import { realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

/** The package of the devframe wire service that opens files, when the host installs it. */
export const OPEN_SERVICE_PACKAGE = '@devframes/service-open';

export interface OpenInEditorRequest {
  file?: unknown;
  line?: unknown;
  column?: unknown;
}

export type OpenInEditorResult = { ok: true; file: string } | { ok: false; error: string };

/** Opens `target` (`file`, `file:line` or `file:line:column`) in the developer's editor. */
export type EditorLauncher = (path: string, line?: number, column?: number) => void | Promise<void>;

const MAX_PATH = 4096;
const MAX_LINE = 10_000_000;

function within(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function position(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_LINE
    ? value
    : undefined;
}

async function canonical(path: string): Promise<string | null> {
  try {
    return await realpath(path);
  } catch {
    return null;
  }
}

/**
 * Where `file` could be under `roots`: itself when absolute, then under each
 * root, so a project-relative path (Angular's `debugInfo.filePath`) and a
 * root-relative one (`/src/app/app.ts` from a dev server) both resolve.
 */
function candidates(file: string, roots: readonly string[]): string[] {
  const list = isAbsolute(file)
    ? [resolve(file), ...roots.map((root) => resolve(join(root, file)))]
    : roots.map((root) => resolve(root, file));
  return [...new Set(list)];
}

/**
 * Resolves `file` to a regular file inside one of `roots`, or says why not.
 * Refuses paths that leave every root, by `..`, by an absolute path or
 * through a symlink, and paths that are missing or are not files.
 */
export async function resolveEditorFile(
  file: unknown,
  roots: readonly string[],
): Promise<OpenInEditorResult> {
  if (typeof file !== 'string' || !file.trim() || file.length > MAX_PATH || file.includes('\0')) {
    return { ok: false, error: 'No file to open.' };
  }
  const allowed = [...new Set(roots.map((root) => resolve(root)))];
  const real = (await Promise.all(allowed.map(canonical))).filter(
    (root): root is string => root !== null,
  );
  let inside = false;
  let notFile = false;
  for (const path of candidates(file.trim(), allowed)) {
    if (!allowed.some((root) => within(root, path))) continue;
    inside = true;
    const target = await canonical(path);
    if (!target) continue;
    if (!real.some((root) => within(root, target))) {
      return { ok: false, error: `${file} is outside the project root.` };
    }
    const info = await stat(target).catch(() => null);
    if (!info?.isFile()) {
      notFile = true;
      continue;
    }
    return { ok: true, file: target };
  }
  // An absolute path outside every root is refused as such, even when the
  // root-relative reading of it is merely missing.
  const literal = file.trim();
  const absoluteOutside =
    isAbsolute(literal) && !allowed.some((root) => within(root, resolve(literal)));
  if (!inside || absoluteOutside) {
    return { ok: false, error: `${file} is outside the project root.` };
  }
  return { ok: false, error: notFile ? `${file} is not a file.` : `${file} was not found.` };
}

/** The handler of the `open-in-editor` RPC: checks the path, then launches the editor. */
export function createOpenInEditor(options: {
  roots: () => readonly string[];
  launch: EditorLauncher;
}) {
  return async (request: OpenInEditorRequest | null): Promise<OpenInEditorResult> => {
    const result = await resolveEditorFile(request?.file, options.roots());
    if (!result.ok) return result;
    try {
      await options.launch(result.file, position(request?.line), position(request?.column));
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not open the editor.',
      };
    }
    return result;
  };
}

interface OpenServiceApi {
  openInEditor: (input: { path: string; line?: number; column?: number }) => Promise<void>;
}

/**
 * Launches through the `@devframes/service-open` wire service when the host
 * installed it, so its editor setting applies, and otherwise through
 * devframe's `launch-editor`, which picks the editor from `LAUNCH_EDITOR`,
 * then a running editor, then `VISUAL` or `EDITOR`.
 */
export function defaultLauncher(services: { get(id: string): unknown }): EditorLauncher {
  return async (path, line, column) => {
    const service = services.get(OPEN_SERVICE_PACKAGE) as OpenServiceApi | undefined;
    if (typeof service?.openInEditor === 'function') {
      await service.openInEditor({ path, line, column });
      return;
    }
    const { launchEditor } = await import('devframe/utils/launch-editor');
    launchEditor(line ? `${path}:${line}${column ? `:${column}` : ''}` : path);
  };
}
