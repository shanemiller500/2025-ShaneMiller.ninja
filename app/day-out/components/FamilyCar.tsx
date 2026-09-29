// A family station wagon (surfboard on the roof) with the kid, Mum and Dad all
// staring out the windows in shock. Side view facing right: long wagon roof at the
// back (left), sloped windscreen and bonnet at the front (right). viewBox 200×90.
const INK = "#111", SKIN = "#f1c27d";

function ShockedFace({ cx, cy, r = 8, hair, extra }: { cx: number; cy: number; r?: number; hair: string; extra?: React.ReactNode }) {
  return <g>
    <circle cx={cx} cy={cy} r={r} fill={SKIN} stroke={INK} strokeWidth={2} />
    <path d={`M${cx - r} ${cy - 2} q${r} ${-r * 1.6} ${r * 2} 0`} fill={hair} stroke={INK} strokeWidth={1.5} />
    <circle cx={cx + r * 0.2} cy={cy} r={2.6} fill="#fff" stroke={INK} strokeWidth={1} />
    <circle cx={cx + r * 0.75} cy={cy} r={2.6} fill="#fff" stroke={INK} strokeWidth={1} />
    <circle cx={cx + r * 0.25} cy={cy} r={1} fill={INK} />
    <circle cx={cx + r * 0.8} cy={cy} r={1} fill={INK} />
    <ellipse cx={cx + r * 0.5} cy={cy + r * 0.55} rx={2} ry={3} fill={INK} />
    {extra}
  </g>;
}

export default function FamilyCar({ color }: { color: string }) {
  return <svg viewBox="0 0 200 90" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Surfboard strapped to the roof racks */}
    <ellipse cx={72} cy={8} rx={50} ry={4.5} fill="#ffd23f" stroke={INK} strokeWidth={2.5} />
    <line x1={40} y1={9} x2={40} y2={16} stroke={INK} strokeWidth={2.5} />
    <line x1={104} y1={9} x2={104} y2={16} stroke={INK} strokeWidth={2.5} />
    {/* Body: square wagon back, roof, windscreen, bonnet */}
    <path d="M8 64 L8 28 Q8 16 22 16 L126 16 Q134 16 140 23 L154 38 L184 41 Q196 44 196 54 L196 64 Q196 71 189 71 L14 71 Q8 71 8 64 Z" fill={color} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    <path d="M10 54 H194" stroke="#ffffff66" strokeWidth={3} />
    {/* Windows: kid in the back, Mum in the middle, Dad driving */}
    <path d="M14 22 Q14 20 17 20 H46 V38 H14 Z" fill="#bfe3f2" stroke={INK} strokeWidth={2.5} />
    <path d="M50 20 H88 V38 H50 Z" fill="#bfe3f2" stroke={INK} strokeWidth={2.5} />
    <path d="M92 20 H125 Q131 20 135 25 L146 38 H92 Z" fill="#bfe3f2" stroke={INK} strokeWidth={2.5} />
    <ShockedFace cx={31} cy={32} r={6.5} hair="#e0b030" extra={<path d="M24 28 l-3 -3" stroke={INK} strokeWidth={1.5} />} />
    <ShockedFace cx={67} cy={31} r={8} hair="#7a3b12" extra={<circle cx={60} cy={23} r={3.5} fill="#7a3b12" stroke={INK} strokeWidth={1.5} />} />
    <ShockedFace cx={112} cy={31} r={8} hair="#3a2a1f" extra={<path d="M113 37 q4 -2 8 0" stroke="#3a2a1f" strokeWidth={2.5} fill="none" strokeLinecap="round" />} />
    {/* Doors, handle, lights, bumpers */}
    <line x1={90} y1={38} x2={90} y2={70} stroke={INK} strokeWidth={2} />
    <line x1={48} y1={38} x2={48} y2={70} stroke={INK} strokeWidth={2} />
    <rect x={76} y={45} width={10} height={3} rx={1.5} fill={INK} />
    <circle cx={190} cy={50} r={4} fill="#fff3b0" stroke={INK} strokeWidth={2} />
    <rect x={8} y={42} width={5} height={10} rx={2} fill="#e53935" stroke={INK} strokeWidth={1.5} />
    <rect x={184} y={64} width={14} height={6} rx={2} fill="#bfc4ca" stroke={INK} strokeWidth={2} />
    <rect x={4} y={64} width={12} height={6} rx={2} fill="#bfc4ca" stroke={INK} strokeWidth={2} />
    {/* Wheels */}
    {[42, 160].map(cx => <g key={cx}>
      <circle cx={cx} cy={71} r={14} fill="#222" stroke={INK} strokeWidth={3} />
      <circle cx={cx} cy={71} r={6} fill="#d7dbe0" stroke={INK} strokeWidth={2} />
    </g>)}
  </svg>;
}
