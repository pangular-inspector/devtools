// Keeps the Analog source scan until a file it reads changes, instead of
// rescanning every few seconds. The Vite plugin bumps a shared version from
// its file watcher; elsewhere (the Express hub, the CLI) the cache watches the
// folders the scan reads with `fs.watch`. Where neither works, it falls back
// to rescanning after `fallbackMs`.

import { existsSync, watch as fsWatch } from 'node:fs';
import { join } from 'node:path';

interface ScanVersion {
  /** Bumped by the Vite plugin's watcher on every file change in the project. */
  version: number;
  /** Whether a Vite watcher is bumping `version`. */
  watched: boolean;
}

function scanVersion(): ScanVersion {
  const g = globalThis as { __PANGULAR_ANALOG_SCAN__?: ScanVersion };
  return (g.__PANGULAR_ANALOG_SCAN__ ??= { version: 0, watched: false });
}

const WATCHED_DIRS = ['src', 'app', 'dist'];

const SKIP = /[\\/](node_modules|\.git|\.nx|\.angular|\.cache)([\\/]|$)/;

/**
 * For the Vite plugin: marks the scan as watched and returns the listener to
 * pass to `server.watcher.on('all', ...)`.
 */
export function viteScanWatcher(): (event: string, file: string) => void {
  const shared = scanVersion();
  shared.watched = true;
  return (_event, file) => {
    if (!SKIP.test(String(file))) shared.version++;
  };
}

/** For tests and server restarts: forgets the Vite watcher. */
export function resetScanVersion(): void {
  const shared = scanVersion();
  shared.version = 0;
  shared.watched = false;
}

export type WatchFn = (
  path: string,
  options: { recursive: boolean },
  onChange: (file: string) => void,
) => { close(): void };

const nodeWatch: WatchFn = (path, options, onChange) => {
  const watcher = fsWatch(path, { recursive: options.recursive, persistent: false }, (_e, file) =>
    onChange(String(file ?? '')),
  );
  watcher.on('error', () => onChange(''));
  return watcher;
};

/** The folders under `root` the scan reads, recursively, and `root` itself for config files. */
export function watchedPaths(root: string): { path: string; recursive: boolean }[] {
  const out = [{ path: root, recursive: false }];
  for (const dir of WATCHED_DIRS) {
    const path = join(root, dir);
    if (existsSync(path)) out.push({ path, recursive: true });
  }
  return out;
}

export interface ScanCache<T> {
  /** The scan, fresh: rescans now when a file changed. For queries and agent tools. */
  get(): T;
  /**
   * The last scan without waiting, for pushes. When a file changed, the
   * rescan runs on a later tick and `onRefresh` listeners get the new one.
   */
  peek(): T;
  onRefresh(listener: (value: T) => void): () => void;
  dispose(): void;
}

export function createScanCache<T extends { root: string }>(
  scan: () => T,
  options: { watch?: WatchFn | false; fallbackMs?: number; now?: () => number } = {},
): ScanCache<T> {
  const watch = options.watch === undefined ? nodeWatch : options.watch;
  const fallbackMs = options.fallbackMs ?? 2000;
  const now = options.now ?? Date.now;
  const listeners = new Set<(value: T) => void>();
  let value: T | undefined;
  let at = 0;
  let version = -1;
  let dirty = true;
  let watching: { root: string; closers: { close(): void }[]; ok: boolean } | undefined;
  let scheduled = false;
  let rewatch = false;

  const unwatch = () => {
    for (const closer of watching?.closers ?? []) {
      try {
        closer.close();
      } catch {
        // already closed
      }
    }
    watching = undefined;
  };

  const startWatching = (root: string) => {
    if (scanVersion().watched || !watch) return;
    if (watching?.root === root && !rewatch) return;
    unwatch();
    rewatch = false;
    const state = { root, closers: [] as { close(): void }[], ok: true };
    watching = state;
    for (const { path, recursive } of watchedPaths(root)) {
      try {
        state.closers.push(
          watch(path, { recursive }, (file) => {
            if (SKIP.test(join(path, file))) return;
            dirty = true;
            // A watcher error (no file name), or a folder the scan reads appeared or went
            // away (a build wrote dist): watch anew.
            if (!file || (!recursive && WATCHED_DIRS.includes(file))) rewatch = true;
          }),
        );
      } catch {
        state.ok = false;
      }
    }
  };

  const stale = () => {
    if (!value || dirty) return true;
    const shared = scanVersion();
    if (shared.watched) return shared.version !== version;
    if (watch && watching?.ok) return false;
    return now() - at > fallbackMs;
  };

  const rescan = () => {
    // Clear first, so a change during the scan marks the new value stale again.
    dirty = false;
    version = scanVersion().version;
    at = now();
    value = scan();
    startWatching(value.root);
    return value;
  };

  const notify = (next: T) => {
    for (const listener of listeners) {
      try {
        listener(next);
      } catch {
        // a broken listener must not break the others
      }
    }
  };

  const refresh = () => {
    scheduled = false;
    if (!stale()) return;
    notify(rescan());
  };

  return {
    get: () => {
      if (!stale()) return value!;
      // Whichever call rescans tells the listeners, or the open pages keep the old scan.
      const first = !value;
      const next = rescan();
      if (!first) notify(next);
      return next;
    },
    peek: () => {
      if (!value) return rescan();
      if (stale() && !scheduled) {
        scheduled = true;
        setImmediate(refresh);
      }
      return value;
    },
    onRefresh: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      unwatch();
      listeners.clear();
    },
  };
}
