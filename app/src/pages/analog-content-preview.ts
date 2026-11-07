import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { rpcTry as call } from '../rpc';
import { markdownBlocks, type InlinePart } from './analog-markdown';

/** One line of inline markdown parts, as text, code, strong and em elements. */
@Component({
  selector: 'app-md-inline',
  template: `
    @for (part of parts(); track $index) {
      @if (part.code) {
        <code>{{ part.text }}</code>
      } @else if (part.strong) {
        <strong>{{ part.text }}</strong>
      } @else if (part.em) {
        <em>{{ part.text }}</em>
      } @else {
        {{ part.text }}
      }
    }
  `,
  styles: `
    code {
      padding: 1px 5px;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-family: var(--mono);
      font-size: 12px;
    }
  `,
})
export class MarkdownInline {
  readonly parts = input<InlinePart[]>([]);
}

export interface ContentPreviewData {
  file: string;
  values: Record<string, unknown>;
  body: string;
  truncated?: true;
  schemaErrors?: string[];
  error?: string;
}

@Component({
  selector: 'app-analog-content-preview',
  template: `
    <section class="card" aria-labelledby="content-preview-heading">
      <div class="row head">
        <h2 id="content-preview-heading">Preview</h2>
        <span class="file grow">{{ file() }}</span>
        <button type="button" class="btn ghost" (click)="closed.emit()">Close preview</button>
      </div>
      @if (loading()) {
        <p class="muted" role="status">Reading {{ file() }}…</p>
      } @else if (data(); as d) {
        @if (d.error) {
          <p class="note" data-tone="bad" role="alert">{{ d.error }}</p>
        }
        @if (d.schemaErrors?.length) {
          <div class="note" data-tone="bad" role="status">
            <p><strong>Does not match the content schema</strong></p>
            <ul class="plain">
              @for (e of d.schemaErrors; track e) {
                <li>{{ e }}</li>
              }
            </ul>
          </div>
        } @else if (schema() && !d.error) {
          <p class="muted small">Matches {{ schema() }}.</p>
        }
        @if (frontmatter().length) {
          <dl class="facts">
            @for (f of frontmatter(); track f[0]) {
              <dt class="mono">{{ f[0] }}</dt>
              <dd class="mono">{{ f[1] }}</dd>
            }
          </dl>
        }
        <div
          class="md"
          [attr.aria-label]="'Rendered markdown of ' + file()"
          role="region"
          tabindex="0"
        >
          @for (block of blocks(); track $index) {
            @switch (block.kind) {
              @case ('heading') {
                <p class="md-heading" [attr.data-level]="block.level">
                  <app-md-inline [parts]="block.parts" />
                </p>
              }
              @case ('paragraph') {
                <p><app-md-inline [parts]="block.parts" /></p>
              }
              @case ('quote') {
                <blockquote>
                  <app-md-inline [parts]="block.parts" />
                </blockquote>
              }
              @case ('list') {
                @if (block.ordered) {
                  <ol>
                    @for (item of block.items; track $index) {
                      <li><app-md-inline [parts]="item" /></li>
                    }
                  </ol>
                } @else {
                  <ul>
                    @for (item of block.items; track $index) {
                      <li><app-md-inline [parts]="item" /></li>
                    }
                  </ul>
                }
              }
              @case ('code') {
                <pre class="code">{{ block.text }}</pre>
              }
              @case ('rule') {
                <hr />
              }
            }
          } @empty {
            <p class="muted">The file has no markdown after its frontmatter.</p>
          }
          @if (d.truncated) {
            <p class="muted small">The preview stops after 20,000 characters.</p>
          }
        </div>
      } @else {
        <p class="note" data-tone="bad" role="alert">Could not read {{ file() }}.</p>
      }
    </section>
  `,
  imports: [MarkdownInline],
  styles: `
    @use 'analog' as a;
    @include a.controls;
    :host {
      display: block;
    }
    .head {
      justify-content: space-between;
    }
    .plain {
      margin: 4px 0 0;
      padding-left: 18px;
    }
    .md {
      display: grid;
      gap: 10px;
      max-height: 420px;
      overflow: auto;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .md:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: -2px;
    }
    .md ul,
    .md ol {
      margin: 0;
      padding-left: 22px;
    }
    .md-heading {
      color: var(--text-strong);
      font-weight: 650;
    }
    .md-heading[data-level='1'] {
      font-size: 20px;
    }
    .md-heading[data-level='2'] {
      font-size: 17px;
    }
    .md-heading[data-level='3'] {
      font-size: 15px;
    }
    blockquote {
      margin: 0;
      padding-left: 12px;
      border-left: 3px solid var(--border-strong);
      color: var(--text-2);
    }
    hr {
      width: 100%;
      border: none;
      border-top: 1px solid var(--border);
    }
  `,
})
export class AnalogContentPreview {
  readonly rpc = input<DevframeRpcClient | null>(null);
  readonly file = input.required<string>();
  /** The schema file the frontmatter is checked against, when one is set. */
  readonly schema = input<string | undefined>(undefined);
  readonly closed = output<void>();

  readonly data = signal<ContentPreviewData | null>(null);
  readonly loading = signal(true);
  readonly blocks = computed(() => markdownBlocks(this.data()?.body ?? ''));
  readonly frontmatter = computed(() =>
    Object.entries(this.data()?.values ?? {}).map(
      ([key, value]) =>
        [key, typeof value === 'string' ? value : JSON.stringify(value)] as [string, string],
    ),
  );
  private run = 0;

  constructor() {
    effect(() => {
      const file = this.file();
      const client = this.rpc();
      untracked(() => void this.fetch(client, file));
    });
  }

  private async fetch(client: DevframeRpcClient | null, file: string) {
    const run = ++this.run;
    this.loading.set(true);
    const data = await call<ContentPreviewData>(client, 'analog-content-preview', file);
    if (run !== this.run) return;
    this.data.set(data);
    this.loading.set(false);
  }
}
