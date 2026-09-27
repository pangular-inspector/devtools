import { decodePayload } from './http-payload.ts';
import { httpRegistry, sanitizeRules, storeRules } from './http-rules.ts';
import type { HttpPage, HydrationStats } from './types.ts';

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

function hydrationStats(): HydrationStats {
  const counters = (globalThis as { ngDevMode?: Record<string, unknown> | boolean }).ngDevMode;
  const num = (key: string) =>
    counters && typeof counters === 'object' && typeof counters[key] === 'number'
      ? (counters[key] as number)
      : undefined;
  const hydratedComponents = num('hydratedComponents');
  return {
    enabled: !!document.querySelector('[ngh]') || (hydratedComponents ?? 0) > 0,
    hydratedComponents,
    hydratedNodes: num('hydratedNodes'),
    componentsSkippedHydration: num('componentsSkippedHydration'),
    deferBlocksWithIncrementalHydration: num('deferBlocksWithIncrementalHydration'),
    skipHydrationHosts: [...document.querySelectorAll('[ngskiphydration]')]
      .slice(0, 50)
      .map((el) => el.tagName.toLowerCase()),
    warnings: [...(httpRegistry().warnings ?? [])],
  };
}

function appId(): string {
  const script = document.querySelector('script[id$="-state"][type="application/json"]');
  return script?.id.replace(/-state$/, '') || 'ng';
}

/** Reports payload, hydration and client calls, and keeps fault rules in sync. */
export function attachHttp(my: RpcScope, pageId: string) {
  // The payload never changes after load, so decode it once.
  const payload = decodePayload(document, appId());
  let lastSent = '';
  let lastSentAt = 0;

  const push = async () => {
    const report: Omit<HttpPage, 'reportedAt'> = {
      pageId,
      url: location.pathname + location.search,
      title: document.title,
      payload,
      hydration: hydrationStats(),
      calls: [...(httpRegistry().calls ?? [])],
    };
    const body = JSON.stringify(report);
    // Re-send unchanged reports every few pushes so the server keeps the page alive.
    if (body === lastSent && Date.now() - lastSentAt < 8000) return;
    lastSent = body;
    lastSentAt = Date.now();
    await my.rpc.call('push-http', report);
  };

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
      httpRegistry().calls = [];
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
