import { interpolate, useCurrentFrame } from 'remotion';
import { clamp, Embers, Forge, progress, SceneFade } from '../components/atmosphere';
import { colors, fonts } from '../theme';

type Row =
  | { kind: 'ask'; text: string; at: number }
  | { kind: 'tool'; name: string; args: string; at: number }
  | { kind: 'result'; text: string; at: number }
  | { kind: 'answer'; text: string; at: number };

// Tool names as MCP clients see them: pangular_<name> (apps/docs agents/tools.md).
const ROWS: Row[] = [
  { kind: 'ask', text: 'Why is the Pay button disabled?', at: 20 },
  { kind: 'tool', name: 'pangular_inspect-component', args: 'component: "CheckoutForm"', at: 58 },
  { kind: 'result', text: 'canPay: false · total: 86 · coupon: "SPRING"', at: 74 },
  { kind: 'tool', name: 'pangular_inspect-signals', args: 'component: "CheckoutForm"', at: 92 },
  { kind: 'result', text: 'canPay ← total, shippingMethod', at: 106 },
  { kind: 'tool', name: 'pangular_explain-invalid-forms', args: '', at: 122 },
  { kind: 'result', text: 'address.zip: required', at: 136 },
  {
    kind: 'answer',
    text: 'Pay stays disabled because the address form is invalid: zip is empty, so canPay is false.',
    at: 152,
  },
];

export function Agent() {
  const frame = useCurrentFrame();
  const enter = progress(frame, 0, 30);
  return (
    <SceneFade>
      <Forge glow={0.9} x={68} y={50} />
      <Embers count={24} seed="agent" opacity={0.5} speed={0.7} />
      <div
        style={{
          position: 'absolute',
          left: 100,
          top: 0,
          bottom: 0,
          width: 640,
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
          MCP SERVER
        </div>
        {['Your agent', 'sees it too.'].map((text, i) => {
          const t = progress(frame, 8 + i * 14, 34 + i * 14);
          return (
            <div key={text} style={{ overflow: 'hidden', paddingBottom: 6 }}>
              <div
                style={{
                  fontFamily: fonts.sans,
                  fontWeight: 800,
                  fontSize: 104,
                  lineHeight: 1.0,
                  letterSpacing: '-0.035em',
                  color: i ? colors.amber : colors.textStrong,
                  transform: `translateY(${(1 - t) * 100}%)`,
                  opacity: t,
                }}
              >
                {text}
              </div>
            </div>
          );
        })}
        <div
          style={{
            fontFamily: fonts.sans,
            fontSize: 32,
            lineHeight: 1.4,
            color: colors.text,
            marginTop: 36,
            opacity: progress(frame, 40, 66),
          }}
        >
          100+ agent tools over MCP read the same live app you do.
        </div>
        <div
          style={{
            marginTop: 34,
            alignSelf: 'flex-start',
            fontFamily: fonts.mono,
            fontSize: 24,
            color: colors.amberHover,
            background: 'rgba(245,165,36,0.1)',
            border: '1px solid rgba(245,165,36,0.4)',
            borderRadius: 10,
            padding: '12px 18px',
            opacity: progress(frame, 56, 80),
          }}
        >
          npx @pangular-inspector/devtools mcp
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          right: 90,
          top: 250,
          width: 1000,
          height: 580,
          borderRadius: 18,
          background: 'linear-gradient(180deg, #141317, #0e0d10)',
          border: `1.5px solid rgba(245,165,36,0.35)`,
          boxShadow: '0 40px 120px rgba(0,0,0,0.7), 0 0 70px rgba(245,165,36,0.14)',
          opacity: enter,
          transform: `translateY(${(1 - enter) * 40}px)`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 52,
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            gap: 9,
          }}
        >
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} style={{ width: 13, height: 13, borderRadius: '50%', background: c }} />
          ))}
          <span
            style={{ marginLeft: 16, fontFamily: fonts.mono, fontSize: 18, color: colors.text3 }}
          >
            ~/shop — coding agent
          </span>
        </div>
        <div style={{ padding: '30px 34px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ROWS.map((row, i) => (
            <TerminalRow key={i} row={row} />
          ))}
        </div>
      </div>
    </SceneFade>
  );
}

function TerminalRow({ row }: { row: Row }) {
  const frame = useCurrentFrame();
  const t = progress(frame, row.at, row.at + 10);
  if (frame < row.at) return null;
  const base = { fontFamily: fonts.mono, fontSize: 24, lineHeight: 1.45, opacity: t };
  if (row.kind === 'ask') {
    const shown = Math.floor(
      interpolate(frame, [row.at, row.at + 28], [0, row.text.length], clamp),
    );
    return (
      <div
        style={{ ...base, opacity: 1, color: colors.textStrong, fontWeight: 500, marginBottom: 8 }}
      >
        <span style={{ color: colors.amber }}>› </span>
        {row.text.slice(0, shown)}
        {shown < row.text.length ? <span style={{ color: colors.amber }}>▍</span> : null}
      </div>
    );
  }
  if (row.kind === 'tool') {
    return (
      <div style={{ ...base, color: colors.text }}>
        <span style={{ color: '#4ade80' }}>● </span>
        <span style={{ color: colors.amberHover, fontWeight: 700 }}>{row.name}</span>
        <span style={{ color: colors.text3 }}>({row.args})</span>
      </div>
    );
  }
  if (row.kind === 'result') {
    return (
      <div style={{ ...base, color: colors.text2, paddingLeft: 30, marginTop: -10 }}>
        ⎿ {row.text}
      </div>
    );
  }
  return (
    <div
      style={{
        ...base,
        fontFamily: fonts.sans,
        fontSize: 27,
        color: colors.textStrong,
        marginTop: 14,
        paddingTop: 18,
        borderTop: `1px solid ${colors.border}`,
      }}
    >
      {row.text}
    </div>
  );
}
