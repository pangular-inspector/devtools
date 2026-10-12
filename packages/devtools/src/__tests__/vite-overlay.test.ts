import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, resolveConfig, type InlineConfig, type ViteDevServer } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import pangularVite, { type PangularViteOptions } from '../vite.ts';
import { OVERLAY_ENTRY, overlayTags } from '../vite-overlay.ts';

const HTML = '<!doctype html><html><head></head><body><app-root></app-root></body></html>';
const servers: ViteDevServer[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
});

/** A dev server whose overlay entry is a stub file, so the test needs no build. */
async function devServer(options: PangularViteOptions = {}, config: InlineConfig = {}) {
  const root = mkdtempSync(join(tmpdir(), 'pangular-overlay-'));
  const stub = join(root, 'overlay-stub.js');
  writeFileSync(stub, 'export function initOverlay() { return Promise.resolve(() => {}); }\n');
  writeFileSync(join(root, 'index.html'), HTML);
  const server = await createServer({
    configFile: false,
    root,
    logLevel: 'silent',
    plugins: [pangularVite({ apiPrefix: 'api', ...options })],
    resolve: { alias: { [OVERLAY_ENTRY]: stub } },
    server: { middlewareMode: true, ws: false },
    optimizeDeps: { noDiscovery: true },
    ...config,
  });
  servers.push(server);
  return { server, stub };
}

const proxies = (html: string) =>
  [...html.matchAll(/src="([^"]*html-proxy[^"]*)"/g)].map((m) => m[1]!);

describe('overlayTags', () => {
  it('adds one module script at the end of the body that starts the overlay on the hub', () => {
    expect(overlayTags(HTML, '/__devframes/')).toEqual([
      {
        tag: 'script',
        attrs: { type: 'module', 'data-pangular-overlay': '' },
        children: `import { initOverlay } from "${OVERLAY_ENTRY}";\ninitOverlay({ baseURL: "/__devframes/pangular/" }).catch(console.error);`,
        injectTo: 'body',
      },
    ]);
  });

  it('points the overlay at a custom hub base', () => {
    const [tag] = overlayTags(HTML, '/devtools/');
    expect(tag!.children).toContain(`import { initOverlay } from "${OVERLAY_ENTRY}"`);
    expect(tag!.children).toContain('initOverlay({ baseURL: "/devtools/pangular/" })');
  });

  it('adds nothing when the page already loads the overlay or was already injected', () => {
    expect(
      overlayTags(`<script type="module">import '${OVERLAY_ENTRY}';</script>`, '/__devframes/'),
    ).toEqual([]);
    expect(overlayTags('<script type="module" data-pangular-overlay>x</script>', '/x/')).toEqual(
      [],
    );
    expect(
      overlayTags(`<script type="module" src="/@id/${OVERLAY_ENTRY}"></script>`, '/__devframes/'),
    ).toEqual([]);
  });

  it('still injects when the entry or the marker only appears outside a module script', () => {
    const pages = [
      `<!-- the overlay comes from ${OVERLAY_ENTRY} --><body></body>`,
      '<!-- <script type="module" data-pangular-overlay></script> --><body></body>',
      `<p>Import ${OVERLAY_ENTRY} to start it. Mark it with data-pangular-overlay.</p>`,
      `<script type="text/plain">import '${OVERLAY_ENTRY}';</script>`,
      `<script>// ${OVERLAY_ENTRY}</script>`,
    ];
    for (const html of pages) expect(overlayTags(html, '/__devframes/')).toHaveLength(1);
  });
});

describe('pangularVite overlay injection', () => {
  it('injects the overlay into the dev server HTML, resolved like an app import', async () => {
    const { server, stub } = await devServer();
    const html = await server.transformIndexHtml('/index.html', HTML);
    const [src, ...more] = proxies(html);
    expect(src).toBeDefined();
    expect(more).toEqual([]);
    const code = (await server.transformRequest(src!))?.code ?? '';
    expect(code).toContain(stub.split('/').pop());
  });

  it('shares one overlay module with an import in main.ts, so it runs once', async () => {
    const { server } = await devServer();
    writeFileSync(
      join(server.config.root, 'main.ts'),
      `if (import.meta.env.DEV) void import('${OVERLAY_ENTRY}');\n`,
    );
    const html = await server.transformIndexHtml('/index.html', HTML);
    const injected = (await server.transformRequest(proxies(html)[0]!))?.code ?? '';
    const manual = (await server.transformRequest('/main.ts'))?.code ?? '';
    const url = (code: string) => code.match(/["'](\/[^"']*overlay-stub\.js[^"']*)["']/)?.[1];
    expect(url(injected)).toBeDefined();
    expect(url(injected)).toBe(url(manual));
  });

  it('keeps working under a Vite base', async () => {
    const { server } = await devServer({}, { base: '/app/' });
    const html = await server.transformIndexHtml('/app/', HTML);
    expect(proxies(html)).toHaveLength(1);
    expect(proxies(html)[0]).toMatch(/^\/app\//);
  });

  it('does not inject with overlay: false', async () => {
    const { server } = await devServer({ overlay: false });
    const html = await server.transformIndexHtml('/', HTML);
    expect(proxies(html)).toEqual([]);
    expect(html).not.toContain('pangular');
  });

  it('does not add a second tag when the HTML already imports the overlay', async () => {
    const { server } = await devServer();
    const own = HTML.replace(
      '</body>',
      `<script type="module">import '${OVERLAY_ENTRY}';</script></body>`,
    );
    const html = await server.transformIndexHtml('/', own);
    expect(proxies(html)).toHaveLength(1);
  });

  it('is not part of a build', async () => {
    const config = await resolveConfig(
      { configFile: false, logLevel: 'silent', plugins: [pangularVite()] },
      'build',
    );
    expect(config.plugins.some((plugin) => plugin.name === 'pangular')).toBe(false);
    const serve = await resolveConfig(
      { configFile: false, logLevel: 'silent', plugins: [pangularVite()] },
      'serve',
    );
    expect(serve.plugins.some((plugin) => plugin.name === 'pangular')).toBe(true);
  });
});
