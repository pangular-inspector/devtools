import type {
  SignalChange,
  SignalGraphElement,
  SignalGraphNode,
} from '@pangular-inspector/devtools/internal/types';

export interface SignalEdge {
  consumer: number;
  producer: number;
}

export interface SignalResource {
  id: string;
  name: string;
  named: boolean;
  status?: string;
  isLoading?: boolean;
  params?: unknown;
  value?: unknown;
  error?: unknown;
  statusCode?: number;
  epoch: number;
  changes?: number;
  nodeIds: string[];
}

export interface GraphInjector {
  id: string;
  name: string;
}

/** The signal graph of one page, as the Signals tab reads it from the `signal-graph` state. */
export interface SignalGraph {
  nodes: SignalGraphNode[];
  edges: SignalEdge[];
  componentSelector?: string;
  component?: { id: string; name: string; tag: string; path: string };
  injector?: GraphInjector;
  element?: SignalGraphElement;
  environments?: GraphInjector[];
  resources?: SignalResource[];
  nodeCount?: number;
  unsupported?: boolean;
  writeHook?: false;
  source?: 'selected' | 'routed' | 'root';
  pageId?: string;
  history?: Record<string, SignalChange[]>;
  watch?: { ids: string[]; stacks: boolean };
}
