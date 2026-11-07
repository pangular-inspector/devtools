import { DatePipe, JsonPipe } from '@angular/common';
import { Component, computed, input, linkedSignal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { actionAllowed, actionBlockedMessage } from '../devtools-config';
import {
  FORMS_STYLES,
  actionMessage,
  formAction,
  type WebMcpPage,
  type WebMcpTool,
} from './forms-types';

let nextId = 0;

const OUTCOMES: Record<string, string> = {
  running: 'running',
  submitted: 'submitted',
  failed: 'submit failed',
  done: 'done',
  threw: 'threw',
};

/** A sample input for a JSON schema: empty strings, zeros, false and one item per array. */
export function sampleInput(schema: unknown, depth = 0): unknown {
  if (!schema || typeof schema !== 'object' || depth > 10) return null;
  const node = schema as Record<string, unknown>;
  switch (node['type']) {
    case 'object': {
      const out: Record<string, unknown> = {};
      const properties = (node['properties'] ?? {}) as Record<string, unknown>;
      for (const [key, child] of Object.entries(properties))
        out[key] = sampleInput(child, depth + 1);
      return out;
    }
    case 'array':
      return [sampleInput(node['items'], depth + 1)];
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    default:
      return null;
  }
}

@Component({
  selector: 'app-forms-webmcp',
  imports: [DatePipe, JsonPipe],
  template: `
    @if (tool(); as tool) {
      <section class="webmcp" [attr.aria-labelledby]="uid + '-title ' + uid + '-name'">
        <div class="head">
          <h3 [id]="uid + '-title'" class="section-label">WebMCP tool</h3>
          <code class="name" [id]="uid + '-name'">{{ tool.name }}</code>
          <span class="state" [attr.data-state]="tool.status">{{ statusText() }}</span>
          @if (tool.duplicate) {
            <span class="state" data-state="failed">duplicate name</span>
          }
        </div>
        @if (tool.description) {
          <p class="description">{{ tool.description }}</p>
        }
        @if (tool.status === 'failed' && tool.error && tool.error !== 'schema') {
          <p class="problem">{{ tool.error }}</p>
        }
        @if (tool.blocking?.length) {
          <div class="group">
            <p class="muted">Angular could not infer an input schema. These fields block it:</p>
            <ul>
              @for (entry of tool.blocking!; track entry.path) {
                <li>
                  <code>{{ entry.path }}</code> is {{ entry.reason }}
                </li>
              }
            </ul>
          </div>
        }
        @if (tool.inputs?.length) {
          <div class="group">
            <p class="muted">Inputs</p>
            <ul class="inputs">
              @for (entry of tool.inputs!; track entry) {
                <li>
                  <code>{{ entry }}</code>
                  @if (isRequired(entry)) {
                    <span class="tag">required</span>
                  }
                </li>
              }
            </ul>
          </div>
        }
        @if (tool.requiredChanged?.length) {
          <div class="group">
            <p class="muted">
              Required changed since registration. Angular reads it once, so agents still see the
              old schema:
            </p>
            <ul>
              @for (entry of tool.requiredChanged!; track entry.path) {
                <li>
                  <code>{{ entry.path }}</code> is now
                  {{ entry.now ? 'required' : 'optional' }}
                </li>
              }
            </ul>
          </div>
        }
        <div class="group">
          <p class="muted">Recent calls</p>
          @if (tool.calls?.length) {
            <ul>
              @for (call of tool.calls!; track $index) {
                <li>
                  <time [attr.datetime]="iso(call.at)">{{ call.at | date: 'HH:mm:ss' }}</time>
                  <span class="state" [attr.data-state]="call.outcome">{{
                    outcome(call.outcome)
                  }}</span>
                  @if (call.tried) {
                    <span class="tag">tried from the panel</span>
                  }
                  @if (call.ms !== undefined) {
                    <span class="muted">{{ call.ms }} ms</span>
                  }
                  @if (call.fields?.length) {
                    <span class="muted">fields {{ call.fields!.join(', ') }}</span>
                  }
                  @if (call.detail) {
                    <pre class="detail">{{ call.detail }}</pre>
                  }
                </li>
              }
            </ul>
          } @else if (tool.seen === 'list') {
            <p class="muted">
              Calls are not recorded for a tool registered before the inspector attached.
            </p>
          } @else {
            <p class="muted">No agent has called this tool since the inspector attached.</p>
          }
        </div>
        @if (tool.schema) {
          <details class="schema">
            <summary>Input schema</summary>
            <pre class="detail">{{ tool.schema | json }}</pre>
          </details>
        }
        @if (formId() && tool.status === 'registered') {
          <div class="try" role="group" [attr.aria-labelledby]="uid + '-try-label'">
            <label class="muted" [id]="uid + '-try-label'" [for]="uid + '-try-input'"
              >Tool input (JSON)</label
            >
            <textarea
              class="try-input"
              rows="4"
              spellcheck="false"
              autocomplete="off"
              [id]="uid + '-try-input'"
              [attr.aria-describedby]="uid + '-try-hint'"
              [value]="draft()"
              (input)="draft.set($any($event.target).value)"
            ></textarea>
            <p class="muted" [id]="uid + '-try-hint'">
              Runs the tool in the app the way an agent call does: it fills the form and submits it.
            </p>
            <div class="try-row">
              <button
                type="button"
                class="small primary"
                [class.armed]="armed()"
                [disabled]="!canWrite()"
                [attr.aria-describedby]="canWrite() ? null : uid + '-try-off'"
                (click)="tryTool()"
              >
                {{ armed() ? 'Confirm try' : 'Try this tool' }}
              </button>
            </div>
            @if (!canWrite()) {
              <p class="muted" [id]="uid + '-try-off'">{{ writesOff }}</p>
            }
            <p class="status" role="status">{{ message() }}</p>
          </div>
        }
      </section>
    } @else if (noModelContext()) {
      <p class="note">
        This app uses <code>provideExperimentalWebMcpForms()</code>, but the browser has no
        <code>modelContext</code>, so Angular registers no WebMCP tool for this form.
      </p>
    }
  `,
  styles: `
    ${FORMS_STYLES}

    :host {
      display: contents;
    }
    .webmcp {
      display: grid;
      gap: 8px;
      min-width: 0;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      font-size: 13px;
      color: var(--text);
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      align-items: center;
    }
    .section-label {
      @include m.label;
      margin: 0;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12.5px;
      overflow-wrap: anywhere;
    }
    .name {
      font-weight: 600;
    }
    .state {
      padding: 0 8px;
      border: 1px solid var(--border-strong);
      border-radius: 999px;
      color: var(--text-2);
      font-size: 12px;
      line-height: 20px;
    }
    .state[data-state='failed'],
    .state[data-state='threw'] {
      border-color: color-mix(in srgb, var(--danger) 45%, transparent);
      color: var(--danger);
    }
    .state[data-state='registered'],
    .state[data-state='submitted'] {
      border-color: var(--accent-line);
      color: var(--text);
    }
    .description,
    .problem,
    .note {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .problem {
      color: var(--danger);
    }
    .note {
      color: var(--text-2);
      font-size: 13px;
    }
    .muted {
      margin: 0;
      color: var(--text-2);
    }
    .group {
      display: grid;
      gap: 4px;
      min-width: 0;
    }
    ul {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0 0 0 16px;
      overflow-wrap: anywhere;
    }
    li {
      min-width: 0;
    }
    li > * + * {
      margin-left: 6px;
    }
    .tag {
      color: var(--text-2);
      font-size: 11px;
    }
    .detail {
      margin: 4px 0 0;
      padding: 6px 8px;
      border-radius: var(--radius-sm);
      background: var(--bg);
      font-family: var(--font-mono);
      font-size: 12px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .schema summary {
      color: var(--text);
      font-weight: 500;
      cursor: pointer;
    }
    .schema summary:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .try {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .try-input {
      width: 100%;
      min-width: 0;
      padding: 6px 8px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12.5px;
      resize: vertical;
    }
    .try-input:focus,
    .try-input:focus-visible {
      @include m.field-focus;
    }
    .try-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .status:empty {
      display: none;
    }
  `,
})
export class FormsWebMcp {
  protected readonly uid = `forms-webmcp-${++nextId}`;
  tool = input<WebMcpTool | undefined>();
  page = input<WebMcpPage | undefined>();
  signalForm = input(false);
  /** The form the tool belongs to; Try this tool shows only with it. */
  formId = input<string | undefined>();
  rpc = input<DevframeRpcClient | null>(null);

  readonly canWrite = computed(() => actionAllowed(this.rpc(), 'forms'));
  protected readonly writesOff = actionBlockedMessage('forms');
  private readonly target = computed(() => `${this.formId() ?? ''}|${this.tool()?.name ?? ''}`);
  private readonly schemaText = computed(() =>
    JSON.stringify(sampleInput(this.tool()?.schema) ?? {}, null, 2),
  );
  /** The input to send; starts as a sample of the schema and resets when the tool changes. */
  readonly draft = linkedSignal<{ target: string; sample: string }, string>({
    source: () => ({ target: this.target(), sample: this.schemaText() }),
    computation: (source, previous) =>
      previous && previous.source.target === source.target ? previous.value : source.sample,
  });
  readonly armed = linkedSignal({ source: this.target, computation: () => false });
  readonly message = linkedSignal({ source: this.target, computation: () => '' });

  /** First press arms the button, the second sends the input to the page (try-webmcp). */
  async tryTool() {
    const formId = this.formId();
    if (!formId) return;
    let value: unknown;
    try {
      value = JSON.parse(this.draft());
    } catch {
      this.message.set('The tool input is not valid JSON.');
      return;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      this.message.set('The tool input must be a JSON object.');
      return;
    }
    if (!this.armed()) {
      this.armed.set(true);
      this.message.set('Press "Confirm try" to run the tool in the app. It submits the form.');
      return;
    }
    this.armed.set(false);
    const target = this.target();
    const result = await formAction(this.rpc(), {
      action: 'try-webmcp',
      formId,
      value,
      confirm: true,
    });
    if (this.target() !== target) return;
    this.message.set(actionMessage(result));
  }

  readonly statusText = computed(() => {
    const tool = this.tool();
    if (!tool) return '';
    if (tool.status === 'failed') return 'not registered';
    if (tool.status === 'registering') return 'registering';
    return tool.seen === 'list' ? 'registered before the inspector attached' : 'registered';
  });

  readonly noModelContext = computed(() => {
    const page = this.page();
    return this.signalForm() && !!page && !page.modelContext && !!page.provided;
  });

  isRequired(entry: string): boolean {
    const path = entry.slice(0, entry.lastIndexOf(':'));
    return this.tool()?.required?.includes(path) ?? false;
  }

  outcome(value: string): string {
    return OUTCOMES[value] ?? value;
  }

  iso(at: number): string {
    return new Date(at).toISOString();
  }
}

/** WebMCP tools the page registered that the collector could not link to a form. */
@Component({
  selector: 'app-forms-webmcp-others',
  imports: [FormsWebMcp],
  template: `
    @if (tools().length) {
      <section class="others" aria-labelledby="forms-webmcp-others-title">
        <h2 id="forms-webmcp-others-title">
          Other WebMCP tools <span class="count">{{ tools().length }}</span>
        </h2>
        <p class="muted">
          Tools registered on the page that are not linked to a form in the list, such as tools the
          app registers itself.
        </p>
        <ul class="tools">
          @for (entry of tools(); track $index) {
            <li>
              @if (manyPages()) {
                <p class="page">
                  Page <code>{{ entry.pageId }}</code>
                </p>
              }
              <app-forms-webmcp [tool]="entry.tool" />
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    .others {
      display: grid;
      gap: 8px;
      min-width: 0;
      margin-top: 16px;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
    }
    h2 {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 0;
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .count {
      padding: 0 6px;
      border-radius: 99px;
      background: var(--surface-3);
      color: var(--text-2);
      font-size: 11px;
      letter-spacing: 0;
      line-height: 18px;
      font-variant-numeric: tabular-nums;
    }
    .muted,
    .page {
      margin: 0;
      color: var(--text-2);
      font-size: 13px;
      line-height: 1.5;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12.5px;
      overflow-wrap: anywhere;
    }
    .tools {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .tools > li {
      display: grid;
      gap: 4px;
      min-width: 0;
    }
  `,
})
export class FormsWebMcpOthers {
  pages = input<WebMcpPage[]>([]);

  readonly tools = computed(() =>
    this.pages().flatMap((page) => page.tools.map((tool) => ({ tool, pageId: page.pageId }))),
  );

  readonly manyPages = computed(() => new Set(this.tools().map((t) => t.pageId)).size > 1);
}
