import styles from "../day-out.module.css";

// A bloke walking his blue heeler on a lead round the park. The dog's out front; when it stops it
// either cocks a leg on something (the owner looks at the sky and whistles) or squats for a poo
// (the owner checks nobody's looking). Faces right; viewBox 130×100, feet on y=98.
const INK = "#111", SKIN = "#e0ac69", HEELER = "#4a6fa5", TAN = "#d6a35c";

export default function DogWalker({ pose = "walk" }: { pose?: "walk" | "pee" | "poop" | "stand" }) {
  const walking = pose === "walk", squat = pose === "poop", pee = pose === "pee";
  return <svg viewBox="0 0 130 100" width="100%" height="100%" aria-hidden overflow="visible">
    {/* The owner: thongs, footy shorts, singlet, cap, lead in hand */}
    <g className={walking ? styles.bludgerLegs : undefined}>
      <path d="M22 66 L20 96 M30 66 L32 96" stroke={SKIN} strokeWidth={5} strokeLinecap="round" />
    </g>
    <path d="M15 97 h9 M28 97 h9" stroke="#2563eb" strokeWidth={3} strokeLinecap="round" />
    <path d="M17 58 h18 l2 12 h-22 z" fill="#1e3a8a" stroke={INK} strokeWidth={1.3} />
    <path d="M17 34 q9 -6 18 0 l2 26 h-22 z" fill="#f8fafc" stroke={INK} strokeWidth={1.5} />
    <path d="M18 36 L14 58" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" />
    <path d="M34 38 L42 50" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" />
    <circle cx={26} cy={23} r={8.5} fill={SKIN} stroke={INK} strokeWidth={1.5} />
    <path d="M17 21 q9 -12 18 -1 l6 1 h-24 z" fill="#dc2626" stroke={INK} strokeWidth={1.2} />
    {pee
      ? <><circle cx={29} cy={20} r={1} fill={INK} /><circle cx={24} cy={20} r={1} fill={INK} /><circle cx={27} cy={27} r={1.6} fill={INK} /><text x={36} y={10} fontSize={9} fill={INK}>♪</text></>
      : squat
        ? <><circle cx={22} cy={22} r={1.1} fill={INK} /><circle cx={27} cy={22} r={1.1} fill={INK} /><path d="M22 28 h6" stroke={INK} strokeWidth={1.1} /></>
        : <><circle cx={29} cy={22} r={1.1} fill={INK} /><path d="M27 27 q3 2 6 0" stroke={INK} strokeWidth={1.1} fill="none" /></>}
    {/* The lead */}
    <path d={squat ? "M42 50 Q64 72 90 72" : "M42 50 Q66 62 92 64"} stroke="#dc2626" strokeWidth={1.6} fill="none" />
    {/* The dog: a blue heeler with tan legs and a cheeky face */}
    <g transform={squat ? "translate(0 5) rotate(-8 100 74)" : undefined}>
      <g className={styles.tailWag} style={{ transformOrigin: "82px 70px" }}><path d="M83 70 Q74 62 72 56" stroke={HEELER} strokeWidth={4} fill="none" strokeLinecap="round" /></g>
      <g className={walking ? styles.bludgerLegs : undefined}>
        <path d={pee ? "M86 78 L74 70" : squat ? "M86 78 L82 86 L88 92" : "M86 78 L84 96"} stroke={TAN} strokeWidth={4} strokeLinecap="round" fill="none" />
        <path d="M112 78 L114 96" stroke={TAN} strokeWidth={4} strokeLinecap="round" />
      </g>
      <path d={squat ? "M92 78 L90 88 L96 92" : "M92 78 L92 96"} stroke={TAN} strokeWidth={4} strokeLinecap="round" fill="none" />
      <path d="M106 78 L106 96" stroke={TAN} strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={99} cy={72} rx={18} ry={9} fill={HEELER} stroke={INK} strokeWidth={1.4} />
      <path d="M90 68 q6 -3 12 1" stroke="#7d9cc9" strokeWidth={2} fill="none" />
      <circle cx={92} cy={64} r={1} fill="#dc2626" />
      <ellipse cx={118} cy={64} rx={8} ry={7} fill={HEELER} stroke={INK} strokeWidth={1.3} />
      <path d="M113 59 L112 49 L118 57 M120 57 L123 48 L124 59" fill={HEELER} stroke={INK} strokeWidth={1.1} />
      <path d="M122 64 h7 q2 3 -1 5 h-6 z" fill={TAN} stroke={INK} strokeWidth={1} />
      <circle cx={128.5} cy={64.5} r={1.4} fill={INK} />
      <circle cx={119} cy={62} r={1.2} fill={INK} />
      {pee && <path d="M127 70 q2 4 0 7" fill="#f472b6" />}
    </g>
    {pee && <path className={styles.peeStream} d="M80 76 Q74 84 72 98" stroke="#fde047" strokeWidth={2} fill="none" strokeDasharray="3 3" />}
  </svg>;
}
