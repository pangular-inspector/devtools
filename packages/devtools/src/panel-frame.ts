export const POPUP_ROOT_ID = 'pangular-popup-root';

/**
 * Where the overlay and the floating button look for the devtools server, in
 * order: next to the page, the Express mount, the hub frame, then the devframe
 * mount.
 */
export const DEVTOOLS_BASES = ['./', '/__pangular/', '/__devframes/pangular/', '/__devframe/'];

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
