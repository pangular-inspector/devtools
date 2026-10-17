/**
 * Parts of an `analog({ ... })` call that the source scan in `analog-scan.ts`
 * reads as literals only. When the config builds them some other way (a
 * variable, a spread, a template string), the scan cannot know their values,
 * so the reasons returned here tell the panel and the agent tools that the
 * config they show is incomplete.
 */

/** The most reasons one config reports. */
const MAX_REASONS = 8;

function depthOneSpread(masked: string): boolean {
  let depth = 0;
  for (let i = 0; i < masked.length; i++) {
    const ch = masked[i];
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') depth--;
    else if (depth === 1 && masked.startsWith('...', i)) return true;
  }
  return false;
}

function blockAt(masked: string, open: number): string {
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === '{' || masked[i] === '[') depth++;
    else if ((masked[i] === '}' || masked[i] === ']') && --depth === 0) {
      return masked.slice(open, i + 1);
    }
  }
  return masked.slice(open);
}

/** `object` with everything nested below its own level blanked out. */
function ownLevel(object: string): string {
  let depth = 0;
  let out = '';
  for (const ch of object) {
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    out += depth > 1 ? ' ' : ch;
    if (ch === '}' || ch === ']' || ch === ')') depth--;
  }
  return out;
}

/** The `key: { ... }` block directly in `object` (an object literal), not one nested deeper. */
function topLevelKey(object: string, key: string): { at: number; block: string } | null {
  const pattern = new RegExp(`\\b${key}\\s*:\\s*\\{`, 'g');
  let depth = 0;
  let at = 0;
  for (let match = pattern.exec(object); match; match = pattern.exec(object)) {
    for (; at < match.index; at++) {
      if (object[at] === '{' || object[at] === '[' || object[at] === '(') depth++;
      else if (object[at] === '}' || object[at] === ']' || object[at] === ')') depth--;
    }
    if (depth === 1) {
      const open = match.index + match[0].length - 1;
      return { at: open, block: blockAt(object, open) };
    }
  }
  return null;
}

/**
 * Why the options of one `analog(...)` call could not be read in full.
 * `args` is the text between the call's parentheses and `masked` the same
 * text with its strings blanked by `maskStrings`, so the two line up.
 */
export function partialReasons(args: string, masked: string): string[] {
  const reasons: string[] = [];
  const body = masked.trim();
  if (!body) return reasons;
  if (!body.startsWith('{')) {
    const name = body.match(/^[\w$.]+/)?.[0];
    reasons.push(
      `analog() gets its options from ${name ?? 'an expression'}, not an object literal, so none of them were read.`,
    );
    return reasons;
  }
  const objectAt = masked.indexOf('{');
  const object = blockAt(masked, objectAt);
  if (depthOneSpread(object)) {
    reasons.push('analog() options use a spread (...), and the spread values were not read.');
  }
  const own = ownLevel(object);
  for (const key of ['ssr', 'static']) {
    if (
      new RegExp(`(?:[{,]\\s*)${key}\\s*:\\s*(?!(?:true|false)\\s*(?:[,}]|$))[^\\s,}]`).test(own)
    ) {
      reasons.push(`${key} is not a plain true or false, so its value is unknown.`);
    }
  }
  if (/\bapiPrefix\s*:\s*(?!['"`])[^\s,}]/.test(own)) {
    reasons.push('apiPrefix is not a string literal, so the default api is assumed.');
  }
  for (const match of object.matchAll(/\brouteRules\b(\s*:\s*\{)?/g)) {
    if (!match[1]) {
      reasons.push('routeRules is not an object literal, so its rules were not read.');
      break;
    }
    const rules = blockAt(object, match.index + match[0].length - 1);
    if (/\.\.\./.test(rules)) {
      reasons.push('routeRules uses a spread (...), and the spread rules were not read.');
      break;
    }
    if (/\[[^\]]*\]\s*:/.test(rules)) {
      reasons.push('routeRules has computed keys, and those rules were not read.');
      break;
    }
  }
  const prerender = topLevelKey(object, 'prerender');
  const routes = prerender ? /\broutes\s*:\s*/.exec(prerender.block) : null;
  if (prerender && routes) {
    const at = prerender.at + routes.index + routes[0].length;
    const value = object.slice(at);
    if (value.startsWith('[')) {
      const list = blockAt(object, at);
      const from = objectAt + at;
      const literal = args.slice(from, from + list.length);
      const rest = list
        .slice(1, -1)
        .replace(/(['"`])\s*\1/g, '')
        .replace(/[\s,]/g, '');
      if (rest || literal.includes('${')) {
        reasons.push(
          'prerender.routes has entries that are not plain strings, so only the literal ones are listed.',
        );
      }
    } else if (!/^(async\b|function\b|\()/.test(value)) {
      reasons.push('prerender.routes is not an array literal, so the listed routes are unknown.');
    }
  }
  return reasons.slice(0, MAX_REASONS);
}

export const PARTIAL_HINT =
  'Render modes, the prerender plan and the lint checks that use the config may be incomplete.';
