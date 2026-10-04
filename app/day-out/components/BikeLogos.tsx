// The two bike shops' badges, shared by the shopfronts (signs, flags) and the sledging-match card.
const INK = "#111";

// The Harley bar & shield, as an SVG group centred on (cx, cy); about 100×68 at s=1.
export function BarAndShield({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  return <g transform={`translate(${cx} ${cy}) scale(${s})`}>
    <path d="M-40 -34 h80 l-4 22 q-6 24 -36 46 q-30 -22 -36 -46 z" fill="#f97316" stroke="#fff" strokeWidth={3} />
    <path d="M-40 -34 h80 l-4 22 q-6 24 -36 46 q-30 -22 -36 -46 z" fill="none" stroke={INK} strokeWidth={1.5} />
    <text x={0} y={-17} textAnchor="middle" fontSize={11} fontWeight={900} fill="#111" fontFamily="Impact, sans-serif">MOTOR</text>
    <rect x={-50} y={-11} width={100} height={18} fill="#111" stroke="#fff" strokeWidth={2} />
    <text x={0} y={3} textAnchor="middle" fontSize={11} fontWeight={900} fill="#f97316" fontFamily="Impact, sans-serif">HARLEY-DAVIDSON</text>
    <text x={0} y={20} textAnchor="middle" fontSize={10} fontWeight={900} fill="#111" fontFamily="Impact, sans-serif">CYCLES</text>
  </g>;
}

// Standalone badges for HTML (the score pills on the sledging card).
export function HarleyBadge({ className }: { className?: string }) {
  return <svg viewBox="-53 -37 106 74" className={className} aria-hidden><BarAndShield cx={0} cy={0} /></svg>;
}
export function IndianBadge({ className }: { className?: string }) {
  return <svg viewBox="0 0 100 60" className={className} aria-hidden>
    <rect x={2} y={2} width={96} height={56} rx={10} fill="#b91c1c" stroke="#f3e6c8" strokeWidth={3} />
    <path d="M14 46 Q46 30 88 34 Q66 40 60 44 Q40 48 18 50 Z" fill="#7f1d1d" />
    <text x={50} y={33} textAnchor="middle" fontSize={27} fontStyle="italic" fontWeight={900} fill="#f3e6c8" fontFamily="'Brush Script MT', 'Segoe Script', cursive">Indian</text>
    <text x={50} y={50} textAnchor="middle" fontSize={8} fontWeight={900} fill="#f3e6c8" fontFamily="sans-serif" letterSpacing={2}>MOTORCYCLE</text>
  </svg>;
}
