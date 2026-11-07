import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createScanCache, resetScanVersion, type WatchFn } from '../rpc/analog-scan-cache.ts';

/** A watch function the test drives: each call records its path and change callback. */
function fakeWatch() {
  const watchers: { path: string; onChange: (file: string) => void; closed: boolean }[] = [];
  const watch: WatchFn = (path, _options, onChange) => {
    const entry = { path, onChange, closed: false };
    watchers.push(entry);
    return { close: () => (entry.closed = true) };
  };
  return { watch, watchers };
}

describe('createScanCache', () => {
  afterEach(resetScanVersion);

  it('tells the listeners when get() runs the rescan', () => {
    const root = mkdtempSync(join(tmpdir(), 'scan-cache-'));
    const { watch, watchers } = fakeWatch();
    let n = 0;
    const cache = createScanCache(() => ({ root, n: ++n }), { watch });
    cache.get();
    const seen: number[] = [];
    cache.onRefresh((value) => seen.push(value.n));

    watchers[0]!.onChange('a.page.ts');
    expect(cache.get().n).toBe(2);
    expect(seen).toEqual([2]);
    cache.dispose();
  });

  it('watches again after a watcher error', () => {
    const root = mkdtempSync(join(tmpdir(), 'scan-cache-'));
    const { watch, watchers } = fakeWatch();
    let n = 0;
    const cache = createScanCache(() => ({ root, n: ++n }), { watch });
    cache.get();
    const first = watchers[0]!;

    // nodeWatch reports a watcher `error` event as a change with no file name.
    first.onChange('');
    expect(cache.get().n).toBe(2);
    expect(first.closed).toBe(true);
    expect(watchers.length).toBe(2);

    // The new watcher still marks the scan stale.
    watchers[1]!.onChange('a.page.ts');
    expect(cache.get().n).toBe(3);
    cache.dispose();
  });
});
