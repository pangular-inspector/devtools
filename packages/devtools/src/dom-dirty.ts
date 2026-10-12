import type { HostTree } from './host-tree.ts';

/** A cached read is redone at least this often, even when the DOM looks unchanged. */
export const DIRTY_HEARTBEAT_MS = 4000;

export interface DomDirty {
  /** Observes the open shadow roots `tree` walks into, as the walk goes. */
  watch<H extends object>(tree: HostTree<H>): HostTree<H>;
  /**
   * A read that runs again only when elements were added or removed since
   * the last run, `heartbeatMs` passed, or `force` is set. With no
   * `MutationObserver` it always runs. `keep` can refuse to cache a result,
   * such as a tree still hydrating.
   */
  cached<T>(read: () => T, keep?: (value: T) => boolean): (force?: boolean) => T;
  stop(): void;
}

/**
 * Dirty flags for the collectors that walk the DOM: a `MutationObserver` on
 * the document (and the shadow roots walks find) bumps a version whenever
 * elements are added or removed, so a collector can skip the walk while the
 * page's structure stays the same. Text and attribute changes don't count:
 * the component and injector trees are made of elements.
 */
export function createDomDirty(
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
  options: { heartbeatMs?: number; now?: () => number } = {},
): DomDirty {
  const heartbeatMs = options.heartbeatMs ?? DIRTY_HEARTBEAT_MS;
  const now = options.now ?? (() => Date.now());
  let version = 0;
  const observed = new WeakSet<Node>();
  const observer =
    doc && typeof MutationObserver === 'function'
      ? new MutationObserver(() => {
          version++;
        })
      : null;
  const observe = (node: Node) => {
    if (!observer || observed.has(node)) return;
    observed.add(node);
    observer.observe(node, { childList: true, subtree: true });
  };
  if (doc) observe(doc.documentElement ?? doc);

  return {
    watch(tree) {
      if (!observer) return tree;
      return {
        ...tree,
        children(host) {
          const shadow = (host as { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (shadow) observe(shadow);
          return tree.children(host);
        },
      };
    },
    cached(read, keep) {
      let has = false;
      let value: ReturnType<typeof read>;
      let readVersion = -1;
      let readAt = 0;
      return (force = false) => {
        // Records not delivered yet still count.
        if (observer?.takeRecords().length) version++;
        const fresh =
          has && !force && observer && readVersion === version && now() - readAt < heartbeatMs;
        if (fresh) return value;
        readVersion = version;
        readAt = now();
        value = read();
        has = !keep || keep(value);
        return value;
      };
    },
    stop() {
      observer?.disconnect();
    },
  };
}
