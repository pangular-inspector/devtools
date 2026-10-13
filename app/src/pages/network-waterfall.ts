import { Component, computed, input, output } from '@angular/core';
import { RovingList } from '../ui/roving-list';

/** The fields of a recorded call the waterfall reads. */
export interface WaterfallCall {
  id: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  at: number;
  side: 'client' | 'server';
  pageUrl?: string;
  cacheHit: boolean;
  cancelled?: boolean;
  error?: string;
}

interface Row {
  call: WaterfallCall;
  offsetMs: number;
  left: number;
  width: number;
  tone: 'ok' | 'bad' | 'cache' | 'neutral';
  /** The status shown in the row, so the outcome doesn't rest on the bar colour alone. */
  status: string;
  label: string;
}

interface Group {
  key: string;
  index: number;
  url: string;
  spanMs: number;
  rows: Row[];
}

function pathOf(url: string): string {
  try {
    const parsed = new URL(url, 'http://x');
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

function statusText(call: WaterfallCall): string {
  if (call.cancelled) return 'cancelled';
  return call.status ? String(call.status) : 'ERR';
}

function toneOf(call: WaterfallCall): Row['tone'] {
  if (call.cancelled) return 'neutral';
  if (!call.status || call.status >= 400 || call.error) return 'bad';
  return call.cacheHit ? 'cache' : 'ok';
}

/**
 * Client calls in start order, grouped by navigation: a group starts each
 * time the page URL a call was made on changes. Same rule as
 * `waterfallGroups` in `packages/devtools/src/rpc/http-waterfall.ts`.
 */
export function groupCalls(calls: readonly WaterfallCall[]): Group[] {
  const groups: Group[] = [];
  const sorted = calls.filter((c) => c.side === 'client').sort((a, b) => a.at - b.at);
  let current: (Group & { startedAt: number }) | undefined;
  for (const call of sorted) {
    const url = call.pageUrl ?? '';
    if (!current || current.url !== url) {
      current = {
        key: `${call.at}:${call.id}`,
        index: groups.length + 1,
        url,
        startedAt: call.at,
        spanMs: 0,
        rows: [],
      };
      groups.push(current);
    }
    const offsetMs = call.at - current.startedAt;
    current.spanMs = Math.max(current.spanMs, offsetMs + Math.max(call.durationMs, 0));
    current.rows.push({
      call,
      offsetMs,
      left: 0,
      width: 0,
      tone: toneOf(call),
      status: statusText(call) + (call.cacheHit && !call.cancelled ? ' cache' : ''),
      label: '',
    });
  }
  for (const group of groups) {
    const span = Math.max(group.spanMs, 1);
    for (const row of group.rows) {
      row.left = (row.offsetMs / span) * 100;
      // A call too short to see still gets a sliver.
      row.width = Math.max((Math.max(row.call.durationMs, 0) / span) * 100, 0.8);
      row.label =
        `${row.call.method} ${pathOf(row.call.url)}, starts at +${row.offsetMs} ms, ` +
        `takes ${row.call.durationMs} ms, status ${statusText(row.call)}` +
        (row.call.cacheHit ? ', transfer cache' : '');
    }
  }
  return groups.reverse();
}

/**
 * The client calls of one page as a waterfall, newest navigation first. Each
 * bar starts at the call's offset in its navigation and spans its duration.
 * Clicking a row opens the call's details in the timeline.
 */
@Component({
  selector: 'app-network-waterfall',
  imports: [RovingList],
  template: `
    @if (groups().length) {
      <div class="legend" aria-hidden="true">
        <span><i class="swatch ok"></i>Network</span>
        <span><i class="swatch cache"></i>Transfer cache</span>
        <span><i class="swatch bad"></i>Failed</span>
        <span><i class="swatch neutral"></i>Cancelled</span>
      </div>
      <div class="groups" appRovingList="button.wf-row">
        @for (group of groups(); track group.key) {
          <section class="group" [attr.aria-labelledby]="'wf-' + group.key">
            <h3 class="group-head" [id]="'wf-' + group.key">
              <span class="group-title">Navigation {{ group.index }}</span>
              <span class="sr-only">, </span>
              <span class="group-url" [title]="group.url">{{ group.url || 'Unknown page' }}</span>
              <span class="sr-only">, </span>
              <span class="group-meta"
                >{{ group.rows.length }} {{ group.rows.length === 1 ? 'call' : 'calls' }},
                {{ group.spanMs }} ms</span
              >
            </h3>
            <ul class="rows">
              @for (row of group.rows; track row.call.id) {
                <li>
                  <button
                    type="button"
                    class="wf-row"
                    [attr.data-call-id]="row.call.id"
                    [class.selected]="selectedId() === row.call.id"
                    [attr.aria-pressed]="selectedId() === row.call.id"
                    [attr.aria-label]="row.label"
                    [attr.aria-controls]="selectedId() ? 'call-preview' : null"
                    (click)="open.emit(row.call.id)"
                  >
                    <span class="name">
                      <span class="method">{{ row.call.method }}</span>
                      <span class="path" [title]="row.call.url">{{ pathOf(row.call.url) }}</span>
                    </span>
                    <span class="track" aria-hidden="true">
                      <span
                        [class]="'bar ' + row.tone"
                        [style.left.%]="row.left"
                        [style.width.%]="row.width"
                      ></span>
                    </span>
                    <span class="time" aria-hidden="true"
                      ><span [class]="'status status-' + row.tone">{{ row.status }}</span> · +{{
                        row.offsetMs
                      }}
                      ms · {{ row.call.durationMs }} ms</span
                    >
                  </button>
                </li>
              }
            </ul>
          </section>
        }
      </div>
    } @else {
      <div class="empty" role="status">
        <p>No client calls to show.</p>
        <p class="muted small">
          The waterfall shows calls made in the browser. Clear the filters or pick All sides, then
          use the page.
        </p>
      </div>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      margin: 0 0 8px;
      color: var(--text-2);
      font-size: 12px;
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .swatch {
      display: inline-block;
      width: 12px;
      height: 8px;
      border-radius: 2px;
    }
    .groups {
      display: grid;
      gap: 12px;
      max-height: 480px;
      overflow: auto;
    }
    .group-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 2px 8px;
      margin: 0 0 4px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-strong);
    }
    .group-url {
      @include m.truncate;
      flex: 1 1 120px;
      color: var(--text-2);
      font-family: var(--font-mono);
      font-weight: 400;
    }
    .group-meta {
      color: var(--text-2);
      font-weight: 400;
    }
    .rows {
      display: grid;
      gap: 2px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .wf-row {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(80px, 3fr) auto;
      align-items: center;
      gap: 8px;
      width: 100%;
      height: auto;
      min-height: 28px;
      padding: 4px 8px;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--text);
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background 150ms var(--ease);
    }
    .wf-row:hover {
      background: var(--surface-2);
    }
    .wf-row.selected {
      border-color: var(--accent-line);
      background: var(--accent-soft);
    }
    .wf-row:focus-visible {
      @include m.focus-ring(-2px);
    }
    .name {
      display: flex;
      align-items: baseline;
      gap: 6px;
      min-width: 0;
    }
    .method {
      color: var(--text-2);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
    }
    .path {
      @include m.truncate;
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .track {
      position: relative;
      height: 10px;
      border-radius: 2px;
      background: var(--surface-3);
    }
    .bar {
      position: absolute;
      top: 0;
      bottom: 0;
      border-radius: 2px;
    }
    .ok {
      background: var(--accent);
    }
    .cache {
      background: var(--ok);
    }
    .bad {
      background: var(--danger);
    }
    .neutral {
      background: var(--text-3);
    }
    .status {
      padding: 0 4px;
      border: 1px solid transparent;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--text-2);
    }
    .status-bad {
      @include m.tint(danger);
    }
    .status-cache {
      @include m.tint(ok);
    }
    .time {
      color: var(--text-2);
      font-family: var(--font-mono);
      font-size: 11px;
      white-space: nowrap;
    }
    .empty p {
      margin: 0 0 4px;
    }
    .muted {
      color: var(--text-2);
    }
    .small {
      font-size: 12px;
    }
    @media (max-width: 480px) {
      .wf-row {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .track {
        grid-column: 1 / -1;
        grid-row: 2;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .wf-row {
        transition: none;
      }
    }
  `,
})
export class NetworkWaterfall {
  readonly calls = input<readonly WaterfallCall[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly open = output<string>();

  readonly groups = computed(() => groupCalls(this.calls()));
  protected readonly pathOf = pathOf;
}
