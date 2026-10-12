import { createHostContext } from 'devframe/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pangular from '../devframe.ts';
import type { CollectedForm, FormFieldNode } from '../forms.ts';
import {
  CHANGE_DETECTION_SHAPE,
  COMPONENT_TREE_SHAPE,
  FORMS_SHAPE,
  INJECTOR_TREE_SHAPE,
  createDeltaSender,
  type DeltaShape,
} from '../push-delta.ts';

// The same reports, pushed in full to one server and as deltas to another,
// must leave both with the same shared state and the same agent answers.

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
  const call = async (tool: string, args: Record<string, unknown> = {}) =>
    ((await ctx.agent.invoke(`pangular:${tool}`, args)) as { markdown: string }).markdown;
  const state = async (key: string) =>
    (
      await (
        ctx.rpc as unknown as {
          sharedState: { get: (key: string) => Promise<{ value: () => unknown }> };
        }
      ).sharedState.get(`pangular:${key}`)
    ).value();
  return { push, call, state };
}

type Booted = Awaited<ReturnType<typeof boot>>;

/** Pushes `report` to `full` as it is and to `delta` through a sender, as the overlay would. */
function pair(shape: DeltaShape, name: string) {
  const sender = createDeltaSender(shape);
  const messages: number[] = [];
  return async (full: Booted, delta: Booted, report: Record<string, unknown>) => {
    await full.push(name, report);
    const next = sender.next(report, false);
    if (!next.changed && !next.full) return;
    const message = JSON.parse(JSON.stringify(next.message));
    messages.push(JSON.stringify(message).length);
    const answer = (await delta.push(name, message)) as { delta?: boolean } | undefined;
    expect(answer).toEqual({ delta: true });
    sender.confirm(next.seq);
  };
}

function node(id: string, name: string, children: unknown[] = []) {
  return { id, name, tag: `app-${name.toLowerCase()}`, children };
}

function leaf(key: string, value: string): FormFieldNode {
  return {
    key,
    path: key,
    type: 'control',
    status: value ? 'VALID' : 'INVALID',
    touched: !!value,
    dirty: !!value,
    bound: true,
    errors: value ? [] : [{ kind: 'required', message: 'Required' }],
    value,
  } as FormFieldNode;
}

function form(id: string, email: string): CollectedForm {
  return {
    id,
    kind: 'reactive',
    owner: 'Signup',
    property: 'form',
    label: 'Signup.form',
    submitted: false,
    root: {
      key: 'form',
      path: '',
      type: 'group',
      status: email ? 'VALID' : 'INVALID',
      touched: true,
      dirty: true,
      bound: false,
      errors: [],
      children: [leaf('email', email), leaf('name', 'Ada')],
    },
  } as CollectedForm;
}

describe('delta pushes on the server', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
  });
  afterEach(() => vi.useRealTimers());

  it('give the panel and agents the same component tree as full reports', async () => {
    const full = await boot();
    const delta = await boot();
    const send = pair(COMPONENT_TREE_SHAPE, 'push-component-tree');
    const steps = [
      [node('a', 'App', [node('b', 'Header'), node('c', 'List', [node('d', 'Item')])])],
      [
        node('a', 'App', [
          node('b', 'Header'),
          node('c', 'List', [node('d', 'Item'), node('e', 'Item')]),
        ]),
      ],
      [node('a', 'App', [node('c', 'List', [node('e', 'Item'), node('d', 'Item')])])],
      [node('a', 'App', [node('c', 'Feed', [])])],
    ];
    for (const [i, roots] of steps.entries()) {
      await send(full, delta, {
        pageId: 'p1',
        roots,
        count: 4,
        detail: null,
        url: 'http://localhost/x',
        title: `Step ${i}`,
      });
      expect(await delta.state('component-tree')).toEqual(await full.state('component-tree'));
      expect(await delta.call('list-components')).toBe(await full.call('list-components'));
    }
  });

  it('give the same injector trees, change detection and forms as full reports', async () => {
    const full = await boot();
    const delta = await boot();
    const injectors = pair(INJECTOR_TREE_SHAPE, 'push-injector-tree');
    const injector = (id: string, name: string, children: unknown[] = []) => ({
      injector: { id, type: 'element', name, providerCount: 1 },
      providers: [{ token: `${name}Service`, type: 'class', isViewProvider: false }],
      children,
    });
    for (const roots of [
      [injector('i1', 'app-root', [injector('i2', 'app-list')])],
      [injector('i1', 'app-root', [injector('i2', 'app-list'), injector('i3', 'app-item')])],
      [injector('i1', 'app-root')],
    ]) {
      await injectors(full, delta, { pageId: 'p1', roots, environment: [], zone: 'zoneless' });
      expect(await delta.state('injector-tree')).toEqual(await full.state('injector-tree'));
      expect(await delta.call('inspect-providers', { selector: 'app-root' })).toBe(
        await full.call('inspect-providers', { selector: 'app-root' }),
      );
    }

    const cd = pair(CHANGE_DETECTION_SHAPE, 'push-change-detection');
    const cycle = (id: number) => ({ id, at: id, ms: 2, passes: 1, checks: 1, components: [] });
    for (const [from, to] of [
      [1, 3],
      [1, 6],
      [3, 9],
    ] as const) {
      await cd(full, delta, {
        pageId: 'p1',
        supported: true,
        recording: true,
        startedAt: 1,
        dropped: from - 1,
        cycles: Array.from({ length: to - from }, (_, i) => cycle(from + i)),
        components: [{ name: 'Cart', checks: to, ms: 2, maxMs: 2, cycles: to }],
        hosts: { a: to, ...(to > 5 ? { b: 1 } : {}) },
      });
      expect(await delta.state('change-detection')).toEqual(await full.state('change-detection'));
      expect(await delta.call('change-detection')).toBe(await full.call('change-detection'));
    }

    const forms = pair(FORMS_SHAPE, 'push-forms');
    const event = (seq: number, detail: string) => ({
      formId: 'form-1@p1',
      path: 'email',
      type: 'value',
      detail,
      origin: 'user',
      timestamp: 1000 + seq,
      seq,
    });
    const events = [event(1, '"a"')];
    for (const email of ['', 'a', 'ab@x.dev']) {
      if (email === 'ab@x.dev') events.push(event(2, '"ab@x.dev"'));
      await forms(full, delta, {
        pageId: 'p1',
        forms: [form('form-1@p1', email)],
        events: [...events],
        setupErrors: [],
        instrumented: false,
      });
      expect(await delta.state('forms')).toEqual(await full.state('forms'));
      for (const tool of ['inspect-forms', 'form-history']) {
        expect(await delta.call(tool, { form: 'form-1@p1' })).toBe(
          await full.call(tool, { form: 'form-1@p1' }),
        );
      }
    }
  });

  it('ask for a full report after the page was forgotten', async () => {
    const server = await boot();
    const sender = createDeltaSender(COMPONENT_TREE_SHAPE);
    const report = { pageId: 'p1', roots: [node('a', 'App')], count: 1, detail: null };
    const first = sender.next(report, false);
    expect(await server.push('push-component-tree', first.message)).toEqual({ delta: true });
    sender.confirm(first.seq);
    await server.push('forget-component-page', 'p1');
    const next = sender.next({ ...report, count: 2 }, false);
    expect(next.full).toBe(false);
    expect(await server.push('push-component-tree', next.message)).toEqual({ known: false });
  });

  it('still take full reports from a page that sends no delta mark', async () => {
    const server = await boot();
    const report = { pageId: 'p1', roots: [node('a', 'App')], count: 1, detail: null };
    expect(await server.push('push-component-tree', report)).toBeUndefined();
    expect(await server.call('list-components')).toContain('App');
  });
});
