import styles from "../day-out.module.css";

// A bundle of three sticks of dynamite, taped together, with a fizzing fuse. viewBox 50×50.
const INK = "#111";

export default function Dynamite() {
  return <svg viewBox="0 0 50 50" width="100%" height="100%" aria-hidden overflow="visible">
    {[8, 20, 32].map(x => <g key={x}>
      <rect x={x} y={20} width={11} height={28} rx={3} fill="#d62828" stroke={INK} strokeWidth={2} />
      <path d={`M${x + 3} 24 v20`} stroke="#ff6b6b" strokeWidth={2} strokeLinecap="round" />
    </g>)}
    <rect x={6} y={30} width={39} height={6} fill="#c9b27c" stroke={INK} strokeWidth={1.5} />
    <path d="M26 20 C 26 10, 34 8, 38 2" stroke="#3a2a1a" strokeWidth={2.2} fill="none" strokeLinecap="round" />
    <g className={styles.fuseSpark}>
      <circle cx={38} cy={2} r={4} fill="#ffd23f" />
      <path d="M38 -6 v5 M44 -2 l-4 3 M32 -3 l4 3 M44 6 l-4 -2" stroke="#ff8a3d" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  </svg>;
}
