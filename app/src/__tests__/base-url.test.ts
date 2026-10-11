import { describe, expect, it } from 'vitest';
import { detectBaseURL } from '../base-url';

function at(href: string) {
  const url = new URL(href);
  return {
    href: url.href,
    origin: url.protocol === 'chrome-extension:' ? `${url.protocol}//${url.host}` : url.origin,
    protocol: url.protocol,
    pathname: url.pathname,
    search: url.search,
  };
}

describe('detectBaseURL', () => {
  it('tries the embedded server path, then the folder the panel is served from', () => {
    expect(detectBaseURL(at('http://localhost:5173/'))).toEqual(['/__pangular/', './']);
    expect(detectBaseURL(at('http://127.0.0.1:4782/reports/today/'))).toEqual([
      '/__pangular/',
      './',
    ]);
  });

  it('lets devframe pick the base when the panel is served under the server path', () => {
    expect(detectBaseURL(at('http://localhost:4200/__pangular/'))).toBeUndefined();
    expect(detectBaseURL(at('http://localhost:4200/__devframes/pangular/'))).toBeUndefined();
  });

  it('accepts a same origin baseURL query', () => {
    const loc = at('http://localhost:4200/panel/?baseURL=/custom/');
    expect(detectBaseURL(loc)).toBe('/custom/');
    const absolute = at(
      'http://localhost:4200/panel/?baseURL=' + encodeURIComponent('http://localhost:4200/x/'),
    );
    expect(detectBaseURL(absolute)).toBe('http://localhost:4200/x/');
  });

  it('ignores a cross origin baseURL query on a web page', () => {
    const loc = at(
      'http://localhost:4200/panel/?baseURL=' + encodeURIComponent('https://evil.example/'),
    );
    expect(detectBaseURL(loc)).toEqual(['/__pangular/', './']);
  });

  it('ignores a malformed baseURL query instead of throwing', () => {
    const loc = at('http://localhost:4200/panel/?baseURL=' + encodeURIComponent('http://['));
    expect(() => detectBaseURL(loc)).not.toThrow();
    expect(detectBaseURL(loc)).toEqual(['/__pangular/', './']);
  });

  it('accepts an http or https host from the extension panel', () => {
    const base = 'chrome-extension://abc/ui/index.html?baseURL=';
    const http = at(base + encodeURIComponent('http://localhost:4200/__pangular/'));
    expect(detectBaseURL(http)).toBe('http://localhost:4200/__pangular/');
    const https = at(base + encodeURIComponent('https://app.example/__pangular/'));
    expect(detectBaseURL(https)).toBe('https://app.example/__pangular/');
  });

  it('rejects other schemes from the extension panel', () => {
    const loc = at(
      'chrome-extension://abc/ui/index.html?baseURL=' + encodeURIComponent('javascript:alert(1)'),
    );
    expect(detectBaseURL(loc)).toEqual(['/__pangular/', './']);
  });
});
