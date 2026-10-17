#!/usr/bin/env node
/**
 * Publish the package to a local registry, create a fresh app the way a user does, install the
 * package into it from that registry, wire the documented setup, build it, and check the hub
 * answers.
 *
 * The workspace links `@pangular-inspector/devtools` to its TypeScript sources, so nothing else
 * here checks what npm actually gets: `publishConfig.exports`, the `files` list, the bundled panel
 * in `dist/public`, and dependencies that resolve by version from a registry.
 *
 * Nothing reaches npmjs. A throwaway Verdaccio serves `@pangular-inspector/*` itself, with no uplink
 * for the scope, so a package that failed to publish cannot be quietly satisfied by the real one.
 * Everything else is proxied to npmjs. The registry helpers live in `lib/local-registry.mjs`, which
 * `e2e-install.mjs` shares for the full install matrix.
 *
 * Scenarios (`--scenario=<name>`, `angular-cli` by default):
 *   angular-cli  `ng new --ssr` on the newest Angular the peer range allows, the Express hub in
 *                `server.ts` and the overlay in `main.ts`, a development build, then the built
 *                SSR server must answer `__connection.json` and serve the panel.
 *   analog       `create-analog`, the Vite plugin and the overlay, `vite build`, then the dev
 *                server must answer `__connection.json` and serve the panel.
 *
 * `--tarball=<file>` publishes that tarball instead of packing one, so the release checks the exact
 * file it then publishes to npm.
 *
 * Each run ends with the versions it resolved, in the log and, on GitHub Actions, in the job
 * summary, so a failure names the release that moved.
 *
 * Usage: node scripts/verify-publish.mjs [--scenario=angular-cli|analog] [--tarball=<file>]
 * Ports: 4873 (registry), 4874 (the app). Override with VERIFY_PORT (the registry; the app uses
 * the next one).
 */
import { appendFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  arg,
  checkHub,
  createRegistry,
  manifest,
  readJson,
  replaceIn,
  wireOverlayInMain,
} from './lib/local-registry.mjs';

const registryPort = Number(process.env.VERIFY_PORT ?? 4873);
const appPort = registryPort + 1;

const work = mkdtempSync(path.join(tmpdir(), 'pangular-verify-'));
const { run, start, stopAll, waitFor, startRegistry, pack, publish, registryEnv, newest } =
  createRegistry({ work, registryPort });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(130));

const OVERLAY_VITE = `bootstrapApplication(App, appConfig).then(() => {
  if (import.meta.env.DEV) void import('@pangular-inspector/devtools/overlay');
});`;

/** `ng new` with SSR, the Express hub (getting-started/express.md) and a development build. */
async function angularCli(version) {
  const range = manifest.peerDependencies['@angular/core'];
  const cli = newest('@angular/cli', range);
  console.log(`ng new web --ssr with @angular/cli@${cli} (peer range ${range})`);
  run(
    'npx',
    [
      '--yes',
      `@angular/cli@${cli}`,
      'new',
      'web',
      '--ssr',
      '--defaults',
      '--skip-git',
      '--skip-install',
      '--interactive=false',
    ],
    work,
  );
  const app = path.join(work, 'web');
  console.log(`installing ${manifest.name}@${version} and devframe from the registry`);
  run('npm', ['install', `${manifest.name}@${version}`, 'devframe'], app);

  const server = path.join(app, 'src/server.ts');
  replaceIn(
    server,
    "import express from 'express';",
    "import express from 'express';\nimport { initPangularHub } from '@pangular-inspector/devtools/hub';",
  );
  replaceIn(
    server,
    'const app = express();',
    'const app = express();\nconst devtools = initPangularHub({ ws: false });\napp.use(devtools.nodeMiddleware);',
  );
  wireOverlayInMain(path.join(app, 'src/main.ts'));

  console.log('ng build --configuration development');
  run('npx', ['ng', 'build', '--configuration', 'development'], app);

  console.log(`starting the built SSR server on ${appPort}`);
  const logFile = path.join(work, 'app.log');
  const child = start(
    process.execPath,
    ['dist/web/server/server.mjs'],
    app,
    { ...process.env, PORT: String(appPort) },
    logFile,
  );
  return { app, result: await checkHub(`http://localhost:${appPort}`, child, logFile, waitFor) };
}

/** `create-analog`, the Vite plugin (getting-started/vite.md), `vite build`, then the dev server. */
async function analog(version) {
  console.log('create-analog analog --template latest');
  run(
    'npx',
    ['--yes', 'create-analog@latest', 'analog', '--template', 'latest', '--skipTailwind'],
    work,
  );
  const app = path.join(work, 'analog');
  console.log(`installing ${manifest.name}@${version} and devframe from the registry`);
  run('npm', ['install', `${manifest.name}@${version}`, 'devframe'], app);

  const config = path.join(app, 'vite.config.ts');
  replaceIn(
    config,
    "import analog from '@analogjs/platform';",
    "import analog from '@analogjs/platform';\nimport pangular from '@pangular-inspector/devtools/vite';",
  );
  replaceIn(config, 'analog(),', 'analog(),\n    pangular(),');
  replaceIn(path.join(app, 'src/main.ts'), 'bootstrapApplication(App, appConfig);', OVERLAY_VITE);

  console.log('vite build');
  run('npx', ['vite', 'build'], app);

  // The plugin applies to `vite serve` only, so the hub is checked on the dev server.
  console.log(`starting the Vite dev server on ${appPort}`);
  const logFile = path.join(work, 'app.log');
  const child = start(
    process.execPath,
    [path.join(app, 'node_modules/vite/bin/vite.js'), '--port', String(appPort), '--strictPort'],
    app,
    registryEnv(),
    logFile,
  );
  return { app, result: await checkHub(`http://localhost:${appPort}`, child, logFile, waitFor) };
}

const SCENARIOS = { 'angular-cli': angularCli, analog };

/** What a failure most likely moved under us. */
const REPORTED = [
  manifest.name,
  '@angular/core',
  '@angular/build',
  '@angular/ssr',
  '@analogjs/platform',
  'vite',
  'express',
  'devframe',
  '@devframes/hub',
  'typescript',
];

function reportVersions(name, outcome, app) {
  const version = (pkg) => {
    const file = app && path.join(app, 'node_modules', pkg, 'package.json');
    return file && existsSync(file) ? readJson(file).version : '-';
  };
  const table = [
    `### ${name}: ${outcome}`,
    '',
    '| Package | Resolved |',
    '| --- | --- |',
    ...REPORTED.map((pkg) => `| \`${pkg}\` | ${version(pkg)} |`),
    '',
  ].join('\n');
  console.log(`\n${table}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, table);
}

const name = arg('scenario') ?? 'angular-cli';
if (!SCENARIOS[name]) {
  console.error(`No scenario "${name}". There are: ${Object.keys(SCENARIOS).join(', ')}.`);
  process.exit(1);
}

const started = Date.now();
const elapsed = () => `${Math.round((Date.now() - started) / 1000)}s`;
let app;
try {
  const given = arg('tarball');
  const tarball = given ? path.resolve(given) : pack();
  await startRegistry();
  const version = publish(tarball);
  const outcome = await SCENARIOS[name](version);
  app = outcome.app;
  console.log(`\nok  ${name}: ${outcome.result}, in ${elapsed()}`);
  reportVersions(name, `passed in ${elapsed()}`, app);
  stopAll();
  rmSync(work, { recursive: true, force: true });
} catch (error) {
  app ??= [path.join(work, 'web'), path.join(work, 'analog')].find(existsSync);
  reportVersions(name, `failed after ${elapsed()}`, app);
  console.error(`\n${error instanceof Error ? error.message : error}`);
  console.error(`\nThe registry, the app and their logs are left in ${work}`);
  stopAll();
  process.exit(1);
}
