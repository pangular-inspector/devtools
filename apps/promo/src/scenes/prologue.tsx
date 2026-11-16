import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, Embers, Forge, Mist, progress, SceneFade } from '../components/atmosphere';
import { ForgedRing } from '../components/ring';
import { colors, ease, fonts, goldGradient } from '../theme';

// The logo mark's viewBox is -13 4 278 250 and its ellipse sits at (120, 129)
// with a 128 unit radius, so the ring radius sets the logo's scale.
const R = 220;
const SCALE = R / 128;
const CX = 960;
const CY = 430;

/** Darkness, a ring forged from embers, then the ring lies down into the logo mark. */
export function Prologue() {
  const frame = useCurrentFrame();

  const draw = progress(frame, 18, 96, ease.inOut);
  const heat = progress(frame, 70, 150);
  const inscription = progress(frame, 60, 110) * interpolate(frame, [196, 222], [1, 0], clamp);
  const tilt = progress(frame, 214, 258, ease.inOut);
  const logo = progress(frame, 240, 272);
  const flash = interpolate(frame, [244, 254, 290], [0, 1, 0], clamp);
  const ringFade = interpolate(frame, [250, 272], [1, 0], clamp);
  const glow = 0.35 + 0.65 * progress(frame, 30, 120) + flash * 0.6;
  const breathe = 1 + Math.sin(frame / 22) * 0.012;
  const push = interpolate(frame, [0, 345], [1.04, 1], { ...clamp, easing: ease.out });

  return (
    <SceneFade fadeIn={0} fadeOut={16}>
      <Forge glow={progress(frame, 10, 120)} y={40} />
      <Embers count={70} seed="prologue" opacity={progress(frame, 0, 40)} />
      <Mist opacity={0.6} />
      <AbsoluteFill style={{ transform: `scale(${push * breathe})` }}>
        <AbsoluteFill style={{ opacity: ringFade }}>
          <ForgedRing
            cx={CX}
            cy={CY}
            r={R}
            draw={draw}
            heat={heat}
            spin={frame * 0.12}
            tilt={tilt}
            glow={glow}
            inscription={inscription}
          />
        </AbsoluteFill>
        <Img
          src={staticFile('logo-mark-dark.svg')}
          style={{
            position: 'absolute',
            width: 278 * SCALE,
            height: 250 * SCALE,
            left: CX - (120 + 13) * SCALE,
            top: CY - (129 - 4) * SCALE,
            opacity: logo,
            transform: `scale(${0.92 + 0.08 * logo})`,
            filter: `drop-shadow(0 0 ${30 + flash * 50}px rgba(245,165,36,${0.45 + flash * 0.4}))`,
          }}
        />
        <AbsoluteFill
          style={{
            opacity: flash * 0.5,
            background: `radial-gradient(circle at 50% ${(CY / 1080) * 100}%, rgba(255,230,170,0.7) 0%, transparent 35%)`,
            mixBlendMode: 'screen',
          }}
        />
      </AbsoluteFill>

      <Line text="In the age of scattered devtools…" from={44} to={128} />
      <Line text="…one tool was forged." from={132} to={214} />
      <Tagline from={262} />
    </SceneFade>
  );
}

function Line({ text, from, to }: { text: string; from: number; to: number }) {
  const frame = useCurrentFrame();
  const opacity = Math.min(
    progress(frame, from, from + 22),
    interpolate(frame, [to - 14, to], [1, 0], clamp),
  );
  const blur = (1 - progress(frame, from, from + 26)) * 10;
  const spacing = 0.08 + 0.06 * progress(frame, from, to, ease.inOut);
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 150 }}>
      <div
        style={{
          fontFamily: fonts.epic,
          fontWeight: 400,
          fontSize: 62,
          color: '#f3e6c8',
          letterSpacing: `${spacing}em`,
          opacity,
          filter: `blur(${blur}px)`,
          textShadow: '0 0 30px rgba(245,165,36,0.35)',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

function Tagline({ from }: { from: number }) {
  const frame = useCurrentFrame();
  const t = progress(frame, from, from + 30);
  const sheen = interpolate(frame, [from, from + 70], [0, 100], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 120 }}>
      <div
        style={{
          fontFamily: fonts.epic,
          fontWeight: 700,
          fontSize: 84,
          letterSpacing: '0.06em',
          backgroundImage: `linear-gradient(100deg, transparent ${sheen - 12}%, rgba(255,255,255,0.85) ${sheen}%, transparent ${sheen + 12}%), ${goldGradient}`,
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          opacity: t,
          transform: `translateY(${(1 - t) * 24}px)`,
          filter: `drop-shadow(0 4px 24px rgba(245,165,36,0.35))`,
        }}
      >
        One devtools to rule them all.
      </div>
      <div
        style={{
          height: 2,
          width: 520 * t,
          marginTop: 22,
          background: `linear-gradient(90deg, transparent, ${colors.amber}, transparent)`,
        }}
      />
    </AbsoluteFill>
  );
}
