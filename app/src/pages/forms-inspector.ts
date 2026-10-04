import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { JsonPipe } from '@angular/common';
import type { DevframeRpcClient } from 'devframe/client';
import { hostPageId } from '../page-id';
import { actionAllowed, actionBlockedMessage, panelConfig } from '../devtools-config';
import { LimitNote } from '../ui/limit-note';
import { FormsFieldDetail } from './forms-field-detail';
import { FormsLint, FormsSubmit } from './forms-report';
import { FormsTimeline } from './forms-timeline';
import {
  FORMS_STYLES,
  KIND_LABELS,
  SOURCE_LABELS,
  actionMessage,
  formAction,
  pageOf,
  redactLabel,
  type CollectedForm,
  type FormEvent,
  type FormFieldError,
  type FormFieldNode,
} from './forms-types';

type Tab = 'fields' | 'timeline' | 'submit' | 'lint';
type Chip = 'invalid' | 'dirty' | 'touched' | 'disabled' | 'hidden-error';

const TABS: { id: Tab; label: string }[] = [
  { id: 'fields', label: 'Fields' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'submit', label: 'Submit' },
  { id: 'lint', label: 'Lint' },
];

const CHIPS: { id: Chip; label: string }[] = [
  { id: 'invalid', label: 'Invalid' },
  { id: 'dirty', label: 'Dirty' },
  { id: 'touched', label: 'Touched' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'hidden-error', label: 'Error not shown' },
];

function matchesChip(node: FormFieldNode, chip: Chip): boolean {
  switch (chip) {
    case 'invalid':
      return node.errors.length > 0;
    case 'dirty':
      return node.dirty && node.type === 'control';
    case 'touched':
      return node.touched && node.type === 'control';
    case 'disabled':
      return node.status === 'DISABLED';
    case 'hidden-error':
      return node.dom?.errorShown === false;
  }
}

interface FormsSnapshot {
  forms?: CollectedForm[];
  events?: FormEvent[];
  instrumented?: string[];
  dropped?: Record<string, number>;
}

interface FieldRow {
  node: FormFieldNode;
  depth: number;
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
  imports: [JsonPipe, FormsFieldDetail, FormsTimeline, FormsSubmit, FormsLint, LimitNote],
  host: { '(keydown.escape)': 'cancelPick()' },
  template: `
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
        <div class="sidebar">
          <h2 class="list-heading" id="forms-list-heading">
            Forms <span class="list-count">{{ visible().length }}</span>
          </h2>
          @if (hostPageId && (allPages() || otherPages())) {
            <label class="page-toggle">
              <input
                type="checkbox"
                [checked]="allPages()"
                (change)="allPages.set($any($event.target).checked)"
              />
              All pages
            </label>
          }
          <ul class="form-list" aria-labelledby="forms-list-heading">
            @for (form of visible(); track form.id) {
              <li>
                <button
                  type="button"
                  class="form-item"
                  [class.active]="form.id === selected()?.id"
                  [attr.aria-current]="form.id === selected()?.id ? 'true' : null"
                  (click)="selectForm(form.id)"
                >
                  <span class="dot" [attr.data-status]="form.root.status" aria-hidden="true"></span>
                  <span class="label" [attr.title]="form.label">{{ form.label }}</span>
                  <span class="kind"
                    >{{ kindLabel(form.kind) }} · <span class="id">{{ form.id }}</span>
                    <span class="sr-only">, {{ form.root.status }}</span></span
                  >
                  @if (counts().get(form.id)?.errors; as count) {
                    <span class="count">{{ count }}<span class="sr-only"> errors</span></span>
                  }
                </button>
              </li>
            }
          </ul>
        </div>

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
                      <code>{{ entry.path || '(form)' }}</code> {{ entry.message }}
                      <code class="kind-tag">{{ entry.kind }}</code>
                    </li>
                  }
                </ul>
              </details>
            }

            <div class="action-bar">
              <div class="actions" role="group" aria-label="Form actions">
                <button
                  type="button"
                  class="small"
                  [disabled]="!canWrite()"
                  [attr.aria-describedby]="canWrite() ? null : 'forms-writes-off'"
                  (click)="act('touch-all')"
                >
                  Touch all
                </button>
                <button
                  type="button"
                  class="small"
                  [disabled]="!canWrite()"
                  [attr.aria-describedby]="canWrite() ? null : 'forms-writes-off'"
                  (click)="act('revalidate')"
                >
                  Revalidate
                </button>
                <button type="button" class="small" (click)="act('focus-first-invalid')">
                  Focus first invalid
                </button>
                <button
                  type="button"
                  class="small"
                  [class.on]="picking()"
                  [attr.aria-pressed]="!!picking()"
                  (click)="picking() ? cancelPick() : pick()"
                >
                  {{ picking() ? 'Cancel picking' : 'Pick field on page' }}
                </button>
                <span class="divider" aria-hidden="true"></span>
                <button type="button" class="small" (click)="act('snapshot')">Snapshot</button>
                @if (snapshot()) {
                  <button
                    type="button"
                    class="small"
                    [class.armed]="armed() === 'restore'"
                    [disabled]="!canWrite()"
                    [attr.aria-describedby]="canWrite() ? null : 'forms-writes-off'"
                    [attr.title]="'Restore ' + snapshot()"
                    (click)="confirmAct('restore')"
                  >
                    {{ armed() === 'restore' ? 'Confirm restore' : 'Restore ' + snapshot() }}
                  </button>
                }
                <span class="spacer" aria-hidden="true"></span>
                <button
                  type="button"
                  class="small danger"
                  [class.armed]="armed() === 'reset'"
                  [disabled]="!canWrite()"
                  [attr.aria-describedby]="canWrite() ? null : 'forms-writes-off'"
                  (click)="confirmAct('reset')"
                >
                  {{ armed() === 'reset' ? 'Confirm reset' : 'Reset' }}
                </button>
                <button
                  type="button"
                  class="small primary"
                  [class.armed]="armed() === 'submit'"
                  [disabled]="!canWrite()"
                  [attr.aria-describedby]="canWrite() ? null : 'forms-writes-off'"
                  (click)="confirmAct('submit')"
                >
                  {{ armed() === 'submit' ? 'Confirm submit' : 'Submit' }}
                </button>
              </div>
              @if (!canWrite()) {
                <p id="forms-writes-off" class="muted">{{ writesOff }}</p>
              }
              <p class="status" role="status">{{ message() }}</p>
            </div>

            <div class="tabs" role="tablist" aria-label="Form views" (keydown)="onKey($event)">
              @for (tab of tabs; track tab.id) {
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
                  <div class="filters">
                    <input
                      class="filter"
                      type="search"
                      placeholder="Filter fields by path"
                      aria-label="Filter fields by path"
                      autocomplete="off"
                      spellcheck="false"
                      [value]="filter()"
                      (input)="onFilter($event)"
                    />
                    <fieldset class="chips">
                      <legend class="sr-only">Show only fields that are</legend>
                      @for (chip of chips; track chip.id) {
                        <label>
                          <input
                            type="checkbox"
                            [checked]="active().has(chip.id)"
                            (change)="toggleChip(chip.id)"
                          />
                          {{ chip.label }}
                        </label>
                      }
                    </fieldset>
                  </div>

                  <div class="table-scroll" role="region" aria-label="Fields" tabindex="0">
                    <table class="fields">
                      <thead>
                        <tr>
                          <th scope="col">Field</th>
                          <th scope="col">Value</th>
                          <th scope="col">Status</th>
                          <th scope="col">State</th>
                          <th scope="col">Errors</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of rows(); track row.node.path) {
                          <tr
                            [class.invalid]="row.node.errors.length"
                            (mouseenter)="highlight(form.id, row.node.path)"
                            (mouseleave)="highlight(null, '')"
                          >
                            <th
                              scope="row"
                              class="name"
                              [style.padding-left.px]="12 + row.depth * 16"
                            >
                              <button
                                type="button"
                                class="field"
                                [attr.aria-label]="
                                  'Show details for ' + (row.node.path || 'the form')
                                "
                                [attr.aria-pressed]="row.node.path === fieldPath()"
                                [attr.title]="row.node.path || '(form)'"
                                (focus)="highlight(form.id, row.node.path)"
                                (blur)="highlight(null, '')"
                                (click)="toggleField(row.node.path)"
                              >
                                {{ row.node.key || '(form)' }}
                              </button>
                              <span class="type">{{ row.node.type }}</span>
                            </th>
                            <td class="value">
                              @if (row.node.type === 'control') {
                                <code>{{ row.node.value | json }}</code>
                                @if (row.node.uncommitted !== undefined) {
                                  <div class="muted">
                                    typed <code>{{ row.node.uncommitted | json }}</code
                                    >, not in the model yet
                                  </div>
                                }
                                @if (row.node.defaultValue !== undefined) {
                                  <div class="muted">
                                    resets to <code>{{ row.node.defaultValue | json }}</code>
                                  </div>
                                }
                              }
                            </td>
                            <td class="status-cell">
                              @if (row.node.materialized === false) {
                                <span class="muted">not created yet</span>
                              } @else {
                                <span class="badge" [attr.data-status]="row.node.status">{{
                                  row.node.status
                                }}</span>
                              }
                            </td>
                            <td class="flags">
                              @if (row.node.touched) {
                                <span>touched</span>
                              }
                              @if (row.node.dirty) {
                                <span>{{
                                  row.node.changed === false ? 'dirty, unchanged' : 'dirty'
                                }}</span>
                              }
                              @if (row.node.skipped) {
                                <span>not validated ({{ row.node.skipped }})</span>
                              }
                              @if (row.node.stale?.length) {
                                <span class="warn">stale: {{ row.node.stale!.join(', ') }}</span>
                              }
                              @if (row.node.dom?.drift !== undefined) {
                                <span class="warn">view out of sync</span>
                              }
                              @if (row.node.redacted) {
                                <span>redacted: {{ redactLabel(row.node.redacted) }}</span>
                              }
                              @if (row.node.required) {
                                <span>required</span>
                              }
                              @if (row.node.readonly) {
                                <span>readonly</span>
                              }
                              @if (row.node.hidden) {
                                <span>hidden</span>
                              }
                              @if (row.node.updateOn) {
                                <span>updates on {{ row.node.updateOn }}</span>
                              }
                              @if (row.node.debouncing) {
                                <span>debouncing</span>
                              }
                              @if (row.node.validators?.sync) {
                                <span>validators</span>
                              }
                              @if (row.node.validators?.async) {
                                <span>async validator</span>
                              }
                              @for (rule of constraintList(row.node); track rule) {
                                <span>{{ rule }}</span>
                              }
                              @if (row.node.accessor) {
                                <span>{{ row.node.accessor }}</span>
                              }
                              @if (row.node.name) {
                                <span>name {{ row.node.name }}</span>
                              }
                              @for (value of row.node.metadata ?? []; track $index) {
                                <span>metadata {{ value | json }}</span>
                              }
                              @for (reason of row.node.disabledReasons ?? []; track $index) {
                                <span>disabled: {{ reason }}</span>
                              }
                            </td>
                            <td class="errors">
                              @for (error of row.node.errors; track $index) {
                                <div>
                                  {{ errorText(row.node, error) }}
                                  <code class="kind-tag">{{ error.kind }}</code>
                                  @if (error.kind === 'standardSchema' && error.params?.['path']) {
                                    <span class="source">at {{ error.params!['path'] }}</span>
                                  }
                                  @if (error.source) {
                                    <span class="source">{{ sourceText(error) }}</span>
                                  }
                                </div>
                              }
                              @if (row.node.errors.length && row.node.dom?.errorShown === false) {
                                <div class="unseen">not shown to the user</div>
                              }
                            </td>
                          </tr>
                          @if (row.node.truncated) {
                            <tr>
                              <td
                                colspan="5"
                                class="muted truncated"
                                [style.padding-left.px]="28 + row.depth * 16"
                              >
                                {{ row.node.truncated }} more fields under
                                {{ row.node.path || 'the form' }} not shown
                              </td>
                            </tr>
                          }
                        } @empty {
                          <tr>
                            <td colspan="5" class="no-match">
                              @if (filter()) {
                                No field path matches "{{ filter() }}".
                              } @else {
                                No field matches the selected filters.
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>

                  @if (selectedNode(); as node) {
                    <app-forms-field-detail
                      [form]="form"
                      [node]="node"
                      [version]="version()"
                      [rpc]="rpc()"
                      (closed)="closeField()"
                    />
                  }
                }
                @case ('timeline') {
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
                  <app-forms-lint [formId]="form.id" [version]="version()" [rpc]="rpc()" />
                }
              }
            </div>
          </section>
        }
      </div>
    }
  `,
  styles: `
    ${FORMS_STYLES}
    :host {
      display: block;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(200px, 260px) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
    }
    .sidebar {
      min-width: 0;
      padding: 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      animation: enter 0.35s var(--ease) both;
    }
    .list-heading {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 4px 8px 8px;
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .list-count {
      padding: 0 6px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 11px;
      letter-spacing: 0;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
    }
    .form-list {
      display: grid;
      gap: 2px;
      align-content: start;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .form-item {
      width: 100%;
      display: grid;
      grid-template-columns: 8px minmax(0, 1fr) auto;
      grid-template-areas: 'dot label count' '. kind kind';
      gap: 2px 10px;
      align-items: center;
      padding: 8px 10px;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text);
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition:
        background-color 150ms var(--ease),
        color 150ms var(--ease),
        box-shadow 150ms var(--ease);
    }
    .form-item:hover {
      background: var(--surface-2);
    }
    .form-item:active {
      background: var(--surface-3);
    }
    .form-item.active {
      background: var(--accent-soft);
      box-shadow: inset 2px 0 0 var(--accent);
      color: var(--text-strong);
    }
    .form-item:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .form-item .dot {
      grid-area: dot;
    }
    .form-item .label {
      grid-area: label;
      min-width: 0;
      overflow: hidden;
      font-size: 13px;
      font-weight: 500;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .form-item .kind {
      grid-area: kind;
      min-width: 0;
      overflow: hidden;
      color: var(--text-3);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .form-item .id {
      font-family: var(--font-mono);
      font-size: 11.5px;
    }
    .form-item.active .kind {
      color: var(--text-2);
    }
    .form-item .count {
      grid-area: count;
      min-width: 20px;
      padding: 0 7px;
      border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
      border-radius: 99px;
      background: color-mix(in srgb, var(--danger) 12%, transparent);
      color: var(--danger);
      font-size: 11px;
      font-weight: 600;
      line-height: 18px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 15%, transparent);
    }
    .dot[data-status='INVALID'] {
      background: var(--danger);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 15%, transparent);
    }
    .dot[data-status='PENDING'] {
      background: var(--warn);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--warn) 15%, transparent);
    }
    .dot[data-status='DISABLED'] {
      background: var(--text-3);
      box-shadow: none;
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
    .page-toggle {
      display: flex;
      gap: 8px;
      align-items: center;
      min-height: 32px;
      margin: 0 8px 8px;
      color: var(--text-2);
      font-size: 13px;
      cursor: pointer;
    }
    .page-toggle input {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--accent);
    }
    .page-toggle input:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
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
    .badge {
      display: inline-block;
      padding: 0 8px;
      border: 1px solid color-mix(in srgb, var(--ok) 30%, transparent);
      border-radius: 99px;
      background: color-mix(in srgb, var(--ok) 12%, transparent);
      color: var(--ok);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      line-height: 20px;
      white-space: nowrap;
    }
    .summary > .badge {
      line-height: 22px;
    }
    .badge[data-status='INVALID'] {
      border-color: color-mix(in srgb, var(--danger) 30%, transparent);
      background: color-mix(in srgb, var(--danger) 12%, transparent);
      color: var(--danger);
    }
    .badge[data-status='PENDING'] {
      border-color: color-mix(in srgb, var(--warn) 30%, transparent);
      background: color-mix(in srgb, var(--warn) 12%, transparent);
      color: var(--warn);
    }
    .badge[data-status='DISABLED'] {
      border-color: var(--border-strong);
      background: var(--surface-2);
      color: var(--text-2);
    }
    .action-bar {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .divider {
      width: 1px;
      height: 20px;
      background: var(--border-strong);
    }
    .spacer {
      flex: 1 1 0;
    }
    .actions .small:not(.primary):not(.danger) {
      max-width: 240px;
    }
    .small.on {
      background: var(--accent-soft);
      border-color: var(--accent-line);
      color: var(--text-strong);
    }
    .status:empty {
      height: 0;
      margin-top: -8px;
    }
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
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }
    .chips label {
      position: relative;
      display: inline-flex;
      align-items: center;
      height: 28px;
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: 99px;
      background: var(--surface-2);
      color: var(--text-2);
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      transition:
        background-color 150ms var(--ease),
        border-color 150ms var(--ease),
        color 150ms var(--ease);
    }
    .chips label:hover {
      color: var(--text);
      border-color: var(--border-strong);
    }
    .chips input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }
    .chips label:has(input:checked) {
      border-color: var(--accent-line);
      background: var(--accent-soft);
      color: var(--accent);
    }
    .chips label:has(input:focus-visible) {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .filter {
      flex: 1 1 220px;
      min-width: 0;
      height: 34px;
      padding: 0 12px 0 34px;
      background-color: var(--bg);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238e8e99' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: 12px center;
      background-size: 14px;
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text);
      font: inherit;
      font-size: 13px;
      transition:
        border-color 150ms var(--ease),
        box-shadow 150ms var(--ease);
    }
    .filter::placeholder {
      color: var(--text-3);
    }
    .filter:hover {
      border-color: color-mix(in srgb, var(--text-3) 55%, var(--border-strong));
    }
    .filter:focus,
    .filter:focus-visible {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
    .table-scroll {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .table-scroll:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .fields {
      width: 100%;
      min-width: 680px;
      border-collapse: collapse;
      font-size: 13px;
    }
    .fields th,
    .fields td {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
      line-height: 20px;
    }
    .fields tbody tr:last-child > * {
      border-bottom: 0;
    }
    .fields thead th {
      background: var(--surface-2);
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      line-height: 16px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .fields tbody th {
      color: var(--text);
      font-weight: 500;
      white-space: nowrap;
    }
    .fields tbody tr {
      transition: background-color 150ms var(--ease);
    }
    .fields tbody tr:hover {
      background: var(--surface-2);
    }
    .fields tbody tr.invalid > th {
      box-shadow: inset 2px 0 0 color-mix(in srgb, var(--danger) 60%, transparent);
    }
    .fields tbody tr:has(.field[aria-pressed='true']) {
      background: var(--accent-soft);
    }
    .fields tbody tr:has(.field[aria-pressed='true']) > th {
      box-shadow: inset 2px 0 0 var(--accent);
      color: var(--text-strong);
    }
    .name {
      max-width: 280px;
    }
    .field {
      display: inline-block;
      max-width: 200px;
      padding: 0;
      overflow: hidden;
      border: none;
      border-radius: 4px;
      background: none;
      color: inherit;
      font-family: var(--font-mono);
      font-size: 12.5px;
      font-weight: 500;
      line-height: 20px;
      text-align: left;
      text-overflow: ellipsis;
      vertical-align: top;
      white-space: nowrap;
      cursor: pointer;
      transition: color 150ms var(--ease);
    }
    .field:hover {
      color: var(--accent-hover);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .field[aria-pressed='true'] {
      color: var(--accent);
    }
    .field:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .type {
      margin-left: 8px;
      color: var(--text-3);
      font-size: 11px;
      font-weight: 400;
      vertical-align: top;
    }
    .value {
      min-width: 140px;
      max-width: 320px;
    }
    .value code,
    .errors code {
      color: #fde68a;
      overflow-wrap: anywhere;

      @include m.light {
        color: var(--accent);
      }
    }
    .value .muted {
      margin-top: 2px;
      font-size: 12px;
    }
    .status-cell {
      white-space: nowrap;
    }
    .flags {
      min-width: 160px;
    }
    .flags span {
      display: inline-block;
      margin: 0 4px 4px 0;
      padding: 0 8px;
      border: 1px solid var(--border);
      border-radius: 99px;
      background: var(--surface-2);
      color: var(--text-2);
      font-size: 11px;
      line-height: 18px;
      white-space: nowrap;
    }
    .flags span.warn {
      border-color: color-mix(in srgb, var(--warn) 30%, transparent);
      background: color-mix(in srgb, var(--warn) 12%, transparent);
      color: var(--warn);
    }
    .errors {
      min-width: 180px;
    }
    .errors div {
      color: var(--danger);
      overflow-wrap: anywhere;
    }
    .errors div + div {
      margin-top: 4px;
    }
    .errors .kind-tag {
      margin-left: 6px;
      color: var(--text-3);
      font-size: 11px;
    }
    .source {
      margin-left: 6px;
      color: var(--text-2);
      font-size: 11px;
    }
    .errors .unseen {
      color: var(--warn);
      font-size: 11px;
    }
    .truncated {
      color: var(--text-3);
      font-size: 12px;
      font-style: italic;
    }
    .fields .no-match {
      padding: 24px 12px;
      color: var(--text-2);
      text-align: center;
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
      .form-list {
        max-height: 240px;
        overflow-y: auto;
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
      .spacer,
      .divider {
        display: none;
      }
    }
  `,
})
export class FormsInspector {
  rpc = input<DevframeRpcClient | null>(null);
  focus = input<{ id: string } | null>(null);
  readonly canWrite = computed(() => actionAllowed(this.rpc(), 'forms'));
  protected readonly redactLabel = redactLabel;
  protected readonly writesOff = actionBlockedMessage('forms');
  readonly focusHandled = output<void>();

  readonly forms = signal<CollectedForm[]>([]);
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
  readonly tabs = TABS;
  readonly chips = CHIPS;
  readonly tab_ = signal<Tab>('fields');
  readonly active = signal(new Set<Chip>());
  readonly fieldPath = signal<string | null>(null);
  readonly version = signal(0);
  readonly message = signal('');
  readonly armed = signal<string | null>(null);
  readonly snapshot = signal<string | null>(null);
  readonly picking = signal<string | null>(null);
  private pickSeq = 0;

  private unsubscribe: (() => void) | null = null;
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly counts = computed(
    () =>
      new Map(
        this.visible().map((form) => [
          form.id,
          { fields: countFields(form.root), errors: countErrors(form.root) },
        ]),
      ),
  );

  readonly selected = computed(() => {
    const forms = this.visible();
    const id = this.selectedId();
    if (id === null) return forms[0] ?? null;
    const label = this.selectedLabel();
    const page = pageOf(id);
    return (
      forms.find((f) => f.id === id) ??
      forms.find((f) => f.label === label && pageOf(f.id) === page) ??
      forms.find((f) => f.label === label) ??
      null
    );
  });

  readonly missing = computed(() =>
    this.selectedId() !== null && !this.selected() && this.visible().length
      ? (this.selectedLabel() ?? this.selectedId())
      : null,
  );

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
    return this.events()
      .filter((e) => e.formId === id)
      .slice(-200);
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

  toggleChip(chip: Chip) {
    this.active.update((set) => {
      const next = new Set(set);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });
  }

  async act(action: string, extra: Record<string, unknown> = {}) {
    const form = this.selected();
    if (!form) return;
    this.armed.set(null);
    const result = await formAction(this.rpc(), { action, formId: form.id, ...extra });
    if (result.snapshot) this.snapshot.set(result.snapshot);
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
    const order = this.tabs.map((tab) => tab.id);
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

  sourceText(error: FormFieldError) {
    const label = SOURCE_LABELS[error.source ?? ''] ?? error.source ?? '';
    return error.from !== undefined ? `${label} on ${error.from || 'the form'}` : label;
  }

  onFilter(event: Event) {
    this.filter.set((event.target as HTMLInputElement).value);
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

  constraintList(node: FormFieldNode) {
    return Object.entries(node.constraints ?? {}).map(([name, value]) => `${name} ${value}`);
  }

  errorText(node: FormFieldNode, error: FormFieldError) {
    return /^[a-z]/.test(error.message)
      ? `${node.key || 'The form'} ${error.message}`
      : error.message;
  }
}
