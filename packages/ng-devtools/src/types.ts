import type { HttpCall, HttpRule } from './http-rules.ts';
import type { PayloadSummary } from './http-payload.ts';

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
  | 'unknown';

export interface SignalGraphNode {
  id: string;
  kind: SignalNodeKind;
  label?: string;
  epoch: number;
  value?: unknown;
  watched: boolean;
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

export interface SignalGraph {
  nodes: SignalGraphNode[];
  edges: SignalGraphEdge[];
  componentSelector?: string;
  /** Recent value changes, keyed by node id, oldest first. */
  history?: Record<string, SignalChange[]>;
}

export interface InjectorInfo {
  id: string;
  type: 'element' | 'environment' | 'null';
  name: string;
  providerCount: number;
}

export interface ProviderInfo {
  token: string;
  type: 'class' | 'value' | 'factory' | 'existing' | 'unknown';
  isViewProvider: boolean;
}

export interface InjectorTreeNode {
  injector: InjectorInfo;
  providers: ProviderInfo[];
  children: InjectorTreeNode[];
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
  skipHydrationHosts: string[];
  warnings: string[];
}

export interface HttpPage {
  pageId: string;
  url: string;
  title: string;
  payload: PayloadSummary;
  hydration: HydrationStats | null;
  calls: HttpCall[];
  reportedAt: number;
}

export interface HttpState {
  serverCalls: HttpCall[];
  pages: HttpPage[];
  rules: HttpRule[];
}

declare module 'devframe' {
  interface DevframeRpcSharedStates {
    'ng-devtools:component-tree': {
      nodes: ComponentNode[];
      selectedId: string | null;
      highlightedId: string | null;
    };
    'ng-devtools:routes': {
      routes: RouteInfo[];
      activeRoute: string | null;
    };
    'ng-devtools:signal-graph': {
      graph: SignalGraph | null;
      selectedNodeId: string | null;
    };
    'ng-devtools:injector-tree': {
      roots: InjectorTreeNode[];
      selectedInjectorId: string | null;
    };
    'ng-devtools:ngrx-store': {
      state: unknown;
      actions: NgrxRuntimeAction[];
      connected: boolean;
    };
    'ng-devtools:http': HttpState;
  }
}
