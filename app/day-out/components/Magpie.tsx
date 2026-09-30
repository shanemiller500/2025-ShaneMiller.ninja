import styles from "../day-out.module.css";

// An Australian magpie mid-swoop, properly pied: black face, chest and flight feathers; white
// nape, white shoulder patch, white rump and a white tail with a black tip. Pale beak, red eye.
// Faces right; viewBox 60×40.
const INK = "#111", WHITE = "#f8fafc";

export default function Magpie() {
  return <svg viewBox="0 0 60 40" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Tail: white with a black band at the tip */}
    <path d="M4 20 L16 17 L16 27 L4 26 Z" fill={WHITE} stroke={INK} strokeWidth={1} />
    <path d="M4 20 L8 19.2 L8 26.3 L4 26 Z" fill={INK} />
    {/* Body: black underneath, white back/rump */}
    <ellipse cx={28} cy={22} rx={15} ry={8} fill={INK} />
    <path d="M14 20 Q26 13 40 16 Q30 20 16 23 Z" fill={WHITE} stroke={INK} strokeWidth={0.8} />
    {/* Wing: white shoulder, black flight feathers */}
    <g className={styles.magpieWing}>
      <path d="M22 20 Q30 0 42 4 Q36 14 34 22 Z" fill={INK} stroke={INK} strokeWidth={1} />
      <path d="M24 19 Q29 8 36 8 Q33 14 32 20 Z" fill={WHITE} />
    </g>
    {/* Head: black face, white nape band down the back of the neck */}
    <circle cx={44} cy={18} r={7} fill={INK} />
    <path d="M37 13 Q40 9 44 11 Q41 16 38 22 Q35 18 37 13 Z" fill={WHITE} />
    <path d="M50 16 L60 19 L50 21 Z" fill="#e2e8f0" stroke={INK} strokeWidth={1} />
    <path d="M57 18.2 L60 19 L57 19.8 Z" fill={INK} />
    <circle cx={46.5} cy={16.5} r={1.7} fill="#dc2626" />
    <circle cx={46.5} cy={16.5} r={0.7} fill={INK} />
    <path d="M24 29 l-2 6 M30 29 l1 6" stroke="#444" strokeWidth={1.5} />
  </svg>;
}
