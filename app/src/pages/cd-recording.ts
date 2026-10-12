import { Component, computed, input, signal } from '@angular/core';
import type { CdReport } from '@pangular-inspector/devtools/config';
import type { DevframeRpcClient } from 'devframe/client';
import { panelConfig } from '../devtools-config';
import { time } from '../format';
import { rpcCall as call } from '../rpc';
import { LimitNote } from '../ui/limit-note';

export type { CdCheck, CdComponentStat, CdCycle } from '@pangular-inspector/devtools/config';
/** One page's recording, as the page reports it. */
export type CdPage = CdReport;

const SHOWN = 10;
const SHOWN_CYCLES = 30;

/** Record and Stop for change detection, with the slowest components and the latest cycles. */
@Component({
  selector: 'app-cd-recording',
  imports: [LimitNote],
  template: `
    <section class="cd" aria-labelledby="cd-heading">
      <div class="cd-head">
        <h2 id="cd-heading">Change detection</h2>
        <button type="button" [class.on]="recording()" [disabled]="!pageId()" (click)="toggle()">
          <span class="dot" aria-hidden="true"></span>
          {{ recording() ? 'Stop recording' : 'Record' }}
        </button>
        @if (cycles().length) {
          <button type="button" (click)="clear()">Clear</button>
        }
        <p class="status">{{ status() }}</p>
        <p class="sr-only" role="status">{{ announcement() }}</p>
      </div>
      <p class="hint">
        Records each change detection cycle with Angular's profiler: how long it took, how many
        components it checked and the output that ran before it. Tree rows show how often each
        instance was checked. Times come from a development build.
      </p>
      @if (page()?.supported === false) {
        <p class="note">This page can't record change detection. It needs Angular 20 or later.</p>
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
      @if (slowest().length) {
        <div class="cd-grid">
          <div>
            <h3>Slowest components</h3>
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
    .top {
      color: var(--text-2);
    }
    .trigger .mono,
    .top .mono {
      overflow-wrap: anywhere;
    }
  `,
})
export class CdRecording {
  readonly page = input<CdPage | null>(null);
  readonly pageId = input<string | null>(null);
  readonly rpc = input<DevframeRpcClient | null>(null);

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
  readonly slowest = computed(() =>
    [...(this.page()?.components ?? [])].sort((a, b) => b.ms - a.ms).slice(0, SHOWN),
  );
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

  async clear() {
    await this.send({ clear: true }, '', () => 'Cleared the recorded cycles.');
  }

  private async send(
    request: { on?: boolean; clear?: boolean },
    pending: string,
    done: () => string,
  ) {
    this.message.set(pending);
    try {
      if (!this.rpc()) throw new Error('no client');
      await call(this.rpc(), 'request-change-detection-record', {
        pageId: this.pageId(),
        ...request,
      });
      this.message.set('');
      this.announce(done());
    } catch {
      const failed = 'Could not reach the page.';
      this.message.set(failed);
      this.announce(failed);
    }
  }

  /** Sets the live message, changing it slightly when it repeats so screen readers say it again. */
  private announce(message: string) {
    this.announcement.update((current) => (current === message ? `${message} ` : message));
  }
}
