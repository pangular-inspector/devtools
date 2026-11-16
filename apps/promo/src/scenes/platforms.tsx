import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { Embers, Forge, Mist, progress, SceneFade } from '../components/atmosphere';
import { colors, fonts, goldGradient } from '../theme';

// The supported platforms and setups in apps/docs getting-started/platforms.md
// and installation.md.
const PLATFORMS = [
  { name: 'Angular', note: 'CLI, SSR & hydration', logo: 'angular' },
  { name: 'Analog', note: 'Vite & Nitro', logo: 'analog' },
  { name: 'Capacitor', note: '& Ionic WebViews', logo: 'capacitor' },
  { name: 'NativeScript', note: 'over a WebSocket', logo: 'nativescript' },
  { name: 'Angular Native', note: 'over a WebSocket', logo: 'angular-native' },
];

const W = 300;
const GAP = 28;

export function Platforms() {
  const frame = useCurrentFrame();
  const title = progress(frame, 2, 30);
  const left = (1920 - (W * 5 + GAP * 4)) / 2;
  return (
    <SceneFade>
      <Forge glow={1} y={58} />
      <Mist opacity={0.5} />
      <Embers count={30} seed="platforms" opacity={0.5} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 170 }}>
        <div
          style={{
            fontFamily: fonts.epic,
            fontWeight: 700,
            fontSize: 84,
            letterSpacing: '0.04em',
            opacity: title,
            transform: `translateY(${(1 - title) * 20}px)`,
            display: 'flex',
            gap: 28,
          }}
        >
          <span style={{ color: colors.textStrong }}>Wherever</span>
          <span
            style={{
              backgroundImage: goldGradient,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Angular runs.
          </span>
        </div>
      </AbsoluteFill>
      {PLATFORMS.map((p, i) => {
        const t = progress(frame, 22 + i * 10, 52 + i * 10);
        const float = Math.sin((frame + i * 17) / 26) * 6;
        return (
          <div
            key={p.name}
            style={{
              position: 'absolute',
              left: left + i * (W + GAP),
              top: 440,
              width: W,
              height: 340,
              borderRadius: 24,
              background: 'linear-gradient(180deg, #1a171b, #100f12)',
              border: `1.5px solid rgba(245,165,36,${0.18 + 0.3 * t})`,
              boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 40px rgba(245,165,36,${0.12 * t})`,
              opacity: t,
              transform: `translateY(${(1 - t) * 60 + float}px)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
            }}
          >
            <Img
              src={staticFile(`logos/${p.logo}.svg`)}
              style={{ height: 120, width: 140, objectFit: 'contain' }}
            />
            <div
              style={{
                fontFamily: fonts.sans,
                fontWeight: 700,
                fontSize: 34,
                color: colors.textStrong,
                letterSpacing: '-0.01em',
              }}
            >
              {p.name}
            </div>
            <div
              style={{ fontFamily: fonts.sans, fontSize: 24, color: colors.text2, marginTop: -10 }}
            >
              {p.note}
            </div>
          </div>
        );
      })}
    </SceneFade>
  );
}
