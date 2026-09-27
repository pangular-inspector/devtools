import { httpResource } from '@angular/common/http';
import { Component, computed, signal } from '@angular/core';
import { ExamplePage } from './example-page';

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

type Scenario = 'ok' | 'slow' | 'fail';

const SCENARIOS: { value: Scenario; label: string; query: string }[] = [
  { value: 'ok', label: 'Normal', query: '' },
  { value: 'slow', label: 'Slow backend (1.5 s)', query: '?delay=1500' },
  { value: 'fail', label: 'Backend error (503)', query: '?fail=503' },
];

@Component({
  selector: 'app-http-example',
  imports: [ExamplePage],
  template: `
    <app-example-page heading="SSR &amp; HTTP" tab="SSR & HTTP">
      <ng-container lead>
        The product list is fetched with <code>httpResource</code> while the server renders, then
        replayed from the transfer cache during hydration. The SSR &amp; HTTP tab shows the payload,
        both sides of the call and the hydration counters.
      </ng-container>
      <ng-container hint>
        Add a fault rule for <code>/api/products</code> in the tab, then press Reload or refresh the
        page to see it on the client or during SSR.
      </ng-container>

      <div class="controls">
        <label>
          Backend scenario
          <select [value]="scenario()" (change)="setScenario($event)">
            @for (option of scenarios; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>
        <button type="button" (click)="products.reload()">Reload</button>
      </div>

      <section aria-labelledby="products-heading" [attr.aria-busy]="products.isLoading()">
        <h3 id="products-heading">Products</h3>
        <p class="status" role="status">{{ status() }}</p>
        @if (products.error(); as error) {
          <p class="error" role="alert">{{ errorText(error) }}</p>
        }
        @if (products.hasValue()) {
          <ul class="grid">
            @for (product of products.value(); track product.id) {
              <li class="card">
                <button
                  type="button"
                  [attr.aria-pressed]="selectedId() === product.id"
                  (click)="selectedId.set(product.id)"
                >
                  <span class="name">{{ product.name }}</span>
                  <span class="meta">\${{ product.price }} · {{ product.stock }} in stock</span>
                </button>
              </li>
            }
          </ul>
        }
      </section>

      @if (selectedId() !== null) {
        <section aria-labelledby="detail-heading" class="detail">
          <h3 id="detail-heading">Detail (client-only request)</h3>
          @if (detail.hasValue()) {
            <p>{{ detail.value().name }}: {{ detail.value().stock }} left</p>
          } @else if (detail.error(); as error) {
            <p class="error" role="alert">{{ errorText(error) }}</p>
          } @else {
            <p class="status">Loading…</p>
          }
        </section>
      }
    </app-example-page>
  `,
  styles: `
    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 12px;
    }
    label {
      display: grid;
      gap: 4px;
      color: var(--muted);
      font-size: 14px;
    }
    select,
    .controls button {
      padding: 6px 12px;
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: var(--surface);
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    h3 {
      margin: 0 0 8px;
      font-size: 16px;
    }
    .status {
      margin: 0 0 8px;
      color: var(--muted);
    }
    .error {
      margin: 0 0 8px;
      color: var(--danger, #b91c1c);
    }
    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .card button {
      display: grid;
      gap: 4px;
      width: 100%;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .card button[aria-pressed='true'] {
      border-color: var(--brand);
    }
    .name {
      font-weight: 600;
    }
    .meta {
      color: var(--muted);
      font-size: 14px;
    }
    .detail p {
      margin: 0;
    }
    :focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
    }
  `,
})
export class HttpExample {
  protected readonly scenarios = SCENARIOS;
  protected readonly scenario = signal<Scenario>('ok');
  protected readonly selectedId = signal<number | null>(null);

  protected readonly products = httpResource<Product[]>(
    () => `/api/products${SCENARIOS.find((s) => s.value === this.scenario())?.query ?? ''}`,
  );

  protected readonly detail = httpResource<Product>(() => {
    const id = this.selectedId();
    return id === null ? undefined : `/api/products/${id}`;
  });

  protected readonly status = computed(() => {
    if (this.products.isLoading()) return 'Loading products…';
    if (this.products.hasValue()) return `${this.products.value().length} product(s) loaded.`;
    return this.products.error() ? 'The request failed.' : '';
  });

  protected setScenario(event: Event) {
    this.scenario.set((event.target as HTMLSelectElement).value as Scenario);
  }

  protected errorText(error: unknown): string {
    const cause = (error as { cause?: unknown })?.cause ?? error;
    const status = (cause as { status?: number })?.status;
    const message = (cause as { message?: string })?.message ?? String(cause);
    return status ? `HTTP ${status}: ${message}` : message;
  }
}
