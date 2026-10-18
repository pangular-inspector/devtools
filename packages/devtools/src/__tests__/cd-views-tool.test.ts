import { createHostContext } from 'devframe/node';
import { describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import { RPC_INSPECTOR } from '../config.ts';
import { answerText } from './tool-answer.ts';

async function boot() {
  const host = {
    mountStatic: () => {},
    resolveOrigin: () => 'http://localhost',
    getStorageDir: () => '',
  };
  const ctx = await createHostContext({ cwd: process.cwd(), mode: 'dev', host: host as never });
  await pangular.setup(ctx as never);
  const sent: { method: string; args: [Record<string, unknown>] }[] = [];
  const push = (name: string, payload: unknown) =>
    ctx.rpc.invokeLocal(`pangular:${name}` as never, ...([payload] as never));
  vi.spyOn(ctx.rpc, 'broadcast').mockImplementation((async (options: (typeof sent)[number]) => {
    sent.push(options);
    // A page that reports confirms a record request by pushing its recording.
    const { pageId, on } = options.args[0] as { pageId?: string; on?: boolean };
    if (options.method === 'pangular:change-detection-record' && typeof on === 'boolean') {
      setTimeout(
        () => void push('push-change-detection', { ...report(pageId ?? 'p1'), recording: on }),
        5,
      );
    }
  }) as never);
  // Recording and the live views are record-change-detection; reading is change-detection.
  const writes = ['record', 'flash', 'track', 'angularProfiling'];
  const call = async (args: Record<string, unknown>) =>
    await answerText(
      ctx.agent.invoke(
        Object.keys(args).some((key) => writes.includes(key))
          ? 'pangular:record-change-detection'
          : 'pangular:change-detection',
        args,
      ),
    );
  const options = () => sent.filter((s) => s.method === 'pangular:change-detection-options');
  return { push, call, sent, options };
}

const report = (pageId: string, options?: Record<string, unknown>) => ({
  pageId,
  supported: true,
  recording: false,
  startedAt: null,
  dropped: 0,
  cycles: [],
  components: [],
  hosts: {},
  ...(options ? { options } : {}),
});

describe('change detection views', () => {
  it('belongs to the components inspector', () => {
    expect(RPC_INSPECTOR['request-change-detection-options']).toBe('components');
  });

  it('sends the panel request to the page with only the known fields', async () => {
    const { push, options } = await boot();
    await push('request-change-detection-options', {
      pageId: 'p1',
      flash: true,
      track: 'x',
      angularProfiling: false,
      other: 1,
    });
    expect(options()).toEqual([
      {
        method: 'pangular:change-detection-options',
        args: [{ pageId: 'p1', flash: true }],
        optional: true,
      },
    ]);
  });

  it('turns the flash overlay and the track on from the agent tool', async () => {
    const { push, call, options } = await boot();
    await push('push-change-detection', report('p1'));
    expect(await call({ page: 'gone', flash: true })).toMatch(/^No page `gone`/);
    expect(options()).toEqual([]);
    const text = await call({ page: 'p1', flash: true, track: true });
    expect(text).toContain('Flash overlay turned on for page `p1`');
    expect(text).toContain('"Pangular" track');
    expect(options().at(-1)!.args[0]).toEqual({ pageId: 'p1', flash: true, track: true });
  });

  it('says Angular profiling stays on, and refuses to turn it off', async () => {
    const { call, options } = await boot();
    expect(await call({ angularProfiling: true })).toContain('stays on until the page reloads');
    expect(options().at(-1)!.args[0]).toEqual({ pageId: undefined, angularProfiling: true });
    const sent = options().length;
    // `angularProfiling` only takes true, so false is refused before anything is sent.
    const off = await call({ angularProfiling: false });
    expect(off).toContain('cannot be turned off');
    expect(options()).toHaveLength(sent);
  });

  it('combines views with record', async () => {
    const { call, sent, push } = await boot();
    await push('push-change-detection', report('p1'));
    sent.length = 0;
    const text = await call({ record: 'start', flash: true });
    expect(text).toMatch(/^Recording started on page `p1`/);
    expect(text).toContain('Flash overlay turned on');
    expect(
      sent.map((s) => s.method).filter((method) => method.includes('change-detection')),
    ).toEqual(['pangular:change-detection-options', 'pangular:change-detection-record']);
  });

  it('keeps the views a page reports and lists them in the answer', async () => {
    const { push, call } = await boot();
    await push(
      'push-change-detection',
      report('p1', {
        flash: true,
        track: false,
        angularProfiling: true,
        angularProfilingAvailable: true,
        extra: 'dropped',
      }),
    );
    const text = await call({ page: 'p1' });
    expect(text).toContain(
      'Live views: flash overlay on, Performance panel track off, Angular profiling on until the page reloads.',
    );
    await push('push-change-detection', report('p2'));
    expect(await call({ page: 'p2' })).not.toContain('Live views');
  });
});
