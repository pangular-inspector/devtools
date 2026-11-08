import { DestroyRef, Injectable, computed, inject, signal, type Signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { hostPageId } from '../../page-id';
import { rpcTry as call } from '../../rpc';
import {
  LINT_TEXT,
  STATIC_MESSAGES,
  walk,
  type AnalogProject,
  type AnalogRoute,
  type AnalogState,
  type Finding,
  type LintCard,
  type PrerenderPlan,
  type RenderCheck,
  type RenderRow,
  type UrlMatch,
  type View,
} from './analog-model';

/**
 * What the Analog page reads from the devtools server, and the view state that outlives a switch
 * between its views (the URL being explained, the route filter, the open transform and preview,
 * the render checks). The page provides it; its views in `./analog/` share it.
 */
@Injectable()
export class AnalogPageState {
  private rpcSource: Signal<DevframeRpcClient | null> = signal(null);
  readonly rpc = computed(() => this.rpcSource());

  readonly view = signal<View>('routes');
  readonly project = signal<AnalogProject | null>(null);
  readonly loadFailed = signal(false);
  readonly state = signal<AnalogState>({});
  readonly findings = signal<Finding[]>([]);
  readonly renderRows = signal<RenderRow[]>([]);
  readonly plan = signal<PrerenderPlan | null>(null);
  readonly filter = signal('');
  readonly testUrl = signal('');
  readonly explained = signal<{ url: string; match: UrlMatch } | null>(null);
  readonly explainError = signal('');
  readonly explaining = signal(false);
  /** The dev server origin for copied requests: the open page's, or the panel's own. */
  readonly devOrigin = computed(() => {
    const url = this.page()?.url ?? '';
    if (/^https?:\/\//.test(url)) {
      // A malformed page URL must not break the whole Server view.
      try {
        return new URL(url).origin;
      } catch {
        return '';
      }
    }
    return /^https?:$/.test(location.protocol) ? location.origin : '';
  });
  /** The page file whose Vite transform stack is open below the routes. */
  readonly transformFile = signal<string | null>(null);
  /** The content file open in the preview. */
  readonly previewFile = signal<string | null>(null);
  /** Dev server render checks by route. */
  readonly checks = signal<Record<string, RenderCheck | 'running'>>({});

  private unsubscribe: (() => void) | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private refreshRun = 0;
  private readonly destroyRef = inject(DestroyRef);

  readonly hostPageId = hostPageId();

  readonly page = computed(() => {
    const pages = this.state().pages ?? [];
    return (this.hostPageId ? pages.find((p) => p.pageId === this.hostPageId) : pages[0]) ?? null;
  });
  /** Open page files, mapped to their named outlet ('' for the primary outlet). */
  readonly openFiles = computed(() => {
    const open = new Map<string, string>();
    for (const c of this.page()?.chain ?? []) {
      // The primary outlet wins when one file renders in several outlets.
      if (c.file && (!open.has(c.file) || !c.outlet)) open.set(c.file, c.outlet ?? '');
    }
    return open;
  });
  /** Every call the dev server keeps, from every tab. */
  readonly allCalls = computed(() => this.state().calls ?? []);
  /** The tab the Server view shows by default: the panel's page. */
  readonly scopePageId = computed(() => this.page()?.pageId);
  /** Shows the calls of every tab, and those the dev server tied to no tab. */
  readonly allTabs = signal(false);
  /** The calls of the panel's tab, or every call with "All tabs" on or no page reporting. */
  readonly tabCalls = computed(() => {
    const pageId = this.scopePageId();
    const calls = this.allCalls();
    return this.allTabs() || !pageId ? calls : calls.filter((c) => c.pageId === pageId);
  });
  readonly allRoutes = computed(() => walk(this.project()?.routes ?? []));
  readonly pageCount = computed(
    () => this.allRoutes().filter((r) => r.route.file && r.route.kind !== 'layout').length,
  );
  readonly serverFns = computed(() => this.project()?.serverFns ?? []);
  readonly fnById = computed(() => new Map(this.serverFns().map((fn) => [fn.id, fn])));
  readonly lintCards = computed(() => {
    const order = { error: 0, warning: 1, info: 2 };
    const cards = new Map<string, LintCard>();
    for (const finding of this.findings()) {
      let card = cards.get(finding.rule);
      if (!card) {
        const known = LINT_TEXT[finding.rule];
        card = {
          rule: finding.rule,
          severity: finding.severity,
          title: known?.title ?? finding.rule,
          summary: known?.summary ?? finding.message,
          fix: finding.fix,
          items: [],
        };
        cards.set(finding.rule, card);
      }
      const message =
        STATIC_MESSAGES.has(finding.rule) || finding.message === card.summary
          ? undefined
          : finding.message;
      const same = (item: LintCard['items'][number]) =>
        item.file === finding.file && item.path === finding.path && item.message === message;
      if (!card.items.some(same))
        card.items.push({ file: finding.file, path: finding.path, message });
    }
    return Array.from(cards.values()).sort((a, b) => order[a.severity] - order[b.severity]);
  });
  /** Errors and warnings; info findings are advice, so they are not counted. */
  readonly lintCount = computed(() => {
    const findings = this.findings();
    return {
      errors: findings.filter((f) => f.severity === 'error').length,
      warnings: findings.filter((f) => f.severity === 'warning').length,
    };
  });
  readonly lintTone = computed(() => {
    const { errors, warnings } = this.lintCount();
    return errors ? 'bad' : warnings ? 'warn' : '';
  });
  readonly views = computed(() => {
    const { errors, warnings } = this.lintCount();
    return [
      { id: 'routes' as View, label: 'Routes', count: this.pageCount() as number | null, tone: '' },
      { id: 'server' as View, label: 'Server', count: this.tabCalls().length, tone: '' },
      { id: 'render' as View, label: 'Render', count: this.renderRows().length, tone: '' },
      {
        id: 'content' as View,
        label: 'Content',
        count: this.project()?.content.length ?? 0,
        tone: '',
      },
      { id: 'data' as View, label: 'Data', count: null, tone: '' },
      { id: 'runtime' as View, label: 'Runtime', count: null, tone: '' },
      { id: 'lint' as View, label: 'Lint', count: errors + warnings, tone: this.lintTone() },
    ];
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.unsubscribe?.();
      clearTimeout(this.refreshTimer);
    });
  }

  /** Reads the RPC client from the page's `rpc` input. Called once, by the page. */
  connect(rpc: Signal<DevframeRpcClient | null>) {
    this.rpcSource = rpc;
  }

  async load(client: DevframeRpcClient) {
    const project = await call<AnalogProject>(client, 'analog-project');
    if (this.destroyRef.destroyed) return;
    this.project.set(project);
    this.loadFailed.set(project === null);
    try {
      const shared = await client.scope('pangular').rpc.sharedState('analog');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => this.state.set((value as AnalogState) ?? {});
      apply(shared.value());
      this.unsubscribe?.();
      this.unsubscribe = shared.on('updated', apply);
    } catch {
      this.state.set({});
    }
    if (this.destroyRef.destroyed) return;
    await this.refresh(this.view());
  }

  retry() {
    const client = this.rpc();
    if (!client) return;
    this.loadFailed.set(false);
    void this.load(client);
  }

  scheduleRefresh(view: View) {
    clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => void this.refresh(view), 300);
  }

  private async refresh(view: View) {
    const client = this.rpc();
    if (!client) return;
    const run = ++this.refreshRun;
    const [findings, render] = await Promise.all([
      call<Finding[]>(client, 'analog-lint', this.hostPageId ?? undefined),
      call<{ rows: RenderRow[]; plan: PrerenderPlan }>(client, 'analog-render'),
    ]);
    if (run !== this.refreshRun) return;
    this.findings.set(findings ?? []);
    this.renderRows.set(render?.rows ?? []);
    this.plan.set(render?.plan ?? null);
    if (view === 'routes' || view === 'content' || this.project() === null) {
      const project = await call<AnalogProject>(client, 'analog-project');
      if (project && run === this.refreshRun) {
        this.project.set(project);
        this.loadFailed.set(false);
      }
    }
  }

  isOpen(route: AnalogRoute): boolean {
    return !!route.file && this.openFiles().has(route.file);
  }

  openText(route: AnalogRoute): string {
    const outlet = route.file ? this.openFiles().get(route.file) : undefined;
    return outlet ? `open in ${outlet}` : 'open';
  }
}
