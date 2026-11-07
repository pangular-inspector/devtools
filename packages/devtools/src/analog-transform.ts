// The Vite transform stack of one project file: which plugins changed the
// code, in order, so the `.analog`/`.ag` compile and Analog's server function
// id rewrite can be seen. The Vite plugin wraps each plugin's `transform`
// hook once; the wrapper records only while a trace of that file runs.

import { redactText } from './serialize.ts';

/** One plugin's `transform` hook on the traced file. */
export interface TransformStep {
  plugin: string;
  /** Whether the hook returned code that differs from what it got. */
  changed: boolean;
  ms: number;
  /** Characters of code after the step. */
  size: number;
  /** The code after the step, masked and clipped, for the steps that changed it. */
  code?: string;
  truncated?: true;
}

export interface TransformTrace {
  file: string;
  ssr: boolean;
  steps: TransformStep[];
  /** The code Vite serves, masked and clipped. */
  code: string;
  truncated?: true;
  /** `vite-plugin-inspect`'s page for the file, when that plugin is installed. */
  inspectUrl?: string;
  error?: string;
}

type Hook = (this: unknown, code: string, id: string, options?: unknown) => unknown;
type HookObject = { handler: Hook; [key: string]: unknown };

interface VitePluginLike {
  name?: string;
  transform?: Hook | HookObject;
}

interface ModuleLike {
  file?: string | null;
}

interface EnvironmentLike {
  plugins?: readonly VitePluginLike[];
  transformRequest?: (url: string) => Promise<{ code: string } | null>;
  moduleGraph?: {
    getModulesByFile(file: string): Set<ModuleLike> | undefined;
    invalidateModule(mod: ModuleLike): void;
  };
}

/** The parts of Vite's dev server the tracer uses. */
export interface ViteServerLike {
  config: { root: string; base?: string; plugins: readonly VitePluginLike[] };
  environments?: Record<string, EnvironmentLike>;
  moduleGraph?: EnvironmentLike['moduleGraph'];
  transformRequest?: (url: string, options?: { ssr?: boolean }) => Promise<{ code: string } | null>;
}

const MAX_CODE = 20_000;
const MAX_STEPS = 60;
const TRACE_TIMEOUT_MS = 15_000;

/** Files being traced, by their path with `/` separators, and the steps seen so far. */
const active = new Map<string, TransformStep[]>();
const wrapped = new WeakSet<object>();
let tracer: ((file: string, ssr: boolean) => Promise<TransformTrace>) | undefined;
/** The dev server the tracer belongs to: a restart opens the new one before the old one closes. */
let tracerOwner: unknown;

function posix(path: string): string {
  return path.split('\\').join('/');
}

function clipCode(code: string): { code: string; truncated?: true } {
  const masked = redactText(code.length > MAX_CODE ? code.slice(0, MAX_CODE) : code);
  return code.length > MAX_CODE ? { code: masked, truncated: true } : { code: masked };
}

function codeOf(result: unknown): string | undefined {
  if (typeof result === 'string') return result;
  if (
    result &&
    typeof result === 'object' &&
    typeof (result as { code?: unknown }).code === 'string'
  ) {
    return (result as { code: string }).code;
  }
  return undefined;
}

function record(
  steps: TransformStep[],
  plugin: string,
  input: string,
  result: unknown,
  ms: number,
) {
  if (steps.length >= MAX_STEPS) return;
  const out = codeOf(result);
  const changed = out !== undefined && out !== input;
  const step: TransformStep = {
    plugin,
    changed,
    ms: Math.round(ms * 10) / 10,
    size: (out ?? input).length,
  };
  if (changed) Object.assign(step, clipCode(out));
  steps.push(step);
}

/** Wraps one plugin's `transform` hook so a trace can see it; a no-op for a plugin already wrapped. */
export function wrapTransform(plugin: VitePluginLike): void {
  const hook = plugin.transform;
  if (!hook || wrapped.has(plugin)) return;
  wrapped.add(plugin);
  const name = plugin.name ?? '(unnamed plugin)';
  const original = typeof hook === 'function' ? hook : hook.handler;
  if (typeof original !== 'function') return;
  const handler: Hook = function (this: unknown, code, id, options) {
    const steps = active.size ? active.get(posix(String(id).split('?')[0])) : undefined;
    if (!steps) return original.call(this, code, id, options);
    const started = performance.now();
    const settle = (result: unknown) => {
      record(steps, name, code, result, performance.now() - started);
      return result;
    };
    const result = original.call(this, code, id, options);
    return result instanceof Promise ? result.then(settle) : settle(result);
  };
  plugin.transform = typeof hook === 'function' ? handler : { ...hook, handler };
}

function invalidate(env: EnvironmentLike | undefined, file: string) {
  const graph = env?.moduleGraph;
  for (const mod of graph?.getModulesByFile(file) ?? []) graph?.invalidateModule(mod);
}

/**
 * Wraps the transform hooks of the dev server's plugins and makes
 * `traceTransform` work. Called by the Vite plugin in `configureServer`.
 */
export function installTransformTracer(server: ViteServerLike): void {
  // A partial server (a test double, an older Vite) may lack these lists.
  const list = (value: unknown): readonly VitePluginLike[] =>
    Array.isArray(value) ? (value as VitePluginLike[]) : [];
  const own = list(server.config?.plugins);
  const all = [
    ...own,
    ...Object.values(server.environments ?? {}).flatMap((env) => list(env?.plugins)),
  ];
  for (const plugin of all) wrapTransform(plugin);
  const inspect = own.some((p) => /vite-plugin-inspect/.test(p.name ?? ''));
  const base = (server.config.base ?? '/').replace(/\/?$/, '/');
  tracerOwner = server;
  tracer = async (file, ssr) => {
    const full = posix(`${server.config.root.replace(/[\\/]+$/, '')}${file}`);
    const env = server.environments?.[ssr ? 'ssr' : 'client'];
    const trace: TransformTrace = { file, ssr, steps: [], code: '' };
    if (inspect) trace.inspectUrl = `${base}__inspect/#/module?id=${encodeURIComponent(full)}`;
    if (active.has(full)) return { ...trace, error: 'A trace of this file is already running.' };
    const steps: TransformStep[] = [];
    active.set(full, steps);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // The cached result skips the plugins, so drop it and transform again.
      invalidate(env ?? { moduleGraph: server.moduleGraph }, full);
      const run = env?.transformRequest
        ? env.transformRequest(file)
        : server.transformRequest?.(file, { ssr });
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('The transform took too long.')),
          TRACE_TIMEOUT_MS,
        );
      });
      const result = await Promise.race([run ?? Promise.resolve(null), timeout]);
      if (!result) return { ...trace, steps, error: 'Vite did not transform this file.' };
      return { ...trace, steps, ...clipCode(result.code) };
    } catch (error) {
      const message = redactText(String((error as Error)?.message ?? error)).slice(0, 500);
      return { ...trace, steps, error: `Vite could not transform this file: ${message}` };
    } finally {
      clearTimeout(timer);
      active.delete(full);
    }
  };
}

/**
 * Forgets the dev server when it closes. With `owner`, only while that server
 * still owns the tracer, so a closing server never clears its successor's.
 */
export function resetTransformTracer(owner?: unknown): void {
  if (owner !== undefined && owner !== tracerOwner) return;
  tracer = undefined;
  tracerOwner = undefined;
  active.clear();
}

/** Whether a trace can run: only through the `pangular()` Vite plugin. */
export function canTraceTransforms(): boolean {
  return !!tracer;
}

/** Transforms a project file (`/src/app/pages/index.page.ts`) again and returns each plugin's step. */
export async function traceTransform(file: string, ssr = false): Promise<TransformTrace> {
  if (!tracer) {
    return {
      file,
      ssr,
      steps: [],
      code: '',
      error:
        'The transform stack is known only to the Vite dev server. Run the app with the pangular() Vite plugin.',
    };
  }
  return tracer(file, ssr);
}
