import { Component, computed, input, signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { isStaticReport } from '../rpc';

/** What the page stores: a component, a provider or NgRx state (see `console-handles.ts`). */
export type ConsoleTarget =
  | { kind: 'component'; id: string }
  | { kind: 'provider'; injectorId: string; token: string; index: number }
  | { kind: 'ngrx'; storeId: string };

interface StoreResult {
  ok?: boolean;
  name?: string;
  message?: string;
}

/**
 * "Store as global": asks the page that owns `pageId` to store the target as
 * `temp1`, `temp2`… in its console, then says which name it used.
 */
@Component({
  selector: 'app-store-global',
  template: `
    @if (!staticReport()) {
      <button
        type="button"
        class="store"
        [disabled]="busy() || !rpc() || !pageId()"
        (click)="store()"
      >
        Store as global
        @if (label()) {
          <span class="sr-only">: {{ label() }}</span>
        }
      </button>
      <span class="status" role="status">{{ message() }}</span>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .store:focus-visible {
      @include m.focus-ring;
    }
    .status {
      color: var(--text-2);
      font-size: 12px;
    }
    .status:empty {
      display: none;
    }
  `,
})
export class StoreGlobal {
  readonly rpc = input<DevframeRpcClient | null>(null);
  readonly pageId = input<string | null | undefined>(null);
  readonly target = input.required<ConsoleTarget>();
  /** Names the target for screen readers when several buttons share a view. */
  readonly label = input<string>('');

  /** A saved report has no page to store anything in. */
  protected readonly staticReport = computed(() => isStaticReport(this.rpc()));
  protected readonly busy = signal(false);
  protected readonly message = signal('');

  async store() {
    const client = this.rpc();
    const pageId = this.pageId();
    if (!client || !pageId) return;
    this.busy.set(true);
    this.message.set('');
    try {
      const result = (await client
        .scope('pangular')
        .rpc.call('request-console-global', { pageId, target: this.target() })) as StoreResult;
      this.message.set(
        result?.message ||
          (result?.ok && result.name ? `Stored as ${result.name}.` : 'Not stored.'),
      );
    } catch {
      this.message.set('Could not reach the page.');
    } finally {
      this.busy.set(false);
    }
  }
}
