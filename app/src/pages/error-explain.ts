import { Component, computed, input, signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { time } from '../format';
import {
  codeSegments,
  type ErrorExplain,
  type ErrorOwner,
  type InjectionExplanation,
  type InjectionStep,
} from './errors-types';

const STEP_LABEL: Record<InjectionStep['status'], string> = {
  provides: 'Provides it',
  missing: 'Not provided',
  hidden: 'Hidden',
  skipped: 'Skipped',
  'not-asked': 'Not asked',
  unknown: 'Unknown',
};

const STEP_TONE: Record<InjectionStep['status'], string> = {
  provides: 'ok',
  missing: 'plain',
  hidden: 'warn',
  skipped: 'plain',
  'not-asked': 'plain',
  unknown: 'warn',
};

/**
 * The explainer under an error in the Errors tab: what changed for an NG0100,
 * the server vs client DOM diff of a hydration mismatch, and the token of a
 * missing provider with an Explain lookup button that walks its injectors.
 */
@Component({
  selector: 'app-error-explain',
  template: `
    @switch (explain().kind) {
      @case ('expression-changed') {
        @if (changed(); as e) {
          <h3 class="label">What changed</h3>
          <dl class="facts">
            <dt>Binding</dt>
            <dd>
              @if (e.binding) {
                <code>{{ e.binding }}</code>
              } @else {
                <span class="muted">A text interpolation (Angular doesn't name it)</span>
              }
              @if (e.template) {
                <span class="muted"> in </span><code>{{ e.template }}</code>
              }
            </dd>
            <dt>Previous</dt>
            <dd>
              <code class="value">{{ e.previous }}</code>
            </dd>
            <dt>Current</dt>
            <dd>
              <code class="value">{{ e.current }}</code>
            </dd>
            @if (e.members?.length) {
              <dt>Held by</dt>
              <dd>
                @for (member of e.members; track member; let last = $last) {
                  <code>{{ member }}</code
                  >{{ last ? '' : ', ' }}
                }
              </dd>
            }
          </dl>
          @if (e.masked) {
            <p class="note">
              Values are hidden: the binding or a field that holds them has a secret-looking name.
            </p>
          }
          @if (e.creation) {
            <p class="note">
              Angular says this view was created after its parent was checked, so a change detection
              hook such as <code>ngAfterViewInit</code> created it.
            </p>
          }
          @if (e.writes?.length) {
            <h4 class="label">Written by</h4>
            <ul class="writes">
              @for (write of e.writes; track write.signal + write.at) {
                <li>
                  Signal <code>{{ write.signal }}</code> at {{ time(write.at) }}
                  @if (write.stack?.length) {
                    <ol class="frames" aria-label="App frames that wrote it">
                      @for (frame of write.stack; track $index) {
                        <li>
                          <code>{{ frame }}</code>
                        </li>
                      }
                    </ol>
                  } @else {
                    <span class="muted">
                      (turn on write stacks in the Signals tab and reproduce to see the code)</span
                    >
                  }
                </li>
              }
            </ul>
          } @else if (e.writesKnown) {
            <p class="note">
              No named signal was written with this value just before the check. Look for code that
              sets a field the template reads during change detection, such as
              <code>ngAfterViewInit</code>, a getter that returns a new value each time, or a child
              that changes its parent.
            </p>
          } @else {
            <p class="note">
              Where it was written is unknown: the page doesn't report signal writes (the Signals
              inspector is off, or Angular is older than 17).
            </p>
          }
        }
      }
      @case ('hydration-mismatch') {
        @if (mismatch(); as m) {
          <h3 class="label">Server vs client DOM</h3>
          @if (m.summary) {
            <p class="summary">{{ m.summary }}</p>
          }
          @if (m.diff?.length) {
            <p class="legend">
              <span class="sign expected" aria-hidden="true">−</span> server HTML Angular expected
              <span class="sign actual" aria-hidden="true">+</span> client DOM it found
            </p>
            <div
              class="diff-wrap"
              tabindex="0"
              role="region"
              aria-label="Server vs client DOM diff"
            >
              <ol class="diff">
                @for (line of m.diff; track $index) {
                  <li [attr.data-op]="line.op">
                    <span class="sign" aria-hidden="true">{{ signOf(line.op) }}</span>
                    @if (line.op !== 'same') {
                      <span class="sr-only">{{
                        line.op === 'expected' ? 'Server only:' : 'Client only:'
                      }}</span>
                    }
                    <code>{{ line.text }}</code>
                  </li>
                }
              </ol>
            </div>
          } @else {
            <p class="note">Angular described neither side of the mismatch.</p>
          }
          @if (m.external) {
            <p class="note">
              Angular thinks a browser extension or third-party script changed the DOM before
              hydration. Try a clean browser profile, or add <code>ngSkipHydration</code> to the
              host.
            </p>
          }
        }
      }
      @case ('missing-provider') {
        @if (missing(); as p) {
          <h3 class="label">Missing provider</h3>
          <dl class="facts">
            <dt>Token</dt>
            <dd>
              <code>{{ p.token }}</code>
            </dd>
            @if (p.path?.length) {
              <dt>Path</dt>
              <dd>
                @for (name of p.path; track $index; let last = $last) {
                  <code>{{ name }}</code
                  >{{ last ? '' : ' → ' }}
                }
              </dd>
            }
            @if (p.source) {
              <dt>Source</dt>
              <dd>
                <code>{{ p.source }}</code>
              </dd>
            }
          </dl>
          @if (canExplain() && owner()) {
            <button
              type="button"
              class="small"
              [attr.aria-disabled]="loading() || null"
              (click)="explainLookup(p.token)"
            >
              {{ lookup() ? 'Explain lookup again' : 'Explain lookup' }}
            </button>
          } @else if (!owner()) {
            <p class="note">
              The component that asked for it wasn't found on the page, so the lookup can't be
              walked from here.
            </p>
          }
          <div aria-live="polite">
            @if (loading()) {
              <p class="note">Walking the lookup…</p>
            } @else if (lookupError(); as error) {
              <p class="note" role="alert">
                @for (part of segments(error); track $index) {
                  @if (part.code) {
                    <code>{{ part.text }}</code>
                  } @else {
                    <span>{{ part.text }}</span>
                  }
                }
              </p>
            } @else if (lookup(); as l) {
              <p class="summary">
                @for (part of segments(l.summary); track $index) {
                  @if (part.code) {
                    <code>{{ part.text }}</code>
                  } @else {
                    <span>{{ part.text }}</span>
                  }
                }
              </p>
            }
          </div>
          @if (!loading() && !lookupError() && lookup(); as l) {
            <ol class="steps" aria-label="Injectors Angular asks, in order">
              @for (step of l.steps; track step.id + $index) {
                <li>
                  <span class="step-name">
                    <code>{{ step.name }}</code>
                    @if (step.component) {
                      <code class="muted">{{ step.component }}</code>
                    }
                  </span>
                  <span class="chip" [attr.data-tone]="stepTone[step.status]">{{
                    stepLabel[step.status]
                  }}</span>
                  <span class="reason">
                    @for (part of segments(step.reason); track $index) {
                      @if (part.code) {
                        <code>{{ part.text }}</code>
                      } @else {
                        <span>{{ part.text }}</span>
                      }
                    }
                  </span>
                </li>
              }
            </ol>
            <p class="note">
              Read from the injector tree the page reported, assuming no <code>self</code>,
              <code>skipSelf</code>, <code>host</code> or <code>optional</code>. Agents can pass
              those to <code>explain-injection</code>.
              @if (l.approximate) {
                This Angular version has no resolution path, so the path follows the rendered tree.
              }
            </p>
          }
        }
      }
    }
  `,
  styles: `
    @use 'mixins' as m;
    :host {
      display: grid;
      gap: 6px;
      min-width: 0;
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--bg);
      font-size: 12px;
    }
    .label {
      @include m.label;
      margin: 0;
    }
    code {
      font-family: var(--font-mono);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .muted {
      color: var(--text-2);
    }
    .facts {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 4px 12px;
      margin: 0;
    }
    dt {
      color: var(--text-2);
    }
    dd {
      min-width: 0;
      margin: 0;
    }
    .value {
      white-space: pre-wrap;
    }
    .note,
    .summary,
    .legend {
      margin: 0;
      color: var(--text-2);
      line-height: 1.5;
    }
    .summary {
      color: var(--text);
    }
    .writes,
    .frames {
      margin: 0;
      padding-left: 18px;
    }
    .diff-wrap {
      max-height: 280px;
      overflow: auto;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
    }
    .diff-wrap:focus-visible {
      @include m.focus-ring(-2px);
    }
    .diff {
      min-width: max-content;
      margin: 0;
      padding: 4px 0;
      list-style: none;
    }
    .diff li {
      display: flex;
      gap: 8px;
      padding: 0 8px;
      white-space: pre;
    }
    .diff code {
      overflow-wrap: normal;
    }
    .diff li[data-op='expected'] {
      @include m.tint(danger);
    }
    .diff li[data-op='actual'] {
      @include m.tint(ok);
    }
    .sign {
      flex-shrink: 0;
      width: 1ch;
      font-family: var(--font-mono);
      font-weight: 700;
    }
    .legend .sign {
      display: inline-block;
      text-align: center;
    }
    .legend .sign.expected {
      color: var(--danger-text);
    }
    .legend .sign.actual {
      color: var(--ok-text);
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
    .small:hover {
      background: var(--surface-3);
    }
    .small[aria-disabled='true'] {
      cursor: progress;
    }
    .small:focus-visible {
      @include m.focus-ring;
    }
    .steps {
      display: grid;
      gap: 4px;
      margin: 0;
      padding-left: 22px;
    }
    .steps li {
      padding: 2px 0;
    }
    .step-name {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-right: 6px;
    }
    .reason {
      display: block;
      color: var(--text-2);
      line-height: 1.5;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      padding: 0 8px;
      border: 1px solid transparent;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 600;
    }
    .chip[data-tone='ok'] {
      @include m.tint(ok);
    }
    .chip[data-tone='warn'] {
      @include m.tint(warn);
    }
    .chip[data-tone='plain'] {
      border-color: var(--border);
      background: var(--surface-2);
      color: var(--text-2);
    }
  `,
})
export class ErrorExplainView {
  readonly explain = input.required<ErrorExplain>();
  readonly owner = input<ErrorOwner | undefined>(undefined);
  readonly pageId = input<string>('');
  readonly rpc = input<DevframeRpcClient | null>(null);
  /** Whether the Injectors inspector is on, so the lookup can be walked. */
  readonly canExplain = input(false);

  protected readonly time = time;
  protected readonly segments = codeSegments;
  protected readonly stepLabel = STEP_LABEL;
  protected readonly stepTone = STEP_TONE;

  protected readonly changed = computed(() => {
    const e = this.explain();
    return e.kind === 'expression-changed' ? e : null;
  });
  protected readonly mismatch = computed(() => {
    const e = this.explain();
    return e.kind === 'hydration-mismatch' ? e : null;
  });
  protected readonly missing = computed(() => {
    const e = this.explain();
    return e.kind === 'missing-provider' ? e : null;
  });

  readonly loading = signal(false);
  readonly lookup = signal<InjectionExplanation | null>(null);
  readonly lookupError = signal<string | null>(null);

  signOf(op: 'same' | 'expected' | 'actual'): string {
    return op === 'expected' ? '−' : op === 'actual' ? '+' : ' ';
  }

  async explainLookup(token: string) {
    const client = this.rpc();
    const owner = this.owner();
    if (!client || !owner || this.loading()) return;
    this.loading.set(true);
    this.lookupError.set(null);
    try {
      const answer = (await client.scope('pangular').rpc.call('explain-injection', {
        selector: owner.id,
        token,
        pageId: this.pageId(),
      } as never)) as InjectionExplanation | { error: string } | null;
      if (!answer || 'error' in answer) {
        this.lookup.set(null);
        this.lookupError.set(answer?.error ?? "The server didn't answer.");
      } else {
        this.lookup.set(answer);
      }
    } catch {
      this.lookup.set(null);
      this.lookupError.set("Can't reach the devtools server. Try again.");
    } finally {
      this.loading.set(false);
    }
  }
}
