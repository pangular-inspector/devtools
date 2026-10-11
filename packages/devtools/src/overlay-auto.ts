// The `@pangular-inspector/devtools/overlay` entry: the overlay API, plus an
// overlay and the floating button started on import. `overlay-manual`
// (`overlay.ts`) exports the same API and starts nothing.
import { initOverlay } from './overlay.ts';
import { showOverlayPopup } from './overlay-popup.ts';
import { insideDevtoolsPanel } from './panel-frame.ts';

export * from './overlay.ts';

// Skipped in tests, and inside the devtools panel's own frame.
if (
  typeof document !== 'undefined' &&
  !(typeof process !== 'undefined' && process.env?.['VITEST']) &&
  !insideDevtoolsPanel()
) {
  initOverlay().catch(console.error);
  showOverlayPopup();
}
