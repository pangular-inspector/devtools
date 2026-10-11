import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ExamplePage } from './example-page';
import { pingPong } from './ping-pong';

@Component({
  selector: 'app-routes-example',
  imports: [ExamplePage, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <app-example-page heading="Nested routes" tab="Routes">
      <ng-container lead>
        This page has children of its own, route <code>data</code>, a redirect, a route with a param
        and a resolver, a guard that redirects, a guard that blocks, a resolver that fails and two
        guards that redirect to each other a few times before they let go.
      </ng-container>
      <ng-container hint>
        Click through the links and watch the current route and the navigation timeline in the
        Routes tab.
      </ng-container>

      <nav class="sub" aria-label="Route example">
        <a routerLink="summary" routerLinkActive="active" ariaCurrentWhenActive="page">Summary</a>
        <a routerLink="details" routerLinkActive="active" ariaCurrentWhenActive="page">Details</a>
        <a routerLink="users/7" routerLinkActive="active" ariaCurrentWhenActive="page">User 7</a>
        <a routerLink="admin" routerLinkActive="active" ariaCurrentWhenActive="page">Admin</a>
        <a routerLink="locked" routerLinkActive="active" ariaCurrentWhenActive="page">Locked</a>
        <a routerLink="broken" routerLinkActive="active" ariaCurrentWhenActive="page">Broken</a>
        <a routerLink="loop-a" routerLinkActive="active" ariaCurrentWhenActive="page">Guard loop</a>
        <button type="button" [attr.aria-disabled]="running() || null" (click)="pingPong()">
          Navigation ping-pong
        </button>
      </nav>

      <div class="outlet">
        <router-outlet />
      </div>
    </app-example-page>
  `,
  styles: `
    .sub {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .sub a,
    .sub button {
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      color: var(--muted);
      text-decoration: none;
    }
    .sub button[aria-disabled='true'] {
      cursor: progress;
    }
    .sub button {
      border: 0;
      background: none;
      font: inherit;
      font-size: 14px;
      cursor: pointer;
    }
    .sub a:hover,
    .sub button:not([aria-disabled='true']):hover {
      background: var(--subtle);
      color: var(--ink);
    }
    .sub a.active {
      background: var(--brand-soft);
      color: var(--brand);
    }
    .sub a:focus-visible,
    .sub button:focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
    }
    .outlet {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 16px;
      background: var(--surface);
    }
  `,
})
export class RoutesExample {
  private readonly router = inject(Router);

  protected readonly running = signal(false);

  protected async pingPong() {
    if (this.running()) return;
    this.running.set(true);
    try {
      await pingPong(this.router);
    } finally {
      this.running.set(false);
    }
  }
}
