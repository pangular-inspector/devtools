import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  PLATFORM_ID,
  Service,
  inject,
  provideAppInitializer,
  signal,
  type EnvironmentProviders,
} from '@angular/core';
import { createFlagStore } from 'pangular-plugin-example';

/**
 * The shop's feature flags, kept in the example library's store. The store
 * knows nothing about Angular, so this service bumps a signal on each change
 * and templates that read `enabled()` update.
 */
@Service()
export class FeatureFlags {
  readonly store = createFlagStore({
    'promo-banner': {
      default: false,
      description: 'Shows the free shipping banner on the home page.',
    },
    'blog-teaser': {
      default: true,
      description: 'Lists the latest blog posts on the home page.',
    },
  });

  private readonly changes = signal(0);

  constructor() {
    const stop = this.store.subscribe(() => this.changes.update((count) => count + 1));
    inject(DestroyRef).onDestroy(stop);
  }

  enabled(name: string): boolean {
    this.changes();
    return this.store.enabled(name);
  }
}

/**
 * Registers the flag store's Pangular tab in development builds in the
 * browser. The library's `./pangular` entry is loaded on demand, so the main
 * bundle never carries it.
 */
export function provideFeatureFlagsPangularPlugin(): EnvironmentProviders {
  return provideAppInitializer(() => {
    if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const flags = inject(FeatureFlags);
    const destroyRef = inject(DestroyRef);
    void import('pangular-plugin-example/pangular').then(({ registerFlagsPangularPlugin }) => {
      if (destroyRef.destroyed) return;
      destroyRef.onDestroy(registerFlagsPangularPlugin(flags.store));
    });
  });
}
