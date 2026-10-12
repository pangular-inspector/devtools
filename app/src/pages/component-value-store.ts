import { signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { FIRST_LIMIT, LOAD_STEP, MAX_LIMIT, pathKey } from './component-value-state';

/** Whether the level `key` is inside the level `parent` (both from `pathKey`). */
function isBelow(key: string, parent: string): boolean {
  return key.length > parent.length && key.startsWith(`${parent.slice(0, -1)},`);
}

interface ValueAnswer {
  ok?: boolean;
  value?: unknown;
  error?: string;
}

export interface ValueTarget {
  rpc: DevframeRpcClient | null;
  pageId: string | null;
  componentId: string | null;
}

/**
 * The nested value levels of the selected component: which ones are open,
 * what each holds and how many entries it lists. The page reads an opened
 * level again on every push (`detail.expanded`), which wins over the answer
 * to the first request, so open levels follow the app.
 */
export class ValueStore {
  private target: ValueTarget = { rpc: null, pageId: null, componentId: null };
  private readonly fetched = signal<ReadonlyMap<string, unknown>>(new Map());
  private readonly pushed = signal<Readonly<Record<string, unknown>>>({});
  readonly open = signal<ReadonlySet<string>>(new Set());
  readonly loading = signal<ReadonlySet<string>>(new Set());
  readonly errors = signal<ReadonlyMap<string, string>>(new Map());
  private readonly limits = new Map<string, number>();
  private generation = 0;

  /** Follows the selected component; another instance or page starts over. */
  follow(target: ValueTarget, expanded: Record<string, unknown> | undefined) {
    const same =
      target.componentId === this.target.componentId && target.pageId === this.target.pageId;
    this.target = target;
    if (!same) {
      this.generation++;
      this.fetched.set(new Map());
      this.open.set(new Set());
      this.loading.set(new Set());
      this.errors.set(new Map());
      this.limits.clear();
    }
    this.pushed.set(expanded ?? {});
  }

  /** The level at a path that the page sent, or `undefined` when none is loaded. */
  level(path: readonly string[], directive?: number): unknown {
    const key = pathKey(path, directive);
    const pushed = this.pushed();
    return Object.hasOwn(pushed, key) ? pushed[key] : this.fetched().get(key);
  }

  isOpen(path: readonly string[], directive?: number): boolean {
    return this.open().has(pathKey(path, directive));
  }

  /** Opens a level; `load` asks the page for it unless the detail already carries it. */
  toggle(path: readonly string[], directive: number | undefined, load: boolean) {
    const key = pathKey(path, directive);
    const open = new Set(this.open());
    if (open.has(key)) {
      // The page stops reading the level and the ones below it, so they close too.
      for (const other of open) if (other === key || isBelow(other, key)) open.delete(other);
      this.open.set(open);
      void this.send({ path, directive, forget: true });
      return;
    }
    open.add(key);
    this.open.set(open);
    if (load) void this.load(path, directive, this.limits.get(key) ?? FIRST_LIMIT);
  }

  /** Lists the next entries of a level. */
  more(path: readonly string[], directive: number | undefined, listed: number) {
    const key = pathKey(path, directive);
    const limit = Math.min(MAX_LIMIT, Math.max(listed, this.limits.get(key) ?? 0) + LOAD_STEP);
    this.limits.set(key, limit);
    void this.load(path, directive, limit);
  }

  /** Reads a value once, without keeping it open: the draft of a whole-value edit. */
  async read(path: readonly string[], depth: number, limit: number): Promise<ValueAnswer> {
    return this.send({ path, depth, limit });
  }

  private async load(path: readonly string[], directive: number | undefined, limit: number) {
    const key = pathKey(path, directive);
    const generation = this.generation;
    this.loading.update((set) => new Set(set).add(key));
    const answer = await this.send({ path, directive, limit, watch: true });
    if (generation !== this.generation) return;
    this.loading.update((set) => {
      const next = new Set(set);
      next.delete(key);
      return next;
    });
    this.errors.update((map) => {
      const next = new Map(map);
      if (answer.ok) next.delete(key);
      else next.set(key, answer.error ?? 'The page did not read it.');
      return next;
    });
    if (answer.ok) this.fetched.update((map) => new Map(map).set(key, answer.value));
  }

  private async send(request: Record<string, unknown>): Promise<ValueAnswer> {
    const { rpc, pageId, componentId } = this.target;
    if (!rpc || !pageId || !componentId) return { error: 'No live page to read from.' };
    const { directive, ...rest } = request;
    try {
      return ((await rpc.scope('pangular').rpc.call('request-component-value', {
        pageId,
        request: {
          id: componentId,
          ...rest,
          ...(directive === undefined ? {} : { directive }),
        },
      })) ?? {}) as ValueAnswer;
    } catch {
      return { error: 'The devtools server did not answer. Try again.' };
    }
  }
}
