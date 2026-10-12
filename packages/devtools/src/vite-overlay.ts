import type { HtmlTagDescriptor } from 'vite';
import { PANGULAR_HUB_BASE } from './hub.ts';

/** The package entry that starts the overlay and the floating button on import. */
export const OVERLAY_ENTRY = '@pangular-inspector/devtools/overlay';

/** Marks the injected tag, so a second pass over the same HTML adds nothing. */
export const OVERLAY_TAG_ATTRIBUTE = 'data-pangular-overlay';

/**
 * The module script that starts the overlay, or nothing when the page
 * already loads it from its HTML. The script is inline so Vite resolves the
 * entry the same way as an import in `main.ts`: both share one module, which
 * runs once, so an app that also imports the overlay itself still gets one.
 * It goes at the end of `<body>`, so it runs after the app's own entry and
 * its polyfills. On a custom hub `base` it points the overlay there.
 */
export function overlayTags(html: string, hubBase: string): HtmlTagDescriptor[] {
  if (html.includes(OVERLAY_TAG_ATTRIBUTE) || html.includes(OVERLAY_ENTRY)) return [];
  const children =
    hubBase === PANGULAR_HUB_BASE
      ? `import ${JSON.stringify(OVERLAY_ENTRY)};`
      : `import { initOverlay } from ${JSON.stringify(OVERLAY_ENTRY)};\ninitOverlay({ baseURL: ${JSON.stringify(`${hubBase}pangular/`)} }).catch(console.error);`;
  return [
    {
      tag: 'script',
      attrs: { type: 'module', [OVERLAY_TAG_ATTRIBUTE]: '' },
      children,
      injectTo: 'body',
    },
  ];
}
