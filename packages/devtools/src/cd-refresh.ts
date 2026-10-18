// Which `ComponentStart`/`ComponentEnd` pairs were real checks.
//
// Angular emits the pair in `detectChangesInComponent` for every child
// component of a refreshed view, before `detectChangesInView` decides whether
// to refresh it, so a clean OnPush child that is only walked past gets a pair
// too. Its template runs only when the view is refreshed: `executeTemplate`
// then emits `TemplateUpdateStart` with the component instance as context,
// before any embedded view or child of it. In a dev build `ApplicationRef.tick`
// also runs `checkNoChanges` on every view after the last synchronization pass
// (between `ChangeDetectionSyncEnd` and `ChangeDetectionEnd`); that pass
// changes nothing and is not a check either. Checked against
// `@angular/core/fesm2022/_debug_node-chunk.mjs` (Angular 22).
//
// The recorder, the flash overlay and the Performance track all count with
// this, so they agree with `diagnose-change-detection` (`cd-diagnosis.ts`).

/** Angular's `ProfilerEvent` values the tracker reads. */
const EVENT = {
  TemplateUpdateStart: 2,
  ChangeDetectionStart: 12,
  ChangeDetectionEnd: 13,
  ChangeDetectionSyncStart: 14,
  ChangeDetectionSyncEnd: 15,
  ComponentStart: 18,
  ComponentEnd: 19,
} as const;

/** Open frames past this depth are dropped, in case an end event never comes. */
const MAX_OPEN = 200;
const NONE = Symbol('none');

export interface RefreshTracker {
  /**
   * Feeds one profiler event. For `ComponentEnd` it answers whether that
   * component's own template ran in a real check; for any other event, false.
   */
  onEvent(event: number, instance?: unknown): boolean;
  reset(): void;
}

export function createRefreshTracker(): RefreshTracker {
  let frames: { first: unknown }[] = [];
  /** Open ticks, each with whether the tick it interrupted was in a sync pass. */
  let ticks: boolean[] = [];
  let inSync = false;

  return {
    onEvent(event, instance) {
      switch (event) {
        case EVENT.ChangeDetectionStart:
          ticks.push(inSync);
          if (ticks.length > MAX_OPEN) ticks.shift();
          inSync = false;
          return false;
        case EVENT.ChangeDetectionEnd:
          inSync = ticks.pop() ?? false;
          return false;
        case EVENT.ChangeDetectionSyncStart:
          inSync = true;
          return false;
        case EVENT.ChangeDetectionSyncEnd:
          inSync = false;
          return false;
        case EVENT.ComponentStart:
          frames.push({ first: NONE });
          if (frames.length > MAX_OPEN) frames.shift();
          return false;
        case EVENT.TemplateUpdateStart: {
          const top = frames.at(-1);
          if (top && top.first === NONE) top.first = instance;
          return false;
        }
        case EVENT.ComponentEnd: {
          const frame = frames.pop();
          // Inside a tick, only a synchronization pass counts: what runs after it is checkNoChanges.
          const counted = ticks.length === 0 || inSync;
          return !!frame && !!instance && frame.first === instance && counted;
        }
        default:
          return false;
      }
    },
    reset() {
      frames = [];
      ticks = [];
      inSync = false;
    },
  };
}
