import styles from "../day-out.module.css";

// Cartoon Aussie roadkill: legs in the air, X eyes, a couple of flies. viewBox 80×44.
// "snake" is only ever a hoop snake that got run over (or shot), so it is not in CRITTERS.
export type Critter = "roo" | "koala" | "croc" | "wombat" | "snake";
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
    case "snake": return <>
      <path d="M4 36 q9 -9 18 0 t18 0 t18 0" stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />
      <path d="M4 36 q9 -9 18 0 t18 0 t18 0" stroke="#7a5c2e" strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d="M8 35 q7 -6 14 0 t18 0 t14 0" stroke="#e8d5a8" strokeWidth={2} fill="none" strokeDasharray="3 3" />
      <ellipse cx={64} cy={36} rx={8} ry={5} fill="#7a5c2e" stroke={INK} strokeWidth={2} />
      <XEye x={65} y={35} />
      <path d="M72 37 h5 l2 -2 m-2 2 l2 2" stroke="#d62828" strokeWidth={1.3} fill="none" strokeLinecap="round" />
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

// What the crows leave behind: a cartoon skeleton (skull, spine, ribs, a leg bone or two).
function Bones({ kind }: { kind: Critter }) {
  const long = kind === "croc" || kind === "snake";
  const ribs = long ? [16, 24, 32, 40, 48, 56] : [28, 35, 42, 49];
  return <>
    <ellipse cx={40} cy={42} rx={32} ry={2.5} fill="#0004" />
    <path d={long ? "M6 34 Q40 28 62 32" : "M18 34 Q40 28 58 32"} stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />
    <path d={long ? "M6 34 Q40 28 62 32" : "M18 34 Q40 28 58 32"} stroke="#f5f0e6" strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray="4 1.5" />
    {ribs.map(x => <path key={x} d={`M${x} 31 q-3 -8 1 -13 M${x} 32 q-3 6 1 9`} stroke="#f5f0e6" strokeWidth={2.4} fill="none" strokeLinecap="round" />)}
    {!long && <>
      <path d="M20 36 l-8 4 M24 36 l-4 7" stroke="#f5f0e6" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={11} cy={40} r={1.8} fill="#f5f0e6" stroke={INK} strokeWidth={0.8} />
    </>}
    <path d="M60 24 C 60 16, 76 16, 76 25 C 76 30, 72 33, 68 33 L 64 33 C 61 31, 60 28, 60 24 Z" fill="#f5f0e6" stroke={INK} strokeWidth={1.8} />
    <circle cx={65} cy={24} r={2.4} fill={INK} />
    <circle cx={71} cy={24} r={2.4} fill={INK} />
    <path d="M64 31 h8 M66 29.5 v3 M68.5 29.5 v3 M71 29.5 v3" stroke={INK} strokeWidth={0.9} />
  </>;
}

// Red smears left by the crows (cartoon: blotches and drips, nothing more).
function Mess() {
  return <g fill="#b3121f" opacity={0.85}>
    <ellipse cx={40} cy={41} rx={26} ry={3.2} opacity={0.7} />
    <path d="M30 26 q6 -4 12 0 q5 3 0 7 q-7 3 -12 -1 q-3 -3 0 -6 z" />
    <path d="M52 30 q4 -3 7 1 q1 4 -4 4 q-4 -1 -3 -5 z" />
    <circle cx={22} cy={32} r={2.6} /><circle cx={60} cy={24} r={2} /><circle cx={46} cy={36} r={1.8} />
    <path d="M36 33 q1 4 0 7 M44 34 q-1 3 0 6" stroke="#b3121f" strokeWidth={1.6} fill="none" strokeLinecap="round" />
  </g>;
}

export default function RoadKill({ kind, bones = false, bloody = false }: { kind: Critter; bones?: boolean; bloody?: boolean }) {
  return <svg viewBox="0 0 80 44" width="100%" height="100%" aria-hidden overflow="visible">
    {bones ? <Bones kind={kind} /> : <CritterArt kind={kind} />}
    {bloody && <Mess />}
  </svg>;
}
