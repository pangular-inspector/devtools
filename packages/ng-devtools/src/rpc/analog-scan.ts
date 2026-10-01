import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { IGNORED_DIRS, maskStrings, stripComments } from './source-scan.ts';

export type AnalogRouteKind = 'page' | 'layout' | 'markdown' | 'group' | 'implicit';

export interface AnalogRoute {
  id: string;
  segment: string;
  fullPath: string;
  file?: string;
  kind: AnalogRouteKind;
  params: string[];
  catchAll?: 'required' | 'optional';
  serverFile?: string;
  serverExports?: string[];
  routeMeta?: string[];
  defaultExport?: boolean;
  outlet?: boolean;
  title?: string;
  children: AnalogRoute[];
}

export interface AnalogApiRoute {
  path: string;
  method: string;
  file: string;
  params: string[];
}

export interface AnalogServerFn {
  name: string;
  file: string;
  id: string;
  method: string;
}

export interface AnalogContentFile {
  file: string;
  slug: string;
  attributes: Record<string, string>;
  error?: string;
}

export interface AnalogRouteRule {
  path: string;
  ssr?: boolean;
  prerender?: boolean;
  isr?: string;
  swr?: string;
  cache?: boolean;
  redirect?: string;
  cacheControl?: string;
}

export interface AnalogConfig {
  ssr?: boolean;
  static?: boolean;
  prerender?: string[];
  prerenderDynamic?: boolean;
  apiPrefix: string;
  noSsrRoutes: string[];
  routeRules: AnalogRouteRule[];
  configFile?: string;
}

export interface AnalogProject {
  analog: boolean;
  version?: string;
  root: string;
  routes: AnalogRoute[];
  files: string[];
  serverFiles: string[];
  api: AnalogApiRoute[];
  middleware: string[];
  content: AnalogContentFile[];
  serverFns: AnalogServerFn[];
  config: AnalogConfig;
  prerendered: string[];
  scanErrors?: string[];
}

export interface AnalogLintFinding {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  file?: string;
  path?: string;
  message: string;
  fix: string;
}

const MAX_FILES = 4000;
const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'connect',
  'trace',
];

let walkErrors: Map<string, string> | null = null;

function walk(dir: string, accept: (name: string) => boolean, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') walkErrors?.set(dir, code ?? 'unknown error');
    return out;
  }
  for (const entry of entries.sort()) {
    if (out.length >= MAX_FILES) return out;
    const full = join(dir, entry);
    try {
      const stats = lstatSync(full);
      if (stats.isSymbolicLink()) continue;
      if (stats.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.toLowerCase())) walk(full, accept, out);
        continue;
      }
    } catch {
      continue;
    }
    if (accept(entry)) out.push(full);
  }
  return out;
}

function read(file: string): string {
  try {
    return readFileSync(file, 'utf-8');
  } catch {
    return '';
  }
}

function rel(root: string, file: string): string {
  return `/${relative(root, file).split('\\').join('/')}`;
}

export function toRawPath(filename: string): string {
  return filename
    .replace(
      /^(?:[a-zA-Z]:[\\/])?(.*?)[\\/](?:routes|pages)[\\/]|(?:[\\/](?:app[\\/](?:routes|pages)|src[\\/]content)[\\/])|(\.page\.(js|ts|analog|ag)$)|(\.(ts|md|analog|ag)$)/g,
      '',
    )
    .replace(/\[\[\.\.\.([^\]]+)\]\]/g, '(opt-$1)')
    .replace(/\[\.{3}.+\]/, '**')
    .replace(/\[([^\]]+)\]/g, ':$1');
}

export function toSegment(rawSegment: string): string {
  return rawSegment
    .replace(/index|\(.*?\)/g, '')
    .replace(/\.|\/+/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

interface RawRoute {
  filename: string | null;
  rawSegment: string;
  ancestors: string[];
  segment: string;
  children: RawRoute[];
}

function deprioritize(segment: string): string {
  return segment.replace(':', '~~').replace('**', '~~~~');
}

function sortRaw(routes: RawRoute[]) {
  routes.sort((a, b) => {
    let segmentA = deprioritize(a.segment);
    let segmentB = deprioritize(b.segment);
    if (a.children.length > b.children.length) segmentA = `~${segmentA}`;
    else if (a.children.length < b.children.length) segmentB = `~${segmentB}`;
    return segmentA > segmentB ? 1 : -1;
  });
  for (const route of routes) sortRaw(route.children);
}

function rawTree(filenames: string[]): RawRoute[] {
  const byLevel = new Map<number, Map<string, RawRoute>>();
  const level = (n: number) => {
    let map = byLevel.get(n);
    if (!map) byLevel.set(n, (map = new Map()));
    return map;
  };
  for (const filename of filenames) {
    const rawPath = toRawPath(filename);
    const parts = rawPath.split('/');
    const depth = parts.length - 1;
    const rawSegment = parts[depth];
    level(depth).set(rawPath, {
      filename,
      rawSegment,
      ancestors: parts.slice(0, depth),
      segment: toSegment(rawSegment),
      children: [],
    });
  }
  const maxLevel = Math.max(0, ...byLevel.keys());
  for (let depth = maxLevel; depth > 0; depth--) {
    for (const route of level(depth).values()) {
      const parentPath = route.ancestors.join('/');
      const parentIndex = route.ancestors.length - 1;
      const parents = level(depth - 1);
      let parent = parents.get(parentPath);
      if (!parent) {
        parent = {
          filename: null,
          rawSegment: route.ancestors[parentIndex],
          ancestors: route.ancestors.slice(0, parentIndex),
          segment: toSegment(route.ancestors[parentIndex]),
          children: [],
        };
        parents.set(parentPath, parent);
      }
      parent.children.push(route);
    }
  }
  const roots = Array.from(level(0).values());
  sortRaw(roots);
  return roots;
}

const ROUTE_META_KEYS =
  /\b(title|meta|canActivate|canActivateChild|canDeactivate|canMatch|resolve|redirectTo|pathMatch|providers|data|runGuardsAndResolvers)\s*:/g;

function routeMetaOf(code: string): string[] | undefined {
  const start = code.search(/export\s+const\s+routeMeta\b/);
  if (start < 0) return undefined;
  const open = code.indexOf('{', start);
  if (open < 0) return [];
  let depth = 0;
  let end = open;
  for (; end < code.length; end++) {
    if (code[end] === '{') depth++;
    else if (code[end] === '}' && --depth === 0) break;
  }
  const body = code.slice(open + 1, end);
  const keys = new Set<string>();
  let depthIn = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if ('{[('.includes(ch)) depthIn++;
    else if ('}])'.includes(ch)) depthIn--;
    else if (depthIn === 0) {
      ROUTE_META_KEYS.lastIndex = i;
      const match = ROUTE_META_KEYS.exec(body);
      if (match && match.index === i) {
        keys.add(match[1]);
        i += match[0].length - 1;
      }
    }
  }
  return Array.from(keys);
}

function exportsOf(code: string): string[] {
  const names = new Set<string>();
  for (const match of code.matchAll(/export\s+(?:async\s+)?(?:const|let|function)\s+(\w+)/g)) {
    names.add(match[1]);
  }
  return Array.from(names);
}

function titleOf(source: string, kind: AnalogRouteKind): string | undefined {
  if (kind === 'markdown') return frontmatter(source).attributes['title'];
  return source.match(/routeMeta[\s\S]{0,400}?\btitle\s*:\s*['"`]([^'"`]{1,120})['"`]/)?.[1];
}

function describe(root: string, raw: RawRoute, parentPath: string, index: number): AnalogRoute {
  const fullPath = [parentPath, raw.segment].filter(Boolean).join('/');
  const file = raw.filename ?? undefined;
  const absolute = file ? join(root, file) : undefined;
  const source = absolute ? read(absolute) : '';
  const code = source ? maskStrings(stripComments(source)) : '';
  const markdown = !!file?.endsWith('.md');
  const kind: AnalogRouteKind = !file
    ? raw.rawSegment.startsWith('(')
      ? 'group'
      : 'implicit'
    : markdown
      ? 'markdown'
      : raw.children.length
        ? 'layout'
        : 'page';
  const route: AnalogRoute = {
    id: `${parentPath}/${raw.rawSegment}#${index}`,
    segment: raw.segment,
    fullPath: `/${fullPath}`,
    kind,
    params: Array.from(raw.segment.matchAll(/:(\w+)/g), (m) => m[1]),
    children: [],
  };
  if (file) route.file = file;
  const optional = file?.match(/\[\[\.\.\.(\w+)\]\]/);
  if (optional) {
    route.catchAll = 'optional';
    route.params = [optional[1]];
  } else if (raw.segment.includes('**')) route.catchAll = 'required';
  if (file && !markdown) {
    route.defaultExport = /export\s+default\b/.test(code);
    const meta = routeMetaOf(code);
    if (meta) route.routeMeta = meta;
    if (kind === 'layout') route.outlet = /router-outlet|RouterOutlet/.test(source);
    const server = file.replace(/\.page\.(ts|analog|ag)$/, '.server.ts');
    if (server !== file && existsSync(join(root, server))) {
      route.serverFile = server;
      route.serverExports = exportsOf(maskStrings(stripComments(read(join(root, server)))));
    }
  }
  const title = file ? titleOf(source, kind) : undefined;
  if (title) route.title = title;
  route.children = raw.children.map((child, i) => describe(root, child, fullPath, i));
  return route;
}

export function routeFiles(root: string): string[] {
  const files = [
    ...walk(join(root, 'app/routes'), (n) => n.endsWith('.ts') || n.endsWith('.md')),
    ...walk(join(root, 'src/app/routes'), (n) => n.endsWith('.ts') || n.endsWith('.md')),
    ...walk(join(root, 'src/app/pages'), (n) => n.endsWith('.page.ts') || n.endsWith('.md')),
    ...walk(join(root, 'src/content'), (n) => n.endsWith('.md')),
  ];
  return files.map((file) => rel(root, file)).filter((file) => !file.endsWith('.server.ts'));
}

export function buildRoutes(root: string, files = routeFiles(root)): AnalogRoute[] {
  return rawTree(files).map((raw, i) => describe(root, raw, '', i));
}

function apiPath(file: string): { path: string; method: string; params: string[] } {
  let name = file.replace(/\.(ts|js|mjs)$/, '');
  let method = 'ANY';
  const suffix = name.match(/\.(\w+)$/);
  if (suffix && HTTP_METHODS.includes(suffix[1].toLowerCase())) {
    method = suffix[1].toUpperCase();
    name = name.slice(0, -suffix[0].length);
  }
  const params: string[] = [];
  const path = name
    .split('/')
    .map((part) => {
      const catchAll = part.match(/^\[\.\.\.(\w+)\]$/);
      if (catchAll) {
        params.push(catchAll[1]);
        return '**';
      }
      return part.replace(/\[(\w+)\]/g, (_m, param: string) => {
        params.push(param);
        return `:${param}`;
      });
    })
    .filter((part) => part !== 'index')
    .join('/');
  return { path: `/${path}`.replace(/\/+$/, '') || '/', method, params };
}

export function apiRoutes(root: string): AnalogApiRoute[] {
  const dir = join(root, 'src/server/routes');
  return walk(dir, (n) => /\.(ts|js|mjs)$/.test(n) && !n.endsWith('.d.ts')).map((full) => {
    const file = rel(root, full);
    return { ...apiPath(relative(dir, full).split('\\').join('/')), file };
  });
}

/** The id Analog derives for a server function (see derive-server-fn-id in @analogjs/vite-plugin-nitro). */
export function serverFnId(file: string, name: string): string {
  return createHash('sha256')
    .update(`${file.replace(/^\//, '')}#${name}`)
    .digest('hex')
    .slice(0, 16);
}

function serverFnMethod(source: string, argsAt: number): string {
  const rest = source.slice(argsAt).trimStart();
  if (/^(?:async\b|function\b|\(|\w+\s*=>)/.test(rest)) return 'GET';
  if (!rest.startsWith('{')) return 'POST';
  const config = rest.slice(0, blockEnd(rest, 0) + 1);
  const method = config.match(/\bmethod\s*:\s*['"`](\w+)['"`]/);
  if (method) return method[1].toUpperCase();
  return /\binput\s*:/.test(config) ? 'POST' : 'GET';
}

export function serverFnsOf(file: string, source: string): AnalogServerFn[] {
  if (!source.includes('serverFn')) return [];
  const code = stripComments(source);
  const masked = maskStrings(code);
  const locals = new Set<string>();
  for (const match of masked.matchAll(/\bimport\s*\{([^}]*)\}\s*from\s*(['"`])/g)) {
    const from = code.slice(match.index + match[0].length).match(/^([^'"`]*)/)?.[1];
    if (from !== '@analogjs/router/server') continue;
    for (const spec of match[1].split(',')) {
      const alias = spec.trim().match(/^serverFn(?:\s+as\s+(\w+))?$/);
      if (alias) locals.add(alias[1] ?? 'serverFn');
    }
  }
  if (!locals.size) locals.add('serverFn');
  const out: AnalogServerFn[] = [];
  for (const match of masked.matchAll(
    /\bexport\s+(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?=\s*(\w+)\s*\(/g,
  )) {
    if (!locals.has(match[2])) continue;
    out.push({
      name: match[1],
      file,
      id: serverFnId(file, match[1]),
      method: serverFnMethod(code, match.index + match[0].length),
    });
  }
  return out;
}

export function serverFunctions(root: string): AnalogServerFn[] {
  const src = join(root, 'src');
  return walk(src, (n) => n.endsWith('.server.ts') && n !== 'app.config.server.ts')
    .filter((full) => relative(src, full).split('\\').join('/').includes('/'))
    .flatMap((full) => serverFnsOf(rel(root, full), read(full)));
}

export function frontmatter(source: string): {
  attributes: Record<string, string>;
  error?: string;
} {
  if (!source.startsWith('---')) return { attributes: {} };
  const end = source.indexOf('\n---', 3);
  if (end < 0) return { attributes: {}, error: 'Frontmatter block is not closed with ---' };
  const attributes: Record<string, string> = {};
  for (const line of source.slice(3, end).replace(/\r/g, '').split('\n')) {
    if (!line.trim() || /^\s/.test(line) || line.trim().startsWith('#')) continue;
    const match = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!match) return { attributes, error: `Cannot read frontmatter line: ${line.slice(0, 60)}` };
    const raw = match[2].trim();
    if (!/^['"]/.test(raw) && /:\s/.test(raw)) {
      return {
        attributes,
        error: `"${match[1]}" has an unquoted ": " in its value, which is invalid YAML and breaks every page. Quote the value.`,
      };
    }
    attributes[match[1]] = raw.replace(/^['"]|['"]$/g, '').slice(0, 200);
  }
  return { attributes };
}

export function contentFiles(root: string): AnalogContentFile[] {
  return walk(join(root, 'src/content'), (n) => n.endsWith('.md')).map((full) => {
    const file = rel(root, full);
    const parsed = frontmatter(read(full));
    const slug = parsed.attributes['slug'] || file.split('/').pop()!.replace(/\.md$/, '');
    const out: AnalogContentFile = { file, slug, attributes: parsed.attributes };
    if (parsed.error) out.error = parsed.error;
    return out;
  });
}

function configFile(root: string): string | undefined {
  return ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs'].find((name) =>
    existsSync(join(root, name)),
  );
}

function blockEnd(source: string, open: number): number {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return i;
  }
  return source.length;
}

function ruleTiming(body: string, key: string): string | undefined {
  const match = body.match(new RegExp(`\\b${key}\\s*:\\s*(true|false|\\d+|\\{)`));
  if (!match || match[1] === 'false') return undefined;
  return match[1] === '{' ? 'true' : match[1];
}

export function routeRuleOf(path: string, body: string): AnalogRouteRule {
  const rule: AnalogRouteRule = { path };
  const flag = (key: string) => body.match(new RegExp(`\\b${key}\\s*:\\s*(true|false)\\b`))?.[1];
  const ssr = flag('ssr');
  if (ssr) rule.ssr = ssr === 'true';
  const prerender = flag('prerender');
  if (prerender) rule.prerender = prerender === 'true';
  const isr = ruleTiming(body, 'isr');
  if (isr) rule.isr = isr;
  const swr = ruleTiming(body, 'swr');
  if (swr) rule.swr = swr;
  const cache = body.match(/\bcache\s*:\s*(false|\{)/)?.[1];
  if (cache) rule.cache = cache === '{';
  const redirect =
    body.match(/\bredirect\s*:\s*['"`]([^'"`]+)['"`]/) ??
    body.match(/\bredirect\s*:\s*\{[^}]*\bto\s*:\s*['"`]([^'"`]+)['"`]/);
  if (redirect) rule.redirect = redirect[1];
  const cacheControl = body.match(/['"`]?cache-control['"`]?\s*:\s*['"`]([^'"`]+)['"`]/i);
  if (cacheControl) rule.cacheControl = cacheControl[1];
  return rule;
}

export function routeRulesOf(source: string): AnalogRouteRule[] {
  const rules: AnalogRouteRule[] = [];
  const blocks = /\brouteRules\s*:\s*\{/g;
  for (let block = blocks.exec(source); block; block = blocks.exec(source)) {
    const open = block.index + block[0].length - 1;
    const end = blockEnd(source, open);
    const entry = /['"`](\/[^'"`]*)['"`]\s*:\s*\{/y;
    for (let i = open + 1; i < end;) {
      entry.lastIndex = i;
      const match = entry.exec(source);
      if (!match) {
        i++;
        continue;
      }
      const bodyOpen = match.index + match[0].length - 1;
      const bodyEnd = blockEnd(source, bodyOpen);
      rules.push(routeRuleOf(match[1], source.slice(bodyOpen + 1, bodyEnd)));
      i = bodyEnd + 1;
    }
    blocks.lastIndex = end;
  }
  return rules;
}

function stripBlocks(source: string, keys: string[]): string {
  let out = source;
  for (const key of keys) {
    for (let guard = 0; guard < 10; guard++) {
      const match = new RegExp(`\\b${key}\\s*:\\s*\\{`).exec(out);
      if (!match) break;
      let depth = 0;
      let end = match.index + match[0].length - 1;
      for (; end < out.length; end++) {
        if (out[end] === '{') depth++;
        else if (out[end] === '}' && --depth === 0) break;
      }
      out = out.slice(0, match.index) + out.slice(end + 1);
    }
  }
  return out;
}

export function analogConfig(root: string): AnalogConfig {
  const file = configFile(root);
  const config: AnalogConfig = { apiPrefix: 'api', noSsrRoutes: [], routeRules: [] };
  if (!file) return config;
  config.configFile = file;
  const source = stripComments(read(join(root, file)));
  const start = source.search(/\banalog\s*\(/);
  if (start < 0) return config;
  const options = source.slice(start, start + 4000);
  const topLevel = stripBlocks(options.slice(options.indexOf('(') + 1), [
    'nitro',
    'routeRules',
    'vite',
    'content',
    'prerender',
  ]);
  const flag = (name: string) => {
    const match = topLevel.match(new RegExp(`\\b${name}\\s*:\\s*(true|false)`));
    return match ? match[1] === 'true' : undefined;
  };
  const ssr = flag('ssr');
  if (ssr !== undefined) config.ssr = ssr;
  const isStatic = flag('static');
  if (isStatic !== undefined) config.static = isStatic;
  const prefix = options.match(/\bapiPrefix\s*:\s*['"`]([^'"`]*)['"`]/);
  if (prefix) config.apiPrefix = prefix[1];
  const prerender = options.match(
    /\bprerender\s*:\s*\{[\s\S]*?\broutes\s*:\s*(\[[\s\S]*?\]|async|\(|function)/,
  );
  if (prerender) {
    if (prerender[1].startsWith('[')) {
      config.prerender = Array.from(prerender[1].matchAll(/['"`](\/[^'"`]*)['"`]/g), (m) => m[1]);
    } else config.prerenderDynamic = true;
  }
  config.routeRules = routeRulesOf(options);
  config.noSsrRoutes = config.routeRules.filter((r) => r.ssr === false).map((r) => r.path);
  return config;
}

function packageVersion(dir: string): string | undefined {
  try {
    const pkg = JSON.parse(read(join(dir, 'package.json')));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return deps['@analogjs/platform'] ?? deps['@analogjs/router'];
  } catch {
    return undefined;
  }
}

function isWorkspaceBoundary(dir: string): boolean {
  return dirname(dir) === dir || existsSync(join(dir, '.git')) || existsSync(join(dir, 'nx.json'));
}

function analogPackage(root: string): { dir: string; version: string } | undefined {
  const own = packageVersion(root);
  if (own) return { dir: root, version: own };
  if (isWorkspaceBoundary(root) || !hasAnalogConfig(root)) return undefined;
  for (let dir = dirname(root); ; dir = dirname(dir)) {
    const version = packageVersion(dir);
    if (version) return { dir, version };
    if (isWorkspaceBoundary(dir)) return undefined;
  }
}

function nxWorkspace(root: string): string | undefined {
  for (let dir = root; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'nx.json'))) return dir;
    if (isWorkspaceBoundary(dir)) return undefined;
  }
}

export function analogVersion(root: string): string | undefined {
  return analogPackage(root)?.version;
}

function hasAnalogConfig(dir: string): boolean {
  const file = configFile(dir);
  return !!file && /\banalog\s*\(/.test(stripComments(read(join(dir, file))));
}

let viteRoot: string | undefined;

export function setAnalogRoot(root: string | undefined) {
  viteRoot = root;
}

export function servedAnalogRoot(cwd: string): string {
  return analogRoot(viteRoot ?? cwd);
}

export function analogRoot(cwd: string): string {
  if (existsSync(join(cwd, 'src/app/pages')) || hasAnalogConfig(cwd)) return cwd;
  let names: string[];
  try {
    names = readdirSync(join(cwd, 'apps')).sort();
  } catch {
    return cwd;
  }
  return names.map((name) => join(cwd, 'apps', name)).find(hasAnalogConfig) ?? cwd;
}

export function prerenderedPages(root: string, workspace = root): string[] {
  const dir = [
    join(root, 'dist/analog/public'),
    join(workspace, 'dist', relative(workspace, root), 'analog/public'),
  ].find((candidate) => existsSync(candidate));
  if (!dir) return [];
  return walk(dir, (n) => n === 'index.html').map((full) => {
    const path = relative(dir, full)
      .split('\\')
      .join('/')
      .replace(/\/?index\.html$/, '');
    return `/${path}`;
  });
}

export function scanAnalog(cwd: string): AnalogProject {
  walkErrors = new Map();
  const root = analogRoot(cwd);
  try {
    const project = scanProject(root);
    if (walkErrors.size) {
      project.scanErrors = Array.from(walkErrors, ([dir, code]) => `${rel(root, dir)}: ${code}`);
    }
    return project;
  } finally {
    walkErrors = null;
  }
}

function scanProject(root: string): AnalogProject {
  const pkg = analogPackage(root);
  const version = pkg?.version;
  const files = routeFiles(root);
  return {
    analog: !!version,
    version,
    root,
    files,
    serverFiles: walk(join(root, 'src/app/pages'), (n) => n.endsWith('.server.ts')).map((f) =>
      rel(root, f),
    ),
    routes: version ? buildRoutes(root, files) : [],
    api: version ? apiRoutes(root) : [],
    middleware: version
      ? walk(join(root, 'src/server/middleware'), (n) => /\.(ts|js)$/.test(n)).map((f) =>
          rel(root, f),
        )
      : [],
    content: version ? contentFiles(root) : [],
    serverFns: version ? serverFunctions(root) : [],
    config: analogConfig(root),
    prerendered: pkg ? prerenderedPages(root, nxWorkspace(root) ?? pkg.dir) : [],
  };
}

function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

export function flattenRoutes(routes: AnalogRoute[], out: AnalogRoute[] = []): AnalogRoute[] {
  for (const route of routes) {
    out.push(route);
    flattenRoutes(route.children, out);
  }
  return out;
}

export interface UrlMatch {
  matched: boolean;
  chain: AnalogRoute[];
  params: Record<string, string>;
  rejected: { file?: string; path: string; reason: string }[];
}

function matchSegments(
  routes: AnalogRoute[],
  parts: string[],
  params: Record<string, string>,
  rejected: UrlMatch['rejected'],
): AnalogRoute[] | null {
  for (const route of routes) {
    const segs = route.segment ? route.segment.split('/') : [];
    const local: Record<string, string> = {};
    let consumed = 0;
    let ok = true;
    for (const seg of segs) {
      if (seg === '**') {
        local['**'] = parts.slice(consumed).join('/');
        consumed = parts.length;
        break;
      }
      const part = parts[consumed];
      if (part === undefined) {
        ok = false;
        break;
      }
      if (seg.startsWith(':')) local[seg.slice(1)] = safeDecode(part);
      else if (seg !== part) {
        ok = false;
        break;
      }
      consumed++;
    }
    if (!ok) {
      if (route.file)
        rejected.push({ file: route.file, path: route.fullPath, reason: 'segment does not match' });
      continue;
    }
    const rest = parts.slice(consumed);
    if (route.catchAll === 'optional' && rest.length) {
      Object.assign(params, local, { [route.params[0] ?? 'slug']: rest.join('/') });
      return [route];
    }
    if (!rest.length && (route.file || !route.children.length)) {
      const index = route.children.find((c) => c.segment === '' && c.file);
      if (index && route.kind !== 'page' && route.kind !== 'markdown') {
        Object.assign(params, local);
        return [route, index];
      }
      if (route.file) {
        Object.assign(params, local);
        return [route];
      }
    }
    const child = matchSegments(route.children, rest, params, rejected);
    if (child) {
      Object.assign(params, local);
      return [route, ...child];
    }
    if (route.file && route.children.length === 0) {
      rejected.push({
        file: route.file,
        path: route.fullPath,
        reason: `leaves "${rest.join('/')}" unmatched`,
      });
    }
  }
  return null;
}

export function explainUrl(routes: AnalogRoute[], url: string): UrlMatch {
  const path = url.split(/[?#]/)[0];
  const parts = path.split('/').filter(Boolean);
  const params: Record<string, string> = {};
  const rejected: UrlMatch['rejected'] = [];
  const chain = matchSegments(routes, parts, params, rejected) ?? [];
  return { matched: chain.length > 0, chain, params, rejected: rejected.slice(0, 20) };
}

function hasPageExports(source: string): boolean {
  return exportsOf(maskStrings(stripComments(source))).some((e) => e === 'load' || e === 'action');
}

export function lintAnalog(project: AnalogProject): AnalogLintFinding[] {
  const out: AnalogLintFinding[] = [];
  for (const error of project.scanErrors ?? []) {
    out.push({
      rule: 'scan-error',
      severity: 'error',
      file: error.slice(0, error.lastIndexOf(':')),
      message: `Could not read this folder (${error.slice(error.lastIndexOf(':') + 2)}), so its files are missing from every result.`,
      fix: 'Check the folder permissions, or that the path is a folder and not a file.',
    });
  }
  const all = flattenRoutes(project.routes);
  const fnFiles = new Set((project.serverFns ?? []).map((fn) => fn.file));
  const byPath = new Map<string, AnalogRoute[]>();
  for (const route of all) {
    if (!route.file || route.kind === 'layout' || route.kind === 'group') continue;
    const list = byPath.get(route.fullPath) ?? [];
    list.push(route);
    byPath.set(route.fullPath, list);
  }
  for (const [path, routes] of byPath) {
    if (routes.length > 1) {
      out.push({
        rule: 'duplicate-url',
        severity: 'error',
        path,
        file: routes[0].file,
        message: `${routes.map((r) => r.file).join(' and ')} both resolve to ${path}; only one is reachable.`,
        fix: 'Rename or remove one of the files.',
      });
    }
  }
  const siblings = (routes: AnalogRoute[]) => {
    const dynamic = routes.filter((r) => /^:\w+$/.test(r.segment));
    if (dynamic.length > 1) {
      out.push({
        rule: 'sibling-params',
        severity: 'warning',
        path: dynamic[0].fullPath,
        file: dynamic[0].file,
        message: `${dynamic.map((r) => r.file ?? r.segment).join(' and ')} are both dynamic at the same level; the first one always wins.`,
        fix: 'Keep one [param] file per folder.',
      });
    }
    for (const route of routes) siblings(route.children);
  };
  siblings(project.routes);
  for (const route of all) {
    if (route.kind === 'page' || route.kind === 'layout') {
      if (route.defaultExport === false && !route.routeMeta?.includes('redirectTo')) {
        out.push({
          rule: 'missing-default-export',
          severity: 'error',
          file: route.file,
          path: route.fullPath,
          message: 'The page has no default export, so Analog renders nothing.',
          fix: 'Add export default to the component class.',
        });
      }
      if (route.routeMeta?.includes('redirectTo') && route.defaultExport) {
        out.push({
          rule: 'redirect-with-component',
          severity: 'warning',
          file: route.file,
          path: route.fullPath,
          message: 'A redirect page also exports a component; the component never shows.',
          fix: 'Drop the default export from redirect-only pages.',
        });
      }
      if (
        route.routeMeta?.includes('redirectTo') &&
        !route.routeMeta.includes('pathMatch') &&
        route.segment === ''
      ) {
        out.push({
          rule: 'redirect-path-match',
          severity: 'warning',
          file: route.file,
          path: route.fullPath,
          message: 'An empty-path redirect without pathMatch: "full" matches every URL below it.',
          fix: "Add pathMatch: 'full' to routeMeta.",
        });
      }
    }
    if (route.kind === 'layout' && route.outlet === false) {
      out.push({
        rule: 'layout-without-outlet',
        severity: 'error',
        file: route.file,
        path: route.fullPath,
        message:
          'This layout has child pages but no <router-outlet>, so the children never render.',
        fix: 'Add <router-outlet /> to the layout template.',
      });
    }
    if (
      route.serverFile &&
      !route.serverExports?.some((e) => e === 'load' || e === 'action') &&
      !fnFiles.has(route.serverFile)
    ) {
      out.push({
        rule: 'server-without-load',
        severity: 'warning',
        file: route.serverFile,
        path: route.fullPath,
        message: 'The .server.ts file exports neither load nor action.',
        fix: 'Export const load = async (...) => ... or remove the file.',
      });
    }
  }
  const pages = new Set(project.files);
  for (const file of project.serverFiles) {
    if (fnFiles.has(file) && !hasPageExports(read(join(project.root, file)))) continue;
    if (!pages.has(file.replace('.server.ts', '.page.ts'))) {
      out.push({
        rule: 'orphan-server-file',
        severity: 'warning',
        file,
        message: 'No page file next to this .server.ts, so its load never runs.',
        fix: 'Rename it to match a .page.ts file.',
      });
    }
  }
  for (const api of project.api) {
    const base = api.file
      .split('/')
      .pop()!
      .replace(/\.(ts|js|mjs)$/, '');
    const suffix = base.includes('.') ? base.split('.').pop()!.toLowerCase() : '';
    if (suffix && !HTTP_METHODS.includes(suffix) && !/^\[/.test(suffix)) {
      out.push({
        rule: 'api-method-suffix',
        severity: 'warning',
        file: api.file,
        path: api.path,
        message: `".${suffix}" is not an HTTP method, so it becomes part of the URL (${api.path}).`,
        fix: 'Use .get, .post, .put, .patch or .delete, or rename the file.',
      });
    }
  }
  const apiKeys = new Map<string, string>();
  for (const api of project.api) {
    const key = `${api.method} ${api.path}`;
    const previous = apiKeys.get(key);
    if (previous) {
      out.push({
        rule: 'duplicate-api-route',
        severity: 'error',
        file: api.file,
        path: api.path,
        message: `${previous} and ${api.file} both handle ${key}.`,
        fix: 'Remove or rename one of them.',
      });
    } else apiKeys.set(key, api.file);
  }
  const prefix = `/${project.config.apiPrefix}`;
  for (const api of project.api) {
    if (
      project.config.apiPrefix &&
      !api.path.startsWith(prefix) &&
      !api.file.includes('/middleware/')
    ) {
      out.push({
        rule: 'api-outside-prefix',
        severity: 'info',
        file: api.file,
        path: api.path,
        message: `This server route is served at ${api.path}, outside ${prefix}, so the Vite dev server passes it to the page renderer instead of Nitro.`,
        fix: `Move it under src/server/routes/${project.config.apiPrefix}/.`,
      });
    }
  }
  for (const path of project.config.prerender ?? []) {
    const match = explainUrl(project.routes, path);
    if (!match.matched) {
      out.push({
        rule: 'prerender-unknown-route',
        severity: 'warning',
        path,
        message: `prerender.routes lists ${path}, which matches no page.`,
        fix: 'Fix the path or remove it from prerender.routes.',
      });
    }
  }
  if (
    project.config.static &&
    project.config.prerender &&
    !project.config.prerender.includes('/')
  ) {
    out.push({
      rule: 'prerender-missing-root',
      severity: 'warning',
      path: '/',
      message: 'static is on but prerender.routes does not include /.',
      fix: "Add '/' to prerender.routes.",
    });
  }
  const dynamicPages = all.filter(
    (r) => (r.kind === 'page' || r.kind === 'layout') && r.file && r.params.length && !r.catchAll,
  );
  for (const route of all) {
    if (route.kind !== 'markdown' || !route.file?.startsWith('/src/content/')) continue;
    const parts = route.fullPath.split('/').filter(Boolean);
    const page = dynamicPages.find((candidate) => {
      const pattern = candidate.fullPath.split('/').filter(Boolean);
      return (
        pattern.length === parts.length &&
        pattern.every((seg, i) => seg === parts[i] || seg.startsWith(':'))
      );
    });
    if (page) {
      out.push({
        rule: 'content-shadows-page',
        severity: 'warning',
        file: route.file,
        path: route.fullPath,
        message: `Files under src/content are routes too, so ${route.file} serves ${route.fullPath} and ${page.file} never renders for it.`,
        fix: 'Move content outside the routed content folder (for example src/content-data with contentDir), or drop the [param] page.',
      });
    }
  }
  const slugs = new Map<string, string>();
  for (const file of project.content) {
    if (file.error) {
      out.push({
        rule: 'content-frontmatter',
        severity: 'error',
        file: file.file,
        message: file.error,
        fix: 'Fix the frontmatter block (--- key: value ---).',
      });
    }
    const previous = slugs.get(file.slug);
    if (previous) {
      out.push({
        rule: 'duplicate-slug',
        severity: 'warning',
        file: file.file,
        message: `Slug "${file.slug}" is used by ${previous} and ${file.file}.`,
        fix: 'Give one of them a different slug.',
      });
    } else slugs.set(file.slug, file.file);
  }
  return out;
}
