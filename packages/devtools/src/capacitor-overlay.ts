import { capacitorHook, type CapacitorInfo } from './capacitor-collector.ts';
import { keepaliveDue } from './change-detection.ts';
import { redactMessage, redactUrl } from './router.ts';
import type { CapacitorReport } from './rpc/capacitor-tools.ts';

interface RpcScope {
  rpc: { call(name: string, ...args: unknown[]): Promise<unknown> };
}

export interface CapacitorOverlayOptions {
  /** Calls kept on the page (`limits.capacitorCalls`). */
  maxCalls: number;
  /** The devtools server's `__connection.json` URL, so its own requests stay out of the log. */
  devtoolsUrl?: string;
  win?: { Capacitor?: unknown };
}

const PUSH_DELAY_MS = 250;
const TICK_MS = 4000;

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Reports a Capacitor page: platform, plugins, and the plugin calls and
 * listeners since the overlay started. Pages without `window.Capacitor` send
 * nothing. A push carries only the calls that changed since the last one.
 */
export function attachCapacitor(my: RpcScope, pageId: string, options: CapacitorOverlayOptions) {
  const devtoolsOrigin = originOf(options.devtoolsUrl);
  // With CapacitorHttp on, the bridge sends `fetch` through the same native
  // call, including the overlay's own requests to the devtools server.
  const ignore = (plugin: string, method: string, args: unknown) => {
    if (plugin !== 'CapacitorHttp' || method !== 'request' || !devtoolsOrigin) return false;
    const url = (args as { url?: unknown } | null)?.url;
    return typeof url === 'string' && url.startsWith(devtoolsOrigin);
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pushing = false;
  let again = false;
  let full = true;
  let sentRevision = 0;
  let lastInfo = '';
  let lastSentAt = 0;
  let left = false;

  const schedule = (delay = PUSH_DELAY_MS) => {
    if (timer !== undefined || left) return;
    timer = setTimeout(() => {
      timer = undefined;
      void push();
    }, delay);
  };

  // Reuses the hook the app installed early, so calls made before the
  // overlay started are in the log too.
  const { hook: collector, created } = capacitorHook(
    (options.win ?? globalThis) as Parameters<typeof capacitorHook>[0],
    { maxCalls: options.maxCalls },
  );
  collector.setIgnore(ignore);
  const unsubscribe = collector.subscribe(() => schedule());

  const push = async (): Promise<void> => {
    if (left) return;
    if (pushing) {
      again = true;
      return;
    }
    const info: CapacitorInfo | null = collector.info();
    if (!info) return;
    const infoJson = JSON.stringify(info);
    const snapshot = collector.snapshot(full ? undefined : sentRevision);
    const quiet = !full && !snapshot.calls.length && !snapshot.listeners && infoJson === lastInfo;
    if (quiet && !keepaliveDue(lastSentAt, TICK_MS)) return;
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
      const answer = (await my.rpc.call('push-capacitor', report)) as
        { known?: boolean } | null | undefined;
      lastSentAt = Date.now();
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
    } catch {
      full = true;
    } finally {
      pushing = false;
    }
    if (again) {
      again = false;
      schedule(0);
    }
  };

  const tick = setInterval(() => {
    collector.install();
    void push();
  }, TICK_MS);
  schedule(0);

  return {
    push,
    leave() {
      left = true;
      full = true;
      clearTimeout(timer);
      timer = undefined;
      void my.rpc.call('forget-capacitor-page', pageId).catch(() => {});
    },
    /** After `pageshow`, a page back from the cache reports again. */
    resume() {
      left = false;
      schedule(0);
    },
    stop() {
      left = true;
      clearTimeout(timer);
      clearInterval(tick);
      unsubscribe();
      collector.setIgnore(undefined);
      if (created) collector.stop();
    },
  };
}
