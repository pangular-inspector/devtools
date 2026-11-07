import { Component, computed, effect, input, linkedSignal, signal, untracked } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { actionAllowed, actionBlockedMessage } from '../devtools-config';
import { rpcTry as call } from '../rpc';
import { Select } from '../ui/select';

export interface PlaygroundRoute {
  method: string;
  path: string;
  file: string;
}

/** A route the parent asks the playground to load; `nonce` makes the same route load again. */
export interface PlaygroundTarget {
  route: PlaygroundRoute;
  nonce: number;
}

export interface PlaygroundResult {
  ok?: boolean;
  status?: number;
  ms?: number;
  headersMs?: number;
  type?: string;
  size?: number;
  headers?: Record<string, string>;
  body?: string;
  error?: string;
}

interface Pair {
  id: number;
  key: string;
  value: string;
}

type PairList = 'query' | 'headers' | 'cookies';

interface Snapshot {
  method: string;
  template: string;
  params: Record<string, string>;
  query: Pair[];
  headers: Pair[];
  cookies: Pair[];
  body: string;
}

export interface HistoryEntry {
  at: number;
  url: string;
  method: string;
  status?: number;
  ms?: number;
  error?: string;
  snapshot: Snapshot;
}

const MAX_HISTORY = 10;
const PAIR_LABEL: Record<PairList, { title: string; key: string; add: string }> = {
  query: { title: 'Query', key: 'Name', add: 'Add query parameter' },
  headers: { title: 'Headers', key: 'Header', add: 'Add header' },
  cookies: { title: 'Cookies', key: 'Cookie', add: 'Add cookie' },
};

let nextPair = 0;

/** The `:param` and `**` names of a route pattern, in order. */
export function patternParams(template: string): string[] {
  const names = Array.from(template.matchAll(/:(\w+)/g), (m) => m[1]);
  if (/(^|\/)\*\*(\/|$)/.test(template)) names.push('**');
  return [...new Set(names)];
}

/** A pattern with its params filled in, each value URL-encoded. */
export function fillPattern(template: string, values: Record<string, string>): string {
  return template
    .replace(/:(\w+)/g, (match, name: string) =>
      values[name] ? encodeURIComponent(values[name]) : match,
    )
    .replace(/(^|\/)\*\*(?=\/|$)/, (match, slash: string) =>
      values['**'] ? `${slash}${values['**'].split('/').map(encodeURIComponent).join('/')}` : match,
    );
}

function quote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}

@Component({
  selector: 'app-analog-playground',
  imports: [Select],
  template: `
    <form class="card playground" (submit)="$event.preventDefault(); send()">
      <h2 id="playground-heading">Request playground</h2>
      @if (routeOptions().length) {
        <div class="row">
          <span class="label" id="playground-route-label">Route</span>
          <app-select
            class="grow"
            labelledBy="playground-route-label"
            placeholder="Pick an API route"
            [options]="routeOptions()"
            [value]="routeKey()"
            (valueChange)="pick($event)"
          />
        </div>
      }
      <div class="row">
        <app-select
          class="method-select"
          ariaLabel="Method"
          [options]="methodOptions"
          [value]="method()"
          (valueChange)="method.set($event ?? 'GET')"
        />
        <label for="api-path" class="sr-only">Path</label>
        <input
          id="api-path"
          class="field grow mono"
          type="text"
          placeholder="/api/v1/products/:id"
          aria-describedby="api-path-hint"
          [value]="template()"
          (input)="template.set($any($event.target).value)"
        />
        <button
          type="submit"
          class="btn primary"
          [disabled]="!canSend()"
          [attr.aria-describedby]="sendHintId()"
        >
          {{ sending() ? 'Sending…' : 'Send' }}
        </button>
      </div>
      <p id="api-path-hint" class="muted small">
        Write <code>:name</code> or <code>**</code> in the path to fill it in below.
        @if (template().trim()) {
          Sends <span class="mono">{{ url() }}</span>
        }
      </p>
      @if (!canCall()) {
        <p id="analog-calls-off" class="muted">{{ callsOff }}</p>
      } @else if (needsConfirm()) {
        <p id="analog-confirm-hint" class="muted">
          Tick "This request can change data on the dev server" below to send a
          {{ method() }} request.
        </p>
      }

      @if (params().length) {
        <fieldset class="group">
          <legend class="label">Path params</legend>
          @for (name of params(); track name) {
            <div class="row">
              <label class="pair-key mono" [for]="'param-' + $index">{{
                name === '**' ? 'rest of the path' : name
              }}</label>
              <input
                class="field grow mono"
                type="text"
                [id]="'param-' + $index"
                [value]="paramValues()[name] ?? ''"
                (input)="setParam(name, $any($event.target).value)"
              />
            </div>
          }
        </fieldset>
      }

      @for (list of pairLists; track list) {
        <details class="group" [open]="pairs(list).length > 0">
          <summary>
            {{ labels[list].title }}
            @if (pairs(list).length) {
              <span class="pill">{{ pairs(list).length }}</span>
            }
          </summary>
          @for (pair of pairs(list); track pair.id) {
            <div class="row pair">
              <label class="sr-only" [for]="list + '-key-' + pair.id"
                >{{ labels[list].key }} {{ $index + 1 }} name</label
              >
              <input
                class="field mono pair-input"
                type="text"
                [id]="list + '-key-' + pair.id"
                [placeholder]="labels[list].key"
                [value]="pair.key"
                (input)="editPair(list, pair.id, 'key', $any($event.target).value)"
              />
              <label class="sr-only" [for]="list + '-value-' + pair.id"
                >{{ labels[list].key }} {{ $index + 1 }} value</label
              >
              <input
                class="field grow mono"
                type="text"
                placeholder="Value"
                [id]="list + '-value-' + pair.id"
                [value]="pair.value"
                (input)="editPair(list, pair.id, 'value', $any($event.target).value)"
              />
              <button
                type="button"
                class="btn ghost"
                [attr.aria-label]="'Remove ' + labels[list].key.toLowerCase() + ' ' + ($index + 1)"
                (click)="removePair(list, pair.id)"
              >
                Remove
              </button>
            </div>
          }
          <button type="button" class="btn ghost" (click)="addPair(list)">
            {{ labels[list].add }}
          </button>
        </details>
      }

      @if (method() !== 'GET') {
        <label class="label" for="api-body">JSON body</label>
        <textarea
          id="api-body"
          class="field mono"
          rows="3"
          placeholder='{"name": "Ada"}'
          [value]="body()"
          (input)="body.set($any($event.target).value)"
        ></textarea>
        <label class="check confirm-send"
          ><input
            type="checkbox"
            [checked]="confirmSend()"
            (change)="confirmSend.set(!confirmSend())"
          />
          This request can change data on the dev server</label
        >
      }

      <div class="row">
        <button type="button" class="btn ghost" (click)="copy('curl')">Copy as curl</button>
        <button type="button" class="btn ghost" (click)="copy('fetch')">Copy as fetch</button>
        <span class="muted small" role="status">{{ copied() }}</span>
      </div>

      @if (sending()) {
        <p class="muted" role="status">Sending {{ method() }} {{ url() }}…</p>
      } @else if (response(); as r) {
        <div class="response" role="status">
          @if (r.error) {
            <div class="row">
              <span class="status" data-status="bad">Refused</span>
              <span>{{ r.error }}</span>
            </div>
          } @else {
            <div class="row">
              <span class="status" [attr.data-status]="statusClass(r.status ?? 0)">{{
                r.status
              }}</span>
              <span class="muted tnum"
                >{{ r.ms }} ms total
                @if (r.headersMs !== undefined) {
                  · headers after {{ r.headersMs }} ms
                }
                · {{ sizeText(r.size) }} · {{ r.type || 'no content type' }}</span
              >
            </div>
            @if (headerList(r).length) {
              <details>
                <summary>Response headers ({{ headerList(r).length }})</summary>
                <dl class="facts headers">
                  @for (h of headerList(r); track h[0]) {
                    <dt class="mono">{{ h[0] }}</dt>
                    <dd class="mono">{{ h[1] }}</dd>
                  }
                </dl>
              </details>
            }
            <pre class="code">{{ pretty(r.body ?? '') }}</pre>
          }
        </div>
      }

      @if (history().length) {
        <div class="history">
          <h3>History for {{ template().trim() || '/' }}</h3>
          <ul class="plain">
            @for (h of history(); track $index) {
              <li class="row">
                <span
                  class="status"
                  [attr.data-status]="h.error ? 'bad' : statusClass(h.status ?? 0)"
                  >{{ h.error ? 'Refused' : h.status }}</span
                >
                <span class="mono path">{{ h.method }} {{ h.url }}</span>
                @if (h.ms !== undefined) {
                  <span class="muted small tnum">{{ h.ms }} ms</span>
                }
                <button
                  type="button"
                  class="btn ghost"
                  [attr.aria-label]="'Load ' + h.method + ' ' + h.url + ' again'"
                  (click)="restore(h)"
                >
                  Load
                </button>
              </li>
            }
          </ul>
        </div>
      }
    </form>
  `,
  styles: `
    @use 'mixins' as m;
    @use 'analog' as a;
    @include a.controls;
    :host {
      display: block;
    }
    .method-select {
      width: 112px;
      font-family: var(--mono);
    }
    .group {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    details.group > summary {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    details.group[open] > summary {
      margin-bottom: 4px;
    }
    .group legend {
      padding: 0 4px;
    }
    .pair-key {
      min-width: 120px;
      color: var(--text-2);
    }
    .pair-input {
      flex: 0 1 180px;
      min-width: 0;
    }
    .response {
      display: grid;
      gap: 8px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
    }
    .headers {
      margin-top: 8px;
    }
    code {
      padding: 1px 6px;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-family: var(--mono);
      font-size: 12px;
    }
    .history {
      display: grid;
      gap: 6px;
    }
    .plain {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    @media (max-width: 560px) {
      .pair-input {
        flex: 1 1 100%;
      }
    }
  `,
})
export class AnalogPlayground {
  readonly rpc = input<DevframeRpcClient | null>(null);
  /** The API routes the route picker offers. */
  readonly routes = input<PlaygroundRoute[]>([]);
  /** A route to load, from a Try button. */
  readonly target = input<PlaygroundTarget | null>(null);
  /** The dev server origin for the copied commands; empty uses a placeholder. */
  readonly origin = input('');

  readonly canCall = computed(() => actionAllowed(this.rpc(), 'analog'));
  protected readonly callsOff = actionBlockedMessage('analog');
  protected readonly labels = PAIR_LABEL;
  protected readonly pairLists: PairList[] = ['query', 'headers', 'cookies'];
  readonly methodOptions = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({
    value: m,
    label: m,
  }));

  readonly method = signal('GET');
  readonly template = signal('');
  readonly paramValues = signal<Record<string, string>>({});
  readonly query = signal<Pair[]>([]);
  readonly headers = signal<Pair[]>([]);
  readonly cookies = signal<Pair[]>([]);
  readonly body = signal('');
  readonly response = signal<PlaygroundResult | null>(null);
  readonly sending = signal(false);
  readonly copied = signal('');
  /** Past requests by route pattern, newest first. */
  readonly historyByRoute = signal<Record<string, HistoryEntry[]>>({});

  readonly params = computed(() => patternParams(this.template()));
  readonly url = computed(() => {
    const path = fillPattern(this.template().trim(), this.paramValues());
    const search = new URLSearchParams();
    for (const pair of this.query())
      if (pair.key.trim()) search.append(pair.key.trim(), pair.value);
    const query = search.toString();
    if (!query) return path;
    return `${path}${path.includes('?') ? '&' : '?'}${query}`;
  });
  /** Confirms one request: cleared when the method or URL changes, and after it is sent. */
  readonly confirmSend = linkedSignal({
    source: () => `${this.method()} ${this.url()}`,
    computation: () => false,
  });
  readonly needsConfirm = computed(() => this.method() !== 'GET' && !this.confirmSend());
  readonly canSend = computed(
    () => this.canCall() && !this.sending() && !this.needsConfirm() && !!this.template().trim(),
  );
  readonly sendHintId = computed(() =>
    !this.canCall() ? 'analog-calls-off' : this.needsConfirm() ? 'analog-confirm-hint' : null,
  );
  readonly history = computed(() => this.historyByRoute()[this.template().trim()] ?? []);
  readonly routeOptions = computed(() =>
    this.routes().map((route) => ({
      value: `${route.method} ${route.path}`,
      label: `${route.method} ${route.path}`,
    })),
  );
  readonly routeKey = computed(() => {
    const key = `${this.method()} ${this.template().trim()}`;
    return this.routeOptions().some((o) => o.value === key) ? key : null;
  });

  private lastNonce = -1;

  constructor() {
    // A Try button in the parent hands a route over through `target`, once per click.
    effect(() => {
      const target = this.target();
      if (!target || target.nonce === this.lastNonce) return;
      this.lastNonce = target.nonce;
      untracked(() => this.load(target.route));
    });
  }

  load(route: PlaygroundRoute) {
    this.method.set(route.method === 'ANY' ? 'GET' : route.method);
    this.template.set(route.path);
    this.paramValues.set({});
    this.confirmSend.set(false);
    this.response.set(null);
    queueMicrotask(() => {
      const first = this.params().length ? 'param-0' : 'api-path';
      document.getElementById(first)?.focus();
    });
  }

  pick(key: string | null) {
    const route = this.routes().find((r) => `${r.method} ${r.path}` === key);
    if (route) this.load(route);
  }

  setParam(name: string, value: string) {
    this.paramValues.update((values) => ({ ...values, [name]: value }));
  }

  pairs(list: PairList): Pair[] {
    return this[list]();
  }

  addPair(list: PairList) {
    const id = nextPair++;
    this[list].update((pairs) => [...pairs, { id, key: '', value: '' }]);
    queueMicrotask(() => document.getElementById(`${list}-key-${id}`)?.focus());
  }

  editPair(list: PairList, id: number, field: 'key' | 'value', value: string) {
    this[list].update((pairs) => pairs.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  removePair(list: PairList, id: number) {
    this[list].update((pairs) => pairs.filter((p) => p.id !== id));
  }

  private record(list: PairList): Record<string, string> | undefined {
    const out: Record<string, string> = {};
    for (const pair of this[list]()) if (pair.key.trim()) out[pair.key.trim()] = pair.value;
    return Object.keys(out).length ? out : undefined;
  }

  private parsedBody(): { body?: unknown; error?: string } {
    if (this.method() === 'GET' || !this.body().trim()) return {};
    try {
      return { body: JSON.parse(this.body()) };
    } catch {
      return { error: 'The body is not valid JSON.' };
    }
  }

  private snapshot(): Snapshot {
    return {
      method: this.method(),
      template: this.template().trim(),
      params: { ...this.paramValues() },
      query: this.query(),
      headers: this.headers(),
      cookies: this.cookies(),
      body: this.body(),
    };
  }

  restore(entry: HistoryEntry) {
    const s = entry.snapshot;
    this.method.set(s.method);
    this.template.set(s.template);
    this.paramValues.set({ ...s.params });
    this.query.set(s.query);
    this.headers.set(s.headers);
    this.cookies.set(s.cookies);
    this.body.set(s.body);
    this.response.set(null);
  }

  async send() {
    const path = this.url();
    if (!this.template().trim() || this.sending() || this.needsConfirm()) return;
    const parsed = this.parsedBody();
    if (parsed.error) {
      this.response.set({ error: parsed.error });
      return;
    }
    const snapshot = this.snapshot();
    this.response.set(null);
    this.sending.set(true);
    try {
      const result =
        (await call<PlaygroundResult>(this.rpc(), 'analog-call-api', {
          method: this.method(),
          path,
          body: parsed.body,
          headers: this.record('headers'),
          cookies: this.record('cookies'),
          confirm: this.confirmSend(),
        })) ?? ({ error: 'No answer from the devtools server.' } satisfies PlaygroundResult);
      this.response.set(result);
      const entry: HistoryEntry = {
        at: Date.now(),
        url: path,
        method: snapshot.method,
        snapshot,
        ...(result.error ? { error: result.error } : { status: result.status, ms: result.ms }),
      };
      this.historyByRoute.update((all) => ({
        ...all,
        [snapshot.template]: [entry, ...(all[snapshot.template] ?? [])].slice(0, MAX_HISTORY),
      }));
    } finally {
      this.sending.set(false);
      this.confirmSend.set(false);
    }
  }

  /** The request as a curl command or a fetch() call. */
  command(kind: 'curl' | 'fetch'): string {
    const url = `${this.origin() || 'http://localhost:5173'}${this.url()}`;
    const headers: Record<string, string> = { ...this.record('headers') };
    const cookies = this.record('cookies');
    if (cookies) {
      headers['cookie'] = Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }
    const body = this.method() !== 'GET' && this.body().trim() ? this.body().trim() : undefined;
    if (body) headers['content-type'] ??= 'application/json';
    if (kind === 'curl') {
      return [
        `curl -X ${this.method()} ${quote(url)}`,
        ...Object.entries(headers).map(([k, v]) => `-H ${quote(`${k}: ${v}`)}`),
        ...(body ? [`--data ${quote(body)}`] : []),
      ].join(' \\\n  ');
    }
    const init: Record<string, unknown> = { method: this.method() };
    if (Object.keys(headers).length) init['headers'] = headers;
    if (body) init['body'] = body;
    return `await fetch(${JSON.stringify(url)}, ${JSON.stringify(init, null, 2)});`;
  }

  async copy(kind: 'curl' | 'fetch') {
    try {
      await navigator.clipboard.writeText(this.command(kind));
      this.copied.set(kind === 'curl' ? 'Copied as curl.' : 'Copied as fetch.');
    } catch {
      this.copied.set('Could not copy. The browser blocked the clipboard.');
    }
  }

  headerList(result: PlaygroundResult): [string, string][] {
    return Object.entries(result.headers ?? {});
  }

  sizeText(size: number | undefined): string {
    if (size === undefined) return 'size unknown';
    return size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} kB`;
  }

  statusClass(status: number): 'good' | 'warn' | 'bad' {
    if (status >= 500 || status === 0) return 'bad';
    if (status >= 400) return 'warn';
    return 'good';
  }

  pretty(text: string): string {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
}
