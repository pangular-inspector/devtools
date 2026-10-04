import type {} from 'devframe';
import type { HttpCall, HttpRule } from './http-rules.ts';
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
}

export interface LiveComponentNode {
  id: string;
  name: string;
  tag: string;
  directives?: string[];
  children: LiveComponentNode[];
}

export interface ComponentProp {
  name: string;
  prop: string;
  value?: unknown;
  listened?: boolean;
  kind?: 'signal' | 'resource';
}

export interface ComponentDetail {
  id: string;
  name: string;
  tag: string;
  path: string;
  changeDetection?: string;
  encapsulation?: string;
  inputs: ComponentProp[];
  outputs: ComponentProp[];
  /** Own fields that are not inputs, outputs, injected services or methods. */
  properties: ComponentProp[];
  listeners: string[];
  directives: { name: string; inputs: ComponentProp[]; outputs: ComponentProp[] }[];
  dependencies: DependencyInfo[];
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

export type PagePlatform = 'browser' | 'angular-native';

export interface ComponentTreeReport {
  pageId: string;
  url?: string;
  title?: string;
  platform?: PagePlatform;
  roots: LiveComponentNode[];
  count: number;
  truncated?: boolean;
  /** The caps that stopped collection: `components` instances, or `depth` DOM levels. */
  truncatedBy?: { components?: number; depth?: number };
  detail: ComponentDetail | null;
  /** Missing when the page's Angular exposes no defer block util. */
  deferBlocks?: DeferBlockInfo[];
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
  directives?: string[];
  selector?: string;
  path?: string[];
}

export interface ProviderInfo {
  token: string;
  type: 'class' | 'value' | 'factory' | 'existing' | 'unknown';
  isViewProvider: boolean;
  multi?: boolean;
  importPath?: string[];
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
  firstSeenAt: number;
  reportedAt: number;
}

/** What the page sends with `push-http`; `full` replaces the stored calls instead of adding to them. */
export type HttpReport = Omit<HttpPage, 'reportedAt' | 'firstSeenAt'> & { full: boolean };

export interface HttpState {
  serverCalls: HttpCall[];
  /** Older SSR calls removed at `limits.httpCalls`. */
  serverDropped?: number;
  pages: HttpPage[];
  rules: HttpRule[];
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
