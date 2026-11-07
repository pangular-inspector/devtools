import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import type { NavigationRecord } from '../router.ts';
import { MAX_STREAM_ENTRIES, NavigationStream, streamText } from '../rpc/router-stream.ts';
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
});
