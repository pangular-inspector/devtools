// Deep checks for a pushed component report, at the RPC boundary. A page
// runs code the server does not control (an older overlay, a native build
// pinned to another version, a third-party client), and the agent tools read
// every page at once, so one malformed entry must never reach them: bad
// entries are dropped, missing fields get safe defaults.
import type {
  ComponentDetail,
  ComponentProp,
  DeferBlockInfo,
  DependencyInfo,
  ForBlockInfo,
  HydrationStatus,
  LiveComponentNode,
} from '../types.ts';

type AnyRecord = Record<string, unknown>;

/** Deeper than any tree the overlay sends (it caps DOM depth), shallow enough for the stack. */
const MAX_DEPTH = 200;
/** Nodes kept per report; the overlay caps components well below this. */
const MAX_NODES = 20_000;

const HYDRATION = new Set<HydrationStatus>(['hydrated', 'skipped', 'mismatched', 'client']);
const DEFER_HYDRATION = new Set<DeferBlockInfo['hydration']>([
  'not-configured',
  'dehydrated',
  'hydrated',
]);
const TRACKS = new Set<ForBlockInfo['track']>(['$index', 'item', 'function']);

const isRecord = (value: unknown): value is AnyRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown): value is string => typeof value === 'string';
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter(str) : []);
const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const records = (value: unknown): AnyRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

/** The roots with every node that has an `id`, `name` and `tag`; other nodes and their subtrees go. */
export function guardComponentRoots(value: unknown): LiveComponentNode[] {
  let budget = MAX_NODES;
  const node = (raw: unknown, depth: number): LiveComponentNode | null => {
    if (budget <= 0 || !isRecord(raw)) return null;
    if (!str(raw['id']) || !raw['id'] || !str(raw['name']) || !str(raw['tag'])) return null;
    budget--;
    const out: LiveComponentNode = {
      id: raw['id'],
      name: raw['name'],
      tag: raw['tag'],
      children: [],
    };
    if (raw['kind'] === 'directive') out.kind = 'directive';
    if (Array.isArray(raw['directives'])) out.directives = strings(raw['directives']);
    if (Array.isArray(raw['attributes'])) out.attributes = strings(raw['attributes']);
    if (HYDRATION.has(raw['hydration'] as HydrationStatus)) {
      out.hydration = raw['hydration'] as HydrationStatus;
    }
    if (depth < MAX_DEPTH && Array.isArray(raw['children'])) {
      for (const child of raw['children']) {
        const kept = node(child, depth + 1);
        if (kept) out.children.push(kept);
      }
    }
    return out;
  };
  if (!Array.isArray(value)) return [];
  return value.map((root) => node(root, 0)).filter((root) => root !== null);
}

function guardProps(value: unknown): ComponentProp[] {
  return records(value)
    .filter((prop) => str(prop['name']))
    .map((prop) => ({
      ...prop,
      name: prop['name'] as string,
      prop: String(prop['prop'] ?? prop['name']),
    }));
}

function guardDependencies(value: unknown): DependencyInfo[] {
  return records(value)
    .filter((dep) => str(dep['token']))
    .map((dep) => ({
      ...dep,
      from: str(dep['from']) ? dep['from'] : '',
      token: dep['token'] as string,
      flags: strings(dep['flags']),
      providedBy: str(dep['providedBy']) ? dep['providedBy'] : null,
    }));
}

/** The selected component's detail, or null when it has no `id`, `name` and `tag`. */
export function guardComponentDetail(value: unknown): ComponentDetail | null {
  if (!isRecord(value)) return null;
  if (!str(value['id']) || !str(value['name']) || !str(value['tag'])) return null;
  return {
    ...value,
    id: value['id'],
    name: value['name'],
    tag: value['tag'],
    path: str(value['path']) ? value['path'] : '',
    inputs: guardProps(value['inputs']),
    outputs: guardProps(value['outputs']),
    properties: guardProps(value['properties']),
    listeners: strings(value['listeners']),
    directives: records(value['directives'])
      .filter((d) => str(d['name']))
      .map((d) => ({
        ...d,
        name: d['name'] as string,
        inputs: guardProps(d['inputs']),
        outputs: guardProps(d['outputs']),
      })),
    dependencies: guardDependencies(value['dependencies']),
  } as ComponentDetail;
}

function guardOwner(value: unknown): DeferBlockInfo['owner'] {
  if (!isRecord(value) || !str(value['id']) || !str(value['name'])) return undefined;
  return { id: value['id'], name: value['name'], tag: str(value['tag']) ? value['tag'] : '' };
}

/** The defer blocks that have an `id`, with every field the tools read set to a safe value. */
export function guardDeferBlocks(value: unknown): DeferBlockInfo[] {
  return records(value)
    .filter((block) => str(block['id']) && block['id'])
    .map((block) => {
      const owner = guardOwner(block['owner']);
      const out: DeferBlockInfo = {
        id: block['id'] as string,
        ...(owner ? { owner } : {}),
        state: str(block['state']) && block['state'] ? block['state'] : 'unknown',
        hydration: DEFER_HYDRATION.has(block['hydration'] as DeferBlockInfo['hydration'])
          ? (block['hydration'] as DeferBlockInfo['hydration'])
          : 'not-configured',
        triggers: strings(block['triggers']),
        hasErrorBlock: block['hasErrorBlock'] === true,
        rootIds: strings(block['rootIds']),
        since: finite(block['since']) ?? 0,
      };
      if (block['hydrateNever'] === true) out.hydrateNever = true;
      const hydratedAt = finite(block['hydratedAt']);
      if (hydratedAt !== undefined) out.hydratedAt = hydratedAt;
      const time = (raw: unknown) => finite(raw) ?? null;
      if (isRecord(block['loading'])) {
        out.loading = {
          minimumTime: time(block['loading']['minimumTime']),
          afterTime: time(block['loading']['afterTime']),
        };
      }
      if (isRecord(block['placeholder'])) {
        out.placeholder = { minimumTime: time(block['placeholder']['minimumTime']) };
      }
      return out;
    });
}

/** The `@for` blocks that have an `id`, with every field the tools read set to a safe value. */
export function guardForBlocks(value: unknown): ForBlockInfo[] {
  return records(value)
    .filter((block) => str(block['id']) && block['id'])
    .map((block) => {
      const owner = guardOwner(block['owner']);
      const count = finite(block['count']);
      return {
        id: block['id'] as string,
        ...(owner ? { owner } : {}),
        count: count !== undefined && count > 0 ? Math.floor(count) : 0,
        track: TRACKS.has(block['track'] as ForBlockInfo['track'])
          ? (block['track'] as ForBlockInfo['track'])
          : null,
        hasEmptyBlock: block['hasEmptyBlock'] === true,
        showingEmpty: block['showingEmpty'] === true,
        rootIds: strings(block['rootIds']),
      };
    });
}
