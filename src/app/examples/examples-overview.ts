import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ExampleLink {
  path: string;
  tab: string;
  title: string;
  blurb: string;
}

@Component({
  selector: 'app-examples-overview',
  imports: [RouterLink],
  template: `
    <section>
      <p class="lead">
        Eight pages, each built to fill one DevTools inspector. Open the popup with the button in
        the corner, then work through them.
      </p>

      <ul class="grid">
        @for (example of examples; track example.path) {
          <li>
            <a [routerLink]="['/examples', example.path]">
              <span class="top">
                <span class="tab">{{ example.tab }}</span>
                <svg class="arrow" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
              <span class="title">{{ example.title }}</span>
              <span class="blurb">{{ example.blurb }}</span>
            </a>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    section {
      display: grid;
      gap: 20px;
      padding: 24px 0 64px;
    }
    .lead {
      margin: 0;
      max-width: 68ch;
      color: var(--muted);
    }
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: grid;
    }
    a {
      position: relative;
      display: grid;
      align-content: start;
      gap: 8px;
      height: 100%;
      box-sizing: border-box;
      padding: 20px;
      border: 1px solid var(--line);
      border-radius: var(--radius, 12px);
      background: var(--surface);
      box-shadow: var(--shadow-sm);
      text-decoration: none;
      overflow: hidden;
      transition:
        border-color 0.15s var(--ease, ease),
        box-shadow 0.15s var(--ease, ease),
        transform 0.15s var(--ease, ease);
    }
    a::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 3px;
      background: var(--brand-gradient);
      opacity: 0;
      transition: opacity 0.15s var(--ease, ease);
    }
    a:hover {
      border-color: var(--line-strong);
      box-shadow: 0 6px 20px var(--shadow);
      transform: translateY(-1px);
    }
    a:hover::before,
    a:focus-visible::before {
      opacity: 1;
    }
    a:focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 4px;
    }
    .tab {
      padding: 2px 8px;
      border-radius: 6px;
      background: var(--brand-soft);
      color: var(--brand-strong);
      font-size: 12px;
      font-weight: 600;
      line-height: 1.5;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .arrow {
      flex: none;
      fill: none;
      stroke: var(--muted);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      transition:
        transform 0.15s var(--ease, ease),
        stroke 0.15s var(--ease, ease);
    }
    a:hover .arrow,
    a:focus-visible .arrow {
      stroke: var(--brand);
      transform: translateX(2px);
    }
    .title {
      color: var(--ink);
      font-size: 16px;
      font-weight: 600;
      line-height: 1.35;
    }
    .blurb {
      color: var(--muted);
      font-size: 14px;
    }
    @media (prefers-reduced-motion: reduce) {
      a:hover {
        transform: none;
      }
    }
  `,
})
export class ExamplesOverview {
  readonly examples: ExampleLink[] = [
    {
      path: 'signals',
      tab: 'Signals',
      title: 'Every signal kind',
      blurb: 'signal, computed, linkedSignal, effect, resource, queries, inputs and outputs.',
    },
    {
      path: 'components',
      tab: 'Components',
      title: 'Inputs, outputs and a directive',
      blurb: 'A card with a required input and a model, plus an attribute directive.',
    },
    {
      path: 'di',
      tab: 'Injectors',
      title: 'A real injector tree',
      blurb: 'A parent and a child that each provide tokens, one overriding the other.',
    },
    {
      path: 'routes',
      tab: 'Routes',
      title: 'Nested routes',
      blurb: 'Children, grandchildren, a redirect, route data and a lazy child config.',
    },
    {
      path: 'forms',
      tab: 'Forms',
      title: 'Every kind of form',
      blurb: 'Signal Forms, reactive and template-driven forms with failing validators.',
    },
    {
      path: 'pipes',
      tab: 'Pipes',
      title: 'Pure, impure and module',
      blurb:
        'A pure formatting pipe, an impure one that recomputes every tick, and a standalone: false one declared through an NgModule.',
    },
    {
      path: 'http',
      tab: 'SSR & HTTP',
      title: 'Data from the backend',
      blurb: 'HttpClient calls made during SSR, the transfer cache and injected faults.',
    },
    {
      path: 'store',
      tab: 'Store',
      title: 'Scoped signal state',
      blurb: 'A signalStore provided by a component and a signalState kept in a component field.',
    },
    {
      path: 'defer',
      tab: 'Components',
      title: 'Defer blocks',
      blurb: 'Defer triggers, loading and error blocks, and incremental hydration.',
    },
  ];
}
