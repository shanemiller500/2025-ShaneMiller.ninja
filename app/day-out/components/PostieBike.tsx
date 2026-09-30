import styles from "../day-out.module.css";

// The Aussie postie on the little red step-through, mail bags on the racks, hi-vis vest and a
// white open-face helmet. Faces right; viewBox 130×100, wheels touching y=98.
const INK = "#111", RED = "#d62828", SKIN = "#f1c27d";

export default function PostieBike() {
  return <svg viewBox="0 0 130 100" width="100%" height="100%" aria-hidden overflow="visible">
    {[26, 102].map(cx => <g key={cx} className={styles.wheel}>
      <circle cx={cx} cy={86} r={12} fill="#222" stroke={INK} strokeWidth={2.5} />
      <circle cx={cx} cy={86} r={5} fill="#c9ced6" stroke={INK} strokeWidth={1.5} />
      <line x1={cx - 9} y1={86} x2={cx + 9} y2={86} stroke="#c9ced6" strokeWidth={1.5} />
    </g>)}
    {/* Step-through frame, front forks, mudguard */}
    <path d="M26 86 L44 66 L70 76 L92 58 L102 86" stroke={INK} strokeWidth={7} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    <path d="M26 86 L44 66 L70 76 L92 58 L102 86" stroke={RED} strokeWidth={4.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    <path d="M92 70 q10 -4 18 6" stroke={INK} strokeWidth={4} fill="none" />
    <path d="M92 58 L96 42 M90 42 h10" stroke={INK} strokeWidth={3} strokeLinecap="round" />
    {/* Rear rack with the mail bags, front basket of letters */}
    <rect x={6} y={50} width={34} height={24} rx={4} fill="#b91c1c" stroke={INK} strokeWidth={2.5} />
    <path d="M6 60 h34" stroke="#fde68a" strokeWidth={2.5} />
    <rect x={98} y={46} width={22} height={14} rx={2} fill="#9ca3af" stroke={INK} strokeWidth={2} />
    <path d="M101 46 l3 -6 h6 l-2 6 M109 46 l3 -5 h5 l-2 5" fill="#fff" stroke={INK} strokeWidth={1.2} />
    {/* Seat and the postie */}
    <rect x={38} y={56} width={24} height={6} rx={3} fill={INK} />
    <path d="M52 58 L66 72 L70 84" stroke={INK} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M52 58 L66 72 L70 84" stroke="#1e3a5f" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M44 56 L48 26 Q56 20 64 26 L62 56 Z" fill="#fb923c" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
    <path d="M47 40 h16 M46 48 h17" stroke="#e5e7eb" strokeWidth={3} />
    <path d="M60 30 L80 40 L94 42" stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M60 30 L80 40 L94 42" stroke={SKIN} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={57} cy={14} r={9} fill={SKIN} stroke={INK} strokeWidth={2} />
    <path d="M47 14 q0 -13 12 -13 q11 0 11 12 z" fill="#fff" stroke={INK} strokeWidth={2} />
    <circle cx={62} cy={14} r={1.3} fill={INK} />
    <path d="M60 19 q3 2 6 0" stroke={INK} strokeWidth={1.4} fill="none" />
  </svg>;
}
