import { Component, effect, inject, input, untracked } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { AnalogData } from './analog-data';
import { AnalogRuntime } from './analog-runtime';
import { AnalogCallsState } from './analog/analog-calls-state';
import { AnalogContent } from './analog/analog-content';
import { AnalogLint } from './analog/analog-lint';
import type { AnalogRoute, ApiRoute } from './analog/analog-model';
import { AnalogPageState } from './analog/analog-page-state';
import { AnalogRender } from './analog/analog-render';
import { AnalogRoutes } from './analog/analog-routes';
import { AnalogServer } from './analog/analog-server';

/**
 * The Analog page: the project summary, the view tabs, and one view per tab. The Routes, Server,
 * Render, Content and Lint views live in `./analog/` and share the page's {@link AnalogPageState}
 * and {@link AnalogCallsState}; the page keeps the members its tests and the shell read on itself.
 */
@Component({
  selector: 'app-analog-inspector',
  imports: [
    AnalogContent,
    AnalogData,
    AnalogLint,
    AnalogRender,
    AnalogRoutes,
    AnalogRuntime,
    AnalogServer,
  ],
  providers: [AnalogPageState, AnalogCallsState],
  templateUrl: './analog-inspector.html',
  styleUrl: './analog-inspector.scss',
})
export class AnalogInspector {
  rpc = input<DevframeRpcClient | null>(null);

  private readonly pageState = inject(AnalogPageState);
  private readonly callsState = inject(AnalogCallsState);

  readonly view = this.pageState.view;
  readonly project = this.pageState.project;
  readonly loadFailed = this.pageState.loadFailed;
  readonly state = this.pageState.state;
  readonly findings = this.pageState.findings;
  readonly filter = this.pageState.filter;
  readonly page = this.pageState.page;
  readonly serverFns = this.pageState.serverFns;
  readonly tabCalls = this.pageState.tabCalls;
  readonly pageCount = this.pageState.pageCount;
  readonly lintCount = this.pageState.lintCount;
  readonly lintTone = this.pageState.lintTone;
  readonly views = this.pageState.views;

  readonly kind = this.callsState.kind;
  readonly callQuery = this.callsState.callQuery;
  readonly failedOnly = this.callsState.failedOnly;
  readonly tryTarget = this.callsState.tryTarget;
  readonly duplicates = this.callsState.duplicates;

  constructor() {
    this.pageState.connect(this.rpc);
    effect(() => {
      const client = this.rpc();
      if (client) untracked(() => void this.pageState.load(client));
    });
    effect(() => {
      const view = this.view();
      this.state();
      untracked(() => this.pageState.scheduleRefresh(view));
    });
  }

  retry() {
    this.pageState.retry();
  }

  isOpen(route: AnalogRoute): boolean {
    return this.pageState.isOpen(route);
  }

  openText(route: AnalogRoute): string {
    return this.pageState.openText(route);
  }

  tryApi(api: ApiRoute) {
    this.callsState.tryApi(api);
  }

  onKey(event: KeyboardEvent) {
    const order = this.views().map((v) => v.id);
    const index = order.indexOf(this.view());
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % order.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + order.length) % order.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = order.length - 1;
    else return;
    event.preventDefault();
    this.view.set(order[next]);
    const host = event.currentTarget as HTMLElement;
    queueMicrotask(() => host.querySelector<HTMLElement>(`#analog-tab-${order[next]}`)?.focus());
  }
}
