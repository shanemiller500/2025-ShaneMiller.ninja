import styles from "../day-out.module.css";

// An emu at full sprint: shaggy brown body, long blue-grey neck, legs going like the clappers.
// `oneLeg`: it's been shot once and lost a leg, so it hops. Faces right; viewBox 70×90, feet on y=90.
const INK = "#111", FEATHER = "#5b4636", NECK = "#8ea3b8";

const Leg = ({ d }: { d: string }) => <>
  <path d={d} stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  <path d={d} stroke="#9a7b5b" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
</>;

export default function Emu({ oneLeg = false }: { oneLeg?: boolean }) {
  return <svg viewBox="0 0 70 90" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Legs: the near one swings, the far one counter-swings (only the near one if it's lost one) */}
    {!oneLeg && <g className={styles.emuLegFar}><Leg d="M30 52 L26 70 L32 88 M32 88 l-6 2 M32 88 l6 1" /></g>}
    <g className={oneLeg ? undefined : styles.emuLegNear}><Leg d="M36 52 L40 70 L34 88 M34 88 l-6 1 M34 88 l6 2" /></g>
    {/* Shaggy body */}
    <ellipse cx={32} cy={42} rx={24} ry={15} fill={FEATHER} stroke={INK} strokeWidth={1.8} />
    <path d="M12 40 q4 8 0 14 M18 44 q3 8 -1 13 M26 46 q2 7 -1 11 M36 46 q2 6 0 10 M46 44 q2 6 1 10" stroke="#3b2f26" strokeWidth={2} fill="none" strokeLinecap="round" />
    <path d="M16 34 q8 -6 18 -4 q8 -2 14 4" stroke="#7a6048" strokeWidth={2} fill="none" />
    {/* Neck and little head, staring */}
    <path d="M50 36 Q60 26 58 8" stroke={INK} strokeWidth={8} fill="none" strokeLinecap="round" />
    <path d="M50 36 Q60 26 58 8" stroke={NECK} strokeWidth={5.5} fill="none" strokeLinecap="round" />
    <ellipse cx={60} cy={6} rx={7} ry={5} fill="#4b3a2c" stroke={INK} strokeWidth={1.4} />
    <path d="M66 6 L72 7 L66 9 Z" fill="#3b3b3b" stroke={INK} strokeWidth={0.8} />
    <circle cx={62} cy={5} r={2} fill="#f97316" stroke={INK} strokeWidth={0.8} />
    <circle cx={62.4} cy={5} r={0.8} fill={INK} />
  </svg>;
}

// The leg that comes off on the first shot, spinning away. viewBox 20×40.
export function EmuLeg() {
  return <svg viewBox="0 0 20 40" width="100%" height="100%" aria-hidden overflow="visible">
    <Leg d="M8 2 L12 20 L6 38 M6 38 l-5 1 M6 38 l5 2" />
    <path d="M4 2 q4 -3 8 0" stroke={FEATHER} strokeWidth={4} fill="none" strokeLinecap="round" />
  </svg>;
}
