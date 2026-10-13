import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import { needsDomText } from '../rpc/pages.ts';

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const sent: { method: string; args: [Record<string, unknown>] }[] = [];
  vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: (typeof sent)[number]) => {
    sent.push(options);
  }) as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const tool = async (id: string, args: Record<string, unknown>) =>
    ((await ctx.agent.invoke(`pangular:${id}`, args)) as { markdown: string }).markdown;
  return { push, tool, sent };
}

const tree = (pageId: string, platform?: string) => ({
  pageId,
  url: '/',
  title: platform ? 'Angular Native' : 'Trips',
  count: 1,
  detail: null,
  ...(platform ? { platform } : {}),
  roots: [{ id: `${pageId}-root`, name: 'App', tag: 'app-root', children: [] }],
});

describe('tools that need a DOM on a native page', () => {
  it('names the platform and the missing DOM, and nothing for a browser page', () => {
    expect(needsDomText('an1', 'angular-native', 'a screenshot')).toContain(
      'is an Angular Native app',
    );
    expect(needsDomText('ns1', 'nativescript', 'a screenshot')).toContain('is a NativeScript app');
    expect(needsDomText('web1', undefined, 'a screenshot')).toBeUndefined();
  });

  it('answers a screenshot of a native page without asking the page', async () => {
    const { push, tool, sent } = await boot();
    await push('push-component-tree', tree('an1', 'angular-native'));
    const answer = await tool('screenshot-component', { selector: 'App', page: 'an1' });
    expect(answer).toContain('is an Angular Native app');
    expect(answer).toContain('no DOM');
    expect(sent.some((s) => s.method.endsWith('component-screenshot'))).toBe(false);
  });

  it('captures from the browser page when a native app reports the same component', async () => {
    const { push, tool, sent } = await boot();
    await push('push-component-tree', tree('web1'));
    await push('push-component-tree', tree('an1', 'angular-native'));
    void tool('screenshot-component', { selector: 'App' });
    await vi.waitFor(() =>
      expect(sent.find((s) => s.method.endsWith('component-screenshot'))?.args[0]).toMatchObject({
        pageId: 'web1',
      }),
    );
  });

  it('says why when only a native app reports', async () => {
    const { push, tool } = await boot();
    await push('push-component-tree', tree('ns1', 'nativescript'));
    expect(await tool('screenshot-component', { selector: 'App' })).toContain(
      'is a NativeScript app',
    );
  });

  it('does not run axe on a native page, and the audit says why', async () => {
    const { push, tool, sent } = await boot();
    await push('push-component-tree', tree('ns1', 'nativescript'));
    const answer = await tool('audit', { page: 'ns1', axe: true });
    expect(answer).toContain('The axe pass did not run');
    expect(answer).toContain('is a NativeScript app');
    expect(sent.some((s) => s.method.endsWith('axe-run'))).toBe(false);

    const run = (await push('request-axe-run', { pageId: 'ns1' })) as {
      ok: boolean;
      error?: string;
    };
    expect(run.ok).toBe(false);
    expect(run.error).toContain('no DOM');

    const audit = (await push('get-audit', { pageId: 'ns1' })) as {
      report: { sources: { area: string; state: string; note?: string }[] };
    };
    expect(audit.report.sources.find((source) => source.area === 'accessibility')).toMatchObject({
      state: 'off',
      note: expect.stringContaining('an axe pass'),
    });
  });

  it('turns no live change detection view on for a native page, and records there', async () => {
    const { push, tool, sent } = await boot();
    await push('push-component-tree', tree('an1', 'angular-native'));
    const answer = await tool('change-detection', { page: 'an1', flash: true });
    expect(answer).toContain('the flash overlay');
    expect(answer).toContain('Recording with `record` works there.');
    expect(sent.some((s) => s.method.endsWith('change-detection-options'))).toBe(false);

    await tool('change-detection', { page: 'an1', record: 'start' });
    expect(sent.find((s) => s.method.endsWith('change-detection-record'))?.args[0]).toMatchObject({
      pageId: 'an1',
      on: true,
    });
  });

  it('still records when live views are asked for a native page in the same call', async () => {
    const { push, tool, sent } = await boot();
    await push('push-component-tree', tree('an1', 'angular-native'));
    const answer = await tool('change-detection', { page: 'an1', record: 'start', flash: true });
    expect(answer.startsWith('Page `an1` is an Angular Native app')).toBe(true);
    expect(answer).toContain('Recording started');
    expect(sent.some((s) => s.method.endsWith('change-detection-options'))).toBe(false);
    expect(sent.find((s) => s.method.endsWith('change-detection-record'))?.args[0]).toMatchObject({
      pageId: 'an1',
      on: true,
    });
  });
  it('says no page can show live views when every reporting page is native and page is omitted', async () => {
    const { push, tool, sent } = await boot();
    await push('push-component-tree', tree('an1', 'angular-native'));
    const answer = await tool('change-detection', { flash: true });
    expect(answer).toContain('Every page that reports is an Angular Native or NativeScript app');
    expect(sent.some((s) => s.method.endsWith('change-detection-options'))).toBe(false);

    await push('push-component-tree', tree('web1'));
    await tool('change-detection', { flash: true });
    expect(sent.some((s) => s.method.endsWith('change-detection-options'))).toBe(true);
  });
});
