import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { time } from '../format';
import { hostPageId } from '../page-id';
import { isStaticReport, rpcCall } from '../rpc';
import { Select, type SelectOption } from '../ui/select';
import type { ComponentFocus } from '../types/component-focus.types';
import { AuditDiffView } from './audit-diff';
import {
  AREA_LABEL,
  AUDIT_AREAS,
  METRICS,
  toAuditResponse,
  toolCall,
  type AuditArea,
  type AuditFinding,
  type AuditResponse,
} from './audit-types';

type SeverityFilter = 'all' | 'error' | 'warning';

const SEVERITY_TONE = { error: 'danger', warning: 'warn', info: 'accent' } as const;
const SEVERITY_RANK = { error: 0, warning: 1, info: 2 } as const;
/** Areas whose findings point at a component host the Components tab can select. */
const COMPONENT_AREAS: readonly AuditArea[] = ['errors', 'hydration'];
/**
 * How long the panel waits after a change to the `audit` shared state before
 * reading the audit again, so a burst (an axe pass starting, its result, it
 * ending) costs one read.
 */
export const AUDIT_REFRESH_DELAY_MS = 150;

@Component({
  selector: 'app-audit-inspector',
  imports: [Select, AuditDiffView],
  template: `
    @if (staticReport()) {
      <div class="state" role="status">
        <p>The audit reads a live page, and a static report has none.</p>
        <p class="muted">Open the panel from the server that runs the app to audit it.</p>
      </div>
    } @else if (!loaded()) {
      <p class="state" role="status">Loading the audit…</p>
    } @else if (failed()) {
      <div class="state" role="alert">
        <p>Can't read the audit from the devtools server.</p>
        <button type="button" class="small" (click)="refresh()">Retry</button>
      </div>
    } @else if (!report()) {
      <div class="state" role="status">
        <p>No page reports live data yet.</p>
        <p class="muted">
          Open the app with the overlay loaded. The audit reads what the other inspectors collect
          from it.
        </p>
      </div>
    } @else {
      <p class="intro">
        One ranked list of what the inspectors found on the live page, with an axe pass over the app
        when you run one. Take a baseline before a change and an after audit to compare them. Agents
        get the same list from the <code>audit</code> tool.
      </p>

      <div class="toolbar">
        <div class="search">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            #search
            type="search"
            aria-label="Filter findings"
            placeholder="Filter by component, rule or text"
            [value]="filter()"
            (input)="filter.set($any($event.target).value)"
            (keydown.escape)="filter.set('')"
          />
        </div>
        <app-select
          class="filter-select"
          ariaLabel="Area"
          [options]="areaOptions()"
          [value]="area()"
          (valueChange)="area.set($any($event) ?? 'all')"
        />
        <app-select
          class="filter-select"
          ariaLabel="Severity"
          [options]="severityOptions"
          [value]="severity()"
          (valueChange)="severity.set($any($event) ?? 'all')"
        />
        @if (pageOptions().length > 1) {
          <app-select
            class="filter-select"
            ariaLabel="Page"
            [options]="pageOptions()"
            [value]="pageId()"
            (valueChange)="pickPage($event)"
          />
        }
        <span class="count" role="status">{{ countText() }}</span>
        <button type="button" class="small" [disabled]="axeRunning()" (click)="runAxe()">
          {{ axeRunning() ? 'Running axe…' : 'Run axe' }}
        </button>
        <button type="button" class="small" [disabled]="busy()" (click)="refresh()">Refresh</button>
      </div>

      <p class="axe-status" role="status">{{ axeStatus() }}</p>
      @if (axeError(); as error) {
        <p class="notice error" role="alert">{{ error }}</p>
      }

      <section class="session" aria-labelledby="audit-session-title">
        <div class="session-head">
          <h2 id="audit-session-title">Before and after</h2>
          <div class="actions">
            <button type="button" class="small" [disabled]="busy()" (click)="mark('before')">
              Take baseline
            </button>
            <button
              type="button"
              class="small"
              [disabled]="busy() || !before()"
              (click)="mark('after')"
            >
              Take after audit
            </button>
            @if (before()) {
              <button type="button" class="small" [disabled]="busy()" (click)="mark('clear')">
                Clear
              </button>
            }
          </div>
        </div>
        <p class="muted">{{ sessionText() }}</p>
        @if (sessionError(); as error) {
          <p class="notice error" role="alert">{{ error }}</p>
        }
        @if (diff(); as diff) {
          <app-audit-diff [diff]="diff" />
        }
      </section>

      <section aria-labelledby="audit-findings-title">
        <h2 id="audit-findings-title" class="section-title">Findings</h2>
        @if (!findings().length) {
          <p class="empty">
            No finding on this page. Run axe, or record change detection, to check more.
          </p>
        } @else if (!shown().length) {
          <div class="empty">
            <p>No finding matches the filters.</p>
            <button type="button" class="small" (click)="clearFilters(); search.focus()">
              Clear filters
            </button>
          </div>
        } @else {
          <ol class="findings" aria-label="Findings, most severe first">
            @for (finding of shown(); track finding.key) {
              <li class="finding" (mouseenter)="highlight(finding)" (mouseleave)="highlight(null)">
                <div class="head">
                  <span class="chip" [attr.data-tone]="tone[finding.severity]">{{
                    finding.severity
                  }}</span>
                  <span class="chip plain">{{ areaLabel[finding.area] }}</span>
                  @if (finding.subject) {
                    <code class="subject">{{ finding.subject }}</code>
                  }
                  @if ((finding.count ?? 1) > 1) {
                    <span class="times" [attr.aria-label]="finding.count + ' times'"
                      >{{ finding.count }}×</span
                    >
                  }
                </div>
                <p class="why">{{ finding.why }}</p>
                <div class="meta">
                  <span class="muted"
                    >Rule <code>{{ finding.rule }}</code></span
                  >
                  <span class="muted"
                    >Agent tool <code>{{ toolCall(finding) }}</code></span
                  >
                  <!-- Both open or outline the element through the Components inspector. -->
                  @if (finding.elementId && canShowComponent()) {
                    @if (isComponentArea(finding.area)) {
                      <button
                        type="button"
                        class="link"
                        (focus)="highlight(finding)"
                        (blur)="highlight(null)"
                        (click)="showComponent.emit({ id: finding.elementId, pageId: pageId() })"
                      >
                        Show component
                      </button>
                    } @else {
                      <button
                        type="button"
                        class="link"
                        (focus)="highlight(finding)"
                        (blur)="highlight(null)"
                        (click)="highlight(finding, true)"
                      >
                        Show in page
                      </button>
                    }
                  }
                </div>
              </li>
            }
          </ol>
        }
      </section>

      <section aria-labelledby="audit-numbers-title">
        <h2 id="audit-numbers-title" class="section-title">Key numbers</h2>
        <dl class="numbers">
          @for (metric of numbers(); track metric.label) {
            <div>
              <dt>{{ metric.label }}</dt>
              <dd>{{ metric.value }}</dd>
            </div>
          }
        </dl>
      </section>

      @if (coverage().length) {
        <section aria-labelledby="audit-coverage-title">
          <h2 id="audit-coverage-title" class="section-title">Not checked</h2>
          <ul class="coverage">
            @for (source of coverage(); track source.area) {
              <li>
                <strong>{{ areaLabel[source.area] }}</strong>
                {{
                  source.state === 'off'
                    ? 'Its inspector is turned off.'
                    : (source.note ?? 'Nothing to read yet.')
                }}
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
  styles: `
    @use 'mixins' as m;
    :host {
      display: block;
      font-size: 13px;
    }
    .intro {
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .muted {
      color: var(--text-2);
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      margin: 0 0 8px;
      padding: 8px;
      background: color-mix(in srgb, var(--surface) 85%, transparent);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: var(--radius);
    }
    .search {
      position: relative;
      flex: 1 1 200px;
      min-width: 0;
    }
    .search-icon {
      position: absolute;
      top: 50%;
      left: 12px;
      width: 14px;
      height: 14px;
      transform: translateY(-50%);
      fill: none;
      stroke: var(--text-3);
      stroke-width: 2.2;
      stroke-linecap: round;
      pointer-events: none;
    }
    input[type='search'] {
      width: 100%;
      height: var(--control-h);
      padding: 0 12px 0 34px;
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 13px;
    }
    input[type='search']:focus {
      @include m.field-focus;
    }
    .filter-select {
      flex: 0 1 170px;
      min-width: 0;
    }
    .count {
      margin-left: auto;
      color: var(--text-2);
      font-size: 12px;
    }
    .small {
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      cursor: pointer;
    }
    .small:hover:not(:disabled) {
      background: var(--surface-3);
    }
    .small:disabled {
      color: var(--text-2);
      cursor: default;
    }
    .small:focus-visible {
      @include m.focus-ring;
    }
    .axe-status {
      min-height: 1.5em;
      margin: 0 0 8px;
      color: var(--text-2);
      font-size: 12px;
    }
    .notice {
      margin: 0 0 12px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-2);
      line-height: 1.5;
    }
    .notice.error {
      color: var(--danger-text);
      border-color: color-mix(in srgb, var(--danger) 40%, transparent);
    }
    section {
      margin: 0 0 16px;
    }
    .session {
      @include m.panel;
      display: grid;
      gap: 8px;
      padding: 10px 12px;
    }
    .session p {
      margin: 0;
    }
    .session-head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      justify-content: space-between;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    h2 {
      margin: 0;
      color: var(--text-strong);
      font-size: 14px;
      font-weight: 600;
    }
    .section-title {
      margin: 0 0 8px;
    }
    .findings {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .finding {
      @include m.panel;
      display: grid;
      gap: 4px;
      min-width: 0;
      padding: 8px 12px;
    }
    .head,
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      align-items: center;
      min-width: 0;
    }
    .meta {
      font-size: 12px;
    }
    .meta code {
      overflow-wrap: anywhere;
    }
    .subject {
      min-width: 0;
      color: var(--text-strong);
      overflow-wrap: anywhere;
    }
    .times {
      color: var(--text-2);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .why {
      margin: 0;
      color: var(--text);
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      padding: 1px 8px;
      border: 1px solid transparent;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
      @include m.tint(accent);
    }
    .chip.plain {
      border-color: var(--border);
      background: var(--surface-2);
      color: var(--text-2);
    }
    .chip[data-tone='danger'] {
      @include m.tint(danger);
    }
    .chip[data-tone='warn'] {
      @include m.tint(warn);
    }
    .link {
      padding: 0;
      border: 0;
      border-radius: 2px;
      background: none;
      color: var(--accent-text);
      font: inherit;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    .link:focus-visible {
      @include m.focus-ring;
    }
    .numbers {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: 6px;
      margin: 0;
    }
    .numbers div {
      @include m.panel;
      padding: 6px 10px;
    }
    .numbers dt {
      color: var(--text-2);
      font-size: 12px;
    }
    .numbers dd {
      margin: 0;
      color: var(--text-strong);
      font-size: 15px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .coverage {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0 0 0 18px;
      color: var(--text-2);
      font-size: 12px;
    }
    .coverage strong {
      color: var(--text);
      font-weight: 600;
    }
    .empty,
    .state {
      margin: 0 0 12px;
      color: var(--text-2);
    }
    .empty p,
    .state p {
      margin: 0 0 8px;
    }
  `,
})
export class AuditInspector {
  readonly rpc = input<DevframeRpcClient | null>(null);
  /**
   * Whether the Components inspector is on: "Show component" opens its tab, and
   * "Show in page" and hover outlines go through its `request-page-highlight`.
   */
  readonly canShowComponent = input(true);
  readonly showComponent = output<ComponentFocus>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly hostPageId = hostPageId();
  private unsubscribe?: () => void;
  private seq = 0;
  private highlighted = false;
  private queued?: ReturnType<typeof setTimeout>;

  protected readonly time = time;
  protected readonly toolCall = toolCall;
  protected readonly areaLabel = AREA_LABEL;
  protected readonly tone = SEVERITY_TONE;
  protected readonly severityOptions: SelectOption[] = [
    { value: 'all', label: 'All severities' },
    { value: 'error', label: 'Errors' },
    { value: 'warning', label: 'Warnings and errors' },
  ];

  readonly data = signal<AuditResponse | null>(null);
  readonly loaded = signal(false);
  readonly failed = signal(false);
  readonly busy = signal(false);
  readonly axeRunning = signal(false);
  readonly axeError = signal<string | null>(null);
  readonly sessionError = signal<string | null>(null);
  readonly filter = signal('');
  readonly area = signal<AuditArea | 'all'>('all');
  readonly severity = signal<SeverityFilter>('all');
  /** The page picked here, else the page the panel sits on, else the server's most recent. */
  readonly pageId = linkedSignal<AuditResponse | null, string>({
    source: () => this.data(),
    computation: (data, previous) =>
      previous?.value && data?.pages.some((page) => page.pageId === previous.value)
        ? previous.value
        : (data?.report?.pageId ?? this.hostPageId ?? ''),
  });

  readonly staticReport = computed(() => isStaticReport(this.rpc()));
  readonly report = computed(() => this.data()?.report ?? null);
  readonly findings = computed(() => this.report()?.findings ?? []);
  readonly before = computed(() => this.data()?.session?.before ?? null);
  readonly after = computed(() => this.data()?.session?.after ?? null);
  readonly diff = computed(() => this.data()?.session?.diff ?? null);
  readonly pageOptions = computed<SelectOption[]>(() =>
    (this.data()?.pages ?? []).map((page) => ({
      value: page.pageId,
      label: page.title || page.url || page.pageId,
      ...(page.url && page.url !== (page.title || page.url) ? { hint: page.url } : {}),
    })),
  );
  readonly areaOptions = computed<SelectOption[]>(() => [
    { value: 'all', label: 'All areas' },
    ...AUDIT_AREAS.map((area) => ({
      value: area,
      label: AREA_LABEL[area],
      hint: String(this.findings().filter((finding) => finding.area === area).length),
    })),
  ]);
  readonly shown = computed(() => {
    const text = this.filter().trim().toLowerCase();
    const area = this.area();
    const floor = this.severity() === 'all' ? 2 : SEVERITY_RANK[this.severity() as 'error'];
    return this.findings().filter(
      (finding) =>
        (area === 'all' || finding.area === area) &&
        SEVERITY_RANK[finding.severity] <= floor &&
        (!text ||
          `${finding.subject ?? ''} ${finding.rule} ${finding.why}`.toLowerCase().includes(text)),
    );
  });
  readonly countText = computed(
    () => `${this.shown().length} of ${this.findings().length} findings`,
  );
  readonly numbers = computed(() => {
    const metrics = this.report()?.metrics ?? {};
    return METRICS.filter((metric) => metrics[metric.key] !== undefined).map((metric) => ({
      label: metric.unit === '%' ? `${metric.label} (%)` : metric.label,
      value: `${metrics[metric.key]}${metric.unit === 'ms' ? ' ms' : ''}`,
    }));
  });
  readonly coverage = computed(() =>
    (this.report()?.sources ?? []).filter((source) => source.state !== 'ok'),
  );
  readonly axeStatus = computed(() => {
    if (this.axeRunning()) return 'Running axe on the page…';
    const axe = this.data()?.axe;
    if (!axe) return 'No axe pass on this page yet. Run axe to check accessibility.';
    return `Last axe pass at ${time(axe.at)}: ${axe.violations.length} ${axe.violations.length === 1 ? 'rule' : 'rules'} broken.`;
  });
  readonly sessionText = computed(() => {
    const before = this.before();
    const after = this.after();
    if (!before) {
      return 'Take a baseline, make your change, then take an after audit. Run axe and record change detection the same way both times, so the numbers compare.';
    }
    const base = `Baseline at ${time(before.at)} with ${before.findings.length} findings.`;
    return after
      ? `${base} After audit at ${time(after.at)} with ${after.findings.length} findings.`
      : `${base} Make your change, then take an after audit.`;
  });

  constructor() {
    effect(() => {
      const client = this.rpc();
      // Only the client is a dependency: the fetch reads the picked page, which must not re-run this.
      if (client && !isStaticReport(client)) untracked(() => void this.subscribe(client));
    });
    this.destroyRef.onDestroy(() => {
      this.unsubscribe?.();
      clearTimeout(this.queued);
      this.highlight(null);
    });
  }

  isComponentArea(area: AuditArea): boolean {
    return COMPONENT_AREAS.includes(area);
  }

  clearFilters() {
    this.filter.set('');
    this.area.set('all');
    this.severity.set('all');
  }

  pickPage(pageId: string | null) {
    if (!pageId) return;
    this.pageId.set(pageId);
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const client = this.rpc();
    if (!client) return;
    const seq = ++this.seq;
    this.failed.set(false);
    try {
      const value = await rpcCall(client, 'get-audit', { pageId: this.pageId() || undefined });
      if (seq !== this.seq || this.destroyRef.destroyed) return;
      const data = toAuditResponse(value);
      // The panel's own page may not report (yet): fall back to the server's most recent.
      if (!data.report && data.pages.length && this.pageId()) {
        this.pageId.set('');
        return this.refresh();
      }
      this.data.set(data);
    } catch {
      if (seq === this.seq) this.failed.set(true);
    } finally {
      if (seq === this.seq) this.loaded.set(true);
    }
  }

  async runAxe() {
    const client = this.rpc();
    if (!client || this.axeRunning()) return;
    this.axeRunning.set(true);
    this.axeError.set(null);
    try {
      const result = (await rpcCall(client, 'request-axe-run', {
        pageId: this.pageId() || undefined,
      })) as { ok?: boolean; error?: string } | null;
      if (!result?.ok) this.axeError.set(result?.error ?? 'The axe pass did not run.');
    } catch {
      this.axeError.set("Can't reach the devtools server to run axe.");
    } finally {
      this.axeRunning.set(false);
    }
    await this.refresh();
  }

  async mark(action: 'before' | 'after' | 'clear') {
    const client = this.rpc();
    if (!client) return;
    this.busy.set(true);
    this.sessionError.set(null);
    try {
      const result = (await rpcCall(client, 'audit-session', {
        pageId: this.pageId() || undefined,
        action,
      })) as { ok?: boolean; error?: string } | null;
      if (!result?.ok) this.sessionError.set(result?.error ?? 'The session did not change.');
    } catch {
      this.sessionError.set("Can't reach the devtools server.");
    } finally {
      this.busy.set(false);
    }
    await this.refresh();
  }

  highlight(finding: AuditFinding | null, reveal = false) {
    const client = this.rpc();
    if (!client || !this.canShowComponent()) return;
    const pageId = this.pageId();
    const target =
      finding?.elementId && pageId
        ? { pageId, id: finding.elementId, ...(reveal ? { reveal: true } : {}) }
        : null;
    // Clear only a box this view drew.
    if (!target && !this.highlighted) return;
    this.highlighted = !!target;
    void rpcCall(client, 'request-page-highlight', target).catch(() => {});
  }

  /** One read for a burst of shared state changes; none while an action here reads it when done. */
  private refreshSoon() {
    if (this.queued !== undefined) return;
    this.queued = setTimeout(() => {
      this.queued = undefined;
      if (this.destroyRef.destroyed || this.axeRunning() || this.busy()) return;
      void this.refresh();
    }, AUDIT_REFRESH_DELAY_MS);
  }

  private async subscribe(client: DevframeRpcClient) {
    await this.refresh();
    try {
      // Sessions and axe passes change from agents too; fetch again when they do.
      const state = await client.scope('pangular').rpc.sharedState('audit');
      if (this.destroyRef.destroyed) return;
      this.unsubscribe?.();
      this.unsubscribe = state.on('updated', () => this.refreshSoon());
    } catch {
      // Without the shared state the Refresh button still works.
    }
  }
}
