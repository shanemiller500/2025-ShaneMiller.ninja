import styles from "../day-out.module.css";

// Bits and pieces for a bush doof, Aussie backyard style.
const INK = "#111";

// A Hills Hoist rotary clothesline with a goon bag pegged on it (the "goon of fortune").
// Spins in CSS. viewBox 120×150, base at y=150.
export function HillsHoist() {
  return <svg viewBox="0 0 120 150" width="100%" height="100%" aria-hidden overflow="visible">
    <line x1={60} y1={30} x2={60} y2={150} stroke="#9ca3af" strokeWidth={5} />
    <g className={styles.hoistSpin}>
      <path d="M4 30 L60 22 L116 30 M60 22 L60 40 M20 36 L60 22 L100 36" stroke="#9ca3af" strokeWidth={3} fill="none" />
      <path d="M12 30 h96 M24 33 h72" stroke="#d1d5db" strokeWidth={1} />
      {/* The goon bag, pegged on */}
      <path d="M88 31 v6 M100 31 v6" stroke="#f59e0b" strokeWidth={3} />
      <path d="M84 36 h20 l3 24 q-13 8 -26 0 z" fill="#e5e7eb" stroke={INK} strokeWidth={2} />
      <path d="M86 44 h16" stroke="#7f1d1d" strokeWidth={6} opacity={0.6} />
      <circle cx={94} cy={60} r={2.5} fill="#111" />
    </g>
  </svg>;
}

// A blue-and-white esky, lid ajar, tinnies poking out. viewBox 60×44.
export function Esky() {
  return <svg viewBox="0 0 60 44" width="100%" height="100%" aria-hidden overflow="visible">
    <rect x={4} y={14} width={52} height={28} rx={4} fill="#2563eb" stroke={INK} strokeWidth={2.5} />
    <rect x={6} y={30} width={48} height={10} fill="#f8fafc" />
    <path d="M2 10 h56 l-2 6 h-52 z" fill="#f8fafc" stroke={INK} strokeWidth={2.5} transform="rotate(-8 30 12)" />
    <rect x={16} y={4} width={7} height={11} rx={1.5} fill="#d4af37" stroke={INK} strokeWidth={1.3} />
    <rect x={30} y={2} width={7} height={13} rx={1.5} fill="#16a34a" stroke={INK} strokeWidth={1.3} />
  </svg>;
}

// A boombox, bouncing to the beat. viewBox 70×44.
export function Boombox() {
  return <svg viewBox="0 0 70 44" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M18 8 q17 -10 34 0" stroke={INK} strokeWidth={3} fill="none" />
    <rect x={2} y={8} width={66} height={34} rx={6} fill="#374151" stroke={INK} strokeWidth={2.5} />
    {[18, 52].map(cx => <g key={cx} className={styles.speakerThump}>
      <circle cx={cx} cy={27} r={11} fill="#111" stroke="#9ca3af" strokeWidth={2} />
      <circle cx={cx} cy={27} r={4} fill="#6b7280" />
    </g>)}
    <rect x={29} y={14} width={12} height={7} rx={1} fill="#22d3ee" />
  </svg>;
}

// A wobble board, held up and flexed in time. viewBox 90×40.
export function WobbleBoard() {
  return <svg viewBox="0 0 90 40" width="100%" height="100%" aria-hidden overflow="visible">
    <path className={styles.wobbleFlex} d="M4 22 Q45 4 86 22 Q45 36 4 22 Z" fill="#c9a86a" stroke={INK} strokeWidth={2} />
  </svg>;
}
