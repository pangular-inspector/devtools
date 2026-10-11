import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

const KEYS = ['ArrowDown', 'ArrowUp', 'Home', 'End'];

/** An item the page marks as chosen, which is where Tab lands in the list. */
const SELECTED =
  '[aria-pressed="true"], [aria-expanded="true"], [aria-current]:not([aria-current="false"]), .selected';

/**
 * Makes a long list one Tab stop. Only the current item is in the Tab order,
 * and ArrowUp, ArrowDown, Home and End move focus between the items that
 * `appRovingList` selects. The current item is the one last focused, or else
 * the selected one, or else the first.
 */
@Directive({
  selector: '[appRovingList]',
  host: {
    '(keydown)': 'onKey($event)',
    '(focusin)': 'onFocusIn($event)',
  },
})
export class RovingList {
  /** The CSS selector of the list's focusable items, such as `button.row`. */
  readonly appRovingList = input.required<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private current: HTMLElement | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.sync();
      if (typeof MutationObserver === 'undefined') return;
      // Rows come and go as data arrives; only added or removed nodes matter.
      const observer = new MutationObserver(() => this.sync());
      observer.observe(this.host, { childList: true, subtree: true });
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private items(): HTMLElement[] {
    return [...this.host.querySelectorAll<HTMLElement>(this.appRovingList())];
  }

  /** Keeps exactly one item in the Tab order. */
  private sync() {
    const items = this.items();
    if (!this.current || !this.host.contains(this.current)) {
      this.current = items.find((item) => item.matches(SELECTED)) ?? items[0] ?? null;
    }
    for (const item of items) {
      const tabIndex = item === this.current ? '0' : '-1';
      if (item.getAttribute('tabindex') !== tabIndex) item.setAttribute('tabindex', tabIndex);
    }
  }

  onFocusIn(event: FocusEvent) {
    const target = event.target as HTMLElement | null;
    if (!target?.matches(this.appRovingList()) || target === this.current) return;
    this.current?.setAttribute('tabindex', '-1');
    this.current = target;
    target.setAttribute('tabindex', '0');
  }

  onKey(event: KeyboardEvent) {
    if (!KEYS.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    if (!target?.matches(this.appRovingList())) return;
    const items = this.items();
    const at = items.indexOf(target);
    if (at < 0) return;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(at + 1, items.length - 1),
      ArrowUp: Math.max(at - 1, 0),
      Home: 0,
      End: items.length - 1,
    };
    const next = moves[event.key];
    event.preventDefault();
    items[next].focus();
  }
}
