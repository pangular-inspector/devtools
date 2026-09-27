import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { initDevframe } from 'devframe/initiate';
import ngDevtools from '@santoshyadavdev/ng-devtools/devframe';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

const auth = process.env['NG_DEVTOOLS_AUTH'] === 'true';
const devtools = initDevframe(ngDevtools, {
  base: '/__ng-devtools/',
  ws: false,
  auth,
  allowedOrigins: false,
});
app.use(devtools.nodeMiddleware);

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
