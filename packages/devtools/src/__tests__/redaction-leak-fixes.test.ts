// @vitest-environment jsdom
// Leaks the corpus test (redaction-corpus.test.ts) found, one case each.
import { afterEach, describe, expect, it } from 'vitest';
import { setRedaction } from '../forms-privacy.ts';
import { redactText } from '../text-redact.ts';
import { redactBody, redactMessage } from '../analog-server-log.ts';
import { redactHeaders } from '../http-redact.ts';
import { serialize as ngrxSerialize } from '../ngrx-shared.ts';

afterEach(() => setRedaction());

const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

describe('leaks found by the corpus', () => {
  it('masks a pair whose key was read as the value of the word before it', () => {
    expect(redactText('Error: password: "Tr0ub4dor-3"')).toBe('Error: password: "[redacted]"');
    expect(redactText('Error: token: "abc123"')).toBe('Error: token: "[redacted]"');
    expect(redactText('Error: password="abc123"')).toBe('Error: password="[redacted]"');
    expect(redactText('<a xmlns:auth="urn:a">')).toBe('<a xmlns:auth="urn:a">');
    // Prose stays as it was.
    expect(redactText('Error: token: expired')).toBe('Error: token: expired');
    expect(redactText('Status: code: 404')).toBe('Status: code: 404');
  });

  it('masks the credential after a scheme in an Analog server body that is not JSON', () => {
    expect(redactBody('Authorization: ApiKey Zq7Lm2Pw9Xr4Tn8Vb3Kd')).not.toContain(
      'Zq7Lm2Pw9Xr4Tn8Vb3Kd',
    );
  });

  it('masks secret pairs in the fragment and matrix params of an Analog server message', () => {
    expect(redactMessage('/login#access_token=abc123')).toBe('/login#access_token=[redacted]');
    expect(redactMessage('/a;sid=abc123')).toBe('/a;sid=[redacted]');
  });

  it('masks a header whose camelCase name looks secret', () => {
    expect(redactHeaders({ newPassword: 'C0rrectHorse', 'x-request-id': '42' })).toEqual({
      newpassword: '[redacted]',
      'x-request-id': '42',
    });
  });

  it('masks tokens used as NgRx state keys, keeping both entries', () => {
    const other = JWT.replace('dozj', 'zzzz');
    const out = ngrxSerialize({ [JWT]: 1, [other]: 2, user: 'ada' }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toContain('eyJ');
    expect(Object.values(out).sort()).toEqual([1, 2, 'ada']);
    expect(out['user']).toBe('ada');
  });
});

describe('a value read again as the next key', () => {
  // Reading `password:` again as a key must not rescan the rest of a long chain of pairs.
  it.each([
    ['compact', 'a:'],
    ['spaced', 'a: '],
    ['spaced with =', 'a= '],
  ])('stays linear on a %s chain of 20000 pairs', (_name, unit) => {
    const started = performance.now();
    redactText(unit.repeat(20_000), [], 'text');
    expect(performance.now() - started).toBeLessThan(4000);
  });

  it('still finds a secret after a chain of plain pairs', () => {
    const out = redactText(`${'a: '.repeat(50)}password: "hunter2"`, [], 'text');
    expect(out).not.toContain('hunter2');
  });

  it.each([
    'Error: context:password: "hunter2"',
    'Error: context:password: hunter2',
    'Error: a:b:c:token: hunter2',
    'Error: context:password= "hunter2"',
    'Error: context:password= hunter2',
    'Error: context:password="hunter2"',
    `Error: ${'a:'.repeat(5000)}password: hunter2`,
  ])('finds a secret after a compact chain of key names: %s', (text) => {
    expect(redactText(text, [], 'text')).not.toContain('hunter2');
  });

  it('keeps a namespaced attribute after a key as one name', () => {
    expect(redactText('Log: xmlns:auth="urn:a"', [], 'text')).toContain('urn:a');
    expect(redactText('Log: xmlns:password="urn:a"', [], 'text')).toContain('urn:a');
  });
});
