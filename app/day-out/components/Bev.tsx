import styles from "../day-out.module.css";

// Bev from the caravan park: floral dress, rollers in her hair, thongs, and a set of lungs on her.
// "shout" has her arms up screaming; "run" is legging it. Faces right; viewBox 60×110, feet on y=108.
const INK = "#111", SKIN = "#f1c7a3";

export default function Bev({ pose = "shout" }: { pose?: "shout" | "run" }) {
  const run = pose === "run";
  const arms = run ? "M20 42 L10 30 M40 42 L52 30" : "M20 42 L10 16 M40 42 L50 16";
  return <svg viewBox="0 0 60 110" width="100%" height="100%" aria-hidden overflow="visible">
    <g className={run ? styles.bludgerLegs : undefined}>
      <path d="M25 84 L22 104 M35 84 L38 104" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <path d="M25 84 L22 104 M35 84 L38 104" stroke={SKIN} strokeWidth={4} strokeLinecap="round" />
      <path d="M15 107 h10 M33 107 h10" stroke="#06b6d4" strokeWidth={3.5} strokeLinecap="round" />
    </g>
    {/* Floral dress */}
    <path d="M19 34 q11 -6 22 0 l8 52 h-38 z" fill="#f472b6" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    {[[24, 50], [34, 58], [28, 70], [40, 74], [20, 78], [36, 44]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r={2.6} fill="#fde047" /><circle cx={x} cy={y} r={1} fill="#f97316" /></g>)}
    <path d={arms} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
    <path d={arms} stroke={SKIN} strokeWidth={4} fill="none" strokeLinecap="round" />
    {/* Head, rollers, the scream */}
    <circle cx={30} cy={20} r={10} fill={SKIN} stroke={INK} strokeWidth={2} />
    <path d="M20 18 q2 -12 10 -12 q9 0 10 12" fill="#b45309" stroke={INK} strokeWidth={1.4} />
    {[[22, 9], [28, 5], [34, 5], [39, 10]].map(([x, y], i) => <rect key={i} x={x - 3} y={y - 3} width={6} height={6} rx={2} fill="#93c5fd" stroke={INK} strokeWidth={1} />)}
    <circle cx={27} cy={19} r={1.5} fill={INK} /><circle cx={34} cy={19} r={1.5} fill={INK} />
    <ellipse cx={31} cy={26} rx={3.2} ry={4} fill="#7f1d1d" stroke={INK} strokeWidth={1.2} />
  </svg>;
}
