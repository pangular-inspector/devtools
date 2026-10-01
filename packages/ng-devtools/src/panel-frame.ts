export const POPUP_ROOT_ID = 'ng-devtools-popup-root';

export const SETUP_URL = 'https://github.com/santoshyadavdev/angular-devtools#readme';

/** True in the popup's own frame, where the host app would otherwise start a second overlay. */
export function insideDevtoolsPanel(): boolean {
  try {
    const root = window.frameElement?.getRootNode();
    return !!root && 'host' in root && (root.host as Element | null)?.id === POPUP_ROOT_ID;
  } catch {
    return false;
  }
}
