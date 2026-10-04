import styles from "../day-out.module.css";

// The cast of the surf beach's little dramas.
const INK = "#111";

// The lifeguard: red-and-yellow cap, yellow long-sleeve rashie, red boardies, zinc on the nose.
// Faces right; viewBox 50×100, feet on y=98. "swim" shows him from the chest up (the rest is under
// the water); "carry" has him lugging a swimmer across his arms; "flex" is him being a legend.
export function Lifeguard({ pose = "run" }: { pose?: "run" | "swim" | "carry" | "flex" | "stand" }) {
  const SKIN = "#c68642";
  if (pose === "swim") return <svg viewBox="0 0 50 100" width="100%" height="100%" aria-hidden overflow="visible">
    <g className={styles.swimStroke} style={{ transformOrigin: "14px 74px" }}><path d="M14 74 Q4 64 10 56" stroke={SKIN} strokeWidth={5} fill="none" strokeLinecap="round" /></g>
    <path d="M16 80 q9 -10 18 0" fill="#facc15" stroke={INK} strokeWidth={1.3} />
    <circle cx={28} cy={70} r={8.5} fill={SKIN} stroke={INK} strokeWidth={1.4} />
    <path d="M19 67 q9 -11 18 0 z" fill="#dc2626" stroke={INK} strokeWidth={1} /><path d="M28 59 q5 3 9 8 h-9 z" fill="#facc15" />
    <path d="M33 72 h4" stroke="#f8fafc" strokeWidth={3} strokeLinecap="round" />
    <path d="M4 82 q6 -4 12 0 t12 0 t12 0 t12 0" stroke="#e0f2fe" strokeWidth={2} fill="none" />
  </svg>;
  const arms = pose === "flex" ? <path d="M16 36 L8 26 L12 16 M34 36 L42 26 L38 16" stroke={SKIN} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    : pose === "carry" ? <path d="M18 38 L30 44 M34 38 L40 44" stroke={SKIN} strokeWidth={5} fill="none" strokeLinecap="round" />
      : <path d="M16 36 L10 52 M34 36 L42 50" stroke={SKIN} strokeWidth={5} fill="none" strokeLinecap="round" />;
  return <svg viewBox="0 0 50 100" width="100%" height="100%" aria-hidden overflow="visible">
    <g className={pose === "run" || pose === "carry" ? styles.bludgerLegs : undefined}>
      <path d="M20 66 L17 96 M30 66 L33 96" stroke={SKIN} strokeWidth={5.5} strokeLinecap="round" />
    </g>
    <path d="M16 56 h18 l2 14 h-22 z" fill="#dc2626" stroke={INK} strokeWidth={1.4} />
    <path d="M15 32 q10 -6 20 0 l1 26 h-22 z" fill="#facc15" stroke={INK} strokeWidth={1.5} />
    <text x={25} y={48} textAnchor="middle" fontSize={5.5} fontWeight={900} fill="#dc2626" fontFamily="sans-serif">LIFEGUARD</text>
    {arms}
    {pose === "carry" && <g>
      <path d="M8 42 H44" stroke="#f1c7a3" strokeWidth={6} strokeLinecap="round" />
      <path d="M22 42 h8" stroke="#ec4899" strokeWidth={6.5} />
      <circle cx={4} cy={40} r={4.5} fill="#f1c7a3" stroke={INK} strokeWidth={1} />
      <path d="M0 40 q2 8 -2 12" stroke="#fde047" strokeWidth={3} fill="none" />
    </g>}
    <circle cx={25} cy={20} r={9} fill={SKIN} stroke={INK} strokeWidth={1.5} />
    <path d="M30 22 h5" stroke="#f8fafc" strokeWidth={3.4} strokeLinecap="round" />
    <circle cx={28} cy={18} r={1.1} fill={INK} />
    <path d={pose === "flex" ? "M24 26 q4 3 8 0" : "M26 26 h5"} stroke={INK} strokeWidth={1.2} fill="none" />
    <path d="M15 17 q10 -13 20 0 z" fill="#dc2626" stroke={INK} strokeWidth={1.2} /><path d="M25 7 q6 3 10 10 h-10 z" fill="#facc15" />
    <path d="M24 30 l-2 8" stroke="#9ca3af" strokeWidth={1} /><circle cx={22} cy={39} r={1.6} fill="#e5e7eb" stroke={INK} strokeWidth={0.6} />
  </svg>;
}

// A swimmer in a pink cossie who got caught in the rip. "drown" is just her head and frantic arms
// above the water; "sit" is her plonked on the sand, dripping; "walk" is her heading off.
// Faces right; viewBox 40×100, feet on y=98.
export function Swimmer({ pose = "drown" }: { pose?: "drown" | "sit" | "walk" }) {
  const SKIN = "#f1c7a3", HAIR = "#fde047", SUIT = "#ec4899";
  if (pose === "drown") return <svg viewBox="0 0 40 100" width="100%" height="100%" aria-hidden overflow="visible">
    <g className={styles.flailArm} style={{ transformOrigin: "14px 76px" }}><path d="M14 76 L6 56" stroke={SKIN} strokeWidth={4} strokeLinecap="round" /></g>
    <g className={`${styles.flailArm} ${styles.flailArmOther}`} style={{ transformOrigin: "26px 76px" }}><path d="M26 76 L34 56" stroke={SKIN} strokeWidth={4} strokeLinecap="round" /></g>
    <circle cx={20} cy={72} r={7.5} fill={SKIN} stroke={INK} strokeWidth={1.4} />
    <path d="M12 72 q-2 -12 8 -12 q10 0 8 12 q-2 -6 -8 -7 q-6 1 -8 7 z" fill={HAIR} stroke={INK} strokeWidth={1} />
    <ellipse cx={20} cy={76} rx={3} ry={2.4} fill={INK} />
    <path d="M2 80 q6 -4 12 0 t12 0 t12 0" stroke="#e0f2fe" strokeWidth={2} fill="none" />
    <circle cx={8} cy={84} r={1.6} fill="#e0f2fe" /><circle cx={33} cy={83} r={1.3} fill="#e0f2fe" />
  </svg>;
  if (pose === "sit") return <svg viewBox="0 0 40 100" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M14 94 H36" stroke={SKIN} strokeWidth={5} strokeLinecap="round" />
    <path d="M10 70 q6 -4 12 0 l1 24 h-14 z" fill={SKIN} stroke={INK} strokeWidth={1.3} />
    <path d="M10 88 h13 v6 h-13 z M11 74 h5 v4 h-5 z M17 74 h5 v4 h-5 z" fill={SUIT} />
    <path d="M12 74 L6 94" stroke={SKIN} strokeWidth={3.5} strokeLinecap="round" />
    <circle cx={17} cy={62} r={7} fill={SKIN} stroke={INK} strokeWidth={1.3} />
    <path d="M10 62 q-1 -10 7 -10 q8 0 7 10 q-2 6 -2 12 q-2 -8 -5 -12 q-3 4 -5 10 z" fill={HAIR} stroke={INK} strokeWidth={1} />
    <circle cx={19.5} cy={61} r={1} fill={INK} /><path d="M18 66 q2 1 4 0" stroke={INK} strokeWidth={1} fill="none" />
    <circle cx={26} cy={58} r={1.2} fill="#7dd3fc" /><circle cx={9} cy={70} r={1.2} fill="#7dd3fc" />
  </svg>;
  return <svg viewBox="0 0 40 100" width="100%" height="100%" aria-hidden overflow="visible">
    <g className={styles.bludgerLegs}><path d="M16 64 L14 96 M24 64 L26 96" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" /></g>
    <path d="M12 36 q8 -5 16 0 l1 30 h-18 z" fill={SKIN} stroke={INK} strokeWidth={1.3} />
    <path d="M11 58 h18 v8 h-18 z M12 40 h7 v5 h-7 z M21 40 h7 v5 h-7 z" fill={SUIT} />
    <path d="M12 38 L8 58 M28 38 L32 58" stroke={SKIN} strokeWidth={3.5} strokeLinecap="round" />
    <circle cx={20} cy={26} r={7.5} fill={SKIN} stroke={INK} strokeWidth={1.3} />
    <path d="M12 26 q-1 -11 8 -11 q9 0 8 11 q-2 8 -2 14 q-2 -10 -6 -14 q-4 4 -6 12 z" fill={HAIR} stroke={INK} strokeWidth={1} />
    <circle cx={23} cy={25} r={1} fill={INK} />
  </svg>;
}

// A surfer paddling out, flat on his board. Faces right; viewBox 70×30.
export function PaddleSurfer() {
  return <svg viewBox="0 0 70 30" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M4 22 Q34 16 66 20 Q36 27 4 22 Z" fill="#f97316" stroke={INK} strokeWidth={1.3} />
    <path d="M14 19 H46" stroke="#111" strokeWidth={6} strokeLinecap="round" />
    <g className={styles.swimStroke} style={{ transformOrigin: "40px 18px" }}><path d="M40 18 L48 27" stroke="#e0a982" strokeWidth={3} strokeLinecap="round" /></g>
    <circle cx={52} cy={15} r={4.6} fill="#e0a982" stroke={INK} strokeWidth={1} />
    <path d="M48 13 q4 -5 9 0" fill="#7c2d12" />
    <path d="M0 26 q6 -3 12 0 t12 0 t12 0 t12 0 t12 0 t12 0" stroke="#e0f2fe" strokeWidth={1.6} fill="none" />
  </svg>;
}

// A shark fin cutting through the water. Points right; viewBox 30×24.
export function SharkFin() {
  return <svg viewBox="0 0 30 24" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M6 18 Q14 14 16 0 Q22 10 26 18 Z" fill="#64748b" stroke={INK} strokeWidth={1.3} />
    <path d="M0 19 q5 -3 10 0 t10 0 t10 0" stroke="#e0f2fe" strokeWidth={1.6} fill="none" />
  </svg>;
}

// The great white, mid-lunge, jaws wide open. Faces left; viewBox 120×80.
export function SharkLunge() {
  return <svg viewBox="0 0 120 80" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M118 30 L104 40 L118 52 L108 42 Z" fill="#64748b" stroke={INK} strokeWidth={1.4} />
    <path d="M104 42 Q80 18 44 22 Q22 24 8 34 L30 40 L8 48 Q24 62 50 60 Q84 60 104 42 Z" fill="#64748b" stroke={INK} strokeWidth={1.8} />
    <path d="M30 40 L8 48 Q24 62 50 60 Q76 60 96 48 Q66 52 44 46 Z" fill="#f8fafc" stroke={INK} strokeWidth={1.2} />
    <path d="M30 40 L8 34 Q14 38 30 40 L8 48 Z" fill="#7f1d1d" />
    <path d="M10 35 l3 3 l3 -2 l3 3 l3 -2 l3 3 M10 47 l3 -3 l3 2 l3 -3 l3 2 l3 -3" stroke="#f8fafc" strokeWidth={1.6} fill="none" strokeLinejoin="round" />
    <path d="M62 22 L72 4 L80 24 Z" fill="#64748b" stroke={INK} strokeWidth={1.4} />
    <circle cx={34} cy={31} r={2.4} fill={INK} /><circle cx={33.4} cy={30.4} r={0.7} fill="#fff" />
    <path d="M44 30 q2 4 0 8 M48 30 q2 4 0 8 M52 30 q2 4 0 8" stroke="#475569" strokeWidth={1} fill="none" />
  </svg>;
}
