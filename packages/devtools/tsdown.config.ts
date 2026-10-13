import { defineConfig } from 'tsdown';

export default defineConfig({
  // Named after the package exports: `overlay` is the entry that starts on
  // import (`overlay-auto.ts`), `overlay-manual` the one that waits for
  // `initOverlay()` (`overlay.ts`).
  entry: {
    devframe: 'src/devframe.ts',
    config: 'src/config.ts',
    'cd-data': 'src/cd-data.ts',
    popup: 'src/popup.ts',
    overlay: 'src/overlay-auto.ts',
    'overlay-manual': 'src/overlay.ts',
    'capacitor-hook': 'src/capacitor-hook.ts',
    'startup-hook': 'src/startup-hook.ts',
    plugin: 'src/plugin.ts',
    'overlay-nativescript': 'src/overlay-nativescript.ts',
    'overlay-angular-native': 'src/overlay-angular-native.ts',
    vite: 'src/vite.ts',
    'signals-stub': 'src/signals-stub.ts',
    http: 'src/http.ts',
    hub: 'src/hub.ts',
    cli: 'src/cli.ts',
  },
  external: [/^@angular\//, /^@nativescript\//, /^rxjs/],
  format: 'esm',
  platform: 'node',
  dts: true,
});
