import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import type { CdOptions, CdReport } from '@pangular-inspector/devtools/config';
import type { DevframeRpcClient } from 'devframe/client';
import { panelConfig } from '../devtools-config';
import { time } from '../format';
import { rpcCall as call } from '../rpc';
import { LimitNote } from '../ui/limit-note';
import { AngularUnavailable } from '../ui/angular-unavailable';
import { angularPageFor, injectAngularPages } from '../angular-pages';
import { aggregateComponents, cyclesInRange, type CdRange } from './cd-chart-data';
import { CdCycleChart } from './cd-cycle-chart';
import { CdFlameGraph } from './cd-flame-graph';
import { CdTiming } from './cd-timing';
import { CdTransfer, type CdImported } from './cd-transfer';
import { CdTreemap } from './cd-treemap';

export type { CdCheck, CdComponentStat, CdCycle } from '@pangular-inspector/devtools/config';
/** One page's recording, as the page reports it. */
export type CdPage = CdReport;

const SHOWN = 10;
const SHOWN_CYCLES = 30;

/** Record and Stop for change detection, with the slowest components and the latest cycles. */
@Component({
  selector: 'app-cd-recording',
  imports: [
    AngularUnavailable,
    LimitNote,
    CdTiming,
    CdTransfer,
    CdCycleChart,
    CdFlameGraph,
    CdTreemap,
  ],
  template: `
    <section class="cd" aria-labelledby="cd-heading">
      <div class="cd-head">
        <h2 id="cd-heading">Change detection</h2>
        @if (!imported()) {
          <button type="button" [class.on]="recording()" [disabled]="!pageId()" (click)="toggle()">
            <span class="dot" aria-hidden="true"></span>
            {{ recording() ? 'Stop recording' : 'Record' }}
          </button>
          @if (cycles().length) {
            <button type="button" (click)="clear()">Clear</button>
          }
        }
        <app-cd-transfer
          [page]="page()"
          [maxCycles]="maxCycles()"
          (imported)="showImport($event)"
        />
        <p class="status">{{ status() }}</p>
        <p class="sr-only" role="status">{{ announcement() }}</p>
      </div>
      @if (imported(); as file) {
        <p class="imported">
          <span class="badge">Imported recording</span>
          <span class="mono">{{ file.fileName }}</span>
          <button type="button" (click)="closeImport()">Back to live recording</button>
        </p>
      }
      <p class="hint">
        Records each change detection cycle with Angular's profiler: how long it took, how many
        components it checked and the output that ran before it. Tree rows show how often each
        instance was checked. Times come from a development build.
      </p>
      @if (page()?.supported === false) {
        <app-angular-unavailable [page]="angularPage()" capability="profiler" missing compact />
      }
      @if (!imported()) {
        <div class="views" role="group" aria-labelledby="cd-views-label">
          <span id="cd-views-label" class="views-label">Live views</span>
          <button
            type="button"
            class="view"
            [attr.aria-pressed]="views().flash"
            [disabled]="!canShowViews()"
            (click)="setView('flash', !views().flash)"
          >
            <span class="dot" aria-hidden="true"></span>
            Flash checks
          </button>
          <button
            type="button"
            class="view"
            [attr.aria-pressed]="views().track"
            [disabled]="!canShowViews()"
            (click)="setView('track', !views().track)"
          >
            <span class="dot" aria-hidden="true"></span>
            Performance track
          </button>
          <button
            type="button"
            class="view"
            [attr.aria-pressed]="views().angularProfiling"
            [disabled]="
              !canShowViews() || views().angularProfiling || !views().angularProfilingAvailable
            "
            (click)="setView('angularProfiling', true)"
          >
            <span class="dot" aria-hidden="true"></span>
            Angular profiling
          </button>
        </div>
        <p class="hint">
          Flash checks draws a box over each component on the page as Angular checks it, with its
          name and how often it was checked, fading over a second. Performance track adds a Pangular
          track to the Chrome Performance panel with every component check, hook and output. Angular
          profiling turns on Angular's own track there.
        </p>
        @if (views().angularProfiling) {
          <p class="note">Angular profiling stays on until the page reloads.</p>
        } @else if (!views().angularProfilingAvailable) {
          <app-angular-unavailable
            [page]="angularPage()"
            capability="angularProfiling"
            missing
            compact
          />
        }
      }
      <app-limit-note
        [dropped]="page()?.dropped ?? 0"
        [max]="maxCycles()"
        what="cycles"
        limit="cdCycles"
      />
      @for (note of capNotes(); track note) {
        <p class="note">{{ note }}</p>
      }
      @if (cycles().length) {
        <h3>Cycles</h3>
        <app-cd-cycle-chart [cycles]="cycles()" [(range)]="range" />
        <app-cd-flame-graph
          [cycles]="picked()"
          [names]="spanNames()"
          [scope]="scope()"
          (pick)="showComponent.emit($event)"
        />
        @if (!hasSpans()) {
          <p class="spans-note">
            {{
              range()
                ? 'The picked cycles have no timed spans, so there is no flame graph for them.'
                : 'This recording has no timed spans, so there is no flame graph. A recording from an older version, or a file saved without spans, has none.'
            }}
          </p>
        }
        <h3>Self time by component</h3>
        @if (range()) {
          <p class="note">
            For picked cycles, totals come from the 10 slowest components each cycle lists.
          </p>
        }
        <app-cd-treemap [stats]="stats()" [scope]="scope()" (pick)="showComponent.emit($event)" />
      }
      @if (page()?.components?.length) {
        <div class="cd-grid">
          <div>
            <h3>
              {{ range() ? 'Slowest components in the picked cycles' : 'Slowest components' }}
            </h3>
            <table>
              <thead>
                <tr>
                  <th scope="col">Component</th>
                  <th scope="col" class="num">Checks</th>
                  <th scope="col" class="num">Self time</th>
                  <th scope="col" class="num">Slowest</th>
                </tr>
              </thead>
              <tbody>
                @for (c of slowest(); track $index) {
                  <tr>
                    <td class="mono">{{ c.name }}</td>
                    <td class="num">{{ c.checks }}</td>
                    <td class="num">{{ ms(c.ms) }}</td>
                    <td class="num">{{ ms(c.maxMs) }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4">No component time in the picked cycles.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div>
            <h3>Latest cycles</h3>
            <ol class="cycles" aria-label="Latest change detection cycles, newest first">
              @for (cycle of latest(); track cycle.id) {
                <li>
                  <span class="when">{{ clock(cycle.at) }}</span>
                  <span class="mono">{{ ms(cycle.ms) }}</span>
                  <span>
                    {{ cycle.checks }} {{ cycle.checks === 1 ? 'check' : 'checks' }},
                    {{ cycle.passes }}
                    {{ cycle.passes === 1 ? 'pass' : 'passes' }}
                  </span>
                  @if (cycle.trigger) {
                    <span class="trigger"
                      >after <span class="mono">{{ cycle.trigger }}</span></span
                    >
                  }
                  @if (cycle.hookMs) {
                    <span class="timing">hooks {{ ms(cycle.hookMs) }}</span>
                  }
                  @if (cycle.afterRenderMs) {
                    <span class="timing">afterRender {{ ms(cycle.afterRenderMs) }}</span>
                  }
                  @if (cycle.components[0]; as top) {
                    <span class="top">
                      slowest <span class="mono">{{ top.name }}</span> {{ ms(top.ms) }}
                    </span>
                  }
                </li>
              }
            </ol>
          </div>
        </div>
        <app-cd-timing [page]="page()" />
      } @else if (recording()) {
        <p class="empty">Use the app. Cycles show up here as Angular runs change detection.</p>
      }
    </section>
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      margin-top: 16px;
    }
    .cd {
      @include m.panel;
      padding: 12px 14px;
    }
    .cd-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    h2 {
      margin: 0;
      font-size: 14px;
      color: var(--text-strong);
    }
    h3 {
      @include m.label;
      margin: 12px 0 6px;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: var(--control-h);
      padding: 0 12px;
      background: var(--surface-2);
      border: 1px solid var(--border-strong);
      border-radius: var(--radius-sm);
      color: var(--text);
      cursor: pointer;
      font: inherit;
      font-size: 13px;
    }
    button:hover:not(:disabled) {
      background: var(--surface-3);
      border-color: var(--accent-line);
    }
    button:focus-visible {
      @include m.focus-ring;
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    .views {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .views-label {
      @include m.label;
    }
    button.view[aria-pressed='true'] {
      border-color: var(--accent-line);
    }
    button.view[aria-pressed='true'] .dot {
      background: var(--accent);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-3);
    }
    button.on .dot {
      background: var(--danger);
    }
    .status {
      margin: 0;
      color: var(--text-2);
      font-size: 12px;
    }
    .hint,
    .note,
    .spans-note,
    .empty {
      margin: 8px 0;
      color: var(--text-2);
      line-height: 1.5;
    }
    .cd-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0 16px;
    }
    @media (min-width: 880px) {
      .cd-grid {
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
    .cycles {
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 12px;
    }
    .cycles li {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 10px;
      padding: 4px 0;
      border-bottom: 1px solid var(--border);
      color: var(--text);
    }
    .when,
    .trigger,
    .timing,
    .top {
      color: var(--text-2);
    }
    .imported {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin: 8px 0;
      color: var(--text-2);
    }
    .badge {
      @include m.tint(accent);
      padding: 2px 8px;
      border: 1px solid;
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 600;
    }
    .trigger .mono,
    .top .mono {
      overflow-wrap: anywhere;
    }
  `,
})
export class CdRecording {
  /** The page's own recording. */
  readonly livePage = input<CdPage | null>(null, { alias: 'page' });
  readonly pageId = input<string | null>(null);
  readonly rpc = input<DevframeRpcClient | null>(null);
  private readonly angularPages = injectAngularPages(() => this.rpc());
  /** This page's Angular version, for the unavailable notes. */
  readonly angularPage = computed(() => angularPageFor(this.angularPages(), this.pageId()));
  /** A component class picked in the treemap, to show in the component tree. */
  readonly showComponent = output<string>();
  /** The cycles picked in the chart by id, or null for all of them. */
  readonly range = signal<CdRange | null>(null);

  /** A recording loaded from a file; while set, the section shows it instead of the page's. */
  protected readonly imported = signal<CdImported | null>(null);
  /** The recording on screen: an imported one, else the page's. */
  readonly page = computed(() => this.imported()?.page ?? this.livePage());

  /** The views the page has on, set ahead of the page's next report when a toggle is used. */
  readonly views = linkedSignal<CdOptions>(
    () =>
      this.livePage()?.options ?? {
        flash: false,
        track: false,
        angularProfiling: false,
        angularProfilingAvailable: true,
      },
  );
  readonly canShowViews = computed(() => !!this.pageId() && this.livePage()?.supported !== false);

  protected readonly message = signal('');
  /**
   * What a screen reader hears. It changes only when Record, Stop or Clear finishes or fails.
   * The visible status also counts cycles as they arrive, which would make a screen reader talk
   * many times a second while the app is used, so it sits outside any live region.
   */
  protected readonly announcement = signal('');
  readonly recording = computed(() => this.page()?.recording === true);
  readonly cycles = computed(() => this.page()?.cycles ?? []);
  readonly maxCycles = computed(() => panelConfig(this.rpc()).limits.cdCycles);
  /** The cycles the picked range covers, or every cycle. */
  readonly picked = computed(() => cyclesInRange(this.cycles(), this.range()));
  /** Whether any picked cycle has timed spans for the flame graph. */
  readonly hasSpans = computed(() => this.picked().some((cycle) => cycle.spans?.length));
  /** The names the cycles' spans point to. */
  readonly spanNames = computed(() => this.page()?.spanNames ?? []);

  /** Component totals for the picked cycles, or the recording's own totals for all of them. */
  readonly stats = computed(() =>
    this.range()
      ? aggregateComponents(this.picked())
      : [...(this.page()?.components ?? [])].sort((a, b) => b.ms - a.ms),
  );
  readonly scope = computed(() => {
    const picked = this.range() ? this.picked() : [];
    if (!picked.length) return 'the recording';
    return picked.length === 1
      ? `cycle ${picked[0].id}`
      : `cycles ${picked[0].id} to ${picked.at(-1)!.id}`;
  });
  readonly slowest = computed(() => this.stats().slice(0, SHOWN));
  readonly latest = computed(() => this.cycles().slice(-SHOWN_CYCLES).reverse());
  /** Says when the recording checked more classes or instances than it keeps. */
  readonly capNotes = computed(() => {
    const classes = this.page()?.droppedClasses ?? 0;
    const hosts = this.page()?.droppedHosts ?? 0;
    const notes: string[] = [];
    if (classes > 0) {
      notes.push(
        `${classes} more component ${classes === 1 ? 'class was' : 'classes were'} checked than a recording keeps, so ${classes === 1 ? 'it is' : 'they are'} left out of these totals.`,
      );
    }
    if (hosts > 0) {
      notes.push(
        `${hosts} component ${hosts === 1 ? 'instance was' : 'instances were'} checked past the 2000 a recording counts, so ${hosts === 1 ? 'its tree row shows' : 'their tree rows show'} no check count.`,
      );
    }
    return notes;
  });
  readonly status = computed(() => {
    if (this.message()) return this.message();
    const count = this.cycles().length;
    if (this.imported()) return `${count} ${count === 1 ? 'cycle' : 'cycles'} imported.`;
    if (this.recording()) return `Recording. ${count} ${count === 1 ? 'cycle' : 'cycles'} so far.`;
    return count ? `${count} ${count === 1 ? 'cycle' : 'cycles'} recorded.` : '';
  });

  protected ms(value: number): string {
    return `${value < 10 ? value.toFixed(2) : Math.round(value)} ms`;
  }

  protected clock(at: number): string {
    return time(at);
  }

  async toggle() {
    if (this.recording()) {
      await this.send({ on: false }, '', () => {
        const count = this.cycles().length;
        return `Recording stopped. ${count} ${count === 1 ? 'cycle' : 'cycles'} recorded.`;
      });
    } else {
      await this.send({ on: true }, 'Starting…', () => 'Recording started.');
    }
  }

  showImport(file: CdImported) {
    this.message.set('');
    this.range.set(null);
    this.imported.set(file);
    const count = file.page.cycles.length;
    this.announce(
      `Imported ${file.fileName}: ${count} ${count === 1 ? 'cycle' : 'cycles'}. Showing the imported recording.`,
    );
  }

  closeImport() {
    this.imported.set(null);
    this.range.set(null);
    this.announce('Showing the live recording.');
  }

  async clear() {
    this.range.set(null);
    await this.send({ clear: true }, '', () => 'Cleared the recorded cycles.');
  }

  /** Turns a live view on or off on the page. Angular profiling only turns on. */
  async setView(view: 'flash' | 'track' | 'angularProfiling', on: boolean) {
    const before = this.views();
    this.views.set({ ...before, [view]: on });
    const done = {
      flash: on ? 'Flash checks on.' : 'Flash checks off.',
      track: on
        ? 'Performance track on. Record in the Chrome Performance panel to see it.'
        : 'Performance track off.',
      angularProfiling: 'Angular profiling on. It stays on until the page reloads.',
    }[view];
    const sent = await this.send(
      { [view]: on },
      '',
      () => done,
      'request-change-detection-options',
    );
    if (!sent) this.views.set(before);
  }

  private async send(
    request: { on?: boolean; clear?: boolean; flash?: boolean; track?: boolean },
    pending: string,
    done: () => string,
    rpc = 'request-change-detection-record',
  ): Promise<boolean> {
    this.message.set(pending);
    try {
      if (!this.rpc()) throw new Error('no client');
      await call(this.rpc(), rpc, {
        pageId: this.pageId(),
        ...request,
      });
      this.message.set('');
      this.announce(done());
      return true;
    } catch {
      const failed = 'Could not reach the page.';
      this.message.set(failed);
      this.announce(failed);
      return false;
    }
  }

  /** Sets the live message, changing it slightly when it repeats so screen readers say it again. */
  private announce(message: string) {
    this.announcement.update((current) => (current === message ? `${message} ` : message));
  }
}
