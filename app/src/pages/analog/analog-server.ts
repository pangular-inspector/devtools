import { Component, ElementRef, inject } from '@angular/core';
import { time } from '../../format';
import { SearchField } from '../../ui/search-field';
import { SourceLink } from '../../ui/source-link';
import { AnalogPlayground } from '../analog-playground';
import { AnalogCallsState } from './analog-calls-state';
import {
  base,
  dir,
  short,
  statusClass,
  type ActionOutcome,
  type AnalogCall,
  type ApiRoute,
  type Kind,
} from './analog-model';
import { AnalogPageState } from './analog-page-state';

/** The Server view of the Analog page: the server calls, API routes, server functions and the playground. */
@Component({
  selector: 'div[appAnalogServer]',
  imports: [SearchField, SourceLink, AnalogPlayground],
  templateUrl: './analog-server.html',
  styleUrl: './analog-server.scss',
})
export class AnalogServer {
  private readonly page = inject(AnalogPageState);
  private readonly callsState = inject(AnalogCallsState);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly rpc = this.page.rpc;
  protected readonly project = this.page.project;
  protected readonly serverFns = this.page.serverFns;
  protected readonly devOrigin = this.page.devOrigin;
  protected readonly allCalls = this.page.allCalls;
  protected readonly tabCalls = this.page.tabCalls;
  protected readonly scopePageId = this.page.scopePageId;
  protected readonly allTabs = this.page.allTabs;

  protected readonly kinds = this.callsState.kinds;
  protected readonly kind = this.callsState.kind;
  protected readonly tryTarget = this.callsState.tryTarget;
  protected readonly maxServerCalls = this.callsState.maxServerCalls;
  protected readonly callQuery = this.callsState.callQuery;
  protected readonly failedOnly = this.callsState.failedOnly;
  protected readonly callsMessage = this.callsState.callsMessage;
  protected readonly callFiltered = this.callsState.callFiltered;
  protected readonly matchingCalls = this.callsState.matchingCalls;
  protected readonly calls = this.callsState.calls;
  protected readonly shownCount = this.callsState.shownCount;
  protected readonly serverFull = this.callsState.serverFull;
  protected readonly refetchedFns = this.callsState.refetchedFns;
  protected readonly duplicates = this.callsState.duplicates;

  protected readonly time = time;
  protected readonly short = short;
  protected readonly dir = dir;
  protected readonly base = base;
  protected readonly statusClass = statusClass;

  protected kindLabel(kind: Kind): string {
    return this.callsState.kindLabel(kind);
  }

  protected kindCount(kind: Kind): number {
    return this.callsState.kindCount(kind);
  }

  protected fnOf(call: AnalogCall) {
    return this.callsState.fnOf(call);
  }

  protected fnCalls(id: string): number {
    return this.callsState.fnCalls(id);
  }

  protected outcomeLabel(outcome: ActionOutcome): string {
    return this.callsState.outcomeLabel(outcome);
  }

  protected outcomeTone(outcome: ActionOutcome): string {
    return this.callsState.outcomeTone(outcome);
  }

  protected tryApi(api: ApiRoute) {
    this.callsState.tryApi(api);
  }

  protected pretty(text: string): string {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  protected clearCallFilters() {
    this.callsState.resetFilters();
    queueMicrotask(() =>
      this.host.nativeElement.querySelector<HTMLInputElement>('#analog-call-search')?.focus(),
    );
  }

  protected async clearCalls() {
    if (await this.callsState.clearCalls()) {
      // The button is disabled once the list is empty, so hand focus to the kind filter.
      queueMicrotask(() =>
        this.host.nativeElement
          .querySelector<HTMLInputElement>('input[name="analog-kind"]:checked')
          ?.focus(),
      );
    }
  }
}
