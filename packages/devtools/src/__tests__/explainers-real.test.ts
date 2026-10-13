// @vitest-environment jsdom
import '@angular/compiler';
import { Component, ErrorHandler, Injectable, Injector } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { elementById } from '../element-id.ts';
import { createRecentWrites } from '../error-explain.ts';
import { attachErrors, type ErrorsDebugNg } from '../errors-collector.ts';
import { collectInjectorTree, type DebugNg } from '../injector-tree.ts';
import { explainInjection, type InjectionExplanation } from '../rpc/injection-explain.ts';
import type { ErrorsReport } from '../rpc/errors-tools.ts';
import type { InjectorPage, InjectorTreeNode } from '../types.ts';
import { angularAtLeast, bootstrapRoot, STANDALONE, type BootedApp } from './angular-version.ts';

/** `ChangeDetectionStrategy.Default` (`Eager` from 22.0): checked again after each tick, so NG0100 fires. */
const EAGER = 1;

class Headline {
  label = 'Trips';
  ngAfterViewInit(): void {
    this.label = 'Trips (3)';
  }
}
Component({
  ...STANDALONE,
  selector: 'app-headline',
  template: '<h1 [title]="label">Hello</h1>',
  changeDetection: EAGER,
})(Headline);

class Missing {}
Injectable()(Missing);
class CardState {}
Injectable()(CardState);
class Hint {}
Injectable()(Hint);

class TripCard {
  constructor(readonly injector: Injector) {}
  open(): void {
    this.injector.get(Missing);
  }
}
(TripCard as unknown as { ctorParameters: () => unknown[] }).ctorParameters = () => [
  { type: Injector },
];
Component({
  ...STANDALONE,
  selector: 'app-trip-card',
  template: '<button type="button" (click)="open()">Open</button>',
  providers: [CardState],
})(TripCard);

class TripPage {}
Component({
  ...STANDALONE,
  selector: 'app-root',
  imports: [TripCard, Headline],
  template: '<app-headline></app-headline><app-trip-card></app-trip-card>',
  viewProviders: [Hint],
  // An OnPush parent that is not dirty skips its children in the second check.
  changeDetection: EAGER,
})(TripPage);

const flatten = (nodes: InjectorTreeNode[]): InjectorTreeNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

function harness() {
  const reports: ErrorsReport[] = [];
  const my = {
    rpc: {
      call: async (name: string, report: unknown) => {
        if (name === 'push-errors') reports.push(report as ErrorsReport);
        return { known: true };
      },
    },
  };
  const ng = () => (globalThis as { ng?: ErrorsDebugNg }).ng;
  const writes = createRecentWrites();
  writes.listening();
  return { reports, collector: attachErrors(my, 'real-page', ng, { writes }) };
}

describe('the explainers with a real app', () => {
  let app: BootedApp | null = null;
  let stop = () => {};
  afterEach(() => {
    stop();
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  async function boot() {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = '<app-root></app-root>';
    const { reports, collector } = harness();
    stop = collector.stop;
    app = await bootstrapRoot(TripPage, { declarations: [TripCard, Headline] });
    for (let i = 0; i < 2; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      try {
        app.appRef.tick();
      } catch (error) {
        // A direct tick throws; the app's scheduler hands the error to the ErrorHandler.
        app.injector.get(ErrorHandler).handleError(error);
      }
    }
    return { reports, collector };
  }

  it("explains Angular's own NG0100 with the binding, both values and the field that holds the new one", async () => {
    const { reports, collector } = await boot();
    await collector.push();
    const group = reports
      .flatMap((report) => report.errors)
      .find((error) => /ExpressionChanged/.test(error.message));
    expect(group).toBeDefined();
    expect(group!.owner?.name).toBe('Headline');
    expect(group!.explain).toMatchObject({
      kind: 'expression-changed',
      previous: 'Trips',
      current: 'Trips (3)',
      members: ['label'],
      writesKnown: true,
    });
    if (angularAtLeast('12.0')) {
      expect(group!.explain).toMatchObject({ binding: 'title' });
    }
  });

  it("explains a real missing provider and walks the real injector tree's lookup for it", async () => {
    const { reports, collector } = await boot();
    document.querySelector('button')!.click();
    await collector.push();
    const group = reports
      .flatMap((report) => report.errors)
      .find((error) => error.explain?.kind === 'missing-provider');
    expect(group?.explain).toMatchObject({ kind: 'missing-provider', token: 'Missing' });
    expect(group?.owner?.name).toBe('TripCard');
    expect(elementById(group!.owner!.id)).toBe(document.querySelector('app-trip-card'));

    const ng = (globalThis as { ng?: DebugNg }).ng!;
    const tree = collectInjectorTree(ng);
    const page: InjectorPage = { pageId: 'real-page', reportedAt: 1, ...tree };
    const nodes = flatten(tree.roots);
    const card = nodes.find((n) => n.injector.component === 'TripCard')!;
    const root = nodes.find((n) => n.injector.component === 'TripPage')!;
    // TripCard is declared in TripPage's template, so a `host` lookup stops at TripPage.
    expect(card.injector.host).toBe(root.injector.id);
    expect(root.injector.host).toBeUndefined();

    const reduced = !angularAtLeast('16.2');
    const missing = explainInjection(
      page,
      { selector: group!.owner!.id, token: 'Missing' },
      reduced,
    ) as InjectionExplanation;
    expect(missing.outcome).toBe(reduced ? 'unknown' : 'error');
    expect(missing.steps.at(-1)?.type).toBe('null');
    if (reduced) return;
    expect(missing.approximate).toBeUndefined();

    const own = explainInjection(page, {
      selector: 'TripCard',
      token: 'CardState',
    }) as InjectionExplanation;
    expect(own.resolvedBy).toBe(card.injector.id);
    // TripPage's viewProviders reach TripCard, which sits in TripPage's view.
    const hint = explainInjection(page, {
      selector: 'TripCard',
      token: 'Hint',
      host: true,
    }) as InjectionExplanation;
    expect(hint.resolvedBy).toBe(root.injector.id);
  });
});
