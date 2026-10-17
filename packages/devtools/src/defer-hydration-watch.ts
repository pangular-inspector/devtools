/**
 * The attribute Angular puts on elements inside a dehydrated `@defer (hydrate …)`
 * block that waits for an event (`DEFER_BLOCK_SSR_ID_ATTRIBUTE` in @angular/core).
 * Angular removes it, together with `jsaction`, from every element of a block
 * once the block has hydrated (`removeListeners` in `DehydratedBlockRegistry.cleanup`).
 */
export const DEFER_BLOCK_ATTRIBUTE = 'ngb';

export interface DeferHydrationWatch {
  /** Goes up by one each time Angular finishes hydrating one or more blocks. */
  epoch(): number;
  stop(): void;
}

/**
 * Tells when incremental hydration finishes a `@defer (hydrate on …)` block,
 * so the hydration scan can run again right away instead of waiting for the
 * next time bucket. A `MutationObserver` filtered to the `ngb` attribute does
 * the work: it costs nothing while no block hydrates, and never touches the
 * page. Blocks with non-event triggers (viewport, timer, idle, immediate, when)
 * carry no `ngb`; the `ngDevMode` counters or the time bucket cover those.
 */
export function watchDeferHydration(
  onHydrate: () => void,
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
): DeferHydrationWatch {
  let epoch = 0;
  const root = doc?.documentElement;
  if (!root || typeof MutationObserver !== 'function') {
    return { epoch: () => epoch, stop: () => {} };
  }
  const hydrated = (records: MutationRecord[]) =>
    records.some(
      (record) =>
        record.oldValue !== null &&
        record.target instanceof Element &&
        !record.target.hasAttribute(DEFER_BLOCK_ATTRIBUTE),
    );
  const observer = new MutationObserver((records) => {
    if (!hydrated(records)) return;
    epoch++;
    onHydrate();
  });
  observer.observe(root, {
    attributes: true,
    attributeFilter: [DEFER_BLOCK_ATTRIBUTE],
    attributeOldValue: true,
    subtree: true,
  });
  return {
    epoch: () => {
      // Records not delivered yet still count.
      if (hydrated(observer.takeRecords())) epoch++;
      return epoch;
    },
    stop: () => observer.disconnect(),
  };
}
