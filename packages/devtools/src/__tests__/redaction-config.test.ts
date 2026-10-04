// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { REDACTED, isSecretKey, redactReason, setRedaction } from '../forms-privacy.ts';
import { serialize } from '../serialize.ts';
import { serialize as ngrxSerialize } from '../ngrx-shared.ts';
import { serializeFormValue } from '../forms.ts';
import { keepSecrets, secretInside } from '../forms-actions.ts';
import { redactUrl } from '../router.ts';
import { loadSummary } from '../analog-runtime.ts';
import { previewOf } from '../analog-server-log.ts';

const page = globalThis as { __PANGULAR_FORMS__?: unknown };

afterEach(() => {
  setRedaction();
  delete page.__PANGULAR_FORMS__;
});

describe('redaction config', () => {
  it('adds secret names to the built-in list, matched by words', () => {
    expect(isSecretKey('passportNumber')).toBe(false);
    setRedaction({ secretNames: ['passport', 'tax id'] });
    for (const key of ['passport', 'passportNumber', 'user_passports', 'taxId', 'myTaxID']) {
      expect(isSecretKey(key), key).toBe(true);
    }
    for (const key of ['passenger', 'taxi', 'syntax_idx', 'identity']) {
      expect(isSecretKey(key), key).toBe(false);
    }
    expect(isSecretKey('password')).toBe(true);
    expect(redactReason('passportNumber')).toBe('key');
  });

  it('merges unmask with the page config', () => {
    page.__PANGULAR_FORMS__ = { unmask: ['pin'] };
    setRedaction({ unmask: ['otp'] });
    expect(redactReason('pin')).toBeNull();
    expect(redactReason('otp')).toBeNull();
    expect(redactReason('password')).toBe('key');
    page.__PANGULAR_FORMS__ = { mask: ['city'] };
    expect(redactReason('otp')).toBeNull();
    expect(redactReason('city')).toBe('config');
  });

  it('applies to router URLs and Analog previews', () => {
    setRedaction({ secretNames: ['voucher'] });
    expect(redactUrl('/checkout?voucher=ABC123&step=2')).toBe(
      '/checkout?voucher=[redacted]&step=2',
    );
    expect(loadSummary({ voucherCode: 'ABC123', total: 3 })!.preview).toBe(
      '{"voucherCode":"[redacted]","total":3}',
    );
    expect(previewOf('{"voucher":"ABC123","ok":true}', 'application/json')).toBe(
      '{"voucher":"[redacted]","ok":true}',
    );
  });

  it('goes back to the built-in list when reset', () => {
    setRedaction({ secretNames: ['voucher'], unmask: ['password'] });
    setRedaction();
    expect(isSecretKey('voucher')).toBe(false);
    expect(redactReason('password')).toBe('key');
  });
});

describe('one redaction rule across inspectors', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.c2lnbmF0dXJlLXZhbHVl';
  const value = {
    pin: '1234',
    nickname: 'bob',
    dob: '1992-05-05',
    voucher: 'SAVE10',
    password: 'hunter2',
    sessionId: 'abc123',
    cookie: 'sid=1',
    jwt: 'raw',
    city: 'Oslo',
  };
  const hidden = ['nickname', 'dob', 'voucher', 'password', 'sessionId', 'cookie', 'jwt'];
  const shown = ['pin', 'city'];

  function configure() {
    setRedaction({ unmask: ['pin'], secretNames: ['voucher'] });
    page.__PANGULAR_FORMS__ = { mask: ['nickname', 'dob'] };
  }

  function check(name: string, out: Record<string, unknown>) {
    for (const key of hidden) expect(out[key], `${name} ${key}`).toBe(REDACTED);
    for (const key of shown) expect(out[key], `${name} ${key}`).toBe(value[key as 'pin']);
  }

  it('gives every serializer the same answer for the same keys', () => {
    configure();
    check('components and signals', serialize(value) as Record<string, unknown>);
    check('ngrx', ngrxSerialize(value) as Record<string, unknown>);
    check('form values', serializeFormValue(value) as Record<string, unknown>);
    check('analog load()', JSON.parse(loadSummary(value)!.preview!));
    check('analog server calls', JSON.parse(previewOf(JSON.stringify(value), 'application/json')!));
  });

  it('refuses a group write and keeps the secrets on restore by the same rule', () => {
    configure();
    expect(secretInside({ billing: { pin: '1', city: 'x' } })).toBeNull();
    expect(secretInside({ billing: { nickname: 'bob' } })).toBe('billing.nickname');
    expect(keepSecrets({ pin: 'old', dob: 'old' }, { pin: 'new', dob: 'new' })).toEqual({
      pin: 'old',
      dob: 'new',
    });
  });

  it('scrubs tokens inside NgRx strings and error messages', () => {
    const out = ngrxSerialize({
      auth: { header: `Bearer ${jwt}`, note: `token ${jwt}` },
      error: new Error(`401 for ${jwt}`),
    }) as { auth: Record<string, string>; error: { message: string } };
    expect(JSON.stringify(out)).not.toContain(jwt);
    expect(out.auth['header']).toBe(`Bearer ${REDACTED}`);
    expect(out.error.message).toBe(`401 for ${REDACTED}`);
  });
});
