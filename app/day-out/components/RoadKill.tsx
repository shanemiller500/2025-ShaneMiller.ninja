import styles from "../day-out.module.css";

// Cartoon Aussie roadkill: legs in the air, X eyes, a couple of flies. viewBox 80×44.
export type Critter = "roo" | "koala" | "croc" | "wombat";
export const CRITTERS: Critter[] = ["roo", "koala", "croc", "wombat"];
const INK = "#111";

const XEye = ({ x, y }: { x: number; y: number }) => <path d={`M${x - 2.5} ${y - 2.5} l5 5 m0 -5 l-5 5`} stroke={INK} strokeWidth={1.8} strokeLinecap="round" />;
const Leg = ({ d, color }: { d: string; color: string }) => <>
  <path d={d} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
  <path d={d} stroke={color} strokeWidth={3.5} fill="none" strokeLinecap="round" />
</>;

function Body({ kind }: { kind: Critter }) {
  switch (kind) {
    case "roo": return <>
      <path d="M22 34 Q10 36 2 40" stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />
      <path d="M22 34 Q10 36 2 40" stroke="#b5733a" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Leg d="M32 26 L26 8 L20 6" color="#b5733a" />
      <Leg d="M38 25 L36 10 L30 7" color="#b5733a" />
      <Leg d="M50 24 L53 16" color="#b5733a" />
      <ellipse cx={40} cy={32} rx={20} ry={9} fill="#b5733a" stroke={INK} strokeWidth={2.5} />
      <ellipse cx={40} cy={29} rx={12} ry={4} fill="#e6c49a" />
      <ellipse cx={66} cy={17} rx={3} ry={8} fill="#b5733a" stroke={INK} strokeWidth={2} transform="rotate(20 66 17)" />
      <circle cx={63} cy={31} r={8} fill="#b5733a" stroke={INK} strokeWidth={2.5} />
      <XEye x={64} y={30} />
      <path d="M69 35 q3 3 1 6" stroke="#e57373" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </>;
    case "koala": return <>
      <Leg d="M32 22 L30 10" color="#9aa0a6" />
      <Leg d="M44 20 L46 9" color="#9aa0a6" />
      <circle cx={38} cy={30} r={13} fill="#9aa0a6" stroke={INK} strokeWidth={2.5} />
      <ellipse cx={38} cy={27} rx={7} ry={4} fill="#e8e8e8" />
      <circle cx={52} cy={17} r={7} fill="#9aa0a6" stroke={INK} strokeWidth={2} />
      <circle cx={52} cy={17} r={3.5} fill="#f0d5d5" />
      <circle cx={68} cy={20} r={7} fill="#9aa0a6" stroke={INK} strokeWidth={2} />
      <circle cx={68} cy={20} r={3.5} fill="#f0d5d5" />
      <circle cx={60} cy={28} r={10} fill="#9aa0a6" stroke={INK} strokeWidth={2.5} />
      <ellipse cx={66} cy={31} rx={3.5} ry={4.5} fill={INK} />
      <XEye x={57} y={26} />
    </>;
    case "croc": return <>
      {[20, 30, 46, 56].map(x => <Leg key={x} d={`M${x} 28 L${x - 2} 20`} color="#4f7942" />)}
      <path d="M4 34 Q20 26 40 28 Q60 28 78 32 Q60 40 40 40 Q18 40 4 34 Z" fill="#4f7942" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M14 31 Q40 25 64 30" stroke="#c9d7a0" strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d="M60 36 l3 3 l3 -3 l3 3 l3 -3 l3 3" stroke="#fff" strokeWidth={1.8} fill="none" />
      <XEye x={62} y={31} />
    </>;
    case "wombat": return <>
      {[26, 34, 46, 54].map(x => <Leg key={x} d={`M${x} 22 L${x} 13`} color="#7a5c43" />)}
      <rect x={16} y={20} width={46} height={20} rx={10} fill="#7a5c43" stroke={INK} strokeWidth={2.5} />
      <rect x={24} y={20} width={30} height={6} rx={3} fill="#a0826a" />
      <circle cx={66} cy={17} r={3} fill="#7a5c43" stroke={INK} strokeWidth={2} />
      <circle cx={66} cy={29} r={9} fill="#7a5c43" stroke={INK} strokeWidth={2.5} />
      <ellipse cx={73} cy={31} rx={3} ry={3.5} fill={INK} />
      <XEye x={64} y={27} />
    </>;
  }
}

// The critter on its own, for drawing inside another SVG (e.g. strapped to the bike).
export function CritterArt({ kind, shadow = true }: { kind: Critter; shadow?: boolean }) {
  return <>
    {shadow && <ellipse cx={40} cy={42} rx={34} ry={3} fill="#0005" />}
    <Body kind={kind} />
    <g className={styles.flies}>
      <circle cx={30} cy={2} r={1.4} fill={INK} />
      <circle cx={46} cy={-2} r={1.4} fill={INK} />
      <path d="M26 6 q2 -3 4 0 q2 3 4 0" stroke="#0008" strokeWidth={1} fill="none" />
    </g>
  </>;
}

export default function RoadKill({ kind }: { kind: Critter }) {
  return <svg viewBox="0 0 80 44" width="100%" height="100%" aria-hidden overflow="visible">
    <CritterArt kind={kind} />
  </svg>;
}
