import { describe, expect, it } from 'vitest';
import { compareCounts, countDiagnostics } from '../../../../scripts/lint-ratchet.mjs';

describe('lint ratchet', () => {
  it('counts diagnostics per file and rule with sorted keys', () => {
    const counts = countDiagnostics(
      [
        { filename: 'b.ts', code: 'eslint(no-unused-vars)' },
        { filename: 'a.ts', code: 'typescript(no-explicit-any)' },
        { filename: 'b.ts', code: 'eslint(no-unused-vars)' },
        { filename: 'b.ts', code: 'eslint(no-control-regex)' },
      ],
      '/repo',
    );
    expect(counts).toEqual({
      'a.ts': { 'typescript(no-explicit-any)': 1 },
      'b.ts': { 'eslint(no-control-regex)': 1, 'eslint(no-unused-vars)': 2 },
    });
    expect(Object.keys(counts['b.ts']!)).toEqual([
      'eslint(no-control-regex)',
      'eslint(no-unused-vars)',
    ]);
  });

  it('fails on a new warning, also in a new file or for a new rule', () => {
    const baseline = { 'a.ts': { any: 2 } };
    expect(compareCounts(baseline, { 'a.ts': { any: 3 } }).added).toEqual(['a.ts: any 2 -> 3']);
    expect(compareCounts(baseline, { 'a.ts': { any: 2, unused: 1 } }).added).toEqual([
      'a.ts: unused 0 -> 1',
    ]);
    expect(compareCounts(baseline, { 'a.ts': { any: 2 }, 'b.ts': { any: 1 } }).added).toEqual([
      'b.ts: any 0 -> 1',
    ]);
  });

  it('passes at the baseline and lists counts that went down', () => {
    const baseline = { 'a.ts': { any: 2 }, 'b.ts': { unused: 1 } };
    expect(compareCounts(baseline, baseline)).toEqual({ added: [], fixed: [] });
    expect(compareCounts(baseline, { 'a.ts': { any: 1 } })).toEqual({
      added: [],
      fixed: ['a.ts: any 2 -> 1', 'b.ts: unused 1 -> 0'],
    });
  });
});
