import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideNgDevtoolsHttp, withNgDevtools } from '@santoshyadavdev/ng-devtools/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideClientHydration(withIncrementalHydration()),
    provideHttpClient(withFetch(), withNgDevtools()),
    provideNgDevtoolsHttp(),
  ],
};
