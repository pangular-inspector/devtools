import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { initPangularHub } from '@pangular-inspector/devtools/hub';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

const auth = process.env['PANGULAR_AUTH'] === 'true';
const devtools = initPangularHub({
  ws: { sidecar: true },
  auth,
});
app.use(devtools.nodeMiddleware);
// Traces each SSR request for the SSR & HTTP tab and adds a Server-Timing header.
app.use(devtools.ssrMiddleware);

const products = [
  { id: 1, name: 'Signal lamp', price: 24, stock: 12 },
  { id: 2, name: 'Hydration flask', price: 18, stock: 0 },
  { id: 3, name: 'Router compass', price: 42, stock: 5 },
  { id: 4, name: 'Injector toolkit', price: 65, stock: 3 },
];

/**
 * Demo API for the SSR & HTTP example. `?fail=503` answers with that status
 * and `?delay=800` waits first, so errors can also be produced by the backend.
 */
app.get('/api/products{/:id}', (req, res) => {
  const fail = Number(req.query['fail']);
  const delay = Math.min(Math.max(Number(req.query['delay']) || 0, 0), 5000);
  setTimeout(() => {
    if (Number.isInteger(fail) && fail >= 400 && fail <= 599) {
      res.status(fail).json({ error: `Simulated ${fail} from the demo API` });
      return;
    }
    if (req.params['id'] === undefined) {
      res.json(products);
      return;
    }
    const product = products.find((p) => p.id === Number(req.params['id']));
    if (product) res.json(product);
    else res.status(404).json({ error: 'No such product' });
  }, delay);
});

/** Access check for the SSR guards example: product 2 is sold out, unknown ids answer 404. */
app.get('/api/access/:id', (req, res) => {
  const delay = Math.min(Math.max(Number(req.query['delay']) || 0, 0), 5000);
  setTimeout(() => {
    const product = products.find((p) => p.id === Number(req.params['id']));
    if (!product) res.status(404).json({ allowed: false });
    else res.json({ allowed: product.stock > 0, soldOut: product.stock === 0 });
  }, delay);
});

/** A POST for the SSR requests example; the transfer cache leaves POSTs out by default. */
app.post('/api/quote', express.json({ limit: '1kb' }), (req, res) => {
  const ids: unknown[] = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 20) : [];
  const picked = products.filter((p) => ids.includes(p.id));
  res.json({ items: picked.length, total: picked.reduce((sum, p) => sum + p.price, 0) });
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
