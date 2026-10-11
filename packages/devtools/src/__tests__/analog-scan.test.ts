import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analogConfig,
  apiRoutes,
  explainUrl,
  flattenRoutes,
  frontmatter,
  lintAnalog,
  scanAnalog,
  servedAnalogRoot,
  setAnalogRoot,
  toRawPath,
  toSegment,
} from '../rpc/analog-scan.ts';
import { getBuildMeta } from '../rpc/build-meta.ts';
import { extractRoutes } from '../rpc/get-routes.ts';
import { scan } from '../rpc/__tests__/scan.ts';
import { BASE_FILES, BROKEN_FILES, makeProject } from './analog-fixture.ts';

describe('Analog route rules', () => {
  it('converts file names like Analog does', () => {
    expect(toRawPath('/src/app/pages/products/[id].page.ts')).toBe('products/:id');
    expect(toRawPath('/src/app/pages/docs/[...slug].page.ts')).toBe('docs/**');
    expect(toRawPath('/src/app/pages/shop/[[...path]].page.ts')).toBe('shop/(opt-path)');
    expect(toRawPath('/src/app/pages/(auth)/login.page.ts')).toBe('(auth)/login');
    expect(toRawPath('/src/content/hello.md')).toBe('hello');
    expect(toSegment('(auth)')).toBe('');
    expect(toSegment('index')).toBe('');
    expect(toSegment('a.b')).toBe('a/b');
  });

  it('builds the route tree with layouts, groups, params and server files', () => {
    const project = scanAnalog(makeProject(BASE_FILES));
    expect(project.analog).toBe(true);
    const all = flattenRoutes(project.routes);
    const byFile = (file: string) => all.find((r) => r.file === file)!;
    expect(byFile('/src/app/pages/products.page.ts')).toMatchObject({
      kind: 'layout',
      outlet: true,
    });
    expect(byFile('/src/app/pages/products/[id].page.ts')).toMatchObject({
      fullPath: '/products/:id',
      params: ['id'],
      serverFile: '/src/app/pages/products/[id].server.ts',
      serverExports: ['load'],
    });
    expect(byFile('/src/app/pages/(marketing)/pricing.page.ts')).toMatchObject({
      fullPath: '/pricing',
      title: 'Pricing',
      routeMeta: ['title', 'meta', 'canActivate'],
    });
    expect(byFile('/src/app/pages/docs/[...slug].page.ts').catchAll).toBe('required');
    expect(byFile('/src/app/pages/shop/[[...path]].page.ts').catchAll).toBe('optional');
    expect(byFile('/src/app/pages/about.md')).toMatchObject({ kind: 'markdown', title: 'About' });
    expect(all.find((r) => r.kind === 'group')?.fullPath).toBe('/');
  });

  it('explains a URL, including groups, catch-alls and misses', () => {
    const { routes } = scanAnalog(makeProject(BASE_FILES));
    const files = (url: string) => explainUrl(routes, url).chain.map((r) => r.file);
    expect(files('/products/7')).toEqual([
      '/src/app/pages/products.page.ts',
      '/src/app/pages/products/[id].page.ts',
    ]);
    expect(explainUrl(routes, '/products/7?x=1').params).toEqual({ id: '7' });
    expect(files('/products')).toEqual([
      '/src/app/pages/products.page.ts',
      '/src/app/pages/products/index.page.ts',
    ]);
    expect(files('/login')).toEqual([
      '/src/app/pages/(auth).page.ts',
      '/src/app/pages/(auth)/login.page.ts',
    ]);
    expect(files('/pricing')).toEqual([undefined, '/src/app/pages/(marketing)/pricing.page.ts']);
    expect(explainUrl(routes, '/docs/a/b').params).toEqual({ '**': 'a/b' });
    expect(explainUrl(routes, '/shop/x/y').params).toEqual({ path: 'x/y' });
    const miss = explainUrl(routes, '/nope');
    expect(miss.matched).toBe(false);
    expect(miss.rejected.length).toBeGreaterThan(0);
  });

  it('lists API routes with methods and params, content and config', () => {
    const root = makeProject(BASE_FILES);
    expect(
      apiRoutes(root)
        .map((a) => `${a.method} ${a.path}`)
        .sort(),
    ).toEqual(['ANY /api/v1/hello', 'DELETE /api/v1/products/:id', 'GET /api/v1/products']);
    const project = scanAnalog(root);
    expect(project.middleware).toEqual(['/src/server/middleware/log.ts']);
    expect(project.content).toEqual([
      {
        file: '/src/content/hello.md',
        slug: 'hello',
        attributes: { title: 'Hello', slug: 'hello' },
      },
    ]);
    expect(analogConfig(root)).toMatchObject({
      apiPrefix: 'api',
      prerender: ['/', '/pricing', '/missing'],
      noSsrRoutes: ['/dashboard'],
    });
    expect(analogConfig(root).ssr).toBeUndefined();
    expect(frontmatter('---\ntitle: x').error).toContain('not closed');
    expect(frontmatter('---\nsummary: From order to door: fast\n---\n').error).toContain(
      'unquoted',
    );
    expect(frontmatter("---\nsummary: 'From order to door: fast'\n---\n").attributes).toEqual({
      summary: 'From order to door: fast',
    });
  });

  it('reads build output as prerendered pages', () => {
    const root = makeProject(BASE_FILES);
    for (const page of ['', 'pricing']) {
      mkdirSync(join(root, 'dist/analog/public', page), { recursive: true });
      writeFileSync(join(root, 'dist/analog/public', page, 'index.html'), '<html></html>');
    }
    expect(scanAnalog(root).prerendered.sort()).toEqual(['/', '/pricing']);
  });

  it('is quiet about a clean project, apart from the listed prerender miss', () => {
    const rules = lintAnalog(scanAnalog(makeProject(BASE_FILES))).map(
      (f) => `${f.rule} ${f.path ?? f.file}`,
    );
    expect(rules).toEqual(['prerender-unknown-route /missing']);
  });

  it('flags common Analog mistakes', () => {
    const findings = lintAnalog(scanAnalog(makeProject(BASE_FILES, BROKEN_FILES)));
    const rules = findings.map((f) => f.rule);
    expect(rules).toEqual(
      expect.arrayContaining([
        'duplicate-url',
        'missing-default-export',
        'sibling-params',
        'redirect-with-component',
        'server-without-load',
        'orphan-server-file',
        'api-method-suffix',
        'duplicate-api-route',
        'api-outside-prefix',
        'content-frontmatter',
        'duplicate-slug',
        'prerender-unknown-route',
      ]),
    );
    expect(findings.find((f) => f.rule === 'duplicate-url')?.message).toContain('/about');
  });

  it('scans .page.analog and .page.ag pages and pairs their .server.ts files', () => {
    const root = makeProject(BASE_FILES, {
      'src/app/pages/blog.page.analog': `<script lang="ts">\n  defineMetadata({ title: 'Blog' });\n</script>\n\n<template><h1>Blog</h1></template>\n`,
      'src/app/pages/blog.server.ts': `export const load = async () => ({ posts: [] });\n`,
      'src/app/pages/news.page.ag': `<template><h1>News</h1></template>\n`,
    });
    const project = scanAnalog(root);
    const all = flattenRoutes(project.routes);
    expect(all.find((r) => r.file === '/src/app/pages/blog.page.analog')).toMatchObject({
      fullPath: '/blog',
      kind: 'page',
      serverFile: '/src/app/pages/blog.server.ts',
    });
    expect(all.find((r) => r.file === '/src/app/pages/news.page.ag')?.fullPath).toBe('/news');
    expect(explainUrl(project.routes, '/blog').chain.map((r) => r.file)).toEqual([
      '/src/app/pages/blog.page.analog',
    ]);
    const findings = lintAnalog(project).filter(
      (f) => f.file?.includes('blog') || f.file?.includes('news'),
    );
    expect(findings).toEqual([]);
  });

  it('flags content files that take over a dynamic page', () => {
    const root = makeProject(BASE_FILES, {
      'src/app/pages/blog/[slug].page.ts': `import { Component } from '@angular/core';\n@Component({ template: '' })\nexport default class Post {}\n`,
      'src/content/blog/first.md': '---\ntitle: First\n---\n',
    });
    const finding = lintAnalog(scanAnalog(root)).find((f) => f.rule === 'content-shadows-page');
    expect(finding).toMatchObject({ file: '/src/content/blog/first.md', path: '/blog/first' });
    const fallback = makeProject(BASE_FILES, {
      'src/app/pages/help/[...slug].page.ts': `import { Component } from '@angular/core';\n@Component({ template: '' })\nexport default class NotFound {}\n`,
      'src/content/help/faq.md': '---\ntitle: FAQ\n---\n',
    });
    expect(lintAnalog(scanAnalog(fallback)).map((f) => f.rule)).not.toContain(
      'content-shadows-page',
    );
  });

  it('flags a layout without router-outlet', () => {
    const root = makeProject(BASE_FILES, {
      'src/app/pages/settings.page.ts': `import { Component } from '@angular/core';\n@Component({ template: '<p>settings</p>' })\nexport default class Settings {}\n`,
      'src/app/pages/settings/profile.page.ts': `import { Component } from '@angular/core';\n@Component({ template: '' })\nexport default class Profile {}\n`,
    });
    expect(lintAnalog(scanAnalog(root)).map((f) => f.rule)).toContain('layout-without-outlet');
  });

  it('reads CRLF frontmatter and survives malformed URL escapes', () => {
    expect(frontmatter('---\r\ntitle: Hello\r\nslug: hi\r\n---\r\nBody')).toEqual({
      attributes: { title: 'Hello', slug: 'hi' },
    });
    const { routes } = scanAnalog(makeProject(BASE_FILES));
    expect(explainUrl(routes, '/products/%E0').params).toEqual({ id: '%E0' });
  });

  it('reports a folder it cannot read instead of treating it as empty', () => {
    const files: Record<string, string> = {
      ...BASE_FILES,
      'src/server/middleware': 'not a folder',
    };
    delete files['src/server/middleware/log.ts'];
    const root = makeProject(files);
    const project = scanAnalog(root);
    expect(project.scanErrors).toEqual(['/src/server/middleware: ENOTDIR']);
    expect(lintAnalog(project)).toContainEqual(
      expect.objectContaining({ rule: 'scan-error', file: '/src/server/middleware' }),
    );
    expect(scanAnalog(makeProject(BASE_FILES)).scanErrors).toBeUndefined();
  });

  it('finds the app in an Nx workspace from the workspace or the app folder', () => {
    const { 'package.json': pkg, ...app } = BASE_FILES;
    const ws = makeProject(
      { 'package.json': pkg, 'nx.json': '{}', 'apps/docs-site/project.json': '{}' },
      Object.fromEntries(Object.entries(app).map(([file, text]) => [`apps/shop/${file}`, text])),
    );
    const shop = join(ws, 'apps/shop');
    for (const page of ['', 'pricing']) {
      mkdirSync(join(ws, 'dist/apps/shop/analog/public', page), { recursive: true });
      writeFileSync(join(ws, 'dist/apps/shop/analog/public', page, 'index.html'), '<html></html>');
    }
    const fromApp = scanAnalog(shop);
    const fromWorkspace = scanAnalog(ws);
    for (const project of [fromApp, fromWorkspace]) {
      expect(project).toMatchObject({ analog: true, version: '2.7.5', root: shop });
      expect(project.routes.length).toBeGreaterThan(0);
      expect(project.api.length).toBeGreaterThan(0);
      expect(project.config.prerender).toContain('/pricing');
      expect(project.prerendered.sort()).toEqual(['/', '/pricing']);
    }
    expect(fromWorkspace.files).toEqual(fromApp.files);
    expect(extractRoutes(ws).map((r) => r.file)).toContain(
      'apps/shop/src/app/pages/(marketing)/pricing.page.ts',
    );
  });

  it('uses the Vite root for every surface when an Nx workspace has several Analog apps', async () => {
    const { 'package.json': pkg, ...app } = BASE_FILES;
    const inApp = (name: string) =>
      Object.fromEntries(Object.entries(app).map(([file, text]) => [`apps/${name}/${file}`, text]));
    const ws = makeProject(
      {
        'package.json': pkg,
        'nx.json': '{}',
        'apps/blog/src/app/pages/blog-only.page.ts': app['src/app/pages/index.page.ts']!,
        'apps/blog/vite.config.ts': `import analog from '@analogjs/platform';\nexport default { plugins: [analog({ ssr: false })] };\n`,
      },
      inApp('shop'),
    );
    const shop = join(ws, 'apps/shop');
    setAnalogRoot(shop);
    try {
      expect(servedAnalogRoot(ws)).toBe(shop);
      const files = extractRoutes(ws).map((r) => r.file);
      expect(files).toContain('apps/shop/src/app/pages/(marketing)/pricing.page.ts');
      expect(files.some((file) => file.startsWith('apps/blog/'))).toBe(false);
      expect(await scan(getBuildMeta, ws)).toMatchObject({ ssr: true, analog: '2.7.5' });
    } finally {
      setAnalogRoot(undefined);
    }
    expect(servedAnalogRoot(ws)).toBe(join(ws, 'apps/blog'));
  });

  it('does not treat a plain Angular app as Analog because the workspace root installs Analog', () => {
    const { 'package.json': pkg, ...app } = BASE_FILES;
    const ws = makeProject(
      {
        'package.json': pkg,
        'nx.json': '{}',
        'apps/admin/project.json': '{}',
        'apps/admin/src/main.ts': '',
      },
      Object.fromEntries(Object.entries(app).map(([file, text]) => [`apps/shop/${file}`, text])),
    );
    expect(scanAnalog(join(ws, 'apps/admin'))).toMatchObject({ analog: false, routes: [] });
    expect(scanAnalog(join(ws, 'apps/shop'))).toMatchObject({ analog: true, version: '2.7.5' });
  });

  it('finds workspace build output when the app declares Analog in its own package.json', () => {
    const { 'package.json': pkg, ...app } = BASE_FILES;
    const ws = makeProject(
      { 'package.json': '{"name":"workspace"}', 'nx.json': '{}', 'apps/shop/package.json': pkg },
      Object.fromEntries(Object.entries(app).map(([file, text]) => [`apps/shop/${file}`, text])),
    );
    for (const page of ['', 'pricing']) {
      mkdirSync(join(ws, 'dist/apps/shop/analog/public', page), { recursive: true });
      writeFileSync(join(ws, 'dist/apps/shop/analog/public', page, 'index.html'), '<html></html>');
    }
    const project = scanAnalog(join(ws, 'apps/shop'));
    expect(project).toMatchObject({ analog: true, version: '2.7.5' });
    expect(project.prerendered.sort()).toEqual(['/', '/pricing']);
  });

  it('reports a non-Analog project as such', () => {
    const project = scanAnalog(makeProject({ 'package.json': '{"dependencies":{}}' }));
    expect(project).toMatchObject({ analog: false, routes: [], api: [] });
  });
});
