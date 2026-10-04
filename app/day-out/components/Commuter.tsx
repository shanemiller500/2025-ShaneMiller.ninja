import styles from "../day-out.module.css";

// Nice, normal people catching the bus: an office worker with a handbag, a bloke in a polo with a
// backpack, a nan with her shopping bag, a schoolkid in a hat, a tourist with a camera, and a young
// woman glued to her phone. Faces right; viewBox 40×100, feet at y=98. `walking` swings the legs;
// `waving` puts a hand up (for the bus).
const INK = "#111";
const LOOKS = [
  { skin: "#f1c7a3", hair: "#7c2d12", top: "#60a5fa", legs: "#1e293b", skirt: true, bag: "handbag" },
  { skin: "#c68642", hair: "#111", top: "#16a34a", legs: "#d6c7a1", skirt: false, bag: "backpack" },
  { skin: "#f5d0b5", hair: "#e5e7eb", top: "#c4b5fd", legs: "#64748b", skirt: true, bag: "shopping" },
  { skin: "#e0ac69", hair: "#3f2a14", top: "#f8fafc", legs: "#1e3a8a", skirt: false, bag: "school" },
  { skin: "#f9d5b8", hair: "#a16207", top: "#f472b6", legs: "#f5f5f4", skirt: false, bag: "camera" },
  { skin: "#8d5524", hair: "#111", top: "#fbbf24", legs: "#334155", skirt: false, bag: "phone" },
] as const;

export default function Commuter({ look = 0, walking = false, waving = false }: { look?: number; walking?: boolean; waving?: boolean }) {
  const L = LOOKS[look % LOOKS.length], kid = L.bag === "school";
  return <svg viewBox="0 0 40 100" width="100%" height="100%" aria-hidden overflow="visible">
    <g transform={kid ? "translate(4 22) scale(0.78)" : undefined}>
      {L.bag === "backpack" && <rect x={6} y={36} width={10} height={20} rx={3} fill="#1d4ed8" stroke={INK} strokeWidth={1.2} />}
      {L.bag === "school" && <rect x={3} y={34} width={13} height={24} rx={3} fill="#dc2626" stroke={INK} strokeWidth={1.2} />}
      <g className={walking ? styles.bludgerLegs : undefined}>
        <path d="M17 64 L15 95 M24 64 L26 95" stroke={INK} strokeWidth={6} strokeLinecap="round" />
        <path d="M17 64 L15 95 M24 64 L26 95" stroke={kid ? "#f1c7a3" : L.legs} strokeWidth={4} strokeLinecap="round" />
      </g>
      <path d="M10 97 h8 M23 97 h8" stroke={kid ? "#111" : "#3f3f46"} strokeWidth={3.5} strokeLinecap="round" />
      {L.skirt
        ? <path d="M12 52 L29 52 L32 74 L9 74 Z" fill={L.legs} stroke={INK} strokeWidth={1.4} />
        : kid && <path d="M12 56 h17 l2 12 h-21 z" fill="#1e3a8a" stroke={INK} strokeWidth={1.2} />}
      <path d="M11 34 q9 -6 18 0 l2 24 h-22 z" fill={L.top} stroke={INK} strokeWidth={1.6} />
      {L.bag === "camera" && <><path d="M13 34 L26 50" stroke="#111" strokeWidth={1} /><rect x={22} y={47} width={9} height={7} rx={1.5} fill="#27272a" /><circle cx={26.5} cy={50.5} r={2} fill="#93c5fd" /></>}
      {L.bag === "camera" && [[16, 42], [22, 38], [18, 52]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.6} fill="#fde047" />)}
      {/* Arm: down with the bag, up waving at the bus, or holding the phone up to the face */}
      {waving
        ? <><path d="M27 38 L34 22" stroke={L.top} strokeWidth={5} strokeLinecap="round" /><circle cx={35} cy={19} r={3} fill={L.skin} stroke={INK} strokeWidth={0.8} /></>
        : L.bag === "phone"
          ? <><path d="M27 38 L32 46 L30 36" stroke={L.top} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" /><rect x={28} y={29} width={5} height={8} rx={1} fill="#111" /><rect x={28.8} y={30} width={3.4} height={6} fill="#93c5fd" /></>
          : <path d="M27 38 L29 56" stroke={L.top} strokeWidth={5} strokeLinecap="round" />}
      {L.bag === "handbag" && !waving && <><path d="M26 54 q4 -8 8 0" stroke="#7c2d12" strokeWidth={1.4} fill="none" /><rect x={24} y={54} width={12} height={10} rx={2} fill="#b45309" stroke={INK} strokeWidth={1} /></>}
      {L.bag === "shopping" && !waving && <><rect x={25} y={55} width={11} height={14} rx={1} fill="#16a34a" stroke={INK} strokeWidth={1} /><path d="M27 55 q3 -5 6 0" stroke="#166534" strokeWidth={1.2} fill="none" /><circle cx={28} cy={54} r={2} fill="#f97316" /><path d="M32 55 l1 -6" stroke="#65a30d" strokeWidth={1.5} /></>}
      <circle cx={21} cy={22} r={8.5} fill={L.skin} stroke={INK} strokeWidth={1.6} />
      <circle cx={24} cy={21} r={1.1} fill={INK} /><path d="M22 26 q2.5 2 5 0" stroke={INK} strokeWidth={1} fill="none" />
      {L.bag === "shopping"
        ? <><path d="M12 20 q9 -12 18 0 q-2 -4 -9 -4 q-7 0 -9 4 z" fill={L.hair} stroke={INK} strokeWidth={1} /><circle cx={14} cy={14} r={4} fill={L.hair} stroke={INK} strokeWidth={1} /><circle cx={24} cy={21} r={2.6} fill="none" stroke={INK} strokeWidth={0.8} /></>
        : L.bag === "school"
          ? <path d="M9 18 q12 -14 24 0 l5 2 h-34 z" fill="#1e3a8a" stroke={INK} strokeWidth={1.2} />
          : L.bag === "camera"
            ? <path d="M10 19 q11 -14 22 0 l4 3 h-30 z" fill="#fef3c7" stroke={INK} strokeWidth={1.2} />
            : L.skirt
              ? <path d="M12 22 q0 -14 10 -12 q9 0 8 10 l-4 -4 q-6 -2 -10 2 l-1 16 q-4 -4 -3 -12 z" fill={L.hair} stroke={INK} strokeWidth={1} />
              : <path d="M12 20 q2 -11 11 -10 q7 1 7 8 q-6 -4 -18 2 z" fill={L.hair} stroke={INK} strokeWidth={1} />}
    </g>
  </svg>;
}
