import { keepaliveDue } from './change-detection.ts';
import { appIdOf, scanHydration } from './http-hydration.ts';
import { decodePayload, type PayloadSummary } from './http-payload.ts';
import { redactCall } from './http-redact.ts';
import { httpRegistry, sanitizeRules, storeRules, type HttpCall } from './http-rules.ts';
import { redactUrl } from './router.ts';
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

export function createHydrationScanner(scan: () => HydrationScan = () => scanHydration(document)) {
  let cached: HydrationScan | null = null;
  let key = '';
  let scans = 0;
  return (counters: Record<string, unknown> | undefined): HydrationScan => {
    const next = counters
      ? `${counters['hydratedNodes']}:${counters['componentsSkippedHydration']}:${counters['deferBlocksWithIncrementalHydration']}`
      : '';
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
): HydrationStats {
  const counters = (globalThis as { ngDevMode?: Record<string, unknown> | boolean }).ngDevMode;
  const num = (key: string) =>
    counters && typeof counters === 'object' && typeof counters[key] === 'number'
      ? (counters[key] as number)
      : undefined;
  const hydratedComponents = num('hydratedComponents');
  const scan = scanner(counters && typeof counters === 'object' ? counters : undefined);
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
  };
}

/**
 * Reports payload, hydration and client calls, and keeps fault rules in sync.
 * The payload and the full call list go out once; later pushes carry only new
 * calls, and a ping keeps the page alive while nothing changes.
 */
export function attachHttp(my: RpcScope, pageId: string, tickMs: () => number = () => 0) {
  const payload = decodePayload(document, appIdOf(document));
  const initialUrl = redactUrl(location.pathname + location.search);
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
      title: document.title,
      hydration: hydrationStats(payload, scanner),
      dropped: registry.dropped ?? 0,
    };
    const metaJson = JSON.stringify(meta);
    const full = !payloadSent;
    const calls = full ? [...all] : newCalls(all);
    if (!full && !calls.length && metaJson === lastMeta) {
      if (!keepaliveDue(lastSentAt, tickMs())) return;
      lastSentAt = Date.now();
      const ping = (await my.rpc.call('ping-http', pageId)) as { known?: boolean } | undefined;
      if (ping?.known === false) payloadSent = false;
      return;
    }
    const report: HttpReport = { ...meta, calls: calls.map(redactCall), full };
    const answer = (await my.rpc.call('push-http', full ? { ...report, payload } : report)) as
      { needPayload?: boolean } | null | undefined;
    lastMeta = metaJson;
    lastSentAt = Date.now();
    lastCall = all.at(-1) ?? lastCall;
    payloadSent = !answer?.needPayload;
  };

  const push = () => (queue = queue.then(pushOnce, pushOnce));

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
      void push();
    },
  });

  void my.rpc
    .call('get-http-rules')
    .then((rules) => storeRules(sanitizeRules(rules)))
    .catch(() => {});

  return {
    push,
    leave: () => void my.rpc.call('forget-http-page', pageId).catch(() => {}),
  };
}
