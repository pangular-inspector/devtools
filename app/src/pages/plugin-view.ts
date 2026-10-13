import { Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { PluginCell, PluginSection } from '@pangular-inspector/devtools/plugin';

// Renders one section of a plugin view: the declarative shapes a plugin
// reports instead of shipping code into the panel. Every value is text.

/** The text of a table cell, for display and the filter. */
export function cellText(value: PluginCell | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return value.text;
  return String(value);
}

function matches(text: string, filter: string): boolean {
  return !filter || text.toLowerCase().includes(filter);
}

/** The rows or items of a section the filter keeps, and how many it had. */
export function filteredCount(
  section: PluginSection,
  filter: string,
): { shown: number; total: number } {
  const text = filter.trim().toLowerCase();
  if (section.kind === 'table') {
    const shown = section.rows.filter((row) =>
      section.columns.some((column) => matches(cellText(row[column.key]), text)),
    ).length;
    return { shown, total: section.rows.length };
  }
  if (section.kind === 'list') {
    const shown = section.items.filter((item) =>
      matches(`${item.label} ${item.detail ?? ''} ${item.badge?.label ?? ''}`, text),
    ).length;
    return { shown, total: section.items.length };
  }
  return { shown: 0, total: 0 };
}

interface TreeEntry {
  key: string;
  value: unknown;
  /** A nested object or array, folded. */
  nested: boolean;
  summary: string;
}

const MAX_TREE_DEPTH = 8;
const MAX_TREE_ENTRIES = 200;

function entriesOf(value: unknown): TreeEntry[] {
  if (!value || typeof value !== 'object') return [];
  const pairs: [string, unknown][] = Array.isArray(value)
    ? value.map((item, index) => [String(index), item])
    : Object.entries(value as Record<string, unknown>);
  return pairs.slice(0, MAX_TREE_ENTRIES).map(([key, item]) => {
    const nested = !!item && typeof item === 'object';
    const summary = Array.isArray(item)
      ? `Array(${item.length})`
      : nested
        ? `{${Object.keys(item as object).length}}`
        : item === null
          ? 'null'
          : typeof item === 'string'
            ? JSON.stringify(item)
            : String(item);
    return { key, value: item, nested, summary };
  });
}

@Component({
  selector: 'app-plugin-section',
  imports: [NgTemplateOutlet],
  template: `
    @let part = section();
    <section class="section" [attr.aria-labelledby]="headingId()">
      <h3 class="title" [id]="headingId()">{{ part.title }}</h3>
      @switch (part.kind) {
        @case ('stats') {
          <dl class="stats">
            @for (item of part.items; track $index) {
              <div class="stat" [attr.data-tone]="item.tone ?? null">
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
              </div>
            }
          </dl>
        }
        @case ('text') {
          <p class="text">{{ part.text }}</p>
        }
        @case ('table') {
          @if (!part.rows.length) {
            <p class="empty">{{ part.empty ?? 'No rows.' }}</p>
          } @else if (!rows().length) {
            <p class="empty">No row matches the filter.</p>
          } @else {
            <div class="table-wrap" tabindex="0" role="region" [attr.aria-labelledby]="headingId()">
              <table>
                <thead>
                  <tr>
                    @for (column of part.columns; track column.key) {
                      <th scope="col">{{ column.label }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of rows(); track $index) {
                    <tr>
                      @for (column of part.columns; track column.key) {
                        @let value = row[column.key];
                        <td>
                          @if (toneOf(value); as tone) {
                            <span class="chip" [attr.data-tone]="tone">{{ cellText(value) }}</span>
                          } @else {
                            {{ cellText(value) }}
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
        @case ('list') {
          @if (!part.items.length) {
            <p class="empty">{{ part.empty ?? 'Nothing listed.' }}</p>
          } @else if (!items().length) {
            <p class="empty">No item matches the filter.</p>
          } @else {
            <ul class="list">
              @for (item of items(); track $index) {
                <li>
                  <span class="label">{{ item.label }}</span>
                  @if (item.badge; as badge) {
                    <span class="chip" [attr.data-tone]="badge.tone ?? 'neutral'">{{
                      badge.label
                    }}</span>
                  }
                  @if (item.detail) {
                    <span class="detail">{{ item.detail }}</span>
                  }
                </li>
              }
            </ul>
          }
        }
        @case ('tree') {
          <ng-container
            [ngTemplateOutlet]="tree"
            [ngTemplateOutletContext]="{ $implicit: part.value, depth: 0 }"
          />
        }
      }
    </section>

    <ng-template #tree let-value let-depth="depth">
      @let entries = entriesOf(value);
      @if (!entries.length) {
        <code class="leaf">{{ leafText(value) }}</code>
      } @else {
        <ul class="tree" [class.root]="depth === 0">
          @for (entry of entries; track entry.key) {
            <li>
              @if (entry.nested && depth < maxDepth) {
                <details [open]="depth === 0 && entries.length <= 8">
                  <summary>
                    <span class="key">{{ entry.key }}</span>
                    <span class="summary">{{ entry.summary }}</span>
                  </summary>
                  <ng-container
                    [ngTemplateOutlet]="tree"
                    [ngTemplateOutletContext]="{ $implicit: entry.value, depth: depth + 1 }"
                  />
                </details>
              } @else {
                <span class="key">{{ entry.key }}</span>
                <code class="leaf">{{ entry.summary }}</code>
              }
            </li>
          }
        </ul>
      }
    </ng-template>
  `,
  styles: `
    @use 'mixins' as m;
    :host {
      display: block;
    }
    .section {
      @include m.panel;
      display: grid;
      gap: 8px;
      min-width: 0;
      padding: 10px 12px;
    }
    .title {
      @include m.label;
      margin: 0;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 8px;
      margin: 0;
    }
    .stat {
      display: grid;
      gap: 2px;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
    }
    .stat dt {
      color: var(--text-2);
      font-size: 12px;
    }
    .stat dd {
      margin: 0;
      color: var(--text-strong);
      font-size: 18px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    .stat[data-tone='ok'] dd {
      color: var(--ok-text);
    }
    .stat[data-tone='warn'] dd {
      color: var(--warn-text);
    }
    .stat[data-tone='danger'] dd {
      color: var(--danger-text);
    }
    .stat[data-tone='accent'] dd {
      color: var(--accent-text);
    }
    .text {
      margin: 0;
      color: var(--text);
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .empty {
      margin: 0;
      color: var(--text-2);
    }
    .table-wrap {
      max-width: 100%;
      overflow-x: auto;
      border-radius: var(--radius-sm);
    }
    .table-wrap:focus-visible {
      @include m.focus-ring(-2px);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th,
    td {
      padding: 6px 8px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--text-2);
      font-weight: 600;
      white-space: nowrap;
    }
    td {
      color: var(--text);
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      padding: 1px 8px;
      border: 1px solid var(--border);
      border-radius: 99px;
      background: var(--surface-2);
      color: var(--text-2);
      font-size: 11px;
      font-weight: 600;
    }
    .chip[data-tone='ok'] {
      @include m.tint(ok);
    }
    .chip[data-tone='warn'] {
      @include m.tint(warn);
    }
    .chip[data-tone='danger'] {
      @include m.tint(danger);
    }
    .chip[data-tone='accent'] {
      @include m.tint(accent);
    }
    .list {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .list li {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: baseline;
      min-width: 0;
      padding: 4px 0;
      border-bottom: 1px solid var(--border);
    }
    .label {
      color: var(--text-strong);
      overflow-wrap: anywhere;
    }
    .detail {
      flex: 1 1 200px;
      min-width: 0;
      color: var(--text-2);
      overflow-wrap: anywhere;
    }
    .tree {
      margin: 0;
      padding: 0 0 0 14px;
      list-style: none;
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .tree.root {
      padding-left: 0;
    }
    .tree li {
      padding: 2px 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    summary {
      width: fit-content;
      max-width: 100%;
      border-radius: 2px;
      cursor: pointer;
    }
    summary:focus-visible {
      @include m.focus-ring;
    }
    .key {
      margin-right: 6px;
      color: var(--accent-text);
    }
    .summary {
      color: var(--text-2);
    }
    .leaf {
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 12px;
    }
  `,
})
export class PluginSectionView {
  readonly section = input.required<PluginSection>();
  /** Keeps the table rows and list items whose text contains it. */
  readonly filter = input('');
  /** Makes the heading id unique on the page. */
  readonly index = input(0);

  protected readonly maxDepth = MAX_TREE_DEPTH;
  protected readonly cellText = cellText;
  protected readonly entriesOf = entriesOf;
  protected readonly headingId = computed(() => `plugin-section-${this.index()}`);

  private readonly text = computed(() => this.filter().trim().toLowerCase());
  protected readonly rows = computed(() => {
    const part = this.section();
    if (part.kind !== 'table') return [];
    const text = this.text();
    return part.rows.filter((row) =>
      part.columns.some((column) => matches(cellText(row[column.key]), text)),
    );
  });
  protected readonly items = computed(() => {
    const part = this.section();
    if (part.kind !== 'list') return [];
    const text = this.text();
    return part.items.filter((item) =>
      matches(`${item.label} ${item.detail ?? ''} ${item.badge?.label ?? ''}`, text),
    );
  });

  protected toneOf(value: PluginCell | undefined): string | null {
    return value && typeof value === 'object' && value.tone ? value.tone : null;
  }

  protected leafText(value: unknown): string {
    if (value === null || value === undefined) return String(value);
    if (Array.isArray(value)) return '[]';
    if (typeof value === 'object') return '{}';
    return typeof value === 'string' ? JSON.stringify(value) : String(value);
  }
}
