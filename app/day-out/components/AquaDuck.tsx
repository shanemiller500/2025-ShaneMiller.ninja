import styles from "../day-out.module.css";

// The Aquaduck: the Gold Coast's duck-faced amphibious tour bus. Blue body splashed with waves,
// red AQUADUCK lettering, an open-sided white canopy with passengers, a cab up front, and the duck
// face: big white cheek, a googly eye and a yellow bill. Faces right; viewBox 300×140, wheels on
// y=138. `riders` fills the canopy with heads; `quack` opens the bill.
const INK = "#111";
const HEADS = [["#f1c7a3", "#7c2d12"], ["#c68642", "#111"], ["#f5d0b5", "#e5e7eb"], ["#e0ac69", "#1e3a8a"], ["#f9d5b8", "#fef3c7"], ["#8d5524", "#111"], ["#f1c7a3", "#a16207"], ["#e0ac69", "#3f2a14"]];

export default function AquaDuck({ riders = 0, quack = false }: { riders?: number; quack?: boolean }) {
  return <svg viewBox="0 0 300 140" width="100%" height="100%" aria-hidden overflow="visible">
    {/* The duck cam on the roof: a rubber duck on a bracket with a lens for an eye */}
    <path d="M150 14 V4" stroke="#6b7280" strokeWidth={2} />
    <g className={styles.camPan}>
      <path d="M140 2 q-2 -10 8 -10 q8 0 8 6 q8 -2 12 6 q-2 8 -16 8 q-12 0 -12 -10 z" fill="#facc15" stroke={INK} strokeWidth={1.2} />
      <path d="M154 -6 l7 1 l-7 2 z" fill="#f97316" stroke={INK} strokeWidth={0.6} />
      <circle cx={150} cy={-6} r={2.6} fill="#111" /><circle cx={150.6} cy={-6.6} r={0.8} fill="#7dd3fc" />
      <circle cx={146} cy={1} r={1.1} fill="#ef4444" className={styles.camLed} />
    </g>
    {/* Canopy: white roof on posts, passengers in the open sides */}
    <rect x={14} y={8} width={70} height={7} rx={2} fill="#f97316" stroke={INK} strokeWidth={1.5} />
    <rect x={8} y={14} width={196} height={10} rx={4} fill="#f8fafc" stroke={INK} strokeWidth={2} />
    <rect x={12} y={24} width={190} height={40} fill="#cfe8f7" />
    {Array.from({ length: Math.min(riders, 8) }, (_, i) => {
      const [skin, hair] = HEADS[i % HEADS.length], cx = 28 + i * 21;
      return <g key={i}><path d={`M${cx - 8} 64 q8 -14 16 0`} fill={["#ef4444", "#22c55e", "#3b82f6", "#eab308"][i % 4]} stroke={INK} strokeWidth={1} />
        <circle cx={cx} cy={46} r={6} fill={skin} stroke={INK} strokeWidth={1.1} /><path d={`M${cx - 6} 44 q6 -8 12 0`} fill={hair} /></g>;
    })}
    {[14, 54, 94, 134, 174].map(x => <rect key={x} x={x} y={24} width={5} height={40} fill="#f8fafc" stroke={INK} strokeWidth={1} />)}
    <path d="M12 52 H200" stroke="#f8fafc" strokeWidth={3} />
    {/* Cab with the driver */}
    <path d="M198 64 V22 q2 -8 12 -8 h34 q14 0 22 22 l6 28 Z" fill="#f8fafc" stroke={INK} strokeWidth={2} />
    <path d="M206 58 V28 q0 -6 8 -6 h28 q10 0 16 18 l4 18 Z" fill="#1e293b" stroke={INK} strokeWidth={1.5} />
    <path d="M216 26 l8 0 l-12 30" stroke="#ffffff33" strokeWidth={4} />
    <circle cx={238} cy={44} r={6} fill="#c68642" /><path d="M231 41 h14 l-2 -5 h-10 z" fill="#1d4ed8" /><path d="M234 56 q4 -8 10 0" fill="#38bdf8" />
    {/* Hull: blue, splashed with waves, a white duck cheek up the front */}
    <path d="M6 64 H262 L274 92 L268 118 H16 Q4 118 4 104 Z" fill="#1d8fe0" stroke={INK} strokeWidth={2.5} />
    <path d="M6 108 q8 -14 16 0 q8 -18 16 0 q8 -12 16 0 q8 -20 16 0 q8 -14 16 0 q8 -18 16 0 q8 -12 16 0 q8 -20 16 0 q8 -14 16 0 q8 -16 16 0 V118 H16 Q6 118 6 108 Z" fill="#1559b8" />
    {[[30, 94], [70, 90], [118, 96], [150, 88], [176, 98]].map(([x, y], i) => <path key={i} d={`M${x} ${y} q3 -6 0 -9 q-3 3 0 9 z`} fill="#bfe3ff" />)}
    <path d="M196 64 H262 L274 92 L266 106 Q236 112 212 104 Q228 88 196 64 Z" fill="#f8fafc" stroke={INK} strokeWidth={2} />
    <path d="M206 72 q10 4 16 -2 M210 82 q10 3 14 -3" stroke="#cbd5e1" strokeWidth={2} fill="none" />
    {/* Name and badge */}
    <text x={110} y={92} textAnchor="middle" fontSize={25} fontWeight={900} fontStyle="italic" fill="#dc2626" stroke="#fff" strokeWidth={4} paintOrder="stroke" fontFamily="Impact, 'Arial Black', sans-serif" letterSpacing={0.5}>AQUADUCK</text>
    <circle cx={26} cy={80} r={11} fill="#facc15" stroke="#1e3a8a" strokeWidth={2} />
    <path d="M21 82 q5 -9 10 0 l4 1 l-4 2 q-5 4 -10 -3 z" fill="#f97316" stroke={INK} strokeWidth={0.8} />
    {/* The duck: googly eye with a blue iris, and the bill (opens to quack) */}
    <ellipse cx={244} cy={78} rx={11} ry={9} fill="#fff" stroke={INK} strokeWidth={1.8} />
    <circle cx={249} cy={79} r={5} fill="#1d4ed8" /><circle cx={250} cy={78} r={2.2} fill={INK} /><circle cx={251.5} cy={76.5} r={0.9} fill="#fff" />
    <path d="M232 70 q12 -8 24 0" stroke={INK} strokeWidth={2.5} fill="none" />
    <g className={quack ? styles.duckQuack : undefined}>
      <path d="M222 96 Q258 86 298 98 Q296 108 280 110 Q250 112 230 106 Z" fill="#fbbf24" stroke={INK} strokeWidth={2} />
      <path d="M240 101 Q268 104 294 100" stroke="#b45309" strokeWidth={2} fill="none" />
    </g>
    <path d={quack ? "M230 108 Q258 128 292 112 Q280 104 232 106 Z" : "M230 106 Q262 118 290 108 Q262 112 230 106 Z"} fill="#f59e0b" stroke={INK} strokeWidth={2} />
    {/* Wheels */}
    {[64, 226].map(cx => <g key={cx}>
      <circle cx={cx} cy={118} r={20} fill="#111" />
      <circle cx={cx} cy={118} r={11} fill="#f8fafc" stroke="#9ca3af" strokeWidth={2} />
      <circle cx={cx} cy={118} r={4} fill="#9ca3af" stroke={INK} strokeWidth={1} />
    </g>)}
  </svg>;
}
