import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';
import type { VirtualWindow } from './virtual-window';

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
    '(focusout)': 'onFocusOut($event)',
  },
})
export class RovingList {
  /** The CSS selector of the list's focusable items, such as `button.row`. */
  readonly appRovingList = input('');
  /**
   * The window of a list that renders only the rows near view. Home and End
   * then go to the first and last row of the whole list, rendering it first.
   * Rows carry `data-vindex`.
   */
  readonly rovingWindow = input<VirtualWindow | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private current: HTMLElement | null = null;
  /** Whether focus is in the list, kept when the focused item is removed rather than left. */
  private focusInside = false;

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

  /**
   * Focus can move into the list while its view is still being created,
   * before the selector input is set, so an unset selector matches nothing.
   */
  private isItem(element: HTMLElement | null): element is HTMLElement {
    const selector = this.appRovingList();
    return !!selector && !!element?.matches(selector);
  }

  private items(): HTMLElement[] {
    const selector = this.appRovingList();
    return selector ? [...this.host.querySelectorAll<HTMLElement>(selector)] : [];
  }

  /** Keeps exactly one item in the Tab order. */
  private sync() {
    const items = this.items();
    let refocus = false;
    if (!this.current || !this.host.contains(this.current)) {
      // A removed item that had focus leaves it on the page body, outside the list.
      const active = document.activeElement;
      refocus = this.focusInside && (!active || active === document.body);
      this.current = items.find((item) => item.matches(SELECTED)) ?? items[0] ?? null;
    }
    for (const item of items) {
      const tabIndex = item === this.current ? '0' : '-1';
      if (item.getAttribute('tabindex') !== tabIndex) item.setAttribute('tabindex', tabIndex);
    }
    if (refocus) this.current?.focus();
  }

  onFocusIn(event: FocusEvent) {
    this.focusInside = true;
    const target = event.target as HTMLElement | null;
    if (!this.isItem(target) || target === this.current) return;
    this.current?.setAttribute('tabindex', '-1');
    this.current = target;
    target.setAttribute('tabindex', '0');
  }

  onFocusOut(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (next && this.host.contains(next)) return;
    const target = event.target as HTMLElement | null;
    // Some browsers send focusout when the focused item is removed; that isn't leaving.
    setTimeout(() => {
      if (target?.isConnected !== false && !this.host.contains(document.activeElement)) {
        this.focusInside = false;
      }
    });
  }

  onKey(event: KeyboardEvent) {
    if (!KEYS.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    if (!this.isItem(target)) return;
    const items = this.items();
    const at = items.indexOf(target);
    if (at < 0) return;
    const window = this.rovingWindow();
    if (window?.enabled() && (event.key === 'Home' || event.key === 'End')) {
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : window.count - 1;
      const focus = () => {
        const row = this.host.querySelector(`[data-vindex="${index}"]`);
        const item = row?.matches(this.appRovingList())
          ? row
          : row?.querySelector(this.appRovingList());
        (item as HTMLElement | null | undefined)?.focus();
      };
      if (window.rendered(index)) focus();
      else window.reveal(index, focus);
      return;
    }
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
