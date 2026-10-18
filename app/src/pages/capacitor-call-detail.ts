import { Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { time } from '../format';
import {
  callAsCode,
  isUnimplemented,
  json,
  span,
  took,
  type CapacitorCall,
} from './capacitor-types';

type DetailTab = 'args' | 'outcome' | 'timing';
const TAB_ORDER: readonly DetailTab[] = ['args', 'outcome', 'timing'];

/** One plugin call: arguments, result or error, and timing, with copy actions. */
@Component({
  selector: 'app-capacitor-call-detail',
  template: `
    @let c = call();
    <section class="detail" id="cap-detail" aria-labelledby="cap-detail-title">
      <h3 id="cap-detail-title">
        <code>{{ c.plugin }}.{{ c.method }}()</code>
      </h3>
      <p class="meta">
        {{ statusText() }}, {{ c.via }}, {{ c.kind === 'callback' ? 'stream' : 'promise' }}
      </p>
      <div class="actions">
        <button type="button" class="small" (click)="copy('json')">Copy as JSON</button>
        <button type="button" class="small" (click)="copy('code')">Copy as code</button>
      </div>
      <div class="tabs" role="tablist" aria-label="Call details" (keydown)="onTabKey($event)">
        @for (id of tabOrder; track id) {
          <button
            type="button"
            role="tab"
            [id]="'cap-tab-' + id"
            [attr.aria-selected]="tab() === id"
            [attr.aria-controls]="'cap-panel-' + id"
            [attr.tabindex]="tab() === id ? 0 : -1"
            (click)="tab.set(id)"
          >
            {{ tabLabel(id) }}
          </button>
        }
      </div>
      <div
        class="panel"
        role="tabpanel"
        [id]="'cap-panel-' + tab()"
        [attr.aria-labelledby]="'cap-tab-' + tab()"
        [attr.tabindex]="panelHasFocusable() ? null : 0"
      >
        @switch (tab()) {
          @case ('args') {
            @if (c.args === undefined) {
              <p class="muted">No arguments.</p>
            } @else {
              <pre tabindex="0" aria-label="Arguments">{{ json(c.args) }}</pre>
            }
          }
          @case ('outcome') {
            @if (c.error; as error) {
              <p class="error-text">
                @if (error.code) {
                  <code>{{ error.code }}</code>
                }
                {{ error.message }}
              </p>
            } @else if (c.status === 'pending') {
              <p class="muted">No answer yet.</p>
            } @else {
              @if (c.callbacks && c.callbacks > 1) {
                <p class="muted">The latest of {{ c.callbacks }} callbacks.</p>
              }
              @if (c.result === undefined) {
                <p class="muted">Resolved without a value.</p>
              } @else {
                <pre tabindex="0" aria-label="Result">{{ json(c.result) }}</pre>
              }
            }
          }
          @case ('timing') {
            <dl>
              <div>
                <dt>Started</dt>
                <dd>{{ time(c.startedAt) }}</dd>
              </div>
              <div>
                <dt>Finished</dt>
                <dd>
                  {{ c.durationMs === undefined ? 'Not yet' : time(c.startedAt + c.durationMs) }}
                </dd>
              </div>
              <div>
                <dt>{{ c.status === 'pending' ? 'Waiting for' : 'Duration' }}</dt>
                <dd>{{ span(took(c, now())) }}</dd>
              </div>
              @if (c.kind === 'callback') {
                <div>
                  <dt>Callbacks</dt>
                  <dd>{{ c.callbacks ?? 0 }}</dd>
                </div>
              }
            </dl>
          }
        }
      </div>
    </section>
  `,
  styles: `
    @use 'mixins' as m;

    .detail {
      @include m.panel;
      position: sticky;
      top: 64px;
      min-width: 0;
      margin: 0;
      padding: 12px;
    }
    h3 {
      margin: 0 0 4px;
      font-size: 14px;
      overflow-wrap: anywhere;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .meta,
    .muted {
      margin: 0;
      color: var(--text-2);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 10px 0;
    }
    .small {
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      cursor: pointer;
    }
    .small:hover {
      background: var(--surface-3);
    }
    .small:focus-visible {
      @include m.focus-ring;
    }
    .tabs {
      display: flex;
      gap: 2px;
      max-width: 100%;
      margin: 0 0 8px;
      padding: 2px;
      overflow-x: auto;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .tabs [role='tab'] {
      flex: none;
      height: 28px;
      padding: 0 12px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: var(--text-2);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 150ms var(--ease);
    }
    .tabs [role='tab']:hover {
      color: var(--text);
      background: var(--surface-2);
    }
    .tabs [role='tab'][aria-selected='true'] {
      background: var(--surface-3);
      color: var(--text-strong);
      box-shadow: inset 0 0 0 1px var(--border-strong);
    }
    .tabs [role='tab']:focus-visible {
      @include m.focus-ring(-2px);
    }
    .panel {
      min-width: 0;
      border-radius: var(--radius-sm);
    }
    .panel:focus-visible {
      @include m.focus-ring;
    }
    pre {
      max-height: 280px;
      margin: 0;
      padding: 8px;
      overflow: auto;
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    pre:focus-visible {
      @include m.focus-ring(-2px);
    }
    .error-text {
      margin: 0;
      color: var(--text);
      overflow-wrap: anywhere;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 8px;
      margin: 0;
    }
    dt {
      @include m.label;
      margin: 0 0 2px;
    }
    dd {
      margin: 0;
      color: var(--text);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class CapacitorCallDetail {
  readonly call = input.required<CapacitorCall>();
  readonly now = input.required<number>();
  /** A sentence for the status region: what was copied, or why it wasn't. */
  readonly announce = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly tab = signal<DetailTab>('args');
  protected readonly tabOrder = TAB_ORDER;
  protected readonly json = json;
  protected readonly time = time;
  protected readonly span = span;
  protected readonly took = took;

  protected readonly statusText = computed(() => {
    const call = this.call();
    if (call.status === 'pending') return 'Pending';
    if (call.status === 'ok') return 'OK';
    return isUnimplemented(call) ? 'Not implemented' : 'Error';
  });

  /** Whether the open panel holds a focusable `pre`; otherwise the panel takes focus. */
  protected readonly panelHasFocusable = computed(() => {
    const call = this.call();
    if (this.tab() === 'args') return call.args !== undefined;
    if (this.tab() === 'outcome') {
      return !call.error && call.status === 'ok' && call.result !== undefined;
    }
    return false;
  });

  protected tabLabel(id: DetailTab): string {
    if (id === 'args') return 'Arguments';
    if (id === 'timing') return 'Timing';
    return this.call().status === 'error' ? 'Error' : 'Result';
  }

  /** Arrow keys, Home and End move between tabs and open them, as in the APG tabs pattern. */
  protected onTabKey(event: KeyboardEvent) {
    const index = TAB_ORDER.indexOf(this.tab());
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % TAB_ORDER.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TAB_ORDER.length - 1;
    else return;
    event.preventDefault();
    const id = TAB_ORDER[next];
    this.tab.set(id);
    this.host.nativeElement.querySelector<HTMLElement>(`#cap-tab-${id}`)?.focus();
  }

  /** Copies only what the panel holds, which the page and the server masked already. */
  protected async copy(kind: 'json' | 'code') {
    const call = this.call();
    const name = `${call.plugin}.${call.method}()`;
    const text = kind === 'json' ? json(call) : callAsCode(call);
    try {
      await navigator.clipboard.writeText(text);
      this.announce.emit(`Copied ${name} as ${kind === 'json' ? 'JSON' : 'code'}.`);
    } catch {
      this.announce.emit('The clipboard is not available here.');
    }
  }
}
