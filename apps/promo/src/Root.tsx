import type { ComponentType } from 'react';
import { AbsoluteFill, Composition, Html5Audio, Sequence, staticFile } from 'remotion';
import { Grain } from './components/atmosphere';
import { Agent } from './scenes/agent';
import { Finale } from './scenes/finale';
import { FiveRealms } from './scenes/five-realms';
import { Platforms } from './scenes/platforms';
import { Product, type ProductBeat } from './scenes/product';
import { Prologue } from './scenes/prologue';
import { RealmMap } from './scenes/realm-map';
import { colors, FPS, HEIGHT, WIDTH } from './theme';

/** Frames each scene overlaps the next, for a cross-dissolve. */
const OVERLAP = 14;

const product = (beat: ProductBeat) => () => <Product {...beat} />;

const SCENES: { name: string; frames: number; component: ComponentType }[] = [
  { name: 'Prologue', frames: 360, component: Prologue },
  { name: 'Map', frames: 225, component: RealmMap },
  {
    name: 'Components',
    frames: 140,
    component: product({
      chapter: 'I · COMPONENTS',
      first: 'Every component.',
      second: 'Live values.',
      points: ['Inputs, outputs & signals', 'Injected services', 'Hydration per host'],
      shot: 'components',
      focus: [80, 40],
    }),
  },
  {
    name: 'Signals',
    frames: 140,
    component: product({
      chapter: 'II · SIGNALS',
      first: 'Every signal.',
      second: 'Every dependency.',
      points: [
        'Producers & consumers',
        'Value history per signal',
        'Computeds, effects, resources',
      ],
      shot: 'signals',
      focus: [4, 45],
      flip: true,
    }),
  },
  {
    name: 'Routes',
    frames: 140,
    component: product({
      chapter: 'III · ROUTES',
      first: 'Navigations,',
      second: 'explained.',
      points: ['Every navigation & outcome', 'Guards and redirects', 'Replay & compare'],
      shot: 'routes',
      focus: [70, 55],
    }),
  },
  {
    name: 'SSR',
    frames: 140,
    component: product({
      chapter: 'IV · SSR & HTTP',
      first: 'SSR &',
      second: 'hydration.',
      points: ['Server & browser HttpClient calls', 'Transfer cache hits', 'Hydration stats'],
      shot: 'ssr-http',
      focus: [4, 50],
      flip: true,
    }),
  },
  { name: 'FiveRealms', frames: 195, component: FiveRealms },
  { name: 'Agent', frames: 225, component: Agent },
  { name: 'Platforms', frames: 165, component: Platforms },
  { name: 'Finale', frames: 300, component: Finale },
];

const STARTS = SCENES.reduce<number[]>(
  (starts, scene, i) => [...starts, i ? starts[i - 1] + SCENES[i - 1].frames - OVERLAP : 0],
  [],
);
export const DURATION = STARTS[STARTS.length - 1] + SCENES[SCENES.length - 1].frames;

export function Promo() {
  return (
    <AbsoluteFill style={{ background: colors.bg }}>
      {SCENES.map(({ name, frames, component: Scene }, i) => (
        <Sequence key={name} name={name} from={STARTS[i]} durationInFrames={frames}>
          <Scene />
        </Sequence>
      ))}
      <Grain />
      {/* The original score from music/compose.py, timed to the scenes above. */}
      <Html5Audio src={staticFile('music/score.m4a')} />
    </AbsoluteFill>
  );
}

export function Root() {
  return (
    <Composition
      id="Promo"
      component={Promo}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
}
