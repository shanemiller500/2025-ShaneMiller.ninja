import type React from "react";
import styles from "../day-out.module.css";
import { BarAndShield } from "./BikeLogos";

// The backdrop behind the road: a strip of tired old two-storey terrace shops, cartoon style.
// From the left: the Indian Motorcycle shop, the fish and chip shop, the milk bar, Centrelink, the
// Harley-Davidson shop (glaring back down the street at the Indian mob), the bottlo, and a big
// yellow Chemist Warehouse; a bus shelter, a power pole with sagging wires,
// and a back lane at each end (room for the flags and palms, and somewhere to extend the street to
// later). viewBox -650 0 2900 420. The Harley block is drawn at x -900..-450 and shifted +1900 (to
// 1000..1450); the bottlo is drawn at 1000..1250 and shifted +450 (to 1450..1700); the chemist
// sits at 1700..2050. The footpath runs along the bottom (y 380-420).
const INK = "#111";
// Round trig-derived coordinates: the server (Node) and the browser can disagree in the last few
// bits of Math.cos/Math.sin, which breaks hydration if the raw floats go into attributes.
const rd = (n: number) => Math.round(n * 100) / 100;

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
// A bike parked angled into the kerb, the way they line up outside a dealer: front wheel turned
// out towards the street (a tall chrome-spoked ellipse), forks, headlight and bars up top, tank,
// seat and rear wheel tucked in behind. (x, y) is where the front tyre meets the footpath; the bike
// runs back up-left (up-right with `flip`). `fairing` adds a batwing fairing and a saddlebag.
function AngledBike({ x, y, color, s = 1, flip = false, fairing = false }: { x: number; y: number; color: string; s?: number; flip?: boolean; fairing?: boolean }) {
  const spokes = Array.from({ length: 10 }, (_, i) => (i * Math.PI) / 5);
  return <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
    <ellipse cx={-30} cy={-16} rx={8} ry={14} fill="#111" /><ellipse cx={-30} cy={-16} rx={4} ry={8} fill="#6b7280" />
    <path d="M-44 -8 L-14 -14" stroke="#e5e7eb" strokeWidth={3} strokeLinecap="round" />
    <path d="M-40 -22 Q-31 -36 -20 -27" stroke={color} strokeWidth={5} fill="none" strokeLinecap="round" />
    {fairing && <rect x={-48} y={-34} width={18} height={14} rx={4} fill={color} stroke={INK} strokeWidth={1.2} />}
    <path d="M-20 -32 L-2 -32 L2 -18 L-16 -13 Z" fill="#374151" stroke={INK} strokeWidth={1} />
    <path d="M-16 -32 l3 -6 h5 l-2 6 M-8 -32 l3 -6 h5 l-2 6" stroke="#e5e7eb" strokeWidth={2.5} fill="none" />
    <path d="M-38 -36 Q-26 -43 -14 -39 L-12 -34 Q-24 -32 -38 -32 Z" fill="#111" />
    <path d="M-16 -42 Q-5 -53 7 -45 Q3 -36 -14 -36 Z" fill={color} stroke={INK} strokeWidth={1.2} />
    {/* Front wheel, turned out to the street */}
    <ellipse cx={0} cy={-16} rx={9} ry={16} fill="#cbd5e1" stroke="#111" strokeWidth={4} />
    {spokes.map(a => <line key={a} x1={0} y1={-16} x2={rd(Math.cos(a) * 7)} y2={rd(-16 + Math.sin(a) * 13.5)} stroke="#64748b" strokeWidth={0.8} />)}
    <circle cx={0} cy={-16} r={2.2} fill="#f8fafc" stroke={INK} strokeWidth={0.8} />
    <path d="M-9 -25 Q0 -37 9 -25" stroke={color} strokeWidth={4} fill="none" />
    <path d="M-2 -16 L-4 -50 M2 -16 L1 -50" stroke="#e5e7eb" strokeWidth={2.2} />
    {fairing
      ? <><path d="M-17 -46 Q-2 -64 15 -48 Q2 -40 -17 -46 Z" fill={color} stroke={INK} strokeWidth={1.2} /><path d="M-12 -55 Q-2 -70 10 -57 L8 -52 Q-2 -60 -10 -50 Z" fill="#94a3b8" opacity={0.6} /><circle cx={-1} cy={-47} r={3.5} fill="#f8fafc" stroke={INK} strokeWidth={0.8} /></>
      : <><circle cx={-2} cy={-48} r={5} fill="#f8fafc" stroke={INK} strokeWidth={1} /><circle cx={-2} cy={-48} r={2.4} fill="#fde68a" /></>}
    <path d="M-15 -57 L13 -59" stroke="#111" strokeWidth={2.5} strokeLinecap="round" />
    <path d="M-14 -57 l-2 -6 M12 -59 l2 -6" stroke="#9ca3af" strokeWidth={1} /><circle cx={-16} cy={-64} r={2} fill="#d1d5db" stroke={INK} strokeWidth={0.6} /><circle cx={14} cy={-66} r={2} fill="#d1d5db" stroke={INK} strokeWidth={0.6} />
  </g>;
}
// The Indian window showbike: a red custom Scout bobber. Cream whitewalls on red rims, red frame
// and springer forks, red tank with the script, floating brown saddle, V-twin, wrapped pipes.
// (x, y) is the back of the rear tyre on the ground; faces right; about 130 long at s=1.
function ScoutBobber({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const RED = "#c1121f", wheel = (cx: number) => <g>
    <circle cx={cx} cy={-20} r={20} fill="#f3e6c8" stroke={INK} strokeWidth={1.5} />
    <circle cx={cx} cy={-20} r={15} fill="#1f2937" stroke={RED} strokeWidth={2.5} />
    {Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6; return <line key={i} x1={cx} y1={-20} x2={rd(cx + Math.cos(a) * 14)} y2={rd(-20 + Math.sin(a) * 14)} stroke="#e5e7eb" strokeWidth={0.7} />; })}
    <circle cx={cx} cy={-20} r={3} fill={RED} stroke={INK} strokeWidth={0.8} />
  </g>;
  return <g transform={`translate(${x} ${y}) scale(${s})`}>
    {wheel(20)}{wheel(110)}
    <circle cx={20} cy={-20} r={7} fill="none" stroke="#9ca3af" strokeWidth={2} />
    <path d="M4 -30 Q18 -44 34 -36" stroke={RED} strokeWidth={4} fill="none" strokeLinecap="round" />
    <path d="M20 -20 L46 -50 L92 -56 L110 -20 M46 -50 L56 -18 L20 -20" stroke={RED} strokeWidth={4} fill="none" strokeLinejoin="round" />
    <path d="M44 -24 h36 l-4 13 h-27 z" fill="#111" stroke={INK} strokeWidth={1} />
    <path d="M50 -28 l-7 -20 h11 l5 20 z M68 -28 l5 -20 h11 l-6 20 z" fill="#374151" stroke={INK} strokeWidth={1} />
    <path d="M46 -44 h10 M47 -38 h10 M74 -44 h10 M73 -38 h10" stroke="#9ca3af" strokeWidth={1.2} />
    <circle cx={64} cy={-28} r={6} fill="#e5e7eb" stroke={INK} strokeWidth={1} />
    <path d="M58 -24 Q40 -10 16 -30" stroke="#e7d5b0" strokeWidth={5} fill="none" strokeLinecap="round" />
    <path d="M58 -24 Q40 -10 16 -30" stroke="#c9b48c" strokeWidth={5} fill="none" strokeDasharray="1.5 2.5" />
    <path d="M16 -30 l-10 -4" stroke="#111" strokeWidth={4} strokeLinecap="round" />
    <path d="M48 -58 Q66 -71 90 -61 Q86 -50 54 -50 Z" fill={RED} stroke={INK} strokeWidth={1.2} />
    <text x={69} y={-55} textAnchor="middle" fontSize={7} fontStyle="italic" fontWeight={900} fill="#f3e6c8" fontFamily="'Brush Script MT', 'Segoe Script', cursive">Indian</text>
    <path d="M26 -57 Q37 -64 47 -57 Q39 -52 28 -53 Z" fill="#a0703f" stroke={INK} strokeWidth={1} /><path d="M34 -53 v6 M40 -53 v6" stroke="#9ca3af" strokeWidth={1.2} />
    <path d="M110 -20 L100 -66 M104 -20 L96 -64" stroke={RED} strokeWidth={3} />
    <path d="M90 -70 l16 -4" stroke="#111" strokeWidth={2.5} strokeLinecap="round" />
    <circle cx={106} cy={-61} r={4.5} fill="#f8fafc" stroke={INK} strokeWidth={1} />
    <path d="M96 -26 Q110 -40 124 -28" stroke={RED} strokeWidth={3} fill="none" />
  </g>;
}
// The Harley window showbike: a CVO Road Glide bagger in gunmetal and lime. Shark-nose fairing with
// twin headlights, long hard bags, black wheels with green pinstripes, big chrome V-twin.
// (x, y) is the back of the rear tyre; faces right (left with `flip`); about 150 long at s=1.
function RoadGlide({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) {
  const GREY = "#3f3f46", LIME = "#a3b82a", wheel = (cx: number, r: number) => <g>
    <circle cx={cx} cy={-r} r={r} fill="#111" />
    <circle cx={cx} cy={-r} r={r - 5} fill="#27272a" stroke={LIME} strokeWidth={1.2} />
    {Array.from({ length: 6 }, (_, i) => { const a = (i * Math.PI) / 3; return <line key={i} x1={cx} y1={-r} x2={rd(cx + Math.cos(a) * (r - 6))} y2={rd(-r + Math.sin(a) * (r - 6))} stroke="#52525b" strokeWidth={2.5} />; })}
    <circle cx={cx} cy={-r} r={4} fill="#a1a1aa" stroke={INK} strokeWidth={0.8} />
  </g>;
  return <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})${flip ? " translate(-150 0)" : ""}`}>
    {wheel(24, 20)}{wheel(126, 21)}
    <circle cx={126} cy={-21} r={9} fill="none" stroke="#d4d4d8" strokeWidth={2} />
    <path d="M40 -18 L-6 -22 M44 -13 L-4 -16" stroke="#e5e7eb" strokeWidth={4} strokeLinecap="round" />
    <path d="M64 -24 h36 l-4 12 h-28 z" fill="#18181b" stroke={INK} strokeWidth={1} />
    <path d="M70 -28 l-4 -18 h12 l2 18 z M86 -28 l4 -18 h12 l-4 18 z" fill="#52525b" stroke={INK} strokeWidth={1} />
    <circle cx={88} cy={-36} r={6} fill="#d4d4d8" stroke={INK} strokeWidth={1} />
    <path d="M0 -34 Q2 -50 20 -52 H62 L58 -26 Q30 -20 6 -26 Z" fill={GREY} stroke={INK} strokeWidth={1.4} />
    <path d="M6 -40 Q30 -44 58 -42" stroke={LIME} strokeWidth={4} fill="none" />
    <path d="M10 -32 h18" stroke="#a1a1aa" strokeWidth={1.5} />
    <path d="M50 -56 Q64 -63 80 -58 L82 -51 H50 Z" fill="#111" />
    <path d="M80 -60 Q96 -69 112 -62 L108 -51 H82 Z" fill={GREY} stroke={INK} strokeWidth={1.2} />
    <path d="M84 -58 Q96 -63 108 -59" stroke={LIME} strokeWidth={2.5} fill="none" />
    <path d="M126 -21 L114 -64" stroke="#18181b" strokeWidth={5} />
    <path d="M110 -30 Q126 -47 142 -30" stroke={GREY} strokeWidth={5} fill="none" />
    <path d="M106 -54 Q112 -80 132 -76 Q147 -72 147 -60 Q140 -49 116 -50 Z" fill={GREY} stroke={INK} strokeWidth={1.4} />
    <path d="M112 -60 Q128 -67 145 -62" stroke={LIME} strokeWidth={3} fill="none" />
    <circle cx={139} cy={-66} r={3} fill="#f8fafc" stroke={INK} strokeWidth={0.8} /><circle cx={143} cy={-58} r={2.5} fill="#f8fafc" stroke={INK} strokeWidth={0.8} />
    <path d="M114 -76 Q119 -89 132 -85 L131 -76 Z" fill="#94a3b8" opacity={0.65} stroke={INK} strokeWidth={0.8} />
  </g>;
}
// The big cream feather-wing decal on the Indian showroom glass.
function FeatherWing({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`} opacity={0.88}>
    <path d="M0 40 Q120 -10 330 6 Q250 20 230 34 Q170 44 60 52 Z" fill="#f3e6c8" />
    {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${40 + i * 20} ${46 - i * 1.4} l${18} ${-26 + i * 0.6}`} stroke="#1e293b" strokeWidth={2} />)}
    <text x={150} y={42} textAnchor="middle" fontSize={20} fontWeight={900} fontStyle="italic" fill="#7f1d1d" fontFamily="'Brush Script MT', 'Segoe Script', cursive">Indian</text>
  </g>;
}

// Shop flags. Each shop has a few designs and runs a different one up the pole each day (UTC day,
// so the server and the browser agree). 66×42, hoisted at (x, y) on the pole.

// An n-pointed star (the Commonwealth Star has 7 points, the Southern Cross stars have 7 and 5).
const starPath = (cx: number, cy: number, r: number, n: number) => Array.from({ length: n * 2 }, (_, i) => {
  const a = (i * Math.PI) / n - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
  return `${i ? "L" : "M"}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`;
}).join(" ") + " Z";
// The Australian flag at 66×42: Union Jack in the canton, the Commonwealth Star under it, the
// Southern Cross on the fly. `harley` slaps the bar & shield across the middle (the Aussie H-D flag).
function AusFlag({ harley = false }: { harley?: boolean }) {
  return <>
    <rect width={66} height={42} fill="#012169" />
    <path d="M0 0 L33 21 M33 0 L0 21" stroke="#fff" strokeWidth={4.2} />
    <path d="M0 0 L33 21 M33 0 L0 21" stroke="#c8102e" strokeWidth={1.4} />
    <path d="M16.5 0 V21 M0 10.5 H33" stroke="#fff" strokeWidth={7} />
    <path d="M16.5 0 V21 M0 10.5 H33" stroke="#c8102e" strokeWidth={4.2} />
    <path d={starPath(16.5, 31.5, 5.2, 7)} fill="#fff" />
    <path d={starPath(49.5, 35, 2.6, 7)} fill="#fff" />
    <path d={starPath(49.5, 7.5, 2.6, 7)} fill="#fff" />
    <path d={starPath(41.5, 18, 2.6, 7)} fill="#fff" />
    <path d={starPath(57, 16, 2.6, 7)} fill="#fff" />
    <path d={starPath(53, 23, 1.4, 5)} fill="#fff" />
    {harley && <BarAndShield cx={34} cy={22} s={0.34} />}
  </>;
}
// `design` pins a flag to one design; otherwise it rotates daily. The Harley shop's first pole always
// flies the Aussie Harley flag (design 3), so its second pole rotates through the other three.
function ShopFlag({ x, y, brand, slot, design: pinned }: { x: number; y: number; brand: "harley" | "indian"; slot: number; design?: number }) {
  const design = pinned ?? (Math.floor(Date.now() / 86_400_000) + slot) % (brand === "harley" ? 3 : 4);
  let body: React.ReactNode;
  if (brand === "harley") body = [
    <><rect width={66} height={42} fill="#111" /><BarAndShield cx={33} cy={21} s={0.5} /></>,
    <><rect width={66} height={42} fill="#f97316" /><rect y={34} width={66} height={8} fill="#111" /><BarAndShield cx={33} cy={19} s={0.42} /></>,
    <><rect width={66} height={42} fill="#111" /><path d="M8 26 Q20 8 33 18 Q46 8 58 26 Q46 20 33 26 Q20 20 8 26 Z" fill="#f97316" /><text x={33} y={37} textAnchor="middle" fontSize={7.5} fontWeight={900} fill="#f97316" fontFamily="Impact, sans-serif">HARLEY-DAVIDSON</text><text x={33} y={12} textAnchor="middle" fontSize={6} fontWeight={900} fill="#fff" fontFamily="sans-serif">EST. 1903</text></>,
    <AusFlag harley />,
  ][design];
  else body = [
    <><rect width={66} height={42} fill="#b91c1c" /><text x={33} y={27} textAnchor="middle" fontSize={20} fontStyle="italic" fontWeight={900} fill="#f3e6c8" fontFamily="'Brush Script MT', 'Segoe Script', cursive">Indian</text><text x={33} y={37} textAnchor="middle" fontSize={5.5} fontWeight={900} fill="#f3e6c8" fontFamily="sans-serif" letterSpacing={2}>MOTORCYCLE</text></>,
    <><rect width={66} height={42} fill="#f3e6c8" /><g transform="translate(4 4) scale(0.18)"><path d="M0 40 Q120 -10 330 6 Q250 20 230 34 Q170 44 60 52 Z" fill="#7f1d1d" /></g><text x={33} y={34} textAnchor="middle" fontSize={17} fontStyle="italic" fontWeight={900} fill="#b91c1c" fontFamily="'Brush Script MT', 'Segoe Script', cursive">Indian</text></>,
    <><rect width={66} height={42} fill="#111" /><text x={33} y={24} textAnchor="middle" fontSize={18} fontStyle="italic" fontWeight={900} fill="#c1121f" fontFamily="'Brush Script MT', 'Segoe Script', cursive">Indian</text><circle cx={33} cy={33} r={6} fill="#7f1d1d" stroke="#f3e6c8" strokeWidth={1} /><text x={33} y={35} textAnchor="middle" fontSize={4.5} fontWeight={900} fill="#f3e6c8" fontFamily="sans-serif">1901</text></>,
    <><rect width={66} height={21} fill="#b91c1c" /><rect y={21} width={66} height={21} fill="#f3e6c8" /><text x={33} y={17} textAnchor="middle" fontSize={15} fontStyle="italic" fontWeight={900} fill="#f3e6c8" fontFamily="'Brush Script MT', 'Segoe Script', cursive">Indian</text><text x={33} y={34} textAnchor="middle" fontSize={7} fontWeight={900} fill="#7f1d1d" fontFamily="sans-serif" letterSpacing={2}>MOTORCYCLE</text></>,
  ][design];
  return <g transform={`translate(${x} ${y})`}>
    <g className={styles.flagWave} style={{ animationDelay: `${-slot * 0.45}s` }}>{body}<rect width={66} height={42} fill="none" stroke={INK} strokeWidth={1.2} /></g>
  </g>;
}

// A back lane at the end of the shops, drawn in a 200-wide slot and open to the sky: the corner of
// the next building along (x 0..46), then the lane running back between the two buildings' side
// walls (in perspective, to a vanishing point) to a paling fence and far-off rooftops. The shop's
// own wall is at x=200, its roof at `wallTop`, side wall in `wallColor`. `flip` mirrors it for the
// right-hand end. No text in here (it would read backwards when flipped).
function Alley({ x, flip = false, wallTop, wallColor }: { x: number; flip?: boolean; wallTop: number; wallColor: string }) {
  const vx = 123, vy = 262, backL = 92, backR = 154;
  // Where a line from (x0, y0) towards the vanishing point crosses x = xt.
  const toward = (x0: number, y0: number, xt: number) => y0 + (vy - y0) * ((xt - x0) / (vx - x0));
  const lTop = toward(46, 110, backL), lBot = toward(46, 380, backL), rTop = toward(200, wallTop, backR), rBot = toward(200, 380, backR);
  return <g transform={flip ? `translate(${x + 200} 0) scale(-1 1)` : `translate(${x} 0)`}>
    {/* Far end of the lane: rooftops and a gum poking up behind a paling fence */}
    <path d={`M${backL} 262 h18 l8 -8 h14 l6 8 h${backR - backL - 46} V${lBot} H${backL} Z`} fill="#94a3b8" stroke={INK} strokeWidth={1} />
    <circle cx={136} cy={250} r={10} fill="#3d7a50" stroke={INK} strokeWidth={1} /><circle cx={144} cy={256} r={8} fill="#2f6643" />
    <rect x={backL} y={284} width={backR - backL} height={lBot - 284} fill="#a07a52" stroke={INK} strokeWidth={1} />
    {Array.from({ length: 9 }, (_, i) => <line key={i} x1={backL + 3 + i * 7} y1={284} x2={backL + 3 + i * 7} y2={lBot} stroke="#7c5a3a" strokeWidth={1} />)}
    {/* The lane itself, with a faded centre line */}
    <path d={`M46 380 H200 L${backR} ${rBot} H${backL} Z`} fill="#4b4f57" />
    <path d={`M123 380 L123 ${lBot}`} stroke="#e5e7eb" strokeWidth={1.5} strokeDasharray="8 8" opacity={0.45} />
    {/* Side wall of the building across the lane: brick, in shade */}
    <path d={`M46 110 L${backL} ${lTop} V${lBot} L46 380 Z`} fill="#8a3b1c" stroke={INK} strokeWidth={1.5} />
    {[140, 170, 200, 230, 260, 290, 320, 350].map(y => <line key={y} x1={46} y1={y} x2={backL} y2={toward(46, y, backL)} stroke="#6f2f16" strokeWidth={1} />)}
    <path d={`M58 ${toward(46, 180, 58)} L74 ${toward(46, 180, 74)} V${toward(46, 230, 74)} L58 ${toward(46, 230, 58)} Z`} fill="#1e293b" stroke={INK} strokeWidth={1} />
    <path d="M56 236 q8 -10 14 2 t12 -4" stroke="#a855f7" strokeWidth={2.5} fill="none" />
    {/* Side wall of the shop: same colour as its front, in shade, with a downpipe and a lamp */}
    <path d={`M200 ${wallTop} L${backR} ${rTop} V${rBot} L200 380 Z`} fill={wallColor} stroke={INK} strokeWidth={1.5} />
    <path d={`M200 ${wallTop} L${backR} ${rTop} V${rBot} L200 380 Z`} fill="#000" opacity={0.28} />
    {[120, 170, 220, 270, 320].map(y => <line key={y} x1={200} y1={y} x2={backR} y2={toward(200, y, backR)} stroke="#000" strokeWidth={1} opacity={0.25} />)}
    <path d={`M190 ${toward(200, wallTop, 190) + 4} V${toward(200, 378, 190)}`} stroke="#6b7280" strokeWidth={3} />
    <path d="M200 196 l-12 2 v6" stroke="#4b5563" strokeWidth={2.5} fill="none" /><ellipse cx={188} cy={206} rx={6} ry={3} fill="#fde68a" className={styles.officeLight} />
    <path d="M178 230 l-12 9 l11 4 l-9 8" stroke="#facc15" strokeWidth={2} fill="none" />
    {/* A skip bin against the shop wall, a milk crate on the other side */}
    <path d="M148 352 h32 l-3 26 h-26 z" fill="#15803d" stroke={INK} strokeWidth={1.4} />
    <path d="M146 352 h36 l-4 -6 h-28 z" fill="#166534" stroke={INK} strokeWidth={1.2} />
    <rect x={64} y={358} width={16} height={14} fill="#dc2626" stroke={INK} strokeWidth={1} />
    {/* The next building along: just its front corner, cut off by the edge of the world */}
    <rect x={-10} y={110} width={56} height={270} fill="url(#sfBrickRed)" stroke={INK} strokeWidth={2.5} />
    <rect x={-14} y={102} width={64} height={12} fill="#c96b3d" stroke={INK} strokeWidth={2} />
    <rect x={4} y={150} width={28} height={40} fill="#cbe4f5" stroke={INK} strokeWidth={1.5} />
    <path d="M18 150 v40 M4 170 h28" stroke={INK} strokeWidth={1} />
    <rect x={-10} y={290} width={56} height={90} fill="#57534e" stroke={INK} strokeWidth={1.5} />
    <rect x={2} y={300} width={32} height={74} fill="#78716c" stroke={INK} strokeWidth={1} />
  </g>;
}
// Footpath crossover where the lane meets the road, and the kerb on the far side of it.
function LaneCrossing({ x, flip = false }: { x: number; flip?: boolean }) {
  return <g transform={flip ? `translate(${x + 200} 0) scale(-1 1)` : `translate(${x} 0)`}>
    <path d="M56 380 H190 L198 420 H48 Z" fill="#8f8a80" />
    <path d="M56 380 L48 420 M190 380 L198 420" stroke="#6b665d" strokeWidth={2} />
    {[392, 404].map(y => <line key={y} x1={56} y1={y} x2={192} y2={y} stroke="#7d786f" strokeWidth={1} />)}
    {/* Bollard on the corner */}
    <rect x={40} y={386} width={8} height={22} rx={3} fill="#facc15" stroke={INK} strokeWidth={1.2} />
  </g>;
}
// A blue-and-white Aussie street-name sign on a pole.
function LaneSign({ x, name }: { x: number; name: string }) {
  return <g>
    <path d={`M${x} 404 V262`} stroke="#9ca3af" strokeWidth={4} />
    <rect x={x - 44} y={248} width={88} height={20} rx={3} fill="#1e3a8a" stroke="#f8fafc" strokeWidth={2} />
    <text x={x} y={262} textAnchor="middle" fontSize={11} fontWeight={900} fill="#f8fafc" fontFamily="sans-serif" letterSpacing={1}>{name}</text>
  </g>;
}

// A window poster: a coloured panel with stacked lines of text, each [text, size].
function Poster({ x, y, w, h, bg, fg, lines }: { x: number; y: number; w: number; h: number; bg: string; fg: string; lines: [string, number][] }) {
  const total = lines.reduce((sum, [, size]) => sum + size * 1.05, 0);
  let at = y + (h - total) / 2;
  return <g>
    <rect x={x} y={y} width={w} height={h} fill={bg} stroke={INK} strokeWidth={1} />
    {lines.map(([text, size], i) => { at += size * 1.05; return <text key={i} x={x + w / 2} y={at - size * 0.18} textAnchor="middle" fontSize={size} fontWeight={900} fill={fg} fontFamily="Impact, 'Arial Black', sans-serif">{text}</text>; })}
  </g>;
}

// `sky={false}` leaves the sky transparent so a separate sky layer (with the jets in it) shows
// through behind the buildings.
export default function Shopfronts({ sky = true }: { sky?: boolean }) {
  return <svg viewBox="-650 0 2900 420" width="100%" height="100%" preserveAspectRatio="xMidYMax slice" aria-hidden>
    <defs>
      <linearGradient id="sfSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f80d1" /><stop offset="1" stopColor="#8cc4f0" /></linearGradient>
      <pattern id="sfBrickRed" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#b4532a" /><path d="M0 12 H24 M12 0 V6 M0 6 H24 M0 6 V12 M24 6 V12" stroke="#8a3b1c" strokeWidth={1} /></pattern>
      <pattern id="sfBrickOrange" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#c2410c" /><path d="M0 12 H24 M12 0 V6 M0 6 H24 M0 6 V12 M24 6 V12" stroke="#9a3412" strokeWidth={1} /></pattern>
      <pattern id="sfBrickDark" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#2b2f36" /><path d="M0 12 H24 M12 0 V6 M0 6 H24 M0 6 V12 M24 6 V12" stroke="#1b1e23" strokeWidth={1} /></pattern>
    </defs>
    {sky && <rect x={-650} width="2900" height="420" fill="url(#sfSky)" />}
    <g className={styles.stripCloud}><ellipse cx={150} cy={70} rx={60} ry={22} fill="#fff" /><ellipse cx={190} cy={62} rx={40} ry={20} fill="#fff" /></g>
    <g className={styles.stripCloud} style={{ animationDelay: "-30s" }}><ellipse cx={900} cy={40} rx={50} ry={16} fill="#fff" opacity={0.9} /></g>

    <g transform="translate(1900 0)">
    {/* Harley-Davidson: orange-brick block with a tall black tower and the bar & shield up top */}
    <rect x={-900} y={18} width={120} height={362} fill="#1c1c1e" stroke={INK} strokeWidth={2.5} />
    {[-880, -860, -840, -820, -800].map(x => <line key={x} x1={x} y1={22} x2={x} y2={378} stroke="#2a2a2e" strokeWidth={2} />)}
    <BarAndShield cx={-840} cy={92} s={1.15} />
    <path d="M-760 76 V6 M-540 76 V6" stroke="#9ca3af" strokeWidth={3} /><circle cx={-760} cy={5} r={3} fill="#facc15" /><circle cx={-540} cy={5} r={3} fill="#facc15" />
    <ShopFlag x={-758} y={8} brand="harley" slot={0} design={3} />
    <ShopFlag x={-538} y={8} brand="harley" slot={1} />
    <rect x={-780} y={84} width={330} height={296} fill="url(#sfBrickOrange)" stroke={INK} strokeWidth={2.5} />
    <rect x={-786} y={76} width={342} height={12} fill="#1c1c1e" stroke={INK} strokeWidth={2} />
    <rect x={-770} y={150} width={310} height={40} fill="#111" stroke={INK} strokeWidth={2} />
    <text x={-615} y={177} textAnchor="middle" fontSize={22} fontWeight={900} fill="#f97316" fontFamily="Impact, sans-serif" letterSpacing={2}>HARLEY-DAVIDSON</text>
    <text x={-615} y={142} textAnchor="middle" fontSize={10} fontWeight={900} fill="#fde68a" fontFamily="sans-serif" letterSpacing={3}>BIKES · GEAR · SERVICE</text>
    {/* Black-glass showroom with the bikes lined up inside */}
    <rect x={-770} y={200} width={310} height={176} fill="#0f172a" stroke={INK} strokeWidth={2.5} />
    <path d="M-690 204 L-735 362 H-640 Z M-540 204 L-590 362 H-495 Z" fill="#fde68a" opacity={0.13} />
    <rect x={-720} y={360} width={210} height={14} rx={3} fill="#111" stroke={INK} strokeWidth={1.5} />
    <rect x={-720} y={360} width={210} height={3} fill="#f97316" />
    <ellipse cx={-615} cy={360} rx={92} ry={5} fill="#f8fafc" opacity={0.12} />
    <RoadGlide x={-701} y={360} s={1.15} flip />
    {[-700, -620, -540].map(x => <line key={x} x1={x} y1={200} x2={x} y2={376} stroke="#334155" strokeWidth={3} opacity={0.7} />)}
    <path d="M-760 210 l60 -6 M-600 214 l70 -8" stroke="#ffffff22" strokeWidth={8} />
    <rect x={-770} y={196} width={310} height={6} fill="#f97316" />

    </g>

    {/* Indian Motorcycle: sleek black dealership, red script, cream lettering, big glass showroom */}
    <rect x={-450} y={56} width={450} height={324} fill="#111" stroke={INK} strokeWidth={2.5} />
    {Array.from({ length: 14 }, (_, i) => <line key={i} x1={-440 + i * 32} y1={60} x2={-440 + i * 32} y2={160} stroke="#1f1f22" strokeWidth={2} />)}
    <text x={-215} y={128} textAnchor="middle" fontSize={62} fontWeight={900} fontStyle="italic" fill="#c1121f" stroke="#7f1d1d" strokeWidth={1.5} fontFamily="'Brush Script MT', 'Segoe Script', cursive">Indian</text>
    <text x={-215} y={152} textAnchor="middle" fontSize={14} fontWeight={900} fill="#f3e6c8" fontFamily="sans-serif" letterSpacing={7}>MOTORCYCLE</text>
    <circle cx={-405} cy={108} r={28} fill="#7f1d1d" stroke="#f3e6c8" strokeWidth={3} />
    <text x={-405} y={103} textAnchor="middle" fontSize={9} fontWeight={900} fill="#f3e6c8" fontFamily="sans-serif">EST.</text>
    <text x={-405} y={118} textAnchor="middle" fontSize={14} fontWeight={900} fill="#f3e6c8" fontFamily="sans-serif">1901</text>
    {/* The showroom: lit glass, a showbike on a plinth, the big cream feather-wing decal */}
    <rect x={-440} y={170} width={360} height={206} fill="#1e293b" stroke={INK} strokeWidth={2.5} />
    {[-420, -360, -300, -240, -180, -120].map(x => <rect key={x} x={x} y={176} width={20} height={4} rx={2} fill="#fef9c3" className={styles.officeLight} />)}
    <path d="M-440 340 h360" stroke="#475569" strokeWidth={2} />
    <ellipse cx={-265} cy={366} rx={90} ry={10} fill="#f8fafc" opacity={0.18} />
    <rect x={-350} y={352} width={170} height={14} rx={4} fill="#c1121f" stroke={INK} strokeWidth={1.5} />
    <ScoutBobber x={-333} y={352} s={1.05} />
    <FeatherWing x={-420} y={196} />
    <path d="M-430 186 l80 -4 M-200 300 l90 -10" stroke="#ffffff1a" strokeWidth={10} />
    {/* Roof flags */}
    <path d="M-440 56 V4 M-60 56 V4" stroke="#9ca3af" strokeWidth={3} /><circle cx={-440} cy={4} r={3} fill="#facc15" /><circle cx={-60} cy={4} r={3} fill="#facc15" />
    <ShopFlag x={-438} y={6} brand="indian" slot={0} />
    <ShopFlag x={-58} y={6} brand="indian" slot={2} />
    {/* Glass door */}
    <rect x={-70} y={210} width={56} height={166} fill="#334155" stroke={INK} strokeWidth={2} />
    <path d="M-42 210 v166" stroke={INK} strokeWidth={1.5} />
    <rect x={-66} y={290} width={8} height={30} rx={2} fill="#c1121f" />

    {/* ---- Back lanes at each end ---- */}
    <Alley x={-650} wallTop={56} wallColor="#1c1c1e" />
    <Alley x={2050} flip wallTop={110} wallColor="#fcd116" />
    {/* ---- The six terraces ---- */}
    {/* 0: painted brick, the fish and chip shop */}
    <rect x={0} y={90} width={250} height={290} fill="#f1f5f9" stroke={INK} strokeWidth={2.5} />
    {Array.from({ length: 11 }, (_, i) => <line key={i} x1={2} y1={102 + i * 12} x2={248} y2={102 + i * 12} stroke="#e2e8f0" strokeWidth={1} />)}
    <rect x={-4} y={82} width={258} height={12} fill="#1d4ed8" stroke={INK} strokeWidth={2} />
    <Window x={60} y={130} /><Window x={150} y={130} curtain="#fde68a" />
    {/* 1: red brick, MILKO (next door to Centrelink) */}
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
    <g transform="translate(450 0)">
    {/* 4: sage green 1926 */}
    <path d="M1000 380 V84 h60 q65 -46 130 0 h60 V380 Z" fill="#c7d3a8" stroke={INK} strokeWidth={2.5} />
    <text x={1125} y={68} textAnchor="middle" fontSize={16} fontWeight={900} fill="#7c8a5c" fontFamily="sans-serif">1926</text>
    <path d="M1030 120 q10 20 0 40 M1220 150 q-12 16 -4 30" stroke="#a7b386" strokeWidth={4} fill="none" />
    <Window x={1062} y={132} /><Window x={1150} y={132} curtain="#fecaca" />
    </g>

    {/* ---- Signs ---- */}
    <g transform="translate(250 0)">
      <rect x={4} y={228} width={242} height={40} fill="#f8fafc" stroke={INK} strokeWidth={2} />
      <text x={70} y={258} textAnchor="middle" fontSize={26} fontWeight={900} fill="#dc2626" fontFamily="sans-serif">MILKO</text>
      <text x={180} y={246} textAnchor="middle" fontSize={11} fontWeight={900} fill="#1d4ed8" fontFamily="sans-serif">MILK BAR</text>
      <text x={180} y={260} textAnchor="middle" fontSize={10} fontWeight={800} fill="#1d4ed8" fontFamily="sans-serif">CONVENIENCE</text>
    </g>
    {/* Fish and chips: blue sign, a big golden fish, yellow letters */}
    <rect x={4} y={226} width={242} height={44} rx={4} fill="#1d4ed8" stroke={INK} strokeWidth={2} />
    <path d="M14 248 l-8 -9 v18 z" fill="#f59e0b" stroke={INK} strokeWidth={1} />
    <ellipse cx={34} cy={248} rx={20} ry={11} fill="#fbbf24" stroke={INK} strokeWidth={1.5} />
    <path d="M28 240 q-4 8 0 16 M36 239 q-4 9 0 18" stroke="#d97706" strokeWidth={1.2} fill="none" />
    <circle cx={46} cy={245} r={2.6} fill="#fff" stroke={INK} strokeWidth={0.8} /><circle cx={46.6} cy={245} r={1.2} fill={INK} />
    <text x={146} y={254} textAnchor="middle" fontSize={25} fontWeight={900} fill="#fde047" stroke={INK} strokeWidth={1} fontFamily="Impact, 'Arial Black', sans-serif" letterSpacing={1}>{"FISH & CHIPS"}</text>
    <text x={146} y={265} textAnchor="middle" fontSize={6.5} fontWeight={900} fill="#f8fafc" fontFamily="sans-serif" letterSpacing={1}>{"HOT CHIPS · POTATO SCALLOPS · DIM SIMS"}</text>
    <rect x={504} y={228} width={492} height={40} fill="#1e293b" stroke={INK} strokeWidth={2} />
    <circle cx={556} cy={248} r={11} fill="none" stroke="#5eead4" strokeWidth={3} strokeDasharray="6 3" />
    <text x={700} y={258} textAnchor="middle" fontSize={26} fontWeight={900} fill="#f8fafc" fontFamily="sans-serif" letterSpacing={2}>CENTRELINK</text>
    <text x={900} y={252} textAnchor="middle" fontSize={11} fontWeight={800} fill="#cbd5e1" fontFamily="sans-serif">TAKE A NUMBER</text>
    <g transform="translate(450 0)">
    <rect x={1004} y={228} width={242} height={40} fill="#2f5d4a" stroke={INK} strokeWidth={2} />
    <text x={1095} y={258} textAnchor="middle" fontSize={24} fontWeight={900} fill="#fef3c7" fontFamily="sans-serif" letterSpacing={1}>THE BOTTLO</text>
    <ellipse cx={1210} cy={248} rx={22} ry={15} fill="#b91c1c" stroke="#fef3c7" strokeWidth={2} />
    <text x={1210} y={254} textAnchor="middle" fontSize={15} fontWeight={900} fill="#fef3c7" fontFamily="sans-serif">VB</text>
    </g>
    {/* Peeling paint on the milk bar's old board */}
    <path d="M480 262 l-12 -8 l-4 6" stroke="#a8a29e" strokeWidth={2} fill="none" />

    {[0, 250, 1450].map(x => <Awning key={x} x={x + 2} w={246} />)}

    {/* ---- Shopfronts ---- */}
    {/* Milk bar: posters, door, the board */}
    <g transform="translate(250 0)">
    <rect x={10} y={288} width={230} height={92} fill="#1f2937" stroke={INK} strokeWidth={2} />
    <rect x={18} y={296} width={60} height={80} fill="#bfdbfe" stroke={INK} strokeWidth={1.5} />
    {[[22, 300, "#dc2626"], [44, 318, "#f59e0b"], [24, 340, "#16a34a"], [52, 352, "#dc2626"]].map(([x, y, c], i) => <rect key={i} x={x as number} y={y as number} width={20} height={16} fill={c as string} stroke={INK} strokeWidth={0.8} />)}
    <rect x={86} y={296} width={36} height={84} fill="#78350f" stroke={INK} strokeWidth={1.5} />
    <rect x={132} y={296} width={100} height={80} fill="#111827" stroke={INK} strokeWidth={1.5} />
    <text x={182} y={318} textAnchor="middle" fontSize={11} fontWeight={900} fill="#f8fafc" fontFamily="sans-serif">COLD DRINKS</text>
    <text x={182} y={336} textAnchor="middle" fontSize={11} fontWeight={900} fill="#fde68a" fontFamily="sans-serif">ICE CREAMS</text>
    <text x={182} y={354} textAnchor="middle" fontSize={11} fontWeight={900} fill="#86efac" fontFamily="sans-serif">SNACKS</text>
    </g>
    {/* Fish and chip shop: fly strips in the door, the bain-marie full of chips, the menu board */}
    <rect x={10} y={288} width={230} height={92} fill="#1e3a8a" stroke={INK} strokeWidth={2} />
    <rect x={18} y={296} width={40} height={84} fill="#0f172a" stroke={INK} strokeWidth={1.5} />
    {Array.from({ length: 8 }, (_, i) => <line key={i} x1={21 + i * 5} y1={298} x2={21 + i * 5} y2={378} stroke={["#ef4444", "#facc15", "#22c55e", "#3b82f6"][i % 4]} strokeWidth={3} />)}
    <rect x={66} y={296} width={166} height={58} fill="#fef3c7" stroke={INK} strokeWidth={1.5} />
    <rect x={72} y={336} width={78} height={16} fill="#cbd5e1" stroke={INK} strokeWidth={1} />
    {Array.from({ length: 16 }, (_, i) => <rect key={i} x={75 + (i % 8) * 9} y={326 + Math.floor(i / 8) * 5} width={3} height={10} rx={1} fill="#facc15" stroke="#ca8a04" strokeWidth={0.5} transform={`rotate(${(i % 3 - 1) * 12} ${76 + (i % 8) * 9} ${331 + Math.floor(i / 8) * 5})`} />)}
    {[84, 112, 136].map(x => <ellipse key={x} cx={x} cy={336} rx={10} ry={4} fill="#d97706" stroke={INK} strokeWidth={0.6} />)}
    <rect x={104} y={300} width={30} height={11} rx={3} fill="#111" stroke="#ef4444" strokeWidth={1.2} />
    <text x={119} y={308.5} textAnchor="middle" fontSize={7} fontWeight={900} fill="#ef4444" fontFamily="sans-serif" className={styles.openSign}>OPEN</text>
    {/* The menu board: cost of living, chippy edition. Your soul's the bargain of the day. */}
    <rect x={152} y={299} width={78} height={52} fill="#111" stroke="#78350f" strokeWidth={2} />
    {[["FLAKE", "$34"], ["CHIPS", "$19.50"], ["SCALLOP", "$12"], ["DIM SIM", "$9.90"], ["BURGER", "$42"], ["FUN-SIZE SAUCE", "$9.99"], ["YOUR SOUL", "$2"]].map(([item, price], i) => {
      const soul = item === "YOUR SOUL";
      return <g key={item}>
        {soul && <rect x={154} y={302 + i * 6.8} width={74} height={7} fill="#7f1d1d" />}
        <text x={155} y={307.5 + i * 6.8} fontSize={5.6} fontWeight={800} fill={soul ? "#fecaca" : "#f8fafc"} fontFamily="sans-serif">{item}</text>
        <text x={227} y={307.5 + i * 6.8} textAnchor="end" fontSize={5.6} fontWeight={900} fill={soul ? "#fde047" : "#fde047"} fontFamily="sans-serif">{price}</text>
      </g>;
    })}
    <rect x={66} y={354} width={166} height={6} fill="#94a3b8" stroke={INK} strokeWidth={1} />
    {Array.from({ length: 20 }, (_, i) => <rect key={i} x={66 + (i % 10) * 16.6} y={360 + Math.floor(i / 10) * 10} width={16.6} height={10} fill={(i + Math.floor(i / 10)) % 2 ? "#f8fafc" : "#3b82f6"} />)}
    {/* Centrelink: glass, lights on, notices */}
    <rect x={510} y={278} width={480} height={102} fill="#334155" stroke={INK} strokeWidth={2} />
    {[520, 640, 760, 880].map(x => <rect key={x} x={x} y={286} width={100} height={88} fill="#cbe4f5" stroke={INK} strokeWidth={1.5} />)}
    {[540, 600, 660, 720, 780, 840, 900, 960].map(x => <rect key={x} x={x - 12} y={290} width={24} height={4} rx={2} fill="#fef9c3" className={styles.officeLight} />)}
    {[[530, 320], [560, 330], [890, 315], [920, 326], [950, 318]].map(([x, y], i) => <rect key={i} x={x} y={y} width={16} height={20} fill="#f8fafc" stroke={INK} strokeWidth={0.8} />)}
    <path d="M760 286 v88 M820 286 v88" stroke={INK} strokeWidth={2} />
    <g transform="translate(450 0)">
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
    </g>
    {/* Chemist Warehouse: the big yellow box, the red house sign up top, the blue DISCOUNT CHEMIST
        band, and windows plastered with price posters */}
    <rect x={1910} y={46} width={13} height={26} fill="#e01b22" stroke="#fff" strokeWidth={3} />
    <rect x={1700} y={110} width={350} height={270} fill="#fcd116" stroke={INK} strokeWidth={2.5} />
    <rect x={1702} y={112} width={346} height={7} fill="#f5b800" />
    <path d="M1812 142 V80 L1875 42 L1938 80 V142 Z" fill="#e01b22" stroke="#fff" strokeWidth={4} strokeLinejoin="round" />
    <path d="M1812 142 V80 L1875 42 L1938 80 V142 Z" fill="none" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
    <text x={1875} y={74} textAnchor="middle" fontSize={7} fontStyle="italic" fontWeight={900} fill="#fde047" fontFamily="sans-serif">Stop Paying Too Much!!</text>
    <text x={1875} y={104} textAnchor="middle" fontSize={27} fontWeight={900} fill="#fff" fontFamily="Impact, 'Arial Black', sans-serif">CHEMIST</text>
    <text x={1875} y={127} textAnchor="middle" fontSize={14.5} fontWeight={900} fill="#fff" fontFamily="Impact, 'Arial Black', sans-serif" letterSpacing={2}>WAREHOUSE</text>
    <rect x={1700} y={156} width={350} height={36} fill="#1d3f9a" stroke={INK} strokeWidth={2} />
    <path d="M1700 160 H2050 M1700 188 H2050" stroke="#f8fafc" strokeWidth={1.5} />
    <text x={1875} y={182} textAnchor="middle" fontSize={21} fontStyle="italic" fontWeight={900} fill="#fff" fontFamily="Impact, 'Arial Black', sans-serif" letterSpacing={1}>DISCOUNT CHEMIST</text>
    {[1722, 2028].map(x => <g key={x}><path d={`M${x - 13} 186 V170 L${x} 162 L${x + 13} 170 V186 Z`} fill="#e01b22" stroke="#fff" strokeWidth={1.5} /><text x={x} y={181} textAnchor="middle" fontSize={7} fontWeight={900} fill="#fff" fontFamily="sans-serif">CW</text></g>)}
    {/* Windows full of posters, sliding glass doors in the middle under ENTRY */}
    <rect x={1708} y={206} width={130} height={164} fill="#1e293b" stroke={INK} strokeWidth={2} />
    <rect x={1912} y={206} width={130} height={164} fill="#1e293b" stroke={INK} strokeWidth={2} />
    <Poster x={1711} y={212} w={30} h={152} bg="#e01b22" fg="#fff" lines={[["OPEN", 10], ["7", 30], ["DAYS", 10]]} />
    <Poster x={1743} y={212} w={30} h={152} bg="#fde047" fg="#e01b22" lines={[["UP TO", 7], ["50%", 12], ["OFF", 12], ["SCRIPTS", 6]]} />
    <Poster x={1775} y={212} w={30} h={152} bg="#1d3f9a" fg="#fff" lines={[["CHEAP", 8], ["AS", 8], ["CHIPS", 8], ["!!", 14]]} />
    <Poster x={1807} y={212} w={28} h={152} bg="#fff" fg="#e01b22" lines={[["BIG", 9], ["SAV-", 9], ["INGS", 9]]} />
    <Poster x={1915} y={212} w={30} h={152} bg="#e01b22" fg="#fde047" lines={[["UP TO", 7], ["85%", 12], ["OFF", 12]]} />
    <Poster x={1947} y={212} w={30} h={152} bg="#1d3f9a" fg="#fde047" lines={[["VITA-", 8], ["MINS", 8], ["2 FOR", 8], ["1", 22]]} />
    <Poster x={1979} y={212} w={30} h={152} bg="#fde047" fg="#1d3f9a" lines={[["SUN-", 8], ["SCREEN", 6.5], ["$9", 18], [".99", 9]]} />
    <Poster x={2011} y={212} w={28} h={152} bg="#e01b22" fg="#fff" lines={[["OPEN", 10], ["7", 30], ["DAYS", 10]]} />
    <rect x={1846} y={266} width={58} height={12} fill="#e01b22" stroke={INK} strokeWidth={1} />
    <text x={1875} y={275} textAnchor="middle" fontSize={8} fontWeight={900} fill="#fff" fontFamily="sans-serif" letterSpacing={2}>ENTRY</text>
    <rect x={1846} y={280} width={58} height={100} fill="#94a3b8" stroke={INK} strokeWidth={2} />
    <rect x={1849} y={283} width={25} height={97} fill="#cbe4f5" opacity={0.85} /><rect x={1876} y={283} width={25} height={97} fill="#cbe4f5" opacity={0.85} />
    <path d="M1854 300 l14 -10 M1882 320 l14 -10" stroke="#fff" strokeWidth={3} opacity={0.7} />
    <rect x={1700} y={370} width={146} height={10} fill="#1d3f9a" /><rect x={1904} y={370} width={146} height={10} fill="#1d3f9a" />

    {/* ---- Street furniture ---- */}
    <rect x={-650} y={380} width={2900} height={40} fill="#b9b4aa" />
    {Array.from({ length: 97 }, (_, i) => <line key={i} x1={-650 + i * 30} y1={380} x2={-650 + i * 30} y2={420} stroke="#a39e93" strokeWidth={1.5} />)}
    <rect x={-650} y={380} width={2900} height={4} fill="#8f8a80" />
    <LaneCrossing x={-650} />
    <LaneCrossing x={2050} flip />
    {/* The chemist's yellow bollards (not across the doors) */}
    {[1712, 1752, 1792, 1832, 1918, 1958, 1998, 2038].map(x => <rect key={x} x={x - 3} y={384} width={6} height={20} rx={2} fill="#fcd116" stroke={INK} strokeWidth={1.1} />)}
    <LaneSign x={-610} name="DOLE LANE" />
    <LaneSign x={2210} name="SNAG ALLEY" />
    {/* The bike shops' rides parked out front, on the footpath */}
    {/* Harley row: angled into the kerb, front wheels turned out to the street, pointing back down
        the street at the Indian shop. Some baggers with batwing fairings. Drawn left to right so each
        bike's tucked-in back end sits behind its neighbour. */}
    {Array.from({ length: 11 }, (_, i) => 1030 + i * 39).map((x, i) => <AngledBike key={x} x={x} y={412} s={1.1} flip fairing={i % 3 === 1}
      color={["#111", "#4338ca", "#7f1d1d", "#111", "#52525b", "#ea580c", "#1e1b4b", "#111", "#4338ca", "#3f3f46", "#9a3412"][i]} />)}
    {/* Indian row: same, angled the other way, pointing at the Harley shop. Drawn right to left. */}
    {Array.from({ length: 9 }, (_, i) => -110 - i * 40).map((x, i) => <AngledBike key={x} x={x} y={412} s={1.1} fairing={i % 4 === 2}
      color={["#b91c1c", "#111", "#7f1d1d", "#f3e6c8", "#c1121f", "#1c1917", "#991b1b", "#111", "#b91c1c"][i]} />)}
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
    {/* Power pole out the front of Centrelink, streetlight, sagging wires with a few birds */}
    <g transform="translate(-426 0)">
    <rect x={1146} y={40} width={12} height={360} fill="#8a7a5f" stroke={INK} strokeWidth={1.5} />
    <path d="M1120 70 h64 M1128 92 h48" stroke="#5b4636" strokeWidth={5} />
    <path d="M1152 60 q40 -40 110 -36" stroke="#9ca3af" strokeWidth={4} fill="none" />
    <ellipse cx={1268} cy={26} rx={16} ry={6} fill="#cbd5e1" stroke={INK} strokeWidth={1.2} />
    </g>
    <path d="M-650 100 Q-300 160 0 140 M-650 76 Q-300 124 0 110" stroke="#1f2937" strokeWidth={2} fill="none" />
    <path d="M0 140 Q360 165 694 70 M0 110 Q360 132 702 92 M758 70 Q1500 150 2250 70 M750 92 Q1500 175 2250 104" stroke="#1f2937" strokeWidth={2} fill="none" />
    {[[388, 131], [1353, 108], [1427, 110]].map(([x, y], i) => <g key={i} className={styles.wireBird} style={{ animationDelay: `${-i * 0.7}s` }}><ellipse cx={x} cy={y - 5} rx={5} ry={4} fill="#1f2937" /><circle cx={x + 4} cy={y - 9} r={2.6} fill="#1f2937" /></g>)}
  </svg>;
}
