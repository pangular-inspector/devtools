import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import {
  SHARED_STYLES,
  routerCall,
  type LintFinding,
  type LintResult,
  type RouterPage,
} from './router-types';

@Component({
  selector: 'app-route-lint',
  template: `
    <div class="toolbar">
      <button type="button" class="small" [attr.aria-busy]="checking()" (click)="run()">
        {{ checking() ? 'Checking…' : 'Check again' }}
      </button>
      <span class="muted"
        >Checks the live config, links and recent navigations. Lazy routes that have not loaded are
        skipped.</span
      >
      @if (result()?.checked && findings().length) {
        <span class="summary">
          @if (counts().error) {
            <span class="badge" data-tone="bad">{{ counts().error }} error(s)</span>
          }
          @if (counts().warning) {
            <span class="badge" data-tone="warn">{{ counts().warning }} warning(s)</span>
          }
          @if (counts().info) {
            <span class="badge">{{ counts().info }} info</span>
          }
        </span>
      }
    </div>
    @if (failed()) {
      <div class="empty" role="alert">
        <p class="empty-title">The route checks could not run.</p>
        <p class="muted">The devtools server did not answer. Check that it is still running.</p>
        <button type="button" class="small" (click)="run()">Retry</button>
      </div>
    } @else if (!result()) {
      <p class="muted empty" role="status">Checking…</p>
    } @else if (notChecked(); as reason) {
      <div class="empty">
        <p class="empty-title">No checks ran.</p>
        <p class="muted">
          @switch (reason) {
            @case ('events-only') {
              This page runs in events-only mode: it has no debug utils (a production build or an
              unusual setup), so it cannot report its route config.
            }
            @case ('no-config') {
              The page has not reported its route config yet. It appears after the app finishes
              bootstrapping.
            }
            @default {
              No page with a router is connected.
            }
          }
        </p>
      </div>
    } @else if (findings().length) {
      <ul class="findings" [attr.aria-busy]="checking()">
        @for (finding of findings(); track $index) {
          <li [attr.data-severity]="finding.severity">
            <div class="head">
              <span class="badge" [attr.data-tone]="severityTone(finding.severity)">{{
                finding.severity
              }}</span>
              <code class="rule">{{ finding.rule }}</code>
              <code class="route">{{ finding.route }}</code>
            </div>
            <p class="message">{{ finding.message }}</p>
            <p class="fix">
              <span class="fix-label">Fix</span>
              <span class="fix-text"
                >{{ finding.fix }}
                <span class="muted"
                  >(Angular
                  {{
                    finding.angular === 'throws'
                      ? 'throws'
                      : finding.angular === 'warns'
                        ? 'warns'
                        : 'does not warn'
                  }})</span
                ></span
              >
            </p>
          </li>
        }
      </ul>
    } @else {
      <div class="empty">
        <span class="ok-mark" aria-hidden="true">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <p class="empty-title">No route config problems found.</p>
        <p class="muted">The check runs again after each navigation or config change.</p>
      </div>
    }
  `,
  styles: `
    ${SHARED_STYLES}
    :host {
      display: grid;
      gap: 12px;
      min-width: 0;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: center;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
    }
    .toolbar .muted {
      flex: 1 1 240px;
      font-size: 12px;
    }
    .summary {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 6px;
      font-variant-numeric: tabular-nums;
    }
    .ok-mark {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      margin-bottom: 4px;
      border: 1px solid color-mix(in srgb, var(--ok) 30%, transparent);
      border-radius: 99px;
      background: color-mix(in srgb, var(--ok) 12%, transparent);
      color: var(--ok);
    }
    .findings {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .findings li {
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
      font-size: 13px;
      line-height: 1.5;
      animation: enter 0.35s var(--ease) both;
      transition: border-color 0.15s var(--ease);
    }
    .findings li:hover {
      border-color: var(--border-strong);
    }
    .findings li[data-severity='error'] {
      box-shadow: inset 3px 0 0 var(--danger);
    }
    .findings li[data-severity='warning'] {
      box-shadow: inset 3px 0 0 var(--warn);
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      min-width: 0;
    }
    .rule {
      color: var(--text-strong);
      font-weight: 500;
    }
    .route {
      color: var(--accent);
    }
    .message {
      margin: 8px 0 0;
    }
    .fix {
      display: flex;
      gap: 10px;
      align-items: baseline;
      margin: 10px 0 0;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
    }
    .fix-label {
      flex: none;
      color: var(--accent);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .fix-text {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .fix .muted {
      font-size: 12px;
    }
  `,
})
export class RouteLint {
  page = input.required<RouterPage>();
  rpc = input<DevframeRpcClient | null>(null);

  readonly result = signal<LintResult | null>(null);
  readonly failed = signal(false);
  readonly checking = signal(false);
  readonly findings = computed(() => {
    const result = this.result();
    return result?.checked ? result.findings : [];
  });
  readonly notChecked = computed(() => {
    const result = this.result();
    return result && !result.checked ? result.reason : null;
  });
  readonly counts = computed(() => {
    const counts = { error: 0, warning: 0, info: 0 };
    for (const finding of this.findings()) counts[finding.severity]++;
    return counts;
  });
  private readonly key = computed(() => {
    const page = this.page();
    const last = page.navigations[page.navigations.length - 1];
    return `${page.pageId}:${page.generation}:${last?.id}:${last?.outcome}`;
  });
  private seq = 0;
  private checkedPage: string | null = null;

  constructor() {
    effect(() => {
      this.key();
      untracked(() => void this.run());
    });
  }

  severityTone(severity: LintFinding['severity']) {
    return severity === 'error' ? 'bad' : severity === 'warning' ? 'warn' : '';
  }

  async run() {
    const seq = ++this.seq;
    const pageId = this.page().pageId;
    if (pageId !== this.checkedPage) this.result.set(null);
    this.checking.set(true);
    const result = await routerCall<LintResult>(this.rpc(), 'router-lint', pageId);
    if (seq !== this.seq) return;
    this.checking.set(false);
    this.failed.set(!result);
    if (result) {
      this.result.set(result);
      this.checkedPage = pageId;
    }
  }
}
