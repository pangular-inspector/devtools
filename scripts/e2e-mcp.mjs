#!/usr/bin/env node
/**
 * End-to-end check of the agent surface through a real MCP client.
 *
 * - Starts the demo SSR server (src/server.ts) on --port and opens the Angular
 *   Travel demo in headless Chromium, driven so every inspector has data.
 * - Connects over HTTP MCP (`/__devframes/__mcp`) and over stdio (`pangular mcp`).
 * - Lists every tool and calls each one with valid arguments, without its
 *   required arguments, with wrong-typed arguments, with a bad enum value, with
 *   a huge `limit` and with an unknown `page`.
 * - Reads every resource and resource template, gets every prompt, and waits for
 *   `notifications/resources/list_changed` when a tab joins and leaves.
 * - Restarts the hub with `agent.readOnly`, `agent.tools.<name>: false` and
 *   `inspectors.<name>: false`, and checks what disappears.
 * - Runs the action tools and reads the app back (DOM and read tools) to check
 *   that they changed it.
 * - Compares the tool list and arguments with apps/docs/src/content/agents/tools.md.
 *
 * Writes a JSON report (--report) and exits with 1 when a check fails.
 * Run `node scripts/e2e-mcp.mjs --help` for the flags.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createConnection } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requireFromRoot = createRequire(join(ROOT, 'package.json'));
const BROWSER_DIST = join(ROOT, 'dist/pangular-inspector/browser');
const SERVER_ENTRY = join(ROOT, 'dist/pangular-inspector/server/server.mjs');
const UNKNOWN_PAGE = 'zz-no-such-page';
const PHASES = ['http', 'actions', 'negative', 'stdio', 'variants', 'docs'];

const HELP = `Usage: node scripts/e2e-mcp.mjs [flags]

  --port <n>          Port of the demo SSR server (default 5150). Variant hubs use
                      <n>+1 to <n>+4, and their WebSockets 20 ports above.
  --skip-build        Reuse dist/ instead of running devtools:build-pkg and build.
  --report <file>     Where to write the JSON report (default dist/e2e-mcp/report.json).
  --only <phases>     Comma-separated subset of: ${PHASES.join(', ')}.
                      'actions' and 'negative' need 'http'.
  --chrome <path>     Chromium executable (default PANGULAR_E2E_CHROME, then
                      /opt/pw-browsers, then Playwright's own).
  --leave-timeout <s> How long to wait for list_changed after a tab closes (default 60).
  --verbose           Log every call.
`;

// ---------------------------------------------------------------------------
// Flags

function parseArgs(argv) {
  const opts = {
    port: 5150,
    build: true,
    report: join(ROOT, 'dist/e2e-mcp/report.json'),
    only: new Set(PHASES),
    chrome: process.env['PANGULAR_E2E_CHROME'],
    verbose: false,
    leaveTimeoutMs: 60_000,
    serveVariant: undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${flag} needs a value`);
      return next;
    };
    switch (flag) {
      case '--port':
        opts.port = Number(value());
        break;
      case '--skip-build':
        opts.build = false;
        break;
      case '--report':
        opts.report = resolve(value());
        break;
      case '--only': {
        const names = value().split(',').filter(Boolean);
        for (const name of names)
          if (!PHASES.includes(name)) throw new Error(`Unknown phase ${name}`);
        opts.only = new Set(names);
        break;
      }
      case '--chrome':
        opts.chrome = value();
        break;
      case '--leave-timeout':
        opts.leaveTimeoutMs = Number(value()) * 1000;
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      case '--serve-variant':
        opts.serveVariant = value();
        break;
      case '-h':
      case '--help':
        console.log(HELP);
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown flag ${flag}. Run with --help.`);
    }
  }
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65_525) {
    throw new Error('--port must be a port number');
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Variant hub: `--serve-variant <base64 config>` runs a small Express server
// with the hub under that config and the client build of the demo app, so a
// page can connect to a hub with readOnly or hidden inspectors.

async function serveVariant(encoded, port) {
  const config = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  const { default: express } = await import('express');
  const { initPangularHub } = await import('@pangular-inspector/devtools/hub');
  const app = express();
  // The WebSocket gets its own port, 20 above the page port, so the run stays in a known range.
  const devtools = initPangularHub({ ...config, ws: { port: port + 20 }, auth: false });
  app.use(devtools.nodeMiddleware);
  app.get('/api/products{/:id}', (_req, res) => res.json([{ id: 1, name: 'Signal lamp' }]));
  app.use(express.static(BROWSER_DIST, { index: false, redirect: false }));
  app.use((_req, res) => res.sendFile(join(BROWSER_DIST, 'index.csr.html')));
  app.listen(port, () => console.log(`variant hub listening on http://localhost:${port}`));
}

// ---------------------------------------------------------------------------
// Report

const report = {
  startedAt: new Date().toISOString(),
  finishedAt: undefined,
  durationMs: 0,
  options: {},
  counts: {},
  failures: [],
  warnings: [],
  calls: [],
  resources: [],
  prompts: [],
  listChanged: {},
  writes: [],
  stdio: {},
  variants: [],
  docs: {},
  serverLog: [],
};
let verbose = false;

function log(message) {
  console.log(`[e2e-mcp] ${message}`);
}

function failure(scope, message, extra = {}) {
  report.failures.push({ scope, message, ...extra });
  log(`FAIL ${scope}: ${message}`);
}

function warning(scope, message, extra = {}) {
  report.warnings.push({ scope, message, ...extra });
  if (verbose) log(`warn ${scope}: ${message}`);
}

function check(condition, scope, message, extra) {
  if (!condition) failure(scope, message, extra);
  return Boolean(condition);
}

// ---------------------------------------------------------------------------
// Processes

function run(command, args) {
  log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: false });
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(' ')} exited with ${result.status}`);
}

function portInUse(port) {
  return new Promise((done) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      done(true);
    });
    socket.once('error', () => done(false));
  });
}

async function startServer(name, args, port, env = {}) {
  if (await portInUse(port)) throw new Error(`Port ${port} is already in use (${name}).`);
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'development', PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const lines = [];
  const keep = (chunk) => {
    for (const line of String(chunk).split('\n')) if (line.trim()) lines.push(line.slice(0, 500));
    if (lines.length > 400) lines.splice(0, lines.length - 400);
  };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  let exited = false;
  child.once('exit', () => (exited = true));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (exited) throw new Error(`${name} exited early:\n${lines.join('\n')}`);
    try {
      const response = await fetch(`http://localhost:${port}/`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.status < 500) break;
    } catch {
      // Not listening yet.
    }
    await sleep(300);
  }
  log(`${name} listening on http://localhost:${port}`);
  return {
    lines,
    async stop() {
      if (exited) return;
      child.kill('SIGTERM');
      for (let i = 0; i < 50 && !exited; i++) await sleep(100);
      if (!exited) child.kill('SIGKILL');
      report.serverLog.push({ name, tail: lines.slice(-60) });
    },
  };
}

/** A request the SSR middleware traces like a browser page load. */
const fetchPage = (url) =>
  fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Dest': 'document',
    },
  }).then(async (res) => ({ status: res.status, body: await res.text() }));

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitUntil(fn, timeoutMs, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

// ---------------------------------------------------------------------------
// MCP SDK and Playwright, resolved from the workspace. The SDK is not a direct
// dependency, so fall back to the copy other workspace tools bring.

async function loadSdk() {
  const files = {
    client: 'client/index.js',
    http: 'client/streamableHttp.js',
    stdio: 'client/stdio.js',
    types: 'types.js',
  };
  const hosts = [null, '@angular/cli', '@nx/workspace', 'nx'];
  for (const host of hosts) {
    try {
      const req = host
        ? createRequire(requireFromRoot.resolve(`${host}/package.json`))
        : requireFromRoot;
      const load = async (file) =>
        import(pathToFileURL(req.resolve(`@modelcontextprotocol/sdk/${file}`)).href);
      const [client, http, stdio, types] = await Promise.all(Object.values(files).map(load));
      let modern;
      try {
        const agentic = createRequire(requireFromRoot.resolve('@devframes/agentic/package.json'));
        modern = await import(pathToFileURL(agentic.resolve('@modelcontextprotocol/client')).href);
      } catch {
        modern = undefined;
      }
      return {
        modern,
        Client: client.Client,
        StreamableHTTPClientTransport: http.StreamableHTTPClientTransport,
        StdioClientTransport: stdio.StdioClientTransport,
        ResourceListChangedNotificationSchema: types.ResourceListChangedNotificationSchema,
      };
    } catch {
      // Try the next host.
    }
  }
  throw new Error('Cannot find @modelcontextprotocol/sdk in the workspace. Run pnpm install.');
}

async function loadChromium(chromePath) {
  const playwright = await import('playwright');
  const chromium = playwright.chromium ?? playwright.default.chromium;
  let executablePath = chromePath;
  if (!executablePath && existsSync('/opt/pw-browsers')) {
    const dir = readdirSync('/opt/pw-browsers')
      .filter((name) => name.startsWith('chromium-'))
      .sort()
      .pop();
    const candidate = dir && join('/opt/pw-browsers', dir, 'chrome-linux/chrome');
    if (candidate && existsSync(candidate)) executablePath = candidate;
  }
  return chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
}

async function connectHttp(sdk, port, onListChanged) {
  const client = new sdk.Client({ name: 'pangular-e2e', version: '1.0.0' }, { capabilities: {} });
  if (onListChanged)
    client.setNotificationHandler(sdk.ResourceListChangedNotificationSchema, onListChanged);
  const origin = `http://localhost:${port}`;
  const transport = new sdk.StreamableHTTPClientTransport(new URL(`${origin}/__devframes/__mcp`), {
    requestInit: { headers: { Origin: origin } },
  });
  await client.connect(transport);
  return client;
}

async function connectStdio(sdk, extraArgs = []) {
  const client = new sdk.Client({ name: 'pangular-e2e', version: '1.0.0' }, { capabilities: {} });
  const transport = new sdk.StdioClientTransport({
    command: process.execPath,
    args: [join(ROOT, 'bin.mjs'), 'mcp', '--root', ROOT, ...extraArgs],
    cwd: ROOT,
    stderr: 'pipe',
  });
  const stderr = [];
  transport.stderr?.on('data', (chunk) => stderr.push(String(chunk)));
  await client.connect(transport);
  return { client, stderr };
}

async function listAll(client, method, key) {
  const items = [];
  let cursor;
  do {
    const page = await client[method](cursor ? { cursor } : {});
    items.push(...page[key]);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

// ---------------------------------------------------------------------------
// Calling tools and checking answers

const short = (name) => name.replace(/^pangular_/, '');

/** A tool answers with one plain text block: the markdown itself, or compact JSON for a scan. */
function markdownOf(text) {
  return text;
}

/** Documented answer caps, in characters of the markdown. */
const CAPS = {
  'inspect-component': 20_000,
  'list-components': 20_000,
  'defer-blocks': 20_000,
  'for-blocks': 20_000,
  hydration: 20_000,
  'inspect-signals': 20_000,
  'inspect-providers': 20_000,
  snapshot: 20_000,
  'inspect-forms': 20_000,
  'export-form': 20_000,
  'capacitor-list-calls': 20_000,
  'capacitor-list-plugins': 20_000,
  'ngrx-export-session': 60_000,
  'change-detection': 100_000,
};
/** Above this, any answer gets a warning: it costs an agent a lot of context. */
const SOFT_CAP = 50_000;

const STACK_LINE =
  /^\s*at\s+(?:[^\n]*\()?(?:file:|node:|\/|[A-Za-z]:\\|<anonymous>|webpack|chunk-)[^\n]*:\d+(?::\d+)?\)?\s*$/m;
const RAW_ERROR =
  /\b(?:TypeError|ReferenceError|SyntaxError|RangeError)\b: |Cannot read propert(?:y|ies) of|is not a function|\[object Object\]/;

function looksLikeRawJson(text) {
  const trimmed = text.trim();
  return /^\[\s*\{/.test(trimmed) && /"(?:code|expected|path)"/.test(trimmed);
}

let callCounter = 0;

async function callTool(client, transport, name, args, kind, options = {}) {
  const record = {
    n: ++callCounter,
    transport,
    tool: short(name),
    case: kind,
    args,
    isError: false,
    durationMs: 0,
    failures: [],
    warnings: [],
  };
  const started = Date.now();
  try {
    const result = await client.callTool({ name, arguments: args }, undefined, {
      timeout: options.timeoutMs ?? 60_000,
    });
    record.isError = result.isError === true;
    record.contentTypes = (result.content ?? []).map((item) => item.type);
    const text = (result.content ?? [])
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('\n');
    record.text = text;
    record.markdown = markdownOf(text);
    record.length = record.markdown.length;
    record.rawLength = text.length;
    record.structured = result.structuredContent !== undefined;
  } catch (error) {
    record.protocolError = {
      code: error?.code,
      message: String(error?.message ?? error).slice(0, 3000),
    };
    record.markdown = '';
    record.length = 0;
  }
  record.durationMs = Date.now() - started;
  report.calls.push(record);
  if (verbose) {
    log(
      `#${record.n} ${transport} ${record.tool} [${kind}] ${record.protocolError ? `protocol ${record.protocolError.code}` : record.isError ? 'isError' : 'ok'} ${record.length} chars ${record.durationMs}ms`,
    );
  }
  return record;
}

function recordFailure(record, message) {
  record.failures.push(message);
  failure(`${record.transport} ${record.tool} [${record.case}]`, message, {
    args: record.args,
    answer: (record.markdown || record.protocolError?.message || '').slice(0, 1500),
  });
}

function recordWarning(record, message) {
  record.warnings.push(message);
  warning(`${record.transport} ${record.tool} [${record.case}]`, message, {
    args: record.args,
    answer: (record.markdown || record.protocolError?.message || '').slice(0, 800),
  });
}

/**
 * The checks every answer gets. `expect` is `ok` (a normal answer), `error`
 * (a refusal with isError), `refusal` (a refusal, isError either way) or `any`.
 */
function checkAnswer(record, tool, expect) {
  if (record.protocolError) {
    const invalidInput = ['missing', 'wrong-type', 'bad-enum', 'unknown-tool'].includes(
      record.case,
    );
    if (invalidInput && record.protocolError.code === -32602) {
      recordWarning(
        record,
        `rejected as a JSON-RPC error (-32602) instead of a tool result with isError`,
      );
      if (
        STACK_LINE.test(record.protocolError.message) ||
        looksLikeRawJson(record.protocolError.message.replace(/^[^[]*/, ''))
      ) {
        recordWarning(record, 'the -32602 message is raw validator JSON, not a sentence');
      }
    } else {
      recordFailure(
        record,
        `protocol error ${record.protocolError.code}: ${record.protocolError.message.slice(0, 300)}`,
      );
    }
    return;
  }
  const text = record.text ?? '';
  const hasImage = record.contentTypes?.includes('image');
  if (!text.trim() && !hasImage) recordFailure(record, 'empty answer');
  if (STACK_LINE.test(text)) recordFailure(record, 'answer contains a stack trace');
  if (record.isError && RAW_ERROR.test(text))
    recordFailure(record, 'error answer is a raw JavaScript error');
  if (record.isError && looksLikeRawJson(record.markdown))
    recordFailure(record, 'error answer is raw validator JSON');
  if (!record.isError && /\[object Object\]/.test(text))
    recordFailure(record, 'answer contains [object Object]');

  if (expect === 'ok' && record.isError) recordFailure(record, 'valid call answered with isError');
  if (expect === 'error' && !record.isError) recordWarning(record, 'refusal sent without isError');

  const cap = CAPS[record.tool];
  if (cap && record.length > cap)
    recordFailure(record, `answer is ${record.length} chars, over its documented ${cap}`);
  else if (record.length > SOFT_CAP) recordWarning(record, `answer is ${record.length} chars`);

  // Every answer is plain text: no output schema, no structured copy, no `{markdown}` wrapper.
  if (tool?.outputSchema) recordFailure(record, 'tool declares an outputSchema');
  if (record.structured) recordFailure(record, 'answer sent structuredContent');
  if (!record.isError && /^\{\s*"markdown"\s*:/.test(record.markdown)) {
    recordFailure(record, 'answer is wrapped in {"markdown": ...}');
  }
}

// ---------------------------------------------------------------------------
// Parsing ids out of answers

function parseComponents(markdown) {
  const components = [];
  for (const match of markdown.matchAll(/^(\s*)([A-Z]\w*) <([\w-]+)> (\S+)/gm)) {
    components.push({ depth: match[1].length / 2, name: match[2], tag: match[3], id: match[4] });
  }
  return components;
}

const parseFormIds = (markdown) => [...markdown.matchAll(/^- (\S+@\S+) /gm)].map((m) => m[1]);
const parseStoreIds = (markdown) =>
  [...markdown.matchAll(/`(ngrx-\d+)`, (\w+)/g)].map((m) => ({ id: m[1], name: m[2] }));
const parseSeqs = (markdown) =>
  [...markdown.matchAll(/^- #(\d+) [^\n]*?call `(\w+)`[^\n]*?on `(ngrx-\d+)`([^\n]*)/gm)].map(
    (m) => ({
      seq: Number(m[1]),
      method: m[2],
      store: m[3],
      rest: m[4],
    }),
  );

function jsonBlock(markdown) {
  const start = markdown.indexOf('{');
  if (start < 0) return undefined;
  for (let end = markdown.length; end > start; end = markdown.lastIndexOf('}', end - 1)) {
    try {
      return JSON.parse(markdown.slice(start, end + 1));
    } catch {
      // Shorter.
    }
    if (end <= start) break;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// The app in the browser

function isoDay(offsetDays) {
  const day = new Date();
  day.setDate(day.getDate() + offsetDays);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

class App {
  constructor(page, origin) {
    this.page = page;
    this.origin = origin;
  }

  /** In-app navigation, through the router's popstate listener, so the page id stays. */
  async go(path, settleMs = 1500) {
    await this.page.evaluate((target) => {
      history.pushState(null, '', target);
      dispatchEvent(new PopStateEvent('popstate', { state: null }));
    }, path);
    await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
    await sleep(settleMs);
  }

  path() {
    return new URL(this.page.url()).pathname + new URL(this.page.url()).search;
  }

  async text(selector) {
    return (
      (
        await this.page
          .locator(selector)
          .first()
          .textContent({ timeout: 5000 })
          .catch(() => null)
      )?.trim() ?? null
    );
  }

  async value(selector) {
    return this.page
      .locator(selector)
      .first()
      .inputValue({ timeout: 5000 })
      .catch(() => null);
  }
}

// ---------------------------------------------------------------------------
// Valid arguments for each read tool, and the route the page should be on.

/** Tools of a library the demo does not use, which the server lists only for an app that uses it. */
const LIBRARY_TOOL = /^(analog-|capacitor-|tanstack-)/;

const READ_PLAN = [
  // [tool, route, args(ctx)]
  ['list-pages', null, () => ({})],
  ['scan-build', null, () => ({})],
  ['scan-routes', null, () => ({})],
  ['scan-components', null, () => ({})],
  ['scan-pipes', null, () => ({})],
  ['scan-signals', null, () => ({})],
  ['scan-providers', null, () => ({})],
  ['ngrx-scan', null, () => ({})],
  ['devframes_plugin_messages_list', null, () => ({})],
  ['devframe_state_read', null, () => ({})],
  ['devframe_state_read', null, () => ({ key: 'pangular:http' })],
  ['scan-templates', null, () => ({ limit: 20 })],
  ['scan-pipe-usage', null, () => ({})],
  ['scan-render-mode', null, () => ({ url: '/about' })],
  ['analog-scan-routes', null, () => ({})],
  ['analog-scan-url', null, () => ({ url: '/' })],
  ['analog-inspect-page', null, () => ({})],
  ['analog-list-server-calls', null, () => ({})],
  ['analog-scan-server-functions', null, () => ({})],
  ['analog-scan-api-routes', null, () => ({})],
  ['analog-explain-render-modes', null, () => ({})],
  ['analog-scan-prerender', null, () => ({})],
  ['analog-scan-content', null, () => ({})],
  ['analog-lint', null, () => ({})],
  ['capacitor-list-calls', null, () => ({})],
  ['capacitor-list-plugins', null, () => ({})],
  ['tanstack-list-queries', null, () => ({})],
  ['tanstack-inspect-query', null, () => ({ key: 'products' })],
  ['redux-inspect-stores', null, () => ({})],
  ['list-errors', null, () => ({})],
  ['explain-error', null, (ctx) => ({ id: ctx.errorId ?? 'e1' })],
  ['explain-error', null, () => ({ code: 'NG0100' })],
  ['list-console', null, () => ({ since: '30m', limit: 20 })],
  ['list-plugins', null, () => ({})],
  ['inspect-plugin', null, () => ({ plugin: 'travel' })],
  ['plugin_travel_bookings', null, () => ({})],
  ['audit', null, () => ({ limit: 20 })],
  ['startup-timing', null, () => ({ limit: 5 })],

  ['list-components', '/destinations', () => ({ depth: 4 })],
  ['list-components', '/destinations', () => ({ filter: 'DestinationCard' })],
  [
    'inspect-component',
    '/destinations',
    (ctx) => ({ component: ctx.component('DestinationCard').id }),
  ],
  [
    'inspect-component',
    '/destinations',
    (ctx) => ({ component: ctx.component('DestinationCard').id, path: 'destination', depth: 2 }),
  ],
  ['highlight', '/destinations', (ctx) => ({ component: ctx.component('DestinationCard', 1).id })],
  ['highlight', '/destinations', () => ({ selector: 'app-theme-toggle' })],
  ['screenshot-component', '/destinations', () => ({ component: 'app-theme-toggle' })],
  [
    'wait-for',
    '/destinations',
    () => ({ condition: 'component', component: 'DestinationCard', timeoutMs: 3000 }),
  ],
  [
    'wait-for',
    '/destinations',
    () => ({ condition: 'component-gone', component: 'Booking', timeoutMs: 2000 }),
  ],
  ['wait-for', '/destinations', () => ({ condition: 'navigation', timeoutMs: 2000 })],
  [
    'open-in-panel',
    '/destinations',
    (ctx) => ({ tab: 'components', id: ctx.component('DestinationCard').id, page: ctx.pageId }),
  ],
  ['snapshot', '/destinations', (ctx) => ({ page: ctx.pageId })],
  [
    'snapshot',
    '/destinations',
    () => ({ sections: ['page', 'route', 'stores'], limit: 3, maxChars: 2000 }),
  ],
  ['ngrx-inspect-store', '/destinations', () => ({})],
  ['ngrx-inspect-store', '/destinations', (ctx) => ({ store: ctx.storeId('TravelStore') })],
  ['ngrx-inspect-store', '/destinations', () => ({ store: 'TravelStore' })],
  [
    'ngrx-history',
    '/destinations',
    (ctx) => ({ page: ctx.pageId, store: ctx.storeId('TravelStore') }),
  ],
  ['ngrx-inspect-entry', '/destinations', (ctx) => ({ seq: ctx.lastSeq() })],
  ['ngrx-export-session', '/destinations', (ctx) => ({ store: ctx.storeId('TravelStore') })],
  ['ngrx-import-session', '/destinations', (ctx) => ({ session: ctx.exportedSession ?? '{}' })],
  ['ngrx-generate-test', '/destinations', (ctx) => ({ store: ctx.storeId('TravelStore') })],
  [
    'ngrx-generate-test',
    '/destinations',
    (ctx) => (ctx.sessionId ? { session: ctx.sessionId } : { store: 'ngrx-1' }),
  ],
  [
    'ngrx-inspect-entry',
    '/destinations',
    (ctx) => (ctx.sessionId ? { seq: 1, session: ctx.sessionId } : { seq: 1 }),
  ],
  ['read-provider-value', '/destinations', () => ({ token: 'TravelStore' })],
  ['read-provider-value', '/destinations', () => ({ token: 'TravelStore', path: 'saved' })],

  ['list-components', '/examples/components', () => ({})],
  ['defer-blocks', '/examples/defer', () => ({})],
  ['for-blocks', '/examples/defer', () => ({})],
  ['hydration', '/examples/defer', () => ({})],
  ['change-detection', '/examples/components', () => ({})],
  ['diagnose-change-detection', '/examples/components', () => ({})],
  ['find-leaks', '/examples/components', () => ({ limit: 5 })],

  ['inspect-signals', '/examples/signals', () => ({ component: 'app-signals-example' })],
  [
    'inspect-signals',
    '/examples/signals',
    () => ({ component: 'app-signals-example', node: 'count', history: false }),
  ],
  ['inspect-signals', '/examples/signals', () => ({ component: 'root' })],

  ['inspect-providers', '/examples/di', () => ({})],
  ['inspect-providers', '/examples/di', () => ({ injector: 'Root' })],
  ['inspect-providers', '/examples/di', () => ({ token: 'HttpClient' })],
  ['explain-injection', '/examples/di', () => ({ injector: 'app-root', token: 'Router' })],
  [
    'explain-injection',
    '/examples/di',
    () => ({ injector: 'app-root', token: 'NoSuchToken', optional: true }),
  ],

  ['explain-pipe', '/examples/pipes', () => ({ name: 'appTimeAgo' })],
  ['explain-pipe', '/examples/pipes', () => ({ name: 'date' })],

  ['list-ssr-requests', '/examples/http', () => ({ limit: 5 })],
  [
    'explain-ssr-request',
    '/examples/http',
    (ctx) => (ctx.ssrRequestId ? { id: ctx.ssrRequestId } : {}),
  ],
  ['explain-ssr-request', '/examples/http', () => ({ url: '/' })],
  ['list-http-calls', '/examples/http', () => ({ limit: 10, preview: true, headers: true })],
  ['list-http-calls', '/examples/http', () => ({ failed: true })],
  ['list-http-calls', '/examples/http', () => ({ view: 'waterfall', headers: true })],
  ['list-http-rules', '/examples/http', () => ({})],
  ['inspect-transfer-state', '/examples/http', () => ({})],
  ['list-ssr-overrides', '/examples/http', () => ({})],

  ['inspect-route', '/examples/routes/details', () => ({})],
  ['inspect-route', '/examples/routes/details', () => ({ component: 'RoutePanel' })],
  ['explain-navigation', '/examples/routes/details', () => ({ limit: 5 })],
  ['explain-navigation', '/examples/routes/details', () => ({ perf: true })],
  ['explain-navigation', '/examples/routes/details', () => ({ url: '/trips' })],
  ['list-routes', '/examples/routes/details', () => ({})],
  [
    'list-routes',
    '/examples/routes/details',
    () => ({ match: '/destinations/kyoto', audit: true }),
  ],
  ['list-routes', '/examples/routes/details', () => ({ filter: 'book' })],
  ['lint-routes', '/examples/routes/details', () => ({})],
  ['router-config', '/examples/routes/details', () => ({})],
  ['explain-navigation', '/examples/routes/details', () => ({ format: 'repro' })],

  ['inspect-forms', '/examples/forms', () => ({})],
  ['inspect-forms', '/examples/forms', (ctx) => ({ form: ctx.formIds[0] })],
  [
    'inspect-forms',
    '/examples/forms',
    (ctx) => ({ form: ctx.formIds[1], onlyInvalid: true, includeValues: false }),
  ],
  ['explain-invalid-forms', '/examples/forms', () => ({})],
  ['lint-forms', '/examples/forms', () => ({})],
  ['explain-custom-control', '/examples/forms', (ctx) => ({ form: ctx.formIds[0] })],
  ['explain-submit', '/examples/forms', (ctx) => ({ form: ctx.formIds[2] })],
  ['export-form', '/examples/forms', (ctx) => ({ form: ctx.formIds[1], format: 'snapshot' })],

  ['inspect-forms', '/book/kyoto', (ctx) => ({ form: ctx.bookingForm })],
  ['inspect-forms', '/book/kyoto', (ctx) => ({ form: ctx.bookingForm, path: 'email' })],
  ['explain-invalid-forms', '/book/kyoto', (ctx) => ({ form: ctx.bookingForm })],
  ['explain-field', '/book/kyoto', (ctx) => ({ form: ctx.bookingForm, path: 'travelers' })],
  ['explain-field', '/book/kyoto', () => ({ selector: '#email' })],
  ['explain-submit', '/book/kyoto', (ctx) => ({ form: ctx.bookingForm })],
  ['inspect-form-payload', '/book/kyoto', (ctx) => ({ form: ctx.bookingForm })],
  ['list-form-changes', '/book/kyoto', (ctx) => ({ form: ctx.bookingForm, limit: 20 })],
  [
    'list-form-changes',
    '/book/kyoto',
    (ctx) => ({ form: ctx.bookingForm, type: 'submit', origin: 'user' }),
  ],
  ['explain-form-changes', '/book/kyoto', (ctx) => ({ form: ctx.bookingForm, after: 0 })],
  ['lint-forms', '/book/kyoto', (ctx) => ({ form: ctx.bookingForm })],
  ['explain-custom-control', '/book/kyoto', (ctx) => ({ form: ctx.bookingForm, path: 'terms' })],
  ['export-form', '/book/kyoto', (ctx) => ({ form: ctx.bookingForm, format: 'fixture' })],
  [
    'wait-for',
    '/book/kyoto',
    (ctx) => ({ condition: 'form', form: ctx.bookingForm, until: 'settled', timeoutMs: 2000 }),
  ],
];

/** Tools that act; each is covered by a scenario in `runActions`. */
const ACTION_SCENARIO_TOOLS = new Set([
  'navigate',
  'probe-route',
  'record-guards',
  'ngrx-dispatch',
  'ngrx-restore',
  'tanstack-run-query',
  'run-form-action',
  'fill-form',
  'set-http-rule',
  'remove-http-rule',
  'set-ssr-override',
  'remove-ssr-override',
  'set-component-property',
  'set-signal',
  'watch-signal',
  'record-pipes',
  'track-subscriptions',
  'record-change-detection',
  'audit',
  'clear-recordings',
  'analog-run-api',
  'plugin_travel_clear-saved',
  'highlight',
]);

// ---------------------------------------------------------------------------
// HTTP phase

async function runHttp(opts, sdk, browser, state) {
  const port = opts.port;
  const origin = `http://localhost:${port}`;
  // The demo keeps the one-time code on unless PANGULAR_AUTH is false.
  const server = await startServer('demo SSR server', [SERVER_ENTRY], port, {
    PANGULAR_AUTH: 'false',
  });
  state.stoppers.push(() => server.stop());

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.accept().catch(() => undefined));
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error.message)));
  const app = new App(page, origin);
  state.app = app;
  state.context = context;

  const listChanged = [];
  const client = await connectHttp(sdk, port, () => listChanged.push(Date.now()));
  state.client = client;
  state.listChanged = listChanged;
  report.instructions = client.getInstructions?.();
  check(
    typeof report.instructions === 'string' && report.instructions.includes('pangular_list-pages'),
    'http initialize',
    'server instructions are missing or do not name pangular_list-pages',
  );

  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  const pageId = await waitUntil(
    async () => {
      const answer = await client.callTool({ name: 'pangular_list-pages', arguments: {} });
      return markdownOf(answer.content?.[0]?.text ?? '').match(/\| `([^`]+)` \| `\/`/)?.[1];
    },
    30_000,
    500,
  );
  if (!pageId)
    throw new Error('The demo page never reported to the hub (list-pages stayed empty).');
  state.pageId = pageId;
  log(`page ${pageId} connected`);

  await driveApp(app, state);
  state.pageErrors = pageErrors;

  const tools = await listAll(client, 'listTools', 'tools');
  state.tools = new Map(tools.map((tool) => [short(tool.name), tool]));
  report.counts.httpTools = tools.length;
  report.toolList = tools.map((tool) => ({
    name: tool.name,
    title: tool.title ?? tool.annotations?.title,
    readOnlyHint: tool.annotations?.readOnlyHint,
    destructiveHint: tool.annotations?.destructiveHint,
    required: tool.inputSchema?.required ?? [],
    properties: Object.keys(tool.inputSchema?.properties ?? {}),
    outputSchema: Boolean(tool.outputSchema),
  }));
  log(`${tools.length} tools over HTTP`);
  report.counts.httpToolListBytes = JSON.stringify(tools).length;
  log(`tools/list is ${report.counts.httpToolListBytes} bytes`);
  const libraryListed = tools
    .map((tool) => short(tool.name))
    .filter((name) => LIBRARY_TOOL.test(name));
  check(
    !libraryListed.length,
    'http tools/list',
    `lists tools of libraries the demo does not use: ${libraryListed.join(', ')}`,
  );
  for (const tool of tools) {
    if (!tool.title && !tool.annotations?.title)
      warning(`http ${short(tool.name)}`, 'tool has no title');
    if (!tool.description) failure(`http ${short(tool.name)}`, 'tool has no description');
  }

  await checkResourcesAndPrompts(client, state, 'http');
  await checkListChanged(context, state, origin, sdk, opts.leaveTimeoutMs);

  const ctx = await makeContext(client, state);
  state.ctx = ctx;
  await runReadPlan(client, app, state, ctx);
  for (const name of state.tools.keys()) {
    const covered = READ_PLAN.some(([tool]) => tool === name) || ACTION_SCENARIO_TOOLS.has(name);
    if (!covered)
      failure(`http ${name}`, 'no valid-arguments case in the harness for this tool (new tool?)');
  }
}

/** Puts data in every inspector. */
async function driveApp(app, state) {
  const { page } = app;
  // A guard redirect: /trips needs a signed-in account.
  await app.go('/trips');
  state.guardRedirect = app.path();
  check(
    app.path().startsWith('/sign-in'),
    'drive app',
    `/trips should redirect to /sign-in, got ${app.path()}`,
  );

  await app.go('/destinations');
  for (const name of ['Istanbul', 'Kyoto']) {
    await page
      .getByRole('button', { name: `Save ${name}` })
      .first()
      .click({ timeout: 5000 });
    await sleep(300);
  }
  await app.go('/destinations/kyoto');
  await app.go('/examples/routes/details');
  await app.go('/examples/routes/admin');
  await app.go('/examples/routes/broken');
  await app.go('/examples/http');
  await page
    .locator('button.reload')
    .first()
    .click({ timeout: 5000 })
    .catch(() => undefined);
  await sleep(1000);
  await app.go('/examples/ssr');
  await app.go('/examples/store');
  await page.getByRole('button', { name: 'Add an item' }).click({ timeout: 5000 });
  await page.locator('input[type=checkbox]').nth(1).click({ timeout: 5000 });
  await app.go('/examples/signals');
  await page.getByRole('button', { name: 'Add one' }).click({ timeout: 5000 });
  await app.go('/examples/pipes');
  await page
    .getByRole('button', { name: 'Post again' })
    .click({ timeout: 5000 })
    .catch(() => undefined);
  await app.go('/examples/defer');
  await app.go('/examples/di');
  await app.go('/examples/components');
  await app.go('/examples/forms');
  await page.evaluate(() => {
    console.warn('e2e-mcp console warning');
    setTimeout(() => {
      throw new Error('e2e-mcp uncaught error');
    });
  });
  await sleep(500);

  // The booking form: invalid first, through the real inputs.
  await app.go('/book/kyoto');
  await page.locator('#travelers').fill('0');
  await page.locator('#email').fill('not-an-email');
  await page.locator('#name').fill('A');
  await page.locator('button[type=submit]').first().click();
  await sleep(800);
  state.invalidStatus = await app.text('[role=status], .status');
}

/** Lazily collected ids that the valid arguments need. */
async function makeContext(client, state) {
  const read = async (tool, args = {}) => {
    const answer = await client.callTool({ name: `pangular_${tool}`, arguments: args });
    return markdownOf((answer.content ?? []).map((item) => item.text ?? '').join('\n'));
  };
  const ctx = {
    pageId: state.pageId,
    read,
    components: [],
    stores: [],
    seqs: [],
    formIds: [],
    bookingForm: undefined,
    component(name, index = 0) {
      const matches = ctx.components.filter((item) => item.name === name);
      return matches[index] ?? matches[0] ?? { id: name };
    },
    storeId(name) {
      return ctx.stores.find((store) => store.name === name)?.id ?? 'ngrx-1';
    },
    lastSeq() {
      return ctx.seqs.at(-1)?.seq ?? 1;
    },
    async refresh(route) {
      if (
        route === '/destinations' ||
        route === '/examples/components' ||
        route === '/examples/signals'
      ) {
        ctx.components = parseComponents(await read('list-components', {}));
      }
      if (route === '/destinations') {
        ctx.stores = parseStoreIds(await read('ngrx-inspect-store', {}));
        ctx.seqs = parseSeqs(await read('ngrx-history', { page: ctx.pageId }));
      }
      if (route === '/examples/forms') ctx.formIds = parseFormIds(await read('inspect-forms', {}));
      if (route === '/book/kyoto')
        ctx.bookingForm = parseFormIds(await read('inspect-forms', {})).find((id) =>
          id.startsWith('Booking.'),
        );
      if (route === '/examples/http') {
        ctx.ssrRequestId = (await read('list-ssr-requests', {})).match(
          /\| `([0-9a-f]{8,})` \|/,
        )?.[1];
      }
    },
  };
  ctx.errorId = (await read('list-errors', {})).match(/\| `(e\d+)` \|/)?.[1];
  return ctx;
}

async function runReadPlan(client, app, state, ctx) {
  let route;
  for (const [name, wanted, buildArgs] of READ_PLAN) {
    const tool = state.tools.get(name);
    if (!tool) {
      // The demo uses no Analog, Capacitor or TanStack Query, so their tools stay out of the list.
      if (LIBRARY_TOOL.test(name)) continue;
      failure(`http ${name}`, 'tool is in the harness plan but not in tools/list');
      continue;
    }
    if (wanted && wanted !== route) {
      route = wanted;
      await app.go(wanted);
      await ctx.refresh(wanted);
    }
    const args = buildArgs(ctx);
    const record = await callTool(client, 'http', tool.name, args, 'valid');
    checkAnswer(record, tool, 'ok');
    // Hand-offs between calls.
    if (name === 'ngrx-export-session' && !record.isError) {
      const block = record.markdown.match(/```json\n([\s\S]*?)\n```/)?.[1];
      ctx.exportedSession = block;
      if (!block) recordFailure(record, 'export has no json block to import');
    }
    if (name === 'ngrx-import-session' && !record.isError) {
      ctx.sessionId = record.markdown.match(/`(s[\w-]+|[0-9a-f-]{6,})`/)?.[1];
      if (!ctx.sessionId) recordWarning(record, 'could not find the session id in the answer');
    }
    if (name === 'list-pages') {
      check(
        record.markdown.includes(ctx.pageId),
        'http list-pages',
        'list-pages does not list the page',
      );
    }
    if (name === 'inspect-component' && !args.path) {
      check(
        !/no component|not found/i.test(record.markdown),
        'http inspect-component',
        'did not find the instance',
      );
    }
    if (name === 'snapshot' && args.maxChars) {
      check(
        record.length <= args.maxChars,
        'http snapshot',
        `answer ${record.length} chars over maxChars ${args.maxChars}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Resources, templates, prompts

async function checkResourcesAndPrompts(client, state, transport) {
  const resources = await listAll(client, 'listResources', 'resources');
  const templates = await listAll(client, 'listResourceTemplates', 'resourceTemplates').catch(
    (error) => {
      failure(`${transport} resources/templates/list`, String(error.message));
      return [];
    },
  );
  state.resources = resources;
  state.templates = templates;
  report.counts[`${transport}Resources`] = resources.length;
  report.counts[`${transport}ResourceTemplates`] = templates.length;
  const names = [
    'component-tree',
    'signal-graph',
    'injector-tree',
    'ngrx-store',
    'forms',
    'router',
  ];
  for (const name of names) {
    const uri = `devframe://resource/${encodeURIComponent(`pangular:${name}`)}`;
    check(
      resources.some((item) => item.uri === uri),
      `${transport} resources/list`,
      `missing ${uri}`,
    );
    check(
      templates.some((item) => item.uriTemplate === `pangular://pages/{pageId}/${name}`),
      `${transport} resources/templates/list`,
      `missing template for ${name}`,
    );
    if (state.pageId) {
      check(
        resources.some((item) => item.uri === `pangular://pages/${state.pageId}/${name}`),
        `${transport} resources/list`,
        `missing the per-page entry pangular://pages/${state.pageId}/${name}`,
      );
    }
  }
  for (const resource of resources) {
    await readResource(client, transport, resource.uri, 'listed');
  }
  for (const template of templates) {
    const pageId = state.pageId ?? 'none';
    const uri = template.uriTemplate.replace('{pageId}', pageId);
    const entry = await readResource(client, transport, uri, 'template');
    if (entry.ok && state.pageId) {
      check(
        entry.json !== undefined,
        `${transport} ${uri}`,
        'template read for a live page is not JSON',
      );
      if (entry.json) {
        check(
          Object.keys(entry.json)[0] === '_untrusted',
          `${transport} ${uri}`,
          'does not start with _untrusted',
        );
        const pages = Object.keys(entry.json.pages ?? {});
        check(
          pages.length <= 1,
          `${transport} ${uri}`,
          `holds ${pages.length} pages, expected only ${pageId}`,
        );
      }
    }
    const unknown = await readResource(
      client,
      transport,
      template.uriTemplate.replace('{pageId}', UNKNOWN_PAGE),
      'template-unknown-page',
    );
    if (unknown.ok) {
      check(
        unknown.text.includes(UNKNOWN_PAGE) && /No page/.test(unknown.text),
        `${transport} ${template.uriTemplate} [unknown page]`,
        'answer for an unknown page does not say so',
        { answer: unknown.text.slice(0, 500) },
      );
    }
  }
  // Prompts.
  let prompts = [];
  try {
    prompts = await listAll(client, 'listPrompts', 'prompts');
  } catch (error) {
    report.prompts.push({ transport, error: String(error.message) });
  }
  state.prompts = prompts;
  report.counts[`${transport}Prompts`] = prompts.length;
  for (const prompt of prompts) {
    for (const withArg of [false, true]) {
      const args = {};
      if (withArg)
        for (const arg of prompt.arguments ?? [])
          args[arg.name] =
            `${'x'.repeat(250)} eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop\nsecond line`;
      try {
        const result = await client.getPrompt({ name: prompt.name, arguments: args });
        const text = result.messages.map((message) => message.content?.text ?? '').join('\n');
        const entry = {
          transport,
          prompt: prompt.name,
          withArg,
          messages: result.messages.length,
          text: text.slice(0, 4000),
        };
        report.prompts.push(entry);
        check(
          result.messages.length === 1 && result.messages[0].role === 'user',
          `${transport} prompt ${prompt.name}`,
          'expected one user message',
        );
        const toolNames = [...text.matchAll(/pangular_([\w-]+)/g)].map((m) => m[1]);
        for (const name of toolNames) {
          check(
            state.tools?.has(name) ?? true,
            `${transport} prompt ${prompt.name}`,
            `names ${name}, which is not in tools/list`,
          );
        }
        if (withArg) {
          check(
            !text.includes('eyJzdWIiOiIxIn0'),
            `${transport} prompt ${prompt.name}`,
            'argument JWT is not masked',
          );
          check(
            !text.includes('x'.repeat(201)),
            `${transport} prompt ${prompt.name}`,
            'argument is not cut at 200 characters',
          );
          check(
            !text.includes('\nsecond line'),
            `${transport} prompt ${prompt.name}`,
            'argument is not put on one line',
          );
        }
      } catch (error) {
        failure(`${transport} prompt ${prompt.name}`, `prompts/get failed: ${error.message}`);
      }
    }
  }
  try {
    await client.getPrompt({ name: 'no-such-prompt', arguments: {} });
    failure(`${transport} prompt no-such-prompt`, 'unknown prompt did not fail');
  } catch (error) {
    report.prompts.push({
      transport,
      prompt: 'no-such-prompt',
      error: String(error.message).slice(0, 300),
    });
  }
}

async function readResource(client, transport, uri, kind) {
  const entry = { transport, uri, kind, ok: false };
  try {
    const result = await client.readResource({ uri });
    const content = result.contents?.[0] ?? {};
    entry.ok = true;
    entry.mimeType = content.mimeType;
    entry.text = content.text ?? '';
    entry.length = entry.text.length;
    try {
      entry.json = JSON.parse(entry.text);
    } catch {
      entry.json = undefined;
    }
    if (entry.length > 100_000 && !uri.startsWith('devframe://state/')) {
      failure(
        `${transport} ${uri}`,
        `resource is ${entry.length} chars, over the 100,000 summary limit`,
      );
    }
    if (
      entry.mimeType === 'application/json' &&
      entry.json === undefined &&
      kind !== 'template-unknown-page'
    ) {
      failure(`${transport} ${uri}`, 'mimeType is application/json but the text does not parse');
    }
    if (/^devframe:\/\/resource\//.test(uri) && entry.json) {
      check(
        Object.keys(entry.json)[0] === '_untrusted',
        `${transport} ${uri}`,
        'does not start with _untrusted',
      );
    }
  } catch (error) {
    entry.error = String(error.message).slice(0, 500);
    if (kind !== 'expect-missing')
      failure(`${transport} ${uri}`, `resources/read failed: ${entry.error}`);
  }
  report.resources.push({ ...entry, json: undefined, text: entry.text?.slice(0, 2000) });
  return entry;
}

/**
 * `notifications/resources/list_changed` when a tab joins and leaves. The HTTP
 * endpoint is stateless, so a 2025-era client (the SDK's default) can only get
 * it unsolicited, and a 2026-07-28 client through `subscriptions/listen`.
 * Both are checked.
 */
async function checkListChanged(context, state, origin, sdk, timeoutMs) {
  const modern = [];
  let modernClient;
  let subscription;
  if (sdk.modern) {
    try {
      modernClient = new sdk.modern.Client(
        { name: 'pangular-e2e-modern', version: '1.0.0' },
        { capabilities: {}, versionNegotiation: { mode: 'auto' } },
      );
      modernClient.setNotificationHandler('notifications/resources/list_changed', () =>
        modern.push(Date.now()),
      );
      await modernClient.connect(
        new sdk.modern.StreamableHTTPClientTransport(new URL(`${origin}/__devframes/__mcp`), {
          requestInit: { headers: { Origin: origin } },
        }),
      );
      report.listChanged.modernProtocol = modernClient.getNegotiatedProtocolVersion?.();
      subscription = await modernClient.listen({ resourcesListChanged: true });
      report.listChanged.honoredFilter = subscription.honoredFilter;
    } catch (error) {
      failure(
        'http list_changed',
        `could not open a subscriptions/listen stream: ${error.message}`,
      );
    }
  } else {
    warning(
      'http list_changed',
      'no @modelcontextprotocol/client in the workspace, so only the 2025-era client is checked',
    );
  }
  const legacyCount = state.listChanged.length;
  const second = await context.newPage();
  const joinedAt = Date.now();
  await second.goto(`${origin}/about`, { waitUntil: 'networkidle' });
  const pages = await waitUntil(
    async () => {
      const answer = markdownOf(
        (await state.client.callTool({ name: 'pangular_list-pages', arguments: {} })).content?.[0]
          ?.text ?? '',
      );
      return [...answer.matchAll(/\| `([^`]+)` \| `\/about`/g)]
        .map((m) => m[1])
        .find((id) => id !== state.pageId);
    },
    15_000,
    300,
  );
  state.secondPageId = pages;
  if (subscription) {
    const joined = await waitUntil(() => modern.some((at) => at >= joinedAt), 15_000, 200);
    report.listChanged.modernJoinMs = joined
      ? modern.find((at) => at >= joinedAt) - joinedAt
      : null;
    check(
      joined,
      'http list_changed',
      'no list_changed on the subscriptions/listen stream within 15s of a second tab connecting',
    );
  }
  await sleep(2000);
  report.listChanged.legacyJoin = state.listChanged.length > legacyCount;
  // The stateless endpoint only reaches subscriptions/listen streams, as
  // agents/resources.md ("List changes") documents, so this is a known limit.
  if (!report.listChanged.legacyJoin)
    warning(
      'http list_changed',
      'a 2025-era client (MCP SDK 1.x defaults) gets no list_changed when a tab connects (documented in agents/resources.md)',
    );

  const legacyLeaveCount = state.listChanged.length;
  await second.close();
  const closedAt = Date.now();
  const uri = `pangular://pages/${state.secondPageId}/component-tree`;
  const gone = await waitUntil(
    async () => {
      const resources = await listAll(state.client, 'listResources', 'resources');
      return (
        !resources.some((item) => item.uri === uri) &&
        (!subscription || modern.some((at) => at >= closedAt))
      );
    },
    timeoutMs,
    500,
  );
  report.listChanged.modernLeaveMs =
    subscription && gone ? modern.find((at) => at >= closedAt) - closedAt : null;
  report.listChanged.leaveListedFor = Date.now() - closedAt;
  check(
    gone,
    'http list_changed',
    `the closed tab ${state.secondPageId} was still listed, or no list_changed came, ${Math.round(timeoutMs / 1000)}s after it closed`,
  );
  report.listChanged.legacyLeave = state.listChanged.length > legacyLeaveCount;
  await subscription?.close().catch(() => undefined);
  await modernClient?.close().catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Action tools: run each one and read the app back.

async function runActions(state) {
  const { client, app, ctx } = state;
  const { page } = app;
  const tools = state.tools;
  const act = async (name, args, expect = 'ok') => {
    const tool = tools.get(name);
    if (!tool) {
      if (!LIBRARY_TOOL.test(name)) failure(`http ${name}`, 'action tool missing from tools/list');
      return { markdown: '', isError: true, failures: [], skipped: true };
    }
    const record = await callTool(
      client,
      'http',
      tool.name,
      args,
      expect === 'ok' ? 'valid' : 'action-refusal',
      { timeoutMs: 90_000 },
    );
    checkAnswer(record, tool, expect);
    return record;
  };
  const write = (tool, what, ok, detail) => {
    report.writes.push({ tool, what, ok: Boolean(ok), detail });
    if (!ok) failure(`write ${tool}`, `${what}${detail ? `: ${detail}` : ''}`);
  };
  const read = ctx.read;

  // navigate
  await app.go('/destinations');
  let r = await act('navigate', { action: 'go', url: '/about', waitFor: 'stable' });
  await sleep(500);
  write(
    'navigate',
    'navigate to /about changes the page URL',
    app.path() === '/about',
    `page is on ${app.path()}`,
  );
  write(
    'navigate',
    'inspect-route reads /about afterwards',
    /\/about/.test(await read('inspect-route', {})),
  );
  r = await act('navigate', { action: 'go', url: '/trips' });
  await sleep(500);
  write(
    'navigate',
    'a guarded URL redirects to /sign-in',
    app.path().startsWith('/sign-in'),
    `page is on ${app.path()}, answer ${r.markdown.slice(0, 300)}`,
  );
  r = await act('navigate', {
    action: 'go',
    pattern: '/destinations/:id',
    params: { id: 'lisbon' },
  });
  await sleep(500);
  write(
    'navigate',
    'pattern + params navigates',
    app.path() === '/destinations/lisbon',
    app.path(),
  );
  r = await act('probe-route', { url: '/trips' });
  write(
    'probe-route',
    'probe does not move the page',
    app.path() === '/destinations/lisbon',
    app.path(),
  );
  // signedInGuard is canActivate, which a probe does not run (it runs canMatch only).
  write(
    'probe-route',
    'probe matches the trips route',
    /"matched":\s*true/.test(r.markdown) && /trips/.test(r.markdown),
    r.markdown.slice(0, 400),
  );
  await act('record-guards', { on: true });
  // The old actions are gone: `probe` is not a `navigate` action any more.
  await act('navigate', { action: 'probe', url: '/trips' }, 'refusal');
  const navs = await read('explain-navigation', { limit: 3 });
  const navId = Number(navs.match(/^- #(\d+)/m)?.[1] ?? 1);
  // Replaying the navigation to the current URL is skipped by the router: a no-op, so isError.
  r = await act('navigate', { action: 'replay', id: navId }, 'any');
  write(
    'navigate',
    'a replay that the router skipped or that ran names its page',
    r.markdown.includes(`"page": "${state.pageId}"`) &&
      (r.isError ? /"outcome": "(skipped|cancelled|failed)"/.test(r.markdown) : true),
    r.markdown.slice(0, 400),
  );
  await act('navigate', { action: 'abort' }, 'any');
  const routesMd = await read('list-routes', {});
  const lazyId = routesMd.match(/`(r?\d+|[\w-]*examples[\w-]*)`[^\n]*(?:lazy|not loaded)/i)?.[1];
  r = await act(
    'list-routes',
    { resolveLazy: lazyId ?? 'examples' },
    // A name that is not a route id is refused by the page.
    lazyId && /^r?\d+(\.\d+)*$/.test(lazyId) ? 'ok' : 'any',
  );
  state.resolveLazyRouteId = lazyId;
  await act('navigate', { action: 'go', url: 'https://example.com/' }, 'refusal');
  write(
    'navigate',
    'an off-origin URL is refused',
    app.path() === '/destinations/lisbon',
    app.path(),
  );

  // highlight
  await app.go('/destinations');
  ctx.components = parseComponents(await read('list-components', {}));
  const card = ctx.component('DestinationCard', 2);
  r = await act('highlight', { component: card.id });
  const tree = await state.client.readResource({
    uri: 'devframe://resource/pangular%3Acomponent-tree',
  });
  const treeJson = JSON.parse(tree.contents[0].text);
  const selected =
    JSON.stringify(treeJson).match(/"selectedId":"([^"]+)"/)?.[1] ?? treeJson.detail?.id;
  write(
    'highlight',
    'the highlighted instance becomes the selection in component-tree',
    selected === card.id || JSON.stringify(treeJson.detail ?? {}).includes(card.id),
    `selected ${selected}, wanted ${card.id}`,
  );
  const overlayShown = await page.evaluate(() =>
    [...document.querySelectorAll('body *')].some((el) => {
      const style = getComputedStyle(el);
      return (
        el.shadowRoot ||
        (style.position === 'fixed' && /highlight|pangular/i.test(`${el.id} ${el.className}`))
      );
    }),
  );
  write('highlight', 'an overlay element is drawn in the page', overlayShown);

  // ngrx-restore: save Lisbon, then restore the entry before it.
  ctx.seqs = parseSeqs(await read('ngrx-history', { page: ctx.pageId }));
  const beforeSave = ctx.seqs.filter((entry) => entry.method === 'toggleSaved').at(-1);
  await page.getByRole('button', { name: 'Save Lisbon' }).first().click({ timeout: 5000 });
  await sleep(800);
  const savedBefore = await page.getByRole('button', { name: 'Remove Lisbon' }).count();
  write('ngrx-restore', 'precondition: Lisbon is saved through the UI', savedBefore > 0);
  if (beforeSave) {
    r = await act('ngrx-restore', { seq: beforeSave.seq, page: ctx.pageId });
    await sleep(800);
    const lisbonSaved = await page.getByRole('button', { name: 'Remove Lisbon' }).count();
    write(
      'ngrx-restore',
      `restoring #${beforeSave.seq} unsaves Lisbon in the DOM`,
      lisbonSaved === 0,
      r.markdown.slice(0, 300),
    );
    const state1 = await read('ngrx-inspect-store', { store: ctx.storeId('TravelStore') });
    write(
      'ngrx-restore',
      'ngrx-inspect-store no longer lists lisbon in saved',
      !/"saved":\s*\[[^\]]*lisbon/.test(state1.replace(/\s+/g, '')),
      state1.match(/saved[^\]]*\]/)?.[0],
    );
    const history = await read('ngrx-history', { page: ctx.pageId });
    write(
      'ngrx-restore',
      'the log gets a Restore entry',
      /restore/i.test(history.split('\n').slice(-5).join('\n')),
    );
  } else {
    write('ngrx-restore', 'found a toggleSaved entry to restore', false);
  }
  await act('ngrx-restore', { latest: true, page: ctx.pageId }, 'any');
  await act('ngrx-restore', { seq: 999_999, page: ctx.pageId }, 'refusal');
  await act('ngrx-dispatch', { type: '[E2E] Ping', payload: { id: 1 } }, 'refusal');

  // plugin action
  const savedCount = await page.getByRole('button', { name: /^Remove / }).count();
  r = await act('plugin_travel_clear-saved', {});
  await sleep(800);
  const savedAfter = await page.getByRole('button', { name: /^Remove / }).count();
  write(
    'plugin_travel_clear-saved',
    'clears the saved destinations in the DOM',
    savedCount > 0 ? savedAfter === 0 : true,
    `before ${savedCount}, after ${savedAfter}`,
  );

  // set-component-property and set-signal
  await app.go('/examples/components');
  ctx.components = parseComponents(await read('list-components', {}));
  r = await act('set-component-property', {
    component: 'EagerClock',
    property: 'ticks',
    value: 5000,
  });
  await sleep(1200);
  const ticks = Number(await app.text('app-eager-clock strong'));
  write(
    'set-component-property',
    'EagerClock.ticks is written and rendered',
    ticks >= 5000,
    `DOM shows ${ticks}`,
  );
  await act(
    'set-component-property',
    { component: 'StatCard', property: 'value', value: 3 },
    'refusal',
  );
  await act(
    'set-component-property',
    { component: 'EagerClock', property: 'ticks', value: 'not json {' },
    'any',
  );

  await app.go('/examples/signals');
  r = await act('set-signal', { component: 'SignalsExample', property: 'count', value: 42 });
  await sleep(600);
  const count = await app.text('dl.readouts dd');
  const doubled = await app.text('dl.readouts dd:nth-of-type(2)');
  write(
    'set-signal',
    'count is set to 42 in the DOM, doubled follows',
    count === '42' && doubled === '84',
    `count ${count}, doubled ${doubled}`,
  );
  await act(
    'set-signal',
    { component: 'SignalsExample', property: 'doubled', value: 1 },
    'refusal',
  );
  const doubledAfter = await app.text('dl.readouts dd:nth-of-type(2)');
  write(
    'set-signal',
    'a computed is refused and left as it was',
    doubledAfter === '84',
    doubledAfter,
  );

  // watch-signal
  const graph = jsonBlock(await read('inspect-signals', { component: 'app-signals-example' }));
  const countNode = graph?.nodes?.find((node) => node.label === 'count');
  r = await act('watch-signal', { node: countNode?.id ?? 'count', stacks: true });
  await page.getByRole('button', { name: 'Add one' }).click();
  await sleep(800);
  const watched = jsonBlock(
    await read('inspect-signals', {
      component: 'app-signals-example',
      node: countNode?.id ?? 'count',
    }),
  );
  write(
    'watch-signal',
    'inspect-signals lists the node under watch.ids',
    JSON.stringify(watched?.watch ?? {}).includes(String(countNode?.id ?? 'count')),
    JSON.stringify(watched?.watch),
  );
  write(
    'watch-signal',
    'write stacks appear on history entries',
    JSON.stringify(watched ?? {}).includes('"stack"'),
  );
  await act('watch-signal', { node: countNode?.id ?? 'count', watch: false, stacks: false });
  await act('watch-signal', {}, 'refusal');

  // record-change-detection, then change-detection reads
  r = await act('record-change-detection', { record: 'start' });
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Add one' }).click();
    await sleep(200);
  }
  await sleep(1000);
  r = await act('change-detection', { limit: 5 });
  write(
    'change-detection',
    'a recording started by the tool has cycles',
    /cycle/i.test(r.markdown) && !/no cycles|not recording|start a recording/i.test(r.markdown),
    r.markdown.slice(0, 300),
  );
  await act('diagnose-change-detection', { limit: 5 });
  r = await act('change-detection', { export: 'json' });
  write(
    'change-detection',
    'export json returns a json block',
    /```json/.test(r.markdown) || /characters/.test(r.markdown),
    r.markdown.slice(0, 200),
  );
  await act('change-detection', { export: 'trace' });
  await act('record-change-detection', {}, 'refusal');
  await act('record-change-detection', { flash: true, track: true });
  await act('record-change-detection', { flash: false, track: false });
  await act('record-change-detection', { angularProfiling: false }, 'refusal');
  await act('record-change-detection', { record: 'stop' });
  r = await act('record-change-detection', { record: 'clear' });

  // track-subscriptions and find-leaks
  r = await act('track-subscriptions', { action: 'start' });
  await app.go('/examples/http');
  await app.go('/examples/signals');
  const leaks = await read('find-leaks', {});
  write(
    'track-subscriptions',
    'find-leaks reports tracking on',
    !/tracking (is )?off|not tracking|track-subscriptions/i.test(leaks) ||
      /tracking (is )?on/i.test(leaks),
    leaks.slice(0, 400),
  );
  await act('track-subscriptions', { action: 'stop' });

  // record-pipes and explain-pipe
  await app.go('/examples/pipes');
  r = await act('record-pipes', { action: 'start' });
  await page
    .getByRole('button', { name: 'Post again' })
    .click({ timeout: 5000 })
    .catch(() => undefined);
  await sleep(1500);
  const pipe = await read('explain-pipe', { name: 'appTimeAgo' });
  write(
    'record-pipes',
    'explain-pipe shows recorded calls',
    /calls?\b[^\n]*\d/i.test(pipe) && !/hint to start|start recording|recording is off/i.test(pipe),
    pipe.slice(0, 400),
  );
  await act('record-pipes', { action: 'stop' });

  // hydration overlay, drawn by highlight
  await app.go('/examples/defer');
  r = await act('highlight', { hydration: true });
  await sleep(800);
  const treeAfter = JSON.parse(
    (await state.client.readResource({ uri: 'devframe://resource/pangular%3Acomponent-tree' }))
      .contents[0].text,
  );
  const overlayOn = JSON.stringify(treeAfter).match(/"overlay":(true|false)/)?.[1];
  write(
    'highlight',
    'hydration: true turns the hydration overlay on',
    overlayOn === 'true' || !/not rendered on the server/i.test(r.markdown) === false,
    `component-tree overlay=${overlayOn}; ${r.markdown.slice(0, 200)}`,
  );
  await act('highlight', { hydration: false });

  // audit with axe
  r = await act('audit', { axe: true, session: 'before' }, 'any');
  write(
    'audit',
    'axe: true runs axe',
    /axe/i.test(r.markdown) && !/did not run/i.test(r.markdown),
    r.markdown.slice(0, 300),
  );
  r = await act('audit', { session: 'after', area: 'accessibility' }, 'any');
  await act('audit', { session: 'clear' }, 'any');

  // HTTP fault rules
  await app.go('/examples/http');
  r = await act('set-http-rule', {
    pattern: '/api/products',
    status: 503,
    target: 'client',
    method: 'GET',
  });
  const ruleId =
    r.markdown.match(/`([\w-]+)`[^\n]*\/api\/products/)?.[1] ??
    r.markdown.match(/\| `([\w-]+)` \|/)?.[1];
  const rules = await read('list-http-rules', {});
  write(
    'set-http-rule',
    'list-http-rules shows the new rule',
    rules.includes('/api/products'),
    rules.slice(0, 300),
  );
  await page
    .locator('button.reload')
    .first()
    .click({ timeout: 5000 })
    .catch(() => undefined);
  await sleep(1500);
  const calls = await read('list-http-calls', { url: '/api/products', limit: 3 });
  write(
    'set-http-rule',
    'the next client call gets the 503 from the rule',
    /503/.test(calls.split('\n').slice(0, 12).join('\n')),
    calls.slice(0, 600),
  );
  await act('set-http-rule', { pattern: '/x', status: 999 }, 'refusal');
  await act('set-http-rule', { pattern: '/x' }, 'refusal');
  if (ruleId) {
    r = await act('remove-http-rule', { id: ruleId });
    const rulesAfter = await read('list-http-rules', {});
    write(
      'remove-http-rule',
      'list-http-rules no longer shows the rule',
      !rulesAfter.includes('/api/products'),
      rulesAfter.slice(0, 300),
    );
  } else {
    write('set-http-rule', 'answer names the rule id', false, r.markdown.slice(0, 400));
  }
  await act('remove-http-rule', { id: 'no-such-rule' }, 'refusal');

  // SSR overrides. /about is prerendered, so an override there cannot apply;
  // the tool should say so.
  r = await act('set-ssr-override', {
    kind: 'render-error',
    pattern: '/about',
    message: 'e2e prerendered',
  });
  const prerendered = (await fetchPage(`${app.origin}/about`)).status;
  if (prerendered === 200 && !/prerender/i.test(r.markdown)) {
    warning(
      'write set-ssr-override',
      'accepted a render-error override for a prerendered page, which never applies, without a note',
      { answer: r.markdown.slice(0, 300) },
    );
  }
  const prerenderedId = r.markdown.match(/override `([\w-]+)`/)?.[1];
  if (prerenderedId) await act('remove-ssr-override', { id: prerenderedId });
  r = await act('set-ssr-override', {
    kind: 'render-error',
    pattern: '/examples/ssr',
    message: 'e2e simulated render error',
  });
  const overrideId =
    r.markdown.match(/override `([\w-]+)`/)?.[1] ?? r.markdown.match(/\| `([\w-]+)` \|/)?.[1];
  const broken = await fetchPage(`${app.origin}/examples/ssr`);
  write(
    'set-ssr-override',
    'the next server render of /examples/ssr fails with the message',
    broken.status >= 500 || broken.body.includes('e2e simulated'),
    `status ${broken.status}`,
  );
  if (overrideId) {
    await act('remove-ssr-override', { id: overrideId });
    const fixed = (await fetchPage(`${app.origin}/examples/ssr`)).status;
    write(
      'remove-ssr-override',
      'the server renders /examples/ssr again',
      fixed === 200,
      `status ${fixed}`,
    );
  } else {
    write('set-ssr-override', 'answer names the override id', false, r.markdown.slice(0, 400));
  }
  await act('set-ssr-override', { kind: 'state-edit', pattern: '/', key: ' bad key ' }, 'refusal');
  await act('remove-ssr-override', { id: 'no-such-override' }, 'refusal');

  // clear-recordings
  r = await act('clear-recordings', { target: 'http' });
  const callsAfter = await read('list-http-calls', { limit: 5 });
  write(
    'clear-recordings',
    'list-http-calls is empty after clearing http',
    !/\| (GET|POST) /.test(callsAfter),
    callsAfter.slice(0, 400),
  );
  r = await act('clear-recordings', { target: 'router', page: ctx.pageId });
  const navsAfter = await read('explain-navigation', {});
  write(
    'clear-recordings',
    'explain-navigation is empty after clearing router',
    !/^- #\d+/m.test(navsAfter),
    navsAfter.slice(0, 300),
  );
  await act('clear-recordings', { target: 'analog' }, 'any');
  await act('clear-recordings', { target: 'all' }, 'any');

  // TanStack and Analog: not in this app, so a readable refusal.
  await act('tanstack-run-query', { action: 'invalidate', key: 'products' }, 'refusal');
  await act('analog-run-api', { path: '/api/products' }, 'refusal');
  await act('analog-run-api', { path: '/api/products', method: 'DELETE' }, 'refusal');

  // Forms: fill-form and run-form-action on the booking form.
  await app.go('/destinations');
  await app.go('/book/lisbon');
  // The page reports a form that appears after a route change on its next
  // push, which can take up to the collector's 5 s heartbeat.
  let formsList = '';
  for (const started = Date.now(); Date.now() - started < 10_000; await sleep(250)) {
    formsList = await read('inspect-forms', {});
    if (parseFormIds(formsList).some((id) => id.startsWith('Booking.'))) break;
  }
  const form = parseFormIds(formsList).find((id) => id.startsWith('Booking.'));
  if (!form) {
    write('fill-form', 'found the booking form', false, formsList.slice(0, 300));
    return;
  }
  const marker = Number(
    (await read('list-form-changes', { form, limit: 1 })).match(/marker[^\d]*(\d+)/i)?.[1] ?? 0,
  );
  r = await act('fill-form', { form, values: { travelers: 0, email: 'not-an-email', name: 'B' } });
  await sleep(500);
  write(
    'fill-form',
    'invalid values reach the inputs',
    (await app.value('#travelers')) === '0' && (await app.value('#email')) === 'not-an-email',
    `travelers ${await app.value('#travelers')}, email ${await app.value('#email')}`,
  );
  const invalid = await read('explain-invalid-forms', { form });
  write(
    'fill-form',
    'explain-invalid-forms names the invalid fields',
    /travelers/.test(invalid) && /email/.test(invalid),
    invalid.slice(0, 400),
  );
  const valid = {
    startDate: isoDay(21),
    travelers: 2,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    requests: 'Window seat',
    terms: true,
  };
  r = await act('fill-form', { form, values: valid });
  await sleep(600);
  const dom = {
    startDate: await app.value('#start'),
    travelers: await app.value('#travelers'),
    name: await app.value('#name'),
    email: await app.value('#email'),
    requests: await app.value('#requests'),
    terms: await page
      .locator('input[type=checkbox]')
      .first()
      .isChecked()
      .catch(() => null),
  };
  write(
    'fill-form',
    'valid values reach every input',
    dom.startDate === valid.startDate &&
      dom.travelers === '2' &&
      dom.name === valid.name &&
      dom.email === valid.email &&
      dom.requests === valid.requests &&
      dom.terms === true,
    JSON.stringify(dom),
  );
  const nowValid = await read('explain-invalid-forms', { form });
  write(
    'fill-form',
    'explain-invalid-forms finds nothing wrong',
    !/travelers|startDate|email/.test(nowValid) ||
      /valid/i.test(nowValid.split('\n').slice(0, 4).join(' ')),
    nowValid.slice(0, 300),
  );
  const diff = await read('explain-form-changes', { form, after: marker });
  write(
    'fill-form',
    `explain-form-changes after ${marker} lists the changed fields`,
    ['startDate', 'name', 'email', 'terms'].every((field) => diff.includes(field)),
    diff.slice(0, 500),
  );
  // MCP writes are tagged `devtools`; `agent` is a WebMCP tool call on the page.
  const history = await read('list-form-changes', { form, origin: 'devtools', limit: 50 });
  write(
    'fill-form',
    'list-form-changes tags the writes with origin devtools',
    /email/.test(history),
    history.slice(0, 300),
  );

  r = await act('run-form-action', {
    action: 'set-value',
    form,
    path: 'requests',
    value: 'Aisle seat',
    mode: 'user',
  });
  await sleep(300);
  write(
    'run-form-action',
    'set-value (user) reaches the textarea',
    (await app.value('#requests')) === 'Aisle seat',
    await app.value('#requests'),
  );
  r = await act('run-form-action', {
    action: 'set-value',
    form,
    path: 'travelers',
    value: 3,
    mode: 'code',
  });
  await sleep(300);
  write(
    'run-form-action',
    'set-value (code) reaches the input',
    (await app.value('#travelers')) === '3',
    await app.value('#travelers'),
  );
  r = await act('run-form-action', { action: 'focus', form, path: 'email' });
  await sleep(300);
  write(
    'run-form-action',
    'focus moves focus to the field',
    (await page.evaluate(() => document.activeElement?.id)) === 'email',
    await page.evaluate(() => document.activeElement?.id),
  );
  r = await act('run-form-action', { action: 'mark-touched', form, path: 'name' });
  r = await act('run-form-action', { action: 'touch-all', form });
  r = await act('run-form-action', { action: 'revalidate', form });
  r = await act('run-form-action', { action: 'snapshot', form });
  const snapshotId = r.markdown.match(/`([\w:-]+)`/)?.[1];
  r = await act('run-form-action', { action: 'store-as-global', form });
  const globalSet = await page.evaluate(() => typeof window.$form !== 'undefined');
  write('run-form-action', 'store-as-global sets $form in the page', globalSet);
  r = await act('run-form-action', { action: 'submit', form }, 'refusal');
  await sleep(300);
  write(
    'run-form-action',
    'submit without confirm does not submit',
    !(await page.getByText("You're going to").count()),
  );
  await act('fill-form', { form, values: { name: 'X' }, submit: true }, 'refusal');
  write(
    'fill-form',
    'fill-form with submit and no confirm writes nothing',
    (await app.value('#name')) === valid.name,
    await app.value('#name'),
  );
  r = await act('run-form-action', { action: 'submit', form, confirm: true });
  const booked = await waitUntil(
    async () => (await page.getByText("You're going to").count()) > 0,
    5000,
  );
  write(
    'run-form-action',
    'submit with confirm books the trip (confirmation shown)',
    booked,
    r.markdown.slice(0, 300),
  );
  const stores = await read('ngrx-inspect-store', { store: ctx.storeId('TravelStore') });
  write(
    'run-form-action',
    'TravelStore holds the booking',
    /Ada Lovelace|BK-?\d+|booking[^\n]*\(1\)/i.test(stores),
    stores.slice(0, 300),
  );
  const submitHistory = await read('list-form-changes', { form, type: 'submit' });
  write(
    'run-form-action',
    'list-form-changes records the submit as ran',
    /ran/.test(submitHistory),
    submitHistory.slice(0, 300),
  );
  await act('run-form-action', { action: 'restore', form, snapshot: snapshotId ?? 'none' }, 'any');
  await act(
    'run-form-action',
    { action: 'set-value', form: 'NoSuch.form@zz', path: 'x', value: 1 },
    'refusal',
  );
  await act('fill-form', { form, values: { 'no.such.path': 1 } }, 'refusal');

  // wait-for with conditions that need an event after the call starts.
  const waiting = callTool(
    client,
    'http',
    'pangular_wait-for',
    { condition: 'http-call', url: '/api/products', timeoutMs: 8000 },
    'valid',
  );
  await sleep(500);
  await app.go('/examples/http');
  await page
    .locator('button.reload')
    .first()
    .click({ timeout: 5000 })
    .catch(() => undefined);
  const waited = await waiting;
  checkAnswer(waited, tools.get('wait-for'), 'ok');
  write(
    'wait-for',
    'http-call resolves on the next call',
    !/Timed out/.test(waited.markdown),
    waited.markdown.slice(0, 300),
  );
  const timedOut = await callTool(
    client,
    'http',
    'pangular_wait-for',
    { condition: 'error', code: 'NG0999', timeoutMs: 1000 },
    'valid',
  );
  checkAnswer(timedOut, tools.get('wait-for'), 'any');
  write(
    'wait-for',
    'an unmet condition times out with the last state',
    /Timed out after/.test(timedOut.markdown),
    timedOut.markdown.slice(0, 200),
  );
}

// ---------------------------------------------------------------------------
// Invalid input for every tool

function wrongValue(schema) {
  const type = Array.isArray(schema?.type) ? schema.type[0] : schema?.type;
  switch (type) {
    case 'string':
      return 12_345;
    case 'integer':
    case 'number':
      return 'not-a-number';
    case 'boolean':
      return 'yes';
    case 'array':
      return 'not-an-array';
    case 'object':
      return 'not-an-object';
    default:
      return undefined;
  }
}

function validFor(name, state) {
  const entry = READ_PLAN.find(([tool]) => tool === name);
  try {
    return entry ? entry[2](state.ctx) : {};
  } catch {
    return {};
  }
}

const ACTION_VALID = {
  navigate: () => ({ action: 'abort' }),
  'probe-route': () => ({ url: '/about' }),
  'record-guards': () => ({ on: false }),
  'record-change-detection': () => ({ record: 'stop' }),
  'track-subscriptions': () => ({ action: 'stop' }),
  'record-pipes': () => ({ action: 'stop' }),
  'clear-recordings': () => ({ target: 'router' }),
  'set-component-property': () => ({ component: 'NoSuch', property: 'x', value: 1 }),
  'set-signal': () => ({ component: 'NoSuch', property: 'x', value: 1 }),
  'watch-signal': () => ({ stacks: false }),
  'ngrx-restore': () => ({ seq: 999_999 }),
  'ngrx-dispatch': () => ({ type: '[E2E] Ping' }),
  'tanstack-run-query': () => ({ action: 'refetch', key: 'nothing' }),
  'run-form-action': (ctx) => ({ action: 'revalidate', form: ctx.formIds?.[0] ?? 'x' }),
  'fill-form': (ctx) => ({ form: ctx.formIds?.[0] ?? 'x', values: {} }),
  'set-http-rule': () => ({ pattern: '/never-matches-e2e', delayMs: 1, enabled: false }),
  'remove-http-rule': () => ({ id: 'no-such-rule' }),
  'set-ssr-override': () => ({
    kind: 'client-render',
    pattern: '/never-matches-e2e',
    enabled: false,
  }),
  'remove-ssr-override': () => ({ id: 'no-such-override' }),
  'analog-run-api': () => ({ path: '/api/none' }),
  'plugin_travel_clear-saved': () => ({}),
  'change-detection': () => ({}),
  hydration: () => ({}),
  audit: () => ({}),
};

async function runNegative(client, transport, tools, state) {
  for (const tool of tools) {
    const name = short(tool.name);
    const schema = tool.inputSchema ?? {};
    const properties = schema.properties ?? {};
    const required = schema.required ?? [];
    const valid = ACTION_VALID[name] ? ACTION_VALID[name](state.ctx ?? {}) : validFor(name, state);

    if (required.length) {
      const record = await callTool(client, transport, tool.name, {}, 'missing');
      checkAnswer(record, tool, 'error');
      if (!record.protocolError && !record.isError)
        recordWarning(record, 'missing required arguments answered without isError');
      if (!record.protocolError && !required.some((arg) => record.markdown.includes(arg))) {
        recordWarning(
          record,
          `the refusal does not name the missing argument (${required.join(', ')})`,
        );
      }
    }

    // One wrong-typed argument at a time, the others valid, so a crash names its argument.
    for (const [key, propertySchema] of Object.entries(properties)) {
      const value = wrongValue(propertySchema);
      if (value === undefined) continue;
      const record = await callTool(
        client,
        transport,
        tool.name,
        { ...valid, [key]: value },
        'wrong-type',
      );
      record.wrongArg = key;
      checkAnswer(record, tool, 'error');
      if (!record.protocolError && !record.isError)
        recordWarning(record, `wrong-typed ${key} was accepted without isError`);
      if (key === 'page' && transport === 'http' && !record.isError && !record.protocolError) {
        const fellBack =
          (state.pageId && record.markdown.includes(state.pageId)) ||
          /every page|on \d+ page\(s\)|^Cleared/m.test(record.markdown);
        if (fellBack)
          recordWarning(
            record,
            `a numeric ${key} is ignored: the tool answered for or acted on the real page(s) instead of refusing`,
          );
      }
    }

    const enumKey = Object.keys(properties).find((key) => Array.isArray(properties[key].enum));
    if (enumKey) {
      const record = await callTool(
        client,
        transport,
        tool.name,
        { ...valid, [enumKey]: 'not-a-valid-choice' },
        'bad-enum',
      );
      checkAnswer(record, tool, 'error');
      if (!record.protocolError && !record.isError)
        recordWarning(record, `bad ${enumKey} accepted without isError`);
    }

    if ('limit' in properties && !ACTION_SCENARIO_TOOLS.has(name)) {
      const record = await callTool(
        client,
        transport,
        tool.name,
        { ...valid, limit: 1_000_000 },
        'huge-limit',
      );
      checkAnswer(record, tool, 'any');
    }

    const pageKey = 'page' in properties ? 'page' : undefined;
    if (pageKey && transport === 'http') {
      const record = await callTool(
        client,
        transport,
        tool.name,
        { ...valid, [pageKey]: UNKNOWN_PAGE },
        'unknown-page',
      );
      checkAnswer(record, tool, 'refusal');
      if (!record.protocolError) {
        // Tools with nothing to report anywhere (no Capacitor app, not an Analog app) may say that instead.
        const says =
          record.markdown.includes(UNKNOWN_PAGE) ||
          /no page|not report|unknown page|no connected|No Capacitor app reports|not an Analog app/i.test(
            record.markdown,
          );
        if (!says)
          recordFailure(
            record,
            `answer for page ${UNKNOWN_PAGE} does not say that page is unknown`,
          );
        if (
          state.pageId &&
          record.markdown.includes(`\`${state.pageId}\``) &&
          !/report|pages? that|connected/i.test(record.markdown)
        ) {
          recordFailure(record, 'answer for an unknown page carries data from the real page');
        }
      }
    }
  }
  // An unknown tool.
  const record = await callTool(client, transport, 'pangular_no-such-tool', {}, 'unknown-tool');
  if (record.protocolError) {
    if (record.protocolError.code !== -32602 && record.protocolError.code !== -32601) {
      recordWarning(
        record,
        `unknown tool answered with protocol error ${record.protocolError.code}`,
      );
    }
  } else {
    checkAnswer(record, undefined, 'error');
  }

  // 1.0 is a clean break: the names before it are gone, not aliased.
  const listed = new Set(tools.map((tool) => short(tool.name)));
  for (const old of RETIRED_TOOLS) {
    if (listed.has(old)) failure(`${transport} tools/list`, `retired tool ${old} is still listed`);
  }
  const retired = await callTool(client, transport, 'pangular_get-routes', {}, 'unknown-tool');
  if (!retired.protocolError && !retired.isError)
    recordFailure(retired, 'the retired tool get-routes still answers');
  if (transport === 'http' && listed.has('inspect-providers')) {
    const oldArg = await callTool(
      client,
      transport,
      'pangular_inspect-providers',
      { pageId: state.pageId ?? 'p1' },
      'retired-argument',
    );
    if (
      !oldArg.protocolError &&
      !/There is no `pageId` argument; pass `page`/.test(oldArg.markdown)
    )
      recordFailure(oldArg, 'the retired argument pageId is not refused with its new name');
  }
}

/** Tool names 1.0 retired (see apps/docs/src/content/agents/tools.md, Names before 1.0). */
const RETIRED_TOOLS = [
  'get-routes',
  'get-components',
  'get-pipes',
  'get-signals',
  'get-providers',
  'get-ngrx-store',
  'lint-templates',
  'lint-pipes',
  'explain-render-mode',
  'build-meta',
  'inspect-signal-store',
  'signal-store-history',
  'dispatch-ngrx-action',
  'restore-ngrx-state',
  'inspect-ngrx-entry',
  'export-ngrx-session',
  'import-ngrx-session',
  'generate-ngrx-test',
  'inspect-redux-stores',
  'list-queries',
  'inspect-query',
  'query-action',
  'list-capacitor-calls',
  'list-capacitor-plugins',
  'analog-routes',
  'analog-explain-url',
  'analog-server-functions',
  'analog-api-routes',
  'analog-prerender-plan',
  'analog-content',
  'analog-current-page',
  'analog-server-calls',
  'analog-call-api',
  'analog-render-modes',
  'form-payload',
  'form-history',
  'form-diff',
  'form-action',
  'wait-for-form',
  'explain-form-invalid',
  'export-navigation',
  'http-waterfall',
];

// ---------------------------------------------------------------------------
// stdio

async function runStdio(sdk, state, config) {
  const { client, stderr } = await connectStdio(sdk);
  try {
    const tools = await listAll(client, 'listTools', 'tools');
    report.counts.stdioTools = tools.length;
    const names = new Set(tools.map((tool) => short(tool.name)));
    // The repository is no Analog app, so the Analog source tools stay out (library tools).
    const expected = Object.entries(config.AGENT_ENTRIES)
      .filter(([, entry]) => entry.kind !== 'resource' && !entry.page)
      .map(([name]) => name)
      .filter((name) => !LIBRARY_TOOL.test(name));
    for (const name of names)
      if (LIBRARY_TOOL.test(name))
        failure('stdio tools/list', `${name} is listed although the project is not an Analog app`);
    report.stdio.tools = [...names];
    for (const name of expected)
      check(names.has(name), 'stdio tools/list', `source tool ${name} is missing over stdio`);
    for (const name of names) {
      const entry = config.AGENT_ENTRIES[name];
      if (entry?.page)
        failure('stdio tools/list', `${name} needs a page but is offered over stdio`);
    }
    report.stdio.instructions = client.getInstructions?.() ?? null;
    for (const tool of tools) {
      const name = short(tool.name);
      const args = { ...validFor(name, state) };
      delete args.page;
      const record = await callTool(client, 'stdio', tool.name, args, 'valid');
      // No page reaches stdio, so reading a live NgRx entry reads nothing: a refusal.
      checkAnswer(record, tool, name === 'ngrx-inspect-entry' ? 'error' : 'ok');
    }
    await runNegative(client, 'stdio', tools, state);
    const resources = await listAll(client, 'listResources', 'resources').catch((error) => {
      report.stdio.resourcesError = String(error.message);
      return [];
    });
    report.counts.stdioResources = resources.length;
    report.stdio.resources = resources.map((item) => item.uri);
    for (const resource of resources) await readResource(client, 'stdio', resource.uri, 'listed');
    try {
      report.stdio.prompts = (await listAll(client, 'listPrompts', 'prompts')).map(
        (prompt) => prompt.name,
      );
    } catch (error) {
      report.stdio.prompts = `error: ${String(error.message).slice(0, 200)}`;
    }
    try {
      report.stdio.templates = (
        await listAll(client, 'listResourceTemplates', 'resourceTemplates')
      ).length;
    } catch (error) {
      report.stdio.templates = `error: ${String(error.message).slice(0, 200)}`;
    }
  } finally {
    await client.close();
    report.stdio.stderr = stderr.join('').slice(-3000);
  }

  // --read-only and --config on stdio.
  const configFile = join(dirname(report.options.report), 'stdio-config.json');
  writeFileSync(
    configFile,
    JSON.stringify({ inspectors: { pipes: false }, agent: { tools: { ngrx: false } } }),
  );
  for (const [label, args, hidden] of [
    ['--read-only', ['--read-only'], []],
    [
      '--config pipes off, ngrx agent tools off',
      ['--config', configFile],
      [
        'scan-pipes',
        'scan-pipe-usage',
        'explain-pipe',
        'ngrx-scan',
        'ngrx-inspect-entry',
        'ngrx-import-session',
        'ngrx-generate-test',
      ],
    ],
  ]) {
    const { client: variant } = await connectStdio(sdk, args);
    try {
      const names = (await listAll(variant, 'listTools', 'tools')).map((tool) => short(tool.name));
      const leaks = hidden.filter((name) => names.includes(name));
      report.stdio[label] = { tools: names.length, leaks };
      check(!leaks.length, `stdio ${label}`, `still lists ${leaks.join(', ')}`);
      const instructions = variant.getInstructions?.();
      if (label === '--read-only' && instructions) {
        check(
          /read-only/.test(instructions),
          'stdio --read-only',
          'instructions do not say read-only',
        );
      }
    } finally {
      await variant.close();
    }
  }
}

// ---------------------------------------------------------------------------
// Variants: a hub with a different config, and a page connected to it.

async function runVariants(opts, sdk, browser, config, state) {
  const variants = [
    { label: 'agent.readOnly', config: { agent: { readOnly: true } } },
    {
      label: 'agent.tools forms and ngrx off',
      config: { agent: { tools: { forms: false, ngrx: false } } },
    },
    {
      label: 'inspectors router and http off, actions.forms off',
      config: { inspectors: { router: false, http: false }, actions: { forms: false } },
    },
    { label: 'actions.router off', config: { actions: { router: false } } },
  ];
  let port = opts.port + 1;
  const fullTools = state.tools;
  for (const variant of variants) {
    const result = {
      label: variant.label,
      config: variant.config,
      leaks: [],
      missing: [],
      notes: [],
    };
    report.variants.push(result);
    const encoded = Buffer.from(JSON.stringify(variant.config)).toString('base64');
    let server;
    let context;
    let client;
    try {
      server = await startServer(
        `variant hub (${variant.label})`,
        [fileURLToPath(import.meta.url), '--serve-variant', encoded, '--port', String(port)],
        port,
      );
      context = await browser.newContext();
      const page = await context.newPage();
      page.on('dialog', (dialog) => dialog.accept().catch(() => undefined));
      client = await connectHttp(sdk, port);
      await page.goto(`http://localhost:${port}/book/kyoto`, { waitUntil: 'networkidle' });
      const pageId = await waitUntil(
        async () => {
          const answer = await client.callTool({ name: 'pangular_list-pages', arguments: {} });
          return markdownOf(answer.content?.[0]?.text ?? '').match(/\| `([^`]+)` \| `\//)?.[1];
        },
        30_000,
        500,
      );
      result.pageId = pageId;
      if (!pageId) result.notes.push('no page connected to the variant hub');
      await sleep(1500);

      const tools = await listAll(client, 'listTools', 'tools');
      const names = new Set(tools.map((tool) => short(tool.name)));
      result.tools = names.size;
      const resolved = config.resolvePangularConfig(variant.config);
      const resources = (await listAll(client, 'listResources', 'resources')).map(
        (item) => item.uri,
      );
      const templates = (
        await listAll(client, 'listResourceTemplates', 'resourceTemplates').catch(() => [])
      ).map((item) => item.uriTemplate);
      const prompts = await listAll(client, 'listPrompts', 'prompts').catch(() => []);
      result.resources = resources.length;
      result.templates = templates;
      result.prompts = prompts.map((prompt) => prompt.name);
      const scope = `variant ${variant.label}`;

      // Expected from the docs and the config, independently of the server.
      for (const name of fullTools.keys()) {
        const entry = config.AGENT_ENTRIES[name];
        let offered = true;
        // The variant hub has no server plugins, so plugin tools are left out here.
        if (name.startsWith('plugin_')) continue;
        if (entry)
          offered = entry.kind === 'resource' ? true : config.agentToolOffered(name, resolved);
        // tools.md: clear-recordings stays while any of its targets passes
        // (action, agent tools and inspector all on).
        if (name === 'clear-recordings') {
          offered =
            !resolved.agent.readOnly &&
            ['http', 'router', 'analog'].some(
              (target) =>
                resolved.actions[target] &&
                resolved.agent.tools[target] &&
                resolved.inspectors[target],
            );
        }
        if (offered && !names.has(name)) result.missing.push(name);
        if (!offered && names.has(name)) result.leaks.push(name);
      }
      if (variant.config.agent?.readOnly) {
        for (const tool of tools) {
          const name = short(tool.name);
          check(
            tool.annotations?.readOnlyHint === true,
            scope,
            `${name} is listed without readOnlyHint`,
          );
        }
        const props = (name) =>
          Object.keys(
            tools.find((tool) => short(tool.name) === name)?.inputSchema?.properties ?? {},
          );
        check(
          !props('change-detection').some((key) =>
            ['record', 'flash', 'track', 'angularProfiling'].includes(key),
          ),
          scope,
          `change-detection keeps acting arguments: ${props('change-detection')}`,
        );
        check(!props('hydration').includes('overlay'), scope, 'hydration has an overlay argument');
        check(!props('audit').includes('axe'), scope, 'audit keeps axe');
        for (const name of [
          'run-form-action',
          'fill-form',
          'navigate',
          'probe-route',
          'record-guards',
          'record-change-detection',
          'set-signal',
          'set-component-property',
          'ngrx-restore',
          'ngrx-dispatch',
          'set-http-rule',
          'remove-http-rule',
          'set-ssr-override',
          'remove-ssr-override',
          'watch-signal',
          'record-pipes',
          'track-subscriptions',
          'clear-recordings',
          'tanstack-run-query',
          'analog-run-api',
          'plugin_travel_clear-saved',
        ]) {
          check(!names.has(name), scope, `${name} is still listed`);
        }
        // audit ignores axe under readOnly; check that no axe pass was recorded.
        const auditState = async () =>
          markdownOf(
            (
              await client.callTool({
                name: 'devframe_state_read',
                arguments: { key: 'pangular:audit' },
              })
            ).content?.[0]?.text ?? '',
          );
        const auditBefore = await auditState();
        const axeRecord = await callTool(
          client,
          `variant:${variant.label}`,
          'pangular_audit',
          { axe: true },
          'read-only-refusal',
        );
        checkAnswer(
          axeRecord,
          tools.find((tool) => short(tool.name) === 'audit'),
          'any',
        );
        await sleep(1500);
        const auditAfter = await auditState();
        if (auditAfter !== auditBefore && /axe/i.test(auditAfter))
          recordFailure(axeRecord, 'axe ran under agent.readOnly');
        else if (!/read-only|readOnly/i.test(axeRecord.markdown))
          recordWarning(axeRecord, '`axe: true` is ignored silently under agent.readOnly');
        // The arguments that act are refused even when sent anyway.
        for (const [name, args] of [['audit', { session: 'clear' }]]) {
          const record = await callTool(
            client,
            `variant:${variant.label}`,
            `pangular_${name}`,
            args,
            'read-only-refusal',
          );
          checkAnswer(
            record,
            tools.find((tool) => short(tool.name) === name),
            'refusal',
          );
          if (
            !record.protocolError &&
            !/read-only|readOnly/i.test(record.markdown) &&
            !record.isError
          ) {
            recordFailure(record, `${JSON.stringify(args)} was not refused under agent.readOnly`);
          }
        }
        const record = await callTool(
          client,
          `variant:${variant.label}`,
          'pangular_run-form-action',
          { action: 'submit', form: 'x', confirm: true },
          'hidden-tool',
        );
        if (!record.protocolError && !record.isError)
          recordFailure(record, 'a dropped action tool still runs');
        check(
          /read-only/.test(client.getInstructions?.() ?? ''),
          scope,
          'instructions do not say read-only',
        );
        const fixForm = prompts.find((prompt) => prompt.name === 'fix-form');
        if (fixForm) {
          const text = (await client.getPrompt({ name: 'fix-form', arguments: {} })).messages
            .map((m) => m.content?.text ?? '')
            .join('\n');
          check(!/form-action|fill-form/.test(text), scope, 'fix-form names an action tool');
        }
      }
      const hiddenResources = [];
      if (
        variant.config.agent?.tools?.forms === false ||
        variant.config.inspectors?.forms === false
      )
        hiddenResources.push('forms');
      if (variant.config.agent?.tools?.ngrx === false) hiddenResources.push('ngrx-store');
      if (variant.config.inspectors?.router === false) hiddenResources.push('router');
      for (const name of hiddenResources) {
        const key = `pangular:${name}`;
        const leaks = resources.filter(
          (uri) => uri.includes(encodeURIComponent(key)) || uri.endsWith(`/${name}`),
        );
        if (leaks.length) result.leaks.push(...leaks);
        if (templates.some((template) => template.endsWith(`/${name}`)))
          result.leaks.push(`template ${name}`);
        const direct = await readResource(
          client,
          `variant:${variant.label}`,
          `devframe://state/${encodeURIComponent(key)}`,
          'expect-missing',
        );
        if (
          direct.ok &&
          direct.text &&
          !/not (exposed|available|found)|hidden|unknown/i.test(direct.text)
        )
          result.leaks.push(`state read ${key}`);
        if (pageId) {
          const perPage = await readResource(
            client,
            `variant:${variant.label}`,
            `pangular://pages/${pageId}/${name}`,
            'expect-missing',
          );
          if (perPage.ok && perPage.json) result.leaks.push(`page resource ${name}`);
        }
        const stateRead = await callTool(
          client,
          `variant:${variant.label}`,
          'devframe_state_read',
          { key },
          'hidden-key',
        );
        if (
          !stateRead.protocolError &&
          !stateRead.isError &&
          stateRead.markdown.includes('"pages"')
        )
          result.leaks.push(`devframe_state_read ${key}`);
        const keyList = await callTool(
          client,
          `variant:${variant.label}`,
          'devframe_state_read',
          {},
          'list-keys',
        );
        if (keyList.markdown.includes(key)) result.leaks.push(`devframe_state_read lists ${key}`);
      }
      if (variant.config.agent?.tools?.forms === false) {
        check(!result.prompts.includes('fix-form'), scope, 'fix-form prompt is still offered');
        const snap = await callTool(
          client,
          `variant:${variant.label}`,
          'pangular_snapshot',
          {},
          'valid',
        );
        checkAnswer(
          snap,
          tools.find((tool) => short(tool.name) === 'snapshot'),
          'ok',
        );
        check(
          /Skipped[^\n]*forms|forms[^\n]*skipped/i.test(snap.markdown),
          scope,
          'snapshot does not list forms under Skipped',
        );
        check(
          !/Booking\.booking@/.test(snap.markdown),
          scope,
          'snapshot still shows the booking form',
        );
      }
      if (variant.config.inspectors?.router === false) {
        const waitFor = tools.find((tool) => short(tool.name) === 'wait-for');
        const conditions = waitFor?.inputSchema?.properties?.condition?.enum ?? [];
        check(
          !conditions.includes('navigation') && !conditions.includes('http-call'),
          scope,
          `wait-for still offers ${conditions.join(', ')}`,
        );
        const clear = tools.find((tool) => short(tool.name) === 'clear-recordings');
        const targets = clear?.inputSchema?.properties?.target?.enum ?? [];
        if (targets.includes('router') || targets.includes('http')) {
          warning(
            scope,
            `clear-recordings still lists the targets ${targets.join(', ')} with the http and router inspectors off`,
          );
        }
        for (const target of ['http', 'router']) {
          const record = await callTool(
            client,
            `variant:${variant.label}`,
            'pangular_clear-recordings',
            { target },
            'blocked-target',
          );
          checkAnswer(record, clear, 'refusal');
          if (!record.protocolError && /^Cleared/m.test(record.markdown))
            recordFailure(record, `cleared ${target} with its inspector off`);
        }
      }
      if (variant.config.actions?.router === false) {
        check(!names.has('navigate'), scope, 'navigate is still listed with actions.router off');
        check(
          !names.has('probe-route'),
          scope,
          'probe-route is still listed with actions.router off',
        );
        check(
          names.has('record-guards'),
          scope,
          'record-guards should stay with actions.router off',
        );
        const before = new URL(page.url()).pathname;
        const record = await callTool(
          client,
          `variant:${variant.label}`,
          'pangular_navigate',
          { action: 'go', url: '/about' },
          'hidden-tool',
        );
        if (!record.protocolError && !record.isError)
          recordFailure(record, 'navigate ran with actions.router off');
        await sleep(800);
        check(
          new URL(page.url()).pathname === before,
          scope,
          `navigate moved the page to ${new URL(page.url()).pathname}`,
        );
        const instrument = await callTool(
          client,
          `variant:${variant.label}`,
          'pangular_record-guards',
          { on: true },
          'kept-tool',
        );
        checkAnswer(
          instrument,
          tools.find((tool) => short(tool.name) === 'record-guards'),
          'ok',
        );
      }
      for (const leak of result.leaks) failure(scope, `still offers ${leak}`);
      for (const name of result.missing)
        failure(scope, `${name} is missing though the config keeps it`);
    } catch (error) {
      failure(`variant ${variant.label}`, `crashed: ${error.stack ?? error}`);
    } finally {
      await client?.close().catch(() => undefined);
      await context?.close().catch(() => undefined);
      await server?.stop();
    }
    port++;
  }
}

// ---------------------------------------------------------------------------
// Docs: tools.md against the live tool list.

function runDocs(state) {
  const docsDir = join(ROOT, 'apps/docs/src/content');
  // The table of names before 1.0 lists names that are gone on purpose.
  const toolsMd = readFileSync(join(docsDir, 'agents/tools.md'), 'utf8').split(
    /^## Names before 1\.0$/m,
  )[0];
  const serverMd = readFileSync(join(docsDir, 'agents/mcp-server.md'), 'utf8');
  const configMd = readFileSync(join(docsDir, 'getting-started/configuration.md'), 'utf8');
  const live = [...state.tools.keys()].filter(
    (name) => !name.startsWith('plugin_') && !name.startsWith('devframe'),
  );
  const docs = report.docs;
  const mentioned = new Set([
    ...[...toolsMd.matchAll(/`([a-z][a-z0-9-]+)`/g)].map((m) => m[1]),
    ...[...toolsMd.matchAll(/^#+ ([a-z][a-z0-9-]+)\b/gm)].map((m) => m[1]),
  ]);
  docs.undocumentedTools = live.filter((name) => !mentioned.has(name));
  // Tool names in table first cells and ### headings.
  const documented = new Set();
  for (const m of toolsMd.matchAll(/^### ([a-z][a-z0-9-]+)\b/gm)) documented.add(m[1]);
  for (const m of toolsMd.matchAll(/^\| `([a-z][a-z0-9-]+)`\s+\|/gm)) documented.add(m[1]);
  const notTools = new Set([
    'page',
    'components',
    'route',
    'navigations',
    'http',
    'errors',
    'console',
    'forms',
    'signals',
    'stores',
    'queries',
    'sections',
    'limit',
    'maxChars',
    'tab',
    'id',
    'condition',
    'selector',
    'after',
    'go',
    'view',
    'waterfall',
    'list',
    'explain',
    'repro',
    'resolvelazy',
    'url',
    'code',
    'timeoutMs',
    'component',
    'navigation',
    'http-call',
    'error',
    'component-gone',
    'rule',
    'file',
    'severity',
    'template-parse-error',
    'track-by-index',
    'img-missing-alt',
    'click-without-key',
    'legacy-control-flow',
    'ngclass-ngstyle',
    'record',
    'export',
    'flash',
    'track',
    'angularprofiling',
    'property',
    'signal',
    'value',
    'path',
    'depth',
    'filter',
    'directivehosts',
    'node',
    'history',
    'framework',
    'resources',
    'environments',
    'changes',
    'nodecount',
    'unnamedsignals',
    'watch',
    'stack',
    'stacks',
    'token',
    'injector',
    'self',
    'skipself',
    'host',
    'optional',
    'since',
    'seq',
    'session',
    'from',
    'to',
    'store',
    'match',
    'audit',
    'action',
    'type',
    'payload',
    'latest',
    'key',
    'navigate',
    'abort',
    'replay',
    'stable',
    'name',
    'kind',
    'render-error',
    'client-render',
    'state-edit',
    'target',
    'axe',
    'area',
    'method',
    'body',
    'confirm',
    'read',
    'action',
    'destructive',
    'form',
    'level',
    'search',
    'status',
    'plugin',
    'failed',
    'slowms',
    'format',
    'until',
    'mode',
    'values',
    'submit',
    'snapshot',
    'force',
    '$index',
    'pattern',
    'enabled',
    'message',
    'delayms',
    'headers',
    'preview',
    'perf',
    'on',
    'waitfor',
    'params',
    'replaceurl',
    'skiplocationchange',
  ]);
  // Library tools are documented but not listed for the demo, which uses none of the libraries.
  docs.phantomTools = [...documented].filter(
    (name) =>
      !state.tools.has(name) && !notTools.has(name.toLowerCase()) && !LIBRARY_TOOL.test(name),
  );
  // Argument names: the `| Argument |` table under each `### tool` heading, and
  // the last cell of `| Tool | ... | Arguments |` tables.
  const argDrift = [];
  const argsIn = (cell) =>
    [...cell.replace(/\([^)]*\)/g, '').matchAll(/`([A-Za-z]+)`/g)].map((m) => m[1]);
  const compare = (name, docArgs, where) => {
    const tool = state.tools.get(name);
    if (!tool) return;
    const schema = tool.inputSchema?.properties ?? {};
    const enumValues = new Set(
      Object.values(schema)
        .flatMap((prop) => prop.enum ?? [])
        .map(String),
    );
    const notInSchema = docArgs.filter((arg) => !(arg in schema) && !enumValues.has(arg));
    const missingInDocs = Object.keys(schema).filter(
      (arg) => !docArgs.includes(arg) && arg !== 'page',
    );
    if (notInSchema.length || missingInDocs.length)
      argDrift.push({ tool: name, where, missingInDocs, notInSchema });
  };
  const tables = [];
  let heading = '';
  let current;
  for (const line of toolsMd.split('\n')) {
    const h = line.match(/^###? (.+)/);
    if (h) heading = h[1].replace(/<[^>]+>/g, '').trim();
    if (line.startsWith('|')) {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (!current) {
        current = { heading, header: cells, rows: [] };
        tables.push(current);
      } else if (!/^-+$/.test(cells[0].replace(/[: ]/g, ''))) current.rows.push(cells);
    } else current = undefined;
  }
  const perTool = new Map();
  for (const table of tables) {
    if (table.header[0] === 'Argument') {
      const name = table.heading.match(/^([a-z][a-z0-9-]+)$/)?.[1];
      if (name)
        perTool.set(name, [
          ...(perTool.get(name) ?? []),
          ...table.rows.map((row) => argsIn(row[0])[0]).filter(Boolean),
        ]);
    }
    if (table.header[0] === 'Tool' && /^Arguments?$/.test(table.header.at(-1))) {
      for (const row of table.rows) {
        const name = row[0].match(/^`([a-z][a-z0-9-]+)`$/)?.[1];
        const cell = row.at(-1);
        if (name && cell && !/^none$/i.test(cell))
          perTool.set(name, [...(perTool.get(name) ?? []), ...argsIn(cell)]);
        else if (name && /^none$/i.test(cell)) perTool.set(name, perTool.get(name) ?? []);
      }
    }
  }
  for (const [name, docArgs] of perTool) compare(name, [...new Set(docArgs)], 'tools.md');
  docs.argumentDrift = argDrift;
  // The counts the docs state.
  const builtIns = live.length + 1; // devframe_state_read is listed too, under Shared state
  docs.statedToolCount = toolsMd.match(/^\s*([A-Z][a-z-]+) tools, grouped/m)?.[1];
  docs.liveBuiltInTools = live.length;
  docs.liveTotalTools = state.tools.size;
  const actionLive = [...state.tools.values()]
    .filter((tool) => tool.annotations?.readOnlyHint !== true)
    .map((tool) => short(tool.name));
  docs.liveActionTools = actionLive;
  const tierTable = [...serverMd.matchAll(/^\| `([a-z-]+)`\s+\| `(action|destructive)`/gm)].map(
    (m) => ({ name: m[1], tier: m[2] }),
  );
  docs.tierTableMissing = actionLive.filter(
    (name) => !name.startsWith('plugin_') && !tierTable.some((row) => row.name === name),
  );
  docs.tierTableExtra = tierTable
    .filter((row) => !actionLive.includes(row.name) && !LIBRARY_TOOL.test(row.name))
    .map((row) => row.name);
  for (const row of tierTable) {
    const tool = state.tools.get(row.name);
    if (tool && (row.tier === 'destructive') !== (tool.annotations?.destructiveHint === true)) {
      docs.tierMismatch = [
        ...(docs.tierMismatch ?? []),
        `${row.name}: docs ${row.tier}, destructiveHint ${tool.annotations?.destructiveHint}`,
      ];
    }
  }
  const readOnlyRow = configMd.match(/\| `agent\.readOnly`[^\n]*/)?.[0] ?? '';
  const readOnlyListed = [...readOnlyRow.matchAll(/`([a-z][a-z-]+)`/g)]
    .map((m) => m[1])
    .filter((name) => state.tools.has(name));
  const readOnlyVariant = report.variants.find((variant) => variant.config.agent?.readOnly);
  docs.configReadOnlyList = readOnlyListed;
  docs.configReadOnlyListMissing = actionLive.filter(
    (name) =>
      !['audit'].includes(name) && !name.startsWith('plugin_') && !readOnlyListed.includes(name),
  );
  docs.builtInsCountedAs = builtIns;
  for (const name of docs.undocumentedTools)
    failure('docs tools.md', `${name} is a live tool but tools.md never names it`);
  for (const name of docs.phantomTools)
    failure('docs tools.md', `${name} is documented as a tool but is not in tools/list`);
  for (const drift of argDrift) warning('docs tools.md', `${drift.tool}: arguments drift`, drift);
  for (const name of docs.tierTableMissing)
    failure('docs mcp-server.md', `${name} acts but is not in the tier table`);
  for (const name of docs.tierTableExtra)
    failure('docs mcp-server.md', `${name} is in the tier table but is read-only`);
  for (const name of docs.configReadOnlyListMissing)
    failure(
      'docs configuration.md',
      `agent.readOnly drops ${name}, but the agent.readOnly row does not list it`,
    );
  if (readOnlyVariant) docs.readOnlyVariantTools = readOnlyVariant.tools;
}

// ---------------------------------------------------------------------------
// Main

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.serveVariant) {
    await serveVariant(opts.serveVariant, opts.port);
    return;
  }
  verbose = opts.verbose;
  const started = Date.now();
  report.options = {
    port: opts.port,
    build: opts.build,
    only: [...opts.only],
    report: opts.report,
  };
  mkdirSync(dirname(opts.report), { recursive: true });

  if (opts.build) {
    run('pnpm', ['devtools:build-pkg']);
    run('pnpm', ['build', '--configuration', 'development']);
  }
  for (const file of [SERVER_ENTRY, join(BROWSER_DIST, 'index.csr.html')]) {
    if (!existsSync(file)) throw new Error(`${file} is missing. Run without --skip-build.`);
  }

  const sdk = await loadSdk();
  const config = await import('@pangular-inspector/devtools/internal/config');
  const state = { stoppers: [] };
  const needsBrowser = ['http', 'actions', 'negative', 'variants', 'docs'].some((phase) =>
    opts.only.has(phase),
  );
  const browser = needsBrowser ? await loadChromium(opts.chrome) : undefined;
  const phase = async (name, fn) => {
    const t0 = Date.now();
    log(`phase ${name}`);
    try {
      await fn();
    } catch (error) {
      failure(`phase ${name}`, `crashed: ${error.stack ?? error}`);
    }
    report.counts[`${name}Ms`] = Date.now() - t0;
  };
  try {
    const wantHttp = ['http', 'actions', 'negative', 'docs', 'variants'].some((name) =>
      opts.only.has(name),
    );
    if (wantHttp) await phase('http', () => runHttp(opts, sdk, browser, state));
    if (state.tools && opts.only.has('actions')) await phase('actions', () => runActions(state));
    if (state.tools && opts.only.has('negative')) {
      await phase('negative', async () => {
        // On a page with forms, so the forms tools reach their own argument checks.
        await state.app.go('/examples/forms');
        await state.ctx.refresh('/examples/forms');
        await runNegative(state.client, 'http', [...state.tools.values()], state);
      });
    }
    if (state.pageErrors?.length) report.pageErrors = state.pageErrors;
    await state.client?.close().catch(() => undefined);
    await state.context?.close().catch(() => undefined);
    for (const stop of state.stoppers.splice(0)) await stop();
    if (opts.only.has('stdio')) await phase('stdio', () => runStdio(sdk, state, config));
    if (state.tools && opts.only.has('variants'))
      await phase('variants', () => runVariants(opts, sdk, browser, config, state));
    if (state.tools && opts.only.has('docs')) await phase('docs', () => runDocs(state));
  } finally {
    for (const stop of state.stoppers) await stop().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }

  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.now() - started;
  report.counts.calls = report.calls.length;
  report.counts.toolsCalled = new Set(
    report.calls.map((call) => `${call.transport}:${call.tool}`),
  ).size;
  report.counts.failures = report.failures.length;
  report.counts.warnings = report.warnings.length;
  report.counts.resourcesRead = report.resources.length;
  report.counts.promptsGot = report.prompts.length;
  for (const call of report.calls) {
    call.snapshot = (call.markdown ?? '').slice(0, call.failures.length ? 6000 : 2500);
    delete call.text;
    delete call.markdown;
  }
  writeFileSync(opts.report, JSON.stringify(report, null, 2));
  log(
    `${report.counts.calls} calls, ${report.counts.failures} failures, ${report.counts.warnings} warnings in ${Math.round(report.durationMs / 1000)}s. Report: ${opts.report}`,
  );
  process.exitCode = report.failures.length ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
