import { Component, input } from '@angular/core';
import { SHARED_STYLES, type RouterPage } from './router-types';
import { plural } from '../format';

@Component({
  selector: 'app-route-setup',
  template: `
    @if (page().setup; as setup) {
      @if (setup.mode === 'events-only') {
        <p class="note" role="note">
          Events-only mode: this build lacks the injector provider debug helper, so setup detection
          is limited. The preloader, the scroller and the router providers can't be found, and the
          features and options below can show defaults.
        </p>
      }
      <dl class="facts">
        <dt>Set up with</dt>
        <dd>
          {{ setup.setupKind
          }}{{ setup.routers > 1 ? ', ' + setup.routers + ' routers on the page' : '' }}
        </dd>
        @if (setup.angularVersion) {
          <dt>Angular</dt>
          <dd>{{ setup.angularVersion }}</dd>
        }
        @if (setup.baseHref) {
          <dt>Base href</dt>
          <dd>
            <code>{{ setup.baseHref }}</code>
          </dd>
        }
        @if (setup.hydrated) {
          <dt>Hydration</dt>
          <dd>{{ plural(setup.hydrated, 'component') }} hydrated from server HTML</dd>
        }
      </dl>
      <h3>Options</h3>
      <div class="table-scroll" role="region" aria-label="Router options" tabindex="0">
        <table>
          <thead>
            <tr>
              <th scope="col">Option</th>
              <th scope="col">Value</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            @for (option of setup.options; track option.name) {
              <tr>
                <td class="name">
                  <code>{{ option.name }}</code>
                </td>
                <td>
                  <code>{{ option.value }}</code>
                </td>
                <td class="source">
                  <span class="badge" [attr.data-tone]="option.set ? 'warn' : ''">{{
                    option.set ? 'set' : 'default'
                  }}</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (entries(setup.features).length) {
        <h3>Features</h3>
        <ul class="chips">
          @for (feature of entries(setup.features); track feature[0]) {
            <li>
              <span class="badge" [attr.data-tone]="feature[1] === 'off' ? '' : 'good'"
                >{{ feature[0] }}: {{ feature[1] }}</span
              >
            </li>
          }
        </ul>
      }
      @if (entries(setup.strategies).length) {
        <h3>Strategies</h3>
        <dl class="facts">
          @for (strategy of entries(setup.strategies); track strategy[0]) {
            <dt>{{ strategy[0] }}</dt>
            <dd>
              <code>{{ strategy[1] }}</code>
            </dd>
          }
        </dl>
      }
    } @else {
      <div class="empty">
        <p class="empty-title">The page has not reported its router setup yet.</p>
        <p class="muted">
          It appears after the app finishes bootstrapping. Reload the app if it stays empty.
        </p>
      </div>
    }
  `,
  styles: `
    ${SHARED_STYLES}
    :host {
      display: grid;
      gap: 16px;
      min-width: 0;
    }
    .name code {
      color: var(--text-strong);
    }
    .source {
      width: 1%;
      white-space: nowrap;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .chips .badge {
      font-family: var(--font-mono);
      font-weight: 500;
    }
    .facts code {
      color: var(--text-strong);
    }
  `,
})
export class RouteSetup {
  protected readonly plural = plural;
  page = input.required<RouterPage>();

  entries(value: Record<string, string>) {
    return Object.entries(value);
  }
}
