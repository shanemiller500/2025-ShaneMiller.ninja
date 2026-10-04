import styles from "../day-out.module.css";

// A big Aussie cockroach, top-down-ish side view: glossy brown shell, six scuttling legs, long
// twitchy antennae. `squashed` flattens it into a smear. Faces right; viewBox 32×16.
const INK = "#111";

export default function Roach({ squashed = false }: { squashed?: boolean }) {
  if (squashed) return <svg viewBox="0 0 32 16" width="100%" height="100%" aria-hidden overflow="visible">
    <ellipse cx={16} cy={12} rx={14} ry={3.5} fill="#5b3a1e" opacity={0.85} />
    <path d="M4 12 l-3 -2 M8 13 l-2 3 M24 13 l2 3 M28 12 l3 -2" stroke="#3b2414" strokeWidth={1.2} />
  </svg>;
  return <svg viewBox="0 0 32 16" width="100%" height="100%" aria-hidden overflow="visible">
    <g className={styles.roachLegs}>
      <path d="M10 10 l-4 5 M15 11 l-1 5 M20 10 l3 5" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />
    </g>
    <g className={styles.roachLegs} style={{ animationDelay: "-.06s" }}>
      <path d="M12 10 l-5 4 M17 11 l1 5 M22 10 l5 4" stroke="#2b1a0e" strokeWidth={1.1} strokeLinecap="round" />
    </g>
    <ellipse cx={15} cy={8} rx={11} ry={4.5} fill="#7a4a24" stroke={INK} strokeWidth={1.1} />
    <path d="M6 8 q9 -5 18 0" stroke="#a8693a" strokeWidth={1.4} fill="none" />
    <path d="M15 4 v8" stroke="#4a2c14" strokeWidth={0.8} />
    <ellipse cx={26} cy={8} rx={3.4} ry={2.8} fill="#4a2c14" stroke={INK} strokeWidth={1} />
    <g className={styles.roachFeelers}>
      <path d="M28 7 q6 -6 4 -7 M28 9 q7 -1 4 -5" stroke="#3b2414" strokeWidth={0.8} fill="none" />
    </g>
  </svg>;
}
