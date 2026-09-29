import styles from "../day-out.module.css";

// Shazz off the bike, standing at a flat-plate barbie flipping roadkill snags.
// Snags go on pink and char to black (CSS); "served" adds bread and a squirt of
// dead horse (tomato sauce). viewBox 170×150, ground at y=148.
const INK = "#111", SKIN = "#f1c27d", TATTOO = "#2c5f7a";

const Arm = ({ d, className }: { d: string; className?: string }) => <g className={className}>
  <path d={d} stroke={INK} strokeWidth={15} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  <path d={d} stroke={SKIN} strokeWidth={10} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  <path d={d} stroke={TATTOO} strokeWidth={7} strokeDasharray="2 5 6 4" fill="none" opacity={0.85} />
</g>;

export default function BbqScene({ served }: { served: boolean }) {
  return <svg viewBox="0 0 170 150" width="100%" height="100%" aria-hidden overflow="visible">
    {/* The barbie: plate, hood-less body, legs, gas bottle */}
    <line x1={100} y1={116} x2={98} y2={148} stroke={INK} strokeWidth={4} />
    <line x1={156} y1={116} x2={158} y2={148} stroke={INK} strokeWidth={4} />
    <rect x={142} y={122} width={16} height={24} rx={6} fill="#e8e8e8" stroke={INK} strokeWidth={2.5} />
    <rect x={92} y={100} width={70} height={18} rx={3} fill="#b3261e" stroke={INK} strokeWidth={3} />
    <g className={styles.bbqFlames}>
      <path d="M102 100 q3 -7 6 0 M118 100 q3 -8 6 0 M134 100 q3 -7 6 0 M150 100 q3 -8 6 0" fill="#ff8a00" stroke="#ff5a1f" strokeWidth={1.5} />
    </g>
    <rect x={88} y={94} width={78} height={7} rx={2} fill="#3a3a3a" stroke={INK} strokeWidth={2.5} />
    {/* Snags: pink on, charcoal off */}
    {[96, 112, 128, 144].map((x, i) => <rect key={x} x={x} y={86} width={14} height={8} rx={4}
      className={styles.snag} style={{ animationDelay: `${i * 0.25}s` }} stroke={INK} strokeWidth={2} />)}
    {/* Dead horse (tomato sauce) on the side */}
    <rect x={160} y={70} width={9} height={24} rx={3} fill="#d32f2f" stroke={INK} strokeWidth={2} />
    <rect x={162} y={65} width={5} height={6} rx={1} fill="#fff" stroke={INK} strokeWidth={1.5} />
    <rect x={161} y={78} width={7} height={8} fill="#fff" />
    {served && <g className={styles.sanga}>
      {/* Snag sanga: white bread, black snag, squiggle of dead horse */}
      <path d="M92 80 q-2 -8 6 -8 h26 q8 0 6 8 v6 h-38 z" fill="#fff5dc" stroke="#c8a165" strokeWidth={2.5} />
      <rect x={96} y={76} width={30} height={7} rx={3.5} fill="#1b1b1b" stroke={INK} strokeWidth={1.5} />
      <path d="M98 76 q4 -4 7 0 q4 4 7 0 q4 -4 7 0 q3 3 5 0" stroke="#d32f2f" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </g>}

    {/* Shazz, standing. Legs, boots, big body, vest */}
    <rect x={20} y={108} width={12} height={36} rx={4} fill="#2f4a78" stroke={INK} strokeWidth={2.5} />
    <rect x={38} y={108} width={12} height={36} rx={4} fill="#2f4a78" stroke={INK} strokeWidth={2.5} />
    <rect x={16} y={140} width={18} height={9} rx={4} fill="#1a1a1a" stroke={INK} strokeWidth={2} />
    <rect x={36} y={140} width={20} height={9} rx={4} fill="#1a1a1a" stroke={INK} strokeWidth={2} />
    <ellipse cx={36} cy={84} rx={30} ry={32} fill="#c0392b" stroke={INK} strokeWidth={3} />
    <path d="M8 76 C 6 96, 14 112, 30 114 L 34 114 C 30 94, 30 64, 28 52 C 18 54, 10 62, 8 76 Z" fill="#1d1d1d" stroke={INK} strokeWidth={3} />
    {/* Stubby hand at her side, tongs hand at the barbie */}
    <Arm d="M16 70 L10 92 L14 104" />
    <line x1={14} y1={112} x2={14} y2={96} stroke={INK} strokeWidth={9} strokeLinecap="round" />
    <line x1={14} y1={112} x2={14} y2={96} stroke="#6b3e12" strokeWidth={6} strokeLinecap="round" />
    <line x1={14} y1={104} x2={14} y2={100} stroke="#f5d76e" strokeWidth={6} />
    <g className={styles.tongs}>
      <Arm d="M54 66 L72 80 L90 74" />
      <path d="M90 74 L112 86 M90 76 L112 90" stroke="#bfc4ca" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={90} cy={74} r={6} fill={SKIN} stroke={INK} strokeWidth={2.5} />
    </g>
    {/* Head: helmet, sunnies, teardrop, grin, braid */}
    <path d="M28 40 C 16 46, 14 62, 6 68" stroke="#7a3b12" strokeWidth={6} fill="none" strokeLinecap="round" />
    <circle cx={40} cy={40} r={16} fill={SKIN} stroke={INK} strokeWidth={3} />
    <path d="M23 37 C 23 19, 57 17, 57 36 Z" fill="#1d1d1d" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M37 37 h20 v6 q-5 4 -10 0 q-5 4 -10 0 z" fill={INK} />
    <path d="M51.5 45 q2 3 1 4.6 q-1.4 0.8 -2.2 -0.4 q-0.4 -1.6 1.2 -4.2 z" fill="#1f3b57" />
    <path className={styles.mouth} d="M42 50 q7 7 13 0 z" fill="#fff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    <circle cx={33} cy={46} r={2.2} fill="#ffd23f" stroke={INK} strokeWidth={1} />
  </svg>;
}
