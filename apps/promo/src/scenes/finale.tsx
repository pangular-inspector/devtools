import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import {
  clamp,
  Embers,
  Forge,
  Mist,
  Mountains,
  progress,
  SceneFade,
} from '../components/atmosphere';
import { colors, ease, fonts, goldGradient } from '../theme';

/** "Version 1.0.0" forged in gold, then the end card. */
export function Finale() {
  const frame = useCurrentFrame();
  const forge = progress(frame, 6, 60, ease.inOut);
  const sheen = interpolate(frame, [40, 110], [-20, 120], clamp);
  const versionOut = interpolate(frame, [118, 140], [1, 0], clamp);
  const versionUp = progress(frame, 118, 150, ease.inOut);
  const card = progress(frame, 132, 166);
  const sun = progress(frame, 0, 90);

  return (
    <SceneFade fadeOut={0}>
      <Forge glow={0.6 + 0.4 * sun} y={72} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 40% 30% at 50% 78%, rgba(251,191,36,${0.35 * sun}) 0%, rgba(251,122,60,${0.12 * sun}) 45%, transparent 75%)`,
        }}
      />
      <Mountains rise={sun} rim={sun} />
      <Mist opacity={0.7} />
      <Embers count={70} seed="finale" opacity={0.9} />

      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 140,
          opacity: versionOut,
          transform: `translateY(${-versionUp * 60}px) scale(${1 - versionUp * 0.1})`,
        }}
      >
        <div
          style={{
            fontFamily: fonts.epic,
            fontWeight: 600,
            fontSize: 34,
            letterSpacing: '0.6em',
            color: '#f3e6c8',
            opacity: progress(frame, 0, 24),
            marginBottom: 10,
            paddingLeft: '0.6em',
          }}
        >
          VERSION
        </div>
        <div
          style={{
            fontFamily: fonts.epic,
            fontWeight: 900,
            fontSize: 250,
            lineHeight: 1,
            letterSpacing: '0.02em',
            backgroundImage: `linear-gradient(100deg, transparent ${sheen - 10}%, rgba(255,255,255,0.9) ${sheen}%, transparent ${sheen + 10}%), ${goldGradient}`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            opacity: forge,
            transform: `scale(${1.12 - 0.12 * forge})`,
            filter: `blur(${(1 - forge) * 14}px) drop-shadow(0 0 ${40 * forge}px rgba(245,165,36,0.45))`,
          }}
        >
          1.0.0
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          opacity: card,
          transform: `translateY(${(1 - card) * 30}px)`,
          paddingBottom: 60,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
          <Img
            src={staticFile('logo-mark-dark.svg')}
            style={{ width: 190, filter: 'drop-shadow(0 0 40px rgba(245,165,36,0.45))' }}
          />
          <div
            style={{
              fontFamily: fonts.sans,
              fontWeight: 800,
              fontSize: 120,
              letterSpacing: '-0.04em',
              color: colors.textStrong,
            }}
          >
            Pangular <span style={{ color: colors.amber }}>Inspector</span>
          </div>
        </div>
        <div
          style={{
            marginTop: 26,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            fontFamily: fonts.sans,
            fontSize: 40,
            fontWeight: 500,
            color: colors.text,
            opacity: progress(frame, 150, 176),
          }}
        >
          The unified Angular devtools
          <span style={{ color: colors.amber }}>·</span>
          <span
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: '#1c1300',
              background: colors.amber,
              borderRadius: 999,
              padding: '6px 20px',
            }}
          >
            open source
          </span>
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: fonts.sans,
            fontWeight: 700,
            fontSize: 44,
            color: colors.textStrong,
            letterSpacing: '0.01em',
            opacity: progress(frame, 166, 190),
          }}
        >
          pangular-inspector.dev
        </div>
        <div
          style={{
            marginTop: 30,
            fontFamily: fonts.mono,
            fontSize: 32,
            color: colors.text,
            background: 'rgba(11,11,14,0.75)',
            border: '1px solid rgba(245,165,36,0.45)',
            borderRadius: 14,
            padding: '16px 28px',
            opacity: progress(frame, 180, 204),
          }}
        >
          <span style={{ color: colors.amber }}>$ </span>npm install -D @pangular-inspector/devtools
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
}
