import styles from "../day-out.module.css";

// A Queensland police paddy wagon: ute cab up front, caged pod on the back with barred windows,
// blue-and-yellow checks, flashing light bar. Faces right; viewBox 240×120, wheels on y=118.
const INK = "#111";

export default function PaddyWagon() {
  return <svg viewBox="0 0 240 120" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Caged pod on the tray */}
    <rect x={8} y={18} width={140} height={78} rx={6} fill="#f4f4f4" stroke={INK} strokeWidth={3} />
    <rect x={22} y={28} width={46} height={30} rx={3} fill="#1f2937" stroke={INK} strokeWidth={2} />
    <rect x={82} y={28} width={46} height={30} rx={3} fill="#1f2937" stroke={INK} strokeWidth={2} />
    {[30, 38, 46, 54, 62, 90, 98, 106, 114, 122].map(x => <line key={x} x1={x} y1={28} x2={x} y2={58} stroke="#9ca3af" strokeWidth={2} />)}
    <text x={78} y={80} textAnchor="middle" fontSize={13} fontWeight={900} fill="#1e3a5f" fontFamily="sans-serif">POLICE</text>
    {/* Cab */}
    <path d="M150 40 h40 l22 22 h14 q8 0 8 10 v24 h-84 z" fill="#f4f4f4" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M160 46 h26 l16 16 h-42 z" fill="#bfe3f2" stroke={INK} strokeWidth={2} />
    <circle cx={228} cy={76} r={4} fill="#fff3b0" stroke={INK} strokeWidth={1.5} />
    {/* Checks along the bottom */}
    {Array.from({ length: 14 }, (_, i) => <rect key={i} x={10 + i * 16} y={84} width={16} height={10} fill={i % 2 ? "#facc15" : "#1e3a5f"} />)}
    <rect x={8} y={84} width={226} height={10} fill="none" stroke={INK} strokeWidth={1.5} />
    {/* Light bar */}
    <rect x={160} y={30} width={14} height={9} rx={2} fill="#e53935" className={styles.sirenRed} stroke={INK} strokeWidth={1.5} />
    <rect x={176} y={30} width={14} height={9} rx={2} fill="#1e88e5" className={styles.sirenBlue} stroke={INK} strokeWidth={1.5} />
    {[42, 190].map(cx => <g key={cx} className={styles.wheel}>
      <circle cx={cx} cy={104} r={15} fill="#222" stroke={INK} strokeWidth={3} />
      <circle cx={cx} cy={104} r={6} fill="#d7dbe0" stroke={INK} strokeWidth={2} />
    </g>)}
  </svg>;
}
