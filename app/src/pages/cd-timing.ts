import { Component, computed, input } from '@angular/core';
import type { CdReport } from '@pangular-inspector/devtools/internal/config';

const SHOWN = 10;

/** Milliseconds as the change detection section shows them. */
export function cdMs(value: number): string {
  return `${value < 10 ? value.toFixed(2) : Math.round(value)} ms`;
}

/** Lifecycle hook, output listener and afterRender time of a recording. */
@Component({
  selector: 'app-cd-timing',
  template: `
    @if (hooks().length || outputs().length || afterRender()) {
      <div class="timing">
        @if (hooks().length) {
          <div>
            <h3>Lifecycle hooks</h3>
            <table>
              <thead>
                <tr>
                  <th scope="col">Hook</th>
                  <th scope="col" class="num">Calls</th>
                  <th scope="col" class="num">Time</th>
                  <th scope="col" class="num">Slowest</th>
                </tr>
              </thead>
              <tbody>
                @for (h of hooks(); track $index) {
                  <tr>
                    <td class="mono">{{ h.name }}.{{ h.hook }}</td>
                    <td class="num">{{ h.calls }}</td>
                    <td class="num">{{ ms(h.ms) }}</td>
                    <td class="num">{{ ms(h.maxMs) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @if (outputs().length) {
          <div>
            <h3>Output listeners</h3>
            <table>
              <thead>
                <tr>
                  <th scope="col">Listener</th>
                  <th scope="col" class="num">Calls</th>
                  <th scope="col" class="num">Time</th>
                  <th scope="col" class="num">Slowest</th>
                </tr>
              </thead>
              <tbody>
                @for (o of outputs(); track $index) {
                  <tr>
                    <td class="mono">
                      {{ o.name }}
                      @if (o.listener) {
                        ({{ o.listener }})
                      }
                    </td>
                    <td class="num">{{ o.calls }}</td>
                    <td class="num">{{ ms(o.ms) }}</td>
                    <td class="num">{{ ms(o.maxMs) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
      @if (afterRender(); as a) {
        <p class="after-render">
          afterRender callbacks ran {{ a.runs }} {{ a.runs === 1 ? 'time' : 'times' }},
          {{ ms(a.ms) }} in total, slowest {{ ms(a.maxMs) }}.
        </p>
      }
      @if (dropped()) {
        <p class="note">
          {{ dropped() }} more hook or output {{ dropped() === 1 ? 'row is' : 'rows are' }} left
          out. A recording lists at most 100 of each.
        </p>
      }
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    .timing {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0 16px;
    }
    @media (min-width: 880px) {
      .timing {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
    }
    h3 {
      @include m.label;
      margin: 12px 0 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th,
    td {
      padding: 4px 6px;
      border-bottom: 1px solid var(--border);
      text-align: left;
    }
    th {
      color: var(--text-2);
      font-weight: 500;
    }
    td.mono {
      overflow-wrap: anywhere;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .mono {
      font-family: var(--font-mono);
    }
    .after-render,
    .note {
      margin: 8px 0 0;
      color: var(--text-2);
      font-size: 12px;
    }
  `,
})
export class CdTiming {
  readonly page = input<CdReport | null>(null);

  readonly hooks = computed(() => (this.page()?.hooks ?? []).slice(0, SHOWN));
  readonly outputs = computed(() => (this.page()?.outputs ?? []).slice(0, SHOWN));
  readonly afterRender = computed(() => {
    const stat = this.page()?.afterRender;
    return stat?.runs ? stat : null;
  });
  readonly dropped = computed(() => this.page()?.droppedTimings ?? 0);

  protected ms(value: number): string {
    return cdMs(value);
  }
}
