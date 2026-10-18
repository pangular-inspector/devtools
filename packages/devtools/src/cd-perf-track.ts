// The "Pangular" track in the Chrome DevTools Performance panel, written with
// the `console.timeStamp` extensibility API.

import { PROFILER_EVENT } from './cd-recorder.ts';
import { createRefreshTracker } from './cd-refresh.ts';
import { hookName, listenerName } from './cd-timing.ts';
import { addProfilerListener, type Profiler } from './change-detection.ts';
import { className } from './injector-tree.ts';

export const PERF_TRACK = 'Pangular';
export const PERF_TRACK_GROUP = 'Pangular Inspector';
/** Open spans past this depth are dropped, in case an end event never comes. */
const MAX_OPEN = 50;

type TimeStamp = (
  label: string,
  start: number,
  end: number,
  track: string,
  group: string,
  color: string,
) => void;

interface Open {
  start: number;
  instance: unknown;
  fn: unknown;
}

const nameOf = (instance: unknown) => {
  const ctor = (instance as { constructor?: unknown } | null)?.constructor;
  return typeof ctor === 'function' ? className(ctor as { name?: string }) : '?';
};

/** `console.timeStamp` when the browser has it; Chrome draws its entries on custom tracks. */
export function consoleTimeStamp(target: Console = console): TimeStamp | null {
  const stamp = (target as unknown as { timeStamp?: unknown }).timeStamp;
  return typeof stamp === 'function' ? (stamp.bind(target) as TimeStamp) : null;
}

/**
 * Writes one entry per component check, lifecycle hook and output listener to
 * the Performance panel while it is on. Off, it has no profiler listener.
 */
export function createCdPerfTrack(options: {
  getNg: () => unknown;
  doc?: Document;
  now?: () => number;
  console?: Console;
}) {
  const now = options.now ?? (() => performance.now());
  let removeListener: (() => void) | null = null;
  let stamp: TimeStamp | null = null;
  let components: number[] = [];
  let hooks: Open[] = [];
  let outputs: Open[] = [];
  // Only checks whose template ran, as the recorder counts them (`cd-refresh.ts`).
  const refresh = createRefreshTracker();

  const push = <T>(stack: T[], entry: T) => {
    stack.push(entry);
    if (stack.length > MAX_OPEN) stack.shift();
  };

  const emit = (label: string, start: number, color: string) => {
    try {
      stamp?.(label, start, now(), PERF_TRACK, PERF_TRACK_GROUP, color);
    } catch {
      // a console that refuses the extra arguments draws nothing
    }
  };

  const listener: Profiler = (event, instance, fn) => {
    const refreshed = refresh.onEvent(event, instance);
    switch (event) {
      case PROFILER_EVENT.ComponentStart:
        push(components, now());
        return;
      case PROFILER_EVENT.ComponentEnd: {
        const start = components.pop();
        if (start !== undefined && instance && refreshed) emit(nameOf(instance), start, 'primary');
        return;
      }
      case PROFILER_EVENT.LifecycleHookStart:
        push(hooks, { start: now(), instance, fn });
        return;
      case PROFILER_EVENT.LifecycleHookEnd: {
        const open = hooks.pop();
        if (open)
          emit(
            `${nameOf(open.instance)}.${hookName(open.instance, open.fn)}`,
            open.start,
            'secondary',
          );
        return;
      }
      case PROFILER_EVENT.OutputStart:
        push(outputs, { start: now(), instance, fn });
        return;
      case PROFILER_EVENT.OutputEnd: {
        const open = outputs.pop();
        if (!open) return;
        const listener = listenerName(open.fn);
        emit(
          `${nameOf(open.instance)} output${listener ? ` (${listener})` : ''}`,
          open.start,
          'tertiary',
        );
        return;
      }
    }
  };

  return {
    get on() {
      return removeListener !== null;
    },
    /**
     * Turns the track on or off; false when the page has no profiler to listen
     * to or the browser has no `console.timeStamp`.
     */
    set(on: boolean): boolean {
      if (!on) {
        removeListener?.();
        removeListener = null;
        components = [];
        refresh.reset();
        hooks = [];
        outputs = [];
        return true;
      }
      if (removeListener) return true;
      stamp = consoleTimeStamp(options.console);
      if (!stamp) return false;
      removeListener = addProfilerListener(options.getNg(), listener, options.doc);
      return removeListener !== null;
    },
  };
}

export type CdPerfTrack = ReturnType<typeof createCdPerfTrack>;
