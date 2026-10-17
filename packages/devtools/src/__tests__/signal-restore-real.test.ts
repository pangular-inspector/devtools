// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  computed,
  linkedSignal,
  model,
  provideZonelessChangeDetection,
  signal,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { elementById } from '../element-id.ts';
import { REDACTED, serializeNamed } from '../serialize.ts';
import { collectSignalGraph, graphValue, type SignalDebugNg } from '../signal-graph.ts';
import { createSignalHistory, installSignalWriteHook } from '../signal-history.ts';
import { registerSignalRestore, restoreSignalEntry } from '../signal-restore.ts';
import type { SignalGraph, SignalGraphNode } from '../types.ts';
import { angularAtLeast, STANDALONE } from './angular-version.ts';

/** Far past the history's serialization limits (40 items, 500 characters of text). */
const BIG = {
  items: Array.from({ length: 120 }, (_, i) => ({ id: i, text: 'x'.repeat(800) })),
};

class Editor {
  readonly title = signal('Draft', { debugName: 'title' });
  readonly count = signal(1);
  readonly doc = signal<unknown>(BIG, { debugName: 'doc' });
  readonly login = signal({ user: 'ada', password: 'hunter2' }, { debugName: 'login' });
  readonly tags = signal(['a'], { debugName: 'tags' });
  readonly shout = computed(() => this.title().toUpperCase(), { debugName: 'shout' });
  readonly picked = linkedSignal(() => this.title(), { debugName: 'picked' });
  readonly open = model(false, { debugName: 'open' });
}

Component({
  ...STANDALONE,
  selector: 'app-root',
  template: `{{ title() }} {{ count() }} {{ doc() ? 1 : 0 }} {{ login().user }} {{ tags().length }}
    {{ shout() }} {{ picked() }} {{ open() }}`,
})(Editor);

const settle = async (app: ApplicationRef) => {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    app.tick();
  }
};

describe.skipIf(!angularAtLeast('20.1.0'))('restoring signal history with a real app', () => {
  let app: ApplicationRef | null = null;
  let unhook: (() => void) | null = null;
  let editor: Editor;
  let ng: SignalDebugNg;
  let history: ReturnType<typeof createSignalHistory>;

  /** One collect cycle, the way the overlay pushes a graph. */
  const snapshot = (): SignalGraph => {
    const graph = collectSignalGraph(ng)!;
    history.collect(graph.nodes);
    return graph;
  };
  const nodeOf = (graph: SignalGraph, label: string | undefined, kind = 'signal') =>
    graph.nodes.find((n) => n.label === label && n.kind === kind)!;
  const restore = (graph: SignalGraph, node: SignalGraphNode, epoch: number) =>
    restoreSignalEntry(
      ng,
      { component: graph.component!.id, node: node.id, epoch },
      history,
      (id) => elementById(id),
    );

  beforeEach(async () => {
    document.body.innerHTML = '<app-root></app-root>';
    history = createSignalHistory(
      (value, name) => serializeNamed(name, value, { budget: 1000 }),
      Date.now,
      (value, name) => graphValue(name, value),
      { restorable: true },
    );
    unhook = await installSignalWriteHook(history.onWrite);
    app = await bootstrapApplication(Editor, { providers: [provideZonelessChangeDetection()] });
    await settle(app);
    ng = (globalThis as { ng?: SignalDebugNg }).ng!;
    editor = ng.getComponent!(document.querySelector('app-root')!) as Editor;
  });

  afterEach(() => {
    app?.destroy();
    app = null;
    unhook?.();
    unhook = null;
  });

  it('gives own writable signals a locator, found by identity when unnamed', () => {
    // Angular reports model() nodes as kind `signal`.
    const graph = snapshot();
    const id = graph.component!.id;
    expect(nodeOf(graph, 'title').locator).toEqual({ id, key: 'title' });
    expect(nodeOf(graph, 'doc').locator).toEqual({ id, key: 'doc' });
    expect(nodeOf(graph, 'picked', 'linkedSignal').locator).toEqual({ id, key: 'picked' });
    const open = nodeOf(graph, 'open');
    expect(open.locator).toEqual({ id, key: 'open' });
    expect(open.value).toBe(false);
    expect(nodeOf(graph, undefined).locator).toEqual({ id, key: 'count' });
    expect(nodeOf(graph, 'shout', 'computed').locator).toBeUndefined();
  });

  it('restores a set entry with the exact value', async () => {
    snapshot();
    editor.title.set('One');
    await settle(app!);
    snapshot();
    editor.title.set('Two');
    await settle(app!);
    const graph = snapshot();
    const title = nodeOf(graph, 'title');
    const entries = history.collect(graph.nodes)[title.id];
    const one = entries.find((c) => c.value === 'One')!;
    expect(one.source).toBe('write');

    const result = restore(graph, title, one.epoch);
    expect(result).toMatchObject({ ok: true, component: 'Editor', key: 'title', value: 'One' });
    expect(editor.title()).toBe('One');
  });

  it('restores a value larger than the history shows, as the same object', async () => {
    const first = snapshot();
    const doc = nodeOf(first, 'doc');
    editor.doc.set({ small: true });
    await settle(app!);
    const graph = snapshot();
    const initial = history.collect(graph.nodes)[doc.id][0];
    expect(JSON.stringify(initial.value)).not.toBe(JSON.stringify(BIG));

    expect(restore(graph, doc, initial.epoch)).toMatchObject({ ok: true, key: 'doc' });
    expect(editor.doc()).toBe(BIG);
  });

  it('restores a value whose secret field the history masks, and answers it masked', async () => {
    const first = snapshot();
    const login = nodeOf(first, 'login');
    editor.login.set({ user: 'bob', password: 'other' });
    await settle(app!);
    const graph = snapshot();
    const initial = history.collect(graph.nodes)[login.id][0];
    expect(initial.value).toMatchObject({ user: 'ada', password: REDACTED });

    const result = restore(graph, login, initial.epoch);
    expect(result).toMatchObject({ ok: true, value: { user: 'ada', password: REDACTED } });
    expect(editor.login()).toEqual({ user: 'ada', password: 'hunter2' });
  });

  it('restores sampled entries of an unnamed signal and of a model', async () => {
    const first = snapshot();
    const count = nodeOf(first, undefined);
    const open = nodeOf(first, 'open');
    editor.count.set(5);
    editor.open.set(true);
    await settle(app!);
    const graph = snapshot();
    const lists = history.collect(graph.nodes);
    expect(lists[count.id].map((c) => c.value)).toEqual([1, 5]);
    expect(lists[open.id].map((c) => c.value)).toEqual([false, true]);

    expect(restore(graph, count, lists[count.id][0].epoch)).toMatchObject({ ok: true });
    expect(restore(graph, open, lists[open.id][0].epoch)).toMatchObject({ ok: true });
    expect(editor.count()).toBe(1);
    expect(editor.open()).toBe(false);
  });

  it('refuses a value changed in place, an entry no longer kept and a computed', async () => {
    const first = snapshot();
    const tags = nodeOf(first, 'tags');
    const original = editor.tags();
    editor.tags.set(['b']);
    await settle(app!);
    const graph = snapshot();
    original.push('mutated');
    const initial = history.collect(graph.nodes)[tags.id][0];

    expect(restore(graph, tags, initial.epoch)).toEqual({
      error: expect.stringContaining('was changed in place'),
    });
    expect(editor.tags()).toEqual(['b']);
    expect(restore(graph, tags, 999)).toEqual({
      error: expect.stringContaining('no longer in the page'),
    });
    expect(restore(graph, nodeOf(graph, 'shout', 'computed'), 0)).toEqual({
      error: expect.stringContaining('not a writable field'),
    });
    expect(
      restoreSignalEntry(ng, { component: 'gone', node: tags.id, epoch: 0 }, history, () => null),
    ).toEqual({ error: expect.stringContaining('no longer on the page') });
  });

  it('answers the server on its page only, and refuses when component writes are off', async () => {
    const graph = snapshot();
    const title = nodeOf(graph, 'title');
    const handlers: Record<string, (message: unknown) => void> = {};
    const call = vi.fn(async () => undefined);
    const rpc = {
      call,
      register: (d: { name: string; handler: (message: never) => unknown }) => {
        handlers[d.name] = d.handler as (message: unknown) => void;
      },
    };
    const restored = vi.fn();
    registerSignalRestore(rpc, 'p1', {
      getNg: () => ng,
      history,
      allowed: false,
      restored,
    });
    const request = { component: graph.component!.id, node: title.id, epoch: title.epoch };
    handlers['signal-restore']({ requestId: 'r1', pageId: 'p2', request });
    expect(call).not.toHaveBeenCalled();
    handlers['signal-restore']({ requestId: 'r1', pageId: 'p1', request });
    expect(call).toHaveBeenCalledWith('signal-restore-result', {
      requestId: 'r1',
      pageId: 'p1',
      result: { error: expect.stringContaining('actions.components') },
    });
    expect(restored).not.toHaveBeenCalled();
  });
});
