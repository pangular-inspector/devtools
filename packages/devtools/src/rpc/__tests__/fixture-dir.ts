import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onTestFinished } from 'vitest';

/** A temporary directory removed when the test that made it finishes. */
export function fixtureDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  // Registered on the running test, so it outlives neither it nor its
  // assertions. Callers use ordinary `it`, where the global hook resolves to
  // the right test; a `test.concurrent` caller would need the context hook.
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
