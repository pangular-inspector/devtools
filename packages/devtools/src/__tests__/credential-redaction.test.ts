// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { redactMessage as serverLogMessage } from '../analog-server-log.ts';
import { REDACTED, isRedactedKey, isSecretKey, redactMessage } from '../forms-privacy.ts';
import type { HttpCall } from '../http-rules.ts';
import { redactCall, redactPreview } from '../http-redact.ts';
import { serialize as ngrxSerialize } from '../ngrx-shared.ts';
import {
  isSecretKey as isRouterSecretKey,
  redactRecord,
  redactText,
  redactUrl,
} from '../router.ts';
import { serialize } from '../serialize.ts';

const basic = `Basic ${btoa('alice:hunter22')}`;

describe('URL passwords', () => {
  const url = 'https://alice:hunter22@api.example.com/v1/users?page=2';

  it('hides the password and keeps the user in every helper', () => {
    const safe = `https://alice:${REDACTED}@api.example.com/v1/users?page=2`;
    expect(redactUrl(url)).toBe(safe);
    expect(redactText(url)).toBe(safe);
    expect(redactMessage(url)).toBe(safe);
    expect(serialize(url)).toBe(safe);
    expect(ngrxSerialize({ dsn: url })).toEqual({ dsn: safe });
    expect(serverLogMessage(`GET ${url}`)).toBe(`GET ${safe}`);
  });

  it('hides it in recorded HTTP calls and inside text', () => {
    const call = { url, pageUrl: url, error: `failed to reach ${url}` } as HttpCall;
    const safe = redactCall(call);
    for (const text of [safe.url, safe.pageUrl, safe.error]) {
      expect(text).toContain(`alice:${REDACTED}@`);
      expect(text).not.toContain('hunter22');
    }
    expect(redactPreview(JSON.stringify({ db: 'postgres://app:s3cr3t@db:5432/x' }))).toBe(
      JSON.stringify({ db: `postgres://app:${REDACTED}@db:5432/x` }),
    );
    expect(redactMessage('mongodb+srv://u:p%40ss@cluster0.example.net/db')).toBe(
      `mongodb+srv://u:${REDACTED}@cluster0.example.net/db`,
    );
  });

  it('leaves URLs without a password alone', () => {
    for (const text of [
      'ssh://git@github.com/org/repo.git',
      'https://example.com/users/@alice',
      'http://localhost:4200/a:b@c',
      'mailto:alice@example.com',
      'https://example.com:8443/path',
    ]) {
      expect(redactUrl(text), text).toBe(text);
      expect(redactMessage(text), text).toBe(text);
    }
  });
});

describe('Authorization credentials', () => {
  it('hides Basic, Digest and Token credentials and keeps the scheme', () => {
    expect(redactMessage(basic)).toBe(`Basic ${REDACTED}`);
    expect(redactMessage('Token 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b')).toBe(
      `Token ${REDACTED}`,
    );
    expect(
      redactMessage(
        'Digest username="alice", realm="api", nonce="dcd98b", response="6629fae49393a05397450978507c4ef1"',
      ),
    ).toBe(`Digest ${REDACTED}`);
    expect(serialize(`sent ${basic.replace('Basic', 'basic')}`)).toBe(`sent basic ${REDACTED}`);
  });

  it('hides any known scheme after an Authorization header name', () => {
    expect(redactText('Authorization: Negotiate YIIBhwYGKwYBBQUCoIIBezCCAXeg')).toBe(
      `Authorization: Negotiate ${REDACTED}`,
    );
    expect(serverLogMessage('proxy-authorization=NTLM TlRMTVNTUAABAAAAB4IIog')).toBe(
      `proxy-authorization=NTLM ${REDACTED}`,
    );
    expect(redactPreview('{"headers":{"Authorization":"Basic abc')).not.toContain('abc');
  });

  it('hides credentials in values whatever the key is called', () => {
    expect(serialize({ header: basic, auth: basic })).toEqual({
      header: `Basic ${REDACTED}`,
      auth: `Basic ${REDACTED}`,
    });
    expect(redactRecord({ h: 'Token abcd1234efgh5678' })).toEqual({ h: `Token ${REDACTED}` });
  });

  it('leaves ordinary words alone', () => {
    for (const text of [
      'Basic usage of the API',
      'Basic plan',
      'Token expired, please sign in again',
      'Token refresh failed',
      'Digest of the week',
      'authorization: required for this endpoint',
    ]) {
      expect(redactMessage(text), text).toBe(text);
      expect(redactText(text), text).toBe(text);
    }
  });
});

describe('secret key names', () => {
  const masked = [
    'authorization',
    'Authorization',
    'proxy-authorization',
    'bearer',
    'Bearer',
    'bearerToken',
    'x-api-key',
    'apiKey',
    'api_key',
    'access_token',
    'accessToken',
    'refresh_token',
    'client_secret',
    'clientSecret',
    'authToken',
    'authHeader',
    'authKey',
    'auth_code',
    'basicAuth',
  ];
  const kept = [
    'author',
    'authorName',
    'authors',
    'authored',
    'authority',
    'authorize',
    'authorized',
    'oauthProvider',
    'authStatus',
    'isAuthenticated',
    'keyboard',
    'monkey',
  ];

  it('masks credential-looking keys', () => {
    for (const key of masked) {
      expect(isSecretKey(key), key).toBe(true);
      expect(isRedactedKey(key), key).toBe(true);
      expect(isRouterSecretKey(key), key).toBe(true);
    }
    expect(serialize({ bearer: 'abc', apiKey: 'k' })).toEqual({
      bearer: REDACTED,
      apiKey: REDACTED,
    });
  });

  it('keeps ordinary names that only start like a secret one', () => {
    for (const key of kept) {
      expect(isSecretKey(key), key).toBe(false);
      expect(isRedactedKey(key), key).toBe(false);
    }
    expect(serialize({ author: 'Ada', authorName: 'Ada Lovelace' })).toEqual({
      author: 'Ada',
      authorName: 'Ada Lovelace',
    });
  });
});
