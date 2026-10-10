import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';
import { ExamplePage } from './example-page';

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

interface Quote {
  total: number;
  items: number;
}

@Component({
  selector: 'app-ssr-requests-example',
  imports: [ExamplePage],
  template: `
    <app-example-page heading="SSR requests" tab="SSR & HTTP">
      <ng-container lead>
        The server renders this page and makes three HttpClient calls while it does. Open the SSR
        &amp; HTTP tab: the SSR requests table shows this render with its id, render time and calls,
        linked to the tab that loaded it.
      </ng-container>
      <ng-container hint>
        Two of the calls run again in the browser after hydration, so the request detail lists them
        under "Fetched again in the browser". The browser's own Network panel shows the render time
        too, in the document's Server-Timing.
      </ng-container>

      <ul class="calls">
        <li>
          <h3>Cached GET</h3>
          <p class="why">Stored in the transfer cache and replayed during hydration.</p>
          <p class="result" role="status">
            @if (products.hasValue()) {
              {{ products.value().length }} products
            } @else if (products.error()) {
              Failed
            } @else {
              Loading…
            }
          </p>
        </li>
        <li>
          <h3>POST</h3>
          <p class="why">
            Left out of the transfer cache unless <code>includePostRequests</code> is set.
          </p>
          <p class="result" role="status">
            @if (quote.hasValue()) {
              Total \${{ quote.value().total }} for {{ quote.value().items }} items
            } @else if (quote.error()) {
              Failed
            } @else {
              Loading…
            }
          </p>
        </li>
        <li>
          <h3>GET with transferCache: false</h3>
          <p class="why">Opted out of the cache, so the browser asks again.</p>
          <p class="result" role="status">
            @if (stock.hasValue()) {
              {{ stock.value().name }}: {{ stock.value().stock }} left
            } @else if (stock.error()) {
              Failed
            } @else {
              Loading…
            }
          </p>
        </li>
      </ul>
    </app-example-page>
  `,
  styles: `
    .calls {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: grid;
      align-content: start;
      gap: 6px;
      padding: 14px 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius, 12px);
      background: var(--surface);
    }
    h3 {
      margin: 0;
      font-size: 16px;
      line-height: 1.3;
    }
    p {
      margin: 0;
    }
    .why {
      color: var(--muted);
      font-size: 14px;
    }
    .result {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class SsrRequestsExample {
  protected readonly products = httpResource<Product[]>(() => '/api/products');

  protected readonly quote = httpResource<Quote>(() => ({
    url: '/api/quote',
    method: 'POST',
    body: { ids: [1, 3] },
  }));

  protected readonly stock = httpResource<Product>(() => ({
    url: '/api/products/3',
    transferCache: false,
  }));
}
