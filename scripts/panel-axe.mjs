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
