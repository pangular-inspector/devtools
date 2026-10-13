import {
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  type Signal,
} from '@angular/core';

/** Lists at or below this many rows render every row, so the browser's find sees them all. */
export const WINDOW_MIN = 300;
/** Rows rendered above and below the visible ones. */
const OVERSCAN = 12;
/** The viewport assumed before the first measure, and where nothing can be measured. */
const DEFAULT_VIEWPORT = 900;

export interface VirtualWindowOptions {
  /** How many rows the whole list has. */
  count: Signal<number>;
  /** Estimated row height in px, replaced by the measured average once rows render. */
  estimate: number;
  /** Render every row up to this count. Defaults to {@link WINDOW_MIN}. */
  min?: number;
  /** True when every row has the estimated height, so nothing needs measuring. */
  fixed?: boolean;
}

export interface WindowRange {
  start: number;
  end: number;
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(style.overflowY)) return node;
  }
  return null;
}

/**
 * Windowing for a long list or tree: only the rows near the visible part of
 * the scroll container render, with space above and below standing in for
 * the rest. Short lists render whole. Rows carry `data-vindex`, their index
 * in the whole list, so the average height can be measured.
 *
 * Create it in a component's injection context, give `range` to the
 * template and `attach` the list element once it exists.
 */
export class VirtualWindow {
  private readonly injector = inject(Injector);
  private readonly visibleTop = signal(0);
  private readonly viewport = signal(DEFAULT_VIEWPORT);
  private readonly rowHeight: ReturnType<typeof signal<number>>;
  private host: HTMLElement | null = null;
  private scroller: HTMLElement | null = null;
  private detach: (() => void) | null = null;

  /** Whether the list is long enough to window. */
  readonly enabled: Signal<boolean>;
  /** The rows to render, `end` excluded. */
  readonly range: Signal<WindowRange>;
  /** Space standing in for the rows above and below the range, in px. */
  readonly padTop: Signal<number>;
  readonly padBottom: Signal<number>;

  constructor(private readonly options: VirtualWindowOptions) {
    this.rowHeight = signal(options.estimate);
    const min = options.min ?? WINDOW_MIN;
    this.enabled = computed(() => options.count() > min);
    this.range = computed(() => {
      const count = options.count();
      if (!this.enabled()) return { start: 0, end: count };
      const height = this.rowHeight();
      const viewport = this.viewport();
      // A list that just got shorter can leave the last scroll position past
      // its end; the window then shows the last rows instead of none.
      const top = Math.max(0, Math.min(this.visibleTop(), count * height - viewport));
      const start = Math.max(0, Math.min(count - 1, Math.floor(top / height) - OVERSCAN));
      const end = Math.min(count, Math.max(start, Math.ceil((top + viewport) / height) + OVERSCAN));
      return { start, end };
    });
    this.padTop = computed(() => (this.enabled() ? this.range().start * this.rowHeight() : 0));
    this.padBottom = computed(() =>
      this.enabled() ? (options.count() - this.range().end) * this.rowHeight() : 0,
    );
    // When the row count changes the browser may move the scroll position
    // (a shorter list can't scroll as far) without a scroll event: read it again.
    effect(() => {
      options.count();
      afterNextRender(() => this.update(), { injector: this.injector });
    });
    inject(DestroyRef).onDestroy(() => this.detach?.());
  }

  /** How many rows the whole list has. */
  get count(): number {
    return this.options.count();
  }

  /** Whether row `index` is rendered now. */
  rendered(index: number): boolean {
    const { start, end } = this.range();
    return index >= start && index < end;
  }

  /**
   * Follows the scrolling of `host`, the element that holds the rows. When
   * it scrolls itself it is the scroll container; otherwise the nearest
   * scrolling ancestor is, or the page.
   */
  attach(host: HTMLElement) {
    if (this.host === host) return;
    this.detach?.();
    this.host = host;
    // The browser's scroll anchoring would follow rows the window replaces and
    // jump the list; the window keeps the position itself.
    host.style.overflowAnchor = 'none';
    // The reduced motion baseline gives every property a tiny transition, so the
    // spacing would keep its old value for a frame and focus would scroll to it.
    host.style.transitionProperty = 'none';
    const own = /(auto|scroll|overlay)/.test(getComputedStyle(host).overflowY);
    this.scroller = own ? host : scrollParent(host);
    const target: HTMLElement | Window = this.scroller ?? window;
    const update = () => this.update();
    target.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    this.detach = () => {
      target.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
    this.update();
  }

  /** Reads where the list is in its scroll container, and the row height. */
  update() {
    const host = this.host;
    if (!host) return;
    if (this.scroller === host) {
      this.place(host.scrollTop, host.clientHeight);
    } else {
      const top = this.scroller ? this.scroller.getBoundingClientRect().top : 0;
      const height = this.scroller ? this.scroller.clientHeight : window.innerHeight;
      this.place(top - host.getBoundingClientRect().top, height);
    }
    if (!this.options.fixed) this.measure();
  }

  /** Sets the visible part of the list directly: `top` px from its start, `height` px tall. */
  place(top: number, height: number) {
    this.visibleTop.set(top);
    // A layout that measures nothing (hidden, or a test without layout) keeps the default.
    this.viewport.set(height > 0 ? height : DEFAULT_VIEWPORT);
  }

  private measure() {
    const rows = this.host?.querySelectorAll<HTMLElement>('[data-vindex]');
    if (!rows || rows.length < 2) return;
    const first = rows[0]!.getBoundingClientRect();
    const last = rows[rows.length - 1]!.getBoundingClientRect();
    const average = (last.bottom - first.top) / rows.length;
    if (average > 4 && Math.abs(average - this.rowHeight()) > 1) this.rowHeight.set(average);
  }

  /**
   * Brings row `index` into the window and calls `then` once it rendered,
   * such as to focus it. Scrolls the container to it when the list windows.
   */
  reveal(index: number, then?: () => void) {
    if (this.enabled() && !this.rendered(index)) {
      const top = index * this.rowHeight();
      const height = this.viewport();
      const wanted = Math.max(0, top - height / 2);
      this.place(wanted, height);
      if (this.host && this.scroller === this.host) this.host.scrollTop = wanted;
      else if (this.host) {
        const base = this.scroller ? this.scroller.getBoundingClientRect().top : 0;
        const delta = this.host.getBoundingClientRect().top - base + wanted;
        if (this.scroller) this.scroller.scrollTop += delta;
        else window.scrollBy(0, delta);
      }
    }
    if (then) afterNextRender(then, { injector: this.injector });
  }
}
