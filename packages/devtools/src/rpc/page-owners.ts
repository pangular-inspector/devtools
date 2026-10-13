import { trackPageSessions } from './page-sessions.ts';
import { HIDDEN_PAGE_TTL_MS, type PageTtl } from './page-ttl.ts';

/** Longest page key the server keeps. The overlay sends 32 hex characters. */
const MAX_KEY_LENGTH = 100;

interface Owner {
  /** The connection that reports the page, or `null` once it closed. */
  session: number | null;
  /** The secret the page minted with its id, once it showed one. */
  key?: string;
  /** When the owner last reported, pinged or claimed the page. */
  seenAt: number;
}

export interface PageOwners {
  /**
   * The overlay shows the secret it minted with its `pageId`. A connection
   * that shows the page's secret takes the page over at once, so a reloaded
   * tab gets its own `pageId` back before the old connection is seen closing.
   * Returns whether the claim was accepted.
   */
  claim(pageId: string, key: unknown): boolean;
  /**
   * Whether the current RPC call may push or ping `pageId`. The first
   * connection to report a page owns it. Another connection takes it over
   * only when the owner closed or went quiet past the page expiry.
   */
  write(pageId: string): boolean;
  /** Whether the current RPC call may forget `pageId`; when it may, the page is released. */
  forget(pageId: string): boolean;
  /** Whether `pageId` reported or pinged within its expiry on a connection that is still open. */
  alive(pageId: string, now?: number): boolean;
  /** Drops owners that have been quiet for long, so the map does not grow. */
  expire(now?: number): void;
}

/**
 * One owner per `pageId`, shared by every inspector, so one connection can't
 * overwrite or remove the pages of another. Calls made outside an RPC request
 * (in-process, from the server itself) are always allowed.
 */
export function createPageOwners(host: unknown, ttl: PageTtl): PageOwners {
  const owners = new Map<string, Owner>();
  const sessions = trackPageSessions(host, (pageIds) => {
    for (const pageId of pageIds) {
      const owner = owners.get(pageId);
      if (owner) owner.session = null;
    }
  });

  const gone = (pageId: string, owner: Owner, now: number) =>
    owner.session === null || now - owner.seenAt > ttl(pageId);

  const take = (pageId: string, session: number, now: number, key = owners.get(pageId)?.key) => {
    owners.set(pageId, { session, seenAt: now, ...(key ? { key } : {}) });
    sessions.bind(pageId);
  };

  return {
    claim(pageId, key) {
      if (typeof key !== 'string' || !key || key.length > MAX_KEY_LENGTH) return false;
      const session = sessions.session();
      if (session === undefined) return true;
      const now = Date.now();
      const owner = owners.get(pageId);
      if (!owner || owner.key === key || owner.session === session || gone(pageId, owner, now)) {
        take(pageId, session, now, key);
        return true;
      }
      return false;
    },
    write(pageId) {
      const session = sessions.session();
      if (session === undefined) return true;
      const now = Date.now();
      const owner = owners.get(pageId);
      if (owner?.session === session) {
        owner.seenAt = now;
        return true;
      }
      if (owner && !gone(pageId, owner, now)) return false;
      take(pageId, session, now);
      return true;
    },
    forget(pageId) {
      const session = sessions.session();
      if (session === undefined) {
        owners.delete(pageId);
        return true;
      }
      const owner = owners.get(pageId);
      if (owner && owner.session !== session && !gone(pageId, owner, Date.now())) return false;
      owners.delete(pageId);
      sessions.unbind(pageId);
      return true;
    },
    alive(pageId, now = Date.now()) {
      const owner = owners.get(pageId);
      return !!owner && !gone(pageId, owner, now);
    },
    expire(now = Date.now()) {
      for (const [pageId, owner] of owners) {
        if (now - owner.seenAt > Math.max(ttl(pageId), HIDDEN_PAGE_TTL_MS)) {
          owners.delete(pageId);
          sessions.unbind(pageId);
        }
      }
    },
  };
}
