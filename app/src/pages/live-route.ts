import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { hostPageId } from '../page-id';
import { RouteCurrent } from './route-current';
import { RouteLint } from './route-lint';
import { RouteSetup } from './route-setup';
import { RouteTimeline } from './route-timeline';
import { RouteTree } from './route-tree';
import type { RouterPage, SourceRoute } from './router-types';
import { Select } from '../ui/select';

const TABS = [
  { id: 'current', label: 'Current' },
  { id: 'navigations', label: 'Navigations' },
  { id: 'routes', label: 'Routes' },
  { id: 'setup', label: 'Setup' },
  { id: 'lint', label: 'Lint' },
] as const;

type TabId = (typeof TABS)[number]['id'];

@Component({
  selector: 'app-live-route',
  imports: [RouteCurrent, RouteLint, RouteSetup, RouteTimeline, RouteTree, Select],
  template: `
    <div class="section-head">
      <h2>Live router</h2>
      @if (page(); as current) {
        @if (pages().length > 1) {
          <div class="page-pick">
            <span class="page-label" id="live-route-page-label">Page</span>
            <app-select
              labelledBy="live-route-page-label"
              [options]="pageOptions()"
              [value]="current.pageId"
              (valueChange)="pageId.set($event)"
            />
          </div>
        }
      }
    </div>
    @if (failed()) {
      <div class="empty" role="alert">
        <p class="empty-title">Could not load the live router state.</p>
        <p class="muted">
          Check that the dev server with Pangular Inspector is still running, then retry.
        </p>
        <button type="button" class="retry" (click)="retry()">Retry</button>
      </div>
    } @else if (loading()) {
      <p class="muted empty" role="status">Loading the live router state…</p>
    } @else if (page(); as current) {
      <div class="tabs" role="tablist" aria-label="Router views" (keydown)="onKey($event)">
        @for (tab of tabs; track tab.id) {
          <button
            type="button"
            role="tab"
            [id]="'router-tab-' + tab.id"
            [attr.aria-selected]="tab.id === selected()"
            [attr.aria-controls]="'router-panel-' + tab.id"
            [attr.tabindex]="tab.id === selected() ? 0 : -1"
            (click)="selected.set(tab.id)"
          >
            {{ tab.label }}
            @if (tab.id === 'navigations' && problems() > 0) {
              <span class="count" aria-hidden="true">{{ problems() }}</span>
              <span class="visually-hidden">, {{ problems() }} problem navigations</span>
            }
          </button>
        }
      </div>
      <div
        class="panel"
        role="tabpanel"
        [id]="'router-panel-' + selected()"
        [attr.aria-labelledby]="'router-tab-' + selected()"
      >
        @switch (selected()) {
          @case ('current') {
            <app-route-current [page]="current" [rpc]="rpc()" />
          }
          @case ('navigations') {
            <app-route-timeline [page]="current" [rpc]="rpc()" />
          }
          @case ('routes') {
            <app-route-tree [page]="current" [rpc]="rpc()" [sources]="sources()" />
          }
          @case ('setup') {
            <app-route-setup [page]="current" />
          }
          @case ('lint') {
            <app-route-lint [page]="current" [rpc]="rpc()" />
          }
        }
      </div>
    } @else {
      <div class="empty">
        <p class="empty-title">No page is reporting router state yet.</p>
        <p class="muted">
          Open the app in a browser. This view updates as soon as a page connects.
        </p>
      </div>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 16px;
      min-width: 0;
      margin-bottom: 32px;
    }
    .section-head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      align-items: center;
      justify-content: space-between;
      min-height: 34px;
    }
    h2 {
      margin: 0;
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .muted {
      color: var(--text-2);
      font-size: 13px;
      line-height: 1.5;
    }
    .empty {
      display: grid;
      gap: 6px;
      justify-items: center;
      margin: 0;
      padding: 40px 24px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      text-align: center;
      animation: enter 0.35s var(--ease) both;
    }
    .empty p {
      margin: 0;
      max-width: 480px;
    }
    .empty-title {
      color: var(--text-strong);
      font-size: 14px;
      font-weight: 600;
    }
    .retry {
      height: 34px;
      margin-top: 8px;
      padding: 0 12px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.15s var(--ease);
    }
    .retry:hover {
      background: var(--surface-3);
    }
    .retry:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .page-pick {
      display: flex;
      flex: 0 1 420px;
      gap: 10px;
      align-items: center;
      min-width: 0;
    }
    .page-label {
      flex: none;
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .page-pick app-select {
      flex: 1 1 auto;
      width: 100%;
    }
    .tabs {
      display: flex;
      justify-self: start;
      max-width: 100%;
      gap: 2px;
      padding: 3px;
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg);
    }
    [role='tab'] {
      display: inline-flex;
      flex: none;
      align-items: center;
      gap: 6px;
      height: 26px;
      padding: 0 12px;
      border: none;
      border-radius: 7px;
      background: transparent;
      color: var(--text-2);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color 0.15s var(--ease),
        color 0.15s var(--ease),
        box-shadow 0.15s var(--ease);
    }
    [role='tab']:hover {
      background: var(--surface-2);
      color: var(--text);
    }
    [role='tab'][aria-selected='true'] {
      background: var(--surface-3);
      color: var(--text-strong);
      box-shadow: inset 0 0 0 1px var(--border-strong);
    }
    [role='tab']:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
    .panel {
      min-width: 0;
      animation: enter 0.35s var(--ease) both;
    }
    .count {
      min-width: 18px;
      padding: 0 6px;
      border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
      border-radius: 99px;
      background: color-mix(in srgb, var(--danger) 12%, transparent);
      color: var(--danger);
      font-size: 11px;
      font-weight: 600;
      line-height: 16px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class LiveRoute {
  rpc = input<DevframeRpcClient | null>(null);
  sources = input<SourceRoute[]>([]);

  readonly tabs = TABS;
  readonly selected = signal<TabId>('current');
  readonly pages = signal<RouterPage[]>([]);
  private readonly hostPageId = hostPageId();
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly pageId = linkedSignal<RouterPage[], string | null>({
    source: this.pages,
    computation: (pages, previous) =>
      previous?.value && pages.some((p) => p.pageId === previous.value)
        ? previous.value
        : (pages.find((p) => p.pageId === this.hostPageId && p.snapshot)?.pageId ??
          pages.find((p) => p.snapshot)?.pageId ??
          pages[0]?.pageId ??
          null),
  });

  private unsubscribe: (() => void) | null = null;
  private readonly destroyRef = inject(DestroyRef);

  readonly page = computed(() => {
    const pages = this.pages();
    return pages.find((p) => p.pageId === this.pageId()) ?? pages[0] ?? null;
  });

  readonly problems = computed(
    () =>
      (this.page()?.navigations ?? []).filter(
        (nav) => !nav.probe && ['failed', 'cancelled', 'redirected'].includes(nav.outcome),
      ).length,
  );

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) this.load(client);
    });
    this.destroyRef.onDestroy(() => this.unsubscribe?.());
  }

  async load(client: DevframeRpcClient) {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const state = await client.scope('pangular').rpc.sharedState('router');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => {
        this.pages.set((value as { pages?: RouterPage[] } | undefined)?.pages ?? []);
      };
      apply(state.value());
      this.unsubscribe?.();
      this.unsubscribe = state.on('updated', apply);
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  retry() {
    const client = this.rpc();
    if (client) this.load(client);
  }

  readonly pageOptions = computed(() =>
    this.pages().map((p) => ({
      value: p.pageId,
      label: p.snapshot?.url ?? p.pageId,
      hint: p.pageId,
    })),
  );

  onKey(event: KeyboardEvent) {
    const order = this.tabs.map((tab) => tab.id);
    const index = order.indexOf(this.selected());
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % order.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + order.length) % order.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = order.length - 1;
    else return;
    event.preventDefault();
    this.selected.set(order[next]);
    const host = event.currentTarget as HTMLElement;
    queueMicrotask(() => host.querySelector<HTMLElement>(`#router-tab-${order[next]}`)?.focus());
  }
}
