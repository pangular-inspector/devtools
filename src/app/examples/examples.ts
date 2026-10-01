import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-examples',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <section class="container wrap">
      <header>
        <p class="eyebrow">DevTools Lab</p>
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
        <a routerLink="pipes" routerLinkActive="active" ariaCurrentWhenActive="page">Pipes</a>
        <a routerLink="http" routerLinkActive="active" ariaCurrentWhenActive="page"
          >SSR &amp; HTTP</a
        >
        <a routerLink="store" routerLinkActive="active" ariaCurrentWhenActive="page">NgRx</a>
        <a routerLink="defer" routerLinkActive="active" ariaCurrentWhenActive="page">Defer</a>
      </nav>

      <router-outlet />
    </section>
  `,
  styles: `
    .wrap {
      display: block;
      padding-top: 40px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(26px, 3.5vw, 34px);
      line-height: 1.15;
      letter-spacing: -0.02em;
    }
    .lead {
      margin: 0;
      max-width: 68ch;
      color: var(--muted);
    }
    .tabs {
      display: flex;
      gap: 4px;
      margin: 24px -4px 0;
      padding: 0 4px 12px;
      border-bottom: 1px solid var(--line);
      overflow-x: auto;
      scrollbar-width: thin;
      scroll-padding-inline: 16px;
    }
    .tabs a {
      display: inline-flex;
      flex: none;
      align-items: center;
      height: 36px;
      padding: 0 14px;
      border-radius: var(--radius-sm, 8px);
      color: var(--muted);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;
      transition:
        background-color 0.15s var(--ease, ease),
        color 0.15s var(--ease, ease);
    }
    .tabs a:hover {
      background: var(--subtle);
      color: var(--ink);
    }
    .tabs a.active {
      background: var(--brand-soft);
      color: var(--brand-strong);
    }
    .tabs a:focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: -2px;
    }
    @media (max-width: 600px) {
      .wrap {
        padding-top: 28px;
      }
      .tabs {
        margin-inline: -16px;
        padding-inline: 16px;
      }
    }
  `,
})
export class Examples {}
