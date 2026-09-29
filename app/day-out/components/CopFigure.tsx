// A cartoon cop. "xray" is the classic cartoon explosion gag (skeleton flash);
// "singed" is afterwards: blackened, frizzy, hat smoking. viewBox 40×70.
const INK = "#111";

export default function CopFigure({ look }: { look: "xray" | "singed" }) {
  if (look === "xray") return <svg viewBox="0 0 40 70" width="100%" height="100%" aria-hidden overflow="visible">
    <rect x={2} y={0} width={36} height={70} rx={8} fill="#1b2a3a" />
    <circle cx={20} cy={14} r={8} fill="#f4f4f4" />
    <circle cx={17} cy={13} r={2.2} fill="#1b2a3a" /><circle cx={23} cy={13} r={2.2} fill="#1b2a3a" />
    <path d="M16 19 h8" stroke="#1b2a3a" strokeWidth={1.5} strokeDasharray="1.5 1" />
    <line x1={20} y1={22} x2={20} y2={46} stroke="#f4f4f4" strokeWidth={3} />
    {[27, 32, 37].map(y => <path key={y} d={`M12 ${y} q8 -3 16 0`} stroke="#f4f4f4" strokeWidth={2} fill="none" />)}
    <path d="M20 25 L8 38 M20 25 L32 38 M20 46 L13 66 M20 46 L27 66" stroke="#f4f4f4" strokeWidth={3} strokeLinecap="round" />
  </svg>;
  return <svg viewBox="0 0 40 70" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M14 50 L12 66 M26 50 L28 66" stroke={INK} strokeWidth={7} strokeLinecap="round" />
    <path d="M14 50 L12 66 M26 50 L28 66" stroke="#1f2f55" strokeWidth={4} strokeLinecap="round" />
    <rect x={9} y={24} width={22} height={28} rx={6} fill="#2e3f66" stroke={INK} strokeWidth={2.5} />
    <path d="M10 28 L2 20 M30 28 L38 20" stroke={INK} strokeWidth={6} strokeLinecap="round" />
    <path d="M10 28 L2 20 M30 28 L38 20" stroke="#3a3a3a" strokeWidth={3.5} strokeLinecap="round" />
    <circle cx={20} cy={14} r={9} fill="#3a3a3a" stroke={INK} strokeWidth={2.5} />
    {/* Frizzed hair and a scorched, tilted cap */}
    <path d="M12 8 l-3 -4 M16 6 l-1 -5 M24 6 l1 -5 M28 8 l3 -4" stroke={INK} strokeWidth={1.5} />
    <path d="M13 7 h14 l-2 -5 h-10 z" fill="#1f2f55" stroke={INK} strokeWidth={1.5} transform="rotate(-18 20 5)" />
    <circle cx={17} cy={13} r={3} fill="#fff" /><circle cx={24} cy={13} r={3} fill="#fff" />
    <circle cx={17} cy={13} r={1} fill={INK} /><circle cx={24} cy={13} r={1} fill={INK} />
    <ellipse cx={20} cy={19} rx={2.5} ry={3} fill="#fff" stroke={INK} strokeWidth={1} />
  </svg>;
}
