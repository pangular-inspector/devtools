import { Service, effect, inject, untracked, type WritableSignal } from '@angular/core';
import { hostPageId } from './page-id';

const MEMORY_KEY = 'pangular-view';

/**
 * Where each view was: the scroll position of the panel and the selected
 * item of a page, per view, tab and inspected page. It lives in
 * `sessionStorage`, so switching tabs and reloading the popup or the
 * extension comes back to the same place, and a copy stays in memory for
 * when storage is blocked.
 */
@Service()
export class ViewMemory {
  private readonly values = new Map<string, unknown>();
  private view: () => string = () => 'panel';

  /** Follows the panel view (`angular`, `analog` and so on); the shell sets it. */
  useView(view: () => string) {
    this.view = view;
  }

  private key(name: string) {
    return `${MEMORY_KEY}:${untracked(this.view)}:${hostPageId() ?? ''}:${name}`;
  }

  read<T>(name: string): T | undefined {
    const key = this.key(name);
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch {
      // Blocked or unreadable storage falls back to the copy in memory.
      return this.values.get(key) as T | undefined;
    }
  }

  write(name: string, value: unknown) {
    const key = this.key(name);
    try {
      if (value === null || value === undefined) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Blocked storage keeps a copy in memory, which lasts until the panel reloads.
      this.values.set(key, value);
    }
  }
}

/**
 * Keeps a page's selection across tab switches and reloads: sets `value` to
 * what was selected last time, then saves every change. Call it in the
 * page's injection context, after the signal exists. The value must be plain
 * JSON, such as an id.
 */
export function rememberSelection<T>(tab: string, value: WritableSignal<T>, name = 'selection') {
  const memory = inject(ViewMemory);
  const key = `${tab}:${name}`;
  const saved = memory.read<T>(key);
  if (saved !== undefined && saved !== null) value.set(saved);
  effect(() => memory.write(key, value()));
}

/**
 * Scrolls `el` back to `top` as the content grows to reach it, for up to
 * `frames` animation frames. Stops early when the user scrolls, clicks or
 * types. Calls `onEnd` once it stops, for whatever reason. Returns a
 * function that stops it.
 */
export function restoreScroll(
  el: HTMLElement,
  top: number,
  frames = 120,
  onEnd?: () => void,
): () => void {
  let left = frames;
  let frame = 0;
  let done = false;
  const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;
  const stop = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    for (const type of inputs) el.removeEventListener(type, stop);
    onEnd?.();
  };
  for (const type of inputs) el.addEventListener(type, stop, { passive: true });
  const step = () => {
    if (done) return;
    el.scrollTop = top;
    if (Math.abs(el.scrollTop - top) < 2 || --left <= 0) stop();
    else frame = requestAnimationFrame(step);
  };
  if (top > 0) {
    step();
  } else {
    el.scrollTop = 0;
    stop();
  }
  return stop;
}
