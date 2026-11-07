import {
  Component,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import { storeFlag, storedFlag } from '../view-prefs';

export interface LiveFeedOptions<T> {
  /** Names the feed for the saved Follow newest choice, such as `network`. */
  name: string;
  /** The live list, before any filter. */
  source: () => readonly T[];
  /** A stable id of an entry, to count what arrived during a pause. */
  key: (item: T) => string | number;
  /** Which end of the list holds the newest entry. Defaults to `first`. */
  newest?: 'first' | 'last';
  /**
   * What the list belongs to, such as the selected page. A paused feed that
   * switches to another one holds that one's entries instead.
   */
  scope?: () => unknown;
}

/** What the controls and {@link followNewest} need from a feed, whatever its entries are. */
export interface LiveFeedState {
  readonly paused: Signal<boolean>;
  readonly pending: Signal<number>;
  readonly newestKey: Signal<string | number | undefined>;
  readonly follow: Signal<boolean>;
  toggle(): void;
  setFollow(on: boolean): void;
}

/**
 * A live list that the viewer can pause. While paused, `items` keeps the
 * entries it had and `pending` counts the ones that arrived since; resuming
 * shows them all. `follow` is the viewer's Follow newest choice, saved per feed.
 *
 * Create it in a component's injection context and read `items` where the
 * page read its live list, so filters still apply on top.
 */
export class LiveFeed<T> implements LiveFeedState {
  private readonly held: ReturnType<typeof linkedSignal<unknown, readonly T[] | null>>;
  private readonly followed: ReturnType<typeof signal<boolean>>;

  /** The entries to show: the held ones while paused, else the live ones. */
  readonly items: Signal<readonly T[]>;
  readonly paused: Signal<boolean>;
  /** How many entries arrived since the pause. */
  readonly pending: Signal<number>;
  /** The id of the newest entry shown. */
  readonly newestKey: Signal<string | number | undefined>;
  readonly follow: Signal<boolean>;

  constructor(private readonly options: LiveFeedOptions<T>) {
    // A computed, so a scope that reads other signals moves on only when its value changes.
    const scope = computed(() => options.scope?.());
    this.held = linkedSignal<unknown, readonly T[] | null>({
      source: scope,
      // A pause outlives a switch to another page or store: it holds that one's entries.
      computation: (_scope, previous) => (previous?.value ? untracked(options.source) : null),
    });
    this.followed = signal(storedFlag(`follow:${options.name}`) ?? false);
    this.follow = this.followed.asReadonly();
    this.items = computed(() => this.held() ?? options.source());
    this.paused = computed(() => this.held() !== null);
    this.pending = computed(() => {
      const held = this.held();
      if (!held) return 0;
      const seen = new Set(held.map(options.key));
      return options.source().filter((item) => !seen.has(options.key(item))).length;
    });
    this.newestKey = computed(() => {
      const items = this.items();
      const item = options.newest === 'last' ? items.at(-1) : items[0];
      return item === undefined ? undefined : options.key(item);
    });
  }

  pause() {
    if (!this.paused()) this.held.set([...untracked(this.options.source)]);
  }

  resume() {
    this.held.set(null);
  }

  toggle() {
    if (this.paused()) this.resume();
    else this.pause();
  }

  setFollow(on: boolean) {
    this.followed.set(on);
    storeFlag(`follow:${this.options.name}`, on);
  }
}

/**
 * Calls `scroll` after the render that shows a new newest entry, while
 * Follow newest is on, and once when the viewer turns it on. Call it in a
 * component's injection context.
 */
export function followNewest(feed: LiveFeedState, scroll: () => void) {
  const injector = inject(Injector);
  let lastKey: string | number | undefined;
  let lastFollow = false;
  let primed = false;
  effect(() => {
    const key = feed.newestKey();
    const follow = feed.follow();
    const changed = primed && key !== undefined && key !== lastKey;
    if (follow && (changed || !lastFollow)) afterNextRender(scroll, { injector });
    lastKey = key;
    lastFollow = follow;
    primed = true;
  });
}

/**
 * Pause and Follow newest controls for a {@link LiveFeed}. The count of held
 * entries is not a live region; the toggle says what happened once, when the
 * viewer presses it.
 */
@Component({
  selector: 'app-live-controls',
  template: `
    <div class="live" role="group" [attr.aria-label]="'Live ' + what()">
      <button
        type="button"
        class="pause"
        [attr.aria-pressed]="feed().paused()"
        [attr.aria-describedby]="feed().paused() ? pendingId : null"
        (click)="toggle()"
      >
        <span class="icon" [attr.data-paused]="feed().paused()" aria-hidden="true"></span>
        Pause
      </button>
      @if (feed().paused()) {
        <span class="pending" [id]="pendingId">{{ pendingText() }}</span>
      }
      <label class="check">
        <input
          type="checkbox"
          [checked]="feed().follow()"
          (change)="feed().setFollow($any($event.target).checked)"
        />
        Follow newest
      </label>
      <p class="sr-only" role="status">{{ announcement() }}</p>
    </div>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: contents;
    }
    .live {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 6px 12px;
      align-items: center;
      min-width: 0;
    }
    .pause {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      transition:
        background-color 0.15s var(--ease),
        border-color 0.15s var(--ease);
    }
    .pause:hover {
      background: var(--surface-3);
    }
    .pause[aria-pressed='true'] {
      border-color: var(--accent-line);
      background: var(--accent-soft);
      color: var(--text-strong);
    }
    .pause:focus-visible {
      @include m.focus-ring;
    }
    .icon {
      flex: none;
      width: 10px;
      height: 10px;
      border-right: 3px solid currentColor;
      border-left: 3px solid currentColor;
      box-sizing: border-box;
    }
    .icon[data-paused='true'] {
      width: 0;
      height: 0;
      border-top: 5px solid transparent;
      border-right: 0;
      border-bottom: 5px solid transparent;
      border-left: 8px solid currentColor;
    }
    .pending {
      @include m.tint(accent);
      padding: 1px 8px;
      border: 1px solid;
      border-radius: 999px;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .check {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      min-height: var(--control-h);
      color: var(--text-2);
      font-size: 13px;
      cursor: pointer;
      user-select: none;
    }
    .check:hover {
      color: var(--text);
    }
    .check input {
      flex: none;
      width: 14px;
      height: 14px;
      margin: 0;
      accent-color: var(--accent);
      cursor: pointer;
    }
    .check input:focus-visible {
      @include m.focus-ring;
    }
  `,
})
export class LiveControls {
  private static nextId = 0;
  readonly feed = input.required<LiveFeedState>();
  /** The entries, plural and lowercase, such as `navigations`. */
  readonly what = input.required<string>();
  protected readonly pendingId = `live-pending-${LiveControls.nextId++}`;
  protected readonly announcement = signal('');

  protected readonly pendingText = computed(() => {
    const count = this.feed().pending();
    return count ? `${count} new` : `No new ${this.what()}`;
  });

  toggle() {
    const feed = this.feed();
    const count = feed.pending();
    feed.toggle();
    this.announcement.set(
      feed.paused()
        ? `Paused. New ${this.what()} wait until you resume.`
        : count
          ? `Resumed with ${count} new ${this.what()}.`
          : 'Resumed.',
    );
  }
}
