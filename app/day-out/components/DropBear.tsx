// The dreaded drop bear: a koala gone feral. Darker fur, red eyes, fangs and claws out.
// viewBox 60×60, centred; it drops from a gum tree onto the road.
const INK = "#111";

export default function DropBear() {
  return <svg viewBox="-30 -30 60 60" width="100%" height="100%" aria-hidden overflow="visible">
    <ellipse cx={0} cy={10} rx={14} ry={15} fill="#5d5f63" stroke={INK} strokeWidth={2} />
    {/* Claws out */}
    <path d="M-14 6 l-8 -6 m8 6 l-9 0 m9 0 l-7 5 M14 6 l8 -6 m-8 6 l9 0 m-9 0 l7 5" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
    <circle cx={-12} cy={-12} r={8} fill="#5d5f63" stroke={INK} strokeWidth={1.8} />
    <circle cx={12} cy={-12} r={8} fill="#5d5f63" stroke={INK} strokeWidth={1.8} />
    <path d="M-12 -18 l-3 -7 l4 5 M12 -18 l3 -7 l-4 5" stroke={INK} strokeWidth={1.5} fill="#5d5f63" />
    <circle cx={0} cy={-4} r={12} fill="#5d5f63" stroke={INK} strokeWidth={2} />
    {/* Angry brows, glowing red eyes */}
    <path d="M-9 -10 l6 3 M9 -10 l-6 3" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
    <circle cx={-5} cy={-5} r={2.4} fill="#ff2a2a" />
    <circle cx={5} cy={-5} r={2.4} fill="#ff2a2a" />
    <ellipse cx={0} cy={1} rx={3.5} ry={3} fill={INK} />
    {/* Snarl with fangs */}
    <path d="M-7 6 q7 7 14 0 z" fill="#7a0000" stroke={INK} strokeWidth={1.5} />
    <path d="M-5 6 l1.5 4 l1.5 -4 M2 6 l1.5 4 l1.5 -4" fill="#fff" stroke={INK} strokeWidth={0.8} />
  </svg>;
}
