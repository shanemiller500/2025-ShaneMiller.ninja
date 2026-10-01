import styles from "../day-out.module.css";
import Kangaroo from "./Kangaroo";
import SlitherSnake from "./SlitherSnake";
import Emu from "./Emu";
import type { Critter } from "./RoadKill";

// The critters while they're still alive, wandering onto the road. Side-on facing right,
// viewBox 80×56 with feet at y=54 (the roo reuses the hopping Kangaroo).
const INK = "#111";

const Leg = ({ d, color }: { d: string; color: string }) => <>
  <path d={d} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
  <path d={d} stroke={color} strokeWidth={3.5} fill="none" strokeLinecap="round" />
</>;
const Eye = ({ x, y }: { x: number; y: number }) => <>
  <circle cx={x} cy={y} r={2.6} fill="#fff" stroke={INK} strokeWidth={1} />
  <circle cx={x + 0.8} cy={y} r={1.2} fill={INK} />
</>;

function Body({ kind }: { kind: Exclude<Critter, "roo" | "snake" | "emu"> }) {
  switch (kind) {
    case "koala": return <>
      <g className={styles.critterLegs}><Leg d="M28 40 L26 53" color="#9aa0a6" /><Leg d="M48 40 L50 53" color="#9aa0a6" /></g>
      <Leg d="M34 42 L34 53" color="#8a9096" /><Leg d="M42 42 L43 53" color="#8a9096" />
      <ellipse cx={38} cy={36} rx={18} ry={11} fill="#9aa0a6" stroke={INK} strokeWidth={2.5} />
      <circle cx={52} cy={18} r={7} fill="#9aa0a6" stroke={INK} strokeWidth={2} />
      <circle cx={52} cy={18} r={3.5} fill="#f0d5d5" />
      <circle cx={70} cy={20} r={7} fill="#9aa0a6" stroke={INK} strokeWidth={2} />
      <circle cx={70} cy={20} r={3.5} fill="#f0d5d5" />
      <circle cx={61} cy={29} r={11} fill="#9aa0a6" stroke={INK} strokeWidth={2.5} />
      <ellipse cx={68} cy={32} rx={3.5} ry={5} fill={INK} />
      <Eye x={59} y={26} />
    </>;
    case "croc": return <>
      <g className={styles.critterLegs}>{[18, 50].map(x => <Leg key={x} d={`M${x} 42 L${x - 4} 53`} color="#4f7942" />)}</g>
      {[26, 58].map(x => <Leg key={x} d={`M${x} 42 L${x + 3} 53`} color="#3f6634" />)}
      <path d="M0 40 Q16 32 36 33 Q56 32 70 36 L80 38 Q70 46 50 46 Q18 46 0 40 Z" fill="#4f7942" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M8 37 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4" stroke={INK} strokeWidth={1.5} fill="#3f6634" />
      <path d="M58 42 l3 -3 l3 3 l3 -3 l3 3 l3 -3" stroke="#fff" strokeWidth={1.8} fill="none" />
      <circle cx={62} cy={32} r={4} fill="#4f7942" stroke={INK} strokeWidth={2} />
      <circle cx={62.5} cy={31.5} r={1.8} fill="#ffd23f" stroke={INK} strokeWidth={0.8} />
    </>;
    case "wombat": return <>
      <g className={styles.critterLegs}>{[24, 50].map(x => <Leg key={x} d={`M${x} 40 L${x} 53`} color="#7a5c43" />)}</g>
      {[32, 58].map(x => <Leg key={x} d={`M${x} 40 L${x + 1} 53`} color="#6a4e38" />)}
      <rect x={14} y={24} width={50} height={22} rx={11} fill="#7a5c43" stroke={INK} strokeWidth={2.5} />
      <rect x={22} y={25} width={32} height={6} rx={3} fill="#a0826a" />
      <circle cx={64} cy={20} r={3.5} fill="#7a5c43" stroke={INK} strokeWidth={2} />
      <circle cx={68} cy={32} r={10} fill="#7a5c43" stroke={INK} strokeWidth={2.5} />
      <ellipse cx={76} cy={34} rx={3.5} ry={4} fill={INK} />
      <Eye x={67} y={29} />
    </>;
  }
}

export default function LiveCritter({ kind }: { kind: Critter }) {
  if (kind === "roo") return <Kangaroo />;
  if (kind === "snake") return <SlitherSnake />;
  if (kind === "emu") return <Emu />;
  return <svg viewBox="0 0 80 56" width="100%" height="100%" aria-hidden overflow="visible">
    <Body kind={kind} />
  </svg>;
}
