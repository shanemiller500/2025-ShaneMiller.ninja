import styles from "../day-out.module.css";

// Shazz on a stool getting her second teardrop from a tattooist (bikini top, denim
// shorts, full sleeves). Stages: "inking" (gun buzzing), "done" (second drop shows),
// "pat" (Shazz pats her bum), "slap" (she cops it: handprint, head snaps round).
// viewBox 190×150, ground at y=148.
export type TattooStage = "inking" | "done" | "pat" | "slap";
const INK = "#111", SKIN = "#f1c27d", TAN = "#e0a878", TATTOO = "#2c5f7a";

const Arm = ({ d, color = SKIN, className }: { d: string; color?: string; className?: string }) => <g className={className}>
  <path d={d} stroke={INK} strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  <path d={d} stroke={color} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  <path d={d} stroke={TATTOO} strokeWidth={6} strokeDasharray="2 5 6 4" fill="none" opacity={0.8} />
</g>;
const Drop = ({ x, y, className }: { x: number; y: number; className?: string }) =>
  <path className={className} d={`M${x} ${y} q2 3 1 4.6 q-1.4 0.8 -2.2 -0.4 q-0.4 -1.6 1.2 -4.2 z`} fill="#1f3b57" />;

export default function TattooScene({ stage }: { stage: TattooStage }) {
  const slapped = stage === "slap";
  return <svg viewBox="0 0 190 150" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Stool */}
    <rect x={14} y={112} width={48} height={7} rx={3} fill="#6b3e12" stroke={INK} strokeWidth={2.5} />
    <path d="M20 119 L16 148 M56 119 L60 148" stroke={INK} strokeWidth={4} />

    {/* Shazz, seated, facing right */}
    <rect x={38} y={102} width={36} height={13} rx={6} fill="#2f4a78" stroke={INK} strokeWidth={2.5} />
    <rect x={64} y={106} width={12} height={36} rx={5} fill="#2f4a78" stroke={INK} strokeWidth={2.5} />
    <rect x={62} y={138} width={22} height={10} rx={4} fill="#1a1a1a" stroke={INK} strokeWidth={2} />
    <ellipse cx={38} cy={84} rx={28} ry={30} fill="#c0392b" stroke={INK} strokeWidth={3} />
    <path d="M10 76 C 8 96, 16 110, 32 112 L 36 112 C 32 92, 32 62, 30 50 C 20 52, 12 60, 10 76 Z" fill="#1d1d1d" stroke={INK} strokeWidth={3} />
    {stage === "pat" || slapped
      ? <Arm d="M56 74 L92 92 L118 98" />
      : <Arm d="M56 74 L66 96 L80 100" />}
    <g className={slapped ? styles.headSnap : undefined}>
      <path d="M30 40 C 18 46, 16 62, 8 68" stroke="#7a3b12" strokeWidth={6} fill="none" strokeLinecap="round" />
      <circle cx={44} cy={40} r={16} fill={SKIN} stroke={INK} strokeWidth={3} />
      <path d="M27 37 C 27 19, 61 17, 61 36 Z" fill="#1d1d1d" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M41 37 h20 v6 q-5 4 -10 0 q-5 4 -10 0 z" fill={INK} />
      <Drop x={55} y={45} />
      {stage !== "inking" && <Drop x={56.5} y={51} className={styles.newDrop} />}
      {slapped
        ? <path d="M48 52 q6 -3 11 1" stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        : <path className={styles.mouth} d="M46 50 q7 7 13 0 z" fill="#fff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />}
      {slapped && <path className={styles.handprint} d="M50 40 l2 -7 l2 7 l2 -8 l2 8 l2 -6 l1 7 q2 6 -4 9 q-6 1 -8 -4 z" fill="#e53935" opacity={0.75} />}
    </g>

    {/* The tattooist, standing, facing left */}
    <path d="M146 112 L144 146 M158 112 L160 146" stroke={INK} strokeWidth={10} strokeLinecap="round" />
    <path d="M146 112 L144 146 M158 112 L160 146" stroke={TAN} strokeWidth={6} strokeLinecap="round" />
    <path d="M140 146 h10 M156 146 h10" stroke="#e53935" strokeWidth={4} strokeLinecap="round" />
    <path d="M138 98 h28 l-2 18 h-24 z" fill="#4f7cc4" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
    <ellipse cx={152} cy={80} rx={14} ry={22} fill={TAN} stroke={INK} strokeWidth={2.5} />
    <path d="M139 74 q5 -4 10 0 v6 h-10 z" fill="#ff4f8b" stroke={INK} strokeWidth={1.5} />
    <Arm d="M160 70 L168 90 L162 100" color={TAN} />
    {slapped
      ? <Arm d="M146 66 L110 54 L68 44" color={TAN} className={styles.slapArm} />
      : <g className={stage === "inking" ? styles.tattooGun : undefined}>
          <Arm d="M146 66 L124 70 L104 58" color={TAN} />
          <rect x={86} y={52} width={16} height={8} rx={2} fill="#5d6066" stroke={INK} strokeWidth={2} />
          <line x1={86} y1={56} x2={72} y2={52} stroke={INK} strokeWidth={1.5} />
        </g>}
    <path d="M140 36 q12 -16 24 0" fill="#3a2a1f" stroke={INK} strokeWidth={2} />
    <circle cx={160} cy={26} r={6} fill="#3a2a1f" stroke={INK} strokeWidth={2} />
    <circle cx={150} cy={46} r={12} fill={TAN} stroke={INK} strokeWidth={2.5} />
    <path d="M139 40 q11 -12 23 -2" fill="#3a2a1f" stroke={INK} strokeWidth={1.5} />
    {stage === "pat" || slapped
      ? <><path d="M140 42 l6 2 M140 46 l6 -1" stroke={INK} strokeWidth={2} strokeLinecap="round" /><path d="M142 53 q4 -3 8 0" stroke={INK} strokeWidth={2} fill="none" /></>
      : <><circle cx={143} cy={45} r={1.6} fill={INK} /><path d="M142 51 q4 3 8 0" stroke={INK} strokeWidth={1.8} fill="none" /></>}
  </svg>;
}
