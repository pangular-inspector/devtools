import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { AngularUnavailable } from '../ui/angular-unavailable';
import { Select } from '../ui/select';
import { SearchField } from '../ui/search-field';
import { CdRecording } from './cd-recording';
import { DeferBlocksSection, type DeferBlock } from './defer-blocks-section';
import { ForBlocksSection, type ForBlock } from './for-blocks-section';
import { HydrationSection } from './hydration-section';
import { LeaksSection } from './leaks-section';
import type { ComponentFocus } from '../types/component-focus.types';
import type { ComponentCommand } from '../types/component-command.types';
import type { InjectorFocus } from '../types/injector-focus.types';
import type { SignalFocus } from '../types/signal-focus.types';
import type { LiveNode } from './components/component-model';
import { ComponentDetail } from './components/component-detail';
import { DetailState } from './components/detail-state';
import { HostDetail } from './components/host-detail';
import { PickState } from './components/pick-state';
import { SourceList } from './components/source-list';
import { SourceScan } from './components/source-scan';
import { TreeRows } from './components/tree-rows';
import { TreeState } from './components/tree-state';

export { ancestors } from './components/component-model';

/**
 * The Components page: the live component tree with the selected instance's detail and the
 * page sections under it, or what the source declares when no page reports a tree. The sections
 * live in `./components/` and share the page's {@link TreeState}, {@link PickState},
 * {@link SourceScan} and {@link DetailState}; the page keeps the members the app and its tests
 * read on itself.
 */
@Component({
  selector: 'app-component-tree',
  imports: [
    SearchField,
    Select,
    CdRecording,
    DeferBlocksSection,
    ForBlocksSection,
    HydrationSection,
    LeaksSection,
    AngularUnavailable,
    TreeRows,
    HostDetail,
    ComponentDetail,
    SourceList,
  ],
  providers: [TreeState, PickState, SourceScan, DetailState],
  host: { '(keydown.escape)': 'cancelPick()', '(keydown)': 'pickKey($event)' },
  templateUrl: './component-tree.html',
  styleUrl: './component-tree.scss',
})
export class ComponentTree {
  readonly rpc = input<DevframeRpcClient | null>(null);
  readonly focus = input<ComponentFocus | null>(null);
  readonly showForm = output<string>();
  readonly focusHandled = output<void>();
  /** A palette command to run once the tree shows a live page. */
  readonly command = input<ComponentCommand | null>(null);
  readonly commandHandled = output<void>();
  /** Whether the Injectors tab is on, so "Show in Injectors" can open it. */
  readonly canShowInjector = input(false);
  /** Whether the Pipes inspector is on, so the detail lists the template's pipes. */
  readonly canShowPipes = input(false);
  /** Opens the Pipes tab on the pipe with this name, for the page the tree shows. */
  readonly showPipe = output<{ name: string; pageId?: string }>();
  readonly showInjector = output<InjectorFocus>();
  /** Whether the Signals tab is on, so "Show in Signals" can open it. */
  readonly canShowSignals = input(false);
  readonly showSignals = output<SignalFocus>();

  private readonly state = inject(TreeState);
  private readonly picker = inject(PickState);
  private readonly scan = inject(SourceScan);
  private readonly details = inject(DetailState);
  private readonly destroyRef = inject(DestroyRef);
  private readonly filterInput = viewChild<SearchField>('filterInput');
  private readonly cdRecording = viewChild(CdRecording);

  readonly staticReport = computed(() => this.state.staticReport());
  readonly filter = this.state.filter;
  readonly pages = this.state.pages;
  readonly chosenPageId = this.state.chosenPageId;
  readonly selectedId = this.state.selectedId;
  readonly destroyed = this.state.destroyed;
  readonly announcement = this.state.announcement;
  readonly pickMessage = this.state.pickMessage;
  readonly focusId = this.state.focusId;
  readonly collapsed = this.state.collapsed;
  readonly showDirectiveHosts = this.state.showDirectiveHosts;
  protected readonly pagesKnown = this.state.pagesKnown;
  readonly angularPage = this.state.angularPage;
  readonly deferUnavailable = this.state.deferUnavailable;
  readonly forUnavailable = this.state.forUnavailable;
  readonly page = this.state.page;
  readonly pageOptions = this.state.pageOptions;
  readonly live = this.state.live;
  readonly native = this.state.native;
  readonly canEdit = this.state.canEdit;
  readonly cdPage = this.state.cdPage;
  readonly cdHosts = this.state.cdHosts;
  readonly leaksPage = this.state.leaksPage;
  readonly deferBlocks = this.state.deferBlocks;
  readonly ownedDeferBlocks = this.state.ownedDeferBlocks;
  readonly countLabel = this.state.countLabel;
  readonly truncationText = this.state.truncationText;
  readonly rows = this.state.rows;
  readonly rowWindow = this.state.rowWindow;
  readonly shownRows = this.state.shownRows;
  readonly tabStop = this.state.tabStop;
  readonly selectedNode = this.state.selectedNode;
  readonly selectedHost = this.state.selectedHost;
  readonly detail = this.state.detail;
  readonly rovingId = this.state.rovingId;
  readonly routedById = this.state.routedById;

  readonly picking = this.picker.picking;
  readonly pickLabel = this.picker.pickLabel;

  readonly loading = this.scan.loading;
  readonly error = this.scan.error;
  readonly source = this.scan.source;
  readonly formOwners = this.scan.formOwners;
  readonly openKey = this.scan.openKey;
  readonly filteredSource = this.scan.filteredSource;
  readonly sourceCounts = this.scan.sourceCounts;

  readonly values = this.details.values;
  readonly propFilter = this.details.propFilter;
  readonly propQuery = this.details.propQuery;
  readonly shownValues = this.details.shownValues;
  readonly valueTotal = this.details.valueTotal;
  readonly propFilterStatus = this.details.propFilterStatus;
  readonly actionMessage = this.details.actionMessage;
  readonly copyMessage = this.details.copyMessage;
  readonly devtoolsActions = this.details.devtoolsActions;

  constructor() {
    const state = this.state;
    state.connect({
      rpc: this.rpc,
      canShowInjector: this.canShowInjector,
      canShowSignals: this.canShowSignals,
      canShowPipes: this.canShowPipes,
    });
    effect(() => this.details.followValues());
    effect(() => {
      const shown = this.page()?.pageId ?? null;
      untracked(() => this.picker.followPage(shown));
    });
    effect(() => this.details.trackChanges());
    this.destroyRef.onDestroy(() => this.details.clearChanges());
    effect(() => {
      const client = this.rpc();
      if (!client) return;
      void this.refresh();
      void state.watch(client);
    });
    effect(() => {
      const focus = this.focus();
      if (!focus) return;
      const shown = this.page()?.pageId ?? null;
      // The focus names the page it came from, which may not be the one shown.
      if (focus.pageId && shown !== focus.pageId && this.pages()[focus.pageId]) {
        untracked(() => this.selectPage(focus.pageId!));
        return;
      }
      if (!this.live()) return;
      untracked(() => {
        const onPage = !focus.pageId || shown === focus.pageId;
        if (onPage && state.index().map.has(focus.id)) this.reveal(focus.id);
        else this.announcement.set('That component is no longer on the page.');
        this.focusHandled.emit();
      });
    });
    effect(() => {
      const command = this.command();
      if (!command) return;
      if (!this.live()) {
        // The tab already explains that no live page is connected.
        if (this.pagesKnown()) untracked(() => this.commandHandled.emit());
        return;
      }
      if (command.kind === 'pick') {
        untracked(() => {
          if (!this.picking()) void this.pick();
          this.commandHandled.emit();
        });
        return;
      }
      const recording = this.cdRecording();
      if (!recording) {
        if (this.native() || this.staticReport()) {
          untracked(() => {
            state.say('This page cannot record change detection.');
            this.commandHandled.emit();
          });
        }
        return;
      }
      untracked(() => {
        if (command.kind === 'cd-clear') void recording.clear();
        else if ((command.kind === 'cd-start') !== recording.recording()) void recording.toggle();
        this.commandHandled.emit();
      });
    });
    this.destroyRef.onDestroy(() => state.destroy());
  }

  refresh() {
    return this.scan.refresh();
  }

  selectPage(pageId: string | null) {
    this.state.selectPage(pageId);
  }

  setFilter(value: string) {
    this.state.setFilter(value);
  }

  /** Clears the filter from the no-match state and keeps focus on the search box. */
  clearFilter() {
    if (this.live()) this.setFilter('');
    else this.filter.set('');
    this.filterInput()?.focus();
  }

  pick() {
    return this.picker.pick();
  }

  pickKey(event: KeyboardEvent) {
    this.picker.pickKey(event);
  }

  cancelPick() {
    this.picker.cancelPick();
  }

  select(id: string) {
    this.state.select(id);
  }

  toggleDirectiveHosts() {
    this.state.toggleDirectiveHosts();
  }

  setHydrationOverlay(on: boolean) {
    this.state.setHydrationOverlay(on);
  }

  /** Shows a node that the hydration summary names, when it is in the tree. */
  revealNode(id: string) {
    if (this.state.index().map.has(id)) this.reveal(id);
  }

  /** Shows a component a Leaks row names, and moves keyboard focus to its tree row. */
  showLeakComponent(id: string) {
    if (this.state.index().map.has(id)) this.reveal(id, true);
  }

  /** Opens the tree to a node and selects it; `focus` also moves keyboard focus to its row. */
  reveal(id: string, focus = false) {
    this.state.reveal(id, focus);
  }

  toggle(id: string, event?: Event) {
    this.state.toggle(id, event);
  }

  expandAll() {
    this.state.expandAll();
  }

  collapseAll() {
    this.state.collapseAll();
  }

  highlight(id: string | null) {
    this.state.highlight(id);
  }

  /** One box around every root element of the block, or its owner when none is rendered. */
  highlightBlock(block: DeferBlock) {
    this.state.highlightBlock(block);
  }

  showOwner(block: DeferBlock) {
    if (block.owner && this.state.index().map.has(block.owner.id)) this.reveal(block.owner.id);
  }

  /**
   * Shows an instance of a component class from the change detection recording,
   * the one checked most often when there are several.
   */
  showCdComponent(name: string) {
    const hosts = this.cdHosts();
    let best: LiveNode | null = null;
    for (const node of this.state.index().map.values()) {
      if (node.name !== name) continue;
      if (!best || (hosts[node.id] ?? 0) > (hosts[best.id] ?? 0)) best = node;
    }
    if (!best) {
      this.state.say(`No ${name} is in the tree now.`);
      return;
    }
    this.state.say(`Showing ${name} in the tree.`);
    this.reveal(best.id);
  }

  showForOwner(block: ForBlock) {
    if (block.owner && this.state.index().map.has(block.owner.id)) this.reveal(block.owner.id);
  }

  /** The nearest component above a row, such as the one whose template renders a directive host. */
  ownerOf(id: string): LiveNode | null {
    return this.state.ownerOf(id);
  }
}
