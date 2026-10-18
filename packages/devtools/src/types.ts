import type {} from 'devframe';
import type { HttpCall, HttpRule } from './http-rules.ts';
import type { SsrRequest } from './ssr-registry.ts';
import type { SsrOverride } from './ssr-overrides.ts';
import type { PayloadSummary } from './http-payload.ts';
import type { HydrationMismatch } from './http-hydration.ts';

export interface ComponentNode {
  id: string;
  selector: string;
  file: string;
  inputs: string[];
  outputs: string[];
  children: ComponentNode[];
}

export interface RouteInfo {
  path: string;
  component?: string;
  redirectTo?: string;
  title?: string;
  hasChildren: boolean;
  guards?: string[];
}

export type SignalNodeKind =
  | 'signal'
  | 'computed'
  | 'linkedSignal'
  | 'effect'
  | 'template'
  | 'afterRenderEffectPhase'
  | 'childSignalProp'
  | 'resource'
  | 'unknown';

export interface SignalGraphNode {
  id: string;
  kind: SignalNodeKind;
  label?: string;
  epoch: number;
  value?: unknown;
  /** Changes seen since the page first reported the node, including ones whose value went unseen. */
  changes?: number;
  /** Created by Angular's own code rather than the app (see `signal-framework.ts`). */
  framework?: true;
  /**
   * The own field of the component instance that holds this writable signal
   * (`signal`, `linkedSignal` or `model`), so a history entry can be restored.
   * Left out for `computed`, inputs, service signals and fields it could not
   * match (see `signal-locator.ts`).
   */
  locator?: SignalWriteLocator;
}

/** Where a writable signal lives: the component instance id and its property. */
export interface SignalWriteLocator {
  id: string;
  key: string;
}

export interface SignalGraphEdge {
  consumer: number;
  producer: number;
}

export interface SignalChange {
  epoch: number;
  value: unknown;
  /** Page clock, ms since epoch. */
  at: number;
  /** `write` is captured on set; `sample`/`initial` come from polling and may skip values. */
  source: 'write' | 'sample' | 'initial';
  /** Changes between this sample and the previous entry whose values weren't seen. */
  missed?: number;
  /** First app frames of the code that wrote it, when write stacks are on (`write` entries only). */
  stack?: string[];
}

/** What the page watches: node ids it logs to the console, and whether it records write stacks. */
export interface SignalWatchReport {
  ids: string[];
  stacks: boolean;
}

export interface SignalGraphComponent {
  id: string;
  name: string;
  tag: string;
  path: string;
}

export type SignalResourceStatus =
  'idle' | 'loading' | 'reloading' | 'resolved' | 'error' | 'local';

export interface SignalResource {
  /** Stable id, also the key of the status history. */
  id: string;
  name: string;
  /** False when the resource has no `debugName` and `name` is a number. */
  named: boolean;
  status?: SignalResourceStatus;
  isLoading?: boolean;
  params?: unknown;
  value?: unknown;
  error?: unknown;
  /** HTTP status code of the last response (httpResource). */
  statusCode?: number;
  /** Version of the resource state, bumped on every status change. */
  epoch: number;
  changes?: number;
  /** Graph node ids of the signals the resource is built from. */
  nodeIds: string[];
}

export interface SignalGraphInjector {
  id: string;
  name: string;
}

export interface SignalGraph {
  nodes: SignalGraphNode[];
  edges: SignalGraphEdge[];
  componentSelector?: string;
  component?: SignalGraphComponent;
  /** Set instead of `component` when the graph belongs to an environment injector. */
  injector?: SignalGraphInjector;
  /** Environment injectors (root and route) the page can report a graph for. */
  environments?: SignalGraphInjector[];
  resources?: SignalResource[];
  /** Nodes Angular reported before the page kept the first `nodes.length`. */
  nodeCount?: number;
  /** True when the Angular version reports nodes without ids (before 20.1). */
  unsupported?: boolean;
  /** False when the signal write hook did not load, so history holds samples only. */
  writeHook?: false;
  source?: 'selected' | 'routed' | 'root';
  pageId?: string;
  /** Recent value changes, keyed by node or resource id, oldest first. */
  history?: Record<string, SignalChange[]>;
  /** Set when the page watches a signal or records write stacks. */
  watch?: SignalWatchReport;
}

/**
 * How hydration treated a component host, from Angular's dev-mode hydration
 * info: `hydrated` (server HTML reused), `skipped` (`ngSkipHydration`, so
 * rendered again on the client), `mismatched` (the DOM did not match the
 * server HTML), or `client` (no hydration info in a hydrated page: created on
 * the client, or inside a skipped host).
 */
export type HydrationStatus = 'hydrated' | 'skipped' | 'mismatched' | 'client';

export interface LiveComponentNode {
  id: string;
  /** The class name; on a directive host, the first directive's. */
  name: string;
  tag: string;
  /** `directive` for an element that hosts directives but no component. */
  kind?: 'directive';
  /** The other directives on the host; on a directive host, all of them. */
  directives?: string[];
  /** Attribute names from the selectors of those directives, such as `routerLink`. */
  attributes?: string[];
  /** Set on component hosts in a page that was rendered on the server. */
  hydration?: HydrationStatus;
  children: LiveComponentNode[];
}

/** A component whose DOM did not match the server HTML. */
export interface ComponentHydrationMismatch {
  id: string;
  name: string;
  tag: string;
  /** What Angular expected, as it describes it in its error. */
  expected?: string;
  /** What it found instead. */
  actual?: string;
}

/** Hydration of a page that was rendered on the server. Missing on any other page. */
export interface HydrationReport {
  /**
   * True when Angular hydrated at least one host. False when the page has
   * server HTML but nothing was hydrated: client hydration is off, so the app
   * rendered again on the client.
   */
  hydrated: boolean;
  /** Component hosts by status, and `@defer` blocks still dehydrated. */
  counts: Record<HydrationStatus, number> & { dehydratedBlocks: number };
  /** At most 20 mismatched components. */
  mismatches: ComponentHydrationMismatch[];
  /** The hydration overlay is drawn on the page. */
  overlay?: boolean;
}

export interface ComponentProp {
  name: string;
  prop: string;
  value?: unknown;
  listened?: boolean;
  kind?: 'signal' | 'resource';
  /** The write that edits it: `property` (set-component-property) or `signal` (set-signal). */
  edit?: 'property' | 'signal';
  /** Why it cannot be edited, when it cannot. */
  locked?: string;
  /**
   * The write that edits values inside it (`user.name`, `items[0]`), set on
   * an object or array whose root can be written.
   */
  editInside?: 'property' | 'signal';
}

export interface ComponentSource {
  /** Project-relative path from Angular's dev-mode debug info. */
  file: string;
  /** 1-based line of the class declaration. */
  line: number;
}

export interface ComponentDetail {
  id: string;
  name: string;
  tag: string;
  path: string;
  source?: ComponentSource;
  changeDetection?: string;
  encapsulation?: string;
  inputs: ComponentProp[];
  outputs: ComponentProp[];
  /** Own fields that are not inputs, outputs, injected services or methods. */
  properties: ComponentProp[];
  listeners: string[];
  directives: { name: string; inputs: ComponentProp[]; outputs: ComponentProp[] }[];
  dependencies: DependencyInfo[];
  /**
   * Nested value levels the panel opened, keyed by `valuePathKey()`, read
   * again on every push so they stay current. See `component-values.ts`.
   */
  expanded?: Record<string, unknown>;
}

export interface DeferBlockInfo {
  id: string;
  /** The component whose template holds the block. */
  owner?: { id: string; name: string; tag: string };
  /** `initial`, `placeholder`, `loading`, `complete` or `error`. */
  state: string;
  hydration: 'not-configured' | 'dehydrated' | 'hydrated';
  hydrateNever?: boolean;
  triggers: string[];
  hasErrorBlock: boolean;
  loading?: { minimumTime: number | null; afterTime: number | null };
  placeholder?: { minimumTime: number | null };
  /** Element ids of the block's rendered root elements, for highlighting. */
  rootIds: string[];
  /** Page clock, ms since epoch, when the state or hydration state last changed. */
  since: number;
  hydratedAt?: number;
}

export interface ForBlockInfo {
  id: string;
  /** The component whose template holds the block. */
  owner?: { id: string; name: string; tag: string };
  /** Items in the collection the block renders. */
  count: number;
  /**
   * What Angular reports for the `track` expression: `$index`, `item` (tracks
   * the item itself), `function` (any other expression), or `null` when unknown.
   */
  track: '$index' | 'item' | 'function' | null;
  hasEmptyBlock: boolean;
  /** The `@empty` block shows: there are no items and the block has one. */
  showingEmpty: boolean;
  /** Element ids of the first rendered root elements, for highlighting. */
  rootIds: string[];
}

export type PagePlatform = 'browser' | 'angular-native' | 'nativescript';

export interface ComponentTreeReport {
  pageId: string;
  url?: string;
  title?: string;
  platform?: PagePlatform;
  roots: LiveComponentNode[];
  count: number;
  truncated?: boolean;
  /**
   * The caps that stopped collection: `components` instances, `depth` DOM
   * levels, or `directiveHosts` elements that host only directives.
   */
  truncatedBy?: { components?: number; depth?: number; directiveHosts?: number };
  /** Elements in `roots` that host directives but no component; `count` leaves them out. */
  directiveHostCount?: number;
  /** Missing when the page was not rendered on the server. */
  hydration?: HydrationReport;
  detail: ComponentDetail | null;
  /** Missing when the page's Angular exposes no defer block util. */
  deferBlocks?: DeferBlockInfo[];
  /** True when the page has more defer blocks than the 500 in `deferBlocks`. */
  deferTruncated?: boolean;
  /** Missing when the page's Angular has no `ɵgetControlFlowBlocks` (before 22.0). */
  forBlocks?: ForBlockInfo[];
  /** The page has more `@for` blocks than it lists. */
  forBlocksTruncated?: boolean;
}

export interface ComponentPage extends ComponentTreeReport {
  reportedAt: number;
}

export interface InjectorInfo {
  id: string;
  type: 'element' | 'environment' | 'null';
  name: string;
  providerCount: number;
  component?: string;
  /**
   * The component's id in the component tree (`elementId` of the host), set on
   * element injectors whose host is a component. Links the two views.
   */
  componentId?: string;
  directives?: string[];
  selector?: string;
  path?: string[];
  /**
   * On an element injector: the id of the element injector where a `host`
   * lookup from here stops, the host of the component whose template declares
   * this element. Missing on a root component.
   */
  host?: string;
  /** Set by the server: one of Angular's own injectors (see `framework-tokens.ts`). */
  framework?: boolean;
}

export interface ProviderInfo {
  token: string;
  type: 'class' | 'value' | 'factory' | 'existing' | 'unknown';
  isViewProvider: boolean;
  multi?: boolean;
  importPath?: string[];
  /** Set by the server: the token comes from an installed `@angular/*` package. */
  framework?: boolean;
  /**
   * The state keys of an @ngrx/signals store instance the injector holds.
   * Every `signalStore()` class is named `SignalStore`, so the server names
   * the store from these, the way the NgRx tools do (`rpc/store-tokens.ts`).
   */
  stateKeys?: string[];
  /**
   * Set by the server when it renamed `token` (a signal store gets its
   * declared name): the class name the page reports, which the page matches.
   */
  tokenClass?: string;
}

export interface DependencyInfo {
  from: string;
  token: string;
  flags: string[];
  providedBy: string | null;
  providedByName?: string;
}

export interface InjectorTreeNode {
  injector: InjectorInfo;
  providers: ProviderInfo[];
  children: InjectorTreeNode[];
  dependencies?: DependencyInfo[];
}

/** `zone-unused`: zoneless, with zone.js still loaded on the page. */
export type ZoneMode = 'zoneless' | 'zone' | 'zone-unused';

export interface InjectorTreeReport {
  roots: InjectorTreeNode[];
  environment: InjectorTreeNode[];
  truncated?: boolean;
  zone?: ZoneMode;
}

export interface InjectorPage extends InjectorTreeReport {
  pageId: string;
  reportedAt: number;
}

// --- NgRx Store types ---

export interface NgrxActionInfo {
  name: string;
  source: string;
  file: string;
  line: number;
}

export interface NgrxReducerInfo {
  name: string;
  featureKey?: string;
  actions: string[];
  file: string;
  line: number;
}

export interface NgrxEffectInfo {
  name: string;
  actions: string[];
  file: string;
  line: number;
}

export interface NgrxSelectorInfo {
  name: string;
  file: string;
  line: number;
}

export interface NgrxFeatureInfo {
  name: string;
  featureKey: string;
  file: string;
  line: number;
}

export interface NgrxStoreEntry {
  name: string;
  kind:
    | 'action'
    | 'reducer'
    | 'effect'
    | 'selector'
    | 'feature'
    | 'store-setup'
    | 'signal-store'
    | 'signal-state'
    | 'signal-method';
  file: string;
  line: number;
  detail?: string;
}

export interface NgrxRuntimeAction {
  type: string;
  payload?: unknown;
  timestamp: number;
}

export interface NgrxRuntimeState {
  state: unknown;
  actions: NgrxRuntimeAction[];
}

export interface HydrationStats {
  enabled: boolean;
  hydratedComponents?: number;
  hydratedNodes?: number;
  componentsSkippedHydration?: number;
  deferBlocksWithIncrementalHydration?: number;
  nodes?: { hydrated: number; skipped: number; mismatched: number };
  mismatches: HydrationMismatch[];
  skipHydrationHosts: string[];
  warnings: string[];
  warningsCaptured: boolean;
  /** Navigation start until the app first became stable, when `providePangularHttp()` is set up. */
  stableMs?: number;
}

export interface HttpPage {
  pageId: string;
  url: string;
  initialUrl: string;
  title: string;
  hydration: HydrationStats | null;
  calls: HttpCall[];
  /** Older client calls the page removed at `limits.httpCalls`. */
  dropped?: number;
  /** The SSR request that served this document, read from its Server-Timing header. */
  ssrRequestId?: string;
  firstSeenAt: number;
  reportedAt: number;
}

/** What the page sends with `push-http`; `full` replaces the stored calls instead of adding to them. */
export type HttpReport = Omit<HttpPage, 'reportedAt' | 'firstSeenAt'> & { full: boolean };

export interface HttpState {
  serverCalls: HttpCall[];
  /** Older SSR calls removed at `limits.httpCalls`. */
  serverDropped?: number;
  /** Requests traced by `ssrMiddleware`, oldest first. */
  requests: SsrRequest[];
  pages: HttpPage[];
  rules: HttpRule[];
  /** Dev-only overrides that change server responses: render errors, forced Client renders, TransferState edits. */
  ssrOverrides: SsrOverride[];
}

/** TransferState payloads by page id, kept apart so call updates don't resend them. */
export interface HttpPayloadState {
  pages: Record<string, PayloadSummary>;
}

declare module 'devframe' {
  interface DevframeRpcSharedStates {
    'pangular:component-tree': {
      nodes: LiveComponentNode[];
      pages: Record<string, ComponentPage>;
      selectedId: string | null;
      highlightedId: string | null;
    };
    'pangular:routes': {
      routes: RouteInfo[];
      activeRoute: string | null;
    };
    'pangular:signal-graph': {
      graph: SignalGraph | null;
      pages: Record<string, SignalGraph>;
      selectedNodeId: string | null;
    };
    'pangular:injector-tree': {
      roots: InjectorTreeNode[];
      environment: InjectorTreeNode[];
      pages: Record<string, InjectorPage>;
      selectedInjectorId: string | null;
    };
    'pangular:ngrx-store': import('./ngrx-shared.ts').NgrxState;
    'pangular:http': HttpState;
    'pangular:http-payloads': HttpPayloadState;
    'pangular:change-detection': import('./rpc/cd-tools.ts').CdState;
  }
}
