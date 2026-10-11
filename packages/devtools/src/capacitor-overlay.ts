import { capacitorHook, type CapacitorHook, type CapacitorInfo } from './capacitor-collector.ts';
import { keepaliveDue, outsideAngular } from './change-detection.ts';
import { redactMessage, redactUrl } from './router.ts';
import type { CapacitorReport } from './rpc/capacitor-tools.ts';

interface RpcScope {
  rpc: { call(name: string, ...args: unknown[]): Promise<unknown> };
}

type HookWindow = NonNullable<Parameters<typeof capacitorHook>[0]>;

export interface CapacitorOverlayOptions {
  /** Calls kept on the page (`limits.capacitorCalls`). */
  maxCalls: number;
  /** How often to check for changes and keep the page alive (`limits.refreshMs`). */
  tickMs?: number;
  /** The devtools server's `__connection.json` URL, so its own requests stay out of the log. */
  devtoolsUrl?: string;
  win?: { Capacitor?: unknown };
  /** For the hidden-tab pause. Defaults to `document` when there is one. */
  doc?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
}

const PUSH_DELAY_MS = 250;
const DEFAULT_TICK_MS = 3000;
// A page without Capacitor gets this many checks, then the collector stops.
const PROBE_TICKS = 5;
const MAX_BACKOFF_MS = 60_000;

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** The server has no such RPC function: an older server, or the inspector is off there. */
function isMissingFunction(error: unknown): boolean {
  return /not found|unknown (rpc|function)/i.test(String((error as Error)?.message ?? error));
}

/**
 * Reports a Capacitor page: platform, plugins, and the plugin calls and
 * listeners. On a page without Capacitor it checks a few times, then stops,
 * and never wraps anything. A push carries only the calls that changed since
 * the last one.
 */
export function attachCapacitor(my: RpcScope, pageId: string, options: CapacitorOverlayOptions) {
  const win = (options.win ?? globalThis) as HookWindow;
  const doc = options.doc ?? (typeof document === 'undefined' ? undefined : document);
  const tickMs = options.tickMs ?? DEFAULT_TICK_MS;
  const devtoolsOrigin = originOf(options.devtoolsUrl);
  // With CapacitorHttp on, the bridge sends `fetch` through the same native
  // call, including the overlay's own requests to the devtools server.
  const ignore = (plugin: string, method: string, args: unknown) => {
    if (plugin !== 'CapacitorHttp' || method !== 'request' || !devtoolsOrigin) return false;
    const url = (args as { url?: unknown } | null)?.url;
    return typeof url === 'string' && url.startsWith(devtoolsOrigin);
  };

  let collector: CapacitorHook | null = null;
  let created = false;
  let unsubscribe = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let tick: ReturnType<typeof setInterval> | undefined;
  let probes = 0;
  let pushing = false;
  let again = false;
  let full = true;
  let sentRevision = 0;
  let lastInfo = '';
  let lastSentAt = 0;
  let sent = false;
  let left = false;
  // A page that leaves while a push is on its way forgets itself once the
  // push lands, so that push can't bring the page back.
  let forgetAfterPush = false;
  // Separate RPC calls may arrive out of order, so a push waits for a forget
  // still on its way, or the server could drop the page it just got.
  let forgetting: Promise<unknown> | undefined;
  let stopped = false;
  let disabled = false;
  let failures = 0;
  let retryAt = 0;

  const schedule = (delay = PUSH_DELAY_MS) => {
    if (timer !== undefined || left || stopped || disabled || !collector) return;
    timer = outsideAngular(() =>
      setTimeout(() => {
        timer = undefined;
        void push();
      }, delay),
    );
  };

  /** Starts the collector once Capacitor or the app's early hook is there. */
  const attach = (): boolean => {
    if (collector) return true;
    if (!win.Capacitor && !win.__pangularCapacitorHook) return false;
    // Reuses the hook the app installed early, so calls made before the
    // overlay started are in the log too.
    ({ hook: collector, created } = capacitorHook(win, { maxCalls: options.maxCalls }));
    collector.setIgnore(ignore);
    unsubscribe = collector.subscribe(() => schedule());
    return true;
  };

  const push = async (): Promise<void> => {
    if (left || stopped || disabled || !collector) return;
    if (pushing) {
      again = true;
      return;
    }
    const wait = retryAt - Date.now();
    if (wait > 0) {
      schedule(wait);
      return;
    }
    const info: CapacitorInfo | null = collector.info();
    if (!info) return;
    const infoJson = JSON.stringify(info);
    const snapshot = collector.snapshot(full ? undefined : sentRevision);
    const quiet = !full && !snapshot.calls.length && !snapshot.listeners && infoJson === lastInfo;
    if (quiet && !keepaliveDue(lastSentAt, tickMs)) return;
    const report: CapacitorReport = {
      pageId,
      url: redactUrl(location.pathname + location.search),
      title: redactMessage(document.title),
      full,
      ...(full || infoJson !== lastInfo ? { info } : {}),
      calls: snapshot.calls,
      ...(snapshot.listeners ? { listeners: snapshot.listeners } : {}),
      dropped: snapshot.dropped,
    };
    pushing = true;
    try {
      if (forgetting) await forgetting;
      const answer = (await outsideAngular(() => my.rpc.call('push-capacitor', report))) as
        { known?: boolean } | null | undefined;
      lastSentAt = Date.now();
      sent = true;
      failures = 0;
      retryAt = 0;
      if (answer?.known === false) {
        // The server dropped this page: send everything again, at once after
        // a partial push, and on the next tick after a full one.
        again = !report.full;
        full = true;
      } else {
        full = false;
        sentRevision = snapshot.revision;
        lastInfo = infoJson;
      }
    } catch (error) {
      full = true;
      if (isMissingFunction(error)) {
        disabled = true;
      } else {
        failures++;
        retryAt = Date.now() + Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (failures - 1));
        again = true;
      }
    } finally {
      pushing = false;
    }
    if (forgetAfterPush) {
      forgetAfterPush = false;
      if (left) forget();
      return;
    }
    if (again) {
      again = false;
      schedule(Math.max(0, retryAt - Date.now()));
    }
  };

  const forget = () => {
    sent = false;
    const done: Promise<unknown> = my.rpc
      .call('forget-capacitor-page', pageId)
      .catch(() => {})
      .finally(() => {
        if (forgetting === done) forgetting = undefined;
      });
    forgetting = done;
  };

  const stopTicking = () => {
    clearInterval(tick);
    tick = undefined;
  };

  const onTick = () => {
    if (!attach()) {
      if (++probes >= PROBE_TICKS) stopTicking();
      return;
    }
    collector!.install();
    void push();
  };

  const startTicking = () => {
    if (tick !== undefined || left || stopped || disabled) return;
    if (!collector && probes >= PROBE_TICKS) return;
    tick = outsideAngular(() => setInterval(onTick, tickMs));
  };

  // A tab in the background stops, like the other collectors.
  const onVisibility = () => {
    if (doc?.visibilityState === 'hidden') {
      stopTicking();
      return;
    }
    startTicking();
    if (attach()) schedule(0);
  };
  doc?.addEventListener('visibilitychange', onVisibility);

  if (attach()) schedule(0);
  if (doc?.visibilityState !== 'hidden') startTicking();

  return {
    push,
    leave() {
      left = true;
      full = true;
      clearTimeout(timer);
      timer = undefined;
      // Only a page the server heard from, or is about to, has anything to forget.
      if (pushing) forgetAfterPush = true;
      else if (sent) forget();
    },
    /** After `pageshow`, a page back from the cache reports again. */
    resume() {
      left = false;
      forgetAfterPush = false;
      if (attach()) schedule(0);
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      stopTicking();
      doc?.removeEventListener('visibilitychange', onVisibility);
      unsubscribe();
      collector?.setIgnore(undefined);
      if (created) collector?.stop();
    },
  };
}
