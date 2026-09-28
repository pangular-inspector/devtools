import { Component, computed, input, signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { time } from '../format';
import {
  SHARED_STYLES,
  routerAction,
  routerCall,
  tone,
  type NavigationRecord,
  type RouterPage,
} from './router-types';

const PHASES = ['recognize', 'guards', 'resolve', 'activate'] as const;
const PHASE_COLORS: Record<string, string> = {
  recognize: '#60a5fa',
  guards: '#f59e0b',
  resolve: '#2dd4bf',
  activate: '#34d399',
};

@Component({
  selector: 'app-route-timeline',
  template: `
    <div class="toolbar">
      <input
        #filterInput
        class="field"
        type="text"
        aria-label="Filter navigations by URL"
        placeholder="Filter by URL"
        [value]="filter()"
        (input)="filter.set($any($event.target).value)"
      />
      <label class="check">
        <input
          type="checkbox"
          [checked]="onlyProblems()"
          (change)="onlyProblems.set($any($event.target).checked)"
        />
        Only problems
      </label>
      <label class="check">
        <input
          type="checkbox"
          [checked]="page().instrumented"
          (change)="toggleInstrument($event)"
        />
        Record each guard and resolver
      </label>
      <button type="button" class="small export" (click)="exportJson()">Export JSON</button>
    </div>
    @if (message()) {
      <p class="message" role="status">{{ message() }}</p>
    }
    @if (items().length) {
      <div class="meta-row">
        <span class="muted count"
          >{{ items().length }} of {{ page().navigations.length }} navigation(s)</span
        >
        <div class="legend" aria-hidden="true">
          @for (phase of phases; track phase) {
            <span><i [style.background]="color(phase)"></i>{{ phase }}</span>
          }
        </div>
      </div>
      <ol class="navs">
        @for (nav of items(); track nav.id) {
          <li>
            <div class="head">
              @if (!nav.beforeConnect) {
                <time>{{ time(nav.startedAt) }}</time>
              }
              <span class="id">#{{ nav.id }}</span>
              <code class="url">{{ nav.url }}</code>
              @if (nav.finalUrl && nav.finalUrl !== nav.url) {
                <span class="arrow" aria-hidden="true">→</span>
                <span class="visually-hidden">redirected to</span>
                <code class="url">{{ nav.finalUrl }}</code>
              }
              <span class="meta">
                <span class="badge" [attr.data-tone]="tone(nav.outcome)">{{ nav.outcome }}</span>
                @if (nav.beforeConnect) {
                  <span class="muted">{{
                    nav.endedAt === undefined && nav.outcome !== 'pending'
                      ? 'before DevTools connected'
                      : 'started before DevTools connected'
                  }}</span>
                } @else if (nav.phases?.['total'] !== undefined) {
                  <span class="muted ms">{{ nav.phases?.['total'] }}ms</span>
                } @else if (nav.endedAt !== undefined) {
                  <span class="muted ms">{{ nav.endedAt - nav.startedAt }}ms</span>
                }
                @if (nav.probe) {
                  <span class="tag">probe</span>
                }
              </span>
            </div>
            @if (bars(nav).length) {
              <div class="bar" role="img" [attr.aria-label]="barLabel(nav)">
                @for (bar of bars(nav); track bar.phase) {
                  <span
                    [style.width.%]="bar.width"
                    [style.background]="color(bar.phase)"
                    [attr.title]="bar.phase + ' ' + bar.ms + 'ms'"
                  ></span>
                }
              </div>
            }
            <dl class="details">
              @if (nav.from) {
                <dt>From</dt>
                <dd>
                  <code>{{ nav.from }}</code>
                </dd>
              }
              @if (nav.caller) {
                <dt>Started by</dt>
                <dd>{{ nav.caller }} ({{ nav.trigger }})</dd>
              }
              @if (nav.extras?.length) {
                <dt>Extras</dt>
                <dd>{{ nav.extras?.join(', ') }}</dd>
              }
              @if (nav.redirectedFrom !== undefined) {
                <dt>Redirect of</dt>
                <dd>#{{ nav.redirectedFrom }}</dd>
              }
              @if (nav.redirectTo) {
                <dt>Redirects to</dt>
                <dd>
                  <code>{{ nav.redirectTo }}</code> ({{ nav.redirectKind }})
                </dd>
              }
              @if (nav.guards && (nav.guards.names.length || nav.guards.passed === false)) {
                <dt>Guards</dt>
                <dd>{{ nav.guards.names.join(', ') || 'none' }}: {{ guardResult(nav) }}</dd>
              }
              @if (nav.runs?.length) {
                <dt>Runs</dt>
                <dd>
                  @for (run of nav.runs; track $index) {
                    <div>
                      <code>{{ run.guard }}</code> {{ run.kind }} on <code>{{ run.route }}</code
                      >: <strong [class.bad]="isBad(run.result)">{{ run.result }}</strong> ({{
                        run.ms
                      }}ms)
                    </div>
                  }
                </dd>
              }
              @if (nav.checked && (nav.checked.activate.length || nav.checked.deactivate.length)) {
                <dt>Checked</dt>
                <dd>
                  @if (nav.checked.deactivate.length) {
                    leaving {{ nav.checked.deactivate.join(', ') }};
                  }
                  entering {{ nav.checked.activate.join(', ') || 'nothing new' }}
                </dd>
              }
              @if (nav.resolvers?.names?.length) {
                <dt>Resolvers</dt>
                <dd>{{ nav.resolvers?.names?.join(', ') }}</dd>
              }
              @if (nav.lazyLoaded?.length) {
                <dt>Lazy loaded</dt>
                <dd>{{ nav.lazyLoaded?.join(', ') }}</dd>
              }
              @if (nav.reused?.length) {
                <dt>Reused</dt>
                <dd>
                  {{ nav.reused?.join(', ') }} (component kept, only inputs and params change)
                </dd>
              }
              @if (nav.requests) {
                <dt>HTTP</dt>
                <dd>{{ nav.requests.count }} request(s): {{ nav.requests.urls.join(', ') }}</dd>
              }
              @if (nav.scroll) {
                <dt>Scroll</dt>
                <dd>{{ nav.scroll }}</dd>
              }
              @if (nav.title) {
                <dt>Title after</dt>
                <dd>{{ nav.title }}</dd>
              }
              @if (nav.warnings?.length) {
                <dt>Warnings</dt>
                <dd>{{ nav.warnings?.join(' · ') }}</dd>
              }
              @if (nav.reason || nav.code) {
                <dt>Reason</dt>
                <dd class="reason">{{ reasonText(nav) }}</dd>
              }
              @if (nav.errorCode) {
                <dt>Error</dt>
                <dd class="reason">{{ nav.errorCode }}</dd>
              }
              @if (nav.errorHandler) {
                <dt>Error handler</dt>
                <dd>{{ nav.errorHandler }}</dd>
              }
              @if (nav.earlier) {
                <dt>Earlier</dt>
                <dd>{{ nav.earlier }} navigation(s) before DevTools connected</dd>
              }
            </dl>
            <div class="actions">
              <button
                type="button"
                class="small"
                (click)="replay(nav)"
                [attr.aria-label]="'Replay navigation ' + nav.id"
              >
                Replay
              </button>
              <button
                type="button"
                class="small"
                (click)="copy(nav)"
                [attr.aria-label]="'Copy repro for navigation ' + nav.id"
              >
                Copy repro
              </button>
            </div>
          </li>
        }
      </ol>
    } @else {
      @if (page().navigations.length) {
        <div class="empty">
          <p class="empty-title">No navigations match the current filters.</p>
          <p class="muted">
            {{ page().navigations.length }} navigation(s) are hidden. Clear the filters to see them.
          </p>
          <button type="button" class="small" (click)="clearFilters(); filterInput.focus()">
            Clear filters
          </button>
        </div>
      } @else {
        <div class="empty">
          <p class="empty-title">No navigations since DevTools connected.</p>
          <p class="muted">Earlier ones are not visible. Click a link in the app to record one.</p>
        </div>
      }
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
      gap: 8px 16px;
      align-items: center;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      color: var(--text);
      font-size: 13px;
    }
    .toolbar .field {
      flex: 1 1 200px;
      min-width: 0;
    }
    .export {
      margin-left: auto;
    }
    .check {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      min-height: 34px;
      color: var(--text-2);
      cursor: pointer;
      user-select: none;
      transition: color 0.15s var(--ease);
    }
    .check:hover {
      color: var(--text);
    }
    .check input {
      flex: none;
      width: 14px;
      height: 14px;
      margin: 0;
      accent-color: var(--accent);
      cursor: pointer;
    }
    .message {
      margin: 0;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
      align-items: center;
      justify-content: space-between;
      padding: 0 4px;
    }
    .count {
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .legend i {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 99px;
    }
    .navs {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .navs > li {
      min-width: 0;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      font-size: 13px;
      animation: enter 0.35s var(--ease) both;
      transition: border-color 0.15s var(--ease);
    }
    .navs > li:hover {
      border-color: var(--border-strong);
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 8px;
      align-items: center;
      min-width: 0;
      font-variant-numeric: tabular-nums;
    }
    .head .url {
      min-width: 0;
      color: var(--text-strong);
      font-weight: 500;
    }
    .id {
      color: var(--text-3);
      font-family: var(--font-mono);
      font-size: 12px;
    }
    .arrow {
      color: var(--text-3);
    }
    .meta {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 6px 8px;
      align-items: center;
      margin-left: auto;
    }
    .ms {
      font-family: var(--font-mono);
      font-size: 12px;
    }
    time {
      color: var(--text-3);
      font-family: var(--font-mono);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }
    .bar {
      display: flex;
      gap: 2px;
      height: 6px;
      margin: 12px 0 4px;
      overflow: hidden;
      border-radius: 99px;
      background: var(--surface-3);
    }
    .bar span {
      display: block;
      min-width: 2px;
    }
    .details {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      align-items: baseline;
      gap: 6px 16px;
      margin: 12px 0 0;
      font-size: 12.5px;
      line-height: 1.5;
    }
    .details:empty {
      display: none;
    }
    .details dt {
      letter-spacing: 0.06em;
    }
    .reason,
    .bad {
      color: var(--danger);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }
    @media (max-width: 480px) {
      .details {
        grid-template-columns: minmax(0, 1fr);
        gap: 2px;
      }
      .details dd + dt {
        margin-top: 6px;
      }
      .export {
        margin-left: 0;
      }
    }
  `,
})
export class RouteTimeline {
  page = input.required<RouterPage>();
  rpc = input<DevframeRpcClient | null>(null);

  readonly phases = PHASES;
  readonly filter = signal('');
  readonly onlyProblems = signal(false);
  readonly message = signal('');

  readonly items = computed(() => {
    const needle = this.filter().toLowerCase();
    return [...this.page().navigations]
      .reverse()
      .filter(
        (nav) =>
          (!needle ||
            nav.url.toLowerCase().includes(needle) ||
            !!nav.finalUrl?.toLowerCase().includes(needle)) &&
          (!this.onlyProblems() || !['succeeded', 'pending'].includes(nav.outcome)),
      );
  });

  reasonText(nav: NavigationRecord) {
    return [nav.code, nav.reason].filter(Boolean).join(': ');
  }

  clearFilters() {
    this.filter.set('');
    this.onlyProblems.set(false);
  }

  tone(outcome: string) {
    return tone(outcome);
  }

  color(phase: string) {
    return PHASE_COLORS[phase];
  }

  bars(nav: NavigationRecord) {
    const total = nav.phases?.['total'];
    if (!total) return [];
    return PHASES.filter((phase) => (nav.phases?.[phase] ?? 0) > 0).map((phase) => ({
      phase,
      ms: nav.phases![phase],
      width: Math.max(1, (nav.phases![phase] / total) * 100),
    }));
  }

  barLabel(nav: NavigationRecord) {
    return `Phases: ${this.bars(nav)
      .map((bar) => `${bar.phase} ${bar.ms}ms`)
      .join(', ')}`;
  }

  guardResult(nav: NavigationRecord) {
    const passed = nav.guards?.passed;
    if (passed === true) return 'passed';
    if (passed === false) return nav.outcome === 'redirected' ? 'redirected' : 'blocked';
    return nav.outcome === 'pending' ? 'running' : `did not finish, navigation ${nav.outcome}`;
  }

  isBad(result: string) {
    return result === 'false' || /^(UrlTree|RedirectCommand|threw)/.test(result);
  }

  readonly time = time;

  async toggleInstrument(event: Event) {
    const on = (event.target as HTMLInputElement).checked;
    const result = await routerAction(this.rpc(), this.page().pageId, { action: 'instrument', on });
    this.message.set(
      result?.['error']
        ? String(result['error'])
        : on
          ? 'Recording each guard and resolver.'
          : 'Stopped recording guards and resolvers.',
    );
  }

  async replay(nav: NavigationRecord) {
    this.message.set(`Replaying #${nav.id}…`);
    const result = await routerAction(this.rpc(), this.page().pageId, {
      action: 'replay',
      id: nav.id,
    });
    if (!result || result['error']) {
      this.message.set(String(result?.['error'] ?? 'Replay failed.'));
      return;
    }
    const replay = result['replay'] as { outcome?: string } | undefined;
    this.message.set(
      `Replay of #${nav.id}: ${replay?.outcome ?? 'unknown'}${result['same'] ? ' (same as before)' : ' (different from before)'}.`,
    );
  }

  async copy(nav: NavigationRecord) {
    const text = await routerCall<string>(this.rpc(), 'router-export', {
      pageId: this.page().pageId,
      id: nav.id,
    });
    if (!text) {
      this.message.set('Could not build the repro.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      this.message.set(`Copied a markdown repro of #${nav.id}.`);
    } catch {
      this.message.set('The clipboard is not available here.');
    }
  }

  exportJson() {
    const blob = new Blob([JSON.stringify(this.page().navigations, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `navigations-${this.page().pageId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
