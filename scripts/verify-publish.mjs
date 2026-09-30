#!/usr/bin/env node
/**
 * Publish the package to a local registry, create a fresh app the way a user does, install the
 * package into it from that registry, wire the documented setup, build it, and check the hub
 * answers.
 *
 * The workspace links `@santoshyadavdev/ng-devtools` to its TypeScript sources, so nothing else
 * here checks what npm actually gets: `publishConfig.exports`, the `files` list, the bundled panel
 * in `dist/public`, and dependencies that resolve by version from a registry.
 *
 * Nothing reaches npmjs. A throwaway Verdaccio serves `@santoshyadavdev/*` itself, with no uplink
 * for the scope, so a package that failed to publish cannot be quietly satisfied by the real one.
 * Everything else is proxied to npmjs.
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
import { execFileSync, spawn } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageDir = path.join(root, 'packages/ng-devtools');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const manifest = readJson(path.join(packageDir, 'package.json'));

const registryPort = Number(process.env.VERIFY_PORT ?? 4873);
const appPort = registryPort + 1;
const REGISTRY = `http://localhost:${registryPort}`;

const arg = (name) =>
  process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

const work = mkdtempSync(path.join(tmpdir(), 'ng-devtools-verify-'));
const children = new Set();

function stopAll() {
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }
  children.clear();
}
process.on('exit', stopAll);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(130));

/**
 * Every command after the publish runs against the local registry, with its own npm cache: each
 * run publishes the same version, and a cache keyed by name and version would hand back an older
 * build, or the real one from npmjs.
 */
const registryEnv = () => ({
  // Dropped in any case: setup-node exports NPM_CONFIG_USERCONFIG, which would compete with ours.
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^npm_config_(registry|userconfig|cache)$/i.test(key),
    ),
  ),
  npm_config_registry: REGISTRY,
  npm_config_userconfig: path.join(work, '.npmrc'),
  npm_config_cache: path.join(work, 'npm-cache'),
  npm_config_audit: 'false',
  npm_config_fund: 'false',
  npm_config_update_notifier: 'false',
  NG_CLI_ANALYTICS: 'false',
});

function run(cmd, args, cwd, env = registryEnv()) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(
      `${cmd} ${args.join(' ')} failed in ${cwd}:\n${error.stdout ?? ''}${error.stderr ?? ''}`,
    );
  }
}

/** A long-running process in its own group, so stopping it also stops what it started. */
function start(cmd, args, cwd, env, logFile) {
  const child = spawn(cmd, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  const log = (chunk) => appendFileSync(logFile, chunk);
  child.stdout.on('data', log);
  child.stderr.on('data', log);
  return child;
}

async function waitFor(url, child, logFile, seconds) {
  for (let tries = 0; tries < seconds; tries++) {
    const response = await fetch(url).catch(() => undefined);
    if (response?.ok) return response;
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${url} did not answer:\n${tail(logFile)}`);
}

const tail = (file) => (existsSync(file) ? readFileSync(file, 'utf8').slice(-4000) : '(no log)');

/** Replaces `from` with `to`, or fails naming the generated file that no longer has `from`. */
function replaceIn(file, from, to) {
  const text = readFileSync(file, 'utf8');
  if (!text.includes(from)) {
    throw new Error(`${file} no longer contains ${JSON.stringify(from)}:\n${text}`);
  }
  writeFileSync(file, text.replace(from, to));
}

async function startRegistry() {
  const storage = path.join(work, 'registry');
  mkdirSync(storage);
  const config = path.join(storage, 'config.yaml');
  writeFileSync(
    config,
    `storage: ./storage
auth:
  htpasswd:
    file: ./htpasswd
    max_users: 10
uplinks:
  npmjs:
    url: https://registry.npmjs.org/
max_body_size: 200mb
packages:
  '@santoshyadavdev/*':
    access: $all
    publish: $authenticated
    # No proxy: the package under test must come from this registry or not at all.
  '**':
    access: $all
    proxy: npmjs
log: { type: stdout, format: pretty, level: warn }
`,
  );
  const logFile = path.join(work, 'registry.log');
  console.log(`starting Verdaccio on ${REGISTRY}`);
  const child = start(
    'pnpm',
    ['dlx', 'verdaccio@6', '--config', config, '--listen', `localhost:${registryPort}`],
    storage,
    process.env,
    logFile,
  );
  await waitFor(`${REGISTRY}/-/ping`, child, logFile, 180);

  // Publishing needs a user. Verdaccio creates one on this request and returns its token.
  const response = await fetch(`${REGISTRY}/-/user/org.couchdb.user:verify`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'verify', password: 'verify-password' }),
  });
  const { token } = await response.json();
  if (!token) throw new Error(`Verdaccio returned no token (${response.status})`);
  writeFileSync(
    path.join(work, '.npmrc'),
    `registry=${REGISTRY}\n//localhost:${registryPort}/:_authToken=${token}\n`,
  );
}

/** `pnpm pack` applies `publishConfig.exports`, and its `prepack` builds the library and panel. */
function pack() {
  const out = path.join(work, 'pack');
  mkdirSync(out);
  console.log('packing the package (builds the library and the panel)');
  run('pnpm', ['pack', '--pack-destination', out], packageDir, process.env);
  const [file] = readdirSync(out).filter((name) => name.endsWith('.tgz'));
  if (!file) throw new Error(`pnpm pack wrote no tarball to ${out}`);
  return path.join(out, file);
}

/** Every entry point the published manifest exports has to be in the tarball. */
function checkTarball(tarball) {
  const files = new Set(run('tar', ['-tzf', tarball], work, process.env).split('\n'));
  const published = JSON.parse(run('tar', ['-xOzf', tarball, 'package/package.json'], work));
  const missing = Object.values(published.exports ?? {})
    .map((target) => path.posix.join('package', target))
    .filter((file) => !files.has(file));
  if (!files.has('package/dist/public/index.html')) missing.push('package/dist/public/index.html');
  if (missing.length) throw new Error(`the tarball is missing:\n  ${missing.join('\n  ')}`);
  return published.version;
}

function publish(tarball) {
  const version = checkTarball(tarball);
  console.log(`publishing ${manifest.name}@${version} to ${REGISTRY}`);
  run('npm', ['publish', tarball, '--registry', REGISTRY, '--access', 'public'], work);
  return version;
}

/** Compares two versions by major, minor and patch, with a prerelease sorting before its release. */
function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre = ''] = v.split('-', 2);
    return { parts: core.split('.').map(Number), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (x.parts[i] ?? 0) - (y.parts[i] ?? 0);
    if (diff) return diff;
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre.localeCompare(y.pre, 'en', { numeric: true });
}

/** The newest version of `name` inside `range`, from npmjs through the registry's proxy. */
function newest(name, range) {
  const found = JSON.parse(run('npm', ['view', `${name}@${range}`, 'version', '--json'], work));
  return Array.isArray(found) ? [...found].sort(compareVersions).at(-1) : found;
}

const OVERLAY_CLI = `bootstrapApplication(App, appConfig)
  .then(() => {
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      return import('@santoshyadavdev/ng-devtools/overlay');
    }
    return undefined;
  })
  .catch((err) => console.error(err));`;

const OVERLAY_VITE = `bootstrapApplication(App, appConfig).then(() => {
  if (import.meta.env.DEV) void import('@santoshyadavdev/ng-devtools/overlay');
});`;

/** The hub answers its connection file and serves the panel the package bundles. */
async function checkHub(base, child, logFile) {
  const connection = await waitFor(`${base}/__devframes/__connection.json`, child, logFile, 180);
  const text = await connection.text();
  try {
    JSON.parse(text);
  } catch {
    throw new Error(`__connection.json is not JSON:\n${text.slice(0, 500)}`);
  }
  const panelUrl = `${base}/__devframes/ng-devtools/`;
  const panel = await fetch(panelUrl);
  const html = await panel.text();
  if (!panel.ok || !html.includes('<title>Angular DevTools</title>')) {
    throw new Error(`the panel did not load (${panel.status}):\n${html.slice(0, 500)}`);
  }
  const script = /<script[^>]+src="([^"]+\.js)"/.exec(html)?.[1];
  if (!script) throw new Error(`the panel page names no script:\n${html.slice(0, 500)}`);
  const asset = await fetch(new URL(script, panelUrl));
  if (!asset.ok) throw new Error(`the panel script ${script} did not load (${asset.status})`);
  return 'the hub answers __connection.json and serves the panel and its script';
}

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
    "import express from 'express';\nimport { initNgDevtoolsHub } from '@santoshyadavdev/ng-devtools/hub';",
  );
  replaceIn(
    server,
    'const app = express();',
    'const app = express();\nconst devtools = initNgDevtoolsHub({ ws: false });\napp.use(devtools.nodeMiddleware);',
  );
  replaceIn(
    path.join(app, 'src/main.ts'),
    'bootstrapApplication(App, appConfig)\n  .catch((err) => console.error(err));',
    OVERLAY_CLI,
  );

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
  return { app, result: await checkHub(`http://localhost:${appPort}`, child, logFile) };
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
    "import analog from '@analogjs/platform';\nimport ngDevtools from '@santoshyadavdev/ng-devtools/vite';",
  );
  replaceIn(config, 'analog(),', 'analog(),\n    ngDevtools(),');
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
  return { app, result: await checkHub(`http://localhost:${appPort}`, child, logFile) };
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
