import styles from "../day-out.module.css";

// Beachgoers, drawn the same way as the street's commuters: a bloke in boardies, a woman in a
// bikini, a bloke in budgie smugglers, a woman in a one-piece, a bloke with a beer gut, a woman in
// a pink bikini. `kid` shrinks them into a little'un in a rashie. Faces right; viewBox 40×100, feet
// on y=98. `pose`: stand, walk (legs going), throw (arm swinging, for the frisbee), wave, sit.
const INK = "#111";
const LOOKS = [
  { skin: "#f1c7a3", hair: "#7c2d12", wear: "boardies", c: "#2563eb", long: false },
  { skin: "#e0ac69", hair: "#111", wear: "bikini", c: "#dc2626", long: true },
  { skin: "#f5d0b5", hair: "#a16207", wear: "budgies", c: "#facc15", long: false },
  { skin: "#8d5524", hair: "#111", wear: "onepiece", c: "#0d9488", long: true },
  { skin: "#c68642", hair: "#3f2a14", wear: "gut", c: "#16a34a", long: false },
  { skin: "#f9d5b8", hair: "#fde047", wear: "bikini", c: "#ec4899", long: true },
] as const;

export default function BeachGoer({ look = 0, pose = "stand", kid = false }: { look?: number; pose?: "stand" | "walk" | "throw" | "wave" | "sit"; kid?: boolean }) {
  const L = LOOKS[look % LOOKS.length], gut = L.wear === "gut" ? 5 : 0, sit = pose === "sit";
  return <svg viewBox="0 0 40 100" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Sitting: legs stretched out on the sand, the rest of them dropped down to sit on it */}
    {sit && <path d="M14 93 H37" stroke={INK} strokeWidth={6} strokeLinecap="round" />}
    {sit && <path d="M14 93 H37" stroke={L.skin} strokeWidth={4} strokeLinecap="round" />}
    <g transform={kid ? "translate(4 22) scale(0.78)" : sit ? "translate(0 30)" : undefined}>
      {!sit && <>
      <g className={pose === "walk" ? styles.bludgerLegs : undefined}>
        <path d="M17 64 L15 95 M24 64 L26 95" stroke={INK} strokeWidth={6} strokeLinecap="round" />
        <path d="M17 64 L15 95 M24 64 L26 95" stroke={L.skin} strokeWidth={4} strokeLinecap="round" />
      </g>
      <path d="M11 97 h7 M23 97 h7" stroke={kid ? "#f97316" : "#3f3f46"} strokeWidth={2.5} strokeLinecap="round" />
      </>}
      {/* Body (bare skin), then whatever they're wearing */}
      <path d={`M11 34 q9 -6 18 0 q${2 + gut} 14 2 30 h-22 q-2 -16 2 -30 z`} fill={L.skin} stroke={INK} strokeWidth={1.5} />
      {kid ? <path d="M11 34 q9 -6 18 0 l1 22 h-20 z" fill="#38bdf8" stroke={INK} strokeWidth={1.2} />
        : L.wear === "onepiece" ? <path d="M12 38 q8 -4 16 0 l1 26 h-18 z" fill={L.c} stroke={INK} strokeWidth={1.2} />
          : L.wear === "bikini" ? <><path d="M12 40 h7 v5 h-7 z M21 40 h7 v5 h-7 z" fill={L.c} stroke={INK} strokeWidth={0.8} /><path d="M11 56 h18 l-2 8 h-14 z" fill={L.c} stroke={INK} strokeWidth={1} /></>
            : null}
      {(L.wear === "boardies" || L.wear === "gut" || kid) && <path d="M10 56 h21 l1 14 h-9 l-2 -6 l-2 6 h-9 z" fill={kid ? "#f97316" : L.c} stroke={INK} strokeWidth={1.2} />}
      {L.wear === "boardies" && !kid && <path d="M12 60 l6 8 M26 58 l3 6" stroke="#f8fafc" strokeWidth={1.4} />}
      {L.wear === "budgies" && !kid && <path d="M11 57 h19 l-6 7 h-7 z" fill={L.c} stroke={INK} strokeWidth={1} />}
      {/* Arms: one down, one up throwing or waving */}
      <path d="M12 38 L9 56" stroke={L.skin} strokeWidth={4.5} strokeLinecap="round" />
      {pose === "throw"
        ? <g className={styles.throwArm} style={{ transformOrigin: "28px 38px" }}><path d="M28 38 L36 26" stroke={L.skin} strokeWidth={4.5} strokeLinecap="round" /></g>
        : pose === "wave"
          ? <g className={styles.flailArm} style={{ transformOrigin: "28px 38px" }}><path d="M28 38 L34 20" stroke={L.skin} strokeWidth={4.5} strokeLinecap="round" /></g>
          : <path d="M28 38 L31 56" stroke={L.skin} strokeWidth={4.5} strokeLinecap="round" />}
      {/* Head, shades or not, hair */}
      {L.long && <path d="M12 22 q-2 18 4 22 h10 q6 -4 4 -22 z" fill={L.hair} stroke={INK} strokeWidth={1} />}
      <circle cx={21} cy={22} r={8.5} fill={L.skin} stroke={INK} strokeWidth={1.6} />
      {look % 2 === 0 ? <rect x={20} y={18.5} width={9} height={3.4} rx={1.6} fill={INK} /> : <circle cx={24} cy={21} r={1.1} fill={INK} />}
      <path d="M22 26 q2.5 2 5 0" stroke={INK} strokeWidth={1} fill="none" />
      <path d={L.long ? "M12 22 q0 -14 10 -12 q9 0 8 10 q-5 -5 -10 -4 q-5 1 -8 6 z" : "M12 20 q2 -11 11 -10 q7 1 7 8 q-6 -4 -18 2 z"} fill={L.hair} stroke={INK} strokeWidth={1} />
    </g>
  </svg>;
}

// Someone stretched out on a towel, sunbaking. Head to the right; viewBox 100×30, towel on y=26.
export function Sunbaker({ look = 0, towel = "#38bdf8" }: { look?: number; towel?: string }) {
  const L = LOOKS[look % LOOKS.length];
  return <svg viewBox="0 0 100 30" width="100%" height="100%" aria-hidden overflow="visible">
    <rect x={2} y={20} width={90} height={8} rx={2} fill={towel} stroke={INK} strokeWidth={1.2} />
    <path d="M8 22 h6 M8 25 h6" stroke="#f8fafc" strokeWidth={1.4} />
    <path d="M10 18 H48" stroke={INK} strokeWidth={8} strokeLinecap="round" /><path d="M10 18 H48" stroke={L.skin} strokeWidth={6} strokeLinecap="round" />
    <path d="M44 14 q16 -4 30 0 q2 4 0 8 q-15 3 -30 0 z" fill={L.skin} stroke={INK} strokeWidth={1.3} />
    {L.wear === "bikini" || L.wear === "onepiece"
      ? <><path d="M44 15 h9 v7 h-9 z" fill={L.c} /><path d="M62 13 h5 v4 h-5 z M62 19 h5 v3 h-5 z" fill={L.c} /></>
      : <path d="M40 13 h13 v10 h-13 z" fill={L.c} stroke={INK} strokeWidth={0.8} />}
    <circle cx={82} cy={17} r={7} fill={L.skin} stroke={INK} strokeWidth={1.4} />
    <rect x={80} y={12} width={8} height={3} rx={1.5} fill={INK} />
    <path d={L.long ? "M84 10 q10 2 12 14" : "M78 11 q5 -4 10 0"} stroke={L.hair} strokeWidth={4} fill="none" strokeLinecap="round" />
  </svg>;
}
