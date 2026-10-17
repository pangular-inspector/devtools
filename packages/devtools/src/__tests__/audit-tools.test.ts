import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPangular } from '../devframe.ts';
import type { PangularConfig } from '../config.ts';
import { agentSafety, resolvePangularConfig } from '../config.ts';
import type { AxeReport } from '../axe-runner.ts';
import { AXE_TIMEOUT_MS, createAxeRequests } from '../rpc/audit-axe.ts';
import type { ErrorsReport } from '../rpc/errors-tools.ts';
import { answerText } from './tool-answer.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

async function boot(config?: PangularConfig) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  // The pipe lint scans this repository's demo app; most tests leave it out.
  await createPangular(config ?? { inspectors: { pipes: false } }).setup(ctx as never);
  const call = (name: string, payload?: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never)) as Promise<any>;
  const audit = async (args: Record<string, unknown> = {}) =>
    await answerText(ctx.agent.invoke('pangular:audit', args));
  const tool = () => ctx.agent.list().tools.find((t) => t.id === 'pangular:audit');
  return { ctx, call, audit, tool };
}

const tree = (pageId: string) => ({
  pageId,
  url: `/${pageId}`,
  count: 1,
  detail: null,
  roots: [{ id: `${pageId}-root`, name: 'App', tag: 'app-root', children: [] }],
});

const errors = (pageId: string, message = 'TypeError: trips is undefined'): ErrorsReport => ({
  pageId,
  full: true,
  url: '/trips',
  title: 'Trips',
  handler: 'wrapped',
  errors: [
    {
      id: 'e1',
      message,
      count: 2,
      firstAt: Date.now(),
      lastAt: Date.now(),
      sources: ['handler'],
      owner: { id: 'c1', name: 'TripList' },
    },
  ],
  console: [],
  dropped: { errors: 0, console: 0 },
});

const axeReport = (violations = 1): AxeReport => ({
  at: Date.now(),
  ms: 40,
  url: '/trips',
  version: '4.13.0',
  violations: Array.from({ length: violations }, (_, i) => ({
    id: i ? 'button-name' : 'image-alt',
    impact: 'critical' as const,
    help: i ? 'Buttons must have discernible text' : 'Images must have alternative text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.13/image-alt',
    tags: ['wcag2a'],
    count: 1,
    nodes: [
      {
        target: `img[data-t="${JWT}"]`,
        html: '<img class="hero">',
        elementId: 'c1-9',
        owner: { id: 'c1-3', name: 'TripPhoto' },
      },
    ],
  })),
});

type AxeMessage = { requestId: string; pageId: string };

/** Answers each axe-run broadcast the way the page would, with `report()`. */
function answerAxe(
  ctx: Awaited<ReturnType<typeof boot>>['ctx'],
  call: Awaited<ReturnType<typeof boot>>['call'],
  report: () => unknown,
  from?: string,
) {
  const sent: AxeMessage[] = [];
  vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: {
    method: string;
    args: [AxeMessage];
  }) => {
    if (!options.method.endsWith('axe-run')) return;
    const message = options.args[0];
    sent.push(message);
    setTimeout(
      () =>
        void call('axe-result', {
          requestId: message.requestId,
          pageId: from ?? message.pageId,
          result: { ok: true, report: report() },
        }),
      1,
    );
  }) as never);
  return sent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the audit agent tool', () => {
  it('says what to do when no page reports', async () => {
    const { audit } = await boot();
    expect(await audit()).toContain('No page reports live data');
  });

  it('lists the findings of the most recent page with the tool to call for each', async () => {
    const { call, audit } = await boot();
    await call('push-component-tree', tree('tab1'));
    await call('push-errors', errors('tab1', `TypeError: bad token ${JWT}`));
    const text = await audit();
    expect(text).toContain('Audit of page `tab1`');
    expect(text).toContain('| 1 | error | Errors | `TripList` |');
    expect(text).toContain('explain-error { page: "tab1", id: "e1" }');
    expect(text).toContain('Error groups 1, Error occurrences 2');
    expect(text).toContain('**Coverage**');
    expect(text).toContain('Accessibility: No axe pass yet');
    expect(text).not.toContain(JWT);
  });

  it('runs axe on the page when asked and lists its elements for the accessibility area', async () => {
    const { ctx, call, audit } = await boot();
    await call('push-component-tree', tree('tab1'));
    const sent = answerAxe(ctx, call, () => axeReport());
    const text = await audit({ axe: true, area: 'accessibility' });
    expect(sent).toEqual([expect.objectContaining({ pageId: 'tab1' })]);
    expect(text).toContain('Ran axe-core over the app');
    expect(text).toContain('`image-alt` Images must have alternative text');
    expect(text).toContain('in `TripPhoto` (instance `c1-3`)');
    expect(text).toContain('[Rule](https://dequeuniversity.com/rules/axe/4.13/image-alt)');
    expect(text).not.toContain(JWT);
    // The pass is kept for the next audit without `axe`.
    expect(await audit()).toContain('axe rules broken 1');
  });

  it('ignores an axe result sent for another page', async () => {
    const { ctx, call } = await boot();
    await call('push-component-tree', tree('tab1'));
    await call('push-component-tree', tree('tab2'));
    const requests = createAxeRequests({
      broadcast: () => {},
      answersFor: (target, pageId) => pageId === target,
      timeoutMs: 20,
    });
    const pending = requests.run('tab1');
    requests.answer({ requestId: 'a1', pageId: 'tab2', result: { ok: true, report: axeReport() } });
    expect(await pending).toMatchObject({
      ok: false,
      error: expect.stringContaining('did not answer'),
    });
    // Through the server too: an answer naming the wrong page settles nothing.
    answerAxe(ctx, call, () => axeReport(), 'tab2');
    const result = await Promise.race([
      call('request-axe-run', { pageId: 'tab1' }),
      new Promise((resolve) => setTimeout(() => resolve('waiting'), 50)),
    ]);
    expect(result).toBe('waiting');
  });

  it('compares a baseline with the audit after a change', async () => {
    const { ctx, call, audit } = await boot();
    await call('push-component-tree', tree('tab1'));
    await call('push-errors', errors('tab1'));
    let violations = 2;
    answerAxe(ctx, call, () => axeReport(violations));
    expect(await audit({ session: 'after' })).toContain('has no baseline');
    const before = await audit({ session: 'before', axe: true });
    expect(before).toContain('Saved this audit as the baseline of page `tab1`');

    // The fix: the error is gone after a reload, and one axe rule passes.
    await call('forget-errors-page', 'tab1');
    await call('push-errors', { ...errors('tab1'), errors: [] });
    violations = 1;
    const after = await audit({ session: 'after', axe: true });
    expect(after).toContain('## Before and after');
    expect(after).toMatch(/\*\*Resolved\*\* \(2\)/);
    expect(after).toContain('`TripList`: TypeError: trips is undefined');
    expect(after).toContain('| axe rules broken | 2 | 1 (-1, better) |');
    expect(after).toContain('| Error occurrences | 2 | 0 (-2, better) |');
    expect(after).toMatch(/\*\*New\*\* \(0\)/);

    expect(await audit({ session: 'clear' })).toContain('Dropped the audit session');
    expect(await audit({ session: 'clear' })).toContain('had no audit session');
  });

  it('filters by area and severity, and refuses an unknown page', async () => {
    const { call, audit } = await boot();
    await call('push-component-tree', tree('tab1'));
    await call('push-errors', errors('tab1'));
    expect(await audit({ area: 'router' })).toContain('No finding.');
    expect(await audit({ severity: 'error' })).toContain('1 match the filters');
    expect(await audit({ page: 'nope' })).toContain('No page `nope` is reporting live data');
  });

  it('is a read tool without axe in read-only mode, and an action tool otherwise', async () => {
    const full = await boot();
    expect(full.tool()?.safety).toBe('action');
    expect(Object.keys((full.tool()?.inputSchema as any).properties)).toContain('axe');

    const readOnly = await boot({ agent: { readOnly: true } });
    expect(readOnly.tool()?.safety).toBe('read');
    expect(Object.keys((readOnly.tool()?.inputSchema as any).properties)).not.toContain('axe');
    const broadcast = vi.spyOn(readOnly.ctx.rpc, 'broadcast');
    await readOnly.call('push-component-tree', tree('tab1'));
    // A read-only agent may not load axe-core into the page, so `axe` is refused, not ignored.
    expect(await readOnly.audit({ axe: true })).toMatch(
      /^The agent is read-only .*can't run axe-core/,
    );
    expect(await readOnly.audit({})).toContain('Audit of page');
    expect(
      broadcast.mock.calls.some(([options]) => String((options as any).method).endsWith('axe-run')),
    ).toBe(false);
    expect(
      agentSafety('pangular:audit', resolvePangularConfig({ agent: { readOnly: true } })),
    ).toBe('read');
  });

  it('leaves out areas whose agent tools are off, while the panel still sees them', async () => {
    const { call, audit } = await boot({
      agent: { tools: { errors: false } },
      inspectors: { pipes: false },
    });
    await call('push-component-tree', tree('tab1'));
    await call('push-errors', errors('tab1'));
    const text = await audit();
    expect(text).not.toContain('TripList');
    expect(text).toContain('Errors: its agent tools are off (`agent.tools.errors`).');
    expect(text).not.toContain('Errors: its inspector is turned off.');
    const panel = await call('get-audit', { pageId: 'tab1' });
    expect(panel.report.findings).toEqual([
      expect.objectContaining({ area: 'errors', subject: 'TripList' }),
    ]);
  });

  it('stays with every inspector off, with nothing but axe to read', async () => {
    const inspectors = Object.fromEntries(
      [
        'components',
        'injectors',
        'signals',
        'ngrx',
        'forms',
        'router',
        'pipes',
        'http',
        'analog',
        'capacitor',
        'errors',
      ].map((key) => [key, false]),
    );
    const { ctx, tool, call, audit } = await boot({ inspectors });
    expect(tool()).toBeDefined();
    expect(await call('get-audit', {})).toEqual({ pages: [], report: null });
    // A page the overlay claimed is listed, so axe still runs on it.
    const host = ctx.rpc as unknown as { getCurrentRpcSession: () => unknown };
    host.getCurrentRpcSession = () => ({ meta: { id: 1 } });
    await call('claim-page', { pageId: 'tab1', key: 'k'.repeat(32) });
    host.getCurrentRpcSession = () => undefined;
    expect((await call('get-audit', {})).pages).toEqual([
      expect.objectContaining({ pageId: 'tab1' }),
    ]);
    answerAxe(ctx, call, () => axeReport());
    expect(await audit({ axe: true })).toContain('axe rules broken 1');
  });

  it('audits a page that only the Errors inspector reports', async () => {
    const inspectors = Object.fromEntries(
      ['components', 'injectors', 'signals', 'ngrx', 'forms', 'router', 'pipes', 'http'].map(
        (key) => [key, false],
      ),
    );
    const { call, audit } = await boot({ inspectors });
    await call('push-errors', errors('tab1'));
    const text = await audit();
    expect(text).toContain('Audit of page `tab1`');
    expect(text).toContain('`TripList`');
    expect((await call('get-audit', {})).pages).toEqual([
      expect.objectContaining({ pageId: 'tab1' }),
    ]);
  });

  it('does not compare accessibility when the before and after audits reuse one axe pass', async () => {
    const { ctx, call, audit } = await boot();
    await call('push-component-tree', tree('tab1'));
    answerAxe(ctx, call, () => axeReport(2));
    await audit({ session: 'before', axe: true });
    const after = await audit({ session: 'after' });
    expect(after).toContain('Both audits used the same axe pass');
    expect(after).not.toContain('| axe rules broken |');
    expect(after).toMatch(/\*\*Still there\*\* \(0\)/);
  });

  it('drops the axe pass, not the baseline, when the page loads again', async () => {
    const { ctx, call, audit } = await boot();
    await call('push-component-tree', tree('tab1'));
    answerAxe(ctx, call, () => axeReport());
    await audit({ session: 'before', axe: true });
    expect((await call('get-audit', { pageId: 'tab1' })).axe).not.toBeNull();
    await call('claim-page', { pageId: 'tab1', key: 'k'.repeat(32) });
    const result = await call('get-audit', { pageId: 'tab1' });
    expect(result.axe).toBeNull();
    expect(result.session.before).toMatchObject({ axe: true, axeAt: expect.any(Number) });
    expect(await audit({ session: 'after' })).toContain('Only the before audit ran axe');
  });

  it('keeps the full baseline an agent took, so the panel after audit does not see hidden areas as new', async () => {
    const { call, audit } = await boot({
      agent: { tools: { errors: false } },
      inspectors: { pipes: false },
    });
    await call('push-component-tree', tree('tab1'));
    await call('push-errors', errors('tab1'));
    await audit({ session: 'before' });
    expect(await call('audit-session', { pageId: 'tab1', action: 'after' })).toEqual({ ok: true });
    const { session } = await call('get-audit', { pageId: 'tab1' });
    expect(session.before.findings).toEqual([expect.objectContaining({ area: 'errors' })]);
    expect(session.diff.added).toEqual([]);
    expect(session.diff.remaining).toEqual([expect.objectContaining({ area: 'errors' })]);
    // The agent's comparison still leaves the hidden area out.
    const after = await audit({ session: 'after' });
    expect(after).not.toContain('TripList');
    expect(after).not.toContain('Error occurrences');
  });

  it('keeps component owners out of the axe answer when the agent cannot see components', async () => {
    const { ctx, call, audit } = await boot({
      agent: { tools: { components: false } },
      inspectors: { pipes: false },
    });
    await call('push-component-tree', tree('tab1'));
    answerAxe(ctx, call, () => axeReport(2));
    await audit({ session: 'before', axe: true });
    const text = await audit({ area: 'accessibility', axe: true, session: 'after' });
    expect(text).toContain('`image-alt` Images must have alternative text');
    expect(text).not.toContain('TripPhoto');
    expect(text).not.toContain('c1-3');
    expect(text).not.toContain('inspect-component');
    const panel = await call('get-audit', { pageId: 'tab1' });
    expect(panel.report.findings).toContainEqual(
      expect.objectContaining({ area: 'accessibility', subject: 'TripPhoto' }),
    );
  });

  it('refuses to drop or replace the baseline in read-only mode', async () => {
    const { call, audit } = await boot({ agent: { readOnly: true }, inspectors: { pipes: false } });
    await call('push-component-tree', tree('tab1'));
    await call('push-errors', errors('tab1'));
    expect(await audit({ session: 'before' })).toContain('Saved this audit as the baseline');
    const taken = (await call('get-audit', { pageId: 'tab1' })).session.before.at;
    expect(await audit({ session: 'before' })).toContain("can't replace the audit session");
    expect(await audit({ session: 'clear' })).toContain("can't drop the audit session");
    expect((await call('get-audit', { pageId: 'tab1' })).session.before.at).toBe(taken);
    expect(await audit({ session: 'after' })).toContain('## Before and after');
  });

  it('stops waiting for axe before the client gives up on the call', () => {
    // devframe's client times an RPC call out after 60 s.
    expect(AXE_TIMEOUT_MS).toBeLessThan(60_000);
  });
});

describe('the audit RPC functions for the panel', () => {
  it('return the audit, take a baseline and an after audit, and report the diff', async () => {
    const { ctx, call } = await boot();
    await call('push-component-tree', tree('tab1'));
    await call('push-errors', errors('tab1'));
    answerAxe(ctx, call, () => axeReport());
    expect(await call('audit-session', { pageId: 'tab1', action: 'after' })).toMatchObject({
      ok: false,
    });
    expect(await call('request-axe-run', { pageId: 'tab1' })).toEqual({ ok: true, violations: 1 });
    expect(await call('audit-session', { pageId: 'tab1', action: 'before' })).toEqual({ ok: true });
    await call('push-errors', { ...errors('tab1'), errors: [] });
    await call('forget-errors-page', 'tab1');
    expect(await call('audit-session', { pageId: 'tab1', action: 'after' })).toEqual({ ok: true });
    const result = await call('get-audit', { pageId: 'tab1' });
    expect(result.pages).toEqual([expect.objectContaining({ pageId: 'tab1', url: '/tab1' })]);
    expect(result.report.findings.map((f: { area: string }) => f.area)).toEqual(['accessibility']);
    expect(result.session.diff.resolved).toEqual([expect.objectContaining({ area: 'errors' })]);
    expect(result.axe.violations).toHaveLength(1);
    const shared = await (
      ctx.rpc as unknown as {
        sharedState: { get: (key: string) => Promise<{ value: () => any }> };
      }
    ).sharedState.get('pangular:audit');
    // Times only: a count would tell other clients what hidden areas hold.
    expect(shared.value().pages['tab1']).toEqual({
      before: expect.any(Number),
      after: expect.any(Number),
      axe: expect.any(Number),
    });
    expect(await call('audit-session', { pageId: 'tab1', action: 'nope' })).toMatchObject({
      ok: false,
    });
  });
});
