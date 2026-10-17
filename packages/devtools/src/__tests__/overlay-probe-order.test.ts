// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

// The overlay hands its bases to devframe, which fetches `__connection.json`
// under each in turn until one answers. Every miss is a 404 the browser logs
// in red on the app's page.

let answering = '';
let fetched: string[] = [];

vi.mock('devframe/client', () => ({
  connectDevframe: async ({ baseURL }: { baseURL: string | string[] }) => {
    for (const base of Array.isArray(baseURL) ? baseURL : [baseURL]) {
      fetched.push(base);
      if (base !== answering) continue;
      return {
        connectionMeta: { backend: 'websocket', websocket: { path: '__ws' } },
        connection: { metaBaseUrl: new URL(`${base}__connection.json`, location.href).href },
        scope: () => ({ rpc: { call: async () => undefined, register: () => {} } }),
      };
    }
    throw new Error('no devtools server');
  },
}));

afterEach(() => {
  fetched = [];
  document.body.innerHTML = '';
  sessionStorage.clear();
});

async function missesFor(base: string): Promise<string[]> {
  answering = base;
  vi.resetModules();
  const { initOverlay } = await import('../overlay.ts');
  const stop = await initOverlay();
  stop();
  return fetched.filter((tried) => tried !== base);
}

describe('where the overlay looks first', () => {
  it('finds the Express hub and the Vite plugin without a failed request', async () => {
    expect(await missesFor('/__devframes/pangular/')).toEqual([]);
  });

  it('finds `pangular dev` behind the dev server proxy after one miss', async () => {
    expect(await missesFor('/__pangular/')).toEqual(['/__devframes/pangular/']);
  });
});
