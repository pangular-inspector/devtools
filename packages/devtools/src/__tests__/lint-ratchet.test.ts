import { describe, expect, it } from 'vitest';
import {
  MAX_LINES_RULE,
  compareCounts,
  countDiagnostics,
  lineDiagnostics,
} from '../../../../scripts/lint-ratchet.mjs';

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

  it('holds files over the line limit at their length, and lets short ones be', () => {
    const lines = lineDiagnostics(
      [
        { file: 'big.ts', lines: 1600 },
        { file: 'small.ts', lines: 200 },
      ],
      1500,
    );
    expect(lines.map((d) => [d.filename, d.count])).toEqual([['big.ts', 1600]]);
    const baseline = countDiagnostics(lines, '/repo');
    expect(baseline).toEqual({ 'big.ts': { [MAX_LINES_RULE]: 1600 } });
    const grown = countDiagnostics(
      lineDiagnostics([{ file: 'big.ts', lines: 1610 }], 1500),
      '/repo',
    );
    expect(compareCounts(baseline, grown).added).toEqual([
      `big.ts: ${MAX_LINES_RULE} 1600 -> 1610`,
    ]);
    const split = countDiagnostics(
      lineDiagnostics([{ file: 'big.ts', lines: 900 }], 1500),
      '/repo',
    );
    expect(compareCounts(baseline, split)).toEqual({
      added: [],
      fixed: [`big.ts: ${MAX_LINES_RULE} 1600 -> 0`],
    });
  });
});
