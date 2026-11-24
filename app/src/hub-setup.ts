import type { ComingSoonInfo } from './pages/coming-soon';

// What the NativeScript, Capacitor, Analog and Angular Native docks show when their
// tool has nothing to show.

export const NATIVESCRIPT_SETUP: ComingSoonInfo = {
  id: 'nativescript',
  name: 'NativeScript',
  badge: 'Available',
  heading: 'Inspect NativeScript apps',
  summary:
    'A NativeScript Angular app reports from the simulator or device to this server, and its components, signals, injectors and NgRx stores show up in the Angular dock.',
  color: '#3c5afd',
  plansTitle: 'Set up an app',
  plans: [
    'Install @pangular-inspector/devtools and @valor/nativescript-websockets',
    'Call initNativeScriptOverlay() in main.ts, before the app bootstraps',
    'Run npx pangular dev --no-auth in the app, then open the Angular dock',
  ],
  link: {
    label: 'NativeScript setup guide',
    href: 'https://pangular-inspector.dev/getting-started/nativescript/',
  },
};

export const CAPACITOR_SETUP: ComingSoonInfo = {
  id: 'capacitor',
  name: 'Capacitor',
  badge: 'Available',
  heading: 'Inspect Capacitor apps',
  summary:
    'An Ionic or Capacitor app runs the browser overlay in its WebView and reports to this server, so it shows up in the Angular dock like a browser tab.',
  color: '#119eff',
  plansTitle: 'Set up an app',
  plans: [
    'With live reload on localhost, load @pangular-inspector/devtools/overlay as in a browser',
    'In a bundled build, call initOverlay() from @pangular-inspector/devtools/overlay-manual with this server’s address and connectionMeta',
    'Run the app, then come back here for its plugin calls, or open the Angular dock',
  ],
  link: {
    label: 'Capacitor setup guide',
    href: 'https://pangular-inspector.dev/guides/capacitor/',
  },
};

export const NOT_ANALOG: ComingSoonInfo = {
  id: 'analog',
  name: 'Analog',
  badge: 'Not in this app',
  heading: 'This app doesn’t use Analog',
  summary:
    'In an Analog app this dock shows your file routes, server load() and API calls, render modes and route lint.',
  color: '#dd0330',
  plans: [
    'Which page, layout and .server.ts files render a URL',
    'Every load(), server function and API call with timing',
    'SSR, prerendered or client only, per page',
  ],
  link: { label: 'Get started with Analog', href: 'https://analogjs.org/docs/getting-started' },
};

export const NO_ANGULAR_NATIVE: ComingSoonInfo = {
  id: 'angular-native',
  name: 'Angular Native',
  badge: 'Not connected',
  heading: 'No Angular Native app is connected',
  summary:
    'Start the overlay in your Angular Native app and run this server with --no-auth. The tabs fill as soon as the app reports.',
  color: '#e11d48',
  plans: [
    'The component tree, with the view outlined on the device',
    'Signals and injectors of the running app',
    'Live @ngrx/signals and @ngrx/store state',
  ],
  link: {
    label: 'Set up Angular Native',
    href: 'https://pangular-inspector.dev/getting-started/angular-native/',
  },
};
