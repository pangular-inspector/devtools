import { keepaliveDue } from './change-detection.ts';
import { watchDeferHydration } from './defer-hydration-watch.ts';
import { appIdOf, scanHydration, type HydrationScanNg } from './http-hydration.ts';
import { decodePayload, sanitizePayload, type PayloadSummary } from './http-payload.ts';
import { refetchPayload, type RefetchEnv } from './http-payload-refetch.ts';
import { outsideAngular } from './outside-angular.ts';
import { withCapturedHeaders } from './http-headers.ts';
import { redactCall } from './http-redact.ts';
import { httpRegistry, sanitizeRules, storeRules, type HttpCall } from './http-rules.ts';
import { redactMessage, redactUrl } from './router.ts';
import { readSsrRequestId } from './ssr-registry.ts';
import type { HttpReport, HydrationStats } from './types.ts';

interface RpcScope {
  rpc: {
    call(name: string, ...args: unknown[]): Promise<unknown>;
    register(definition: {
      name: string;
      type: 'event';
      jsonSerializable: boolean;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler: (...args: any[]) => unknown;
    }): void;
  };
}

type HydrationScan = ReturnType<typeof scanHydration>;

/** The page's debug API, for the class names of mismatched components. */
const pageNg = () => (globalThis as { ng?: HydrationScanNg }).ng;

/** How long a scan is reused when `ngDevMode` has no counters to tell when hydration changed. */
const RESCAN_MS = 5000;

export function createHydrationScanner(
  scan: () => HydrationScan = () => scanHydration(document, pageNg()),
) {
  let cached: HydrationScan | null = null;
  let key = '';
  let scans = 0;
  return (
    counters: Record<string, unknown> | undefined,
    now = Date.now(),
    deferEpoch = 0,
  ): HydrationScan => {
    // Without counters (`ngDevMode` is plain `true`), a time bucket stands in for them, so
    // nodes that incremental hydration reaches later still show up. `deferEpoch` moves when a
    // `@defer (hydrate …)` block finishes hydrating, which rescans at once either way.
    const next = `${
      counters
        ? `${counters['hydratedNodes']}:${counters['componentsSkippedHydration']}:${counters['deferBlocksWithIncrementalHydration']}`
        : `t${Math.floor(now / RESCAN_MS)}`
    }:d${deferEpoch}`;
    if (cached && scans >= 3 && next === key) return cached;
    cached = scan();
    key = next;
    scans++;
    return cached;
  };
}

function hydrationStats(
  payload: PayloadSummary,
  scanner: ReturnType<typeof createHydrationScanner>,
  deferEpoch: number,
): HydrationStats {
  const counters = (globalThis as { ngDevMode?: Record<string, unknown> | boolean }).ngDevMode;
  const num = (key: string) =>
    counters && typeof counters === 'object' && typeof counters[key] === 'number'
      ? (counters[key] as number)
      : undefined;
  const hydratedComponents = num('hydratedComponents');
  const scan = scanner(
    counters && typeof counters === 'object' ? counters : undefined,
    Date.now(),
    deferEpoch,
  );
  const annotated = payload.entries.some((e) => e.key === '__nghData__');
  const warnings = httpRegistry().warnings;
  return {
    enabled: annotated || (hydratedComponents ?? 0) > 0 || scan.hydrated > 0,
    hydratedComponents,
    hydratedNodes: num('hydratedNodes'),
    componentsSkippedHydration: num('componentsSkippedHydration'),
    deferBlocksWithIncrementalHydration: num('deferBlocksWithIncrementalHydration'),
    nodes: { hydrated: scan.hydrated, skipped: scan.skipped, mismatched: scan.mismatched },
    mismatches: scan.mismatches,
    skipHydrationHosts: [...document.querySelectorAll('[ngskiphydration]')]
      .slice(0, 50)
      .map((el) => el.tagName.toLowerCase()),
    warnings: [...(warnings ?? [])],
    warningsCaptured: Array.isArray(warnings),
    ...(httpRegistry().stableMs !== undefined ? { stableMs: httpRegistry().stableMs } : {}),
  };
}

/**
 * Reports payload, hydration and client calls, and keeps fault rules in sync.
 * The payload and the full call list go out once; later pushes carry only new
 * calls, and a ping keeps the page alive while nothing changes.
 */
export function attachHttp(
  my: RpcScope,
  pageId: string,
  tickMs: () => number = () => 0,
  refetchEnv: RefetchEnv = {},
) {
  // The payload the page was served with: hydration stats always read this one.
  const payload = decodePayload(document, appIdOf(document));
  // What the panel shows: the served payload, or the last refetched one.
  let shownPayload = payload;
  // TransferState holds whatever the server rendered with, so it is masked here, before it
  // leaves the page, with the same rules the server applies to it.
  let maskedPayload: PayloadSummary | undefined;
  const initialUrl = redactUrl(location.pathname + location.search);
  const ssrRequestId = readSsrRequestId();
  const scanner = createHydrationScanner();
  let payloadSent = false;
  let lastCall: HttpCall | undefined;
  let lastMeta = '';
  let lastSentAt = 0;
  let queue = Promise.resolve();

  const newCalls = (calls: HttpCall[]) => {
    const at = lastCall ? calls.lastIndexOf(lastCall) : -1;
    return at === -1 ? [...calls] : calls.slice(at + 1);
  };

  const pushOnce = async () => {
    const registry = httpRegistry();
    const all = registry.calls ?? [];
    const meta = {
      pageId,
      url: redactUrl(location.pathname + location.search),
      initialUrl,
      title: redactMessage(document.title),
      hydration: hydrationStats(payload, scanner, deferHydration.epoch()),
      dropped: registry.dropped ?? 0,
      ...(ssrRequestId ? { ssrRequestId } : {}),
    };
    const metaJson = JSON.stringify(meta);
    const full = !payloadSent;
    const calls = full ? [...all] : newCalls(all);
    const sentUpTo = all.at(-1) ?? lastCall;
    if (!full && !calls.length && metaJson === lastMeta) {
      if (!keepaliveDue(lastSentAt, tickMs())) return;
      lastSentAt = Date.now();
      const ping = (await my.rpc.call('ping-http', pageId)) as { known?: boolean } | undefined;
      if (ping?.known === false) payloadSent = false;
      return;
    }
    // Headers are read here, once per call, and masked before they leave the page.
    const report: HttpReport = {
      ...meta,
      calls: calls.map((call) => redactCall(withCapturedHeaders(call))),
      full,
    };
    const sent = full
      ? { ...report, payload: (maskedPayload ??= sanitizePayload(shownPayload)) }
      : report;
    const answer = (await my.rpc.call('push-http', sent)) as
      { needPayload?: boolean } | null | undefined;
    lastMeta = metaJson;
    lastSentAt = Date.now();
    lastCall = sentUpTo;
    payloadSent = !answer?.needPayload;
  };

  const push = () => (queue = queue.then(pushOnce, pushOnce));
  // A `@defer (hydrate on …)` block can finish after the change detection that runs the
  // collectors, so its hydration is pushed on its own.
  const deferHydration = watchDeferHydration(() => void push().catch(() => {}));

  my.rpc.register({
    name: 'http-rules',
    type: 'event',
    jsonSerializable: true,
    handler: (rules: unknown) => storeRules(sanitizeRules(rules)),
  });
  my.rpc.register({
    name: 'http-clear',
    type: 'event',
    jsonSerializable: true,
    handler: () => {
      const registry = httpRegistry();
      registry.calls = [];
      registry.dropped = 0;
      push().catch(() => {});
    },
  });

  // A user's Refetch in the panel, or an agent's `refetch-transfer-state`: render the page's
  // URL again on the server and show the payload it sends now, without reloading the tab.
  my.rpc.register({
    name: 'http-payload-refetch',
    type: 'event',
    jsonSerializable: true,
    handler: (message: { requestId?: unknown; pageId?: unknown } | undefined) => {
      if (message?.pageId !== pageId || typeof message.requestId !== 'string') return;
      const requestId = message.requestId;
      void outsideAngular(async () => {
        const fetched = await refetchPayload(location.href, refetchEnv);
        let result: Record<string, unknown>;
        if ('error' in fetched) {
          result = { error: redactMessage(fetched.error) };
        } else {
          shownPayload = fetched.payload;
          maskedPayload = sanitizePayload(shownPayload);
          payloadSent = false;
          await push().catch(() => {});
          result = {
            ok: true,
            status: fetched.status,
            found: maskedPayload.found,
            entries: maskedPayload.entries.length,
            size: maskedPayload.size,
          };
        }
        await my.rpc
          .call('http-payload-refetch-result', { requestId, pageId, result })
          .catch(() => {});
      });
    },
  });

  void my.rpc
    .call('get-http-rules')
    .then((rules) => storeRules(sanitizeRules(rules)))
    .catch(() => {});

  return {
    push,
    leave: () => void my.rpc.call('forget-http-page', pageId).catch(() => {}),
    stop: () => deferHydration.stop(),
  };
}
