import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp, Embers, Forge, Glint, progress, SceneFade } from '../components/atmosphere';
import { colors, ease, fonts } from '../theme';

export interface ProductBeat {
  /** Small caps over the headline, like a chapter. */
  chapter: string;
  first: string;
  second: string;
  points: string[];
  /** A PNG in public/shots. */
  shot: string;
  /** Where the slow push-in heads, in percent of the shot. */
  focus: [number, number];
  /** Puts the shot on the left and the text on the right. */
  flip?: boolean;
}

const SHOT_W = 1120;
const SHOT_H = 700;

/** A headline, three points and a panel screenshot that pushes in slowly. */
export function Product({ chapter, first, second, points, shot, focus, flip }: ProductBeat) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const enter = progress(frame, 0, 34);
  const push = interpolate(frame, [0, durationInFrames], [1, 1.12], {
    ...clamp,
    easing: ease.inOut,
  });
  const turn = interpolate(frame, [0, durationInFrames], [flip ? 9 : -9, flip ? 3 : -3], clamp);
  const dir = flip ? -1 : 1;

  return (
    <SceneFade delayIn={6} fadeIn={12} fadeOut={10}>
      <Forge glow={0.9} x={flip ? 30 : 68} y={50} />
      <Embers count={26} seed={shot} opacity={0.6} speed={0.7} />

      <div
        style={{
          position: 'absolute',
          top: 190,
          [flip ? 'left' : 'right']: 90,
          width: SHOT_W,
          height: SHOT_H,
          perspective: 1800,
          opacity: enter,
          transform: `translateX(${(1 - enter) * 90 * dir}px)`,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 18,
            overflow: 'hidden',
            transform: `rotateY(${turn}deg)`,
            transformOrigin: flip ? 'left center' : 'right center',
            border: `1.5px solid rgba(245,165,36,0.45)`,
            boxShadow:
              '0 40px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 80px rgba(245,165,36,0.18)',
            background: colors.bg,
            position: 'relative',
          }}
        >
          <Img
            src={staticFile(`shots/${shot}.png`)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top left',
              transform: `scale(${push})`,
              transformOrigin: `${focus[0]}% ${focus[1]}%`,
            }}
          />
          <Glint from={36} duration={46} />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [flip ? 'right' : 'left']: 100,
          width: 600,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontFamily: fonts.epic,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: '0.32em',
            color: colors.amber,
            opacity: progress(frame, 4, 26),
            marginBottom: 26,
          }}
        >
          {chapter}
        </div>
        <Phrase text={first} at={8} color={colors.textStrong} />
        <Phrase text={second} at={24} color={colors.amber} />
        <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {points.map((point, i) => {
            const t = progress(frame, 44 + i * 12, 70 + i * 12);
            return (
              <div
                key={point}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  opacity: t,
                  transform: `translateX(${(1 - t) * -20}px)`,
                  fontFamily: fonts.sans,
                  fontWeight: 500,
                  fontSize: 32,
                  color: colors.text,
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    transform: 'rotate(45deg)',
                    background: colors.amber,
                    boxShadow: `0 0 14px ${colors.amber}`,
                    flex: 'none',
                  }}
                />
                {point}
              </div>
            );
          })}
        </div>
      </div>
    </SceneFade>
  );
}

function Phrase({ text, at, color }: { text: string; at: number; color: string }) {
  const frame = useCurrentFrame();
  const t = progress(frame, at, at + 26);
  return (
    <div style={{ overflow: 'hidden', paddingBottom: 6 }}>
      <div
        style={{
          fontFamily: fonts.sans,
          fontWeight: 800,
          fontSize: 92,
          lineHeight: 1.02,
          letterSpacing: '-0.035em',
          color,
          transform: `translateY(${(1 - t) * 100}%)`,
          opacity: t,
        }}
      >
        {text}
      </div>
    </div>
  );
}
