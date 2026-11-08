import type { SourceLocation } from '../../extension-bridge';
import type { HydrationStatus } from '../component-tree-state';
import type { HydrationReport } from '../hydration-section';
import type { DeferBlock } from '../defer-blocks-section';
import type { ForBlock } from '../for-blocks-section';

/** A component or directive the source scan found. */
export interface SourceComponent {
  selector: string;
  className: string;
  kind: 'component' | 'directive';
  file: string;
  line: number;
  inputs: string[];
  outputs: string[];
  isStandalone: boolean;
  changeDetection?: 'OnPush' | 'Eager' | 'unknown';
}

export interface LiveNode {
  id: string;
  name: string;
  tag: string;
  /** `directive` for an element that hosts directives but no component. */
  kind?: 'directive';
  directives?: string[];
  attributes?: string[];
  hydration?: HydrationStatus;
  children: LiveNode[];
}

export interface Prop {
  name: string;
  prop: string;
  value?: unknown;
  listened?: boolean;
  kind?: 'signal' | 'resource';
  edit?: 'property' | 'signal';
  locked?: string;
  editInside?: 'property' | 'signal';
}

export interface Dependency {
  from: string;
  token: string;
  flags: string[];
  providedBy: string | null;
  providedByName?: string;
}

export interface Detail {
  id: string;
  name: string;
  tag: string;
  path: string;
  /** A CSS selector that finds the host with `querySelector`, from a browser page. */
  selector?: string;
  source?: SourceLocation;
  changeDetection?: string;
  encapsulation?: string;
  inputs: Prop[];
  outputs: Prop[];
  properties?: Prop[];
  listeners: string[];
  directives: { name: string; inputs: Prop[]; outputs: Prop[] }[];
  dependencies: Dependency[];
  /** Nested value levels opened in the panel, read again on each push. */
  expanded?: Record<string, unknown>;
}

export interface Page {
  pageId: string;
  url?: string;
  title?: string;
  platform?: string;
  deferBlocks?: DeferBlock[];
  /** The page has more defer blocks than the ones in `deferBlocks`. */
  deferTruncated?: boolean;
  forBlocks?: ForBlock[];
  forBlocksTruncated?: boolean;
  roots: LiveNode[];
  count: number;
  /** Elements in `roots` that host directives but no component. */
  directiveHostCount?: number;
  hydration?: HydrationReport;
  truncated?: boolean;
  truncatedBy?: { components?: number; depth?: number; directiveHosts?: number };
  detail: Detail | null;
  reportedAt: number;
  /** The server clock minus the page clock, in ms, for ages of page times. */
  clockOffset?: number;
}

export interface OutletInfo {
  outlet: string;
  route?: string;
  element?: string;
  devtoolsId?: string;
  activated: boolean;
  children?: OutletInfo[];
}

export interface RoutedHit {
  route: string;
  outlet: string;
}

export interface PickResult {
  ok?: boolean;
  id?: string;
  name?: string;
  pageId?: string;
  error?: string;
}

export interface Row {
  node: LiveNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  /** Position among its siblings, from 1, and how many siblings there are, for screen readers. */
  posinset: number;
  setsize: number;
}

/** A form the Forms inspector found, and the file of the component that owns it. */
export interface FormOwner {
  formId: string;
  label: string;
  file: string | null;
}

/** Height of a tree row, fixed while the tree renders only the rows in view. */
export const TREE_ROW_PX = 32;

export function bare(name: string): string {
  return name.replace(/^_(?=[A-Z])/, '');
}

/** True when two paths name the same file, one maybe longer or with `./` or backslashes. */
export function sameSourceFile(a: string, b: string): boolean {
  const norm = (path: string) => path.replace(/\\/g, '/').replace(/^\.\//, '');
  const [x, y] = [norm(a), norm(b)];
  return x === y || x.endsWith('/' + y) || y.endsWith('/' + x);
}

/** The ids above `id`, nearest first; stops at a repeated id so a bad map cannot loop. */
export function ancestors(parents: ReadonlyMap<string, string>, id: string): string[] {
  const out: string[] = [];
  const seen = new Set([id]);
  for (let parent = parents.get(id); parent && !seen.has(parent); parent = parents.get(parent)) {
    seen.add(parent);
    out.push(parent);
  }
  return out;
}

/** The keys that move a running pick on the page, as the page names them. */
export const PICK_KEY_NAMES: Record<string, string> = {
  ArrowDown: 'next',
  ArrowUp: 'previous',
  ArrowLeft: 'parent',
  ArrowRight: 'child',
  Enter: 'pick',
};

export const DIRECTIVE_HOSTS_KEY = 'pangular:components:directive-hosts';

/** Whether this viewer last chose to show directive hosts; shown unless they hid them. */
export function storedDirectiveHosts(): boolean {
  try {
    return localStorage.getItem(DIRECTIVE_HOSTS_KEY) !== 'hidden';
  } catch {
    return true;
  }
}
