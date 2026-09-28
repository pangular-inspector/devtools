import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { JsonPipe } from '@angular/common';
import type { DevframeRpcClient } from 'devframe/client';
import { hostPageId } from '../page-id';
import { rpcCall as call } from '../rpc';
import { Select, type SelectOption } from '../ui/select';

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
  source?: 'http' | 'analog' | 'hydration';
  size: number;
  value: unknown;
}

interface HydrationMismatch {
  component: string;
  expected?: string;
  actual?: string;
}

interface HydrationStats {
  enabled: boolean;
  hydratedComponents?: number;
  hydratedNodes?: number;
  componentsSkippedHydration?: number;
  deferBlocksWithIncrementalHydration?: number;
  nodes?: { hydrated: number; skipped: number; mismatched: number };
  mismatches?: HydrationMismatch[];
  skipHydrationHosts: string[];
  warnings: string[];
  warningsCaptured?: boolean;
}

interface HttpPage {
  pageId: string;
  url: string;
  initialUrl?: string;
  title: string;
  payload: { found: boolean; size: number; entries: PayloadEntry[]; error?: string };
  hydration: HydrationStats | null;
  calls: HttpCall[];
  firstSeenAt?: number;
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

@Component({
  selector: 'app-network-inspector',
  imports: [JsonPipe, Select],
  template: `
    @if (loading()) {
      <div class="state" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <span>Loading…</span>
      </div>
    } @else if (failed()) {
      <div class="state error" role="alert">
        <strong>Could not reach the devtools server.</strong>
        <span
          >Check that the app's dev server is running with the devtools plugin, then reopen this
          panel.</span
        >
      </div>
    }

    <div class="toolbar">
      <div class="page-picker">
        <span id="page-picker-label">Page</span>
        <app-select
          labelledBy="page-picker-label"
          emptyText="No connected page"
          placeholder="No connected page"
          [options]="pageOptions()"
          [value]="selected()?.pageId ?? null"
          (valueChange)="selectPage($event)"
        />
      </div>
      <button type="button" (click)="clearCalls()">Clear timeline</button>
      <p class="message" role="status">{{ message() }}</p>
    </div>

    <div class="grid">
      <section class="panel wide" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading">HTTP timeline ({{ timeline().length }})</h2>
        @if (timeline().length) {
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Side</th>
                  <th scope="col">Method</th>
                  <th scope="col">URL</th>
                  <th scope="col">Page</th>
                  <th scope="col">Status</th>
                  <th scope="col" class="num">Time</th>
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
                    <td class="method">{{ entry.method }}</td>
                    <td class="url">
                      <button
                        type="button"
                        class="link"
                        [title]="entry.url"
                        [attr.aria-pressed]="selectedCall()?.id === entry.id"
                        (click)="selectedCallId.set(entry.id)"
                      >
                        {{ entry.url }}
                      </button>
                    </td>
                    <td class="page-url" [title]="entry.pageUrl ?? ''">
                      {{ entry.pageUrl ?? '' }}
                    </td>
                    <td
                      class="status"
                      [class.ok]="statusTone(entry.status) === 'ok'"
                      [class.redirect]="statusTone(entry.status) === 'redirect'"
                      [class.bad]="statusTone(entry.status) === 'bad'"
                    >
                      <span class="dot" aria-hidden="true"></span>{{ entry.status || 'ERR' }}
                    </td>
                    <td class="num">{{ entry.durationMs }} ms</td>
                    <td>
                      <div class="notes">
                        @if (entry.cacheHit) {
                          <span class="tag">transfer cache</span>
                        }
                        @if (entry.faulted) {
                          <span class="tag fault">faulted</span>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="empty">
            <p>No requests yet.</p>
            <p class="muted small">
              Add <code>withNgDevtools()</code> to <code>provideHttpClient</code>, then load a page
              of the app.
            </p>
          </div>
        }
        @if (selectedCall(); as detail) {
          <div class="preview">
            <div class="preview-head">
              <h3>Response preview</h3>
              <button type="button" class="ghost" (click)="selectedCallId.set(null)">Close</button>
            </div>
            <p class="preview-meta">
              <span class="method">{{ detail.method }}</span>
              <span
                class="status"
                [class.ok]="statusTone(detail.status) === 'ok'"
                [class.redirect]="statusTone(detail.status) === 'redirect'"
                [class.bad]="statusTone(detail.status) === 'bad'"
                >{{ detail.status || 'ERR' }}</span
              >
              <span class="preview-url" [title]="detail.url">{{ detail.url }}</span>
            </p>
            <pre [class.error]="!!detail.error">{{
              detail.error ?? detail.preview ?? '(no body)'
            }}</pre>
          </div>
        }
      </section>

      <section class="panel" aria-labelledby="rules-heading">
        <h2 id="rules-heading">Fault injection</h2>
        <form class="rule-form" (submit)="addRule($event)">
          <label>
            <span>URL pattern <span class="hint">(substring or * glob)</span></span>
            <input
              required
              spellcheck="false"
              autocomplete="off"
              [value]="draft().pattern"
              (input)="patch('pattern', $event)"
              placeholder="/api/products"
            />
          </label>
          <div class="row">
            <div class="field-group">
              <span id="rule-method-label">Method</span>
              <app-select
                labelledBy="rule-method-label"
                [options]="methodOptions"
                [value]="draft().method"
                (valueChange)="setDraft('method', $event ?? '')"
              />
            </div>
            <div class="field-group">
              <span id="rule-target-label">Apply on</span>
              <app-select
                labelledBy="rule-target-label"
                [options]="targetOptions"
                [value]="draft().target"
                (valueChange)="setDraft('target', $event ?? 'both')"
              />
            </div>
          </div>
          <div class="row">
            <label>
              Status
              <input
                type="number"
                inputmode="numeric"
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
                inputmode="numeric"
                min="0"
                max="10000"
                placeholder="0"
                [value]="draft().delayMs"
                (input)="patch('delayMs', $event)"
              />
            </label>
          </div>
          <label>
            <span>Mock JSON body <span class="hint">(optional)</span></span>
            <textarea
              rows="3"
              spellcheck="false"
              [placeholder]="bodyPlaceholder"
              [value]="draft().body"
              (input)="patch('body', $event)"
              [attr.aria-invalid]="bodyError() ? 'true' : null"
              aria-describedby="body-error"
            ></textarea>
          </label>
          <p id="body-error" class="field-error">{{ bodyError() }}</p>
          @if (draftMocksOnServer()) {
            <p class="muted small">
              SSR mocks are not transferred to the client: the browser requests the URL again and
              gets the real response unless the rule also applies on the client.
            </p>
          }
          <div class="form-actions">
            <button type="submit" [disabled]="!draft().pattern.trim() || !!bodyError()">
              Add rule
            </button>
          </div>
        </form>

        <h3 class="rules-heading">Rules ({{ rules().length }})</h3>
        <ul class="rules">
          @for (rule of rules(); track rule.id) {
            <li [class.off]="!rule.enabled">
              <label class="inline">
                <input
                  type="checkbox"
                  [checked]="rule.enabled"
                  (change)="toggleRule(rule.id)"
                  [attr.aria-label]="'Enable rule for ' + rule.pattern"
                />
                <code class="rule-pattern" [title]="rule.pattern"
                  ><span class="rule-method">{{ rule.method || 'ANY' }}</span>
                  {{ rule.pattern }}</code
                >
              </label>
              <button
                type="button"
                class="link remove"
                (click)="removeRule(rule.id)"
                [attr.aria-label]="'Remove rule for ' + rule.pattern"
              >
                Remove
              </button>
              <span class="rule-meta">
                <span>{{ targetLabel(rule.target) }}</span>
                @if (rule.status === undefined) {
                  <span>passthrough</span>
                } @else {
                  <span
                    class="status"
                    [class.ok]="statusTone(rule.status) === 'ok'"
                    [class.redirect]="statusTone(rule.status) === 'redirect'"
                    [class.bad]="statusTone(rule.status) === 'bad'"
                    >{{ rule.status }}</span
                  >
                }
                @if (rule.delayMs) {
                  <span>{{ rule.delayMs }} ms</span>
                }
                @if (rule.body) {
                  <span>mock body</span>
                }
              </span>
              @if (mocksOnServer(rule)) {
                <p class="rule-note">
                  The SSR mock is not written to TransferState, so the browser requests this URL
                  again.
                </p>
              }
            </li>
          } @empty {
            <li class="empty-rule">No rules. SSR rules apply on the next page load.</li>
          }
        </ul>
      </section>

      <section class="panel" aria-labelledby="hydration-heading">
        <h2 id="hydration-heading">Hydration</h2>
        @if (selected()?.hydration; as h) {
          <dl class="stats">
            <div>
              <dt>Enabled</dt>
              <dd>
                <span class="tag" [class.on]="h.enabled" [class.off-tag]="!h.enabled">{{
                  h.enabled ? 'yes' : 'no (client render only)'
                }}</span>
              </dd>
            </div>
            <div>
              <dt>Hydrated components</dt>
              <dd>{{ h.hydratedComponents ?? 'n/a' }}</dd>
            </div>
            <div>
              <dt>Hydrated nodes</dt>
              <dd>{{ h.hydratedNodes ?? 'n/a' }}</dd>
            </div>
            <div>
              <dt>Skipped components</dt>
              <dd>{{ h.componentsSkippedHydration ?? 'n/a' }}</dd>
            </div>
            <div>
              <dt>Incremental defer blocks</dt>
              <dd>{{ h.deferBlocksWithIncrementalHydration ?? 'n/a' }}</dd>
            </div>
            @if (h.nodes; as n) {
              <div>
                <dt>DOM nodes hydrated</dt>
                <dd>{{ n.hydrated }}</dd>
              </div>
              <div>
                <dt>DOM nodes skipped</dt>
                <dd>{{ n.skipped }}</dd>
              </div>
              <div>
                <dt>Mismatched components</dt>
                <dd [class.bad]="n.mismatched > 0">{{ n.mismatched }}</dd>
              </div>
            }
          </dl>
          @if (h.mismatches?.length) {
            <h3>Mismatches ({{ h.mismatches!.length }})</h3>
            <ul class="plain mismatches">
              @for (m of h.mismatches; track $index) {
                <li>
                  <code>{{ '<' + m.component + '>' }}</code>
                  @if (m.expected) {
                    <span class="mismatch-row"
                      ><span class="mismatch-label">Expected</span>
                      <code>{{ m.expected }}</code></span
                    >
                  }
                  @if (m.actual) {
                    <span class="mismatch-row"
                      ><span class="mismatch-label">Actual</span> <code>{{ m.actual }}</code></span
                    >
                  }
                </li>
              }
            </ul>
          }
          @if (h.skipHydrationHosts.length) {
            <h3>ngSkipHydration hosts</h3>
            <ul class="plain">
              @for (host of h.skipHydrationHosts; track $index) {
                <li>
                  <code>{{ host }}</code>
                </li>
              }
            </ul>
          }
          @if (h.warningsCaptured === false) {
            <h3>Warnings</h3>
            <p class="muted small">
              Not captured: add <code>provideNgDevtoolsHttp()</code> to the app providers.
            </p>
          } @else {
            <h3>Warnings ({{ h.warnings.length }})</h3>
            @for (warning of h.warnings; track $index) {
              <pre class="warn">{{ warning }}</pre>
            } @empty {
              <p class="muted small ok-note">No hydration warnings.</p>
            }
          }
        } @else {
          <div class="empty">
            <p>No hydration data for this page.</p>
            <p class="muted small">Open a server rendered page of the app to see its stats.</p>
          </div>
        }
      </section>

      <section class="panel wide" aria-labelledby="payload-heading">
        <h2 id="payload-heading">TransferState payload</h2>
        @if (selected()?.payload; as payload) {
          @if (!payload.found) {
            <div class="empty">
              <p>No TransferState script: this page was not server rendered.</p>
            </div>
          } @else {
            <p class="muted small summary-line">
              {{ payload.entries.length }} entr{{ payload.entries.length === 1 ? 'y' : 'ies' }},
              {{ payload.size }} bytes
            </p>
            @if (payload.error) {
              <p class="bad" role="alert">{{ payload.error }}</p>
            }
            <div class="entries">
              @for (entry of payload.entries; track entry.key) {
                <details>
                  <summary>
                    <span class="chevron" aria-hidden="true"></span>
                    @if (payloadLabel(entry); as label) {
                      <span class="tag">{{ label }}</span>
                    }
                    @if (entry.http; as http) {
                      <span
                        class="tag"
                        [class.server]="statusTone(http.status) === 'ok'"
                        [class.fault]="statusTone(http.status) === 'bad'"
                        >HTTP {{ http.status }}</span
                      >
                      <span class="entry-key">{{ http.url ?? entry.key }}</span>
                    } @else {
                      <span class="entry-key">{{ entry.key }}</span>
                    }
                    <span class="entry-size">{{ entry.size }} B</span>
                  </summary>
                  <pre>{{ entry.value | json }}</pre>
                </details>
              }
            </div>
          }
        } @else {
          <div class="empty">
            <p>Open a page of the app to see its payload.</p>
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      color: var(--text);
      font-size: 13px;
    }
    .state {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-2);
    }
    .state.error {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      @include m.soft(var(--danger));
    }
    .state.error strong {
      font-weight: 600;
    }
    .state.error span {
      color: var(--text);
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--border-strong);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin: 0 0 16px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: color-mix(in srgb, var(--surface) 85%, transparent);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }
    .toolbar .page-picker {
      display: flex;
      flex: 0 1 auto;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .page-picker > span {
      @include m.label;
    }
    .toolbar app-select {
      width: 280px;
      max-width: 420px;
    }
    .field-group {
      display: grid;
      gap: 6px;
      min-width: 0;
      color: var(--text-2);
      font-size: 12px;
      font-weight: 500;
    }
    .field-group app-select {
      width: 100%;
    }
    .message {
      flex: 1 1 200px;
      min-width: 0;
      margin: 0;
      color: var(--text-2);
      font-size: 12px;
      text-align: right;
    }
    .message:empty {
      display: none;
    }
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .panel {
      @include m.panel;
      @include m.enter;
      min-width: 0;
      padding: 16px;
    }
    .wide {
      grid-column: 1 / -1;
    }
    h2 {
      @include m.label;
      margin: 0 0 16px;
    }
    h3 {
      margin: 16px 0 8px;
      color: var(--text-strong);
      font-size: 12px;
      font-weight: 600;
    }
    p {
      margin: 0;
    }
    label {
      display: grid;
      gap: 6px;
      color: var(--text-2);
      font-size: 12px;
      font-weight: 500;
    }
    label.inline {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      color: var(--text);
      cursor: pointer;
    }
    .hint {
      color: var(--text-3);
      font-weight: 400;
    }
    input,
    select,
    textarea,
    button {
      font: inherit;
      color: var(--text);
    }
    input:not([type='checkbox']),
    select,
    textarea {
      width: 100%;
      min-width: 0;
      padding: 0 10px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background-color: var(--bg);
      transition:
        border-color 0.2s var(--ease),
        box-shadow 0.2s var(--ease);
    }
    input:not([type='checkbox']),
    select {
      height: 34px;
    }
    select {
      padding-right: 36px;
    }
    textarea {
      padding: 8px 10px;
      font-family: var(--font-mono);
      font-size: 12px;
    }
    input::placeholder,
    textarea::placeholder {
      color: var(--text-3);
    }
    input:not([type='checkbox']):hover,
    select:hover,
    textarea:hover {
      border-color: color-mix(in srgb, var(--border-strong) 60%, var(--text-3));
    }
    input:not([type='checkbox']):focus-visible,
    select:focus-visible,
    textarea:focus-visible {
      @include m.field-focus;
    }
    textarea[aria-invalid='true'] {
      border-color: color-mix(in srgb, var(--danger) 60%, transparent);
    }
    input[type='checkbox'] {
      flex: none;
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--accent);
      cursor: pointer;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 34px;
      padding: 0 14px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      transition:
        background-color 0.2s var(--ease),
        border-color 0.2s var(--ease),
        color 0.2s var(--ease),
        transform 0.1s var(--ease);
    }
    button:hover:not(:disabled) {
      border-color: var(--accent-line);
      background: var(--surface-3);
    }
    button:active:not(:disabled) {
      transform: translateY(1px);
    }
    button[type='submit'] {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--accent-ink);
      font-weight: 600;
    }
    button[type='submit']:hover:not(:disabled) {
      border-color: var(--accent-hover);
      background: var(--accent-hover);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button.ghost {
      height: 28px;
      padding: 0 10px;
      border-color: transparent;
      background: none;
      color: var(--text-2);
      font-size: 12px;
    }
    button.ghost:hover:not(:disabled) {
      border-color: var(--border-strong);
      background: var(--surface-2);
      color: var(--text);
    }
    button.link {
      display: inline;
      height: auto;
      padding: 0;
      border: none;
      border-radius: 4px;
      background: none;
      color: var(--text);
      text-align: left;
    }
    button.link:hover:not(:disabled) {
      border: none;
      background: none;
      color: var(--accent);
    }
    button.link:active:not(:disabled) {
      transform: none;
    }
    :focus-visible {
      @include m.focus-ring;
    }
    .muted {
      color: var(--text-2);
    }
    .small {
      font-size: 12px;
    }
    .bad {
      color: var(--danger);
    }
    .empty {
      display: grid;
      gap: 4px;
      padding: 24px 16px;
      border: 1px dashed var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text);
      text-align: center;
      line-height: 1.5;
    }
    .table-wrap {
      overflow-x: auto;
      margin: 0 -16px;
      padding: 0 16px;
    }
    table {
      width: 100%;
      min-width: 560px;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums;
    }
    th,
    td {
      height: 36px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: middle;
      white-space: nowrap;
    }
    th:first-child,
    td:first-child {
      padding-left: 8px;
    }
    th {
      @include m.label;
      height: 32px;
      border-bottom-color: var(--border-strong);
    }
    .num {
      text-align: right;
    }
    td.num {
      color: var(--text-2);
    }
    tbody tr {
      cursor: pointer;
    }
    tbody td {
      transition: background-color 0.15s var(--ease);
    }
    tbody tr:hover td {
      background: var(--surface-2);
    }
    tr.selected td,
    tr.selected:hover td {
      background: var(--accent-soft);
    }
    tr.selected td:first-child {
      box-shadow: inset 2px 0 0 var(--accent);
    }
    .method {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      color: var(--text-strong);
    }
    td.url {
      width: 100%;
      max-width: 0;
      font-family: var(--font-mono);
      font-size: 12px;
    }
    td.url button.link {
      display: block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    tr.selected td.url button.link {
      color: var(--text-strong);
    }
    td.page-url {
      max-width: 160px;
      overflow: hidden;
      color: var(--text-2);
      font-family: var(--font-mono);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rule-note {
      grid-column: 1 / -1;
      margin: 0;
      padding-left: 24px;
      color: var(--text-2);
      font-size: 12px;
    }
    .mismatches li {
      display: grid;
      gap: 4px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
    }
    .mismatch-row {
      display: flex;
      gap: 8px;
      min-width: 0;
      font-size: 12px;
    }
    .mismatch-row code {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .mismatch-label {
      flex: none;
      width: 64px;
      color: var(--text-2);
    }
    .status {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 600;
      color: var(--text-2);
    }
    .status.ok {
      color: var(--ok);
    }
    .status.bad {
      color: var(--danger);
    }
    .dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      margin-right: 6px;
      border-radius: 50%;
      background: currentColor;
      vertical-align: middle;
    }
    .notes {
      display: flex;
      gap: 4px;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      height: 20px;
      padding: 0 8px;
      border: 1px solid var(--border-strong);
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .tag.server {
      @include m.soft(var(--accent));
    }
    .tag.fault {
      @include m.soft(var(--danger));
    }
    .tag.on {
      @include m.soft(var(--ok));
    }
    .tag.off-tag {
      @include m.soft(var(--warn));
    }
    pre {
      margin: 0;
      padding: 10px 12px;
      max-height: 240px;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text-2);
      font: 12px/1.5 var(--font-mono);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    pre + pre {
      margin-top: 8px;
    }
    pre.warn {
      border-color: color-mix(in srgb, var(--warn) 30%, transparent);
      color: var(--warn);
    }
    pre.error {
      border-color: color-mix(in srgb, var(--danger) 30%, transparent);
      color: var(--danger);
    }
    .preview {
      @include m.enter(0.2s);
      margin-top: 16px;
    }
    .preview-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }
    .preview-head h3 {
      margin: 0;
    }
    .preview-meta {
      display: flex;
      align-items: baseline;
      gap: 8px;
      min-width: 0;
      margin-bottom: 8px;
    }
    .preview-url {
      min-width: 0;
      overflow: hidden;
      color: var(--text-2);
      font-family: var(--font-mono);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rule-form {
      display: grid;
      gap: 12px;
    }
    .row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    @media (max-width: 420px) {
      .row {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .field-error {
      margin-top: -4px;
      color: var(--danger);
      font-size: 12px;
    }
    .field-error:empty {
      display: none;
    }
    .form-actions {
      display: flex;
    }
    .rules-heading {
      margin-top: 24px;
    }
    .rules,
    .plain {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .rules li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 4px 12px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      transition:
        border-color 0.2s var(--ease),
        opacity 0.2s var(--ease);
    }
    .rules li:hover {
      border-color: var(--border-strong);
    }
    .rules li.off .rule-pattern {
      color: var(--text-2);
      text-decoration: line-through;
    }
    .rules li.off .rule-method,
    .rules li.off .rule-meta,
    .rules li.off .rule-meta .status {
      color: var(--text-3);
    }
    .rules li.empty-rule {
      display: block;
      padding: 16px 12px;
      border-style: dashed;
      border-color: var(--border-strong);
      background: none;
      color: var(--text-2);
      text-align: center;
    }
    .rule-pattern {
      min-width: 0;
      overflow: hidden;
      color: var(--text-strong);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rule-method {
      color: var(--accent);
      font-weight: 600;
    }
    .rule-meta {
      display: flex;
      flex-wrap: wrap;
      grid-column: 1 / -1;
      gap: 4px 8px;
      padding-left: 24px;
      color: var(--text-2);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .rule-meta > span + span::before {
      content: '·';
      margin-right: 8px;
      color: var(--text-3);
    }
    .rule-meta .status {
      font-size: 11px;
    }
    .rules button.remove {
      padding: 2px 4px;
      color: var(--text-2);
      font-size: 12px;
    }
    .rules button.remove:hover:not(:disabled) {
      color: var(--danger);
    }
    .plain li {
      overflow-wrap: anywhere;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .stats {
      display: grid;
      margin: 0;
    }
    .stats > div {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: 36px;
      padding: 6px 0;
      border-bottom: 1px solid var(--border);
    }
    .stats > div:last-child {
      border-bottom: none;
    }
    dt {
      color: var(--text-2);
    }
    dd {
      margin: 0;
      color: var(--text-strong);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    .ok-note {
      color: var(--text-2);
    }
    .summary-line {
      margin-bottom: 8px;
      font-variant-numeric: tabular-nums;
    }
    .entries {
      border-top: 1px solid var(--border);
    }
    details {
      border-bottom: 1px solid var(--border);
    }
    details pre {
      margin: 0 0 12px;
    }
    summary {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 36px;
      padding: 6px 4px;
      border-radius: 4px;
      list-style: none;
      cursor: pointer;
      transition: background-color 0.15s var(--ease);
    }
    summary::-webkit-details-marker {
      display: none;
    }
    summary:hover {
      background: var(--surface-2);
    }
    .chevron {
      flex: none;
      width: 6px;
      height: 6px;
      margin: 0 4px;
      border-right: 1.5px solid var(--text-3);
      border-bottom: 1.5px solid var(--text-3);
      transform: rotate(-45deg);
      transition: transform 0.15s var(--ease);
    }
    details[open] .chevron {
      transform: rotate(45deg);
    }
    .entry-key {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      font-family: var(--font-mono);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    summary:hover .entry-key {
      color: var(--accent);
    }
    .entry-size {
      flex: none;
      color: var(--text-2);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    @media (max-width: 760px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
      .toolbar .page-picker {
        flex: 1 1 100%;
      }
      .toolbar app-select {
        flex: 1 1 auto;
        width: auto;
        max-width: none;
      }
      .message {
        text-align: left;
      }
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
  private readonly hostPageId = hostPageId();
  readonly selectedPageId = linkedSignal<HttpPage[], string | null>({
    source: () => this.pages(),
    computation: (pages, previous) =>
      previous?.value && pages.some((p) => p.pageId === previous.value)
        ? previous.value
        : (pages.find((p) => p.pageId === this.hostPageId)?.pageId ?? pages[0]?.pageId ?? null),
  });
  readonly selectedCallId = signal<string | null>(null);
  readonly draft = signal<RuleDraft>({ ...EMPTY_DRAFT });
  readonly message = signal('');
  readonly bodyPlaceholder = '{ "error": "Service unavailable" }';

  private unsubscribe: (() => void) | null = null;
  private readonly destroyRef = inject(DestroyRef);

  readonly selected = computed(
    () => this.pages().find((p) => p.pageId === this.selectedPageId()) ?? null,
  );

  readonly pageServerCalls = computed(() => {
    const initialUrl = this.selected()?.initialUrl;
    if (!initialUrl) return this.serverCalls();
    return this.serverCalls().filter((c) => !c.pageUrl || c.pageUrl === initialUrl);
  });

  readonly timeline = computed(() =>
    [...this.pageServerCalls(), ...(this.selected()?.calls ?? [])].sort((a, b) => b.at - a.at),
  );

  readonly selectedCall = computed(
    () => this.timeline().find((c) => c.id === this.selectedCallId()) ?? null,
  );

  readonly draftMocksOnServer = computed(() => {
    const draft = this.draft();
    const status = Number(draft.status);
    return (
      !!draft.status &&
      Number.isFinite(status) &&
      this.mocksOnServer({ target: draft.target, status })
    );
  });

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

  statusTone(status: number | undefined): 'ok' | 'redirect' | 'bad' | 'neutral' {
    if (status === undefined) return 'neutral';
    if (status === 0 || status >= 400) return 'bad';
    if (status >= 300) return 'redirect';
    if (status >= 200) return 'ok';
    return 'neutral';
  }

  mocksOnServer(rule: Pick<HttpRule, 'target' | 'status'>): boolean {
    return rule.target !== 'client' && rule.status !== undefined && rule.status < 400;
  }

  payloadLabel(entry: PayloadEntry): string | null {
    if (entry.source === 'hydration') return 'hydration annotations';
    if (entry.source === 'analog') return 'Analog';
    return null;
  }

  targetLabel(target: HttpRule['target']): string {
    return target === 'both' ? 'SSR + client' : target === 'server' ? 'SSR only' : 'Client only';
  }

  readonly pageOptions = computed<SelectOption[]>(() =>
    this.pages().map((page) => ({ value: page.pageId, label: page.title || page.url })),
  );

  readonly methodOptions: SelectOption[] = [
    { value: '', label: 'Any' },
    ...['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m })),
  ];

  readonly targetOptions: SelectOption<HttpRule['target']>[] = [
    { value: 'both', label: 'SSR + client' },
    { value: 'server', label: 'SSR only' },
    { value: 'client', label: 'Client only' },
  ];

  selectPage(pageId: string | null) {
    if (pageId) this.selectedPageId.set(pageId);
    this.selectedCallId.set(null);
  }

  setDraft<K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) {
    this.draft.update((draft) => ({ ...draft, [key]: value }));
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
