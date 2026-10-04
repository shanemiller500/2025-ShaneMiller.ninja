import styles from "../day-out.module.css";

// A bloke cruising down the street on his club's bike, side-on. Harley: black tank with an orange
// flash, ape-hanger bars, black vest, orange bandana. Indian: red tank and big skirted red
// fenders, cream open-face lid, red vest. `look` varies the beard; `riderless` leaves the bike
// parked up on its own. Faces right; viewBox 160×100, wheels on y=98.
const INK = "#111", SKIN = "#e0a982";

export default function PassingBiker({ brand, look = 0, riderless = false }: { brand: "harley" | "indian"; look?: number; riderless?: boolean }) {
  const harley = brand === "harley", tank = harley ? "#111" : "#b91c1c", vest = harley ? "#18181b" : "#b91c1c";
  const beard = ["#57534e", "#d6d3d1", "#7c2d12"][look % 3];
  const wheel = (cx: number) => <g>
    <circle cx={cx} cy={80} r={18} fill="#111" />
    <g className={styles.rideWheel} style={{ transformOrigin: `${cx}px 80px` }}>
      <circle cx={cx} cy={80} r={11} fill="#9ca3af" stroke="#e5e7eb" strokeWidth={1.5} />
      <path d={`M${cx - 11} 80 H${cx + 11} M${cx} 69 V91 M${cx - 8} 72 L${cx + 8} 88 M${cx + 8} 72 L${cx - 8} 88`} stroke="#4b5563" strokeWidth={1} />
    </g>
    <circle cx={cx} cy={80} r={3} fill="#e5e7eb" stroke={INK} strokeWidth={0.8} />
  </g>;
  return <svg viewBox="0 0 160 100" width="100%" height="100%" aria-hidden overflow="visible">
    {wheel(32)}{wheel(128)}
    {/* Fenders: skirted on the Indian */}
    {harley
      ? <path d="M14 70 Q32 54 50 68" stroke="#111" strokeWidth={4} fill="none" />
      : <><path d="M10 82 Q12 56 32 56 Q52 56 54 76 L50 76 Q48 62 32 62 Q16 62 16 82 Z" fill="#b91c1c" stroke={INK} strokeWidth={1.2} /><path d="M106 82 Q108 58 128 58 Q146 58 150 78 L144 78 Q140 64 128 64 Q114 64 112 82 Z" fill="#b91c1c" stroke={INK} strokeWidth={1.2} /></>}
    {/* Frame, engine, pipes */}
    <path d="M32 80 L58 60 L100 58 L128 80" stroke="#374151" strokeWidth={4} fill="none" />
    <path d="M60 64 h34 l-4 18 h-26 z" fill="#27272a" stroke={INK} strokeWidth={1.2} />
    <path d="M64 64 l-4 -14 h10 l3 14 z M80 64 l3 -14 h10 l-3 14 z" fill="#9ca3af" stroke={INK} strokeWidth={1} />
    <path d="M62 84 L14 88 M66 88 L18 93" stroke="#e5e7eb" strokeWidth={3.5} strokeLinecap="round" />
    {/* Tank, seat, forks, bars, headlight */}
    <path d="M62 52 Q80 40 102 50 Q98 60 66 60 Z" fill={tank} stroke={INK} strokeWidth={1.3} />
    {harley ? <path d="M72 50 l20 -2 l-6 6 z" fill="#f97316" /> : <text x={84} y={55} textAnchor="middle" fontSize={7} fontStyle="italic" fontWeight={900} fill="#f3e6c8" fontFamily="'Brush Script MT', 'Segoe Script', cursive">Indian</text>}
    <path d="M36 56 Q48 48 64 54 L62 60 Q48 58 38 60 Z" fill="#111" />
    <path d="M128 80 L110 34" stroke="#cbd5e1" strokeWidth={3.5} />
    {harley ? <path d="M110 36 L104 14 L96 16" stroke="#111" strokeWidth={3} fill="none" strokeLinecap="round" /> : <path d="M110 36 L102 30 L94 32" stroke="#111" strokeWidth={3} fill="none" strokeLinecap="round" />}
    <circle cx={116} cy={42} r={5} fill="#fef9c3" stroke={INK} strokeWidth={1.2} />
    {!riderless && <>
    {/* The rider: boots on the pegs, laid back, arms up to the bars */}
    <path d="M58 54 L72 70 L86 72" stroke="#1e3a8a" strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M84 74 h8" stroke={INK} strokeWidth={5} strokeLinecap="round" />
    <path d="M48 56 Q46 34 54 22 L66 24 Q68 40 64 56 Z" fill={harley ? "#f8fafc" : "#111"} stroke={INK} strokeWidth={1.4} />
    <path d="M47 56 Q45 36 52 24 L58 24 L58 56 Z" fill={vest} stroke={INK} strokeWidth={1.2} />
    {harley
      ? <g transform="translate(48 34)"><path d="M0 0 h8 l-1 3.6 q-1 3.6 -3 5.4 q-2 -1.8 -3 -5.4 z" fill="#f97316" stroke="#fff" strokeWidth={0.7} /><rect x={-0.8} y={2.2} width={9.6} height={2.4} fill="#111" /></g>
      : <text x={53} y={42} textAnchor="middle" fontSize={5.5} fontStyle="italic" fontWeight={900} fill="#f3e6c8" fontFamily="'Brush Script MT', 'Segoe Script', cursive">Indian</text>}
    <path d={harley ? "M62 30 L84 22 L98 16" : "M62 32 L80 34 L94 32"} stroke={harley ? "#f8fafc" : "#111"} strokeWidth={5} fill="none" strokeLinecap="round" />
    <circle cx={harley ? 98 : 94} cy={harley ? 16 : 32} r={3} fill={SKIN} stroke={INK} strokeWidth={0.8} />
    <circle cx={62} cy={14} r={9} fill={SKIN} stroke={INK} strokeWidth={1.6} />
    <path d={`M56 16 q2 ${12 + (look % 3) * 2} 9 ${12 + (look % 3) * 2} q7 -2 7 -12 q-4 3 -8 2 q-4 1 -8 -2 z`} fill={beard} stroke={INK} strokeWidth={1} />
    <rect x={62} y={10} width={10} height={3.6} rx={1.8} fill={INK} />
    {harley
      ? <><path d="M53 10 q9 -11 19 -1 l-1 2 h-17 z" fill="#f97316" stroke={INK} strokeWidth={1.1} /><path d="M54 10 l-10 2 M54 10 l-9 -3" stroke="#f97316" strokeWidth={2.2} strokeLinecap="round" className={styles.bandanaTail} /></>
      : <><path d="M52 13 q0 -13 11 -13 q10 0 10 11 l-1 2 h-20 z" fill="#f3e6c8" stroke={INK} strokeWidth={1.3} /><path d="M53 7 h19" stroke="#b91c1c" strokeWidth={2.4} /></>}
    </>}
  </svg>;
}
