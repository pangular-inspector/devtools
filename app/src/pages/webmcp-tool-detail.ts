import { Component, input, output } from '@angular/core';
import type { PanelLink } from '@pangular-inspector/devtools/internal/config';
import type { WebMcpToolRow } from './webmcp-data';

/** One WebMCP tool in full: what the page registered and what it claims. */
@Component({
  selector: 'app-webmcp-tool-detail',
  template: `
    @let t = tool();
    <p class="name">{{ t.name }}</p>
    <div class="pills">
      <span class="pill" [attr.data-tone]="t.tone ?? null">{{ t.statusText }}</span>
      @if (t.duplicate) {
        <span class="pill" data-tone="danger">duplicate name</span>
      }
      @if (t.readOnly) {
        <span class="pill">claims read only</span>
      } @else {
        <span class="pill" data-tone="warn">may change data</span>
      }
    </div>
    @if (t.description) {
      <p class="description">{{ t.description }}</p>
    } @else {
      <p class="muted">The page gave no description.</p>
    }
    @if (t.error) {
      <p class="problem">{{ t.error }}</p>
    }
    @if (t.duplicate) {
      <p class="muted">
        Another tool on this page has the same name, so the browser keeps only one of them.
      </p>
    }

    <h3>Annotations claimed by the page</h3>
    @if (t.claims.length) {
      <ul class="lines">
        @for (claim of t.claims; track claim) {
          <li>
            <code>{{ claim }}</code>
          </li>
        }
      </ul>
    } @else {
      <p class="muted">None.</p>
    }
    @if (!t.readOnly) {
      <p class="muted">
        Without <code>readOnlyHint: true</code> the tool is treated as able to change data.
      </p>
    } @else {
      <p class="muted">
        The page says this tool only reads. Calls that change data are flagged in the Calls list.
      </p>
    }

    <h3>Inputs</h3>
    @if (t.inputs.length) {
      <ul class="lines">
        @for (entry of t.inputs; track entry.text) {
          <li>
            <code>{{ entry.text }}</code>
            @if (entry.required) {
              <span class="tag">required</span>
            }
          </li>
        }
      </ul>
    } @else {
      <p class="muted">No inputs.</p>
    }

    @if (t.formId) {
      <h3>Form</h3>
      <p class="form">
        <code>{{ t.formId }}</code>
        @if (canShowForm()) {
          <button type="button" class="small" (click)="showForm(t)">Show form</button>
        }
      </p>
    }
    @if (t.listed) {
      <p class="muted">
        The tool was registered before the inspector attached, so earlier calls are not recorded.
      </p>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: grid;
      gap: 8px;
      min-width: 0;
    }
    p {
      margin: 0;
    }
    h3 {
      margin: 4px 0 0;
      @include m.label;
    }
    .name {
      color: var(--text-strong);
      font-family: var(--font-mono);
      font-size: 12.5px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .pill,
    .tag {
      display: inline-flex;
      align-items: center;
      padding: 0 8px;
      border: 1px solid var(--border);
      border-radius: 99px;
      background: var(--surface-2);
      color: var(--text-2);
      font-size: 11px;
      font-weight: 600;
      line-height: 18px;
    }
    .pill[data-tone='ok'] {
      @include m.tint(ok);
    }
    .pill[data-tone='warn'] {
      @include m.tint(warn);
    }
    .pill[data-tone='danger'] {
      @include m.tint(danger);
    }
    .description {
      color: var(--text);
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .problem {
      color: var(--danger-text);
      overflow-wrap: anywhere;
    }
    .muted {
      color: var(--text-2);
      line-height: 1.5;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .lines {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0 0 0 16px;
    }
    .lines li {
      min-width: 0;
    }
    .tag {
      margin-left: 6px;
    }
    .form {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 10px;
      align-items: center;
    }
    .small {
      height: var(--control-h);
      padding: 0 12px;
      border: 1px solid var(--control-border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font: inherit;
      cursor: pointer;
    }
    .small:focus-visible {
      @include m.focus-ring;
    }
  `,
})
export class WebMcpToolDetail {
  readonly tool = input.required<WebMcpToolRow>();
  /** Whether the Forms tab is on, so "Show form" has somewhere to go. */
  readonly canShowForm = input(true);
  readonly open = output<PanelLink>();

  showForm(tool: WebMcpToolRow) {
    if (tool.formId) this.open.emit({ tab: 'forms', id: tool.formId, page: tool.pageId });
  }
}
