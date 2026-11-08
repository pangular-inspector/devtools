import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { time } from '../../format';
import { RovingList } from '../../ui/roving-list';
import { VirtualWindow } from '../../ui/virtual-window';
import { pretty, short } from '../store-types';
import { StoreActions } from './store-actions';
import { StoreEntry } from './store-entry';
import { kindColor, slice } from './store-format';
import { StoreState } from './store-state';

/** The Events section: events dispatched through `@ngrx/signals/events` on the shown page. */
@Component({
  selector: 'section[appStoreEvents]',
  imports: [RovingList, StoreEntry],
  templateUrl: './store-events.html',
  styleUrl: './store-events.scss',
})
export class StoreEvents {
  private readonly state = inject(StoreState);
  private readonly actions = inject(StoreActions);
  private readonly eventsList = viewChild<ElementRef<HTMLElement>>('eventsList');
  private readonly eventDetailHeading = viewChild<ElementRef<HTMLElement>>('eventDetailHeading');

  protected readonly pageEvents = this.state.pageEvents;
  protected readonly selectedEventSeq = this.state.selectedEventSeq;
  protected readonly eventEntry = this.state.eventEntry;
  protected readonly kindColor = kindColor;
  protected readonly formatTime = time;

  protected readonly eventWindow = new VirtualWindow({
    count: computed(() => this.pageEvents().length),
    estimate: 36,
  });
  protected readonly shownEvents = computed(() => slice(this.pageEvents(), this.eventWindow));

  constructor() {
    effect(() => {
      const events = this.eventsList()?.nativeElement;
      if (events) this.eventWindow.attach(events);
    });
    afterRenderEffect(() => {
      const seq = this.actions.focusEventSeq();
      const detail = this.eventDetailHeading();
      if (seq === null || !detail) return;
      this.actions.focusEventSeq.set(null);
      detail.nativeElement.focus();
    });
  }

  protected selectEvent(seq: number) {
    this.actions.selectEvent(seq);
  }

  protected prettyText(value: unknown) {
    return pretty(value);
  }

  protected shortText(value: unknown) {
    return short(value);
  }
}
