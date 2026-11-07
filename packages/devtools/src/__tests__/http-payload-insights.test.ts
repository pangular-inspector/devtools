import { describe, expect, it } from 'vitest';
import { PAYLOAD_BUDGET_BYTES, byteText, payloadInsights } from '../http-data.ts';
import type { PayloadSummary } from '../http-payload.ts';
import { transferStateText } from '../rpc/ssr-override-tools.ts';
import type { HttpPage } from '../types.ts';

const entry = (key: string, size: number, url?: string) => ({
  key,
  size,
  value: null,
  ...(url ? { http: { url, status: 200 } } : {}),
});

describe('payloadInsights', () => {
  it('ranks the largest entries with their share of the payload', () => {
    const info = payloadInsights({
      size: 1000,
      entries: [entry('a', 100), entry('b', 600, '/api/big'), entry('c', 300), entry('d', 0)],
    });
    expect(info.overBudget).toBe(false);
    expect(info.largest).toEqual([
      { key: 'b', label: '/api/big', size: 600, share: 60 },
      { key: 'c', label: 'c', size: 300, share: 30 },
      { key: 'a', label: 'a', size: 100, share: 10 },
    ]);
    expect(payloadInsights({ size: 0, entries: [] }).largest).toEqual([]);
  });

  it('warns over the 100 KB budget', () => {
    expect(PAYLOAD_BUDGET_BYTES).toBe(102_400);
    expect(payloadInsights({ size: 102_401, entries: [] }).overBudget).toBe(true);
    expect(payloadInsights({ size: 50, entries: [] }, { budget: 40 }).overBudget).toBe(true);
  });

  it('finds a URL the transfer cache stored under more than one key', () => {
    const info = payloadInsights({
      size: 30,
      entries: [entry('k1', 10, '/api/p'), entry('k2', 15, '/api/p'), entry('k3', 5, '/api/q')],
    });
    expect(info.sameUrl).toEqual([{ url: '/api/p', keys: ['k1', 'k2'], size: 25 }]);
  });

  it('writes sizes for people', () => {
    expect([byteText(812), byteText(14_540), byteText(102_400), byteText(1_400_000)]).toEqual([
      '812 B',
      '14.2 KB',
      '100 KB',
      '1.3 MB',
    ]);
  });
});

describe('inspect-transfer-state notes', () => {
  const page = { pageId: 'p1', url: '/', initialUrl: '/', reportedAt: 1 } as HttpPage;

  it('adds the budget warning and the repeated URLs to the key list', () => {
    const payload: PayloadSummary = {
      found: true,
      size: 150_000,
      entries: [entry('k1', 90_000, '/api/p'), entry('k2', 50_000, '/api/p'), entry('x', 10)],
    };
    const text = transferStateText(new Map([['p1', payload]]), [page]);
    expect(text).toContain('Over the 100 KB budget');
    expect(text).toContain('Largest entries: `/api/p` (87.9 KB), `/api/p` (48.8 KB), `x` (10 B).');
    expect(text).toContain('Same URL stored under more than one key');
    expect(text).toContain('`/api/p` (2 keys)');
  });

  it('adds nothing to a small payload with no repeats', () => {
    const payload: PayloadSummary = { found: true, size: 20, entries: [entry('a', 10, '/api/a')] };
    const text = transferStateText(new Map([['p1', payload]]), [page]);
    expect(text).not.toContain('budget');
    expect(text).not.toContain('Same URL');
  });
});
