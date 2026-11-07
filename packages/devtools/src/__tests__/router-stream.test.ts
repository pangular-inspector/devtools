import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import type { NavigationRecord } from '../router.ts';
import { MAX_STREAM_ENTRIES, NavigationStream, streamText } from '../rpc/router-stream.ts';
import { MAX_TOOL_CHARS } from '../rpc/router-tools.ts';
import { answerText } from './tool-answer.ts';

function nav(id: number, extra: Partial<NavigationRecord> = {}): NavigationRecord {
  return {
    id,
    url: `/p${id}`,
    trigger: 'imperative',
    startedAt: 1000 + id,
    outcome: 'pending',
    ...extra,
  };
}

describe('NavigationStream', () => {
  it('numbers new navigations and hands a changed one out again', () => {
    const stream = new NavigationStream();
    expect(stream.record('a', [nav(1), nav(2, { probe: true })])).toBe(1);
    const cursor = stream.cursor;
    // The same report again changes nothing.
    expect(stream.record('a', [nav(1)])).toBe(0);
    stream.record('a', [nav(1, { outcome: 'redirected', redirectTo: '/login' }), nav(3)]);
    const read = stream.read(cursor);
    expect(read.entries.map((e) => [e.nav.id, e.updated])).toEqual([
      [1, true],
      [3, false],
    ]);
    expect(read.cursor).toBe(3);
    expect(stream.read(read.cursor).entries).toEqual([]);
  });

  it('keeps pages apart and filters by page', () => {
    const stream = new NavigationStream();
    stream.record('a', [nav(1)]);
    stream.record('b', [nav(1)]);
    expect(stream.read(0).entries).toHaveLength(2);
    expect(stream.read(0, 'b').entries.map((e) => e.pageId)).toEqual(['b']);
  });

  it('forgets one page or every page when cleared, and keeps the cursor', () => {
    const stream = new NavigationStream();
    stream.record('a', [nav(1)]);
    stream.record('b', [nav(1)]);
    stream.clear('a');
    expect(stream.read(0).entries.map((e) => e.pageId)).toEqual(['b']);
    expect(stream.pageIds()).toEqual(new Set(['b']));
    // A navigation the page reports again after a clear counts as new.
    expect(stream.record('a', [nav(1)])).toBe(1);
    stream.clear();
    expect(stream.read(0).entries).toEqual([]);
    expect(stream.cursor).toBe(3);
  });

  it('starts over for a cursor from before the server started', () => {
    const stream = new NavigationStream();
    stream.record('a', [nav(1)]);
    expect(stream.read(99)).toMatchObject({ reset: true, cursor: 1 });
  });

  it('caps what it keeps and says how many changes were missed', () => {
    const stream = new NavigationStream();
    stream.record(
      'a',
      Array.from({ length: MAX_STREAM_ENTRIES + 10 }, (_, i) => nav(i + 1)),
    );
    const read = stream.read(0);
    expect(read.entries).toHaveLength(MAX_STREAM_ENTRIES);
    expect(read.missed).toBe(10);
  });

  it('waits for the next navigation, or gives up after the wait', async () => {
    vi.useFakeTimers();
    try {
      const stream = new NavigationStream();
      const waiting = stream.wait(0, 5_000);
      stream.record('a', [nav(7)]);
      expect((await waiting).entries.map((e) => e.nav.id)).toEqual([7]);
      const empty = stream.wait(stream.cursor, 1_000);
      await vi.advanceTimersByTimeAsync(1_000);
      expect((await empty).entries).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('writes the next cursor into the answer', () => {
    const stream = new NavigationStream();
    stream.record('a', [nav(1, { outcome: 'failed', reason: 'Error: boom', endedAt: 1010 })]);
    const text = streamText(stream.read(0), { since: 0, waited: false });
    expect(text).toContain('- [1] page `a` #1 `/p1`: **failed** in 9ms: `Error: boom`');
    expect(text).toContain('**Next cursor: 1**');
    expect(streamText(stream.read(1), { since: 1, waited: true })).toContain(
      'No new navigation came within the wait.',
    );
  });
});

describe('streamText when the answer is too long', () => {
  it('cuts at a whole entry and hands out the cursor of the last one shown', () => {
    const stream = new NavigationStream();
    const long = (id: number) => nav(id, { url: `/p${id}/${'x'.repeat(400)}` });
    stream.record(
      'a',
      Array.from({ length: 200 }, (_, i) => long(i + 1)),
    );
    const text = streamText(stream.read(0), { since: 0, waited: false });
    expect(text.length).toBeLessThanOrEqual(MAX_TOOL_CHARS);
    expect(text).not.toContain('truncated');
    const cursor = Number(/Next cursor: (\d+)/.exec(text)?.[1]);
    expect(cursor).toBeGreaterThan(0);
    expect(cursor).toBeLessThan(200);
    expect(text).toContain(`- [${cursor}] page`);
    expect(text).not.toContain(`- [${cursor + 1}] page`);
    expect(text).toContain(`${200 - cursor} more navigation(s) did not fit`);
    // The next read goes on from the first entry left out.
    const next = streamText(stream.read(cursor), { since: cursor, waited: false });
    expect(next).toContain(`- [${cursor + 1}] page`);
  });
});

describe('pangular:follow-navigations', () => {
  it('follows navigations the pages push, from a cursor', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await pangular.setup(ctx as never);
    const push = (navigations: NavigationRecord[]) =>
      ctx.rpc.invokeLocal(
        'pangular:push-router' as never,
        ...([
          {
            pageId: 'page-s',
            snapshot: null,
            navigations,
          },
        ] as never),
      );
    const call = (args: Record<string, unknown>) =>
      answerText(ctx.agent.invoke('pangular:follow-navigations', args));

    await push([nav(1, { outcome: 'succeeded', endedAt: 1050 })]);
    const first = await call({});
    expect(first).toContain('#1 `/p1`: **succeeded**');
    const cursor = Number(/Next cursor: (\d+)/.exec(first)?.[1]);

    const waiting = call({ since: cursor, waitMs: 5_000 });
    await push([nav(1, { outcome: 'succeeded', endedAt: 1050 }), nav(2)]);
    const next = await waiting;
    expect(next).toContain('#2 `/p2`: **pending**');
    expect(next).not.toContain('#1 `/p1`');
    expect(await call({ page: 'nope' })).toMatch(/nope/);
  });

  it('drops navigations that were cleared or whose page was forgotten', async () => {
    const host = {
      mountStatic: () => {},
      resolveOrigin: () => 'http://localhost',
      getStorageDir: () => '',
    };
    const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
    await pangular.setup(ctx as never);
    const invoke = (name: string, payload: unknown) =>
      ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
    const push = (pageId: string, navigations: NavigationRecord[]) =>
      invoke('push-router', { pageId, snapshot: null, navigations });
    const call = (args: Record<string, unknown>) =>
      answerText(ctx.agent.invoke('pangular:follow-navigations', args));
    const done = { outcome: 'succeeded' as const, endedAt: 1050 };

    await push('page-c', [nav(1, done)]);
    await push('page-d', [nav(2, done)]);
    await invoke('clear-router-navigations', 'page-c');
    expect(await call({})).not.toContain('`/p1`');
    expect(await call({})).toContain('`/p2`');

    await invoke('forget-router-page', 'page-d');
    expect(await call({})).not.toContain('`/p2`');

    await push('page-c', [nav(3, done)]);
    await ctx.agent.invoke('pangular:clear-recordings', { target: 'router' });
    expect(await call({})).not.toContain('`/p3`');
  });
});
