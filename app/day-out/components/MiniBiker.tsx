import styles from "../day-out.module.css";

// One of Shazz's mates: bearded bloke in a vest and bandana on a chopper, facing
// right. Kept simple because fifty of them ride past at once. viewBox 100×70.
const INK = "#111";
const BANDANAS = ["#c0392b", "#1f3b8f", "#111", "#e0a100", "#2e7d32"];
const TANKS = ["#1d1d1d", "#7a1f1f", "#1f3b8f", "#555", "#b35900"];
const BEARDS = ["#6d4c2f", "#999", "#3a2a1f", "#d9c7a8"];

// `gang` forces club colours (red or blue bandana and tank) for the brawl.
// `riderless` leaves the bike parked on its own (the rider's off having a go). `bricks`: the rear
// wheel has been nicked and the back of the bike is propped up on a couple of bricks.
export default function MiniBiker({ seed, gang, riderless = false, bricks = false }: { seed: number; gang?: "red" | "blue"; riderless?: boolean; bricks?: boolean }) {
  const club = gang === "red" ? "#c0392b" : gang === "blue" ? "#1f5fbf" : null;
  const bandana = club || BANDANAS[seed % BANDANAS.length], tank = club || TANKS[(seed * 3) % TANKS.length], beard = BEARDS[(seed * 7) % BEARDS.length];
  return <svg viewBox="0 0 100 70" width="100%" height="100%" aria-hidden overflow="visible">
    {bricks && <g stroke={INK} strokeWidth={1.5}>
      <rect x={11} y={58} width={18} height={9} fill="#b45309" /><rect x={13} y={49} width={16} height={9} fill="#c2410c" />
      <path d="M11 62 h18 M19 58 v4 M21 49 v9" stroke="#7c2d12" strokeWidth={1} />
    </g>}
    {(bricks ? [80] : [20, 80]).map(cx => <g key={cx} className={styles.wheel}>
      <circle cx={cx} cy={56} r={12} fill="#222" stroke={INK} strokeWidth={2.5} />
      <line x1={cx - 8} y1={56} x2={cx + 8} y2={56} stroke="#aeb4bb" strokeWidth={1.5} />
      <line x1={cx} y1={48} x2={cx} y2={64} stroke="#aeb4bb" strokeWidth={1.5} />
    </g>)}
    <path d="M20 56 L36 42 L58 44 L70 26 L80 56" stroke={INK} strokeWidth={4} fill="none" strokeLinejoin="round" />
    <path d="M50 44 C 53 36, 66 34, 70 40 C 66 46, 54 48, 50 44 Z" fill={tank} stroke={INK} strokeWidth={2} />
    <path d="M70 28 L66 12 L60 13" stroke="#c9ced6" strokeWidth={3} fill="none" strokeLinecap="round" />
    {!riderless && <>
    <ellipse cx={42} cy={32} rx={12} ry={13} fill="#1d1d1d" stroke={INK} strokeWidth={2} />
    <path d="M42 44 L54 46 L58 54" stroke="#2f4a78" strokeWidth={7} fill="none" strokeLinecap="round" />
    <path d="M46 26 L56 24 L61 14" stroke="#f1c27d" strokeWidth={5} fill="none" strokeLinecap="round" />
    <circle cx={48} cy={13} r={8} fill="#f1c27d" stroke={INK} strokeWidth={2} />
    <path d="M40 11 q8 -9 16 0 z" fill={bandana} stroke={INK} strokeWidth={1.5} />
    <path d="M42 15 q4 12 13 3" fill={beard} stroke={INK} strokeWidth={1.5} />
    <rect x={48} y={11} width={8} height={3} rx={1} fill={INK} />
    </>}
  </svg>;
}
