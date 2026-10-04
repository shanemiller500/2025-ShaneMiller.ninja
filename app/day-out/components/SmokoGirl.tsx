import styles from "../day-out.module.css";

// One of the dancers from Sandy Bottoms on a smoko out the back: big teased hair, full face of
// makeup (eyeshadow, lashes, red lips), sparkly two-piece stage outfit, platform heels, a durry on
// the go. Drawn like the street's commuters. Faces right; viewBox 40×100, feet on y=98.
const INK = "#111";
const LOOKS = [
  { skin: "#f1c7a3", hair: "#fef3c7", outfit: "#db2777", heels: "#f8fafc", shadow: "#3b82f6" },
  { skin: "#c68642", hair: "#7f1d1d", outfit: "#7c3aed", heels: "#111", shadow: "#a855f7" },
] as const;

export default function SmokoGirl({ look = 0 }: { look?: number }) {
  const L = LOOKS[look % LOOKS.length];
  return <svg viewBox="0 0 40 100" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Legs and platform heels */}
    <path d="M17 64 L16 91 M24 64 L25 91" stroke={INK} strokeWidth={5.5} strokeLinecap="round" />
    <path d="M17 64 L16 91 M24 64 L25 91" stroke={L.skin} strokeWidth={3.8} strokeLinecap="round" />
    <path d="M12 96 l4 -6 h3 v6 z M23 96 l2 -6 h3 l2 6 z" fill={L.heels} stroke={INK} strokeWidth={1} />
    <path d="M13.5 96 h5 M24 96 h5" stroke={INK} strokeWidth={2} />
    {/* Body, then the sparkly two-piece */}
    <path d="M13 34 q8 -5 15 0 q2 14 1 32 h-17 q-1 -18 1 -32 z" fill={L.skin} stroke={INK} strokeWidth={1.4} />
    <path d="M13 39 q4 -2 7 1 q3 -3 8 -1 l-0.5 6 h-14 z" fill={L.outfit} stroke={INK} strokeWidth={1} />
    <path d="M12 58 h17 l-1 7 q-7 2 -15 0 z" fill={L.outfit} stroke={INK} strokeWidth={1} />
    {[[16, 42], [24, 41], [15, 61], [21, 62], [26, 60]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.9} fill="#fef9c3" className={styles.sparkle} style={{ animationDelay: `${-i * 0.3}s` }} />)}
    <path d="M14 66 l-1 8 M27 66 l1 8" stroke={L.outfit} strokeWidth={1} opacity={0.6} />
    {/* Arm folded under, the other bringing the durry up for a drag */}
    <path d="M13 38 Q16 50 24 50" stroke={L.skin} strokeWidth={4} fill="none" strokeLinecap="round" />
    <g className={styles.cigDrag} style={{ transformOrigin: "27px 37px" }}>
      <path d="M27 37 L32 32 L29 27" stroke={L.skin} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M29 27 l5 -3" stroke="#f8fafc" strokeWidth={1.6} strokeLinecap="round" /><circle cx={34.2} cy={23.8} r={0.9} fill="#f97316" />
    </g>
    {[0, 1, 2].map(i => <circle key={i} cx={35} cy={21} r={2.4 + i} fill="#e5e7eb" opacity={0.7} className={styles.smokePuff} style={{ animationDelay: `${-i * 0.9}s` }} />)}
    {/* Big hair, made-up face, hoop earring */}
    <path d="M9 24 q-4 -18 12 -18 q14 0 11 16 q4 10 -2 16 q-1 -10 -4 -14 q-8 4 -13 2 q-2 6 -1 12 q-6 -6 -3 -14 z" fill={L.hair} stroke={INK} strokeWidth={1.1} />
    <circle cx={21} cy={22} r={8} fill={L.skin} stroke={INK} strokeWidth={1.5} />
    <path d="M22 17 q2.5 -2 5 0" stroke={L.shadow} strokeWidth={2.2} fill="none" />
    <circle cx={24.5} cy={19.5} r={1.1} fill={INK} /><path d="M22.5 17.6 l-1.4 -1.6 M24 17 l-0.6 -2 M25.6 17.2 l0.4 -2" stroke={INK} strokeWidth={0.7} />
    <circle cx={25} cy={24} r={1.8} fill="#fda4af" opacity={0.8} />
    <path d="M22 27 q2.4 1.6 4.6 0 q-2.3 -1 -4.6 0 z" fill="#dc2626" stroke="#991b1b" strokeWidth={0.5} />
    <path d="M13 22 q0 -12 9 -12 q-6 4 -5 12 z" fill={L.hair} />
    <circle cx={13.6} cy={26.5} r={2} fill="none" stroke="#fde047" strokeWidth={0.9} />
  </svg>;
}
