import { loadFont as loadCinzel } from '@remotion/google-fonts/Cinzel';
import { loadFont as loadCormorant } from '@remotion/google-fonts/CormorantGaramond';
import { loadFont as loadGeistMono } from '@remotion/google-fonts/GeistMono';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { Easing } from 'remotion';

const latin = { subsets: ['latin'] as ['latin'] };

export const fonts = {
  /** Epic titles. */
  epic: loadCinzel('normal', { weights: ['400', '600', '700', '900'], ...latin }).fontFamily,
  /** Italic asides on the map and the cold open. */
  serif: loadCormorant('italic', { weights: ['500', '600'], ...latin }).fontFamily,
  /** The brand grotesk, as in the panel and the docs. */
  sans: loadInter('normal', { weights: ['400', '500', '600', '700', '800', '900'], ...latin })
    .fontFamily,
  /** Code, as in the docs. */
  mono: loadGeistMono('normal', { weights: ['400', '500', '700'], ...latin }).fontFamily,
};

/** The panel's dark neutrals and amber accent (app/src/styles/_palette.scss). */
export const colors = {
  bg: '#0b0b0e',
  surface: '#131317',
  surface2: '#1a1a20',
  border: '#25252c',
  borderStrong: '#34343d',
  text: '#ececf1',
  textStrong: '#fafafa',
  text2: '#a1a1aa',
  text3: '#8e8e99',
  amber: '#f5a524',
  amberHover: '#fbbf4d',
  /** The logo's gold, its darker face and its ring (apps/docs/public/logo-mark-dark.svg). */
  gold: '#fbbf24',
  goldDeep: '#f59e0b',
  ring: '#78350f',
  ember: '#fb7a3c',
  parchment: '#efe2c2',
  parchmentDark: '#d9c497',
  ink: '#3b2a12',
};

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Frames for a number of seconds. */
export const s = (seconds: number) => Math.round(seconds * FPS);

export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.5, 0, 0.75, 0),
};

/** A molten gold fill for text, used with background-clip. */
export const goldGradient =
  'linear-gradient(180deg, #fff3c4 0%, #fbd46a 28%, #f5a524 55%, #b8650f 82%, #ffd27a 100%)';
