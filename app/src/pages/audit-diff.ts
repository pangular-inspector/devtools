import { Component, computed, input } from '@angular/core';
import { AREA_LABEL, METRICS, type AuditDiff, type AuditFinding } from './audit-types';

interface MetricRow {
  label: string;
  before: string;
  after: string;
  change: string;
  tone: 'ok' | 'danger' | 'plain';
}

/** The before and after comparison of two audits: numbers, then resolved, new and changed findings. */
@Component({
  selector: 'app-audit-diff',
  template: `
    @for (note of diff().notes; track note) {
      <p class="notice">{{ note }}</p>
    }
    <div class="table-wrap" tabindex="0" role="region" aria-label="Numbers before and after">
      <table>
        <caption class="sr-only">
          Numbers before and after. Lower is better for each.
        </caption>
        <thead>
          <tr>
            <th scope="col">Number</th>
            <th scope="col">Before</th>
            <th scope="col">After</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.label) {
            <tr>
              <th scope="row">{{ row.label }}</th>
              <td>{{ row.before }}</td>
              <td>{{ row.after }}</td>
              <td>
                <span class="chip" [attr.data-tone]="row.tone">{{ row.change }}</span>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <div class="lists">
      <section aria-labelledby="audit-resolved">
        <h3 id="audit-resolved">Resolved ({{ diff().resolved.length }})</h3>
        @if (diff().resolved.length) {
          <ul>
            @for (finding of diff().resolved; track finding.key) {
              <li>
                <span class="area">{{ areaLabel[finding.area] }}</span>
                {{ label(finding) }}
              </li>
            }
          </ul>
        } @else {
          <p class="muted">None.</p>
        }
      </section>
      <section aria-labelledby="audit-added">
        <h3 id="audit-added">New ({{ diff().added.length }})</h3>
        @if (diff().added.length) {
          <ul>
            @for (finding of diff().added; track finding.key) {
              <li>
                <span class="area">{{ areaLabel[finding.area] }}</span>
                {{ label(finding) }}
              </li>
            }
          </ul>
        } @else {
          <p class="muted">None.</p>
        }
      </section>
      <section aria-labelledby="audit-changed">
        <h3 id="audit-changed">Changed count ({{ changed().length }})</h3>
        @if (changed().length) {
          <ul>
            @for (finding of changed(); track finding.key) {
              <li>
                <span class="area">{{ areaLabel[finding.area] }}</span>
                {{ label(finding) }}: {{ finding.countBefore }}× → {{ finding.count ?? 1 }}×
              </li>
            }
          </ul>
        } @else {
          <p class="muted">{{ diff().remaining.length }} still there with the same count.</p>
        }
      </section>
    </div>
  `,
  styles: `
    @use 'mixins' as m;
    :host {
      display: grid;
      gap: 12px;
    }
    .notice {
      margin: 0;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text-2);
    }
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border);
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
      padding: 6px 10px;
      border-bottom: 1px solid var(--border);
      text-align: left;
      white-space: nowrap;
    }
    thead th {
      @include m.label;
      background: var(--surface);
    }
    tbody th {
      font-weight: 500;
      color: var(--text);
    }
    td {
      color: var(--text-2);
      font-variant-numeric: tabular-nums;
    }
    tbody tr:last-child > * {
      border-bottom: 0;
    }
    .chip {
      display: inline-flex;
      padding: 1px 8px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text-2);
    }
    .chip[data-tone='ok'] {
      border-color: transparent;
      @include m.tint(ok);
    }
    .chip[data-tone='danger'] {
      border-color: transparent;
      @include m.tint(danger);
    }
    .lists {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
    h3 {
      @include m.label;
      margin: 0 0 6px;
    }
    ul {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .area {
      color: var(--text-2);
      font-weight: 600;
    }
    .muted {
      margin: 0;
      color: var(--text-2);
      font-size: 12px;
    }
  `,
})
export class AuditDiffView {
  readonly diff = input.required<AuditDiff>();

  protected readonly areaLabel = AREA_LABEL;

  readonly changed = computed(() =>
    this.diff().remaining.filter(
      (finding) => finding.countBefore !== undefined && finding.countBefore !== finding.count,
    ),
  );

  readonly rows = computed<MetricRow[]>(() => {
    const byKey = new Map(this.diff().metrics.map((change) => [change.metric, change]));
    return METRICS.filter((metric) => byKey.has(metric.key)).map((metric) => {
      const change = byKey.get(metric.key)!;
      const unit = metric.unit ? ` ${metric.unit}` : '';
      const show = (value?: number) => (value === undefined ? 'Not measured' : `${value}${unit}`);
      const delta = change.delta;
      return {
        label: metric.unit === '%' ? `${metric.label} (%)` : metric.label,
        before: show(change.before),
        after: show(change.after),
        change:
          delta === undefined
            ? 'Not compared'
            : delta === 0
              ? 'Same'
              : `${delta > 0 ? '+' : '−'}${Math.abs(delta)}${unit}, ${delta < 0 ? 'better' : 'worse'}`,
        tone: delta === undefined || delta === 0 ? 'plain' : delta < 0 ? 'ok' : 'danger',
      };
    });
  });

  label(finding: AuditFinding): string {
    return `${finding.rule}${finding.subject ? ` in ${finding.subject}` : ''}`;
  }
}
