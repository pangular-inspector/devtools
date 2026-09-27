import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-examples',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <section class="wrap">
      <header>
        <h1>DevTools examples</h1>
        <p class="lead">
          Each page below feeds one inspector. Serve the app, open the DevTools popup and switch
          tabs while you interact with these pages.
        </p>
      </header>

      <nav class="tabs" aria-label="Examples">
        <a
          routerLink="."
          routerLinkActive="active"
          ariaCurrentWhenActive="page"
          [routerLinkActiveOptions]="{ exact: true }"
          >Overview</a
        >
        <a routerLink="signals" routerLinkActive="active" ariaCurrentWhenActive="page">Signals</a>
        <a routerLink="components" routerLinkActive="active" ariaCurrentWhenActive="page"
          >Components</a
        >
        <a routerLink="di" routerLinkActive="active" ariaCurrentWhenActive="page">Injectors</a>
        <a routerLink="routes" routerLinkActive="active" ariaCurrentWhenActive="page">Routes</a>
        <a routerLink="forms" routerLinkActive="active" ariaCurrentWhenActive="page">Forms</a>
        <a routerLink="http" routerLinkActive="active" ariaCurrentWhenActive="page"
          >SSR &amp; HTTP</a
        >
      </nav>

      <router-outlet />
    </section>
  `,
  styles: `
    .wrap {
      max-width: 1080px;
      margin: 0 auto;
      padding: 24px 24px 0;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 26px;
      letter-spacing: -0.02em;
    }
    h1::after {
      content: '';
      display: block;
      width: 56px;
      height: 3px;
      margin-top: 10px;
      border-radius: 2px;
      background: var(--angular-gradient);
    }
    .lead {
      margin: 0;
      max-width: 70ch;
      color: var(--muted);
    }
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin: 16px 0 0;
      border-bottom: 1px solid var(--line);
      padding-bottom: 12px;
    }
    .tabs a {
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      color: var(--muted);
      text-decoration: none;
      transition:
        background 0.15s,
        color 0.15s;
    }
    .tabs a:hover {
      background: var(--subtle);
      color: var(--ink);
    }
    .tabs a.active {
      background: var(--brand-soft);
      color: var(--brand);
    }
    .tabs a:focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
    }
  `,
})
export class Examples {}
