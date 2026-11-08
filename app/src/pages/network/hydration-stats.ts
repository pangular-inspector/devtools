import { Component, inject } from '@angular/core';
import { NetworkState } from './network-state';

/** The hydration stats, mismatches and warnings of the page selected on the Network page. */
@Component({
  selector: 'section[appHydrationStats]',
  template: `
    <h2 id="hydration-heading">Hydration</h2>
    @if (selected()?.hydration; as h) {
      <dl class="stats">
        <div>
          <dt>Enabled</dt>
          <dd>
            <span class="tag" [class.on]="h.enabled" [class.off-tag]="!h.enabled">{{
              h.enabled ? 'yes' : 'no (client render only)'
            }}</span>
          </dd>
        </div>
        <div>
          <dt>Hydrated components</dt>
          <dd>{{ h.hydratedComponents ?? 'n/a' }}</dd>
        </div>
        <div>
          <dt>Hydrated nodes</dt>
          <dd>{{ h.hydratedNodes ?? 'n/a' }}</dd>
        </div>
        <div>
          <dt>Skipped components</dt>
          <dd>{{ h.componentsSkippedHydration ?? 'n/a' }}</dd>
        </div>
        <div>
          <dt>App stable after</dt>
          <dd>{{ h.stableMs === undefined ? 'n/a' : h.stableMs + ' ms' }}</dd>
        </div>
        <div>
          <dt>Incremental defer blocks</dt>
          <dd>{{ h.deferBlocksWithIncrementalHydration ?? 'n/a' }}</dd>
        </div>
        @if (h.nodes; as n) {
          <div>
            <dt>DOM nodes hydrated</dt>
            <dd>{{ n.hydrated }}</dd>
          </div>
          <div>
            <dt>DOM nodes skipped</dt>
            <dd>{{ n.skipped }}</dd>
          </div>
          <div>
            <dt>Mismatched components</dt>
            <dd [class.bad]="n.mismatched > 0">{{ n.mismatched }}</dd>
          </div>
        }
      </dl>
      @if (h.mismatches?.length) {
        <h3>Mismatches ({{ h.mismatches!.length }})</h3>
        <ul class="plain mismatches">
          @for (m of h.mismatches; track $index) {
            <li>
              <code>{{ m.isClass ? m.component : '<' + m.component + '>' }}</code>
              @if (m.expected) {
                <span class="mismatch-row"
                  ><span class="mismatch-label">Expected</span> <code>{{ m.expected }}</code></span
                >
              }
              @if (m.actual) {
                <span class="mismatch-row"
                  ><span class="mismatch-label">Actual</span> <code>{{ m.actual }}</code></span
                >
              }
            </li>
          }
        </ul>
      }
      @if (h.skipHydrationHosts.length) {
        <h3>ngSkipHydration hosts</h3>
        <ul class="plain">
          @for (host of h.skipHydrationHosts; track $index) {
            <li>
              <code>{{ host }}</code>
            </li>
          }
        </ul>
      }
      @if (h.warningsCaptured === false) {
        <h3>Warnings</h3>
        <p class="muted small">
          Not captured: add <code>providePangularHttp()</code> to the app providers.
        </p>
      } @else {
        <h3>Warnings ({{ h.warnings.length }})</h3>
        @for (warning of h.warnings; track $index) {
          <pre class="warn">{{ warning }}</pre>
        } @empty {
          <p class="muted small ok-note">No hydration warnings.</p>
        }
      }
    } @else {
      <div class="empty">
        <p>No hydration data for this page.</p>
        <p class="muted small">Open a server rendered page of the app to see its stats.</p>
      </div>
    }
  `,
  styles: `
    @use 'network' as net;

    @include net.controls;
    .mismatches li {
      display: grid;
      gap: 4px;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
    }
    .mismatch-row {
      display: flex;
      gap: 8px;
      min-width: 0;
      font-size: 12px;
    }
    .mismatch-row code {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .mismatch-label {
      flex: none;
      width: 64px;
      color: var(--text-2);
    }
    @include net.status;
    @include net.pre;
    .plain {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .plain li {
      overflow-wrap: anywhere;
    }
    @include net.stats;
  `,
})
export class HydrationStats {
  protected readonly selected = inject(NetworkState).selected;
}
