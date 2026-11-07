#!/usr/bin/env node
// Extension e2e: loads the unpacked extension (extension/) into Playwright's Chromium, opens
// DevTools on a running app, selects the Pangular Inspector panel and checks that it finds the
// devtools server, loads extension/ui in its frame for the inspected page and shows the app.
//
//   node scripts/e2e-extension.mjs --base http://localhost:4000 [--out dir] [--component App]
//
// The app must run with PANGULAR_AUTH=false, as .github/workflows/e2e.yml starts the SSR demo:
// the panel bridge does not answer the one-time code prompt. Chromium runs headless (the new
// headless mode, which loads extensions); set HEADED=1 to watch it, CHROMIUM_PATH to use another
// Chromium.
//
// Playwright has no handle on DevTools windows, so the script talks to the DevTools front end and
// the panel page over the Chrome DevTools Protocol, through the inspected page's CDP session.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
const base = option('base', 'http://localhost:4000').replace(/\/$/, '');
const out = resolve(option('out', 'dist/e2e-extension'));
// The root component of the app, which the Components tab must list.
const component = option('component', 'App');
const extensionDir = resolve(import.meta.dirname, '../extension');
// The ID the `key` in extension/manifest.json gives, which the devtools server trusts.
const EXTENSION_ID = 'dcogniffeelebaolkkfbopmjcblhblfk';
const extensionOrigin = `chrome-extension://${EXTENSION_ID}`;
const TIMEOUT_MS = 30_000;

const steps = [];
function step(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  return ok;
}

/** Polls `read` until `done` holds for its value, or gives the last value after the timeout. */
async function until(read, done, timeoutMs = TIMEOUT_MS) {
  const end = Date.now() + timeoutMs;
  let value;
  for (;;) {
    value = await read().catch((error) => ({ error: error.message }));
    if (done(value) || Date.now() > end) return value;
    await new Promise((r) => setTimeout(r, 250));
  }
}

const profile = mkdtempSync(join(tmpdir(), 'pangular-extension-e2e-'));
const context = await chromium.launchPersistentContext(profile, {
  // `chromium` is the new headless mode, the one that loads extensions.
  channel: process.env.CHROMIUM_PATH ? undefined : 'chromium',
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: !process.env.HEADED,
  viewport: { width: 1280, height: 800 },
  args: [
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    '--auto-open-devtools-for-tabs',
  ],
});

let failed = false;
try {
  // One tab, so the one DevTools front end is the one for the app.
  const page = context.pages()[0] ?? (await context.newPage());
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${base}/`);
  await page.waitForLoadState('networkidle').catch(() => {});

  const cdp = await context.newCDPSession(page);
  const targets = async () => (await cdp.send('Target.getTargets')).targetInfos;

  // Commands to a target attached without flattening go through sendMessageToTarget.
  let nextId = 0;
  const replies = new Map();
  cdp.on('Target.receivedMessageFromTarget', ({ sessionId, message }) => {
    const reply = JSON.parse(message);
    replies.get(`${sessionId}:${reply.id}`)?.(reply);
  });
  async function attach(targetId) {
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: false });
    return async (expression) => {
      const id = ++nextId;
      const reply = new Promise((done) => replies.set(`${sessionId}:${id}`, done));
      await cdp.send('Target.sendMessageToTarget', {
        sessionId,
        message: JSON.stringify({
          id,
          method: 'Runtime.evaluate',
          params: { expression, awaitPromise: true, returnByValue: true },
        }),
      });
      const { result, error } = await reply;
      if (error) throw new Error(error.message);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    };
  }

  const front = await until(
    async () => (await targets()).find((t) => t.url.startsWith('devtools://')),
    Boolean,
  );
  if (!step('DevTools opens on the app', !!front?.targetId)) throw new Error('no DevTools');
  const inDevtools = await attach(front.targetId);

  // devtools.js adds the panel once it sees Angular on the page.
  const panelId = await until(
    () =>
      inDevtools(`(async () => {
        const UI = await import('./ui/legacy/legacy.js');
        return UI.InspectorView.InspectorView.instance()
          .tabbedPane.tabIds().find((id) => id.startsWith(${JSON.stringify(extensionOrigin)})) ?? null;
      })()`),
    (id) => typeof id === 'string',
  );
  if (!step('the extension adds its panel', typeof panelId === 'string', JSON.stringify(panelId))) {
    throw new Error('no panel');
  }
  await inDevtools(`(async () => {
    const UI = await import('./ui/legacy/legacy.js');
    await UI.InspectorView.InspectorView.instance().showPanel(${JSON.stringify(panelId)});
  })()`);

  const panelTarget = await until(
    async () => (await targets()).find((t) => t.url === `${extensionOrigin}/panel.html`),
    Boolean,
  );
  if (!step('the panel page loads', !!panelTarget)) throw new Error('no panel page');
  const inPanel = await attach(panelTarget.targetId);

  // panel.html and extension/ui share the extension's origin, so the panel reads its frame.
  const STATE = `(() => {
    const frame = document.getElementById('devtools-frame');
    const ui = frame?.style.display === 'block' ? frame.contentDocument : null;
    return {
      status: document.getElementById('status-message')?.textContent ?? '',
      src: frame?.getAttribute('src') ?? '',
      connected: !!ui?.querySelector('.status.connected'),
      tabs: [...(ui?.querySelectorAll('nav[aria-label="Inspectors"] button') ?? [])].map((b) =>
        b.textContent.trim(),
      ),
    };
  })()`;
  const state = await until(
    () => inPanel(STATE),
    (s) => s?.connected && s.tabs?.length > 0,
  );
  const src = state?.src ? new URL(state.src) : null;
  step(
    'the bridge loads extension/ui for the inspected page',
    src?.href.startsWith(`${extensionOrigin}/ui/index.html?`) &&
      new URL(src.searchParams.get('baseURL') ?? 'x:', base).origin === new URL(base).origin &&
      !!src.searchParams.get('pageId'),
    state?.src || state?.status || JSON.stringify(state),
  );
  step('the panel connects to the devtools server', !!state?.connected, state?.status);
  step('the panel shows the inspector tabs', state?.tabs?.length > 0, state?.tabs?.join(', '));

  const components = await until(
    () =>
      inPanel(`(() => {
        const ui = document.getElementById('devtools-frame').contentDocument;
        const tab = [...ui.querySelectorAll('nav[aria-label="Inspectors"] button')].find(
          (b) => b.textContent.trim() === 'Components',
        );
        if (tab && tab.getAttribute('aria-current') !== 'page') tab.click();
        // The first word of each row of the component tree is the component's name.
        return [...ui.querySelectorAll('main [role="treeitem"]')].map((row) =>
          row.textContent.trim().match(/^[A-Za-z0-9_$]+/)?.[0],
        ).filter(Boolean);
      })()`),
    (names) => Array.isArray(names) && names.includes(component),
  );
  step(
    `the Components tab lists ${component} from the inspected page`,
    Array.isArray(components) && components.includes(component),
    Array.isArray(components) ? components.slice(0, 8).join(', ') : JSON.stringify(components),
  );
  step('the app logs no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join('; '));
} catch (error) {
  step('the run finishes', false, error.message.split('\n')[0]);
} finally {
  failed = steps.some((s) => !s.ok);
  await context.close();
  rmSync(profile, { recursive: true, force: true });
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'results.json'), JSON.stringify(steps, null, 2));
console.log(`\n${steps.length} steps, ${steps.filter((s) => !s.ok).length} failed.`);
process.exit(failed ? 1 : 0);
