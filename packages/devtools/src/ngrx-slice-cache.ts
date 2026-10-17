import { redactionEpoch } from './forms-privacy.ts';
import { serializeSlice } from './ngrx-shared.ts';
import { knownSecretsVersion } from './text-redact.ts';

/**
 * The serialized form of each state slice a store update showed, so the next
 * update diffs against it instead of serializing the same `before` value again:
 * with `watchState`, one update's `after` slice is the next one's `before`.
 *
 * Only `before` values are read from here; `after` is always serialized fresh
 * and then remembered. An entry is dropped when the redaction config or the
 * known secret values change (outside `withRedactionScope` nothing is cached).
 * If the app mutates a slice in place, the diff shows it against what the
 * slice held when it was last logged, which is what the change log showed.
 */
export class SliceCache {
  private readonly slices = new WeakMap<
    object,
    { key: PropertyKey; epoch: string; value: unknown }
  >();

  private epoch(): string | null {
    const epoch = redactionEpoch();
    return epoch === null ? null : `${epoch}/${knownSecretsVersion()}`;
  }

  /** The serialized `before` slice, from the update that showed it as `after` when possible. */
  before(key: PropertyKey, value: unknown): unknown {
    const epoch = this.epoch();
    if (epoch !== null && value && typeof value === 'object') {
      const hit = this.slices.get(value);
      if (hit && hit.key === key && hit.epoch === epoch) return hit.value;
    }
    return serializeSlice(key, value);
  }

  /** The serialized `after` slice, remembered for the next update. */
  after(key: PropertyKey, value: unknown): unknown {
    const out = serializeSlice(key, value);
    const epoch = this.epoch();
    if (epoch !== null && value && typeof value === 'object') {
      this.slices.set(value, { key, epoch, value: out });
    }
    return out;
  }
}
