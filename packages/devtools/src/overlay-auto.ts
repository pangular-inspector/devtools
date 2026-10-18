// The `@pangular-inspector/devtools/overlay` entry: the overlay API, plus an
// overlay and the floating button started on import. `overlay-manual`
// (`overlay.ts`) exports the same API and starts nothing.
import { initOverlay } from './overlay.ts';
import { showOverlayPopup } from './overlay-popup.ts';
import { overlayStarts } from './overlay-start.ts';
import { insideDevtoolsPanel } from './panel-frame.ts';

export * from './overlay.ts';

declare const ngDevMode: unknown;

// Skipped in production builds, which set ngDevMode to false (so a static
// import, such as one for disposeOverlay, starts nothing there), in tests,
// and inside the devtools panel's own frame.
if (
  (typeof ngDevMode === 'undefined' || !!ngDevMode) &&
  typeof document !== 'undefined' &&
  !(typeof process !== 'undefined' && process.env?.['VITEST']) &&
  !insideDevtoolsPanel()
) {
  // Started on the next task, so a script that imports this entry and calls
  // initOverlay({baseURL}) right away starts the only overlay, and nothing
  // looks for the server on the default paths first.
  const before = overlayStarts.count;
  setTimeout(() => {
    if (overlayStarts.count === before) initOverlay().catch(console.error);
  });
  showOverlayPopup();
}
