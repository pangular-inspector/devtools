import { describe, expect, it } from 'vitest';
import { redactText } from '../text-redact.ts';

describe('redactText in messages', () => {
  it('masks a secret key=value pair inside a sentence', () => {
    expect(redactText('retry with token=abc123')).toBe('retry with token=[redacted]');
    expect(redactText('failed (api_key=XYZ987, user=7)')).toBe(
      'failed (api_key=[redacted], user=7)',
    );
    expect(redactText('Error:password=hunter2')).toBe('Error:password=[redacted]');
    expect(redactText("sent 'session_id=s3ss10n' twice")).toBe(
      "sent 'session_id=[redacted]' twice",
    );
    expect(redactText('retry with key = k3y-value')).toBe('retry with key = [redacted]');
  });

  it('masks key: value and JSON-ish pairs under secret names', () => {
    expect(redactText('login failed, password: hunter2')).toBe(
      'login failed, password: [redacted]',
    );
    expect(redactText('body {"token":"abc123","page":2}')).toBe(
      'body {"token":"[redacted]","page":2}',
    );
    expect(redactText("{ 'refreshToken': 'r3fr3sh', id: 4 }")).toBe(
      "{ 'refreshToken': '[redacted]', id: 4 }",
    );
    expect(redactText('{accessToken: abc123}')).toBe('{accessToken: [redacted]}');
    expect(redactText('token: Bearer abc.def-123')).not.toContain('abc.def');
    expect(redactText('Authorization: Negotiate YIIBhwYGKwYBBQUCoIIB')).toBe(
      'Authorization: Negotiate [redacted]',
    );
  });

  it('hides the whole of a password that holds a separator, a space or an escaped quote', () => {
    expect(redactText('Login rejected password=Tr0ub&rest-of-it now')).toBe(
      'Login rejected password=[redacted] now',
    );
    expect(redactText('password=abc,def123')).toBe('password=[redacted]');
    expect(redactText('password=Tr0ub&rest&user=ada')).toBe('password=[redacted]&user=ada');
    expect(redactText('retry password: correct horse battery\nnext line')).toBe(
      'retry password: [redacted]\nnext line',
    );
    expect(redactText('payload {"password":"abc\\"tail-part","page":2}')).toBe(
      'payload {"password":"[redacted]","page":2}',
    );
    // Weaker names still stop at the separator, as in a query string.
    expect(redactText('token=abc&page=2')).toBe('token=[redacted]&page=2');
  });

  it('keeps ordinary prose and non-secret pairs', () => {
    for (const text of [
      'the token is valid',
      'Invalid key: expected a string',
      'status code: 404',
      'session: 5 minutes left',
      'password reset sent to the user',
      'token: null',
      'at 12:30 the page=2 view loaded',
      'tokens are refreshed every 5 minutes',
      'Invalid token: expired',
      'authorization: required for this endpoint',
      'the password field is empty',
    ]) {
      expect(redactText(text), text).toBe(text);
    }
  });

  it('masks a lowercase word after a strong secret name and a colon', () => {
    expect(redactText('password: correcthorse')).toBe('password: [redacted]');
    expect(redactText('login failed, passwd: hunter')).toBe('login failed, passwd: [redacted]');
    expect(redactText('secret: swordfish')).toBe('secret: [redacted]');
    expect(redactText('client_secret: abcdef')).toBe('client_secret: [redacted]');
    expect(redactText('api_key: letmein')).toBe('api_key: [redacted]');
    expect(redactText('Passwords: opensesame')).toBe('Passwords: [redacted]');
    // Plain values and the weak names, which read as prose, stay.
    for (const text of [
      'password: null',
      'Invalid token: expired',
      'status code: 404',
      'the token is valid',
      'authorization: required',
    ]) {
      expect(redactText(text), text).toBe(text);
    }
  });

  it('still masks URL pairs and nested queries in text', () => {
    expect(redactText('Redirecting to "/login?token=abc&x=1"')).toBe(
      'Redirecting to "/login?token=[redacted]&x=1"',
    );
    expect(redactText('go /cb?next=%2Fa%3Ftoken%3Dabc')).not.toContain('abc');
  });
});
