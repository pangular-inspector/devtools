import { extensionOrigin } from './extension-origin.ts';

function webOrigin(entry: string): string {
  try {
    return new URL(entry).origin;
  } catch {
    return 'null';
  }
}

/**
 * Reduces each `allowedOrigins` entry to the origin a browser sends: no path or
 * trailing slash, and a lowercase host. Entries that are not URLs are dropped.
 */
export function normalizeAllowedOrigins(
  entries: readonly string[] | undefined,
  warn: (message: string) => void = () => undefined,
): string[] {
  const origins: string[] = [];
  for (const entry of entries ?? []) {
    const origin = extensionOrigin(entry) ?? webOrigin(entry);
    if (origin === 'null') {
      warn(
        `[pangular] Ignoring allowedOrigins entry "${entry}": it is not an origin such as https://tunnel.example.`,
      );
      continue;
    }
    if (origin !== entry) {
      warn(
        `[pangular] allowedOrigins entry "${entry}" is read as "${origin}". Browsers send the origin only, without a path.`,
      );
    }
    if (!origins.includes(origin)) origins.push(origin);
  }
  return origins;
}
