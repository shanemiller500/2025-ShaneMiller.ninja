import styles from "../day-out.module.css";
import { CritterArt, type Critter } from "./RoadKill";
import { StickFood } from "./Trev";

// Kylie, Trev's girlfriend: just as wired. Skinny, messy blonde bun with a scrunchie, faded
// pink singlet, denim shorts, a rose tatt on the arm, grubby knees, and the same huge eyes.
// Faces right; viewBox 60×110, feet at y=108. Same poses and stick as Trev.
const INK = "#111", SKIN = "#f0c09a", DIRT = "#8a6a4a", INKTAT = "#35507a";

// Same extra poses as Trev; `top` recolours the singlet.
export default function Kylie({ pose = "peek", carrying = null, stick = "none", top = "#f9a8d4" }: { pose?: "peek" | "run" | "cook" | "dance" | "zapped" | "cuffed" | "scratch"; carrying?: Critter | null; stick?: "none" | "cook" | "up"; top?: string }) {
  const running = pose === "run", walking = running || pose === "cuffed";
  const arms = pose === "scratch" ? "M23 40 L30 52 L34 51 M37 40 L46 26 L38 14" : pose === "cuffed" ? "M23 40 L22 58 M37 40 L30 60" : pose === "dance" ? "M23 40 L14 20 M37 40 L46 18" : pose === "zapped" ? "M23 40 L6 32 M37 40 L54 32"
    : pose === "cook" ? "M23 40 L28 54 M37 40 L50 44"
    : running ? (stick === "up" ? "M23 40 L14 54 M37 40 L42 16" : "M23 40 L14 54 M37 40 L46 32")
    : "M37 40 L50 38 L54 32 M23 40 L18 56";
  return <svg viewBox="0 0 60 110" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Legs, thongs, grubby knees */}
    <g className={walking ? styles.bludgerLegs : undefined}>
      <path d="M26 74 L22 104 M34 74 L38 104" stroke={INK} strokeWidth={6.5} strokeLinecap="round" />
      <path d="M26 74 L22 104 M34 74 L38 104" stroke={SKIN} strokeWidth={4.2} strokeLinecap="round" />
      <path d="M16 107 h10 M34 107 h10" stroke="#ec4899" strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={24} cy={88} r={1.6} fill={DIRT} opacity={0.7} /><circle cx={36} cy={90} r={1.6} fill={DIRT} opacity={0.7} />
    </g>
    {/* Denim shorts, faded singlet */}
    <path d="M20 64 h20 l2 12 h-11 l-1 -4 l-1 4 h-11 z" fill="#5b7fb8" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    <path d="M22 36 q8 -5 16 0 l2 29 h-20 z" fill={top} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    <path d="M25 36 v-4 M35 36 v-4" stroke={top} strokeWidth={2} />
    <circle cx={34} cy={52} r={2} fill={DIRT} opacity={0.45} /><circle cx={26} cy={58} r={1.4} fill={DIRT} opacity={0.45} />
    {stick === "cook" && <StickFood x1={50} y1={44} x2={86} y2={38} />}
    {stick === "up" && <StickFood x1={42} y1={16} x2={46} y2={-14} />}
    <g className={pose === "scratch" ? styles.scratchArm : undefined}>
      <path d={arms} stroke={INK} strokeWidth={5.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={arms} stroke={SKIN} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    {/* Rose tatt on the upper arm */}
    <circle cx={running ? 18 : 21} cy={running ? 48 : 49} r={1.8} fill="#e11d48" stroke={INKTAT} strokeWidth={0.8} />
    {pose === "cuffed" && <>
      <circle cx={24} cy={59} r={2.6} fill="none" stroke="#9ca3af" strokeWidth={1.6} /><circle cx={29} cy={59} r={2.6} fill="none" stroke="#9ca3af" strokeWidth={1.6} />
    </>}
    {carrying && <g transform="translate(6 42) scale(0.42)"><CritterArt kind={carrying} shadow={false} /></g>}
    {/* Head: messy bun and scrunchie, big eyes, hoops */}
    <ellipse cx={31} cy={21} rx={9} ry={10.5} fill={SKIN} stroke={INK} strokeWidth={2} />
    <path d="M22 20 q-1 -12 9 -12 q10 0 10 11 q-3 -6 -10 -6 q-6 0 -9 7 z" fill="#e8c35a" stroke={INK} strokeWidth={1.3} />
    <circle cx={27} cy={6} r={5.5} fill="#e8c35a" stroke={INK} strokeWidth={1.3} />
    <path d="M24 9 q3 2 6 0" stroke="#ec4899" strokeWidth={2.5} fill="none" />
    <path d="M22 4 l-3 -3 M31 2 l2 -3" stroke="#c9a23f" strokeWidth={1} />
    <circle cx={23} cy={27} r={2.4} fill="none" stroke="#fbbf24" strokeWidth={1.1} />
    <g className={styles.trevEyes}>
      <circle cx={30} cy={19} r={4.6} fill="#fff" stroke={INK} strokeWidth={1.3} />
      <circle cx={39} cy={19} r={4.6} fill="#fff" stroke={INK} strokeWidth={1.3} />
      <circle cx={31.5} cy={19} r={1.4} fill={INK} /><circle cx={40.5} cy={19} r={1.4} fill={INK} />
      <path d="M27 13 l2 1 M37 13 l2 1" stroke={INK} strokeWidth={1} />
    </g>
    {pose === "cuffed" && <g transform="rotate(15 33 12)"><rect x={28} y={11} width={11} height={4} rx={2} fill="#f5d0a9" stroke={INK} strokeWidth={0.8} /><path d="M32 12 v2 M35 12 v2" stroke="#c9a27a" strokeWidth={0.8} /></g>}
    <path d={running ? "M31 27 q4 4 8 0 z" : "M32 28 q3 2 6 -1"} fill={running ? "#fff" : "none"} stroke={INK} strokeWidth={1.3} />
    {pose === "zapped" && <g className={styles.zapBolt} stroke="#fde047" strokeWidth={2} fill="none" strokeLinejoin="round">
      <path d="M8 18 l6 3 l-4 3 l7 3" /><path d="M52 16 l-6 3 l4 3 l-7 3" /><path d="M10 50 l6 2 l-4 3 l6 3" /><path d="M50 52 l-6 2 l4 3 l-6 3" />
      <path d="M24 4 l1 -6 M31 2 v-7 M38 4 l2 -6" stroke="#6b4a2b" strokeWidth={2} />
    </g>}
  </svg>;
}
