import styles from "../day-out.module.css";

export type ShazzPose = "ride" | "drink" | "flip" | "smoke" | "throw" | "moon" | "fallen";

// Big Shazz on her chopper, side-on facing right. viewBox 260×180; the wheels touch
// the ground at y=172 (rear x=60, front x=205) and the exhaust tip sits at (16,128).
// Pose hand positions (used for effects): durry tip (150,38), throwing hand (85,12).
const INK = "#111", CHROME = "#d7dbe0", SKIN = "#f1c27d", SKIN_BACK = "#d9a766", GLASS = "#6b3e12";
const Wheel = ({ cx }: { cx: number }) => <g className={styles.wheel}>
  <circle cx={cx} cy={140} r={32} fill="#222" stroke={INK} strokeWidth={3} />
  <circle cx={cx} cy={140} r={21} fill="none" stroke={CHROME} strokeWidth={4} />
  {[0, 30, 60, 90, 120, 150].map(angle => <line key={angle} x1={cx - 20} y1={140} x2={cx + 20} y2={140} stroke="#aeb4bb" strokeWidth={2} transform={`rotate(${angle} ${cx} 140)`} />)}
  <circle cx={cx} cy={140} r={5} fill="#f28c28" stroke={INK} strokeWidth={2} />
</g>;
const Limb = ({ d, color, width = 12 }: { d: string; color: string; width?: number }) => <>
  <path d={d} stroke={INK} strokeWidth={width + 5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
</>;
// A stubby: thick brown body, thin neck, yellow label.
const Stubby = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => {
  const nx = x2 + (x2 - x1) * 0.3, ny = y2 + (y2 - y1) * 0.3, lx = x1 + (x2 - x1) * 0.3, ly = y1 + (y2 - y1) * 0.3, mx = x1 + (x2 - x1) * 0.65, my = y1 + (y2 - y1) * 0.65;
  return <>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={12} strokeLinecap="round" />
    <line x1={x2} y1={y2} x2={nx} y2={ny} stroke={INK} strokeWidth={7} strokeLinecap="round" />
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={GLASS} strokeWidth={8} strokeLinecap="round" />
    <line x1={x2} y1={y2} x2={nx} y2={ny} stroke={GLASS} strokeWidth={3.5} strokeLinecap="round" />
    <line x1={lx} y1={ly} x2={mx} y2={my} stroke="#f5d76e" strokeWidth={8} />
  </>;
};

function NearArm({ pose }: { pose: ShazzPose }) {
  switch (pose) {
    case "drink": return <><Limb d="M110 52 L132 50 L142 32" color={SKIN} /><Stubby x1={152} y1={22} x2={136} y2={35} /><circle cx={142} cy={31} r={7} fill={SKIN} stroke={INK} strokeWidth={2.5} /></>;
    case "flip": return <>
      <Limb d="M110 52 L126 36 L136 16" color={SKIN} />
      <Limb d="M137 10 L137 -6" color={SKIN} width={5} />
      <circle cx={137} cy={13} r={8} fill={SKIN} stroke={INK} strokeWidth={2.5} />
    </>;
    case "smoke": return <>
      <Limb d="M110 52 L130 52 L134 41" color={SKIN} />
      <line x1={136} y1={40} x2={150} y2={38} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <line x1={136} y1={40} x2={150} y2={38} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
      <circle cx={151} cy={38} r={2.5} fill="#ff6a00" />
      <circle cx={135} cy={40} r={6} fill={SKIN} stroke={INK} strokeWidth={2.5} />
    </>;
    case "throw": return <><Stubby x1={86} y1={14} x2={74} y2={0} /><Limb d="M108 50 L96 30 L86 14" color={SKIN} /><circle cx={86} cy={13} r={7} fill={SKIN} stroke={INK} strokeWidth={2.5} /></>;
    case "moon": return null;
    default: return <><Limb d="M110 52 L126 72 L140 66" color={SKIN} /><Stubby x1={143} y1={74} x2={143} y2={56} /><circle cx={141} cy={66} r={7} fill={SKIN} stroke={INK} strokeWidth={2.5} /></>;
  }
}

export default function BikerShazz({ pose = "ride", drunk = 0 }: { pose?: ShazzPose; drunk?: number }) {
  return <svg viewBox="0 0 260 180" width="100%" height="100%" aria-hidden overflow="visible" className={pose === "fallen" ? styles.fallen : ""}>
    <g className={styles.bikeParts}>
      <path d="M112 128 C 90 136, 60 134, 18 128" stroke={INK} strokeWidth={10} fill="none" strokeLinecap="round" />
      <path d="M112 128 C 90 136, 60 134, 18 128" stroke={CHROME} strokeWidth={5} fill="none" strokeLinecap="round" />
      <circle cx={16} cy={128} r={4.5} fill="#333" stroke={INK} strokeWidth={2} />
      <Wheel cx={60} />
      <Wheel cx={205} />
      <path d="M26 132 A36 36 0 0 1 94 116" stroke={INK} strokeWidth={11} fill="none" strokeLinecap="round" />
      <path d="M26 132 A36 36 0 0 1 94 116" stroke="#b3261e" strokeWidth={7} fill="none" strokeLinecap="round" />
      <path d="M181 118 A36 36 0 0 1 234 128" stroke={INK} strokeWidth={10} fill="none" strokeLinecap="round" />
      <path d="M181 118 A36 36 0 0 1 234 128" stroke="#b3261e" strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d="M60 140 L95 108 L150 112 L178 70" stroke={INK} strokeWidth={8} fill="none" strokeLinejoin="round" />
      <line x1={178} y1={70} x2={205} y2={140} stroke={INK} strokeWidth={9} strokeLinecap="round" />
      <line x1={178} y1={70} x2={205} y2={140} stroke={CHROME} strokeWidth={5} strokeLinecap="round" />
      <rect x={106} y={96} width={16} height={26} rx={3} fill="#9aa0a6" stroke={INK} strokeWidth={2.5} transform="rotate(-22 114 109)" />
      <rect x={124} y={96} width={16} height={26} rx={3} fill="#9aa0a6" stroke={INK} strokeWidth={2.5} transform="rotate(22 132 109)" />
      <ellipse cx={122} cy={127} rx={19} ry={11} fill={CHROME} stroke={INK} strokeWidth={2.5} />
      <path d="M126 92 C 132 74, 170 70, 180 84 C 174 97, 142 100, 126 92 Z" fill="#f28c28" stroke={INK} strokeWidth={3} />
      <path d="M134 90 q8 -8 14 -3 q5 -8 12 -2 q4 -6 10 -2 q-12 9 -36 7 z" fill="#ffd23f" />
      <circle cx={190} cy={80} r={8} fill="#fff3b0" stroke={INK} strokeWidth={2.5} />
      <path d="M178 72 L171 34 L158 37" stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M178 72 L171 34 L158 37" stroke={CHROME} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>

    <g className={styles.rider}>
      <path className={styles.braid} d="M101 24 C 88 20, 84 34, 74 30 C 66 27, 62 37, 52 33" stroke="#7a3b12" strokeWidth={7} fill="none" strokeLinecap="round" />
      <circle cx={52} cy={33} r={3.5} fill="#b3261e" stroke={INK} strokeWidth={1.5} />
      {/* Far arm stays on the bars (unless she's fallen off) */}
      {pose !== "fallen" && <Limb d="M104 50 L140 58 L158 40" color={SKIN_BACK} />}
      <Limb d="M100 96 L132 100 L140 122" color="#2f4a78" width={16} />
      <rect x={131} y={118} width={22} height={11} rx={4} fill="#1a1a1a" stroke={INK} strokeWidth={2} />
      <ellipse cx={100} cy={70} rx={34} ry={32} fill="#c0392b" stroke={INK} strokeWidth={3} />
      <path d="M69 60 C 66 82, 74 98, 96 102 L 104 102 C 99 80, 99 52, 95 40 C 84 40, 73 47, 69 60 Z" fill="#1d1d1d" stroke={INK} strokeWidth={3} />
      <rect x={74} y={60} width={20} height={17} rx={3} fill="#f28c28" stroke={INK} strokeWidth={1.5} />
      <text x={84} y={72.5} textAnchor="middle" fontSize={8} fontWeight={900} fill={INK} fontFamily="sans-serif">SA</text>
      {/* Full moon: jeans down, big cheeks out the back */}
      {pose === "moon" && <g className={styles.moonCheeks}>
        <circle cx={72} cy={92} r={15} fill="#ffd9b8" stroke={INK} strokeWidth={3} />
        <circle cx={88} cy={96} r={15} fill="#ffd9b8" stroke={INK} strokeWidth={3} />
        <path d="M80 82 q-1 10 0 22" stroke={INK} strokeWidth={2} fill="none" />
        <path d="M58 104 q30 14 50 2" stroke="#2f4a78" strokeWidth={7} fill="none" strokeLinecap="round" />
        <circle cx={66} cy={87} r={3} fill="#fff" opacity={0.7} />
      </g>}
      <NearArm pose={pose} />
      <circle cx={117} cy={28} r={17} fill={SKIN} stroke={INK} strokeWidth={3} />
      <path d="M99 25 C 99 7, 133 5, 135 24 Z" fill="#1d1d1d" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M103 18 C 110 12, 124 11, 131 17" stroke="#f28c28" strokeWidth={2.5} fill="none" />
      {pose === "fallen"
        ? <><path d="M115 24 l6 6 m0 -6 l-6 6 M126 24 l6 6 m0 -6 l-6 6" stroke={INK} strokeWidth={2.5} strokeLinecap="round" /></>
        : <><path d="M113 25 h22 v6 q-5 4 -11 0 q-5 4 -11 0 z" fill={INK} /><line x1={117} y1={27} x2={121} y2={27} stroke="#fff" strokeWidth={1.5} /></>}
      <circle cx={135} cy={33} r={3} fill={drunk >= 2 ? "#e8766b" : SKIN} stroke={INK} strokeWidth={1.5} />
      <circle cx={124} cy={35} r={3.5 + drunk * 0.6} fill="#ff6f61" opacity={0.45 + drunk * 0.12} />
      {pose === "moon"
        ? <path d="M121 37 q7 7 14 0 z M126 40 q3 6 6 0" fill="#fff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        : <path className={styles.mouth} d="M120 38 q8 8 15 0 z" fill="#fff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />}
      <circle cx={109} cy={34} r={2.2} fill="#ffd23f" stroke={INK} strokeWidth={1} />
    </g>
  </svg>;
}
