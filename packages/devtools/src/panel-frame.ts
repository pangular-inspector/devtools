export const POPUP_ROOT_ID = 'pangular-popup-root';

/**
 * Where the overlay and the floating button look for the devtools server, in
 * order: the hub frame (the Express hub and the Vite plugin), the
 * `pangular dev` proxy path, next to the page, then the devframe mount. Each
 * miss is a 404 the browser logs, so the setups most apps use come first.
 */
export const DEVTOOLS_BASES = ['/__devframes/pangular/', '/__pangular/', './', '/__devframe/'];

export const SETUP_URL = 'https://pangular-inspector.dev/getting-started/installation/';

/** True in the popup's own frame, where the host app would otherwise start a second overlay. */
export function insideDevtoolsPanel(): boolean {
  try {
    const root = window.frameElement?.getRootNode();
    return !!root && 'host' in root && (root.host as Element | null)?.id === POPUP_ROOT_ID;
  } catch {
    return false;
  }
}
