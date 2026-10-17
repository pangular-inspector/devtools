import { createHostContext } from 'devframe/node';
import { describe, expect, it } from 'vitest';
import type { PangularConfig } from '../config.ts';
import { createPangular } from '../devframe.ts';
import { MAX_SSR_OVERRIDES, type SsrOverride } from '../ssr-overrides.ts';
import { ssrRegistry } from '../ssr-registry.ts';
import {
  removeSsrOverride,
  ssrOverridesText,
  transferStateText,
  upsertSsrOverride,
} from '../rpc/ssr-override-tools.ts';
import type { HttpPage, HttpState } from '../types.ts';
import { answerText } from './tool-answer.ts';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlLXZhbHVl';

async function boot(config: PangularConfig = {}) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await createPangular(config).setup(ctx as never);
  const tools = ctx.agent.list().tools;
  const tool = async (name: string, args: Record<string, unknown> = {}) =>
    await answerText(ctx.agent.invoke(`pangular:${name}`, args));
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never)) as Promise<unknown>;
  const state = async () =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => unknown }> };
        }
      ).sharedState.get('pangular:http')
    ).value() as HttpState;
  return { tools, tool, push, state };
}

const NAMES = [
  'inspect-transfer-state',
  'list-ssr-overrides',
  'set-ssr-override',
  'remove-ssr-override',
];

describe('SSR override agent tools', () => {
  it('registers the writes as action tools and the reads as read tools', async () => {
    const { tools } = await boot();
    const safety = (name: string) => tools.find((t) => t.id === `pangular:${name}`)?.safety;
    expect(safety('inspect-transfer-state')).toBe('read');
    expect(safety('list-ssr-overrides')).toBe('read');
    expect(safety('set-ssr-override')).toBe('action');
    expect(safety('remove-ssr-override')).toBe('action');
  });

  it('drops the writes under agent.readOnly and actions.http, and all four with the http inspector off', async () => {
    const ids = async (config: PangularConfig) =>
      (await boot(config)).tools.map((t) => t.id.replace('pangular:', ''));
    const readOnly = await ids({ agent: { readOnly: true } });
    expect(readOnly).toContain('list-ssr-overrides');
    expect(readOnly).toContain('inspect-transfer-state');
    expect(readOnly).not.toContain('set-ssr-override');
    expect(readOnly).not.toContain('remove-ssr-override');
    const blocked = await ids({ actions: { http: false } });
    expect(blocked).not.toContain('set-ssr-override');
    expect(blocked).toContain('list-ssr-overrides');
    const off = await ids({ inspectors: { http: false } });
    for (const name of NAMES) expect(off).not.toContain(name);
  });

  it('adds, updates and removes overrides through the list the panel and the SSR middleware use', async () => {
    const { tool, state } = await boot();
    expect(await tool('list-ssr-overrides')).toMatch(/^No SSR overrides\. Add one with/);

    const added = await tool('set-ssr-override', {
      kind: 'state-edit',
      pattern: ' /destinations* ',
      key: 'trips',
      value: [{ id: 1 }],
    });
    expect(added).toMatch(
      /^Added TransferState edit override `o[a-z0-9]+` for `\/destinations\*`\. Reload/,
    );
    const [saved] = ssrRegistry().overrides!;
    expect(saved).toMatchObject({
      kind: 'state-edit',
      pattern: '/destinations*',
      key: 'trips',
      value: '[{"id":1}]',
      enabled: true,
    });
    expect((await state()).ssrOverrides).toEqual([saved]);

    const updated = await tool('set-ssr-override', {
      id: saved!.id,
      kind: 'render-error',
      pattern: '^/checkout',
      message: 'Payment service down',
      enabled: false,
    });
    expect(updated).toMatch(/^Updated render error override/);
    expect(ssrRegistry().overrides).toEqual([
      {
        id: saved!.id,
        kind: 'render-error',
        pattern: '^/checkout',
        message: 'Payment service down',
        enabled: false,
      },
    ]);
    expect(await tool('list-ssr-overrides')).toMatch(
      /\| `o[a-z0-9]+` \| off \| Render error \| `\^\/checkout` \| throws `Payment service down` \|/,
    );

    expect(await tool('remove-ssr-override', { id: saved!.id })).toMatch(/^Removed render error/);
    expect(ssrRegistry().overrides).toEqual([]);
    expect((await state()).ssrOverrides).toEqual([]);
  });

  it('refuses the inputs the panel form refuses, and changes nothing', async () => {
    const { tool } = await boot();
    expect(await tool('set-ssr-override', { kind: 'nope', pattern: '/a' })).toMatch(
      /`kind` must be/,
    );
    expect(await tool('set-ssr-override', { kind: 'client-render', pattern: ' ' })).toMatch(
      /`pattern` is required/,
    );
    expect(await tool('set-ssr-override', { kind: 'state-edit', pattern: '/a' })).toMatch(
      /`key` is required/,
    );
    expect(
      await tool('set-ssr-override', { kind: 'state-edit', pattern: '/a', key: 'k', value: '{' }),
    ).toMatch(/`value` must be valid JSON/);
    expect(
      await tool('set-ssr-override', {
        kind: 'state-edit',
        pattern: '/a',
        key: 'token=[redacted]',
      }),
    ).toMatch(/masked part/);
    expect(
      await tool('set-ssr-override', { kind: 'client-render', pattern: '/a', message: 'x' }),
    ).toMatch(/only applies to `render-error`/);
    expect(await tool('remove-ssr-override', { id: 'o404' })).toMatch(/^No override `o404`/);
    expect(ssrRegistry().overrides).toEqual([]);
  });

  it('removes an entry when a state edit has no value', () => {
    const change = upsertSsrOverride(
      [],
      { kind: 'state-edit', pattern: '/a', key: 'flags' },
      () => 'o1',
    );
    expect(change).toEqual({
      overrides: [{ id: 'o1', kind: 'state-edit', pattern: '/a', key: 'flags', enabled: true }],
      override: { id: 'o1', kind: 'state-edit', pattern: '/a', key: 'flags', enabled: true },
    });
    expect(ssrOverridesText((change as { overrides: SsrOverride[] }).overrides, true)).toContain(
      'removes `flags`',
    );
  });

  it('stops at the cap the panel keeps', () => {
    const full = Array.from({ length: MAX_SSR_OVERRIDES }, (_, i) => ({
      id: `o${i}`,
      kind: 'client-render' as const,
      pattern: `/p${i}`,
      enabled: true,
    }));
    expect(upsertSsrOverride(full, { kind: 'client-render', pattern: '/x' }, () => 'n')).toEqual({
      error: `There are already ${MAX_SSR_OVERRIDES} overrides. Remove one with \`remove-ssr-override\`.`,
    });
    expect(removeSsrOverride(full, undefined)).toMatchObject({ error: /`id` is required/ });
  });

  it('masks tokens in patterns, messages and values', () => {
    const text = ssrOverridesText(
      [
        {
          id: 'o1',
          kind: 'render-error',
          pattern: `/a?token=${JWT}`,
          message: `Bearer ${JWT}`,
          enabled: true,
        },
        {
          id: 'o2',
          kind: 'state-edit',
          pattern: '/b',
          key: 'session',
          value: JSON.stringify({ password: 'hunter22', jwt: JWT }),
          enabled: true,
        },
      ],
      true,
    );
    expect(text).not.toContain(JWT);
    expect(text).not.toContain('hunter22');
    expect(text).toContain('[redacted]');
  });

  it('says that no override applies when actions.http is off', async () => {
    const { tool } = await boot({ actions: { http: false } });
    expect(await tool('list-ssr-overrides')).toMatch(/turned off in the devtools config/);
  });
});

describe('inspect-transfer-state', () => {
  const payload = {
    found: true,
    size: 420,
    entries: [
      {
        key: '123456',
        size: 80,
        source: 'http',
        http: { url: '/api/trips', status: 200 },
        value: [{ id: 1, apiKey: 'sk-live-123', note: `Bearer ${JWT}` }],
      },
      { key: 'theme', size: 9, value: 'dark' },
      { key: '__nghData__', size: 300, source: 'hydration', value: [{}] },
    ],
  };

  it('lists the keys of the newest page and reads one masked value', async () => {
    const { tool, push } = await boot();
    await push('push-http', {
      pageId: 'p1',
      url: '/trips',
      initialUrl: '/trips',
      title: 'Trips',
      hydration: null,
      calls: [],
      payload,
    });
    const list = await tool('inspect-transfer-state');
    expect(list).toContain(
      'TransferState of page `p1` (served for `/trips`): 3 entries, 420 bytes.',
    );
    expect(list).toMatch(/\| `123456` \| HTTP transfer cache \| 80 \| 200 `\/api\/trips` \|/);
    expect(list).toMatch(/\| `theme` \| app state \| 9 \| `"dark"` \|/);
    expect(list).toContain('| `__nghData__` | hydration data |');

    const one = await tool('inspect-transfer-state', { key: '123456' });
    expect(one).toContain('- Kind: HTTP transfer cache');
    expect(one).toContain('kind: "state-edit"');
    expect(one).not.toContain('sk-live-123');
    expect(one).not.toContain(JWT);

    expect(await tool('inspect-transfer-state', { search: 'THEME' })).not.toContain('123456');
    expect(await tool('inspect-transfer-state', { key: 'nope' })).toContain(
      'No entry with key `nope`',
    );
    expect(await tool('inspect-transfer-state', { page: 'other' })).toContain(
      'No page `other` is reporting a TransferState payload',
    );
  });

  it('says when no page reports, or the page was not server rendered', () => {
    expect(transferStateText(new Map(), [])).toMatch(/^No page reports a TransferState payload/);
    const page = { pageId: 'p2', url: '/', initialUrl: '/', reportedAt: 1 } as HttpPage;
    expect(
      transferStateText(new Map([['p2', { found: false, size: 0, entries: [] }]]), [page]),
    ).toContain('No TransferState script on page `p2`');
  });
});
