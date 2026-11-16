import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, ease } from '../theme';

/** Fades a scene in and out over its own length, so overlapping scenes cross-dissolve. */
export function SceneFade({
  children,
  fadeIn = 14,
  fadeOut = 14,
  delayIn = 0,
  style,
}: {
  children: ReactNode;
  fadeIn?: number;
  fadeOut?: number;
  /** Frames to wait before fading in, so the outgoing scene is mostly gone. */
  delayIn?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = Math.min(
    fadeIn ? interpolate(frame, [delayIn, delayIn + fadeIn], [0, 1], clamp) : 1,
    fadeOut ? interpolate(frame, [durationInFrames - fadeOut, durationInFrames], [1, 0], clamp) : 1,
  );
  return <AbsoluteFill style={{ opacity, ...style }}>{children}</AbsoluteFill>;
}

export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 0 to 1 between two frames, eased out. */
export function progress(frame: number, from: number, to: number, easing = ease.out) {
  return interpolate(frame, [from, to], [0, 1], { ...clamp, easing });
}

/** The near-black backdrop with a warm forge glow behind the center. */
export function Forge({
  glow = 1,
  x = 50,
  y = 55,
  hue = colors.amber,
}: {
  glow?: number;
  x?: number;
  y?: number;
  hue?: string;
}) {
  return (
    <AbsoluteFill style={{ background: colors.bg }}>
      <AbsoluteFill
        style={{
          opacity: glow,
          background: `radial-gradient(ellipse 55% 60% at ${x}% ${y}%, ${hue}2e 0%, ${hue}10 40%, transparent 72%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 85% 80% at 50% 50%, transparent 55%, rgba(0,0,0,0.75) 100%)',
        }}
      />
    </AbsoluteFill>
  );
}

/** Slow drifting mist bands. */
export function Mist({ opacity = 0.5 }: { opacity?: number }) {
  const frame = useCurrentFrame();
  const bands = [0, 1, 2];
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'screen', pointerEvents: 'none' }}>
      {bands.map((i) => {
        const x = ((frame * (0.35 + i * 0.15) + i * 600) % 2600) - 700;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: 560 + i * 140,
              width: 1400,
              height: 260,
              borderRadius: '50%',
              background:
                'radial-gradient(ellipse at center, rgba(255,226,180,0.10) 0%, rgba(255,226,180,0.04) 45%, transparent 70%)',
              filter: 'blur(30px)',
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

/** Embers rising from the bottom of the frame, deterministic per seed. */
export function Embers({
  count = 60,
  seed = 'embers',
  opacity = 1,
  speed = 1,
}: {
  count?: number;
  seed?: string;
  opacity?: number;
  speed?: number;
}) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ opacity, pointerEvents: 'none' }}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const life = 140 + r('life') * 160;
        const t = ((frame * speed + r('offset') * life) % life) / life;
        const x0 = r('x') * width;
        const sway = Math.sin((frame / (30 + r('sway') * 40)) * Math.PI + r('phase') * 6) * 28;
        const x = x0 + sway + t * (r('drift') - 0.5) * 180;
        const y = height + 40 - t * (height * (0.7 + r('rise') * 0.6));
        const size = 2 + r('size') * 4.5;
        const flicker = 0.55 + 0.45 * Math.sin(frame / (3 + r('flicker') * 4) + i);
        const fade = Math.sin(Math.PI * t);
        const hot = r('hue') > 0.5;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: hot ? '#ffd27a' : colors.ember,
              boxShadow: `0 0 ${size * 3}px ${size}px ${hot ? 'rgba(251,191,36,0.55)' : 'rgba(251,122,60,0.55)'}`,
              opacity: fade * flicker,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

/** Layered mountain silhouettes with a gold rim from the light behind them. */
export function Mountains({ rise = 0, rim = 1 }: { rise?: number; rim?: number }) {
  return (
    <AbsoluteFill style={{ transform: `translateY(${110 + (1 - rise) * 120}px)` }}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#140d07" />
            <stop offset="1" stopColor="#0b0b0e" />
          </linearGradient>
          <linearGradient id="near" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a0705" />
            <stop offset="1" stopColor="#050505" />
          </linearGradient>
        </defs>
        <path
          d="M0 820 L180 700 L300 760 L470 610 L610 720 L760 640 L900 700 L1010 560 L1150 690 L1290 620 L1430 720 L1580 600 L1740 700 L1920 640 L1920 1080 L0 1080 Z"
          fill="url(#far)"
          stroke={colors.amber}
          strokeOpacity={0.35 * rim}
          strokeWidth={2}
        />
        <path
          d="M0 900 L140 840 L260 880 L420 780 L560 870 L700 820 L860 900 L1040 800 L1200 880 L1340 830 L1500 900 L1660 820 L1800 880 L1920 850 L1920 1080 L0 1080 Z"
          fill="url(#near)"
          stroke={colors.gold}
          strokeOpacity={0.22 * rim}
          strokeWidth={1.5}
        />
      </svg>
    </AbsoluteFill>
  );
}

/** A soft diagonal light that sweeps across its parent once between two frames. */
export function Glint({ from, duration = 40 }: { from: number; duration?: number }) {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [from, from + duration], [-0.4, 1.4], {
    ...clamp,
    easing: ease.inOut,
  });
  if (t <= -0.4 || t >= 1.4) return null;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        background: `linear-gradient(105deg, transparent ${t * 100 - 18}%, rgba(255,236,190,0.16) ${t * 100 - 4}%, rgba(255,246,220,0.28) ${t * 100}%, rgba(255,236,190,0.16) ${t * 100 + 4}%, transparent ${t * 100 + 18}%)`,
      }}
    />
  );
}

/** Fine film grain over everything, so gradients don't band. */
export function Grain() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: 0.07, mixBlendMode: 'overlay' }}>
      <svg width="1920" height="1080">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed={frame % 12}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="1920" height="1080" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
}
