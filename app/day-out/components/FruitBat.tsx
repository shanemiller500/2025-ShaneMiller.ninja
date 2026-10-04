import styles from "../day-out.module.css";

// A flying fox hanging upside down off a power line by its feet: wings wrapped round like a little
// brown umbrella, golden mantle, ears pointing at the ground. `open` has it half-unfurled,
// stretching. `zapped` is what happens when it touches two wires at once: lit up, fur on end,
// bolts everywhere. Feet at (0, 0); viewBox -26 -2 52 44.
const INK = "#111";

export default function FruitBat({ open = false, zapped = false }: { open?: boolean; zapped?: boolean }) {
  return <svg viewBox="-26 -2 52 44" width="100%" height="100%" aria-hidden overflow="visible">
    <g className={zapped ? styles.batZap : styles.batSwing}>
      <path d="M-2 0 v5 M2 0 v5" stroke="#1c1917" strokeWidth={1.5} strokeLinecap="round" />
      {(open || zapped) && <path d="M0 6 Q-20 3 -24 19 Q-18 16 -14 21 Q-10 17 -7 23 L0 24 L7 23 Q10 17 14 21 Q18 16 24 19 Q20 3 0 6 Z" fill={zapped ? "#facc15" : "#2b1d16"} stroke={INK} strokeWidth={0.9} />}
      <ellipse cx={0} cy={14} rx={6.5} ry={11} fill={zapped ? "#fef08a" : "#3b2a20"} stroke={INK} strokeWidth={1} />
      {zapped
        ? <path d="M-7 6 l-4 -2 M-7 12 l-5 0 M-7 18 l-4 2 M7 6 l4 -2 M7 12 l5 0 M7 18 l4 2" stroke={INK} strokeWidth={1.2} />
        : <path d="M-6 7 Q-9 15 -4 24 M6 7 Q9 15 4 24" stroke="#22160f" strokeWidth={1.3} fill="none" />}
      <circle cx={0} cy={27} r={5.6} fill={zapped ? "#fde047" : "#b07a3c"} stroke={INK} strokeWidth={1} />
      <path d="M-4 31 l-2.6 5 l4.6 -2.6 z M4 31 l2.6 5 l-4.6 -2.6 z" fill="#3b2a20" stroke={INK} strokeWidth={0.6} />
      {zapped
        ? <><path d="M-3.4 26.4 l2 2 M-1.4 26.4 l-2 2 M1.4 26.4 l2 2 M3.4 26.4 l-2 2" stroke={INK} strokeWidth={0.9} /><ellipse cx={0} cy={23} rx={2} ry={1.6} fill={INK} /></>
        : <><ellipse cx={0} cy={23.6} rx={1.6} ry={1.2} fill="#22160f" /><circle cx={-2.2} cy={27.6} r={1.1} fill={INK} /><circle cx={2.2} cy={27.6} r={1.1} fill={INK} /></>}
      {zapped && <g stroke="#fde047" strokeWidth={1.8} fill="none" strokeLinejoin="round">
        <path d="M-14 -1 l4 5 l-4 2 l5 6" /><path d="M14 -1 l-4 5 l4 2 l-5 6" /><path d="M-18 26 l5 2 l-3 3 l6 3" /><path d="M18 26 l-5 2 l3 3 l-6 3" />
      </g>}
    </g>
  </svg>;
}
