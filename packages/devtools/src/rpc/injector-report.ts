import * as v from 'valibot';
import type { DependencyInfo, InjectorTreeNode, ProviderInfo } from '../types.ts';
import { MAX_INJECTOR_NODES, MAX_SERVICE_DEPENDENCIES } from '../injector-tree.ts';

/** Element injectors plus room for the environment injectors around them. */
export const MAX_REPORTED_INJECTORS = MAX_INJECTOR_NODES + 500;
const MAX_TEXT = 500;
const MAX_SELECTOR = 4000;
const MAX_PROVIDERS = 1000;
/** How deep an injector can sit before the server leaves it out. */
export const MAX_INJECTOR_DEPTH = 1000;

const clipped = (max: number) =>
  v.pipe(
    v.string(),
    v.transform((text) => (text.length > max ? text.slice(0, max) : text)),
  );
const text = clipped(MAX_TEXT);
const texts = (max: number) =>
  v.pipe(
    v.array(text),
    v.transform((list) => list.slice(0, max)),
  );

const InjectorSchema = v.object({
  id: text,
  type: v.picklist(['element', 'environment', 'null']),
  name: text,
  providerCount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  component: v.optional(text),
  componentId: v.optional(text),
  directives: v.optional(texts(100)),
  selector: v.optional(clipped(MAX_SELECTOR)),
  path: v.optional(texts(200)),
  host: v.optional(text),
});

const ProviderSchema = v.object({
  token: text,
  type: v.picklist(['class', 'value', 'factory', 'existing', 'unknown']),
  isViewProvider: v.boolean(),
  multi: v.optional(v.boolean()),
  importPath: v.optional(texts(50)),
  stateKeys: v.optional(texts(200)),
});

const DependencySchema = v.object({
  from: text,
  token: text,
  flags: texts(10),
  providedBy: v.nullable(text),
  providedByName: v.optional(text),
});

/** Keeps the entries of `list` that match `schema`, up to `max`. */
function valid<T>(
  schema: v.GenericSchema<unknown, T>,
  list: unknown,
  max: number,
): T[] | undefined {
  if (!Array.isArray(list)) return undefined;
  const out: T[] = [];
  for (const item of list) {
    if (out.length >= max) break;
    const parsed = v.safeParse(schema, item);
    if (parsed.success) out.push(parsed.output);
  }
  return out;
}

/**
 * Checks an injector tree a page pushed before it reaches the panel and
 * agents. Malformed nodes are dropped with their children, malformed
 * providers and dependencies are dropped, long strings are clipped, and the
 * tree is cut with `truncated` set: element injectors at `MAX_INJECTOR_NODES`,
 * then environment injectors at what is left of `MAX_REPORTED_INJECTORS`, so
 * environment injectors never push element injectors out. Injectors nested
 * deeper than `MAX_INJECTOR_DEPTH` are left out too.
 */
export function sanitizeInjectorTree(
  roots: unknown,
  environment: unknown,
): { roots: InjectorTreeNode[]; environment: InjectorTreeNode[]; truncated: boolean } {
  let budget = MAX_INJECTOR_NODES;
  let truncated = false;
  const nodes = (list: unknown, depth: number): InjectorTreeNode[] => {
    const out: InjectorTreeNode[] = [];
    if (!Array.isArray(list)) return out;
    if (depth > MAX_INJECTOR_DEPTH) {
      if (list.length) truncated = true;
      return out;
    }
    for (const item of list) {
      const raw = item as Partial<Record<keyof InjectorTreeNode, unknown>> | null;
      if (!raw || typeof raw !== 'object') continue;
      const injector = v.safeParse(InjectorSchema, raw.injector);
      if (!injector.success) continue;
      if (budget <= 0) {
        truncated = true;
        break;
      }
      budget--;
      const node: InjectorTreeNode = {
        injector: injector.output,
        providers: valid<ProviderInfo>(ProviderSchema, raw.providers, MAX_PROVIDERS) ?? [],
        children: [],
      };
      const dependencies = valid<DependencyInfo>(
        DependencySchema,
        raw.dependencies,
        MAX_SERVICE_DEPENDENCIES,
      );
      if (dependencies) node.dependencies = dependencies;
      out.push(node);
      node.children = nodes(raw.children, depth + 1);
    }
    return out;
  };
  const rootNodes = nodes(roots, 0);
  budget += MAX_REPORTED_INJECTORS - MAX_INJECTOR_NODES;
  const environmentNodes = nodes(environment, 0);
  return { roots: rootNodes, environment: environmentNodes, truncated };
}
