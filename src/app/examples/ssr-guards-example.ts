import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ExamplePage } from './example-page';
import type { Product } from './ssr-guards';

@Component({
  selector: 'app-ssr-guards-example',
  imports: [ExamplePage, RouterLink],
  template: `
    <app-example-page heading="SSR guards and resolvers" tab="SSR & HTTP">
      <ng-container lead>
        This route runs a <code>canActivate</code> guard that calls <code>/api/access</code>, then a
        resolver that loads the product from a slow API, both while the server renders. Open the SSR
        &amp; HTTP tab: the request shows each navigation under "Router during the render", with the
        guard and resolver times and both API calls.
      </ng-container>
      <ng-container hint>
        Load each link with a full page reload (or open it in a new tab) so the server renders it.
        Links inside the app navigate in the browser, which the Routes tab shows instead.
      </ng-container>

      @if (from() === 'sold-out') {
        <p class="note" role="status">
          The product you asked for is sold out, so the guard redirected you here.
        </p>
      }

      <section class="card" aria-labelledby="product-heading">
        <h3 id="product-heading">{{ product().name }}</h3>
        <p class="meta">\${{ product().price }} · {{ product().stock }} in stock</p>
      </section>

      <h3 class="cases-heading">Try each case</h3>
      <ul class="cases">
        <li>
          <a href="/examples/ssr/product/3">Allowed</a>
          <span>The guard passes and the resolver loads product 3.</span>
        </li>
        <li>
          <a href="/examples/ssr/product/2">Sold out</a>
          <span>The guard redirects to product 1, so the request lists two navigations.</span>
        </li>
        <li>
          <a href="/examples/ssr/product/9">Unknown</a>
          <span>The access API answers 404 and the guard rejects the navigation.</span>
        </li>
        <li>
          <a routerLink="/examples/ssr/product/4">Product 4, in the browser</a>
          <span>A client navigation, for comparison in the Routes tab.</span>
        </li>
      </ul>
    </app-example-page>
  `,
  styles: `
    .note {
      margin: 0;
      padding: 10px 14px;
      border: 1px solid var(--line-strong);
      border-radius: var(--radius-sm, 8px);
      background: var(--brand-soft);
      color: var(--ink);
    }
    .card {
      display: grid;
      gap: 4px;
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
    .meta {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
      font-variant-numeric: tabular-nums;
    }
    .cases {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .cases li {
      display: grid;
      gap: 2px;
    }
    .cases a {
      color: var(--brand);
      font-weight: 600;
    }
    .cases span {
      color: var(--muted);
      font-size: 14px;
    }
    a:focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
    }
  `,
})
export class SsrGuardsExample {
  readonly product = input.required<Product>();
  readonly from = input<string>();
}
