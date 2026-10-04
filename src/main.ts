import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Load the devtools overlay (which also opens the popup) in development only
bootstrapApplication(App, appConfig)
  .then((ref) => {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      return ref
        .whenStable()
        .then(() =>
          Promise.all([import('@pangular-inspector/devtools/overlay'), import('@ngrx/signals')]),
        )
        .then(([devtools, { patchState, watchState }]) =>
          devtools.registerNgrxSignals({ patchState, watchState }),
        );
    }
    return undefined;
  })
  .catch((err) => console.error(err));
