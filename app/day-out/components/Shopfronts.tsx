import styles from "../day-out.module.css";

// The backdrop behind the road: a strip of tired old two-storey terrace shops, cartoon style.
// Milk bar, an empty shop covered in tags, Centrelink, the bottlo, a discount variety store with
// its roller door down; a bus shelter, a power pole with sagging wires, a scrappy street tree.
// viewBox 1500×420; the footpath runs along the bottom (y 380-420) and meets the road.
const INK = "#111";

function Window({ x, y, curtain = "#f8fafc" }: { x: number; y: number; curtain?: string }) {
  return <g>
    <rect x={x - 4} y={y - 6} width={48} height={8} fill="#e7e5e4" stroke={INK} strokeWidth={1.5} />
    <rect x={x} y={y} width={40} height={68} fill="#1f2937" stroke={INK} strokeWidth={2} />
    <rect x={x + 3} y={y + 3} width={34} height={30} fill={curtain} opacity={0.85} />
    <path d={`M${x} ${y + 34} h40 M${x + 20} ${y} v68`} stroke={INK} strokeWidth={1.5} />
    <rect x={x - 3} y={y + 68} width={46} height={6} fill="#e7e5e4" stroke={INK} strokeWidth={1.5} />
  </g>;
}
// Corrugated striped awning.
function Awning({ x, w }: { x: number; w: number }) {
  return <g>
    <path d={`M${x} 268 h${w} l-6 20 h-${w - 12} z`} fill="#d6c7a8" stroke={INK} strokeWidth={1.8} />
    {Array.from({ length: Math.floor(w / 12) }, (_, i) => <line key={i} x1={x + 6 + i * 12} y1={269} x2={x + 4 + i * 12} y2={287} stroke="#a8977a" strokeWidth={2} />)}
  </g>;
}
// A scribbly graffiti tag.
function Tag({ x, y, color, s = 1 }: { x: number; y: number; color: string; s?: number }) {
  return <path d={`M${x} ${y} q${8 * s} ${-16 * s} ${14 * s} 0 t${14 * s} 0 q${4 * s} ${-14 * s} ${12 * s} ${-4 * s} l${-6 * s} ${14 * s} q${10 * s} ${-12 * s} ${18 * s} ${-2 * s}`} stroke={color} strokeWidth={3 * s} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
}

// `sky={false}` leaves the sky transparent so a separate sky layer (with the jets in it) shows
// through behind the buildings.
export default function Shopfronts({ sky = true }: { sky?: boolean }) {
  return <svg viewBox="0 0 1500 420" width="100%" height="100%" preserveAspectRatio="xMidYMax slice" aria-hidden>
    <defs>
      <linearGradient id="sfSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f80d1" /><stop offset="1" stopColor="#8cc4f0" /></linearGradient>
      <pattern id="sfBrickRed" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#b4532a" /><path d="M0 12 H24 M12 0 V6 M0 6 H24 M0 6 V12 M24 6 V12" stroke="#8a3b1c" strokeWidth={1} /></pattern>
      <pattern id="sfBrickDark" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#2b2f36" /><path d="M0 12 H24 M12 0 V6 M0 6 H24 M0 6 V12 M24 6 V12" stroke="#1b1e23" strokeWidth={1} /></pattern>
    </defs>
    {sky && <rect width="1500" height="420" fill="url(#sfSky)" />}
    <g className={styles.stripCloud}><ellipse cx={150} cy={70} rx={60} ry={22} fill="#fff" /><ellipse cx={190} cy={62} rx={40} ry={20} fill="#fff" /></g>
    <g className={styles.stripCloud} style={{ animationDelay: "-30s" }}><ellipse cx={900} cy={40} rx={50} ry={16} fill="#fff" opacity={0.9} /></g>

    {/* ---- The six terraces ---- */}
    {/* 0: dark brick, MILKO */}
    <rect x={0} y={90} width={250} height={290} fill="url(#sfBrickDark)" stroke={INK} strokeWidth={2.5} />
    <rect x={-4} y={82} width={258} height={12} fill="#3f444c" stroke={INK} strokeWidth={2} />
    <Window x={60} y={130} /><Window x={150} y={130} curtain="#fde68a" />
    {/* 1: red brick, empty and tagged */}
    <rect x={250} y={72} width={250} height={308} fill="url(#sfBrickRed)" stroke={INK} strokeWidth={2.5} />
    <rect x={244} y={64} width={262} height={12} fill="#c96b3d" stroke={INK} strokeWidth={2} />
    <Window x={310} y={124} /><Window x={400} y={124} />
    {/* 2: cream render with a curved pediment */}
    <path d="M500 380 V70 h70 q55 -50 110 0 h70 V380 Z" fill="#efe8d8" stroke={INK} strokeWidth={2.5} />
    <path d="M590 66 q35 -28 70 0" stroke="#cfc6b0" strokeWidth={6} fill="none" />
    <path d="M520 110 l10 30 M720 100 l-12 40 M560 190 l20 10" stroke="#cfc6b0" strokeWidth={3} />
    <Window x={575} y={124} /><Window x={645} y={124} />
    {/* 3: blue-black brick */}
    <rect x={750} y={96} width={250} height={284} fill="url(#sfBrickDark)" stroke={INK} strokeWidth={2.5} />
    <rect x={744} y={88} width={262} height={12} fill="#353a42" stroke={INK} strokeWidth={2} />
    <Window x={810} y={132} curtain="#e0f2fe" /><Window x={900} y={132} />
    {/* 4: sage green 1926 */}
    <path d="M1000 380 V84 h60 q65 -46 130 0 h60 V380 Z" fill="#c7d3a8" stroke={INK} strokeWidth={2.5} />
    <text x={1125} y={68} textAnchor="middle" fontSize={16} fontWeight={900} fill="#7c8a5c" fontFamily="sans-serif">1926</text>
    <path d="M1030 120 q10 20 0 40 M1220 150 q-12 16 -4 30" stroke="#a7b386" strokeWidth={4} fill="none" />
    <Window x={1062} y={132} /><Window x={1150} y={132} curtain="#fecaca" />
    {/* 5: red brick, discount variety */}
    <rect x={1250} y={70} width={250} height={310} fill="url(#sfBrickRed)" stroke={INK} strokeWidth={2.5} />
    <rect x={1244} y={62} width={262} height={12} fill="#c96b3d" stroke={INK} strokeWidth={2} />
    <Window x={1310} y={124} /><Window x={1400} y={124} />
    <rect x={1440} y={210} width={30} height={20} fill="#e5e7eb" stroke={INK} strokeWidth={1.5} />

    {/* ---- Signs ---- */}
    <rect x={4} y={228} width={242} height={40} fill="#f8fafc" stroke={INK} strokeWidth={2} />
    <text x={70} y={258} textAnchor="middle" fontSize={26} fontWeight={900} fill="#dc2626" fontFamily="sans-serif">MILKO</text>
    <text x={180} y={246} textAnchor="middle" fontSize={11} fontWeight={900} fill="#1d4ed8" fontFamily="sans-serif">MILK BAR</text>
    <text x={180} y={260} textAnchor="middle" fontSize={10} fontWeight={800} fill="#1d4ed8" fontFamily="sans-serif">CONVENIENCE</text>
    <rect x={254} y={228} width={242} height={40} fill="#e7dcc4" stroke={INK} strokeWidth={2} />
    {[[270, 236, 40], [340, 244, 60], [430, 234, 30], [300, 256, 50]].map(([x, y, w], i) => <rect key={i} x={x} y={y} width={w} height={8} fill="#b8a98a" />)}
    <rect x={504} y={228} width={492} height={40} fill="#1e293b" stroke={INK} strokeWidth={2} />
    <circle cx={556} cy={248} r={11} fill="none" stroke="#5eead4" strokeWidth={3} strokeDasharray="6 3" />
    <text x={700} y={258} textAnchor="middle" fontSize={26} fontWeight={900} fill="#f8fafc" fontFamily="sans-serif" letterSpacing={2}>CENTRELINK</text>
    <text x={900} y={252} textAnchor="middle" fontSize={11} fontWeight={800} fill="#cbd5e1" fontFamily="sans-serif">TAKE A NUMBER</text>
    <rect x={1004} y={228} width={242} height={40} fill="#2f5d4a" stroke={INK} strokeWidth={2} />
    <text x={1095} y={258} textAnchor="middle" fontSize={24} fontWeight={900} fill="#fef3c7" fontFamily="sans-serif" letterSpacing={1}>THE BOTTLO</text>
    <ellipse cx={1210} cy={248} rx={22} ry={15} fill="#b91c1c" stroke="#fef3c7" strokeWidth={2} />
    <text x={1210} y={254} textAnchor="middle" fontSize={15} fontWeight={900} fill="#fef3c7" fontFamily="sans-serif">VB</text>
    <rect x={1254} y={228} width={242} height={40} fill="#f1f5f9" stroke={INK} strokeWidth={2} />
    <text x={1350} y={254} textAnchor="middle" fontSize={17} fontWeight={900} fill="#1d4ed8" fontFamily="sans-serif">DISCOUNT VARIETY</text>
    <text x={1462} y={244} textAnchor="middle" fontSize={7} fontWeight={800} fill="#dc2626" fontFamily="sans-serif">TOYS GIFTS</text>
    <text x={1462} y={254} textAnchor="middle" fontSize={7} fontWeight={800} fill="#dc2626" fontFamily="sans-serif">HOUSEHOLD</text>
    {/* Peeling paint on the old boards */}
    <path d="M10 266 l14 -6 l6 6 M226 232 l-10 6 M480 262 l-12 -8 l-4 6" stroke="#a8a29e" strokeWidth={2} fill="none" />

    {[0, 250, 1000, 1250].map(x => <Awning key={x} x={x + 2} w={246} />)}

    {/* ---- Shopfronts ---- */}
    {/* Milk bar: posters, door, the board */}
    <rect x={10} y={288} width={230} height={92} fill="#1f2937" stroke={INK} strokeWidth={2} />
    <rect x={18} y={296} width={60} height={80} fill="#bfdbfe" stroke={INK} strokeWidth={1.5} />
    {[[22, 300, "#dc2626"], [44, 318, "#f59e0b"], [24, 340, "#16a34a"], [52, 352, "#dc2626"]].map(([x, y, c], i) => <rect key={i} x={x as number} y={y as number} width={20} height={16} fill={c as string} stroke={INK} strokeWidth={0.8} />)}
    <rect x={86} y={296} width={36} height={84} fill="#78350f" stroke={INK} strokeWidth={1.5} />
    <rect x={132} y={296} width={100} height={80} fill="#111827" stroke={INK} strokeWidth={1.5} />
    <text x={182} y={318} textAnchor="middle" fontSize={11} fontWeight={900} fill="#f8fafc" fontFamily="sans-serif">COLD DRINKS</text>
    <text x={182} y={336} textAnchor="middle" fontSize={11} fontWeight={900} fill="#fde68a" fontFamily="sans-serif">ICE CREAMS</text>
    <text x={182} y={354} textAnchor="middle" fontSize={11} fontWeight={900} fill="#86efac" fontFamily="sans-serif">SNACKS</text>
    {/* Empty shop: boarded up and tagged to death */}
    <rect x={260} y={288} width={230} height={92} fill="#57534e" stroke={INK} strokeWidth={2} />
    <rect x={270} y={296} width={40} height={84} fill="#78716c" stroke={INK} strokeWidth={1.5} />
    <rect x={320} y={296} width={160} height={78} fill="#d6d3d1" stroke={INK} strokeWidth={1.5} />
    <Tag x={334} y={340} color="#111" s={1.4} /><Tag x={400} y={360} color="#7c3aed" /><Tag x={420} y={318} color="#dc2626" s={0.8} />
    <rect x={330} y={300} width={50} height={22} fill="#f8fafc" stroke={INK} strokeWidth={1} /><text x={355} y={315} textAnchor="middle" fontSize={8} fontWeight={900} fill="#dc2626" fontFamily="sans-serif">FOR LEASE</text>
    {/* Centrelink: glass, lights on, notices */}
    <rect x={510} y={278} width={480} height={102} fill="#334155" stroke={INK} strokeWidth={2} />
    {[520, 640, 760, 880].map(x => <rect key={x} x={x} y={286} width={100} height={88} fill="#cbe4f5" stroke={INK} strokeWidth={1.5} />)}
    {[540, 600, 660, 720, 780, 840, 900, 960].map(x => <rect key={x} x={x - 12} y={290} width={24} height={4} rx={2} fill="#fef9c3" className={styles.officeLight} />)}
    {[[530, 320], [560, 330], [890, 315], [920, 326], [950, 318]].map(([x, y], i) => <rect key={i} x={x} y={y} width={16} height={20} fill="#f8fafc" stroke={INK} strokeWidth={0.8} />)}
    <path d="M760 286 v88 M820 286 v88" stroke={INK} strokeWidth={2} />
    {/* The bottlo: VB poster, shelves of grog, neon OPEN, XXXX poster */}
    <rect x={1010} y={288} width={230} height={92} fill="#1c1917" stroke={INK} strokeWidth={2} />
    <rect x={1018} y={296} width={64} height={78} fill="#14532d" stroke={INK} strokeWidth={1.5} />
    <ellipse cx={1050} cy={318} rx={18} ry={13} fill="#b91c1c" stroke="#fef3c7" strokeWidth={2} />
    <text x={1050} y={323} textAnchor="middle" fontSize={13} fontWeight={900} fill="#fef3c7" fontFamily="sans-serif">VB</text>
    <text x={1050} y={346} textAnchor="middle" fontSize={7} fontWeight={900} fill="#fef3c7" fontFamily="sans-serif">VICTORIA</text>
    <text x={1050} y={356} textAnchor="middle" fontSize={7} fontWeight={900} fill="#fef3c7" fontFamily="sans-serif">BITTER</text>
    <rect x={1090} y={296} width={90} height={84} fill="#44403c" stroke={INK} strokeWidth={1.5} />
    {[306, 326, 346].map(y => <g key={y}><line x1={1092} y1={y + 12} x2={1178} y2={y + 12} stroke="#a8a29e" strokeWidth={2} />{[1098, 1110, 1122, 1134, 1146, 1158, 1170].map((x, i) => <rect key={x} x={x} y={y} width={6} height={12} rx={1} fill={["#16a34a", "#b45309", "#7c2d12", "#facc15", "#dc2626"][(i + y) % 5]} />)}</g>)}
    <rect x={1104} y={298} width={40} height={12} rx={3} fill="#111" stroke="#f472b6" strokeWidth={1.5} />
    <text x={1124} y={307.5} textAnchor="middle" fontSize={8} fontWeight={900} fill="#f472b6" fontFamily="sans-serif" className={styles.openSign}>OPEN</text>
    <rect x={1188} y={300} width={46} height={74} fill="#f5c518" stroke={INK} strokeWidth={1.5} />
    <text x={1211} y={330} textAnchor="middle" fontSize={13} fontWeight={900} fill="#c1121f" fontFamily="sans-serif">XXXX</text>
    <text x={1211} y={346} textAnchor="middle" fontSize={10} fontWeight={900} fill="#c1121f" fontFamily="sans-serif">GOLD</text>
    {/* Discount variety: roller door down, tagged */}
    <rect x={1260} y={288} width={230} height={92} fill="#9ca3af" stroke={INK} strokeWidth={2} />
    {Array.from({ length: 11 }, (_, i) => <line key={i} x1={1262} y1={294 + i * 8} x2={1488} y2={294 + i * 8} stroke="#6b7280" strokeWidth={1.5} />)}
    <Tag x={1290} y={344} color="#111" s={1.6} /><Tag x={1380} y={330} color="#2563eb" s={1.2} /><Tag x={1420} y={364} color="#111" s={0.9} />

    {/* ---- Street furniture ---- */}
    <rect x={0} y={380} width={1500} height={40} fill="#b9b4aa" />
    {Array.from({ length: 50 }, (_, i) => <line key={i} x1={i * 30} y1={380} x2={i * 30} y2={420} stroke="#a39e93" strokeWidth={1.5} />)}
    <rect x={0} y={380} width={1500} height={4} fill="#8f8a80" />
    {/* Bus shelter, bench, bin, stop sign */}
    <rect x={420} y={318} width={170} height={8} fill="#166534" stroke={INK} strokeWidth={1.5} />
    <path d="M426 326 V392 M584 326 V392" stroke="#166534" strokeWidth={5} />
    <rect x={432} y={326} width={148} height={46} fill="#bae6fd" opacity={0.45} stroke="#166534" strokeWidth={1} />
    <rect x={446} y={372} width={118} height={7} rx={2} fill="#78350f" stroke={INK} strokeWidth={1.2} />
    <path d="M452 379 v12 M558 379 v12" stroke={INK} strokeWidth={3} />
    <path d="M606 300 V400" stroke="#9ca3af" strokeWidth={4} />
    <rect x={596} y={300} width={22} height={26} rx={2} fill="#2563eb" stroke={INK} strokeWidth={1.2} />
    <text x={607} y={318} textAnchor="middle" fontSize={13} fontWeight={900} fill="#fff" fontFamily="sans-serif">7</text>
    <rect x={618} y={366} width={22} height={30} rx={3} fill="#166534" stroke={INK} strokeWidth={1.5} />
    {/* Scrappy street tree in a tree guard */}
    <g className={styles.stripTree}>
      <path d="M760 400 V300 M760 330 l-24 -26 M760 316 l20 -24 M760 350 l18 -14" stroke="#7c5a3a" strokeWidth={4} fill="none" strokeLinecap="round" />
      {[[736, 300], [782, 290], [760, 286], [748, 316], [776, 334]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={9} fill={i % 2 ? "#ca8a04" : "#a3a33a"} opacity={0.9} />)}
    </g>
    <rect x={748} y={388} width={24} height={12} fill="#78350f" />
    {/* Power pole, streetlight, sagging wires with a few birds */}
    <rect x={1146} y={40} width={12} height={360} fill="#8a7a5f" stroke={INK} strokeWidth={1.5} />
    <path d="M1120 70 h64 M1128 92 h48" stroke="#5b4636" strokeWidth={5} />
    <path d="M1152 60 q40 -40 110 -36" stroke="#9ca3af" strokeWidth={4} fill="none" />
    <ellipse cx={1268} cy={26} rx={16} ry={6} fill="#cbd5e1" stroke={INK} strokeWidth={1.2} />
    <path d="M0 140 Q560 170 1120 70 M0 110 Q560 136 1128 92 M1184 70 Q1350 92 1500 76 M1176 92 Q1340 120 1500 110" stroke="#1f2937" strokeWidth={2} fill="none" />
    {[[380, 152], [404, 151], [1330, 86]].map(([x, y], i) => <g key={i} className={styles.wireBird} style={{ animationDelay: `${-i * 0.7}s` }}><ellipse cx={x} cy={y - 5} rx={5} ry={4} fill="#1f2937" /><circle cx={x + 4} cy={y - 9} r={2.6} fill="#1f2937" /></g>)}
  </svg>;
}
