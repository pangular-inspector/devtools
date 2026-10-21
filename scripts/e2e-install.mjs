#!/usr/bin/env node
/**
 * The install and setup matrix: one packed tarball, published to a throwaway local registry, then
 * installed into fresh apps the way each setup guide in apps/docs/src/content/getting-started says.
 * Each cell builds the app, starts it, checks that `__connection.json` answers and the panel is
 * served, then opens the app and the panel in headless Chromium and waits for the Components tab
 * to show the app root.
 *
 * It builds on `verify-publish.mjs` (the registry helpers live in `lib/local-registry.mjs`), which
 * stays the quick weekly check. This one is the release check.
 *
 * Scenarios:
 *   angular-cli        `ng new --ssr`, the Express hub as quick-start.md shows, the overlay in
 *                      `main.ts`, `ng build --configuration development`, then the built SSR server.
 *   angular-cli-serve  The same app run with `ng serve`, the path quick-start.md takes.
 *   angular-cli-nossr  `ng new --ssr=false`, the client-only setup in installation.md:
 *                      `pangular dev --proxy-origin` next to `ng serve` with `proxy.conf.json`.
 *   analog             `create-analog`, the Vite plugin as vite.md shows (no overlay import), a
 *                      `vite build`, then the Vite dev server.
 *   cli                The standalone CLI in cli.md: `npx @pangular-inspector/devtools dev` without
 *                      installing, then the installed `pangular build` static report.
 *
 * Package managers: npm, pnpm, yarn and bun. One that is not installed is skipped and says so.
 * Angular versions: any npm range of `@angular/cli`, such as `20.0`, `20.3`, `21` or `22`. A
 * version with a minor pins the app's Angular packages to that minor. The default is the newest
 * the package's peer range allows.
 *
 * The package audit installs the tarball into an empty project and imports every entry point of the
 * published `exports` in Node, type-checks an import of each with `tsc --noEmit` (nodenext, bundler
 * and node10 resolution), and checks the tarball holds the bundled panel, the skills and the CLI.
 *
 * Usage:
 *   node scripts/e2e-install.mjs [--scenarios=a,b] [--pm=npm,pnpm] [--angular=20.0,22]
 *                                [--cells=angular-cli:pnpm:22,analog:npm] [--tarball=<file>]
 *                                [--report=<file.json>] [--no-audit] [--audit-only] [--keep]
 *                                [--logs=<dir>]
 *                                [--list]
 * With no matrix flags it runs every scenario on npm (Analog on pnpm) with the newest Angular, plus
 * the audit.
 *
 * Ports: the registry on VERIFY_PORT (4873 by default) and the apps on the ports after it, up to
 * three per cell.
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  arg,
  checkHub,
  checkPanelHtml,
  createRegistry,
  flag,
  manifest,
  readJson,
  replaceIn,
  tail,
  wireOverlayInMain,
} from './lib/local-registry.mjs';

const SCENARIOS = ['angular-cli', 'angular-cli-serve', 'angular-cli-nossr', 'analog', 'cli'];
const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'];
const PEER_RANGE = manifest.peerDependencies['@angular/core'];
/** The entry points a page imports, which must bundle with no Node builtins. */
const BROWSER_ENTRIES = [
  './overlay',
  './overlay-manual',
  './popup',
  './capacitor-hook',
  './store-hook',
  './startup-hook',
  './http',
  './overlay-angular-native',
  './overlay-nativescript',
  './config',
  './cd-data',
];

/** Packages whose versions each cell reports, so a failure names the release that moved. */
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

const list = (value) =>
  value
    ?.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

/** The cells to run, from `--cells` or from the product of the matrix flags. */
function plannedCells() {
  const explicit = list(arg('cells'));
  const cells = explicit
    ? explicit.map((entry) => {
        const [scenario, pm = 'npm', angular = 'newest'] = entry.split(':');
        return { scenario, pm, angular };
      })
    : (list(arg('scenarios')) ?? SCENARIOS).flatMap((scenario) =>
        // The create-analog template's `$vitest` override fails `npm install` on npm 10.
        (list(arg('pm')) ?? [scenario === 'analog' ? 'pnpm' : 'npm']).flatMap((pm) =>
          (list(arg('angular')) ?? ['newest']).map((angular) => ({ scenario, pm, angular })),
        ),
      );
  const seen = new Set();
  return cells
    .map((cell) => (cell.scenario === 'analog' ? { ...cell, angular: 'analog-latest' } : cell))
    .filter((cell) => {
      const key = `${cell.scenario}:${cell.pm}:${cell.angular}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const cells = plannedCells();
for (const cell of cells) {
  if (!SCENARIOS.includes(cell.scenario)) {
    console.error(`No scenario "${cell.scenario}". There are: ${SCENARIOS.join(', ')}.`);
    process.exit(1);
  }
  if (!PACKAGE_MANAGERS.includes(cell.pm)) {
    console.error(`No package manager "${cell.pm}". There are: ${PACKAGE_MANAGERS.join(', ')}.`);
    process.exit(1);
  }
}
const runAudit = !flag('no-audit');
const auditOnly = flag('audit-only');
if (flag('list')) {
  for (const cell of cells) console.log(`${cell.scenario}:${cell.pm}:${cell.angular}`);
  if (runAudit) console.log('package-audit');
  process.exit(0);
}

const registryPort = Number(process.env.VERIFY_PORT ?? 4873);
const work = mkdtempSync(path.join(tmpdir(), 'pangular-e2e-install-'));
const registry = createRegistry({ work, registryPort });
const { REGISTRY, registryEnv, run, start, stop, stopAll, waitFor, newest } = registry;
// An interrupted run removes its work folder too, so no multi-GB folder is left behind.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopAll();
    if (!flag('keep')) rmSync(work, { recursive: true, force: true });
    process.exit(130);
  });
}

/** Each package manager's commands, and the cache it keeps inside this run's work folder. */
const PM = {
  npm: {
    install: () => ['npm', ['install']],
    add: (pkgs, dev) => ['npm', ['install', ...(dev ? ['-D'] : []), ...pkgs]],
    exec: (bin, args) => ['npx', [bin, ...args]],
    dlx: (pkg, args) => ['npx', ['--yes', pkg, ...args]],
  },
  pnpm: {
    install: () => ['pnpm', ['install']],
    add: (pkgs, dev) => ['pnpm', ['add', ...(dev ? ['-D'] : []), ...pkgs]],
    exec: (bin, args) => ['pnpm', ['exec', bin, ...args]],
    dlx: (pkg, args) => ['pnpm', ['dlx', pkg, ...args]],
  },
  yarn: {
    install: () => ['yarn', ['install']],
    add: (pkgs, dev) => ['yarn', ['add', ...(dev ? ['-D'] : []), ...pkgs]],
    exec: (bin, args) => ['yarn', [bin, ...args]],
    // Yarn 1 has no dlx; cli.md names `yarn dlx -p`, which needs Yarn 2 or later.
    dlx: (pkg, args) =>
      yarnMajor() >= 2 ? ['yarn', ['dlx', pkg, ...args]] : ['npx', ['--yes', pkg, ...args]],
  },
  bun: {
    install: () => ['bun', ['install']],
    add: (pkgs, dev) => ['bun', ['add', ...(dev ? ['-D'] : []), ...pkgs]],
    exec: (bin, args) => ['bunx', [bin, ...args]],
    dlx: (pkg, args) => ['bunx', [pkg, ...args]],
  },
};

const pmVersions = {};
function pmVersion(pm) {
  if (!(pm in pmVersions)) {
    try {
      pmVersions[pm] = execFileSync(pm, ['--version'], { encoding: 'utf8' }).trim();
    } catch {
      pmVersions[pm] = undefined;
    }
  }
  return pmVersions[pm];
}
const yarnMajor = () => Number(pmVersion('yarn')?.split('.')[0] ?? 0);

/** The registry env, plus a cache per package manager in the work folder. */
const pmEnv = () => ({
  ...registryEnv(),
  npm_config_store_dir: path.join(work, 'pnpm-store'),
  YARN_CACHE_FOLDER: path.join(work, 'yarn-cache'),
  YARN_REGISTRY: REGISTRY,
  // Yarn 2 and later read neither `.yarnrc` nor YARN_REGISTRY, and refuse a plain http registry.
  YARN_NPM_REGISTRY_SERVER: REGISTRY,
  YARN_UNSAFE_HTTP_WHITELIST: new URL(REGISTRY).hostname,
  BUN_INSTALL_CACHE_DIR: path.join(work, 'bun-cache'),
  BUN_CONFIG_REGISTRY: REGISTRY,
});

/** Points every package manager in `dir` at the local registry. */
function useRegistry(dir) {
  writeFileSync(path.join(dir, '.npmrc'), `registry=${REGISTRY}/\n`);
  writeFileSync(path.join(dir, '.yarnrc'), `registry "${REGISTRY}/"\n`);
  writeFileSync(
    path.join(dir, 'bunfig.toml'),
    `[install]\nregistry = "${REGISTRY}/"\n\n[install.cache]\ndir = "${path.join(work, 'bun-cache')}"\n`,
  );
}

const pmRun = (cell, [cmd, args], cwd) => run(cmd, args, cwd, pmEnv());

/** What a package manager prints when the registry could not fetch a package from npmjs. */
const REGISTRY_FETCH_ERROR =
  /is not in the npm registry|ERR_PNPM_FETCH|ERR_PNPM_META_FETCH|ETIMEDOUT|ECONNRESET|EAI_AGAIN|socket hang up/;

/**
 * The cell's dependency install. The local registry fetches every dependency except the package
 * under test from npmjs, and one fetch can fail on the way, so a fetch error is retried once.
 */
function installDependencies(cell, app) {
  try {
    return pmRun(cell, PM[cell.pm].install(), app);
  } catch (error) {
    if (!REGISTRY_FETCH_ERROR.test(String(error))) throw error;
    log(cell, 'the registry could not fetch a package from npmjs; installing again');
    pmRun(cell, PM[cell.pm].install(), app);
    return 'installed on the second try, after a registry fetch error';
  }
}

/** A port in this cell's block that nothing listens on, or an error naming it. */
async function freePort(port) {
  await new Promise((done, fail) => {
    const server = createNetServer();
    server.once('error', () => fail(new Error(`port ${port} is already in use`)));
    server.listen(port, 'localhost', () => server.close(done));
  });
  return port;
}

/** The env for an app server: development, so the hub and the overlay are on. */
function devEnv(extra = {}) {
  const env = { ...pmEnv(), ...extra };
  delete env.NODE_ENV;
  return env;
}

// ---------------------------------------------------------------------------------------------
// The browser checks

let browserPromise;
async function browser() {
  browserPromise ??= import('playwright').then(({ chromium }) =>
    chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  );
  return browserPromise;
}

/** The newest one-time code a server printed, from its `#devframe_otp=` link or its box. */
async function oneTimeCode(logFile, seconds = 30) {
  for (let tries = 0; tries < seconds * 2; tries++) {
    const log = existsSync(logFile)
      ? readFileSync(logFile, 'utf8').replace(/\x1b\[[0-9;]*m/g, '')
      : '';
    const codes = [
      ...log.matchAll(/devframe_otp=(\d{4,8})/g),
      ...log.matchAll(/auth code\D{0,40}?(\d{6})/gi),
    ];
    if (codes.length) return codes.sort((a, b) => a.index - b.index).at(-1)[1];
    await new Promise((done) => setTimeout(done, 500));
  }
  return undefined;
}

const ROOT_ROW = /app-root|\bApp(Component)?\b/;

/**
 * Opens the app page (when there is one) and waits for the overlay's button, then opens the panel
 * with the one-time code the server printed and waits for the Components tab to list the root.
 */
async function checkInBrowser(cell, { appUrl, panelUrl, codeLog, live = true }) {
  const context = await (await browser()).newContext({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];
  const shot = (name) => path.join(cell.dir, `${name}.png`);
  let app;
  try {
    if (appUrl) {
      app = await context.newPage();
      app.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300));
      });
      app.on('response', (response) => {
        if (response.status() >= 400)
          consoleErrors.push(`HTTP ${response.status()} ${response.url()}`);
      });
      app.on('pageerror', (error) =>
        consoleErrors.push(`pageerror: ${error.message.slice(0, 300)}`),
      );
      await app.goto(appUrl, { waitUntil: 'load', timeout: 120_000 });
      await app
        .getByRole('button', { name: 'Toggle Pangular Inspector' })
        .first()
        .waitFor({ timeout: 45_000 })
        .catch(async () => {
          await app.screenshot({ path: shot('app') }).catch(() => {});
          throw new Error(
            `the overlay's button never appeared on ${appUrl}. Console errors:\n${consoleErrors.join('\n') || '(none)'}`,
          );
        });
    } else {
      // No page: the panel's own connection makes the server print the code. A hash change on
      // the same page would not reload it, so the panel opens again in a new page below.
      const probe = await context.newPage();
      await probe.goto(panelUrl, { waitUntil: 'load', timeout: 60_000 });
      await probe.waitForTimeout(3000);
      await probe.close();
    }
    const code = codeLog ? await oneTimeCode(codeLog) : undefined;
    if (codeLog && !code) {
      throw new Error(`no one-time code was printed in ${codeLog}:\n${tail(codeLog, 1500)}`);
    }
    const panel = await context.newPage();
    const hash = `${code ? `devframe_otp=${code}&` : ''}tab=components`;
    await panel.goto(`${panelUrl}#${hash}`, { waitUntil: 'load', timeout: 60_000 });
    const connected = await panel
      .locator('.status.connected')
      .first()
      .waitFor({ timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (live && !connected) {
      await panel.screenshot({ path: shot('panel') }).catch(() => {});
      const text = (
        await panel
          .locator('body')
          .innerText()
          .catch(() => '')
      ).slice(0, 800);
      throw new Error(`the panel never showed Live (no .status.connected). Panel text:\n${text}`);
    }
    // A live page fills the instance tree; with no page the tab lists what the source declares.
    const row = live
      ? panel.getByRole('treeitem').filter({ hasText: ROOT_ROW }).first()
      : panel.getByText('<app-root>', { exact: true }).first();
    const found = await row
      .waitFor({ timeout: 45_000 })
      .then(() => true)
      .catch(() => false);
    if (!found) {
      await panel.screenshot({ path: shot('panel') }).catch(() => {});
      const text = (
        await panel
          .locator('body')
          .innerText()
          .catch(() => '')
      ).slice(0, 1200);
      throw new Error(
        `the Components tab never listed the app root. Panel text:\n${text}\nApp console errors:\n${consoleErrors.join('\n') || '(none)'}`,
      );
    }
    const label = (await row.innerText()).replace(/\s+/g, ' ').trim().slice(0, 80);
    if (consoleErrors.length)
      cell.consoleErrors = [...(cell.consoleErrors ?? []), ...consoleErrors];
    return `panel ${connected ? 'Live' : 'not Live'}, Components shows "${label}"${consoleErrors.length ? `; ${consoleErrors.length} console error(s) on the app page` : ''}`;
  } finally {
    await context.close();
  }
}

/** Serves a folder of static files, the way a user hosts the static report. */
function serveStatic(dir, port) {
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
  };
  const server = createHttpServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    let file = path.join(dir, decodeURIComponent(url.pathname));
    if (!file.startsWith(dir)) file = dir;
    if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404).end('not found');
      return;
    }
    response.writeHead(200, {
      'content-type': types[path.extname(file)] ?? 'application/octet-stream',
    });
    createReadStream(file).pipe(response);
  });
  return new Promise((done) => server.listen(port, 'localhost', () => done(server)));
}

// ---------------------------------------------------------------------------------------------
// The scenarios

/** `ng new` with the package manager and Angular version of the cell, then an install. */
async function newAngularApp(cell, { ssr }) {
  const range = cell.angular === 'newest' ? PEER_RANGE : cell.angular;
  const cli = newest('@angular/cli', range);
  cell.angularCli = cli;
  await step(
    cell,
    `ng new web --ssr=${ssr} --package-manager=${cell.pm} (@angular/cli@${cli})`,
    () =>
      run(
        'npx',
        [
          '--yes',
          `@angular/cli@${cli}`,
          'new',
          'web',
          `--ssr=${ssr}`,
          '--defaults',
          '--skip-git',
          '--skip-install',
          '--interactive=false',
          `--package-manager=${cell.pm}`,
        ],
        cell.dir,
        pmEnv(),
      ),
  );
  const app = path.join(cell.dir, 'web');
  // `^20.0.0` would install the newest 20.x; a version with a minor stays on that minor.
  if (/^\d+\.\d+$/.test(cell.angular)) {
    const file = path.join(app, 'package.json');
    const pkg = readJson(file);
    for (const field of ['dependencies', 'devDependencies']) {
      for (const [name, version] of Object.entries(pkg[field] ?? {})) {
        if (name.startsWith('@angular/') && version.startsWith('^')) {
          pkg[field][name] = `~${version.slice(1)}`;
        }
      }
    }
    writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  }
  useRegistry(app);
  await step(cell, `${cell.pm} install`, () => installDependencies(cell, app));
  return app;
}

/** Checks the package manager installed the version this run published. */
function checkInstalled(cell, app) {
  const file = path.join(app, 'node_modules', manifest.name, 'package.json');
  if (!existsSync(file)) throw new Error(`${manifest.name} is not in ${app}/node_modules`);
  const installed = readJson(file).version;
  if (installed !== cell.version) {
    throw new Error(`installed ${manifest.name}@${installed}, expected ${cell.version}`);
  }
}

const ngBin = (app) => path.join(app, 'node_modules/.bin/ng');

/** quick-start.md, "Mount the hub" and "Load the overlay". */
function wireExpressHub(app) {
  const server = path.join(app, 'src/server.ts');
  replaceIn(
    server,
    "import express from 'express';",
    "import express from 'express';\nimport { initPangularHub } from '@pangular-inspector/devtools/hub';",
  );
  replaceIn(
    server,
    'const angularApp = new AngularNodeAppEngine();',
    'const angularApp = new AngularNodeAppEngine();\n// Before express.static and the Angular handler, so the devtools routes answer first.\nconst devtools = initPangularHub({ ws: false });\napp.use(devtools.nodeMiddleware);',
  );
  wireOverlay(app);
}

function wireOverlay(app) {
  wireOverlayInMain(path.join(app, 'src/main.ts'));
}

/** angular-cli and angular-cli-serve: quick-start.md, on the built SSR server or `ng serve`. */
async function angularCli(cell, { serve }) {
  const app = await newAngularApp(cell, { ssr: true });
  cell.app = app;
  // quick-start.md: "Install it as a dependency, not a dev dependency".
  await step(cell, 'install the package', () => {
    pmRun(cell, PM[cell.pm].add([manifest.name], false), app);
    checkInstalled(cell, app);
  });
  await step(cell, 'wire server.ts and main.ts', () => wireExpressHub(app));
  await step(cell, 'ng build --configuration development', () =>
    run(ngBin(app), ['build', '--configuration', 'development'], app, pmEnv()),
  );
  const port = await freePort(cell.ports[0]);
  const base = `http://localhost:${port}`;
  const logFile = path.join(cell.dir, 'app.log');
  // From Angular 22.2 the built server refuses every host until `allowedHosts` names it (an empty
  // list in angular.json); express.md does not say so yet. NG_ALLOWED_HOSTS is Angular's own switch.
  const child = serve
    ? start(ngBin(app), ['serve', '--port', String(port)], app, devEnv(), logFile)
    : start(
        process.execPath,
        ['dist/web/server/server.mjs'],
        app,
        devEnv({ PORT: String(port), NG_ALLOWED_HOSTS: 'localhost' }),
        logFile,
      );
  cell.logs.push(logFile);
  try {
    await step(cell, serve ? 'ng serve: hub answers' : 'SSR server: hub answers', () =>
      checkHub(base, child, logFile, waitFor),
    );
    await step(cell, 'full-page hub /__devframes/', () => checkStatus(`${base}/__devframes/`));
    return await step(cell, 'browser: panel connects to the page', () =>
      checkInBrowser(cell, {
        appUrl: `${base}/`,
        panelUrl: `${base}/__devframes/pangular/`,
        codeLog: logFile,
      }),
    );
  } finally {
    await stop(child);
  }
}

async function checkStatus(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return `${url} answers ${response.status}`;
}

/** angular-cli-nossr: installation.md, "Client-only Angular CLI app". */
async function angularCliNoSsr(cell) {
  const app = await newAngularApp(cell, { ssr: false });
  cell.app = app;
  const [appPort, cliPort] = [await freePort(cell.ports[0]), await freePort(cell.ports[1])];
  // installation.md, "Dependency or dev dependency": a client-only app installs it as a dev dependency.
  await step(cell, 'install the package', () => {
    pmRun(cell, PM[cell.pm].add([manifest.name], true), app);
    checkInstalled(cell, app);
  });
  await step(cell, 'wire proxy.conf.json, angular.json and main.ts', () => {
    // The proxy config as installation.md prints it, with our ports instead of 9999 and 4200.
    writeFileSync(
      path.join(app, 'proxy.conf.json'),
      `// proxy.conf.json
{
  "/__pangular": {
    "target": "http://localhost:${cliPort}",
    "pathRewrite": {"^/__pangular": ""},
    "ws": true
  }
}
`,
    );
    const file = path.join(app, 'angular.json');
    const config = readJson(file);
    const project = Object.values(config.projects)[0];
    project.architect.serve.options = {
      ...project.architect.serve.options,
      proxyConfig: 'proxy.conf.json',
    };
    writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
    wireOverlay(app);
  });
  await step(cell, 'ng build --configuration development', () =>
    run(ngBin(app), ['build', '--configuration', 'development'], app, pmEnv()),
  );
  const cliLog = path.join(cell.dir, 'pangular-dev.log');
  const appLog = path.join(cell.dir, 'ng-serve.log');
  cell.logs.push(cliLog, appLog);
  const [cmd, args] = PM[cell.pm].exec('pangular', [
    'dev',
    '--port',
    String(cliPort),
    '--proxy-origin',
    `http://localhost:${appPort}`,
  ]);
  const cli = start(cmd, args, app, devEnv(), cliLog);
  const ng = start(ngBin(app), ['serve', '--port', String(appPort)], app, devEnv(), appLog);
  try {
    await step(cell, 'pangular dev answers', () =>
      checkHub(`http://localhost:${cliPort}`, cli, cliLog, waitFor, {
        connection: '/__connection.json',
        panel: '/',
      }),
    );
    await step(cell, 'ng serve proxies /__pangular/', () =>
      checkHub(`http://localhost:${appPort}`, ng, appLog, waitFor, {
        connection: '/__pangular/__connection.json',
        panel: '/__pangular/',
      }),
    );
    return await step(cell, 'browser: panel connects to the page', () =>
      checkInBrowser(cell, {
        appUrl: `http://localhost:${appPort}/`,
        panelUrl: `http://localhost:${appPort}/__pangular/`,
        codeLog: cliLog,
      }),
    );
  } finally {
    await stop(ng);
    await stop(cli);
  }
}

/** analog: vite.md, the plugin next to `analog()` and nothing in `main.ts`. */
async function analog(cell) {
  await step(cell, 'npx create-analog@latest analog --template latest --skipTailwind', () =>
    run(
      'npx',
      ['--yes', 'create-analog@latest', 'analog', '--template', 'latest', '--skipTailwind'],
      cell.dir,
      pmEnv(),
    ),
  );
  const app = path.join(cell.dir, 'analog');
  cell.app = app;
  useRegistry(app);
  if (cell.pm === 'pnpm') {
    // The workaround in analog.md ("If the build fails under pnpm"). @analogjs/vite-plugin-nitro
    // (2.7.0 to 2.8.1 at least) imports `h3` without declaring it; with this package's h3 2 (from
    // devframe) in the tree, pnpm can hoist h3 2 and `vite build` fails on the missing
    // `createEvent`. Remove this once the plugin declares h3.
    await step(cell, 'pnpm-workspace.yaml: declare h3 for @analogjs/vite-plugin-nitro', () => {
      const file = path.join(app, 'pnpm-workspace.yaml');
      const text = existsSync(file) ? readFileSync(file, 'utf8') : '';
      if (/^packageExtensions:/m.test(text)) {
        throw new Error(`${file} already has packageExtensions:\n${text}`);
      }
      writeFileSync(
        file,
        `${text}${text && !text.endsWith('\n') ? '\n' : ''}packageExtensions:\n  '@analogjs/vite-plugin-nitro':\n    dependencies:\n      h3: ^1.15.0\n`,
      );
    });
  }
  await step(cell, `${cell.pm} install`, () => installDependencies(cell, app));
  // vite.md: "Add @pangular-inspector/devtools as a dev dependency."
  await step(cell, 'install the package', () => {
    pmRun(cell, PM[cell.pm].add([manifest.name], true), app);
    checkInstalled(cell, app);
  });
  await step(cell, 'wire vite.config.ts', () => {
    const config = path.join(app, 'vite.config.ts');
    replaceIn(
      config,
      "import analog from '@analogjs/platform';",
      "import analog from '@analogjs/platform';\nimport pangular from '@pangular-inspector/devtools/vite';",
    );
    const text = readFileSync(config, 'utf8');
    // `analog(...)` with or without options, then `pangular()` after it.
    const match = /analog\((?:[^()]|\([^()]*\))*\)/.exec(text.slice(text.indexOf('plugins')));
    if (!match) throw new Error(`no analog() call in the plugins of ${config}:\n${text}`);
    replaceIn(config, match[0], `${match[0]},\n    pangular()`);
  });
  const vite = path.join(app, 'node_modules/.bin/vite');
  await step(cell, 'vite build', () => run(vite, ['build'], app, pmEnv()));
  const port = await freePort(cell.ports[0]);
  const base = `http://localhost:${port}`;
  const logFile = path.join(cell.dir, 'vite.log');
  cell.logs.push(logFile);
  const child = start(vite, ['--port', String(port), '--strictPort'], app, devEnv(), logFile);
  try {
    await step(cell, 'vite dev server: hub answers', () => checkHub(base, child, logFile, waitFor));
    return await step(cell, 'browser: panel connects to the page', () =>
      checkInBrowser(cell, {
        appUrl: `${base}/`,
        panelUrl: `${base}/__devframes/pangular/`,
        codeLog: logFile,
      }),
    );
  } finally {
    await stop(child);
  }
}

/** cli: cli.md, `dev` without installing, then the installed `pangular build`. */
async function cliScenario(cell) {
  const app = await newAngularApp(cell, { ssr: false });
  cell.app = app;
  const [devPort, reportPort] = [await freePort(cell.ports[0]), await freePort(cell.ports[1])];
  const devLog = path.join(cell.dir, 'pangular-dev.log');
  cell.logs.push(devLog);
  // cli.md, "Run it without installing": `npx @pangular-inspector/devtools dev`.
  const [cmd, args] = PM[cell.pm].dlx(manifest.name, ['dev', '--port', String(devPort)]);
  const dev = start(cmd, args, app, devEnv(), devLog);
  try {
    const base = `http://localhost:${devPort}`;
    await step(cell, `${[cmd, ...args].join(' ')}: server answers`, () =>
      checkHub(base, dev, devLog, waitFor, { connection: '/__connection.json', panel: '/' }),
    );
    await step(cell, 'browser: the dev panel shows the source scan', () =>
      checkInBrowser(cell, { panelUrl: `${base}/`, codeLog: devLog, live: false }),
    );
  } finally {
    await stop(dev);
  }
  await step(cell, 'install the package', () => {
    pmRun(cell, PM[cell.pm].add([manifest.name], true), app);
    checkInstalled(cell, app);
  });
  const outDir = path.join(app, 'dist-report');
  await step(cell, 'pangular build --outDir dist-report', () => {
    const [buildCmd, buildArgs] = PM[cell.pm].exec('pangular', [
      'build',
      '--outDir',
      'dist-report',
    ]);
    run(buildCmd, buildArgs, app, pmEnv());
    for (const file of ['index.html', '__connection.json']) {
      if (!existsSync(path.join(outDir, file))) throw new Error(`the report has no ${file}`);
    }
    const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
    if (!html.includes('<title>Pangular Inspector</title>')) {
      throw new Error(`the report's index.html is not the panel:\n${html.slice(0, 500)}`);
    }
    return `${readdirSync(outDir).length} entries in dist-report`;
  });
  const server = await serveStatic(outDir, reportPort);
  try {
    const base = `http://localhost:${reportPort}`;
    await step(cell, 'static report: panel HTML and script', () => checkPanelHtml(`${base}/`));
    return await step(cell, 'browser: the static report shows the source scan', () =>
      checkInBrowser(cell, { panelUrl: `${base}/`, live: false }),
    );
  } finally {
    server.close();
  }
}

const RUNNERS = {
  'angular-cli': (cell) => angularCli(cell, { serve: false }),
  'angular-cli-serve': (cell) => angularCli(cell, { serve: true }),
  'angular-cli-nossr': angularCliNoSsr,
  analog,
  cli: cliScenario,
};

// ---------------------------------------------------------------------------------------------
// The package audit (Phase 8)

async function packageAudit(tarball, version) {
  const result = {
    name: 'package-audit',
    steps: [],
    status: 'pass',
    dir: path.join(work, 'audit'),
  };
  const dir = result.dir;
  mkdirSync(dir);
  const started = Date.now();
  try {
    const { files, published } = registry.readTarball(tarball);
    await step(result, 'tarball: files', () => {
      const missing = [];
      const has = (file) => files.has(`package/${file}`);
      for (const [subpath, target] of Object.entries(published.exports ?? {})) {
        if (!has(target.replace(/^\.\//, ''))) missing.push(`${subpath} -> ${target}`);
        if (target.endsWith('.mjs')) {
          const types = target.replace(/^\.\//, '').replace(/\.mjs$/, '.d.mts');
          if (!has(types)) missing.push(`${subpath} types -> ${types}`);
        }
      }
      for (const file of ['dist/public/index.html', 'bin.mjs', 'package.json']) {
        if (!has(file)) missing.push(file);
      }
      if (![...files].some((file) => file.startsWith('package/skills/'))) missing.push('skills/');
      const html = run(
        'tar',
        ['-xOzf', tarball, 'package/dist/public/index.html'],
        work,
        process.env,
      );
      for (const asset of html.matchAll(/(?:src|href)="(?!https?:|data:|#)\.?\/?([^"]+)"/g)) {
        const file = `dist/public/${asset[1]}`;
        if (/\.(js|css)$/.test(file) && !has(file)) missing.push(`panel asset ${file}`);
      }
      if (published.exports?.['.'] && !published.exports['.'].startsWith('./dist/')) {
        missing.push(`exports "." points at ${published.exports['.']}, not the build`);
      }
      if (missing.length) throw new Error(`the tarball is missing:\n  ${missing.join('\n  ')}`);
      return `${files.size - 1} files, ${Object.keys(published.exports).length} exports, panel bundled`;
    });

    writeFileSync(
      path.join(dir, 'package.json'),
      `${JSON.stringify({ name: 'audit', private: true, type: 'module' }, null, 2)}\n`,
    );
    useRegistry(dir);
    await step(result, 'npm install the tarball and its peers', () =>
      run(
        'npm',
        [
          'install',
          `${manifest.name}@${version}`,
          '@angular/core',
          '@angular/common',
          '@angular/compiler',
          'rxjs',
          'vite',
          'typescript',
          // node10 resolution reads `typesVersions`; TypeScript 7 removed it, so it runs on 5.x.
          'typescript5@npm:typescript@5',
          'esbuild',
          '@types/node',
        ],
        dir,
        pmEnv(),
      ),
    );
    const subpaths = Object.keys(published.exports).filter(
      (subpath) => subpath !== './package.json',
    );
    const specifier = (subpath) =>
      subpath === '.' ? manifest.name : `${manifest.name}/${subpath.slice(2)}`;

    // The entry points a page imports must bundle for the browser, as the Angular CLI and Vite do.
    // A Node builtin anywhere in their graph fails the app's build.
    result.browserBundles = {};
    await step(result, 'esbuild: browser entry points bundle for the browser', async () => {
      const { build } = await import(path.join(dir, 'node_modules/esbuild/lib/main.js'));
      const failed = [];
      for (const subpath of BROWSER_ENTRIES.filter((entry) => published.exports[entry])) {
        const spec = specifier(subpath);
        const problem = await build({
          stdin: { contents: `import ${JSON.stringify(spec)};`, resolveDir: dir },
          bundle: true,
          write: false,
          platform: 'browser',
          format: 'esm',
          logLevel: 'silent',
          external: ['@angular/*', 'rxjs', 'rxjs/*', '@nativescript/*', '@capacitor/*'],
        }).then(
          () => undefined,
          (error) =>
            error.errors
              .map((entry) => `${entry.text} (${entry.location?.file}:${entry.location?.line})`)
              .join('; '),
        );
        result.browserBundles[spec] = problem ?? 'ok';
        if (problem) failed.push(`${spec}: ${problem}`);
      }
      if (failed.length) {
        throw new Error(
          `${failed.length} browser entry points do not bundle for the browser:\n  ${failed.join('\n  ')}`,
        );
      }
      return `${Object.keys(result.browserBundles).length} browser entry points bundle`;
    }).catch(() => {
      // Recorded; the other checks still run.
    });

    result.imports = {};
    await step(result, 'node: import every entry point', () => {
      const failed = [];
      for (const subpath of subpaths) {
        const spec = specifier(subpath);
        try {
          const out = execFileSync(
            process.execPath,
            [
              '--input-type=module',
              '-e',
              // Angular's partially compiled packages need the JIT compiler outside a build.
              `await import('@angular/compiler'); const m = await import(${JSON.stringify(spec)}); console.log(Object.keys(m).join(','));`,
            ],
            { cwd: dir, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] },
          );
          result.imports[spec] = { ok: true, exports: out.trim().split(',').filter(Boolean) };
        } catch (error) {
          const message =
            `${error.stderr ?? error.message}`
              .split('\n')
              .find((line) => /Error|error/.test(line)) ?? `${error.message}`;
          const peer = /Cannot find package '([^']+)'/.exec(message)?.[1];
          if (peer && published.peerDependenciesMeta?.[peer]?.optional) {
            // An entry point for a platform whose optional peer this project does not install.
            result.imports[spec] = { ok: true, skipped: `needs the optional peer ${peer}` };
            continue;
          }
          result.imports[spec] = { ok: false, error: message.trim().slice(0, 300) };
          failed.push(`${spec}: ${message.trim().slice(0, 300)}`);
        }
      }
      if (failed.length)
        throw new Error(
          `${failed.length} of ${subpaths.length} failed to import in Node:\n  ${failed.join('\n  ')}`,
        );
      return `${subpaths.length} entry points import`;
    }).catch(() => {
      // Recorded; the type checks still run.
    });

    // An import of each entry point, plus the named imports the guides use.
    const lines = subpaths.map(
      (subpath, index) => `import * as entry${index} from '${specifier(subpath)}';`,
    );
    lines.push(
      "import { initPangularHub } from '@pangular-inspector/devtools/hub';",
      "import pangular from '@pangular-inspector/devtools/vite';",
      "import pangularDevframe, { initDevframe } from '@pangular-inspector/devtools/devframe';",
      "import type { PangularConfig } from '@pangular-inspector/devtools/config';",
      "import { createDevtoolsPopup } from '@pangular-inspector/devtools/popup';",
      "import { providePangularHttp, withPangular } from '@pangular-inspector/devtools/http';",
      `export const all = [${subpaths.map((_, index) => `entry${index}`).join(', ')}];`,
      'export const named = [initPangularHub, pangular, pangularDevframe, initDevframe, createDevtoolsPopup, providePangularHttp, withPangular];',
      'export const config: PangularConfig | undefined = undefined;',
    );
    writeFileSync(path.join(dir, 'check.ts'), `${lines.join('\n')}\n`);
    const tsVersion = (pkg) =>
      readJson(path.join(dir, 'node_modules', pkg, 'package.json')).version;
    result.typescript = {
      typescript: tsVersion('typescript'),
      typescript5: tsVersion('typescript5'),
    };
    result.typecheck = {};
    const ts = { latest: 'typescript', 5: 'typescript5' };
    for (const [label, tsPackage, options] of [
      ['nodenext', ts.latest, { module: 'nodenext', moduleResolution: 'nodenext' }],
      ['bundler', ts.latest, { module: 'esnext', moduleResolution: 'bundler' }],
      ['nodenext', ts[5], { module: 'nodenext', moduleResolution: 'nodenext' }],
      ['bundler', ts[5], { module: 'esnext', moduleResolution: 'bundler' }],
      // node10 reads `typesVersions`; TypeScript 7 removed it.
      ['node10', ts[5], { module: 'esnext', moduleResolution: 'node10' }],
    ]) {
      // skipLibCheck on is the gate (do the types resolve and match the guides); off is reported.
      for (const skipLibCheck of [true, false]) {
        const version = tsVersion(tsPackage);
        const name = `tsc ${version} ${label}${skipLibCheck ? '' : ' (skipLibCheck off, informational)'}`;
        const config = `tsconfig.${tsPackage}.${label}${skipLibCheck ? '' : '.strict'}.json`;
        writeFileSync(
          path.join(dir, config),
          JSON.stringify({
            compilerOptions: {
              ...options,
              target: 'es2022',
              lib: ['es2022', 'dom'],
              strict: true,
              noEmit: true,
              skipLibCheck,
              types: ['node'],
            },
            files: ['check.ts'],
          }),
        );
        const tsc = () =>
          run(process.execPath, [`node_modules/${tsPackage}/bin/tsc`, '-p', config], dir, pmEnv());
        if (skipLibCheck) {
          const outcome = await step(result, name, tsc).catch((error) => error);
          result.typecheck[name] = outcome instanceof Error ? outcome.message.slice(0, 4000) : 'ok';
        } else {
          try {
            tsc();
            result.typecheck[name] = 'ok';
          } catch (error) {
            result.typecheck[name] = error.message.slice(0, 4000);
          }
        }
      }
    }
  } catch (error) {
    result.error ??= error.message;
  }
  result.status = result.steps.every((entry) => entry.ok) ? 'pass' : 'fail';
  result.seconds = Math.round((Date.now() - started) / 1000);
  return result;
}

// ---------------------------------------------------------------------------------------------
// Running and reporting

function log(cell, message) {
  console.log(`  [${cell.name}] ${message}`);
}

/** Runs one step of a cell, records how it went, and rethrows a failure. */
async function step(cell, name, fn) {
  const started = Date.now();
  log(cell, `${name} ...`);
  try {
    const note = await fn();
    const entry = { name, ok: true, seconds: Math.round((Date.now() - started) / 1000) };
    if (typeof note === 'string') entry.note = note.slice(0, 300);
    cell.steps.push(entry);
    return note;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cell.steps.push({
      name,
      ok: false,
      seconds: Math.round((Date.now() - started) / 1000),
      error: message.slice(-6000),
    });
    log(cell, `FAILED: ${name}`);
    throw error;
  }
}

/** The line of a failure worth reading first: the last error line, without npm's warnings. */
function summarize(message) {
  const lines = message
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        !/^npm warn/i.test(line) &&
        !/^at /.test(line) &&
        !/complete log of this run/.test(line),
    );
  const errors = lines.filter((line) => /error|ERR_|failed|never|not |cannot|missing/i.test(line));
  return (errors.at(-1) ?? lines.at(-1) ?? message).slice(0, 240);
}

function versionsIn(app) {
  return Object.fromEntries(
    REPORTED.map((pkg) => {
      const file = app && path.join(app, 'node_modules', pkg, 'package.json');
      return [pkg, file && existsSync(file) ? readJson(file).version : '-'];
    }),
  );
}

async function runCell(cell) {
  cell.name = `${cell.scenario}:${cell.pm}:${cell.angular}`;
  cell.steps = [];
  cell.logs = [];
  const started = Date.now();
  const available = pmVersion(cell.pm);
  if (!available) {
    console.log(`\nskip ${cell.name}: ${cell.pm} is not installed`);
    return { ...cell, status: 'skip', detail: `${cell.pm} is not installed`, seconds: 0 };
  }
  cell.pmVersion = available;
  cell.dir = path.join(work, 'cells', cell.name.replace(/[:/]/g, '-'));
  mkdirSync(cell.dir, { recursive: true });
  console.log(`\n=== ${cell.name} (${cell.pm} ${available}) in ${cell.dir}`);
  try {
    const detail = await RUNNERS[cell.scenario](cell);
    cell.status = 'pass';
    cell.detail = detail;
  } catch (error) {
    cell.status = 'fail';
    const message = error instanceof Error ? error.message : String(error);
    const failed = cell.steps.find((entry) => !entry.ok);
    cell.detail = `${failed ? `${failed.name}: ` : ''}${summarize(message)}`;
    cell.error = message.slice(-6000);
    cell.logExcerpts = Object.fromEntries(
      cell.logs.filter(existsSync).map((file) => [file, tail(file, 2500)]),
    );
  }
  cell.versions = versionsIn(cell.app);
  cell.seconds = Math.round((Date.now() - started) / 1000);
  console.log(
    `${cell.status === 'pass' ? 'ok  ' : 'FAIL'} ${cell.name} in ${cell.seconds}s: ${cell.detail}`,
  );
  return cell;
}

function printTable(results) {
  const rows = results.map((cell) => [
    cell.name,
    cell.status.toUpperCase(),
    `${cell.seconds ?? 0}s`,
    cell.versions?.['@angular/core'] ?? cell.versions?.['@analogjs/platform'] ?? '-',
    (cell.detail ?? '').replace(/\s+/g, ' ').slice(0, 110),
  ]);
  const head = ['Cell', 'Result', 'Time', 'Angular', 'Detail'];
  const widths = head.map((title, index) =>
    Math.max(title.length, ...rows.map((row) => row[index].length)),
  );
  const line = (row) => `| ${row.map((cell, index) => cell.padEnd(widths[index])).join(' | ')} |`;
  const table = [
    line(head),
    `|${widths.map((width) => '-'.repeat(width + 2)).join('|')}|`,
    ...rows.map(line),
  ].join('\n');
  console.log(`\n${table}\n`);
  return table;
}

const startedAt = new Date();
const results = [];
const report = {
  started: startedAt.toISOString(),
  node: process.version,
  packageManagers: {},
  registry: REGISTRY,
  work,
  cells: results,
};
let exitCode = 0;
try {
  const given = arg('tarball');
  report.tarball = given ? path.resolve(given) : registry.pack();
  await registry.startRegistry();
  report.version = registry.publish(report.tarball);
  for (const pm of PACKAGE_MANAGERS) report.packageManagers[pm] = pmVersion(pm) ?? 'not installed';

  let port = registryPort + 1;
  if (!auditOnly) {
    for (const cell of cells) {
      cell.version = report.version;
      cell.ports = [port, port + 1, port + 2];
      port += 3;
      results.push(await runCell(cell));
    }
  }
  if (runAudit || auditOnly) {
    console.log('\n=== package-audit');
    const audit = await packageAudit(report.tarball, report.version);
    audit.detail =
      audit.status === 'pass'
        ? audit.steps.map((entry) => entry.note).filter(Boolean)[0]
        : audit.steps
            .filter((entry) => !entry.ok)
            .map((entry) => `${entry.name}: ${summarize(entry.error)}`)
            .join('; ');
    report.audit = audit;
    results.push(audit);
  }
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  console.error(`\n${report.error}`);
  exitCode = 1;
} finally {
  await browserPromise?.then((instance) => instance.close()).catch(() => {});
}

report.finished = new Date().toISOString();
report.seconds = Math.round((Date.now() - startedAt.getTime()) / 1000);
const table = printTable(results);
if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `### Install matrix\n\n${table}\n`, { flag: 'a' });
}
const reportFile = arg('report');
if (reportFile) {
  mkdirSync(path.dirname(path.resolve(reportFile)), { recursive: true });
  writeFileSync(path.resolve(reportFile), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${path.resolve(reportFile)}`);
}
if (results.some((cell) => cell.status === 'fail')) exitCode = 1;
stopAll();
if (exitCode !== 0) {
  // The work folder holds every app and its node_modules, which can be gigabytes, so a failed run
  // keeps only the logs, copied out first, unless --keep asks for the whole folder.
  const logs = path.resolve(arg('logs') ?? mkdtempSync(path.join(tmpdir(), 'pangular-e2e-logs-')));
  let copied = 0;
  for (const file of results.flatMap((cell) => cell.logs ?? [])) {
    if (!existsSync(file)) continue;
    const to = path.join(logs, path.relative(work, file).replaceAll(path.sep, '__'));
    mkdirSync(path.dirname(to), { recursive: true });
    copyFileSync(file, to);
    copied++;
  }
  console.log(`The logs of the run (${copied} files) are in ${logs}`);
}
if (flag('keep')) {
  console.log(`The registry, the apps and their logs are left in ${work} (--keep)`);
} else {
  rmSync(work, { recursive: true, force: true });
}
console.log(`total ${report.seconds}s`);
process.exit(exitCode);
