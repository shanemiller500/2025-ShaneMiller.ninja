import styles from "../day-out.module.css";

// A roadside gum tree (pale trunk, peeling bark, blue-green canopy). `koala` sits one in the
// fork, chewing and blinking. viewBox 120×220, base of the trunk at y=220.
const INK = "#111";

function Koala() {
  return <g className={styles.koala}>
    <ellipse cx={0} cy={10} rx={11} ry={12} fill="#9aa0a6" stroke={INK} strokeWidth={1.8} />
    <ellipse cx={0} cy={13} rx={6} ry={7} fill="#e3e3e3" />
    <circle cx={-10} cy={-9} r={6.5} fill="#9aa0a6" stroke={INK} strokeWidth={1.5} />
    <circle cx={-10} cy={-9} r={3.2} fill="#f0d5d5" />
    <circle cx={10} cy={-9} r={6.5} fill="#9aa0a6" stroke={INK} strokeWidth={1.5} />
    <circle cx={10} cy={-9} r={3.2} fill="#f0d5d5" />
    <circle cx={0} cy={-3} r={9.5} fill="#9aa0a6" stroke={INK} strokeWidth={1.8} />
    <ellipse cx={0} cy={0} rx={3.2} ry={4} fill={INK} />
    <g className={styles.koalaEyes}>
      <circle cx={-4.5} cy={-5} r={1.3} fill={INK} />
      <circle cx={4.5} cy={-5} r={1.3} fill={INK} />
    </g>
    {/* Gum leaf being chewed */}
    <path className={styles.koalaChew} d="M2 5 q7 -1 10 4 q-6 2 -10 -4z" fill="#6f9a5e" stroke={INK} strokeWidth={1} />
    <path d="M-9 16 q-4 4 -2 8 M9 16 q4 4 2 8" stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
  </g>;
}

export default function GumTree({ koala = false, variant = 0 }: { koala?: boolean; variant?: number }) {
  const lean = variant % 2 ? -1 : 1;
  return <svg viewBox="0 0 120 220" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Trunk and branches */}
    <path d={`M52 220 C 50 180, 56 150, ${58 + lean * 4} 110 C 60 90, 56 70, 60 50`} stroke="#b3a58c" strokeWidth={16} fill="none" strokeLinecap="round" />
    <path d={`M52 220 C 50 180, 56 150, ${58 + lean * 4} 110 C 60 90, 56 70, 60 50`} stroke={INK} strokeWidth={18} fill="none" strokeLinecap="round" opacity={0.18} />
    <path d="M58 118 C 70 108, 82 100, 92 84" stroke="#b3a58c" strokeWidth={8} fill="none" strokeLinecap="round" />
    <path d="M58 100 C 46 90, 36 84, 26 70" stroke="#b3a58c" strokeWidth={7} fill="none" strokeLinecap="round" />
    {/* Peeling bark patches */}
    <path d="M50 190 q4 -8 2 -16 M56 160 q-3 -6 0 -12 M54 138 q4 -4 2 -10" stroke="#7a6a52" strokeWidth={3} fill="none" strokeLinecap="round" />
    {/* Canopy: sparse, drooping, blue-green like a real gum */}
    {[[60, 44, 30], [30, 62, 22], [92, 70, 24], [74, 30, 20], [44, 34, 20], [100, 50, 16]].map(([cx, cy, r], i) => (
      <circle key={i} cx={cx} cy={cy} r={r} fill={i % 2 ? "#3d7a50" : "#2f6643"} stroke={INK} strokeWidth={1.5} opacity={0.95} />
    ))}
    <path d="M20 74 q-2 10 2 16 M104 82 q4 8 0 16 M70 60 q2 8 -2 14" stroke="#1f4a30" strokeWidth={2} fill="none" strokeLinecap="round" />
    {koala && <g transform="translate(80 98)"><Koala /></g>}
  </svg>;
}
