import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import type { WebMcpPage, WebMcpTool } from './forms-types';

const OUTCOMES: Record<string, string> = {
  running: 'running',
  submitted: 'submitted',
  failed: 'submit failed',
  done: 'done',
  threw: 'threw',
};

@Component({
  selector: 'app-forms-webmcp',
  imports: [DatePipe],
  template: `
    @if (tool(); as tool) {
      <section class="webmcp" aria-labelledby="forms-webmcp-title">
        <div class="head">
          <h3 id="forms-webmcp-title" class="section-label">WebMCP tool</h3>
          <code class="name">{{ tool.name }}</code>
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
              @for (call of tool.calls!; track call.at) {
                <li>
                  <time [attr.datetime]="iso(call.at)">{{ call.at | date: 'HH:mm:ss' }}</time>
                  <span class="state" [attr.data-state]="call.outcome">{{
                    outcome(call.outcome)
                  }}</span>
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
      </section>
    } @else if (noModelContext()) {
      <p class="note">
        This app uses <code>provideExperimentalWebMcpForms()</code>, but the browser has no
        <code>modelContext</code>, so Angular registers no WebMCP tool for this form.
      </p>
    }
  `,
  styles: `
    @use 'mixins' as m;

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
  `,
})
export class FormsWebMcp {
  tool = input<WebMcpTool | undefined>();
  page = input<WebMcpPage | undefined>();
  signalForm = input(false);

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
