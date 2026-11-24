import { Component, input, output } from '@angular/core';
import type { PanelLink } from '@pangular-inspector/devtools/internal/config';
import { clockTime, spanText } from './timeline-data';
import type { WebMcpCallRow, WebMcpCallTrace } from './webmcp-data';

/** One WebMCP tool call in full: its masked values and what it did on the page. */
@Component({
  selector: 'app-webmcp-call-detail',
  template: `
    @let c = call();
    @let t = trace();
    <p class="name">{{ c.tool }}</p>
    <dl>
      <dt>Outcome</dt>
      <dd>
        <span class="pill" [attr.data-tone]="c.tone ?? null">{{ c.outcomeText }}</span>
      </dd>
      <dt>Started</dt>
      <dd>{{ clock(c.at) }}</dd>
      <dt>Took</dt>
      <dd>{{ c.ms !== undefined ? span(c.ms) : 'still running' }}</dd>
    </dl>
    @if (c.detail) {
      <p class="problem">{{ c.detail }}</p>
    }

    @if (t.verdict === 'warning') {
      <p class="verdict warning">{{ t.verdictText }}</p>
    } @else if (t.verdict === 'info') {
      <p class="verdict">{{ t.verdictText }}</p>
    }

    <h3>Arguments</h3>
    @if (c.args !== undefined) {
      <pre tabindex="0" aria-label="Arguments">{{ c.args }}</pre>
    } @else {
      <p class="muted">None.</p>
    }
    <h3>Result</h3>
    @if (c.result !== undefined) {
      <pre tabindex="0" aria-label="Result">{{ c.result }}</pre>
    } @else {
      <p class="muted">{{ c.outcome === 'running' ? 'Not settled yet.' : 'None.' }}</p>
    }

    <h3>Effects</h3>
    @if (t.userInput) {
      <p class="muted">The user was active during this call, so only caused effects are listed.</p>
    }
    @if (t.effects.length) {
      <ol class="effects" aria-label="Effects of this call">
        @for (effect of t.effects; track effect.key) {
          <li>
            <div class="effect-head">
              <span class="pill" [attr.data-certainty]="effect.certainty">{{
                effect.certaintyText
              }}</span>
              <span class="layer">{{ effect.layerLabel }}</span>
              <time class="when">{{ clock(effect.at) }}</time>
            </div>
            <code class="title">{{ effect.title }}</code>
            @if (effect.detail) {
              <span class="muted">{{ effect.detail }}</span>
            }
            <button type="button" class="link" (click)="open.emit(effect.link)">
              Open in {{ effect.tabLabel }}<span class="sr-only">: {{ effect.title }}</span>
            </button>
          </li>
        }
      </ol>
      <p class="muted">
        Caused: a collector tied the effect to this call. Probably caused: it started while the call
        ran.
      </p>
    } @else {
      <p class="muted">
        No navigation, HTTP call, NgRx action, form change or signal write was seen during this
        call.
      </p>
    }

    @if (c.formId && canShowForm()) {
      <button type="button" class="small" (click)="showForm(c)">Show form</button>
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
    dl {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 4px 12px;
      margin: 0;
    }
    dt {
      color: var(--text-2);
    }
    dd {
      margin: 0;
    }
    .pill {
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
      white-space: nowrap;
    }
    .pill[data-tone='ok'] {
      @include m.tint(ok);
    }
    .pill[data-tone='danger'] {
      @include m.tint(danger);
    }
    .pill[data-certainty='caused'] {
      @include m.tint(accent);
    }
    .problem {
      color: var(--danger-text);
      overflow-wrap: anywhere;
    }
    .verdict {
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      line-height: 1.5;
    }
    .verdict.warning {
      @include m.tint(warn);
      border-color: color-mix(in srgb, var(--warn) 45%, transparent);
    }
    .muted {
      color: var(--text-2);
      line-height: 1.5;
    }
    code,
    pre {
      font-family: var(--font-mono);
      font-size: 12px;
    }
    pre {
      max-height: 200px;
      margin: 0;
      padding: 8px;
      overflow: auto;
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    pre:focus-visible {
      @include m.focus-ring(-2px);
    }
    .effects {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .effects li {
      display: grid;
      gap: 2px;
      min-width: 0;
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
    }
    .effect-head {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: center;
      font-size: 12px;
    }
    .layer {
      color: var(--text-2);
    }
    .when {
      margin-left: auto;
      color: var(--text-2);
      font-variant-numeric: tabular-nums;
    }
    .title {
      color: var(--text-strong);
      overflow-wrap: anywhere;
    }
    .link {
      justify-self: start;
      padding: 0;
      border: 0;
      border-radius: 2px;
      background: none;
      color: var(--accent-text);
      font: inherit;
      font-size: 12px;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    .link:focus-visible {
      @include m.focus-ring;
    }
    .small {
      justify-self: start;
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
export class WebMcpCallDetail {
  readonly call = input.required<WebMcpCallRow>();
  readonly trace = input.required<WebMcpCallTrace>();
  readonly canShowForm = input(true);
  readonly open = output<PanelLink>();
  protected readonly clock = clockTime;
  protected readonly span = spanText;

  showForm(call: WebMcpCallRow) {
    if (call.formId) this.open.emit({ tab: 'forms', id: call.formId, page: call.pageId });
  }
}
