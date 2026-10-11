export const POPUP_ROOT_ID = 'pangular-popup-root';

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
