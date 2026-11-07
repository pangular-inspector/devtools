/**
 * Opt-in masking of high-entropy strings (`redaction.entropy`): opaque tokens
 * that no name or shape rule recognizes, such as a session token in a
 * harmless-looking field or a cloud secret with no known prefix.
 *
 * A candidate is a run of letters, digits, `_`, `-`, `+` and `/` (with any
 * trailing `=`) of at least `minLength` characters (24 by default). It is
 * masked only when it:
 *
 * - mixes lowercase letters, uppercase letters and digits,
 * - is not hex (hashes, commit SHAs, UUIDs, Mongo ids, colors) or a ULID,
 * - does not read as words: a camelCase identifier such as
 *   `getUserProfileById2024` (half or more of it in words of three letters or
 *   more, with a quarter or more vowels among its letters) stays,
 * - has a Shannon entropy of at least `log2(length) - 1` bits per character,
 *   capped at `threshold` (4.5 by default: 3.6 bits for 24 characters, 4 for
 *   32, 4.5 from 45), which about 99% of random 24-character tokens and more
 *   of longer ones reach.
 *
 * A run with `/` is judged whole (base64 such as a cloud secret key) unless
 * one of its segments is a plain word or number, as in a path; then each
 * segment is judged on its own, so `/api/Users/<token>` keeps its path readable.
 *
 * Every step is linear in the text: one regex pass without nested
 * quantifiers, and per-run checks that each read the run once.
 */

import { ENTROPY_DEFAULTS, resolveEntropy, type EntropyOptions } from './config.ts';

export { ENTROPY_DEFAULTS, resolveEntropy, type EntropyOptions };

let active: EntropyOptions | undefined;

/**
 * Turns entropy masking on with `options`, or off with `undefined` or
 * `false`. `setRedaction` calls it with `redaction.entropy`.
 */
export function setEntropyRedaction(options: unknown) {
  active = resolveEntropy(options);
}

/** The options in use, or `undefined` while entropy masking is off. */
export function entropyRedaction(): EntropyOptions | undefined {
  return active ? { ...active } : undefined;
}

export function entropyRedactionOn(): boolean {
  return active !== undefined;
}

/** A run this much in words, and with this share of vowels, reads as an identifier. */
const WORDY = 0.5;
const VOWELS = 0.25;
const WORD = /[A-Z]?[a-z]{3,}/g;

const HEX = /^[\da-f-]+$/i;
const ULID = /^[\dA-HJKMNP-TV-Z]{26}$/i;
/** A path segment: a word, a capitalized word, a number or a short version tag such as `v2`. */
const PLAIN_SEGMENT = /^(?:[a-z]{3,}|[A-Z][a-z]{2,}|\d+|v\d+|[a-z]+(?:[-_][a-z]+)+)$/;

const candidates = new Map<number, RegExp>();

/** The run pattern for `minLength`, built once per length. */
function candidate(minLength: number): RegExp {
  let pattern = candidates.get(minLength);
  if (!pattern) {
    pattern = new RegExp(`(?<![\\w+/-])[\\w+/-]{${minLength},}=*(?![\\w+/=-])`, 'g');
    candidates.set(minLength, pattern);
  }
  return pattern;
}

/** Whether `token` reads as words, like a camelCase or snake_case identifier. */
function readsAsWords(token: string): boolean {
  let inWords = 0;
  for (const word of token.match(WORD) ?? []) inWords += word.length;
  if (inWords / token.length < WORDY) return false;
  const letters = token.match(/[a-z]/gi)?.length ?? 0;
  const vowels = token.match(/[aeiou]/gi)?.length ?? 0;
  return letters > 0 && vowels / letters >= VOWELS;
}

/** Shannon entropy of `text`, in bits per character. */
export function shannonEntropy(text: string): number {
  if (!text) return 0;
  const counts = new Map<string, number>();
  for (const ch of text) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let bits = 0;
  for (const count of counts.values()) {
    const p = count / text.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

/** Whether `token` (no separators, no `=` padding) reads as a random secret. */
export function isHighEntropy(
  token: string,
  options: EntropyOptions = active ?? ENTROPY_DEFAULTS,
): boolean {
  if (token.length < options.minLength) return false;
  if (HEX.test(token) || ULID.test(token)) return false;
  if (!/[a-z]/.test(token) || !/[A-Z]/.test(token) || !/\d/.test(token)) return false;
  if (readsAsWords(token)) return false;
  return shannonEntropy(token) >= Math.min(options.threshold, Math.log2(token.length) - 1);
}

function maskRun(run: string, mask: string, options: EntropyOptions): string {
  const body = run.replace(/=+$/, '');
  const core = body.replace(/^\/+|\/+$/g, '');
  if (!core.includes('/')) return isHighEntropy(core, options) ? run.replace(core, mask) : run;
  const segments = core.split('/');
  if (!segments.some((segment) => PLAIN_SEGMENT.test(segment)) && isHighEntropy(core, options)) {
    return run.replace(core, mask);
  }
  const masked = segments
    .map((segment) => (isHighEntropy(segment, options) ? mask : segment))
    .join('/');
  return masked === core ? run : run.replace(core, masked);
}

/**
 * `text` with each high-entropy run replaced by `mask`. Does nothing unless
 * `redaction.entropy` is on, or when `force` passes options (for tests and
 * tools that check a value).
 */
export function redactHighEntropy(
  text: string,
  mask: string,
  force?: EntropyOptions | true,
): string {
  const options = force === true ? ENTROPY_DEFAULTS : (force ?? active);
  if (!options || !text || text.length < options.minLength) return text;
  return text.replace(candidate(options.minLength), (run) => maskRun(run, mask, options));
}
