import { Component, computed, effect, input, linkedSignal, signal } from '@angular/core';
import type { DevframeRpcClient } from 'devframe/client';
import { Select } from '../ui/select';
import {
  PAGE_UNREACHABLE,
  SHARED_STYLES,
  routerCall,
  type NavigationDiffResult,
  type NavigationRecord,
  type RouterPage,
} from './router-types';

/** The default pair: the newest finished navigation and the one before it. */
function defaults(navigations: NavigationRecord[]): { a: string | null; b: string | null } {
  const real = navigations.filter((nav) => !nav.probe && nav.outcome !== 'pending');
  const b = real[real.length - 1];
  const a = real[real.length - 2];
  return { a: a ? String(a.id) : null, b: b ? String(b.id) : null };
}

@Component({
  selector: 'app-route-diff',
  imports: [Select],
  template: `
    <p class="muted intro">
      Pick two recorded navigations to see which params, data, guards, resolvers, outlets and
      components changed between them.
    </p>
    @if (options().length < 2) {
      <div class="empty">
        <p class="empty-title">Two navigations are needed to compare.</p>
        <p class="muted">Navigate in the app, then come back to this view.</p>
      </div>
    } @else {
      <div class="pick">
        <span class="pick-label" id="route-diff-a-label">Earlier</span>
        <app-select
          labelledBy="route-diff-a-label"
          [options]="options()"
          [value]="a()"
          (valueChange)="a.set($event)"
        />
        <span class="pick-label" id="route-diff-b-label">Later</span>
        <app-select
          labelledBy="route-diff-b-label"
          [options]="options()"
          [value]="b()"
          (valueChange)="b.set($event)"
        />
      </div>
      <p class="visually-hidden" role="status">{{ announcement() }}</p>
      @if (result(); as diff) {
        @if ('error' in diff) {
          <p class="message">{{ diff.error }}</p>
        } @else {
          @if (!diff.sections.length) {
            <p class="message">Nothing recorded differs between #{{ diff.a }} and #{{ diff.b }}.</p>
          }
          @for (section of diff.sections; track section.title) {
            <div class="diff">
              <h3 [id]="'route-diff-' + $index">{{ section.title }}</h3>
              <div
                class="table-scroll"
                role="region"
                [attr.aria-label]="section.title + ' changes'"
                tabindex="0"
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">#{{ diff.a }}</th>
                      <th scope="col">#{{ diff.b }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (change of section.changes; track change.field) {
                      <tr>
                        <th scope="row" class="field-name">{{ change.field }}</th>
                        <td>
                          @if (change.before !== undefined) {
                            <code>{{ change.before }}</code>
                          } @else {
                            <span class="nil">none</span>
                          }
                        </td>
                        <td>
                          @if (change.after !== undefined) {
                            <code>{{ change.after }}</code>
                          } @else {
                            <span class="nil">none</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          }
          @if (diff.same.length) {
            <p class="muted">Same in both: {{ diff.same.join(', ') }}.</p>
          }
          @for (note of diff.notes; track note) {
            <p class="muted">{{ note }}</p>
          }
        }
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
    .intro {
      margin: 0;
    }
    .pick {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr) max-content minmax(0, 1fr);
      gap: 8px 12px;
      align-items: center;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
    }
    .pick-label {
      color: var(--text-3);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .message {
      margin: 0;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
      font-size: 13px;
    }
    .diff {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    h3 {
      margin: 0;
      color: var(--text-strong);
      font-size: 13px;
    }
    .field-name {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 500;
      text-align: left;
      overflow-wrap: anywhere;
    }
    td code {
      overflow-wrap: anywhere;
    }
    @media (max-width: 560px) {
      .pick {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class RouteDiff {
  page = input.required<RouterPage>();
  rpc = input<DevframeRpcClient | null>(null);
  /** A navigation to start from, such as the one "Compare" was clicked on. */
  start = input<number | null>(null);

  private readonly pageId = computed(() => this.page().pageId);

  readonly options = computed(() =>
    [...this.page().navigations]
      .filter((nav) => !nav.probe)
      .reverse()
      .map((nav) => ({
        value: String(nav.id),
        label: `#${nav.id} ${nav.finalUrl ?? nav.url}`,
        hint: nav.outcome,
      })),
  );

  readonly b = linkedSignal<{ page: string; start: number | null }, string | null>({
    source: () => ({ page: this.pageId(), start: this.start() }),
    computation: ({ start }) =>
      start !== null ? String(start) : defaults(this.page().navigations).b,
  });
  readonly a = linkedSignal<{ page: string; b: string | null }, string | null>({
    source: () => ({ page: this.pageId(), b: this.b() }),
    computation: ({ b }, previous) => {
      const navigations = this.page().navigations.filter((nav) => !nav.probe);
      if (previous?.value && previous.value !== b && previous.source.page === this.pageId()) {
        return previous.value;
      }
      const index = navigations.findIndex((nav) => String(nav.id) === b);
      const before = index > 0 ? navigations[index - 1] : undefined;
      // No earlier navigation: show no comparison rather than a later one as "Earlier".
      return before ? String(before.id) : null;
    },
  });

  private readonly version = computed(() =>
    this.page()
      .navigations.map((nav) => `${nav.id}:${nav.outcome}`)
      .join(','),
  );

  readonly result = signal<NavigationDiffResult | null>(null);
  readonly announcement = signal('');
  private seq = 0;

  constructor() {
    effect(() => {
      const a = this.a();
      const b = this.b();
      const pageId = this.pageId();
      // Recompare when a navigation is added or ends, so a pending one fills in.
      this.version();
      void this.compare(pageId, a, b);
    });
  }

  private async compare(pageId: string, a: string | null, b: string | null) {
    const seq = ++this.seq;
    if (a === null || b === null) {
      this.result.set(null);
      return;
    }
    const result = await routerCall<NavigationDiffResult>(this.rpc(), 'router-diff', {
      pageId,
      a: Number(a),
      b: Number(b),
    });
    if (seq !== this.seq) return;
    this.result.set(result ?? { error: PAGE_UNREACHABLE });
    this.announcement.set(
      !result || 'error' in result
        ? (result?.error ?? PAGE_UNREACHABLE)
        : `${result.sections.length} of ${result.sections.length + result.same.length} parts differ between #${result.a} and #${result.b}.`,
    );
  }
}
