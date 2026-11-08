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
  type OnDestroy,
  type Signal,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import type { InjectorTreeLimits } from '@pangular-inspector/devtools/internal/types';
import { pickPage, type ReportedPage } from '../../live-pages';
import { hostPageId } from '../../page-id';
import type { SelectOption } from '../../ui/select';
import { storeFlag, storedFlag } from '../../view-prefs';
import { zoneLabel } from '../dashboard';
import {
  HIDE_FRAMEWORK_PREF,
  MAX_PROVIDED_BY,
  NULL_ID,
  isTree,
  kindOf,
  labelOf,
  type InjectorNode,
  type InjectorPage,
  type InjectorTreeState,
  type PathStep,
  type ProviderInfo,
  type Row,
  type SourceProvider,
  type TreeView,
} from './injector-model';

/**
 * The state the Injectors page and its sections share: the `injector-tree` shared state and the
 * source scan, the shown page, the tree filters, the selection and the announcements. Provided
 * by the page, so every section of one page reads the same signals.
 */
@Injectable()
export class InjectorsState implements OnDestroy {
  private rpcSource: Signal<DevframeRpcClient | null> = signal(null);
  readonly rpc = computed(() => this.rpcSource());
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly hostPage = hostPageId();
  readonly treeState = signal<InjectorTreeState | null>(null);
  readonly pageTitles = signal<Record<string, { title?: string; url?: string }>>({});
  readonly chosenPageId = signal<string | null>(null);

  // Older servers send only the newest tree, without the per-page map.
  readonly treePages = computed<Record<string, InjectorPage>>(() => {
    const state = this.treeState();
    if (!state) return {};
    const pages = state.pages && typeof state.pages === 'object' ? state.pages : {};
    if (Object.keys(pages).length || this.hostPage) return pages;
    return { '': state };
  });

  // A page that reports later never takes over from the one shown.
  readonly shownPageId = linkedSignal<
    { pages: Record<string, InjectorPage>; chosen: string | null },
    string | null
  >({
    source: () => ({ pages: this.treePages(), chosen: this.chosenPageId() }),
    computation: ({ pages, chosen }, previous) => {
      const reported: Record<string, ReportedPage> = {};
      for (const [pageId, page] of Object.entries(pages)) {
        const at = typeof page?.reportedAt === 'number' ? page.reportedAt : 0;
        reported[pageId] = { pageId, reportedAt: at };
      }
      return pickPage(reported, {
        chosen,
        host: this.hostPage,
        previous: previous?.value ?? null,
      });
    },
  });

  private readonly shownPage = computed(() => {
    const pageId = this.shownPageId();
    return pageId === null ? null : (this.treePages()[pageId] ?? null);
  });
  readonly roots = computed<InjectorNode[]>(() => {
    const roots = this.shownPage()?.roots;
    return isTree(roots) ? roots : [];
  });
  readonly environment = computed<InjectorNode[]>(() => {
    const environment = this.shownPage()?.environment;
    return isTree(environment) ? environment : [];
  });
  readonly truncated = computed(() => this.shownPage()?.truncated === true);
  /** The caps the server names with `truncated`, or the ones it has always used. */
  readonly limits = computed<InjectorTreeLimits>(() => {
    const limits = this.shownPage()?.limits as Partial<InjectorTreeLimits> | undefined;
    const whole = (n: unknown, fallback: number) =>
      typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : fallback;
    return {
      elements: whole(limits?.elements, 2000),
      injectors: whole(limits?.injectors, 2500),
      depth: whole(limits?.depth, 1000),
    };
  });
  readonly zone = computed(() => {
    const zone = this.shownPage()?.zone;
    return typeof zone === 'string' ? zoneLabel(zone) : null;
  });

  readonly multiPage = computed(() => !this.hostPage && Object.keys(this.treePages()).length > 1);
  readonly pageOptions = computed<SelectOption[]>(() => {
    if (!this.multiPage()) return [];
    const titles = this.pageTitles();
    return Object.keys(this.treePages()).map((pageId) => {
      const page = titles[pageId];
      return {
        value: pageId,
        label: page?.title || page?.url || `Page ${pageId}`,
        hint: page?.url,
      };
    });
  });

  /** Injector ids belong to one page, so each page keeps its own selection and expansion. */
  private readonly pageKey = computed(() => this.shownPageId() ?? '');
  private perPage<T>(initial: () => T) {
    const saved = new Map<string, T>();
    return linkedSignal<string, T>({
      source: this.pageKey,
      computation: (key, previous) => {
        if (previous) saved.set(previous.source, previous.value);
        return saved.has(key) ? (saved.get(key) as T) : initial();
      },
    });
  }

  readonly sourceProviders = signal<SourceProvider[]>([]);
  readonly loaded = signal(false);
  /** The live injector tree or the source scan could not be read from the server. */
  readonly treeFailed = signal(false);
  private readonly sourceFailed = signal(false);
  readonly loadFailed = computed(() => this.treeFailed() || this.sourceFailed());
  readonly retrying = signal(false);
  readonly view = signal<TreeView>('element');
  readonly query = signal('');
  readonly onlyProviding = signal(false);
  readonly componentsOnly = signal(true);
  /** Hides Angular's own injectors and providers (marked `framework` by the server). */
  readonly hideFramework = signal(storedFlag(HIDE_FRAMEWORK_PREF) ?? false);
  readonly collapsed = this.perPage<ReadonlySet<string>>(() => new Set());
  readonly selectedId = this.perPage<string | null>(() => null);
  readonly focusId = this.perPage<string | null>(() => null);
  readonly announcement = signal('');
  private readonly selectedLabel = this.perPage<string | null>(() => null);
  private wasGone = false;
  /** The dependency whose resolution is open in the details. */
  readonly resolvingKey = signal<string | null>(null);

  readonly index = computed(() => {
    const map = new Map<string, InjectorNode>();
    const parents = new Map<string, string>();
    const walk = (nodes: InjectorNode[], parent: string | null) => {
      for (const node of nodes) {
        map.set(node.injector.id, node);
        if (parent) parents.set(node.injector.id, parent);
        walk(node.children, node.injector.id);
      }
    };
    walk(this.roots(), null);
    walk(this.environment(), null);
    const byComponent = new Map<string, string>();
    for (const node of map.values()) {
      const componentId = node.injector.componentId;
      if (componentId && node.injector.type === 'element')
        byComponent.set(componentId, node.injector.id);
    }
    return { map, parents, byComponent };
  });

  /** The element and environment trees without framework injectors, while they are hidden. */
  private readonly shownRoots = computed(() => this.withoutFramework(this.roots()));
  private readonly shownEnvironment = computed(() => this.withoutFramework(this.environment()));

  readonly elementCount = computed(() => this.count(this.shownRoots()));
  readonly environmentCount = computed(() => this.count(this.shownEnvironment()));

  /** What "Hide framework" hides in the current view: injectors, and providers on the rest. */
  readonly frameworkHiddenCount = computed(() => {
    const all = this.view() === 'element' ? this.roots() : this.environment();
    let injectors = 0;
    let providers = 0;
    const walk = (nodes: InjectorNode[]) => {
      for (const node of nodes) {
        if (node.injector.framework) injectors++;
        else providers += node.providers.filter((p) => p.framework).length;
        walk(node.children);
      }
    };
    walk(all);
    return { injectors, providers };
  });
  readonly frameworkHiddenText = computed(() => {
    const { injectors, providers } = this.frameworkHiddenCount();
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
    if (!injectors && !providers) return 'Nothing hidden';
    if (!providers) return `${plural(injectors, 'injector')} hidden`;
    if (!injectors) return `${plural(providers, 'provider')} hidden`;
    return `${plural(injectors, 'injector')} and ${plural(providers, 'provider')} hidden`;
  });

  private readonly visible = computed(() => {
    let nodes = this.view() === 'element' ? this.shownRoots() : this.shownEnvironment();
    if (this.view() === 'element' && this.componentsOnly()) {
      nodes = this.prune(nodes, (n) => !!n.injector.component);
    }
    if (this.onlyProviding()) nodes = this.prune(nodes, (n) => this.providerCount(n) > 0);
    const q = this.normalizedQuery();
    if (q) nodes = this.prune(nodes, (n) => this.nodeMatches(n, q));
    return nodes;
  });

  readonly rows = computed<Row[]>(() => {
    const rows: Row[] = [];
    const collapsed = this.collapsed();
    const searching = !!this.normalizedQuery();
    const walk = (nodes: InjectorNode[], depth: number) => {
      for (const node of nodes) {
        const expanded = searching || !collapsed.has(node.injector.id);
        rows.push({ node, depth, hasChildren: node.children.length > 0, expanded });
        if (expanded) walk(node.children, depth + 1);
      }
    };
    walk(this.visible(), 0);
    return rows;
  });

  /** Falls back to the first row only while nothing is chosen, never when the choice is gone. */
  readonly selected = computed(() => {
    const id = this.selectedId();
    if (!id) return this.rows()[0]?.node ?? null;
    return this.index().map.get(id) ?? null;
  });

  /** The label of the chosen injector once it has left the page. */
  readonly gone = computed(() => {
    const id = this.selectedId();
    return id && !this.index().map.has(id) ? (this.selectedLabel() ?? 'The injector') : null;
  });

  readonly rovingId = computed(() => {
    const rows = this.rows();
    const want = this.focusId() ?? this.selected()?.injector.id;
    if (want && rows.some((r) => r.node.injector.id === want)) return want;
    return rows[0]?.node.injector.id ?? null;
  });

  readonly path = computed<PathStep[]>(() => {
    const sel = this.selected();
    if (!sel) return [];
    const { map, parents } = this.index();
    let ids = sel.injector.path ?? [];
    if (!ids.length) {
      ids = [sel.injector.id];
      let parent = parents.get(sel.injector.id);
      while (parent) {
        ids.push(parent);
        parent = parents.get(parent);
      }
      ids.push(NULL_ID);
    }
    return ids.map((id) => {
      const node = map.get(id);
      return {
        id,
        label: node ? labelOf(node) : id === NULL_ID ? 'Null injector' : 'Not listed',
        kind: node ? kindOf(node) : 'null',
        providers: node ? this.providerCount(node) : 0,
      };
    });
  });

  /** Every injector that provides a token matching the search. */
  readonly providerHits = computed(() => {
    const q = this.normalizedQuery();
    if (!q) return [];
    const hits: { id: string; label: string; kind: string; tokens: string }[] = [];
    for (const node of this.index().map.values()) {
      if (this.isHiddenInjector(node)) continue;
      const tokens = node.providers.filter(
        (p) => !this.isHidden(p) && p.token.toLowerCase().includes(q),
      );
      if (!tokens.length) continue;
      hits.push({
        id: node.injector.id,
        label: labelOf(node),
        kind: kindOf(node),
        tokens: tokens.map((t) => t.token).join(', '),
      });
    }
    return hits;
  });
  readonly providedBy = computed(() => this.providerHits().slice(0, MAX_PROVIDED_BY));
  readonly providedByMore = computed(() =>
    Math.max(0, this.providerHits().length - MAX_PROVIDED_BY),
  );

  /** What a screen reader hears about the search results. */
  readonly searchSummary = computed(() => {
    const query = this.query().trim();
    if (!query) return '';
    const hits = this.providerHits().length;
    if (hits === 1) return `1 injector provides “${query}”.`;
    if (hits > 1) return `${hits} injectors provide “${query}”.`;
    if (!this.rows().length) return `Nothing here matches “${query}”.`;
    return `No injector provides “${query}”.`;
  });

  readonly normalizedQuery = computed(() => this.query().trim().toLowerCase());

  private stopTree: (() => void) | null = null;
  private treeLoad = 0;

  connect(rpc: Signal<DevframeRpcClient | null>) {
    this.rpcSource = rpc;
  }

  ngOnDestroy() {
    this.stopTree?.();
    this.highlight(null);
  }

  depKey(dep: { from: string; token: string; tokenId?: string }, index: number): string {
    return `${index}|${dep.from}|${dep.tokenId ?? dep.token}`;
  }

  toggleResolve(key: string) {
    this.resolvingKey.update((open) => (open === key ? null : key));
  }

  /** Turns "Hide framework" on or off and remembers the choice for the next visit. */
  setHideFramework(hide: boolean) {
    this.hideFramework.set(hide);
    storeFlag(HIDE_FRAMEWORK_PREF, hide);
  }

  /**
   * `(2 of 3)` for a token that several shown providers share (multi
   * providers), so their buttons and value regions get unique names; else ''.
   */
  tokenPosition(providers: readonly ProviderInfo[], index: number): string {
    const token = providers[index]?.token;
    let at = 0;
    let count = 0;
    providers.forEach((p, i) => {
      if (p.token !== token || this.isHidden(p)) return;
      count++;
      if (i <= index) at++;
    });
    return count > 1 ? `(${at} of ${count})` : '';
  }

  positionSuffix(providers: readonly ProviderInfo[], index: number): string {
    const position = this.tokenPosition(providers, index);
    return position ? ` ${position}` : '';
  }

  /** Whether a provider is left out of the lists while framework providers are hidden. */
  isHidden(provider: ProviderInfo): boolean {
    return this.hideFramework() && provider.framework === true;
  }

  private isHiddenInjector(node: InjectorNode): boolean {
    return this.hideFramework() && node.injector.framework === true;
  }

  /** How many providers the node shows. */
  providerCount(node: InjectorNode): number {
    if (!this.hideFramework()) return node.injector.providerCount;
    const hidden = node.providers.filter((p) => p.framework).length;
    return Math.max(0, node.injector.providerCount - hidden);
  }

  hiddenProviders(node: InjectorNode): number {
    return this.hideFramework() ? node.providers.filter((p) => p.framework).length : 0;
  }

  /** Loads the injector tree and the source scan again. The alert stays until they answer, so
   * focus stays on Retry while it is shown and moves to the toolbar when the alert goes, which
   * also happens when live injectors arrive but the source scan still fails. */
  async retry() {
    const client = this.rpc();
    if (!client || this.retrying()) return;
    const trigger = document.activeElement;
    this.retrying.set(true);
    try {
      await Promise.all([this.loadInjectorTree(client), this.loadSourceProviders(client)]);
    } finally {
      this.retrying.set(false);
    }
    if (this.destroyRef.destroyed) return;
    afterNextRender(
      () => {
        if (trigger?.isConnected && document.activeElement !== document.body) return;
        this.host.nativeElement
          .querySelector<HTMLElement>('.toolbar input, .toolbar button')
          ?.focus();
      },
      { injector: this.injector },
    );
  }

  /** Asks the shown page to read every injector again, element entries included. */
  refresh() {
    const pageId = this.shownPageId();
    if (!pageId) return;
    this.requestRefresh(pageId);
    this.announcement.set('Reading the injectors again.');
  }

  requestRefresh(pageId: string, injectorId?: string) {
    const client = this.rpc();
    if (!client) return;
    void client
      .scope('pangular')
      .rpc.call('request-injector-refresh', injectorId ? { pageId, injectorId } : { pageId })
      .catch(() => {});
  }

  kindById(id: string) {
    const node = this.index().map.get(id);
    return node ? kindOf(node) : 'null';
  }

  labelById(id: string) {
    const node = this.index().map.get(id);
    return node ? labelOf(node) : id === NULL_ID ? 'Null injector' : 'not listed';
  }

  matches(token: string) {
    const q = this.normalizedQuery();
    return !!q && token.toLowerCase().includes(q);
  }

  setView(view: TreeView) {
    if (this.view() === view) return;
    this.view.set(view);
    this.choose(null);
    this.focusId.set(null);
  }

  select(id: string) {
    this.choose(id);
    this.focusId.set(id);
  }

  choose(id: string | null) {
    const node = id ? this.index().map.get(id) : undefined;
    this.selectedId.set(id);
    this.selectedLabel.set(node ? labelOf(node) : null);
    this.wasGone = false;
  }

  /** Announces once when the chosen injector leaves the page, like the component tree does. */
  private syncGone() {
    const gone = this.gone() !== null;
    if (gone && !this.wasGone) {
      // A trailing no-break space makes a repeat differ, so screen readers say it again.
      const message = 'The selected injector is no longer on the page.';
      this.announcement.update((current) => (current === message ? `${message} ` : message));
    }
    this.wasGone = gone;
  }

  selectPage(pageId: string | null) {
    if (!pageId || pageId === this.shownPageId()) return;
    this.chosenPageId.set(pageId);
    this.wasGone = this.gone() !== null;
    const label = this.pageOptions().find((o) => o.value === pageId)?.label ?? pageId;
    this.announcement.set(`Showing the injectors of ${label}.`);
  }

  private notePageGone(pages: Record<string, InjectorPage> | undefined) {
    const chosen = this.chosenPageId();
    if (!chosen || pages?.[chosen]) return;
    const label = this.pageOptions().find((o) => o.value === chosen)?.label ?? 'The chosen page';
    this.chosenPageId.set(null);
    this.announcement.set(`${label} closed, so this shows another page.`);
    // The page that takes over brings its own selection; only a gone injector there is news.
    this.wasGone = true;
  }

  toggle(id: string, event?: Event) {
    event?.stopPropagation();
    if (this.normalizedQuery()) return;
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  reveal(id: string) {
    const node = this.index().map.get(id);
    if (!node) return;
    this.setView(node.injector.type === 'element' ? 'element' : 'environment');
    const { parents } = this.index();
    this.collapsed.update((set) => {
      const next = new Set(set);
      let parent = parents.get(id);
      while (parent) {
        next.delete(parent);
        parent = parents.get(parent);
      }
      return next;
    });
    if (this.onlyProviding() && this.providerCount(node) === 0) this.onlyProviding.set(false);
    if (node.injector.type === 'element' && !node.injector.component)
      this.componentsOnly.set(false);
    // Shows the target for now; the saved choice stays as it was.
    if (this.isHiddenInjector(node)) this.hideFramework.set(false);
    const q = this.normalizedQuery();
    if (q && !this.nodeMatches(node, q)) this.query.set('');
    this.select(id);
    afterNextRender(() => this.focusRow(id, false), { injector: this.injector });
  }

  highlight(node: InjectorNode | null) {
    const client = this.rpc();
    if (!client) return;
    const selector = node?.injector.type === 'element' ? (node.injector.selector ?? null) : null;
    const target = selector ? { pageId: this.shownPageId() || null, selector } : null;
    void client
      .scope('pangular')
      .rpc.call('request-page-highlight', target)
      .catch(() => {});
  }

  focusRow(id: string, focus: boolean) {
    const el = document.querySelector<HTMLElement>(`.row[data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    if (focus) el.focus();
    el.scrollIntoView({ block: 'nearest' });
  }

  private clearTree() {
    this.stopTree?.();
    this.stopTree = null;
  }

  async loadInjectorTree(client: DevframeRpcClient) {
    const load = ++this.treeLoad;
    this.clearTree();
    const my = client.scope('pangular');
    let state: Awaited<ReturnType<typeof my.rpc.sharedState>>;
    try {
      state = await my.rpc.sharedState('injector-tree');
    } catch {
      if (load === this.treeLoad) this.treeFailed.set(true);
      return;
    }
    if (this.destroyRef.destroyed || this.rpc() !== client || load !== this.treeLoad) return;
    this.treeFailed.set(false);
    const apply = (value: unknown) => {
      const next = value && typeof value === 'object' ? (value as InjectorTreeState) : null;
      this.notePageGone(next?.pages);
      this.treeState.set(next);
      this.syncGone();
    };
    apply(state.value());
    this.clearTree();
    this.stopTree = state.on('updated', apply);
  }

  async loadSourceProviders(client: DevframeRpcClient) {
    const my = client.scope('pangular');
    try {
      this.sourceProviders.set((await my.rpc.call('get-providers')) as SourceProvider[]);
      this.sourceFailed.set(false);
    } catch {
      this.sourceProviders.set([]);
      this.sourceFailed.set(true);
    } finally {
      this.loaded.set(true);
    }
  }

  private count(nodes: InjectorNode[]): number {
    return nodes.reduce((sum, n) => sum + 1 + this.count(n.children), 0);
  }

  nodeMatches(node: InjectorNode, q: string): boolean {
    const i = node.injector;
    return (
      i.name.toLowerCase().includes(q) ||
      !!i.component?.toLowerCase().includes(q) ||
      !!i.directives?.some((d) => d.toLowerCase().includes(q)) ||
      node.providers.some((p) => p.token.toLowerCase().includes(q)) ||
      !!node.dependencies?.some((d) => d.token.toLowerCase().includes(q))
    );
  }

  /** Leaves framework injectors out while they are hidden, moving their children up a level. */
  private withoutFramework(nodes: InjectorNode[]): InjectorNode[] {
    if (!this.hideFramework()) return nodes;
    const lift = (list: InjectorNode[]): InjectorNode[] =>
      list.flatMap((node) =>
        node.injector.framework
          ? lift(node.children)
          : [{ ...node, children: lift(node.children) }],
      );
    return lift(nodes);
  }

  private prune(nodes: InjectorNode[], keep: (node: InjectorNode) => boolean): InjectorNode[] {
    const out: InjectorNode[] = [];
    for (const node of nodes) {
      const children = this.prune(node.children, keep);
      if (keep(node) || children.length) out.push({ ...node, children });
    }
    return out;
  }
}
