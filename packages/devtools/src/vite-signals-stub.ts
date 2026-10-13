import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Alias } from 'vite';

/** The entry the overlay's signal write hook imports (signal-history.ts). */
export const SIGNAL_PRIMITIVES = '@angular/core/primitives/signals';

/** The `@angular/core` major the app at `root` installs, or undefined when there is none. */
export function angularCoreMajor(root: string): number | undefined {
  try {
    const require = createRequire(join(root, 'package.json'));
    const file = require.resolve('@angular/core/package.json');
    const version = (JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown }).version;
    const major = parseInt(String(version), 10);
    return Number.isFinite(major) ? major : undefined;
  } catch {
    return undefined;
  }
}

/** The stub module next to this one: `.ts` in the workspace, `.mjs` in the published package. */
function stubPath(): string {
  const file = import.meta.url.endsWith('.ts') ? './signals-stub.ts' : './signals-stub.mjs';
  return fileURLToPath(new URL(file, import.meta.url));
}

/**
 * Angular ships `@angular/core/primitives/signals` from 17.0. On an older app
 * Vite could not resolve the overlay's import of it, so the plugin points it
 * at a stub, and signal history falls back to samples. Nothing changes from 17.0.
 */
export function signalPrimitivesAlias(root: string): Alias[] {
  const major = angularCoreMajor(root);
  if (major === undefined || major >= 17) return [];
  return [{ find: SIGNAL_PRIMITIVES, replacement: stubPath() }];
}
