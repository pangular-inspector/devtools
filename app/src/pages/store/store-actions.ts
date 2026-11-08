import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { rpcCall as call } from '../../rpc';
import type { NgrxLogEntry } from '../store-types';
import { parsePayload } from './store-format';
import { StoreState } from './store-state';

/**
 * The writes the Store page sends to the live page (restore, back to latest, the Store DevTools
 * history and dispatch), with the busy flag and the focus moves they ask of the sections.
 * Provided by the page next to {@link StoreState}.
 */
@Injectable()
export class StoreActions {
  private readonly state = inject(StoreState);

  readonly busy = signal(false);
  /** Focus requests the sections carry out once the element they name is rendered. */
  readonly focusLatest = signal(false);
  readonly focusConfirm = signal<'cancel' | 'restore' | null>(null);
  readonly focusReset = signal<'cancel' | 'reset' | null>(null);
  readonly focusEventSeq = signal<number | null>(null);
  /** Focuses the state tree of the shown store; the store detail sets it. */
  focusStateTree: () => void = () => {};

  /** The reset confirm is open; it closes when another store is shown. */
  readonly confirmReset = linkedSignal<string | undefined, boolean>({
    source: () => this.state.store()?.id,
    computation: () => false,
  });

  readonly dispatchType = signal('');
  readonly dispatchPayload = signal('');

  readonly payloadError = computed(() => parsePayload(this.dispatchPayload()).error ?? '');

  readonly dispatchRequest = computed(() => {
    const type = this.dispatchType().trim();
    const { payload, error } = parsePayload(this.dispatchPayload());
    if (!type || error) return null;
    return { type: 'dispatch' as const, action: type, ...(payload ? { payload } : {}) };
  });

  askRestore(seq: number) {
    this.state.confirmSeq.set(seq);
    this.focusConfirm.set('cancel');
  }

  cancelRestore(event?: Event) {
    event?.preventDefault();
    this.state.confirmSeq.set(null);
    this.focusConfirm.set('restore');
  }

  async restore(seq: number, pauses: boolean) {
    const page = this.state.page();
    if (!page) return;
    this.busy.set(true);
    this.focusLatest.set(false);
    let paused = false;
    try {
      const result = (await call(this.state.rpc(), 'request-ngrx-action', {
        pageId: page.pageId,
        request: { type: 'restore', seq },
      })) as { ok?: boolean; message?: string; error?: string; paused?: boolean } | null;
      this.state.message.set(result?.error ?? result?.message ?? 'Restored.');
      paused = pauses && !result?.error && !!result?.paused;
    } catch {
      this.state.message.set('Could not reach the page to restore the state.');
    } finally {
      this.busy.set(false);
      this.state.confirmSeq.set(null);
      this.focusLatest.set(paused);
      if (!paused) this.focusStateTree();
    }
  }

  selectEvent(seq: number) {
    const newSeq = this.state.selectedEventSeq() === seq ? null : seq;
    this.state.selectedEventSeq.set(newSeq);
    if (newSeq !== null) this.focusEventSeq.set(newSeq);
  }

  async backToLatest() {
    const page = this.state.page();
    if (!page) return;
    this.busy.set(true);
    try {
      const result = (await call(this.state.rpc(), 'request-ngrx-action', {
        pageId: page.pageId,
        request: { type: 'latest' },
      })) as { ok?: boolean; message?: string; error?: string } | null;
      this.focusLatest.set(false);
      this.focusStateTree();
      this.state.message.set(result?.error ?? result?.message ?? 'Back on the latest state.');
    } catch {
      this.state.message.set('Could not reach the page to go back to the latest state.');
    } finally {
      this.busy.set(false);
    }
  }

  askReset() {
    this.confirmReset.set(true);
    this.focusReset.set('cancel');
  }

  cancelReset(event?: Event) {
    event?.preventDefault();
    this.confirmReset.set(false);
    this.focusReset.set('reset');
  }

  /** Runs a Store DevTools history operation on the shown page. */
  async devtoolsOp(request: { op: string; seq?: number; index?: number; paused?: boolean }) {
    const page = this.state.page();
    if (!page || this.busy()) return;
    const resetting = request.op === 'reset';
    this.busy.set(true);
    try {
      const result = (await call(this.state.rpc(), 'request-ngrx-action', {
        pageId: page.pageId,
        request: { type: 'devtools', ...request },
      })) as { ok?: boolean; message?: string; error?: string } | null;
      this.state.message.set(result?.error ?? result?.message ?? 'Done.');
    } catch {
      this.state.message.set('Could not reach the page to change the Store DevTools history.');
    } finally {
      this.busy.set(false);
      if (resetting) {
        this.confirmReset.set(false);
        this.focusReset.set('reset');
      }
    }
  }

  async dispatchAction(event: Event) {
    event.preventDefault();
    const request = this.dispatchRequest();
    if (request) await this.send(request, 'Could not reach the page to dispatch the action.');
  }

  dispatchAgain(seq: number) {
    return this.send(
      { type: 'dispatch-again', seq },
      'Could not reach the page to dispatch the action again.',
    );
  }

  private async send(request: Record<string, unknown>, offline: string) {
    const page = this.state.page();
    if (!page || this.busy()) return;
    const session = this.state.logSession();
    this.busy.set(true);
    try {
      const result = (await call(this.state.rpc(), 'request-ngrx-action', {
        pageId: page.pageId,
        request,
      })) as { ok?: boolean; message?: string; error?: string; entry?: NgrxLogEntry } | null;
      this.state.message.set(result?.error ?? result?.message ?? 'Dispatched.');
      if (result?.entry && this.state.logSession() === session) {
        this.state.selectedStoreId.set('store');
        this.state.selectedChangeSeq.set(result.entry.seq);
      }
    } catch {
      this.state.message.set(offline);
    } finally {
      this.busy.set(false);
    }
  }
}
