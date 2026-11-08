import {
  ElementRef,
  Injectable,
  Injector,
  afterNextRender,
  computed,
  inject,
  linkedSignal,
  signal,
  type Signal,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import {
  angularVersionAtLeast,
  lacksCapability,
} from '@pangular-inspector/devtools/internal/config';
import { hostPageId } from '../../page-id';
import { angularPageFor, injectAngularPages } from '../../angular-pages';
import { pickPage } from '../../live-pages';
import { isNativePage } from '../../native-page';
import { isStaticReport } from '../../rpc';
import { actionAllowed } from '../../devtools-config';
import type { SelectOption } from '../../ui/select';
import { VirtualWindow } from '../../ui/virtual-window';
import { keepBelowSticky, stickyClearance } from '../../ui/sticky-clearance';
import {
  countText,
  filterAnnouncement,
  filterTree,
  nearestRow,
  reconcileSelection,
  truncationNotice,
  withoutDirectiveHosts,
} from '../component-tree-state';
import type { CdPage } from '../cd-recording';
import type { DeferBlock } from '../defer-blocks-section';
import type { LeaksPage } from '../leaks-section';
import {
  DIRECTIVE_HOSTS_KEY,
  TREE_ROW_PX,
  ancestors,
  storedDirectiveHosts,
  type LiveNode,
  type OutletInfo,
  type Page,
  type RoutedHit,
  type Row,
} from './component-model';

/** The page inputs the state reads, connected by the page. */
export interface TreeInputs {
  rpc: Signal<DevframeRpcClient | null>;
  /** Whether the Injectors tab is on, so "Show in Injectors" can open it. */
  canShowInjector: Signal<boolean>;
  /** Whether the Signals tab is on, so "Show in Signals" can open it. */
  canShowSignals: Signal<boolean>;
  /** Whether the Pipes inspector is on, so the detail lists the template's pipes. */
  canShowPipes: Signal<boolean>;
}

/**
 * The state the Components page and its sections share: the `component-tree`, `change-detection`,
 * `leaks` and `router` shared states, the shown page, the tree rows with their filter and
 * collapsed nodes, the selection and the live message. Provided by the page, so every section of
 * one page reads the same signals.
 */
@Injectable()
export class TreeState {
  private inputs: TreeInputs = {
    rpc: signal(null),
    canShowInjector: signal(false),
    canShowSignals: signal(false),
    canShowPipes: signal(false),
  };
  readonly rpc = computed(() => this.inputs.rpc());
  readonly canShowInjector = computed(() => this.inputs.canShowInjector());
  readonly canShowSignals = computed(() => this.inputs.canShowSignals());
  readonly canShowPipes = computed(() => this.inputs.canShowPipes());
  readonly staticReport = computed(() => isStaticReport(this.rpc()));

  readonly filter = signal('');
  readonly pages = signal<Record<string, Page>>({});
  readonly chosenPageId = signal<string | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly destroyed = signal<string | null>(null);
  readonly announcement = signal('');
  readonly pickMessage = signal('');
  readonly focusId = signal<string | null>(null);
  readonly collapsed = signal<ReadonlySet<string>>(new Set());
  /** Elements that host directives but no component show as rows; this viewer can hide them. */
  readonly showDirectiveHosts = signal(storedDirectiveHosts());
  private readonly routerPages = signal<{ pageId?: string; outlets?: OutletInfo[] }[]>([]);
  private readonly pageId = hostPageId();
  private readonly angularPages = injectAngularPages(() => this.rpc());
  /** The shown page's Angular version and debug API parts, for the unavailable notes. */
  readonly angularPage = computed(() =>
    angularPageFor(this.angularPages(), this.page()?.pageId ?? this.pageId),
  );
  /** `@defer` and `@for` exist from Angular 17.0, so older pages get no note about them. */
  private readonly hasControlFlow = computed(() => {
    const version = this.angularPage()?.version;
    return !version || angularVersionAtLeast(version, '17.0');
  });
  readonly deferUnavailable = computed(
    () => this.hasControlFlow() && lacksCapability(this.angularPage(), 'deferBlocks'),
  );
  readonly forUnavailable = computed(
    () => this.hasControlFlow() && lacksCapability(this.angularPage(), 'forBlocks'),
  );
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Whether the server sent the component tree state yet, so an empty one means no page. */
  readonly pagesKnown = signal(false);
  private readonly cleanups: (() => void)[] = [];
  private selection = { pageId: null as string | null, detailId: null as string | null };
  /** Set once the page is destroyed, so a late shared state answer is dropped. */
  private gone = false;

  private readonly shownPageId = linkedSignal<
    { pages: Record<string, Page>; chosen: string | null },
    string | null
  >({
    source: () => ({ pages: this.pages(), chosen: this.chosenPageId() }),
    computation: ({ pages, chosen }, previous) =>
      pickPage(pages, { chosen, host: this.pageId, previous: previous?.value ?? null }),
  });

  readonly page = computed<Page | null>(() => {
    const id = this.shownPageId();
    return id ? (this.pages()[id] ?? null) : null;
  });

  readonly pageOptions = computed<SelectOption[]>(() =>
    Object.values(this.pages()).map((page) => ({
      value: page.pageId,
      label: page.title || page.url || `Page ${page.pageId}`,
      hint: page.url,
    })),
  );

  readonly live = computed(() => (this.page()?.roots.length ?? 0) > 0);
  readonly native = computed(() => isNativePage(this.page()));
  /** Inputs, properties and writable signals are editable on a live browser page. */
  readonly canEdit = computed(
    () =>
      this.live() &&
      !this.native() &&
      !this.staticReport() &&
      actionAllowed(this.rpc(), 'components'),
  );

  private readonly cdPages = signal<Record<string, CdPage>>({});
  readonly cdPage = computed(() => {
    const pageId = this.page()?.pageId;
    return pageId ? (this.cdPages()[pageId] ?? null) : null;
  });
  readonly cdHosts = computed(() => this.cdPage()?.hosts ?? {});

  private readonly leaksPages = signal<Record<string, LeaksPage>>({});
  /** The shown page's leak report, from the `leaks` shared state. */
  readonly leaksPage = computed(() => {
    const pageId = this.page()?.pageId;
    return pageId ? (this.leaksPages()[pageId] ?? null) : null;
  });

  /** The page's tree, without directive hosts when this viewer hid them. */
  private readonly visibleRoots = computed(() => {
    const roots = this.page()?.roots ?? [];
    return this.showDirectiveHosts() || !this.page()?.directiveHostCount
      ? roots
      : withoutDirectiveHosts(roots);
  });

  readonly index = computed(() => {
    const map = new Map<string, LiveNode>();
    const parents = new Map<string, string>();
    const walk = (nodes: LiveNode[], parent: string | null) => {
      for (const node of nodes) {
        // The first row with an id wins, so `parents` can never loop.
        if (map.has(node.id)) continue;
        map.set(node.id, node);
        if (parent) parents.set(node.id, parent);
        walk(node.children, node.id);
      }
    };
    walk(this.visibleRoots(), null);
    return { map, parents };
  });

  readonly query = computed(() => this.filter().trim().toLowerCase());

  private readonly filtered = computed(() => filterTree(this.visibleRoots(), this.query()));

  /** Directive host rows in the tree as shown. */
  private readonly shownDirectiveHosts = computed(() =>
    this.showDirectiveHosts() ? (this.page()?.directiveHostCount ?? 0) : 0,
  );

  readonly deferBlocks = computed(() => this.page()?.deferBlocks ?? []);
  /** The defer blocks in the selected component's template. */
  readonly ownedDeferBlocks = computed(() => {
    const id = this.selectedId();
    return id ? this.deferBlocks().filter((block) => block.owner?.id === id) : [];
  });

  readonly countLabel = computed(() =>
    countText(
      this.page()?.count ?? 0,
      this.filtered().matches,
      !!this.query(),
      !!this.page()?.truncated,
      this.shownDirectiveHosts(),
    ),
  );

  readonly truncationText = computed(() => truncationNotice(this.page()?.truncatedBy));

  readonly rows = computed<Row[]>(() => {
    const rows: Row[] = [];
    const collapsed = this.collapsed();
    const searching = !!this.query();
    const walk = (nodes: LiveNode[], depth: number) => {
      nodes.forEach((node, i) => {
        const expanded = searching || !collapsed.has(node.id);
        rows.push({
          node,
          depth,
          hasChildren: node.children.length > 0,
          expanded,
          posinset: i + 1,
          setsize: nodes.length,
        });
        if (expanded) walk(node.children, depth + 1);
      });
    };
    walk(this.filtered().nodes, 0);
    return rows;
  });

  /** A long tree renders only the rows near the visible part of the page. */
  readonly rowWindow = new VirtualWindow({
    count: computed(() => this.rows().length),
    estimate: TREE_ROW_PX,
    fixed: true,
  });
  readonly shownRows = computed(() => {
    const { start, end } = this.rowWindow.range();
    return this.rows()
      .slice(start, end)
      .map((row, i) => ({ row, index: start + i }));
  });
  /** The row Tab lands on: the roving one, or the first rendered row when it is out of view. */
  readonly tabStop = computed(() => {
    const id = this.rovingId();
    const shown = this.shownRows();
    return shown.some(({ row }) => row.node.id === id) ? id : (shown[0]?.row.node.id ?? null);
  });

  readonly selectedNode = computed(() => {
    const id = this.selectedId();
    return id ? (this.index().map.get(id) ?? null) : null;
  });

  /** The selected row when it is a directive host, which has no component detail. */
  readonly selectedHost = computed(() => {
    const node = this.selectedNode();
    return node?.kind === 'directive' ? node : null;
  });

  readonly detail = computed(() => {
    const detail = this.page()?.detail;
    return detail && detail.id === this.selectedId() ? detail : null;
  });

  readonly rovingId = computed(() => {
    const rows = this.rows();
    const ids = new Set(rows.map((r) => r.node.id));
    const focus = this.focusId();
    if (focus && ids.has(focus)) return focus;
    const selected = this.selectedId();
    if (selected && ids.has(selected)) return selected;
    return rows[0]?.node.id ?? null;
  });

  private readonly outlets = computed<OutletInfo[]>(() => {
    const shown = this.page()?.pageId;
    return this.routerPages().find((p) => p.pageId === shown)?.outlets ?? [];
  });

  readonly routedById = computed(() => {
    const map = new Map<string, RoutedHit[]>();
    const visit = (outlets: OutletInfo[]) => {
      for (const outlet of outlets) {
        if (outlet.activated && outlet.devtoolsId) {
          const hits = map.get(outlet.devtoolsId) ?? [];
          hits.push({ route: outlet.route ?? '', outlet: outlet.outlet });
          map.set(outlet.devtoolsId, hits);
        }
        if (outlet.children) visit(outlet.children);
      }
    };
    visit(this.outlets());
    return map;
  });

  /** Reads the page's inputs. Call once, from the page's constructor. */
  connect(inputs: TreeInputs) {
    this.inputs = inputs;
  }

  /** Stops following the shared states, when the page is destroyed. */
  destroy() {
    this.gone = true;
    this.highlight(null);
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }

  async watch(client: DevframeRpcClient) {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    const my = client.scope('pangular');
    try {
      const tree = await my.rpc.sharedState('component-tree');
      if (this.gone) return;
      const applyTree = (value: unknown) => {
        const pages = (value as { pages?: Record<string, Page> } | null)?.pages;
        this.applyPages(pages && typeof pages === 'object' ? pages : {});
        // A state the client hasn't loaded from the server yet says nothing.
        if (value !== undefined) this.pagesKnown.set(true);
      };
      applyTree(tree.value());
      this.cleanups.push(tree.on('updated', applyTree));
    } catch {
      this.applyPages({});
      this.pagesKnown.set(true);
    }
    try {
      const cd = await my.rpc.sharedState('change-detection');
      if (this.gone) return;
      const applyCd = (value: unknown) => {
        const pages = (value as { pages?: Record<string, CdPage> } | null)?.pages;
        this.cdPages.set(pages && typeof pages === 'object' ? pages : {});
      };
      applyCd(cd.value());
      this.cleanups.push(cd.on('updated', applyCd));
    } catch {
      this.cdPages.set({});
    }
    try {
      const leaks = await my.rpc.sharedState('leaks');
      if (this.gone) return;
      const applyLeaks = (value: unknown) => {
        const pages = (value as { pages?: Record<string, LeaksPage> } | null)?.pages;
        this.leaksPages.set(pages && typeof pages === 'object' ? pages : {});
      };
      applyLeaks(leaks.value());
      this.cleanups.push(leaks.on('updated', applyLeaks));
    } catch {
      this.leaksPages.set({});
    }
    try {
      const router = await my.rpc.sharedState('router');
      if (this.gone) return;
      const applyRouter = (value: unknown) => {
        const pages = (value as { pages?: { pageId?: string; outlets?: OutletInfo[] }[] })?.pages;
        this.routerPages.set(Array.isArray(pages) ? pages : []);
      };
      applyRouter(router.value());
      this.cleanups.push(router.on('updated', applyRouter));
    } catch {
      this.routerPages.set([]);
    }
  }

  private applyPages(pages: Record<string, Page>) {
    const active = document.activeElement;
    const focused =
      active instanceof HTMLElement && this.host.nativeElement.contains(active)
        ? (active.closest<HTMLElement>('.row')?.dataset['id'] ?? null)
        : null;
    const before = focused ? this.rows().map((row) => row.node.id) : [];
    const known = this.index().map;
    this.pages.set(pages);
    this.syncSelection(known);
    if (!focused) return;
    const after = new Set(this.rows().map((row) => row.node.id));
    if (after.has(focused)) return;
    const next = nearestRow(before, after, focused);
    if (!next) return;
    this.focusId.set(next);
    afterNextRender(() => this.rowElement(next)?.focus(), { injector: this.injector });
  }

  private syncSelection(known = this.index().map) {
    const page = this.page();
    const next = reconcileSelection(
      { ...this.selection, selectedId: this.selectedId() },
      page
        ? { pageId: page.pageId, roots: page.roots, detail: page.detail, truncated: page.truncated }
        : null,
    );
    const name = next.destroyed ? known.get(next.destroyed)?.name : undefined;
    this.selection = { pageId: next.pageId, detailId: next.detailId };
    if (next.selectedId !== this.selectedId()) this.selectedId.set(next.selectedId);
    if (next.selectedId) this.destroyed.set(null);
    if (!next.destroyed) return;
    this.destroyed.set(name ?? 'The component');
    this.announcement.set('The selected component was destroyed.');
    this.sendSelection(null);
  }

  selectPage(pageId: string | null) {
    if (!pageId) return;
    this.chosenPageId.set(pageId);
    this.destroyed.set(null);
    this.syncSelection();
  }

  setFilter(value: string) {
    this.filter.set(value);
    const { matches } = this.filtered();
    this.announcement.set(
      filterAnnouncement(
        this.page()?.count ?? 0,
        matches,
        value,
        !!this.page()?.truncated,
        this.shownDirectiveHosts(),
      ),
    );
  }

  /** Shows a message under the toolbar and says it. */
  say(message: string) {
    this.pickMessage.set(message);
    this.announce(message);
  }

  private sendSelection(id: string | null) {
    const client = this.rpc();
    if (!client) return;
    void client
      .scope('pangular')
      .rpc.call('select-component', { pageId: this.page()?.pageId, id, console: true })
      .catch(() => {});
  }

  private rowElement(id: string) {
    return this.host.nativeElement.querySelector<HTMLElement>(`.row[data-id="${CSS.escape(id)}"]`);
  }

  select(id: string) {
    const next = this.selectedId() === id ? null : id;
    this.selectedId.set(next);
    this.destroyed.set(null);
    this.focusId.set(id);
    // A directive host has no component detail for the page to send.
    if (next && this.index().map.get(next)?.kind === 'directive') return;
    this.sendSelection(next);
  }

  /** The nearest component above a row, such as the one whose template renders a directive host. */
  ownerOf(id: string): LiveNode | null {
    const { map, parents } = this.index();
    for (const parent of ancestors(parents, id)) {
      const node = map.get(parent);
      if (node && node.kind !== 'directive') return node;
    }
    return null;
  }

  toggleDirectiveHosts() {
    const next = !this.showDirectiveHosts();
    this.showDirectiveHosts.set(next);
    try {
      localStorage.setItem(DIRECTIVE_HOSTS_KEY, next ? 'shown' : 'hidden');
    } catch {
      // the choice lasts for this view only
    }
    const selected = this.selectedId();
    if (!next && selected && !this.index().map.has(selected)) this.selectedId.set(null);
    this.announce(next ? 'Directive hosts are shown.' : 'Directive hosts are hidden.');
  }

  setHydrationOverlay(on: boolean) {
    const client = this.rpc();
    const pageId = this.page()?.pageId;
    if (!client || !pageId) return;
    void client
      .scope('pangular')
      .rpc.call('request-hydration-overlay', { pageId, on })
      .catch(() => {});
    this.announce(on ? 'Outlining hydration on the page.' : 'Hydration outline removed.');
  }

  /** Opens the tree to a node and selects it; `focus` also moves keyboard focus to its row. */
  reveal(id: string, focus = false) {
    const { parents } = this.index();
    this.collapsed.update((set) => {
      const next = new Set(set);
      for (const parent of ancestors(parents, id)) next.delete(parent);
      return next;
    });
    if (!this.rows().some((row) => row.node.id === id)) this.setFilter('');
    if (this.selectedId() !== id) this.select(id);
    if (focus) this.focusId.set(id);
    // In a long tree the row may be outside the rendered window.
    const index = this.rows().findIndex((row) => row.node.id === id);
    if (index >= 0) this.rowWindow.reveal(index);
    afterNextRender(
      () => {
        const row = document.querySelector<HTMLElement>(`.row[data-id="${CSS.escape(id)}"]`);
        this.clearToolbar();
        row?.scrollIntoView({ block: 'nearest' });
        if (row) this.keepBelowToolbar(row);
        if (focus) row?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  /**
   * Sets the rows' `scroll-margin-top` so a row scrolled into view sits below
   * the sticky toolbar, whose height changes as it wraps and which sticks
   * inside the scroller's padding.
   */
  clearToolbar() {
    const toolbar = this.host.nativeElement.querySelector<HTMLElement>('.toolbar');
    if (!toolbar) return;
    this.host.nativeElement.style.setProperty(
      '--ct-toolbar-clearance',
      `${stickyClearance(toolbar)}px`,
    );
  }

  /** Moves a row the sticky toolbar covers back below it. */
  keepBelowToolbar(row: HTMLElement) {
    const toolbar = this.host.nativeElement.querySelector<HTMLElement>('.toolbar');
    if (toolbar) keepBelowSticky(row, toolbar);
  }

  toggle(id: string, event?: Event) {
    event?.stopPropagation();
    if (this.query()) return;
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  expandAll() {
    if (this.query()) return;
    this.collapsed.set(new Set());
    this.announce('Expanded every component.');
  }

  collapseAll() {
    if (this.query()) return;
    const { map, parents } = this.index();
    const previous = this.rovingId();
    const next = new Set<string>();
    for (const node of map.values()) if (node.children.length) next.add(node.id);
    this.collapsed.set(next);
    if (previous) {
      const visible = new Set(this.rows().map((row) => row.node.id));
      let id: string | undefined = previous;
      while (id && !visible.has(id)) id = parents.get(id);
      if (id) this.focusId.set(id);
    }
    this.announce('Collapsed every component. Only the top level is shown.');
  }

  /** Sets the live message, changing it slightly when it repeats so screen readers say it again. */
  announce(message: string) {
    this.announcement.update((current) => (current === message ? `${message} ` : message));
  }

  expandSiblings(id: string) {
    if (this.query()) return;
    const parent = this.index().parents.get(id);
    const siblings = parent
      ? (this.index().map.get(parent)?.children ?? [])
      : (this.page()?.roots ?? []);
    this.collapsed.update((set) => {
      const next = new Set(set);
      for (const sibling of siblings) next.delete(sibling.id);
      return next;
    });
  }

  highlight(id: string | null) {
    this.requestHighlight(id ? { id } : null);
  }

  /** One box around every root element of the block, or its owner when none is rendered. */
  highlightBlock(block: DeferBlock) {
    if (block.rootIds.length > 1) this.requestHighlight({ ids: block.rootIds });
    else this.highlight(block.rootIds[0] ?? block.owner?.id ?? null);
  }

  private requestHighlight(target: { id: string } | { ids: string[] } | null) {
    const client = this.rpc();
    if (!client) return;
    void client
      .scope('pangular')
      .rpc.call('request-page-highlight', target && { pageId: this.page()?.pageId, ...target })
      .catch(() => {});
  }
}
