import { describe, expect, it } from 'vitest';
import { curlSnippet, fetchSnippet } from '../http-data.ts';
import { redactCall } from '../redaction.ts';
import type { HttpCall } from '../http-rules.ts';

const call = (overrides: Partial<HttpCall> = {}): HttpCall => ({
  id: 'c1',
  url: '/api/products?page=2',
  method: 'GET',
  side: 'client',
  status: 200,
  durationMs: 5,
  at: 0,
  cacheHit: false,
  faulted: false,
  ...overrides,
});

describe('fetchSnippet', () => {
  it('writes a bare fetch for a GET with no headers', () => {
    expect(fetchSnippet(call())).toBe('await fetch("/api/products?page=2");');
  });

  it('adds the method and headers, and resolves a client URL against the origin', () => {
    const text = fetchSnippet(
      call({ method: 'put', requestHeaders: { 'content-type': 'application/json' } }),
      'http://localhost:4200',
    );
    expect(text).toBe(
      [
        '// The request body was not recorded.',
        'await fetch("http://localhost:4200/api/products?page=2", {',
        '  "method": "PUT",',
        '  "headers": {',
        '    "content-type": "application/json"',
        '  }',
        '});',
      ].join('\n'),
    );
  });

  it('keeps a server URL as recorded', () => {
    const text = fetchSnippet(call({ side: 'server', url: 'http://api/x' }), 'http://localhost');
    expect(text).toBe('await fetch("http://api/x");');
  });
});

describe('curlSnippet', () => {
  it('quotes for the shell and puts each header on its own line', () => {
    const text = curlSnippet(
      call({
        method: 'POST',
        url: "/api/search?q=it's",
        requestHeaders: { accept: 'application/json', 'x-note': "a'b" },
      }),
    );
    expect(text).toBe(
      [
        '# The request body was not recorded.',
        "curl '/api/search?q=it'\\''s' \\",
        "  -X 'POST' \\",
        "  -H 'accept: application/json' \\",
        "  -H 'x-note: a'\\''b'",
      ].join('\n'),
    );
  });

  it('uses --head for HEAD', () => {
    expect(curlSnippet(call({ method: 'HEAD' }))).toBe("curl '/api/products?page=2' \\\n  --head");
  });
});

describe('copy snippets and redaction', () => {
  it('keeps masked values masked and says they must be filled in', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const masked = redactCall(
      call({
        url: `/api/me?access_token=${jwt}`,
        requestHeaders: { authorization: `Bearer ${jwt}`, cookie: 'sid=abc' },
      }),
    );
    for (const text of [fetchSnippet(masked), curlSnippet(masked)]) {
      expect(text).not.toContain(jwt);
      expect(text).not.toContain('sid=abc');
      expect(text).toContain('[redacted]');
      expect(text).toContain('Masked values ([redacted]) must be filled in before it runs.');
    }
  });
});
