import { Component, signal } from '@angular/core';
import { DeferNote } from './defer-note';
import { ExamplePage } from './example-page';

@Component({
  selector: 'app-defer-example',
  imports: [ExamplePage, DeferNote],
  template: `
    <app-example-page heading="Defer blocks" tab="Components">
      <ng-container lead>
        Each card is a <code>&#64;defer</code> block with a different trigger. The last two render
        on the server and hydrate incrementally: one on interaction, one never.
      </ng-container>
      <ng-container hint>
        The Defer blocks list under the Components tree shows each block's state, triggers and
        hydration state. Hover a block to highlight it here.
      </ng-container>

      <div class="blocks">
        <section class="block" aria-labelledby="defer-viewport">
          <h3 id="defer-viewport">On viewport</h3>
          @defer (on viewport) {
            <app-defer-note label="Rendered once this card scrolled into view." />
          } @placeholder (minimum 500ms) {
            <p class="waiting">Waiting to scroll into view.</p>
          } @loading (after 100ms; minimum 500ms) {
            <p class="waiting">Loading…</p>
          } @error {
            <p class="waiting">This block could not load.</p>
          }
        </section>

        <section class="block" aria-labelledby="defer-interaction">
          <h3 id="defer-interaction">On interaction</h3>
          @defer (on interaction) {
            <app-defer-note label="Rendered after the button was used." />
          } @placeholder {
            <button type="button" class="action">Load the details</button>
          }
        </section>

        <section class="block" aria-labelledby="defer-when">
          <h3 id="defer-when">When a condition is true</h3>
          @defer (when ready()) {
            <app-defer-note label="Rendered once the condition turned true." />
          } @placeholder {
            <button type="button" class="action" (click)="ready.set(true)">Turn it on</button>
          }
        </section>

        <section class="block" aria-labelledby="defer-hydrate">
          <h3 id="defer-hydrate">Hydrate on interaction</h3>
          @defer (hydrate on interaction) {
            <app-defer-note label="Server HTML that hydrates on the first click inside it." />
          }
        </section>

        <section class="block" aria-labelledby="defer-never">
          <h3 id="defer-never">Hydrate never</h3>
          @defer (hydrate never) {
            <app-defer-note label="Server HTML that never hydrates, so the button stays inert." />
          }
        </section>
      </div>
    </app-example-page>
  `,
  styles: `
    .blocks {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
    }
    .block {
      display: grid;
      gap: 10px;
      align-content: start;
      padding: 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius, 12px);
      background: var(--surface);
    }
    h3 {
      margin: 0;
      font-size: 16px;
      line-height: 1.3;
    }
    .waiting {
      margin: 0;
      color: var(--muted);
    }
    .action {
      justify-self: start;
      font: inherit;
      padding: 6px 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--subtle);
      color: var(--ink);
      cursor: pointer;
    }
    code {
      background: var(--subtle);
      border-radius: 4px;
      padding: 1px 5px;
    }
  `,
})
export class DeferExample {
  protected readonly ready = signal(false);
}
