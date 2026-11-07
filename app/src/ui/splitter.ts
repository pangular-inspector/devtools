import { Component, computed, input, model, signal } from '@angular/core';

const PANE_KEY = 'pangular-pref:pane';
/** How far an arrow key moves the splitter, and with Shift held. */
export const SPLITTER_STEP = 16;
export const SPLITTER_STEP_LARGE = 64;

/** The width saved for `view`, or `fallback` when there is none or storage is blocked. */
export function storedPaneSize(view: string, fallback: number): number {
  try {
    const value = Number(localStorage.getItem(`${PANE_KEY}:${view}`));
    return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
  } catch {
    return fallback;
  }
}

/** Saves the width of `view`; `null` forgets it. */
export function storePaneSize(view: string, size: number | null) {
  try {
    if (size === null) localStorage.removeItem(`${PANE_KEY}:${view}`);
    else localStorage.setItem(`${PANE_KEY}:${view}`, String(Math.round(size)));
  } catch {
    // Blocked storage only forgets the width on the next reload.
  }
}

/**
 * A bar between a list and its detail that sets the width of one of them.
 * `pane` says which: the one before the bar (`before`, dragging right makes
 * it wider) or after it (`after`, dragging left makes it wider). It is a
 * focusable separator, so the arrow keys, Home and End resize it too, and a
 * double click resets it. The page binds `size` to the pane's grid column,
 * and hides the bar where the panes stack.
 */
@Component({
  selector: 'app-splitter',
  template: `<span class="grip" aria-hidden="true"></span>`,
  host: {
    role: 'separator',
    tabindex: '0',
    'aria-orientation': 'vertical',
    '[attr.aria-label]': 'label()',
    '[attr.aria-controls]': 'controls()',
    '[attr.aria-valuenow]': 'size()',
    '[attr.aria-valuemin]': 'min()',
    '[attr.aria-valuemax]': 'max()',
    '[attr.aria-valuetext]': 'valueText()',
    title: 'Drag or use the arrow keys to resize. Double click to reset the width.',
    '[class.dragging]': 'dragging()',
    '(keydown)': 'onKey($event)',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerEnd($event)',
    '(pointercancel)': 'onPointerEnd($event)',
    '(dblclick)': 'reset()',
  },
  styles: `
    @use 'mixins' as m;

    :host {
      position: relative;
      display: block;
      align-self: stretch;
      width: 12px;
      min-height: 32px;
      margin: 0 -4px;
      border-radius: var(--radius-sm);
      cursor: col-resize;
      touch-action: none;
    }
    .grip {
      position: absolute;
      inset: 0 auto 0 50%;
      width: 2px;
      transform: translateX(-50%);
      border-radius: 1px;
      background: var(--control-border);
      transition: background 150ms var(--ease);
    }
    :host(:hover) .grip,
    :host(.dragging) .grip {
      background: var(--accent);
    }
    :host(:focus-visible) {
      @include m.focus-ring(-2px);
    }
    :host(:focus-visible) .grip {
      background: var(--accent);
    }
    @media (prefers-reduced-motion: reduce) {
      .grip {
        transition: none;
      }
    }
  `,
})
export class Splitter {
  /** The view the width is saved for. */
  readonly view = input.required<string>();
  /** Which pane the bar sizes: the one before it or the one after it. */
  readonly pane = input<'before' | 'after'>('after');
  readonly size = model.required<number>();
  readonly min = input(240);
  readonly max = input(720);
  /** The width a double click goes back to. */
  readonly defaultSize = input(380);
  readonly label = input('Resize the detail panel');
  /** The id of the pane it sizes. */
  readonly controls = input<string | null>(null);

  protected readonly valueText = computed(() => `${this.size()} pixels wide`);
  protected readonly dragging = signal(false);
  private start: { x: number; size: number } | null = null;

  private clamp(size: number) {
    return Math.round(Math.min(this.max(), Math.max(this.min(), size)));
  }

  private set(size: number, save = true) {
    const next = this.clamp(size);
    if (next !== this.size()) this.size.set(next);
    if (save) storePaneSize(this.view(), next);
  }

  /** Arrow keys move the bar, so for the pane after it, right makes it narrower. */
  protected onKey(event: KeyboardEvent) {
    const step = event.shiftKey ? SPLITTER_STEP_LARGE : SPLITTER_STEP;
    const grow = this.pane() === 'before' ? 1 : -1;
    const by: Record<string, number> = {
      ArrowLeft: -step * grow,
      ArrowRight: step * grow,
    };
    if (event.key in by) {
      event.preventDefault();
      this.set(this.size() + by[event.key]!);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this.set(event.key === 'Home' ? this.min() : this.max());
    }
  }

  protected onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    this.start = { x: event.clientX, size: this.size() };
    this.dragging.set(true);
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent) {
    if (!this.start) return;
    const delta = event.clientX - this.start.x;
    this.set(this.start.size + (this.pane() === 'before' ? delta : -delta), false);
  }

  protected onPointerEnd(event: PointerEvent) {
    if (!this.start) return;
    this.start = null;
    this.dragging.set(false);
    (event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
    storePaneSize(this.view(), this.size());
  }

  reset() {
    this.size.set(this.clamp(this.defaultSize()));
    storePaneSize(this.view(), null);
  }
}
