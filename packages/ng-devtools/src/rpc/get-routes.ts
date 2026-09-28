import { defineRpcFunction } from 'devframe';
import * as v from 'valibot';
import { describable } from './agent-schema.ts';
import { analogVersion, buildRoutes, flattenRoutes } from './analog-scan.ts';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import {
  skipRegex,
  skipString,
  sourceRoots,
  startsRegex,
  stripComments,
  walkFiles,
} from './source-scan.ts';

const RouteSchema = v.object({
  path: v.string(),
  fullPath: v.string(),
  kind: v.picklist(['page', 'group', 'redirect', 'wildcard']),
  component: v.optional(v.string()),
  redirectTo: v.optional(v.string()),
  title: v.optional(v.string()),
  guards: v.optional(v.record(v.string(), v.array(v.string()))),
  resolvers: v.optional(v.array(v.string())),
  hasChildren: v.boolean(),
  file: v.string(),
  line: v.optional(v.number()),
});

type ExtractedRoute = v.InferOutput<typeof RouteSchema>;

export const getRoutes = defineRpcFunction({
  name: 'get-routes',
  type: 'query',
  jsonSerializable: true,
  args: [],
  returns: describable(v.array(RouteSchema)),
  agent: {
    description:
      "List Angular routes extracted from route configuration files in the workspace, with each route's full URL path (parents and loadChildren prefixes included), kind (page, group, redirect or wildcard), guards, resolvers and file:line. Call before suggesting navigation changes or analyzing the app structure.",
    title: 'List Angular routes',
  },
  setup: (ctx) => ({
    handler: async () => extractRoutes(ctx.cwd),
  }),
});

export function extractRoutes(cwd: string): ExtractedRoute[] {
  const routes: ExtractedRoute[] = analogVersion(cwd) ? analogRoutes(cwd) : [];
  const files: string[] = [];
  for (const root of sourceRoots(cwd)) {
    walkFiles(root, (full, entry) => {
      if (ROUTE_FILE.test(entry)) files.push(full);
    });
  }
  routes.push(...resolveFiles(files, cwd));
  return routes;
}

function joinPath(parent: string, path: string): string {
  const joined = [parent.replace(/\/$/, ''), path].filter((part) => part !== '').join('/');
  return joined.startsWith('/') ? joined : `/${joined}`;
}

function kindOf(
  path: string,
  props: Map<string, string>,
  redirectTo: string | undefined,
): ExtractedRoute['kind'] {
  if (path.split('/').includes('**')) return 'wildcard';
  if (redirectTo !== undefined) return 'redirect';
  if (props.has('component') || props.has('loadComponent')) return 'page';
  if (props.has('children') || props.has('loadChildren')) return 'group';
  return 'page';
}

function analogRoutes(cwd: string): ExtractedRoute[] {
  return flattenRoutes(buildRoutes(cwd))
    .filter((route) => route.file)
    .map((route) => {
      const path = route.fullPath.replace(/^\//, '');
      const out: ExtractedRoute = {
        path,
        fullPath: `/${path}`,
        kind: path.split('/').includes('**') ? 'wildcard' : 'page',
        component: route.file!.split('/').pop()!,
        hasChildren: route.children.length > 0,
        file: route.file!.replace(/^\//, ''),
      };
      if (route.title) out.title = route.title;
      return out;
    });
}

const ROUTE_FILE = /\.routes\.ts$|routing\.module\.ts$/;

interface LazyTarget {
  file: string;
  name?: string;
}

interface ParsedRoute {
  route: ExtractedRoute;
  parent: number;
  group?: string;
  lazy?: LazyTarget;
}

interface ParsedFile {
  rel: string;
  root: boolean;
  routes: ParsedRoute[];
}

function parseFile(file: string, cwd: string): ParsedFile | null {
  let content: string;
  try {
    content = readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
  const rel = relative(cwd, file).replaceAll('\\', '/');
  const source = stripComments(content);
  const routes: ParsedRoute[] = [];
  const kept = new Map<number, number>();
  const literals = objectLiterals(source);
  literals.forEach((literal, index) => {
    const props = topLevelProps(literal.body);
    const path = stringLiteral(props.get('path'));
    if (path === undefined) {
      if (literal.parent >= 0 && kept.has(literal.parent))
        kept.set(index, kept.get(literal.parent)!);
      return;
    }
    const redirectTo = routeRedirectTo(props);
    const route: ExtractedRoute = {
      path,
      fullPath: '',
      kind: kindOf(path, props, redirectTo),
      component: routeComponent(props),
      redirectTo,
      title: routeTitle(props),
      // `loadChildren` has children too, it just loads them lazily.
      hasChildren: props.has('children') || props.has('loadChildren'),
      file: rel,
      line: lineAt(source, literal.at),
    };
    const guards = routeGuards(props);
    if (guards) route.guards = guards;
    const resolvers = routeResolvers(props);
    if (resolvers) route.resolvers = resolvers;
    const parsed: ParsedRoute = {
      route,
      parent: literal.parent >= 0 ? (kept.get(literal.parent) ?? -1) : -1,
      group: literal.group,
    };
    const lazy = lazyTarget(props.get('loadChildren'), file, cwd);
    if (lazy) parsed.lazy = lazy;
    kept.set(index, routes.length);
    routes.push(parsed);
  });
  return { rel, root: /\bforRoot\s*\(/.test(source), routes };
}

function resolveFiles(found: string[], cwd: string): ExtractedRoute[] {
  const parsed = new Map<string, ParsedFile>();
  const queue = [...found];
  while (queue.length) {
    const file = queue.shift()!;
    if (parsed.has(file)) continue;
    const result = parseFile(file, cwd);
    if (!result) continue;
    parsed.set(file, result);
    for (const { lazy } of result.routes) {
      if (!lazy || parsed.has(lazy.file)) continue;
      queue.push(lazy.file);
      for (const sibling of routingModules(lazy.file)) queue.push(sibling);
    }
  }

  const loaders: { file: string; index: number; lazy: LazyTarget }[] = [];
  for (const [file, result] of parsed)
    result.routes.forEach((route, index) => {
      if (route.lazy) loaders.push({ file, index, lazy: route.lazy });
    });

  const memo = new Map<string, string>();
  const visiting = new Set<string>();

  const prefixOf = (file: string, group: string | undefined): string => {
    const targeting = loaders.filter((l) => l.lazy.file === file);
    const loader =
      targeting.find((l) => l.lazy.name === undefined || l.lazy.name === group) ??
      targeting[0] ??
      (/routing\.module\.ts$/.test(file) && !parsed.get(file)?.root
        ? loaders.find(
            (l) =>
              l.lazy.file !== file &&
              dirname(l.lazy.file) === dirname(file) &&
              parsed.get(l.lazy.file)?.routes.length === 0,
          )
        : undefined);
    return loader ? fullPathOf(loader.file, loader.index) : '';
  };

  const fullPathOf = (file: string, index: number): string => {
    const key = `${file}#${index}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    if (visiting.has(key)) return '';
    visiting.add(key);
    const route = parsed.get(file)!.routes[index];
    const base = route.parent >= 0 ? fullPathOf(file, route.parent) : prefixOf(file, route.group);
    const full = joinPath(base, route.route.path);
    visiting.delete(key);
    memo.set(key, full);
    return full;
  };

  const out: ExtractedRoute[] = [];
  for (const [file, result] of parsed)
    result.routes.forEach((route, index) => {
      out.push(clean({ ...route.route, fullPath: fullPathOf(file, index) }));
    });
  return out;
}

function clean(route: ExtractedRoute): ExtractedRoute {
  const out = { ...route } as Record<string, unknown>;
  for (const key of Object.keys(out)) if (out[key] === undefined) delete out[key];
  return out as ExtractedRoute;
}

function routingModules(file: string): string[] {
  try {
    const dir = dirname(file);
    return readdirSync(dir)
      .filter((entry) => /routing\.module\.ts$/.test(entry))
      .map((entry) => join(dir, entry));
  } catch {
    return [];
  }
}

function lazyTarget(value: string | undefined, from: string, cwd: string): LazyTarget | undefined {
  if (!value) return undefined;
  const spec = value.match(/import\(\s*(['"`])([^'"`]+)\1\s*\)/)?.[2];
  if (!spec || !spec.startsWith('.')) return undefined;
  const base = join(dirname(from), spec);
  const file = [`${base}.ts`, base.replace(/\.js$/, '.ts'), join(base, 'index.ts'), base].find(
    (candidate) => {
      try {
        return existsSync(candidate) && statSync(candidate).isFile() && candidate.endsWith('.ts');
      } catch {
        return false;
      }
    },
  );
  if (!file) return undefined;
  const rel = relative(cwd, file);
  if (rel.startsWith('..') || isAbsolute(rel)) return undefined;
  const name = value.match(/\.then\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\1\.(\w+)/)?.[2];
  return name && name !== 'default' ? { file, name } : { file };
}

function lineAt(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

const GUARD_KINDS = ['canMatch', 'canActivate', 'canActivateChild', 'canDeactivate', 'canLoad'];

function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '/' && startsRegex(body, i)) i = skipRegex(body, i);
    else if (ch === '"' || ch === "'" || ch === '`') i = skipString(body, i);
    else if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function guardName(entry: string): string {
  if (/^(?:async\b|function\b|\()/.test(entry)) return 'inline';
  return entry.match(/^(?:new\s+)?([\w$.]+)/)?.[1] ?? 'inline';
}

function routeGuards(props: Map<string, string>): Record<string, string[]> | undefined {
  const out: Record<string, string[]> = {};
  for (const kind of GUARD_KINDS) {
    const value = props.get(kind)?.match(/^\[([\s\S]*)\]$/)?.[1];
    if (value === undefined) continue;
    const names = splitTopLevel(value).map(guardName);
    if (names.length) out[kind] = names;
  }
  return Object.keys(out).length ? out : undefined;
}

function routeResolvers(props: Map<string, string>): string[] | undefined {
  const body = props.get('resolve')?.match(/^\{([\s\S]*)\}$/)?.[1];
  if (body === undefined) return undefined;
  const keys = [...topLevelProps(body)].map(([key, value]) => `${key}: ${guardName(value)}`);
  return keys.length ? keys : undefined;
}

function decodeEscapes(s: string): string {
  return s.replace(
    /\\(?:(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2})|([nrtbfv0\\])|(\r\n|[\r\n\u2028\u2029])|(.))/g,
    (
      _: string,
      hex: string | undefined,
      char: string | undefined,
      lineCont: string | undefined,
      anyChar: string | undefined,
    ) => {
      if (hex) return String.fromCharCode(parseInt(hex.slice(1), 16));
      if (char) {
        switch (char) {
          case 'n':
            return '\n';
          case 'r':
            return '\r';
          case 't':
            return '\t';
          case 'b':
            return '\b';
          case 'f':
            return '\f';
          case 'v':
            return '\v';
          case '0':
            return '\0';
          case '\\':
            return '\\';
          default:
            return char;
        }
      }
      if (lineCont) return '';
      return anyChar ?? '';
    },
  );
}

function stringLiteral(v?: string): string | undefined {
  if (!v) return undefined;
  const quote = v[0];
  if (quote !== "'" && quote !== '"' && quote !== '`') return undefined;
  if (skipString(v, 0) !== v.length - 1) return undefined;
  if (quote === '`' && /(^|[^\\])(?:\\\\)*\$\{/.test(v)) return undefined;
  return decodeEscapes(v.slice(1, -1));
}

function routeRedirectTo(props: Map<string, string>): string | undefined {
  const val = props.get('redirectTo');
  if (val === undefined) return undefined;
  const literal = stringLiteral(val);
  return literal !== undefined ? literal : '(dynamic)';
}

function routeTitle(props: Map<string, string>): string | undefined {
  const val = props.get('title');
  if (val === undefined) return undefined;
  const literal = stringLiteral(val);
  return literal !== undefined ? literal : '(dynamic)';
}

function routeComponent(props: Map<string, string>): string | undefined {
  const eager = props.get('component')?.match(/^(\w+)/)?.[1];
  if (eager) return eager;
  return props.get('loadComponent')?.match(/\.then\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\1\.(\w+)/)?.[2];
}

type Bracket = {
  ch: string;
  at: number;
  routeArray: boolean;
  routeObject: boolean;
  index: number;
  group?: string;
};

interface RouteLiteral {
  body: string;
  at: number;
  parent: number;
  group?: string;
}

// An array holds routes when it is the route configuration itself (a top-level
// array, or one passed to provideRouter/forRoot/forChild) or a `children` array.
// Any other array is metadata, so objects inside it are never routes.
const ROUTE_ARRAY = /(?:\bchildren\s*:|\b(?:provideRouter|forRoot|forChild)\s*\()\s*$/;
const ARRAY_NAME = /(?:\b(?:const|let|var)\s+([\w$]+)\s*(?::[^=;]*)?=|\bexport\s+(default))\s*$/;

function objectLiterals(source: string): RouteLiteral[] {
  const found: (RouteLiteral & { end: number })[] = [];
  const open: Bracket[] = [];
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '/' && startsRegex(source, i)) i = skipRegex(source, i);
    else if (ch === '"' || ch === "'" || ch === '`') i = skipString(source, i);
    else if ('([{'.includes(ch)) {
      const parent = open.at(-1);
      const before = source.slice(Math.max(0, i - 128), i);
      const routeArray = ch === '[' && (!parent || ROUTE_ARRAY.test(before.slice(-64)));
      const routeObject = ch === '{' && parent?.ch === '[' && parent.routeArray;
      const bracket: Bracket = { ch, at: i, routeArray, routeObject, index: -1 };
      if (routeArray) {
        bracket.index = parent?.routeObject ? parent.index : -1;
        if (parent?.routeObject) bracket.group = parent.group;
        else if (!parent) {
          const name = before.match(ARRAY_NAME);
          bracket.group = name?.[1] ?? name?.[2];
        }
      } else if (routeObject) {
        bracket.index = found.length;
        bracket.group = parent.group;
        found.push({ body: '', at: i, end: -1, parent: parent.index, group: parent.group });
      }
      open.push(bracket);
    } else if (')]}'.includes(ch)) {
      const closed = open.pop();
      if (ch === '}' && closed?.routeObject) found[closed.index].end = i;
    }
  }
  const remap = new Map<number, number>();
  const out: RouteLiteral[] = [];
  found.forEach(({ at, end, parent, group }, index) => {
    if (end < 0) return;
    remap.set(index, out.length);
    out.push({ body: source.slice(at + 1, end), at, parent: remap.get(parent) ?? -1, group });
  });
  return out;
}

function topLevelProps(body: string): Map<string, string> {
  const props = new Map<string, string>();
  for (const part of splitTopLevel(body)) {
    const prop = part.match(/^\s*(\w+)\s*:\s*([\s\S]*?)\s*$/);
    if (prop) props.set(prop[1], prop[2]);
  }
  return props;
}
