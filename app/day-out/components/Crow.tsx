import styles from "../day-out.module.css";

// An Aussie crow (well, a Torresian crow): glossy black, white eye, stout grey-black beak.
// Standing it pecks (head animates in CSS); `flying` spreads the wings; `messy` means it's been
// eating roadkill (red beak, flecks on the chest and face). Faces right; viewBox 60×44.
const INK = "#111";

const BLOOD = "#b3121f";

export default function Crow({ flying = false, messy = false }: { flying?: boolean; messy?: boolean }) {
  return <svg viewBox="0 0 60 44" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Tail */}
    <path d="M4 22 L18 20 L16 28 Z" fill="#1b1b1f" stroke={INK} strokeWidth={1.2} />
    {!flying && <path d="M26 32 l-2 10 h-3 M34 32 l1 10 h3" stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />}
    <ellipse cx={28} cy={25} rx={14} ry={9} fill="#1b1b1f" stroke={INK} strokeWidth={1.5} />
    {flying
      ? <path className={styles.crowWing} d="M18 22 Q26 -2 44 2 Q34 12 34 22 Z" fill="#26262c" stroke={INK} strokeWidth={1.5} />
      : <path d="M18 22 Q28 16 38 22 Q30 30 18 26 Z" fill="#26262c" stroke={INK} strokeWidth={1.2} />}
    <path d="M22 22 q6 -3 12 -1" stroke="#5b6b8a" strokeWidth={1.2} fill="none" opacity={0.7} />
    {messy && <g fill={BLOOD}>
      <circle cx={36} cy={29} r={1.8} /><circle cx={31} cy={31} r={1.3} /><circle cx={39} cy={25} r={1.1} /><circle cx={26} cy={30} r={1} />
    </g>}
    <g className={styles.crowHead}>
      <circle cx={42} cy={17} r={7.5} fill="#1b1b1f" stroke={INK} strokeWidth={1.5} />
      <path d="M48 14 L58 17 L48 20 Z" fill="#2f2f33" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      {messy && <>
        <path d="M52 15.2 L58 17 L52 18.8 Z" fill={BLOOD} />
        <circle cx={47} cy={21} r={1.4} fill={BLOOD} /><circle cx={40} cy={22} r={1} fill={BLOOD} />
      </>}
      <circle cx={44} cy={15.5} r={1.9} fill="#fff" />
      <circle cx={44.4} cy={15.5} r={0.9} fill={INK} />
    </g>
  </svg>;
}
