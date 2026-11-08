import {
  watchRouter,
  type AnyRecord,
  type NavigationRecord,
  type RouterDebugApi,
} from './router.ts';
import {
  captureCallers,
  captureDiagnostics,
  capturePreloads,
  instrument,
  onGuardsCheckStart,
} from './router-actions.ts';
import { ConfigTracker } from './router-config.ts';
import { preloaderOf } from './router-setup.ts';
import type { PreloadRecord } from './router-types.ts';

/** What the overlay watches on one app of a page that runs several. */
export interface AppWatch {
  /** Turns guard and resolver recording on or off for this app. */
  setInstrumented(on: boolean): void;
  /** Stops every watch and unwraps what was wrapped. */
  stop(): void;
}

/**
 * Watches one app's Router as the overlay watches the first app's: its
 * events, who starts each navigation, what the error handler did, the
 * preloads its own preloader runs, and (when on) each guard and resolver run.
 * Everything lands in this app's `navigations` and `preloads`, never another
 * app's.
 */
export function watchApp(
  ng: RouterDebugApi,
  router: AnyRecord,
  root: Element,
  navigations: NavigationRecord[],
  preloads: PreloadRecord[],
  onChange: () => void,
  instrumented: boolean,
): AppWatch {
  const cleanup: (() => void)[] = [];
  const stop = watchRouter(router, navigations, onChange);
  if (stop) cleanup.push(stop);
  let stopInstrument: (() => void) | null = null;
  // Its own tracker: the report's tracker must still see a config change.
  const loaded = new ConfigTracker();
  loaded.update(router);
  const setInstrumented = (on: boolean) => {
    stopInstrument?.();
    stopInstrument = on ? instrument(router, navigations) : null;
  };
  // Lazy routes load during a navigation: wrap their guards before they run.
  cleanup.push(
    onGuardsCheckStart(router, () => {
      if (!stopInstrument || !loaded.update(router)) return;
      const previous = stopInstrument;
      const next = instrument(router, navigations);
      stopInstrument = () => {
        next();
        previous();
      };
    }),
  );
  cleanup.push(captureCallers(router, navigations, ng));
  cleanup.push(captureDiagnostics(router, navigations));
  cleanup.push(capturePreloads(preloaderOf(ng, root), preloads, onChange));
  setInstrumented(instrumented);
  return {
    setInstrumented,
    stop() {
      for (const fn of cleanup) fn();
      cleanup.length = 0;
      stopInstrument?.();
      stopInstrument = null;
    },
  };
}
