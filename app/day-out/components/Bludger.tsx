import styles from "../day-out.module.css";

// Dazza the bludger: mullet, stubble, a durry tucked behind his ear, Bonds singlet, stubbies
// and thongs. Faces right. "ask" has his hand out; "run" is arms up, legging it.
// viewBox 60×100, feet at y=98.
const INK = "#111", SKIN = "#e8b98a";

export default function Bludger({ pose = "ask" }: { pose?: "ask" | "walk" | "run" }) {
  const running = pose === "run";
  return <svg viewBox="0 0 60 100" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Legs, stubbies, thongs */}
    <g className={pose === "ask" ? undefined : styles.bludgerLegs}>
      <path d="M24 66 L20 94 M34 66 L38 94" stroke={INK} strokeWidth={8} strokeLinecap="round" />
      <path d="M24 66 L20 94 M34 66 L38 94" stroke={SKIN} strokeWidth={5} strokeLinecap="round" />
      <path d="M14 97 h10 M34 97 h10" stroke="#1f5fbf" strokeWidth={3.5} strokeLinecap="round" />
    </g>
    <path d="M19 56 h22 l2 14 h-12 l-1 -5 l-1 5 h-12 z" fill="#1e3a5f" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    {/* Bonds singlet, a bit grubby */}
    <path d="M20 32 q10 -6 20 0 l2 26 h-24 z" fill="#f4f1e8" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    <circle cx={27} cy={47} r={2.5} fill="#c9b99a" opacity={0.7} />
    {/* Arms */}
    {running
      ? <path d="M22 36 L12 20 M38 36 L48 20" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      : <path d="M22 36 L16 54 M38 36 L50 44 L56 42" stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    {running
      ? <path d="M22 36 L12 20 M38 36 L48 20" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" />
      : <path d="M22 36 L16 54 M38 36 L50 44 L56 42" stroke={SKIN} strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    {!running && <path d="M53 40 q4 -1 5 2" stroke={INK} strokeWidth={1.5} fill="none" />}
    {/* Head: mullet (business at the front, party at the back), stubble, durry behind the ear */}
    <path d="M22 14 q-6 10 -2 20 q4 -2 5 -8 z" fill="#8a5a2b" stroke={INK} strokeWidth={1.5} />
    <circle cx={31} cy={18} r={10} fill={SKIN} stroke={INK} strokeWidth={2} />
    <path d="M21 16 q2 -10 12 -9 q7 1 8 7 q-8 -3 -20 2 z" fill="#8a5a2b" stroke={INK} strokeWidth={1.5} />
    <path d="M26 24 q5 4 10 0" stroke="#8a7a6a" strokeWidth={3} opacity={0.5} fill="none" />
    <circle cx={35} cy={16} r={1.3} fill={INK} />
    <path d={running ? "M32 23 q3 4 6 0 z" : "M32 23 q3 2 5 0"} fill={running ? "#fff" : "none"} stroke={INK} strokeWidth={1.4} />
    <line x1={22} y1={14} x2={30} y2={10} stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
    <line x1={22} y1={14} x2={23.5} y2={13.3} stroke="#ff8a3d" strokeWidth={2.2} strokeLinecap="round" />
  </svg>;
}
