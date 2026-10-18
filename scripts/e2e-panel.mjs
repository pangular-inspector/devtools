#!/usr/bin/env node
// Live panel check: opens a running demo app and its panel, then visits every
// panel tab and every sub-view (tablists inside a tab) in dark and light color
// schemes at 1280px and 360px. For each it runs axe, checks for horizontal
// overflow and page errors, and records whether the view shows live data.
//
//   node scripts/e2e-panel.mjs --base http://localhost:4000 [--out dir] [--route tab=/path ...]
//     [--auth-log file]
//
// --auth-log reads the one-time code from the server's output and opens the
// magic link once per browser context. The Vite plugin and the SSR demo both
// ask for the code; start the demo with PANGULAR_AUTH=false to skip it, as
// .github/workflows/e2e.yml does, or pass its log here.
//
// Set CHROMIUM_PATH to use a Chromium other than Playwright's default.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
const base = option('base', 'http://localhost:4000').replace(/\/$/, '');
const out = resolve(option('out', 'dist/e2e-panel'));
const panelPath = option('panel', '/__devframes/pangular/');
const authLog = option('auth-log');

/** Opens the hub so the server prints a fresh code, then follows the magic link. */
async function authorize(page) {
  if (!authLog) return;
  const strip = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');
  const codes = () =>
    [...strip(readFileSync(authLog, 'utf8')).matchAll(/devframe_otp=(\d{6})/g)].map((m) => m[1]);
  const before = codes().length;
  await page.goto(`${base}/__devframes/`);
  // The server prints a code once; Re-issue prints a new one.
  await page.getByRole('button', { name: /Re-issue/ }).click({ timeout: 15_000 });
  let code;
  for (let i = 0; i < 50 && !code; i++) {
    await page.waitForTimeout(200);
    const all = codes();
    if (all.length > before) code = all[all.length - 1];
  }
  if (!code) throw new Error(`no new one-time code in ${authLog}`);
  await page.goto(`${base}/#devframe_otp=${code}`);
  await page.waitForTimeout(2000);
}
mkdirSync(out, { recursive: true });

// The app route that gives each tab something to show.
const ROUTES = {
  dashboard: '/',
  timeline: '/examples/signals',
  audit: '/',
  analog: '/',
  components: '/examples/components',
  routes: '/examples/routes',
  signals: '/examples/signals',
  injectors: '/examples/di',
  store: '/examples/store',
  queries: '/',
  forms: '/examples/forms',
  pipes: '/examples/pipes',
  network: '/examples/http',
  errors: '/',
  capacitor: '/',
  plugins: '/',
  settings: '/',
};
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--route') {
    const [tab, path] = args[i + 1].split('=');
    ROUTES[tab] = path;
  }
}

const SCHEMES = ['dark', 'light'];
const WIDTHS = [1280, 360];
const results = [];
const slug = (text) => text.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function axe(page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    summary: v.nodes[0]?.failureSummary?.split('\n').slice(0, 3).join(' '),
  }));
}

async function overflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const wide = [];
    if (doc.scrollWidth > innerWidth) {
      for (const el of document.querySelectorAll('main *')) {
        const r = el.getBoundingClientRect();
        if (r.right > innerWidth + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') {
          const scroller = el.closest('[class*="scroll"], pre, table, .table-wrap');
          wide.push(
            `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''} right=${Math.round(r.right)}${scroller ? ' (in scroller)' : ''}`,
          );
          if (wide.length >= 6) break;
        }
      }
    }
    return { scrollWidth: doc.scrollWidth, innerWidth, wide };
  });
}

async function record(page, name, meta, errors) {
  await page.waitForTimeout(600);
  const violations = await axe(page);
  const box = meta.width === 360 ? await overflow(page) : null;
  const text = (
    await page
      .locator('main')
      .innerText()
      .catch(() => '')
  ).replace(/\s+/g, ' ');
  const entry = {
    name,
    ...meta,
    violations,
    overflow: box && box.scrollWidth > box.innerWidth ? box : null,
    pageErrors: errors.splice(0),
    textSample: text.slice(0, 160),
  };
  results.push(entry);
  const bad = violations.length || entry.overflow || entry.pageErrors.length;
  if (bad) {
    await page.screenshot({ path: join(out, `${slug(name)}-${meta.scheme}-${meta.width}.png`) });
  }
  console.log(
    `${bad ? 'FAIL' : 'ok  '} ${meta.scheme} ${meta.width} ${name}` +
      (violations.length ? ` axe=${violations.map((v) => v.id).join(',')}` : '') +
      (entry.overflow ? ` overflow=${entry.overflow.scrollWidth}` : '') +
      (entry.pageErrors.length ? ` errors=${entry.pageErrors.length}` : ''),
  );
}

try {
  for (const scheme of SCHEMES) {
    for (const width of WIDTHS) {
      const context = await browser.newContext({
        colorScheme: scheme,
        reducedMotion: 'reduce',
        viewport: { width, height: 800 },
      });
      const app = await context.newPage();
      await app.setViewportSize({ width: 1280, height: 800 });
      await authorize(app);
      await app.goto(`${base}/`);
      const panel = await context.newPage();
      const errors = [];
      panel.on('pageerror', (error) => errors.push(error.message));
      await panel.goto(`${base}${panelPath}`);
      await panel.locator('.status.connected').waitFor({ timeout: 30_000 });
      const tabs = panel.locator('nav[aria-label="Inspectors"] button');
      const labels = await tabs.allInnerTexts();
      const ids = [];
      for (let i = 0; i < labels.length; i++) ids.push(labels[i].trim());
      for (let i = 0; i < ids.length; i++) {
        const label = ids[i];
        const id =
          Object.keys(ROUTES).find((key) => key === label.toLowerCase()) ??
          { 'SSR & HTTP': 'network' }[label] ??
          label.toLowerCase();
        const route = ROUTES[id] ?? '/';
        if (new URL(app.url()).pathname !== route) {
          await app.goto(`${base}${route}`);
          await app.waitForLoadState('networkidle').catch(() => {});
        }
        await panel.bringToFront();
        await tabs.nth(i).click();
        await panel.waitForTimeout(1500);
        await record(panel, label, { scheme, width, tab: id }, errors);
        // Sub-views: every tab in every tablist inside main.
        const lists = panel.locator('main [role="tablist"]');
        const listCount = await lists.count();
        for (let l = 0; l < listCount; l++) {
          const listName = (await lists.nth(l).getAttribute('aria-label')) ?? `list ${l}`;
          const sub = lists.nth(l).locator('[role="tab"]');
          const subLabels = (await sub.allInnerTexts()).map((s) => s.trim().replace(/\s+/g, ' '));
          for (let s = 0; s < subLabels.length; s++) {
            if (!(await sub.nth(s).isVisible())) continue;
            await sub.nth(s).click();
            await panel.waitForTimeout(800);
            await record(
              panel,
              `${label} / ${listName} / ${subLabels[s]}`,
              { scheme, width, tab: id },
              errors,
            );
          }
        }
      }
      await panel.locator('header button[aria-label="Settings"]').click();
      await panel.waitForTimeout(800);
      await record(panel, 'Settings', { scheme, width, tab: 'settings' }, errors);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

writeFileSync(join(out, 'results.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => r.violations.length || r.overflow || r.pageErrors.length);
console.log(
  `\n${results.length} views checked, ${failed.length} with problems. Details: ${join(out, 'results.json')}`,
);
process.exit(failed.length ? 1 : 0);
