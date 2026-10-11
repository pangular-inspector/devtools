import { NgOptimizedImage } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CartStore } from './shared/cart.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgOptimizedImage],
  template: `
    <header>
      <a class="brand" routerLink="/">
        <img ngSrc="/analog.svg" width="36" height="29" alt="" priority />
        <span>Analog <strong>Shop</strong></span>
      </a>
      <nav aria-label="Main">
        <a routerLink="/products" routerLinkActive="active">Products</a>
        <a routerLink="/pricing" routerLinkActive="active">Pricing</a>
        <a routerLink="/blog" routerLinkActive="active">Blog</a>
        <a routerLink="/docs/getting-started" routerLinkActive="active">Docs</a>
        <a routerLink="/about" routerLinkActive="active">About</a>
        <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
      </nav>
      <div class="actions">
        <a routerLink="/login" routerLinkActive="active">Log in</a>
        <a routerLink="/cart" routerLinkActive="active" class="cart">
          Cart <span class="badge" aria-label="items in cart">{{ cart.count() }}</span>
        </a>
      </div>
    </header>
    <main>
      <router-outlet />
    </main>
    <footer>
      <span class="muted">Built with</span>
      <a href="https://analogjs.org">Analog</a>
      <span class="muted">· a demo for Pangular Inspector</span>
    </footer>
  `,
})
export class App {
  protected readonly cart = inject(CartStore);
}
