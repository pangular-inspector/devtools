import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideExperimentalWebMcpForms } from '@angular/forms/signals';
import { providePangularHttp, withPangular } from '@pangular-inspector/devtools/http';
import { provideTravelPangularPlugin } from './devtools/travel-plugin.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(withIncrementalHydration()),
    provideHttpClient(withFetch(), withPangular()),
    providePangularHttp(),
    provideExperimentalWebMcpForms(),
    // An example Pangular plugin: the TravelStore in the panel's Plugins tab.
    provideTravelPangularPlugin(),
  ],
};
