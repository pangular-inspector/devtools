import { describe, expect, it } from 'vitest';
import type { AnalogCall } from '../analog-server-log.ts';
import type { AnalogRuntimeReport } from '../analog-runtime.ts';
import { scanAnalog } from '../rpc/analog-scan.ts';
import { analogLint, restartNeeded } from '../rpc/analog-tools.ts';
import { BASE_FILES, makeProject } from './analog-fixture.ts';

const call = (extra: Partial<AnalogCall>): AnalogCall => ({
  id: 1,
  at: 1,
  kind: 'api',
  method: 'GET',
  url: '/api/v1/hello',
  route: '/api/v1/hello',
  status: 404,
  ms: 1,
  from: 'browser',
  ...extra,
});

const report = (configPaths: string[]): AnalogRuntimeReport => ({
  pageId: 'p',
  url: '/',
  analog: true,
  chain: [],
  serverContext: 'client',
  hydrated: 0,
  transferState: false,
  hydrationErrors: [],
  configPaths,
});

const lintCalls = (calls: AnalogCall[]) =>
  analogLint(scanAnalog(makeProject(BASE_FILES)), {
    pages: [],
    calls,
    duplicates: [],
    reportedAt: 1,
  }).filter((f) => f.rule === 'api-not-found');

describe('api-not-found lint', () => {
  it('does not blame the file layout for a 404 that an existing handler returned', () => {
    const calls = [
      call({ id: 1, method: 'GET', url: '/api/v1/hello', route: '/api/v1/hello' }),
      call({ id: 2, method: 'GET', url: '/api/v1/hello', route: '/api/v1/hello' }),
    ];
    expect(lintCalls(calls)).toEqual([]);
  });

  it('matches a handler with a parameter segment', () => {
    const calls = [
      call({ method: 'DELETE', url: '/api/v1/products/9', route: '/api/v1/products/9' }),
    ];
    expect(lintCalls(calls)).toEqual([]);
  });

  it('reports a missing route once however often it was called', () => {
    const calls = [
      call({ id: 1, url: '/api/v1/nope', route: '/api/v1/nope' }),
      call({ id: 2, url: '/api/v1/nope', route: '/api/v1/nope' }),
      call({ id: 3, url: '/api/v1/nope', route: '/api/v1/nope' }),
    ];
    expect(lintCalls(calls)).toHaveLength(1);
  });

  it('reports a 405 when the path exists only for another method', () => {
    const calls = [
      call({ method: 'POST', status: 405, url: '/api/v1/products', route: '/api/v1/products' }),
    ];
    expect(lintCalls(calls)).toHaveLength(1);
  });
});

describe('restartNeeded', () => {
  const project = scanAnalog(makeProject(BASE_FILES));
  const known = [
    '/',
    '/products',
    '/products/:id',
    '/login',
    '/pricing',
    '/about',
    '/dashboard',
    '/hello',
  ];

  it('notices a page added under a path the router already knows', () => {
    const missing = restartNeeded(project, report(known.filter((p) => p !== '/products/:id')));
    expect(missing).toContain('/products/:id');
  });

  it('reports nothing when the router knows every page', () => {
    expect(restartNeeded(project, report(known))).toEqual([]);
  });

  it('does not guess when the router path list hit its cap', () => {
    const capped = Array.from({ length: 500 }, (_, i) => `/p${i}`);
    expect(restartNeeded(project, report(capped))).toEqual([]);
  });
});
