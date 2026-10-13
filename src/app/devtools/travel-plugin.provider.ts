import { isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  PLATFORM_ID,
  inject,
  provideAppInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import { registerPangularPlugin } from '@pangular-inspector/devtools/plugin';
import { TravelStore } from '../travel/travel.store';
import { travelPlugin } from './travel-plugin';

/**
 * Registers the travel plugin in development builds in the browser. The
 * overlay picks it up whether it loads before or after.
 */
export function provideTravelPangularPlugin(): EnvironmentProviders {
  return provideAppInitializer(() => {
    if (typeof ngDevMode !== 'undefined' && !ngDevMode) return;
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    const store = inject(TravelStore);
    const unregister = registerPangularPlugin(
      travelPlugin({
        bookings: () => store.bookings(),
        saved: () => store.saved(),
        recentQueries: () => store.recentQueries(),
        filters: () => ({ query: store.query(), region: store.region(), sort: store.sort() }),
        unsaveAll: () => {
          for (const id of store.saved()) store.toggleSaved(id);
        },
      }),
    );
    inject(DestroyRef).onDestroy(unregister);
  });
}
