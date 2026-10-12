import type { HtmlTagDescriptor } from 'vite';

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
 * its polyfills. It passes the hub's `baseURL`, so the overlay connects there
 * without looking for the server on the default paths first.
 */
export function overlayTags(html: string, hubBase: string): HtmlTagDescriptor[] {
  if (loadsOverlay(html)) return [];
  const children = `import { initOverlay } from ${JSON.stringify(OVERLAY_ENTRY)};\ninitOverlay({ baseURL: ${JSON.stringify(`${hubBase}pangular/`)} }).catch(console.error);`;
  return [
    {
      tag: 'script',
      attrs: { type: 'module', [OVERLAY_TAG_ATTRIBUTE]: '' },
      children,
      injectTo: 'body',
    },
  ];
}

const HTML_COMMENT = /<!--[\s\S]*?(?:-->|$)/g;
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const MARKER = new RegExp(`(?:^|\\s)${OVERLAY_TAG_ATTRIBUTE}(?=[\\s=/]|$)`, 'i');
const MODULE_TYPE = /(?:^|\s)type\s*=\s*(["']?)module\1(?=[\s/]|$)/i;
const SRC = /(?:^|\s)src\s*=\s*(["']?)([^"'\s>]*)\1/i;

/**
 * Whether a real `<script>` in `html` already starts the overlay: one carrying
 * {@link OVERLAY_TAG_ATTRIBUTE}, or a module script that imports or loads
 * {@link OVERLAY_ENTRY}. Text in HTML comments does not count.
 */
function loadsOverlay(html: string): boolean {
  const scripts = html.replace(HTML_COMMENT, '').matchAll(SCRIPT);
  for (const [, attrs = '', body = ''] of scripts) {
    if (MARKER.test(attrs)) return true;
    if (!MODULE_TYPE.test(attrs)) continue;
    if (body.includes(OVERLAY_ENTRY) || SRC.exec(attrs)?.[2]?.includes(OVERLAY_ENTRY)) return true;
  }
  return false;
}
