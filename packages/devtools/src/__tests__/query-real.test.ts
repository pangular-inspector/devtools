// @vitest-environment jsdom
import '@angular/compiler';
import { Component, DestroyRef, inject } from '@angular/core';
import { QueryClient } from '@tanstack/query-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { domTree } from '../host-tree.ts';
import { createQueryCollector, findQueryClients, type QueryDebugNg } from '../query-collector.ts';
import { angularAtLeast, bootstrapRoot, STANDALONE, type BootedApp } from './angular-version.ts';

// `inject()` inside a factory needs 14.0; resolution paths need 16.2.
const supported = angularAtLeast('16.2');

/**
 * What `provideQueryClient()` from `@tanstack/angular-query-experimental`
 * registers: a factory on the `QueryClient` token that runs on first inject.
 */
function provideQueryClient(create: () => QueryClient) {
  return {
    provide: QueryClient,
    useFactory: () => {
      const client = create();
      inject(DestroyRef).onDestroy(() => client.unmount());
      client.mount();
      return client;
    },
  };
}

class TripsPage {}
Component({ ...STANDALONE, selector: 'app-root', template: 'trips' })(TripsPage);

describe('TanStack Query in a real app', () => {
  let app: BootedApp | null = null;
  afterEach(() => {
    app?.destroy();
    app = null;
    document.body.innerHTML = '';
  });

  it.runIf(supported)(
    'finds the QueryClient only once the app injected it, through the debug API',
    async () => {
      const create = vi.fn(() => new QueryClient());
      document.body.innerHTML = '<app-root></app-root>';
      app = await bootstrapRoot(TripsPage, { providers: [provideQueryClient(create)] });
      const ng = (globalThis as { ng?: QueryDebugNg }).ng!;

      expect(findQueryClients(ng, domTree())).toEqual([]);
      expect(create).not.toHaveBeenCalled();

      const client = app.injector.get(QueryClient);
      client.setQueryData(['trips'], [{ id: 7 }]);
      const found = findQueryClients(ng, domTree());
      expect(found.map((entry) => entry.client)).toEqual([client]);
      expect(found[0].scope).toBe('root');

      const report = createQueryCollector(() => ng).collect();
      expect(report.queries).toEqual([
        expect.objectContaining({ keyText: '["trips"]', status: 'success', observers: 0 }),
      ]);
      expect(create).toHaveBeenCalledTimes(1);
    },
  );
});
