#!/usr/bin/env node
// Multi-tab, lifecycle and resilience checks against the SSR demo.
//
// Build first:
//   pnpm devtools:build-pkg && pnpm build --configuration development
// Then:
//   node scripts/e2e-resilience.mjs multitab expiry lifecycle stress
//   node scripts/e2e-resilience.mjs soak --minutes 30
//
// The harness bundles `scripts/e2e-resilience-app.mjs` (a generated Angular app
// sized by query parameters) into the demo's browser folder, starts the demo
// server on `--port` (default 5401), drives headless Chromium with Playwright
// and reads the hub over MCP (`/__devframes/__mcp`): its shared state through
// `devframe_state_read` (a markdown answer with a fenced JSON part, read part by
// part with `offset`), and the keys that tool hides (RESOURCE_KEYS below)
// through the `pangular:<key>` and `pangular://pages/{pageId}/<key>`
// resources. Results go to stdout and, with `--json <file>`, to a
// JSON file. Exit code 1 when a check fails. A check that fails on an open issue
// prints XFAIL with the issue number and does not fail the run (`knownFailure`).
//
// Options:
//   --port <n>       Port for the demo server (default 5401).
//   --no-spawn       Use a server that is already running on --port; the
//                    lifecycle check then skips the restart part.
//   --minutes <n>    Length of the soak loop (default 30).
//   --idle <n>       Minutes of the idle phases after the soak (default 3).
//   --hidden-ttl     In the expiry check, also wait for a crashed background
//                    tab to expire (up to 6 minutes).
//   --no-overlay     Soak only: block the overlay's connection, so the same
//                    user loop runs without the devtools (an A/B for leaks).
//   --json <file>    Write the results as JSON.
//   --chrome <path>  Chromium binary (default $CHROME or Playwright's own).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = join(ROOT, 'dist/pangular-inspector/server/server.mjs');
const BROWSER_DIR = join(ROOT, 'dist/pangular-inspector/browser');
const APP_DIR = 'e2e-resilience';

// ---------------------------------------------------------------- options

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const VALUED = new Set(['--port', '--minutes', '--idle', '--json', '--chrome']);
const checks = argv.filter((a, i) => !a.startsWith('--') && !VALUED.has(argv[i - 1]));
const PORT = Number(option('port', 5401));
const BASE = `http://localhost:${PORT}`;
const CHROME = option('chrome', process.env.CHROME);
const SOAK_MINUTES = Number(option('minutes', 30));
const IDLE_MINUTES = Number(option('idle', 3));
const SPAWN = !flag('no-spawn');
const NO_OVERLAY = flag('no-overlay');
// Vite sets NODE_ENV=production while it bundles, and the demo server turns the
// devtools off under it, so the spawned server gets the environment we started with.
const START_ENV = { ...process.env };

const ALL = ['multitab', 'expiry', 'lifecycle', 'stress'];
const selected = checks.includes('all') ? ALL : checks;
if (!selected.length) {
  console.error(
    'Usage: node scripts/e2e-resilience.mjs <multitab|expiry|lifecycle|stress|soak|all> [--minutes 30] [--port 5401] [--json out.json]',
  );
  process.exit(2);
}

// ---------------------------------------------------------------- results

const results = { base: BASE, startedAt: new Date().toISOString(), checks: {} };
let current;
function section(name) {
  current = results.checks[name] = { assertions: [], data: {} };
  console.log(`\n=== ${name} ===`);
}
function assert(name, ok, detail = '') {
  current.assertions.push({ name, ok: !!ok, detail: String(detail).slice(0, 500) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  (${detail})` : ''}`);
  return !!ok;
}
/**
 * A check that fails today because of an open issue. It still runs and is reported, as XFAIL,
 * but does not fail the run. When it starts to pass it prints XPASS (and a warning on GitHub
 * Actions), so the mark is removed once the issue is fixed. Never use it to hide a new failure.
 */
function knownFailure(issue, name, ok, detail = '') {
  const label = `${name} [known failure, #${issue}]`;
  current.assertions.push({
    name: label,
    ok: true,
    knownIssue: issue,
    passed: !!ok,
    detail: String(detail).slice(0, 500),
  });
  console.log(`${ok ? 'XPASS' : 'XFAIL'}  ${label}${detail !== '' ? `  (${detail})` : ''}`);
  if (ok && process.env.GITHUB_ACTIONS) {
    console.log(`::warning::${name} passes now: remove its known-failure mark for #${issue}.`);
  }
  return !!ok;
}
function record(key, value) {
  current.data[key] = value;
  console.log(`  ${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitUntil(fn, timeoutMs, stepMs = 500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await fn()) return Date.now() - start;
    } catch {
      // not ready yet
    }
    await sleep(stepMs);
  }
  return null;
}

// ---------------------------------------------------------------- server

function startServer() {
  if (!existsSync(SERVER)) {
    throw new Error(`${SERVER} is missing. Run: pnpm build --configuration development`);
  }
  const proc = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    // The demo keeps the one-time code on unless PANGULAR_AUTH is false.
    env: { ...START_ENV, PANGULAR_AUTH: 'false', PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  const ready = new Promise((resolve, reject) => {
    const onData = (chunk) => {
      const text = chunk.toString();
      log.push(text);
      if (text.includes('listening on')) resolve();
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', (c) => log.push(c.toString()));
    proc.once('exit', (code) => reject(new Error(`server exited ${code}: ${log.join('')}`)));
    setTimeout(() => reject(new Error('server did not start in 30s')), 30_000);
  });
  return {
    proc,
    log,
    ready,
    rssMb() {
      try {
        const kb = /VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${proc.pid}/status`, 'utf8'))?.[1];
        return kb ? Math.round(Number(kb) / 102.4) / 10 : null;
      } catch {
        return null;
      }
    },
    async stop() {
      if (proc.exitCode !== null) return;
      const exited = new Promise((r) => proc.once('exit', r));
      proc.kill('SIGTERM');
      await Promise.race([exited, sleep(5000)]);
      if (proc.exitCode === null) proc.kill('SIGKILL');
    },
  };
}

// ---------------------------------------------------------------- stress app

async function bundleApp() {
  const { build } = await import('vite');
  const outDir = join(BROWSER_DIR, APP_DIR);
  await build({
    root: ROOT,
    configFile: false,
    publicDir: false,
    base: `/${APP_DIR}/`,
    logLevel: 'error',
    resolve: {
      alias: {
        '@pangular-inspector/devtools/overlay': join(ROOT, 'packages/devtools/dist/overlay.mjs'),
      },
    },
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      target: 'es2022',
      rollupOptions: {
        input: join(ROOT, 'scripts/e2e-resilience-app.mjs'),
        output: { entryFileNames: 'app.js', format: 'es' },
      },
    },
  });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'index.html'),
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Resilience app</title>' +
      '<meta name="viewport" content="width=device-width, initial-scale=1"></head>\n' +
      '<body><stress-root></stress-root><script type="module" src="./app.js"></script></body></html>\n',
  );
}
const appUrl = (q) => `/${APP_DIR}/index.html?${new URLSearchParams(q)}`;

// ---------------------------------------------------------------- MCP

const mcp = {
  id: 0,
  async rpc(method, params) {
    const res = await fetch(`${BASE}/__devframes/__mcp`, {
      method: 'POST',
      headers: {
        origin: BASE,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(process.env.PANGULAR_MCP_TOKEN
          ? { authorization: `Bearer ${process.env.PANGULAR_MCP_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++this.id, method, params }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} answered ${res.status}: ${text.slice(0, 200)}`);
    const line = text
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .pop();
    const msg = JSON.parse(line ? line.slice(6) : text);
    if (msg.error) throw new Error(`${method}: ${JSON.stringify(msg.error)}`);
    return msg.result;
  },
  /** A tool's answer: the text of its content. Every Pangular answer is plain text. */
  async text(name, args = {}) {
    const result = await this.rpc('tools/call', { name, arguments: args });
    return (result.content ?? []).map((c) => c.text ?? '').join('\n');
  },
  /** A pangular tool's answer, as markdown. */
  async tool(name, args = {}) {
    return this.text(`pangular_${name}`, args);
  },
  /**
   * The value of a `pangular:<key>` shared state, through `devframe_state_read`.
   * Each answer is a banner and a fenced JSON part of at most `maxChars`; a
   * longer value is read part by part with `offset` and joined before parsing.
   * The keys in RESOURCE_KEYS are not readable this way: use `resourceState`.
   */
  async state(key) {
    let json = '';
    for (let offset = 0, parts = 0; ; parts++) {
      const md = await this.text('devframe_state_read', {
        key: `pangular:${key}`,
        offset,
        maxChars: 50_000,
      });
      const start = md.indexOf('```json\n');
      const end = md.lastIndexOf('\n```');
      if (start < 0 || end < start) throw new Error(`state ${key}: ${md.slice(0, 200)}`);
      json += md.slice(start + '```json\n'.length, end);
      const next = /Pass `offset: (\d+)`/.exec(md)?.[1];
      if (next === undefined) break;
      offset = Number(next);
      if (parts > 400) throw new Error(`state ${key}: more than 400 parts`);
    }
    return JSON.parse(json);
  },
  /** The `pangular:` shared-state keys agents may read, from the key table. */
  async stateKeys() {
    const md = await this.text('devframe_state_read', {});
    return [...md.matchAll(/^\| `pangular:([^`]+)` \|/gm)].map((m) => m[1]);
  },
  async resource(id) {
    return this.resourceUri(`devframe://resource/${encodeURIComponent(id)}`);
  },
  async resourceUri(uri) {
    const result = await this.rpc('resources/read', { uri });
    return result.contents?.[0]?.text ?? '';
  },
  /**
   * The all-pages resource `pangular:<name>` parsed, for the keys that
   * `devframe_state_read` hides (RESOURCE_KEYS). Past 100,000 characters it
   * holds `truncated: true` and the page ids instead of the data.
   */
  async resourceState(name) {
    return JSON.parse(await this.resource(`pangular:${name}`));
  },
  /** `pangular://pages/{pageId}/<name>` parsed, or undefined when that page does not report it. */
  async pageResource(name, pageId) {
    const text = await this.resourceUri(`pangular://pages/${encodeURIComponent(pageId)}/${name}`);
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  },
  /** `list-pages` parsed into rows. */
  async pages() {
    const md = await this.tool('list-pages');
    return md
      .split('\n')
      .filter((l) => l.startsWith('| `'))
      .map((l) => {
        const cells = l.split(' | ').map((c) => c.replace(/^\|?\s*`?|`?\s*\|?$/g, ''));
        const last = cells[4] ?? '';
        return {
          id: cells[0],
          url: cells[1],
          title: cells[2],
          platform: cells[3],
          lastReport: last,
          ago: Number(/(\d+)s ago/.exec(last)?.[1] ?? NaN),
          background: /background/i.test(l),
          reports: cells[5] ?? '',
        };
      });
  },
};

/**
 * Shared-state keys that `devframe_state_read` hides because a resource serves
 * them (`RESOURCE_STATE_KEYS` in packages/devtools/src/config.ts, without
 * `routes`, which no collector fills). They are read through
 * `devframe://resource/pangular:<key>` (every page) or
 * `pangular://pages/{pageId}/<key>` (one page).
 */
const RESOURCE_KEYS = [
  'component-tree',
  'signal-graph',
  'injector-tree',
  'ngrx-store',
  'forms',
  'router',
];

/**
 * Every shared state, as `{key: json}`: the keys `devframe_state_read` lists,
 * plus the RESOURCE_KEYS through their all-pages resources (led by an
 * `_untrusted` notice).
 */
async function allStates() {
  const out = {};
  for (const key of await mcp.stateKeys()) {
    try {
      out[key] = JSON.stringify(await mcp.state(key));
    } catch (error) {
      out[key] = `error: ${error.message}`;
    }
  }
  for (const key of RESOURCE_KEYS) {
    try {
      out[key] = await mcp.resource(`pangular:${key}`);
    } catch (error) {
      out[key] = `error: ${error.message}`;
    }
  }
  return out;
}

/** The part of a shared state that belongs to one page. */
function pageSlice(key, value, pageId) {
  if (!value || typeof value !== 'object') return undefined;
  if (key === 'forms') {
    // Form ids end with `@<pageId>`.
    const forms = (value.forms ?? []).filter((f) => f.id?.endsWith(`@${pageId}`));
    const events = (value.events ?? []).filter((e) => e.formId?.endsWith(`@${pageId}`));
    return forms.length || events.length ? { forms, events } : undefined;
  }
  const pages = value.pages;
  if (Array.isArray(pages)) return pages.find((p) => p.pageId === pageId);
  if (pages && typeof pages === 'object') return pages[pageId];
  return undefined;
}

// ---------------------------------------------------------------- browser

let browser;
async function launch() {
  browser = await chromium.launch({
    ...(CHROME ? { executablePath: CHROME } : {}),
    args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'],
  });
  return browser;
}

/** WebSocket and devframe HTTP traffic of one page, for message rates. */
function trackTraffic(page) {
  const t = { wsOpened: 0, sent: 0, received: 0, bytesSent: 0, bytesReceived: 0, http: 0 };
  page.on('websocket', (ws) => {
    t.wsOpened++;
    ws.on('framesent', (f) => {
      t.sent++;
      t.bytesSent += f.payload?.length ?? 0;
    });
    ws.on('framereceived', (f) => {
      t.received++;
      t.bytesReceived += f.payload?.length ?? 0;
    });
  });
  page.on('request', (r) => {
    if (r.url().includes('/__devframes/') && r.resourceType() !== 'document') t.http++;
  });
  return t;
}

async function openTab(context, path, { errors = [], overlay = true } = {}) {
  const page = await context.newPage();
  const traffic = trackTraffic(page);
  page.on('pageerror', (e) => errors.push(`${path}: ${e.message}`));
  await page.goto(BASE + path, { waitUntil: 'load' });
  if (!overlay) {
    await page.waitForSelector('[ng-version]');
    return { page, id: null, traffic, path };
  }
  await page.waitForFunction(() => window.__pangularPageId, null, { timeout: 60_000 });
  const id = await page.evaluate(() => window.__pangularPageId);
  return { page, id, traffic, path };
}
const pageIdOf = (page) => page.evaluate(() => window.__pangularPageId);

/** Fakes a tab switch: the overlay listens to `visibilitychange`. */
async function setHidden(page, hidden) {
  await page.evaluate((h) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (h ? 'hidden' : 'visible'),
    });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

/** Kills the tab's renderer: the page goes without `pagehide`. The CDP call never answers. */
async function crashRenderer(page) {
  const cdp = await page.context().newCDPSession(page);
  void cdp.send('Page.crash').catch(() => {});
  await sleep(1000);
}

async function heapMb(page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('Performance.enable');
    const { metrics } = await cdp.send('Performance.getMetrics');
    const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
    return {
      heapMb: Math.round(m.JSHeapUsedSize / 104857.6) / 10,
      nodes: m.Nodes,
      listeners: m.JSEventListeners,
    };
  } finally {
    await cdp.detach().catch(() => {});
  }
}

// ---------------------------------------------------------------- demo actions

async function addStoreItems(page, n) {
  for (let i = 0; i < n; i++) await page.getByRole('button', { name: 'Add an item' }).click();
}
async function typeUsername(page, value) {
  const input = page.locator('input[formControlName="username"]');
  await input.fill(value);
  await input.blur();
}
/** In-app navigation through the router, like a click on a routerLink. */
async function routerGo(page, url) {
  await page.evaluate((u) => {
    const link = [...document.querySelectorAll('a[href]')].find(
      (a) => new URL(a.href).pathname === u,
    );
    if (link) {
      link.click();
      return;
    }
    // No link on screen: push the URL and let the router pick it up.
    history.pushState({}, '', u);
    dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, url);
}

// ---------------------------------------------------------------- multitab

async function checkMultitab() {
  section('multitab');
  const errors = [];
  const ctx = await browser.newContext();
  const A = await openTab(ctx, '/examples/store', { errors });
  await addStoreItems(A.page, 3);
  const B = await openTab(ctx, '/examples/forms', { errors });
  await typeUsername(B.page, 'tabBravo');
  const C = await openTab(ctx, '/examples/http', { errors });
  const D = await openTab(ctx, '/examples/forms', { errors });
  await typeUsername(D.page, 'tabDelta');
  const E = await openTab(
    ctx,
    appUrl({ components: 30, defers: 10, entities: 100, fields: 8, label: 'appTwo' }),
    { errors },
  );
  const tabs = { A, B, C, D, E };
  record(
    'tabs',
    Object.fromEntries(Object.entries(tabs).map(([k, t]) => [k, `${t.id} ${t.path}`])),
  );
  assert('every tab has its own pageId', new Set(Object.values(tabs).map((t) => t.id)).size === 5);

  // Wake the pages (no panel is open) and let them report.
  await mcp.tool('list-pages');
  await sleep(4000);
  const rows = await mcp.pages();
  record(
    'list-pages',
    rows.map((r) => `${r.id} ${r.url} ${r.lastReport}`),
  );
  for (const [name, t] of Object.entries(tabs)) {
    const row = rows.find((r) => r.id === t.id);
    assert(
      `list-pages lists tab ${name} with its URL`,
      row && row.url.split('?')[0] === t.path.split('?')[0],
      row ? row.url : 'missing',
    );
  }

  // Tools with `page` answer for that tab only.
  const marks = {
    A: 'StoreExample',
    B: 'tabBravo',
    C: 'HttpExample',
    D: 'tabDelta',
    E: 'appTwo',
  };
  for (const [name, t] of Object.entries(tabs)) {
    // The last line points to the other pages on purpose; leave it out.
    const route = (await mcp.tool('inspect-route', { page: t.id }))
      .split('\n')
      .filter((l) => !/other page\(s\) report too/.test(l))
      .join('\n');
    const otherPaths = Object.values(tabs)
      .filter((o) => o !== t && o.path.split('?')[0] !== t.path.split('?')[0])
      .map((o) => o.path.split('?')[0]);
    // E has no router: it must not get another tab's route instead.
    assert(
      `inspect-route page=${name} names its URL and no other tab's`,
      (name === 'E' || route.includes(t.path.split('?')[0])) &&
        !otherPaths.some((p) => route.includes(`\`${p}\``)),
      `${otherPaths.filter((p) => route.includes(`\`${p}\``)).join(',')} | ${route.slice(0, 100).replace(/\n/g, ' ')}`,
    );
    const comps = await mcp.tool('list-components', { page: t.id });
    const others = Object.entries(marks).filter(([n, m]) => n !== name && /Example|Root/.test(m));
    const leaked = others.filter(([, m]) => comps.includes(m)).map(([n]) => n);
    assert(`list-components page=${name} holds no other tab's components`, !leaked.length, leaked);
  }
  for (const [name, t] of [
    ['B', B],
    ['D', D],
  ]) {
    const list = await mcp.tool('inspect-forms', { page: t.id });
    const formId = /(\S*account\S*@\w+)/i.exec(list)?.[1]?.replace(/`/g, '');
    const detail = formId
      ? await mcp.tool('inspect-forms', { page: t.id, form: formId, includeValues: true })
      : '';
    const own = marks[name];
    const other = name === 'B' ? marks.D : marks.B;
    assert(
      `inspect-forms page=${name} shows its own value and not the other tab's`,
      detail.includes(own) && !detail.includes(other) && formId?.endsWith(`@${t.id}`),
      `${formId} own=${detail.includes(own)} other=${detail.includes(other)}`,
    );
  }
  const storeA = await mcp.tool('ngrx-inspect-store', { page: A.id });
  const storeB = await mcp.tool('ngrx-inspect-store', { page: B.id });
  const storeE = await mcp.tool('ngrx-inspect-store', { page: E.id });
  assert(
    'ngrx-inspect-store is scoped per page',
    storeA.includes('StoreExample (component)') &&
      !storeB.includes('StoreExample') &&
      !storeE.includes('StoreExample') &&
      storeE.includes(E.id) &&
      !storeE.includes(A.id),
    `A=${storeA.includes('StoreExample')} B=${storeB.includes('StoreExample')} E=${storeE.includes('StoreExample')}`,
  );
  const httpC = await mcp.tool('list-http-calls', { page: C.id });
  const httpE = await mcp.tool('list-http-calls', { page: E.id });
  assert(
    'list-http-calls is scoped per page',
    httpC.includes('/api/products') && !httpE.includes('/api/products'),
    `C=${httpC.includes('/api/products')} E=${httpE.includes('/api/products')}`,
  );
  const unknown = await mcp.tool('list-components', { page: 'nosuchid' });
  assert(
    'an unknown page id answers with the tabs that report, not with data',
    !unknown.includes('StoreExample') && unknown.includes(A.id),
    unknown.slice(0, 160).replace(/\n/g, ' '),
  );
  for (const [name, t] of Object.entries(tabs)) {
    const snap = await mcp.tool('snapshot', { page: t.id });
    const foreign = Object.entries(marks)
      .filter(([n]) => n !== name)
      .filter(([, m]) => snap.includes(m))
      .map(([n]) => n);
    assert(`snapshot page=${name} holds no other tab's marks`, !foreign.length, foreign.join(','));
  }

  // Shared state: every page's slice holds only its own marks.
  const states = await allStates();
  const leaks = [];
  for (const [key, json] of Object.entries(states)) {
    const value = json.startsWith('error') ? null : JSON.parse(json);
    for (const [name, t] of Object.entries(tabs)) {
      const slice = pageSlice(key, value, t.id);
      if (!slice) continue;
      const text = JSON.stringify(slice);
      for (const [other, m] of Object.entries(marks)) {
        if (other !== name && text.includes(m)) leaks.push(`${key}[${name}] has ${other}'s ${m}`);
      }
      for (const [other, o] of Object.entries(tabs)) {
        if (other !== name && text.includes(`@${o.id}`)) leaks.push(`${key}[${name}] has @${o.id}`);
      }
    }
  }
  // The per-page resources serve the hidden keys one page at a time: the same check.
  for (const key of RESOURCE_KEYS) {
    for (const [name, t] of Object.entries(tabs)) {
      const value = await mcp.pageResource(key, t.id);
      if (!value) continue;
      const text = JSON.stringify(value);
      for (const [other, m] of Object.entries(marks)) {
        if (other !== name && text.includes(m))
          leaks.push(`pages/${name}/${key} has ${other}'s ${m}`);
      }
      for (const [other, o] of Object.entries(tabs)) {
        if (other !== name && text.includes(o.id)) leaks.push(`pages/${name}/${key} has ${o.id}`);
      }
    }
  }
  assert("no shared-state page slice holds another tab's data", !leaks.length, leaks.join('; '));
  record(
    'state sizes (bytes)',
    Object.fromEntries(Object.entries(states).map(([k, v]) => [k, v.length])),
  );

  // The panel scoped with ?pageId.
  const panelCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const panel = await panelCtx.newPage();
  for (const [name, t, want, notWant] of [
    ['A', A, 'StoreExample', 'StressRoot'],
    ['E', E, 'StressRoot', 'StoreExample'],
  ]) {
    await panel.goto(`${BASE}/__devframes/pangular/?pageId=${t.id}#tab=components`);
    const ms = await waitUntil(
      async () => (await panel.locator('body').innerText()).includes(want),
      20_000,
    );
    const text = await panel.locator('body').innerText();
    assert(
      `panel ?pageId=${name} Components shows ${want} and not ${notWant}`,
      ms !== null && !text.includes(notWant),
      `found after ${ms} ms`,
    );
  }
  for (const [name, t, want, notWant] of [
    ['B', B, B.id, D.id],
    ['D', D, D.id, B.id],
  ]) {
    await panel.goto(`${BASE}/__devframes/pangular/?pageId=${t.id}#tab=forms`);
    await waitUntil(
      async () => /Reactive|account/i.test(await panel.locator('body').innerText()),
      15_000,
    );
    await sleep(1000);
    const html = await panel.content();
    const text = await panel.locator('body').innerText();
    record(`panel forms ?pageId=${name} mentions`, {
      own: html.includes(want),
      other: html.includes(notWant),
      accountForms: (text.match(/account/gi) ?? []).length,
    });
    assert(
      `panel Forms ?pageId=${name} does not show the other tab's forms`,
      !html.includes(`@${notWant}`),
    );
  }
  // Scoped to one tab, Forms offers the other pages (or "All pages") as a choice.
  const pickerText = await panel.locator('body').innerText();
  const pickerHtml = await panel.content();
  record('panel Forms ?pageId=D offers other pages', {
    allPages: /All pages/.test(pickerText) || /All pages/.test(pickerHtml),
    otherPagesLine: pickerText
      .split('\n')
      .filter((l) => /other (page|tab)/i.test(l))
      .slice(0, 2),
  });
  await panelCtx.close();

  assert('no page errors in the tabs', !errors.length, errors.join('; '));
  await ctx.close();
}

// ---------------------------------------------------------------- expiry

async function presence(ids) {
  const rows = await mcp.pages().catch(() => []);
  const states = await allStates();
  const out = {};
  for (const id of ids) {
    const row = rows.find((r) => r.id === id);
    out[id] = {
      listed: !!row,
      background: !!row?.background,
      ago: row?.ago,
      reports: row?.reports,
      keys: Object.entries(states)
        .filter(([, json]) => json.includes(id))
        .map(([k]) => k),
    };
  }
  return out;
}

async function checkExpiry() {
  section('expiry');
  const errors = [];
  // Separate contexts, so a crashed renderer takes no other tab with it.
  const ctxs = await Promise.all([1, 2, 3, 4].map(() => browser.newContext()));
  const closeTab = await openTab(ctxs[0], '/examples/forms', { errors });
  const crashTab = await openTab(ctxs[1], '/examples/forms', { errors });
  const hiddenTab = await openTab(ctxs[2], '/examples/store', { errors });
  const keepTab = await openTab(ctxs[3], '/examples/http', { errors });
  await typeUsername(closeTab.page, 'closeMe');
  await typeUsername(crashTab.page, 'crashMe');
  await mcp.tool('list-pages');
  await sleep(4000);
  const ids = {
    close: closeTab.id,
    crash: crashTab.id,
    hidden: hiddenTab.id,
    keep: keepTab.id,
  };
  record('ids', ids);
  const before = await presence(Object.values(ids));
  record(
    'keys per page before',
    Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, before[id].keys.length])),
  );

  const t0 = Date.now();
  await closeTab.page.close({ runBeforeUnload: true });
  await crashRenderer(crashTab.page);
  await setHidden(hiddenTab.page, true);

  const firstGone = { close: {}, crash: {} };
  const listedGone = {};
  let hiddenMarked = null;
  let last;
  while (Date.now() - t0 < 200_000) {
    last = await presence(Object.values(ids));
    const s = Math.round((Date.now() - t0) / 1000);
    for (const which of ['close', 'crash']) {
      const p = last[ids[which]];
      if (!p.listed && listedGone[which] === undefined) listedGone[which] = s;
      for (const key of before[ids[which]].keys) {
        if (!p.keys.includes(key) && firstGone[which][key] === undefined) firstGone[which][key] = s;
      }
    }
    if (hiddenMarked === null && last[ids.hidden].background) hiddenMarked = s;
    const done = ['close', 'crash'].every((w) => !last[ids[w]].listed && !last[ids[w]].keys.length);
    if (done && Date.now() - t0 > 45_000) break;
    await sleep(2000);
  }
  const elapsed = Math.round((Date.now() - t0) / 1000);
  for (const which of ['close', 'crash']) {
    const remaining = last[ids[which]].keys;
    record(`${which}: seconds until gone from list-pages`, listedGone[which] ?? `>${elapsed}`);
    record(`${which}: seconds until each key dropped`, firstGone[which]);
    if (remaining.length)
      record(`${which}: keys still holding the page after ${elapsed}s`, remaining);
  }
  assert(
    'a closed tab (pagehide) leaves list-pages within 20 s',
    listedGone.close !== undefined && listedGone.close <= 20,
    `${listedGone.close ?? 'never'} s`,
  );
  assert(
    'a closed tab (pagehide) leaves every shared state within 20 s',
    Object.values(firstGone.close).every((s) => s <= 20) && !last[ids.close].keys.length,
    JSON.stringify(firstGone.close),
  );
  // A tab that dies without pagehide goes with the one page expiry (#422): 30 s after its last
  // report, plus up to 5 s until the sweep, the 2 s poll and the time the reads take.
  assert(
    'a crashed tab leaves list-pages within 45 s (30 s expiry)',
    listedGone.crash !== undefined && listedGone.crash <= 45,
    `${listedGone.crash ?? 'never'} s`,
  );
  assert(
    'a crashed tab leaves every shared state within 45 s (30 s expiry)',
    Object.values(firstGone.crash).every((s) => s <= 45) && !last[ids.crash].keys.length,
    JSON.stringify(firstGone.crash),
  );
  assert('the open tab is still listed', last[ids.keep].listed);
  assert(
    'a background tab is marked (background) in list-pages',
    hiddenMarked !== null,
    `after ${hiddenMarked} s`,
  );
  assert(
    'a background tab keeps its last data past the 30 s expiry',
    last[ids.hidden].listed &&
      before[ids.hidden].keys.every((k) => last[ids.hidden].keys.includes(k)),
    `missing: ${before[ids.hidden].keys.filter((k) => !last[ids.hidden].keys.includes(k))}`,
  );
  const comps = await mcp.tool('list-components', { page: ids.hidden });
  assert(
    'tools answer from a background tab’s last data',
    comps.includes('StoreExample'),
    comps.slice(0, 120).replace(/\n/g, ' '),
  );
  await setHidden(hiddenTab.page, false);
  const back = await waitUntil(async () => {
    const row = (await mcp.pages()).find((r) => r.id === ids.hidden);
    return row && !row.background && row.ago <= 3;
  }, 15_000);
  assert('a tab shown again reports fresh data', back !== null, `${back} ms`);

  if (flag('hidden-ttl')) {
    await setHidden(hiddenTab.page, true);
    await sleep(3000);
    const t1 = Date.now();
    await crashRenderer(hiddenTab.page);
    let gone = null;
    while (Date.now() - t1 < 400_000) {
      const p = (await presence([ids.hidden]))[ids.hidden];
      if (!p.listed && !p.keys.length) {
        gone = Math.round((Date.now() - t1) / 1000);
        break;
      }
      await sleep(10_000);
    }
    record('crashed background tab: seconds until dropped', gone ?? '>400');
    assert(
      'a background tab that stops saying it is there is dropped after about 5 minutes',
      gone !== null && gone <= 330,
      `${gone} s`,
    );
  }
  assert('no page errors', !errors.length, errors.join('; '));
  await Promise.all(ctxs.map((c) => c.close().catch(() => {})));
}

// ---------------------------------------------------------------- lifecycle

async function checkLifecycle(server) {
  section('lifecycle');
  const errors = [];
  const ctx = await browser.newContext();
  const L = await openTab(ctx, '/examples/store', { errors });
  await addStoreItems(L.page, 2);
  await mcp.tool('list-pages');
  await sleep(3000);

  // Full reload: same tab, same pageId (sessionStorage), no duplicate row.
  await L.page.reload();
  await L.page.waitForFunction(() => window.__pangularPageId);
  const afterReload = await pageIdOf(L.page);
  assert('a reload keeps the pageId', afterReload === L.id, `${L.id} -> ${afterReload}`);
  await mcp.tool('list-pages');
  await sleep(3000);
  let rows = await mcp.pages();
  assert(
    'a reload leaves one row for the tab',
    rows.filter((r) => r.id === L.id).length === 1 && rows.length >= 1,
    rows.map((r) => r.id).join(','),
  );
  const store = await mcp.tool('ngrx-inspect-store', { page: L.id });
  record('store after reload', store.slice(0, 200).replace(/\n/g, ' '));

  // A hard navigation in the same tab keeps the id too.
  await L.page.goto(`${BASE}/examples/forms`);
  await L.page.waitForFunction(() => window.__pangularPageId);
  assert('a hard navigation keeps the pageId', (await pageIdOf(L.page)) === L.id);

  // Duplicated tab: window.open copies sessionStorage, the overlay must mint a new id.
  const [dup] = await Promise.all([
    ctx.waitForEvent('page'),
    L.page.evaluate(() => window.open(location.href, '_blank')),
  ]);
  await dup.waitForFunction(() => window.__pangularPageId, null, { timeout: 60_000 });
  const dupId = await pageIdOf(dup);
  const dupSession = await dup.evaluate(() => JSON.stringify(sessionStorage));
  record('opened tab sessionStorage', dupSession.slice(0, 200));
  assert(
    'a tab opened from another (copied sessionStorage) gets its own pageId',
    dupId !== L.id,
    `${L.id} vs ${dupId}`,
  );
  await mcp.tool('list-pages');
  await sleep(4000);
  rows = await mcp.pages();
  const origRow = rows.find((r) => r.id === L.id);
  assert(
    'the original tab keeps reporting after the copy opened',
    origRow && origRow.ago <= 6,
    origRow?.lastReport,
  );
  await dup.close({ runBeforeUnload: true });

  // In-app navigation keeps the id and is recorded.
  await routerGo(L.page, '/examples/store');
  await L.page.waitForURL('**/examples/store');
  await routerGo(L.page, '/examples/http');
  await L.page.waitForURL('**/examples/http');
  assert('in-app navigation keeps the pageId', (await pageIdOf(L.page)) === L.id);
  await sleep(2500);
  const nav = await mcp.tool('explain-navigation', { page: L.id });
  assert(
    'explain-navigation lists the in-app navigations',
    nav.includes('/examples/http') && nav.includes('/examples/store'),
    nav.slice(0, 160).replace(/\n/g, ' '),
  );

  if (!server) {
    record('server restart', 'skipped (--no-spawn)');
    await ctx.close();
    return;
  }

  // Server restart with the tab and a panel open.
  const panelCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const panel = await panelCtx.newPage();
  const panelTraffic = trackTraffic(panel);
  await panel.goto(`${BASE}/__devframes/pangular/?pageId=${L.id}#tab=components`);
  await waitUntil(
    async () => (await panel.locator('body').innerText()).includes('HttpExample'),
    20_000,
  );
  await L.page.evaluate(() => (window.__noReload = true));
  const wsBefore = { page: L.traffic.wsOpened, panel: panelTraffic.wsOpened };

  for (const variant of ['with panel', 'without panel']) {
    if (variant === 'without panel') await panelCtx.close();
    await server.stop();
    await sleep(3000);
    const restarted = startServer();
    await restarted.ready;
    Object.assign(server, restarted);
    const t0 = Date.now();
    if (variant === 'with panel') {
      const back = await waitUntil(
        async () => {
          const row = (await mcp.pages()).find((r) => r.id === L.id);
          return row && /components/.test(row.reports);
        },
        60_000,
        1000,
      );
      record(`restart ${variant}: ms until the tab reports components again`, back);
      assert(`after a restart (${variant}) the tab reports again without a reload`, back !== null);
      // The panel reconnects by itself; check that it reaches the new server
      // (a WebSocket opened) and what it shows for the tab.
      const panelWs = await waitUntil(
        async () => panelTraffic.wsOpened > wsBefore.panel,
        60_000,
        500,
      );
      record('restart with panel: ms until the panel opened a new connection', panelWs);
      assert('the panel reconnects to the restarted server', panelWs !== null);
      await sleep(5000);
      const ptext = await panel.locator('body').innerText();
      record('panel text after the restart', ptext.replace(/\s+/g, ' ').slice(0, 300));
      record('websockets opened during the restart', {
        page: L.traffic.wsOpened - wsBefore.page,
        panel: panelTraffic.wsOpened - wsBefore.panel,
      });
    } else {
      await sleep(10_000);
      const comps = await mcp.tool('list-components', { page: L.id });
      const ms = Date.now() - t0;
      assert(
        `after a restart (${variant}) an agent call gets the tab's data`,
        comps.includes('HttpExample'),
        `${ms} ms; ${comps.slice(0, 120).replace(/\n/g, ' ')}`,
      );
      const forms = await mcp.tool('explain-navigation', { page: L.id });
      record('explain-navigation after restart', forms.slice(0, 160).replace(/\n/g, ' '));
    }
    assert(
      `the tab did not reload (${variant})`,
      await L.page.evaluate(() => window.__noReload === true),
    );
    assert(`the tab kept its pageId (${variant})`, (await pageIdOf(L.page)) === L.id);
  }
  // A reload is the way back: the tab reports to the new server again.
  await L.page.reload();
  await L.page.waitForFunction(() => window.__pangularPageId);
  await mcp.tool('list-pages');
  const recovered = await waitUntil(async () => {
    const row = (await mcp.pages()).find((r) => r.id === L.id);
    return row && /components/.test(row.reports);
  }, 20_000);
  assert(
    'after a reload the tab reports to the restarted server',
    recovered !== null,
    `${recovered} ms`,
  );
  assert('no page errors', !errors.length, errors.join('; '));
  await ctx.close();
}

// ---------------------------------------------------------------- stress

async function checkStress() {
  section('stress');
  const errors = [];
  const ctx = await browser.newContext();
  const sizes = { components: 2000, defers: 520, entities: 10000, fields: 300, label: 'big' };
  const t0 = Date.now();
  const S = await openTab(ctx, appUrl(sizes), { errors });
  record('ms until the overlay claimed a pageId', Date.now() - t0);
  await mcp.tool('list-pages');
  await sleep(5000);
  const id = S.id;

  // The component tree is read through the page's resource (state reads hide it).
  // Past 100,000 characters the resource holds only `truncated: true`, so the
  // page's own flag is then read from list-components, which prints
  // `truncatedBy` as "stops at the first <n> component instances".
  const tree = await mcp.pageResource('component-tree', id);
  const own = tree?.pages?.[id] ?? {};
  const list = await mcp.tool('list-components', { page: id });
  const listNote = list.split('\n').filter((l) => /trunc|limit|stops at|more|cut/i.test(l));
  record('component-tree page', {
    resource: tree?.truncated ? 'past 100,000 characters' : 'whole',
    count: own.count,
    directiveHostCount: own.directiveHostCount,
    truncated: own.truncated,
    truncatedBy: own.truncatedBy,
    deferBlocks: Array.isArray(own.deferBlocks) ? own.deferBlocks.length : own.deferBlocks,
    bytes: JSON.stringify(own).length,
  });
  const flagged = tree?.truncated
    ? listNote.some((l) => l.includes(`page \`${id}\` stops at the first 2000 `))
    : own.truncated === true;
  assert(
    'component-tree flags truncation at 2000 instances',
    flagged,
    tree?.truncated ? 'from list-components' : JSON.stringify(own.truncatedBy),
  );

  record('list-components chars', list.length);
  record('list-components notes', listNote.slice(0, 4));
  assert(
    'list-components says the tree was cut',
    listNote.some((l) => /stops at the first 2000/i.test(l)),
  );

  const defers = await mcp.tool('defer-blocks', { page: id });
  const deferNote = defers
    .split('\n')
    .filter((l) => /\d+ defer|trunc|limit|first|more|of 5/i.test(l));
  record('defer-blocks chars', defers.length);
  record('defer-blocks notes', deferNote.slice(0, 4));
  assert(
    'defer-blocks says there are more blocks than it lists (520 > 500)',
    deferNote.some((l) => /500\+|more|trunc|limit|first 500|of 520/i.test(l)),
  );

  const storeList = await mcp.tool('ngrx-inspect-store', { page: id });
  const storeId = /`(ngrx-\d+)`/.exec(storeList)?.[1];
  const storeDetail = storeId
    ? await mcp.tool('ngrx-inspect-store', { page: id, store: storeId })
    : '';
  record('ngrx-inspect-store detail chars', storeDetail.length);
  record(
    'ngrx-inspect-store notes',
    storeDetail
      .split('\n')
      .filter((l) => /trunc|more|limit|cut|10000|10,000/i.test(l))
      .slice(0, 4),
  );
  const ngrx = await mcp.pageResource('ngrx-store', id);
  const ngrxPage = (ngrx?.pages ?? []).find((p) => p.pageId === id);
  record('ngrx-store page bytes', JSON.stringify(ngrxPage ?? {}).length);

  const formsList = await mcp.tool('inspect-forms', { page: id });
  const formId = /(StressRoot\.form@\w+)/.exec(formsList)?.[1];
  record(
    'inspect-forms list',
    formsList.split('\n').filter((l) => l.includes('StressRoot')),
  );
  const formDetail = formId ? await mcp.tool('inspect-forms', { page: id, form: formId }) : '';
  record('inspect-forms detail chars', formDetail.length);
  const formNotes = formDetail
    .split('\n')
    .filter((l) => !l.startsWith('[') && /trunc|more|limit|cut|not shown|left out/i.test(l));
  record('inspect-forms notes', formNotes.slice(0, 4));
  record(
    'inspect-forms "truncated" counts in the JSON',
    formDetail.match(/"truncated":\d+/g) ?? [],
  );
  const listed = Number(/(\d+) fields/.exec(formsList)?.[1]);
  // The forms collector keeps 100 children per group and says so (#423).
  assert(
    'inspect-forms counts the 300 controls of the form (or says it stopped at a limit)',
    listed >= 300 || formNotes.some((l) => /300|200 more|limit of 100|first 100/i.test(l)),
    `${listed} fields; ${formNotes[0] ?? ''}`,
  );
  await S.page.evaluate(() => window.__stress.invalidate(250));
  await sleep(2500);
  const invalid = await mcp.tool('explain-invalid-forms', { page: id, form: formId });
  record('explain-invalid-forms with field250 failing', invalid.replace(/\s+/g, ' ').slice(0, 300));
  assert(
    'explain-invalid-forms names a failing field past the 100th control',
    invalid.includes('field250'),
  );

  // Long histories.
  for (let i = 0; i < 300; i++)
    await S.page.evaluate((n) => window.__stress.setField(n % 300, `v${n}`), i);
  await S.page.evaluate(() => window.__stress.bump(400));
  await S.page.evaluate(async () => {
    for (let i = 0; i < 120; i++) {
      window.__stress.tick(1);
      await window.__stress.settle();
    }
  });
  await mcp.tool('record-change-detection', { page: id, record: 'start' });
  await S.page.evaluate(async () => {
    for (let i = 0; i < 300; i++) {
      window.__stress.tick(1);
      await new Promise((r) => requestAnimationFrame(r));
    }
  });
  await sleep(3000);
  const history = await mcp.tool('list-form-changes', { page: id, form: formId, limit: 500 });
  const historyNote = history
    .split('\n')
    .filter((l) => /dropped|older|latest|limit|showing/i.test(l));
  record('list-form-changes notes', historyNote.slice(0, 3));
  assert('list-form-changes says older events were dropped', historyNote.length > 0);
  const formsState = await mcp.resourceState('forms');
  record(
    'forms state: events kept / dropped',
    `${formsState.events?.length} / ${JSON.stringify(formsState.dropped)}`,
  );
  assert('forms timeline keeps at most 200 events', (formsState.events?.length ?? 0) <= 200);

  const log = await mcp.tool('ngrx-history', { page: id });
  const logRows = log.split('\n').filter((l) => /^\|\s*\d+/.test(l) || /^- /.test(l)).length;
  record('ngrx-history chars / rows', `${log.length} / ${logRows}`);
  const ngrx2 = await mcp.pageResource('ngrx-store', id);
  const p2 = (ngrx2?.pages ?? []).find((p) => p.pageId === id) ?? {};
  const changeLog = p2.log ?? p2.changeLog ?? p2.entries ?? [];
  record(
    'ngrx change log kept / dropped',
    `${Array.isArray(changeLog) ? changeLog.length : '?'} / ${p2.dropped}`,
  );
  assert(
    'ngrx change log keeps at most 200 entries and counts the dropped ones',
    Array.isArray(changeLog) && changeLog.length <= 200 && p2.dropped > 0,
  );

  const ticks = await mcp.tool('inspect-signals', {
    component: 'StressRoot',
    page: id,
    node: 'ticks',
  });
  let tickHistory = 0;
  try {
    const json = JSON.parse(ticks.slice(ticks.indexOf('{'), ticks.lastIndexOf('}') + 1));
    tickHistory = Math.max(0, ...Object.values(json.history ?? {}).map((h) => h.length));
  } catch {
    tickHistory = -1;
  }
  const tickNotes = ticks.split('\n').filter((l) => /older|dropped|more|latest|last \d+/i.test(l));
  record('signal `ticks` history entries after 120 writes', tickHistory);
  record('signal history notes', tickNotes.slice(0, 3));
  assert(
    'signal history keeps at most 50 entries per node',
    tickHistory > 0 && tickHistory <= 50,
    tickHistory,
  );

  const cd = await mcp.tool('change-detection', { page: id });
  const cdNote = cd.split('\n').filter((l) => /cycles|dropped|latest|limit/i.test(l));
  record('change-detection notes', cdNote.slice(0, 4));
  const cdState = await mcp.state('change-detection');
  const cdPage = cdState.pages?.[id] ?? {};
  const cycles = cdPage.cycles?.length ?? cdPage.recording?.cycles?.length;
  record(
    'change-detection cycles kept / dropped',
    `${cycles} / ${cdPage.dropped ?? cdPage.recording?.dropped}`,
  );
  assert(
    'change detection keeps at most 200 cycles',
    cycles === undefined || cycles <= 200,
    cycles,
  );
  await mcp.tool('record-change-detection', { page: id, record: 'stop' });

  const snap = await mcp.tool('snapshot', { page: id });
  record('snapshot chars', snap.length);
  for (const res of [
    'pangular:component-tree',
    'pangular:injector-tree',
    'pangular:forms',
    'pangular:ngrx-store',
  ]) {
    const text = await mcp.resource(res).catch((e) => `error ${e.message}`);
    let truncated;
    try {
      truncated = JSON.parse(text).truncated;
    } catch {
      truncated = 'unparsed';
    }
    record(`resource ${res}`, { chars: text.length, truncated });
    assert(`resource ${res} stays near 100,000 characters`, text.length <= 150_000, text.length);
  }
  const states = await allStates();
  record(
    'state sizes (bytes)',
    Object.fromEntries(Object.entries(states).map(([k, v]) => [k, v.length])),
  );
  record('stress page heap', await heapMb(S.page));

  // The panel with the large page.
  const panelCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const panel = await panelCtx.newPage();
  panel.on('pageerror', (e) => errors.push(`panel: ${e.message}`));
  const p0 = Date.now();
  await panel.goto(`${BASE}/__devframes/pangular/?pageId=${id}#tab=components`);
  const treeMs = await waitUntil(
    async () => (await panel.locator('body').innerText()).includes('StressCell'),
    60_000,
    100,
  );
  record('panel: ms from navigation to Components tree rows (rough)', treeMs ?? 'timeout');
  void p0;
  const ptext = await panel.locator('body').innerText();
  const pills = [...new Set(ptext.match(/\b\d[\d,]*\+/g) ?? [])];
  const panelNotes = ptext
    .split('\n')
    .filter((l) => /trunc|limit|first|more than|cut|2000|2,000|\+/i.test(l));
  record('panel Components pills with +', pills);
  record('panel Components notes', panelNotes.slice(0, 6));
  assert(
    'panel Components says the tree was cut',
    panelNotes.some((l) => /trunc|limit|cut|first|more/i.test(l)),
  );
  const respond = Date.now();
  const search = panel.getByRole('searchbox').first();
  if (await search.count()) {
    await search.fill('StressRoot');
    record('panel: ms to filter the tree (rough)', Date.now() - respond);
  }
  for (const tab of ['forms', 'store', 'signals', 'injectors', 'timeline']) {
    const t1 = Date.now();
    // A hash-only change does not reload the panel, so leave it first.
    await panel.goto('about:blank');
    await panel.goto(`${BASE}/__devframes/pangular/?pageId=${id}#tab=${tab}`);
    await sleep(2500);
    const text = await panel.locator('body').innerText();
    const notes = text.split('\n').filter((l) => /trunc|limit|dropped|older|more|\d+\+/i.test(l));
    record(`panel ${tab}: notes`, notes.slice(0, 4));
    record(`panel ${tab}: loaded`, Date.now() - t1);
  }
  record('panel heap', await heapMb(panel));
  await panelCtx.close();
  assert('no page or panel errors', !errors.length, errors.join('; '));
  await ctx.close();
}

// ---------------------------------------------------------------- soak

const DEMO_ROUTES = [
  '/examples/forms',
  '/examples/store',
  '/examples/http',
  '/examples/signals',
  '/destinations',
  '/examples/routes/users/42',
];

async function userStep(tab, n) {
  const route = DEMO_ROUTES[n % DEMO_ROUTES.length];
  await routerGo(tab.page, route);
  await tab.page.waitForURL(`**${route}`, { timeout: 10_000 }).catch(() => {});
  await sleep(400);
  if (route === '/examples/forms') {
    await typeUsername(tab.page, `user${n}`).catch(() => {});
    await tab.page
      .locator('input[name="fullName"]')
      .fill(`Name ${n}`)
      .catch(() => {});
  } else if (route === '/examples/store') {
    await tab.page
      .getByRole('button', { name: 'Add an item' })
      .click()
      .catch(() => {});
    await tab.page
      .locator('li input[type="checkbox"]')
      .first()
      .click()
      .catch(() => {});
  } else if (route === '/examples/http') {
    await tab.page
      .locator('button.reload')
      .click()
      .catch(() => {});
  } else if (route === '/examples/signals') {
    await tab.page
      .locator('button')
      .first()
      .click()
      .catch(() => {});
  }
}

async function soakSample(server, tabs, panel, minute, prev) {
  const sample = { minute, serverRssMb: server?.rssMb() ?? null };
  for (const [name, t] of Object.entries(tabs)) {
    const h = await heapMb(t.page).catch(() => ({}));
    sample[`${name}HeapMb`] = h.heapMb;
    sample[`${name}Nodes`] = h.nodes;
    sample[`${name}Listeners`] = h.listeners;
    const p = prev?.traffic?.[name] ?? { sent: 0, received: 0, bytesSent: 0 };
    sample[`${name}WsSentPerMin`] = t.traffic.sent - p.sent;
    sample[`${name}WsRecvPerMin`] = t.traffic.received - p.received;
    sample[`${name}KbSentPerMin`] = Math.round((t.traffic.bytesSent - p.bytesSent) / 1024);
  }
  if (panel) {
    const h = await heapMb(panel.page).catch(() => ({}));
    sample.panelHeapMb = h.heapMb;
    const p = prev?.traffic?.panel ?? { received: 0, bytesReceived: 0 };
    sample.panelWsRecvPerMin = panel.traffic.received - p.received;
    sample.panelKbRecvPerMin = Math.round((panel.traffic.bytesReceived - p.bytesReceived) / 1024);
  }
  sample.traffic = Object.fromEntries(
    [...Object.entries(tabs), ...(panel ? [['panel', panel]] : [])].map(([k, t]) => [
      k,
      { ...t.traffic },
    ]),
  );
  return sample;
}

async function capsSnapshot(ids) {
  const caps = {};
  // The hidden keys come from their all-pages resources.
  const router = await mcp.resourceState('router');
  for (const id of ids) {
    const p = (router.pages ?? []).find((x) => x.pageId === id);
    caps[`navigations ${id}`] = p?.navigations?.length;
  }
  const forms = await mcp.resourceState('forms');
  caps.formEvents = forms.events?.length;
  caps.formDropped = forms.dropped;
  const ngrx = await mcp.resourceState('ngrx-store');
  for (const p of ngrx.pages ?? []) {
    const log = p.log ?? p.changeLog ?? p.entries;
    caps[`ngrx log ${p.pageId}`] =
      `${Array.isArray(log) ? log.length : '?'} (dropped ${p.dropped ?? 0})`;
  }
  const signals = await mcp.resourceState('signal-graph');
  const lengths = [];
  // `history` is a record of change lists by node id (an array in older shapes).
  JSON.stringify(signals, (k, v) => {
    if (k !== 'history' || !v || typeof v !== 'object') return v;
    for (const list of Array.isArray(v) ? [v] : Object.values(v)) {
      if (Array.isArray(list)) lengths.push(list.length);
    }
    return v;
  });
  caps.signalHistoryMax = Math.max(0, ...lengths);
  const http = await mcp.state('http');
  caps.httpRequests = http.requests?.length;
  return caps;
}

async function checkSoak(server) {
  section(NO_OVERLAY ? 'soak (no overlay)' : 'soak');
  const errors = [];
  const ctx = await browser.newContext();
  // Without the overlay: its connection lookups fail, so it never starts.
  if (NO_OVERLAY) await ctx.route('**/__devframe*/**', (route) => route.abort());
  const overlay = !NO_OVERLAY;
  const tabs = {
    t1: await openTab(ctx, '/examples/forms', { errors, overlay }),
    t2: await openTab(ctx, '/examples/store', { errors, overlay }),
  };
  if (NO_OVERLAY) {
    const started = await tabs.t1.page.evaluate(() => !!window.__pangularPageId);
    assert('the overlay did not start', !started);
  }
  const panelCtx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const panelPage = await panelCtx.newPage();
  const panel = NO_OVERLAY ? null : { page: panelPage, traffic: trackTraffic(panelPage) };
  panelPage.on('pageerror', (e) => errors.push(`panel: ${e.message}`));
  if (panel) {
    await panelPage.goto(`${BASE}/__devframes/pangular/?pageId=${tabs.t1.id}#tab=components`);
  }
  const ids = Object.values(tabs).map((t) => t.id);
  record('ids', ids);

  const samples = [];
  const stateSizes = [];
  let prev = await soakSample(server, tabs, panel, 0, null);
  samples.push(prev);
  const start = Date.now();
  let step = 0;
  let nextSample = start + 60_000;
  const panelTabs = ['components', 'forms', 'store', 'timeline', 'signals', 'router'];
  while (Date.now() - start < SOAK_MINUTES * 60_000) {
    await Promise.all(Object.values(tabs).map((t, i) => userStep(t, step + i * 3).catch(() => {})));
    step++;
    if (panel && step % 20 === 0) {
      const tab = panelTabs[(step / 20) % panelTabs.length];
      await panelPage
        .goto(`${BASE}/__devframes/pangular/?pageId=${tabs.t1.id}#tab=${tab}`)
        .catch(() => {});
    }
    await sleep(1500);
    if (Date.now() >= nextSample) {
      const minute = Math.round((Date.now() - start) / 60_000);
      const s = await soakSample(server, tabs, panel, minute, prev);
      const sizes = Object.fromEntries(
        Object.entries(await allStates()).map(([k, v]) => [k, v.length]),
      );
      stateSizes.push({ minute, total: Object.values(sizes).reduce((a, b) => a + b, 0), ...sizes });
      s.stateKb = Math.round(stateSizes.at(-1).total / 1024);
      samples.push(s);
      prev = s;
      const { traffic, ...row } = s;
      void traffic;
      console.log('  sample', JSON.stringify(row));
      nextSample += 60_000;
    }
  }
  record('steps', step);
  if (NO_OVERLAY) {
    current.data.samples = samples.map(({ traffic, ...row }) => row);
    await panelCtx.close();
    await ctx.close();
    return;
  }
  const caps = await capsSnapshot(ids);
  record('caps after the loop', caps);
  for (const id of ids) {
    const n = caps[`navigations ${id}`];
    assert(`router keeps at most 50 navigations (${id})`, n === undefined || n <= 50, n);
  }
  assert('forms timeline keeps at most 200 events', (caps.formEvents ?? 0) <= 200, caps.formEvents);
  assert(
    'signal history keeps at most 50 entries per node',
    caps.signalHistoryMax <= 50,
    caps.signalHistoryMax,
  );
  assert('http keeps at most 200 calls', (caps.httpRequests ?? 0) <= 200, caps.httpRequests);

  // Idle: no user, no panel, no agent call. Pages should only say they are there.
  await panelCtx.close();
  const idle = async (label, minutes) => {
    const before = Object.fromEntries(Object.entries(tabs).map(([k, t]) => [k, { ...t.traffic }]));
    await sleep(minutes * 60_000);
    const rate = {};
    for (const [k, t] of Object.entries(tabs)) {
      rate[k] = {
        sentPerMin: Math.round((t.traffic.sent - before[k].sent) / minutes),
        recvPerMin: Math.round((t.traffic.received - before[k].received) / minutes),
        kbSentPerMin: Math.round((t.traffic.bytesSent - before[k].bytesSent) / 1024 / minutes),
      };
    }
    record(`idle ${label}: WebSocket frames per tab per minute`, rate);
    return rate;
  };
  // Agent interest lasts idleAfterMs (60 s) after the last tool call; wait it out first.
  await sleep(70_000);
  const idleRate = await idle('no panel', IDLE_MINUTES);
  const idlePanelCtx = await browser.newContext();
  const idlePanel = await idlePanelCtx.newPage();
  const idlePanelTraffic = trackTraffic(idlePanel);
  await idlePanel.goto(`${BASE}/__devframes/pangular/?pageId=${tabs.t1.id}#tab=components`);
  await sleep(10_000);
  const r0 = idlePanelTraffic.received;
  const watchedRate = await idle('panel open', Math.max(1, Math.round(IDLE_MINUTES / 2)));
  record(
    'idle panel open: panel frames received per minute',
    Math.round((idlePanelTraffic.received - r0) / Math.max(1, Math.round(IDLE_MINUTES / 2))),
  );
  await idlePanelCtx.close();
  for (const [k, r] of Object.entries(idleRate)) {
    assert(
      `idle tab ${k} sends at most ~6 frames a minute (heartbeats only)`,
      r.sentPerMin <= 8,
      r.sentPerMin,
    );
  }
  void watchedRate;

  // Growth: compare the first and last thirds of the samples.
  const series = (key) => samples.map((s) => s[key]).filter((v) => typeof v === 'number');
  const growth = (key) => {
    const v = series(key);
    if (v.length < 6) return null;
    const third = Math.floor(v.length / 3);
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    return Math.round((avg(v.slice(-third)) - avg(v.slice(1, 1 + third))) * 10) / 10;
  };
  const growths = {
    serverRssMb: growth('serverRssMb'),
    t1HeapMb: growth('t1HeapMb'),
    t2HeapMb: growth('t2HeapMb'),
    panelHeapMb: growth('panelHeapMb'),
    t1Nodes: growth('t1Nodes'),
    t2Nodes: growth('t2Nodes'),
    t1Listeners: growth('t1Listeners'),
    t2Listeners: growth('t2Listeners'),
    stateKb: growth('stateKb'),
  };
  record('growth, last third minus first third', growths);
  current.data.samples = samples.map(({ traffic, ...row }) => row);
  current.data.stateSizes = stateSizes;
  assert('no page or panel errors', !errors.length, errors.slice(0, 5).join('; '));
  await ctx.close();
}

// ---------------------------------------------------------------- main

let server;
let exitCode = 0;
try {
  await bundleApp();
  if (SPAWN) {
    server = startServer();
    await server.ready;
  }
  await launch();
  for (const name of selected) {
    try {
      if (name === 'multitab') await checkMultitab();
      else if (name === 'expiry') await checkExpiry();
      else if (name === 'lifecycle') await checkLifecycle(server);
      else if (name === 'stress') await checkStress();
      else if (name === 'soak') await checkSoak(server);
      else throw new Error(`Unknown check ${name}`);
    } catch (error) {
      if (!current) section(name);
      assert(`${name} ran to the end`, false, error.stack ?? error.message);
    }
  }
} finally {
  await browser?.close().catch(() => {});
  await server?.stop();
  results.finishedAt = new Date().toISOString();
  const failed = Object.entries(results.checks).flatMap(([c, r]) =>
    r.assertions.filter((a) => !a.ok).map((a) => `${c}: ${a.name}`),
  );
  results.failed = failed;
  results.knownFailures = Object.entries(results.checks).flatMap(([c, r]) =>
    r.assertions
      .filter((a) => a.knownIssue)
      .map((a) => ({ check: c, name: a.name, issue: a.knownIssue, passed: a.passed })),
  );
  const json = option('json');
  if (json) writeFileSync(json, JSON.stringify(results, null, 2));
  console.log(
    `\n${failed.length ? `${failed.length} failed:\n  ${failed.join('\n  ')}` : 'All checks passed.'}`,
  );
  exitCode = failed.length ? 1 : 0;
}
process.exit(exitCode);
