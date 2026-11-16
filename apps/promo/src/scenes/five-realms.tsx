import type { ReactNode } from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { clamp, Embers, Forge, progress, SceneFade } from '../components/atmosphere';
import { colors, ease, fonts, goldGradient } from '../theme';

const REALMS: { title: string; note: string; art: ReactNode }[] = [
  { title: 'Embedded panel', note: 'docked next to your app', art: <PanelArt /> },
  { title: 'Chrome DevTools', note: 'browser extension', art: <DevtoolsArt /> },
  { title: 'CLI', note: 'npx pangular dev', art: <CliArt /> },
  { title: 'Static report', note: 'self-contained, to share', art: <ReportArt /> },
  { title: 'MCP server', note: 'tools for coding agents', art: <McpArt /> },
];

const CARD_W = 340;
const GAP = 22;
const ROW_Y = 600;

export function FiveRealms() {
  const frame = useCurrentFrame();
  const title = progress(frame, 2, 30);
  const hub = progress(frame, 14, 40);
  const left = (1920 - (CARD_W * 5 + GAP * 4)) / 2;

  return (
    <SceneFade>
      <Forge glow={1} y={40} />
      <Embers count={30} seed="realms" opacity={0.5} />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 96 }}>
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
          <span style={{ color: colors.textStrong }}>Five realms.</span>
          <span
            style={{
              backgroundImage: goldGradient,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            One tool.
          </span>
        </div>
      </AbsoluteFill>

      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        {REALMS.map((_, i) => {
          const x = left + CARD_W / 2 + i * (CARD_W + GAP);
          const t = progress(frame, 30 + i * 8, 56 + i * 8, ease.inOut);
          const d = `M 960 418 C 960 500, ${x} 480, ${x} ${ROW_Y}`;
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={colors.amber}
              strokeOpacity={0.7}
              strokeWidth={2}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - t}
              style={{ filter: 'drop-shadow(0 0 6px rgba(245,165,36,0.8))' }}
            />
          );
        })}
      </svg>

      <div
        style={{
          position: 'absolute',
          left: 960 - 70,
          top: 280,
          width: 140,
          height: 140,
          borderRadius: 32,
          background: 'linear-gradient(180deg, #221a10, #120e09)',
          border: `1.5px solid rgba(245,165,36,0.55)`,
          boxShadow: `0 0 ${60 * hub}px rgba(245,165,36,0.35)`,
          opacity: hub,
          transform: `scale(${0.8 + 0.2 * hub})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Img src={staticFile('logo-mark-dark.svg')} style={{ width: 110 }} />
      </div>

      {REALMS.map((realm, i) => {
        const t = progress(frame, 44 + i * 9, 74 + i * 9);
        const lit = interpolate(frame, [44 + i * 9, 60 + i * 9, 110 + i * 9], [0, 1, 0.55], clamp);
        return (
          <div
            key={realm.title}
            style={{
              position: 'absolute',
              left: left + i * (CARD_W + GAP),
              top: ROW_Y,
              width: CARD_W,
              height: 330,
              borderRadius: 20,
              background: 'linear-gradient(180deg, #19161a, #111013)',
              border: `1.5px solid rgba(245,165,36,${0.2 + 0.5 * lit})`,
              boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 ${50 * lit}px rgba(245,165,36,${0.25 * lit})`,
              opacity: t,
              transform: `translateY(${(1 - t) * 50}px)`,
              padding: 22,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                height: 168,
                borderRadius: 12,
                background: '#0d0c0f',
                border: `1px solid ${colors.border}`,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {realm.art}
            </div>
            <div
              style={{
                fontFamily: fonts.sans,
                fontWeight: 700,
                fontSize: 31,
                color: colors.textStrong,
                marginTop: 22,
                letterSpacing: '-0.01em',
              }}
            >
              {realm.title}
            </div>
            <div
              style={{
                fontFamily: realm.title === 'CLI' ? fonts.mono : fonts.sans,
                fontSize: realm.title === 'CLI' ? 22 : 24,
                color: colors.text2,
                marginTop: 6,
              }}
            >
              {realm.note}
            </div>
          </div>
        );
      })}
    </SceneFade>
  );
}

const bar = (w: number | string, h = 8, c = colors.borderStrong) => ({
  width: w,
  height: h,
  borderRadius: 4,
  background: c,
});

function PanelArt() {
  return (
    <div style={{ position: 'absolute', inset: 12, display: 'flex', gap: 10 }}>
      <div style={{ flex: 1.3, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={bar('80%', 30, colors.surface2)} />
        <div style={bar('100%', 52, colors.surface2)} />
        <div style={bar('60%', 30, colors.surface2)} />
      </div>
      <div
        style={{
          flex: 1,
          borderLeft: `2px solid ${colors.amber}`,
          paddingLeft: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
        }}
      >
        <div style={bar('70%', 10, colors.amber)} />
        {[90, 70, 80, 55, 75].map((w, i) => (
          <div key={i} style={bar(`${w}%`)} />
        ))}
      </div>
    </div>
  );
}

function DevtoolsArt() {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          height: 34,
          background: colors.surface2,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
        }}
      >
        <ChromeDot />
        {['Elements', 'Console', 'Network'].map((t) => (
          <span key={t} style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.text3 }}>
            {t}
          </span>
        ))}
        <span
          style={{
            fontFamily: fonts.sans,
            fontSize: 12,
            fontWeight: 700,
            color: '#1c1300',
            background: colors.amber,
            padding: '2px 7px',
            borderRadius: 5,
          }}
        >
          Pangular
        </span>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {[85, 60, 75, 50].map((w, i) => (
          <div key={i} style={bar(`${w}%`)} />
        ))}
      </div>
    </div>
  );
}

function ChromeDot() {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        background:
          'conic-gradient(from -30deg, #ea4335 0 120deg, #fbbc04 120deg 240deg, #34a853 240deg 360deg)',
        boxShadow: 'inset 0 0 0 4px transparent',
        position: 'relative',
        flex: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 4.5,
          borderRadius: '50%',
          background: '#4285f4',
          border: '2px solid #fff',
        }}
      />
    </span>
  );
}

function CliArt() {
  const lines = [
    ['$ ', 'npx pangular dev', colors.text],
    ['', 'scanning source files', colors.text3],
    ['✓ ', 'routes · components', '#4ade80'],
    ['✓ ', 'signals · pipes', '#4ade80'],
    ['→ ', 'panel ready', colors.amber],
  ];
  return (
    <div style={{ padding: 14, fontFamily: fonts.mono, fontSize: 15, lineHeight: 1.65 }}>
      {lines.map(([prefix, text, color]) => (
        <div key={text} style={{ color }}>
          {prefix}
          {text}
        </div>
      ))}
    </div>
  );
}

function ReportArt() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 14,
        borderRadius: 8,
        background: '#f4efe4',
        padding: 12,
        display: 'flex',
        gap: 12,
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontFamily: fonts.mono, fontSize: 13, fontWeight: 700, color: '#2b2116' }}>
          report/
        </div>
        {[80, 60, 70].map((w, i) => (
          <div key={i} style={bar(`${w}%`, 7, '#d8cdb7')} />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        {[40, 70, 52, 96].map((h, i) => (
          <div
            key={i}
            style={{ width: 16, height: h, borderRadius: 3, background: colors.amber }}
          />
        ))}
      </div>
    </div>
  );
}

function McpArt() {
  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          alignSelf: 'flex-end',
          fontFamily: fonts.sans,
          fontSize: 13,
          fontWeight: 600,
          color: '#1c1300',
          background: colors.amber,
          padding: '5px 10px',
          borderRadius: 10,
        }}
      >
        Why is Pay disabled?
      </div>
      {['inspect-component', 'inspect-signals', 'explain-invalid-forms'].map((t) => (
        <div key={t} style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.text2 }}>
          <span style={{ color: '#4ade80' }}>●</span> {t}
        </div>
      ))}
    </div>
  );
}
