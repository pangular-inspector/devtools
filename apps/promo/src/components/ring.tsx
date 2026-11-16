import { colors, fonts } from '../theme';

/** The inspectors, written around the ring like an inscription. */
const INSCRIPTION =
  'COMPONENTS ✦ SIGNALS ✦ INJECTORS ✦ ROUTES ✦ FORMS ✦ STORE ✦ PIPES ✦ SSR & HTTP ✦ TIMELINE ✦ ';

/**
 * A gold ring drawn around (cx, cy). `draw` runs the stroke from 0 to 1,
 * `heat` lights the inscription, `spin` turns it in degrees, and `tilt`
 * (0 to 1) lays the ring down into the ellipse of the logo mark.
 */
export function ForgedRing({
  cx,
  cy,
  r,
  draw,
  heat,
  spin,
  tilt,
  glow,
  inscription,
}: {
  cx: number;
  cy: number;
  r: number;
  draw: number;
  heat: number;
  spin: number;
  tilt: number;
  glow: number;
  inscription: number;
}) {
  const circumference = 2 * Math.PI * r;
  const textR = r + 40;
  const textCirc = 2 * Math.PI * textR;
  // The logo's ellipse is 128 by 34, turned 10 degrees.
  const scaleY = 1 - tilt * (1 - 34 / 128);
  const rotate = -10 * tilt;
  const heatColor = mix(colors.ember, '#ffe39a', heat);
  return (
    <svg
      width={1920}
      height={1080}
      viewBox="0 0 1920 1080"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
        filter: `drop-shadow(0 0 ${18 * glow}px rgba(245,165,36,${0.65 * glow})) drop-shadow(0 0 ${60 * glow}px rgba(251,122,60,${0.35 * glow}))`,
      }}
    >
      <defs>
        <linearGradient id="ring-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1b8" />
          <stop offset="0.3" stopColor={colors.gold} />
          <stop offset="0.6" stopColor={colors.goldDeep} />
          <stop offset="0.85" stopColor="#a8560c" />
          <stop offset="1" stopColor="#ffd46b" />
        </linearGradient>
        <path
          id="ring-text"
          d={`M ${cx} ${cy - textR} a ${textR} ${textR} 0 1 1 -0.01 0`}
          fill="none"
        />
      </defs>
      <g
        transform={`translate(${cx} ${cy}) rotate(${rotate}) scale(1 ${scaleY}) translate(${-cx} ${-cy})`}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="url(#ring-gold)"
          strokeWidth={22}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - draw)}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r - 7}
          fill="none"
          stroke="#fff6d6"
          strokeOpacity={0.55 * draw}
          strokeWidth={1.5}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r + 7}
          fill="none"
          stroke="#7a3b07"
          strokeOpacity={0.8 * draw}
          strokeWidth={2}
        />
      </g>
      <g opacity={inscription} transform={`rotate(${spin} ${cx} ${cy})`}>
        <text
          fontFamily={fonts.epic}
          fontWeight={600}
          fontSize={22}
          fill={heatColor}
          style={{ filter: `drop-shadow(0 0 ${6 + 10 * heat}px ${colors.ember})` }}
        >
          <textPath href="#ring-text" textLength={textCirc - 8} lengthAdjust="spacing">
            {INSCRIPTION}
          </textPath>
        </text>
      </g>
    </svg>
  );
}

function mix(a: string, b: string, t: number) {
  const pa = parse(a);
  const pb = parse(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function parse(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
