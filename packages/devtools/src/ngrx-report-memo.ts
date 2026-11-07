import { redactionEpoch } from './forms-privacy.ts';
import { knownSecretsVersion } from './text-redact.ts';

/**
 * Change tracking for the NgRx report, so a store whose state did not change
 * is not serialized again on every check (#368).
 *
 * Each store's report is kept with the raw values it was built from: the
 * state slices, the computed values, and the method stats and references. NgRx
 * state is immutable (`@ngrx/signals` freezes it in development), so a new
 * slice is a new object, and an unchanged store gives the same raw values,
 * compared with `Object.is`. The redaction config and the known secret values
 * are part of the key, since they change what the serialized report holds.
 */
export class ReportMemo<T> {
  private readonly entries = new WeakMap<object, { key: readonly unknown[]; value: T }>();

  /** The report of `owner` built from `key`, built again only when `key` changed. */
  get(owner: object, key: readonly unknown[], build: () => T): T {
    const epoch = serializationEpoch();
    // Outside `withRedactionScope` the epoch is unknown, so nothing is kept.
    if (epoch === null) return build();
    const full = [epoch, ...key];
    const hit = this.entries.get(owner);
    if (hit && sameKey(hit.key, full)) return hit.value;
    const value = build();
    this.entries.set(owner, { key: full, value });
    return value;
  }
}

/**
 * A number that goes up whenever the report changes: a store's report was
 * rebuilt, a store came or went, or the classic store's report changed. The
 * overlay compares it with the version it last sent instead of comparing the
 * serialized report.
 */
export class ReportVersion {
  private version = 0;
  private parts: readonly unknown[] = [];

  stamp(parts: readonly unknown[]): number {
    if (!sameKey(this.parts, parts)) {
      this.version++;
      this.parts = parts;
    }
    return this.version;
  }
}

function serializationEpoch(): string | null {
  const epoch = redactionEpoch();
  return epoch === null ? null : `${epoch}/${knownSecretsVersion()}`;
}

function sameKey(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}
