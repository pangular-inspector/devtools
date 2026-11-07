import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
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
import { hostPageId } from '../page-id';
import { actionAllowed, actionBlockedMessage, panelConfig } from '../devtools-config';
import { LimitNote } from '../ui/limit-note';
import { FormsActionBar } from './forms-action-bar';
import { FormsExportTest } from './forms-export-test';
import { FormsFields, matchesChip, type Chip, type FieldRow } from './forms-fields';
import { FormsList } from './forms-list';
import { FormsSchema } from './forms-schema';
import { FormsLint, FormsSubmit } from './forms-report';
import { FormsSetupErrors } from './forms-setup-errors';
import { FormsTimeline } from './forms-timeline';
import { FormsWebMcp, FormsWebMcpOthers } from './forms-webmcp';
import {
  BADGE_STYLES,
  FORMS_STYLES,
  KIND_LABELS,
  actionMessage,
  formAction,
  pageOf,
  type CollectedForm,
  type FormEvent,
  type FormFieldNode,
  type FormSetupError,
  type WebMcpPage,
} from './forms-types';

type Tab = 'fields' | 'schema' | 'timeline' | 'submit' | 'lint';

const TABS: { id: Tab; label: string }[] = [
  { id: 'fields', label: 'Fields' },
  { id: 'schema', label: 'Schema' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'submit', label: 'Submit' },
  { id: 'lint', label: 'Lint' },
];

interface FormsSnapshot {
  forms?: CollectedForm[];
  events?: FormEvent[];
  instrumented?: string[];
  dropped?: Record<string, number>;
  webMcp?: WebMcpPage[];
  setupErrors?: FormSetupError[];
}

function countErrors(node: FormFieldNode): number {
  return node.errors.length + (node.children ?? []).reduce((sum, c) => sum + countErrors(c), 0);
}

function countFields(node: FormFieldNode): number {
  if (!node.children) return node.type === 'control' && node.materialized !== false ? 1 : 0;
  return node.children.reduce((sum, c) => sum + countFields(c), 0);
}

@Component({
  selector: 'app-forms-inspector',
  imports: [
    FormsActionBar,
    FormsExportTest,
    FormsFields,
    FormsList,
    FormsSchema,
    FormsSetupErrors,
    FormsTimeline,
    FormsSubmit,
    FormsLint,
    FormsWebMcp,
    FormsWebMcpOthers,
    LimitNote,
  ],
  host: { '(keydown.escape)': 'cancelPick()' },
  template: `
    <p class="page-intro">
      Signal Forms, reactive and template-driven forms on the live page, with each field's state and
      errors, a change timeline, submit explanations and a lint. Development builds only.
    </p>
    @if (pageSetupErrors().length) {
      <app-forms-setup-errors [errors]="pageSetupErrors()" [showPages]="setupErrorPages()" />
    }
    @if (!rpc()) {
      <div class="empty" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <p>Connecting to the devtools server…</p>
      </div>
    } @else if (failed()) {
      <div class="empty" role="alert">
        <p class="empty-title">Could not load forms</p>
        <p class="muted">
          The devtools server did not answer. Check that the app is running, then try again.
        </p>
        <button type="button" class="small" (click)="retry()">Try again</button>
      </div>
    } @else if (loading()) {
      <div class="empty" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <p>Loading forms…</p>
      </div>
    } @else if (!forms().length) {
      <div class="empty">
        <p class="empty-title">No forms on the page yet</p>
        <p class="muted">
          Open a page that renders a form. Signal Forms, reactive and template-driven forms all show
          up here, in development builds.
        </p>
      </div>
    } @else if (!visible().length) {
      <div class="empty">
        <p class="empty-title">No forms on this page</p>
        <p class="muted">
          Other connected tabs report {{ forms().length }}
          {{ forms().length === 1 ? 'form' : 'forms' }}.
        </p>
        <button type="button" class="small" (click)="allPages.set(true)">
          Show forms from all pages
        </button>
      </div>
    } @else {
      <div class="layout">
        <app-forms-list
          [forms]="visible()"
          [selectedId]="selected()?.id"
          [counts]="counts()"
          [showToggle]="!!hostPageId && (allPages() || otherPages())"
          [(allPages)]="allPages"
          (selectForm)="selectForm($event)"
        />

        @if (missing(); as label) {
          <section class="detail gone" aria-labelledby="forms-detail-title">
            <h2 id="forms-detail-title">{{ label }}</h2>
            <p class="muted" role="status">
              This form is no longer on the page. It comes back here if the page renders it again.
            </p>
            <button type="button" class="small" (click)="selectForm(visible()[0].id)">
              Show {{ visible()[0].label }}
            </button>
          </section>
        } @else if (hidden(); as label) {
          <section class="detail gone" aria-labelledby="forms-detail-title">
            <h2 id="forms-detail-title">{{ label }}</h2>
            <p class="muted">This form is on another page. Tick "All pages" to see it again.</p>
            <button type="button" class="small" (click)="allPages.set(true)">
              Show forms from all pages
            </button>
          </section>
        } @else if (selected(); as form) {
          <section class="detail" aria-labelledby="forms-detail-title">
            <div class="detail-head">
              <h2 id="forms-detail-title">{{ form.label }}</h2>
              <p class="detail-meta">
                {{ kindLabel(form.kind) }} · <code>{{ form.id }}</code>
              </p>
            </div>
            <div class="summary">
              <span class="badge" [attr.data-status]="form.root.status">{{
                form.root.status
              }}</span>
              <span>{{ form.root.dirty ? 'dirty' : 'pristine' }}</span>
              <span>{{ form.root.touched ? 'touched' : 'untouched' }}</span>
              @if (form.submitted !== undefined) {
                <span>{{ form.submitted ? 'submitted' : 'not submitted' }}</span>
              }
              @if (form.root.submitting) {
                <span>submitting</span>
              }
              <span class="totals"
                ><b>{{ counts().get(form.id)?.fields }}</b> fields ·
                <b [class.has-errors]="counts().get(form.id)?.errors">{{
                  counts().get(form.id)?.errors
                }}</b>
                errors</span
              >
            </div>
            @if (form.errorSummary?.length) {
              <details class="error-summary">
                <summary>Error summary ({{ form.errorSummary!.length }})</summary>
                <ul>
                  @for (entry of form.errorSummary!; track $index) {
                    <li>
                      <button type="button" class="summary-link" (click)="showField(entry.path)">
                        <span class="sr-only">Show field </span
                        ><code>{{ entry.path || '(form)' }}</code
                        ><span class="sr-only">:</span> {{ entry.message }}
                        <code class="kind-tag">{{ entry.kind }}</code>
                      </button>
                    </li>
                  }
                </ul>
              </details>
            }
            <app-forms-webmcp
              [tool]="form.webMcp"
              [page]="webMcpPage(form.id)"
              [signalForm]="form.kind === 'signal'"
              [formId]="form.id"
              [rpc]="rpc()"
            />

            <app-forms-action-bar
              [canWrite]="canWrite()"
              [writesOff]="writesOff"
              [picking]="picking()"
              [snapshot]="snapshot()"
              [armed]="armed()"
              [message]="message()"
              (act)="act($event)"
              (confirmAct)="confirmAct($event)"
              (pick)="pick()"
              (cancelPick)="cancelPick()"
            />

            <div class="tabs" role="tablist" aria-label="Form views" (keydown)="onKey($event)">
              @for (tab of tabs(); track tab.id) {
                <button
                  type="button"
                  role="tab"
                  [id]="'forms-tab-' + tab.id"
                  [attr.aria-selected]="tab.id === tab_()"
                  [attr.aria-controls]="'forms-panel-' + tab.id"
                  [attr.tabindex]="tab.id === tab_() ? 0 : -1"
                  (click)="tab_.set(tab.id)"
                >
                  {{ tab.label }}
                </button>
              }
            </div>
            <div
              class="panel"
              role="tabpanel"
              [id]="'forms-panel-' + tab_()"
              [attr.aria-labelledby]="'forms-tab-' + tab_()"
            >
              @switch (tab_()) {
                @case ('fields') {
                  <app-forms-fields
                    [form]="form"
                    [rows]="rows()"
                    [fieldPath]="fieldPath()"
                    [selectedNode]="selectedNode()"
                    [version]="version()"
                    [rpc]="rpc()"
                    [filtering]="filtering()"
                    [filterStatus]="filterStatus()"
                    [(filter)]="filter"
                    [(active)]="active"
                    (toggleField)="toggleField($event)"
                    (closeField)="closeField()"
                    (clearFilters)="clearFilters($event)"
                    (highlight)="highlight($event?.formId ?? null, $event?.path ?? '')"
                  />
                }
                @case ('schema') {
                  <app-forms-schema [form]="form" />
                }
                @case ('timeline') {
                  <app-forms-export-test [formId]="form.id" [rpc]="rpc()" />
                  <app-limit-note
                    [dropped]="droppedEvents()"
                    [max]="maxEvents()"
                    what="form events on this page"
                    limit="formTimeline"
                  />
                  <app-forms-timeline
                    [events]="selectedEvents()"
                    [recording]="recording()"
                    (record)="setRecording($event)"
                  />
                }
                @case ('submit') {
                  <app-forms-submit [formId]="form.id" [version]="version()" [rpc]="rpc()" />
                }
                @case ('lint') {
                  <app-forms-lint
                    [formId]="form.id"
                    [version]="version()"
                    [rpc]="rpc()"
                    (showField)="showField($event)"
                  />
                }
              }
            </div>
          </section>
        }
      </div>
    }
    @if (rpc() && !failed() && !loading()) {
      <app-forms-webmcp-others [pages]="pageWebMcp()" />
    }
  `,
  styles: `
    ${FORMS_STYLES}
    .page-intro {
      margin: 0 0 12px;
      color: var(--text-2);
      line-height: 1.5;
    }
    :host {
      display: block;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(200px, 260px) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }
    .detail {
      display: grid;
      gap: 16px;
      min-width: 0;
      padding: 16px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      animation: enter 0.35s var(--ease) both;
    }
    .detail-head {
      display: grid;
      gap: 4px;
      min-width: 0;
    }
    .detail-head h2 {
      margin: 0;
      color: var(--text-strong);
      font-size: 16px;
      font-weight: 600;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }
    .detail-meta {
      margin: 0;
      color: var(--text-3);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .detail-meta code {
      color: var(--text-2);
      font-size: 11.5px;
    }
    .gone {
      justify-items: start;
    }
    .gone h2 {
      margin: 0;
      color: var(--text-strong);
      font-size: 16px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .gone p {
      margin: 0;
    }
    .error-summary {
      min-width: 0;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      font-size: 13px;
    }
    .error-summary summary {
      color: var(--text);
      font-weight: 500;
      cursor: pointer;
    }
    .error-summary summary:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .error-summary ul {
      display: grid;
      gap: 4px;
      margin: 8px 0 0;
      padding: 0 0 0 16px;
      color: var(--text);
      overflow-wrap: anywhere;
    }
    .error-summary .kind-tag {
      margin-left: 6px;
      color: var(--text-2);
      font-size: 11px;
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      color: var(--text-2);
      font-size: 12px;
    }
    .summary > span:not(.badge):not(.totals) {
      padding: 0 10px;
      border: 1px solid var(--border);
      border-radius: 99px;
      background: var(--surface-2);
      color: var(--text);
      line-height: 22px;
    }
    .totals {
      margin-left: auto;
      color: var(--text-3);
      font-variant-numeric: tabular-nums;
    }
    .totals b {
      color: var(--text);
      font-weight: 600;
    }
    .totals b.has-errors {
      color: var(--danger);
    }
    ${BADGE_STYLES}
    .tabs {
      display: inline-flex;
      justify-self: start;
      gap: 2px;
      max-width: 100%;
      height: 34px;
      padding: 2px;
      overflow-x: auto;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .tabs [role='tab'] {
      flex: none;
      height: 28px;
      padding: 0 14px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: var(--text-2);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition:
        background-color 150ms var(--ease),
        color 150ms var(--ease),
        box-shadow 150ms var(--ease);
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
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
    .panel {
      display: grid;
      gap: 12px;
      min-width: 0;
      animation: enter 0.35s var(--ease) both;
    }
    .empty {
      display: grid;
      justify-items: center;
      gap: 8px;
      margin: 0;
      padding: 48px 24px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text-2);
      font-size: 13px;
      line-height: 1.5;
      text-align: center;
      animation: enter 0.35s var(--ease) both;
    }
    .empty p {
      max-width: 52ch;
      margin: 0;
    }
    .empty .small {
      margin-top: 8px;
    }
    .empty-title {
      color: var(--text-strong);
      font-size: 15px;
      font-weight: 600;
    }
    @media (max-width: 720px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    @media (max-width: 480px) {
      .detail {
        padding: 12px;
      }
      .totals {
        flex-basis: 100%;
        margin-left: 0;
      }
    }
  `,
})
export class FormsInspector {
  rpc = input<DevframeRpcClient | null>(null);
  focus = input<{ id: string } | null>(null);
  readonly canWrite = computed(() => actionAllowed(this.rpc(), 'forms'));
  protected readonly writesOff = actionBlockedMessage('forms');
  readonly focusHandled = output<void>();

  readonly forms = signal<CollectedForm[]>([]);
  readonly webMcp = signal<WebMcpPage[]>([]);
  readonly events = signal<FormEvent[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly selectedLabel = signal<string | null>(null);
  readonly hostPageId = hostPageId();
  readonly allPages = signal(false);
  readonly visible = computed(() => {
    const forms = this.forms();
    const page = this.hostPageId;
    return page && !this.allPages() ? forms.filter((f) => pageOf(f.id) === page) : forms;
  });
  readonly otherPages = computed(() => this.forms().some((f) => pageOf(f.id) !== this.hostPageId));
  readonly instrumented = signal<string[]>([]);
  readonly recording = computed(() => {
    const id = this.selected()?.id ?? '';
    return this.instrumented().some((page) => id.endsWith(`@${page}`));
  });
  readonly filter = signal('');
  /** The views of the selected form; Schema only for a Signal Form. */
  readonly tabs = computed(() =>
    this.selected()?.kind === 'signal' ? TABS : TABS.filter((tab) => tab.id !== 'schema'),
  );
  /** The open view, back on Fields when the next form has no such view. */
  readonly tab_ = linkedSignal<{ id: Tab }[], Tab>({
    source: this.tabs,
    computation: (tabs, previous) =>
      previous && tabs.some((tab) => tab.id === previous.value) ? previous.value : 'fields',
  });
  readonly active = signal(new Set<Chip>());
  /** True while the path search or a chip hides fields, the same test `rows` applies. */
  readonly filtering = computed(() => !!this.filter() || this.active().size > 0);
  /** Spoken only after Clear filters, never on a poll. */
  readonly filterStatus = signal('');
  readonly version = signal(0);
  readonly message = signal('');

  readonly setupErrors = signal<FormSetupError[]>([]);
  /** Setup errors of the pages the form list shows. */
  readonly pageSetupErrors = computed(() => this.onShownPages(this.setupErrors()));
  readonly setupErrorPages = computed(
    () => new Set(this.pageSetupErrors().map((error) => error.pageId)).size > 1,
  );
  /** WebMCP state of the pages the form list shows, for the tools not linked to a form. */
  readonly pageWebMcp = computed(() =>
    this.onShownPages(this.webMcp()).filter((entry) => entry.tools.length),
  );

  private onShownPages<T extends { pageId?: string }>(entries: T[]): T[] {
    const page = this.hostPageId;
    return page && !this.allPages() ? entries.filter((entry) => entry.pageId === page) : entries;
  }

  webMcpPage(formId: string): WebMcpPage | undefined {
    const page = pageOf(formId);
    return this.webMcp().find((entry) => entry.pageId === page);
  }
  readonly picking = signal<string | null>(null);
  private pickSeq = 0;

  private unsubscribe: (() => void) | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly counts = computed(
    () =>
      new Map(
        this.visible().map((form) => [
          form.id,
          { fields: countFields(form.root), errors: countErrors(form.root) },
        ]),
      ),
  );

  /** The chosen form among every reported form, whether or not "All pages" lists it. */
  private readonly chosen = computed(() => {
    const id = this.selectedId();
    if (id === null) return null;
    const forms = this.forms();
    const label = this.selectedLabel();
    const page = pageOf(id);
    return (
      forms.find((f) => f.id === id) ??
      forms.find((f) => f.label === label && pageOf(f.id) === page) ??
      null
    );
  });

  readonly selected = computed(() => {
    const forms = this.visible();
    if (this.selectedId() === null) return forms[0] ?? null;
    const chosen = this.chosen();
    return chosen && forms.includes(chosen) ? chosen : null;
  });

  /** The chosen form left the page. */
  readonly missing = computed(() =>
    this.selectedId() !== null && !this.chosen() && this.visible().length
      ? (this.selectedLabel() ?? this.selectedId())
      : null,
  );

  /** The chosen form is still on its page, but unticking "All pages" hides it. */
  readonly hidden = computed(() => {
    const chosen = this.chosen();
    return chosen && !this.selected() && this.visible().length ? chosen.label : null;
  });

  private readonly selectedFormId = computed(() => this.selected()?.id ?? null);

  // Field, armed confirmation and snapshot all belong to one form, so they reset whenever the
  // selected form changes, including when it falls back to another form without a click.
  readonly fieldPath = linkedSignal<string | null, string | null>({
    source: this.selectedFormId,
    computation: () => null,
  });
  readonly armed = linkedSignal<string | null, string | null>({
    source: this.selectedFormId,
    computation: () => null,
  });
  readonly snapshot = linkedSignal<string | null, string | null>({
    source: this.selectedFormId,
    computation: () => null,
  });

  readonly rows = computed(() => {
    const form = this.selected();
    if (!form) return [];
    const query = this.filter().toLowerCase();
    const chips = Array.from(this.active());
    const rows: FieldRow[] = [];
    const visit = (node: FormFieldNode, depth: number): boolean => {
      const at = rows.length;
      let keep =
        (!query || node.path.toLowerCase().includes(query)) &&
        chips.every((chip) => matchesChip(node, chip));
      for (const child of node.children ?? []) keep = visit(child, depth + 1) || keep;
      if (keep) rows.splice(at, 0, { node, depth });
      return keep;
    };
    visit(form.root, 0);
    return rows;
  });

  readonly selectedNode = computed(() => {
    const path = this.fieldPath();
    const form = this.selected();
    if (path === null || !form) return null;
    const find = (node: FormFieldNode): FormFieldNode | null =>
      node.path === path ? node : ((node.children ?? []).map(find).find(Boolean) ?? null);
    return find(form.root);
  });

  readonly dropped = signal<Record<string, number>>({});
  readonly droppedEvents = computed(() => {
    const id = this.selected()?.id;
    return id ? (this.dropped()[pageOf(id)] ?? 0) : 0;
  });
  readonly maxEvents = computed(() => panelConfig(this.rpc()).limits.formTimeline);

  readonly selectedEvents = computed(() => {
    const id = this.selected()?.id;
    return this.events().filter((e) => e.formId === id);
  });

  constructor() {
    effect(() => {
      const client = this.rpc();
      if (client) this.load(client);
    });
    effect(() => {
      const focus = this.focus();
      if (!focus) return;
      untracked(() => {
        this.selectForm(focus.id);
        this.focusHandled.emit();
      });
    });
    this.destroyRef.onDestroy(() => {
      this.unsubscribe?.();
      this.highlight(null, '');
    });
  }

  async load(client: DevframeRpcClient) {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const state = await client.scope('pangular').rpc.sharedState('forms');
      if (this.destroyRef.destroyed) return;
      const apply = (value: unknown) => {
        const snapshot = value as FormsSnapshot | undefined;
        this.forms.set(snapshot?.forms ?? []);
        this.events.set(snapshot?.events ?? []);
        this.instrumented.set(snapshot?.instrumented ?? []);
        this.dropped.set(snapshot?.dropped ?? {});
        this.webMcp.set(snapshot?.webMcp ?? []);
        this.setupErrors.set(snapshot?.setupErrors ?? []);
        this.version.update((v) => v + 1);
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

  retry() {
    const client = this.rpc();
    if (client) void this.load(client);
  }

  async pick() {
    const form = this.selected();
    if (!form) return;
    const seq = ++this.pickSeq;
    this.picking.set(form.id);
    this.message.set('Click a field in the app. Press Escape or Cancel picking to stop.');
    const result = await formAction(this.rpc(), { action: 'pick', formId: form.id });
    if (seq !== this.pickSeq) return;
    this.picking.set(null);
    const picked = result as typeof result & { formId?: string; path?: string };
    if (!result.ok || !picked.formId) {
      this.message.set(actionMessage(result));
      return;
    }
    this.selectForm(picked.formId);
    this.tab_.set('fields');
    this.fieldPath.set(picked.path ?? '');
    this.message.set(`Picked ${picked.path || '(form)'}.`);
  }

  cancelPick() {
    const formId = this.picking();
    if (!formId) return;
    void formAction(this.rpc(), { action: 'cancel-pick', formId });
  }

  async setRecording(on: boolean) {
    const form = this.selected();
    if (!form) return;
    const result = await formAction(this.rpc(), {
      action: 'instrument',
      formId: form.id,
      value: on,
    });
    this.message.set(actionMessage(result));
  }

  selectForm(id: string) {
    if (this.hostPageId && pageOf(id) && pageOf(id) !== this.hostPageId) this.allPages.set(true);
    this.selectedId.set(id);
    this.selectedLabel.set(this.forms().find((f) => f.id === id)?.label ?? null);
    this.filter.set('');
    this.fieldPath.set(null);
    this.snapshot.set(null);
    this.armed.set(null);
  }

  toggleField(path: string) {
    this.fieldPath.update((current) => (current === path ? null : path));
  }

  closeField() {
    const host = this.host.nativeElement;
    const row =
      host.querySelector<HTMLElement>('button.field[aria-pressed="true"]') ??
      host.querySelector<HTMLElement>('.table-scroll');
    this.fieldPath.set(null);
    row?.focus();
  }

  /** Opens a field from the error summary or a lint finding: Fields tab, filters that hide it cleared, detail focused. */
  showField(path: string) {
    this.tab_.set('fields');
    const listed = () => this.rows().some((row) => row.node.path === path);
    if (!listed()) this.filter.set('');
    if (!listed()) this.active.set(new Set());
    this.fieldPath.set(path);
    afterNextRender(
      () => {
        const host = this.host.nativeElement;
        const row = host.querySelector<HTMLElement>('button.field[aria-pressed="true"]');
        row?.scrollIntoView?.({ block: 'nearest' });
        const target =
          host.querySelector<HTMLElement>('#forms-field-heading') ??
          host.querySelector<HTMLElement>('.table-scroll');
        target?.focus();
      },
      { injector: this.injector },
    );
  }

  async act(action: string, extra: Record<string, unknown> = {}) {
    const form = this.selected();
    if (!form) return;
    this.armed.set(null);
    const result = await formAction(this.rpc(), { action, formId: form.id, ...extra });
    if (result.snapshot && this.selected()?.id === form.id) this.snapshot.set(result.snapshot);
    this.message.set(actionMessage(result));
  }

  confirmAct(action: 'reset' | 'submit' | 'restore') {
    if (this.armed() !== action) {
      this.armed.set(action);
      this.message.set(`Press "Confirm ${action}" to ${action} the form in the app.`);
      return;
    }
    void this.act(action, { confirm: true, snapshot: this.snapshot() ?? undefined });
  }

  onKey(event: KeyboardEvent) {
    const order = this.tabs().map((tab) => tab.id);
    const index = order.indexOf(this.tab_());
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % order.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + order.length) % order.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = order.length - 1;
    else return;
    event.preventDefault();
    this.tab_.set(order[next]);
    const host = event.currentTarget as HTMLElement;
    queueMicrotask(() => host.querySelector<HTMLElement>(`#forms-tab-${order[next]}`)?.focus());
  }

  /** Resets the path search and the chips, then hands focus back to the search field. */
  clearFilters(search: HTMLInputElement) {
    this.filter.set('');
    this.active.set(new Set());
    const count = this.rows().length;
    const message = `Filters cleared. Showing ${count} ${count === 1 ? 'field' : 'fields'}.`;
    this.filterStatus.update((current) => (current === message ? `${message}\u00a0` : message));
    search.focus();
  }

  highlight(formId: string | null, path: string) {
    const client = this.rpc();
    if (!client) return;
    void client
      .scope('pangular')
      .rpc.callEvent('request-form-highlight', formId ? { formId, path } : null);
  }

  kindLabel(kind: CollectedForm['kind']) {
    return KIND_LABELS[kind];
  }
}
