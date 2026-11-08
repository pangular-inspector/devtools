import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { LimitNote } from '../../ui/limit-note';
import { LiveControls, followNewest } from '../../ui/live-feed';
import { RovingList } from '../../ui/roving-list';
import { SearchField } from '../../ui/search-field';
import { Select } from '../../ui/select';
import { SortHeader } from '../../ui/sort-header';
import { VirtualWindow } from '../../ui/virtual-window';
import { NetworkWaterfall } from '../network-waterfall';
import { CallOriginTag } from './call-origin';
import { callTone, statusLabel, type HttpCall } from './http-model';
import { NetworkState } from './network-state';
import { ResponsePreview } from './response-preview';

/**
 * The HTTP timeline of the Network page: filters, the live controls, the call table or the
 * waterfall, and the response preview of the selected call.
 */
@Component({
  selector: 'section[appCallTimeline]',
  imports: [
    CallOriginTag,
    LimitNote,
    LiveControls,
    NetworkWaterfall,
    ResponsePreview,
    RovingList,
    SearchField,
    Select,
    SortHeader,
  ],
  templateUrl: './call-timeline.html',
  styleUrl: './call-timeline.scss',
})
export class CallTimeline {
  private readonly state = inject(NetworkState);
  protected readonly timeline = this.state.timeline;
  protected readonly droppedCalls = this.state.droppedCalls;
  protected readonly maxCalls = this.state.maxCalls;
  protected readonly callFeed = this.state.callFeed;
  protected readonly callQuery = this.state.callQuery;
  protected readonly callSort = this.state.callSort;
  protected readonly sideFilter = this.state.sideFilter;
  protected readonly sideOptions = this.state.sideOptions;
  protected readonly failedOnly = this.state.failedOnly;
  protected readonly timelineView = this.state.timelineView;
  protected readonly countText = this.state.countText;
  protected readonly filterStatus = this.state.filterStatus;
  protected readonly visibleCalls = this.state.visibleCalls;
  protected readonly waterfallCalls = this.state.waterfallCalls;
  protected readonly selectedCall = this.state.selectedCall;

  protected readonly callTone = callTone;
  protected readonly statusLabel = statusLabel;

  /** A long call list renders only the rows near view in its scroll box. */
  protected readonly callWindow = new VirtualWindow({
    count: computed(() => this.visibleCalls().length),
    estimate: 37,
  });
  protected readonly shownCalls = computed(() => {
    const { start, end } = this.callWindow.range();
    return this.visibleCalls()
      .slice(start, end)
      .map((entry, i) => ({ entry, index: start + i }));
  });
  private readonly callsBody = viewChild<ElementRef<HTMLElement>>('callsBody');

  constructor() {
    // Newest first, so following the newest call keeps the table scrolled to the top.
    followNewest(this.callFeed, () => {
      if (this.callSort()) return;
      // The SSR requests table comes first and has a .table-wrap too.
      const wrap = this.callsBody()?.nativeElement.closest<HTMLElement>('.table-wrap');
      if (wrap) wrap.scrollTop = 0;
    });
    effect(() => {
      const body = this.callsBody()?.nativeElement;
      if (body) this.callWindow.attach(body);
    });
  }

  protected rulePatternOf(call: HttpCall): string | null {
    return this.state.rulePatternOf(call);
  }

  protected openCall(id: string) {
    this.state.openCall(id);
  }

  protected closePreview() {
    this.state.closePreview();
  }

  protected clearCallFilters() {
    this.state.clearCallFilters();
  }
}
