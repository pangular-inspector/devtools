import { Component, computed, input } from '@angular/core';
import {
  byteText,
  payloadInsights,
  type PayloadEntryLike,
} from '@pangular-inspector/devtools/internal/http-data';

/**
 * Size checks for the TransferState payload of the selected page: a budget
 * warning, the largest entries with size bars, and URLs the transfer cache
 * stored under more than one key. It only reads what the page reported.
 */
@Component({
  selector: 'app-payload-insights',
  template: `
    @let info = insights();
    @if (info.overBudget) {
      <p class="budget over">
        <strong>{{ bytes(info.size) }}, over the {{ bytes(info.budget) }} budget.</strong>
        The payload is inlined in the HTML, so it delays the first render. Look at the largest
        entries below.
      </p>
    } @else {
      <p class="budget">{{ bytes(info.size) }}, within the {{ bytes(info.budget) }} budget.</p>
    }
    @if (info.largest.length) {
      <h3 id="payload-largest-heading">Largest entries</h3>
      <ol class="largest" aria-labelledby="payload-largest-heading">
        @for (item of info.largest; track item.key) {
          <li>
            <span class="name" [title]="item.key">{{ item.label }}</span>
            <span class="size">{{ bytes(item.size) }}, {{ item.share }}%</span>
            <span class="bar" aria-hidden="true"><span [style.width.%]="item.share"></span></span>
          </li>
        }
      </ol>
    }
    @if (info.sameUrl.length) {
      <h3 id="payload-same-url-heading">
        Same URL stored more than once ({{ info.sameUrl.length }})
      </h3>
      <p class="hint">
        Each key holds its own response, because the headers, params or body differ. Check whether
        one request could serve them all.
      </p>
      <ul class="same-url" aria-labelledby="payload-same-url-heading">
        @for (group of info.sameUrl; track group.url) {
          <li>
            <code class="name">{{ group.url }}</code>
            <span class="size">{{ group.keys.length }} keys, {{ bytes(group.size) }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    @use 'mixins' as m;

    :host {
      display: block;
      margin-bottom: 12px;
    }
    h3 {
      @include m.label;
      margin: 12px 0 6px;
    }
    .budget,
    .hint {
      margin: 0;
      color: var(--text-2);
      font-size: 12px;
    }
    .budget.over {
      padding: 8px 10px;
      border: 1px solid var(--border-strong);
      border-left: 3px solid var(--warn);
      border-radius: var(--radius-sm);
      background: var(--surface-2);
      color: var(--text);
    }
    ol,
    ul {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 2px 8px;
      font-size: 12px;
    }
    .name {
      @include m.truncate;
      font-family: var(--font-mono);
      color: var(--text);
    }
    .size {
      color: var(--text-2);
      font-variant-numeric: tabular-nums;
    }
    .bar {
      grid-column: 1 / -1;
      height: 4px;
      border-radius: 2px;
      background: var(--surface-3);
      overflow: hidden;
      span {
        display: block;
        height: 100%;
        background: var(--accent);
      }
    }
    .same-url {
      margin-top: 6px;
    }
  `,
})
export class PayloadInsights {
  readonly size = input(0);
  readonly entries = input<readonly PayloadEntryLike[]>([]);

  readonly insights = computed(() =>
    payloadInsights({ size: this.size(), entries: this.entries() }),
  );

  bytes(value: number): string {
    return byteText(value);
  }
}
