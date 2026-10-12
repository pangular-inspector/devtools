interface SessionMeta {
  id?: number;
}

/** The slice of devframe's RPC host used here. `_emitSessionDisconnected` is
 * `@internal` there, but every transport (SSE and WebSocket) calls it the
 * moment a client's connection drops, which is the only signal that fires
 * when a tab is closed — a `pagehide` message often never makes it out. */
interface SessionHost {
  getCurrentRpcSession?: () => { meta?: SessionMeta } | undefined;
  _emitSessionDisconnected?: (meta: SessionMeta) => void;
}

export interface PageSessions {
  /** Remembers which connection the page in the current RPC call came from. */
  bind(pageId: string): void;
  unbind(pageId: string): void;
  /** The id of the connection the current RPC call came from, if any. */
  session(): number | undefined;
}

/** Calls `onGone` with every page whose connection just closed. If the host
 * doesn't expose the hook, this is a no-op and expiry stays the fallback. */
export function trackPageSessions(
  host: unknown,
  onGone: (pageIds: string[]) => void,
): PageSessions {
  const h = host as SessionHost;
  const sessionOf = new Map<string, number>();

  const original = h._emitSessionDisconnected;
  if (typeof original === 'function') {
    h._emitSessionDisconnected = (meta) => {
      original.call(h, meta);
      try {
        const gone = [...sessionOf].filter(([, id]) => id === meta?.id).map(([pageId]) => pageId);
        for (const pageId of gone) sessionOf.delete(pageId);
        if (gone.length) onGone(gone);
      } catch {
        // never break the transport's own disconnect handling
      }
    };
  }

  const session = () => {
    try {
      const id = h.getCurrentRpcSession?.()?.meta?.id;
      return typeof id === 'number' ? id : undefined;
    } catch {
      // called outside an RPC request (e.g. in-process)
      return undefined;
    }
  };

  return {
    bind(pageId) {
      const id = session();
      // Outside an RPC request (e.g. in-process), expiry covers it.
      if (id !== undefined) sessionOf.set(pageId, id);
    },
    unbind(pageId) {
      sessionOf.delete(pageId);
    },
    session,
  };
}
