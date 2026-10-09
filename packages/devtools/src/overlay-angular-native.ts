import { connectDevframe } from 'devframe/client';
import { keepaliveDue } from './change-detection.ts';
import { collectComponentTree, type ComponentDebugNg } from './component-tree.ts';
import { configFromConnection } from './config.ts';
import { elementById } from './element-id.ts';
import { setRedaction } from './forms-privacy.ts';
import { hostBySelector } from './host-tree.ts';
import { collectInjectorTree } from './injector-tree.ts';
import { attachNgrx } from './ngrx-overlay.ts';
import { attachPipes } from './pipes-collector.ts';
import type { NgDebugApi } from './pipes-runtime.ts';
import {
  angularNativeTree,
  clearOutline,
  showOutline,
  type AngularNativeNode,
} from './overlay-angular-native-views.ts';
import { serializeNamed } from './serialize.ts';
import {
  collectSignalGraph,
  graphKey,
  graphValue,
  toSignalTarget,
  type SignalDebugNg,
  type SignalTarget,
} from './signal-graph.ts';
import { createSignalHistory, installSignalWriteHook } from './signal-history.ts';

export type { AngularNativeNode } from './overlay-angular-native-views.ts';

type DebugNg = SignalDebugNg<AngularNativeNode> & ComponentDebugNg<AngularNativeNode>;

type Rpc = Awaited<ReturnType<typeof connectDevframe>>;
type ConnectionMeta = NonNullable<
  NonNullable<Parameters<typeof connectDevframe>[0]>['connectionMeta']
>;

export interface AngularNativeOverlayOptions {
  /** The root node `mount()` created (`app.engine.root`), or a function that returns it. */
  root: AngularNativeNode | (() => AngularNativeNode | null | undefined);
  /** Absolute URL of the devtools server. Defaults to `http://localhost:9999/`. */
  baseURL?: string;
  /** How often the app reports, in milliseconds. Defaults to the server's `limits.refreshMs`. */
  intervalMs?: number;
  /** How long to wait before trying the server again, in milliseconds. */
  retryMs?: number;
}

export const DEFAULT_ANGULAR_NATIVE_BASE_URL = 'http://localhost:9999/';

const TITLE = 'Angular Native';
const TRUST_TIMEOUT_MS = 5000;

class UntrustedError extends Error {}

/**
 * Report an Angular Native app to a devtools server over a WebSocket. Call it
 * after `mount()`, in development only. A session that fails or drops is
 * replaced after `retryMs` until the returned function is called.
 */
export function initAngularNativeOverlay(options: AngularNativeOverlayOptions): () => void {
  const baseURL = options.baseURL ?? DEFAULT_ANGULAR_NATIVE_BASE_URL;
  const retryMs = options.retryMs ?? 5000;
  if (typeof WebSocket === 'undefined') {
    console.warn('[pangular] No WebSocket global, so the Angular Native overlay cannot start.');
    return () => {};
  }
  ensureWebSocketStates();

  const root = options.root;
  const getRoot = typeof root === 'function' ? root : () => root;
  const pageId = Math.random().toString(36).slice(2, 6);
  let disposed = false;
  let session: (() => void) | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let unreachable = false;

  const again = () => {
    session?.();
    session = undefined;
    if (disposed || retry) return;
    retry = setTimeout(() => {
      retry = undefined;
      start();
    }, retryMs);
  };
  const start = () => {
    connect(baseURL, pageId, getRoot, options.intervalMs, again).then(
      (dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        session = dispose;
        unreachable = false;
        console.log(`[pangular] Connected to the devtools server at ${baseURL}`);
      },
      (error: unknown) => {
        if (!unreachable) {
          console.warn(
            error instanceof UntrustedError
              ? `[pangular] The devtools server at ${baseURL} did not accept the app. Start it with --no-auth. Retrying every ${retryMs}ms.`
              : `[pangular] Could not reach the devtools server at ${baseURL}; retrying every ${retryMs}ms.`,
          );
        }
        unreachable = true;
        again();
      },
    );
  };
  start();

  return () => {
    disposed = true;
    clearTimeout(retry);
    session?.();
    session = undefined;
  };
}

async function connect(
  baseURL: string,
  pageId: string,
  getRoot: () => AngularNativeNode | null | undefined,
  intervalMs: number | undefined,
  onDisconnected: () => void,
): Promise<() => void> {
  const connectionMeta = await fetchConnectionMeta(baseURL);
  let closing = false;
  const rpc = await withWebShims(baseURL, () =>
    connectDevframe({
      baseURL,
      connectionMeta,
      transport: 'websocket',
      simpleAuth: false,
      otpParam: false,
      webmcp: false,
      wsOptions: {
        onDisconnected: () => {
          if (!closing) onDisconnected();
        },
      },
    }),
  );
  try {
    const trusted = await rpc.ensureTrusted(TRUST_TIMEOUT_MS).catch(() => false);
    if (!trusted) throw new UntrustedError();
    const stop = await startSession(rpc, pageId, getRoot, intervalMs);
    return () => {
      closing = true;
      stop();
    };
  } catch (error) {
    closing = true;
    rpc.close?.();
    throw error;
  }
}

async function fetchConnectionMeta(baseURL: string): Promise<ConnectionMeta> {
  const response = await fetch(new URL('__connection.json', baseURL).href);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ConnectionMeta;
}

async function startSession(
  rpc: Rpc,
  pageId: string,
  getRoot: () => AngularNativeNode | null | undefined,
  intervalMs: number | undefined,
): Promise<() => void> {
  const my = rpc.scope('pangular');
  const config = configFromConnection(rpc.connectionMeta);
  const on = config.inspectors;
  const tickMs = intervalMs ?? config.limits.refreshMs;
  setRedaction(config.redaction);
  const tree = angularNativeTree(getRoot, angularDebugApi);

  const pingKnows = async (name: string) => {
    const answer = (await my.rpc.call(name, pageId)) as { known?: boolean } | undefined;
    return answer?.known !== false;
  };

  let componentTarget: string | null = null;
  let lastTreeJson = '';
  let treeSentAt = 0;
  async function pushTree(force = false) {
    const ng = angularDebugApi();
    if (!ng) return;
    const report = {
      ...collectComponentTree(ng, { tree, selectedId: componentTarget }),
      url: '/',
      title: TITLE,
      platform: 'angular-native' as const,
    };
    const json = JSON.stringify(report);
    if (!force && json === lastTreeJson) {
      if (!keepaliveDue(treeSentAt, tickMs)) return;
      treeSentAt = Date.now();
      if (await pingKnows('ping-component-tree')) return;
    }
    lastTreeJson = json;
    treeSentAt = Date.now();
    await my.rpc.call('push-component-tree', { ...report, pageId });
  }

  const signalHistory = createSignalHistory(
    (value, name) => serializeNamed(name, value, { budget: 1000 }),
    Date.now,
    (value, name) => graphValue(name, value),
  );
  const restoreSignalHook = on.signals ? await installSignalWriteHook(signalHistory.onWrite) : null;

  let signalTarget: SignalTarget = null;
  let lastSignalKey = '';
  let signalSentAt = 0;
  let historyDelta = false;
  let historyFor = '';
  async function pushSignalGraph(force = false) {
    const graph = collectSignalGraph(angularDebugApi(), signalTarget, tree);
    if (!graph) return;
    const key = graphKey(graph);
    if (!force && key === lastSignalKey) {
      if (!keepaliveDue(signalSentAt, tickMs)) return;
      signalSentAt = Date.now();
      if (await pingKnows('ping-signal-graph')) return;
    }
    lastSignalKey = key;
    signalSentAt = Date.now();
    const owner = graph.component?.id ?? '';
    const full = force || !historyDelta || owner !== historyFor;
    historyFor = owner;
    const statuses = (graph.resources ?? [])
      .filter((r) => r.status)
      .map((r) => ({
        id: r.id,
        kind: 'resource' as const,
        label: r.name,
        epoch: r.epoch,
        value: r.status,
      }));
    const { changes: history, rollback } = signalHistory.collectDeltaWithRollback(
      [...graph.nodes, ...statuses],
      full,
    );
    for (const item of [...graph.nodes, ...(graph.resources ?? [])]) {
      const changes = signalHistory.changesOf(item.id);
      if (changes) item.changes = changes;
    }
    let answer: { delta?: boolean } | undefined;
    try {
      answer = (await my.rpc.call('push-signal-graph', {
        ...graph,
        ...(restoreSignalHook ? {} : { writeHook: false as const }),
        pageId,
        ...(full ? { history } : { historyDelta: history }),
      })) as { delta?: boolean } | undefined;
    } catch (error) {
      rollback();
      lastSignalKey = '';
      historyDelta = false;
      throw error;
    }
    historyDelta = answer?.delta === true;
  }

  let lastInjectorJson = '';
  let injectorSentAt = 0;
  async function pushInjectorTree() {
    const ng = angularDebugApi();
    if (!ng) return;
    const report = collectInjectorTree(ng, tree);
    const json = JSON.stringify(report);
    if (json === lastInjectorJson) {
      if (!keepaliveDue(injectorSentAt, tickMs)) return;
      injectorSentAt = Date.now();
      if (await pingKnows('ping-injector-tree')) return;
    }
    lastInjectorJson = json;
    injectorSentAt = Date.now();
    await my.rpc.call('push-injector-tree', { ...report, pageId });
  }

  const ngrx = on.ngrx
    ? attachNgrx(my, pageId, angularDebugApi, config.limits.changeLog, {
        tree,
        describe: () => ({ url: '/', title: TITLE }),
      })
    : null;

  const pipes = on.pipes
    ? attachPipes(my, pageId, () => angularDebugApi() as NgDebugApi | undefined, { tree })
    : null;

  const collectors = [
    on.components && pushTree,
    on.signals && pushSignalGraph,
    on.injectors && pushInjectorTree,
    ngrx && (() => ngrx.push()),
    pipes && (async () => pipes.push()),
  ].filter((collect) => typeof collect === 'function');
  const tick = () => {
    if (rpc.status !== 'connected' && rpc.status !== 'connecting') return;
    for (const collect of collectors) void collect().catch(() => {});
  };
  tick();
  const interval = setInterval(tick, tickMs);

  my.rpc.register({
    name: 'highlight-in-page',
    type: 'event',
    jsonSerializable: true,
    handler: (
      request:
        string | { pageId?: string; id?: string; selector?: string; durationMs?: number } | null,
    ) => {
      clearOutline();
      const wanted = typeof request === 'string' ? { selector: request } : request;
      if (!wanted || (wanted.pageId && wanted.pageId !== pageId)) return;
      const host =
        typeof wanted.id === 'string'
          ? elementById<AngularNativeNode>(wanted.id, (h) => tree.isHost(h) && tree.connected(h))
          : typeof wanted.selector === 'string'
            ? hostBySelector(tree, wanted.selector)
            : null;
      if (host) showOutline(host, wanted.durationMs);
    },
  });

  my.rpc.register({
    name: 'select-signal-component',
    type: 'event',
    jsonSerializable: true,
    handler: (request: unknown) => {
      const next = toSignalTarget(request, pageId);
      if (next === undefined) return;
      signalTarget = next;
      void pushSignalGraph(true).catch(() => {});
    },
  });

  my.rpc.register({
    name: 'inspect-component-in-page',
    type: 'event',
    jsonSerializable: true,
    handler: (request: { pageId?: string; id?: string | null } | null) => {
      if (request?.pageId && request.pageId !== pageId) return;
      componentTarget = typeof request?.id === 'string' ? request.id : null;
      void pushTree(true).catch(() => {});
    },
  });

  return () => {
    clearInterval(interval);
    clearOutline();
    restoreSignalHook?.();
    ngrx?.stop();
    pipes?.stop();
    const forget = [
      on.components && 'forget-component-page',
      on.signals && 'forget-signal-page',
      on.injectors && 'forget-injector-page',
      on.ngrx && 'forget-ngrx-page',
      on.pipes && 'forget-pipes-page',
    ].filter((name): name is string => typeof name === 'string');
    void Promise.allSettled(forget.map((name) => my.rpc.call(name, pageId))).finally(() =>
      rpc.close?.(),
    );
  };
}

function angularDebugApi(): DebugNg | undefined {
  const ng = (globalThis as { ng?: DebugNg }).ng;
  if (typeof ng?.getComponent !== 'function') return undefined;
  const getDirectives = ng.getDirectives;
  if (!getDirectives) return ng;
  return { ...ng, getDirectives: (host) => withTextGlobal(() => getDirectives(host)) };
}

/**
 * Angular's `getDirectives()` starts with `node instanceof Text`, a DOM global
 * React Native lacks, so a stand-in exists for the length of the call.
 */
function withTextGlobal<T>(fn: () => T): T {
  const g = globalThis as Record<string, unknown>;
  if ('Text' in g) return fn();
  g['Text'] = class Text {};
  try {
    return fn();
  } finally {
    delete g['Text'];
  }
}

/**
 * `devframe/client` reads `location` and `navigator` as bare globals while it
 * connects. React Native has no `location`, so the server's address stands in
 * for the page's until `connectDevframe()` settles, and is removed again: Expo
 * loads split bundles from `location.origin` whenever a `location` exists.
 */
let shimUsers = 0;
let shims: Record<string, unknown> = {};

export async function withWebShims<T>(baseURL: string, connect: () => Promise<T>): Promise<T> {
  const g = globalThis as Record<string, unknown>;
  if (shimUsers++ === 0) {
    shims = {};
    if (typeof g['location'] === 'undefined') {
      const url = new URL(baseURL);
      shims['location'] = {
        href: url.href,
        origin: url.origin,
        protocol: url.protocol,
        host: url.host,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        search: '',
        hash: '',
      };
    }
    if (typeof g['navigator'] === 'undefined') shims['navigator'] = { userAgent: TITLE };
    for (const [key, value] of Object.entries(shims)) g[key] = value;
  }
  try {
    return await connect();
  } finally {
    if (--shimUsers === 0) {
      for (const [key, value] of Object.entries(shims)) if (g[key] === value) delete g[key];
      shims = {};
    }
  }
}

function ensureWebSocketStates() {
  const states = WebSocket as unknown as Record<string, number>;
  states['CONNECTING'] ??= 0;
  states['OPEN'] ??= 1;
  states['CLOSING'] ??= 2;
  states['CLOSED'] ??= 3;
}
