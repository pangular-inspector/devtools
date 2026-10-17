import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import { signalGraphText } from '../rpc/signal-tools.ts';
import {
  signalWatchRequest,
  watchSignalRequests,
  watchSignalText,
} from '../rpc/signal-watch-tools.ts';
import { graphKey } from '../signal-graph.ts';
import {
  MAX_WATCHED,
  WATCH_EVENT,
  createSignalWatch,
  registerSignalWatch,
  toWatchRequest,
} from '../signal-watch.ts';
import type { SignalGraph } from '../types.ts';
import { answerText } from './tool-answer.ts';

const graph = (pageId?: string): SignalGraph & { pageId?: string } => ({
  ...(pageId ? { pageId } : {}),
  nodes: [
    { id: '1', kind: 'template', label: 'app-root', epoch: 1 },
    { id: '2', kind: 'signal', label: 'count', epoch: 3, value: 3 },
    { id: '3', kind: 'computed', label: 'reactiveHref', epoch: 1, framework: true },
  ],
  edges: [
    { consumer: 0, producer: 1 },
    { consumer: 0, producer: 2 },
  ],
  component: { id: 'c1', name: 'App', tag: 'app-root', path: 'app-root' },
  componentSelector: 'app-root',
});

describe('toWatchRequest', () => {
  it('keeps well formed fields and ignores requests for other pages', () => {
    expect(toWatchRequest({ pageId: 'p1', id: '2', watch: true }, 'p1')).toEqual({
      id: '2',
      watch: true,
    });
    expect(toWatchRequest({ pageId: 'p2', id: '2', watch: true }, 'p1')).toBeUndefined();
    expect(toWatchRequest({ stacks: true, clear: true }, 'p1')).toEqual({
      stacks: true,
      clear: true,
    });
    expect(toWatchRequest({ id: 'x'.repeat(51), watch: true }, 'p1')).toBeUndefined();
    expect(toWatchRequest('stacks', 'p1')).toBeUndefined();
  });
});

describe('createSignalWatch', () => {
  it('reports nothing until a signal is watched or stacks are on', () => {
    const watch = createSignalWatch(() => {});
    expect(watch.report()).toBeUndefined();
    expect(watch.attach(graph())).not.toHaveProperty('watch');
    expect(watch.apply({ stacks: true })).toBe(true);
    expect(watch.stacks()).toBe(true);
    expect(watch.apply({ stacks: true })).toBe(false);
    expect(watch.apply({ id: '2', watch: true })).toBe(true);
    expect(watch.attach(graph())?.watch).toEqual({ ids: ['2'], stacks: true });
    watch.apply({ id: '2', watch: false });
    watch.apply({ stacks: false });
    expect(watch.report()).toBeUndefined();
  });

  it('drops the oldest watch past the cap', () => {
    const watch = createSignalWatch(() => {});
    for (let i = 0; i <= MAX_WATCHED; i++) watch.apply({ id: `n${i}`, watch: true });
    const ids = watch.report()!.ids;
    expect(ids).toHaveLength(MAX_WATCHED);
    expect(ids[0]).toBe('n1');
  });

  it('logs only the changes of watched signals, with their stack', () => {
    const log = vi.fn();
    const watch = createSignalWatch(log);
    watch.apply({ id: '2', watch: true });
    watch.onChange('9', 'other', { epoch: 1, value: 1, at: 1, source: 'write' });
    watch.onChange(undefined, 'count', { epoch: 1, value: 1, at: 1, source: 'write' });
    watch.onChange('2', 'count', {
      epoch: 4,
      value: 4,
      at: 1,
      source: 'write',
      stack: ['Counter.increment (main.js:4:2)'],
    });
    watch.onChange('2', 'count', { epoch: 6, value: 6, at: 1, source: 'sample' });
    expect(log.mock.calls).toEqual([
      ['[pangular] Signal count set to', 4, '\n  at Counter.increment (main.js:4:2)'],
      ['[pangular] Signal count changed to (sampled)', 6],
    ]);
  });

  it('changes the graph key when the watch changes, so the page pushes again', () => {
    const watch = createSignalWatch(() => {});
    const before = graphKey(watch.attach(graph())!);
    watch.apply({ id: '2', watch: true });
    expect(graphKey(watch.attach(graph())!)).not.toBe(before);
  });

  it('asks for a push only when a request for this page changed something', () => {
    const handlers: ((request: unknown) => void)[] = [];
    const rpc = { register: (fn: { handler: (r: unknown) => void }) => handlers.push(fn.handler) };
    const changed = vi.fn();
    const watch = createSignalWatch(() => {});
    registerSignalWatch(rpc as never, 'p1', watch, changed);
    handlers[0]!({ pageId: 'p2', id: '2', watch: true });
    handlers[0]!({ pageId: 'p1', id: '2', watch: true });
    handlers[0]!({ pageId: 'p1', id: '2', watch: true });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(WATCH_EVENT).toBe('signal-watch');
  });
});

describe('server side', () => {
  const pages = new Map([
    ['old', { graph: graph('old'), reportedAt: 1 }],
    ['new', { graph: graph('new'), reportedAt: 2 }],
  ]);

  it('sends a request without a page to the most recent page', () => {
    expect(signalWatchRequest({ id: '2' }, pages)).toEqual({ id: '2', watch: true, pageId: 'new' });
    expect(signalWatchRequest({ pageId: 'old', stacks: false }, pages)).toEqual({
      stacks: false,
      pageId: 'old',
    });
    expect(signalWatchRequest({ pageId: 'old' }, pages)).toBeUndefined();
    expect(signalWatchRequest({ id: '2' }, new Map())).toBeUndefined();
  });

  it('resolves a label to node ids for the agent tool', () => {
    const asked = watchSignalRequests({ node: 'count', stacks: true }, pages, undefined);
    expect(asked).toEqual({
      pageId: 'new',
      requests: [{ id: '2', watch: true }, { stacks: true }],
      labels: ['count'],
    });
    expect(watchSignalRequests({ node: 'nope' }, pages, undefined)).toMatchObject({
      markdown: expect.stringContaining('No signal node `nope`'),
    });
    expect(watchSignalRequests({}, pages, undefined)).toMatchObject({
      markdown: expect.stringContaining('Pass `node`'),
    });
    expect(watchSignalRequests({ node: '2' }, pages, 'gone')).toMatchObject({
      markdown: expect.stringContaining('No page `gone`'),
    });
    expect(watchSignalRequests({ node: '2' }, new Map(), undefined)).toMatchObject({
      markdown: expect.stringContaining('No page reports a signal graph'),
    });
  });

  it('says what it turned on', () => {
    expect(watchSignalText({ node: 'count', stacks: true }, 'p1', ['count'])).toContain(
      'Watching `count` on page `p1`',
    );
    expect(watchSignalText({ stacks: false }, 'p1', [])).toBe(
      'Write stacks are off for page `p1`.',
    );
  });

  it('leaves out framework nodes for inspect-signals with framework: false', () => {
    const text = JSON.parse(signalGraphText(graph(), { framework: false })) as SignalGraph & {
      frameworkNodesLeftOut?: number;
    };
    expect(text.nodes.map((n) => n.label)).toEqual(['app-root', 'count']);
    expect(text.frameworkNodesLeftOut).toBe(1);
  });
});

describe('watch-signal tool and set-signal-watch', () => {
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
    const call = async (tool: string, args: Record<string, unknown>) =>
      await answerText(ctx.agent.invoke(`pangular:${tool}`, args));
    return { ctx, push, call };
  }

  it('broadcasts a watch for the page and reports what the page then watches', async () => {
    const { ctx, push, call } = await boot();
    await push('push-signal-graph', graph('p1'));
    const broadcast = vi.spyOn(ctx.rpc, 'broadcast');
    const text = await call('watch-signal', { node: 'count', stacks: true });
    expect(text).toContain('Watching `count`');
    const sent = broadcast.mock.calls
      .map(([options]) => options as { method: string; args: unknown[] })
      .filter((options) => options.method === 'pangular:signal-watch')
      .map((options) => options.args[0]);
    expect(sent).toEqual([
      { id: '2', watch: true, pageId: 'p1' },
      { stacks: true, pageId: 'p1' },
    ]);

    await push('push-signal-graph', { ...graph('p1'), watch: { ids: ['2'], stacks: true } });
    const graphText = await call('inspect-signals', { selector: 'app-root' });
    expect(graphText).toContain('"stacks": true');
  });

  it('answers the panel with the page it sent to', async () => {
    const { push } = await boot();
    await push('push-signal-graph', graph('p1'));
    expect(await push('set-signal-watch', { stacks: true })).toEqual({ pages: 1, pageId: 'p1' });
    expect(await push('set-signal-watch', { pageId: 'p1' })).toEqual({ pages: 0 });
  });
});
