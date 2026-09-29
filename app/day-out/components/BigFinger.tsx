// A giant cartoon fist with the middle finger up, in Shazz's leather cuff.
const INK = "#111", SKIN = "#f1c27d";

export default function BigFinger() {
  return <svg viewBox="0 0 200 270" width="100%" height="100%" aria-hidden>
    {/* Middle finger (drawn first so the fist covers its base) */}
    <rect x={78} y={8} width={44} height={140} rx={22} fill={SKIN} stroke={INK} strokeWidth={6} />
    <rect x={87} y={16} width={26} height={24} rx={9} fill="#ffe3cc" stroke={INK} strokeWidth={3} />
    <path d="M86 70 q14 5 28 0 M86 100 q14 5 28 0" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
    {/* Fist and folded knuckles */}
    <rect x={26} y={112} width={156} height={118} rx={42} fill={SKIN} stroke={INK} strokeWidth={6} />
    <ellipse cx={52} cy={128} rx={25} ry={22} fill={SKIN} stroke={INK} strokeWidth={6} />
    <ellipse cx={148} cy={128} rx={24} ry={22} fill={SKIN} stroke={INK} strokeWidth={6} />
    <ellipse cx={172} cy={150} rx={16} ry={20} fill={SKIN} stroke={INK} strokeWidth={6} />
    <rect x={80} y={126} width={40} height={16} fill={SKIN} />
    {/* Thumb across the front */}
    <rect x={38} y={166} width={96} height={36} rx={18} fill={SKIN} stroke={INK} strokeWidth={6} />
    <path d="M58 150 v14 M100 152 v12 M140 150 v14" stroke={INK} strokeWidth={3} strokeLinecap="round" />
    {/* Heart tattoo and studded leather cuff */}
    <path d="M160 185 c-4 -6 -12 -2 -8 4 l8 8 l8 -8 c4 -6 -4 -10 -8 -4 z" fill="#b3261e" />
    <rect x={50} y={224} width={108} height={42} rx={8} fill="#1d1d1d" stroke={INK} strokeWidth={5} />
    {[70, 92, 114, 136].map(x => <circle key={x} cx={x} cy={245} r={5} fill="#d7dbe0" stroke={INK} strokeWidth={2} />)}
  </svg>;
}
