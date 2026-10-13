import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import pangular from '../devframe.ts';
import {
  cdCauseText,
  cdHints,
  cdTraceFile,
  parseCdImport,
  sanitizeCdDiagnosis,
  sanitizeCdRecording,
} from '../cd-data.ts';
import { AGENT_INSPECTOR, AGENT_SAFETY, PAGE_AGENT_ENTRIES, type CdDiagnosis } from '../config.ts';
import { cdDiagnosisText } from '../rpc/cd-diagnosis-tools.ts';
import { toCdPage, type CdState } from '../rpc/cd-tools.ts';

const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

const diagnosis: CdDiagnosis = {
  triggers: true,
  waste: true,
  major: 22,
  causes: { event: 3, zone: 2 },
  components: [
    { name: 'Banner', refreshed: 20, unchanged: 19, strategy: 'Eager' },
    { name: 'Row', refreshed: 12, unchanged: 11, strategy: 'OnPush' },
    { name: 'Cart', refreshed: 12, unchanged: 2, strategy: 'Eager' },
    { name: 'Rare', refreshed: 3, unchanged: 3, strategy: 'Eager' },
  ],
  inputs: [{ name: 'Row', input: 'items', parent: 'List', inPlace: 4, sameContents: 0 }],
  zone: [{ name: 'Clock', ticks: 2, tasks: ['setTimeout'] }],
};

const report = (pageId: string, extra: Record<string, unknown> = {}) => ({
  pageId,
  supported: true,
  recording: true,
  startedAt: 1,
  dropped: 0,
  cycles: [
    {
      id: 1,
      at: 2,
      ms: 1,
      passes: 1,
      checks: 2,
      components: [],
      cause: {
        kind: 'event',
        event: 'click',
        target: 'button',
        component: 'Cart',
        listener: 'add',
      },
      refreshed: 2,
      unchanged: 1,
    },
  ],
  components: [{ name: 'Cart', checks: 2, ms: 1, maxMs: 1, cycles: 1 }],
  hosts: {},
  diagnosis,
  ...extra,
});

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const call = async (args: Record<string, unknown>) =>
    ((await ctx.agent.invoke('pangular:diagnose-change-detection', args)) as { markdown: string })
      .markdown;
  return { push, call, ctx };
}

describe('change detection diagnosis data', () => {
  it('keeps known cause fields and drops unknown kinds, fields and extra frames', () => {
    const clean = sanitizeCdRecording(
      report('p1', {
        cycles: [
          {
            id: 1,
            at: 1,
            ms: 1,
            passes: 1,
            checks: 0,
            components: [],
            cause: {
              kind: 'signal',
              via: 'nonsense',
              signal: 'count',
              extra: 'x',
              stack: ['a', 'b', 'c', 'd'],
              zone: 'yes',
              more: -1,
            },
            refreshed: 'x',
          },
          { id: 2, at: 1, ms: 1, passes: 1, checks: 0, components: [], cause: { kind: 'made-up' } },
        ],
      }),
      10,
    )!;
    expect(clean.cycles[0]!.cause).toEqual({
      kind: 'signal',
      signal: 'count',
      stack: ['a', 'b', 'c'],
    });
    expect(clean.cycles[0]!.refreshed).toBeUndefined();
    expect(clean.cycles[1]!.cause).toBeUndefined();
  });

  it('checks a diagnosis: known kinds, numbers, strategies and capped lists', () => {
    expect(sanitizeCdDiagnosis(null)).toBeUndefined();
    const clean = sanitizeCdDiagnosis({
      triggers: true,
      waste: 'yes',
      major: 1e9,
      causes: { event: 2, bogus: 5, zone: -1 },
      components: [{ name: 'A', refreshed: 3, unchanged: 1, strategy: 'Weird' }, { name: '' }],
      inputs: Array.from({ length: 60 }, (_, i) => ({ name: `C${i}`, input: 'x', inPlace: 1 })),
      zone: [{ name: 'Z', ticks: 1, tasks: ['a', 'b', 'c', 'd'] }],
    })!;
    expect(clean.triggers).toBe(true);
    expect(clean.waste).toBe(false);
    expect(clean.major).toBeUndefined();
    expect(clean.causes).toEqual({ event: 2 });
    expect(clean.components).toEqual([{ name: 'A', refreshed: 3, unchanged: 1 }]);
    expect(clean.inputs).toHaveLength(50);
    expect(clean.inputs![0]).toEqual({ name: 'C0', input: 'x', inPlace: 1, sameContents: 0 });
    expect(clean.zone).toEqual([{ name: 'Z', ticks: 1, tasks: ['a', 'b', 'c'] }]);
    expect(clean.zoneJs).toBeUndefined();
    expect(sanitizeCdDiagnosis({ zoneJs: false })!.zoneJs).toBe(false);
    expect(sanitizeCdDiagnosis({ zoneJs: 'no' })!.zoneJs).toBeUndefined();
  });

  it('keeps whether the page loads zone.js through an export and an import', () => {
    const recording = sanitizeCdRecording(report('p1'), 10)!;
    const withZone = { ...recording, diagnosis: { ...recording.diagnosis!, zoneJs: false } };
    const imported = parseCdImport(JSON.stringify({ recording: withZone }), 10);
    expect(imported.ok && imported.recording.diagnosis?.zoneJs).toBe(false);
  });

  it('keeps the diagnosis through an export and an import, and names the cause in a trace', () => {
    const clean = sanitizeCdRecording(report('p1'), 10)!;
    const imported = parseCdImport(JSON.stringify({ recording: clean }), 10);
    expect(imported.ok && imported.recording.diagnosis?.zone).toEqual(diagnosis.zone);
    const trace = cdTraceFile(clean, 'p1');
    const cycle = trace.traceEvents.find((e) => e.name === 'Change detection #1');
    expect(cycle?.args?.['cause']).toBe('click on button in Cart (add)');
  });

  it('describes causes in one line', () => {
    expect(
      cdCauseText({
        kind: 'event',
        event: 'click',
        target: 'button',
        component: 'Cart',
        listener: 'add',
        signal: 'count',
      }),
    ).toBe('click on button in Cart (add), wrote signal count');
    expect(cdCauseText({ kind: 'http', via: 'markForCheck', component: 'Users', more: 2 })).toBe(
      'HTTP response in Users, via markForCheck, 2 more notifications',
    );
    expect(cdCauseText({ kind: 'zone', zone: true, task: 'setTimeout' })).toBe(
      'zone.js tick with no Angular notification after setTimeout',
    );
    expect(cdCauseText({ kind: 'markForCheck', zone: true })).toBe('markForCheck, run by zone.js');
    expect(cdCauseText({ kind: 'tick', component: 'Poller' })).toBe(
      'ApplicationRef.tick() in Poller',
    );
    expect(cdCauseText({ kind: 'signal', signal: '?' })).toMatch(/wrote an unnamed signal$/);
    expect(cdCauseText({ kind: 'signal', signal: 'count' })).toMatch(/wrote signal count$/);
  });

  it('suggests OnPush by version, notes classes already OnPush, and flags inputs and zone.js', () => {
    const hints = cdHints(diagnosis);
    expect(hints.map((h) => [h.name, h.kind])).toEqual([
      ['Banner', 'on-push'],
      ['Row', 'already-on-push'],
      ['Row', 'in-place'],
      ['Clock', 'zone'],
    ]);
    expect(hints[0]!.text).toContain('default from Angular 22');
    expect(hints[0]!.text).toContain('ChangeDetectionStrategy.Eager');
    const older = cdHints({ ...diagnosis, major: 19 });
    expect(older[0]!.text).toContain('Add `changeDetection: ChangeDetectionStrategy.OnPush`');
    expect(older[1]!.text).not.toContain('Angular 22');
    expect(hints[2]!.text).toContain('Input items of Row set by List changed in place 4 times');
    expect(cdHints(undefined)).toEqual([]);
  });

  it('masks secrets the page put in causes and names', () => {
    const page = toCdPage(
      report('p1', {
        cycles: [
          {
            id: 1,
            at: 1,
            ms: 1,
            passes: 1,
            checks: 0,
            components: [],
            cause: { kind: 'signal', signal: JWT, stack: [`load (src/a.ts?token=${JWT}:1:1)`] },
          },
        ],
        diagnosis: { ...diagnosis, zone: [{ name: 'Clock', ticks: 1, tasks: [`Bearer ${JWT}`] }] },
      }),
      10,
    )!;
    const text = JSON.stringify(page);
    expect(text).not.toContain(JWT);
  });
});

describe('diagnose-change-detection tool', () => {
  it('is a read tool of the components inspector that needs a page', () => {
    expect(AGENT_INSPECTOR['diagnose-change-detection']).toBe('components');
    expect(AGENT_SAFETY['diagnose-change-detection']).toBeUndefined();
    expect(PAGE_AGENT_ENTRIES).toContain('diagnose-change-detection');
  });

  it('answers with causes, zone.js dependents, wasted checks, inputs and hints', async () => {
    const { push, call } = await boot();
    await push('push-change-detection', report('p1'));
    const text = await call({});
    expect(text).toContain('**What started the cycles**');
    expect(text).toContain('Event (`event`): 3 cycle(s)');
    expect(text).toContain('`click on button in Cart (add)`');
    expect(text).toContain('**Components that depend on zone.js**');
    expect(text).toContain('- `Clock`: 2 tick(s), after `setTimeout`');
    expect(text).toContain('- `Banner`: 19 of 20 refreshed check(s) changed nothing (95%), Eager');
    expect(text).toContain('- `Row.items` (set by `List`): 4 change(s) in place');
    expect(text).toContain('remove `changeDetection: ChangeDetectionStrategy.Eager`');
  });

  it('says what to do with no recording, an unknown page and a page without the scheduler', async () => {
    const { push, call } = await boot();
    expect(await call({})).toMatch(/^No change detection recording yet/);
    await push(
      'push-change-detection',
      report('p1', { diagnosis: { ...diagnosis, triggers: false } }),
    );
    expect(await call({ page: 'gone' })).toMatch(/^No page `gone`/);
    expect(await call({ page: 'p1' })).toContain('cycles carry no cause');
  });

  it('explains a page that cannot record and one that sent no diagnosis', () => {
    const state = (page: Record<string, unknown>): CdState =>
      ({ pages: { p1: { ...report('p1'), reportedAt: 1, ...page } } }) as unknown as CdState;
    expect(cdDiagnosisText(state({ supported: false }))).toContain('needs Angular 20 or later');
    expect(cdDiagnosisText(state({ diagnosis: undefined }))).toContain('reported no diagnosis');
    const zoneless = { ...diagnosis, zone: undefined, causes: { event: 1 }, zoneJs: false };
    expect(cdDiagnosisText(state({ diagnosis: zoneless }))).toContain(
      'does not load zone.js, so it runs zoneless',
    );
    expect(
      cdDiagnosisText(state({ supported: false }), {}, () => ({
        version: '19.2.0',
        capabilities: { profiler: false },
      })),
    ).toContain('Unsupported on this Angular version');
  });

  it('adds the cause and unchanged checks to the change-detection cycle lines', async () => {
    const { push, ctx } = await boot();
    await push('push-change-detection', report('p1'));
    const text = ((await ctx.agent.invoke('pangular:change-detection', {})) as { markdown: string })
      .markdown;
    expect(text).toContain(
      'started by `click on button in Cart (add)`, 1 of 2 refreshed check(s) changed nothing',
    );
  });
});
