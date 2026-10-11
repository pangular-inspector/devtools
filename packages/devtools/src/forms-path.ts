// An empty key is written as \e so a lone one is not mistaken for the root path ''.
const EMPTY_KEY = '\\e';

function escapeKey(key: string): string {
  return key ? key.replace(/[\\.]/g, '\\$&') : EMPTY_KEY;
}

export function joinPath(segments: readonly string[]): string {
  return segments.map(escapeKey).join('.');
}

export function childPath(path: string, key: string): string {
  return path ? `${path}.${escapeKey(key)}` : escapeKey(key);
}

export function splitPath(path: string): string[] {
  if (!path) return [];
  const segments: string[] = [];
  let current = '';
  for (let i = 0; i < path.length; i++) {
    const char = path[i];
    if (char === '\\' && path[i + 1] === 'e') i++;
    else if (char === '\\' && i + 1 < path.length) current += path[++i];
    else if (char === '.') {
      segments.push(current);
      current = '';
    } else current += char;
  }
  segments.push(current);
  return segments;
}
