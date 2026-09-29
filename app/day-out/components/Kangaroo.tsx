import styles from "../day-out.module.css";

// A live eastern grey kangaroo, side-on facing right. The hind legs and tail animate with
// the hop (CSS); `joey` pokes a little head out of the pouch. viewBox 90×80, feet at y=78.
const INK = "#111", FUR = "#a8743f", BELLY = "#e6c49a";

export default function Kangaroo({ joey = false }: { joey?: boolean }) {
  return <svg viewBox="0 0 90 80" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Tail: the counterweight */}
    <g className={styles.rooTail}>
      <path d="M30 52 Q14 60 2 74" stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />
      <path d="M30 52 Q14 60 2 74" stroke={FUR} strokeWidth={6} fill="none" strokeLinecap="round" />
    </g>
    {/* Big hind leg and long foot */}
    <g className={styles.rooLegs}>
      <ellipse cx={37} cy={56} rx={14} ry={10} fill={FUR} stroke={INK} strokeWidth={2} />
      <path d="M40 62 L50 76 L66 77" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M40 62 L50 76 L66 77" stroke={FUR} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    {/* Body, belly, pouch */}
    <ellipse cx={46} cy={42} rx={15} ry={21} fill={FUR} stroke={INK} strokeWidth={2} transform="rotate(-28 46 42)" />
    <ellipse cx={52} cy={46} rx={7} ry={14} fill={BELLY} transform="rotate(-28 52 46)" />
    {joey && <>
      <path d="M49 52 q6 3 11 -2" stroke={INK} strokeWidth={1.5} fill="none" />
      <circle cx={57} cy={48} r={4} fill={FUR} stroke={INK} strokeWidth={1.5} />
      <ellipse cx={55.5} cy={43.5} rx={1.4} ry={3} fill={FUR} stroke={INK} strokeWidth={1} />
      <circle cx={58.5} cy={47.5} r={0.8} fill={INK} />
    </>}
    {/* Little arms */}
    <path d="M58 36 L64 44 L62 47" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M58 36 L64 44 L62 47" stroke={FUR} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    {/* Head: ears up, long snout */}
    <ellipse cx={57} cy={10} rx={2.6} ry={7} fill={FUR} stroke={INK} strokeWidth={1.5} transform="rotate(-18 57 10)" />
    <ellipse cx={61} cy={9} rx={2.6} ry={7} fill={FUR} stroke={INK} strokeWidth={1.5} transform="rotate(8 61 9)" />
    <ellipse cx={62} cy={21} rx={9} ry={7} fill={FUR} stroke={INK} strokeWidth={2} />
    <ellipse cx={70} cy={24} rx={6} ry={4} fill={FUR} stroke={INK} strokeWidth={2} />
    <circle cx={75} cy={23} r={1.8} fill={INK} />
    <circle cx={63} cy={19} r={1.4} fill={INK} />
    <circle cx={63.4} cy={18.6} r={0.5} fill="#fff" />
  </svg>;
}
