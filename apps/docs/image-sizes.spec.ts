import {mkdirSync, mkdtempSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {imageSize, readImageSizes} from './image-sizes';

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function jpeg(width: number, height: number): Uint8Array {
  // SOI, an APP0 segment, then a baseline start-of-frame segment.
  const app0 = [0xff, 0xe0, 0x00, 0x04, 0x00, 0x00];
  const sof = [
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
  ];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof, ...new Array(12).fill(0)]);
}

describe('imageSize', () => {
  it('reads PNG and JPEG headers', () => {
    expect(imageSize(png(1280, 800))).toEqual([1280, 800]);
    expect(imageSize(jpeg(640, 480))).toEqual([640, 480]);
  });

  it('returns undefined for other files', () => {
    expect(imageSize(new TextEncoder().encode('<svg></svg>'))).toBeUndefined();
  });
});

describe('readImageSizes', () => {
  it('reads a directory whose path has a space', () => {
    const dir = mkdtempSync(join(tmpdir(), 'image sizes '));
    writeFileSync(join(dir, 'a.png'), png(2, 1));
    expect(readImageSizes(dir)).toEqual({'/a.png': [2, 1]});
  });

  it('returns nothing when there is no public directory', () => {
    expect(readImageSizes(join(tmpdir(), 'image-sizes-missing-dir'))).toEqual({});
  });

  it('fails when an image cannot be read, instead of leaving it out', () => {
    const dir = mkdtempSync(join(tmpdir(), 'image-sizes-'));
    symlinkSync(join(dir, 'gone.png'), join(dir, 'broken.png'));
    expect(() => readImageSizes(dir)).toThrow(/ENOENT/);
  });

  it('keys the sizes by URL path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'image-sizes-'));
    mkdirSync(join(dir, 'images/panel'), {recursive: true});
    writeFileSync(join(dir, 'images/panel/router.png'), png(1280, 800));
    writeFileSync(join(dir, 'logo.svg'), '<svg></svg>');
    expect(readImageSizes(dir)).toEqual({'/images/panel/router.png': [1280, 800]});
  });
});
