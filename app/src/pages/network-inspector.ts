import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import type { DevframeRpcClient } from 'devframe/client';

type HttpSide = 'client' | 'server';

interface HttpRule {
  id: string;
  pattern: string;
  method?: string;
  enabled: boolean;
  target: HttpSide | 'both';
  status?: number;
  delayMs?: number;
  body?: string;
}

interface HttpCall {
  id: string;
  url: string;
  method: string;
  status: number;
  durationMs: number;
  side: HttpSide;
  cacheHit: boolean;
  faulted: boolean;
  ruleId?: string;
  pageUrl?: string;
  at: number;
  error?: string;
  preview?: string;
}

interface PayloadEntry {
  key: string;
  http?: { url?: string; status?: number; statusText?: string; responseType?: string };
  size: number;
  value: unknown;
}

interface HydrationStats {
  enabled: boolean;
  hydratedComponents?: number;
  hydratedNodes?: number;
  componentsSkippedHydration?: number;
  deferBlocksWithIncrementalHydration?: number;
  skipHydrationHosts: string[];
  warnings: string[];
}

interface HttpPage {
  pageId: string;
  url: string;
  title: string;
  payload: { found: boolean; size: number; entries: PayloadEntry[]; error?: string };
  hydration: HydrationStats | null;
  calls: HttpCall[];
  reportedAt: number;
}

interface HttpState {
  serverCalls: HttpCall[];
  pages: HttpPage[];
  rules: HttpRule[];
}

interface RuleDraft {
  pattern: string;
  method: string;
  target: HttpRule['target'];
  status: string;
  delayMs: string;
  body: string;
}

const EMPTY_DRAFT: RuleDraft = {
  pattern: '/api/products',
  method: '',
  target: 'both',
  status: '500',
  delayMs: '',
  body: '',
};

function call(client: DevframeRpcClient | null, name: string, arg?: unknown): Promise<unknown> {
  if (!client) return Promise.resolve(null);
  const rpc = client.scope('ng-devtools').rpc as unknown as {
    call: (name: string, ...args: unknown[]) => Promise<unknown>;
  };
  return rpc.call(name, ...(arg === undefined ? [] : [arg]));
}

@Component({
  selector: 'app-network-inspector',
  imports: [JsonPipe],
  template: `
    @if (loading()) {
      <p class="muted">Loading…</p>
    } @else if (failed()) {
      <p class="muted" role="alert">Could not reach the devtools server.</p>
    }

    <div class="toolbar">
      <label>
        Page
        <select [value]="selected()?.pageId ?? ''" (change)="selectPage($event)">
          @for (page of pages(); track page.pageId) {
            <option [value]="page.pageId">{{ page.title || page.url }}</option>
          } @empty {
            <option value="">No connected page</option>
          }
        </select>
      </label>
      <button type="button" (click)="clearCalls()">Clear timeline</button>
      <p class="message" role="status">{{ message() }}</p>
    </div>

    <div class="grid">
      <section class="panel wide" aria-labelledby="timeline-heading">
        <h3 id="timeline-heading">HTTP timeline ({{ timeline().length }})</h3>
        @if (timeline().length) {
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Side</th>
                  <th scope="col">Method</th>
                  <th scope="col">URL</th>
                  <th scope="col">Status</th>
                  <th scope="col">Time</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                @for (entry of timeline(); track entry.side + entry.id) {
                  <tr
                    [class.selected]="selectedCall()?.id === entry.id"
                    (click)="selectedCallId.set(entry.id)"
                  >
                    <td>
                      <span class="tag" [class.server]="entry.side === 'server'">{{
                        entry.side === 'server' ? 'SSR' : 'Client'
                      }}</span>
                    </td>
                    <td>{{ entry.method }}</td>
                    <td class="url">
                      <button type="button" class="link" (click)="selectedCallId.set(entry.id)">
                        {{ entry.url }}
                      </button>
                    </td>
                    <td [class.bad]="entry.status === 0 || entry.status >= 400">
                      {{ entry.status || 'ERR' }}
                    </td>
                    <td>{{ entry.durationMs }} ms</td>
                    <td class="notes">
                      @if (entry.cacheHit) {
                        <span class="tag">transfer cache</span>
                      }
                      @if (entry.faulted) {
                        <span class="tag fault">faulted</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="muted">
            No requests yet. Add <code>withNgDevtools()</code> to <code>provideHttpClient</code>.
          </p>
        }
        @if (selectedCall(); as detail) {
          <h4>Response preview</h4>
          <pre>{{ detail.error ?? detail.preview ?? '(no body)' }}</pre>
        }
      </section>

      <section class="panel" aria-labelledby="rules-heading">
        <h3 id="rules-heading">Fault injection</h3>
        <form class="rule-form" (submit)="addRule($event)">
          <label>
            URL pattern (substring or * glob)
            <input
              required
              [value]="draft().pattern"
              (input)="patch('pattern', $event)"
              placeholder="/api/products"
            />
          </label>
          <div class="row">
            <label>
              Method
              <select [value]="draft().method" (change)="patch('method', $event)">
                <option value="">Any</option>
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>PATCH</option>
                <option>DELETE</option>
              </select>
            </label>
            <label>
              Apply on
              <select [value]="draft().target" (change)="patch('target', $event)">
                <option value="both">SSR + client</option>
                <option value="server">SSR only</option>
                <option value="client">Client only</option>
              </select>
            </label>
          </div>
          <div class="row">
            <label>
              Status
              <input
                type="number"
                min="100"
                max="599"
                [value]="draft().status"
                (input)="patch('status', $event)"
              />
            </label>
            <label>
              Delay (ms)
              <input
                type="number"
                min="0"
                max="10000"
                [value]="draft().delayMs"
                (input)="patch('delayMs', $event)"
              />
            </label>
          </div>
          <label>
            Mock JSON body (optional)
            <textarea
              rows="3"
              [value]="draft().body"
              (input)="patch('body', $event)"
              [attr.aria-invalid]="bodyError() ? 'true' : null"
              aria-describedby="body-error"
            ></textarea>
          </label>
          <p id="body-error" class="bad small">{{ bodyError() }}</p>
          <button type="submit" [disabled]="!draft().pattern.trim() || !!bodyError()">
            Add rule
          </button>
        </form>

        <ul class="rules">
          @for (rule of rules(); track rule.id) {
            <li>
              <label class="inline">
                <input
                  type="checkbox"
                  [checked]="rule.enabled"
                  (change)="toggleRule(rule.id)"
                  [attr.aria-label]="'Enable rule for ' + rule.pattern"
                />
                <code>{{ rule.method || 'ANY' }} {{ rule.pattern }}</code>
              </label>
              <span class="muted small">
                {{ rule.target }} · {{ rule.status ?? 200 }}
                @if (rule.delayMs) {
                  · {{ rule.delayMs }} ms
                }
                @if (rule.body) {
                  · mock body
                }
              </span>
              <button
                type="button"
                class="link"
                (click)="removeRule(rule.id)"
                [attr.aria-label]="'Remove rule for ' + rule.pattern"
              >
                Remove
              </button>
            </li>
          } @empty {
            <li class="muted">No rules. SSR rules apply on the next page load.</li>
          }
        </ul>
      </section>

      <section class="panel" aria-labelledby="hydration-heading">
        <h3 id="hydration-heading">Hydration</h3>
        @if (selected()?.hydration; as h) {
          <dl>
            <dt>Enabled</dt>
            <dd>{{ h.enabled ? 'yes' : 'no (client render only)' }}</dd>
            <dt>Hydrated components</dt>
            <dd>{{ h.hydratedComponents ?? 'n/a' }}</dd>
            <dt>Hydrated nodes</dt>
            <dd>{{ h.hydratedNodes ?? 'n/a' }}</dd>
            <dt>Skipped components</dt>
            <dd>{{ h.componentsSkippedHydration ?? 'n/a' }}</dd>
            <dt>Incremental defer blocks</dt>
            <dd>{{ h.deferBlocksWithIncrementalHydration ?? 'n/a' }}</dd>
          </dl>
          @if (h.skipHydrationHosts.length) {
            <h4>ngSkipHydration hosts</h4>
            <ul class="plain">
              @for (host of h.skipHydrationHosts; track $index) {
                <li>
                  <code>{{ host }}</code>
                </li>
              }
            </ul>
          }
          <h4>Warnings ({{ h.warnings.length }})</h4>
          @for (warning of h.warnings; track $index) {
            <pre class="warn">{{ warning }}</pre>
          } @empty {
            <p class="muted small">No hydration warnings.</p>
          }
        } @else {
          <p class="muted">No hydration data for this page.</p>
        }
      </section>

      <section class="panel wide" aria-labelledby="payload-heading">
        <h3 id="payload-heading">TransferState payload</h3>
        @if (selected()?.payload; as payload) {
          @if (!payload.found) {
            <p class="muted">No TransferState script: this page was not server rendered.</p>
          } @else {
            <p class="muted small">
              {{ payload.entries.length }} entr{{ payload.entries.length === 1 ? 'y' : 'ies' }},
              {{ payload.size }} bytes
            </p>
            @if (payload.error) {
              <p class="bad" role="alert">{{ payload.error }}</p>
            }
            @for (entry of payload.entries; track entry.key) {
              <details>
                <summary>
                  @if (entry.http; as http) {
                    <span class="tag server">HTTP {{ http.status }}</span>
                    {{ http.url ?? entry.key }}
                  } @else {
                    {{ entry.key }}
                  }
                  <span class="muted small">{{ entry.size }} B</span>
                </summary>
                <pre>{{ entry.value | json }}</pre>
              </details>
            }
          }
        } @else {
          <p class="muted">Open a page of the app to see its payload.</p>
        }
      </section>
    </div>
  `,
  styles: `
    :host {
      display: block;
      color: #e4e4e7;
      font-size: 13px;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 12px;
      margin-bottom: 16px;
    }
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    }
    .panel {
      padding: 14px;
      border: 1px solid #27272a;
      border-radius: 10px;
      background: #18181b;
      min-width: 0;
    }
    .wide {
      grid-column: 1 / -1;
    }
    h3 {
      margin: 0 0 12px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #d4d4d8;
    }
    h4 {
      margin: 12px 0 6px;
      font-size: 12px;
      color: #d4d4d8;
    }
    label {
      display: grid;
      gap: 4px;
      color: #a1a1aa;
      font-size: 12px;
    }
    label.inline {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #e4e4e7;
    }
    input,
    select,
    textarea,
    button {
      font: inherit;
      color: #e4e4e7;
    }
    input:not([type='checkbox']),
    select,
    textarea {
      padding: 6px 8px;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      background: #09090b;
    }
    button {
      padding: 6px 12px;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      background: #27272a;
      cursor: pointer;
    }
    button:hover:not(:disabled) {
      background: #3f3f46;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    button.link {
      padding: 0;
      border: none;
      background: none;
      color: #93c5fd;
      text-align: left;
      word-break: break-all;
    }
    :focus-visible {
      outline: 2px solid #93c5fd;
      outline-offset: 2px;
    }
    .message {
      margin: 0;
      color: #a1a1aa;
    }
    .muted {
      color: #a1a1aa;
    }
    .small {
      font-size: 12px;
    }
    .bad {
      color: #fca5a5;
    }
    .table-wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #27272a;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: #a1a1aa;
      font-weight: 500;
    }
    tr.selected td {
      background: #27272a;
    }
    td.url {
      max-width: 420px;
    }
    .notes {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .tag {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 99px;
      background: #3f3f46;
      font-size: 11px;
      white-space: nowrap;
    }
    .tag.server {
      background: #1e3a8a;
      color: #dbeafe;
    }
    .tag.fault {
      background: #7f1d1d;
      color: #fee2e2;
    }
    pre {
      margin: 4px 0 0;
      padding: 8px;
      max-height: 240px;
      overflow: auto;
      border-radius: 6px;
      background: #09090b;
      color: #a1a1aa;
      font:
        12px ui-monospace,
        monospace;
      white-space: pre-wrap;
      word-break: break-all;
    }
    pre.warn {
      color: #fde68a;
    }
    .rule-form {
      display: grid;
      gap: 8px;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .rules,
    .plain {
      display: grid;
      gap: 8px;
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
    }
    .rules li {
      display: grid;
      gap: 2px;
      padding: 8px;
      border: 1px solid #27272a;
      border-radius: 6px;
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 4px 12px;
      margin: 0;
    }
    dt {
      color: #a1a1aa;
    }
    dd {
      margin: 0;
    }
    details {
      border-bottom: 1px solid #27272a;
      padding: 6px 0;
    }
    summary {
      cursor: pointer;
      word-break: break-all;
    }
  `,
})
export class NetworkInspector {
  readonly rpc = input<DevframeRpcClient | null>(null);

  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly serverCalls = signal<HttpCall[]>([]);
  readonly pages = signal<HttpPage[]>([]);
  readonly rules = signal<HttpRule[]>([]);
  readonly selectedPageId = signal<string | null>(null);
  readonly selectedCallId = signal<string | null>(null);
  readonly draft = signal<RuleDraft>({ ...EMPTY_DRAFT });
  readonly message = signal('');

  private unsubscribe: (() => void) | null = null;
  private readonly destroyRef = inject(DestroyRef);

  readonly selected = computed(() => {
    const pages = this.pages();
    return pages.find((p) => p.pageId === this.selectedPageId()) ?? pages[0] ?? null;
  });

  readonly timeline = computed(() =>
    [...this.serverCalls(), ...(this.selected()?.calls ?? [])].sort((a, b) => b.at - a.at),
  );

  readonly selectedCall = computed(
    () => this.timeline().find((c) => c.id === this.selectedCallId()) ?? null,
  );

  readonly bodyError = computed(() => {
    const body = this.draft().body.trim();
    if (!body) return '';
    try {
      JSON.parse(body);
      return '';
    } catch {
      return 'The mock body must be valid JSON.';
    }
  });

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) this.load(client);
    });
    this.destroyRef.onDestroy(() => this.unsubscribe?.());
  }

  async load(client: DevframeRpcClient) {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const state = await client.scope('ng-devtools').rpc.sharedState('http');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => {
        const snapshot = value as HttpState | undefined;
        this.serverCalls.set(snapshot?.serverCalls ?? []);
        this.pages.set(snapshot?.pages ?? []);
        this.rules.set(snapshot?.rules ?? []);
      };
      apply(state.value());
      this.unsubscribe?.();
      this.unsubscribe = state.on('updated', apply);
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  selectPage(event: Event) {
    this.selectedPageId.set((event.target as HTMLSelectElement).value || null);
    this.selectedCallId.set(null);
  }

  patch(key: keyof RuleDraft, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  addRule(event: Event) {
    event.preventDefault();
    const draft = this.draft();
    if (!draft.pattern.trim() || this.bodyError()) return;
    const status = Number(draft.status);
    const delayMs = Number(draft.delayMs);
    const rule: HttpRule = {
      id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      pattern: draft.pattern.trim(),
      enabled: true,
      target: draft.target,
      ...(draft.method ? { method: draft.method } : {}),
      ...(draft.status && Number.isFinite(status) ? { status } : {}),
      ...(draft.delayMs && Number.isFinite(delayMs) ? { delayMs } : {}),
      ...(draft.body.trim() ? { body: draft.body.trim() } : {}),
    };
    void this.saveRules([...this.rules(), rule], 'Rule added.');
  }

  toggleRule(id: string) {
    void this.saveRules(
      this.rules().map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)),
      'Rule updated.',
    );
  }

  removeRule(id: string) {
    void this.saveRules(
      this.rules().filter((rule) => rule.id !== id),
      'Rule removed.',
    );
  }

  async clearCalls() {
    try {
      await call(this.rpc(), 'clear-http-calls');
      this.selectedCallId.set(null);
      this.message.set('Timeline cleared.');
    } catch {
      this.message.set('Could not clear the timeline.');
    }
  }

  private async saveRules(rules: HttpRule[], done: string) {
    try {
      await call(this.rpc(), 'set-http-rules', rules);
      this.rules.set(rules);
      this.message.set(`${done} Reload the page to apply SSR rules.`);
    } catch {
      this.message.set('Could not save the rules.');
    }
  }
}
