import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { time } from '../../format';
import { LimitNote } from '../../ui/limit-note';
import { LiveControls, followNewest } from '../../ui/live-feed';
import { RovingList } from '../../ui/roving-list';
import { Splitter, storedPaneSize } from '../../ui/splitter';
import { VirtualWindow } from '../../ui/virtual-window';
import { StoreEntry } from './store-entry';
import { formatDuration, kindLabel, slice } from './store-format';
import { StoreState } from './store-state';

/** The change or action log of the shown store, with the detail of the picked entry. */
@Component({
  selector: 'section[appStoreLog]',
  imports: [LimitNote, LiveControls, RovingList, Splitter, StoreEntry],
  templateUrl: './store-log.html',
  styleUrl: './store-log.scss',
})
export class StoreLog {
  private readonly state = inject(StoreState);

  /** The change list width on wide panels, set by the splitter and saved. */
  protected readonly logListSize = signal(storedPaneSize('store-log', 300));
  protected readonly store = this.state.store;
  protected readonly page = this.state.page;
  protected readonly reduxPage = this.state.reduxPage;
  protected readonly maxLog = this.state.maxLog;
  protected readonly filter = this.state.filter;
  protected readonly logFeed = this.state.logFeed;
  protected readonly storeLog = this.state.storeLog;
  protected readonly selectedChangeSeq = this.state.selectedChangeSeq;
  protected readonly changeEntry = this.state.changeEntry;
  protected readonly changesLabel = this.state.changesLabel;
  protected readonly kindLabel = kindLabel;
  protected readonly formatTime = time;
  protected readonly formatDuration = formatDuration;

  /** Long logs render only the entries near view in their scroll box. */
  protected readonly logWindow = new VirtualWindow({
    count: computed(() => this.storeLog().length),
    estimate: 56,
  });
  protected readonly shownLog = computed(() => slice(this.storeLog(), this.logWindow));
  private readonly logList = viewChild<ElementRef<HTMLElement>>('logList');

  constructor() {
    // Newest first, so following the newest change keeps the log scrolled to the top.
    followNewest(this.logFeed, () => {
      const list = this.logList()?.nativeElement;
      if (list) list.scrollTop = 0;
    });
    effect(() => {
      const log = this.logList()?.nativeElement;
      if (log) this.logWindow.attach(log);
    });
  }

  protected selectChange(seq: number) {
    this.state.selectChange(seq);
  }

  protected isSkipped(seq: number): boolean {
    return this.state.isSkipped(seq);
  }
}
