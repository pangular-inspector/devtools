import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/devframe.ts',
    'src/config.ts',
    'src/popup.ts',
    'src/overlay.ts',
    'src/overlay-nativescript.ts',
    'src/overlay-angular-native.ts',
    'src/vite.ts',
    'src/http.ts',
    'src/hub.ts',
    'src/cli.ts',
  ],
  external: [/^@angular\//, /^@nativescript\//, /^rxjs/],
  format: 'esm',
  platform: 'node',
  dts: true,
});
