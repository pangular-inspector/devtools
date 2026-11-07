// Nitro internals of an Analog app, read from the project: server plugins,
// tasks, the storage mounts in vite.config, the routes cached by `isr`, `swr`
// or `cache` rules, and the cache entries Nitro wrote to disk. Purging deletes
// those entry files, so the next request renders the route again.

import { existsSync, lstatSync, readdirSync, rmSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { entriesOf, blockAt, readConfigSource, type ConfigEntry } from './analog-config-blocks.ts';
import type { AnalogProject } from './analog-scan.ts';
import { redactText } from '../serialize.ts';
import { DEVTOOLS_HEADER, redactBody } from '../analog-server-log.ts';

export interface NitroStorageMount {
  name: string;
  driver?: string;
  /** The `base` folder of an `fs` mount, as written. */
  base?: string;
  /** `storage` (every mode) or `devStorage` (the dev server only). */
  from: 'storage' | 'devStorage';
}

export interface NitroCacheEntry {
  /** Path of the entry file, relative to the project root. */
  file: string;
  /** `routes`, `handlers` or `functions`: the Nitro cache group. */
  group: string;
  /** The cache key, from the file path. */
  key: string;
  size: number;
  modifiedAt: number;
}

export interface NitroInternals {
  plugins: string[];
  tasks: { name: string; file: string }[];
  storage: NitroStorageMount[];
  /** Route rules that cache responses. */
  cachedRules: { path: string; rule: string }[];
  /** Folders checked for cache entries that exist, relative to the project root. */
  cacheDirs: string[];
  entries: NitroCacheEntry[];
  notes: string[];
}

export interface PurgeResult {
  ok: boolean;
  removed: number;
  error?: string;
}

const MAX_ENTRIES = 500;
const CACHE_GROUPS = ['routes', 'handlers', 'functions'];
/** Where Nitro's `cache` storage lands with the fs driver, by Nitro and Analog version. */
const DEFAULT_CACHE_DIRS = [
  '.nitro/cache',
  'node_modules/.nitro/cache',
  'node_modules/.cache/nitro',
  'dist/.nitro/cache',
  '.data/cache',
];

function posix(path: string): string {
  return path.split('\\').join('/');
}

function files(dir: string, accept: (name: string) => boolean, out: string[] = [], depth = 0) {
  if (depth > 8 || out.length >= MAX_ENTRIES) return out;
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return out;
  }
  for (const name of names) {
    const full = join(dir, name);
    try {
      const stats = lstatSync(full);
      if (stats.isSymbolicLink()) continue;
      if (stats.isDirectory()) files(full, accept, out, depth + 1);
      else if (accept(name)) out.push(full);
    } catch {
      continue;
    }
    if (out.length >= MAX_ENTRIES) break;
  }
  return out;
}

function value(entries: ConfigEntry[] | undefined, key: string): string | undefined {
  const entry = entries?.find((e) => e.key === key);
  return entry && !entry.expression ? entry.value : undefined;
}

/** The storage mounts in `nitro.storage` and `nitro.devStorage` of vite.config. */
export function storageMounts(root: string): NitroStorageMount[] {
  const config = readConfigSource(root);
  if (!config.source) return [];
  const out: NitroStorageMount[] = [];
  for (const from of ['storage', 'devStorage'] as const) {
    const range = blockAt(config, ['nitro', from]);
    if (!range) continue;
    for (const entry of entriesOf(config, range)) {
      const mount: NitroStorageMount = { name: entry.key, from };
      const driver = value(entry.children, 'driver');
      if (driver) mount.driver = driver;
      const base = value(entry.children, 'base');
      if (base) mount.base = redactText(base);
      out.push(mount);
    }
  }
  return out;
}

/** The folders that can hold Nitro's `cache` storage on disk, inside the project. */
function cacheBases(root: string, storage: NitroStorageMount[]): string[] {
  const configured = storage
    .filter((m) => m.name === 'cache' && (m.driver === 'fs' || m.driver === 'fs-lite') && m.base)
    .map((m) => m.base!);
  return [...new Set([...configured, ...DEFAULT_CACHE_DIRS])]
    .map((dir) => resolve(root, dir))
    .filter((dir) => inside(root, dir) && existsSync(dir));
}

function inside(root: string, full: string): boolean {
  const rel = relative(root, full);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/** Nitro's view of the project, for the Runtime view and `analog-nitro`. */
export function nitroInternals(project: Pick<AnalogProject, 'root' | 'config'>): NitroInternals {
  const root = project.root;
  const server = join(root, 'src/server');
  const plugins = files(
    join(server, 'plugins'),
    (n) => /\.(m?[jt]s)$/.test(n) && !n.endsWith('.d.ts'),
  )
    .map((full) => `/${posix(relative(root, full))}`)
    .slice(0, 100);
  const taskDir = join(server, 'tasks');
  const tasks = files(taskDir, (n) => /\.(m?[jt]s)$/.test(n) && !n.endsWith('.d.ts'))
    .map((full) => ({
      name: posix(relative(taskDir, full))
        .replace(/\.(m?[jt]s)$/, '')
        .split('/')
        .join(':'),
      file: `/${posix(relative(root, full))}`,
    }))
    .slice(0, 100);
  const storage = storageMounts(root);
  const cachedRules = (project.config.routeRules ?? []).flatMap((rule) => {
    const parts: string[] = [];
    if (rule.isr) parts.push(`isr: ${rule.isr}`);
    if (rule.swr) parts.push(`swr: ${rule.swr}`);
    if (rule.cache) parts.push('cache');
    return parts.length ? [{ path: rule.path, rule: parts.join(', ') }] : [];
  });
  const bases = cacheBases(root, storage);
  const entries: NitroCacheEntry[] = [];
  for (const base of bases) {
    for (const group of CACHE_GROUPS) {
      const dir = join(base, 'nitro', group);
      for (const full of files(dir, (n) => n.endsWith('.json'))) {
        if (entries.length >= MAX_ENTRIES) break;
        try {
          const stats = statSync(full);
          entries.push({
            file: `/${posix(relative(root, full))}`,
            group,
            key: redactText(posix(relative(dir, full)).replace(/\.json$/, '')),
            size: stats.size,
            modifiedAt: Math.round(stats.mtimeMs),
          });
        } catch {
          continue;
        }
      }
    }
  }
  const notes: string[] = [];
  const cacheMount = storage.find((m) => m.name === 'cache');
  if (cacheMount && cacheMount.driver !== 'fs' && cacheMount.driver !== 'fs-lite') {
    notes.push(
      `The cache storage uses the ${cacheMount.driver ?? 'configured'} driver, so its entries are not on disk and can't be listed or purged here.`,
    );
  }
  if (cachedRules.length && !entries.length && !notes.length) {
    notes.push(
      'No cache entries on disk yet. Nitro writes them when a cached route is requested; with the memory driver they never reach the disk.',
    );
  }
  return {
    plugins,
    tasks,
    storage,
    cachedRules,
    cacheDirs: bases.map((dir) => posix(relative(root, dir))),
    entries: entries.sort((a, b) => b.modifiedAt - a.modifiedAt),
    notes,
  };
}

/**
 * Deletes Nitro cache entry files. `files` are entry paths from
 * `nitroInternals`; left out, every listed entry goes. Only `.json` files
 * under a cache folder's `nitro/<group>/` are removed.
 */
export function purgeNitroCache(
  project: Pick<AnalogProject, 'root' | 'config'>,
  files?: string[],
): PurgeResult {
  const internals = nitroInternals(project);
  const known = new Set(internals.entries.map((e) => e.file));
  const chosen = files === undefined ? [...known] : files;
  if (!Array.isArray(chosen) || chosen.some((f) => typeof f !== 'string')) {
    return { ok: false, removed: 0, error: 'Pass entry paths as a list of strings.' };
  }
  const unknown = chosen.find((f) => !known.has(f));
  if (unknown) {
    return {
      ok: false,
      removed: 0,
      error: `${unknown.slice(0, 200)} is not a Nitro cache entry. List them with pangular:analog-scan-nitro first.`,
    };
  }
  let removed = 0;
  for (const file of chosen) {
    const full = resolve(project.root, `.${file}`);
    if (!inside(project.root, full) || !full.endsWith('.json')) continue;
    try {
      rmSync(full, { force: true });
      removed++;
    } catch {
      return { ok: false, removed, error: `Could not delete ${file}.` };
    }
  }
  return { ok: true, removed };
}

export interface TaskRunResult {
  ok: boolean;
  name: string;
  status?: number;
  ms?: number;
  /** The task's answer, masked and clipped. */
  output?: string;
  error?: string;
}

const TASK_TIMEOUT_MS = 30_000;
const MAX_TASK_OUTPUT = 4000;
const MAX_PAYLOAD = 10_000;

/**
 * Runs one Nitro task on the dev server through Nitro's dev task route
 * (`/_nitro/tasks/<name>`), which answers only with `nitro.experimental.tasks`
 * on. `name` must be a task `nitroInternals` lists; the answer is masked.
 */
export async function runNitroTask(
  project: Pick<AnalogProject, 'root' | 'config'>,
  name: unknown,
  payload: unknown,
  origin: string | undefined,
  timeoutMs = TASK_TIMEOUT_MS,
): Promise<TaskRunResult> {
  const task = typeof name === 'string' ? name : '';
  if (!task || !nitroInternals(project).tasks.some((t) => t.name === task)) {
    return {
      ok: false,
      name: task.slice(0, 100),
      error: `${task.slice(0, 100) || 'That'} is not a task under src/server/tasks. List them with pangular:analog-scan-nitro.`,
    };
  }
  if (
    payload !== undefined &&
    (!payload || typeof payload !== 'object' || Array.isArray(payload))
  ) {
    return { ok: false, name: task, error: 'Pass payload as an object.' };
  }
  const body = JSON.stringify({ payload: payload ?? {} });
  if (body.length > MAX_PAYLOAD)
    return { ok: false, name: task, error: 'The payload is too large.' };
  if (!origin) {
    return {
      ok: false,
      name: task,
      error:
        'The dev server address is unknown. This works only through the pangular() Vite plugin.',
    };
  }
  const started = performance.now();
  try {
    const response = await fetch(
      `${origin.replace(/\/+$/, '')}/_nitro/tasks/${encodeURIComponent(task)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', [DEVTOOLS_HEADER]: '1' },
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    const text = redactBody(await response.text());
    const output = text.length > MAX_TASK_OUTPUT ? `${text.slice(0, MAX_TASK_OUTPUT)}…` : text;
    const result: TaskRunResult = {
      ok: response.ok,
      name: task,
      status: response.status,
      ms: Math.round(performance.now() - started),
      output,
    };
    if (response.status === 404) {
      result.error =
        'Nitro has no task route. Turn on nitro.experimental.tasks in vite.config to run tasks from the dev server.';
    } else if (!response.ok) {
      result.error = `The task failed with ${response.status}.`;
    }
    return result;
  } catch (error) {
    const timedOut = (error as Error)?.name === 'TimeoutError';
    return {
      ok: false,
      name: task,
      ms: Math.round(performance.now() - started),
      error: timedOut
        ? `The task did not finish within ${Math.round(timeoutMs / 1000)} seconds.`
        : redactText(String((error as Error)?.message ?? error)).slice(0, 300),
    };
  }
}

function kb(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
}

/** Markdown for the `analog-nitro` agent tool. */
export function nitroText(internals: NitroInternals): string {
  const list = (items: string[], empty: string) =>
    items.length ? items.map((item) => `- ${item}`).join('\n') : empty;
  const lines = [
    '## Nitro',
    '',
    '### Server plugins',
    list(internals.plugins, 'None under src/server/plugins.'),
    '',
    '### Tasks',
    list(
      internals.tasks.map((t) => `${t.name} (${t.file})`),
      'None under src/server/tasks.',
    ),
    '',
    '### Storage mounts (vite.config)',
    list(
      internals.storage.map(
        (m) =>
          `${m.name}: ${m.driver ?? 'driver not a literal'}${m.base ? `, base ${m.base}` : ''}${m.from === 'devStorage' ? ' (dev only)' : ''}`,
      ),
      'None configured in nitro.storage or nitro.devStorage.',
    ),
    '',
    '### Cached routes',
    list(
      internals.cachedRules.map((r) => `${r.path}: ${r.rule}`),
      'No route rule caches responses (isr, swr or cache).',
    ),
    '',
    `### Cache entries on disk (${internals.entries.length})`,
    list(
      internals.entries.slice(0, 50).map((e) => `${e.group}/${e.key} (${kb(e.size)}, ${e.file})`),
      internals.cacheDirs.length
        ? 'The cache folders are empty.'
        : 'No Nitro cache folder in the project.',
    ),
  ];
  for (const note of internals.notes) lines.push('', `Note: ${note}`);
  return lines.join('\n');
}
