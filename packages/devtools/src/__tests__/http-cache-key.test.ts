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
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import { sha256Hex, transferCacheKeys } from '../http-cache-key.ts';

try {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
} catch {
  // already initialized in this worker
}

afterEach(() => TestBed.resetTestingModule());

describe('sha256Hex', () => {
  it('matches node:crypto', () => {
    for (const text of ['', 'abc', 'GET\0json\0/api\0\0page=1', 'é'.repeat(80)]) {
      expect(sha256Hex(text)).toBe(createHash('sha256').update(text).digest('hex'));
    }
  });
});

describe('transferCacheKeys', () => {
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
