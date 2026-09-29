import styles from "../day-out.module.css";

// The blue gang leader in the stocks of a cartoon guillotine. When `chopped`, the blade
// drops and takes his mullet clean off. Business at the front, nothing at the back.
// viewBox 120×170, ground at y=168.
const INK = "#111", SKIN = "#f1c27d";

export default function Guillotine({ chopped }: { chopped: boolean }) {
  return <svg viewBox="0 0 120 170" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Posts, crossbar, base */}
    <rect x={20} y={10} width={10} height={156} fill="#8a5a2b" stroke={INK} strokeWidth={3} />
    <rect x={90} y={10} width={10} height={156} fill="#8a5a2b" stroke={INK} strokeWidth={3} />
    <rect x={14} y={4} width={92} height={12} rx={2} fill="#6b3e12" stroke={INK} strokeWidth={3} />
    <rect x={6} y={160} width={108} height={8} rx={2} fill="#6b3e12" stroke={INK} strokeWidth={3} />
    {/* The blade */}
    <g className={chopped ? styles.bladeDrop : undefined}>
      <path d="M30 18 H90 V40 L30 58 Z" fill="#c9ced6" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M32 54 L88 38" stroke="#fff" strokeWidth={2} />
    </g>
    {/* Stocks with the blue leader's head poking through */}
    <rect x={28} y={96} width={64} height={16} rx={3} fill="#8a5a2b" stroke={INK} strokeWidth={3} />
    <circle cx={60} cy={96} r={16} fill={SKIN} stroke={INK} strokeWidth={3} />
    <path d="M44 90 q16 -18 32 0 z" fill="#1f5fbf" stroke={INK} strokeWidth={2} />
    <circle cx={54} cy={96} r={3} fill="#fff" stroke={INK} strokeWidth={1.2} /><circle cx={66} cy={96} r={3} fill="#fff" stroke={INK} strokeWidth={1.2} />
    <circle cx={54} cy={96} r={1.2} fill={INK} /><circle cx={66} cy={96} r={1.2} fill={INK} />
    <ellipse cx={60} cy={105} rx={4} ry={chopped ? 2 : 4} fill={INK} />
    <path d="M50 102 q10 12 20 0" stroke="#6d4c2f" strokeWidth={4} fill="none" strokeLinecap="round" />
    {/* The mullet: gone once the blade drops */}
    <g className={chopped ? styles.mulletFall : undefined}>
      <path d="M72 88 q14 4 12 18 q-2 12 6 22 q-12 2 -18 -10 q-4 -10 -2 -22 z" fill="#8a5a2b" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <path d="M78 96 q4 10 2 20 M82 94 q4 10 4 18" stroke="#5d3a1a" strokeWidth={1.5} fill="none" />
    </g>
    {chopped && <path d="M72 90 v8" stroke="#8a5a2b" strokeWidth={3} strokeLinecap="round" />}
  </svg>;
}
