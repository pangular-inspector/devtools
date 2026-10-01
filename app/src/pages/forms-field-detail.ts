import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import {
  FORMS_STYLES,
  actionMessage,
  formAction,
  formsCall,
  plain,
  redactLabel,
  UNMASK_DOCS_URL,
  type CollectedForm,
  type FormFieldNode,
} from './forms-types';
import { actionAllowed, actionBlockedMessage } from '../devtools-config';

@Component({
  selector: 'app-forms-field-detail',
  host: { role: 'region', 'aria-labelledby': 'forms-field-heading' },
  template: `
    <div class="head">
      <span class="section-label">Field</span>
      <h3 id="forms-field-heading" #heading tabindex="-1">{{ node().path || '(form)' }}</h3>
      <span class="tag">{{ node().type }}</span>
      <button
        type="button"
        class="small close"
        [attr.aria-label]="'Close details for ' + (node().path || 'the form')"
        (click)="closed.emit()"
      >
        Close
      </button>
    </div>
    @if (failed()) {
      <div class="failed" role="alert">
        <p class="muted">Could not explain this field. The devtools server did not answer.</p>
        <button type="button" class="small" (click)="retry()">Try again</button>
      </div>
    } @else {
      <pre class="explain" [attr.aria-busy]="text() === null ? 'true' : null">{{
        text() ?? 'Loading…'
      }}</pre>
    }
    @if (node().type === 'control' && !node().redacted) {
      <div class="editor">
        <label class="sr-only" for="field-value">New value for {{ node().path }}</label>
        <input
          id="field-value"
          class="field-input"
          type="text"
          placeholder="New value, read as the current value's type"
          autocomplete="off"
          spellcheck="false"
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
          (keydown.enter)="setValue()"
        />
        <button
          type="button"
          class="small primary"
          [disabled]="!canWrite()"
          [attr.aria-describedby]="canWrite() ? null : 'field-writes-off'"
          (click)="setValue()"
        >
          Set
        </button>
      </div>
    } @else if (node().type === 'control') {
      <p class="muted">
        No Set editor: this field is redacted ({{ redactLabel(node().redacted!) }}).
        <a [href]="unmaskDocsUrl" target="_blank" rel="noopener noreferrer">How to unmask it</a>
      </p>
    }
    <div class="row" role="group" aria-label="Field actions">
      <button type="button" class="small" (click)="act('focus')">Focus</button>
      <button
        type="button"
        class="small"
        [disabled]="!canWrite()"
        [attr.aria-describedby]="canWrite() ? null : 'field-writes-off'"
        (click)="act('mark-touched')"
      >
        Touch
      </button>
      <button
        type="button"
        class="small"
        [disabled]="!canWrite()"
        [attr.aria-describedby]="canWrite() ? null : 'field-writes-off'"
        (click)="act('revalidate')"
      >
        Revalidate
      </button>
      <button type="button" class="small" (click)="act('store-as-global')">Store as global</button>
    </div>
    @if (!canWrite()) {
      <p id="field-writes-off" class="muted">{{ writesOff }}</p>
    }
    <p class="status" role="status">{{ message() }}</p>
  `,
  styles: `
    ${FORMS_STYLES}
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      padding: 16px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      animation: enter 0.35s var(--ease) both;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: center;
      min-width: 0;
    }
    .head .section-label {
      flex-basis: 100%;
    }
    h3 {
      flex: 1 1 0;
      min-width: 0;
      margin: 0;
      color: var(--text-strong);
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 600;
      line-height: 1.4;
      overflow-wrap: anywhere;
      border-radius: 4px;
    }
    h3:focus {
      outline: none;
    }
    a {
      color: var(--accent);
      border-radius: 2px;
    }
    a:focus-visible,
    h3:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .close {
      margin-left: auto;
    }
    .failed {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
    }
    .failed p {
      margin: 0;
      font-size: 12.5px;
    }
    .editor {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .editor .field-input {
      flex: 1 1 auto;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .status {
      margin-top: -4px;
    }
    .status:empty {
      height: 0;
      margin: -12px 0 0;
    }
  `,
})
export class FormsFieldDetail {
  form = input.required<CollectedForm>();
  node = input.required<FormFieldNode>();
  version = input(0);
  rpc = input<DevframeRpcClient | null>(null);
  readonly closed = output<void>();

  readonly canWrite = computed(() => actionAllowed(this.rpc(), 'forms'));
  protected readonly writesOff = actionBlockedMessage('forms');
  protected readonly redactLabel = redactLabel;
  protected readonly unmaskDocsUrl = UNMASK_DOCS_URL;
  private readonly target = computed(() => `${this.form().id}|${this.node().path}`);
  readonly text = linkedSignal<string, string | null>({
    source: this.target,
    computation: () => null,
  });
  readonly failed = linkedSignal({ source: this.target, computation: () => false });
  private readonly attempt = signal(0);
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly draft = linkedSignal({ source: this.target, computation: () => '' });
  readonly message = linkedSignal({ source: this.target, computation: () => '' });

  constructor() {
    effect(() => {
      const form = this.form().id;
      const path = this.node().path;
      this.version();
      this.attempt();
      const client = this.rpc();
      untracked(() => this.load(client, form, path));
    });
    afterRenderEffect(() => {
      this.target();
      const heading = untracked(this.heading).nativeElement;
      this.host.nativeElement.scrollIntoView?.({ block: 'nearest' });
      heading.focus({ preventScroll: true });
    });
  }

  private async load(client: DevframeRpcClient | null, form: string, path: string) {
    if (!client) return;
    const text = await formsCall<string>(client, 'forms-explain', { kind: 'field', form, path });
    if (this.form().id !== form || this.node().path !== path) return;
    if (text === null) {
      this.failed.set(true);
      return;
    }
    this.failed.set(false);
    this.text.set(plain(text));
  }

  retry() {
    this.failed.set(false);
    this.attempt.update((n) => n + 1);
  }

  async act(action: string) {
    const result = await formAction(this.rpc(), {
      action,
      formId: this.form().id,
      path: this.node().path,
    });
    this.message.set(
      result.expression ? `${actionMessage(result)} ${result.expression}` : actionMessage(result),
    );
  }

  async setValue() {
    const result = await formAction(this.rpc(), {
      action: 'set-value',
      formId: this.form().id,
      path: this.node().path,
      value: this.draft(),
      coerce: true,
      mode: 'user',
    });
    this.message.set(actionMessage(result));
  }
}
