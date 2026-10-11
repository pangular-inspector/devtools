import type { ResolvedPangularConfig } from './config.ts';
import { registerHubDocks, type HubDocks } from './hub-docks.ts';
import { isAnalogProject } from './rpc/analog-scan.ts';

/** A server shared state, reduced to what the dock status reads. */
export interface WatchedState {
  value: () => unknown;
  on: (event: 'updated', listener: (state: unknown) => void) => unknown;
}

export interface HubDockSources {
  /** The project root, to tell whether it is an Analog app. */
  cwd: string;
  /** The `capacitor` shared state the Capacitor view reads. */
  capacitor: WatchedState;
  /** The `component-tree` shared state the Angular Native view reads. */
  components: WatchedState;
}

function pagesOf(state: unknown): unknown[] {
  const pages = (state as { pages?: unknown } | null | undefined)?.pages;
  return pages && typeof pages === 'object' ? Object.values(pages) : [];
}

/** Whether a Capacitor app reports, as the Capacitor view decides it. */
export function capacitorReporting(state: unknown): boolean {
  return pagesOf(state).some((page) => {
    const entry = page as { pageId?: unknown; info?: unknown } | null;
    return typeof entry?.pageId === 'string' && !!entry.info;
  });
}

/** Whether an Angular Native app reports its component tree. */
export function angularNativeReporting(state: unknown): boolean {
  return pagesOf(state).some(
    (page) => (page as { platform?: unknown } | null)?.platform === 'angular-native',
  );
}

/**
 * Registers the hub docks and keeps the explaining title of the Analog, Angular
 * Native and Capacitor docks in step with the data their views show. A
 * NativeScript app reports like a browser page, so its dock keeps its plain title.
 */
export function trackHubDocks(
  ctx: unknown,
  id: string,
  config: ResolvedPangularConfig,
  sources: HubDockSources,
): HubDocks | undefined {
  const docks = registerHubDocks(ctx, id, config, {
    // Whether a project is Analog doesn't change while the server runs.
    analog: config.inspectors.analog ? isAnalogProject(sources.cwd) : undefined,
    capacitor: capacitorReporting(sources.capacitor.value()),
    'angular-native': angularNativeReporting(sources.components.value()),
  });
  if (!docks) return undefined;
  sources.capacitor.on('updated', (state) =>
    docks.setAvailable('capacitor', capacitorReporting(state)),
  );
  sources.components.on('updated', (state) =>
    docks.setAvailable('angular-native', angularNativeReporting(state)),
  );
  return docks;
}
