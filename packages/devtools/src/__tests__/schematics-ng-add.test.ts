import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HostTree, type SchematicContext } from '@angular-devkit/schematics';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { build } from 'tsdown';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  DEV_SERVER_BUILDER,
  detectSetup,
  OVERLAY_SNIPPET,
  switchServeBuilder,
  parseWorkspaceJson,
  ngAdd,
  wireExpressServer,
  wireOverlay,
  wireVitePlugin,
} from '../schematics/ng-add/index.ts';
import { schematicsConfig } from '../../tsdown.config.ts';

const packageDir = join(import.meta.dirname, '../..');
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as {
  schematics?: string;
  files: string[];
};

/** `src/server.ts` as `ng new --ssr` writes it on Angular 20 to 22 (excerpt). */
const SERVER = `import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);
`;

/** `src/main.ts` as `ng new` writes it. */
const MAIN = `import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
`;

/** `vite.config.ts` as `create-analog` writes it (excerpt). */
const VITE = `/// <reference types="vitest" />

import analog from '@analogjs/platform';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    target: ['es2020'],
  },
  resolve: {
    mainFields: ['module'],
  },
  plugins: [
    analog({
      ssr: false,
      prerender: { routes: [] },
    }),
  ],
}));
`;

const WORKSPACE = {
  version: 1,
  projects: {
    web: {
      projectType: 'application',
      root: '',
      sourceRoot: 'src',
      architect: {
        build: {
          builder: '@angular/build:application',
          options: { browser: 'src/main.ts', ssr: { entry: 'src/server.ts' } },
        },
      },
    },
  },
};

/** A client-only app as `ng new --ssr=false` writes it on Angular 20 to 22 (excerpt). */
function clientOnly(
  serveBuilder = '@angular/build:dev-server',
  buildBuilder = '@angular/build:application',
) {
  return {
    version: 1,
    projects: {
      web: {
        projectType: 'application',
        root: '',
        sourceRoot: 'src',
        architect: {
          build: { builder: buildBuilder, options: { browser: 'src/main.ts' } },
          serve: {
            builder: serveBuilder,
            configurations: {
              production: { buildTarget: 'web:build:production' },
              development: { buildTarget: 'web:build:development' },
            },
            defaultConfiguration: 'development',
          },
        },
      },
    },
  };
}

function workspace(files: Record<string, string>, angular: object | null = WORKSPACE) {
  const tree = new HostTree();
  if (angular) tree.create('angular.json', JSON.stringify(angular, null, 2));
  for (const [path, text] of Object.entries(files)) tree.create(path, text);
  return tree;
}

function context() {
  const info = vi.fn();
  const warn = vi.fn();
  const ctx = { logger: { info, warn } } as unknown as SchematicContext;
  const logs = () => [...info.mock.calls, ...warn.mock.calls].map(([m]) => String(m)).join('\n');
  return { ctx, info, warn, logs };
}

function run(tree: HostTree, options = {}) {
  const log = context();
  ngAdd(options)(tree, log.ctx);
  return log;
}

const read = (tree: HostTree, path: string) => tree.readText(path);

describe('detectSetup', () => {
  it('prefers a Vite config, then an Express server, then the CLI', () => {
    expect(detectSetup(workspace({ 'vite.config.ts': VITE, 'src/server.ts': SERVER }))).toEqual(
      expect.objectContaining({ kind: 'vite', viteConfig: 'vite.config.ts', project: 'web' }),
    );
    expect(detectSetup(workspace({ 'src/server.ts': SERVER, 'src/main.ts': MAIN }))).toEqual(
      expect.objectContaining({ kind: 'express', server: 'src/server.ts', main: 'src/main.ts' }),
    );
    expect(detectSetup(workspace({ 'src/main.ts': MAIN }))).toEqual(
      expect.objectContaining({ kind: 'cli', main: 'src/main.ts' }),
    );
  });

  it('tells a server that is not Express apart', () => {
    const hono = `import { Hono } from 'hono';\nconst app = new Hono();\n`;
    expect(detectSetup(workspace({ 'src/server.ts': hono })).kind).toBe('server');
  });

  it('reads the project paths from angular.json and takes --project', () => {
    const angular = {
      projects: {
        lib: { projectType: 'library', root: 'projects/lib' },
        admin: {
          projectType: 'application',
          root: 'projects/admin',
          sourceRoot: 'projects/admin/src',
          architect: { build: { options: { browser: 'projects/admin/src/main.ts' } } },
        },
        shop: { projectType: 'application', root: 'projects/shop' },
      },
    };
    const tree = workspace({ 'projects/shop/vite.config.mts': VITE }, angular);
    expect(detectSetup(tree)).toEqual(
      expect.objectContaining({
        project: 'admin',
        kind: 'cli',
        main: 'projects/admin/src/main.ts',
      }),
    );
    expect(detectSetup(tree, { project: 'shop' })).toEqual(
      expect.objectContaining({ kind: 'vite', viteConfig: 'projects/shop/vite.config.mts' }),
    );
    expect(() => detectSetup(tree, { project: 'nope' })).toThrow(/No project "nope"/);
  });

  it('reads an angular.json with comments and trailing commas, as the Angular CLI does', () => {
    const tree = workspace({ 'src/main.ts': MAIN }, null);
    tree.create(
      'angular.json',
      `{
  // The CLI allows comments.
  "projects": {
    /* and block comments */
    "shop": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src", // trailing comma next
      "architect": {"build": {"options": {"browser": "src/main.ts", "baseHref": "http://x//y"}}},
    },
  },
}`,
    );
    expect(detectSetup(tree)).toEqual(
      expect.objectContaining({ kind: 'cli', project: 'shop', main: 'src/main.ts' }),
    );
    expect(parseWorkspaceJson('{"url": "http://a//b", }')).toEqual({ url: 'http://a//b' });
  });

  it('keeps commas, brackets and slashes inside strings as written', () => {
    expect(
      parseWorkspaceJson(
        '{"sourceRoot": "src,]", "a": "x,}", "url": "http://a//b", /* c */ "n": [1, 2,],}',
      ),
    ).toEqual({ sourceRoot: 'src,]', a: 'x,}', url: 'http://a//b', n: [1, 2] });
    expect(parseWorkspaceJson('{"q": "say \\"hi\\", ]"}')).toEqual({ q: 'say "hi", ]' });
  });

  it('does not join two tokens around a block comment', () => {
    expect(parseWorkspaceJson('{"projects": {}, "version": 1/* c */2}')).toBeUndefined();
    const tree = workspace({ 'src/main.ts': MAIN }, null);
    tree.create('angular.json', '{"projects": {}, "version": 1/* c */2}');
    expect(detectSetup(tree)).toEqual({ kind: 'unreadable' });
  });

  it('treats an empty angular.json as unreadable and changes nothing', () => {
    for (const text of ['', '  \n']) {
      const tree = workspace({ 'src/main.ts': MAIN }, null);
      tree.create('angular.json', text);
      expect(detectSetup(tree)).toEqual({ kind: 'unreadable' });
      const { logs } = run(tree);
      expect(logs()).toMatch(/Could not read angular\.json/);
      expect(tree.readText('src/main.ts')).toBe(MAIN);
    }
  });

  it('changes nothing and prints the snippet when angular.json cannot be read', () => {
    const tree = workspace({ 'src/main.ts': MAIN }, null);
    tree.create('angular.json', '{ "projects": ');
    expect(detectSetup(tree)).toEqual({ kind: 'unreadable' });
    const { logs } = run(tree);
    expect(logs()).toMatch(/Could not read angular\.json/);
    expect(logs()).toContain(OVERLAY_SNIPPET);
    expect(tree.readText('src/main.ts')).toBe(MAIN);
    expect(() => detectSetup(tree, { project: 'shop' })).toThrow(
      /Could not read angular\.json.*project "shop"/,
    );
  });

  it('leaves a workspace-root Vite config to the root app when the nested project does not use Vite', () => {
    const angular = {
      projects: {
        site: { projectType: 'application', root: '', sourceRoot: 'src' },
        admin: {
          projectType: 'application',
          root: 'projects/admin',
          sourceRoot: 'projects/admin/src',
          architect: { build: { options: { browser: 'projects/admin/src/main.ts' } } },
        },
      },
    };
    const tree = workspace(
      { 'vite.config.ts': VITE, 'projects/admin/src/main.ts': MAIN, 'src/main.ts': MAIN },
      angular,
    );
    expect(detectSetup(tree, { project: 'site' })).toEqual(
      expect.objectContaining({ kind: 'vite', viteConfig: 'vite.config.ts' }),
    );
    expect(detectSetup(tree, { project: 'admin' })).toEqual(
      expect.objectContaining({ kind: 'cli', main: 'projects/admin/src/main.ts' }),
    );
    const before = tree.readText('vite.config.ts');
    run(tree, { project: 'admin' });
    expect(tree.readText('vite.config.ts')).toBe(before);
    // A root config that names the nested project's folder belongs to it.
    const named = workspace({ 'vite.config.ts': `${VITE}\n// root: 'projects/admin'\n` }, angular);
    expect(detectSetup(named, { project: 'admin' }).kind).toBe('vite');
  });

  it('works without angular.json', () => {
    expect(detectSetup(workspace({ 'vite.config.ts': VITE }, null))).toEqual(
      expect.objectContaining({ kind: 'vite', main: 'src/main.ts' }),
    );
  });
});

describe('wireExpressServer', () => {
  it('adds the hub as the Express docs show, in the file style', () => {
    const result = wireExpressServer(SERVER);
    expect(result.status).toBe('added');
    expect(result.text).toContain(
      "import express from 'express';\nimport { initPangularHub } from '@pangular-inspector/devtools/hub';\n",
    );
    expect(result.text).toContain(
      'const app = express();\n// Pangular Inspector. The hub turns itself off in production.\nconst devtools = initPangularHub({ ws: false });\napp.use(devtools.nodeMiddleware);\nconst angularApp',
    );
  });

  it('is idempotent', () => {
    const once = wireExpressServer(SERVER).text!;
    expect(wireExpressServer(once)).toEqual({ status: 'present' });
  });

  it('keeps double quotes, no semicolons and the app name', () => {
    const text = `import express from "express"\nconst server = express()\n`;
    expect(wireExpressServer(text).text).toBe(
      `import express from "express"\nimport {initPangularHub} from "@pangular-inspector/devtools/hub"\nconst server = express()\n// Pangular Inspector. The hub turns itself off in production.\nconst devtools = initPangularHub({ws: false})\nserver.use(devtools.nodeMiddleware)\n`,
    );
  });

  it('leaves code it does not recognize alone', () => {
    for (const text of [
      `import express from 'express';\nconst a = express();\nconst b = express();\n`,
      `const express = require('express');\nconst app = express();\n`,
      `import express from 'express';\nexport function create() { return express(); }\n`,
      `import express from 'express';\nconst devtools = 1;\nconst app = express();\n`,
    ]) {
      expect(wireExpressServer(text)).toEqual({ status: 'unsure' });
    }
  });
});

describe('wireOverlay', () => {
  it('loads the overlay after bootstrap behind ngDevMode, as the installation page shows', () => {
    const result = wireOverlay(MAIN);
    expect(result.status).toBe('added');
    expect(result.text).toBe(`import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then(() => {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      return import('@pangular-inspector/devtools/overlay');
    }
    return undefined;
  })
  .catch((err) => console.error(err));
`);
    expect(wireOverlay(result.text!)).toEqual({ status: 'present' });
  });

  it('handles a one-line call, a bare call and an NgModule bootstrap', () => {
    const oneLine = wireOverlay(
      `bootstrapApplication(App, appConfig).catch((err) => console.error(err));\n`,
    ).text!;
    expect(oneLine).toMatch(/^bootstrapApplication\(App, appConfig\)\n {2}\.then\(\(\) => \{/);
    expect(oneLine).toContain('\n  })\n  .catch((err) => console.error(err));\n');
    const bare = wireOverlay(`bootstrapApplication(App, appConfig);\n`).text!;
    expect(bare.endsWith('  return undefined;\n  });\n')).toBe(true);
    const ngModule = wireOverlay(
      `platformBrowserDynamic()\n  .bootstrapModule(AppModule)\n  .catch((err) => console.error(err));\n`,
    );
    expect(ngModule.status).toBe('added');
    expect(ngModule.text).toContain('.bootstrapModule(AppModule)\n  .then(');
  });

  it('runs the overlay import only in development', async () => {
    const code = wireOverlay(`bootstrapApplication(App, appConfig);`).text!.replace(
      "import('@pangular-inspector/devtools/overlay')",
      'load()',
    );
    const load = vi.fn(() => Promise.resolve());
    const bootstrap = () => Promise.resolve();
    for (const dev of [true, false]) {
      load.mockClear();
      await new Function(
        'bootstrapApplication',
        'App',
        'appConfig',
        'ngDevMode',
        'load',
        `return ${code}`,
      )(bootstrap, {}, {}, dev, load);
      expect(load).toHaveBeenCalledTimes(dev ? 1 : 0);
    }
  });

  it('leaves an unknown bootstrap alone', () => {
    expect(wireOverlay(`start();\n`)).toEqual({ status: 'unsure' });
    expect(wireOverlay(`bootstrapApplication(A, c);\nbootstrapApplication(B, c);\n`)).toEqual({
      status: 'unsure',
    });
  });
});

describe('wireVitePlugin', () => {
  it('adds the import and pangular() after analog(), keeping the layout', () => {
    const result = wireVitePlugin(VITE);
    expect(result.status).toBe('added');
    expect(result.text).toContain(
      "import { defineConfig } from 'vite';\nimport pangular from '@pangular-inspector/devtools/vite';\n",
    );
    expect(result.text).toContain(
      `      prerender: { routes: [] },\n    }),\n    pangular(),\n  ],\n}));`,
    );
    expect(wireVitePlugin(result.text!)).toEqual({ status: 'present' });
  });

  it('handles one-line and empty plugin lists', () => {
    expect(
      wireVitePlugin(
        `import analog from '@analogjs/platform';\nexport default { plugins: [analog()] };\n`,
      ).text,
    ).toBe(
      `import analog from '@analogjs/platform';\nimport pangular from '@pangular-inspector/devtools/vite';\nexport default { plugins: [analog(), pangular()] };\n`,
    );
    expect(wireVitePlugin(`export default { plugins: [] };\n`).text).toBe(
      `import pangular from '@pangular-inspector/devtools/vite';\nexport default { plugins: [pangular()] };\n`,
    );
  });

  it('skips brackets inside strings and comments', () => {
    const text = `import a from 'a';\nexport default { plugins: [a(']'), /* ] */ a("[")] };\n`;
    expect(wireVitePlugin(text).text).toContain(`plugins: [a(']'), /* ] */ a("["), pangular()]`);
  });

  it('leaves configs it does not recognize alone', () => {
    for (const text of [
      `export default { plugins };\n`,
      `const a = { plugins: [] };\nconst b = { plugins: [] };\n`,
      `import pangular from './local';\nexport default { plugins: [pangular()] };\n`,
      `export default defineConfig({\n  plugins: [\n    a() // note\n  ],\n});\n`,
    ]) {
      expect(wireVitePlugin(text)).toEqual({ status: 'unsure' });
    }
  });
});

describe('ngAdd', () => {
  it('wires an Express SSR app, and a second run changes nothing', () => {
    const tree = workspace({ 'src/server.ts': SERVER, 'src/main.ts': MAIN });
    const first = run(tree);
    const server = read(tree, 'src/server.ts');
    const main = read(tree, 'src/main.ts');
    expect(server).toContain('initPangularHub({ ws: false })');
    expect(main).toContain("import('@pangular-inspector/devtools/overlay')");
    expect(first.logs()).toContain('Added the devtools hub to src/server.ts');
    const second = run(tree);
    expect(read(tree, 'src/server.ts')).toBe(server);
    expect(read(tree, 'src/main.ts')).toBe(main);
    expect(second.logs()).toContain('already has the devtools hub');
    expect(second.warn).not.toHaveBeenCalled();
  });

  it('adds only the Vite plugin to an Analog app, since the plugin loads the overlay', () => {
    const analogMain = `import { bootstrapApplication } from '@angular/platform-browser';\nbootstrapApplication(App, appConfig);\n`;
    const tree = workspace({ 'vite.config.ts': VITE, 'src/main.ts': analogMain });
    run(tree);
    expect(read(tree, 'vite.config.ts')).toContain('pangular(),');
    expect(read(tree, 'src/main.ts')).toBe(analogMain);
    const config = read(tree, 'vite.config.ts');
    run(tree);
    expect(read(tree, 'vite.config.ts')).toBe(config);
  });

  it('adds the overlay and prints the CLI steps for a client-only app', () => {
    const tree = workspace({ 'src/main.ts': MAIN });
    const { logs } = run(tree);
    expect(read(tree, 'src/main.ts')).toContain('@pangular-inspector/devtools/overlay');
    expect(logs()).toContain('npx pangular dev --port 9999 --proxy-origin http://localhost:4200');
    expect(logs()).toContain('"/__pangular"');
    expect(tree.exists('proxy.conf.json')).toBe(false);
  });

  it('prints the snippet and changes nothing when unsure', () => {
    const server = `import express from 'express';\nexport const app = makeApp(express);\n`;
    const main = `start();\n`;
    const tree = workspace({ 'src/server.ts': server, 'src/main.ts': main });
    const { warn } = run(tree);
    expect(read(tree, 'src/server.ts')).toBe(server);
    expect(read(tree, 'src/main.ts')).toBe(main);
    const warned = warn.mock.calls.map(([m]) => String(m)).join('\n');
    expect(warned).toContain("import {initPangularHub} from '@pangular-inspector/devtools/hub';");
    expect(warned).toContain("return import('@pangular-inspector/devtools/overlay');");
  });

  it('points a server that is not Express at the other servers page', () => {
    const tree = workspace({
      'src/server.ts': `import { Hono } from 'hono';\n`,
      'src/main.ts': MAIN,
    });
    const { warn } = run(tree);
    expect(read(tree, 'src/server.ts')).toBe(`import { Hono } from 'hono';\n`);
    expect(String(warn.mock.calls[0]?.[0])).toContain('/getting-started/other-servers');
  });
});

describe('switchServeBuilder', () => {
  const text = (angular: object) => `${JSON.stringify(angular, null, 2)}\n`;
  const serveOf = (out: string | undefined) =>
    (JSON.parse(out ?? '{}') as ReturnType<typeof clientOnly>).projects.web.architect.serve as {
      builder: string;
      options?: Record<string, unknown>;
      configurations: unknown;
    };

  it('points the serve target at the dev-server builder, keeping the file layout', () => {
    const before = text(clientOnly());
    const result = switchServeBuilder(before, 'web');
    expect(result.status).toBe('added');
    expect(serveOf(result.text).builder).toBe(DEV_SERVER_BUILDER);
    expect(serveOf(result.text).options).toBeUndefined();
    expect(serveOf(result.text).configurations).toEqual(
      clientOnly().projects.web.architect.serve.configurations,
    );
    expect(result.text).toBe(before.replace('@angular/build:dev-server', DEV_SERVER_BUILDER));
    expect(switchServeBuilder(result.text!, 'web').status).toBe('present');
  });

  it('keeps an @angular-devkit/build-angular dev server as the builder option', () => {
    const result = switchServeBuilder(
      text(
        clientOnly(
          '@angular-devkit/build-angular:dev-server',
          '@angular-devkit/build-angular:application',
        ),
      ),
      'web',
    );
    expect(result.status).toBe('added');
    expect(serveOf(result.text)).toMatchObject({
      builder: DEV_SERVER_BUILDER,
      options: { builder: '@angular-devkit/build-angular:dev-server' },
    });
  });

  it('keeps the indent of the file', () => {
    const fourSpaces = `${JSON.stringify(clientOnly(), null, 4)}\n`;
    expect(switchServeBuilder(fourSpaces, 'web').text).toContain(`\n    "projects"`);
  });

  it('skips a webpack build and a serve target it cannot run, with a reason', () => {
    const webpack = switchServeBuilder(
      text(
        clientOnly(
          '@angular-devkit/build-angular:dev-server',
          '@angular-devkit/build-angular:browser',
        ),
      ),
      'web',
    );
    expect(webpack).toMatchObject({
      status: 'unsure',
      skip: expect.stringContaining('no middleware'),
    });
    const custom = switchServeBuilder(text(clientOnly('@nx/angular:dev-server')), 'web');
    expect(custom).toMatchObject({
      status: 'unsure',
      skip: expect.stringContaining('@nx/angular:dev-server'),
    });
    expect(switchServeBuilder(text(WORKSPACE), 'web').skip).toContain('no serve target');
  });

  it('edits an angular.json with comments only where the builder name is unambiguous', () => {
    const commented = `// The workspace.\n${text(clientOnly())}`;
    const result = switchServeBuilder(commented, 'web');
    expect(result.status).toBe('added');
    expect(result.text).toContain('// The workspace.');
    expect(result.text).toContain(`"builder": "${DEV_SERVER_BUILDER}"`);
    const two = clientOnly();
    const twoApps = { ...two, projects: { ...two.projects, admin: two.projects.web } };
    expect(switchServeBuilder(`// Two apps.\n${text(twoApps)}`, 'web')).toEqual({
      status: 'unsure',
    });
    const legacy = `// Legacy.\n${text(clientOnly('@angular-devkit/build-angular:dev-server'))}`;
    expect(switchServeBuilder(legacy, 'web')).toEqual({ status: 'unsure' });
  });
});

describe('ngAdd and the dev-server builder', () => {
  it('switches a client-only app to the builder instead of printing the CLI steps', () => {
    const tree = workspace({ 'src/main.ts': MAIN }, clientOnly());
    const { logs, warn } = run(tree);
    expect(read(tree, 'angular.json')).toContain(`"builder": "${DEV_SERVER_BUILDER}"`);
    expect(read(tree, 'src/main.ts')).toContain('@pangular-inspector/devtools/overlay');
    expect(logs()).toContain(`ng serve now runs ${DEV_SERVER_BUILDER}`);
    expect(logs()).not.toContain('npx pangular dev');
    expect(warn).not.toHaveBeenCalled();
    const angular = read(tree, 'angular.json');
    expect(run(tree).logs()).toContain('already has the');
    expect(read(tree, 'angular.json')).toBe(angular);
  });

  it('keeps the serve target with --dev-server=false and prints the CLI steps', () => {
    const tree = workspace({ 'src/main.ts': MAIN }, clientOnly());
    const before = read(tree, 'angular.json');
    const { logs } = run(tree, { devServer: false });
    expect(read(tree, 'angular.json')).toBe(before);
    expect(logs()).toContain('npx pangular dev --port 9999');
  });

  it('prints the CLI steps for a webpack app, which the builder cannot serve', () => {
    const tree = workspace(
      { 'src/main.ts': MAIN },
      clientOnly(
        '@angular-devkit/build-angular:dev-server',
        '@angular-devkit/build-angular:browser',
      ),
    );
    const before = read(tree, 'angular.json');
    const { logs, warn } = run(tree);
    expect(read(tree, 'angular.json')).toBe(before);
    expect(logs()).toContain('whose dev server takes no middleware');
    expect(logs()).toContain('npx pangular dev --port 9999');
    expect(warn).not.toHaveBeenCalled();
  });

  it('leaves the serve target of an Express SSR app alone', () => {
    const ssr = clientOnly();
    const project = ssr.projects.web.architect.build.options as Record<string, unknown>;
    project['ssr'] = { entry: 'src/server.ts' };
    const tree = workspace({ 'src/server.ts': SERVER, 'src/main.ts': MAIN }, ssr);
    const before = read(tree, 'angular.json');
    run(tree);
    expect(read(tree, 'angular.json')).toBe(before);
    expect(read(tree, 'src/server.ts')).toContain('initPangularHub');
  });
});

describe('the published schematic', () => {
  const work = mkdtempSync(join(tmpdir(), 'pangular-schematics-'));
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  it('is listed in package.json and shipped in dist', () => {
    expect(manifest.schematics).toBe('./dist/schematics/collection.json');
    expect(manifest.files).toContain('dist');
  });

  it('builds a CommonJS collection the Angular CLI can load and run', async () => {
    await build({
      ...schematicsConfig,
      config: false,
      cwd: packageDir,
      outDir: work,
      logLevel: 'silent',
    });
    const collection = join(work, 'schematics/collection.json');
    const runner = new SchematicTestRunner('@pangular-inspector/devtools', collection);
    const tree = await runner.runSchematic(
      'ng-add',
      { project: 'web' },
      workspace({ 'src/server.ts': SERVER, 'src/main.ts': MAIN }),
    );
    expect(tree.readContent('src/server.ts')).toContain('app.use(devtools.nodeMiddleware);');
    expect(tree.readContent('src/main.ts')).toContain('@pangular-inspector/devtools/overlay');
    const again = await runner.runSchematic('ng-add', {}, tree);
    expect(again.readContent('src/server.ts')).toBe(tree.readContent('src/server.ts'));
    // The schema's default switches a client-only app; `devServer: false` keeps it.
    const client = await runner.runSchematic(
      'ng-add',
      {},
      workspace({ 'src/main.ts': MAIN }, clientOnly()),
    );
    expect(client.readContent('angular.json')).toContain(DEV_SERVER_BUILDER);
    const kept = await runner.runSchematic(
      'ng-add',
      { devServer: false },
      workspace({ 'src/main.ts': MAIN }, clientOnly()),
    );
    expect(kept.readContent('angular.json')).not.toContain(DEV_SERVER_BUILDER);
  }, 60_000);
});
