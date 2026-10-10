function escapeKey(key: string): string {
  return key.replace(/[\\.]/g, '\\$&');
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
    if (char === '\\' && i + 1 < path.length) current += path[++i];
    else if (char === '.') {
      segments.push(current);
      current = '';
    } else current += char;
  }
  segments.push(current);
  return segments;
}
