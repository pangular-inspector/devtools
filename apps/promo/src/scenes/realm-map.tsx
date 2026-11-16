import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { clamp, progress, SceneFade } from '../components/atmosphere';
import { colors, ease, fonts } from '../theme';

/** The inspectors as places on a map, in the order the path reaches them. */
const PLACES = [
  { name: 'Components', note: 'the live tree', x: 250, y: 640 },
  { name: 'Signals', note: 'graph & history', x: 520, y: 470 },
  { name: 'Injectors', note: 'every lookup', x: 760, y: 700 },
  { name: 'Routes', note: 'every navigation', x: 980, y: 470 },
  { name: 'Forms', note: 'why it is invalid', x: 1180, y: 730 },
  { name: 'Store', note: 'NgRx & signal stores', x: 1400, y: 500 },
  { name: 'Pipes', note: 'pure & impure', x: 1560, y: 760 },
  { name: 'SSR & HTTP', note: 'server to hydration', x: 1690, y: 430 },
];

/** A smooth path through the places, as cubic curves. */
const PATH = PLACES.reduce((d, p, i) => {
  if (i === 0) return `M ${p.x} ${p.y}`;
  const prev = PLACES[i - 1];
  const mx = (prev.x + p.x) / 2;
  return `${d} C ${mx} ${prev.y}, ${mx} ${p.y}, ${p.x} ${p.y}`;
}, '');

const START = 34;
const STEP = 19;

export function RealmMap() {
  const frame = useCurrentFrame();
  const drawn = interpolate(frame, [START, START + STEP * (PLACES.length - 1)], [0, 1], clamp);
  const zoom = interpolate(frame, [0, 240], [1.08, 1], { ...clamp, easing: ease.out });
  const title = progress(frame, 4, 30);

  return (
    <SceneFade>
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <Parchment />
        <Ranges />
        <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <mask id="path-reveal">
              <path
                d={PATH}
                fill="none"
                stroke="#fff"
                strokeWidth={12}
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1 - drawn}
              />
            </mask>
          </defs>
          <path
            d={PATH}
            fill="none"
            stroke={colors.ring}
            strokeWidth={4}
            strokeDasharray="2 14"
            strokeLinecap="round"
            mask="url(#path-reveal)"
          />
        </svg>
        {PLACES.map((place, i) => (
          <Place key={place.name} {...place} at={START + STEP * i} index={i} />
        ))}
        <Compass />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 92 }}>
        <div
          style={{
            fontFamily: fonts.epic,
            fontWeight: 700,
            fontSize: 70,
            color: colors.ink,
            letterSpacing: '0.04em',
            opacity: title,
            transform: `translateY(${(1 - title) * 16}px)`,
          }}
        >
          Every corner of your app, charted.
        </div>
        <div
          style={{
            fontFamily: fonts.serif,
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: 38,
            color: '#7a5a2a',
            marginTop: 8,
            opacity: progress(frame, 18, 44),
          }}
        >
          One inspector for every part of a running Angular app
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
}

function Place({
  name,
  note,
  x,
  y,
  at,
  index,
}: {
  name: string;
  note: string;
  x: number;
  y: number;
  at: number;
  index: number;
}) {
  const frame = useCurrentFrame();
  const lit = progress(frame, at, at + 16);
  const pulse = interpolate(frame, [at, at + 30], [0, 1], clamp);
  const above = index % 2 === 1;
  return (
    <div style={{ position: 'absolute', left: x, top: y }}>
      <div
        style={{
          position: 'absolute',
          left: -60,
          top: -60,
          width: 120,
          height: 120,
          borderRadius: '50%',
          border: `3px solid ${colors.amber}`,
          opacity: (1 - pulse) * lit,
          transform: `scale(${0.4 + pulse * 0.9})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -20,
          top: -20,
          width: 40,
          height: 40,
          borderRadius: '50%',
          background:
            lit > 0
              ? `radial-gradient(circle at 35% 35%, #ffe7a3, ${colors.amber} 55%, #9a4a08)`
              : '#c9b07c',
          border: `3px solid ${colors.ink}`,
          boxShadow: `0 0 ${30 * lit}px ${10 * lit}px rgba(245,165,36,${0.55 * lit})`,
          transform: `scale(${0.7 + 0.3 * lit})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -200,
          width: 400,
          top: above ? -128 : 34,
          textAlign: 'center',
          opacity: 0.25 + 0.75 * lit,
          transform: `translateY(${(1 - lit) * (above ? 10 : -10)}px)`,
        }}
      >
        <div
          style={{
            fontFamily: fonts.epic,
            fontWeight: 900,
            fontSize: 40,
            color: colors.ink,
            letterSpacing: '0.03em',
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontFamily: fonts.serif,
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: 30,
            color: '#6b4a1c',
            marginTop: -2,
          }}
        >
          {note}
        </div>
      </div>
    </div>
  );
}

function Parchment() {
  return (
    <AbsoluteFill style={{ background: colors.parchment }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <filter id="paper">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed={7} />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0 0.1  0 0 0 0.5 -0.1"
          />
        </filter>
        <rect width={1920} height={1080} filter="url(#paper)" opacity={0.55} />
      </svg>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 75% 70% at 50% 52%, transparent 50%, rgba(120,70,20,0.35) 85%, rgba(60,30,8,0.75) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          margin: 36,
          border: `2px solid rgba(59,42,18,0.55)`,
          outline: `1px solid rgba(59,42,18,0.35)`,
          outlineOffset: 10,
        }}
      />
    </AbsoluteFill>
  );
}

/** Ink mountain ranges and a little sea, drawn like on an old map. */
function Ranges() {
  const peaks = [
    [330, 300],
    [380, 285],
    [430, 302],
    [1210, 300],
    [1260, 284],
    [1310, 300],
    [420, 960],
    [470, 945],
    [520, 962],
    [1000, 955],
    [1050, 938],
    [1100, 956],
    [1150, 944],
  ];
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: 0.55 }}>
      {peaks.map(([x, y], i) => (
        <g key={i} stroke={colors.ink} strokeWidth={2.5} fill="none" strokeLinejoin="round">
          <path d={`M ${x - 34} ${y + 30} L ${x} ${y - 24} L ${x + 34} ${y + 30}`} />
          <path d={`M ${x} ${y - 24} L ${x + 8} ${y + 30}`} strokeWidth={1.5} />
        </g>
      ))}
      <g stroke={colors.ink} strokeWidth={2} fill="none" opacity={0.7}>
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M ${1640 + i * 12} ${600 + i * 26} q 20 -12 40 0 t 40 0 t 40 0`} />
        ))}
        {[0, 1].map((i) => (
          <path key={`w${i}`} d={`M ${120 + i * 14} ${380 + i * 26} q 20 -12 40 0 t 40 0`} />
        ))}
      </g>
    </svg>
  );
}

function Compass() {
  return (
    <svg
      width={150}
      height={170}
      viewBox="-75 -95 150 170"
      style={{ position: 'absolute', right: 96, bottom: 84, opacity: 0.7 }}
    >
      <circle r={52} fill="none" stroke={colors.ink} strokeWidth={2} />
      <circle r={44} fill="none" stroke={colors.ink} strokeWidth={1} />
      <path d="M 0 -66 L 9 0 L 0 66 L -9 0 Z" fill={colors.ink} />
      <path d="M -66 0 L 0 9 L 66 0 L 0 -9 Z" fill={colors.ring} />
      <text
        y={-72}
        textAnchor="middle"
        fontFamily={fonts.epic}
        fontWeight={700}
        fontSize={16}
        fill={colors.ink}
      >
        N
      </text>
    </svg>
  );
}
