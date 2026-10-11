type PopupModule = typeof import('./popup.ts');

let popup: Promise<PopupModule> | undefined;

/**
 * Loads the floating devtools button and shows it. Only the auto-starting
 * `overlay` entry calls this; `overlay-manual` never adds the button.
 */
export function showOverlayPopup(): void {
  popup = import('./popup.ts');
  popup.then((m) => m.showDevtools()).catch(console.error);
}

/** The popup module, once `showOverlayPopup` has loaded it. */
export function overlayPopup(): Promise<PopupModule> | undefined {
  return popup;
}
