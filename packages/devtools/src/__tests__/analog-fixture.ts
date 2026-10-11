import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const PAGE = (name: string, extra = '') =>
  `import { Component } from '@angular/core';\n${extra}\n@Component({ template: '<h1>${name}</h1>' })\nexport default class ${name.replace(/\W/g, '')} {}\n`;

const LAYOUT = (name: string) =>
  `import { Component } from '@angular/core';\nimport { RouterOutlet } from '@angular/router';\n@Component({ imports: [RouterOutlet], template: '<router-outlet />' })\nexport default class ${name} {}\n`;

export const BASE_FILES: Record<string, string> = {
  'package.json': JSON.stringify({
    dependencies: { '@analogjs/router': '2.7.5' },
    devDependencies: { '@analogjs/platform': '2.7.5' },
  }),
  'vite.config.ts': `import analog from '@analogjs/platform';
export default {
  plugins: [
    analog({
      apiPrefix: 'api',
      prerender: { routes: ['/', '/pricing', '/missing'] },
      nitro: { routeRules: { '/dashboard': { ssr: false } } },
    }),
  ],
};
`,
  'src/app/pages/index.page.ts': PAGE('Home'),
  'src/app/pages/(marketing)/pricing.page.ts': PAGE(
    'Pricing',
    `export const routeMeta = { title: 'Pricing', meta: [{ name: 'description', content: 'x' }], canActivate: [() => true] };`,
  ),
  'src/app/pages/(auth).page.ts': LAYOUT('AuthLayout'),
  'src/app/pages/(auth)/login.page.ts': PAGE('Login'),
  'src/app/pages/products.page.ts': LAYOUT('ProductsLayout'),
  'src/app/pages/products/index.page.ts': PAGE('ProductList'),
  'src/app/pages/products/[id].page.ts': PAGE('Product'),
  'src/app/pages/products/[id].server.ts': `export const load = async () => ({ ok: true });\n`,
  'src/app/pages/docs/[...slug].page.ts': PAGE('Docs'),
  'src/app/pages/shop/[[...path]].page.ts': PAGE('Shop'),
  'src/app/pages/dashboard.page.ts': PAGE('Dashboard'),
  'src/app/pages/about.md': '---\ntitle: About\n---\n\n# About\n',
  'src/content/hello.md': '---\ntitle: Hello\nslug: hello\n---\n\nHi\n',
  'src/server/routes/api/v1/hello.ts': 'export default () => ({ message: "hi" });\n',
  'src/server/routes/api/v1/products.get.ts': 'export default () => [];\n',
  'src/server/routes/api/v1/products/[id].delete.ts': 'export default () => null;\n',
  'src/server/middleware/log.ts': 'export default () => undefined;\n',
};

export const BROKEN_FILES: Record<string, string> = {
  'src/app/pages/about/index.page.ts': PAGE('AboutDuplicate'),
  'src/app/pages/team.page.ts': `import { Component } from '@angular/core';\n@Component({ template: '<p>team</p>' })\nexport class Team {}\n`,
  'src/app/pages/team/[member].page.ts': PAGE('Member'),
  'src/app/pages/users/[id].page.ts': PAGE('User'),
  'src/app/pages/users/[name].page.ts': PAGE('UserByName'),
  'src/app/pages/old.page.ts': `export const routeMeta = { redirectTo: '/', pathMatch: 'full' };\nimport { Component } from '@angular/core';\n@Component({ template: '' })\nexport default class Old {}\n`,
  'src/app/pages/users/[id].server.ts': 'export const helper = 1;\n',
  'src/app/pages/ghost.server.ts': 'export const load = async () => ({});\n',
  'src/server/routes/api/v1/items.fetch.ts': 'export default () => [];\n',
  'src/server/routes/api/v1/items.get.ts': 'export default () => [];\n',
  'src/server/routes/api/v1/items/index.get.ts': 'export default () => [];\n',
  'src/server/routes/health.ts': 'export default () => "ok";\n',
  'src/content/bad.md': '---\ntitle: Bad\n',
  'src/content/hello-copy.md': '---\ntitle: Copy\nslug: hello\n---\n',
};

export function makeProject(...sets: Record<string, string>[]): string {
  const root = mkdtempSync(join(tmpdir(), 'analog-fixture-'));
  for (const files of sets) {
    for (const [file, content] of Object.entries(files)) {
      const full = join(root, file);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
  }
  return root;
}
