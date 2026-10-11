export function time(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

const JSON_SPACE = /[ \t\n\r]/;

/**
 * Indents a JSON object or array by 2 spaces. Returns null for anything else,
 * including clipped or invalid JSON. Numbers and strings are copied as written,
 * so large numbers keep every digit.
 */
export function prettyJson(text: string): string | null {
  const source = text.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object') return null;
  let out = '';
  let depth = 0;
  const newline = () => `\n${'  '.repeat(depth)}`;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      let end = i + 1;
      while (source[end] !== '"') end += source[end] === '\\' ? 2 : 1;
      out += source.slice(i, end + 1);
      i = end;
    } else if (ch === '{' || ch === '[') {
      const close = ch === '{' ? '}' : ']';
      let next = i + 1;
      while (JSON_SPACE.test(source[next])) next++;
      if (source[next] === close) {
        out += ch + close;
        i = next;
      } else {
        depth++;
        out += ch + newline();
      }
    } else if (ch === '}' || ch === ']') {
      depth--;
      out += newline() + ch;
    } else if (ch === ',') {
      out += `,${newline()}`;
    } else if (ch === ':') {
      out += ': ';
    } else if (!JSON_SPACE.test(ch)) {
      out += ch;
    }
  }
  return out;
}
