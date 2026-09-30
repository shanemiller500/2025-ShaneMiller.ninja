import styles from "../day-out.module.css";

// A kid on a BMX with cable ties zip-tied to the helmet (the Queensland anti-magpie special).
// `panic` swaps the relaxed grip for arms flapping over the head. Faces right; viewBox 90×90.
const INK = "#111", SKIN = "#f1c27d";

export default function KidBike({ panic = false }: { panic?: boolean }) {
  return <svg viewBox="0 0 90 90" width="100%" height="100%" aria-hidden overflow="visible">
    {[18, 72].map(cx => <g key={cx} className={styles.wheel}>
      <circle cx={cx} cy={76} r={12} fill="none" stroke={INK} strokeWidth={3.5} />
      <line x1={cx - 11} y1={76} x2={cx + 11} y2={76} stroke="#9ca3af" strokeWidth={1.2} />
      <line x1={cx} y1={65} x2={cx} y2={87} stroke="#9ca3af" strokeWidth={1.2} />
    </g>)}
    <path d="M18 76 L38 58 L62 58 L72 76 M38 58 L46 76 L62 58 M62 58 L66 44 M60 44 h10" stroke="#0ea5e9" strokeWidth={3.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    <rect x={32} y={52} width={14} height={4} rx={2} fill={INK} />
    {/* Legs pumping the pedals */}
    <g className={styles.kidLegs}>
      <path d="M40 50 L50 64 L46 76" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M40 50 L50 64 L46 76" stroke="#374151" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    {/* Body: school shirt */}
    <path d="M34 50 L40 28 Q46 24 52 30 L48 52 Z" fill="#fde047" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    {panic
      ? <path d="M44 32 L34 12 M48 32 L60 14" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      : <path d="M48 34 L66 44" stroke={INK} strokeWidth={5} strokeLinecap="round" />}
    {panic
      ? <path d="M44 32 L34 12 M48 32 L60 14" stroke={SKIN} strokeWidth={3} strokeLinecap="round" />
      : <path d="M48 34 L66 44" stroke={SKIN} strokeWidth={3} strokeLinecap="round" />}
    {/* Head, helmet and the cable ties sticking up */}
    <circle cx={48} cy={20} r={8} fill={SKIN} stroke={INK} strokeWidth={2} />
    <path d="M39 18 q1 -12 10 -12 q9 0 10 11 z" fill="#ef4444" stroke={INK} strokeWidth={2} />
    <path d="M42 8 l-3 -8 M47 6 l0 -8 M52 7 l3 -8 M56 10 l5 -6" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
    <circle cx={51} cy={20} r={panic ? 1.8 : 1.2} fill={INK} />
    <path d={panic ? "M49 25 q3 4 6 0 z" : "M49 25 q3 2 5 0"} fill={panic ? INK : "none"} stroke={INK} strokeWidth={1.3} />
  </svg>;
}
