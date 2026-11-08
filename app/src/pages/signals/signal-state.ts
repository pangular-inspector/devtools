import {
  DestroyRef,
  ElementRef,
  Injectable,
  Injector,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { pickPage, type ReportedPage } from '../../live-pages';
import { hostPageId } from '../../page-id';
import { angularPageFor, injectAngularPages } from '../../angular-pages';
import type { SelectOption } from '../../ui/select';
import type { SearchField } from '../../ui/search-field';
import type { GraphLink } from '../signal-graph-layout';
import type { SignalFocus } from '../../types/signal-focus.types';
import type { GraphInjector, SignalGraph, SignalResource } from '../../types/signal-graph.types';
import {
  ENV,
  FOLLOW,
  WATCHABLE,
  WATCH_LOG,
  graphPagesOf,
  type LiveNode,
  type SignalNode,
  type SourceSignal,
} from './signal-model';

/**
 * The state the Signals page and its sections share: the `signal-graph` and `component-tree`
 * shared states, the source scan, the shown page and component, the filters, the selection and
 * the watched signals. Provided by the page, so every section of one page reads the same signals.
 */
@Injectable()
export class SignalState {
  private rpcSource: Signal<DevframeRpcClient | null> = signal(null);
  readonly rpc = computed(() => this.rpcSource());
  private filterField: () => SearchField | undefined = () => undefined;

  /** The signal to select once the focused component's graph arrives. */
  readonly focusedSignal = signal<{ componentId: string; key: string } | null>(null);
  /** The page a focus asked for before it reported a graph; chosen once it does. */
  private pendingPageId: string | null = null;

  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly pageId = hostPageId();
  private readonly angularPages = injectAngularPages(() => this.rpc());
  /** The shown page's Angular version and debug API parts, for the unavailable note. */
  readonly angularPage = computed(() =>
    angularPageFor(this.angularPages(), this.shownPageId() ?? this.pageId),
  );
  readonly cleanups: (() => void)[] = [];
  /** Counts graph loads, so only the newest one applies its result. */
  private graphLoad = 0;
  readonly treePages = signal<
    Record<
      string,
      { roots?: LiveNode[]; reportedAt?: number; title?: string; url?: string; platform?: string }
    >
  >({});
  private readonly graphState = signal<{
    graph: SignalGraph | null;
    pages: Record<string, SignalGraph>;
  }>({ graph: null, pages: {} });
  readonly chosenPageId = signal<string | null>(null);
  readonly announcement = signal('');

  private readonly graphPages = computed(() => graphPagesOf(this.graphState()));

  // The newest graph comes as `graph`; a page that reports later never takes over.
  readonly shownPageId = linkedSignal<
    { pages: Record<string, SignalGraph>; newest: string | null; chosen: string | null },
    string | null
  >({
    source: () => ({
      pages: this.graphPages(),
      newest: this.graphState().graph?.pageId ?? null,
      chosen: this.chosenPageId(),
    }),
    computation: ({ pages, newest, chosen }, previous) => {
      const reported: Record<string, ReportedPage> = {};
      for (const pageId of Object.keys(pages)) {
        reported[pageId] = { pageId, reportedAt: pageId === newest ? 1 : 0 };
      }
      return pickPage(reported, { chosen, host: this.pageId, previous: previous?.value ?? null });
    },
  });

  private readonly reported = computed<SignalGraph | null>(() => {
    const pageId = this.shownPageId();
    return pageId === null ? null : (this.graphPages()[pageId] ?? null);
  });
  readonly unsupported = computed(() => !!this.reported()?.unsupported);
  /** Whether the live graph state arrived, so the intro doesn't call it a source scan first. */
  readonly graphKnown = signal(false);
  readonly graph = computed<SignalGraph | null>(() => {
    const reported = this.reported();
    return reported?.unsupported ? null : reported;
  });
  private readonly graphOwner = computed(() => {
    const g = this.graph();
    return g
      ? `${g.pageId ?? ''}|${g.component?.id ?? g.injector?.id ?? g.element?.id ?? ''}`
      : null;
  });

  // Component and injector ids belong to one page, so each page keeps its own pick.
  private readonly pickedByPage = signal<Record<string, string>>({});
  readonly picked = computed(() => this.pickedByPage()[this.targetPageId() ?? ''] ?? null);

  readonly pageOptions = computed<SelectOption[]>(() => {
    if (this.pageId) return [];
    const tree = this.treePages();
    return Object.keys(this.graphPages()).map((pageId) => {
      const page = tree[pageId];
      return {
        value: pageId,
        label: page?.title || page?.url || `Page ${pageId}`,
        hint: page?.url,
      };
    });
  });

  readonly showInternals = signal(false);
  readonly sourceSignals = signal<SourceSignal[]>([]);
  readonly sourceLoaded = signal(false);
  /** The source scan or the live graph state could not be read from the server. */
  private readonly sourceFailed = signal(false);
  private readonly graphFailed = signal(false);
  readonly loadFailed = computed(() => this.sourceFailed() || this.graphFailed());
  readonly retrying = signal(false);
  readonly filter = signal('');
  readonly resources = computed(() => this.graph()?.resources ?? []);
  private readonly internalIds = computed(
    () => new Set(this.resources().flatMap((r) => r.nodeIds)),
  );
  /** Shows the nodes Angular itself created, which are hidden by default. */
  readonly showFramework = signal(false);
  readonly frameworkCount = computed(() => {
    const internal = this.internalIds();
    return (this.graph()?.nodes ?? []).filter((n) => n.framework && !internal.has(n.id)).length;
  });
  readonly visibleNodes = computed(() => {
    const internal = this.internalIds();
    const framework = this.showFramework();
    return (this.graph()?.nodes ?? []).filter(
      (n) => !internal.has(n.id) && (framework || !n.framework),
    );
  });
  readonly showGraph = signal(true);
  /** Links between the nodes the page shows, by node id. */
  readonly graphLinks = computed<GraphLink[]>(() => {
    const g = this.graph();
    if (!g) return [];
    const shown = new Set(this.visibleNodes().map((n) => n.id));
    const links: GraphLink[] = [];
    for (const edge of g.edges) {
      const producer = g.nodes[edge.producer]?.id;
      const consumer = g.nodes[edge.consumer]?.id;
      if (producer && consumer && shown.has(producer) && shown.has(consumer)) {
        links.push({ producer, consumer });
      }
    }
    return links;
  });
  readonly graphNodes = computed(() =>
    [...this.visibleNodes()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
  );

  readonly watchedIds = computed(() => new Set(this.graph()?.watch?.ids ?? []));
  readonly stacksOn = computed(() => !!this.graph()?.watch?.stacks);
  readonly watchedNodes = computed(() => {
    const ids = this.watchedIds();
    return (this.graph()?.nodes ?? []).filter((n) => ids.has(n.id));
  });
  /** Watched ids the page reports that are not in the graph shown now. */
  readonly watchedElsewhere = computed(() => this.watchedIds().size - this.watchedNodes().length);
  /** The newest changes of every watched signal in this graph, newest first. */
  readonly watchLog = computed(() => {
    const history = this.graph()?.history ?? {};
    const entries = this.watchedNodes().flatMap((node) =>
      (history[node.id] ?? [])
        .filter((change) => change.source !== 'initial')
        .map((change) => ({ id: node.id, label: node.label ?? node.id, change })),
    );
    return entries.sort((a, b) => b.change.at - a.change.at).slice(0, WATCH_LOG);
  });
  readonly hasAnySignals = computed(() => this.visibleNodes().length + this.resources().length > 0);
  readonly kindCounts = computed(() => {
    const kinds: string[] = this.graph()
      ? [...this.visibleNodes().map((n) => n.kind), ...this.resources().map(() => 'resource')]
      : this.sourceSignals().map((s) => s.kind);
    const counts = new Map<string, number>();
    for (const k of kinds) counts.set(k, (counts.get(k) ?? 0) + 1);
    return [...counts].map(([kind, count]) => ({ kind, count }));
  });
  // A kind picked on another graph stays only when this graph has it too.
  readonly kind = linkedSignal<string | null, string | null>({
    source: this.graphOwner,
    computation: (_owner, previous) => {
      const kind = previous?.value ?? null;
      return kind && untracked(this.kindCounts).some((g) => g.kind === kind) ? kind : null;
    },
  });
  // An active kind with no matches still gets a pressed chip, so the filter stays visible.
  readonly kindChips = computed(() => {
    const counts = this.kindCounts();
    const kind = this.kind();
    return kind && !counts.some((g) => g.kind === kind) ? [...counts, { kind, count: 0 }] : counts;
  });
  readonly kindTotal = computed(() => this.kindCounts().reduce((sum, g) => sum + g.count, 0));
  readonly selectedId = linkedSignal<string | null, string | null>({
    source: this.graphOwner,
    computation: () => null,
  });
  readonly selectedNode = computed(
    () => this.graph()?.nodes.find((n) => n.id === this.selectedId()) ?? null,
  );
  private readonly jumpedPast = signal<{ id: string; label: string } | null>(null);
  readonly jumpNote = computed(() => {
    const jumped = this.jumpedPast();
    if (!jumped || this.filter() || this.kind() || this.selectedId() !== jumped.id) return '';
    return `Cleared the filters to show ${jumped.label}.`;
  });

  readonly filteredResources = computed(() => {
    const q = this.filter().toLowerCase();
    const kind = this.kind();
    if (kind && kind !== 'resource') return [];
    return this.resources().filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        // A short query such as `e` would match every resource through its kind.
        (q.length >= 3 && 'resource'.startsWith(q)),
    );
  });

  readonly filteredNodes = computed(() => {
    const q = this.filter().toLowerCase();
    const kind = this.kind();
    const nodes = this.visibleNodes().filter(
      (n) =>
        (!kind || n.kind === kind) &&
        (!q || (n.label ?? '').toLowerCase().includes(q) || n.kind.toLowerCase().includes(q)),
    );
    // Angular orders nodes by last read order, which changes between polls; ids are stable.
    return nodes.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  });

  readonly filteredSourceSignals = computed(() => {
    const q = this.filter().toLowerCase();
    const kind = this.kind();
    return this.sourceSignals().filter(
      (s) =>
        (!kind || s.kind === kind) &&
        (!q ||
          s.name.toLowerCase().includes(q) ||
          s.kind.toLowerCase().includes(q) ||
          s.file.toLowerCase().includes(q)),
    );
  });

  readonly targetPageId = computed(
    () =>
      this.pageId ??
      (this.shownPageId() || null) ??
      this.graph()?.pageId ??
      this.latestTreePage()?.pageId ??
      null,
  );

  private readonly latestTreePage = computed(() => {
    let latest: { pageId: string; reportedAt: number } | null = null;
    for (const [pageId, page] of Object.entries(this.treePages())) {
      const at = page.reportedAt ?? 0;
      if (!latest || at > latest.reportedAt) latest = { pageId, reportedAt: at };
    }
    return latest;
  });

  readonly componentOptions = computed<SelectOption[]>(() => {
    const pageId = this.targetPageId();
    const roots = (pageId ? this.treePages()[pageId]?.roots : undefined) ?? [];
    const flat: LiveNode[] = [];
    const walk = (nodes: LiveNode[]) => {
      for (const node of nodes) {
        flat.push(node);
        walk(node.children);
      }
    };
    walk(roots);
    const environments = this.graph()?.environments ?? [];
    if (!flat.length && !environments.length) return [];
    const totals = new Map<string, number>();
    for (const node of flat) totals.set(node.name, (totals.get(node.name) ?? 0) + 1);
    const seen = new Map<string, number>();
    const options: SelectOption[] = [
      { value: FOLLOW, label: 'Follow the routed component', hint: 'automatic' },
      ...environments.map((env) => ({
        value: ENV + env.id,
        label: this.injectorLabel(env),
        hint: 'injector',
      })),
    ];
    for (const node of flat) {
      const n = (seen.get(node.name) ?? 0) + 1;
      seen.set(node.name, n);
      options.push({
        value: node.id,
        label: (totals.get(node.name) ?? 0) > 1 ? `${node.name} #${n}` : node.name,
        hint: node.kind === 'directive' ? `<${node.tag}> directive` : `<${node.tag}>`,
      });
    }
    return options;
  });

  readonly pickerValue = computed(() => {
    const picked = this.picked();
    return picked && this.componentOptions().some((o) => o.value === picked) ? picked : FOLLOW;
  });

  /** Takes the page's `rpc` input and its filter box, which the sections read through here. */
  connect(rpc: Signal<DevframeRpcClient | null>, filterField: () => SearchField | undefined) {
    this.rpcSource = rpc;
    this.filterField = filterField;
  }

  async loadSignalGraph(client: DevframeRpcClient) {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    const load = ++this.graphLoad;
    /** A newer load (Retry, or a new client) started, so this one's outcome is dropped. */
    const stale = () => this.destroyRef.destroyed || load !== this.graphLoad;
    const my = client.scope('pangular');
    try {
      const state = await my.rpc.sharedState('signal-graph');
      if (stale()) return;
      this.graphFailed.set(false);
      const apply = (value: unknown) => {
        const next = value as {
          graph?: SignalGraph | null;
          pages?: Record<string, SignalGraph>;
        } | null;
        const pages = next?.pages && typeof next.pages === 'object' ? next.pages : {};
        const state = { graph: next?.graph ?? null, pages };
        this.notePageGone(graphPagesOf(state));
        this.graphState.set(state);
        const pending = this.pendingPageId;
        if (pending && this.graphPages()[pending]) {
          this.pendingPageId = null;
          this.chosenPageId.set(pending);
        }
        // A state the client hasn't loaded from the server yet says nothing.
        if (value !== undefined) this.graphKnown.set(true);
      };
      apply(state.value());
      this.cleanups.push(state.on('updated', apply));
    } catch {
      if (stale()) return;
      this.graphState.set({ graph: null, pages: {} });
      this.graphKnown.set(true);
      this.graphFailed.set(true);
    }
    try {
      const tree = await my.rpc.sharedState('component-tree');
      if (stale()) return;
      const applyTree = (value: unknown) => {
        const pages = (value as { pages?: Record<string, { roots?: LiveNode[] }> } | null)?.pages;
        this.treePages.set(pages && typeof pages === 'object' ? pages : {});
      };
      applyTree(tree.value());
      this.cleanups.push(tree.on('updated', applyTree));
    } catch {
      if (!stale()) this.treePages.set({});
    }
  }

  private notePageGone(pages: Record<string, SignalGraph>) {
    const gone = Object.keys(this.graphPages()).filter((pageId) => !pages[pageId]);
    if (gone.length) {
      this.pickedByPage.update((all) => {
        const next = { ...all };
        for (const pageId of gone) delete next[pageId];
        return next;
      });
    }
    const chosen = this.chosenPageId();
    if (!chosen || pages[chosen]) return;
    const label = this.pageOptions().find((o) => o.value === chosen)?.label ?? 'The chosen page';
    this.chosenPageId.set(null);
    this.announcement.set(`${label} closed, so this shows another page.`);
  }

  selectPage(pageId: string | null) {
    if (!pageId || pageId === this.shownPageId()) return;
    this.pendingPageId = null;
    this.chosenPageId.set(pageId);
    const label = this.pageOptions().find((o) => o.value === pageId)?.label ?? pageId;
    this.announcement.set(`Showing the signal graph of ${label}.`);
  }

  /** Shows the graph of the component a focus names, on its page when it names one. */
  showComponent(focus: SignalFocus) {
    this.pendingPageId = null;
    if (focus.pageId && !this.pageId) {
      // A page that has not reported its graph yet is chosen when it does.
      if (this.graphPages()[focus.pageId]) this.chosenPageId.set(focus.pageId);
      else this.pendingPageId = focus.pageId;
    }
    this.focusedSignal.set(focus.key ? { componentId: focus.componentId, key: focus.key } : null);
    this.pickComponent(focus.componentId, this.pageId ?? focus.pageId);
  }

  pickComponent(value: string | null, forPage?: string) {
    const picked = value && value !== FOLLOW ? value : null;
    // Another component replaces a focus that still waits for its signal.
    if (this.focusedSignal()?.componentId !== picked) this.focusedSignal.set(null);
    const pageId = forPage ?? this.targetPageId() ?? undefined;
    this.pickedByPage.update((all) => {
      const next = { ...all };
      if (picked) next[pageId ?? ''] = picked;
      else delete next[pageId ?? ''];
      return next;
    });
    const client = this.rpc();
    if (!client) return;
    const target = picked?.startsWith(ENV)
      ? { pageId, env: picked.slice(ENV.length) }
      : { pageId, id: picked };
    void client
      .scope('pangular')
      .rpc.call('select-signal-target', target)
      .catch(() => {});
  }

  injectorLabel(injector: GraphInjector) {
    return injector.name === 'Root' ? 'Root services' : injector.name;
  }

  async loadSourceSignals(client: DevframeRpcClient) {
    const my = client.scope('pangular');
    try {
      const result = (await my.rpc.call('get-signals')) as SourceSignal[];
      this.sourceSignals.set(result);
      this.sourceFailed.set(false);
    } catch {
      this.sourceFailed.set(true);
    } finally {
      this.sourceLoaded.set(true);
    }
  }

  /** Loads the graph and the source scan again. The alert stays until they answer, so focus
   * stays on Retry while it is shown and moves to the filter box when the alert goes, which
   * also happens when the graph comes back but the source scan still fails. */
  async retry() {
    const client = this.rpc();
    if (!client || this.retrying()) return;
    const trigger = document.activeElement;
    this.retrying.set(true);
    try {
      await Promise.all([this.loadSignalGraph(client), this.loadSourceSignals(client)]);
    } finally {
      this.retrying.set(false);
    }
    if (this.destroyRef.destroyed) return;
    afterNextRender(
      () => {
        const lost = !trigger?.isConnected || document.activeElement === document.body;
        if (lost) this.filterField()?.focus();
      },
      { injector: this.injector },
    );
  }

  /** Clears the filters from a no-match state and keeps focus on the filter box. */
  clearFilters() {
    this.resetFilters();
    this.filterField()?.focus();
  }

  private resetFilters() {
    this.filter.set('');
    this.kind.set(null);
  }

  select(id: string) {
    this.selectedId.set(this.selectedId() === id ? null : id);
    this.showInternals.set(false);
  }

  /** Selects a node from the drawn graph; its detail opens in the list below. */
  selectFromGraph(id: string) {
    this.selectedId.set(id);
    this.showInternals.set(false);
  }

  isWatchable(node: SignalNode): boolean {
    return WATCHABLE.has(node.kind);
  }

  /** Asks the page to watch or stop watching a signal; the page's next report shows it. */
  toggleWatch(node: SignalNode) {
    const watch = !this.watchedIds().has(node.id);
    const label = node.label ?? 'the unnamed signal';
    this.sendWatch({ id: node.id, watch });
    this.announcement.set(
      watch
        ? `Watching ${label}. Its changes also log to the page console.`
        : `Stopped watching ${label}.`,
    );
  }

  /** Turns write stacks on or off for the page that reported the graph. */
  toggleStacks() {
    const stacks = !this.stacksOn();
    this.sendWatch({ stacks });
    this.announcement.set(stacks ? 'Recording write stacks.' : 'Stopped recording write stacks.');
  }

  private sendWatch(request: { id?: string; watch?: boolean; stacks?: boolean }) {
    const client = this.rpc();
    const pageId = this.graph()?.pageId ?? this.targetPageId() ?? undefined;
    if (!client) return;
    void client
      .scope('pangular')
      .rpc.call('set-signal-watch', { ...request, pageId })
      .catch(() => {});
  }

  jumpTo(node: SignalNode) {
    const resource = this.resources().find((r) => r.nodeIds.includes(node.id));
    const id = resource?.id ?? node.id;
    const hidden = resource
      ? !this.filteredResources().some((r) => r.id === id)
      : !this.filteredNodes().some((n) => n.id === id);
    if (hidden) this.resetFilters();
    this.jumpedPast.set(hidden ? { id, label: resource?.name ?? node.label ?? node.id } : null);
    this.selectedId.set(id);
    this.showInternals.set(!!resource);
    afterNextRender(
      () => {
        const card = [
          ...this.host.nativeElement.querySelectorAll<HTMLElement>('.node-card[data-card]'),
        ].find((el) => el.dataset['card'] === id);
        card?.scrollIntoView?.({ block: 'nearest' });
        card?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  // The page counts past the kept history; older pages only send the list.
  changeCount(id: string): number {
    const g = this.graph();
    const counted =
      g?.nodes.find((n) => n.id === id)?.changes ?? g?.resources?.find((r) => r.id === id)?.changes;
    if (counted !== undefined) return counted;
    const list = g?.history?.[id] ?? [];
    return list.reduce((n, c) => n + (c.source === 'initial' ? 0 : 1 + (c.missed ?? 0)), 0);
  }

  internalsOf(resource: SignalResource): SignalNode[] {
    const ids = new Set(resource.nodeIds);
    return (this.graph()?.nodes ?? []).filter((n) => ids.has(n.id));
  }

  /** Producers and consumers of every node, built once per graph. */
  private readonly relations = computed(() => {
    const map = new Map<string, { deps: SignalNode[]; consumers: SignalNode[] }>();
    const g = this.graph();
    if (!g) return map;
    for (const node of g.nodes) map.set(node.id, { deps: [], consumers: [] });
    for (const edge of g.edges) {
      const producer = g.nodes[edge.producer];
      const consumer = g.nodes[edge.consumer];
      if (!producer || !consumer) continue;
      map.get(consumer.id)?.deps.push(producer);
      map.get(producer.id)?.consumers.push(consumer);
    }
    return map;
  });

  getDependencies(node: SignalNode): SignalNode[] {
    return this.relations().get(node.id)?.deps ?? [];
  }

  getConsumers(node: SignalNode): SignalNode[] {
    return this.relations().get(node.id)?.consumers ?? [];
  }
}
