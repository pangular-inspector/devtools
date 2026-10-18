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
import type { PluginView } from '@pangular-inspector/devtools/plugin';
import { pluginSwitches } from '@pangular-inspector/devtools/internal/config';
import { panelConfig } from '../devtools-config';
import { hostPageId } from '../page-id';
import { Select, type SelectOption } from '../ui/select';
import { PluginSectionView, filteredCount } from './plugin-view';

/** One plugin as a page reported it (`rpc/plugins-register.ts`). */
export interface PanelPluginEntry {
  id: string;
  version: string;
  title: string;
  description?: string;
  status: 'running' | 'error' | 'unsupported';
  error?: string;
  view: PluginView | null;
  actions: string[];
}

export interface PanelPluginsPage {
  pageId: string;
  url?: string;
  title?: string;
  reportedAt: number;
  plugins: PanelPluginEntry[];
}

export interface PanelServerPlugin {
  id: string;
  version: string;
  title: string;
  description?: string;
  tools: { name: string; id: string; safety: string; description: string; registered: boolean }[];
}

export interface PanelPluginsState {
  pages: PanelPluginsPage[];
  server: PanelServerPlugin[];
}

/** The `plugins` shared state as lists, newest page first. */
export function pluginsState(value: unknown): PanelPluginsState {
  const state = (value ?? {}) as { pages?: unknown; server?: unknown };
  const pages =
    state.pages && typeof state.pages === 'object'
      ? (Object.values(state.pages) as PanelPluginsPage[]).filter(
          (page) => page && typeof page.pageId === 'string' && Array.isArray(page.plugins),
        )
      : [];
  return {
    pages: pages.sort((a, b) => b.reportedAt - a.reportedAt),
    server: Array.isArray(state.server) ? (state.server as PanelServerPlugin[]) : [],
  };
}

/** Whether any page runs a plugin or a server plugin is set, so the tab has something to show. */
export function pluginsReporting(value: unknown): boolean {
  const state = pluginsState(value);
  return state.server.length > 0 || state.pages.some((page) => page.plugins.length > 0);
}

const STATUS_LABEL: Record<PanelPluginEntry['status'], string> = {
  running: 'Running',
  error: 'Failed',
  unsupported: 'Needs a newer Pangular',
};

const STATUS_TONE: Record<PanelPluginEntry['status'], string> = {
  running: 'ok',
  error: 'danger',
  unsupported: 'warn',
};

@Component({
  selector: 'app-plugins-inspector',
  imports: [Select, PluginSectionView],
  template: `
    @if (!loaded()) {
      <p class="state" role="status">Loading plugins…</p>
    } @else if (failed()) {
      <div class="state" role="alert">
        <p>Can't read the plugins from the devtools server.</p>
        <button type="button" class="small" (click)="retry()">Retry</button>
      </div>
    } @else if (!pluginIds().length) {
      <div class="state" role="status">
        <p>No plugin reports yet.</p>
        <p class="muted">
          A library adds a tab here with <code>registerPangularPlugin()</code> from
          <code>&#64;pangular-inspector/devtools/plugin</code>. Its view shows up once the app runs
          with the overlay loaded.
        </p>
      </div>
    } @else {
      <p class="intro">
        Views that libraries report from the live page through the plugin API. The values come from
        each plugin's code on the page and are masked like other live data.
      </p>

      <div class="toolbar">
        <div class="plugins" role="group" aria-label="Plugin">
          @for (id of pluginIds(); track id) {
            <button
              type="button"
              class="view"
              [attr.aria-pressed]="pluginId() === id"
              (click)="pluginId.set(id)"
            >
              {{ titleOf(id) }}
            </button>
          }
        </div>
        <div class="search">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            #search
            type="search"
            aria-label="Filter rows and items"
            placeholder="Filter rows and items"
            [value]="filter()"
            (input)="filter.set($any($event.target).value)"
            (keydown.escape)="filter.set('')"
          />
        </div>
        @if (pageOptions().length > 1) {
          <app-select
            class="page-select"
            ariaLabel="Page"
            [options]="pageOptions()"
            [value]="pageId() ?? ''"
            (valueChange)="pageId.set($event || null)"
          />
        }
        <span class="count" role="status">{{ countText() }}</span>
      </div>

      @if (entry(); as plugin) {
        <section class="plugin" aria-labelledby="plugin-title">
          <div class="head">
            <h2 id="plugin-title">{{ plugin.title }}</h2>
            @if (plugin.version) {
              <span class="chip plain">{{ plugin.version }}</span>
            }
            <span class="chip" [attr.data-tone]="statusTone[plugin.status]">{{
              statusLabel[plugin.status]
            }}</span>
            @for (badge of plugin.view?.badges ?? []; track $index) {
              <span class="chip" [attr.data-tone]="badge.tone ?? 'plain'">{{ badge.label }}</span>
            }
          </div>
          @if (plugin.view?.summary; as summary) {
            <p class="summary">{{ summary }}</p>
          }
          @if (plugin.description) {
            <p class="muted">{{ plugin.description }}</p>
          }
          @if (plugin.error) {
            <p class="notice" role="alert">{{ plugin.error }}</p>
          }

          @if (actions().length) {
            <div class="actions" role="group" aria-label="Plugin actions">
              @if (!actionsAllowed()) {
                <p class="muted">
                  Actions of this plugin are turned off in the devtools config (<code
                    >actions.plugins</code
                  >
                  or <code>plugins.{{ plugin.id }}.actions</code>).
                </p>
              } @else if (confirming(); as action) {
                <p class="confirm">{{ action.confirm }}</p>
                <button type="button" class="small primary" (click)="run(action.name)">
                  {{ action.label }}
                </button>
                <button type="button" class="small" (click)="confirming.set(null)">Cancel</button>
              } @else {
                @for (action of actions(); track action.name) {
                  <button
                    type="button"
                    class="small"
                    [attr.aria-disabled]="running() || null"
                    (click)="ask(action)"
                  >
                    {{ action.label }}
                  </button>
                }
              }
            </div>
          }
          <p class="result" role="status">{{ result() }}</p>

          @if (!plugin.view) {
            <p class="empty">
              The plugin has not reported a view yet. It reports while this panel is open.
            </p>
          } @else if (!plugin.view.sections.length) {
            <p class="empty">The plugin reported no sections.</p>
          } @else if (filter().trim() && !filterMatches()) {
            <div class="empty">
              <p>No row or item matches “{{ filter().trim() }}”.</p>
              <button type="button" class="small" (click)="filter.set(''); search.focus()">
                Clear filters
              </button>
            </div>
          } @else {
            <div class="sections">
              @for (section of plugin.view.sections; track $index) {
                <app-plugin-section [section]="section" [filter]="filter()" [index]="$index" />
              }
            </div>
          }
        </section>
      } @else {
        <p class="notice">
          No page reports the {{ titleOf(pluginId() ?? '') }} plugin. Open the app with the plugin
          registered and the overlay loaded.
        </p>
      }

      @if (server(); as serverPlugin) {
        <section class="tools" aria-labelledby="plugin-tools-title">
          <h2 id="plugin-tools-title" class="label">Agent tools</h2>
          <ul>
            @for (tool of serverPlugin.tools; track tool.id) {
              <li>
                <code>{{ tool.id }}</code>
                <span class="chip" [attr.data-tone]="tool.safety === 'read' ? 'plain' : 'warn'">{{
                  tool.safety
                }}</span>
                @if (!tool.registered) {
                  <span class="muted">Hidden from agents by the config</span>
                }
                <p class="muted">{{ tool.description }}</p>
              </li>
            } @empty {
              <li class="muted">This plugin has no agent tools.</li>
            }
          </ul>
        </section>
      }
    }
  `,
  styles: `
    @use 'mixins' as m;
    :host {
      display: block;
      font-size: 13px;
    }
    .intro {
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .muted {
      margin: 0;
      color: var(--text-2);
      line-height: 1.5;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      margin: 0 0 12px;
      padding: 8px;
      background: color-mix(in srgb, var(--surface) 85%, transparent);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .plugins {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 4px;
      min-width: 0;
    }
    .view {
      height: var(--control-h);
      max-width: 100%;
      padding: 0 12px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font: inherit;
      cursor: pointer;
      transition: background-color 150ms var(--ease);
      @include m.truncate;
    }
    .view:hover {
      background: var(--surface-2);
    }
    .view[aria-pressed='true'] {
      border-color: var(--accent-line);
      background: var(--accent-soft);
      color: var(--text-strong);
    }
    .view:focus-visible {
      @include m.focus-ring;
    }
    .search {
      position: relative;
      flex: 1 1 180px;
      min-width: 0;
    }
    .search-icon {
      position: absolute;
      top: 50%;
      left: 12px;
      width: 14px;
      height: 14px;
      transform: translateY(-50%);
      fill: none;
      stroke: var(--text-3);
      stroke-width: 2.2;
      stroke-linecap: round;
      pointer-events: none;
    }
    input[type='search'] {
      width: 100%;
      height: var(--control-h);
      padding: 0 12px 0 34px;
      background: var(--bg);
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 13px;
    }
    input[type='search']:focus {
      @include m.field-focus;
    }
    .page-select {
      flex: 0 1 200px;
      min-width: 0;
    }
    .count {
      margin-left: auto;
      color: var(--text-2);
      font-size: 12px;
    }
    .plugin {
      display: grid;
      gap: 10px;
      min-width: 0;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 8px;
      align-items: center;
    }
    h2 {
      margin: 0;
      color: var(--text-strong);
      font-size: 16px;
      overflow-wrap: anywhere;
    }
    .summary {
      margin: 0;
      color: var(--text);
    }
    .chip {
      display: inline-flex;
      align-items: center;
      padding: 1px 8px;
      border: 1px solid transparent;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
      @include m.tint(accent);
    }
    .chip.plain,
    .chip[data-tone='plain'],
    .chip[data-tone='neutral'] {
      border-color: var(--border);
      background: var(--surface-2);
      color: var(--text-2);
    }
    .chip[data-tone='ok'] {
      @include m.tint(ok);
    }
    .chip[data-tone='warn'] {
      @include m.tint(warn);
    }
    .chip[data-tone='danger'] {
      @include m.tint(danger);
    }
    .notice {
      margin: 0 0 12px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-2);
      line-height: 1.5;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .confirm {
      margin: 0;
      color: var(--text);
    }
    .result {
      margin: 0;
      color: var(--text-2);
    }
    .result:empty {
      display: none;
    }
    .small {
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      cursor: pointer;
    }
    .small.primary {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--accent-ink);
    }
    .small[aria-disabled='true'] {
      opacity: 0.6;
      cursor: default;
    }
    .small:focus-visible {
      @include m.focus-ring;
    }
    .sections {
      display: grid;
      gap: 10px;
      min-width: 0;
    }
    .empty,
    .state {
      margin: 0 0 12px;
      color: var(--text-2);
    }
    .empty p,
    .state p {
      margin: 0 0 8px;
    }
    .tools {
      margin-top: 16px;
    }
    .label {
      @include m.label;
      margin: 0 0 8px;
    }
    .tools ul {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .tools li {
      @include m.panel;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: center;
      min-width: 0;
      padding: 8px 12px;
    }
    .tools li code {
      overflow-wrap: anywhere;
    }
    .tools li p {
      flex-basis: 100%;
    }
  `,
})
export class PluginsInspector {
  readonly rpc = input<DevframeRpcClient | null>(null);

  private readonly destroyRef = inject(DestroyRef);
  private readonly hostPageId = hostPageId();
  private unsubscribe?: () => void;

  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusTone = STATUS_TONE;

  readonly state = signal<PanelPluginsState>({ pages: [], server: [] });
  readonly loaded = signal(false);
  readonly failed = signal(false);
  readonly filter = signal('');
  readonly running = signal(false);
  readonly result = signal('');
  readonly confirming = signal<{ name: string; label: string; confirm: string } | null>(null);

  /** Every plugin a page reports or the server has, in name order. */
  readonly pluginIds = computed(() => {
    const ids = new Set<string>();
    for (const page of this.state().pages) for (const plugin of page.plugins) ids.add(plugin.id);
    for (const plugin of this.state().server) ids.add(plugin.id);
    return [...ids].sort((a, b) => this.titleOf(a).localeCompare(this.titleOf(b)));
  });
  readonly pluginId = linkedSignal<string[], string | null>({
    source: () => this.pluginIds(),
    computation: (ids, previous) =>
      previous?.value && ids.includes(previous.value) ? previous.value : (ids[0] ?? null),
  });
  /** The pages that run the picked plugin. */
  private readonly pages = computed(() =>
    this.state().pages.filter((page) => page.plugins.some((p) => p.id === this.pluginId())),
  );
  readonly pageId = linkedSignal<PanelPluginsPage[], string | null>({
    source: () => this.pages(),
    computation: (pages, previous) => {
      if (previous?.value && pages.some((page) => page.pageId === previous.value)) {
        return previous.value;
      }
      return (
        pages.find((page) => page.pageId === this.hostPageId)?.pageId ?? pages[0]?.pageId ?? null
      );
    },
  });
  readonly pageOptions = computed<SelectOption[]>(() =>
    this.pages().map((page) => ({
      value: page.pageId,
      label: page.title || page.url || page.pageId,
      hint: page.url,
    })),
  );
  readonly entry = computed(() => {
    const page = this.pages().find((p) => p.pageId === this.pageId());
    return page?.plugins.find((plugin) => plugin.id === this.pluginId()) ?? null;
  });
  readonly server = computed(
    () => this.state().server.find((plugin) => plugin.id === this.pluginId()) ?? null,
  );
  /** The view's action buttons the page plugin declares. */
  readonly actions = computed(() => {
    const plugin = this.entry();
    return (plugin?.view?.actions ?? []).filter((action) => plugin!.actions.includes(action.name));
  });
  readonly actionsAllowed = computed(() => {
    const id = this.pluginId();
    return !!id && pluginSwitches(id, panelConfig(this.rpc())).actions;
  });
  private readonly counts = computed(() => {
    const sections = this.entry()?.view?.sections ?? [];
    return sections.reduce(
      (sum, section) => {
        const { shown, total } = filteredCount(section, this.filter());
        return { shown: sum.shown + shown, total: sum.total + total };
      },
      { shown: 0, total: 0 },
    );
  });
  readonly filterMatches = computed(() => this.counts().shown > 0);
  readonly countText = computed(() => {
    const { shown, total } = this.counts();
    return total ? `${shown} of ${total} rows and items` : '';
  });

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) void this.load(client);
    });
    this.destroyRef.onDestroy(() => this.unsubscribe?.());
  }

  titleOf(id: string): string {
    for (const page of this.state().pages) {
      const plugin = page.plugins.find((p) => p.id === id);
      if (plugin) return plugin.title || id;
    }
    return this.state().server.find((plugin) => plugin.id === id)?.title || id;
  }

  retry() {
    const client = this.rpc();
    if (client) void this.load(client);
  }

  ask(action: { name: string; label: string; confirm?: string }) {
    if (this.running()) return;
    if (action.confirm) {
      this.confirming.set({ name: action.name, label: action.label, confirm: action.confirm });
      return;
    }
    void this.run(action.name);
  }

  async run(name: string) {
    const client = this.rpc();
    const pluginId = this.pluginId();
    const pageId = this.pageId();
    this.confirming.set(null);
    if (!client || !pluginId || !pageId || this.running()) return;
    this.running.set(true);
    this.result.set('');
    try {
      const answer = (await client
        .scope('pangular')
        .rpc.call(
          'request-plugin-action' as never,
          { pageId, pluginId, action: name } as never,
        )) as { ok?: boolean; error?: string } | undefined;
      this.result.set(answer?.ok ? 'Done.' : (answer?.error ?? 'The action failed.'));
    } catch {
      this.result.set("The devtools server did not answer. Check that it's still running.");
    } finally {
      this.running.set(false);
    }
  }

  private async load(client: DevframeRpcClient) {
    this.failed.set(false);
    try {
      const shared = await client.scope('pangular').rpc.sharedState('plugins');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => this.state.set(pluginsState(value));
      apply(shared.value());
      this.unsubscribe?.();
      this.unsubscribe = shared.on('updated', apply);
    } catch {
      this.failed.set(true);
    } finally {
      this.loaded.set(true);
    }
  }
}
