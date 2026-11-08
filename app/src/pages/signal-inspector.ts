import { Component, DestroyRef, effect, inject, input, untracked, viewChild } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { AngularUnavailable } from '../ui/angular-unavailable';
import { RovingList } from '../ui/roving-list';
import { Select } from '../ui/select';
import { SearchField } from '../ui/search-field';
import type { SignalFocus } from '../types/signal-focus.types';
import type { GraphInjector } from '../types/signal-graph.types';
import { ResourceList } from './signals/resource-list';
import { SignalDetailState } from './signals/signal-detail-state';
import { SignalGraphSection } from './signals/signal-graph-section';
import { SignalList } from './signals/signal-list';
import { kindColor, sourceNote, type SignalNode } from './signals/signal-model';
import { SignalState } from './signals/signal-state';
import { SourceSignals } from './signals/source-signals';
import { WatchedSignals } from './signals/watched-signals';

/**
 * The Signals page: the toolbar, the notes on what the graph shows, the kind chips and the load
 * states, and one section per part of the graph. The sections live in `./signals/` and share the
 * page's {@link SignalState} and {@link SignalDetailState}; the page keeps the members its tests
 * and the shell read on itself.
 */
@Component({
  selector: 'app-signal-inspector',
  imports: [
    AngularUnavailable,
    ResourceList,
    RovingList,
    SearchField,
    Select,
    SignalGraphSection,
    SignalList,
    SourceSignals,
    WatchedSignals,
  ],
  providers: [SignalState, SignalDetailState],
  templateUrl: './signal-inspector.html',
  styleUrl: './signal-inspector.scss',
})
export class SignalInspector {
  readonly rpc = input<DevframeRpcClient | null>(null);
  /** A component to show, from a deep link or the Components tab's "Show in Signals". */
  readonly focus = input<SignalFocus | null>(null);

  private readonly state = inject(SignalState);
  private readonly detail = inject(SignalDetailState);
  private readonly filterInput = viewChild<SearchField>('filterInput');

  readonly angularPage = this.state.angularPage;
  readonly chosenPageId = this.state.chosenPageId;
  readonly announcement = this.state.announcement;
  readonly shownPageId = this.state.shownPageId;
  readonly unsupported = this.state.unsupported;
  /** Whether the live graph state arrived, so the intro doesn't call it a source scan first. */
  protected readonly graphKnown = this.state.graphKnown;
  readonly graph = this.state.graph;
  readonly picked = this.state.picked;
  readonly pageOptions = this.state.pageOptions;
  readonly showInternals = this.state.showInternals;
  readonly sourceSignals = this.state.sourceSignals;
  readonly sourceLoaded = this.state.sourceLoaded;
  readonly loadFailed = this.state.loadFailed;
  readonly retrying = this.state.retrying;
  readonly filter = this.state.filter;
  readonly resources = this.state.resources;
  readonly showFramework = this.state.showFramework;
  readonly frameworkCount = this.state.frameworkCount;
  readonly visibleNodes = this.state.visibleNodes;
  readonly watchedNodes = this.state.watchedNodes;
  readonly watchedElsewhere = this.state.watchedElsewhere;
  readonly kindCounts = this.state.kindCounts;
  readonly kind = this.state.kind;
  readonly kindChips = this.state.kindChips;
  readonly kindTotal = this.state.kindTotal;
  readonly selectedId = this.state.selectedId;
  readonly selectedNode = this.state.selectedNode;
  readonly jumpNote = this.state.jumpNote;
  readonly writeHint = this.detail.writeHint;
  readonly filteredResources = this.state.filteredResources;
  readonly filteredNodes = this.state.filteredNodes;
  readonly filteredSourceSignals = this.state.filteredSourceSignals;
  readonly componentOptions = this.state.componentOptions;
  readonly pickerValue = this.state.pickerValue;
  readonly sourceNote = sourceNote;
  readonly kindColor = kindColor;

  constructor() {
    this.state.connect(this.rpc, () => this.filterInput());
    effect(() => {
      const client = this.rpc();
      if (!client) return;
      void this.state.loadSignalGraph(client);
      void this.state.loadSourceSignals(client);
    });
    effect(() => {
      const focus = this.focus();
      if (focus) untracked(() => this.state.showComponent(focus));
    });
    // Selects the focused signal once the graph of its component is in.
    effect(() => {
      const wanted = this.state.focusedSignal();
      const graph = this.graph();
      if (!wanted || graph?.component?.id !== wanted.componentId) return;
      const node = graph.nodes.find(
        (n) => n.locator?.id === wanted.componentId && n.locator.key === wanted.key,
      );
      untracked(() => {
        this.state.focusedSignal.set(null);
        if (node) this.state.jumpTo(node);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      for (const cleanup of this.state.cleanups.splice(0)) cleanup();
    });
  }

  selectPage(pageId: string | null) {
    this.state.selectPage(pageId);
  }

  pickComponent(value: string | null, forPage?: string) {
    this.state.pickComponent(value, forPage);
  }

  injectorLabel(injector: GraphInjector) {
    return this.state.injectorLabel(injector);
  }

  retry() {
    return this.state.retry();
  }

  clearFilters() {
    this.state.clearFilters();
  }

  select(id: string) {
    this.state.select(id);
  }

  getDependencies(node: SignalNode): SignalNode[] {
    return this.state.getDependencies(node);
  }

  getConsumers(node: SignalNode): SignalNode[] {
    return this.state.getConsumers(node);
  }
}
