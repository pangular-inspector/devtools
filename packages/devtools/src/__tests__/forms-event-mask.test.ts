import { describe, expect, it } from 'vitest';
import { createFormEventMask } from '../forms-event-mask.ts';
import type { FormEvent } from '../forms.ts';

describe('createFormEventMask', () => {
  const secrets: string[] = [];
  const redact = (_formId: string, text: string) =>
    secrets.reduce((out, secret) => out.replaceAll(secret, '[redacted]'), text);
  const event = (fields: Partial<FormEvent>): FormEvent => ({
    formId: 'Login.form@pg',
    path: 'notes',
    type: 'value',
    timestamp: 1,
    ...fields,
  });

  it('masks value, prev and caller again once a secret is learned, replacing the event', () => {
    secrets.length = 0;
    const mask = createFormEventMask(redact, () => secrets.join('\0'));
    const first = event({ detail: 'pw-123', prev: 'old pw-123', caller: 'set pw-123' });
    const other = event({ detail: 'nothing here' });
    const events = [first, other];
    mask(events);
    expect(events[0]).toBe(first);

    secrets.push('pw-123');
    mask(events);
    expect(events[0]).not.toBe(first);
    expect(first.detail).toBe('pw-123');
    expect(events[0]).toMatchObject({
      detail: '[redacted]',
      prev: 'old [redacted]',
      caller: 'set [redacted]',
    });
    expect(events[1]).toBe(other);
  });

  it('reads nothing again while the secrets stay the same', () => {
    secrets.length = 0;
    secrets.push('pw-123');
    let calls = 0;
    const mask = createFormEventMask(
      (formId, text) => {
        calls++;
        return redact(formId, text);
      },
      () => secrets.join('\0'),
    );
    const events = [event({ detail: 'a' })];
    mask(events);
    expect(calls).toBe(1);
    mask(events);
    expect(calls).toBe(1);
  });
});
