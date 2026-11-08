import { Component, effect, inject, input, output, untracked, viewChild } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { plural } from '../format';
import { SearchField } from '../ui/search-field';
import { Select } from '../ui/select';
import { PipeAsync } from './pipes/pipe-async';
import { PipeDetail } from './pipes/pipe-detail';
import { PipeLint } from './pipes/pipe-lint';
import { PipeList } from './pipes/pipe-list';
import {
  KIND_OPTIONS,
  SORT_OPTIONS,
  describe,
  ms,
  sourceLabel,
  type LivePipeInfo,
  type PipeInfo,
  type PipeLintFinding,
  type PipeTarget,
} from './pipes/pipes-model';
import { PipesState } from './pipes/pipes-state';

/**
 * The Pipes page: the toolbar, the load states and one section per part of the page. The
 * sections live in `./pipes/` and share the page's {@link PipesState}; the page keeps the members
 * its tests and the shell read on itself.
 */
@Component({
  selector: 'app-pipes-inspector',
  imports: [PipeAsync, PipeDetail, PipeLint, PipeList, SearchField, Select],
  providers: [PipesState],
  templateUrl: './pipes-inspector.html',
  styleUrl: './pipes-inspector.scss',
})
export class PipesInspector {
  private readonly state = inject(PipesState);
  protected readonly plural = plural;
  private readonly filterInput = viewChild<SearchField>('filterInput');

  rpc = input<DevframeRpcClient | null>(null);
  /** A pipe name to select, from another tab such as Components. */
  readonly focus = input<string | null>(null);
  readonly focusHandled = output<void>();
  /** The page to show live data for, such as the page picked in Components.
   * Without one, the tab shows the page the panel belongs to. */
  readonly pageId = input<string | null>(null);

  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly sortOptions = SORT_OPTIONS;

  readonly pipes = this.state.pipes;
  readonly filter = this.state.filter;
  readonly kind = this.state.kind;
  readonly sort = this.state.sort;
  readonly loading = this.state.loading;
  readonly loadFailed = this.state.loadFailed;
  readonly selected = this.state.selected;
  readonly live = this.state.live;
  readonly async = this.state.async;
  /** Every `| async` usage, set only when the list was cut short. */
  readonly asyncTotal = this.state.asyncTotal;
  readonly lint = this.state.lint;
  readonly lintFailed = this.state.lintFailed;
  readonly instrumentedPages = this.state.instrumentedPages;
  readonly instrumenting = this.state.instrumenting;
  readonly pendingRecord = this.state.pendingRecord;
  readonly recordMessage = this.state.recordMessage;
  readonly recordLabel = this.state.recordLabel;
  /** The source scan plus the pipes seen only on the page, such as library pipes. */
  readonly allPipes = this.state.allPipes;
  readonly filtered = this.state.filtered;

  constructor() {
    this.state.connect(this.rpc, this.pageId);

    effect(() => {
      const client = this.rpc();
      if (client) {
        this.refresh();
        this.loadLive(client);
      }
    });

    // Waits for the pipe to be listed: the source scan or the page may answer later.
    effect(() => {
      const name = this.focus();
      if (!name) return;
      const pipe = this.state.pipesByName().get(name)?.[0];
      if (!pipe) return;
      untracked(() => {
        this.showPipe(pipe);
        this.focusHandled.emit();
      });
    });
  }

  refresh() {
    return this.state.refresh();
  }

  loadLint(client: DevframeRpcClient) {
    return this.state.loadLint(client);
  }

  loadLive(client: DevframeRpcClient) {
    return this.state.loadLive(client);
  }

  toggleInstrument() {
    return this.state.toggleInstrument();
  }

  sourceLabel(p: PipeInfo): string {
    return sourceLabel(p);
  }

  liveFor(name: string): LivePipeInfo | undefined {
    return this.state.liveFor(name);
  }

  ms(value: number): string {
    return ms(value);
  }

  describe(value: unknown): string {
    return describe(value);
  }

  isSelected(pipe: PipeInfo): boolean {
    return this.state.isSelected(pipe);
  }

  select(pipe: PipeInfo) {
    this.state.select(pipe);
  }

  /** The listed pipe a lint finding is about, or null when the pipe is not in the list. */
  pipeFor(finding: PipeLintFinding): PipeInfo | null {
    return this.state.pipeFor(finding);
  }

  /** Selects a pipe, clearing only the filters that hide it, then scrolls its row into view and
   * moves focus to the detail heading. */
  showPipe(pipe: PipeInfo) {
    this.state.showPipe(pipe);
  }

  clearFilters() {
    this.filter.set('');
    this.kind.set('all');
    this.filterInput()?.focus();
  }

  highlightPipe(live: LivePipeInfo | undefined) {
    this.state.highlightPipe(live);
  }

  highlight(target: PipeTarget | null | undefined, reveal = false) {
    this.state.highlight(target, reveal);
  }
}
