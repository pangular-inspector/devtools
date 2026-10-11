import { Component, signal } from '@angular/core';
import { EagerClock } from './eager-clock';
import { ExamplePage } from './example-page';
import { Highlight } from './highlight.directive';
import { StatCard } from './stat-card';

@Component({
  selector: 'app-components-example',
  imports: [ExamplePage, Highlight, StatCard, EagerClock],
  template: `
    <app-example-page heading="Components and directives" tab="Components">
      <ng-container lead>
        <code>app-stat-card</code> has a required input, optional inputs, a two way bound model and
        an output. <code>[appHighlight]</code> is an attribute directive with its own input, output
        and host bindings. <code>app-eager-clock</code> opts out of the default strategy with
        <code>changeDetection: Eager</code>.
      </ng-container>
      <ng-container hint>
        Select <code>app-stat-card</code> to see its inputs and outputs listed from source.
      </ng-container>

      <div class="cards">
        <app-stat-card
          label="Required input"
          [value]="views()"
          [(expanded)]="detailed"
          (refreshed)="refresh()"
        />
        <app-stat-card label="Second instance" [value]="42" hint="Each instance is listed." />
      </div>

      <app-eager-clock />

      <p class="state" aria-live="polite">
        The model is <strong>{{ detailed() ? 'open' : 'closed' }}</strong
        >, and the output has fired {{ refreshes() }} time(s).
      </p>

      <button type="button" class="directive" appHighlight (click)="refresh()">
        Hover, focus or activate this button. The directive sets host bindings rather than using
        <code>&#64;HostBinding</code>.
      </button>
    </app-example-page>
  `,
  styles: `
    .cards {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
    .state {
      margin: 0;
      color: var(--muted);
    }
    .directive {
      display: block;
      width: 100%;
      margin: 0;
      text-align: left;
      font: inherit;
      cursor: pointer;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      color: var(--ink);
      transition: background 0.15s;
    }
    code {
      background: var(--subtle);
      border-radius: 4px;
      padding: 1px 5px;
    }
  `,
})
export class ComponentsExample {
  protected readonly views = signal(3);
  protected readonly detailed = signal(true);
  protected readonly refreshes = signal(0);

  protected refresh() {
    this.views.update((total) => total + 1);
    this.refreshes.update((total) => total + 1);
  }
}
