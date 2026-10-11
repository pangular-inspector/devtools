#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const USAGE = `Usage:
  node scripts/press-kit.mjs screenshots   Capture the panel from the SSR demo on :4000 and rebuild the zip
  node scripts/press-kit.mjs zip           Zip README.txt, logo/svg, logo/png and screenshots

Options: --dir <press folder> (default apps/docs/public/press), --base <demo url> (default http://localhost:4000)`;

const args = process.argv.slice(2);
const command = args[0];
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const dir = resolve(option('--dir', 'apps/docs/public/press'));
const base = option('--base', 'http://localhost:4000');

const ZIP = 'pangular-inspector-press-kit.zip';

const SHOTS = [
  {
    name: 'components',
    app: '/examples/components',
    view: 'angular',
    tab: 'components',
    select: 'ComponentsExample',
  },
  { name: 'signals', app: '/examples/signals', view: 'angular', tab: 'signals' },
  { name: 'router', app: '/examples/routes/summary', view: 'angular', tab: 'routes' },
  {
    name: 'store',
    app: '/examples/store',
    view: 'ngrx',
    tab: 'store',
    click: 'Add an item',
    select: 'PackingStore',
  },
];

async function captureScreenshots(browser) {
  const outDir = join(dir, 'screenshots');
  mkdirSync(outDir, { recursive: true });
  for (const colorScheme of ['dark', 'light']) {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      colorScheme,
      reducedMotion: 'reduce',
    });
    for (const shot of SHOTS) {
      const app = await context.newPage();
      await app.goto(`${base}${shot.app}`);
      await app.waitForLoadState('networkidle');
      await app.waitForTimeout(1500);
      if (shot.click) {
        for (let i = 0; i < 2; i++) await app.getByRole('button', { name: shot.click }).click();
      }
      const panel = await context.newPage();
      await panel.goto(`${base}/__devframes/pangular/?view=${shot.view}#tab=${shot.tab}`);
      await panel
        .locator('.status.connected')
        .waitFor({ timeout: 15_000 })
        .catch(() => {});
      await panel.waitForTimeout(3000);
      if (shot.select) {
        await panel
          .getByText(shot.select, { exact: true })
          .first()
          .click()
          .catch(() => {});
        await panel.waitForTimeout(1000);
      }
      const file = join(outDir, `${shot.name}-${colorScheme}.png`);
      await panel.screenshot({ path: file });
      console.log(`wrote ${file}`);
      await panel.close();
      await app.close();
    }
    await context.close();
  }
}

function buildZip() {
  const zip = join(dir, ZIP);
  rmSync(zip, { force: true });
  const entries = ['README.txt', 'logo/svg', 'logo/png', 'screenshots'];
  const missing = entries.filter((entry) => !existsSync(join(dir, entry)));
  if (missing.length) throw new Error(`Missing in ${dir}: ${missing.join(', ')}`);
  execFileSync('zip', ['-X', '-q', '-r', ZIP, ...entries, '-x', '*/.*'], {
    cwd: dir,
    stdio: 'inherit',
  });
  console.log(`wrote ${zip}`);
}

if (!['screenshots', 'zip'].includes(command)) {
  console.error(USAGE);
  process.exit(1);
}

if (command === 'zip') {
  buildZip();
} else {
  const browser = await chromium.launch();
  try {
    await captureScreenshots(browser);
  } finally {
    await browser.close();
  }
  buildZip();
}
