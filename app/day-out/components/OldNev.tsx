import styles from "../day-out.module.css";

// Old Nev: flat cap, cardigan, specs, walking stick, looking for his long-lost boy.
// Faces right; viewBox 50×100, feet at y=98. `walking` animates the legs; `shaking` has him
// waving his cane about over his head.
const INK = "#111", SKIN = "#eab990";

export default function OldNev({ walking = false, shaking = false }: { walking?: boolean; shaking?: boolean }) {
  return <svg viewBox="0 0 50 100" width="100%" height="100%" aria-hidden overflow="visible">
    <g className={walking ? styles.bludgerLegs : undefined}>
      <path d="M20 64 L18 96 M28 64 L30 96" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <path d="M20 64 L18 96 M28 64 L30 96" stroke="#6b7280" strokeWidth={4} strokeLinecap="round" />
    </g>
    <path d="M12 98 h10 M26 98 h10" stroke="#3b2a1e" strokeWidth={3.5} strokeLinecap="round" />
    <path d="M13 34 q11 -8 22 0 l3 32 h-28 z" fill="#b45309" stroke={INK} strokeWidth={1.8} />
    <path d="M24 34 v30" stroke="#7c2d12" strokeWidth={1.2} strokeDasharray="2 4" />
    {shaking
      ? <g className={styles.caneShake}>
        <path d="M34 40 L42 24" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" />
        <path d="M42 26 L46 -12 q1 -5 5 -3" stroke="#6b4423" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      </g>
      : <>
        <path d="M34 40 L42 58" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" />
        <path d="M42 56 L44 98" stroke="#6b4423" strokeWidth={2.5} strokeLinecap="round" />
      </>}
    <circle cx={27} cy={22} r={9} fill={SKIN} stroke={INK} strokeWidth={1.8} />
    <path d="M16 18 q11 -12 22 0 l4 1 h-28 z" fill="#57534e" stroke={INK} strokeWidth={1.3} />
    <circle cx={30} cy={22} r={3} fill="none" stroke={INK} strokeWidth={1} /><circle cx={36} cy={22} r={3} fill="none" stroke={INK} strokeWidth={1} />
    <path d={shaking ? "M29 29 q4 -3 7 0 z" : "M29 28 q4 2 7 0"} fill={shaking ? INK : "none"} stroke={INK} strokeWidth={1.1} />
    <path d="M22 27 q2 3 0 5" stroke="#e5e7eb" strokeWidth={2} fill="none" />
  </svg>;
}
