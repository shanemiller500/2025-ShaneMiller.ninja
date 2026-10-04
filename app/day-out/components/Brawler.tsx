import styles from "../day-out.module.css";

// A club member on foot, fists up (or swinging something silly), facing right.
// The punching arm animates via CSS; the parent flips blues to face left. viewBox 50×80.
const INK = "#111", SKIN = "#f1c27d";
const BEARDS = ["#6d4c2f", "#999", "#3a2a1f", "#d9c7a8"];

// `colour` overrides the club colour (the bike shops' crews: Harley orange, Indian red).
export default function Brawler({ gang, seed, weapon, colour }: { gang: "red" | "blue"; seed: number; weapon?: string; colour?: string }) {
  const club = colour ?? (gang === "red" ? "#c0392b" : "#1f5fbf"), beard = BEARDS[seed % BEARDS.length];
  return <svg viewBox="0 0 50 80" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Legs in a fighting stance, boots */}
    <path d="M20 54 L14 76 M28 54 L34 76" stroke={INK} strokeWidth={8} strokeLinecap="round" />
    <path d="M20 54 L14 76 M28 54 L34 76" stroke="#2f4a78" strokeWidth={5} strokeLinecap="round" />
    <path d="M10 77 h8 M31 77 h8" stroke={INK} strokeWidth={4} strokeLinecap="round" />
    {/* Back arm (guarding) */}
    <path d="M18 32 L26 40 L32 34" stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 32 L26 40 L32 34" stroke={SKIN} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    {/* Body: club-colour shirt under a black vest */}
    <ellipse cx={24} cy={40} rx={12} ry={16} fill={club} stroke={INK} strokeWidth={2.5} />
    <path d="M13 34 C 11 46, 14 54, 22 56 L 22 26 C 17 27, 14 30, 13 34 Z" fill="#1d1d1d" stroke={INK} strokeWidth={2} />
    {/* Head: bandana, beard, cranky eyes */}
    <circle cx={27} cy={16} r={9} fill={SKIN} stroke={INK} strokeWidth={2.5} />
    <path d="M18 14 q9 -12 18 0 z" fill={club} stroke={INK} strokeWidth={1.5} />
    <path d="M21 19 q5 13 14 3" fill={beard} stroke={INK} strokeWidth={1.5} />
    <path d="M28 14 l4 1.5" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
    <circle cx={31} cy={17} r={1.2} fill={INK} />
    {/* Punching arm (animated), with whatever they grabbed */}
    <g className={styles.punchArm} style={{ animationDelay: `${(seed % 5) * 0.11}s` }}>
      <path d="M26 30 L38 30 L46 26" stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 30 L38 30 L46 26" stroke={SKIN} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={46} cy={26} r={4} fill={SKIN} stroke={INK} strokeWidth={2} />
      {weapon && <text x={48} y={22} fontSize={18} className={styles.weaponSwing}>{weapon}</text>}
    </g>
  </svg>;
}
