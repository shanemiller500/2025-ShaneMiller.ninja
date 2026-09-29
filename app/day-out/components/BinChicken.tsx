import styles from "../day-out.module.css";
import { CritterArt, type Critter } from "./RoadKill";

// An Australian white ibis ("bin chicken"): grubby white feathers, bald black head, long
// curved beak, skinny legs. Faces right; `carrying` dangles a stolen critter from the beak.
// viewBox 90×90, feet at y=88.
const INK = "#111";

// What's dangling from the beak: a stolen critter, or a snag nicked off Shazz's barbie.
function Loot({ carrying, x, y }: { carrying: Critter | "snag"; x: number; y: number }) {
  if (carrying === "snag") return <rect x={x - 3} y={y} width={16} height={6} rx={3} fill="#5a2e17" stroke={INK} strokeWidth={1.5} transform={`rotate(70 ${x} ${y})`} />;
  return <g transform={`translate(${x} ${y}) scale(0.32)`}><CritterArt kind={carrying} shadow={false} /></g>;
}

// In flight: neck stretched forward, legs trailing, wings flapping.
function Flying({ carrying }: { carrying?: Critter | "snag" | null }) {
  return <svg viewBox="0 0 90 90" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M18 48 L1 55 M18 50 L3 59" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
    <path d="M16 44 q-10 2 -14 -4 q8 -2 14 0 z" fill="#1d1d1d" />
    {/* Far wing */}
    <g className={styles.ibisWingFar}><path d="M34 42 Q24 16 46 10 Q48 28 48 42 Z" fill="#cfccc3" stroke={INK} strokeWidth={1.5} /></g>
    <ellipse cx={38} cy={46} rx={24} ry={10} fill="#eceae3" stroke={INK} strokeWidth={2.5} />
    <path d="M58 43 L72 37" stroke="#eceae3" strokeWidth={7} strokeLinecap="round" />
    <circle cx={75} cy={36} r={6.5} fill="#1d1d1d" stroke={INK} strokeWidth={1.5} />
    <circle cx={77} cy={34.5} r={1.5} fill="#fff" />
    <path d="M80 38 q10 3 11 15" stroke="#1d1d1d" strokeWidth={3.2} fill="none" strokeLinecap="round" />
    {carrying && <Loot carrying={carrying} x={89} y={52} />}
    {/* Near wing, black-tipped */}
    <g className={styles.ibisWing}>
      <path d="M30 44 Q16 12 44 4 Q46 26 46 44 Z" fill="#f4f2eb" stroke={INK} strokeWidth={2} />
      <path d="M22 18 Q30 6 44 4 Q40 10 36 12 Z" fill="#1d1d1d" />
    </g>
  </svg>;
}

export default function BinChicken({ carrying, flying = false }: { carrying?: Critter | "snag" | null; flying?: boolean }) {
  if (flying) return <Flying carrying={carrying} />;
  return <svg viewBox="0 0 90 90" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Legs (animated walk) */}
    <g className={styles.ibisLegs}>
      <path d="M36 62 L32 86 M32 86 l-5 2 M32 86 l4 2" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <path d="M44 62 L48 86 M48 86 l-4 2 M48 86 l5 2" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </g>
    {/* Grubby body with black tail plumes */}
    <path d="M14 46 q-8 6 -10 14 q8 -2 14 -6 z" fill="#1d1d1d" stroke={INK} strokeWidth={1.5} />
    <ellipse cx={38} cy={50} rx={24} ry={15} fill="#eceae3" stroke={INK} strokeWidth={2.5} />
    <path d="M22 50 q10 6 26 2" stroke="#b9b39f" strokeWidth={2} fill="none" />
    <circle cx={30} cy={56} r={2.5} fill="#8a7d5c" opacity={0.7} />
    <circle cx={45} cy={46} r={1.8} fill="#8a7d5c" opacity={0.6} />
    {/* Neck and bald black head (bobs while it walks) */}
    <g className={styles.ibisHead}>
      <path d="M56 44 q10 -12 8 -24" stroke="#eceae3" strokeWidth={8} fill="none" strokeLinecap="round" />
      <path d="M56 44 q10 -12 8 -24" stroke={INK} strokeWidth={10} fill="none" strokeLinecap="round" opacity={0.2} />
      <circle cx={64} cy={18} r={7} fill="#1d1d1d" stroke={INK} strokeWidth={1.5} />
      <circle cx={66} cy={16} r={1.6} fill="#fff" />
      <circle cx={66.4} cy={16} r={0.8} fill={INK} />
      {/* The famous beak */}
      <path d="M69 19 q14 4 18 18" stroke="#1d1d1d" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      {carrying && <Loot carrying={carrying} x={70} y={30} />}
    </g>
  </svg>;
}
