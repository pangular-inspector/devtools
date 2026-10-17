/**
 * Caches for the redaction rules on hot paths, such as every NgRx store
 * update. Classifying a key or masking a text depends on the redaction config
 * (`redaction.secretNames` and `unmask`, and the page's `__PANGULAR_FORMS__`
 * `mask` and `unmask` lists, which the app can change at any time) and on the
 * secret values seen so far. A scope reads that config once when it starts;
 * answers cached under it are dropped as soon as a later scope sees a
 * different config. Outside a scope nothing is cached and every call reads
 * the config again, as before.
 */

const MAX_ENTRIES = 20_000;

/**
 * A config read once per scope, plus the per-key answers that stay valid
 * while it is unchanged. An answer must not be `undefined`.
 */
export class RedactionScope<C extends object, R> {
  private depth = 0;
  private pinned: C | null = null;
  private fingerprint: string | null = null;
  private current = 0;
  private readonly answers = new Map<string, R>();

  /** Runs `body` with the config `read` returns pinned; nested runs join the outer one. */
  run<T>(read: () => C, body: () => T): T {
    if (this.depth > 0) return body();
    const config = read();
    const fingerprint = fingerprintOf(config);
    if (fingerprint === null || fingerprint !== this.fingerprint) this.changed();
    this.fingerprint = fingerprint;
    this.pinned = config;
    this.depth++;
    try {
      return body();
    } finally {
      this.depth--;
      this.pinned = null;
    }
  }

  /** The pinned config inside a scope, null outside. */
  config(): C | null {
    return this.pinned;
  }

  /** A number that changes with the config, or null outside a scope. */
  epoch(): number | null {
    return this.depth > 0 ? this.current : null;
  }

  /** Drops every cached answer: the rules changed. */
  changed() {
    this.current++;
    this.answers.clear();
    this.fingerprint = null;
  }

  /** The answer for `key`, computed once per config inside a scope and every time outside one. */
  keyReason(key: string, compute: () => R): R {
    if (this.depth === 0) return compute();
    const cached = this.answers.get(key);
    if (cached !== undefined) return cached;
    const answer = compute();
    if (this.answers.size >= MAX_ENTRIES) this.answers.clear();
    this.answers.set(key, answer);
    return answer;
  }
}

/** The config as text, so a scope can tell it changed; null when it can't be read (never cached then). */
function fingerprintOf(config: object): string | null {
  try {
    return JSON.stringify(config);
  } catch {
    return null;
  }
}

/**
 * Masked texts by their input, valid for one `epoch` (the redaction config and
 * the known secret values). Only short texts are kept, at most `MAX_ENTRIES`.
 */
export class TextMemo {
  private epoch: string | null = null;
  private readonly texts = new Map<string, string>();

  get(epoch: string | null, text: string, mask: (text: string) => string): string {
    if (epoch === null || text.length > 512) return mask(text);
    if (epoch !== this.epoch) {
      this.texts.clear();
      this.epoch = epoch;
    }
    const cached = this.texts.get(text);
    if (cached !== undefined) return cached;
    const out = mask(text);
    if (this.texts.size >= MAX_ENTRIES) this.texts.clear();
    this.texts.set(text, out);
    return out;
  }
}
