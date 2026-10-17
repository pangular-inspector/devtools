// @vitest-environment jsdom
import '@angular/compiler';
import {
  Component,
  Injectable,
  effect,
  inject,
  provideZonelessChangeDetection,
  signal,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { elementById } from '../element-id.ts';
import { serializeNamed } from '../serialize.ts';
import { collectSignalGraph, graphValue, type SignalDebugNg } from '../signal-graph.ts';
import { createSignalHistory, installSignalWriteHook } from '../signal-history.ts';
import { restoreSignalEntry } from '../signal-restore.ts';
import type { SignalGraph } from '../types.ts';
import { angularAtLeast, STANDALONE } from './angular-version.ts';

class Store {
  readonly loading = signal(false, { debugName: 'loading' });
}
Injectable({ providedIn: 'root' })(Store);

/** A field and a service signal that look the same: same name, version and value. */
class Page {
  readonly store = inject(Store);
  /** Read only in a method, so the template's graph never holds it. */
  readonly loading = signal(false, { debugName: 'loading' });
  readonly title = signal('Draft', { debugName: 'title' });
  /** Read only by an effect of the component. */
  readonly saved = signal(0, { debugName: 'saved' });
  seen = 0;

  constructor() {
    effect(() => {
      this.seen = this.saved();
    });
  }

  busy(): boolean {
    return this.loading();
  }
}

Component({
  ...STANDALONE,
  selector: 'app-root',
  template: `{{ store.loading() }} {{ title() }}`,
})(Page);

const settle = async (app: ApplicationRef) => {
  for (let i = 0; i < 4; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    app.tick();
  }
};

describe.skipIf(!angularAtLeast('20.1.0'))('locating writable fields in a real app', () => {
  let app: ApplicationRef | null = null;
  let unhook: (() => void) | null = null;
  let page: Page;
  let ng: SignalDebugNg;
  let history: ReturnType<typeof createSignalHistory>;

  const snapshot = (): SignalGraph => {
    const graph = collectSignalGraph(ng)!;
    history.collect(graph.nodes);
    return graph;
  };

  beforeEach(async () => {
    document.body.innerHTML = '<app-root></app-root>';
    history = createSignalHistory(
      (value, name) => serializeNamed(name, value, { budget: 1000 }),
      Date.now,
      (value, name) => graphValue(name, value),
      { restorable: true },
    );
    unhook = await installSignalWriteHook(history.onWrite);
    app = await bootstrapApplication(Page, { providers: [provideZonelessChangeDetection()] });
    await settle(app);
    ng = (globalThis as { ng?: SignalDebugNg }).ng!;
    page = ng.getComponent!(document.querySelector('app-root')!) as Page;
  });

  afterEach(() => {
    app?.destroy();
    app = null;
    unhook?.();
    unhook = null;
  });

  it('gives no locator to a service signal that looks like a field the template never reads', async () => {
    const graph = snapshot();
    const loading = graph.nodes.filter((n) => n.label === 'loading');
    expect(loading).toHaveLength(1);
    expect(loading[0].locator).toBeUndefined();
    const id = graph.component!.id;
    expect(graph.nodes.find((n) => n.label === 'title')!.locator).toEqual({ id, key: 'title' });
    expect(graph.nodes.find((n) => n.label === 'saved')!.locator).toEqual({ id, key: 'saved' });

    const result = restoreSignalEntry(
      ng,
      { component: id, node: loading[0].id, epoch: 0 },
      history,
      (target) => elementById(target),
    );
    expect(result).toEqual({ error: expect.stringContaining('not a writable field') });
    expect(page.busy()).toBe(false);
    expect(page.store.loading()).toBe(false);
  });

  it('drops a binding once the field is no longer the node in the graph', async () => {
    const first = snapshot();
    const title = first.nodes.find((n) => n.label === 'title')!;
    expect(title.locator?.key).toBe('title');

    // The field now holds a signal the template does not read.
    (page as unknown as { title: unknown }).title = signal('Draft', { debugName: 'title' });
    const graph = snapshot();
    expect(graph.nodes.find((n) => n.id === title.id)!.locator).toBeUndefined();
    const result = restoreSignalEntry(
      ng,
      { component: graph.component!.id, node: title.id, epoch: 0 },
      history,
      (target) => elementById(target),
    );
    expect(result).toEqual({ error: expect.stringContaining('not a writable field') });
  });
});
