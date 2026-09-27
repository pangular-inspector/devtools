import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/devframe.ts', 'src/popup.ts', 'src/overlay.ts', 'src/vite.ts', 'src/http.ts'],
  external: [/^@angular\//, /^rxjs/],
  format: 'esm',
  platform: 'node',
  dts: true,
});
