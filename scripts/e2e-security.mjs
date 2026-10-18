#!/usr/bin/env node
// Security and redaction end-to-end check.
//
// Leak corpus: serves e2e/security (an Angular app that plants a unique canary
// in every place a collector reads) with the Vite plugin, opens it and the
// panel in Chromium, then collects every output channel and greps it for each
// canary: page -> server frames, panel frames and console, every MCP tool and
// resource, the WebMCP page tools, the static report, and the server log.
// It also checks that the documented escape hatches unmask what they promise,
// and that write-back tools refuse secret fields.
//
// Access: the request gate, the one-time code and the MCP token (Vite plugin,
// Express hub and CLI), action and readOnly gating, and a production build.
//
// Usage: pnpm e2e:security [--only leak|access|prod] [--keep] [--verbose]
// E2E_SECURITY_PORT_BASE moves the 7 ports it listens on (default 5231-5237).
// Needs a built package (pnpm devtools:build-pkg) and Playwright's Chromium.
import { createRequire } from 'node:module';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { request as httpRequest } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const FIXTURE = join(ROOT, 'e2e/security');
const DIST = join(ROOT, 'packages/devtools/dist');
const OUT = join(ROOT, 'dist/e2e-security');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined;
const verbose = args.includes('--verbose');
const PORT_BASE = Number(process.env.E2E_SECURITY_PORT_BASE) || 5231;
const PORTS = {
  vite: PORT_BASE,
  viteAuth: PORT_BASE + 1,
  hub: PORT_BASE + 2,
  cli: PORT_BASE + 3,
  prod: PORT_BASE + 4,
  viteRo: PORT_BASE + 5,
  viteHosts: PORT_BASE + 6,
};

if (!existsSync(join(DIST, 'vite.mjs'))) {
  console.error('Build the package first: pnpm devtools:build-pkg');
  process.exit(1);
}

const { C } = await import(join(FIXTURE, 'canaries.ts'));
const require = createRequire(import.meta.url);
const { chromium } = await import('playwright');
const { createServer } = await import('vite');
const angular = (await import('@analogjs/vite-plugin-angular')).default;
const pangular = (await import(join(DIST, 'vite.mjs'))).default;
// The MCP SDK is not a direct dependency; @angular/cli ships it.
const cliRequire = createRequire(require.resolve('@angular/cli/package.json'));
const { Client } = await import(cliRequire.resolve('@modelcontextprotocol/sdk/client/index.js'));
const { StreamableHTTPClientTransport } = await import(
  cliRequire.resolve('@modelcontextprotocol/sdk/client/streamableHttp.js')
);

// devframe from the package's own dependencies: the same module instance the
// built plugin loads, so `getTempAuthCode()` reads the fixture's code.
const devframeRequire = createRequire(join(ROOT, 'packages/devtools/package.json'));
const { connectDevframe } = await import(
  pathToFileURL(devframeRequire.resolve('devframe/client')).href
);
const { getTempAuthCode } = await import(
  pathToFileURL(devframeRequire.resolve('devframe/node/auth')).href
);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Results

const findings = [];
const notes = [];
const checks = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
}

/** Channel name -> captured text, written to OUT for inspection. */
const channels = new Map();

function capture(channel, text) {
  const value = typeof text === 'string' ? text : JSON.stringify(text);
  channels.set(channel, (channels.get(channel) ?? '') + value + '\n');
}

// ---------------------------------------------------------------------------
// Server log tee

// Everything the servers print goes to the `server log` channel; the harness
// prints through `log`, which bypasses it.
const serverLog = [];
const stdoutWrite = process.stdout.write.bind(process.stdout);
for (const stream of [process.stdout, process.stderr]) {
  const write = stream.write.bind(stream);
  stream.write = (chunk, ...rest) => {
    serverLog.push(String(chunk));
    return verbose ? write(chunk, ...rest) : true;
  };
}

function log(text = '') {
  stdoutWrite(`${text}\n`);
}

// ---------------------------------------------------------------------------
// The fixture server

function transferState() {
  return {
    1234567: {
      b: { refresh_token: C.tsBodyRefresh.value, note: C.tsJwt.value, items: [1, 2] },
      h: { authorization: [C.tsHdrBearer.value], 'set-cookie': [`sid=${C.tsSetCookie.value}`] },
      s: 200,
      st: 'OK',
      u: `/svc/cached?token=${C.tsUrlToken.value}`,
      rt: 'json',
    },
    'custom-key': { user: 'ada', password: C.tsCustomPw.value },
  };
}

/** The demo API, the TransferState script and the window mask lists. */
function corpusPlugin() {
  const json = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
  };
  return {
    name: 'leak-corpus',
    transformIndexHtml: () => [
      {
        tag: 'script',
        attrs: { id: 'ng-state', type: 'application/json' },
        children: JSON.stringify(transferState()),
        injectTo: 'body',
      },
      {
        tag: 'script',
        children: `window.__PANGULAR_FORMS__ = ${JSON.stringify({ mask: ['iban2'], unmask: ['recoveryKey'] })};`,
        injectTo: 'head-prepend',
      },
    ],
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://x');
        if (url.pathname === '/svc/profile') {
          return json(
            res,
            200,
            {
              user: 'ada',
              access_token: C.httpRespAccess.value,
              password: C.httpRespPw.value,
              note: C.httpRespJwt.value,
            },
            {
              'set-cookie': `sid=${C.httpRespSetCookie.value}; Path=/; HttpOnly`,
              'x-refresh-token': C.httpRespHdrToken.value,
            },
          );
        }
        if (url.pathname === '/svc/login') {
          return json(res, 401, { error: 'invalid', detail: `token ${C.http401Jwt.value}` });
        }
        if (url.pathname === '/svc/basic') return json(res, 200, { ok: true });
        if (url.pathname === '/svc/form') return json(res, 200, { ok: true });
        if (url.pathname === '/svc/xml') {
          res.writeHead(200, { 'content-type': 'application/xml' });
          return res.end(
            `<login><user>ada</user><password>${C.httpXmlResp.value}</password></login>`,
          );
        }
        if (url.pathname === '/svc/long') {
          return json(res, 200, { pad: 'p'.repeat(1990), token: C.httpLongResp.value });
        }
        if (url.pathname === '/svc/fail') return json(res, 500, { error: 'boom' });
        if (url.pathname === '/api/v1/secure') {
          return json(
            res,
            200,
            { access_token: C.anRespAccess.value, note: C.anRespJwt.value },
            { 'set-cookie': `asid=${C.anSetCookie.value}; Path=/` },
          );
        }
        if (url.pathname === '/api/v1/login') return json(res, 200, { ok: true });
        next();
      });
    },
  };
}

const QUERY_CORE = join(ROOT, 'packages/devtools/node_modules/@tanstack/query-core');

/**
 * `virtual:devtools-stop`: empty, or (`staticImport`) the static import of
 * `disposeOverlay` from the `/overlay` entry that an earlier version of the
 * docs showed, for the production run that checks it starts nothing.
 */
function stopImportPlugin(staticImport = false) {
  const id = 'virtual:devtools-stop';
  return {
    name: 'e2e-devtools-stop',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load: (source) =>
      source === `\0${id}`
        ? staticImport
          ? "import { disposeOverlay } from '@pangular-inspector/devtools/overlay';\nglobalThis.__stopDevtools = disposeOverlay;"
          : 'export {};'
        : undefined,
  };
}

async function startFixture(port, options, host = '127.0.0.1', serverOptions = {}) {
  const server = await createServer({
    configFile: false,
    root: FIXTURE,
    logLevel: 'info',
    server: { port, strictPort: true, host, forwardConsole: false, ...serverOptions },
    resolve: {
      alias: {
        '@pangular-inspector/devtools/overlay': join(DIST, 'overlay.mjs'),
        '@pangular-inspector/devtools/http': join(DIST, 'http.mjs'),
        '@tanstack/query-core': QUERY_CORE,
      },
    },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [
      stopImportPlugin(),
      angular({ tsconfig: join(FIXTURE, 'tsconfig.json') }),
      pangular({ redaction: { secretNames: ['zorblax'], unmask: ['legacyPin'] }, ...options }),
      corpusPlugin(),
    ],
  });
  await server.listen();
  return { server, origin: `http://127.0.0.1:${port}`, close: () => server.close() };
}

// ---------------------------------------------------------------------------
// MCP

const HUB = '/__devframes/';

async function mcpConnect(origin, { token, originHeader = origin, path = `${HUB}__mcp` } = {}) {
  const headers = {};
  if (originHeader) headers.Origin = originHeader;
  if (token) headers.Authorization = `Bearer ${token}`;
  const transport = new StreamableHTTPClientTransport(new URL(path, origin), {
    requestInit: { headers },
  });
  const client = new Client({ name: 'e2e-security', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

function textOf(result) {
  return JSON.stringify(result);
}

/** Arguments for a tool from its input schema: required keys only, from hints or a filler. */
function synth(schema, hints) {
  const out = {};
  const props = schema?.properties ?? {};
  for (const key of schema?.required ?? []) {
    const prop = props[key] ?? {};
    if (key in hints) out[key] = hints[key];
    else if (Array.isArray(prop.enum)) out[key] = prop.enum[0];
    else if (prop.type === 'number' || prop.type === 'integer') out[key] = prop.minimum ?? 1;
    else if (prop.type === 'boolean') out[key] = false;
    else if (prop.type === 'array') out[key] = [];
    else if (prop.type === 'object') out[key] = {};
    else out[key] = 'x';
  }
  if ('page' in props && hints.page) out.page = hints.page;
  return out;
}

async function callTool(client, name, args, channel = `mcp tool ${name}`) {
  try {
    const result = await client.callTool({ name, arguments: args });
    capture(channel, result);
    return { ok: !result.isError, text: textOf(result), result };
  } catch (error) {
    capture(channel, String(error?.message ?? error));
    return { ok: false, text: String(error?.message ?? error) };
  }
}

// ---------------------------------------------------------------------------
// Leak corpus

function tapPage(page, label) {
  page.on('websocket', (ws) => {
    ws.on('framesent', (f) => capture(`${label} ws sent`, String(f.payload)));
    ws.on('framereceived', (f) => capture(`${label} ws received`, String(f.payload)));
  });
  page.on('request', (req) => {
    if (req.url().includes(HUB)) {
      capture(`${label} http request`, `${req.method()} ${req.url()} ${req.postData() ?? ''}`);
    }
  });
  page.on('response', async (res) => {
    if (!res.url().includes(HUB)) return;
    const type = res.headers()['content-type'] ?? '';
    if (!/json|text\/plain|event-stream|javascript|html/.test(type)) return;
    try {
      capture(`${label} http response`, `${res.url()} ${await res.text()}`);
    } catch {
      /* streamed */
    }
  });
  page.on('console', (m) => capture(`${label} browser console`, `${m.type()} ${m.text()}`));
  page.on('pageerror', (e) => capture(`${label} browser console`, `pageerror ${e.message}`));
}

/** Ground truth from the page itself: the values the write-back probes must not change. */
async function appValues(app) {
  return app.evaluate(() => {
    const ng = window.ng;
    const card = ng.getComponent(document.querySelector('app-secret-card'));
    const reactive = ng.getComponent(document.querySelector('app-reactive-secrets'));
    const signalForm = ng.getComponent(document.querySelector('app-signal-secrets'));
    const template = ng.getComponent(document.querySelector('app-template-secrets'));
    return {
      rfPassword: reactive.group.value.password,
      rfApiKey: reactive.group.value.apiKey,
      rfRecovery: reactive.group.value.recoveryKey,
      rfUsername: reactive.group.value.username,
      rfApiSecret: reactive.group.value.apiSecret,
      sfPassword: signalForm.model().password,
      tdToken: template.model.token,
      authToken: card.authToken(),
      profile: JSON.stringify(card.profile()),
      refresh: card.refresh_token,
      vault: JSON.stringify([...card.vault]),
      zorblax: card.zorblaxCode,
    };
  });
}

async function leakRun() {
  const fixture = await startFixture(PORTS.vite, {
    auth: false,
    agent: { browserTools: true },
  });
  // The app and the panel get a window each, so neither is a background tab.
  const appContext = await browser.newContext();
  // WebMCP: a stand-in `document.modelContext` that keeps every registered tool.
  await appContext.addInitScript(() => {
    const tools = new Map();
    window.__webmcpTools = tools;
    const modelContext = {
      registerTool(tool) {
        tools.set(tool.name, tool);
        return { unregister: () => tools.delete(tool.name) };
      },
      unregisterTool(name) {
        tools.delete(name);
      },
    };
    Object.defineProperty(document, 'modelContext', { value: modelContext, configurable: true });
  });
  const app = await appContext.newPage();
  tapPage(app, 'app page');
  await app.goto(`${fixture.origin}/`);
  await app.waitForSelector('app-reset', { timeout: 30_000 });
  await delay(5000);
  await app.evaluate(() => window.__corpusLate());
  await delay(5000);

  // The panel: open it, visit every tab and select what can be selected.
  const panelContext = await browser.newContext();
  const panel = await panelContext.newPage();
  tapPage(panel, 'panel');
  await panel.goto(`${fixture.origin}${HUB}pangular/`);
  await delay(4000);
  const tabs = panel.locator('.tab-bar button, .tab-bar a');
  const count = await tabs.count();
  const tabNames = [];
  for (let i = 0; i < count; i++) {
    const tab = tabs.nth(i);
    tabNames.push((await tab.innerText().catch(() => '')).trim() || `#${i}`);
    await tab.click().catch(() => undefined);
    await delay(1500);
    const items = panel.locator('main [role=treeitem], main [role=option], main [role=tab]');
    const n = Math.min(await items.count(), 40);
    for (let j = 0; j < n; j++) {
      await items
        .nth(j)
        .click({ timeout: 1000 })
        .catch(() => undefined);
      await delay(300);
      capture(
        'panel rendered text',
        await panel
          .locator('main')
          .innerText()
          .catch(() => ''),
      );
    }
    capture(
      'panel rendered text',
      await panel
        .locator('main')
        .innerText()
        .catch(() => ''),
    );
  }
  notes.push(`Panel tabs visited: ${tabNames.join(', ') || 'none found'}`);

  // MCP: every tool, resource and prompt.
  const client = await mcpConnect(fixture.origin);
  const { tools } = await client.listTools();
  writeFileSync(join(OUT, 'mcp-tools.json'), JSON.stringify(tools, null, 2));
  const names = new Set(tools.map((t) => t.name));
  const tool = (short) => (names.has(`pangular_${short}`) ? `pangular_${short}` : short);
  const pages = await callTool(client, tool('list-pages'), {});
  const pageId = pages.text.match(/\| `([0-9a-f]{6,})` \|/)?.[1];
  notes.push(`MCP: ${tools.length} tools; page id ${pageId ?? 'not found'}`);
  const hints = { page: pageId };
  const isAction = (t) => t.annotations?.readOnlyHint === false || t.annotations?.destructiveHint;
  for (const t of tools) {
    if (!isAction(t)) await callTool(client, t.name, synth(t.inputSchema, hints));
  }

  // Targeted reads, with the ids the generic pass cannot guess.
  const page = pageId;
  const forms = [
    `ReactiveSecrets.group@${page}`,
    `TemplateSecrets.ngForm@${page}`,
    `SignalSecrets.login@${page}`,
  ];
  const selectors = [
    'app-root',
    'app-secret-card',
    'app-reactive-secrets',
    'app-template-secrets',
    'app-signal-secrets',
    'app-reset',
    'app-account',
  ];
  const reads = [];
  for (const selector of selectors) {
    reads.push(['inspect-component', { selector, depth: 6, limit: 500, page }]);
    reads.push(['inspect-signals', { selector, history: true, framework: true, page }]);
    reads.push(['inspect-providers', { selector, page }]);
    reads.push(['inspect-route', { selector, page }]);
  }
  for (const path of [
    'config',
    'config.items',
    'vault',
    'tokens',
    'profile',
    'draft',
    'api',
    'session',
    'creds',
    'model',
    'group',
    'login',
    'route',
  ]) {
    reads.push(['inspect-component', { component: 'app-secret-card', path, depth: 6, page }]);
    reads.push(['inspect-component', { component: 'app-reactive-secrets', path, depth: 6, page }]);
    reads.push(['inspect-component', { component: 'app-template-secrets', path, depth: 6, page }]);
    reads.push(['inspect-component', { component: 'app-signal-secrets', path, depth: 6, page }]);
  }
  for (const token of [
    'API_CONFIG',
    'SessionService',
    'AuthStore',
    'Store',
    'TransferState',
    'ActivatedRoute',
    'Router',
    'HttpClient',
    'StoreDevtools',
    'ReducerManager',
    'State',
    'ActionsSubject',
  ]) {
    reads.push(['read-provider-value', { token, depth: 6, limit: 500, page }]);
    reads.push(['explain-injection', { injector: 'app-secret-card', token, page }]);
  }
  for (const path of ['endpoint', 'apiKey', 'clientSecret', 'note']) {
    reads.push(['read-provider-value', { token: 'API_CONFIG', path, page }]);
  }
  for (const form of forms) {
    reads.push(['inspect-forms', { form, includeValues: true, page }]);
    reads.push(['explain-invalid-forms', { form, page }]);
    reads.push(['explain-submit', { form, page }]);
    reads.push(['inspect-form-payload', { form, page }]);
    reads.push(['list-form-changes', { form, limit: 200, page }]);
    reads.push(['explain-form-changes', { form, page }]);
    reads.push(['lint-forms', { form, page }]);
    reads.push(['explain-custom-control', { form, page }]);
    for (const format of ['json', 'markdown', 'typescript', 'test', 'har', 'csv']) {
      reads.push(['export-form', { form, format, page }]);
    }
    for (const path of [
      'password',
      'token',
      'apiKey',
      'notes',
      'credentials',
      'credentials.value',
      'nick',
      'note',
      'recoveryKey',
      'legacyPin',
      'holder',
      'zorblax',
      'mfaCode',
      'refresh_token',
      'authorization',
      'secret',
      'iban2',
      'oneTime',
      'nickname',
      'comment',
      'blob',
    ]) {
      reads.push(['explain-field', { form, path, page }]);
      reads.push(['inspect-form-payload', { form, path, page }]);
      reads.push(['list-form-changes', { form, path, page }]);
    }
  }
  for (const name of ['authHeader', 'json', 'slice', 'async'])
    reads.push(['explain-pipe', { name, page }]);
  for (const key of ['1234567', 'custom-key'])
    reads.push(['inspect-transfer-state', { key, page }]);
  reads.push(['inspect-transfer-state', { search: 'token', page }]);
  reads.push(['list-http-calls', { preview: true, headers: true, limit: 200, page }]);
  reads.push(['list-http-calls', { failed: true, preview: true, headers: true, page }]);
  reads.push(['list-http-calls', { view: 'waterfall', headers: true, limit: 50, page }]);
  for (const id of [1, 2, 3, 4, 5, 6, 7, 8])
    reads.push(['explain-ssr-request', { id: String(id) }]);
  reads.push(['explain-navigation', { limit: 50, perf: true, page }]);
  for (const id of [1, 2, 3, 4]) {
    reads.push(['explain-navigation', { id, page }]);
    reads.push(['explain-navigation', { format: 'repro', id, page }]);
  }
  reads.push(['scan-render-mode', { url: '/acct/reset/x', page }]);
  reads.push(['list-routes', { page, audit: true }]);
  reads.push(['router-config', { page }]);
  for (const seq of [0, 1, 2, 3, 4, 5]) reads.push(['ngrx-inspect-entry', { seq, page }]);
  reads.push(['ngrx-export-session', { page }]);
  reads.push(['ngrx-generate-test', { page }]);
  reads.push(['ngrx-inspect-store', { page }]);
  reads.push(['ngrx-history', { page }]);
  reads.push(['list-console', { limit: 200, page }]);
  for (const level of ['log', 'info', 'warn', 'error', 'debug'])
    reads.push(['list-console', { level, page }]);
  reads.push(['list-errors', { limit: 200, page }]);
  for (const id of ['e1', 'e2', 'e3', 'e4']) reads.push(['explain-error', { id, page }]);
  reads.push(['analog-list-server-calls', { limit: 200 }]);
  reads.push(['analog-inspect-page', { page }]);
  reads.push(['analog-scan-url', { url: '/acct/reset/abc?token=zzz' }]);
  reads.push(['snapshot', { page, maxChars: 200000, limit: 500 }]);
  reads.push(['startup-timing', { page, limit: 200 }]);
  for (const path of [
    'long250',
    'long290',
    'long480',
    'long990',
    'deep',
    'keyed',
    'byJwt',
    'uniHolder',
    'header2',
    'openai',
    'пароль',
  ]) {
    reads.push(['inspect-component', { component: 'app-secret-card', path, depth: 8, page }]);
  }
  reads.push(['tanstack-list-queries', { page }]);
  reads.push(['tanstack-inspect-query', { page, id: 'q1' }]);
  reads.push(['tanstack-inspect-query', { page, id: 'q2' }]);
  reads.push(['tanstack-inspect-query', { page, id: 'q3' }]);
  reads.push(['tanstack-inspect-query', { page, id: 'm1' }]);
  reads.push(['tanstack-inspect-query', { page, id: 'm2' }]);
  reads.push(['find-leaks', { page, limit: 200 }]);
  for (const r of await client
    .listResources()
    .then((x) => x.resources)
    .catch(() => [])) {
    const key = decodeURIComponent(r.uri).match(/^devframe:\/\/state\/(.+)$/)?.[1];
    if (key) reads.push(['devframe_state_read', { key }]);
  }
  for (const [name, args] of reads) {
    const full = names.has(`pangular_${name}`) ? `pangular_${name}` : name;
    if (names.has(full)) await callTool(client, full, args);
    else notes.push(`MCP tool ${name} not registered`);
  }

  // Resources and templates.
  try {
    const { resources } = await client.listResources();
    for (const r of resources) {
      try {
        capture(`mcp resource ${r.uri}`, await client.readResource({ uri: r.uri }));
      } catch (error) {
        capture(`mcp resource ${r.uri}`, String(error));
      }
    }
    const { resourceTemplates } = await client
      .listResourceTemplates()
      .catch(() => ({ resourceTemplates: [] }));
    writeFileSync(
      join(OUT, 'mcp-resource-templates.json'),
      JSON.stringify(resourceTemplates, null, 2),
    );
    for (const t of resourceTemplates) {
      const uri = t.uriTemplate.replace(/\{[^}]+\}/g, page ?? 'x');
      try {
        capture(`mcp resource ${uri}`, await client.readResource({ uri }));
      } catch (error) {
        capture(`mcp resource ${uri}`, String(error));
      }
    }
    const prompts = await client.listPrompts().catch(() => ({ prompts: [] }));
    notes.push(
      `MCP: ${resources.length} resources, ${resourceTemplates.length} templates, ${prompts.prompts.length} prompts`,
    );
  } catch (error) {
    notes.push(`MCP resources failed: ${error}`);
  }

  // Actions that read back data: recordings, axe, the Analog playground.
  const actionReads = [
    ['record-pipes', { action: 'start', page }],
    ['track-subscriptions', { action: 'start', page }],
    ['record-change-detection', { record: 'start', page }],
    ['watch-signal', { watch: true, page }],
  ];
  for (const [name, args] of actionReads) await callTool(client, tool(name), args);
  await app.evaluate(() => window.__corpusLate());
  await delay(3000);
  const afterReads = [
    ['record-pipes', { action: 'stop', page }],
    ['explain-pipe', { name: 'authHeader', page }],
    ['explain-pipe', { name: 'json', page }],
    ['explain-pipe', { name: 'async', page }],
    ['track-subscriptions', { action: 'stop', page }],
    ['record-change-detection', { record: 'stop', page }],
    ['change-detection', { page, export: 'json' }],
    ['diagnose-change-detection', { page }],
    ['inspect-signals', { component: 'app-secret-card', history: true, page }],
    ['audit', { page, axe: true, limit: 500 }],
    ['hydration', { page }],
    [
      'analog-run-api',
      { path: `/api/v1/secure?token=${C.anUrlToken.value}`, method: 'GET', confirm: true },
    ],
    ['analog-list-server-calls', { limit: 200 }],
  ];
  for (const [name, args] of afterReads) await callTool(client, tool(name), args);
  // The Analog playground puts the URL token in its own arguments; keep that out of the grep.
  for (const [channel, text] of channels) {
    if (channel.includes('analog-run-api')) {
      channels.set(channel, text.split(C.anUrlToken.value).join('[arg]'));
    }
  }

  // Write-back: every tool must refuse to write a secret field or a value it masked.
  const before = await appValues(app);
  const probe = C.writeProbe.value;
  const reactive = forms[0];
  const writes = [
    [
      'run-form-action',
      { action: 'set-value', form: reactive, path: 'password', value: probe, confirm: true },
    ],
    [
      'run-form-action',
      { action: 'set-value', form: reactive, path: 'apiKey', value: probe, confirm: true },
    ],
    [
      'run-form-action',
      {
        action: 'set-value',
        form: reactive,
        path: 'credentials',
        value: { value: probe },
        confirm: true,
      },
    ],
    [
      'run-form-action',
      {
        action: 'set-value',
        form: reactive,
        value: { password: probe },
        confirm: true,
        force: true,
      },
    ],
    ['run-form-action', { action: 'reset', form: reactive, confirm: true }],
    [
      'run-form-action',
      { action: 'restore', form: reactive, snapshot: { password: probe }, confirm: true },
    ],
    [
      'fill-form',
      {
        form: reactive,
        values: { password: probe, apiKey: probe, username: 'grace' },
        confirm: true,
      },
    ],
    [
      'run-form-action',
      { action: 'set-value', form: reactive, path: 'apiSecret', value: probe, confirm: true },
    ],
    ['fill-form', { form: forms[2], values: { password: probe, token: probe }, confirm: true }],
    ['fill-form', { form: forms[1], values: { token: probe }, confirm: true }],
    ['set-signal', { component: 'app-secret-card', property: 'authToken', value: probe, page }],
    [
      'set-signal',
      {
        component: 'app-secret-card',
        property: 'profile',
        value: { name: 'x', secret: probe, mfaCode: probe },
        page,
      },
    ],
    [
      'set-component-property',
      { component: 'app-secret-card', property: 'refresh_token', value: probe, page },
    ],
    [
      'set-component-property',
      { component: 'app-secret-card', property: 'zorblaxCode', value: probe, page },
    ],
    [
      'set-component-property',
      { component: 'app-secret-card', property: 'vault', value: {}, page },
    ],
    [
      'set-component-property',
      { component: 'app-secret-card', property: 'config', value: { apiKey: probe }, page },
    ],
  ];
  const writeResults = [];
  for (const [name, args] of writes) {
    const result = await callTool(client, tool(name), args, `mcp write ${name}`);
    writeResults.push({
      name,
      args: { ...args, value: undefined, values: undefined },
      ok: result.ok,
      text: result.text.slice(0, 600),
    });
  }
  await delay(1500);
  const after = await appValues(app);
  writeFileSync(
    join(OUT, 'write-back.json'),
    JSON.stringify({ before, after, writeResults }, null, 2),
  );
  for (const [key, value] of Object.entries(after)) {
    if (key === 'rfRecovery' || key === 'rfUsername') continue;
    check(
      `write-back refused: ${key}`,
      !String(value).includes(probe),
      `${String(before[key]).slice(0, 40)} -> ${String(value).slice(0, 40)}`,
    );
  }
  check(
    'fill-form still writes a non-secret field (username)',
    after.rfUsername === 'grace',
    `username=${after.rfUsername}`,
  );
  // The documented escape hatch: a key unmasked on window can be written.
  const unmasked = await callTool(
    client,
    tool('run-form-action'),
    {
      action: 'set-value',
      form: reactive,
      path: 'recoveryKey',
      value: 'unmask-write-ok',
      confirm: true,
    },
    'mcp write run-form-action unmasked',
  );
  await delay(800);
  const recovery = (await appValues(app)).rfRecovery;
  check(
    'window unmask lets run-form-action write recoveryKey',
    recovery === 'unmask-write-ok',
    `${recovery}; ${unmasked.text.slice(0, 200)}`,
  );
  // The probe value is in our own write arguments only; anywhere else it is a leak.
  for (const [channel, text] of channels) {
    if (channel.startsWith('mcp write')) channels.set(channel, text.split(probe).join('[probe]'));
  }
  await client.close();

  // WebMCP page tools: every tool with no arguments, then a few with ids.
  const webmcp = await app.evaluate(async (page) => {
    const out = {};
    const extra = {
      'pangular_inspect-component': { component: 'app-secret-card', depth: 6 },
      'pangular_inspect-signals': { component: 'app-secret-card', history: true },
      'pangular_inspect-forms': { form: `ReactiveSecrets.group@${page}`, includeValues: true },
      'pangular_read-provider-value': { token: 'API_CONFIG', depth: 6 },
      'pangular_list-http-calls': { preview: true, headers: true },
      'pangular_list-form-changes': { form: `ReactiveSecrets.group@${page}`, limit: 200 },
    };
    for (const [name, t] of window.__webmcpTools) {
      for (const args of [{}, extra[name]].filter(Boolean)) {
        try {
          out[`${name} ${JSON.stringify(args)}`] = await t.execute(args);
        } catch (error) {
          out[`${name} ${JSON.stringify(args)}`] = String(error);
        }
      }
    }
    return out;
  }, page);
  for (const [name, result] of Object.entries(webmcp))
    capture(`webmcp tool ${name.split(' ')[0]}`, result);
  notes.push(
    `WebMCP: ${new Set(Object.keys(webmcp).map((k) => k.split(' ')[0])).size} page tools called`,
  );

  // Hub endpoints a browser can fetch: the connection file and the panel bundle.
  for (const path of [`${HUB}__connection.json`, `${HUB}pangular/__connection.json`]) {
    const res = await fetch(`${fixture.origin}${path}`).catch(() => null);
    if (res) capture(`hub http ${path}`, `${res.status} ${await res.text()}`);
  }

  await appContext.close();
  await panelContext.close();
  await fixture.close();
}

// ---------------------------------------------------------------------------
// Source scan: the static report and the stdio MCP server

function run(cmd, cmdArgs, { env = {}, timeout = 180_000 } = {}) {
  return new Promise((done) => {
    const child = spawn(cmd, cmdArgs, { cwd: ROOT, env: { ...process.env, ...env } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ code, out });
    });
  });
}

function filesUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...filesUnder(path));
    else out.push(path);
  }
  return out;
}

async function sourceScanRun() {
  const outDir = join(OUT, 'report');
  const build = await run(process.execPath, [
    join(ROOT, 'bin.mjs'),
    'build',
    '--root',
    FIXTURE,
    '--outDir',
    outDir,
  ]);
  capture('cli build log', build.out);
  check(
    'pangular build writes a static report',
    build.code === 0 && existsSync(outDir),
    `exit ${build.code}`,
  );
  if (existsSync(outDir)) {
    for (const file of filesUnder(outDir)) {
      if (/\.(json|js|html|txt|md)$/.test(file)) {
        capture(`static report ${relative(outDir, file)}`, readFileSync(file, 'utf8'));
      }
    }
  }

  // The stdio MCP server: every tool with generated arguments.
  const { StdioClientTransport } = await import(
    cliRequire.resolve('@modelcontextprotocol/sdk/client/stdio.js')
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(ROOT, 'bin.mjs'), 'mcp', '--root', FIXTURE],
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', (d) => (stderr += d));
  const client = new Client({ name: 'e2e-security', version: '1.0.0' });
  await client.connect(transport);
  const { tools } = await client.listTools();
  for (const t of tools) {
    await callTool(client, t.name, synth(t.inputSchema, {}), `stdio mcp tool ${t.name}`);
  }
  for (const r of (await client.listResources().catch(() => ({ resources: [] }))).resources) {
    capture(`stdio mcp resource ${r.uri}`, await client.readResource({ uri: r.uri }).catch(String));
  }
  notes.push(`stdio MCP: ${tools.length} tools`);
  await client.close();
  capture('stdio mcp stderr', stderr);
}

// ---------------------------------------------------------------------------
// Access: request gate, one-time code, MCP token

/** A raw HTTP request, so Host, Origin and Sec-Fetch-Site are exactly what we send. */
function raw(
  url,
  { method = 'GET', headers = {}, body, upgrade = false, readMs = 0, localAddress } = {},
) {
  const target = new URL(url);
  return new Promise((done) => {
    const req = httpRequest(
      {
        host: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        method,
        localAddress,
        setHost: false,
        headers: {
          Host: target.host,
          ...(upgrade
            ? {
                Connection: 'Upgrade',
                Upgrade: 'websocket',
                'Sec-WebSocket-Version': '13',
                'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        let text = '';
        res.on('data', (d) => (text += d));
        res.on('end', () => done({ status: res.statusCode, text }));
      },
    );
    req.on('upgrade', (res, socket) => {
      let text = '';
      socket.on('data', (d) => (text += d.toString('latin1')));
      setTimeout(() => {
        socket.destroy();
        done({ status: res.statusCode, text });
      }, readMs);
    });
    req.on('error', (error) => done({ status: 0, text: String(error) }));
    req.setTimeout(10_000, () => req.destroy(new Error('timeout')));
    if (body) req.write(body);
    req.end();
  });
}

const MCP_INIT = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'probe', version: '1' },
  },
});

function mcpPost(
  origin,
  { token, originHeader = origin, host, path = `${HUB}__mcp`, localAddress } = {},
) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (originHeader) headers.Origin = originHeader;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (host) headers.Host = host;
  return raw(`${origin}${path}`, { method: 'POST', headers, body: MCP_INIT, localAddress });
}

const EVIL = 'http://evil.example';

/** The request gate on HTTP, WebSocket and MCP, shared by the Vite plugin and the hub. */
async function gateChecks(
  label,
  origin,
  { mcpToken, mcpPath = `${HUB}__mcp`, panelPath = `${HUB}pangular/`, wsPath = `${HUB}__ws` },
) {
  const host = new URL(origin).host;
  const g = (name, ok, detail) => check(`${label}: ${name}`, ok, detail);
  const panel = await raw(`${origin}${panelPath}`);
  g('panel answers a plain local request', panel.status === 200, `status ${panel.status}`);
  const conn = await raw(`${origin}${panelPath}__connection.json`, { headers: { Origin: EVIL } });
  g('foreign Origin refused (connection file)', conn.status === 403, `status ${conn.status}`);
  const panelEvil = await raw(`${origin}${panelPath}`, { headers: { Origin: EVIL } });
  g('foreign Origin refused (panel)', panelEvil.status === 403, `status ${panelEvil.status}`);
  const rebind = await raw(`${origin}${panelPath}__connection.json`, {
    headers: { Host: 'evil.example' },
  });
  g('DNS rebinding Host refused', rebind.status === 403, `status ${rebind.status}`);
  const rebindIp = await raw(`${origin}${panelPath}__connection.json`, {
    headers: { Host: 'evil.example:80', Origin: 'http://evil.example:80' },
  });
  g(
    'DNS rebinding Host + matching Origin refused',
    rebindIp.status === 403,
    `status ${rebindIp.status}`,
  );
  const crossSite = await raw(`${origin}${panelPath}__connection.json`, {
    headers: { 'Sec-Fetch-Site': 'cross-site' },
  });
  g(
    'cross-site request without Origin refused',
    crossSite.status === 403,
    `status ${crossSite.status}`,
  );
  const nullOrigin = await raw(`${origin}${panelPath}__connection.json`, {
    headers: { Origin: 'null' },
  });
  g('Origin: null refused', nullOrigin.status === 403, `status ${nullOrigin.status}`);
  const otherExt = await raw(`${origin}${panelPath}__connection.json`, {
    headers: { Origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop' },
  });
  g('other extension origin refused', otherExt.status === 403, `status ${otherExt.status}`);
  const lookalike = await raw(`${origin}${panelPath}__connection.json`, {
    headers: { Origin: 'http://localhost.evil.example' },
  });
  g('localhost lookalike origin refused', lookalike.status === 403, `status ${lookalike.status}`);
  const wsEvil = await raw(`${origin}${wsPath}`, { upgrade: true, headers: { Origin: EVIL } });
  g(
    'WebSocket upgrade from foreign Origin refused',
    wsEvil.status !== 101,
    `status ${wsEvil.status}`,
  );
  const wsRebind = await raw(`${origin}${wsPath}`, {
    upgrade: true,
    headers: { Host: 'evil.example', Origin: 'http://evil.example' },
  });
  g(
    'WebSocket upgrade with rebinding Host refused',
    wsRebind.status !== 101,
    `status ${wsRebind.status}`,
  );
  // No token: the socket may open, but must carry no page data.
  const wsLocal = await raw(`${origin}${wsPath}`, {
    upgrade: true,
    headers: { Origin: origin },
    readMs: 2500,
  });
  capture(`${label} unauthenticated websocket`, wsLocal.text);
  const sse = await raw(`${origin}${HUB}__sse`, {
    headers: { Origin: origin, accept: 'text/event-stream' },
  }).catch(() => ({ status: 0, text: '' }));
  capture(`${label} unauthenticated sse`, `${sse.status} ${sse.text}`);

  if (mcpToken !== undefined) {
    const none = await mcpPost(origin, { path: mcpPath });
    g(
      'MCP without token refused',
      none.status === 401 || none.status === 403,
      `status ${none.status}`,
    );
    const wrong = await mcpPost(origin, { path: mcpPath, token: 'x'.repeat(32) });
    g(
      'MCP with a wrong token refused',
      wrong.status === 401 || wrong.status === 403,
      `status ${wrong.status}`,
    );
    const right = await mcpPost(origin, { path: mcpPath, token: mcpToken });
    g(
      'MCP with the token and a loopback Origin answers',
      right.status === 200,
      `status ${right.status}`,
    );
    capture(`${label} mcp authorized initialize`, right.text);
  }
  const token = mcpToken || undefined;
  const evil = await mcpPost(origin, { path: mcpPath, token, originHeader: EVIL });
  g(
    'MCP from a foreign Origin refused',
    evil.status === 403 || evil.status === 401,
    `status ${evil.status}`,
  );
  const noOrigin = await mcpPost(origin, { path: mcpPath, token, originHeader: null });
  g(
    'MCP without an Origin header refused (docs: 403)',
    noOrigin.status === 403,
    `status ${noOrigin.status}`,
  );
  const rebindMcp = await mcpPost(origin, {
    path: mcpPath,
    token,
    host: 'evil.example',
    originHeader: 'http://evil.example',
  });
  g(
    'MCP with rebinding Host refused',
    rebindMcp.status === 403 || rebindMcp.status === 401,
    `status ${rebindMcp.status}`,
  );
  const rebindMcp2 = await mcpPost(origin, { path: mcpPath, token, host: 'evil.example' });
  g(
    'MCP with rebinding Host and loopback Origin refused',
    rebindMcp2.status === 403 || rebindMcp2.status === 401,
    `status ${rebindMcp2.status}`,
  );
  return { host };
}

/** Requests from a non-loopback address of this machine. */
async function remoteChecks(label, port, paths) {
  const lan = Object.values((await import('node:os')).networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  if (!lan) {
    notes.push(`${label}: no non-loopback IPv4 address, remote-address check skipped`);
    return;
  }
  for (const path of paths) {
    const res = await raw(`http://${lan}:${port}${path}`, {
      headers: { Origin: `http://${lan}:${port}` },
    });
    check(
      `${label}: request from non-loopback ${lan} refused (${path})`,
      res.status === 403 || res.status === 0,
      `status ${res.status}`,
    );
  }
}

async function accessRun() {
  const pairing = randomBytes(16).toString('hex');
  const mcpToken = randomBytes(24).toString('base64url');
  process.env.PANGULAR_MCP_TOKEN = mcpToken;

  // Vite plugin, defaults: one-time code on, with a pairing token for the app page.
  const before = serverLog.length;
  const fixture = await startFixture(PORTS.viteAuth, { auth: { tokens: [pairing] } });
  const ctx = await browser.newContext();
  await ctx.addInitScript(
    (t) => localStorage.setItem('__DEVFRAME_CONNECTION_AUTH_TOKEN__', t),
    pairing,
  );
  const app = await ctx.newPage();
  await app.goto(`${fixture.origin}/`);
  await app.waitForSelector('app-reset', { timeout: 30_000 });
  await delay(6000);
  const authed = await mcpConnect(fixture.origin, { token: mcpToken });
  const pages = await callTool(authed, 'pangular_list-pages', {}, 'auth vite mcp list-pages');
  check(
    'vite auth: the paired app page reports',
    /\| `[0-9a-f]{6,}` \|/.test(pages.text),
    pages.text.slice(0, 120),
  );
  await authed.close();
  await gateChecks('vite auth', fixture.origin, { mcpToken });
  await codeGuardChecks('vite auth', `${fixture.origin}${HUB}pangular/`, before);

  // A browser on another origin, and the panel without the code: no page data.
  const attacker = await browser.newContext();
  const evilPage = await attacker.newPage();
  const leakedTo = [];
  evilPage.on('websocket', (ws) =>
    ws.on('framereceived', (f) => capture('auth vite unpaired panel ws', String(f.payload))),
  );
  // The hub page is the URL the plugin prints; it asks for the code.
  await evilPage.goto(`${fixture.origin}${HUB}`);
  await delay(10_000);
  const unpaired = await evilPage
    .locator('body')
    .innerText()
    .catch(() => '');
  capture('auth vite unpaired panel text', unpaired);
  await evilPage.screenshot({ path: join(OUT, 'unpaired-panel.png') }).catch(() => undefined);
  notes.push(`Unpaired panel after 10 s: ${unpaired.replace(/\s+/g, ' ').slice(0, 160)}`);
  // The hub renders the prompt in a shadow root, which innerText does not reach.
  const prompt = await evilPage.locator('text=Authorize Pangular Inspector').count();
  check('vite auth: unpaired hub page asks for the code', prompt > 0);
  check(
    'vite auth: unpaired panel shows no page data',
    !unpaired.includes('ReactiveSecrets') && !/[1-9]\d* forms?\b/.test(unpaired),
  );
  // A website on another origin (served by request interception) tries fetch and a WebSocket.
  const cross = await attacker.newPage();
  await cross.route('http://evil.example/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>other site</title><p>other site</p>',
    }),
  );
  await cross.goto('http://evil.example/');
  const crossResult = await cross.evaluate(async (target) => {
    const out = {};
    try {
      const res = await fetch(`${target}/__devframes/pangular/__connection.json`);
      out.fetch = `${res.status} ${await res.text()}`;
    } catch (error) {
      out.fetch = String(error);
    }
    try {
      const res = await fetch(`${target}/__devframes/__mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      });
      out.mcp = `${res.status}`;
    } catch (error) {
      out.mcp = String(error);
    }
    out.ws = await new Promise((done) => {
      const ws = new WebSocket(`${target.replace('http', 'ws')}/__devframes/__ws`);
      const frames = [];
      ws.onmessage = (e) => frames.push(String(e.data));
      ws.onerror = () => done(`error ${frames.join(' ')}`);
      ws.onclose = (e) => done(`close ${e.code} ${frames.join(' ')}`);
      setTimeout(() => done(`open ${frames.join(' ')}`), 3000);
    });
    return out;
  }, fixture.origin);
  capture('auth vite cross-origin browser', crossResult);
  check(
    'vite auth: cross-origin page cannot read the connection file',
    !/^200/.test(crossResult.fetch),
    crossResult.fetch.slice(0, 80),
  );
  check(
    'vite auth: cross-origin page cannot open the WebSocket',
    !/^open/.test(crossResult.ws),
    crossResult.ws.slice(0, 80),
  );
  await attacker.close();
  await ctx.close();
  await fixture.close();
  const viteLog = serverLog.slice(before).join('');
  check('vite auth: server log never prints the MCP token', !viteLog.includes(mcpToken));
  check('vite auth: server log never prints the pairing token', !viteLog.includes(pairing));
  void leakedTo;

  // Remote address: the plugin listens on every interface, a LAN request is refused.
  const lanFixture = await startFixture(PORTS.viteAuth, { auth: { tokens: [pairing] } }, '0.0.0.0');
  await remoteChecks('vite auth', PORTS.viteAuth, [
    `${HUB}pangular/`,
    `${HUB}pangular/__connection.json`,
    `${HUB}__mcp`,
  ]);
  await lanFixture.close();

  // server.allowedHosts: true lets any Host through, but no other website (M2).
  const hostsFrom = serverLog.length;
  const hostsFixture = await startFixture(PORTS.viteHosts, {}, '127.0.0.1', {
    allowedHosts: true,
  });
  const hostsOrigin = hostsFixture.origin;
  const hostsConn = await raw(`${hostsOrigin}${HUB}pangular/__connection.json`, {
    headers: { Origin: EVIL },
  });
  check(
    'vite allowedHosts true: foreign Origin refused',
    hostsConn.status === 403,
    `status ${hostsConn.status}`,
  );
  const hostsWs = await raw(`${hostsOrigin}${HUB}__ws`, {
    upgrade: true,
    headers: { Origin: EVIL },
  });
  check(
    'vite allowedHosts true: WebSocket from a foreign Origin refused',
    hostsWs.status !== 101,
    `status ${hostsWs.status}`,
  );
  const tunnel = await raw(`${hostsOrigin}${HUB}pangular/__connection.json`, {
    headers: { Host: 'tunnel.example', Origin: 'https://tunnel.example' },
  });
  check(
    'vite allowedHosts true: a same-origin tunnel page passes',
    tunnel.status === 200,
    `status ${tunnel.status}`,
  );
  check(
    'vite allowedHosts true: prints a warning',
    serverLog.slice(hostsFrom).join('').includes('server.allowedHosts is true'),
  );
  await hostsFixture.close();

  // Express hub: defaults, then production.
  await hubChecks(mcpToken);
  // Standalone CLI.
  await cliChecks();
  // Actions, readOnly, inspectors and agent.tools.
  await gatingChecks();
  delete process.env.PANGULAR_MCP_TOKEN;
}

/** A devframe client in Node, as a panel would connect. Close it when done. */
async function devframeClient(baseURL, authToken) {
  // The client reuses a connection it published on globalThis, which would be another server's.
  for (const key of [
    '__DEVFRAME_CONNECTION__',
    '__DEVFRAME_CONNECTION_META__',
    '__DEVFRAME_CONNECTION_AUTH_TOKEN__',
  ]) {
    delete globalThis[key];
  }
  Object.defineProperty(globalThis, 'location', {
    value: new URL(baseURL),
    configurable: true,
    writable: true,
  });
  return connectDevframe({
    baseURL,
    ...(authToken ? { authToken } : {}),
    simpleAuth: false,
    otpParam: false,
    webmcp: false,
  });
}

async function trustedWith(baseURL, authToken) {
  const rpc = await devframeClient(baseURL, authToken);
  const trusted = await rpc.ensureTrusted(2000).catch(() => false);
  rpc.close?.();
  return trusted === true;
}

/** A burst of wrong one-time codes from several connections is throttled (B1). */
async function codeGuardChecks(label, baseURL, logFrom) {
  const clients = [];
  for (let i = 0; i < 4; i++) clients.push(await devframeClient(baseURL));
  const started = Date.now();
  // 12 wrong codes in total: over the 10-a-minute cap for all clients.
  for (const rpc of clients) {
    for (let i = 0; i < 3; i++) await rpc.requestTrustWithCode('xxxxxx').catch(() => false);
  }
  const fresh = await devframeClient(baseURL);
  const right = await fresh.requestTrustWithCode(getTempAuthCode()).catch(() => false);
  check(
    `${label}: the right code is refused during a burst of wrong ones`,
    !right,
    `trusted after ${Date.now() - started} ms`,
  );
  check(
    `${label}: the burst prints a warning`,
    serverLog.slice(logFrom).join('').includes('wrong one-time codes'),
  );
  for (const rpc of [...clients, fresh]) rpc.close?.();
}

async function hubChecks(mcpToken) {
  const hubUrl = pathToFileURL(join(DIST, 'hub.mjs')).href;
  const script = (env, extra = '') => `
    import express from 'express';
    import { initPangularHub } from ${JSON.stringify(hubUrl)};
    const app = express();
    const devtools = initPangularHub({ ${extra} });
    console.log('enabled=' + devtools.enabled);
    app.use(devtools.nodeMiddleware);
    app.get('/', (_req, res) => res.send('app'));
    const server = app.listen(${PORTS.hub}, '127.0.0.1', () => console.log('listening'));
    devtools.attach?.(server);
  `;
  for (const [label, env, extra] of [
    ['hub dev', { NODE_ENV: 'development' }, ''],
    ['hub production', { NODE_ENV: 'production' }, ''],
    ['hub production enabled:true', { NODE_ENV: 'production' }, 'enabled: true'],
  ]) {
    const file = join(OUT, `hub-${label.replace(/\W+/g, '-')}.mjs`);
    writeFileSync(file, script(env, extra));
    const child = spawn(process.execPath, [file], {
      cwd: ROOT,
      env: { ...process.env, ...env, PANGULAR_MCP_TOKEN: mcpToken },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    for (let i = 0; i < 100 && !out.includes('listening'); i++) await delay(100);
    const origin = `http://127.0.0.1:${PORTS.hub}`;
    if (label === 'hub dev') {
      await gateChecks(label, origin, { mcpToken });
    } else {
      const panel = await raw(`${origin}${HUB}pangular/`);
      const mcp = await mcpPost(origin, { token: mcpToken });
      if (label === 'hub production') {
        check(
          `${label}: enabled is false`,
          out.includes('enabled=false'),
          out.trim().split('\n')[0],
        );
        check(`${label}: panel not served`, panel.status === 404, `status ${panel.status}`);
        check(`${label}: MCP not served`, mcp.status === 404, `status ${mcp.status}`);
      } else {
        check(
          `${label}: prints a warning`,
          /warn|production/i.test(out),
          out.slice(0, 160).replace(/\s+/g, ' '),
        );
        check(`${label}: still asks for the MCP token`, (await mcpPost(origin)).status === 401);
      }
    }
    child.kill();
    await new Promise((d) => child.on('close', d));
    capture(`${label} server log`, out);
    check(`${label}: log never prints the MCP token`, !out.includes(mcpToken));
  }
}

/** The token store folder for a project, as `auth-store.ts` names it. */
function authStoreDir(home, projectRoot) {
  const key = createHash('sha256').update(resolve(projectRoot)).digest('hex').slice(0, 16);
  return join(home, '.pangular-inspector', 'auth', key);
}

function seedTokens(dir, tokens) {
  mkdirSync(dir, { recursive: true });
  const trusted = Object.fromEntries(
    Object.entries(tokens).map(([token, timestamp]) => [
      token,
      { authToken: token, ua: 'seed', origin: 'http://localhost', timestamp },
    ]),
  );
  writeFileSync(join(dir, 'auth.json'), JSON.stringify({ trusted }));
}

async function cliChecks() {
  // A private home, with trusted tokens seeded: one expired, one fresh, and
  // one from another project's store (M1).
  const home = join(OUT, 'cli-home');
  const store = authStoreDir(home, FIXTURE);
  const expired = randomBytes(24).toString('hex');
  const fresh = randomBytes(24).toString('hex');
  const foreign = randomBytes(24).toString('hex');
  seedTokens(store, { [expired]: Date.now() - 8 * 24 * 3600 * 1000, [fresh]: Date.now() });
  seedTokens(authStoreDir(home, ROOT), { [foreign]: Date.now() });
  const mcpToken = process.env.PANGULAR_MCP_TOKEN;
  const child = spawn(
    process.execPath,
    // `--host 127.0.0.1`: the default `localhost` resolves to ::1 first on some
    // runners, and the checks below address the server as 127.0.0.1.
    [
      join(ROOT, 'bin.mjs'),
      'dev',
      '--root',
      FIXTURE,
      '--port',
      String(PORTS.cli),
      '--host',
      '127.0.0.1',
    ],
    {
      cwd: ROOT,
      env: { ...process.env, HOME: home },
    },
  );
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  const origin = `http://127.0.0.1:${PORTS.cli}`;
  // Wait until the server answers, not until it prints: on a slow runner the
  // banner can come before the socket listens.
  let exited = false;
  child.once('exit', () => (exited = true));
  for (let i = 0; i < 300 && !exited; i++) {
    if ((await raw(`${origin}/`)).status) break;
    await delay(100);
  }
  if (exited || !(await raw(`${origin}/`)).status) {
    throw new Error(`pangular dev did not answer on ${origin}:\n${out}`);
  }
  const base = out.match(/https?:\/\/[^\s]+?(\/[^\s]*)/)?.[1] ?? '/';
  notes.push(`CLI dev printed: ${out.trim().split('\n').slice(0, 4).join(' / ')}`);
  const panelPath = base.endsWith('/') ? base : `${base}/`;
  const mcpPath = `${panelPath}__mcp`;
  // The MCP token, as on the hub and the Vite plugin (M3).
  await gateChecks('cli dev', origin, {
    mcpToken,
    mcpPath,
    panelPath,
    wsPath: `${panelPath}__ws`,
  });
  const tunnelMcp = await mcpPost(origin, {
    path: mcpPath,
    host: 'localhost',
    originHeader: 'http://localhost',
  });
  check(
    'cli dev: MCP without the token refused for a loopback Origin',
    tunnelMcp.status === 401,
    `status ${tunnelMcp.status}`,
  );
  // Docs: the CLI binds to localhost, so another interface does not answer.
  await remoteChecks('cli dev', PORTS.cli, [panelPath]);

  // Trusted tokens: expired and foreign ones refused, fresh ones kept (M1).
  const baseURL = `${origin}${panelPath}`;
  check('cli dev: a fresh stored token is trusted', await trustedWith(baseURL, fresh));
  check('cli dev: an expired stored token is refused', !(await trustedWith(baseURL, expired)));
  check("cli dev: another project's token is refused", !(await trustedWith(baseURL, foreign)));
  const rpc = await devframeClient(baseURL);
  const from = out.length;
  await rpc.requestAuthCode().catch(() => undefined);
  for (let i = 0; i < 50 && !/\b\d{6}\b/.test(out.slice(from)); i++) await delay(100);
  const code = out.slice(from).match(/\b(\d{6})\b/)?.[1] ?? '';
  check('cli dev: the code trusts a browser', !!(await rpc.requestTrustWithCode(code)));
  rpc.close?.();
  await delay(1000);
  const file = join(store, 'auth.json');
  const mode = (path) => (existsSync(path) ? (statSync(path).mode & 0o777).toString(8) : 'none');
  check('cli dev: the token file is 0600', mode(file) === '600', mode(file));
  check('cli dev: the token folder is 0700', mode(store) === '700', mode(store));
  const stored = existsSync(file) ? readFileSync(file, 'utf8') : '';
  check('cli dev: the expired token was dropped', !stored.includes(expired));
  check(
    'cli dev: nothing written to the shared devframe store',
    !existsSync(join(home, '.pangular', 'devframe', 'auth.json')),
  );
  capture('cli dev log', out);
  child.kill();
  await new Promise((d) => child.on('close', d));
}

/** actions, agent.readOnly, inspectors and agent.tools, read from the MCP tool list and calls. */
async function gatingChecks() {
  const cases = [
    ['readOnly', { auth: false, agent: { readOnly: true } }],
    ['actions false', { auth: false, actions: false }],
    ['actions.forms false', { auth: false, actions: { forms: false } }],
    ['inspectors.forms false', { auth: false, inspectors: { forms: false } }],
    ['agent.tools.forms false', { auth: false, agent: { tools: { forms: false } } }],
  ];
  const ACTION = [
    'run-form-action',
    'fill-form',
    'navigate',
    'probe-route',
    'record-guards',
    'record-change-detection',
    'ngrx-dispatch',
    'ngrx-restore',
    'tanstack-run-query',
    'set-http-rule',
    'remove-http-rule',
    'set-ssr-override',
    'remove-ssr-override',
    'set-component-property',
    'set-signal',
    'watch-signal',
    'record-pipes',
    'track-subscriptions',
    'analog-run-api',
    'clear-recordings',
  ];
  for (const [label, options] of cases) {
    const fixture = await startFixture(PORTS.viteRo, options);
    const ctx = await browser.newContext();
    const app = await ctx.newPage();
    const frames = [];
    app.on('websocket', (ws) => ws.on('framesent', (f) => frames.push(String(f.payload))));
    await app.goto(`${fixture.origin}/`);
    await app.waitForSelector('app-reset', { timeout: 30_000 });
    await delay(5000);
    const client = await mcpConnect(fixture.origin);
    const names = new Set(
      (await client.listTools()).tools.map((t) => t.name.replace(/^pangular_/, '')),
    );
    const form = `ReactiveSecrets.group@${(await callTool(client, 'pangular_list-pages', {}, `gating ${label}`)).text.match(/\| `([0-9a-f]{6,})` \|/)?.[1]}`;
    const g = (name, ok, detail) => check(`${label}: ${name}`, ok, detail);
    if (label === 'readOnly') {
      const left = ACTION.filter((n) => names.has(n));
      g('no action tool is listed', left.length === 0, left.join(', '));
      const call = await callTool(
        client,
        'pangular_run-form-action',
        { action: 'set-value', form, path: 'username', value: 'ro', confirm: true },
        `gating ${label}`,
      );
      g('run-form-action call refused', !call.ok, call.text.slice(0, 120));
    }
    if (label === 'actions false') {
      const left = ACTION.filter(
        (n) =>
          names.has(n) &&
          ![
            'clear-recordings',
            'watch-signal',
            'record-pipes',
            'track-subscriptions',
            'record-guards',
            'record-change-detection',
          ].includes(n),
      );
      g('write tools are dropped', left.length === 0, left.join(', '));
    }
    if (label === 'actions.forms false') {
      g(
        'run-form-action and fill-form dropped',
        !names.has('run-form-action') && !names.has('fill-form'),
      );
      const call = await callTool(
        client,
        'pangular_run-form-action',
        { action: 'set-value', form, path: 'username', value: 'blocked', confirm: true },
        `gating ${label}`,
      );
      const value = await app.evaluate(
        () =>
          window.ng.getComponent(document.querySelector('app-reactive-secrets')).group.value
            .username,
      );
      g('form not written', value === 'ada' && !call.ok, `${value}; ${call.text.slice(0, 100)}`);
    }
    if (label === 'inspectors.forms false') {
      g(
        'forms tools dropped',
        ![...names].some((n) => /form/.test(n)),
        [...names].filter((n) => /form/.test(n)).join(', '),
      );
      const sent = frames.join('\n');
      g(
        'page sends no form values',
        !sent.includes(C.rfEntropy.needle) && !sent.includes('ReactiveSecrets.group'),
        '',
      );
      const read = await callTool(
        client,
        'devframe_state_read',
        { key: 'pangular:forms' },
        `gating ${label}`,
      );
      g(
        'pangular:forms state not readable',
        !read.text.includes('ReactiveSecrets'),
        read.text.slice(0, 100),
      );
      // devframe_state_read hides pangular:forms in every config (RESOURCE_STATE_KEYS), so the
      // resource that serves it is the read that can leak.
      const resource = await client
        .readResource({ uri: `devframe://resource/${encodeURIComponent('pangular:forms')}` })
        .then((r) => r.contents?.map((c) => c.text ?? '').join('\n') ?? '')
        .catch((error) => String(error?.message ?? error));
      g(
        'pangular:forms resource not readable',
        !resource.includes('ReactiveSecrets'),
        resource.slice(0, 100),
      );
    }
    if (label === 'agent.tools.forms false') {
      g(
        'forms tools hidden from agents',
        !names.has('inspect-forms') && !names.has('run-form-action'),
        '',
      );
      const read = await callTool(
        client,
        'devframe_state_read',
        { key: 'pangular:forms' },
        `gating ${label}`,
      );
      g(
        'pangular:forms shared state hidden over MCP',
        !read.text.includes('ReactiveSecrets'),
        read.text.slice(0, 120),
      );
      const resources = (await client.listResources()).resources.map((r) =>
        decodeURIComponent(r.uri),
      );
      g(
        'forms resources hidden',
        !resources.some((u) => /forms/.test(u)),
        resources.filter((u) => /forms/.test(u)).join(', '),
      );
    }
    await client.close();
    await ctx.close();
    await fixture.close();
  }
}

// ---------------------------------------------------------------------------
// Production build: no overlay, no debug API, no live data

async function prodRun() {
  // The documented setup (dynamic import in a dev check), then a static import
  // of the `/overlay` entry, which must start nothing in production either.
  await prodCase('production', false);
  await prodCase('production, static /overlay import', true);
}

async function prodCase(label, staticImport) {
  const outDir = join(OUT, staticImport ? 'prod-static' : 'prod');
  const { build, preview } = await import('vite');
  await build({
    configFile: false,
    root: FIXTURE,
    logLevel: 'warn',
    mode: 'production',
    build: { outDir, emptyOutDir: true },
    resolve: {
      alias: {
        '@pangular-inspector/devtools/overlay': join(DIST, 'overlay.mjs'),
        '@pangular-inspector/devtools/http': join(DIST, 'http.mjs'),
        '@tanstack/query-core': QUERY_CORE,
      },
    },
    plugins: [
      stopImportPlugin(staticImport),
      angular({ tsconfig: join(FIXTURE, 'tsconfig.json') }),
      pangular({}),
      corpusPlugin(),
    ],
  });
  const bundle = filesUnder(outDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  // A static import keeps the overlay's code in the bundle; only its start must be gone.
  if (!staticImport) {
    check(
      'production bundle has no overlay',
      !/initOverlay|__devframes|pangular-popup/.test(bundle),
    );
  }
  const server = await preview({
    configFile: false,
    root: FIXTURE,
    logLevel: 'warn',
    build: { outDir },
    preview: { port: PORTS.prod, strictPort: true, host: '127.0.0.1' },
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const hubRequests = [];
  page.on('request', (r) => {
    if (r.url().includes('__devframes') || r.url().includes('__pangular'))
      hubRequests.push(r.url());
  });
  page.on('websocket', (ws) => hubRequests.push(ws.url()));
  await page.goto(`http://127.0.0.1:${PORTS.prod}/`);
  await page.waitForSelector('app-secret-card', { timeout: 30_000 });
  await delay(3000);
  const probe = await page.evaluate(() => ({
    ng: typeof window.ng,
    getComponent: typeof window.ng?.getComponent,
    ngDevMode: typeof window.ngDevMode === 'undefined' ? 'undefined' : String(window.ngDevMode),
    popup: !!document.querySelector('#pangular-popup-root'),
    // __PANGULAR_FORMS__ is the app's own setting, written by the fixture;
    // __stopDevtools is the static import's own export.
    globals: [
      ...Object.keys(window).filter(
        (k) => /pangular|devframe/i.test(k) && k !== '__PANGULAR_FORMS__',
      ),
      ...Object.getOwnPropertySymbols(globalThis)
        .map(String)
        .filter((k) => /pangular|devframe/i.test(k)),
    ],
  }));
  check(
    `${label}: window.ng absent`,
    probe.ng === 'undefined' || probe.getComponent === 'undefined',
    JSON.stringify(probe),
  );
  check(`${label}: no overlay button`, !probe.popup);
  check(
    `${label}: no request to the devtools server`,
    hubRequests.length === 0,
    hubRequests.join(' '),
  );
  check(
    `${label}: no devtools globals on window`,
    probe.globals.length === 0,
    probe.globals.join(', '),
  );
  await ctx.close();
  await new Promise((d) => server.httpServer.close(d));
}

// ---------------------------------------------------------------------------
// Grep

function grepChannels() {
  const results = [];
  for (const [id, canary] of Object.entries(C)) {
    const hits = [];
    for (const [channel, text] of channels) {
      if (text.includes(canary.needle)) hits.push(channel);
    }
    results.push({ id, ...canary, hits });
  }
  return results;
}

function writeChannels() {
  const dir = join(OUT, 'channels');
  mkdirSync(dir, { recursive: true });
  for (const [channel, text] of channels) {
    writeFileSync(join(dir, `${channel.replace(/[^\w.-]+/g, '_').slice(0, 120)}.txt`), text);
  }
}

// ---------------------------------------------------------------------------

process.env.PANGULAR_MCP_TOKEN_FILE = join(OUT, 'mcp-token');
const browser = await chromium.launch();
try {
  if (!only || only === 'leak') {
    await leakRun();
    await sourceScanRun();
  }
  if (!only || only === 'access') await accessRun();
  if (!only || only === 'prod') await prodRun();
} finally {
  await browser.close();
}
capture('server log', serverLog.join(''));
// The app's own console holds what the fixture logged on purpose.
channels.delete('app page browser console');
writeChannels();

/** Page -> server traffic: the server may still mask it before any reader sees it. */
const isEgress = (channel) => channel === 'app page ws sent' || channel === 'app page http request';
const leakRan = !only || only === 'leak';
const grep = grepChannels();
writeFileSync(join(OUT, 'grep.json'), JSON.stringify(grep, null, 2));
for (const row of grep) {
  let hits = row.hits;
  // The write probes travel to the page inside the write request itself.
  if (row.id === 'writeProbe') hits = hits.filter((h) => h !== 'app page ws received');
  const outputs = hits.filter((h) => !isEgress(h));
  const egress = hits.filter(isEgress);
  if (row.expect === 'masked' && outputs.length) {
    findings.push(`LEAK ${row.id} (${row.where}) in: ${outputs.join(' | ')}`);
  } else if (row.expect === 'masked' && egress.length) {
    findings.push(
      `EGRESS ${row.id} (${row.where}) sent unmasked page -> server (not in any output): ${egress.join(' | ')}`,
    );
  }
  if (
    leakRan &&
    row.expect === 'visible' &&
    !hits.some((h) => h.startsWith('mcp') || h.startsWith('panel'))
  ) {
    findings.push(`UNMASK ${row.id} (${row.where}) not visible in the panel or MCP`);
  }
  if (row.expect === 'info' && hits.length) {
    notes.push(`info ${row.id} (${row.where}) appears in ${hits.length} channel(s), as documented`);
  }
}
const unseen = grep.filter((r) => !r.hits.length && r.expect === 'masked').length;
notes.push(
  `Masked canaries found in no channel: ${unseen} of ${grep.filter((r) => r.expect === 'masked').length}`,
);
log('\n== Notes');
for (const n of notes) log(`- ${n}`);
log('\n== Findings');
for (const f of findings) log(`- ${f}`);
log('\n== Failed checks');
for (const c of checks.filter((x) => !x.ok)) log(`- ${c.name}${c.detail ? ` - ${c.detail}` : ''}`);
writeFileSync(join(OUT, 'summary.json'), JSON.stringify({ findings, checks, notes }, null, 2));
log(
  `\n${findings.length} finding(s), ${checks.filter((c) => !c.ok).length} of ${checks.length} check(s) failed. Channels in ${relative(ROOT, OUT)}`,
);
process.exitCode = findings.length || checks.some((c) => !c.ok) ? 1 : 0;
