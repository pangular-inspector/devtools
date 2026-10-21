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

// The Errors tab with a page that hit errors and logged to the console.
const errorGroup = (id, extra = {}) => ({
  id,
  message: 'Error: No seats left on trip 42',
  name: 'Error',
  count: 3,
  firstAt: now - 60_000,
  lastAt: now - 5_000,
  sources: ['handler'],
  stack: 'Error: No seats left on trip 42\n    at _TripCard.book (main.js:10:5)',
  owner: { id: 'c1-7', name: 'TripCard' },
  ...extra,
});
const ERRORS_SEED = {
  pages: {
    tab1: {
      pageId: 'tab1',
      url: '/trips',
      title: 'Trips',
      reportedAt: now,
      handler: 'wrapped',
      errors: {
        e1: errorGroup('e1'),
        e2: errorGroup('e2', {
          message: 'Error: NG0100: ExpressionChangedAfterItHasBeenCheckedError',
          code: 'NG0100',
          docUrl: 'https://angular.dev/errors/NG0100',
          count: 1,
          sources: ['window'],
          owner: undefined,
        }),
        e3: errorGroup('e3', { message: 'NG0303: unknown property', code: 'NG0303', count: 1 }),
      },
      console: {
        1: { id: 1, level: 'log', text: 'Loaded trips', at: now - 9_000, count: 4 },
        2: { id: 2, level: 'info', text: 'Signed in', at: now - 8_000, count: 1 },
        3: {
          id: 3,
          level: 'warn',
          text: 'NG0913: image too big',
          at: now - 7_000,
          count: 1,
          code: 'NG0913',
          docUrl: 'https://angular.dev/errors/NG0913',
        },
        4: { id: 4, level: 'error', text: 'Failed to save', at: now - 6_000, count: 1 },
        5: { id: 5, level: 'debug', text: 'cache hit', at: now - 5_000, count: 1 },
      },
      dropped: { errors: 0, console: 0 },
    },
  },
};

// Long lists, so axe checks the panel's windowed rows: a 2,000 instance
// component tree and 2,000 HTTP calls.
const LONG = 2000;
const COMPONENTS_SEED = {
  nodes: [],
  selectedId: null,
  highlightedId: null,
  pages: {
    big: {
      pageId: 'big',
      url: '/trips',
      title: 'Trips',
      reportedAt: now,
      count: LONG,
      detail: null,
      roots: [
        {
          id: 'app',
          name: 'App',
          tag: 'app-root',
          children: Array.from({ length: LONG - 1 }, (_, i) => ({
            id: `c${i}`,
            name: 'TripCard',
            tag: 'app-trip-card',
            children: [],
          })),
        },
      ],
    },
  },
};
const HTTP_SEED = {
  serverCalls: [],
  pages: [
    {
      pageId: 'big',
      url: '/trips',
      title: 'Trips',
      hydration: null,
      reportedAt: now,
      calls: Array.from({ length: LONG }, (_, i) => ({
        id: `h${i}`,
        url: `/api/trips/${i}`,
        method: 'GET',
        status: i % 50 ? 200 : 500,
        durationMs: 12,
        side: 'client',
        cacheHit: false,
        faulted: false,
        at: now - LONG + i,
      })),
    },
  ],
};

// A library plugin that reports a view, so the Plugins tab shows, and one that failed.
const PLUGINS_SEED = {
  server: [],
  pages: {
    tab1: {
      pageId: 'tab1',
      url: '/trips',
      title: 'Trips',
      reportedAt: now,
      plugins: [
        {
          id: 'cart',
          version: '1.0.0',
          title: 'Cart',
          description: 'The cart store of the trips app.',
          status: 'running',
          actions: [],
          view: {
            summary: '2 items in the cart',
            badges: [{ label: 'synced', tone: 'ok' }],
            sections: [
              {
                kind: 'table',
                title: 'Items',
                columns: [
                  { key: 'trip', label: 'Trip' },
                  { key: 'seats', label: 'Seats' },
                ],
                rows: [
                  { trip: 'Lisbon', seats: 2 },
                  { trip: 'Porto', seats: { text: 'sold out', tone: 'danger' } },
                ],
                empty: 'The cart is empty.',
              },
              {
                kind: 'list',
                title: 'Coupons',
                items: [{ label: 'SPRING', detail: '10% off', badge: { label: 'active' } }],
              },
            ],
          },
        },
        {
          id: 'broken',
          version: '0.1.0',
          title: 'Broken',
          status: 'error',
          error: 'TypeError: cannot read properties of undefined',
          actions: [],
          view: null,
        },
      ],
    },
  },
};

// A page with a QueryClient: one cached query, one failed query and a mutation.
const query = (id, extra = {}) => ({
  id,
  clientId: 'qc1',
  key: ['trips', id],
  keyText: `["trips","${id}"]`,
  status: 'success',
  fetchStatus: 'idle',
  stale: false,
  invalidated: false,
  observers: 1,
  active: true,
  disabled: false,
  dataUpdatedAt: now - 5_000,
  errorUpdatedAt: 0,
  dataUpdateCount: 1,
  failureCount: 0,
  hasData: true,
  ...extra,
});
const QUERIES_SEED = {
  pages: {
    tab1: {
      pageId: 'tab1',
      url: '/trips',
      title: 'Trips',
      at: now,
      reportedAt: now,
      clients: [{ id: 'qc1', scope: 'root', queries: 2, mutations: 1 }],
      queries: [
        query('q1'),
        query('q2', {
          status: 'error',
          error: 'HttpErrorResponse: 500',
          hasData: false,
          failureCount: 3,
          errorUpdatedAt: now - 2_000,
        }),
      ],
      mutations: [
        {
          id: 'm1',
          clientId: 'qc1',
          keyText: '["book"]',
          status: 'success',
          isPaused: false,
          submittedAt: now - 1_000,
          failureCount: 0,
        },
      ],
    },
  },
};

// A reactive form with an invalid field, so the Forms tab has fields to filter.
const FORMS_SEED = {
  forms: [
    {
      id: 'f1@tab1',
      kind: 'reactive',
      owner: 'SignupForm',
      label: 'signup',
      root: {
        key: '',
        path: '',
        type: 'group',
        status: 'INVALID',
        touched: true,
        dirty: true,
        bound: true,
        errors: [],
        children: [
          {
            key: 'email',
            path: 'email',
            type: 'control',
            status: 'INVALID',
            touched: true,
            dirty: true,
            bound: true,
            required: true,
            value: '',
            errors: [{ kind: 'required', message: 'Email is required' }],
          },
          {
            key: 'name',
            path: 'name',
            type: 'control',
            status: 'VALID',
            touched: false,
            dirty: false,
            bound: true,
            value: 'Ada',
            errors: [],
          },
        ],
      },
    },
  ],
  events: [],
  instrumented: [],
  dropped: {},
  webMcp: [],
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

const SEEDS = {
  'pangular:capacitor': CAPACITOR_SEED,
  'pangular:errors': ERRORS_SEED,
  'pangular:component-tree': COMPONENTS_SEED,
  'pangular:http': HTTP_SEED,
  'pangular:plugins': PLUGINS_SEED,
  'pangular:tanstack-query': QUERIES_SEED,
  'pangular:forms': FORMS_SEED,
};

/** Serves the seeded pages in place of the report's empty state for the `SEEDS` keys. */
async function seedPages(context) {
  await context.route(
    '**/__rpc-dump/devframe~rpc~server-state~get.record.*.json',
    async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const key = Object.keys(SEEDS).find((name) => body.includes(`"${name}"`));
      if (!key) return route.fulfill({ response });
      return route.fulfill({
        response,
        body: encodeRecord({
          inputs: [key],
          output: JSON.parse(JSON.stringify(SEEDS[key])),
        }),
      });
    },
  );
}

// The report's own files, which the panel needs to connect at all.
const REPORT_FILES = /__rpc-dump\/(?!index\.json$|pangular~build-meta\.)/;

/** Every source scan in the report comes back empty, as for a project with nothing in it. */
async function emptySource(context) {
  await context.route(/__rpc-dump\/pangular~[^/]+\.(record\.[^/]+|fallback)\.json$/, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ inputs: [], output: [] }),
    }),
  );
}

/** Every RPC answer fails, as when the devtools server stops answering. */
async function unreachable(context) {
  await context.route(REPORT_FILES, (route) => route.fulfill({ status: 500, body: 'down' }));
}

/** Every RPC answer stays pending, so each tab shows its loading state. */
async function neverAnswers(context) {
  await context.route(REPORT_FILES, () => new Promise(() => {}));
}

const VIEWS = ['ngrx', 'analog', 'angular-native', 'nativescript', 'capacitor'];
const NO_MATCH = 'zz-no-such-thing';
const failures = [];
const browser = await chromium.launch();

/** A browser context for one color scheme, with the routes `setup` adds. */
async function newPanel(colorScheme, setup) {
  const context = await browser.newContext({
    colorScheme,
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 800 },
  });
  await setup?.(context);
  return context;
}

/** Visits every tab in the bar and checks it; `ready` waits for the state under test. */
async function checkTabs(page, name, { ready, after, idle = true } = {}) {
  const tabs = page.locator('nav[aria-label="Inspectors"] button');
  const count = await tabs.count();
  if (!count) failures.push(`${name}: no inspector tabs rendered`);
  for (let i = 0; i < count; i++) {
    const tab = tabs.nth(i);
    const label = (await tab.innerText()).trim();
    await tab.click();
    await ready?.(page, label);
    await check(page, `${name} ${label}`, { idle });
    await after?.(page, `${name} ${label}`);
  }
}

/**
 * Types a filter that matches nothing into every search box the tab shows,
 * checks the "no match" state, then clears them. Returns whether it found one.
 */
async function filterToNothing(page, name) {
  const boxes = page.locator('main input[type="search"]:visible');
  const count = await boxes.count();
  if (!count) return false;
  for (let i = 0; i < count; i++) await boxes.nth(i).fill(NO_MATCH);
  // The pages filter as the viewer types, and some wait a moment before they do.
  await page.waitForTimeout(700);
  await check(page, `${name} filtered to nothing`);
  for (let i = count - 1; i >= 0; i--) await boxes.nth(i).fill('');
  return true;
}

/** Like `filterToNothing`, for a page that must have a search box. */
async function mustFilter(page, name) {
  if (!(await filterToNothing(page, name))) failures.push(`${name}: no search box to filter`);
}

// What a tab shows when the server fails, and while it has not answered yet.
const ERROR_STATE = 'main [role="alert"], main :text("Count unavailable")';
const LOADING_STATE = 'main :text-matches("Loading|Scanning|Counting|Connecting")';
// The Audit tab reads no RPC in a static report, so it shows the same notice in every state.
const NO_RPC_TABS = new Set(['Audit']);

/** Waits for a tab's error or loading state, and fails when it does not show. */
async function waitForState(page, label, selector, state) {
  if (NO_RPC_TABS.has(label)) return;
  try {
    await page.locator(selector).first().waitFor({ timeout: 10_000 });
  } catch {
    failures.push(`${label}: no ${state} state showed`);
  }
}

async function check(page, name, { idle = true } = {}) {
  if (idle) await page.waitForLoadState('networkidle');
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

  // The two color schemes run side by side, each in its own browser contexts.
  await Promise.all(
    ['dark', 'light'].map(async (colorScheme) => {
      const context = await newPanel(colorScheme);
      const page = await context.newPage();
      page.on('pageerror', (error) => failures.push(`${colorScheme}: page error ${error.message}`));

      await page.goto(base);
      await page.locator('.status.connected').waitFor();
      // The report as built: source scans, and the empty state of every live tab.
      await checkTabs(page, colorScheme, { after: filterToNothing });

      await page.locator('header button[aria-label="Settings"]').click();
      await page.locator('#settings-browser-agents').waitFor();
      await check(page, `${colorScheme} Settings`);

      for (const view of VIEWS) {
        await page.goto(`${base}?view=${view}`);
        await page.locator('.status.connected').waitFor();
        // Every view links to the full panel, so axe checks the link in each one.
        if (!(await page.locator('header a.full-panel').count())) {
          failures.push(`${colorScheme} view=${view}: no Open full panel link`);
        }
        await check(page, `${colorScheme} view=${view}`);
      }
      await context.close();

      const seeded = await newPanel(colorScheme, seedPages);
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
        await mustFilter(capacitor, `${colorScheme} view=capacitor`);
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
      const errors = await seeded.newPage();
      errors.on('pageerror', (error) =>
        failures.push(`${colorScheme} Errors: page error ${error.message}`),
      );
      await errors.goto(`${base}#tab=errors`);
      await errors.locator('.status.connected').waitFor();
      try {
        await errors.locator('ol.errors > li').first().waitFor({ timeout: 15_000 });
        await errors.locator('ol.errors details summary').first().click();
        await check(errors, `${colorScheme} Errors with errors reported`);
        await mustFilter(errors, `${colorScheme} Errors`);
        await errors.getByRole('button', { name: /^Console/ }).click();
        await errors.locator('ol.console > li').first().waitFor();
        await check(errors, `${colorScheme} Errors on the console log`);
      } catch (error) {
        failures.push(`${colorScheme} Errors: the seeded page did not show (${error.message})`);
      }
      const long = await seeded.newPage();
      long.on('pageerror', (error) =>
        failures.push(`${colorScheme} long lists: page error ${error.message}`),
      );
      try {
        await long.goto(`${base}#tab=components`);
        await long.locator('.status.connected').waitFor();
        await long.locator('.tree.windowed [role="treeitem"]').first().waitFor({ timeout: 15_000 });
        const rows = await long.locator('.tree [role="treeitem"]').count();
        if (rows >= LONG) failures.push(`${colorScheme} components: ${rows} rows rendered`);
        await check(long, `${colorScheme} Components with ${LONG} instances`);
        await long.locator('.tree [role="treeitem"][tabindex="0"]').focus();
        await long.keyboard.press('End');
        await long.locator('.tree [role="treeitem"][data-id="c1998"]:focus').waitFor();
        await check(long, `${colorScheme} Components at the last instance`);
        const network = await seeded.newPage();
        await network.goto(`${base}#tab=network`);
        await network.locator('.status.connected').waitFor();
        await network.locator('tbody tr[data-vindex]').first().waitFor({ timeout: 15_000 });
        await check(network, `${colorScheme} Network with ${LONG} calls`);
        await mustFilter(network, `${colorScheme} Network`);
      } catch (error) {
        failures.push(`${colorScheme} long lists: did not show (${error.message})`);
      }
      // The live tabs that show nothing to filter until a page reports.
      for (const [tab, label, shown] of [
        ['plugins', 'Plugins', '#plugin-title'],
        ['queries', 'Queries', 'main input[type="search"]'],
        ['forms', 'Forms', 'main input[type="search"]'],
      ]) {
        const live = await seeded.newPage();
        live.on('pageerror', (error) =>
          failures.push(`${colorScheme} ${label}: page error ${error.message}`),
        );
        try {
          await live.goto(`${base}#tab=${tab}`);
          await live.locator('.status.connected').waitFor();
          await live.locator(shown).first().waitFor({ timeout: 15_000 });
          await check(live, `${colorScheme} ${label} with a page reporting`);
          await mustFilter(live, `${colorScheme} ${label}`);
        } catch (error) {
          failures.push(`${colorScheme} ${label}: the seeded page did not show (${error.message})`);
        }
      }
      await seeded.close();

      // A project whose source declares nothing: the empty state of the source scans.
      const empty = await newPanel(colorScheme, emptySource);
      const emptyPage = await empty.newPage();
      emptyPage.on('pageerror', (error) =>
        failures.push(`${colorScheme} empty project: page error ${error.message}`),
      );
      await emptyPage.goto(base);
      await emptyPage.locator('.status.connected').waitFor();
      await checkTabs(emptyPage, `${colorScheme} empty project`);
      await empty.close();

      // The devtools server stops answering: each tab's error state.
      const down = await newPanel(colorScheme, unreachable);
      const downPage = await down.newPage();
      downPage.on('pageerror', (error) =>
        failures.push(`${colorScheme} server down: page error ${error.message}`),
      );
      await downPage.goto(base);
      await downPage.locator('.status.connected').waitFor();
      await checkTabs(downPage, `${colorScheme} server down`, {
        ready: (page, label) => waitForState(page, label, ERROR_STATE, 'error'),
      });
      for (const view of VIEWS) {
        await downPage.goto(`${base}?view=${view}`);
        await downPage.locator('.status.connected').waitFor();
        await check(downPage, `${colorScheme} server down view=${view}`);
      }
      await down.close();

      // The devtools server has not answered yet: each tab's loading state.
      const slow = await newPanel(colorScheme, neverAnswers);
      const slowPage = await slow.newPage();
      slowPage.on('pageerror', (error) =>
        failures.push(`${colorScheme} loading: page error ${error.message}`),
      );
      await slowPage.goto(base);
      await slowPage.locator('.status.connected').waitFor();
      await checkTabs(slowPage, `${colorScheme} loading`, {
        idle: false,
        ready: (page, label) => waitForState(page, label, LOADING_STATE, 'loading'),
      });
      await slow.close();
    }),
  );
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
