type PopupModule = typeof import('./popup.ts');

let popup: Promise<PopupModule> | undefined;

export function showOverlayPopup(): void {
  popup = import('./popup.ts');
  popup.then((m) => m.showDevtools()).catch(console.error);
}

export function overlayPopup(): Promise<PopupModule> | undefined {
  return popup;
}
