import { describe, expect, it } from 'vitest';
import { MAX_RETIRED_SECRETS, SecretSet } from '../forms-privacy.ts';

describe('form secret sets', () => {
  it('keeps hiding a secret value after the secret field changed', () => {
    const first = new SecretSet();
    first.add('old-password-1');
    const next = new SecretSet(first);
    next.add('new-password-2');
    expect(next.redact('confirm=old-password-1 now=new-password-2')).toBe(
      'confirm=[redacted] now=[redacted]',
    );
    expect(new SecretSet(next).redact('old-password-1')).toBe('[redacted]');
    expect(next.all().sort()).toEqual(['new-password-2', 'old-password-1']);
  });

  it('keeps a bounded number of earlier values, newest kept', () => {
    let set = new SecretSet();
    for (let i = 0; i < MAX_RETIRED_SECRETS + 10; i++) {
      const next = new SecretSet(set);
      next.add(`secret-${i}`);
      set = next;
    }
    const later = new SecretSet(set);
    expect(later.redact('secret-0')).toBe('secret-0');
    expect(later.redact(`secret-${MAX_RETIRED_SECRETS + 9}`)).toBe('[redacted]');
  });
});
