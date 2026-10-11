#!/usr/bin/env node
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const dir = resolve(process.argv[2] ?? 'dist/panel-axe');
if (!existsSync(join(dir, '__connection.json'))) {
  console.error(
    `${dir} is not a Pangular Inspector report. Run: node bin.mjs build --outDir ${dir}`,
  );
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

const PREFIX = '/__pangular/';

async function serve(prefix) {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
    let file = join(dir, path.slice(prefix.length - 1));
    if (!path.startsWith(prefix) || !file.startsWith(dir) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return { server, base: `http://127.0.0.1:${server.address().port}${prefix}` };
}

const { server, base } = await serve(PREFIX);
const atRoot = await serve('/');

// The static report has no app reporting, so the Capacitor tab would only
// show its setup steps. These pages stand in for a device that reports.
const now = Date.now();
const capacitorCall = (id, extra = {}) => ({
  id,
  plugin: 'Camera',
  method: 'getPhoto',
  kind: 'promise',
  via: 'native',
  args: { quality: 90 },
  status: 'ok',
  result: { format: 'jpeg' },
  startedAt: now - 60_000 + id * 1000,
  durationMs: 120,
  ...extra,
});
const capacitorInfo = (platform, bridge) => ({
  platform,
  native: bridge,
  bridge,
  webCalls: false,
  env: {
    serverUrl: bridge ? 'https://localhost' : '',
    debug: false,
    logging: true,
    capacitorHttp: bridge ? null : false,
    userAgent: 'Mozilla/5.0 (Linux; Android 15)',
  },
  plugins: [
    { name: 'Barcode', available: false, registered: true, native: false, methods: [] },
    { name: 'Camera', available: true, registered: true, native: true, methods: ['getPhoto'] },
    { name: 'Haptics', available: true, registered: null, native: true, methods: ['vibrate'] },
    { name: 'WebView', available: false, registered: true, native: false, methods: [] },
    {
      name: 'Foldable',
      available: true,
      registered: true,
      native: true,
      methods: ['getFoldState', 'getHingeAngle'],
    },
  ],
});
// The server keys each page's calls by id.
const byId = (calls) => Object.fromEntries(calls.map((call) => [String(call.id), call]));
const CAPACITOR_SEED = {
  pages: {
    device: {
      pageId: 'device',
      url: '/trips',
      title: 'Trips',
      reportedAt: now,
      info: capacitorInfo('android', true),
      calls: byId([
        capacitorCall(1),
        capacitorCall(2, {
          method: 'pickLimitedLibraryPhotos',
          status: 'error',
          result: undefined,
          error: { message: 'Not implemented on Android', code: 'UNIMPLEMENTED' },
        }),
        capacitorCall(3, {
          plugin: 'Geolocation',
          method: 'watchPosition',
          kind: 'callback',
          callbacks: 4,
        }),
        capacitorCall(4, {
          plugin: 'Preferences',
          method: 'get',
          status: 'pending',
          result: undefined,
          durationMs: undefined,
        }),
        capacitorCall(5, {
          plugin: 'Foldable',
          method: 'getFoldState',
          args: undefined,
          durationMs: 840,
          result: {
            state: 'flat',
            isSeparating: false,
            posture: 'flat',
            hingeOrientation: 'vertical',
            activeDisplay: 'inner',
          },
        }),
      ]),
      listeners: [
        {
          id: '1',
          plugin: 'Network',
          event: 'networkStatusChange',
          addedAt: now - 50_000,
          events: 3,
          lastEventAt: now - 5000,
        },
        {
          id: '3',
          plugin: 'Network',
          event: 'networkStatusChange',
          addedAt: now - 40_000,
          events: 3,
          lastEventAt: now - 5000,
          last: { connected: true, connectionType: 'wifi' },
        },
        {
          id: '4',
          plugin: 'Foldable',
          event: 'foldStateChange',
          addedAt: now - 40_000,
          events: 2,
          lastEventAt: now - 3000,
          last: { state: 'half-opened', isSeparating: true, posture: 'tabletop' },
        },
        {
          id: '2',
          plugin: 'App',
          event: 'resume',
          addedAt: now - 50_000,
          events: 0,
          removed: true,
        },
      ],
      dropped: 12,
    },
    desktop: {
      pageId: 'desktop',
      url: '/home',
      title: 'Desktop',
      reportedAt: now - 1000,
      info: capacitorInfo('web', false),
      calls: {},
      listeners: [],
      dropped: 0,
    },
  },
};

/** The dump's record format (@ungap/structured-clone JSON), for plain JSON values. */
function encodeRecord(value) {
  const out = [];
  const walk = (item) => {
    const at = out.length;
    if (item === undefined) {
      out.push([-1]);
    } else if (item === null || typeof item !== 'object') {
      out.push([0, item]);
    } else if (Array.isArray(item)) {
      out.push([1, []]);
      out[at][1] = item.map(walk);
    } else {
      out.push([2, []]);
      out[at][1] = Object.entries(item).map(([key, entry]) => [walk(key), walk(entry)]);
    }
    return at;
  };
  walk(value);
  return JSON.stringify(out);
}

/** Serves the seeded Capacitor pages in place of the report's empty state. */
async function seedCapacitor(context) {
  await context.route(
    '**/__rpc-dump/devframe~rpc~server-state~get.record.*.json',
    async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (!body.includes('"pangular:capacitor"')) return route.fulfill({ response });
      return route.fulfill({
        response,
        body: encodeRecord({
          inputs: ['pangular:capacitor'],
          output: JSON.parse(JSON.stringify(CAPACITOR_SEED)),
        }),
      });
    },
  );
}

const VIEWS = ['ngrx', 'analog', 'angular-native', 'nativescript', 'capacitor'];
const failures = [];
const browser = await chromium.launch();

async function check(page, name) {
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).analyze();
  for (const v of violations) {
    const targets = v.nodes.map((node) => node.target.join(' ')).join(', ');
    failures.push(`${name}: ${v.id} (${v.impact}) ${v.help} -> ${targets}`);
  }
  console.log(`${violations.length ? 'FAIL' : 'ok  '} ${name}`);
}

try {
  const rootPage = await browser.newPage();
  await rootPage.goto(atRoot.base);
  try {
    await rootPage.locator('.status.connected').waitFor({ timeout: 15_000 });
    console.log('ok   report served at /');
  } catch {
    failures.push('report served at /: the panel did not connect');
  }
  await rootPage.close();

  for (const colorScheme of ['dark', 'light']) {
    const context = await browser.newContext({
      colorScheme,
      reducedMotion: 'reduce',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push(`${colorScheme}: page error ${error.message}`));

    await page.goto(base);
    await page.locator('.status.connected').waitFor();
    const tabs = page.locator('nav[aria-label="Inspectors"] button');
    const count = await tabs.count();
    if (!count) failures.push(`${colorScheme}: no inspector tabs rendered`);
    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i);
      const label = (await tab.innerText()).trim();
      await tab.click();
      await check(page, `${colorScheme} ${label}`);
    }

    for (const view of VIEWS) {
      await page.goto(`${base}?view=${view}`);
      await page.locator('.status.connected').waitFor();
      await check(page, `${colorScheme} view=${view}`);
    }
    await context.close();

    const seeded = await browser.newContext({
      colorScheme,
      reducedMotion: 'reduce',
      viewport: { width: 1280, height: 800 },
    });
    await seedCapacitor(seeded);
    const capacitor = await seeded.newPage();
    capacitor.on('pageerror', (error) =>
      failures.push(`${colorScheme} Capacitor: page error ${error.message}`),
    );
    await capacitor.goto(`${base}?view=capacitor`);
    await capacitor.locator('.status.connected').waitFor();
    try {
      await capacitor.locator('.calls .call').first().waitFor({ timeout: 15_000 });
      await capacitor.locator('.calls .call').nth(1).click();
      await capacitor.locator('#cap-detail').waitFor();
      await capacitor.locator('app-capacitor-state article').waitFor();
      await capacitor.getByText('possible leak').first().waitFor();
      await check(capacitor, `${colorScheme} view=capacitor with an app reporting`);
      await capacitor.locator('#cap-tab-outcome').click();
      await check(capacitor, `${colorScheme} view=capacitor on the Error tab`);
      await capacitor.locator('#cap-tab-timing').click();
      await capacitor.locator('.strip [data-filter="slow"]').click();
      await check(capacitor, `${colorScheme} view=capacitor with the Slow filter`);
      await capacitor.locator('.page-picker [role="combobox"]').click();
      await capacitor.locator('.page-picker [role="option"]', { hasText: 'Desktop' }).click();
      await capacitor.getByText("Plugin calls aren't shown on this page.").waitFor();
      await check(capacitor, `${colorScheme} view=capacitor on a web page`);
    } catch (error) {
      failures.push(`${colorScheme} Capacitor: the seeded app did not show (${error.message})`);
    }
    await seeded.close();
  }
} finally {
  await browser.close();
  server.close();
  atRoot.server.close();
}

if (failures.length) {
  console.error(`\n${failures.length} accessibility problem(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
