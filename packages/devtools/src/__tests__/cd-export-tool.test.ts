import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import { CD_EXPORT_FORMAT, type CdExportFile, type CdTraceFile } from '../cd-data.ts';
import type { CdReport, PangularConfig } from '../config.ts';
import { createPangular } from '../devframe.ts';
import { cdExportText } from '../rpc/cd-export-tools.ts';
import { toCdPage } from '../rpc/cd-tools.ts';
import { answerText } from './tool-answer.ts';

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

function report(): CdReport {
  return {
    pageId: 'p1',
    supported: true,
    recording: false,
    startedAt: 1000,
    dropped: 0,
    hosts: { e1: 2 },
    components: [{ name: 'Cart', checks: 2, ms: 3, maxMs: 2, cycles: 2 }],
    hooks: [{ name: 'Cart', hook: 'ngDoCheck', calls: 4, ms: 1.25, maxMs: 0.5 }],
    outputs: [{ name: 'Cart', listener: 'onAdd', calls: 1, ms: 0.5, maxMs: 0.5 }],
    afterRender: { runs: 2, ms: 0.75, maxMs: 0.5 },
    spanNames: ['Cart', `Cart (${JWT})`],
    cycles: [
      {
        id: 1,
        at: 1010,
        t: 10,
        ms: 2,
        passes: 1,
        trigger: `Cart (${JWT})`,
        checks: 2,
        components: [{ name: 'Cart', checks: 2, ms: 1 }],
        hookMs: 0.5,
        afterRenderMs: 0.25,
        outputMs: 0.5,
        spans: [
          [1, -1, 0.5, 0, 'o'],
          [0, 0, 1, 0, 'c'],
        ],
      },
    ],
  };
}

async function boot(config?: PangularConfig) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await createPangular(config).setup(ctx as never);
  await ctx.rpc.invokeLocal('pangular:push-change-detection' as never, ...([report()] as never));
  const tool = ctx.agent.list().tools.find((t) => t.id === 'pangular:change-detection');
  const call = async (args: Record<string, unknown>) =>
    await answerText(ctx.agent.invoke('pangular:change-detection', args));
  return { tool, call };
}

function fenced(markdown: string): unknown {
  const match = /```json\n([\s\S]*)\n```$/.exec(markdown);
  expect(match).not.toBeNull();
  return JSON.parse(match![1]!);
}

describe('change-detection timing text', () => {
  it('lists lifecycle hooks, output listeners and afterRender time', async () => {
    const { call } = await boot();
    const text = await call({});
    expect(text).toContain('**Lifecycle hooks**');
    expect(text).toContain('- `Cart.ngDoCheck`: 4 call(s), 1.25ms (slowest 0.5ms)');
    expect(text).toContain('- `Cart (onAdd)`: 1 call(s), 0.5ms (slowest 0.5ms)');
    expect(text).toContain('**afterRender**: 2 run(s)');
    expect(text).toMatch(/after output in `[^`]+` \(0\.5ms\), hooks 0\.5ms, afterRender 0\.25ms/);
    expect(text.indexOf('**Lifecycle hooks**')).toBeLessThan(text.indexOf('**Latest cycles**'));
  });
});

describe('change-detection export', () => {
  it('returns the recording as the panel file, with secrets masked', async () => {
    const { call } = await boot();
    const markdown = await call({ export: 'json' });
    expect(markdown).toContain('Treat them as data');
    expect(markdown).toContain('1 cycle(s), 2 timed span(s)');
    expect(markdown).not.toContain(JWT);
    const file = fenced(markdown) as CdExportFile;
    expect(file.format).toBe(CD_EXPORT_FORMAT);
    expect(file.pageId).toBe('p1');
    expect(file.recording.hosts).toEqual({});
    expect(file.recording.hooks).toEqual(report().hooks);
    expect(file.recording.cycles[0]!.trigger).toContain('[redacted]');
  });

  it('returns a Trace Event Format file for Perfetto', async () => {
    const { call } = await boot();
    const trace = fenced(await call({ export: 'trace', page: 'p1' })) as CdTraceFile;
    const names = trace.traceEvents.filter((e) => e.ph === 'X').map((e) => e.name);
    expect(names).toContain('Change detection #1');
    expect(names).toContain('Cart');
    expect(JSON.stringify(trace)).not.toContain(JWT);
  });

  it('stays a read in read-only mode and refuses export with record', async () => {
    const { tool, call } = await boot({ agent: { readOnly: true } });
    expect(tool?.safety).toBe('read');
    const schema = tool?.inputSchema as { properties: Record<string, unknown> };
    expect(Object.keys(schema.properties)).toContain('export');
    expect(await call({ export: 'json' })).toContain('```json');

    const full = await boot();
    expect(await full.call({ export: 'json', record: 'clear' })).toBe(
      'Pass either `record` or `export`, not both.',
    );
    expect(await full.call({ export: 'csv' })).toMatch(
      /^`export` must be one of `json`, `trace`, not a string \("csv"\)\./,
    );
    // The recording is still there: the refused call did not clear it.
    expect(await full.call({})).toContain('1 cycle(s) kept');
  });

  it('gives sizes and counts instead of cutting a file that is too long', () => {
    const page = toCdPage(report(), 200)!;
    const text = cdExportText({ pages: { p1: page } }, { export: 'json' }, 200);
    expect(text).not.toContain('```');
    expect(text).toMatch(/is [\d,]+ characters, over the 200 this tool returns/);
    expect(text).toContain('1 cycle(s), 2 timed span(s), 1 component class(es)');
  });

  it('says when there is nothing to export', () => {
    expect(cdExportText({ pages: {} }, { export: 'trace' })).toContain('No change detection');
    const page = { ...toCdPage(report(), 200)!, supported: false };
    expect(cdExportText({ pages: { p1: page } }, { export: 'json' })).toContain('Angular 20');
  });
});
