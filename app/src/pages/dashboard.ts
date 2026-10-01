import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import {
  summarizeNgDevtoolsConfig,
  type ResolvedNgDevtoolsConfig,
} from '@santoshyadavdev/ng-devtools/config';
import { hostPageId } from '../page-id';
import { injectorTreeFor, signalGraphFor } from '../live-pages';
import { isStaticReport } from '../rpc';
import { panelConfig, tabEnabled } from '../devtools-config';
import { TabIcon } from './tab-icon';

type LoadState = 'loading' | 'ready' | 'error';

interface BuildMeta {
  projectName?: string;
  angularVersion?: string;
  typescript?: string;
  ssr?: boolean;
  analog?: string;
}

const STATS = [
  { tab: 'components', label: 'Components' },
  { tab: 'routes', label: 'Routes' },
  { tab: 'signals', label: 'Signals' },
  { tab: 'injectors', label: 'Injectors' },
  { tab: 'store', label: 'NgRx declarations' },
  { tab: 'pipes', label: 'Pipes' },
] as const;

type StatTab = (typeof STATS)[number]['tab'];

interface Card {
  value: number;
  sub: string;
}

interface Row {
  builtin?: boolean;
  kind?: string;
  type?: string;
  redirectTo?: string;
  fullPath?: string;
  path?: string;
}

interface InjectorNode {
  providers?: unknown[];
  children?: InjectorNode[];
}

interface InjectorSnapshot {
  roots?: InjectorNode[];
  environment?: InjectorNode[];
  zone?: string | null;
  pages?: Record<string, InjectorSnapshot>;
}

const ZONE_LABELS: Record<string, string> = {
  zoneless: 'Zoneless',
  zone: 'zone.js',
  'zone-unused': 'Zoneless, zone.js loaded',
};

export function zoneLabel(mode: string | null | undefined): string | null {
  return mode && Object.hasOwn(ZONE_LABELS, mode) ? ZONE_LABELS[mode] : null;
}

interface GraphSnapshot {
  graph?: { nodes?: { kind?: string }[] } | null;
  pages?: Record<string, { nodes?: { kind?: string }[] }>;
}

const LIVE_SIGNAL_KINDS = new Set(['signal', 'computed', 'linkedSignal', 'effect']);

const NGRX_NAMES: Record<string, [string, string]> = {
  action: ['action', 'actions'],
  reducer: ['reducer', 'reducers'],
  effect: ['effect', 'effects'],
  selector: ['selector', 'selectors'],
  feature: ['feature', 'features'],
  'store-setup': ['setup call', 'setup calls'],
  'signal-store': ['signal store', 'signal stores'],
  'signal-state': ['signal state', 'signal states'],
  'signal-method': ['signal method', 'signal methods'],
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function walkInjectors(nodes: InjectorNode[] | undefined, visit: (node: InjectorNode) => void) {
  for (const node of nodes ?? []) {
    visit(node);
    walkInjectors(node.children, visit);
  }
}

export function componentsCard(rows: Row[]): Card {
  if (!rows.some((row) => row.kind)) return { value: rows.length, sub: 'discovered in source' };
  const directives = rows.filter((row) => row.kind === 'directive').length;
  return {
    value: rows.length - directives,
    sub: `components · ${plural(directives, 'directive', 'directives')}`,
  };
}

export function routesCard(rows: Row[]): Card {
  if (!rows.some((row) => row.kind)) return { value: rows.length, sub: 'route entries in source' };
  const redirects = rows.filter((row) => row.kind === 'redirect').length;
  const paths = new Set(
    rows.filter((row) => row.kind === 'page').map((row) => row.fullPath ?? row.path ?? ''),
  );
  return {
    value: paths.size,
    sub: `navigable paths · ${plural(redirects, 'redirect', 'redirects')}`,
  };
}

export function storeCard(rows: Row[]): Card {
  const counts = new Map<string, number>();
  for (const row of rows) if (row.kind) counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1);
  if (!counts.size) return { value: rows.length, sub: 'declarations in source' };
  const parts = [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => {
      const [one, many] = NGRX_NAMES[kind] ?? [kind, kind];
      return plural(count, one, many);
    });
  return { value: rows.length, sub: parts.join(' · ') };
}

@Component({
  selector: 'app-dashboard',
  imports: [TabIcon],
  template: `
    <section
      class="project"
      aria-labelledby="project-title"
      [attr.aria-busy]="metaState() === 'loading'"
    >
      <div class="project-head">
        <p class="eyebrow">Project</p>
        <h2 id="project-title" [class.muted]="metaState() !== 'ready'">
          @switch (metaState()) {
            @case ('ready') {
              {{ meta()?.projectName }}
            }
            @case ('error') {
              Project details unavailable
            }
            @default {
              Loading…
            }
          }
        </h2>
        @if (metaState() === 'error') {
          <p class="hint">
            @if (staticReport()) {
              Run <code>ng-devtools build</code> again to rebuild the report.
            } @else {
              Check that the dev server is running, then reload the panel.
            }
          </p>
        }
      </div>
      <ul class="chips" [class.pending]="metaState() === 'loading'">
        <li><span>Angular</span>{{ meta()?.angularVersion ?? '…' }}</li>
        <li><span>TypeScript</span>{{ meta()?.typescript ?? '…' }}</li>
        <li><span>SSR</span>{{ meta() ? (meta()?.ssr ? 'On' : 'Off') : '…' }}</li>
        @if (meta()?.analog; as analog) {
          <li class="analog"><span>Analog</span>{{ analog }}</li>
        }
        @if (zone(); as zone) {
          <li><span>Change detection</span>{{ zone }}</li>
        }
      </ul>
    </section>

    <div class="grid">
      @for (stat of stats(); track stat.tab; let i = $index) {
        @let state = stateOf(stat.tab);
        <button
          type="button"
          class="stat"
          [style.animation-delay.ms]="60 * i"
          [attr.aria-busy]="state === 'loading'"
          (click)="navigate.emit(stat.tab)"
        >
          <span class="top">
            <span class="icon"><app-tab-icon [name]="stat.tab" /></span>
            <span class="go" aria-hidden="true">→</span>
          </span>
          <span class="label">{{ stat.label }}</span>
          @switch (state) {
            @case ('ready') {
              <span class="big">{{ cards()[stat.tab]?.value }}</span>
              <span class="sub">{{ cards()[stat.tab]?.sub }}</span>
            }
            @case ('error') {
              <span class="big muted">–</span>
              <span class="sub">Count unavailable</span>
            }
            @default {
              <span class="big skeleton" aria-hidden="true"></span>
              <span class="sub">Counting…</span>
            }
          }
        </button>
      }
    </div>

    <section class="config" aria-labelledby="config-title" [attr.aria-busy]="!rpc()">
      <h2 id="config-title">Configuration</h2>
      @if (!rpc()) {
        <p>Loading…</p>
      } @else if (configItems().length) {
        <dl>
          @for (item of configItems(); track item.label) {
            <div>
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          }
        </dl>
      } @else {
        <p>Defaults</p>
      }
    </section>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      max-width: 1200px;
    }
    .project {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px 24px;
      margin-bottom: 16px;
      padding: 24px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background:
        radial-gradient(420px 180px at 100% 0%, var(--accent-soft), transparent 70%),
        linear-gradient(180deg, var(--surface-2), var(--surface));
      box-shadow: var(--shadow);
    }
    .project-head {
      flex: 1 1 240px;
      min-width: 0;
    }
    .eyebrow {
      @include m.label;
      margin: 0 0 4px;
      color: var(--accent);
    }
    h2 {
      margin: 0;
      color: var(--text-strong);
      font-size: 24px;
      line-height: 1.25;
      letter-spacing: -0.02em;
      overflow-wrap: anywhere;
    }
    h2.muted {
      color: var(--text-2);
      font-weight: 600;
    }
    .hint {
      margin: 8px 0 0;
      color: var(--text-2);
      font-size: 13px;
      line-height: 1.5;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      min-width: 0;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .chips li {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 28px;
      max-width: 100%;
      padding: 0 12px;
      border: 1px solid var(--border-strong);
      border-radius: 99px;
      background: var(--bg);
      color: var(--text-strong);
      font-size: 12px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .chips span {
      color: var(--text-3);
      font-weight: 500;
    }
    .chips.pending li {
      color: var(--text-3);
    }
    .chips .analog {
      border-color: color-mix(in srgb, #dd0330 55%, transparent);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
      gap: 12px;
    }
    .stat {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      min-width: 0;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: inherit;
      text-align: left;
      font: inherit;
      cursor: pointer;
      animation: enter 0.4s var(--ease) both;
      transition:
        border-color 0.2s var(--ease),
        transform 0.2s var(--ease),
        background-color 0.2s var(--ease),
        box-shadow 0.2s var(--ease);
    }
    .stat:hover {
      border-color: var(--accent-line);
      background: var(--surface-2);
      box-shadow: var(--shadow);
      transform: translateY(-2px);
    }
    .stat:active {
      transform: translateY(0);
      background: var(--surface-3);
    }
    .stat:focus-visible {
      @include m.focus-ring;
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      align-self: stretch;
      margin-bottom: 12px;
    }
    .icon {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 1px solid var(--accent-line);
      border-radius: var(--radius-sm);
      background: var(--accent-soft);
      color: var(--accent);
    }
    .go {
      display: grid;
      place-items: center;
      width: 24px;
      height: 24px;
      color: var(--text-3);
      transition:
        transform 0.2s var(--ease),
        color 0.2s var(--ease);
    }
    .stat:hover .go,
    .stat:focus-visible .go {
      color: var(--accent);
      transform: translateX(3px);
    }
    .label {
      max-width: 100%;
      overflow: hidden;
      color: var(--text-2);
      font-size: 13px;
      font-weight: 500;
      line-height: 16px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .big {
      margin: 4px 0;
      color: var(--text-strong);
      font-size: 32px;
      font-weight: 750;
      line-height: 40px;
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
    }
    .big.muted {
      color: var(--text-3);
    }
    .skeleton {
      display: block;
      width: 56px;
      height: 32px;
      margin-block: 8px;
      border-radius: var(--radius-sm);
      background: linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2)) 0 0 /
        200% 100%;
      animation: shimmer 1.4s linear infinite;
    }
    .sub {
      max-width: 100%;
      color: var(--text-3);
      font-size: 12px;
      line-height: 16px;
    }
    .config {
      margin-top: 16px;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
    }
    .config h2 {
      @include m.label;
      margin: 0 0 8px;
      color: var(--text-2);
    }
    .config p,
    .config dl {
      margin: 0;
      color: var(--text);
      font-size: 13px;
      line-height: 1.5;
    }
    .config dl {
      display: grid;
      gap: 4px;
    }
    .config dl div {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
    }
    .config dt {
      color: var(--text-2);
    }
    .config dt::after {
      content: ':';
    }
    .config dd {
      margin: 0;
      color: var(--text-strong);
      overflow-wrap: anywhere;
    }
    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }
    @media (max-width: 480px) {
      .project {
        padding: 16px;
      }
      h2 {
        font-size: 20px;
      }
      .stat {
        padding: 12px;
      }
      .big {
        font-size: 28px;
        line-height: 36px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .stat,
      .stat:hover,
      .stat:active {
        transform: none;
      }
      .stat:hover .go {
        transform: none;
      }
      .skeleton {
        animation: none;
      }
    }
  `,
})
export class Dashboard {
  rpc = input<DevframeRpcClient | null>(null);
  navigate = output<StatTab>();
  staticReport = computed(() => isStaticReport(this.rpc()));

  meta = signal<BuildMeta | null>(null);
  private readonly config = computed(() => panelConfig(this.rpc()));
  protected readonly stats = computed(() =>
    this.rpc() ? STATS.filter((stat) => tabEnabled(stat.tab, this.config())) : [],
  );
  protected readonly configItems = computed(() => summarizeNgDevtoolsConfig(this.config()));
  protected readonly metaState = signal<LoadState>('loading');
  protected readonly states = signal<Partial<Record<StatTab, LoadState>>>({});
  private readonly rows = signal<Partial<Record<StatTab, Row[]>>>({});
  private readonly injectorTree = signal<InjectorSnapshot | null>(null);
  private readonly signalGraph = signal<GraphSnapshot | null>(null);
  private readonly pageId = hostPageId();
  private readonly destroyRef = inject(DestroyRef);
  private stopLive: (() => void)[] = [];

  protected readonly zone = computed(() =>
    zoneLabel(injectorTreeFor(this.injectorTree(), this.pageId)?.zone),
  );

  private readonly liveInjectors = computed(() => {
    const tree = injectorTreeFor(this.injectorTree(), this.pageId);
    if (!tree?.roots?.length) return null;
    let injectors = 0;
    let providers = 0;
    const visit = (node: InjectorNode) => {
      injectors++;
      providers += node.providers?.length ?? 0;
    };
    walkInjectors(tree.roots, visit);
    walkInjectors(tree.environment, visit);
    return { injectors, providers };
  });

  private readonly liveSignals = computed(() => {
    const graph = signalGraphFor(this.signalGraph(), this.pageId);
    if (!graph?.nodes?.length) return null;
    return graph.nodes.filter((node) => LIVE_SIGNAL_KINDS.has(node.kind ?? '')).length;
  });

  protected readonly cards = computed<Partial<Record<StatTab, Card>>>(() => {
    const rows = this.rows();
    const out: Partial<Record<StatTab, Card>> = {};
    if (rows.components) out.components = componentsCard(rows.components);
    if (rows.routes) out.routes = routesCard(rows.routes);
    if (rows.store) out.store = storeCard(rows.store);
    if (rows.pipes) {
      const builtin = rows.pipes.filter((row) => row.builtin).length;
      out.pipes = {
        value: rows.pipes.length - builtin,
        sub: builtin ? `custom pipes · ${builtin} built-in in use` : 'custom pipes in source',
      };
    }
    const liveSignals = this.liveSignals();
    if (liveSignals !== null) {
      out.signals = {
        value: liveSignals,
        sub: rows.signals
          ? `live on the page · ${rows.signals.length} declared in source`
          : 'live on the page',
      };
    } else if (rows.signals) {
      out.signals = { value: rows.signals.length, sub: 'signal declarations in source' };
    }
    const live = this.liveInjectors();
    if (live) {
      out.injectors = {
        value: live.injectors,
        sub: `live injectors · ${plural(live.providers, 'provider', 'providers')}`,
      };
    } else if (rows.injectors) {
      out.injectors = {
        value: rows.injectors.filter((row) => row.type !== 'injection').length,
        sub: 'provider declarations in source',
      };
    }
    return out;
  });

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (!client) return;

      const my = client.scope('ng-devtools');
      this.metaState.set('loading');
      this.states.set({});
      this.rows.set({});
      my.rpc
        .call('build-meta')
        .then((m) => {
          this.meta.set(m as BuildMeta);
          this.metaState.set('ready');
        })
        .catch(() => this.metaState.set('error'));
      const config = panelConfig(client);
      const on = (tab: StatTab) => tabEnabled(tab, config);
      if (on('components')) this.load(my.rpc.call('get-components'), 'components');
      if (on('routes')) this.load(my.rpc.call('get-routes'), 'routes');
      if (on('signals')) this.load(my.rpc.call('get-signals'), 'signals');
      if (on('injectors')) this.load(my.rpc.call('get-providers'), 'injectors');
      if (on('store')) this.load(my.rpc.call('get-ngrx-store'), 'store');
      if (on('pipes')) this.load(my.rpc.call('get-pipes'), 'pipes');
      void this.watchLive(client, config);
    });
    this.destroyRef.onDestroy(() => this.unwatch());
  }

  protected stateOf(tab: StatTab): LoadState {
    const live =
      tab === 'signals' ? this.liveSignals() : tab === 'injectors' ? this.liveInjectors() : null;
    return live !== null ? 'ready' : (this.states()[tab] ?? 'loading');
  }

  private load(request: Promise<unknown>, tab: StatTab) {
    const mark = (state: LoadState) => this.states.update((all) => ({ ...all, [tab]: state }));
    request
      .then((rows) => {
        this.rows.update((all) => ({ ...all, [tab]: Array.isArray(rows) ? (rows as Row[]) : [] }));
        mark('ready');
      })
      .catch(() => mark('error'));
  }

  private async watchLive(client: DevframeRpcClient, config: ResolvedNgDevtoolsConfig) {
    this.unwatch();
    const rpc = client.scope('ng-devtools').rpc;
    const follow = async <T>(
      name: 'injector-tree' | 'signal-graph',
      target: (value: T) => void,
    ) => {
      try {
        const state = await rpc.sharedState(name);
        if (this.destroyRef.destroyed || this.rpc() !== client) return;
        target(state.value() as T);
        this.stopLive.push(state.on('updated', (value: unknown) => target(value as T)));
      } catch {
        target(null as T);
      }
    };
    await Promise.all([
      config.inspectors.injectors &&
        follow<InjectorSnapshot | null>('injector-tree', (value) => this.injectorTree.set(value)),
      config.inspectors.signals &&
        follow<GraphSnapshot | null>('signal-graph', (value) => this.signalGraph.set(value)),
    ]);
  }

  private unwatch() {
    for (const stop of this.stopLive.splice(0)) stop();
  }
}
