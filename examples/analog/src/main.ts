import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

// The pangular() Vite plugin adds the overlay to the pages the dev server serves.
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
