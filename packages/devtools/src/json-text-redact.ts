const REDACTED_VALUE = '"[redacted]"';

function stringEnd(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') i++;
    else if (text[i] === '"') return i + 1;
  }
  return text.length;
}

function valueEnd(text: string, start: number): number {
  const first = text[start];
  if (first === '"') return stringEnd(text, start);
  if (first !== '{' && first !== '[') {
    const stop = text.slice(start).search(/[,}\]]/);
    return stop < 0 ? text.length : start + stop;
  }
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') i = stringEnd(text, i) - 1;
    else if (ch === '{' || ch === '[') depth++;
    else if ((ch === '}' || ch === ']') && --depth === 0) return i + 1;
  }
  return text.length;
}

export function redactJsonText(text: string, isSecret: (key: string) => boolean): string {
  const colon = /\s*:\s*/y;
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '"') {
      out += text[i++];
      continue;
    }
    const end = stringEnd(text, i);
    const token = text.slice(i, end);
    out += token;
    i = end;
    colon.lastIndex = i;
    const sep = colon.exec(text);
    if (!sep) continue;
    let key: string;
    try {
      key = String(JSON.parse(token));
    } catch {
      key = token.slice(1, -1);
    }
    if (!isSecret(key)) continue;
    out += `${sep[0]}${REDACTED_VALUE}`;
    i = valueEnd(text, i + sep[0].length);
  }
  return out;
}
