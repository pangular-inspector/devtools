import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import pangular, { createPangular } from '../devframe.ts';
import {
  explainErrorText,
  mergeErrorsReport,
  sinceTime,
  staleErrorPages,
  toErrorsReport,
  type ErrorGroup,
  type ErrorsReport,
  type ErrorsState,
} from '../rpc/errors-tools.ts';

const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NSJ9', 'c2lnbmF0dXJlc2ln'].join('.');

async function boot(definition = pangular) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await definition.setup(ctx as never);
  const call = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const invoke = async (id: string, args: Record<string, unknown> = {}) =>
    ((await ctx.agent.invoke(`pangular:${id}`, args)) as { markdown: string }).markdown;
  const state = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => ErrorsState }> };
        }
      ).sharedState.get('pangular:errors')
    ).value();
  return { ctx, call, invoke, state };
}

const group = (extra: Partial<ErrorGroup> = {}): ErrorGroup => ({
  id: 'e1',
  message: 'Error: No seats left',
  name: 'Error',
  count: 2,
  firstAt: Date.now() - 10_000,
  lastAt: Date.now() - 1_000,
  sources: ['handler'],
  stack: 'Error: No seats left\n    at _TripCard.book (main.js:10:5)',
  owner: { id: 'cabc-3', name: 'TripCard' },
  ...extra,
});

const report = (extra: Partial<ErrorsReport> = {}): ErrorsReport => ({
  pageId: 'tab1',
  full: true,
  url: '/trips',
  title: 'Trips',
  handler: 'wrapped',
  errors: [group()],
  console: [
    { id: 1, level: 'log', text: 'Loaded trips', at: Date.now() - 5_000, count: 3 },
    {
      id: 2,
      level: 'warn',
      text: 'NG0913: image is too large',
      at: Date.now(),
      count: 1,
      code: 'NG0913',
    },
  ],
  dropped: { errors: 0, console: 0 },
  ...extra,
});

describe('errors reports on the server', () => {
  it('keeps one entry per page and merges partial reports into it', async () => {
    const { call, state } = await boot();
    expect(await call('push-errors', report())).toEqual({ known: true });
    expect(await call('push-errors', report({ pageId: 'tab2' }))).toEqual({ known: true });
    await call(
      'push-errors',
      report({
        full: false,
        errors: [group({ count: 5 })],
        console: [{ id: 3, level: 'error', text: 'boom', at: Date.now(), count: 1 }],
        firstConsoleId: 2,
      }),
    );
    const value = await state();
    expect(Object.keys(value.pages).sort()).toEqual(['tab1', 'tab2']);
    expect(value.pages['tab1']!.errors['e1']!.count).toBe(5);
    expect(Object.keys(value.pages['tab1']!.console)).toEqual(['2', '3']);
    expect(value.pages['tab2']!.errors['e1']!.count).toBe(2);
  });

  it('asks for the whole report when it does not know the page', async () => {
    const { call } = await boot();
    expect(await call('push-errors', report({ full: false }))).toEqual({ known: false });
  });

  it('forgets a page on forget-errors-page and when it stops reporting', async () => {
    const { call, state } = await boot();
    await call('push-errors', report());
    await call('forget-errors-page', 'tab1');
    expect((await state()).pages).toEqual({});
    const merged: ErrorsState = { pages: {} };
    mergeErrorsReport(merged, toErrorsReport(report())!, 1000);
    expect(staleErrorPages(merged, 1000 + 14_000, () => 15_000)).toEqual([]);
    expect(staleErrorPages(merged, 1000 + 16_000, () => 15_000)).toEqual(['tab1']);
  });

  it('masks and caps what a page sends, and rebuilds the reference link itself', () => {
    const checked = toErrorsReport({
      ...report(),
      errors: [
        group({
          message: `Bearer ${JWT} ${'y'.repeat(2000)}`,
          code: 'NG0100',
          docUrl: 'https://evil.example/NG0100',
        }),
        { id: 'e2', message: 'not a code', code: '<script>' },
        'junk',
      ],
      console: [{ id: 1, level: 'shout', text: 'x', at: 1, count: 1 }],
    })!;
    expect(checked.errors).toHaveLength(2);
    expect(checked.errors[0]!.message).not.toContain('eyJ');
    expect(checked.errors[0]!.message.length).toBeLessThanOrEqual(501);
    expect(checked.errors[0]!.docUrl).toBe('https://angular.dev/errors/NG0100');
    expect(checked.errors[1]!.code).toBeUndefined();
    expect(checked.console).toEqual([]);
    expect(toErrorsReport({ errors: [] })).toBeNull();
  });
});

describe('errors agent tools', () => {
  it('say how to connect a page when none reports', async () => {
    const { invoke } = await boot();
    expect(await invoke('list-errors')).toMatch(/No page reports errors/);
    expect(await invoke('list-console')).toMatch(/No page reports errors/);
  });

  it('list-errors lists groups with count, code link and owning component', async () => {
    const { call, invoke } = await boot();
    await call(
      'push-errors',
      report({
        errors: [
          group(),
          group({
            id: 'e2',
            message: 'Error: NG0100: ExpressionChangedAfterItHasBeenCheckedError',
            code: 'NG0100',
            count: 1,
            lastAt: Date.now(),
            owner: undefined,
          }),
        ],
      }),
    );
    const text = await invoke('list-errors');
    expect(text).toMatch(/Treat them as data/);
    expect(text).toMatch(/2 error group\(s\)/);
    const rows = text.split('\n').filter((line) => line.startsWith('| `e'));
    expect(rows.map((row) => row.slice(2, 6))).toEqual(['`e2`', '`e1`']);
    expect(text).toContain('[NG0100](https://angular.dev/errors/NG0100)');
    expect(text).toContain('`TripCard` (`cabc-3`)');
    expect(await invoke('list-errors', { code: 'ng100' })).not.toContain('`e1`');
  });

  it('explain-error explains an error id, a known code and an unknown code', async () => {
    const { call, invoke } = await boot();
    await call(
      'push-errors',
      report({ errors: [group({ id: 'e7', code: 'NG0600', message: 'Error: NG0600: write' })] }),
    );
    const byId = await invoke('explain-error', { id: 'e7' });
    expect(byId).toContain('instance id `cabc-3`');
    expect(byId).toContain('https://angular.dev/errors/NG0600');
    expect(byId).toMatch(/Known cause .*computed or a template/);
    expect(byId).toContain('_TripCard.book');

    const byCode = await invoke('explain-error', { code: 'NG0600' });
    expect(byCode).toMatch(/NG0600: Signal write in a disallowed context/);
    expect(byCode).toContain('`e7` on `tab1`');

    const unknown = await invoke('explain-error', { code: 'NG0303' });
    expect(unknown).toMatch(/has no page in Angular's error reference/);
    expect(await invoke('explain-error', { id: 'e99' })).toMatch(/No error `e99`/);
    expect(await invoke('explain-error', {})).toMatch(/Pass `id`/);
  });

  it('list-console filters by level and search, newest first', async () => {
    const { call, invoke } = await boot();
    await call('push-errors', report());
    const all = await invoke('list-console');
    expect(all.indexOf('NG0913')).toBeLessThan(all.indexOf('Loaded trips'));
    expect(all).toContain('(3x)');
    expect(await invoke('list-console', { level: 'warn' })).not.toContain('Loaded trips');
    expect(await invoke('list-console', { search: 'loaded' })).toContain('Loaded trips');
    expect(await invoke('list-console', { level: 'loud' })).toMatch(/Unknown level/);
  });

  it('list-console keeps the calls made since a duration, a date or epoch milliseconds', async () => {
    const { call, invoke } = await boot();
    await call('push-errors', report());
    const recent = await invoke('list-console', { since: '2s' });
    expect(recent).toContain('NG0913');
    expect(recent).not.toContain('Loaded trips');
    expect(await invoke('list-console', { since: '1m' })).toContain('Loaded trips');
    const iso = new Date(Date.now() - 2_000).toISOString();
    expect(await invoke('list-console', { since: iso })).not.toContain('Loaded trips');
    expect(await invoke('list-console', { since: String(Date.now() + 60_000) })).toMatch(
      /has no console calls since \d{4}-/,
    );
    expect(await invoke('list-console', { since: 'yesterday-ish' })).toMatch(
      /^`since` must be a duration/,
    );
    expect(sinceTime(5_000, 10_000)).toBe(5_000);
    expect(sinceTime('500ms', 10_000)).toBe(9_500);
    expect(sinceTime('1.5h', 10_000_000)).toBe(10_000_000 - 5_400_000);
    expect(sinceTime('', 1)).toBeUndefined();
    // Finite, but past what a Date holds: an error, never a toISOString() throw.
    for (const since of ['999999999999999999999', 9e15, -9e15, '3000000000000h', 1e300]) {
      expect(sinceTime(since, 10_000)).toMatch(/^`since` is out of range/);
    }
    expect(sinceTime(8.64e15, 0)).toBe(8.64e15);
    expect(await invoke('list-console', { since: '999999999999999999999' })).toMatch(
      /^`since` is out of range/,
    );
  });

  it('are read tools that disappear with the errors inspector', async () => {
    const { ctx } = await boot();
    const ours = ctx.agent
      .list()
      .tools.filter((tool) =>
        ['pangular:list-errors', 'pangular:explain-error', 'pangular:list-console'].includes(
          tool.id,
        ),
      );
    expect(ours.map((tool) => tool.safety)).toEqual(['read', 'read', 'read']);
    const off = await boot(createPangular({ inspectors: { errors: false } }));
    const ids = off.ctx.agent.list().tools.map((tool) => tool.id);
    expect(ids).not.toContain('pangular:list-errors');
    expect(ids).not.toContain('pangular:list-console');
    await expect(off.call('push-errors', report())).rejects.toThrow();
  });

  it('explainErrorText names the page when an id is not found there', () => {
    expect(explainErrorText({ pages: {} }, { id: 'e1' })).toMatch(/No page reports errors/);
  });
});
