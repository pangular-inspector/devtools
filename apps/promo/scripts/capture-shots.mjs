#!/usr/bin/env node
// Captures the panel screenshots the promo uses, from a static report with
// seeded pages, the way scripts/panel-axe.mjs checks the panel.
//
//   pnpm devtools:build-pkg && node bin.mjs build --outDir dist/panel-axe
//   pnpm --filter pangular-inspector-promo shots [path/to/report]
//
// The PNGs land in apps/promo/public/shots at twice the CSS size.
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const dir = resolve(ROOT, process.argv[2] ?? 'dist/panel-axe');
const out = resolve(HERE, '../public/shots');
if (!existsSync(join(dir, '__connection.json'))) {
  console.error(`${dir} is not a report. Run: node bin.mjs build --outDir ${dir}`);
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
const PREFIX = '/__pangular/';
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  let file = join(dir, path.slice(PREFIX.length - 1));
  if (!path.startsWith(PREFIX) || !file.startsWith(dir) || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  if (statSync(file).isDirectory()) file = join(file, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}${PREFIX}`;

const now = Date.now();
const node = (id, name, tag, children = [], extra = {}) => ({
  id,
  name,
  tag,
  hydration: 'hydrated',
  children,
  ...extra,
});
const prop = (name, value, extra = {}) => ({ name, prop: name, value, ...extra });

const COMPONENTS = {
  nodes: [],
  selectedId: 'c6',
  highlightedId: null,
  pages: {
    shop: {
      pageId: 'shop',
      url: '/checkout',
      title: 'Shop',
      reportedAt: now,
      count: 11,
      hydration: {
        hydrated: true,
        counts: { hydrated: 10, skipped: 0, mismatched: 0, client: 1, dehydratedBlocks: 1 },
        mismatches: [],
      },
      roots: [
        node('c0', 'App', 'app-root', [
          node('c1', 'Header', 'app-header', [node('c2', 'CartBadge', 'app-cart-badge')]),
          node('c3', 'Shop', 'app-shop', [
            node('c4', 'ProductList', 'app-product-list', [
              node('c7', 'ProductCard', 'app-product-card'),
              node('c8', 'ProductCard', 'app-product-card'),
            ]),
            node('c5', 'Checkout', 'app-checkout', [
              node('c6', 'CheckoutForm', 'app-checkout-form', [
                node('c9', 'AddressField', 'app-address-field'),
                node('c10', 'PayButton', 'app-pay-button', [], { hydration: 'client' }),
              ]),
            ]),
          ]),
          node('c11', 'Footer', 'app-footer'),
        ]),
      ],
      detail: {
        id: 'c6',
        name: 'CheckoutForm',
        tag: 'app-checkout-form',
        path: 'app-root > app-shop > app-checkout > app-checkout-form',
        selector: 'app-checkout-form',
        source: { file: 'src/app/checkout/checkout-form.ts', line: 24 },
        changeDetection: 'OnPush',
        encapsulation: 'Emulated',
        inputs: [prop('coupon', 'SPRING', { kind: 'signal', edit: 'signal' })],
        outputs: [prop('paid', undefined, { listened: true })],
        properties: [
          prop(
            'items',
            [
              { sku: 'mug', qty: 2 },
              { sku: 'tee', qty: 1 },
            ],
            {
              kind: 'signal',
              edit: 'signal',
              editInside: 'signal',
            },
          ),
          prop('total', 86, { kind: 'signal', locked: 'computed' }),
          prop('canPay', false, { kind: 'signal', locked: 'computed' }),
          prop('shipping', { status: 'resolved', value: 'standard' }, { kind: 'resource' }),
        ],
        listeners: ['submit'],
        directives: [],
        dependencies: [
          { from: 'CheckoutForm', token: 'CartStore', flags: [], providedBy: 'root' },
          { from: 'CheckoutForm', token: 'HttpClient', flags: [], providedBy: 'root' },
          { from: 'CheckoutForm', token: 'Router', flags: [], providedBy: 'root' },
        ],
      },
    },
  },
};

const sig = (id, kind, label, value, epoch, changes) => ({
  id,
  kind,
  label,
  value,
  epoch,
  changes,
});
const SIGNALS = {
  graph: null,
  selectedNodeId: null,
  pages: {
    shop: {
      pageId: 'shop',
      source: 'selected',
      component: {
        id: 'c6',
        name: 'CheckoutForm',
        tag: 'app-checkout-form',
        path: 'app-checkout-form',
      },
      nodes: [
        sig(
          'n0',
          'signal',
          'items',
          [
            { sku: 'mug', qty: 2 },
            { sku: 'tee', qty: 1 },
          ],
          4,
          3,
        ),
        sig('n1', 'signal', 'coupon', 'SPRING', 2, 1),
        sig('n2', 'computed', 'count', 3, 4, 3),
        sig('n3', 'computed', 'subtotal', 96, 4, 3),
        sig('n4', 'computed', 'total', 86, 5, 4),
        sig('n5', 'linkedSignal', 'shippingMethod', 'standard', 2, 1),
        sig('n6', 'computed', 'canPay', false, 5, 2),
        sig('n7', 'effect', 'persistCart', undefined, 4, 3),
        sig('n8', 'template', 'CheckoutForm', undefined, 6, 5),
      ],
      edges: [
        { consumer: 2, producer: 0 },
        { consumer: 3, producer: 0 },
        { consumer: 4, producer: 3 },
        { consumer: 4, producer: 1 },
        { consumer: 5, producer: 0 },
        { consumer: 6, producer: 4 },
        { consumer: 6, producer: 5 },
        { consumer: 7, producer: 0 },
        { consumer: 8, producer: 2 },
        { consumer: 8, producer: 4 },
        { consumer: 8, producer: 6 },
      ],
      history: {
        n4: [
          { epoch: 3, value: 96, at: now - 9000, source: 'write' },
          { epoch: 4, value: 86, at: now - 4000, source: 'write' },
        ],
      },
    },
  },
};

const route = (id, path, extra = {}) => ({ id, path, fullPath: path, kind: 'component', ...extra });
const ROUTER = {
  pages: [
    {
      pageId: 'shop',
      reportedAt: now,
      generation: 1,
      activeIds: ['shop', 'checkout'],
      snapshot: {
        url: '/checkout',
        queryParams: {},
        fragment: null,
        root: { path: '', url: '', outlet: 'primary', params: {}, data: {}, children: [] },
      },
      config: [
        route('shop', 'shop', {
          component: 'Shop',
          title: 'Shop',
          children: [route('product', 'shop/:id', { component: 'ProductDetail' })],
        }),
        route('checkout', 'checkout', {
          component: 'Checkout',
          guards: { canActivate: ['authGuard'] },
        }),
        route('login', 'login', { component: 'Login' }),
        { id: 'home', path: '', fullPath: '', kind: 'redirect', redirectTo: 'shop' },
      ],
      navigations: [
        {
          id: 1,
          url: '/shop',
          trigger: 'imperative',
          startedAt: now - 12_000,
          endedAt: now - 11_960,
          outcome: 'succeeded',
        },
        {
          id: 2,
          url: '/checkout',
          trigger: 'imperative',
          startedAt: now - 7_000,
          endedAt: now - 6_998,
          outcome: 'redirected',
          redirectedTo: '/login?next=/checkout',
        },
        {
          id: 3,
          url: '/login?next=/checkout',
          trigger: 'imperative',
          startedAt: now - 6_990,
          endedAt: now - 6_950,
          outcome: 'succeeded',
        },
        {
          id: 4,
          url: '/checkout',
          trigger: 'imperative',
          startedAt: now - 3_000,
          endedAt: now - 2_955,
          outcome: 'succeeded',
        },
      ],
    },
  ],
};

const call = (id, url, extra = {}) => ({
  id,
  url,
  method: 'GET',
  status: 200,
  durationMs: 18,
  side: 'client',
  cacheHit: false,
  faulted: false,
  at: now - 5000,
  ...extra,
});
const HTTP = {
  serverCalls: [
    call('s1', '/api/cart', {
      side: 'server',
      requestId: 'r1',
      durationMs: 42,
      cacheStored: true,
      at: now - 8000,
    }),
    call('s2', '/api/products', {
      side: 'server',
      requestId: 'r1',
      durationMs: 65,
      cacheStored: true,
      at: now - 8000,
    }),
    call('s3', '/api/user', {
      side: 'server',
      requestId: 'r1',
      durationMs: 21,
      cacheStored: true,
      at: now - 8000,
    }),
  ],
  requests: [
    {
      id: 'r1',
      method: 'GET',
      url: '/checkout',
      status: 200,
      at: now - 8100,
      durationMs: 148,
      renderMs: 131,
      bytes: 48_213,
      renderMode: 'server',
      fetches: 3,
      fetchMs: 65,
      headers: {},
    },
  ],
  pages: [
    {
      pageId: 'shop',
      url: '/checkout',
      initialUrl: '/checkout',
      title: 'Shop',
      firstSeenAt: now - 7900,
      reportedAt: now,
      ssrRequestId: 'r1',
      hydration: {
        enabled: true,
        hydratedComponents: 10,
        hydratedNodes: 412,
        componentsSkippedHydration: 0,
        nodes: { hydrated: 412, skipped: 0, mismatched: 0 },
        mismatches: [],
        skipHydrationHosts: [],
        warnings: [],
        warningsCaptured: true,
        stableMs: 212,
      },
      calls: [
        call('h1', '/api/cart', { cacheHit: true, durationMs: 0, at: now - 7800 }),
        call('h2', '/api/products', { cacheHit: true, durationMs: 0, at: now - 7800 }),
        call('h3', '/api/user', { cacheHit: true, durationMs: 0, at: now - 7800 }),
        call('h4', '/api/shipping?zip=10115', { durationMs: 37, at: now - 3000 }),
        call('h5', '/api/coupons/SPRING', { durationMs: 24, at: now - 2000 }),
      ],
    },
  ],
  rules: [],
  ssrOverrides: [],
};

const SEEDS = {
  'pangular:component-tree': COMPONENTS,
  'pangular:signal-graph': SIGNALS,
  'pangular:router': ROUTER,
  'pangular:http': HTTP,
};

/** The dump's record format (@ungap/structured-clone JSON), for plain JSON values. */
function encodeRecord(value) {
  const list = [];
  const walk = (item) => {
    const at = list.length;
    if (item === undefined) list.push([-1]);
    else if (item === null || typeof item !== 'object') list.push([0, item]);
    else if (Array.isArray(item)) {
      list.push([1, []]);
      list[at][1] = item.map(walk);
    } else {
      list.push([2, []]);
      list[at][1] = Object.entries(item).map(([key, entry]) => [walk(key), walk(entry)]);
    }
    return at;
  };
  walk(value);
  return JSON.stringify(list);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const context = await browser.newContext({
  colorScheme: 'dark',
  reducedMotion: 'reduce',
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});
await context.route('**/__rpc-dump/devframe~rpc~server-state~get.record.*.json', async (r) => {
  const response = await r.fetch();
  const body = await response.text();
  const key = Object.keys(SEEDS).find((name) => body.includes(`"${name}"`));
  if (!key) return r.fulfill({ response });
  return r.fulfill({
    response,
    body: encodeRecord({ inputs: [key], output: JSON.parse(JSON.stringify(SEEDS[key])) }),
  });
});

const SHOTS = [
  { name: 'components', hash: 'tab=components', ready: '.tree [role="treeitem"]' },
  { name: 'signals', hash: 'tab=signals', ready: 'main svg, main canvas' },
  {
    name: 'routes',
    hash: 'tab=routes',
    ready: 'main',
    prepare: (page) => page.locator('#router-tab-navigations').click(),
  },
  { name: 'ssr-http', hash: 'tab=network', ready: 'main' },
];

const only = process.env.SHOT;
for (const shot of SHOTS) {
  if (only && shot.name !== only) continue;
  const page = await context.newPage();
  await page.goto(`${base}#${shot.hash}`);
  await page.locator('.status.connected').waitFor({ timeout: 20_000 });
  await page
    .locator(shot.ready)
    .first()
    .waitFor({ timeout: 20_000 })
    .catch(() => {});
  await shot.prepare?.(page).catch((error) => console.warn(`${shot.name}: ${error.message}`));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, `${shot.name}.png`) });
  console.log(`saved ${shot.name}.png`);
  await page.close();
}
await browser.close();
server.close();
