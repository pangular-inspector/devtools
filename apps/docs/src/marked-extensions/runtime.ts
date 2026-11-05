import type {MarkedExtension} from 'marked';
import {ngmdVideoExtension} from './ngmd-video.ts';
import {createNgmdImageExtension, type NgmdImageSizes} from './ngmd-image.ts';
import {ngmdKeywordsExtension} from './ngmd-keywords.ts';

/** The extensions with no Node deps; `imageSizes` sizes the `<ngmd-image>` images. */
export function createNgmdRuntimeExtensions(imageSizes: NgmdImageSizes = {}): MarkedExtension[] {
  return [
    {
      extensions: [ngmdVideoExtension, createNgmdImageExtension(imageSizes)],
    },
    ngmdKeywordsExtension,
    {hooks: {postprocess: (html: string) => html.replace(/<table>/g, '<table tabindex="0">')}},
  ];
}

export const ngmdRuntimeExtensions = createNgmdRuntimeExtensions();
