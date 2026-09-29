import styles from "../day-out.module.css";

// A council wheelie bin (green body, red general-waste lid), the bin chickens' clubhouse.
// `rattling` shakes the lid while they dig through it. viewBox 60×80, wheels at y=78.
const INK = "#111";

export default function WheelieBin({ rattling = false }: { rattling?: boolean }) {
  return <svg viewBox="0 0 60 80" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M8 18 L12 74 H48 L52 18 Z" fill="#2f6b3a" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
    <path d="M16 26 V66 M30 26 V68 M44 26 V66" stroke="#255a2f" strokeWidth={2} />
    <rect x={20} y={40} width={20} height={10} rx={2} fill="#f5f5f5" stroke={INK} strokeWidth={1.2} />
    <text x={30} y={48} textAnchor="middle" fontSize={6} fontWeight={900} fill="#2f6b3a" fontFamily="sans-serif">GCCC</text>
    <circle cx={16} cy={75} r={4.5} fill="#222" stroke={INK} strokeWidth={1.5} />
    <circle cx={44} cy={75} r={4.5} fill="#222" stroke={INK} strokeWidth={1.5} />
    <g className={rattling ? styles.binLid : undefined}>
      <path d="M4 13 H56 L54 20 H6 Z" fill="#c62828" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <rect x={24} y={9} width={12} height={5} rx={2} fill="#8e1c1c" stroke={INK} strokeWidth={1.5} />
    </g>
  </svg>;
}
