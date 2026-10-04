import styles from "../day-out.module.css";

// The seagull chip heist at the beach.
const INK = "#111";

// A silver gull: white body, grey wings with black tips, red beak and legs. Faces right; viewBox
// 40×30. `flying` tucks the legs and flaps; `carrying` has it making off with a parcel of chips.
export function Seagull({ flying = false, carrying = false }: { flying?: boolean; carrying?: boolean }) {
  return <svg viewBox="0 0 40 30" width="100%" height="100%" aria-hidden overflow="visible">
    {!flying && <path d="M16 22 L15 29 M21 22 L22 29 M13 29 h4 M20 29 h4" stroke="#dc2626" strokeWidth={1.6} strokeLinecap="round" />}
    <path d="M6 15 L0 12 L1 18 Z" fill="#111" />
    <ellipse cx={18} cy={16} rx={11} ry={7} fill="#f8fafc" stroke={INK} strokeWidth={1.2} />
    {flying
      ? <g className={styles.gullFlap} style={{ transformOrigin: "18px 13px" }}>
        <path d="M12 13 Q16 -4 30 -6 Q24 4 22 13 Z" fill="#9ca3af" stroke={INK} strokeWidth={1} />
        <path d="M26 -5 L30 -6 L27 1 Z" fill="#111" />
      </g>
      : <path d="M8 13 Q18 7 28 14 Q18 18 8 13 Z" fill="#9ca3af" stroke={INK} strokeWidth={1} />}
    {!flying && <path d="M7 13 L4 15 L8 16 Z" fill="#111" />}
    <circle cx={29} cy={10} r={5} fill="#f8fafc" stroke={INK} strokeWidth={1.1} />
    <circle cx={30.5} cy={9} r={1} fill={INK} />
    <path d="M33 10 L40 11.5 L33 13 Z" fill="#ef4444" stroke={INK} strokeWidth={0.6} />
    {carrying && <g transform="translate(38 11) rotate(20)">
      <rect x={-2} y={0} width={11} height={8} rx={1.5} fill="#f8fafc" stroke={INK} strokeWidth={0.8} />
      <path d="M0 0 l1 -5 M3 0 l0 -6 M6 0 l1 -5" stroke="#facc15" strokeWidth={1.6} strokeLinecap="round" />
    </g>}
  </svg>;
}

// The bloke who brought fish and chips to the beach. Faces right; viewBox 40×100, feet on y=98.
// "walk": strolling down with the parcel; "eat": sat on the sand tucking in; "shoo": waving his
// arms at the gulls; "robbed": sat there with nothing, mouth open.
export function ChipEater({ pose = "walk" }: { pose?: "walk" | "eat" | "shoo" | "robbed" }) {
  const SKIN = "#f1c7a3", SHIRT = "#f97316", SHORTS = "#1e3a8a";
  const head = <>
    <circle cx={21} cy={pose === "walk" ? 22 : 50} r={8.5} fill={SKIN} stroke={INK} strokeWidth={1.6} />
    <path d={pose === "walk" ? "M12 20 q2 -11 11 -10 q7 1 7 8 q-6 -4 -18 2 z" : "M12 48 q2 -11 11 -10 q7 1 7 8 q-6 -4 -18 2 z"} fill="#7c2d12" stroke={INK} strokeWidth={1} />
    <circle cx={24} cy={pose === "walk" ? 21 : 49} r={1.1} fill={INK} />
    {pose === "robbed"
      ? <ellipse cx={24} cy={55} rx={2.4} ry={3} fill={INK} />
      : <path d={pose === "walk" ? "M22 26 q2.5 2 5 0" : "M22 54 q2.5 2 5 0"} stroke={INK} strokeWidth={1} fill="none" />}
  </>;
  const parcel = (x: number, y: number, open: boolean) => <g>
    <rect x={x} y={y} width={14} height={8} rx={1.5} fill="#f8fafc" stroke={INK} strokeWidth={0.9} />
    {open && <path d={`M${x + 2} ${y} l1 -6 M${x + 5} ${y} l0 -7 M${x + 8} ${y} l1 -6 M${x + 11} ${y} l0 -5`} stroke="#facc15" strokeWidth={1.8} strokeLinecap="round" />}
    {open && <ellipse cx={x + 7} cy={y - 2} rx={5} ry={2.2} fill="#d97706" stroke={INK} strokeWidth={0.6} />}
  </g>;
  if (pose === "walk") return <svg viewBox="0 0 40 100" width="100%" height="100%" aria-hidden overflow="visible">
    <g className={styles.bludgerLegs}><path d="M17 64 L15 95 M24 64 L26 95" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" /></g>
    <path d="M11 97 h7 M23 97 h7" stroke="#2563eb" strokeWidth={2.5} strokeLinecap="round" />
    <path d="M10 56 h21 l1 12 h-22 z" fill={SHORTS} stroke={INK} strokeWidth={1.2} />
    <path d="M11 34 q9 -6 18 0 l2 24 h-22 z" fill={SHIRT} stroke={INK} strokeWidth={1.5} />
    <path d="M28 38 L32 48" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" />
    {parcel(26, 46, false)}
    <path d="M12 38 L9 56" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" />
    {head}
  </svg>;
  // Sat on the sand: legs out in front, body upright.
  return <svg viewBox="0 0 40 100" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M14 92 H38" stroke={SKIN} strokeWidth={5} strokeLinecap="round" />
    <path d="M10 86 h16 v8 h-16 z" fill={SHORTS} stroke={INK} strokeWidth={1.2} />
    <path d="M11 62 q9 -6 18 0 l1 26 h-20 z" fill={SHIRT} stroke={INK} strokeWidth={1.5} />
    {pose === "eat" && <>{parcel(22, 80, true)}<path d="M28 68 L28 82" stroke={SKIN} strokeWidth={4} strokeLinecap="round" /><path d="M13 66 Q16 60 22 56" stroke={SKIN} strokeWidth={4} strokeLinecap="round" fill="none" /></>}
    {pose === "shoo" && <>{parcel(22, 80, true)}
      <g className={styles.flailArm} style={{ transformOrigin: "12px 66px" }}><path d="M12 66 L4 48" stroke={SKIN} strokeWidth={4} strokeLinecap="round" /></g>
      <g className={`${styles.flailArm} ${styles.flailArmOther}`} style={{ transformOrigin: "28px 66px" }}><path d="M28 66 L36 48" stroke={SKIN} strokeWidth={4} strokeLinecap="round" /></g></>}
    {pose === "robbed" && <path d="M12 66 L4 52 M28 66 L36 52" stroke={SKIN} strokeWidth={4} strokeLinecap="round" />}
    {head}
  </svg>;
}
