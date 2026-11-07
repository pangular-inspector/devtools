import { Component, computed, input } from '@angular/core';
import { SHARED_STYLES, type RoutePreview } from './router-types';

/** The "What happens if I go to X" card: a prediction from the live route config. */
@Component({
  selector: 'app-route-preview',
  template: `
    @let p = preview();
    <section class="card" aria-labelledby="route-preview-heading">
      <h3 id="route-preview-heading">
        What happens if you go to <code>{{ p.url }}</code>
      </h3>
      <p class="muted">Predicted from the live route config. Nothing ran in the app.</p>
      @if (p.hops.length) {
        <ol class="hops" aria-label="Redirects">
          @for (hop of p.hops; track $index) {
            <li>
              Redirect <code>{{ hop.from }}</code> <span aria-hidden="true">→</span
              ><span class="visually-hidden">to</span> <code>{{ hop.to }}</code> by
              <code>{{ hop.route }}</code>
            </li>
          }
        </ol>
      }
      @if (p.chain.length) {
        <p>
          <span class="badge" [attr.data-tone]="p.matched ? 'good' : 'warn'">{{
            p.matched ? 'match' : 'stops'
          }}</span>
          @for (route of p.chain; track route.path; let last = $last) {
            <code>{{ route.path }}</code>
            @if (route.active) {
              <span class="tag">active</span>
            }
            @if (!last) {
              <span aria-hidden="true"> → </span><span class="visually-hidden">then</span>
            }
          }
        </p>
      } @else {
        <p>
          <span class="badge" data-tone="bad">no match</span>
          Matches no route (NG04002).
          @if (p.nearest.length) {
            Nearest: <code>{{ p.nearest.join(', ') }}</code>
          }
        </p>
      }
      @if (paramText(); as params) {
        <p class="muted">
          Params: <code>{{ params }}</code>
        </p>
      }
      @if (p.steps.length) {
        <ol class="steps">
          @for (step of p.steps; track step.phase) {
            <li>
              <span class="phase">{{ step.phase }}</span>
              <ul>
                @for (item of step.items; track $index) {
                  <li>
                    <code>{{ item }}</code>
                  </li>
                }
              </ul>
            </li>
          }
        </ol>
      }
      @if (sources().length) {
        <p class="muted">
          Declared in:
          @for (route of sources(); track route.path; let last = $last) {
            <code>{{ route.source }}</code
            >{{ last ? '' : ', ' }}
          }
        </p>
      }
      @if (p.renderMode; as mode) {
        <p class="muted">
          Render mode <code>{{ mode.mode }}</code> (ServerRoute <code>{{ mode.path }}</code
          >)
        </p>
      }
      @if (p.stopped) {
        <p class="note">{{ p.stopped }}</p>
      }
      @for (note of p.notes; track note) {
        <p class="muted">{{ note }}</p>
      }
    </section>
  `,
  styles: `
    ${SHARED_STYLES}
    .card {
      display: grid;
      gap: 8px;
      min-width: 0;
      padding: 12px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface);
      font-size: 13px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    h3 {
      margin: 0;
      color: var(--text-strong);
      font-size: 13px;
    }
    p,
    ol,
    ul {
      margin: 0;
    }
    .hops,
    .steps {
      padding-left: 20px;
    }
    .steps > li + li {
      margin-top: 6px;
    }
    .steps ul {
      padding-left: 16px;
    }
    .phase {
      color: var(--text-2);
      font-weight: 600;
    }
  `,
})
export class RoutePreviewCard {
  preview = input.required<RoutePreview>();

  readonly paramText = computed(() =>
    Object.entries(this.preview().params)
      .map(([key, value]) => `${key}=${value}`)
      .join(', '),
  );

  readonly sources = computed(() => this.preview().chain.filter((route) => route.source));
}
