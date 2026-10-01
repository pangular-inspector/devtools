import type {
  DependencyInfo,
  InjectorInfo,
  InjectorTreeNode,
  InjectorTreeReport,
  ProviderInfo,
} from './types.ts';
import { isComment, parentOf, walkElements } from './dom-walk.ts';
import { zoneModeOf } from './zone-mode.ts';

interface ProviderRecord {
  token: unknown;
  provider: unknown;
  isViewProvider?: boolean;
  importPath?: unknown[];
}

export interface DebugNg {
  getInjector?(el: Element): unknown;
  getComponent?(el: Element): unknown;
  getDirectives?(node: Node): unknown[];
  ɵgetInjectorMetadata?(injector: unknown): { type: string; source: unknown } | null;
  ɵgetInjectorProviders?(injector: unknown): ProviderRecord[];
  ɵgetInjectorResolutionPath?(injector: unknown): unknown[];
  ɵgetDependenciesFromInjectable?(
    injector: unknown,
    token: unknown,
  ): {
    dependencies: {
      token?: unknown;
      value?: unknown;
      flags?: { optional?: boolean; host?: boolean; self?: boolean; skipSelf?: boolean };
      providedIn?: unknown;
    }[];
  };
}

const ids = new WeakMap<object, string>();
let nextId = 0;

function idFor(key: object): string {
  let id = ids.get(key);
  if (!id) {
    id = `inj-${++nextId}`;
    ids.set(key, id);
  }
  return id;
}

export function className(
  ctor: { readonly name?: string } | (abstract new (...args: never[]) => unknown),
): string {
  return (ctor.name || 'anonymous class').replace(/^_(?=[A-Z])/, '');
}

export function tokenName(token: unknown): string {
  if (typeof token === 'function') return className(token);
  if (token && typeof token === 'object') {
    const desc = (token as { _desc?: unknown })._desc;
    if (typeof desc === 'string' && desc) return desc;
    const text = String(token);
    return text.startsWith('InjectionToken ') ? text.slice('InjectionToken '.length) : text;
  }
  return String(token);
}

export function providerKind(provider: unknown): ProviderInfo['type'] {
  if (typeof provider === 'function') return 'class';
  if (!provider || typeof provider !== 'object') return 'unknown';
  if ('useValue' in provider) return 'value';
  if ('useFactory' in provider) return 'factory';
  if ('useExisting' in provider) return 'existing';
  if ('useClass' in provider) return 'class';
  return 'unknown';
}

function isBuiltInElementToken(record: ProviderRecord): boolean {
  const token = record.token as { __NG_ELEMENT_ID__?: unknown } | null;
  return record.provider === record.token && !!token && '__NG_ELEMENT_ID__' in token;
}

type RecordReader = (injector: unknown) => ProviderRecord[];

function recordReader(ng: DebugNg): RecordReader {
  const cache = new Map<unknown, ProviderRecord[]>();
  return (injector) => {
    let list = cache.get(injector);
    if (!list) {
      try {
        list = ng.ɵgetInjectorProviders?.(injector) ?? [];
      } catch {
        list = [];
      }
      cache.set(injector, list);
    }
    return list;
  };
}

function toProviders(injector: unknown, records: RecordReader): ProviderInfo[] {
  return records(injector)
    .filter((record) => !isBuiltInElementToken(record))
    .map((record) => {
      const info: ProviderInfo = {
        token: tokenName(record.token),
        type: providerKind(record.provider),
        isViewProvider: !!record.isViewProvider,
      };
      const multi = (record.provider as { multi?: unknown } | null)?.multi;
      if (multi === true) info.multi = true;
      if (record.importPath?.length) info.importPath = record.importPath.map(tokenName);
      return info;
    });
}

function selectorCache(doc: Document) {
  const selectors = new Map<Element, string | null>();
  const positions = new Map<Element, number>();
  const top = doc.documentElement;
  const selectorOf = (el: Element): string | null => {
    if (el === top) return '';
    const known = selectors.get(el);
    if (known !== undefined) return known;
    const parent = el.parentElement;
    const tag = el.tagName.toLowerCase();
    let out: string | null = el.parentNode === doc ? tag : null;
    if (parent) {
      if (!positions.has(el)) {
        let index = 0;
        for (const child of Array.from(parent.children)) positions.set(child, ++index);
      }
      const prefix = selectorOf(parent);
      const part = `${tag}:nth-child(${positions.get(el)})`;
      out = prefix === null ? null : prefix ? `${prefix} > ${part}` : part;
    }
    selectors.set(el, out);
    return out;
  };
  return selectorOf;
}

function environmentName(injector: unknown, source: unknown): string {
  const scopes = (injector as { scopes?: Set<string> } | null)?.scopes;
  if (scopes?.has('platform')) return 'Platform';
  if (scopes?.has('root')) return 'Root';
  if (typeof source === 'string' && source) return source;
  return 'Environment';
}

export const NULL_INJECTOR_ID = 'inj-null';

export function injectorRef(ng: DebugNg, injector: unknown): { id: string; name: string } | null {
  if (!injector || typeof injector !== 'object') return null;
  let meta: { type: string; source: unknown } | null = null;
  try {
    meta = ng.ɵgetInjectorMetadata?.(injector) ?? null;
  } catch {
    return null;
  }
  if (meta?.type === 'element') {
    const source = meta.source;
    if (source instanceof Element) {
      return { id: idFor(source), name: `<${source.tagName.toLowerCase()}>` };
    }
    return isComment(source) ? { id: idFor(source), name: '<ng-container>' } : null;
  }
  if (meta?.type === 'null') return { id: NULL_INJECTOR_ID, name: 'Null injector' };
  return { id: idFor(injector), name: environmentName(injector, meta?.source) };
}

type DependencyFlags = { optional?: boolean; host?: boolean; self?: boolean; skipSelf?: boolean };

/**
 * The injector on the lookup path whose own providers list the token.
 * `ɵgetDependenciesFromInjectable` treats a provider whose value is `null` as
 * missing, so a `useValue: null` provider is found here instead.
 */
function listedOnPath(
  ng: DebugNg,
  path: unknown[],
  records: RecordReader,
  token: unknown,
  flags: DependencyFlags,
): unknown {
  for (let i = 0; i < path.length; i++) {
    if (i === 0 && flags.skipSelf) continue;
    const candidate = path[i];
    if (flags.host) {
      let type: string | undefined;
      try {
        type = ng.ɵgetInjectorMetadata?.(candidate)?.type;
      } catch {
        type = undefined;
      }
      if (type !== 'element') break;
    }
    if (records(candidate).some((record) => record.token === token)) return candidate;
    if (i === 0 && flags.self) break;
  }
  return null;
}

export function dependenciesOf(
  ng: DebugNg,
  injector: unknown,
  owners: Iterable<unknown>,
  withNames = false,
  records: RecordReader = recordReader(ng),
): DependencyInfo[] {
  const out: DependencyInfo[] = [];
  let path: unknown[] | undefined;
  const lookupPath = () => {
    if (!path) {
      try {
        path = ng.ɵgetInjectorResolutionPath?.(injector) ?? [];
      } catch {
        path = [];
      }
    }
    return path;
  };
  for (const ctor of owners) {
    if (typeof ctor !== 'function') continue;
    try {
      const result = ng.ɵgetDependenciesFromInjectable?.(injector, ctor);
      for (const dep of result?.dependencies ?? []) {
        if (dep.token === undefined) continue;
        const flags = Object.entries(dep.flags ?? {})
          .filter(([, on]) => on)
          .map(([flag]) => flag);
        const providedIn =
          dep.providedIn ?? listedOnPath(ng, lookupPath(), records, dep.token, dep.flags ?? {});
        const by = providedIn ? injectorRef(ng, providedIn) : null;
        const info: DependencyInfo = {
          from: className(ctor),
          token: tokenName(dep.token),
          flags,
          providedBy: by?.id ?? null,
        };
        if (withNames && by) info.providedByName = by.name;
        out.push(info);
      }
    } catch {
      continue;
    }
  }
  return out;
}

interface Env {
  node: InjectorTreeNode;
  parent: object | null;
}

interface ElementEntry {
  info: Omit<InjectorInfo, 'selector'>;
  providers: ProviderInfo[];
  dependencies: DependencyInfo[];
  environments: object[];
}

export const MAX_INJECTOR_NODES = 2000;
export const MAX_SERVICE_DEPENDENCIES = 500;

interface InjectorRecord {
  factory?: unknown;
  value?: unknown;
  multi?: unknown;
}

function ownRecords(injector: unknown): [unknown, InjectorRecord][] {
  const records = (injector as { records?: unknown } | null)?.records;
  if (!(records instanceof Map)) return [];
  return [...records.entries()].filter(
    (entry): entry is [unknown, InjectorRecord] => !!entry[1] && typeof entry[1] === 'object',
  );
}

/**
 * Whether the injector already holds an instance for a record. A record still
 * waiting to be created holds an empty placeholder object (or one mid-creation),
 * and asking Angular for its dependencies would create it.
 */
function isCreated(record: InjectorRecord): boolean {
  const { value } = record;
  if (value === undefined || value === null) return false;
  if (typeof value !== 'object') return true;
  return !(Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === 0);
}

const serviceDependencies = new WeakMap<object, Map<unknown, DependencyInfo[]>>();

/** What the services an environment injector already created inject. */
function environmentDependencies(
  ng: DebugNg,
  injector: object,
  records: RecordReader,
): DependencyInfo[] {
  let known = serviceDependencies.get(injector);
  if (!known) {
    known = new Map();
    serviceDependencies.set(injector, known);
  }
  const out: DependencyInfo[] = [];
  const seen = new Set<string>();
  for (const [token, record] of ownRecords(injector)) {
    if (out.length >= MAX_SERVICE_DEPENDENCIES) break;
    if (typeof token !== 'function' || typeof record.factory !== 'function') continue;
    if (record.multi || !isCreated(record)) continue;
    let deps = known.get(token);
    if (!deps) {
      deps = dependenciesOf(ng, injector, [token], false, records);
      known.set(token, deps);
    }
    for (const dep of deps) {
      const key = `${dep.from}|${dep.token}|${dep.flags.join(',')}|${dep.providedBy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(dep);
    }
  }
  return out.slice(0, MAX_SERVICE_DEPENDENCIES);
}

const elementEntries = new WeakMap<Element | Comment, ElementEntry>();

function environmentsOf(ng: DebugNg, path: unknown[]): object[] {
  return path.filter((injector) => {
    try {
      return ng.ɵgetInjectorMetadata!(injector)?.type === 'environment';
    } catch {
      return false;
    }
  }) as object[];
}

function readElement(
  ng: DebugNg,
  el: Element | Comment,
  records: RecordReader,
): ElementEntry | null {
  const cached = elementEntries.get(el);
  if (cached) return cached;
  let component: unknown = null;
  let directives: unknown[] = [];
  try {
    component = isComment(el) ? null : (ng.getComponent?.(el) ?? null);
    directives = ng.getDirectives?.(el) ?? [];
  } catch {
    return null;
  }
  if (!component && directives.length === 0) return null;

  let injector: unknown;
  try {
    injector = ng.getInjector!(el as Element);
  } catch {
    return null;
  }
  if (!injector) return null;

  let path: unknown[] = [];
  try {
    path = ng.ɵgetInjectorResolutionPath?.(injector) ?? [];
  } catch {
    path = [];
  }

  const providers = toProviders(injector, records);
  const owners = new Set(
    [component, ...directives]
      .map((owner) => (owner as { constructor?: unknown } | null)?.constructor)
      .filter((ctor): ctor is new () => unknown => typeof ctor === 'function' && ctor !== Object),
  );
  const componentCtor = (component as { constructor?: unknown } | null)?.constructor;
  const info: Omit<InjectorInfo, 'selector'> = {
    id: idFor(el),
    type: 'element',
    name: isComment(el) ? 'ng-container' : el.tagName.toLowerCase(),
    providerCount: providers.length,
    directives: [...owners].map(className),
    path: path
      .map((entry) => injectorRef(ng, entry)?.id ?? null)
      .filter((id): id is string => !!id),
  };
  if (typeof componentCtor === 'function') info.component = className(componentCtor);
  const entry: ElementEntry = {
    info,
    providers,
    dependencies: dependenciesOf(ng, injector, owners, false, records),
    environments: environmentsOf(ng, path),
  };
  elementEntries.set(el, entry);
  return entry;
}

export function collectInjectorTree(
  ng: DebugNg | undefined,
  doc: Document = document,
): InjectorTreeReport {
  const empty: InjectorTreeReport = { roots: [], environment: [] };
  if (!ng?.getInjector || !ng.ɵgetInjectorMetadata) return empty;

  const records = recordReader(ng);
  const envs = new Map<object, Env>();
  const noteEnvironment = (chain: object[]) => {
    chain.forEach((injector, index) => {
      if (envs.has(injector)) return;
      let meta: { type: string; source: unknown } | null = null;
      try {
        meta = ng.ɵgetInjectorMetadata!(injector);
      } catch {
        meta = null;
      }
      const providers = toProviders(injector, records);
      envs.set(injector, {
        parent: chain[index + 1] ?? null,
        node: {
          injector: {
            id: idFor(injector),
            type: 'environment',
            name: environmentName(injector, meta?.source),
            providerCount: providers.length,
          },
          providers,
          children: [],
          dependencies: environmentDependencies(ng, injector, records),
        },
      });
    });
  };

  const selectorOf = selectorCache(doc);
  const elementNodes = new Map<Node, InjectorTreeNode>();
  const roots: InjectorTreeNode[] = [];
  let truncated = false;

  for (const el of walkElements(doc.body ?? doc.documentElement, true)) {
    const entry = readElement(ng, el, records);
    if (!entry) continue;
    if (elementNodes.size >= MAX_INJECTOR_NODES) {
      truncated = true;
      break;
    }
    noteEnvironment(entry.environments);

    const selector = isComment(el) ? null : selectorOf(el);
    const node: InjectorTreeNode = {
      injector: selector === null ? { ...entry.info } : { ...entry.info, selector },
      providers: entry.providers,
      children: [],
      dependencies: entry.dependencies,
    };
    elementNodes.set(el, node);

    let parent = parentOf(el);
    while (parent && !elementNodes.has(parent)) parent = parentOf(parent);
    if (parent) elementNodes.get(parent)!.children.push(node);
    else roots.push(node);
  }

  const environment: InjectorTreeNode[] = [];
  for (const env of envs.values()) {
    const parent = env.parent ? envs.get(env.parent) : undefined;
    if (parent) parent.node.children.push(env.node);
    else environment.push(env.node);
  }

  const report: InjectorTreeReport = truncated
    ? { roots, environment, truncated }
    : { roots, environment };
  const root = [...envs.keys()].find((injector) =>
    (injector as { scopes?: Set<string> }).scopes?.has?.('root'),
  );
  const zone = root ? zoneModeOf(root) : null;
  if (zone) report.zone = zone;
  return report;
}
