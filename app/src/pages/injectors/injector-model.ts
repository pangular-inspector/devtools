import type {
  InjectorTreeNode,
  ProviderInfo as PanelProviderInfo,
} from '@pangular-inspector/devtools/internal/types';

export type ProviderInfo = PanelProviderInfo;
export type InjectorNode = InjectorTreeNode;

/** One entry of the source scan (`get-providers`). */
export interface SourceProvider {
  token: string;
  source: string;
  file: string;
  line: number;
  providedIn?: string;
  type: string;
}

/** One shown row of the injector tree. */
export interface Row {
  node: InjectorNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

export type TreeView = 'element' | 'environment';

export interface InjectorPage {
  roots?: unknown;
  environment?: unknown;
  truncated?: unknown;
  limits?: unknown;
  zone?: unknown;
  reportedAt?: unknown;
}

export interface InjectorTreeState extends InjectorPage {
  pages?: Record<string, InjectorPage>;
}

/** One step of the selected injector's lookup path. */
export interface PathStep {
  id: string;
  label: string;
  kind: string;
  providers: number;
}

export const NULL_ID = 'inj-null';
export const HIDE_FRAMEWORK_PREF = 'injectors.hideFramework';
export const MAX_PROVIDED_BY = 12;
/** The `type` the source scan gives a provide*() call it can't resolve to tokens. */
export const HELPER_TYPE = 'helper';
/** Source entries that provide a token, which the orphaned providers hint checks. */
export const PROVIDING_TYPES = new Set(['provider', 'injectable']);
/** How long typing must pause before the search result is announced. */
export const SEARCH_ANNOUNCE_MS = 600;

// Text tones: these color the kind letter and badge on a 14 to 16% tint of
// themselves, so they use the stronger `-text` tokens.
const KIND_TONE: Record<string, string> = {
  component: 'var(--accent-text)',
  directive: 'var(--directive)',
  environment: 'var(--ok-text)',
  null: 'var(--text-3)',
};

export function kindOf(node: InjectorNode): 'component' | 'directive' | 'environment' {
  if (node.injector.type !== 'element') return 'environment';
  return node.injector.component ? 'component' : 'directive';
}

export function labelOf(node: InjectorNode): string {
  return node.injector.type === 'element' ? `<${node.injector.name}>` : node.injector.name;
}

export function toneOf(kind: string): string {
  return KIND_TONE[kind] ?? KIND_TONE['null'];
}

export function isTree(value: unknown): value is InjectorNode[] {
  return Array.isArray(value);
}
