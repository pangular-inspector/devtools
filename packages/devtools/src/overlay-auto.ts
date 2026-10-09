import { initOverlay } from './overlay.ts';
import { showOverlayPopup } from './overlay-popup.ts';
import { insideDevtoolsPanel } from './panel-frame.ts';

export * from './overlay.ts';

if (
  typeof document !== 'undefined' &&
  !(typeof process !== 'undefined' && process.env?.['VITEST']) &&
  !insideDevtoolsPanel()
) {
  initOverlay().catch(console.error);
  showOverlayPopup();
}
