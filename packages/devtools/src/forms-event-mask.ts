import type { FormEvent } from './forms.ts';

/** The event fields that carry text from the page: a value, an earlier value, a caller. */
const TEXT_FIELDS = ['detail', 'prev', 'caller'] as const;

/**
 * Masks the recorded form events again, once the forms' secrets changed.
 *
 * An event is masked with the secrets known when it is recorded. A field can
 * learn a secret later, such as a password field that takes a value typed in
 * another field first, so the events already kept would still send it.
 * `secretsKey` names the secrets now known; while it stays the same, nothing
 * is read again. An event whose text changes is replaced, never edited, so a
 * report that holds it is not changed behind its back.
 */
export function createFormEventMask(
  redact: (formId: string, text: string) => string,
  secretsKey: () => string,
): (events: FormEvent[]) => void {
  let lastKey = '';
  return (events) => {
    const key = secretsKey();
    if (key === lastKey) return;
    lastKey = key;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      let next: FormEvent | null = null;
      for (const field of TEXT_FIELDS) {
        const text = event[field];
        if (typeof text !== 'string' || !text) continue;
        const masked = redact(event.formId, text);
        if (masked !== text) (next ??= { ...event })[field] = masked;
      }
      if (next) events[i] = next;
    }
  };
}
