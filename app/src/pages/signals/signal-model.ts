import type { SignalChange, SignalGraphNode } from '@pangular-inspector/devtools/internal/types';
import type { SignalGraph } from '../../types/signal-graph.types';

export type SignalNode = SignalGraphNode;

export interface RestoreResult {
  ok?: boolean;
  key?: string;
  error?: string;
}

export interface LiveNode {
  id: string;
  name: string;
  tag: string;
  /** `directive` for an element that hosts directives but no component. */
  kind?: 'directive';
  children: LiveNode[];
}

export interface SourceSignal {
  name: string;
  kind: string;
  file: string;
  line: number;
  component?: string;
}

export const FOLLOW = 'follow';

// Older servers send only the newest graph, without the per-page map.
export function graphPagesOf(state: {
  graph?: SignalGraph | null;
  pages: Record<string, SignalGraph>;
}): Record<string, SignalGraph> {
  if (Object.keys(state.pages).length) return state.pages;
  return state.graph ? { [state.graph.pageId ?? '']: state.graph } : {};
}
export const ENV = 'env:';
export const MAX_HISTORY = 50;
/** Kinds with a value, so the page can watch them. */
export const WATCHABLE = new Set(['signal', 'computed', 'linkedSignal']);
/** Changes of watched signals the panel lists. */
export const WATCH_LOG = 20;

const SOURCE_NOTES: Record<NonNullable<SignalGraph['source']>, string> = {
  selected: 'picked',
  routed: 'rendered by the router',
  root: 'first component with signals',
};

const SOURCE_LABELS: Record<SignalChange['source'], string> = {
  write: 'set',
  sample: 'sampled',
  initial: 'initial',
};

const RESOURCE_STATUS_TONES: Record<string, string> = {
  resolved: 'ok',
  local: 'ok',
  loading: 'warn',
  reloading: 'warn',
  error: 'danger',
};

/** Each kind's `--kind-*` token from `_palette.scss` (`$signal-kinds`). */
const KIND_TOKENS: Record<string, string> = {
  signal: 'signal',
  computed: 'computed',
  linkedSignal: 'linked',
  effect: 'effect',
  template: 'template',
  afterRenderEffectPhase: 'after-render',
  childSignalProp: 'child-prop',
  'input (signal)': 'input',
  'input.required (signal)': 'input',
  'output (signal)': 'output',
  'model (signal)': 'model',
  'model.required (signal)': 'model',
  'viewChild (signal)': 'view-query',
  'viewChild.required (signal)': 'view-query',
  'viewChildren (signal)': 'view-query',
  'contentChild (signal)': 'content-query',
  'contentChild.required (signal)': 'content-query',
  'contentChildren (signal)': 'content-query',
  resource: 'resource',
};

export function sourceNote(source: NonNullable<SignalGraph['source']>) {
  return SOURCE_NOTES[source];
}

export function sourceLabel(source: SignalChange['source']) {
  return SOURCE_LABELS[source];
}

export function statusTone(status: string) {
  return RESOURCE_STATUS_TONES[status] ?? 'neutral';
}

export function kindColor(kind: string) {
  return `var(--kind-${KIND_TOKENS[kind] ?? 'unknown'})`;
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
