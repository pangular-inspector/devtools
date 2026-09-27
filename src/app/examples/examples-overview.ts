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
        Six pages, each built to fill one DevTools inspector. Open the popup with the button in the
        corner, then work through them.
      </p>

      <ul class="grid">
        @for (example of examples; track example.path) {
          <li>
            <a [routerLink]="['/examples', example.path]">
              <span class="tab">{{ example.tab }}</span>
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
      padding: 24px 0 48px;
    }
    .lead {
      margin: 0;
      max-width: 68ch;
      color: var(--muted);
    }
    .grid {
      display: grid;
      gap: 24px;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
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
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      text-decoration: none;
      overflow: hidden;
    }
    a::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 3px;
      background: var(--angular-gradient);
      opacity: 0;
      transition: opacity 0.15s;
    }
    a:hover {
      border-color: var(--line-strong);
      box-shadow: 0 2px 10px var(--shadow);
    }
    a:hover::before,
    a:focus-visible::before {
      opacity: 1;
    }
    a:focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
    }
    .tab {
      justify-self: start;
      align-self: start;
      padding: 1px 8px;
      border: 1px solid var(--line);
      border-radius: 4px;
      background: var(--subtle);
      color: var(--muted);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.02em;
    }
    .title {
      color: var(--ink);
      font-weight: 600;
    }
    .blurb {
      color: var(--muted);
      font-size: 14px;
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
      path: 'http',
      tab: 'SSR & HTTP',
      title: 'Data from the backend',
      blurb: 'HttpClient calls made during SSR, the transfer cache and injected faults.',
    },
  ];
}
