#!/usr/bin/env node
// Captures the panel screenshots on the docs pages, from the demo apps.
//
// It builds the SSR demo in development mode, serves it on a free port (the
// way "Serving Locally" in AGENTS.md does), opens a demo page and the panel in
// Chromium, and saves one PNG per view in apps/docs/public/images/panel. The
// Analog shot comes from the Analog demo's Vite dev server. The Capacitor shot
// runs the demo with a stand-in Android bridge, since no device reports here.
// Servers and the build output it created are removed when it ends.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const USAGE = `Usage: node scripts/docs-screenshots.mjs [options]

Options:
  --only <names>     Comma-separated shot names (default: every shot)
  --out <dir>        Output folder (default apps/docs/public/images/panel)
  --chrome <path>    Chromium executable (default: Playwright's own, or $CHROME_PATH)
  --skip-build       Use the existing dist/ build of the demo
  --keep-build       Keep the build output this script created
  --list             Print the shot names and exit`;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
if (flag('--help')) {
  console.log(USAGE);
  process.exit(0);
}

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, option('--out', 'apps/docs/public/images/panel'));
const chrome = option('--chrome', process.env.CHROME_PATH);
const VIEWPORT = { width: 1280, height: 800 };
const PANEL = '/__devframes/pangular/';

/** Waits until the page settles, then a little longer for the panel to receive pushes. */
async function settle(page, ms = 1500) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(ms);
}

/** Clicks a link or button in the demo app by its accessible name. */
async function click(page, role, name) {
  await page.getByRole(role, { name, exact: true }).first().click();
  await settle(page, 600);
}

/**
 * A minimal Android bridge, so the Capacitor tab has calls to show. The
 * overlay wraps `nativePromise` and `nativeCallback` the way it does in a real
 * WebView, and every call below goes through that wrapper.
 */
function capacitorBridge() {
  const answers = {
    'Camera.getPhoto': () => ({ format: 'jpeg', webPath: 'blob:trip-photo' }),
    'Camera.pickLimitedLibraryPhotos': () => {
      throw Object.assign(new Error('Not implemented on Android'), { code: 'UNIMPLEMENTED' });
    },
    'Preferences.get': () => ({ value: 'trips' }),
    'Network.getStatus': () => ({ connected: true, connectionType: 'wifi' }),
    'Device.getInfo': () => ({ platform: 'android', model: 'Pixel 9', osVersion: '15' }),
  };
  const headers = [
    { name: 'Camera', methods: [{ name: 'getPhoto' }, { name: 'pickLimitedLibraryPhotos' }] },
    { name: 'Preferences', methods: [{ name: 'get' }, { name: 'set' }] },
    { name: 'Network', methods: [{ name: 'getStatus' }, { name: 'addListener' }] },
    { name: 'Device', methods: [{ name: 'getInfo' }] },
    { name: 'Geolocation', methods: [{ name: 'watchPosition' }] },
  ];
  window.Capacitor = {
    DEBUG: true,
    isLoggingEnabled: true,
    getPlatform: () => 'android',
    isNativePlatform: () => true,
    isPluginAvailable: (name) => headers.some((header) => header.name === name),
    getServerUrl: () => 'https://localhost',
    PluginHeaders: headers,
    Plugins: Object.fromEntries(headers.map((header) => [header.name, {}])),
    nativePromise(plugin, method) {
      const answer = answers[`${plugin}.${method}`];
      return new Promise((done, fail) =>
        setTimeout(
          () => {
            try {
              done(answer ? answer() : {});
            } catch (error) {
              fail(error);
            }
          },
          method === 'getPhoto' ? 640 : 40,
        ),
      );
    },
    nativeCallback(plugin, method, options, callback) {
      let ticks = 0;
      const timer = setInterval(() => {
        callback({ coords: { latitude: 48.8566, longitude: 2.3522, accuracy: 12 } });
        if (++ticks === 3) clearInterval(timer);
      }, 200);
      return `${plugin}-${method}`;
    },
  };
}

const SHOTS = [
  {
    // The quick start: the popup open on the demo page.
    name: 'popup',
    app: '/examples/components',
    async inPanel(app) {
      await app.getByRole('button', { name: 'Toggle Pangular Inspector' }).click();
      await app.waitForTimeout(3000);
    },
  },
  {
    // The quick start: the one-time code prompt, with the code on (the default).
    name: 'authorize',
    server: 'ssr-auth',
    app: '/examples/components',
    async inPanel(app) {
      await app.getByRole('button', { name: 'Toggle Pangular Inspector' }).click();
      await app.waitForTimeout(3000);
    },
  },
  {
    name: 'dashboard',
    app: '/examples',
    tab: 'dashboard',
  },
  {
    name: 'timeline',
    app: '/examples/signals',
    tab: 'timeline',
    async prepare(app) {
      await click(app, 'button', 'Add one');
      await click(app, 'button', 'Add five');
      await click(app, 'link', 'Routes');
      await click(app, 'link', 'Details');
      await click(app, 'link', 'SSR & HTTP');
      await click(app, 'link', 'NgRx');
      await click(app, 'button', 'Add an item');
      await click(app, 'button', 'Add an item');
    },
    async inPanel(panel) {
      await panel.locator('button.row').filter({ hasText: 'NgRx' }).first().click();
    },
  },
  {
    name: 'components',
    app: '/examples/components',
    tab: 'components',
    async inPanel(panel) {
      const hosts = panel.getByRole('button', { name: 'Directive hosts' });
      if ((await hosts.getAttribute('aria-pressed')) === 'true') await hosts.click();
      await panel.getByText('ComponentsExample', { exact: true }).first().click();
      await panel.evaluate(() => window.scrollTo(0, 0));
    },
  },
  {
    name: 'injectors',
    app: '/examples/di',
    tab: 'injectors',
    async inPanel(panel) {
      await panel.getByText('<app-di-child>', { exact: true }).first().click();
    },
  },
  {
    name: 'signals',
    app: '/examples/signals',
    tab: 'signals',
    async prepare(app) {
      await click(app, 'button', 'Add one');
      await click(app, 'button', 'Add five');
    },
  },
  {
    name: 'ngrx-store',
    app: '/examples/store',
    tab: 'store',
    async prepare(app) {
      await click(app, 'button', 'Add an item');
      await click(app, 'button', 'Add an item');
    },
    async inPanel(panel) {
      await panel.getByText('PackingStore', { exact: true }).first().click();
    },
  },
  {
    name: 'forms',
    app: '/examples/forms',
    tab: 'forms',
  },
  {
    name: 'router',
    app: '/examples/routes/summary',
    tab: 'routes',
    async prepare(app) {
      await click(app, 'link', 'Details');
      await click(app, 'link', 'User 7');
    },
  },
  {
    name: 'pipes',
    app: '/examples/pipes',
    tab: 'pipes',
  },
  {
    name: 'ssr-http',
    app: '/examples/http',
    tab: 'network',
  },
  {
    name: 'errors',
    app: '/examples/routes/summary',
    tab: 'errors',
    async prepare(app) {
      await click(app, 'link', 'Broken');
      await click(app, 'link', 'Summary');
      await click(app, 'link', 'Broken');
      await click(app, 'link', 'Guard loop');
    },
    async inPanel(panel) {
      await panel.locator('ol.errors details summary').first().click();
    },
  },
  {
    name: 'capacitor',
    app: '/examples',
    tab: 'capacitor',
    init: capacitorBridge,
    // What an Android WebView sends, so the Environment block reads like a device.
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; Pixel 9 Build/AP4A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36',
    async prepare(app) {
      await app.evaluate(async () => {
        const cap = window.Capacitor;
        const call = (plugin, method, options) =>
          cap.nativePromise(plugin, method, options).catch(() => {});
        await call('Device', 'getInfo');
        await call('Network', 'getStatus');
        await call('Preferences', 'get', { key: 'lastSearch' });
        await call('Camera', 'getPhoto', { quality: 90, resultType: 'uri' });
        await call('Camera', 'pickLimitedLibraryPhotos');
        cap.nativeCallback('Geolocation', 'watchPosition', { enableHighAccuracy: true }, () => {});
      });
      await settle(app, 1500);
    },
    async inPanel(panel) {
      await panel.getByText('Camera.getPhoto()', { exact: true }).first().click();
    },
  },
  {
    name: 'command-palette',
    app: '/examples',
    tab: 'dashboard',
    async inPanel(panel) {
      await panel.keyboard.press('Control+K');
      await panel.getByRole('combobox').first().waitFor();
    },
  },
  {
    name: 'command-palette-hub',
    app: '/examples',
    panel: '/__devframes/',
    async inPanel(panel) {
      await panel.keyboard.press('Control+K');
      await panel.waitForTimeout(800);
      await panel.keyboard.type('pangular');
    },
  },
  {
    name: 'settings',
    app: '/examples',
    tab: 'settings',
  },
  {
    name: 'analog',
    server: 'analog',
    app: '/',
    tab: 'analog',
    signIn: true,
  },
];

const selected = option('--only', '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
if (flag('--list')) {
  console.log(SHOTS.map((shot) => shot.name).join('\n'));
  process.exit(0);
}
const unknown = selected.filter((name) => !SHOTS.some((shot) => shot.name === name));
if (unknown.length) {
  console.error(`Unknown shot: ${unknown.join(', ')}\n\n${USAGE}`);
  process.exit(1);
}
const shots = SHOTS.filter((shot) => !selected.length || selected.includes(shot.name));

function freePort() {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => done(port));
    });
  });
}

async function waitForUrl(url, child, timeout = 120_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`${url}: the server exited (${child.exitCode})`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`${url} did not answer within ${timeout / 1000}s`);
}

const children = [];
function start(command, commandArgs, options) {
  const child = spawn(command, commandArgs, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    ...options,
  });
  let log = '';
  const keep = (chunk) => {
    log = (log + chunk).slice(-4000);
  };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  child.log = () => log;
  children.push(child);
  return child;
}

/** Stops every server this script started, and waits for them to exit. */
async function stopAll() {
  const running = children.filter((child) => child.exitCode === null && child.signalCode === null);
  const exited = running.map(
    (child) =>
      new Promise((done) => {
        child.once('exit', done);
        setTimeout(done, 10_000);
      }),
  );
  for (const child of running) {
    try {
      // The process group, so Vite's workers stop too.
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
  await Promise.all(exited);
}
process.on('SIGINT', () => {
  stopAll().finally(() => process.exit(130));
});

/**
 * Starts the SSR demo with the devtools hub on a free port. The hub is off in
 * production, and the demo keeps the one-time code on unless PANGULAR_AUTH is false.
 */
async function startSsr(auth = false) {
  const port = await freePort();
  const env = { ...process.env, PORT: String(port) };
  delete env.NODE_ENV;
  env.PANGULAR_AUTH = auth ? 'true' : 'false';
  const child = start('node', ['dist/pangular-inspector/server/server.mjs'], { env });
  const base = `http://localhost:${port}`;
  try {
    await waitForUrl(`${base}/examples`, child);
  } catch (error) {
    console.error(child.log());
    throw error;
  }
  return { base, child };
}

/** Starts the Analog demo's Vite dev server on a free port. */
async function startAnalog() {
  const port = await freePort();
  const child = start(
    'pnpm',
    ['exec', 'vite', '--port', String(port), '--strictPort', '--host', 'localhost'],
    { cwd: join(root, 'examples/analog'), env: { ...process.env } },
  );
  const base = `http://localhost:${port}`;
  try {
    await waitForUrl(`${base}/`, child, 180_000);
  } catch (error) {
    console.error(child.log());
    throw error;
  }
  return { base, child };
}

/**
 * The Vite plugin keeps the one-time code on. The overlay's connection makes
 * the server print a code, and the panel exchanges it the way the printed
 * link does, through `#devframe_otp=`.
 */
async function oneTimeCode(child) {
  const until = Date.now() + 30_000;
  while (Date.now() < until) {
    // Strip the terminal colors around the code.
    const log = child.log().replace(/\x1b\[[0-9;]*m/g, '');
    const codes = [...log.matchAll(/devframe_otp=(\d+)/g)];
    if (codes.length) return codes.at(-1)[1];
    await new Promise((done) => setTimeout(done, 500));
  }
  console.warn('No one-time code printed; the panel may stay empty.');
  return undefined;
}

/** Shrinks the PNG when pngquant or oxipng is installed. */
function optimize(file) {
  const has = (tool) => {
    try {
      execFileSync('which', [tool], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  if (has('pngquant')) {
    execFileSync('pngquant', [
      '--force',
      '--skip-if-larger',
      '--quality=80-95',
      '--output',
      file,
      file,
    ]);
  }
  if (has('oxipng')) execFileSync('oxipng', ['-q', '-o', '4', '--strip', 'safe', file]);
}

async function capture(browser, base, shot, server) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
    ...(shot.userAgent ? { userAgent: shot.userAgent } : {}),
  });
  try {
    const app = await context.newPage();
    if (shot.init) await app.addInitScript(shot.init);
    await app.goto(`${base}${shot.app}`);
    await settle(app);
    const code = shot.signIn ? await oneTimeCode(server) : undefined;
    if (shot.prepare) await shot.prepare(app);

    let target = app;
    if (shot.tab || shot.panel) {
      target = await context.newPage();
      const hash = `${code ? `devframe_otp=${code}&` : ''}tab=${shot.tab}`;
      await target.goto(shot.panel ? `${base}${shot.panel}` : `${base}${PANEL}#${hash}`);
      // In the hub, the panel sits in a frame.
      const status = shot.panel
        ? target.frameLocator('iframe').first().locator('.status.connected')
        : target.locator('.status.connected');
      await status
        .waitFor({ timeout: 20_000 })
        .catch(() => console.warn(`${shot.name}: the panel did not report Live`));
      await settle(target, 2500);
    }
    if (shot.inPanel) {
      await shot.inPanel(target);
      await settle(target, 1200);
    }
    const file = join(outDir, `${shot.name}.png`);
    await target.screenshot({ path: file });
    optimize(file);
    console.log(`wrote ${file} (${Math.round(statSync(file).size / 1024)} KB)`);
  } finally {
    await context.close();
  }
}

const SERVERS = {
  ssr: () => startSsr(),
  'ssr-auth': () => startSsr(true),
  analog: startAnalog,
};

// Output folders the build and the dev servers create. The ones missing now are removed at the end.
// With --skip-build this run creates none of them, so it removes none.
const built = flag('--skip-build')
  ? []
  : ['dist', 'packages/devtools/dist', 'examples/analog/dist'].filter(
      (dir) => !existsSync(join(root, dir)),
    );
if (!flag('--skip-build')) {
  // Builds the package (with the panel) and the demo, in development mode so ngDevMode is on.
  execFileSync('pnpm', ['build', '--configuration', 'development'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NX_DAEMON: 'false' },
  });
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
try {
  for (const [name, startServer] of Object.entries(SERVERS)) {
    const list = shots.filter((shot) => (shot.server ?? 'ssr') === name);
    if (!list.length) continue;
    const { base, child } = await startServer();
    for (const shot of list) await capture(browser, base, shot, child);
    await stopAll();
  }
} finally {
  await browser.close();
  await stopAll();
  if (!flag('--keep-build')) {
    for (const dir of built) rmSync(join(root, dir), { recursive: true, force: true });
  }
}
