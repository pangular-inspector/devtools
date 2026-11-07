import { signal } from '@angular/core';

/** How long a changed value keeps its outline, in ms. */
export const FLASH_MS = 1000;

/** The keys whose text differs between two reads; a key that is new or gone is not a change. */
export function changedKeys(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): string[] {
  const changed: string[] = [];
  for (const [key, text] of after) {
    const old = before.get(key);
    if (old !== undefined && old !== text) changed.push(key);
  }
  return changed;
}

function textOf(value: unknown): string {
  try {
    return JSON.stringify(value) ?? 'undefined';
  } catch {
    return String(value);
  }
}

/**
 * Which values of the selected component changed in the last push. Each one
 * stays in `changed` for {@link FLASH_MS}, so the detail can outline it. A
 * new component, or a new page, starts over without flashing anything.
 */
export class ValueFlash {
  readonly changed = signal<ReadonlySet<string>>(new Set());
  private owner: string | null = null;
  private last = new Map<string, string>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly ms = FLASH_MS) {}

  /** Reads the values of `owner` (a page and component id) as `key -> value`. */
  update(owner: string | null, values: ReadonlyMap<string, unknown>) {
    const texts = new Map([...values].map(([key, value]) => [key, textOf(value)]));
    if (owner !== this.owner) {
      this.clear();
      this.owner = owner;
      this.last = texts;
      return;
    }
    const changed = changedKeys(this.last, texts);
    this.last = texts;
    if (!changed.length) return;
    this.changed.update((set) => new Set([...set, ...changed]));
    for (const key of changed) {
      clearTimeout(this.timers.get(key));
      this.timers.set(
        key,
        setTimeout(() => {
          this.timers.delete(key);
          this.changed.update((set) => {
            const next = new Set(set);
            next.delete(key);
            return next;
          });
        }, this.ms),
      );
    }
  }

  clear() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    if (this.changed().size) this.changed.set(new Set());
  }
}

/** The key of one value in the detail: `input:name`, `property:name`, `directive:0:name`. */
export function flashKey(section: 'input' | 'property' | 'directive', name: string, index = 0) {
  return section === 'directive' ? `directive:${index}:${name}` : `${section}:${name}`;
}
