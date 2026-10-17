// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compileString } from 'sass';
import { VIEW_ACCENTS } from '../view-accents';

// Tinted pills (`m.tint`, data-tone badges, DI kind letters) put `--<tone>-text`
// on a 12 to 16% tint of the tone. The pill can sit on a plain, hovered or
// pressed surface, or on a selected row (`--accent` at 12% or 16%). The text must
// keep 4.5:1 on all of them, in both themes and with every accent.

type Rgb = [number, number, number];
type Tokens = Record<string, string>;

const STYLES = new URL('../styles/', import.meta.url).pathname;
const PAGES = new URL('../pages/', import.meta.url).pathname;
const ACCENTS = ['amber', 'ember', 'gold'];
const TONES = ['ok', 'warn', 'danger', 'accent'];

function theme(accent: string): { dark: Tokens; light: Tokens } {
  const { css } = compileString(`@use 'theme' with ($accent: ${accent});`, {
    loadPaths: [STYLES],
  });
  const read = (selector: string): Tokens => {
    const start = css.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThanOrEqual(0);
    const body = css.slice(start, css.indexOf('}', start));
    const tokens: Tokens = {};
    for (const [, name, value] of body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
      tokens[name] = value;
    }
    return tokens;
  };
  return { dark: read(':root'), light: read(`:root[data-theme=light]`) };
}

const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const ratio = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const mix = (top: Rgb, amount: number, under: Rgb): Rgb =>
  top.map((v, i) => v * amount + under[i] * (1 - amount)) as Rgb;

function worst(tokens: Tokens, tone: string) {
  const under: [string, Rgb][] = ['bg', 'surface', 'surface-2', 'surface-3'].map((k) => [
    k,
    rgb(tokens[k]),
  ]);
  for (const amount of [12, 16]) {
    under.push([
      `a selected row (accent ${amount}%)`,
      mix(rgb(tokens['accent']), amount / 100, rgb(tokens['surface'])),
    ]);
  }
  let min = { ratio: Infinity, on: '' };
  for (const amount of [12, 16]) {
    for (const [name, backdrop] of under) {
      const tint = mix(rgb(tokens[tone]), amount / 100, backdrop);
      const value = ratio(rgb(tokens[`${tone}-text`]), tint);
      if (value < min.ratio)
        min = { ratio: value, on: `--${tone}-text on ${amount}% tint over ${name}` };
    }
  }
  return min;
}

describe('text on tinted pills', () => {
  for (const accent of ACCENTS) {
    const themes = theme(accent);
    for (const mode of ['dark', 'light'] as const) {
      for (const tone of TONES) {
        it(`${accent} ${mode}: --${tone}-text keeps 4.5:1 on its tint`, () => {
          const tokens = themes[mode];
          expect(tokens[`${tone}-text`], `--${tone}-text`).toBeDefined();
          const min = worst(tokens, tone);
          expect(min.ratio, min.on).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }

  // Brand views replace --accent and --accent-text on the panel root, which also
  // changes the selected-row tint under every other pill.
  const base = theme('amber');
  for (const mode of ['dark', 'light'] as const) {
    for (const [view, brand] of Object.entries(VIEW_ACCENTS[mode])) {
      for (const tone of TONES) {
        it(`${view} view ${mode}: --${tone}-text keeps 4.5:1 on its tint`, () => {
          const tokens = { ...base[mode], accent: brand.accent, 'accent-text': brand.text };
          const min = worst(tokens, tone);
          expect(min.ratio, min.on).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});

// Category hues (Analog route kinds, render modes, server calls and method
// badges): `--hue-<name>-text` sits on a plain surface-2 pill or on a 12 to 16%
// tint of `--hue-<name>`, over any surface or a selected row in the Analog view.
const HUES = [
  'slate',
  'sky',
  'info',
  'blue',
  'teal',
  'green',
  'yellow',
  'orange',
  'pink',
  'purple',
];

describe('text on category hue pills', () => {
  const base = theme('amber');
  for (const mode of ['dark', 'light'] as const) {
    const analog = VIEW_ACCENTS[mode].analog;
    for (const hue of HUES) {
      it(`${mode}: --hue-${hue}-text keeps 4.5:1 on plain and tinted pills`, () => {
        const tokens = base[mode];
        expect(tokens[`hue-${hue}`], `--hue-${hue}`).toBeDefined();
        expect(tokens[`hue-${hue}-text`], `--hue-${hue}-text`).toBeDefined();
        const text = rgb(tokens[`hue-${hue}-text`]);
        for (const surface of ['bg', 'surface', 'surface-2', 'surface-3']) {
          expect(ratio(text, rgb(tokens[surface])), `on --${surface}`).toBeGreaterThanOrEqual(4.5);
        }
        for (const accent of [tokens['accent'], analog.accent]) {
          const min = worst({ ...tokens, accent }, `hue-${hue}`);
          expect(min.ratio, `${min.on} (accent ${accent})`).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  }
});

// Router timeline phases are graphics (bar segments and legend dots), so they
// need 3:1 on the bar track and every surface the timeline sits on.
const PHASES = ['recognize', 'guards', 'resolve', 'activate'];

describe('router timeline phase colours', () => {
  const base = theme('amber');
  for (const mode of ['dark', 'light'] as const) {
    for (const phase of PHASES) {
      it(`${mode}: --phase-${phase} keeps 3:1 on every surface`, () => {
        const tokens = base[mode];
        expect(tokens[`phase-${phase}`], `--phase-${phase}`).toBeDefined();
        const color = rgb(tokens[`phase-${phase}`]);
        for (const surface of ['bg', 'surface', 'surface-2', 'surface-3']) {
          expect(ratio(color, rgb(tokens[surface])), `on --${surface}`).toBeGreaterThanOrEqual(3);
        }
      });
    }
  }
});

// Pages that used hard-coded hex colors now take them from the tokens above, so
// both themes get a value these tests check.
const TOKEN_ONLY_PAGES = ['analog-inspector.ts', 'route-timeline.ts'];

describe('pages that use theme tokens only', () => {
  for (const file of TOKEN_ONLY_PAGES) {
    it(`${file} has no hex colors`, async () => {
      // The panel tsconfig has no Node types, so read the file through a loose import.
      const fsName = 'node:fs';
      const fs = (await import(/* @vite-ignore */ fsName)) as {
        readFileSync(path: string, encoding: 'utf8'): string;
      };
      const source = fs.readFileSync(`${PAGES}${file}`, 'utf8');
      expect(source.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    });
  }
});
