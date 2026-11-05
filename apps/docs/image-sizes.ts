import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';

/**
 * Width and height in pixels, by the public URL of the image
 * (`/images/panel/router.png`). The build-time `<ngmd-image>` writes them into
 * the `width` and `height` of its `<img>`, so the browser reserves the image's
 * space before it loads and the page does not shift (CLS).
 */
export type ImageSizes = Record<string, [number, number]>;

/** The sizes of the PNG and JPEG files under `dir`, keyed by their URL path. */
export function readImageSizes(dir: string): ImageSizes {
  const sizes: ImageSizes = {};
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      const file = join(current, name);
      if (statSync(file).isDirectory()) walk(file);
      else if (/\.(png|jpe?g)$/i.test(name)) {
        const size = imageSize(readFileSync(file));
        if (size) sizes['/' + relative(dir, file).split(sep).join('/')] = size;
      }
    }
  };
  try {
    walk(dir);
  } catch {
    // no public/ directory
  }
  return sizes;
}

/** Width and height from a PNG or JPEG header, or `undefined` for anything else. */
export function imageSize(bytes: Uint8Array): [number, number] | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // PNG: signature, then the IHDR chunk with width and height.
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47)
    return [view.getUint32(16), view.getUint32(20)];
  // JPEG: walk the segments to the first start-of-frame marker.
  if (bytes.length >= 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return undefined;
      const marker = bytes[offset + 1];
      const length = view.getUint16(offset + 2);
      const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrame) return [view.getUint16(offset + 7), view.getUint16(offset + 5)];
      offset += 2 + length;
    }
  }
  return undefined;
}
