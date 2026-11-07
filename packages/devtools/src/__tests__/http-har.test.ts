import { describe, expect, it } from 'vitest';
import { harLog, type RecordedCall } from '../http-data.ts';
import { redactCall } from '../redaction.ts';

const recorded = (overrides: Partial<RecordedCall> = {}): RecordedCall => ({
  id: 'c1',
  url: '/api/products?token=[redacted]&page=2',
  method: 'GET',
  side: 'client',
  status: 200,
  durationMs: 40,
  at: Date.UTC(2026, 0, 1, 0, 0, 1),
  cacheHit: false,
  faulted: false,
  preview: '{"items":[]}',
  requestHeaders: { authorization: '[redacted]', accept: 'application/json' },
  responseHeaders: { 'content-type': 'application/json' },
  ...overrides,
});

describe('harLog', () => {
  it('writes HAR 1.2 entries oldest first, the SSR document request included', () => {
    const har = harLog({
      calls: [
        recorded(),
        recorded({
          id: 's1',
          side: 'server',
          url: 'http://api.test/api/products',
          at: Date.UTC(2026, 0, 1),
          requestId: 'r1',
          preview: undefined,
          responseHeaders: undefined,
        }),
      ],
      ssrRequest: {
        id: 'r1',
        method: 'GET',
        url: '/shop',
        status: 200,
        at: Date.UTC(2025, 11, 31, 23, 59, 59),
        durationMs: 120,
        renderMs: 100,
        headers: { 'server-timing': 'pangular;desc="r1", render;dur=100' },
      },
      title: 'Shop',
      origin: 'http://localhost:4200',
    });
    expect(har.log.version).toBe('1.2');
    expect(har.log.pages).toEqual([
      { id: 'page_1', title: 'Shop', startedDateTime: '2025-12-31T23:59:59.000Z', pageTimings: {} },
    ]);
    expect(har.log.entries.map((e) => [e._side, e.request.url])).toEqual([
      ['document', 'http://localhost:4200/shop'],
      ['server', 'http://api.test/api/products'],
      ['client', 'http://localhost:4200/api/products?token=[redacted]&page=2'],
    ]);
    const [document, server, client] = har.log.entries;
    expect(document.timings).toEqual({ send: 0, wait: 100, receive: 20 });
    expect(document.response.headers).toEqual([
      { name: 'server-timing', value: 'pangular;desc="r1", render;dur=100' },
    ]);
    expect(server.comment).toBe('SSR request r1');
    expect(client).toMatchObject({
      time: 40,
      request: {
        method: 'GET',
        headers: [
          { name: 'authorization', value: '[redacted]' },
          { name: 'accept', value: 'application/json' },
        ],
        queryString: [
          { name: 'token', value: '[redacted]' },
          { name: 'page', value: '2' },
        ],
      },
      response: {
        status: 200,
        content: { mimeType: 'application/json', text: '{"items":[]}', size: 12 },
      },
    });
  });

  it('keeps relative URLs without an origin and notes rule and cache outcomes', () => {
    const har = harLog({
      calls: [
        recorded({ cacheHit: true }),
        recorded({ id: 'c2', status: 0, faulted: true, error: 'Http failure', preview: undefined }),
        recorded({ id: 'c3', status: 0, cancelled: true, error: 'cancelled', preview: undefined }),
      ],
    });
    const [hit, failed, cancelled] = har.log.entries;
    expect(hit.request.url).toBe('/api/products?token=[redacted]&page=2');
    expect(hit._notes).toEqual(['transfer cache']);
    expect(failed.response).toMatchObject({ status: 0, statusText: 'Http failure' });
    expect(failed.response.content.text).toBeUndefined();
    expect(failed._notes).toEqual(['failed by a fault rule']);
    expect(cancelled.response.statusText).toBe('cancelled');
    expect(har.log.comment).toContain('masked');
  });

  it('notes a clipped body', () => {
    const [entry] = harLog({ calls: [recorded({ preview: 'x'.repeat(2001) })] }).log.entries;
    expect(entry.response.content.comment).toBe('Clipped at 2000 characters.');
  });

  it('carries no secret from a call the server masked', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const masked = redactCall({
      ...recorded(),
      url: `/api/me?access_token=${jwt}`,
      requestHeaders: { authorization: `Bearer ${jwt}`, cookie: 'sid=abc' },
      preview: JSON.stringify({ password: 'hunter2', token: jwt }),
    });
    const text = JSON.stringify(harLog({ calls: [masked] }));
    expect(text).not.toContain(jwt);
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('sid=abc');
  });
});
