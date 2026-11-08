import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Architect,
  createBuilder,
  type BuilderContext,
  type BuilderOutput,
} from '@angular-devkit/architect';
import { TestingArchitectHost } from '@angular-devkit/architect/testing';
import { logging, schema } from '@angular-devkit/core';
import { build } from 'tsdown';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  DEV_SERVERS,
  createDevServerBuilder,
  devServerArguments,
  devtoolsUrl,
  pickDevServer,
  type DevServerHost,
  type DevServerHub,
} from '../builders/dev-server/index.ts';
import { buildersConfig } from '../../tsdown.config.ts';

const packageDir = join(import.meta.dirname, '../..');
const require = createRequire(join(packageDir, 'package.json'));
const angularSchema = JSON.parse(
  readFileSync(
    join(require.resolve('@angular/build/package.json'), '../src/builders/dev-server/schema.json'),
    'utf8',
  ),
) as { properties: Record<string, unknown> };
const ownSchema = JSON.parse(
  readFileSync(join(packageDir, 'src/builders/dev-server/schema.json'), 'utf8'),
) as { properties: Record<string, { default?: unknown }>; additionalProperties: boolean };
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as {
  builders?: string;
};
const BuilderSymbol = Symbol.for('@angular-devkit/architect:builder');

interface Call {
  options: Record<string, unknown>;
  rest: unknown[];
}

/** A dev server package that records its calls and reports one successful start. */
function fakeDevServer(calls: Call[]) {
  return {
    async *executeDevServerBuilder(
      options: Record<string, unknown>,
      context: BuilderContext,
      ...rest: unknown[]
    ): AsyncIterable<BuilderOutput> {
      calls.push({ options, rest });
      yield { success: true, baseUrl: 'http://localhost:4300/' };
      // As the Angular dev server does: it runs until the CLI tears it down.
      await new Promise<void>((resolve) => context.addTeardown(resolve));
    },
  };
}

function fakeHub(enabled = true): DevServerHub & { close: ReturnType<typeof vi.fn> } {
  return {
    enabled,
    base: '/__devframes/',
    nodeMiddleware: (_req, _res, next) => next(),
    close: vi.fn(async () => undefined),
  };
}

function host(packages: Record<string, unknown>, hub = fakeHub()) {
  const startHub = vi.fn(async () => hub);
  const devHost: DevServerHost = { load: (name) => packages[name], startHub };
  return { devHost, startHub, hub };
}

/** Runs `serve` through a real architect, with the real `@angular/build` dev server schema. */
async function serve(
  devHost: DevServerHost,
  options: Record<string, unknown>,
  devServer = '@angular/build:dev-server',
) {
  const registry = new schema.CoreSchemaRegistry();
  registry.addPostTransform(schema.transforms.addUndefinedDefaults);
  const architectHost = new TestingArchitectHost(packageDir, packageDir);
  const architect = new Architect(architectHost, registry);
  const info: string[] = [];
  await architectHost.addBuilder(
    devServer,
    // Only its schema is used: the builder validates the serve options against it.
    createBuilder(() => ({ success: true })),
    '',
    angularSchema as never,
  );
  await architectHost.addBuilder(
    '@pangular-inspector/devtools:dev-server',
    createDevServerBuilder(packageDir, devHost) as never,
    '',
    ownSchema as never,
  );
  architectHost.addTarget({ project: 'web', target: 'build' }, '@angular/build:application', {});
  architectHost.addTarget(
    { project: 'web', target: 'serve' },
    '@pangular-inspector/devtools:dev-server',
    { buildTarget: 'web:build:development', ...options },
  );
  const logger = new logging.Logger('test');
  logger.subscribe((entry) => info.push(entry.message));
  const run = await architect.scheduleTarget({ project: 'web', target: 'serve' }, {}, { logger });
  const output = await run.result;
  return { output, run, info };
}

describe('the dev-server builder', () => {
  it('runs the Angular dev server with the hub middleware and its own defaults', async () => {
    const calls: Call[] = [];
    const { devHost, startHub, hub } = host({ '@angular/build': fakeDevServer(calls) });
    const { output, run, info } = await serve(devHost, { port: 4300 });
    expect(output.success).toBe(true);
    expect(startHub).toHaveBeenCalledOnce();
    const [call] = calls;
    // The dev server's own schema filled its defaults; the builder's options stay out.
    expect(call?.options).toMatchObject({ port: 4300, host: 'localhost', liveReload: true });
    expect(call?.options).not.toHaveProperty('devtools');
    expect(call?.options).not.toHaveProperty('builder');
    expect(call?.rest).toEqual([{ middleware: [hub.nodeMiddleware] }]);
    expect(info.join('\n')).toContain('Pangular Inspector: http://localhost:4300/__devframes/');
    await run.stop();
    expect(hub.close).toHaveBeenCalledOnce();
  });

  it('serves without the hub when devtools is false', async () => {
    const calls: Call[] = [];
    const { devHost, startHub } = host({ '@angular/build': fakeDevServer(calls) });
    const { output, run, info } = await serve(devHost, { devtools: false });
    expect(output.success).toBe(true);
    expect(startHub).not.toHaveBeenCalled();
    expect(calls[0]?.rest).toEqual([]);
    expect(info.join('\n')).not.toContain('Pangular Inspector');
    await run.stop();
  });

  it('closes a hub that is off, as with NODE_ENV=production, and serves without it', async () => {
    const calls: Call[] = [];
    const off = fakeHub(false);
    const { devHost } = host({ '@angular/build': fakeDevServer(calls) }, off);
    const { run } = await serve(devHost, {});
    expect(off.close).toHaveBeenCalledOnce();
    expect(calls[0]?.rest).toEqual([]);
    await run.stop();
  });

  it('runs @angular-devkit/build-angular when the options name it, with extensions fourth', async () => {
    const calls: Call[] = [];
    const { devHost, hub } = host({ '@angular-devkit/build-angular': fakeDevServer(calls) });
    const { output, run } = await serve(
      devHost,
      { builder: '@angular-devkit/build-angular:dev-server' },
      '@angular-devkit/build-angular:dev-server',
    );
    expect(output.success).toBe(true);
    expect(calls[0]?.rest).toEqual([undefined, { middleware: [hub.nodeMiddleware] }]);
    await run.stop();
  });

  it('fails with a reason when no dev server is installed', async () => {
    const { devHost, startHub } = host({});
    const { output, info } = await serve(devHost, {});
    expect(output.success).toBe(false);
    expect(info.join('\n')).toContain('Neither @angular/build nor @angular-devkit/build-angular');
    expect(startHub).not.toHaveBeenCalled();
  });
});

describe('pickDevServer', () => {
  const pkg = fakeDevServer([]);

  it('takes the first dev server installed, or the one named', () => {
    const both = { load: () => pkg };
    expect(pickDevServer(undefined, '/', both as never)).toMatchObject({ name: DEV_SERVERS[0] });
    const legacy = {
      load: (name: string) => (name === '@angular-devkit/build-angular' ? pkg : undefined),
    };
    expect(pickDevServer(undefined, '/', legacy as never)).toMatchObject({ name: DEV_SERVERS[1] });
  });

  it('refuses a named package that is not a dev server', () => {
    const other = { load: () => ({}) };
    const picked = pickDevServer('@nx/angular:dev-server', '/', other as never);
    expect(picked).toEqual({ error: expect.stringContaining('has no executeDevServerBuilder()') });
  });

  it('passes the extensions where each package takes them', () => {
    const ext = { middleware: [] };
    expect(devServerArguments('@angular/build:dev-server', ext)).toEqual([ext]);
    expect(devServerArguments('@angular-devkit/build-angular:dev-server', ext)).toEqual([
      undefined,
      ext,
    ]);
    expect(devServerArguments('@angular/build:dev-server', undefined)).toEqual([]);
  });

  it('builds the panel URL from the dev server URL', () => {
    expect(devtoolsUrl('http://localhost:4200/app/')).toBe('http://localhost:4200/__devframes/');
    expect(devtoolsUrl(undefined)).toBeUndefined();
    expect(devtoolsUrl('not a url')).toBeUndefined();
  });

  it('finds the installed @angular/build dev server API', () => {
    const angularBuild = require('@angular/build') as { executeDevServerBuilder?: unknown };
    expect(typeof angularBuild.executeDevServerBuilder).toBe('function');
  });
});

describe('the builder schema', () => {
  it('takes every option of the @angular/build dev server, without its defaults', () => {
    for (const name of Object.keys(angularSchema.properties)) {
      expect(ownSchema.properties, name).toHaveProperty(name);
      expect(ownSchema.properties[name]?.default, name).toBeUndefined();
    }
    expect(ownSchema.additionalProperties).toBe(true);
    expect(ownSchema.properties['devtools']?.default).toBe(true);
  });
});

describe('the published builder', () => {
  const work = mkdtempSync(join(tmpdir(), 'pangular-builders-'));
  afterAll(() => rmSync(work, { recursive: true, force: true }));

  it('is listed in package.json and names its implementation and schema', () => {
    expect(manifest.builders).toBe('./dist/builders/builders.json');
    const builders = JSON.parse(
      readFileSync(join(packageDir, 'src/builders/builders.json'), 'utf8'),
    ) as { builders: Record<string, { implementation: string; schema: string }> };
    expect(builders.builders['dev-server']).toMatchObject({
      implementation: './dev-server/builder.cjs',
      schema: './dev-server/schema.json',
    });
  });

  it('builds a CommonJS builder the Angular CLI can load', async () => {
    await build({
      ...buildersConfig,
      config: false,
      cwd: packageDir,
      outDir: work,
      logLevel: 'silent',
    });
    const loaded = createRequire(join(work, 'package.json'))(
      join(work, 'builders/dev-server/builder.cjs'),
    ) as Record<symbol, unknown>;
    expect(loaded[BuilderSymbol]).toBe(true);
    expect(readFileSync(join(work, 'builders/builders.json'), 'utf8')).toContain('builder.cjs');
    expect(readFileSync(join(work, 'builders/dev-server/builder.cjs'), 'utf8')).toContain(
      'import("@pangular-inspector/devtools/hub")',
    );
  }, 60_000);
});
