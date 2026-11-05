import type {Tokens} from 'marked';
import {escapeHtml} from './escape-html.ts';

interface NgmdImageToken extends Tokens.Generic {
  type: 'ngmd-image';
  src: string;
  alt: string;
  caption?: string;
  width?: string;
}

// Accepts both self-closing `<ngmd-image .../>` and paired
// `<ngmd-image ...></ngmd-image>` (HTML5 parsers don't honour the
// self-closing form for custom elements, so authoring docs use the
// paired form). `s` flag lets attributes span multiple lines.
const tagRule = /^<ngmd-image([^>]*?)(?:\/>|>\s*<\/ngmd-image>)/s;
const attrRule = (name: string) => new RegExp(`${name}="([^"]*)"`);

/** Width and height by image URL; see `image-sizes.ts`. */
export type NgmdImageSizes = Record<string, [number, number]>;

/**
 * `<ngmd-image>` rendered as its final `<figure><img>`, so the image is in the
 * prerendered HTML. With the image's size from `sizes`, the `<img>` gets a
 * `width` and `height` and the browser reserves its space before it loads.
 */
export function createNgmdImageExtension(sizes: NgmdImageSizes = {}) {
  return {
    name: 'ngmd-image',
    level: 'block' as const,
    start(src: string) {
      return src.match(/^\s*<ngmd-image/m)?.index;
    },
    tokenizer(src: string): NgmdImageToken | undefined {
      const match = tagRule.exec(src);
      if (!match) return undefined;
      const attrs = match[1].trim();
      const srcMatch = attrRule('src').exec(attrs);
      if (!srcMatch) return undefined;
      return {
        type: 'ngmd-image',
        raw: match[0],
        src: srcMatch[1],
        alt: attrRule('alt').exec(attrs)?.[1] ?? '',
        caption: attrRule('caption').exec(attrs)?.[1],
        width: attrRule('width').exec(attrs)?.[1],
      };
    },
    renderer(token: NgmdImageToken) {
      const width = token.width?.trim() ?? '';
      const maxWidth = /^\d+(\.\d+)?$/.test(width) ? `${width}px` : width;
      const style = maxWidth ? ` style="max-width: ${escapeHtml(maxWidth)}"` : '';
      const size = sizes[token.src];
      const dimensions = size ? ` width="${size[0]}" height="${size[1]}"` : '';
      const caption = token.caption ? `<figcaption>${escapeHtml(token.caption)}</figcaption>` : '';
      return `<figure class="ngmd-image"${style}><img src="${escapeHtml(token.src)}" alt="${escapeHtml(token.alt)}"${dimensions} loading="lazy" decoding="async">${caption}</figure>`;
    },
  };
}

export const ngmdImageExtension = createNgmdImageExtension();
