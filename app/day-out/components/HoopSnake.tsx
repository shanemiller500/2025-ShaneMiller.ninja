// The legendary hoop snake: bites its own tail and rolls along like a wagon wheel.
// viewBox 60×60, centred; the parent spins it.
const INK = "#111";

export default function HoopSnake() {
  return <svg viewBox="-30 -30 60 60" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Body: a ring with banded scales */}
    <circle cx={0} cy={0} r={22} fill="none" stroke={INK} strokeWidth={10} />
    <circle cx={0} cy={0} r={22} fill="none" stroke="#7a5c2e" strokeWidth={7} />
    <circle cx={0} cy={0} r={22} fill="none" stroke="#c9a86a" strokeWidth={7} strokeDasharray="5 7" />
    {/* Head clamped on the tail tip */}
    <ellipse cx={0} cy={-22} rx={8} ry={6} fill="#7a5c2e" stroke={INK} strokeWidth={2} />
    <circle cx={3} cy={-24} r={1.8} fill="#ffd23f" stroke={INK} strokeWidth={0.8} />
    <path d="M-7 -20 l-4 2 l3 -4" fill="#c9a86a" stroke={INK} strokeWidth={1} />
  </svg>;
}
