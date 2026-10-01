import styles from "../day-out.module.css";

// A dingo: ginger coat, white socks and chest, pointy ears, curled tail. `snags` = a string of
// sausages hanging out of its mouth. Faces right; viewBox 70×46, paws on y=46.
const INK = "#111", GINGER = "#d58a3a", CREAM = "#f6e7cf";

export default function Dingo({ running = false, snags = false }: { running?: boolean; snags?: boolean }) {
  const leg = (d: string) => <><path d={d} stroke={INK} strokeWidth={4.5} strokeLinecap="round" /><path d={d} stroke={GINGER} strokeWidth={3} strokeLinecap="round" /></>;
  return <svg viewBox="0 0 70 46" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M10 20 q-10 -4 -8 -14 q4 6 10 8" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
    <path d="M10 20 q-10 -4 -8 -14 q4 6 10 8" stroke={GINGER} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    <g className={running ? styles.pigLegs : undefined}>{leg("M16 30 L14 44")}{leg("M46 30 L48 44")}</g>
    <g className={running ? styles.pigLegs : undefined} style={{ animationDelay: "-.09s" }}>{leg("M22 30 L24 44")}{leg("M40 30 L38 44")}</g>
    <path d="M12 43 h5 M21 43 h5 M35 43 h5 M45 43 h5" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
    <ellipse cx={30} cy={24} rx={21} ry={9} fill={GINGER} stroke={INK} strokeWidth={1.6} />
    <ellipse cx={42} cy={28} rx={8} ry={5} fill={CREAM} />
    <path d="M46 20 q8 -8 14 -2 l6 6 q-2 4 -8 4 q-8 0 -12 -4 z" fill={GINGER} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
    <path d="M50 14 l2 -9 l5 8 M56 13 l5 -8 l1 9" fill={GINGER} stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
    <path d="M58 26 q4 1 8 -1" fill={CREAM} stroke={INK} strokeWidth={1} />
    <circle cx={66} cy={23} r={1.6} fill={INK} />
    <circle cx={56} cy={18} r={1.3} fill={INK} />
    {snags && <path d="M64 27 q2 8 -6 10 q-6 2 -10 8 q-4 4 -10 2" stroke="#9a3412" strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray="7 2" />}
  </svg>;
}
