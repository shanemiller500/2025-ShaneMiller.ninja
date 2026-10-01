// A little airliner high up, side-on, facing right. viewBox 80×24.
const INK = "#111";

export default function Jet() {
  return <svg viewBox="0 0 80 24" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M6 12 L2 3 h6 l8 7 Z" fill="#cbd5e1" stroke={INK} strokeWidth={1} />
    <path d="M6 10 Q30 7 66 9 Q78 10 78 13 Q78 16 66 16 L10 16 Q4 15 6 10 Z" fill="#f8fafc" stroke={INK} strokeWidth={1.3} />
    <path d="M34 13 L22 22 h7 l14 -8 Z" fill="#cbd5e1" stroke={INK} strokeWidth={1} />
    {[44, 50, 56, 62].map(x => <circle key={x} cx={x} cy={11.5} r={1} fill="#475569" />)}
    <path d="M70 10.5 q4 0.5 6 2" stroke="#475569" strokeWidth={1.4} fill="none" />
    <path d="M12 13 H64" stroke="#2563eb" strokeWidth={1.2} />
  </svg>;
}
