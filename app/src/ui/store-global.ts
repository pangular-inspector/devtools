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
 * `temp1`, `temp2`… in its console, then says which name it used. With
 * `canLog`, "Log to console" asks the page to print the value there instead.
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
      @if (canLog()) {
        <button
          type="button"
          class="store log"
          [disabled]="busy() || !rpc() || !pageId()"
          (click)="store('log')"
        >
          Log to console
          @if (label()) {
            <span class="sr-only">: {{ label() }}</span>
          }
        </button>
      }
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
    /* The panel's .btn: theme tokens and the control height. */
    .store {
      height: var(--control-h);
      padding: 0 14px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 150ms var(--ease);
    }
    .store:hover:not(:disabled) {
      background: var(--surface-3);
    }
    .store:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    .store:focus-visible {
      @include m.focus-ring;
    }
    @media (prefers-reduced-motion: reduce) {
      .store {
        transition: none;
      }
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
  /** Also offers "Log to console". */
  readonly canLog = input(false);

  /** A saved report has no page to store anything in. */
  protected readonly staticReport = computed(() => isStaticReport(this.rpc()));
  protected readonly busy = signal(false);
  protected readonly message = signal('');

  async store(mode: 'store' | 'log' = 'store') {
    const client = this.rpc();
    const pageId = this.pageId();
    if (!client || !pageId) return;
    this.busy.set(true);
    this.message.set('');
    try {
      const result = (await client.scope('pangular').rpc.call('request-console-global', {
        pageId,
        target: this.target(),
        ...(mode === 'log' ? { mode } : {}),
      })) as StoreResult;
      const fallback =
        mode === 'log'
          ? result?.ok
            ? 'Logged in the page console.'
            : 'Not logged.'
          : result?.ok && result.name
            ? `Stored as ${result.name}.`
            : 'Not stored.';
      this.message.set(result?.message || fallback);
    } catch {
      this.message.set('Could not reach the page.');
    } finally {
      this.busy.set(false);
    }
  }
}
