import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import { analogMiddleware, clearCalls, recentCalls } from '../analog-server-log.ts';
import type { HttpCall } from '../http-rules.ts';
import { redactCall } from '../redaction.ts';
import { applyRouterEvent, redactUrl, type NavigationRecord } from '../router.ts';
import { explainNavigationText, type RouterPage } from '../rpc/router-tools.ts';
import { listHttpCallsText } from '../rpc/http-tools.ts';
import { lintRoutes } from '../rpc/router-config-tools.ts';
import { maskEmails, redactText } from '../text-redact.ts';

describe('emails in URLs', () => {
  it('masks an address in a path segment, a query value and a fragment', () => {
    expect(redactUrl('/invite/ada@example.com')).toBe('/invite/[email]');
    expect(redactUrl('/invite/ada@example.com/accept')).toBe('/invite/[email]/accept');
    expect(redactUrl('/users?email=ada.lovelace+news@mail.example.co.uk&page=2')).toBe(
      '/users?email=[email]&page=2',
    );
    expect(redactUrl('/users#ada@example.com')).toBe('/users#[email]');
    expect(redactUrl('/users;contact=ada@example.com')).toBe('/users;contact=[email]');
    expect(redactUrl('https://app.example.com/u/ada@example.com?x=1')).toBe(
      'https://app.example.com/u/[email]?x=1',
    );
  });

  it('masks an address whose @ is percent-encoded', () => {
    expect(redactUrl('/invite/ada%40example.com')).toBe('/invite/[email]');
    expect(redactUrl('/search?q=ada%2Bnews%40example.com')).toBe('/search?q=[email]');
    expect(redactUrl('/login?next=%2Finvite%2Fada%40example.com')).toBe(
      '/login?next=%2Finvite%2F[email]',
    );
    expect(redactUrl('mailto:ada@example.com')).toBe('mailto:[email]');
  });

  it('masks every address and keeps the text around them', () => {
    expect(redactUrl('/a/ada@example.com/b/bob@example.org?to=eve%40example.net#x')).toBe(
      '/a/[email]/b/[email]?to=[email]#x',
    );
  });

  it('leaves an @ that is not part of an address alone', () => {
    for (const url of [
      '/@angular/core',
      '/npm/@scope/package@1.2.3/index.js',
      'https://cdn.example.com/npm/lodash@4.17.21/lodash.min.js',
      'https://example.com/users/@alice',
      'http://localhost:4200/a:b@c',
      '/%40fs/etc/passwd',
      '/users/ada@localhost',
      'ssh://git@github.com/org/repo.git',
      'https://bob@example.com/path',
    ]) {
      expect(redactUrl(url), url).toBe(url);
    }
  });

  it('still hides a URL password and keeps the host', () => {
    expect(redactUrl('https://ada:hunter22@api.example.com/u/ada@example.com')).toBe(
      'https://ada:[redacted]@api.example.com/u/[email]',
    );
  });

  it('hides a known secret whole when an address overlaps its start', () => {
    const out = redactText('/files/a@bob.comXYZ123/raw', ['bob.comXYZ123'], 'url');
    expect(out).not.toContain('XYZ');
    expect(out).not.toContain('123');
    expect(out).toContain('[redacted]');
  });

  it('stays fast on long text with many @ and %40 signs', () => {
    const nasty = [
      'a%40'.repeat(50_000),
      'a@'.repeat(50_000),
      `${'a.'.repeat(50_000)}@`,
      `x@${'a.'.repeat(50_000)}1`,
      '%2B'.repeat(50_000),
    ];
    const start = performance.now();
    for (const text of nasty) maskEmails(text);
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe('emails in URLs shown to the panel and to agents', () => {
  it('masks them in a recorded HTTP call and in list-http-calls', () => {
    const call: HttpCall = {
      id: 'c1',
      url: '/api/users/ada@example.com?to=bob%40example.org',
      pageUrl: '/profile/ada@example.com',
      redirectedTo: '/api/users/ada%40example.com/v2',
      method: 'GET',
      status: 200,
      durationMs: 3,
      side: 'client',
      cacheHit: false,
      faulted: false,
      at: 1_000,
    };
    const safe = redactCall(call);
    expect(safe.url).toBe('/api/users/[email]?to=[email]');
    expect(safe.pageUrl).toBe('/profile/[email]');
    expect(safe.redirectedTo).toBe('/api/users/[email]/v2');
    const text = listHttpCallsText({ serverCalls: [call], pages: [] }, {}, 2_000);
    expect(text).toContain('/api/users/[email]');
    expect(text).not.toContain('example');
  });

  it('masks them in a router navigation and in explain-navigation', () => {
    const navigations: NavigationRecord[] = [];
    applyRouterEvent(navigations, { type: 0, id: 1, url: '/invite/ada@example.com' }, 0);
    applyRouterEvent(
      navigations,
      { type: 1, id: 1, urlAfterRedirects: '/invite/ada%40example.com/welcome' },
      5,
    );
    expect(navigations[0]).toMatchObject({
      url: '/invite/[email]',
      finalUrl: '/invite/[email]/welcome',
    });
    const page: RouterPage = {
      pageId: 'aaaa',
      snapshot: null,
      navigations,
      reportedAt: 1_000,
      changedAt: 1_000,
    } as unknown as RouterPage;
    const text = explainNavigationText({ pages: [page] }, {}, 1_000);
    expect(text).toContain('/invite/[email]');
    expect(text).not.toContain('example');
  });

  it('still flags the email-in-url lint on a navigation the page already masked', () => {
    const page = {
      pageId: 'aaaa',
      config: [],
      navigations: [{ id: 1, url: redactUrl('/invite/ada@example.com'), trigger: 'imperative' }],
    } as unknown as Parameters<typeof lintRoutes>[0];
    const finding = lintRoutes(page).find((f) => f.rule === 'email-in-url');
    expect(finding?.route).toBe('/invite/[email]');
  });
});

class FakeRes extends EventEmitter {
  statusCode = 200;
  headers: Record<string, string> = {};
  getHeader(name: string) {
    return this.headers[name.toLowerCase()];
  }
  write() {
    return true;
  }
  end() {
    this.emit('finish');
    return this;
  }
}

describe('emails in Analog server call URLs', () => {
  afterEach(() => clearCalls());

  it('masks them in the call URL, route and redirect location', () => {
    const req = {
      url: '/index.html',
      originalUrl: '/api/_analog/pages/invite/ada@example.com?to=bob%40example.org',
      method: 'POST',
      headers: {},
    } as never;
    const res = new FakeRes();
    res.statusCode = 303;
    res.headers['location'] = '/welcome/ada@example.com';
    analogMiddleware('api')(req, res as never, () => undefined);
    res.end();
    const call = recentCalls().at(-1)!;
    expect(call.url).toBe('/api/_analog/pages/invite/[email]?to=[email]');
    expect(call.route).toBe('/invite/[email]');
    expect(call.location).toBe('/welcome/[email]');
  });
});
