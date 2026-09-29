import styles from "../day-out.module.css";

// Queensland-style police sedan (blue and yellow checks, flashing light bar) with a
// very cranky cop at the wheel. Side view facing right: boot at the back (left),
// windscreen and long bonnet at the front (right). viewBox 200×84.
// `damage` (0–6) adds shot holes and cracked glass; `wrecked` chars the whole thing.
const INK = "#111";
const HOLES = [[40, 40], [150, 48], [96, 56], [70, 46], [172, 52], [120, 42]];

export default function PoliceCar({ damage = 0, wrecked = false }: { damage?: number; wrecked?: boolean }) {
  const body = wrecked ? "#2a2a2a" : "#f5f5f5";
  return <svg viewBox="0 0 200 84" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Light bar */}
    {!wrecked && <>
      <rect x={72} y={4} width={16} height={8} rx={2} fill="#e53935" stroke={INK} strokeWidth={2} className={styles.lightRed} />
      <rect x={88} y={4} width={16} height={8} rx={2} fill="#1e88e5" stroke={INK} strokeWidth={2} className={styles.lightBlue} />
    </>}
    {/* Body: boot, cabin, bonnet */}
    <path d="M8 60 L10 40 Q12 34 26 33 L44 33 L62 15 L118 15 Q126 15 132 22 L146 36 L182 39 Q194 42 194 52 L194 60 Q194 66 188 66 L14 66 Q8 66 8 60 Z" fill={body} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    {!wrecked && <>
      {/* Battenburg checks */}
      {Array.from({ length: 11 }, (_, i) => <g key={i}>
        <rect x={12 + i * 16} y={44} width={8} height={7} fill={i % 2 ? "#ffd23f" : "#1f3b8f"} />
        <rect x={20 + i * 16} y={51} width={8} height={7} fill={i % 2 ? "#1f3b8f" : "#ffd23f"} />
      </g>)}
      <text x={96} y={41} textAnchor="middle" fontSize={10} fontWeight={900} fill="#1f3b8f" fontFamily="sans-serif">POLICE</text>
    </>}
    {/* Windows and the cop in the driver's seat */}
    <path d="M50 32 L64 19 H88 V32 Z" fill={wrecked ? "#111" : "#bfe3f2"} stroke={INK} strokeWidth={2.5} />
    <path d="M92 19 H116 Q122 19 127 24 L135 32 H92 Z" fill={wrecked ? "#111" : "#bfe3f2"} stroke={INK} strokeWidth={2.5} />
    {!wrecked && <>
      <circle cx={108} cy={26} r={7} fill="#f1c27d" stroke={INK} strokeWidth={2} />
      <path d="M100 22 h16 l-2 -5 h-12 z" fill="#1f3b8f" stroke={INK} strokeWidth={1.5} />
      <path d="M106 24 l4 1.5 m2 -1.5 l4 1.5" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M108 30 q3 -2 6 0" stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </>}
    {/* Shotgun damage */}
    {damage >= 2 && !wrecked && <path d="M96 20 l6 5 l-3 4 l7 3 M60 22 l5 4 l-4 3" stroke="#fff" strokeWidth={1.4} fill="none" />}
    {HOLES.slice(0, damage).map(([x, y], i) => <g key={i}>
      <circle cx={x} cy={y} r={3.2} fill="#141517" stroke="#8a8a8a" strokeWidth={1} />
      <circle cx={x + 5} cy={y - 3} r={1.6} fill="#141517" />
      <circle cx={x - 4} cy={y + 3} r={1.4} fill="#141517" />
    </g>)}
    {damage >= 4 && !wrecked && <path d="M160 38 q6 -6 12 0" stroke="#555" strokeWidth={2} fill="none" />}
    {/* Lights, bumpers, wheels */}
    <circle cx={189} cy={46} r={4} fill={wrecked ? "#333" : "#fff3b0"} stroke={INK} strokeWidth={2} />
    <rect x={8} y={42} width={5} height={8} rx={2} fill="#e53935" stroke={INK} strokeWidth={1.5} />
    <rect x={180} y={60} width={16} height={6} rx={2} fill="#bfc4ca" stroke={INK} strokeWidth={2} />
    {[42, 156].map(cx => <g key={cx}>
      <circle cx={cx} cy={66} r={14} fill="#222" stroke={INK} strokeWidth={3} />
      <circle cx={cx} cy={66} r={6} fill={wrecked ? "#444" : "#d7dbe0"} stroke={INK} strokeWidth={2} />
    </g>)}
  </svg>;
}
