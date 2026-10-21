import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import { createPangular } from '../../devframe.ts';
import {
  SCAN_LIST_DEFAULT_LIMIT,
  SCAN_LIST_MAX_CHARS,
  scanListAnswer,
  type ScanList,
} from '../scan-list.ts';
import { SCAN_TOOLS, scanTool } from '../scan-tools.ts';
import { guardHandler } from '../tool-input.ts';

// #429: scan-signals and scan-components cap their answer, say how much they
// left out, and take `filter`, `offset` and `limit` to read the rest.

const SIGNALS: ScanList = { noun: 'signals', fields: ['name', 'kind', 'file', 'component'] };

function signals(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: i % 10 === 0 ? `Total${i}` : `value${i}`,
    kind: i % 2 ? 'computed' : 'signal',
    file: `src/app/feature-${Math.floor(i / 50)}.ts`,
    line: i + 1,
  }));
}

/** The JSON part of an answer, before its note. */
const items = (text: string) => JSON.parse(text.split('\n\n')[0]) as { line: number }[];

describe('scanListAnswer', () => {
  it('answers a small list as the JSON array alone, as before', () => {
    const list = signals(12);
    expect(scanListAnswer(list, {}, SIGNALS)).toBe(JSON.stringify(list));
    expect(scanListAnswer([], {}, SIGNALS)).toBe('[]');
  });

  it('cuts a long list at the default limit and gives the next offset', () => {
    const text = scanListAnswer(signals(450), {}, SIGNALS);
    expect(items(text)).toHaveLength(SCAN_LIST_DEFAULT_LIMIT);
    expect(text).toContain('_Showing signals 1-200 of 450; 250 more not shown.');
    expect(text).toContain('Pass `offset: 200` for the next part, or `filter` to narrow it.');

    const last = scanListAnswer(signals(450), { offset: 400 }, SIGNALS);
    expect(items(last).map((s) => s.line)).toEqual(Array.from({ length: 50 }, (_, i) => 401 + i));
    expect(last).toContain('Showing signals 401-450 of 450');
    expect(last).toContain('This is the last part.');
  });

  it('pages with offset and limit without losing or repeating items', () => {
    const all = signals(95);
    const seen: number[] = [];
    let offset = 0;
    for (;;) {
      const text = scanListAnswer(all, { offset, limit: 30 }, SIGNALS);
      seen.push(...items(text).map((s) => s.line));
      const next = /offset: (\d+)/.exec(text)?.[1];
      if (!next) break;
      offset = Number(next);
    }
    expect(seen).toEqual(all.map((s) => s.line));
  });

  it('filters on the listed fields, in any case', () => {
    const text = scanListAnswer(signals(450), { filter: 'total' }, SIGNALS);
    expect(items(text)).toHaveLength(45);
    expect(text).not.toContain('\n');
    expect(scanListAnswer(signals(450), { filter: 'FEATURE-8' }, SIGNALS)).not.toContain('\n');
    expect(scanListAnswer(signals(450), { filter: 'nothing like it' }, SIGNALS)).toBe(
      '[]\n\n_No signals match `filter`; the scan found 450 in all._',
    );
  });

  it('says where the list ends when the offset is past it', () => {
    expect(scanListAnswer(signals(450), { offset: 900 }, SIGNALS)).toBe(
      '[]\n\n_No signals at `offset` 900; there are 450, so the last part starts at 250._',
    );
  });

  it('keeps the whole answer, note included, under the character cap', () => {
    const wide = signals(150).map((s) => ({ ...s, file: `src/${'deep/'.repeat(60)}x.ts` }));
    const text = scanListAnswer(wide, { limit: 150 }, SIGNALS);
    expect(text.length).toBeLessThanOrEqual(SCAN_LIST_MAX_CHARS);
    const kept = items(text).length;
    expect(kept).toBeGreaterThan(1);
    expect(kept).toBeLessThan(150);
    expect(text).toContain(`${150 - kept} more not shown. Pass \`offset: ${kept}\``);
  });
});

describe('listed scan tools', () => {
  const fake = (result: unknown[]) =>
    scanTool(
      {
        id: 'pangular:scan-signals',
        title: 'Scan',
        description: 'Fake scan',
        definition: { name: 'fake', setup: () => ({ handler: async () => result }) },
        list: SIGNALS,
      },
      {},
    );

  it('cuts a single item longer than the cap, so the cap still holds', () => {
    const list = signals(3);
    (list[1] as Record<string, unknown>)['component'] = 'x'.repeat(SCAN_LIST_MAX_CHARS * 2);
    const text = scanListAnswer(list, { offset: 1 }, SIGNALS);
    expect(text.length).toBeLessThanOrEqual(SCAN_LIST_MAX_CHARS);
    expect(text).toContain('_Item 2 of 3 is ');
    expect(text).toContain('Pass `offset: 2` for the next part.');
    const last = scanListAnswer([list[1]], {}, SIGNALS);
    expect(last.length).toBeLessThanOrEqual(SCAN_LIST_MAX_CHARS);
    expect(last).toContain('This is the last part.');
  });

  it('points the scans at the live tools that read the running page', () => {
    const description = (id: string) => SCAN_TOOLS.find((tool) => tool.id === id)!.description;
    expect(description('pangular:scan-components')).toContain('pangular:list-components');
    expect(description('pangular:scan-signals')).toContain('pangular:inspect-signals');
  });

  it('checks filter, offset and limit against the input schema', async () => {
    const tool = fake(signals(300));
    const guarded = guardHandler(tool.inputSchema, tool.handler, tool.id);
    for (const bad of [
      { offset: -1 },
      { limit: 0 },
      { limit: 5000 },
      { filter: 3 },
      { offset: 1.5 },
    ]) {
      await expect(guarded(bad), JSON.stringify(bad)).rejects.toThrow();
    }
    const text = (await guarded({ offset: 290, limit: 5 })) as string;
    expect(items(text).map((s) => s.line)).toEqual([291, 292, 293, 294, 295]);
  });

  it('gives scan-signals and scan-components the paging arguments and leaves the other scans alone', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await createPangular({}).setup(ctx as never);
    const tools = new Map(ctx.agent.list().tools.map((tool) => [tool.id, tool]));
    for (const id of ['pangular:scan-signals', 'pangular:scan-components']) {
      const properties = (tools.get(id)?.inputSchema as { properties?: object })?.properties;
      expect(Object.keys(properties ?? {}).sort(), id).toEqual(['filter', 'limit', 'offset']);
    }
    const build = (tools.get('pangular:scan-build')?.inputSchema as { properties?: object })
      ?.properties;
    expect(build).toEqual({});
    const text = (await ctx.agent.invoke('pangular:scan-signals', { limit: 1 })) as string;
    expect(items(text).length).toBeLessThanOrEqual(1);
  });
});
