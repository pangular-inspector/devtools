import { CurrencyPipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  FormField,
  FormRoot,
  email,
  form,
  minLength,
  required,
  type FieldTree,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { RouteMeta } from '@analogjs/router';
import type { Order } from '../../server/data/catalog';
import { CartStore } from '../shared/cart.store';

export const routeMeta: RouteMeta = {
  title: 'Checkout',
};

interface CheckoutModel {
  name: string;
  email: string;
  address: string;
  cardNumber: string;
}

@Component({
  imports: [FormField, FormRoot, RouterLink, CurrencyPipe],
  template: `
    <h1>Checkout</h1>
    @if (placed(); as order) {
      <p role="status">Order {{ order.id }} placed. Total {{ order.total | currency }}.</p>
      <a routerLink="/dashboard">See all orders</a>
    } @else {
      <form [formRoot]="checkout" class="form" novalidate>
        <label for="name">Name</label>
        <input
          id="name"
          [formField]="checkout.name"
          autocomplete="name"
          [attr.aria-invalid]="shown(checkout.name)"
          aria-describedby="name-error"
        />
        <div id="name-error">
          @if (shown(checkout.name)) {
            @for (error of checkout.name().errors(); track error.kind) {
              <p class="error">{{ error.message }}</p>
            }
          }
        </div>
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          [formField]="checkout.email"
          autocomplete="email"
          [attr.aria-invalid]="shown(checkout.email)"
          aria-describedby="email-error"
        />
        <div id="email-error">
          @if (shown(checkout.email)) {
            @for (error of checkout.email().errors(); track error.kind) {
              <p class="error">{{ error.message }}</p>
            }
          }
        </div>
        <label for="address">Address</label>
        <input
          id="address"
          [formField]="checkout.address"
          autocomplete="street-address"
          [attr.aria-invalid]="shown(checkout.address)"
          aria-describedby="address-error"
        />
        <div id="address-error">
          @if (shown(checkout.address)) {
            @for (error of checkout.address().errors(); track error.kind) {
              <p class="error">{{ error.message }}</p>
            }
          }
        </div>
        <label for="card">Card number (demo only, nothing is charged)</label>
        <input
          id="card"
          [formField]="checkout.cardNumber"
          autocomplete="cc-number"
          aria-describedby="card-hint"
        />
        <p id="card-hint" class="muted">
          This demo never sends the card number. It is here to show how Pangular Inspector hides
          card fields.
        </p>
        <p class="muted">Total {{ cart.total() | currency }}</p>
        @if (orderError(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
        <button type="submit" [disabled]="cart.isEmpty()">Place order</button>
        @if (cart.isEmpty()) {
          <p class="muted">Add something to the cart first.</p>
        }
      </form>
    }
  `,
})
export default class Checkout {
  protected readonly cart = inject(CartStore);
  private readonly http = inject(HttpClient);
  protected readonly placed = signal<Order | null>(null);
  protected readonly orderError = signal('');
  private readonly model = signal<CheckoutModel>({
    name: '',
    email: '',
    address: '',
    cardNumber: '',
  });

  protected shown(field: FieldTree<string>): boolean {
    const state = field();
    return state.touched() && state.invalid();
  }

  protected readonly checkout = form(
    this.model,
    (path) => {
      required(path.name, { message: 'Name is required' });
      required(path.email, { message: 'Email is required' });
      email(path.email, { message: 'Enter a valid email' });
      required(path.address, { message: 'Address is required' });
      minLength(path.address, 5, { message: 'Address looks too short' });
    },
    {
      submission: {
        action: async (tree) => {
          const value = tree().value();
          this.orderError.set('');
          try {
            const order = await firstValueFrom(
              this.http.post<Order>('/api/v1/orders', {
                name: value.name,
                email: value.email,
                items: this.cart.items().map((line) => ({
                  productId: line.product.id,
                  quantity: line.quantity,
                })),
              }),
            );
            this.placed.set(order);
            this.cart.clear();
            return undefined;
          } catch (error) {
            const errors: { field: string; message: string }[] =
              (error as HttpErrorResponse).error?.data?.errors ?? [];
            const fieldErrors = errors.filter((e) => e.field === 'email' || e.field === 'name');
            const other = errors.filter((e) => !fieldErrors.includes(e)).map((e) => e.message);
            if (!errors.length) other.push('The order could not be placed. Try again.');
            this.orderError.set(other.join(' '));
            return fieldErrors.map((e) => ({
              kind: 'server',
              message: e.message,
              fieldTree: tree[e.field as 'email' | 'name'],
            }));
          }
        },
      },
    },
  );
}
