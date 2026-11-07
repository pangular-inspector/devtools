import { NgOptimizedImage } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LoadResult, RouteMeta } from '@analogjs/router';
import { injectContentFiles } from '@analogjs/content';
import { FeatureFlags } from '../shared/feature-flags';
import { ProductCard } from '../shared/product-card';
import type { load } from './index.server';

interface PostAttributes {
  title: string;
  date: string;
}

export const routeMeta: RouteMeta = {
  title: 'Analog Shop',
  meta: [{ name: 'description', content: 'A small shop built with Analog' }],
};

@Component({
  imports: [ProductCard, RouterLink, NgOptimizedImage],
  template: `
    @if (flags.enabled('promo-banner')) {
      <p class="promo">Free shipping on every order this week.</p>
    }
    <section class="hero">
      <img
        class="hero-logo"
        ngSrc="/analog.svg"
        width="140"
        height="114"
        alt="Analog logo"
        priority
      />
      <p class="eyebrow">Analog Shop</p>
      <h1>Gear for <span class="accent">focused work</span></h1>
      <p class="lead">{{ load().tagline }}</p>
      <div class="hero-actions">
        <a class="button" routerLink="/products">Browse products</a>
        <a class="button secondary" routerLink="/blog">Read the blog</a>
      </div>
    </section>
    <h2>Featured</h2>
    <div class="grid">
      @for (product of load().featured; track product.id) {
        <app-product-card [product]="product" />
      }
    </div>
    @if (flags.enabled('blog-teaser')) {
      <h2>From the blog</h2>
      <ul class="list">
        @for (post of posts; track post.slug) {
          <li>
            <a [routerLink]="['/blog', post.slug]">{{ post.attributes.title }}</a>
            <span class="muted">{{ post.attributes.date }}</span>
          </li>
        }
      </ul>
    }
  `,
})
export default class Home {
  readonly load = input.required<LoadResult<typeof load>>();
  protected readonly flags = inject(FeatureFlags);
  protected readonly posts = injectContentFiles<PostAttributes>((file) =>
    file.filename.includes('content/blog/'),
  )
    .sort((a, b) => b.attributes.date.localeCompare(a.attributes.date))
    .slice(0, 3);
}
