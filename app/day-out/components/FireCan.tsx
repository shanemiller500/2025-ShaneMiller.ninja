import styles from "../day-out.module.css";

// A rusty paint tin with a fire going in it, for cooking roadkill on sticks. viewBox 40×50.
const INK = "#111";

export default function FireCan({ lit = true }: { lit?: boolean }) {
  return <svg viewBox="0 0 40 50" width="100%" height="100%" aria-hidden overflow="visible">
    {lit && <g className={styles.flames}>
      <path d="M8 22 C 4 12, 12 6, 10 -4 C 16 4, 18 -6, 22 -14 C 24 -2, 32 0, 30 -8 C 36 4, 38 14, 32 22 Z" fill="#ff5a1f" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M12 22 C 10 14, 16 10, 15 2 C 19 8, 21 0, 23 -6 C 25 4, 30 6, 28 22 Z" fill="#ffb020" />
      <path d="M16 22 C 16 16, 19 12, 20 8 C 22 12, 25 14, 24 22 Z" fill="#fff3a0" />
    </g>}
    <path d="M5 20 h30 l-2 28 h-26 z" fill="#8b5a2b" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    <path d="M5 20 h30" stroke="#5a3a1a" strokeWidth={4} />
    <path d="M9 30 q3 4 1 8 M26 26 q4 3 2 9 M18 40 q3 2 6 1" stroke="#b5733a" strokeWidth={2} fill="none" opacity={0.8} />
    <circle cx={12} cy={34} r={1.5} fill="#3a2410" /><circle cx={28} cy={42} r={1.2} fill="#3a2410" />
  </svg>;
}
