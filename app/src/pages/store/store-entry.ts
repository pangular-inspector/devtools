import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, effect, inject, input, viewChild } from '@angular/core';
import { time } from '../../format';
import { SourceLink } from '../../ui/source-link';
import { EntryTabs } from '../store-entry-tabs';
import { moreChangesText, pretty, short, traceFrame, type NgrxLogEntry } from '../store-types';
import { StoreActions } from './store-actions';
import { formatDuration, opLabel, originText } from './store-format';
import { StoreState } from './store-state';

/**
 * The detail of one log entry, shared by the store's change log and the page-level Events
 * section (reachable with no live store at all, since a page can dispatch
 * `@ngrx/signals/events` without any signalStore/signalState instance).
 */
@Component({
  selector: 'section[appStoreEntry]',
  imports: [EntryTabs, NgTemplateOutlet, SourceLink],
  host: { '[attr.aria-labelledby]': "prefix() + '-entry-heading'" },
  templateUrl: './store-entry.html',
  styleUrl: './store-entry.scss',
})
export class StoreEntry {
  private readonly state = inject(StoreState);
  private readonly actions = inject(StoreActions);
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  private readonly restoreButton = viewChild<ElementRef<HTMLButtonElement>>('restoreButton');

  /** Read in the template as `selected`, `headingLevel` and `idPrefix`, as before the split. */
  readonly entry = input.required<NgrxLogEntry>({ alias: 'selected' });
  readonly level = input.required<number>({ alias: 'headingLevel' });
  readonly prefix = input.required<string>({ alias: 'idPrefix' });

  protected readonly store = this.state.store;
  protected readonly confirmSeq = this.state.confirmSeq;
  protected readonly canRestore = this.state.canRestore;
  protected readonly restoreOff = this.state.restoreOff;
  protected readonly loadEntry = this.state.loadEntry;
  protected readonly busy = this.actions.busy;
  protected readonly formatTime = time;
  protected readonly formatDuration = formatDuration;
  protected readonly originText = originText;
  protected readonly opLabel = opLabel;
  protected readonly moreChanges = moreChangesText;

  constructor() {
    effect(() => {
      const target = this.actions.focusConfirm();
      const button = target === 'cancel' ? this.cancelButton() : this.restoreButton();
      if (!target || !button) return;
      this.actions.focusConfirm.set(null);
      button.nativeElement.focus();
    });
  }

  protected traceFrames(trace: string[]) {
    return trace.map(traceFrame);
  }

  protected prettyText(value: unknown) {
    return pretty(value);
  }

  protected shortText(value: unknown) {
    return short(value);
  }

  protected copyDiff(entry: NgrxLogEntry) {
    return this.state.copyDiff(entry);
  }

  protected isSkipped(seq: number): boolean {
    return this.state.isSkipped(seq);
  }

  protected canToggle(entry: NgrxLogEntry): boolean {
    return this.state.canToggle(entry);
  }

  protected canAgain(entry: NgrxLogEntry): boolean {
    return this.state.canAgain(entry);
  }

  protected askRestore(seq: number) {
    this.actions.askRestore(seq);
  }

  protected cancelRestore(event?: Event) {
    this.actions.cancelRestore(event);
  }

  protected restore(seq: number, pauses: boolean) {
    return this.actions.restore(seq, pauses);
  }

  protected devtoolsOp(request: { op: string; seq?: number; index?: number; paused?: boolean }) {
    return this.actions.devtoolsOp(request);
  }

  protected dispatchAgain(seq: number) {
    return this.actions.dispatchAgain(seq);
  }
}
