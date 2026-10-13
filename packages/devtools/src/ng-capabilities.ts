// Finds which parts of Angular's debug API the page has, so each inspector can
// say why it has no data instead of showing an empty view. Every check looks
// at what the page exposes; the `ng-version` attribute is read for messages,
// and for the one check that cannot be made without side effects (`profiler`).

import { keepaliveDue, KEEPALIVE_MS } from './change-detection.ts';
import {
  ANGULAR_CAPABILITIES,
  angularVersionAtLeast,
  type AngularCapability,
  type AngularPageInfo,
} from './config.ts';

export type { AngularCapability, AngularPageInfo } from './config.ts';

type AnyRecord = Record<string, unknown>;

function read<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function has(ng: AnyRecord | null, name: string): boolean {
  return !!ng && read(() => typeof ng[name] === 'function', false);
}

/** The `ng-version` attribute of the first Angular root, which every Ivy version sets. */
export function angularVersionOf(doc: Document | undefined): string | undefined {
  if (!doc) return undefined;
  const version = read(
    () => doc.querySelector('[ng-version]')?.getAttribute('ng-version') ?? undefined,
    undefined,
  );
  return version && version.length < 40 ? version : undefined;
}

const CHECKS: Record<AngularCapability, (ng: AnyRecord | null, version?: string) => boolean> = {
  debugApi: (ng) =>
    has(ng, 'getComponent') &&
    has(ng, 'getDirectives') &&
    has(ng, 'getInjector') &&
    has(ng, 'getHostElement'),
  injectorProviders: (ng) =>
    has(ng, 'ɵgetInjectorProviders') &&
    has(ng, 'ɵgetInjectorResolutionPath') &&
    has(ng, 'ɵgetDependenciesFromInjectable'),
  injectorMetadata: (ng) => has(ng, 'ɵgetInjectorMetadata'),
  isSignal: (ng) => has(ng, 'isSignal'),
  signalGraph: (ng) => has(ng, 'ɵgetSignalGraph'),
  deferBlocks: (ng) => has(ng, 'ɵgetControlFlowBlocks') || has(ng, 'ɵgetDeferBlocks'),
  forBlocks: (ng) => has(ng, 'ɵgetControlFlowBlocks'),
  // Before 20.0 `ɵsetProfiler` has one slot and no remover, so trying it would
  // evict the Angular DevTools extension. The version is the only safe check.
  profiler: (ng, version) =>
    has(ng, 'ɵsetProfiler') && !!version && angularVersionAtLeast(version, '20.0'),
  angularProfiling: (ng) => has(ng, 'enableProfiling'),
  routerInstance: (ng) => has(ng, 'ɵgetRouterInstance'),
};

/**
 * The page's Angular version and which debug API parts it has. A page whose
 * Angular has not started yet (no `ng`, no root) reports every part missing,
 * and reports again once it starts.
 */
export function detectAngular(
  ng: unknown,
  doc: Document | undefined = typeof document === 'undefined' ? undefined : document,
  /** The version read another way, on a platform without `ng-version` attributes. */
  knownVersion?: string,
): AngularPageInfo {
  const api = ng && typeof ng === 'object' ? (ng as AnyRecord) : null;
  const version = knownVersion ?? angularVersionOf(doc);
  const capabilities: AngularPageInfo['capabilities'] = {};
  for (const name of ANGULAR_CAPABILITIES) capabilities[name] = CHECKS[name](api, version);
  return version ? { version, capabilities } : { capabilities };
}

interface Rpc {
  rpc: { call(name: string, ...args: unknown[]): Promise<unknown> };
}

/**
 * Sends the page's Angular version and capabilities with its `pageId` when
 * they change, and again inside the server's expiry so the page stays listed.
 * The report is a few hundred bytes, so it is not held back by the lease.
 */
export function attachAngularInfo(
  my: Rpc,
  pageId: string,
  getNg: () => unknown,
  options: {
    /** The longest gap between two pushes, so a keepalive goes out before the server expires the page. */
    tickMs?: () => number;
    now?: () => number;
    doc?: () => Document | undefined;
    /** The Angular version, on a platform without a DOM to read `ng-version` from. */
    version?: () => string | undefined;
  } = {},
) {
  const now = options.now ?? Date.now;
  const tickMs = options.tickMs ?? (() => KEEPALIVE_MS / 2);
  const doc = options.doc ?? (() => (typeof document === 'undefined' ? undefined : document));
  let last = '';
  let sentAt = 0;
  let sending = false;
  return {
    async push(): Promise<void> {
      if (sending) return;
      const info = detectAngular(getNg(), doc(), options.version?.());
      const key = JSON.stringify(info);
      if (key === last && !keepaliveDue(sentAt, tickMs(), now())) return;
      sending = true;
      try {
        await my.rpc.call('report-page-angular', { pageId, ...info });
        last = key;
        sentAt = now();
      } catch {
        last = '';
      } finally {
        sending = false;
      }
    },
    /** The page left: the server forgets it, and the next push sends it again. */
    leave() {
      last = '';
      void my.rpc.call('forget-page-angular', pageId).catch(() => {});
    },
  };
}
