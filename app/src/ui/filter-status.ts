import { DestroyRef, effect, inject, signal, untracked, type Signal } from '@angular/core';

/**
 * A screen-reader status for a page's "N of M" count that speaks only when the
 * user changes a filter, never when a push from the page changes the numbers.
 *
 * `filters` reads every signal the user controls (search, chips, selects); the
 * count text is read untracked, after `delay` ms, so typing a word announces
 * once. Bind the result to an sr-only `role="status"` element and keep the
 * visible count out of the live region.
 */
export function filterAnnouncement(
  filters: () => unknown,
  text: () => string,
  delay = 600,
): Signal<string> {
  const message = signal('');
  let first = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  effect(() => {
    filters();
    if (first) {
      first = false;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      const next = untracked(text);
      // A trailing no-break space makes a repeated message a new change, so it speaks again.
      message.update((current) => (current === next ? `${next} ` : next));
    }, delay);
  });
  inject(DestroyRef).onDestroy(() => clearTimeout(timer));
  return message.asReadonly();
}
