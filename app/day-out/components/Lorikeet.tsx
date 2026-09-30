import styles from "../day-out.module.css";

// A rainbow lorikeet: blue head, red beak, orange chest, green everything else. Perched it sits
// with wings folded; `flying` flaps. Faces right; viewBox 40×28.
const INK = "#111";

export default function Lorikeet({ flying = false }: { flying?: boolean }) {
  return <svg viewBox="0 0 40 28" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Long pointed tail */}
    <path d="M10 17 L0 24 L3 18 Z" fill="#15803d" stroke={INK} strokeWidth={0.9} strokeLinejoin="round" />
    {!flying && <path d="M17 22 l-1 4 M21 22 l1 4" stroke="#6b7280" strokeWidth={1.4} strokeLinecap="round" />}
    <ellipse cx={18} cy={16} rx={11} ry={6.5} fill="#16a34a" stroke={INK} strokeWidth={1} />
    <ellipse cx={24} cy={17} rx={5} ry={4.6} fill="#f97316" />
    <path d="M21 14 q3 -1 6 1 q-1 3 -3 3 q-3 -1 -3 -4 z" fill="#dc2626" />
    <ellipse cx={19} cy={20.5} rx={5} ry={2} fill="#4338ca" />
    {flying
      ? <path className={styles.lorikeetWing} d="M12 14 Q16 0 28 2 Q22 9 22 14 Z" fill="#15803d" stroke={INK} strokeWidth={1} />
      : <path d="M9 14 Q16 10 23 14 Q17 19 9 17 Z" fill="#15803d" stroke={INK} strokeWidth={0.8} />}
    <path d="M26 12 q3 -2 5 0" stroke="#a3e635" strokeWidth={2} fill="none" />
    <circle cx={30} cy={9} r={5.5} fill="#1d4ed8" stroke={INK} strokeWidth={1} />
    <path d="M34.5 8 q4 0 3.5 4 q-2 -1 -4 -1 z" fill="#ef4444" stroke={INK} strokeWidth={0.8} />
    <circle cx={31.5} cy={8} r={1.3} fill="#f97316" />
    <circle cx={31.7} cy={8} r={0.6} fill={INK} />
  </svg>;
}
