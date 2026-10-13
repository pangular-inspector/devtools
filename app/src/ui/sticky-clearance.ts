/** The nearest ancestor that scrolls vertically, or `null` when the page itself scrolls. */
export function scrollParent(el: Element): HTMLElement | null {
  const view = el.ownerDocument.defaultView;
  if (!view) return null;
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    if (parent === el.ownerDocument.documentElement || parent === el.ownerDocument.body) break;
    if (/(auto|scroll|overlay)/.test(view.getComputedStyle(parent).overflowY)) return parent;
  }
  return null;
}

const px = (value: string) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * The `scroll-margin-top` an item needs so `scrollIntoView` leaves it `gap`
 * pixels below a stuck `position: sticky` bar in the same scroller.
 *
 * A sticky bar sticks inside its scroll container's padding (`top: 0` sits
 * `padding-top` below the scrollport edge), while `scrollIntoView` lines an
 * item up with the scrollport edge plus `scroll-padding-top`. So the margin
 * is the container's padding, the bar's `top` and its height, less the
 * container's scroll padding.
 */
export function stickyClearance(sticky: HTMLElement, gap = 8): number {
  const view = sticky.ownerDocument.defaultView;
  if (!view) return sticky.offsetHeight + gap;
  const scroller = scrollParent(sticky);
  const box = scroller ? view.getComputedStyle(scroller) : null;
  const padding = box ? px(box.paddingTop) : 0;
  const scrollPadding = box ? px(box.scrollPaddingTop) : 0;
  const top = px(view.getComputedStyle(sticky).top);
  return Math.max(0, Math.ceil(padding + top + sticky.offsetHeight + gap - scrollPadding));
}

/**
 * Scrolls `item`'s scroller so the item sits at least `gap` pixels below the
 * stuck `sticky` bar. `scrollIntoView({ block: 'nearest' })` treats an item
 * the bar covers as already visible, so it is measured and corrected here.
 */
export function keepBelowSticky(item: HTMLElement, sticky: HTMLElement, gap = 8): void {
  const scroller = scrollParent(item);
  const overlap = sticky.getBoundingClientRect().bottom + gap - item.getBoundingClientRect().top;
  if (overlap <= 0) return;
  if (scroller) scroller.scrollTop -= overlap;
  else item.ownerDocument.defaultView?.scrollBy(0, -overlap);
}
