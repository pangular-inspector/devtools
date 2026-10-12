import { JsonPipe } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';

export interface EditableProp {
  name: string;
  prop: string;
  value?: unknown;
  edit?: 'property' | 'signal';
  locked?: string;
}

interface EditResult {
  ok?: boolean;
  value?: unknown;
  error?: string;
}

let nextId = 0;

/** Reads the draft as JSON, or says how to fix it. */
export function parseDraft(text: string): { value: unknown } | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'Type a JSON value, such as "text", 42, true, null or [1, 2].' };
  try {
    return { value: JSON.parse(trimmed) };
  } catch {
    return { error: 'Not valid JSON. Put text in double quotes, such as "Paris".' };
  }
}

/**
 * One input or property value in the component detail. When the page says it
 * can be edited and writes are on, Edit turns it into a JSON field: Enter
 * applies, Escape cancels.
 */
@Component({
  selector: 'app-prop-value',
  imports: [JsonPipe],
  template: `
    @if (editing()) {
      <div class="editor">
        <label class="sr-only" [for]="fieldId">New value of {{ prop().name }}, as JSON</label>
        <input
          #field
          [id]="fieldId"
          class="field mono"
          type="text"
          autocomplete="off"
          spellcheck="false"
          [value]="draft()"
          [readOnly]="busy()"
          [attr.aria-busy]="busy() ? 'true' : null"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="hintId + (error() ? ' ' + errorId : '')"
          (input)="draft.set($any($event.target).value)"
          (keydown.enter)="$event.preventDefault(); apply()"
          (keydown.escape)="$event.preventDefault(); $event.stopPropagation(); cancel()"
        />
        <button type="button" class="primary" [disabled]="busy()" (click)="apply()">Apply</button>
        <button type="button" (click)="cancel()">Cancel</button>
      </div>
      <p class="hint" [id]="hintId">
        JSON, such as "text", 42, true or {{ objectSample }}. Enter applies, Escape cancels.
      </p>
    } @else {
      <div class="view">
        <pre
          #valueBox
          [attr.tabindex]="scrollable() ? 0 : null"
          [attr.role]="scrollable() ? 'region' : null"
          [attr.aria-label]="scrollable() ? 'Value of ' + prop().name : null"
          >{{ prop().value | json }}</pre>
        @if (editable()) {
          <button
            #editButton
            type="button"
            class="edit"
            [attr.aria-label]="'Edit ' + prop().name"
            (click)="start()"
          >
            Edit
          </button>
        }
      </div>
      @if (writes() && prop().locked) {
        <p class="locked">{{ prop().locked }}</p>
      }
    }
    @if (error()) {
      <p class="error" role="alert" [id]="errorId">{{ error() }}</p>
    }
    <p class="sr-only" role="status">{{ done() }}</p>
  `,
  styles: `
    @use 'mixins' as m;
    :host {
      display: block;
      min-width: 0;
    }
    .view {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    pre {
      flex: 1 1 auto;
      min-width: 0;
      max-height: 200px;
      margin: 0;
      overflow: auto;
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .editor {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .field {
      flex: 1 1 160px;
      min-width: 0;
      height: var(--control-h);
      padding: 0 10px;
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .field:focus-visible {
      @include m.field-focus;
    }
    .field[aria-invalid='true'] {
      border-color: var(--danger);
    }
    button {
      display: inline-flex;
      flex: none;
      align-items: center;
      height: var(--control-h);
      padding: 0 12px;
      background: var(--surface-2);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text);
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      transition:
        background-color 150ms var(--ease),
        border-color 150ms var(--ease);
    }
    button:hover:not(:disabled) {
      background: var(--surface-3);
      border-color: var(--accent-line);
    }
    button:focus-visible {
      @include m.focus-ring;
    }
    pre:focus-visible {
      @include m.focus-ring(-2px);
    }
    button:disabled {
      opacity: 0.6;
    }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-ink);
    }
    button.primary:hover:not(:disabled) {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }
    button.edit {
      height: 26px;
      padding: 0 10px;
      font-size: 12px;
    }
    .hint,
    .locked,
    .error {
      margin: 6px 0 0;
      font-size: 12px;
      line-height: 1.4;
    }
    .hint,
    .locked {
      color: var(--text-2);
    }
    .error {
      color: var(--danger-text);
    }
  `,
})
export class PropValue {
  readonly prop = input.required<EditableProp>();
  readonly componentId = input.required<string>();
  readonly pageId = input<string | null>(null);
  readonly rpc = input<DevframeRpcClient | null>(null);
  /** Whether this panel may write: live page, server connected, `actions.components` on. */
  readonly writes = input(false);

  protected readonly fieldId = `prop-edit-${++nextId}`;
  protected readonly hintId = `${this.fieldId}-hint`;
  protected readonly errorId = `${this.fieldId}-error`;
  protected readonly objectSample = '{"a": 1}';

  readonly editing = signal(false);
  readonly draft = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly done = signal('');
  readonly editable = computed(
    () => this.writes() && !!this.prop().edit && !!this.pageId() && !!this.rpc(),
  );

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private readonly editButton = viewChild<ElementRef<HTMLButtonElement>>('editButton');
  private readonly valueBox = viewChild<ElementRef<HTMLElement>>('valueBox');
  private readonly injector = inject(Injector);
  /** A value taller than its box scrolls, so it takes focus for keyboard scrolling. */
  readonly scrollable = signal(false);

  constructor() {
    afterRenderEffect(() => {
      this.prop();
      const box = this.valueBox()?.nativeElement;
      this.scrollable.set(!!box && box.scrollHeight > box.clientHeight + 1);
    });
  }

  start() {
    const value = this.prop().value;
    this.draft.set(value === undefined ? '' : JSON.stringify(value));
    this.error.set('');
    this.done.set('');
    this.editing.set(true);
    afterNextRender(
      () => {
        const field = this.field()?.nativeElement;
        field?.focus();
        field?.select();
      },
      { injector: this.injector },
    );
  }

  cancel() {
    if (!this.editing()) return;
    this.editing.set(false);
    this.busy.set(false);
    this.error.set('');
    this.focusEdit();
  }

  async apply() {
    if (this.busy()) return;
    const parsed = parseDraft(this.draft());
    if ('error' in parsed) {
      this.error.set(parsed.error);
      return;
    }
    const prop = this.prop();
    const client = this.rpc();
    const pageId = this.pageId();
    if (!client || !pageId || !prop.edit) return;
    this.busy.set(true);
    this.error.set('');
    let result: EditResult;
    try {
      result = ((await client.scope('pangular').rpc.call('request-component-edit', {
        pageId,
        request: { id: this.componentId(), path: prop.prop, value: parsed.value, kind: prop.edit },
      })) ?? {}) as EditResult;
    } catch {
      result = { error: 'The devtools server did not answer. Try again.' };
    }
    this.busy.set(false);
    if (!this.editing()) return;
    if (result.ok) {
      this.editing.set(false);
      this.done.set(`Set ${prop.name}.`);
      this.focusEdit();
    } else {
      this.error.set(result.error ?? 'The page did not write it.');
      this.field()?.nativeElement.focus();
    }
  }

  private focusEdit() {
    afterNextRender(() => this.editButton()?.nativeElement.focus(), { injector: this.injector });
  }
}
