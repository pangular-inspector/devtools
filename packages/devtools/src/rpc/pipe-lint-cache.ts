// The pipe lint scans every source file synchronously. The audit reads it on
// each call, and the panel fetches the audit again on every session or axe
// change, so one result is kept for a short while instead of scanning again.

import type { PipeLintFinding } from './pipe-lint.ts';

/** How long one pipe lint result is reused. Short enough to see a saved edit on the next audit. */
export const PIPE_LINT_TTL_MS = 10_000;

/** Wraps `lint` so calls within `ttlMs` of the last scan reuse its result. */
export function cachedPipeLint(
  lint: () => PipeLintFinding[],
  options: { ttlMs?: number; now?: () => number } = {},
): () => PipeLintFinding[] {
  const ttlMs = options.ttlMs ?? PIPE_LINT_TTL_MS;
  const now = options.now ?? Date.now;
  let last: { at: number; findings: PipeLintFinding[] } | undefined;
  return () => {
    const at = now();
    if (!last || at - last.at >= ttlMs || at < last.at) {
      last = { at, findings: lint() };
    }
    return last.findings;
  };
}
