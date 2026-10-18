// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { setRedaction } from '../forms-privacy.ts';
import { decodePayload, sanitizePayload } from '../http-payload.ts';
import { redactPreview } from '../http-redact.ts';
import { redactText } from '../router.ts';

afterEach(() => setRedaction());

const unsigned = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0NTY3In0.';

function stateDoc(state: Record<string, unknown>): Document {
  document.body.innerHTML = '';
  const script = document.createElement('script');
  script.id = 'ng-state';
  script.type = 'application/json';
  script.textContent = JSON.stringify(state);
  document.body.append(script);
  return document;
}

describe('TransferState payload redaction', () => {
  it('masks secret keys in an entry the page clipped to a string', () => {
    const doc = stateDoc({
      big: { password: 'hunter2', apiKey: 'sk-live-ABC', filler: 'x'.repeat(21_000) },
    });
    const text = JSON.stringify(sanitizePayload(decodePayload(doc)));
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('sk-live-ABC');
  });

  it('masks secret keys in a text body that holds JSON', () => {
    const out = sanitizePayload({
      found: true,
      size: 1,
      entries: [{ key: 'k', size: 1, value: '{"password":"hunter2","name":"ada"}' }],
    });
    const text = JSON.stringify(out);
    expect(text).not.toContain('hunter2');
    expect(text).toContain('ada');
  });

  it('applies redaction.secretNames to keys inside text bodies', () => {
    setRedaction({ secretNames: ['licenseNumber'] });
    const out = sanitizePayload({
      found: true,
      size: 1,
      entries: [{ key: 'k', size: 1, value: { body: '{"licenseNumber":"D1234567"}' } }],
    });
    expect(JSON.stringify(out)).not.toContain('D1234567');
  });
});

describe('unsigned JWTs', () => {
  it('masks a token with an empty signature in text and previews', () => {
    expect(redactText(`token ${unsigned} end`)).not.toContain('eyJ');
    expect(redactPreview(`{"x":"${unsigned}"}`)).not.toContain('eyJ');
  });
});

describe('XML previews', () => {
  it('masks elements and attributes with secret names, and keeps the rest', () => {
    expect(redactPreview('<login><user>ada</user><password>s3cr3t-xml</password></login>')).toBe(
      '<login><user>ada</user><password>[redacted]</password></login>',
    );
    expect(redactPreview('<auth:apiKey xmlns:auth="urn:a">k3y-value</auth:apiKey>')).toBe(
      '<auth:apiKey xmlns:auth="urn:a">[redacted]</auth:apiKey>',
    );
    expect(redactPreview('<cfg><secret><![CDATA[c-d-a-t-a]]></secret></cfg>')).not.toContain(
      'c-d-a-t-a',
    );
    expect(redactPreview('<login password="attr-s3cr3t" user="ada"/>')).toBe(
      '<login password="[redacted]" user="ada"/>',
    );
  });

  it('masks a secret element a clipped preview cuts short', () => {
    expect(redactPreview('<login><password>s3cr3t-cut')).toBe('<login><password>[redacted]');
  });
});
