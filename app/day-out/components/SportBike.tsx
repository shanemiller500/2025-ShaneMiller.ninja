import styles from "../day-out.module.css";

// A plastic-faired sportsbike with a rider tucked in full leathers ("Power Ranger pyjamas").
// Faces right. viewBox 110×60, wheels touching y=58.
const INK = "#111";

export default function SportBike({ color }: { color: string }) {
  return <svg viewBox="0 0 110 60" width="100%" height="100%" aria-hidden overflow="visible">
    {[22, 88].map(cx => <g key={cx} className={styles.wheel}>
      <circle cx={cx} cy={46} r={12} fill="#222" stroke={INK} strokeWidth={2.5} />
      <circle cx={cx} cy={46} r={6} fill="none" stroke="#c9ced6" strokeWidth={2} />
      <line x1={cx - 6} y1={46} x2={cx + 6} y2={46} stroke="#c9ced6" strokeWidth={1.5} />
    </g>)}
    {/* Exhaust up under the tail */}
    <path d="M40 44 L18 34" stroke={INK} strokeWidth={6} strokeLinecap="round" />
    <path d="M40 44 L18 34" stroke="#9aa0a6" strokeWidth={3.5} strokeLinecap="round" />
    {/* Fairing, tail and tank */}
    <path d="M14 30 L40 26 L62 22 L88 26 L100 38 L86 44 L64 46 L40 46 Z" fill={color} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
    <path d="M70 26 L88 26 L96 34 L76 34 Z" fill="#fff" opacity={0.85} />
    <path d="M30 36 L60 36" stroke="#fff" strokeWidth={3} opacity={0.7} />
    <path d="M88 26 L94 18" stroke={INK} strokeWidth={2} />
    {/* Rider tucked down: leathers, helmet with visor */}
    <path d="M40 28 L52 30 L58 40" stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M40 28 L52 30 L58 40" stroke="#1f2937" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <ellipse cx={50} cy={20} rx={16} ry={8} fill="#1f2937" stroke={INK} strokeWidth={2.5} transform="rotate(-12 50 20)" />
    <path d="M38 18 L64 14" stroke={color} strokeWidth={3} />
    <path d="M62 16 L76 20" stroke={INK} strokeWidth={6} strokeLinecap="round" />
    <path d="M62 16 L76 20" stroke="#1f2937" strokeWidth={3.5} strokeLinecap="round" />
    <circle cx={72} cy={12} r={8} fill={color} stroke={INK} strokeWidth={2.5} />
    <path d="M73 9 h6 q2 3 0 6 h-6 z" fill="#111" />
    <path d="M74 10 h3" stroke="#7fd3ff" strokeWidth={1.2} />
  </svg>;
}
