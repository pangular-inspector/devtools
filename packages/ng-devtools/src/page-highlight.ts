// The box drawn over an element of the app when the panel or an agent points at it.

let highlightEl: HTMLElement | null = null;
let highlightTimer: ReturnType<typeof setTimeout> | undefined;
let highlightFrame = 0;

/** How long a box stays when nothing clears it, such as a lost clear from the panel. */
export const HIGHLIGHT_SAFETY_MS = 60_000;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const empty = (rect: Box) => rect.width === 0 && rect.height === 0;

/**
 * Where an element is drawn. A host with `display: contents` or one that is
 * hidden has an empty rect, so its children stand in for it; `null` when
 * nothing of it is on the page.
 */
export function highlightBox(el: Element): Box | null {
  const rect = el.getBoundingClientRect();
  if (!empty(rect))
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const child of Array.from(el.children)) {
    const box = highlightBox(child);
    if (!box) continue;
    top = Math.min(top, box.top);
    left = Math.min(left, box.left);
    right = Math.max(right, box.left + box.width);
    bottom = Math.max(bottom, box.top + box.height);
  }
  return top === Infinity ? null : { top, left, width: right - left, height: bottom - top };
}

/**
 * Draws the box over `el` until `clearHighlight()` or `durationMs` (default
 * `HIGHLIGHT_SAFETY_MS`), and returns whether anything was drawn. `reveal`
 * scrolls it into view first, for an explicit request rather than a hover.
 */
export function showHighlight(
  el: Element,
  options: { reveal?: boolean; durationMs?: number } = {},
): boolean {
  clearHighlight();
  const first = highlightBox(el);
  if (!first) return false;
  if (options.reveal) {
    try {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } catch {
      // an element with no box of its own may refuse; the box still shows
    }
  }
  const box = document.createElement('div');
  highlightEl = box;
  Object.assign(box.style, {
    position: 'fixed',
    inset: 'auto',
    margin: '0',
    padding: '0',
    overflow: 'visible',
    background: 'rgba(245, 165, 36, 0.12)',
    border: '2px solid rgba(245, 165, 36, 0.9)',
    borderRadius: '4px',
    pointerEvents: 'none',
    zIndex: '2147483645',
  } satisfies Partial<CSSStyleDeclaration>);
  // Dialogs, popovers and CDK overlays paint above any z-index; a popover shown
  // after them paints above them.
  const topLayer = typeof box.showPopover === 'function';
  if (topLayer) box.setAttribute('popover', 'manual');
  document.body.appendChild(box);
  if (topLayer) {
    try {
      box.showPopover();
    } catch {
      // keeps the z-index
    }
  }
  const follow = () => {
    if (highlightEl !== box) return;
    const rect = highlightBox(el);
    Object.assign(box.style, {
      display: rect ? 'block' : 'none',
      top: `${rect?.top ?? 0}px`,
      left: `${rect?.left ?? 0}px`,
      width: `${rect?.width ?? 0}px`,
      height: `${rect?.height ?? 0}px`,
    });
    highlightFrame = requestAnimationFrame(follow);
  };
  follow();
  const duration = options.durationMs;
  highlightTimer = setTimeout(
    clearHighlight,
    typeof duration === 'number' && duration > 0
      ? Math.min(duration, HIGHLIGHT_SAFETY_MS)
      : HIGHLIGHT_SAFETY_MS,
  );
  return true;
}

export function clearHighlight() {
  clearTimeout(highlightTimer);
  cancelAnimationFrame(highlightFrame);
  highlightEl?.remove();
  highlightEl = null;
}
