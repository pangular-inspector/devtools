// @vitest-environment jsdom
import '@angular/compiler';
import { createHash } from 'node:crypto';
import { TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpParams,
  HttpRequest,
  provideHttpClient,
  ɵwithHttpTransferCache as withHttpTransferCache,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { sha256Hex, transferCacheKeys } from '../http-cache-key.ts';
import { angularAtLeast, initAngularTestBed } from './angular-version.ts';

initAngularTestBed();

afterEach(() => TestBed.resetTestingModule());

describe('sha256Hex', () => {
  it('matches node:crypto', () => {
    for (const text of ['', 'abc', 'GET\0json\0/api\0\0page=1', 'é'.repeat(80)]) {
      expect(sha256Hex(text)).toBe(createHash('sha256').update(text).digest('hex'));
    }
  });
});

/** The DJB2 variant Angular 16.0 to 17.0 hash the key with (makeCacheKey in @angular/common/http). */
function angular16Hash(value: string): string {
  let hash = 0;
  for (const char of value) hash = (Math.imul(31, hash) + char.charCodeAt(0)) << 0;
  return String(hash + 2147483647 + 1);
}

describe('transferCacheKeys for each Angular key format', () => {
  it('includes the 16.0 to 17.0 key, which leaves the body out', () => {
    const req = new HttpRequest('GET', '/api/feed', null, {
      params: new HttpParams({ fromObject: { page: 1, tag: 'b' } }),
    });
    expect(transferCacheKeys(req)).toContain(angular16Hash('GET.json./api/feed?page=1&tag=b'));
  });
});

// Angular caches HTTP responses in TransferState from 16.0 (ɵwithHttpTransferCache).
describe.runIf(angularAtLeast('16.0'))('transferCacheKeys', () => {
  const cachedBy = async (stored: HttpRequest<unknown>, sent: { page: number }) => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), withHttpTransferCache({})],
    });
    const state = TestBed.inject(TransferState);
    for (const key of transferCacheKeys(stored)) {
      state.set(makeStateKey<unknown>(key), {
        b: { from: 'cache' },
        h: {},
        s: 200,
        st: 'OK',
        u: '/api/feed',
      });
    }
    const http = TestBed.inject(HttpClient);
    const answer = firstValueFrom(http.get('/api/feed', { params: sent }));
    const pending = TestBed.inject(HttpTestingController).match('/api/feed?page=' + sent.page);
    pending.forEach((req) => req.flush({ from: 'network' }));
    return answer;
  };

  it('computes the key Angular stores a request under', async () => {
    const stored = new HttpRequest('GET', '/api/feed', null, {
      params: new HttpParams({ fromObject: { page: 1 } }),
    });
    expect(await cachedBy(stored, { page: 1 })).toEqual({ from: 'cache' });
  });

  it('gives a request with other params a different key', async () => {
    const stored = new HttpRequest('GET', '/api/feed', null, {
      params: new HttpParams({ fromObject: { page: 1 } }),
    });
    expect(await cachedBy(stored, { page: 2 })).toEqual({ from: 'network' });
  });
});
