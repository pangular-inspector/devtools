// The `ng add @pangular-inspector/devtools` schematic. It finds the setup the
// workspace uses and wires the devtools in the way the docs recommend:
//
// - a Vite config (Analog): the Vite plugin, which also loads the overlay;
// - an Express `server.ts` (Angular SSR): `initPangularHub()` and its
//   middleware, and the overlay in `main.ts` behind a development check;
// - anything else: the overlay in `main.ts`, and the steps to run the
//   standalone CLI next to `ng serve`, printed.
//
// Every edit is idempotent and only inserts lines next to code it recognizes.
// When a file doesn't look the way the docs assume, it changes nothing and
// prints the snippet to add by hand.
//
// It imports nothing at runtime, so it runs on the `@angular-devkit/schematics`
// copy of whichever Angular CLI calls it. The build ships it as CommonJS,
// since that CLI loads factories with `require()`.
import type { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';

export interface NgAddOptions {
  /** The project to set up. Defaults to the workspace's only application, or its first one. */
  project?: string;
}

/** What one edit did: inserted the lines, found them there already, or left the file alone. */
export type EditStatus = 'added' | 'present' | 'unsure';

export interface EditResult {
  status: EditStatus;
  /** The new file content, for `added`. */
  text?: string;
}

export const PACKAGE = '@pangular-inspector/devtools';
const DOCS = 'https://pangular-inspector.dev/getting-started';
const VITE_CONFIGS = ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs'];

export const OVERLAY_SNIPPET = `bootstrapApplication(App, appConfig)
  .then(() => {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      return import('${PACKAGE}/overlay');
    }
    return undefined;
  })
  .catch((err) => console.error(err));`;

export const SERVER_SNIPPET = `import {initPangularHub} from '${PACKAGE}/hub';

const app = express();
const devtools = initPangularHub({ws: false});
app.use(devtools.nodeMiddleware);`;

export const VITE_SNIPPET = `import pangular from '${PACKAGE}/vite';

export default defineConfig({
  plugins: [analog(), pangular()],
});`;

export const CLI_STEPS = [
  'This workspace has no Express server.ts and no Vite config, so run the standalone CLI next to ng serve:',
  '  1. Start it: npx pangular dev --port 9999 --proxy-origin http://localhost:4200',
  '  2. Save proxy.conf.json next to angular.json:',
  '     {"/__pangular": {"target": "http://localhost:9999", "pathRewrite": {"^/__pangular": ""}, "ws": true}}',
  '  3. Set "proxyConfig": "proxy.conf.json" in the serve options of angular.json, or run ng serve --proxy-config proxy.conf.json',
  `See ${DOCS}/installation#client-only-angular-cli-app`,
];

/** The setup found in the workspace and the files the edits go to. */
export interface Setup {
  /** `unreadable`: angular.json is there but could not be parsed, so nothing is changed. */
  kind: 'vite' | 'express' | 'server' | 'cli' | 'unreadable';
  project?: string;
  main?: string;
  server?: string;
  viteConfig?: string;
}

function join(...parts: (string | undefined)[]): string {
  return parts
    .filter((part): part is string => !!part && part !== '.')
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\//, '');
}

function readText(tree: Tree, path: string): string | undefined {
  return tree.exists(path) ? (tree.read(path)?.toString('utf8') ?? undefined) : undefined;
}

type Json = Record<string, unknown>;

/**
 * Parses JSON the way the Angular CLI reads angular.json: `//` and block
 * comments and trailing commas are allowed. Returns undefined when the text
 * still is not JSON. Strings are copied as they are, so a `//` inside a URL stays.
 */
export function parseWorkspaceJson(text: string): unknown {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) return undefined;
      i = end + 1;
    } else {
      out += ch;
    }
  }
  try {
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
  } catch {
    return undefined;
  }
}
const isObject = (value: unknown): value is Json =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** The project named in `options`, or the only application, or the first one. */
function pickProject(workspace: Json, name: string | undefined) {
  const projects = isObject(workspace['projects']) ? workspace['projects'] : {};
  if (name) {
    const project = projects[name];
    if (!isObject(project)) throw new Error(`[pangular] No project "${name}" in angular.json.`);
    return { name, project };
  }
  const entries = Object.entries(projects).filter((entry): entry is [string, Json] =>
    isObject(entry[1]),
  );
  const apps = entries.filter(([, project]) => project['projectType'] !== 'library');
  const fallback =
    typeof workspace['defaultProject'] === 'string' ? workspace['defaultProject'] : '';
  const chosen = apps.find(([key]) => key === fallback) ?? apps[0] ?? entries[0];
  return chosen ? { name: chosen[0], project: chosen[1] } : undefined;
}

/** Reads the setup from `angular.json`, the Vite config and `server.ts`. */
export function detectSetup(tree: Tree, options: NgAddOptions = {}): Setup {
  let root = '';
  let sourceRoot = 'src';
  let main: string | undefined;
  let server: string | undefined;
  let project: string | undefined;
  const workspaceText = readText(tree, 'angular.json');
  const workspace = workspaceText ? parseWorkspaceJson(workspaceText) : undefined;
  if (workspaceText && !isObject(workspace)) {
    if (options.project) {
      throw new Error(
        `[pangular] Could not read angular.json: it is not valid JSON, even with comments and trailing commas allowed. Fix it, then run ng add again for project "${options.project}".`,
      );
    }
    return { kind: 'unreadable' };
  }
  if (isObject(workspace)) {
    const picked = pickProject(workspace, options.project);
    if (picked) {
      project = picked.name;
      root = typeof picked.project['root'] === 'string' ? picked.project['root'] : '';
      sourceRoot =
        typeof picked.project['sourceRoot'] === 'string'
          ? picked.project['sourceRoot']
          : join(root, 'src');
      const architect = isObject(picked.project['architect']) ? picked.project['architect'] : {};
      const build = isObject(architect['build']) ? architect['build'] : {};
      const buildOptions = isObject(build['options']) ? build['options'] : {};
      const entry = buildOptions['browser'] ?? buildOptions['main'];
      if (typeof entry === 'string') main = entry;
      const ssr = buildOptions['ssr'];
      if (isObject(ssr) && typeof ssr['entry'] === 'string') server = ssr['entry'];
    }
  } else if (options.project) {
    throw new Error(`[pangular] No angular.json, so there is no project "${options.project}".`);
  }
  main ??= join(sourceRoot, 'main.ts');
  if (!server || !tree.exists(server)) {
    server = [join(sourceRoot, 'server.ts'), join(root, 'server.ts')].find((path) =>
      tree.exists(path),
    );
  }
  const viteConfig = [root, '']
    .flatMap((dir) => VITE_CONFIGS.map((file) => join(dir, file)))
    .find((path) => tree.exists(path));
  if (viteConfig) return { kind: 'vite', project, main, viteConfig };
  if (server) {
    const text = readText(tree, server) ?? '';
    const express = /from\s+['"]express['"]/.test(text);
    return { kind: express ? 'express' : 'server', project, main, server };
  }
  return { kind: 'cli', project, main };
}

/** Whether the file writes `import { a }` (with spaces) rather than `import {a}`. */
function spacedBraces(text: string): boolean {
  return /import\s+\{\s/.test(text);
}

function braces(text: string, inner: string): string {
  return spacedBraces(text) ? `{ ${inner} }` : `{${inner}}`;
}

/** Whether `name` is already declared or imported in `text`. */
function declares(text: string, name: string): boolean {
  return new RegExp(
    `\\b(?:const|let|var|function|class)\\s+${name}\\b|import[^;]*\\b${name}\\b[^;]*from`,
  ).test(text);
}

/**
 * Adds `initPangularHub()` and its middleware to an Express `server.ts`, right
 * after `import express from 'express'` and `const app = express()`.
 */
export function wireExpressServer(text: string): EditResult {
  if (text.includes(`${PACKAGE}/hub`)) return { status: 'present' };
  const imports = [
    ...text.matchAll(/^import\s+express\b[^;\n]*\bfrom\s+(['"])express\1;?[ \t]*$/gm),
  ];
  const apps = [
    ...text.matchAll(/^([ \t]*)const\s+([A-Za-z_$][\w$]*)\s*=\s*express\(\s*\);?[ \t]*$/gm),
  ];
  if (imports.length !== 1 || apps.length !== 1) return { status: 'unsure' };
  if (declares(text, 'devtools') || declares(text, 'initPangularHub')) return { status: 'unsure' };
  const [importLine] = imports;
  const [appLine] = apps;
  if (importLine?.index === undefined || appLine?.index === undefined) return { status: 'unsure' };
  if (importLine.index > appLine.index) return { status: 'unsure' };
  const quote = importLine[1] ?? "'";
  const indent = appLine[1] ?? '';
  const app = appLine[2];
  const semi = appLine[0].trimEnd().endsWith(';') ? ';' : '';
  const hubImport = `import ${braces(text, 'initPangularHub')} from ${quote}${PACKAGE}/hub${quote}${semi}`;
  const hub = [
    `${indent}// Pangular Inspector. The hub turns itself off in production.`,
    `${indent}const devtools = initPangularHub(${braces(text, 'ws: false')})${semi}`,
    `${indent}${app}.use(devtools.nodeMiddleware)${semi}`,
  ].join('\n');
  const appEnd = appLine.index + appLine[0].length;
  const importEnd = importLine.index + importLine[0].length;
  const out =
    text.slice(0, importEnd) +
    `\n${hubImport}` +
    text.slice(importEnd, appEnd) +
    `\n${hub}` +
    text.slice(appEnd);
  return { status: 'added', text: out };
}

const BOOTSTRAP =
  /(bootstrapApplication\([^;]*?\)|platformBrowser(?:Dynamic)?\(\)\s*\.bootstrapModule\([^;]*?\))(\s*)(\.catch\(|;)/g;

/**
 * Loads the overlay after bootstrap in development builds, as the docs show:
 * a `.then()` between the bootstrap call and its `.catch()`, or before the `;`
 * of a bare bootstrap call.
 */
export function wireOverlay(text: string): EditResult {
  if (text.includes(`${PACKAGE}/overlay`)) return { status: 'present' };
  const calls = [...text.matchAll(BOOTSTRAP)];
  if (calls.length !== 1) return { status: 'unsure' };
  const [call] = calls;
  if (call?.index === undefined) return { status: 'unsure' };
  const [whole, bootstrap = '', space = '', next = ''] = call;
  const lineStart = text.lastIndexOf('\n', call.index) + 1;
  const base = /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? '';
  const quote = /from\s+(['"])@angular\//.exec(text)?.[1] ?? "'";
  const step = space.includes('\n') ? space.slice(space.lastIndexOf('\n') + 1) : `${base}  `;
  const then = [
    `.then(() => {`,
    `${step}  if (typeof ngDevMode === 'undefined' || ngDevMode) {`,
    `${step}    return import(${quote}${PACKAGE}/overlay${quote});`,
    `${step}  }`,
    `${step}  return undefined;`,
    `${step}})`,
  ].join('\n');
  const replacement = `${bootstrap}\n${step}${then}${next === ';' ? ';' : `\n${step}${next}`}`;
  return {
    status: 'added',
    text: text.slice(0, call.index) + replacement + text.slice(call.index + whole.length),
  };
}

/** The index just past the last top-level `import` statement, or 0. */
function afterImports(text: string): number {
  let end = 0;
  for (const match of text.matchAll(/^import\b[^;]*?(?:from\s*)?(['"])[^'"\n]+\1;?[ \t]*$/gm)) {
    if (match.index !== undefined) end = Math.max(end, match.index + match[0].length);
  }
  return end;
}

/** The index of the `]` that closes the `[` at `open`, skipping strings and comments. */
function closingBracket(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const char = text[i];
    if (char === '"' || char === "'" || char === '`') {
      const end = text.indexOf(char, i + 1);
      if (end < 0) return -1;
      i = end;
    } else if (char === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      i = end < 0 ? text.length : end;
    } else if (char === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) return -1;
      i = end + 1;
    } else if (char === '[' || char === '(' || char === '{') {
      depth++;
    } else if (char === ']' || char === ')' || char === '}') {
      depth--;
      if (depth === 0) return char === ']' ? i : -1;
    }
  }
  return -1;
}

/** Adds the Vite plugin: its import after the last import, and `pangular()` at the end of `plugins`. */
export function wireVitePlugin(text: string): EditResult {
  if (text.includes(`${PACKAGE}/vite`)) return { status: 'present' };
  if (/\bpangular\b/.test(text)) return { status: 'unsure' };
  const lists = [...text.matchAll(/\bplugins\s*:\s*\[/g)];
  if (lists.length !== 1) return { status: 'unsure' };
  const [list] = lists;
  if (list?.index === undefined) return { status: 'unsure' };
  const open = list.index + list[0].length - 1;
  const close = closingBracket(text, open);
  if (close < 0) return { status: 'unsure' };
  const inner = text.slice(open + 1, close);
  const quote = /from\s+(['"])/.exec(text)?.[1] ?? "'";
  const semi = /from\s+['"][^'"]+['"];/.test(text) || !/from\s+['"]/.test(text) ? ';' : '';
  let entry: string;
  if (!inner.trim()) {
    entry = 'pangular()';
  } else if (inner.includes('\n')) {
    const last = inner.replace(/\s+$/, '');
    const lines = last.split('\n');
    const indent = /^[ \t]*/.exec(lines[lines.length - 1] ?? '')?.[0] ?? '';
    const comma = last.endsWith(',') ? '' : ',';
    const trailing = inner.slice(last.length);
    entry = `${last}${comma}\n${indent}pangular(),${trailing}`;
  } else {
    const last = inner.replace(/\s+$/, '');
    entry = `${last.replace(/,$/, '')}, pangular()${inner.slice(last.length)}`;
  }
  const withPlugin = text.slice(0, open + 1) + entry + text.slice(close);
  const at = afterImports(withPlugin);
  const line = `import pangular from ${quote}${PACKAGE}/vite${quote}${semi}`;
  const out = at
    ? `${withPlugin.slice(0, at)}\n${line}${withPlugin.slice(at)}`
    : `${line}\n${withPlugin}`;
  return { status: 'added', text: out };
}

function apply(
  tree: Tree,
  context: SchematicContext,
  path: string | undefined,
  edit: (text: string) => EditResult,
  what: string,
  snippet: string,
): EditStatus {
  const text = path ? readText(tree, path) : undefined;
  const result = text === undefined ? { status: 'unsure' as const } : edit(text);
  if (result.status === 'added' && path && result.text !== undefined) {
    tree.overwrite(path, result.text);
    context.logger.info(`[pangular] Added ${what} to ${path}.`);
  } else if (result.status === 'present') {
    context.logger.info(`[pangular] ${path} already has ${what}; left it as it is.`);
  } else {
    const where = path && text !== undefined ? path : `${path ?? 'the file'} (not found)`;
    context.logger.warn(
      `[pangular] Left ${where} alone: it doesn't look the way this schematic expects. Add ${what} by hand:\n\n${snippet}\n`,
    );
  }
  return result.status;
}

/** The `ng-add` schematic. */
export function ngAdd(options: NgAddOptions = {}): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const setup = detectSetup(tree, options);
    const label = setup.project ? ` for ${setup.project}` : '';
    switch (setup.kind) {
      case 'vite':
        context.logger.info(
          `[pangular] Found ${setup.viteConfig}: adding the Vite plugin${label}.`,
        );
        apply(tree, context, setup.viteConfig, wireVitePlugin, 'the Vite plugin', VITE_SNIPPET);
        context.logger.info(
          `[pangular] The plugin loads the overlay on the pages the dev server serves. See ${DOCS}/vite`,
        );
        break;
      case 'express':
        context.logger.info(`[pangular] Found an Express server in ${setup.server}${label}.`);
        apply(tree, context, setup.server, wireExpressServer, 'the devtools hub', SERVER_SNIPPET);
        apply(tree, context, setup.main, wireOverlay, 'the overlay', OVERLAY_SNIPPET);
        context.logger.info(
          `[pangular] Start the app in development mode and open the Pangular Inspector button. See ${DOCS}/express`,
        );
        break;
      case 'server':
        context.logger.warn(
          `[pangular] ${setup.server} is not an Express server, so it was left alone. Mount the devtools there as ${DOCS}/other-servers shows, or run the standalone CLI.`,
        );
        apply(tree, context, setup.main, wireOverlay, 'the overlay', OVERLAY_SNIPPET);
        break;
      case 'cli':
        apply(tree, context, setup.main, wireOverlay, 'the overlay', OVERLAY_SNIPPET);
        context.logger.info(`[pangular] ${CLI_STEPS.join('\n')}`);
        break;
      case 'unreadable':
        context.logger.warn(
          `[pangular] Could not read angular.json: it is not valid JSON, even with comments and trailing commas allowed. Nothing was changed. Add the overlay to main.ts by hand:\n\n${OVERLAY_SNIPPET}\n\nSee ${DOCS}/installation`,
        );
        break;
    }
    return tree;
  };
}
