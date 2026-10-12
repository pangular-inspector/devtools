// What the Vite plugin injects: import the default entry and start the overlay
// on the hub right away, in the same module.
import { initOverlay } from '../overlay-auto.ts';

initOverlay({ baseURL: '/__devframes/pangular/' }).catch(() => undefined);
