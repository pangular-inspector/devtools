import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { rpcCall } from '../../rpc';
import type { PlaygroundTarget } from '../analog-playground';
import {
  KIND_LABEL,
  MAX_SERVER_CALLS,
  MAX_SHOWN_CALLS,
  OUTCOME_LABEL,
  OUTCOME_TONE,
  type ActionOutcome,
  type AnalogCall,
  type ApiRoute,
  type Kind,
  type ServerFn,
  type View,
} from './analog-model';
import { AnalogPageState } from './analog-page-state';

/**
 * The Server view's call list: the kind, search and failed filters, the warnings about reads
 * that ran twice, and the route the last Try button handed to the playground. Kept on the page,
 * so the filters stay set when another view is open.
 */
@Injectable()
export class AnalogCallsState {
  private readonly page = inject(AnalogPageState);

  readonly kinds: Kind[] = ['all', 'page', 'load', 'action', 'fn', 'api'];
  readonly kind = signal<Kind>('all');
  /** The route the last Try button handed to the playground. */
  // Cleared when the view changes, so coming back to Server doesn't load the last Try again.
  readonly tryTarget = linkedSignal<View, PlaygroundTarget | null>({
    source: this.page.view,
    computation: () => null,
  });
  private tryNonce = 0;

  readonly maxServerCalls = MAX_SERVER_CALLS;
  readonly callQuery = signal('');
  readonly failedOnly = signal(false);
  readonly callsMessage = signal('');
  /** True when the search or the failed filter is on, so an empty list is a no-match. */
  readonly callFiltered = computed(() => !!this.callQuery().trim() || this.failedOnly());
  /** Every call that passes the kind, search and failed filters, oldest first. */
  readonly matchingCalls = computed(() => {
    const kind = this.kind();
    const query = this.callQuery().trim().toLowerCase();
    const failedOnly = this.failedOnly();
    return this.page
      .tabCalls()
      .filter(
        (c) =>
          (kind === 'all' || c.kind === kind) &&
          (!failedOnly || this.isFailed(c)) &&
          (!query || this.callText(c).includes(query)),
      );
  });
  readonly calls = computed(() => this.matchingCalls().slice(-MAX_SHOWN_CALLS).reverse());
  readonly shownCount = computed(() => this.calls().length);
  readonly serverFull = computed(() => this.page.allCalls().length >= MAX_SERVER_CALLS);
  /** The routes and server functions the shown calls touch, so a warning about another tab stays hidden. */
  private readonly shownRoutes = computed(
    () => new Set(this.page.tabCalls().map((c) => `${c.kind} ${c.route ?? ''}`)),
  );
  readonly refetchedFns = computed(() =>
    Array.from(
      new Set(
        (this.page.state().refetches ?? [])
          .filter((r) => this.shownRoutes().has(`fn ${r.id}`))
          .map((r) => this.page.fnById().get(r.id)?.name ?? r.id),
      ),
    ),
  );
  readonly duplicates = computed(() =>
    Array.from(
      new Set(
        (this.page.state().duplicates ?? [])
          .filter((d) => this.shownRoutes().has(`load ${d.route}`))
          .map((d) => d.route),
      ),
    ),
  );

  kindLabel(kind: Kind): string {
    return KIND_LABEL[kind];
  }

  kindCount(kind: Kind): number {
    return kind === 'all'
      ? this.page.tabCalls().length
      : this.page.tabCalls().filter((c) => c.kind === kind).length;
  }

  fnOf(call: AnalogCall): ServerFn | undefined {
    return call.kind === 'fn' && call.route ? this.page.fnById().get(call.route) : undefined;
  }

  fnCalls(id: string): number {
    return this.page.tabCalls().filter((c) => c.kind === 'fn' && c.route === id).length;
  }

  outcomeLabel(outcome: ActionOutcome): string {
    return OUTCOME_LABEL[outcome];
  }

  outcomeTone(outcome: ActionOutcome): string {
    return OUTCOME_TONE[outcome];
  }

  tryApi(api: ApiRoute) {
    this.tryTarget.set({ route: api, nonce: ++this.tryNonce });
  }

  /** A failed call answered with 400 or more, never answered, or ended in an error outcome. */
  isFailed(c: AnalogCall): boolean {
    return !c.status || c.status >= 400 || c.outcome === 'error';
  }

  private callText(c: AnalogCall): string {
    const fn = this.fnOf(c);
    return [c.url, c.route, fn?.name, fn?.file].filter(Boolean).join(' ').toLowerCase();
  }

  /** Clears the search, the failed filter and the kind. */
  resetFilters() {
    this.callQuery.set('');
    this.failedOnly.set(false);
    this.kind.set('all');
  }

  /** Asks the dev server to drop its calls; true when it did. */
  async clearCalls(): Promise<boolean> {
    const client = this.page.rpc();
    try {
      if (!client) throw new Error('No devtools server');
      await rpcCall(client, 'analog-clear-calls');
      this.callsMessage.set('Calls cleared.');
      return true;
    } catch {
      this.callsMessage.set('Could not clear the calls.');
      return false;
    }
  }
}
