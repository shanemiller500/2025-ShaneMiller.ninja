import styles from "../day-out.module.css";

// A Queensland copper for breaking up the bush doof: light-blue shirt, navy pants, checked cap
// band, mirrored sunnies, taser on the belt. `zap` points the taser with a bolt coming out of it.
// Faces right; viewBox 50×100, feet at y=98.
const INK = "#111", SKIN = "#eab990";

// `baton` has him swinging his baton overhead (cartoon bonks, nothing more).
export default function RaveCop({ zap = false, walking = false, baton = false }: { zap?: boolean; walking?: boolean; baton?: boolean }) {
  const arm = zap ? "M32 36 L46 38 L54 36" : baton ? "M32 36 L42 22" : "M32 36 L36 54";
  return <svg viewBox="0 0 50 100" width="100%" height="100%" aria-hidden overflow="visible">
    <g className={walking ? styles.bludgerLegs : undefined}>
      <path d="M20 62 L17 94 M30 62 L33 94" stroke={INK} strokeWidth={8} strokeLinecap="round" />
      <path d="M20 62 L17 94 M30 62 L33 94" stroke="#1e3a5f" strokeWidth={5.5} strokeLinecap="round" />
      <path d="M11 97 h10 M29 97 h10" stroke={INK} strokeWidth={4} strokeLinecap="round" />
    </g>
    <path d="M14 30 q11 -6 22 0 l2 32 h-26 z" fill="#9cc3e6" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    <rect x={13} y={56} width={25} height={5} fill="#1b1b1b" />
    <rect x={30} y={55} width={7} height={7} rx={1} fill="#facc15" stroke={INK} strokeWidth={1} />
    <path d="M18 36 l3 3 l-3 3 M26 34 h6" stroke="#1e3a5f" strokeWidth={1.4} fill="none" />
    <path d="M18 36 L12 54" stroke={INK} strokeWidth={6} strokeLinecap="round" />
    <path d="M18 36 L12 54" stroke="#9cc3e6" strokeWidth={4} strokeLinecap="round" />
    <path d={arm} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d={arm} stroke="#9cc3e6" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    {baton && <g className={styles.batonSwing}><path d="M42 22 L60 6" stroke="#111" strokeWidth={4.5} strokeLinecap="round" /><path d="M44 20 l3 3" stroke="#6b7280" strokeWidth={2} /></g>}
    {zap && <>
      <rect x={50} y={32} width={10} height={6} rx={1.5} fill="#facc15" stroke={INK} strokeWidth={1.3} />
      <path className={styles.zapBolt} d="M60 34 l8 -4 l-3 5 l9 -3 l-4 6 l10 -2" stroke="#fde047" strokeWidth={2.2} fill="none" strokeLinejoin="round" />
    </>}
    {/* Head: cap with the checked band, sunnies, flat mouth */}
    <circle cx={26} cy={18} r={9} fill={SKIN} stroke={INK} strokeWidth={2} />
    <path d="M16 13 q10 -10 20 0 z" fill="#1e3a5f" stroke={INK} strokeWidth={1.5} />
    <path d="M16 13 h20" stroke="#fff" strokeWidth={3} strokeDasharray="3 3" />
    <path d="M36 13 h6" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
    <rect x={22} y={15} width={14} height={4} rx={2} fill="#1f2937" />
    <path d="M26 24 h7" stroke={INK} strokeWidth={1.4} />
  </svg>;
}
