type PanelLocation = Pick<Location, 'href' | 'origin' | 'protocol' | 'pathname' | 'search'>;

// Chrome extension passes ?baseURL=...; embedded uses /__pangular/; the CLI and a
// static report serve the panel next to their own __connection.json
function sameOrigin(value: string, loc: PanelLocation): boolean {
  try {
    return new URL(value, loc.href).origin === loc.origin;
  } catch {
    return false;
  }
}

// The extension panel is not web accessible, and it only passes hosts the user granted.
function fromExtension(value: string, loc: PanelLocation): boolean {
  if (loc.protocol !== 'chrome-extension:') return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function detectBaseURL(loc: PanelLocation = location): string | string[] | undefined {
  const params = new URLSearchParams(loc.search);
  const fromQuery = params.get('baseURL');
  // Same origin only: any page can open this URL, and this value decides where
  // the panel opens its RPC channel.
  // `new URL` throws on a malformed value, and this runs before the connection
  // is made, so an unhandled throw would leave the panel blank.
  if (fromQuery && (sameOrigin(fromQuery, loc) || fromExtension(fromQuery, loc))) {
    return fromQuery;
  }

  if (loc.pathname.includes('__pangular') || loc.pathname.includes('__devframes/')) {
    return undefined;
  }
  return ['/__pangular/', './'];
}
