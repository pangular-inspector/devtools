#!/usr/bin/env node
// axe check of the Chrome extension panel (extension/panel.html), loaded over http with a stand-in
// for the `chrome` APIs. It covers every status the panel bridge shows before it connects, then
// the connected panel: the committed extension/ui build in the panel's frame, reading a static
// report served from the same origin. Both color schemes, at 1280 and 360 px. The toolbar popup
// (at its 320 px width) and the site access page are checked too, with the same kind of stand-in.
//
//   node scripts/extension-axe.mjs [report dir]
//
// The report dir defaults to dist/panel-axe, which `pnpm test:axe` writes. Build one with
// `node bin.mjs build --outDir dist/panel-axe` after `pnpm devtools:build-pkg`.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const extensionDir = join(root, 'extension');
const reportDir = resolve(process.argv[2] ?? join(root, 'dist/panel-axe'));
if (!existsSync(join(reportDir, '__connection.json'))) {
  console.error(
    `${reportDir} is not a Pangular Inspector report. Run pnpm test:axe, or: node bin.mjs build --outDir ${reportDir}`,
  );
  process.exit(1);
}
if (!existsSync(join(extensionDir, 'ui/index.html'))) {
  console.error('extension/ui is missing. Run: pnpm extension:build');
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const REPORT_PREFIX = '/__pangular/';

function sendFile(res, base, path) {
  let file = join(base, path);
  if (!(file === base || file.startsWith(base + sep)) || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  if (statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}

/** Starts a server on a free port and gives its origin. */
async function listen(handler) {
  const server = createServer(handler);
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

// The extension's files at `/`, standing in for chrome-extension://<id>/, and the static report
// at /__pangular/, where the bridge finds its __connection.json. One origin, so the panel takes
// the `baseURL` the bridge passes, as it takes the extension's own in Chrome.
const extension = await listen((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  if (path.startsWith(REPORT_PREFIX)) sendFile(res, reportDir, path.slice(REPORT_PREFIX.length));
  else sendFile(res, extensionDir, path.slice(1));
});
// Devtools servers the bridge probes from another origin. CORS headers let it read the status,
// as host permissions let the real extension.
const cors = { 'access-control-allow-origin': '*' };
const missing = await listen((_req, res) => res.writeHead(404, cors).end());
const refusing = await listen((_req, res) =>
  res.writeHead(403, { ...cors, 'content-type': 'text/plain' }).end('Host not allowed'),
);

/**
 * Runs in the panel page before its scripts: a `chrome` with what panel-bridge.js and
 * panel-actions.js call. `origin` is what the inspected page answers for `location.origin`;
 * `error` and `silent` stand for a page that throws or never answers.
 */
function fakeChrome({ theme, origin, granted, eval: mode }) {
  const listeners = () => ({ addListener() {} });
  // Only the panel page itself: the frame it loads reads the theme from its URL.
  if (window.top !== window) return;
  window.chrome = {
    devtools: {
      panels: {
        themeName: theme,
        setThemeChangeHandler() {},
        elements: { onSelectionChanged: listeners() },
        openResource: (_url, _line, done) => done?.({}),
      },
      inspectedWindow: {
        eval(expression, done) {
          if (mode === 'silent') return;
          if (mode === 'error') return done(undefined, { isException: true });
          if (expression === 'location.origin') return done(origin);
          done(null);
        },
        getResources: (done) => done([]),
      },
      network: { onNavigated: listeners() },
    },
    permissions: {
      contains: async () => granted,
      request: async () => false,
    },
    runtime: { getURL: (path = '') => `${location.origin}/${path}` },
  };
}

/**
 * Runs in the toolbar popup and the site access page before their scripts: the `chrome` APIs
 * popup.js and options.js call. `page` is what the active tab answers, `origins` the hosts
 * granted besides the loopback ones.
 */
function fakeExtensionChrome({ page, origins }) {
  const manifest = { host_permissions: ['http://*.localhost/*', 'http://127.0.0.1/*'] };
  window.chrome = {
    tabs: { query: async () => [{ id: 1, url: `${page.origin}/` }] },
    scripting: { executeScript: async () => [{ frameId: 0, result: page }] },
    runtime: { openOptionsPage() {}, getManifest: () => manifest },
    permissions: {
      getAll: async () => ({ origins: [...manifest.host_permissions, ...origins] }),
      remove: async () => true,
    },
  };
}

// The toolbar popup and the site access page, each in the states that change what they show.
const EXTENSION_PAGES = [
  {
    name: 'popup connected',
    path: 'popup.html',
    ready: { selector: '#fact-server', text: 'Answers at' },
    page: { version: '21.0.3', angular: true, devMode: true, overlay: true },
    width: 320,
  },
  {
    name: 'popup no Angular',
    path: 'popup.html',
    ready: { selector: '#next', text: 'frame' },
    page: { version: null, angular: false, devMode: false, overlay: false },
    width: 320,
  },
  {
    name: 'site access with sites',
    path: 'options.html',
    ready: { selector: '#hosts li', text: 'staging' },
    origins: ['https://staging.example.com/*', 'http://192.168.1.20/*'],
  },
  {
    name: 'site access empty',
    path: 'options.html',
    ready: { selector: '#empty', text: 'No other sites' },
    origins: [],
  },
];

// Each status the bridge can show, the text that marks it, and the inspected page behind it.
const STATES = [
  { name: 'page not answering', text: 'not answering', page: { eval: 'silent' } },
  { name: 'page unreadable', text: "Couldn't read", page: { eval: 'error' } },
  { name: 'not http', text: 'served over http', page: { origin: 'null' } },
  {
    name: 'access not granted',
    text: 'Allow Pangular Inspector',
    page: { origin: missing.origin, granted: false },
    visible: '#status-allow',
  },
  {
    name: 'no server',
    text: 'No devtools server answered',
    page: { origin: missing.origin },
    visible: '#status-tried',
  },
  {
    name: 'server refused',
    text: 'refused the request (403)',
    page: { origin: refusing.origin },
    visible: '#status-tried',
  },
];

const failures = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function analyze(page, label) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  for (const v of violations) {
    const targets = v.nodes.map((n) => n.target.join(' ')).slice(0, 3);
    failures.push(`${label}: ${v.id} (${v.impact}) ${v.help} at ${targets.join(', ')}`);
  }
  console.log(`${violations.length ? 'FAIL' : 'ok  '} ${label}`);
}

async function openPanel(scheme, width, page) {
  const context = await browser.newContext({
    colorScheme: scheme,
    reducedMotion: 'reduce',
    viewport: { width, height: 800 },
  });
  await context.addInitScript(fakeChrome, {
    theme: scheme === 'dark' ? 'dark' : 'default',
    origin: extension.origin,
    granted: true,
    eval: 'answer',
    ...page,
  });
  const tab = await context.newPage();
  tab.on('pageerror', (error) => failures.push(`${scheme} ${width}: page error ${error.message}`));
  await tab.goto(`${extension.origin}/panel.html`);
  return { context, tab };
}

try {
  for (const scheme of ['dark', 'light']) {
    for (const width of [1280, 360]) {
      for (const state of STATES) {
        const label = `${scheme} ${width} ${state.name}`;
        const { context, tab } = await openPanel(scheme, width, state.page);
        try {
          // The bridge reads the page for a few seconds before it gives up on it.
          await tab
            .locator('#status-message', { hasText: state.text })
            .waitFor({ timeout: 20_000 });
          if (state.visible) await tab.locator(state.visible).waitFor({ timeout: 5_000 });
          await analyze(tab, label);
        } catch (error) {
          failures.push(`${label}: the status did not show (${error.message.split('\n')[0]})`);
        } finally {
          await context.close();
        }
      }

      // Connected: the bridge finds the report and loads extension/ui in its frame.
      const label = `${scheme} ${width} connected`;
      const { context, tab } = await openPanel(scheme, width, {});
      try {
        await tab.locator('#devtools-frame').waitFor({ state: 'visible', timeout: 20_000 });
        const panel = tab.frameLocator('#devtools-frame');
        await panel.locator('.status.connected').waitFor({ timeout: 20_000 });
        await panel.locator('nav[aria-label="Inspectors"] button').first().waitFor();
        const src = await tab.locator('#devtools-frame').getAttribute('src');
        if (!src?.startsWith(`${extension.origin}/ui/index.html?`)) {
          failures.push(`${label}: the frame loaded ${src}, not extension/ui`);
        }
        await tab.waitForTimeout(700);
        // AxeBuilder checks the frame too.
        await analyze(tab, label);
      } catch (error) {
        failures.push(`${label}: the panel did not load (${error.message.split('\n')[0]})`);
      } finally {
        await context.close();
      }
    }

    for (const entry of EXTENSION_PAGES) {
      for (const width of entry.width ? [entry.width] : [1280, 360]) {
        const label = `${scheme} ${width} ${entry.name}`;
        const context = await browser.newContext({
          colorScheme: scheme,
          reducedMotion: 'reduce',
          viewport: { width, height: 600 },
        });
        await context.addInitScript(fakeExtensionChrome, {
          page: { origin: extension.origin, ...entry.page },
          origins: entry.origins ?? [],
        });
        const tab = await context.newPage();
        tab.on('pageerror', (error) => failures.push(`${label}: page error ${error.message}`));
        try {
          await tab.goto(`${extension.origin}/${entry.path}`);
          await tab
            .locator(entry.ready.selector, { hasText: entry.ready.text })
            .first()
            .waitFor({ timeout: 10_000 });
          const overflow = await tab.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          );
          if (overflow) failures.push(`${label}: the page scrolls sideways`);
          await analyze(tab, label);
        } catch (error) {
          failures.push(`${label}: the page did not show (${error.message.split('\n')[0]})`);
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
  for (const { server } of [extension, missing, refusing]) server.close();
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s) in the extension panel:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('\nThe extension panel, toolbar popup and site access page pass axe in every state.');
