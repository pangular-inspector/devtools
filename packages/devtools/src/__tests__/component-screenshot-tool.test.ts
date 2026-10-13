import { createHostContext } from 'devframe/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PangularConfig } from '../config.ts';
import pangular, { createPangular } from '../devframe.ts';
import { initPangularHub } from '../hub.ts';
import {
  createComponentScreenshots,
  toScreenshotResult,
  withMcpContent,
} from '../rpc/component-screenshots.ts';
import { UNTRUSTED } from '../rpc/forms-tools.ts';
import { makeProject } from './analog-fixture.ts';

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function boot(config?: PangularConfig) {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await (config ? createPangular(config) : pangular).setup(ctx as never);
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  const call = (args: Record<string, unknown>) =>
    ctx.agent.invoke('pangular:screenshot-component', args) as Promise<{
      markdown: string;
      mcpContent?: unknown[];
    }>;
  return { ctx, push, call };
}

const tree = (pageId: string) => ({
  pageId,
  url: `/${pageId}`,
  count: 2,
  detail: null,
  roots: [
    {
      id: `${pageId}-root`,
      name: 'App',
      tag: 'app-root',
      children: [{ id: `${pageId}-card`, name: 'TripCard', tag: 'trip-card', children: [] }],
    },
  ],
});

type Sent = { requestId: string; pageId: string; id?: string; selector?: string };

/** Answers every component-screenshot broadcast the way the page would. */
function answerCaptures(
  ctx: Awaited<ReturnType<typeof boot>>['ctx'],
  push: Awaited<ReturnType<typeof boot>>['push'],
  result: (message: Sent) => unknown,
) {
  const sent: Sent[] = [];
  vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: {
    method: string;
    args: [Sent];
  }) => {
    if (!options.method.endsWith('component-screenshot')) return;
    const message = options.args[0];
    sent.push(message);
    setTimeout(
      () =>
        void push('component-screenshot-result', {
          requestId: message.requestId,
          pageId: message.pageId,
          result: result(message),
        }),
      5,
    );
  }) as never);
  return sent;
}

const ok = {
  ok: true,
  mimeType: 'image/png',
  data: PNG,
  width: 640,
  height: 360,
  cssWidth: 320,
  cssHeight: 180,
  masked: 2,
  maskedText: 1,
  notes: ['1 image(s) could not be read.'],
};

afterEach(() => vi.restoreAllMocks());

describe('screenshot-component', () => {
  it('is a read tool of the components inspector that agent.readOnly keeps', async () => {
    const tools = async (config: PangularConfig) => (await boot(config)).ctx.agent.list().tools;
    const found = (await tools({ agent: { readOnly: true } })).find(
      (t) => t.id === 'pangular:screenshot-component',
    );
    expect(found?.safety).toBe('read');
    expect(
      (await tools({ inspectors: { components: false } })).some(
        (t) => t.id === 'pangular:screenshot-component',
      ),
    ).toBe(false);
  });

  it('asks the page of the instance for an image and returns it as an MCP image block', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    const sent = answerCaptures(ctx, push, () => ok);
    const answer = await call({ selector: 'TripCard' });
    expect(sent).toEqual([{ requestId: expect.any(String), pageId: 'p1', id: 'p1-card' }]);
    expect(answer.markdown.startsWith(UNTRUSTED)).toBe(true);
    expect(answer.markdown).toContain(
      'Screenshot of `TripCard` (`<trip-card>`, instance `p1-card`) on page `p1`: 320×180 CSS pixels, drawn at 640×360 as image/png',
    );
    expect(answer.markdown).toContain(
      '2 field(s) or marked element(s) masked; tokens masked in 1 text node(s).',
    );
    expect(answer.markdown).toContain('- 1 image(s) could not be read.');
    expect(answer.mcpContent).toEqual([
      { type: 'text', text: answer.markdown },
      { type: 'image', data: PNG, mimeType: 'image/png' },
    ]);
    // Serialized results (the panel RPC, an adapter without image support) carry no base64.
    expect(JSON.stringify(answer)).not.toContain(PNG);
  });

  it('sends a CSS selector to the newest page when no instance matches', async () => {
    const { ctx, push, call } = await boot();
    await push('push-component-tree', tree('p1'));
    const sent = answerCaptures(ctx, push, () => ({
      ok: false,
      error: 'No element on the page matches the selector.',
    }));
    const answer = await call({ selector: '.hero img' });
    expect(sent[0]).toMatchObject({ pageId: 'p1', selector: '.hero img' });
    expect(answer.markdown).toContain(
      'Could not capture the first element matching `.hero img` on page `p1`. No element on the page matches the selector.',
    );
    expect(answer.mcpContent).toBeUndefined();
  });

  it('answers without asking a page when none reports or the page is unknown', async () => {
    const { ctx, push, call } = await boot();
    const sent = answerCaptures(ctx, push, () => ok);
    expect((await call({ selector: 'App' })).markdown).toMatch(/^No page reports a component tree/);
    await push('push-component-tree', tree('p1'));
    expect((await call({ selector: 'App', page: 'p9' })).markdown).toMatch(/No page `p9`/);
    expect((await call({ selector: ' ' })).markdown).toMatch(/^Pass `selector`/);
    expect(sent).toEqual([]);
  });

  it('only takes a result from the page the request went to, and times out', async () => {
    vi.useFakeTimers();
    const sent: { requestId: string }[] = [];
    const screenshots = createComponentScreenshots({
      pages: () => [{ ...tree('p1'), reportedAt: 1 }],
      broadcast: (_method, message) => void sent.push(message as { requestId: string }),
      answersFor: (target, pageId) => pageId === target,
      timeoutMs: 1000,
    });
    const pending = screenshots.request('p1', { id: 'p1-card' });
    screenshots.answer({ requestId: sent[0]!.requestId, pageId: 'p2', result: ok });
    expect(screenshots.pendingCount()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(await pending).toEqual({
      ok: false,
      error: expect.stringContaining('did not answer within 1s'),
    });
    expect(screenshots.pendingCount()).toBe(0);
    vi.useRealTimers();
  });
});

describe('toScreenshotResult', () => {
  it('accepts only PNG or JPEG base64 under the cap, and masks the notes', () => {
    expect(toScreenshotResult({ ...ok, mimeType: 'image/svg+xml' })).toEqual({
      ok: false,
      error: expect.stringContaining('other than PNG or JPEG'),
    });
    expect(toScreenshotResult({ ...ok, data: '<svg/>' })).toMatchObject({ ok: false });
    expect(toScreenshotResult({ ...ok, data: 'A'.repeat(6_000_004) })).toMatchObject({ ok: false });
    expect(toScreenshotResult({ ...ok, notes: ['Bearer abc.def.ghi', 3] })).toMatchObject({
      ok: true,
      notes: ['Bearer [redacted]'],
    });
    expect(toScreenshotResult({ ok: false, error: 'x'.repeat(900) })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/^x{499}/),
    });
  });
});

describe('MCP image content', () => {
  it('sends the mcpContent blocks of a tool result as MCP content', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const hub = initPangularHub({
      cwd: makeProject({ 'package.json': '{}' }),
      ws: false,
      auth: false,
      allowedOrigins: false,
    });
    try {
      await hub.ready;
      const ctx = await hub.context;
      ctx.agent.registerTool({
        id: 'test:image',
        description: 'An image.',
        safety: 'read',
        handler: () =>
          withMcpContent({ markdown: 'A pixel.' }, [
            { type: 'text', text: 'A pixel.' },
            { type: 'image', data: PNG, mimeType: 'image/png' },
          ]),
      });
      const send = async (method: string, params: object) => {
        const response = await hub.handler(
          new Request('http://localhost/__devframes/__mcp', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              accept: 'application/json, text/event-stream',
              origin: 'http://localhost:4000',
            },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
          }),
        );
        const text = await response.text();
        return JSON.parse(text.startsWith('{') ? text : (/^data: (.*)$/m.exec(text)?.[1] ?? '{}'));
      };
      await send('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '0' },
      });
      const result = await send('tools/call', { name: 'test_image', arguments: {} });
      expect(result.result.content).toEqual([
        { type: 'text', text: 'A pixel.' },
        { type: 'image', data: PNG, mimeType: 'image/png' },
      ]);
    } finally {
      await hub.close();
      delete (globalThis as { __PANGULAR_HUB__?: unknown }).__PANGULAR_HUB__;
    }
  });
});
