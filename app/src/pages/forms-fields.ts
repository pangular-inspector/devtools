import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
} from '@angular/core';
import { JsonPipe } from '@angular/common';
import type { DevframeRpcClient } from 'devframe/client';
import { actionAllowed } from '../devtools-config';
import { FormsFieldDetail } from './forms-field-detail';
import {
  BADGE_STYLES,
  FORMS_STYLES,
  SOURCE_LABELS,
  actionMessage,
  formAction,
  redactLabel,
  type CollectedForm,
  type FormFieldError,
  type FormFieldNode,
} from './forms-types';

export type Chip = 'invalid' | 'dirty' | 'touched' | 'disabled' | 'hidden-error';

export const CHIPS: { id: Chip; label: string }[] = [
  { id: 'invalid', label: 'Invalid' },
  { id: 'dirty', label: 'Dirty' },
  { id: 'touched', label: 'Touched' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'hidden-error', label: 'Error not shown' },
];

export function matchesChip(node: FormFieldNode, chip: Chip): boolean {
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

/** The text the inline editor starts with: a string as it is, anything else as JSON. */
export function draftOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

export interface FieldRow {
  node: FormFieldNode;
  depth: number;
}

/** The Fields tab: the path search, the state chips, the field table and the open field's detail. */
@Component({
  selector: 'app-forms-fields',
  imports: [JsonPipe, FormsFieldDetail],
  template: `
    <div class="filters">
      <div class="search">
        <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          #fieldFilter
          class="filter"
          type="search"
          placeholder="Filter fields by path"
          aria-label="Filter fields by path"
          autocomplete="off"
          spellcheck="false"
          [value]="filter()"
          (input)="onFilter($event)"
          (keydown.escape)="filter.set('')"
        />
      </div>
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
    <p class="sr-only" role="status">{{ filterStatus() }}</p>

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
              (mouseenter)="highlight.emit({ formId: form().id, path: row.node.path })"
              (mouseleave)="highlight.emit(null)"
            >
              <th scope="row" class="name" [style.padding-left.px]="12 + row.depth * 16">
                <button
                  type="button"
                  class="field"
                  [attr.aria-label]="'Show details for ' + (row.node.path || 'the form')"
                  [attr.aria-pressed]="row.node.path === fieldPath()"
                  [attr.title]="row.node.path || '(form)'"
                  (focus)="highlight.emit({ formId: form().id, path: row.node.path })"
                  (blur)="highlight.emit(null)"
                  (click)="toggleField.emit(row.node.path)"
                >
                  {{ row.node.key || '(form)' }}
                </button>
                <span class="type">{{ row.node.type }}</span>
              </th>
              <td class="value">
                @if (row.node.type === 'control') {
                  <code>{{ row.node.value | json }}</code>
                  @if (row.node.materialized !== false) {
                    <button
                      type="button"
                      class="edit"
                      [attr.aria-label]="'Edit ' + (row.node.path || 'the form')"
                      [attr.aria-expanded]="editing() === row.node.path"
                      [attr.aria-controls]="
                        editing() === row.node.path ? 'forms-inline-editor' : null
                      "
                      [disabled]="!canWrite()"
                      [attr.aria-describedby]="canWrite() ? null : 'forms-writes-off'"
                      (click)="toggleEdit(row.node)"
                    >
                      Edit
                    </button>
                  }
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
                  <span>{{ row.node.changed === false ? 'dirty, unchanged' : 'dirty' }}</span>
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
            @if (editing() === row.node.path) {
              <tr class="edit-row">
                <td colspan="5" [style.padding-left.px]="28 + row.depth * 16">
                  <div
                    id="forms-inline-editor"
                    class="inline-editor"
                    role="group"
                    [attr.aria-label]="'Edit ' + (row.node.path || 'the form')"
                  >
                    @if (!row.node.redacted) {
                      <label class="sr-only" for="forms-inline-value"
                        >New value for {{ row.node.path }}</label
                      >
                      <input
                        id="forms-inline-value"
                        class="filter inline-input"
                        type="text"
                        autocomplete="off"
                        spellcheck="false"
                        [value]="draft()"
                        (input)="draft.set($any($event.target).value)"
                        (keydown.enter)="saveValue(row.node)"
                        (keydown.escape)="stopEdit($event)"
                      />
                      <button type="button" class="small primary" (click)="saveValue(row.node)">
                        Set value
                      </button>
                    } @else {
                      <span class="muted"
                        >The value is redacted ({{ redactLabel(row.node.redacted) }}), so it cannot
                        be edited here.</span
                      >
                    }
                    <label class="check">
                      <input
                        type="checkbox"
                        [checked]="row.node.touched"
                        (change)="mark(row.node, 'touched', $event)"
                        (keydown.escape)="stopEdit($event)"
                      />
                      Touched
                    </label>
                    <label class="check">
                      <input
                        type="checkbox"
                        [checked]="row.node.dirty"
                        (change)="mark(row.node, 'dirty', $event)"
                        (keydown.escape)="stopEdit($event)"
                      />
                      Dirty
                    </label>
                    <button type="button" class="small" (click)="stopEdit()">Done</button>
                  </div>
                  <p class="status" role="status">{{ editMessage() }}</p>
                </td>
              </tr>
            }
            @if (row.node.truncated) {
              <tr>
                <td
                  colspan="5"
                  class="muted truncated"
                  [style.padding-left.px]="28 + row.depth * 16"
                >
                  {{ row.node.truncated }} more fields under {{ row.node.path || 'the form' }} not
                  shown
                </td>
              </tr>
            }
          } @empty {
            <tr>
              <td colspan="5" class="no-match">
                <p>
                  @if (filter()) {
                    No field path matches "{{ filter() }}".
                  } @else {
                    No field matches the selected filters.
                  }
                </p>
                @if (filtering()) {
                  <button type="button" class="small" (click)="clearFilters.emit(fieldFilter)">
                    Clear filters
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (selectedNode(); as node) {
      <app-forms-field-detail
        [form]="form()"
        [node]="node"
        [version]="version()"
        [rpc]="rpc()"
        (closed)="closeField.emit()"
      />
    }
  `,
  styles: `
    ${FORMS_STYLES}
    ${BADGE_STYLES}
    :host {
      display: contents;
    }
    .search {
      position: relative;
      display: flex;
      flex: 1 1 220px;
      min-width: 0;
    }
    .search > input {
      flex: 1 1 auto;
      width: 100%;
      padding-left: 34px;
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
    .search:focus-within .search-icon {
      stroke: var(--accent);
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
      border: 1px solid var(--control-border);
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
      border-color: var(--text-3);
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
      background: var(--bg);
      border: 1px solid var(--control-border);
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
      border-color: color-mix(in srgb, var(--text-3) 55%, var(--control-border));
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
    .edit {
      min-width: 24px;
      height: 24px;
      margin-left: 8px;
      padding: 0 8px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      font-size: 12px;
      line-height: 22px;
      vertical-align: middle;
      cursor: pointer;
      transition:
        background-color 150ms var(--ease),
        border-color 150ms var(--ease);
    }
    .edit:hover {
      background: var(--surface-3);
    }
    .edit[aria-expanded='true'] {
      background: var(--accent-soft);
      border-color: var(--accent-line);
      color: var(--text-strong);
    }
    .edit:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 1px;
    }
    .edit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .fields tbody tr.edit-row,
    .fields tbody tr.edit-row:hover {
      background: var(--surface-2);
    }
    .inline-editor {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
    }
    .inline-input {
      flex: 1 1 200px;
      min-width: 0;
    }
    .check {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      min-height: 24px;
      color: var(--text);
      font-size: 13px;
      cursor: pointer;
    }
    .check input {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: var(--accent);
    }
    .check input:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .edit-row .status {
      margin: 6px 0 0;
    }
    .edit-row .status:empty {
      display: none;
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
      background: color-mix(in srgb, var(--warn) 12%, var(--surface));
      color: var(--warn-text);
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
    .fields .no-match p {
      margin: 0 0 10px;
    }
    .fields .no-match p:last-child {
      margin-bottom: 0;
    }
  `,
})
export class FormsFields {
  readonly form = input.required<CollectedForm>();
  readonly rows = input.required<FieldRow[]>();
  /** The path of the field whose detail is open, or null. */
  readonly fieldPath = input<string | null>(null);
  readonly selectedNode = input<FormFieldNode | null>(null);
  readonly version = input(0);
  readonly rpc = input<DevframeRpcClient | null>(null);
  readonly filtering = input(false);
  readonly filterStatus = input('');
  readonly filter = model('');
  readonly active = model(new Set<Chip>());
  readonly toggleField = output<string>();
  readonly closeField = output<void>();
  readonly clearFilters = output<HTMLInputElement>();
  readonly highlight = output<{ formId: string; path: string } | null>();

  protected readonly chips = CHIPS;
  protected readonly redactLabel = redactLabel;
  readonly canWrite = computed(() => actionAllowed(this.rpc(), 'forms'));
  private readonly formId = computed(() => this.form().id);
  /** The path of the control whose inline editor is open; closes when the form changes. */
  readonly editing = linkedSignal<string, string | null>({
    source: this.formId,
    computation: () => null,
  });
  readonly draft = signal('');
  readonly editMessage = linkedSignal({ source: this.editing, computation: () => '' });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Opens the inline editor of a control with its current value, or closes it. */
  toggleEdit(node: FormFieldNode) {
    if (this.editing() === node.path) {
      this.stopEdit();
      return;
    }
    this.draft.set(draftOf(node.value));
    this.editing.set(node.path);
    afterNextRender(
      () =>
        this.host.nativeElement.querySelector<HTMLElement>('#forms-inline-editor input')?.focus(),
      { injector: this.injector },
    );
  }

  /** Closes the inline editor and hands focus back to its Edit button. */
  stopEdit(event?: Event) {
    event?.stopPropagation();
    const path = this.editing();
    if (path === null) return;
    const host = this.host.nativeElement;
    const button = host
      .querySelector('#forms-inline-editor')
      ?.closest('tr')
      ?.previousElementSibling?.querySelector<HTMLElement>('button.edit');
    this.editing.set(null);
    button?.focus();
  }

  async saveValue(node: FormFieldNode) {
    const formId = this.form().id;
    const result = await formAction(this.rpc(), {
      action: 'set-value',
      formId,
      path: node.path,
      value: this.draft(),
      coerce: true,
      mode: 'user',
    });
    if (this.form().id !== formId || this.editing() !== node.path) return;
    this.editMessage.set(actionMessage(result));
  }

  /** Marks a control touched or untouched, dirty or pristine, from its checkbox. */
  async mark(node: FormFieldNode, flag: 'touched' | 'dirty', event: Event) {
    const box = event.target as HTMLInputElement;
    const on = box.checked;
    const action =
      flag === 'touched'
        ? on
          ? 'mark-touched'
          : 'mark-untouched'
        : on
          ? 'mark-dirty'
          : 'mark-pristine';
    const formId = this.form().id;
    const result = await formAction(this.rpc(), { action, formId, path: node.path });
    // A refused write changed nothing, so the checkbox goes back to the reported state.
    if (!result.ok) box.checked = !on;
    if (this.form().id !== formId || this.editing() !== node.path) return;
    this.editMessage.set(actionMessage(result));
  }

  toggleChip(chip: Chip) {
    this.active.update((set) => {
      const next = new Set(set);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      return next;
    });
  }

  onFilter(event: Event) {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  sourceText(error: FormFieldError) {
    const label = SOURCE_LABELS[error.source ?? ''] ?? error.source ?? '';
    return error.from !== undefined ? `${label} on ${error.from || 'the form'}` : label;
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
