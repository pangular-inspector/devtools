import { Component, computed, input } from '@angular/core';
import { CD_CAUSE_KINDS, CD_CAUSE_LABEL, cdHints } from '@pangular-inspector/devtools/cd-data';
import type { CdReport } from '@pangular-inspector/devtools/config';

const SHOWN = 10;

/** What started a recording's cycles, zone.js dependents, wasted checks, inputs that break OnPush and hints. */
@Component({
  selector: 'app-cd-diagnosis',
  template: `
    @if (diagnosis(); as d) {
      <section class="diagnosis" aria-labelledby="cd-diagnosis-heading">
        <h3 id="cd-diagnosis-heading">Why it ran and what it wasted</h3>
        <div class="grid">
          <div>
            <h4>What started the cycles</h4>
            @if (!d.triggers) {
              <p class="note">
                The page has no Angular change detection scheduler the overlay could find (it needs
                Angular 18 or later), so cycles have no cause.
              </p>
            } @else if (causes().length) {
              <table>
                <thead>
                  <tr>
                    <th scope="col">Trigger</th>
                    <th scope="col" class="num">Cycles</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of causes(); track row.kind) {
                    <tr>
                      <td>{{ row.label }}</td>
                      <td class="num">{{ row.count }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="note">No cycle has a cause yet.</p>
            }
          </div>
          @if (hasZone()) {
            <div>
              <h4>Depends on zone.js</h4>
              @if (zone().length) {
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Component</th>
                      <th scope="col" class="num">Zone-only ticks</th>
                      <th scope="col">After</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (z of zone(); track z.name) {
                      <tr>
                        <td class="mono">{{ z.name }}</td>
                        <td class="num">{{ z.ticks }}</td>
                        <td class="mono">{{ z.tasks?.join(', ') }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              } @else if (d.triggers) {
                <p class="note">{{ zoneNote() }}</p>
              }
            </div>
          }
        </div>
        <h4>Wasted checks</h4>
        @if (!d.waste) {
          <p class="note">The page can't watch DOM updates, so wasted checks are not counted.</p>
        } @else if (wasted().length) {
          <table>
            <thead>
              <tr>
                <th scope="col">Component</th>
                <th scope="col" class="num">Refreshed</th>
                <th scope="col" class="num">Changed nothing</th>
                <th scope="col">Strategy</th>
              </tr>
            </thead>
            <tbody>
              @for (c of wasted(); track c.name) {
                <tr>
                  <td class="mono">{{ c.name }}</td>
                  <td class="num">{{ c.refreshed }}</td>
                  <td class="num">{{ c.unchanged }} ({{ share(c.unchanged, c.refreshed) }})</td>
                  <td>{{ c.strategy ?? 'Unknown' }}</td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <p class="note">Every refreshed check changed something.</p>
        }
        @if (inputs().length) {
          <h4>Inputs that break OnPush</h4>
          <table>
            <thead>
              <tr>
                <th scope="col">Input</th>
                <th scope="col">Set by</th>
                <th scope="col" class="num">Changed in place</th>
                <th scope="col" class="num">Same contents, new reference</th>
              </tr>
            </thead>
            <tbody>
              @for (i of inputs(); track i.name + '.' + i.input) {
                <tr>
                  <td class="mono">{{ i.name }}.{{ i.input }}</td>
                  <td class="mono">{{ i.parent ?? 'Unknown' }}</td>
                  <td class="num">{{ i.inPlace }}</td>
                  <td class="num">{{ i.sameContents }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
        @if (hints().length) {
          <h4>Hints</h4>
          <ul class="hints">
            @for (hint of hints(); track $index) {
              <li>{{ hint.text }}</li>
            }
          </ul>
        }
      </section>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
    }
    h3 {
      @include m.label;
      margin: 16px 0 6px;
    }
    h4 {
      margin: 12px 0 6px;
      color: var(--text-2);
      font-size: 12px;
      font-weight: 600;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0 16px;
    }
    @media (min-width: 880px) {
      .grid {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
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
    .note {
      margin: 4px 0 8px;
      color: var(--text-2);
      font-size: 12px;
      line-height: 1.5;
    }
    .hints {
      margin: 0;
      padding-left: 18px;
      color: var(--text);
      font-size: 12px;
      line-height: 1.5;
    }
    .hints li + li {
      margin-top: 4px;
    }
  `,
})
export class CdDiagnosis {
  readonly page = input<CdReport | null>(null);

  readonly diagnosis = computed(() => this.page()?.diagnosis ?? null);
  readonly causes = computed(() => {
    const counts = this.diagnosis()?.causes ?? {};
    return CD_CAUSE_KINDS.filter((kind) => counts[kind]).map((kind) => ({
      kind,
      label: CD_CAUSE_LABEL[kind],
      count: counts[kind]!,
    }));
  });
  readonly zone = computed(() => (this.diagnosis()?.zone ?? []).slice(0, SHOWN));
  private readonly zoneTicks = computed(() => this.diagnosis()?.causes.zone ?? 0);
  /**
   * Shown when the page loads zone.js. Recordings made before `zoneJs` was
   * reported fall back to whether zone.js started a tick or a component
   * depends on it.
   */
  readonly hasZone = computed(() => {
    const zoneJs = this.diagnosis()?.zoneJs;
    return zoneJs ?? (this.zone().length > 0 || this.zoneTicks() > 0);
  });
  readonly zoneNote = computed(() => {
    const ticks = this.zoneTicks();
    if (!ticks) return 'No component changed in a tick only zone.js started.';
    return `${ticks} ${ticks === 1 ? 'tick' : 'ticks'} came from zone.js alone, and no component changed in them.`;
  });
  readonly wasted = computed(() =>
    (this.diagnosis()?.components ?? []).filter((c) => c.unchanged > 0).slice(0, SHOWN),
  );
  readonly inputs = computed(() => (this.diagnosis()?.inputs ?? []).slice(0, SHOWN));
  readonly hints = computed(() => cdHints(this.diagnosis() ?? undefined).slice(0, SHOWN));

  protected share(part: number, whole: number): string {
    return whole ? `${Math.round((part / whole) * 100)}%` : '0%';
  }
}
