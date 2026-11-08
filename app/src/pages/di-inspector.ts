import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { DevframeRpcClient } from 'devframe/client';
import { angularPageFor, injectAngularPages } from '../angular-pages';
import { AngularUnavailable } from '../ui/angular-unavailable';
import { SearchField } from '../ui/search-field';
import { Select } from '../ui/select';
import { Splitter, storedPaneSize } from '../ui/splitter';
import type { ComponentFocus } from '../types/component-focus.types';
import type { InjectorFocus } from '../types/injector-focus.types';
import { StartupSection } from './startup-section';
import { InjectorDetail } from './injectors/injector-detail';
import { InjectorGone } from './injectors/injector-gone';
import {
  SEARCH_ANNOUNCE_MS,
  labelOf,
  toneOf,
  type InjectorNode,
  type TreeView,
} from './injectors/injector-model';
import { InjectorOrphans } from './injectors/injector-orphans';
import { InjectorTree } from './injectors/injector-tree';
import { InjectorsState } from './injectors/injectors-state';
import { SourceProviders } from './injectors/source-providers';
import { SourceScan } from './injectors/source-scan';

/**
 * The Injectors page: the toolbar, the notices and the tree with its detail, or the source scan
 * while no page reports a live tree. The sections live in `./injectors/` and share the page's
 * {@link InjectorsState} and {@link SourceScan}; the page keeps the members its tests and the
 * shell read on itself.
 */
@Component({
  selector: 'app-di-inspector',
  imports: [
    SearchField,
    Splitter,
    AngularUnavailable,
    NgTemplateOutlet,
    InjectorDetail,
    InjectorGone,
    InjectorOrphans,
    InjectorTree,
    Select,
    SourceProviders,
    StartupSection,
  ],
  providers: [InjectorsState, SourceScan],
  templateUrl: './di-inspector.html',
  styleUrl: './di-inspector.scss',
})
export class DiInspector {
  rpc = input<DevframeRpcClient | null>(null);
  /** An element injector to select, named by its component's id (from the Components tab). */
  readonly focus = input<InjectorFocus | null>(null);
  /** Whether the Components tab is on, so "Show in Components" can open it. */
  readonly canShowComponent = input(false);
  readonly focusHandled = output<void>();
  readonly showComponent = output<ComponentFocus>();

  private readonly state = inject(InjectorsState);
  private readonly scan = inject(SourceScan);

  private readonly angularPages = injectAngularPages(() => this.rpc());
  /** The shown page's Angular version and debug API parts, for the unavailable notes. */
  readonly angularPage = computed(() =>
    angularPageFor(this.angularPages(), this.shownPageId() || this.state.hostPage),
  );

  readonly chosenPageId = this.state.chosenPageId;
  readonly shownPageId = this.state.shownPageId;
  readonly roots = this.state.roots;
  readonly environment = this.state.environment;
  readonly truncated = this.state.truncated;
  readonly limits = this.state.limits;
  readonly zone = this.state.zone;
  readonly pageOptions = this.state.pageOptions;
  readonly sourceProviders = this.state.sourceProviders;
  readonly loaded = this.state.loaded;
  readonly loadFailed = this.state.loadFailed;
  readonly retrying = this.state.retrying;
  readonly view = this.state.view;
  readonly query = this.state.query;
  /** The detail width on wide panels, set by the splitter and saved per view. */
  readonly detailSize = signal(storedPaneSize('injectors', 420));
  private readonly queryInput = viewChild<SearchField>('queryInput');
  readonly onlyProviding = this.state.onlyProviding;
  readonly componentsOnly = this.state.componentsOnly;
  readonly hideFramework = this.state.hideFramework;
  readonly collapsed = this.state.collapsed;
  readonly selectedId = this.state.selectedId;
  readonly focusId = this.state.focusId;
  readonly announcement = this.state.announcement;
  readonly elementCount = this.state.elementCount;
  readonly environmentCount = this.state.environmentCount;
  readonly frameworkHiddenCount = this.state.frameworkHiddenCount;
  readonly frameworkHiddenText = this.state.frameworkHiddenText;
  readonly rows = this.state.rows;
  readonly selected = this.state.selected;
  readonly gone = this.state.gone;
  readonly rovingId = this.state.rovingId;
  readonly path = this.state.path;
  readonly providedBy = this.state.providedBy;
  readonly providedByMore = this.state.providedByMore;
  readonly resolvingKey = this.state.resolvingKey;

  readonly groupedProviders = this.scan.groupedProviders;
  readonly sourceMatchCount = this.scan.sourceMatchCount;
  readonly helpersOpen = this.scan.helpersOpen;
  readonly helpersShown = this.scan.helpersShown;
  readonly orphaned = this.scan.orphaned;
  readonly orphansOpen = this.scan.orphansOpen;
  readonly orphanedText = this.scan.orphanedText;

  private lastSearchMessage = '';
  /** The page and element injector the panel last asked the page to read again. */
  private refreshedKey: string | null = null;

  constructor() {
    this.state.connect(this.rpc);
    // One summary once typing pauses, instead of a live region that reads every keystroke.
    effect((onCleanup) => {
      const message = this.state.searchSummary();
      if (!message) {
        this.lastSearchMessage = '';
        return;
      }
      if (message === this.lastSearchMessage) return;
      const timer = setTimeout(() => {
        this.lastSearchMessage = message;
        this.announcement.set(message);
      }, SEARCH_ANNOUNCE_MS);
      onCleanup(() => clearTimeout(timer));
    });
    effect(() => {
      const client = this.rpc();
      if (!client) return;
      void this.state.loadInjectorTree(client);
      void this.state.loadSourceProviders(client);
    });
    // Element injectors are read once and cached on the page, so the selected
    // one is read again, once each time the selection moves to it.
    effect(() => {
      const sel = this.selected();
      const pageId = this.shownPageId();
      const id = sel?.injector.type === 'element' ? sel.injector.id : null;
      const key = id && pageId ? `${pageId}|${id}` : null;
      if (!key || key === this.refreshedKey) return;
      this.refreshedKey = key;
      untracked(() => this.state.requestRefresh(pageId!, id!));
    });
    // Page titles come from the component tree, and are only needed for the Page picker.
    effect((onCleanup) => {
      const client = this.rpc();
      if (!client || !this.state.multiPage()) return;
      let live = true;
      let stop: (() => void) | null = null;
      onCleanup(() => {
        live = false;
        stop?.();
      });
      client
        .scope('pangular')
        .rpc.sharedState('component-tree')
        .then((state) => {
          if (!live) return;
          const apply = (value: unknown) => {
            const pages = (value as { pages?: unknown } | null)?.pages;
            this.state.pageTitles.set(
              pages && typeof pages === 'object'
                ? (pages as Record<string, { title?: string; url?: string }>)
                : {},
            );
          };
          apply(state.value());
          stop = state.on('updated', apply);
        })
        .catch(() => {});
    });
    // A focus from the Components tab names the page it came from, which may not be the one shown.
    effect(() => {
      const focus = this.focus();
      if (!focus) return;
      const pages = this.state.treePages();
      const shown = this.shownPageId();
      if (focus.pageId && shown !== focus.pageId && pages[focus.pageId]) {
        untracked(() => this.selectPage(focus.pageId!));
        return;
      }
      if (!this.state.treeState() && !this.state.treeFailed()) return;
      untracked(() => {
        const onPage = !focus.pageId || shown === focus.pageId;
        const index = this.state.index();
        const id = onPage ? index.byComponent.get(focus.componentId) : undefined;
        const node = id ? index.map.get(id) : undefined;
        if (id && node) {
          this.reveal(id);
          this.announcement.set(`Showing the injector of ${labelOf(node)}.`);
        } else {
          this.announcement.set("That component's injector is not on this page.");
        }
        this.focusHandled.emit();
      });
    });
  }

  /** Turns "Hide framework" on or off and remembers the choice for the next visit. */
  setHideFramework(hide: boolean) {
    this.state.setHideFramework(hide);
  }

  /** Opens the Components tab on the component that owns this element injector. */
  openComponent(componentId: string) {
    const pageId = this.shownPageId();
    this.showComponent.emit(pageId ? { id: componentId, pageId } : { id: componentId });
  }

  retry() {
    return this.state.retry();
  }

  /** Asks the shown page to read every injector again, element entries included. */
  refresh() {
    this.state.refresh();
  }

  /** Clears the search from a no-match message and keeps focus on the search box. */
  clearQuery() {
    this.query.set('');
    this.queryInput()?.focus();
  }

  tone(kind: string) {
    return toneOf(kind);
  }

  providerCount(node: InjectorNode): number {
    return this.state.providerCount(node);
  }

  setView(view: TreeView) {
    this.state.setView(view);
  }

  select(id: string) {
    this.state.select(id);
  }

  selectPage(pageId: string | null) {
    this.state.selectPage(pageId);
  }

  toggle(id: string, event?: Event) {
    this.state.toggle(id, event);
  }

  reveal(id: string) {
    this.state.reveal(id);
  }

  highlight(node: InjectorNode | null) {
    this.state.highlight(node);
  }
}
