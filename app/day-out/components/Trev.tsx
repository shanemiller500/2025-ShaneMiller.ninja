import styles from "../day-out.module.css";
import { CritterArt, type Critter } from "./RoadKill";

// Twitchy Trev: skinny, shirtless, sunburnt and grubby, faded tatts (skull on the chest, scribbles
// up the arms), rat's-tail mullet and huge bulging eyes from one energy drink too many.
// Faces right; viewBox 60×110, feet at y=108. "peek" is him half behind a tree, a hand on the
// trunk; "cook" holds a stick out over the fire; `stick="up"` waves his dinner over his head.
const INK = "#111", SKIN = "#e9b48c", DIRT = "#8a6a4a", INKTAT = "#35507a";

// A lump of roadkill on the end of a stick, a bit charred.
export function StickFood({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <g>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6b4423" strokeWidth={2.2} strokeLinecap="round" />
    <ellipse cx={x2} cy={y2} rx={6.5} ry={4.8} fill="#7c3f1d" stroke={INK} strokeWidth={1.4} transform={`rotate(${Math.atan2(y2 - y1, x2 - x1) * 57.3} ${x2} ${y2})`} />
    <path d={`M${x2 - 3} ${y2 - 1} l2 2 M${x2 + 1} ${y2 - 2} l2 2`} stroke="#2a1408" strokeWidth={1.2} />
  </g>;
}

// "dance" is arms in the air; "zapped" is stiff-armed with sparks coming off him. `shorts` recolours
// the footy shorts so a crowd of Trevs doesn't look like clones.
export default function Trev({ pose = "peek", carrying = null, stick = "none", shorts = "#b91c1c" }: { pose?: "peek" | "run" | "cook" | "dance" | "zapped" | "cuffed" | "crawl" | "pee" | "scratch"; carrying?: Critter | null; stick?: "none" | "cook" | "up"; shorts?: string }) {
  // On all fours like a dog (Gumtree Gary getting a pat), or with a back leg up against a tree.
  if (pose === "crawl" || pose === "pee") {
    const pee = pose === "pee";
    const limb = (d: string) => <><path d={d} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d={d} stroke={SKIN} strokeWidth={3.8} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>;
    return <svg viewBox="0 0 60 110" width="100%" height="100%" aria-hidden overflow="visible">
      {pee && <path className={styles.peeStream} d="M8 82 Q-8 80 -16 106" stroke="#facc15" strokeWidth={2.4} fill="none" strokeLinecap="round" />}
      <g className={pee ? undefined : styles.bludgerLegs}>{limb(pee ? "M14 82 L2 70 L-4 72" : "M14 84 L10 106")}</g>
      {limb("M22 86 L24 106")}
      <g className={pee ? undefined : styles.bludgerLegs} style={{ animationDelay: "-.15s" }}>{limb("M42 84 L44 106 M48 82 L52 106")}</g>
      <path d="M8 76 q4 -9 15 -7 l2 17 h-17 z" fill={shorts} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M20 70 q16 -9 32 -1 l0 15 q-16 5 -32 0 z" fill={SKIN} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M28 72 v12 M33 71 v13 M38 71 v13" stroke="#c98f6a" strokeWidth={1} />
      <circle cx={30} cy={80} r={1.6} fill={DIRT} opacity={0.6} />
      {/* Head up, tongue out, panting */}
      <path d="M50 62 q-8 -2 -10 8" stroke="#6b4a2b" strokeWidth={3} fill="none" strokeLinecap="round" />
      <ellipse cx={54} cy={66} rx={8} ry={9} fill={SKIN} stroke={INK} strokeWidth={1.8} />
      <path d="M46 62 q4 -8 12 -6 q4 2 4 6 q-6 -3 -16 0 z" fill="#6b4a2b" stroke={INK} strokeWidth={1.2} />
      <g className={styles.trevEyes}>
        <circle cx={54} cy={64} r={3.6} fill="#fff" stroke={INK} strokeWidth={1.1} /><circle cx={60} cy={64} r={3.6} fill="#fff" stroke={INK} strokeWidth={1.1} />
        <circle cx={55} cy={64} r={1.1} fill={INK} /><circle cx={61} cy={64} r={1.1} fill={INK} />
      </g>
      <path className={pee ? undefined : styles.pant} d="M56 72 q3 1 4 0 q1 5 -2 6 q-3 -1 -2 -6 z" fill="#f472b6" stroke={INK} strokeWidth={0.8} />
    </svg>;
  }
  const running = pose === "run", walking = running || pose === "cuffed";
  // "scratch": one hand going at his head, the other at his belly (arms jiggle in CSS).
  const arms = pose === "scratch" ? "M23 38 L30 50 L34 49 M37 38 L46 24 L38 12" : pose === "cuffed" ? "M23 38 L22 56 M37 38 L30 58" : pose === "dance" ? "M23 38 L14 18 M37 38 L46 16" : pose === "zapped" ? "M23 38 L6 30 M37 38 L54 30"
    : pose === "cook" ? "M23 38 L28 52 M37 38 L50 42"
    : running ? (stick === "up" ? "M23 38 L14 52 M37 38 L42 14" : "M23 38 L14 52 M37 38 L46 30")
    : "M37 38 L50 36 L54 30 M23 38 L18 54";
  return <svg viewBox="0 0 60 110" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Legs, footy shorts, thongs */}
    <g className={walking ? styles.bludgerLegs : undefined}>
      <path d="M25 72 L21 104 M35 72 L39 104" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <path d="M25 72 L21 104 M35 72 L39 104" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" />
      <path d="M15 107 h10 M35 107 h10" stroke="#16a34a" strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={23} cy={92} r={1.6} fill={DIRT} /><circle cx={38} cy={96} r={1.3} fill={DIRT} />
    </g>
    <path d="M19 62 h22 l2 14 h-12 l-1 -4 l-1 4 h-12 z" fill={shorts} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    {/* Bare skinny torso: ribs, a skull tatt, grime */}
    <path d="M21 34 q9 -5 18 0 l2 29 h-22 z" fill={SKIN} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    <path d="M24 46 q6 2 12 0 M24 50 q6 2 12 0 M25 54 q5 2 10 0" stroke="#c98f6a" strokeWidth={1.1} fill="none" />
    <g stroke={INKTAT} strokeWidth={1} fill="none">
      <path d="M27 38 q3 -3 6 0 q0 3 -1 4 h-4 q-1 -1 -1 -4 z" />
      <circle cx={29} cy={39} r={0.7} fill={INKTAT} /><circle cx={31.5} cy={39} r={0.7} fill={INKTAT} />
    </g>
    <circle cx={36} cy={57} r={2.2} fill={DIRT} opacity={0.6} /><circle cx={24} cy={41} r={1.5} fill={DIRT} opacity={0.6} />
    {/* Arms, tatts up the forearms, and whatever's in his hands */}
    {stick === "cook" && <StickFood x1={50} y1={42} x2={86} y2={36} />}
    {stick === "up" && <StickFood x1={42} y1={14} x2={46} y2={-16} />}
    <g className={pose === "scratch" ? styles.scratchArm : undefined}>
      <path d={arms} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={arms} stroke={SKIN} strokeWidth={3.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <path d={running ? "M17 47 l2 2" : "M20 47 l1 2"} stroke={INKTAT} strokeWidth={1.2} fill="none" />
    {pose === "cuffed" && <>
      <circle cx={24} cy={57} r={2.6} fill="none" stroke="#9ca3af" strokeWidth={1.6} /><circle cx={29} cy={57} r={2.6} fill="none" stroke="#9ca3af" strokeWidth={1.6} />
    </>}
    {carrying && <g transform="translate(6 40) scale(0.42)"><CritterArt kind={carrying} shadow={false} /></g>}
    {/* Head: rat's tail, stubble, massive eyes */}
    <path d="M24 18 q-6 6 -5 16 q2 -1 3 -6" stroke="#6b4a2b" strokeWidth={3} fill="none" strokeLinecap="round" />
    <ellipse cx={31} cy={20} rx={9} ry={11} fill={SKIN} stroke={INK} strokeWidth={2} />
    <path d="M22 16 q2 -9 10 -9 q7 0 9 7 q-5 -3 -10 -2 q-5 -1 -9 4 z" fill="#6b4a2b" stroke={INK} strokeWidth={1.3} />
    <path d="M25 26 q6 5 12 0" stroke="#8a7a6a" strokeWidth={3} opacity={0.5} fill="none" />
    <g className={styles.trevEyes}>
      <circle cx={30} cy={18} r={4.8} fill="#fff" stroke={INK} strokeWidth={1.3} />
      <circle cx={39} cy={18} r={4.8} fill="#fff" stroke={INK} strokeWidth={1.3} />
      <circle cx={31.5} cy={18} r={1.4} fill={INK} /><circle cx={40.5} cy={18} r={1.4} fill={INK} />
      <path d="M26 15 q2 -1 3 1 M36 15 q2 -1 3 1" stroke="#e57373" strokeWidth={0.6} fill="none" />
    </g>
    <path d={running ? "M31 26 q4 4 8 0 z" : "M31 27 q2 -2 4 0 q2 2 4 0"} fill={running ? "#fff" : "none"} stroke={INK} strokeWidth={1.3} />
    <circle cx={27} cy={25} r={1.2} fill={DIRT} opacity={0.7} />
    {pose === "cuffed" && <g transform="rotate(-20 33 12)"><rect x={28} y={10} width={11} height={4} rx={2} fill="#f5d0a9" stroke={INK} strokeWidth={0.8} /><path d="M32 11 v2 M35 11 v2" stroke="#c9a27a" strokeWidth={0.8} /></g>}
    {pose === "zapped" && <g className={styles.zapBolt} stroke="#fde047" strokeWidth={2} fill="none" strokeLinejoin="round">
      <path d="M8 18 l6 3 l-4 3 l7 3" /><path d="M52 16 l-6 3 l4 3 l-7 3" /><path d="M10 50 l6 2 l-4 3 l6 3" /><path d="M50 52 l-6 2 l4 3 l-6 3" />
      <path d="M24 4 l1 -6 M31 2 v-7 M38 4 l2 -6" stroke="#6b4a2b" strokeWidth={2} />
    </g>}
  </svg>;
}
