import styles from "../day-out.module.css";

// True Blue: old bushie with a battered akubra, specs, a beard down to his belly, navy singlet,
// sunburnt arms and a VB that never leaves his hand. Faces right; viewBox 60×110, feet at y=108.
export type TrueBluePose = "walk" | "stand" | "drink" | "pet" | "catch" | "kiss" | "toss";
const INK = "#111", SKIN = "#dc9a7c", BEARD = "#f1f5f9";

// Front arm path for each pose, and where the hand ends up (for the can).
const ARMS: Record<TrueBluePose, { d: string; hand: [number, number]; tilt: number }> = {
  walk: { d: "M38 40 L43 58", hand: [43, 58], tilt: 0 },
  stand: { d: "M38 40 L43 58", hand: [43, 58], tilt: 0 },
  drink: { d: "M38 40 L47 32 L40 24", hand: [40, 22], tilt: -35 },
  pet: { d: "M38 40 L52 56 L60 66", hand: [60, 66], tilt: 0 },
  catch: { d: "M38 40 L46 22 L50 6", hand: [50, 6], tilt: 0 },
  kiss: { d: "M38 40 L47 32 L42 26", hand: [42, 26], tilt: 0 },
  toss: { d: "M38 40 L52 26 L62 16", hand: [62, 16], tilt: 0 },
};

export default function TrueBlue({ pose = "walk" }: { pose?: TrueBluePose }) {
  const arm = ARMS[pose], walking = pose === "walk", holdsCan = pose === "walk" || pose === "stand" || pose === "drink";
  return <svg viewBox="0 0 60 110" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Skinny sunburnt legs, navy shorts, old work boots */}
    <g className={walking ? styles.bludgerLegs : undefined}>
      <path d="M24 74 L21 102 M33 74 L36 102" stroke={INK} strokeWidth={6.5} strokeLinecap="round" />
      <path d="M24 74 L21 102 M33 74 L36 102" stroke={SKIN} strokeWidth={4.3} strokeLinecap="round" />
      <path d="M14 106 h11 l1 -5 h-10 z M32 106 h11 l1 -5 h-10 z" fill="#5b3a1e" stroke={INK} strokeWidth={1.2} />
    </g>
    <path d="M18 62 h24 l2 14 h-13 l-1 -4 l-1 4 h-13 z" fill="#1e3a8a" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
    {/* Navy singlet */}
    <path d="M19 34 q11 -6 22 0 l2 30 h-26 z" fill="#334155" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M23 34 v-4 M37 34 v-4" stroke="#334155" strokeWidth={2.5} />
    {/* Back arm */}
    <path d="M22 40 L17 58" stroke={INK} strokeWidth={6} strokeLinecap="round" />
    <path d="M22 40 L17 58" stroke={SKIN} strokeWidth={4} strokeLinecap="round" />
    {/* Head: face, glasses */}
    <circle cx={31} cy={20} r={9} fill="#e8a98a" stroke={INK} strokeWidth={1.8} />
    <circle cx={29} cy={19} r={3} fill="#fef3c7" fillOpacity={0.4} stroke={INK} strokeWidth={1} />
    <circle cx={36} cy={19} r={3} fill="#fef3c7" fillOpacity={0.4} stroke={INK} strokeWidth={1} />
    <path d="M32 19 h1" stroke={INK} strokeWidth={1} />
    <circle cx={30} cy={24} r={2} fill="#f87171" opacity={0.5} />
    {/* The beard, down to his belly */}
    <path d="M22 22 q2 6 1 12 q3 14 9 24 q6 -10 8 -24 q-1 -6 1 -12 q-4 6 -10 6 q-6 0 -9 -6 z" fill={BEARD} stroke="#9ca3af" strokeWidth={1.2} />
    <path d="M27 32 q2 10 4 18 M33 32 q0 10 1 16" stroke="#cbd5e1" strokeWidth={1} fill="none" />
    {/* Battered akubra */}
    <path d="M12 14 q19 -6 38 0 q-4 3 -8 2 l-2 -10 q-9 -5 -18 0 l-2 10 q-4 1 -8 -2 z" fill="#6b4423" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
    <path d="M21 13 h19" stroke="#3b2414" strokeWidth={2} />
    {/* Front arm and his VB */}
    <path d={arm.d} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d={arm.d} stroke={SKIN} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    {holdsCan && <g transform={`rotate(${arm.tilt} ${arm.hand[0]} ${arm.hand[1]})`}>
      <rect x={arm.hand[0] - 4} y={arm.hand[1] - 7} width={8} height={13} rx={1.6} fill="#0b6b3a" stroke={INK} strokeWidth={1} />
      <rect x={arm.hand[0] - 4} y={arm.hand[1] - 2} width={8} height={4} fill="#d4af37" />
      <path d={`M${arm.hand[0] - 3} ${arm.hand[1] + 3} h6`} stroke="#c1121f" strokeWidth={1.2} />
    </g>}
  </svg>;
}

// A pelican gliding in, wings going, sometimes with a fish in the bill. Faces right; viewBox 90×50.
export function Pelican({ fish = false }: { fish?: boolean }) {
  return <svg viewBox="0 0 90 50" width="100%" height="100%" aria-hidden overflow="visible">
    <g className={styles.pelicanWing}>
      <path d="M30 22 Q20 -4 2 6 Q14 10 16 18 Q24 16 30 26 Z" fill="#f8fafc" stroke={INK} strokeWidth={1.2} />
      <path d="M2 6 Q8 8 10 12 L4 12 Z" fill="#111" />
    </g>
    <ellipse cx={34} cy={28} rx={18} ry={9} fill="#f8fafc" stroke={INK} strokeWidth={1.4} />
    <path d="M16 28 L4 24 L8 32 Z" fill="#e5e7eb" stroke={INK} strokeWidth={1} />
    <g className={styles.pelicanWing} style={{ animationDelay: "-.15s" }}>
      <path d="M36 22 Q50 -6 70 4 Q56 8 52 16 Q44 14 36 26 Z" fill="#f1f5f9" stroke={INK} strokeWidth={1.2} />
    </g>
    <circle cx={54} cy={20} r={6} fill="#f8fafc" stroke={INK} strokeWidth={1.3} />
    <circle cx={56} cy={18.5} r={1.2} fill={INK} />
    {/* The bill and pouch */}
    <path d="M59 19 L88 22 L60 24 Z" fill="#fb923c" stroke={INK} strokeWidth={1} />
    <path d="M60 24 Q74 34 86 23" fill="#fdba74" stroke={INK} strokeWidth={1} />
    {fish && <text x={72} y={34} fontSize={11} textAnchor="middle">🐟</text>}
  </svg>;
}
