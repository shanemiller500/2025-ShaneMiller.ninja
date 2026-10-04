import type React from "react";
import styles from "../day-out.module.css";
import { BarAndShield } from "./BikeLogos";
import { WIRES, onWire } from "./streetWires";
import BeachGoer, { Sunbaker } from "./BeachGoer";

// The backdrop behind the road: a strip of tired old two-storey terrace shops, cartoon style.
// From the left: Woolies, Dole Lane, the Indian Motorcycle shop, the fish and chip shop, the milk bar, Centrelink, the
// Harley-Davidson shop (glaring back down the street at the Indian mob), the bottlo, and a big
// yellow Chemist Warehouse; a bus shelter, a power pole with sagging wires,
// and a back lane at each end (room for the flags and palms, and somewhere to extend the street to
// later), and past Snag Alley the esplanade park running down to a surf beach. viewBox -1120 0 4730 420. The Harley block is drawn at x -900..-450 and shifted +1900 (to
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
// `cornerW` is how wide the corner building across the lane is; `corner={false}` leaves it out so
// something else (the strip club) can be drawn there unflipped.
function Alley({ x, flip = false, wallTop, wallColor, cornerW = 46, corner = true, cornerWall = "#8a3b1c" }: { x: number; flip?: boolean; wallTop: number; wallColor: string; cornerW?: number; corner?: boolean; cornerWall?: string }) {
  const vx = 123, vy = 262, backL = 92, backR = 154;
  // Where a line from (x0, y0) towards the vanishing point crosses x = xt.
  const toward = (x0: number, y0: number, xt: number) => y0 + (vy - y0) * ((xt - x0) / (vx - x0));
  const lTop = toward(cornerW, 110, backL), lBot = toward(cornerW, 380, backL), rTop = toward(200, wallTop, backR), rBot = toward(200, 380, backR);
  return <g transform={flip ? `translate(${x + 200} 0) scale(-1 1)` : `translate(${x} 0)`}>
    {/* Far end of the lane: rooftops and a gum poking up behind a paling fence */}
    <path d={`M${backL} 262 h18 l8 -8 h14 l6 8 h${backR - backL - 46} V${lBot} H${backL} Z`} fill="#94a3b8" stroke={INK} strokeWidth={1} />
    <circle cx={136} cy={250} r={10} fill="#3d7a50" stroke={INK} strokeWidth={1} /><circle cx={144} cy={256} r={8} fill="#2f6643" />
    <rect x={backL} y={284} width={backR - backL} height={lBot - 284} fill="#a07a52" stroke={INK} strokeWidth={1} />
    {Array.from({ length: 9 }, (_, i) => <line key={i} x1={backL + 3 + i * 7} y1={284} x2={backL + 3 + i * 7} y2={lBot} stroke="#7c5a3a" strokeWidth={1} />)}
    {/* The lane itself, with a faded centre line */}
    <path d={`M${cornerW} 380 H200 L${backR} ${rBot} H${backL} Z`} fill="#4b4f57" />
    <path d={`M123 380 L123 ${lBot}`} stroke="#e5e7eb" strokeWidth={1.5} strokeDasharray="8 8" opacity={0.45} />
    {/* Side wall of the building across the lane: brick, in shade */}
    <path d={`M${cornerW} 110 L${backL} ${lTop} V${lBot} L${cornerW} 380 Z`} fill={cornerWall} stroke={INK} strokeWidth={1.5} />
    {[140, 170, 200, 230, 260, 290, 320, 350].map(y => <line key={y} x1={cornerW} y1={y} x2={backL} y2={toward(cornerW, y, backL)} stroke="#6f2f16" strokeWidth={1} />)}
    {backL - cornerW > 30 && <>
      <path d={`M58 ${toward(46, 180, 58)} L74 ${toward(46, 180, 74)} V${toward(46, 230, 74)} L58 ${toward(46, 230, 58)} Z`} fill="#1e293b" stroke={INK} strokeWidth={1} />
      <path d="M56 236 q8 -10 14 2 t12 -4" stroke="#a855f7" strokeWidth={2.5} fill="none" />
    </>}
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
    <rect x={cornerW + 18} y={358} width={16} height={14} fill="#dc2626" stroke={INK} strokeWidth={1} />
    {/* The next building along: just its front corner, cut off by the edge of the world */}
    {corner && <>
    <rect x={-10} y={110} width={56} height={270} fill="url(#sfBrickRed)" stroke={INK} strokeWidth={2.5} />
    <rect x={-14} y={102} width={64} height={12} fill="#c96b3d" stroke={INK} strokeWidth={2} />
    <rect x={4} y={150} width={28} height={40} fill="#cbe4f5" stroke={INK} strokeWidth={1.5} />
    <path d="M18 150 v40 M4 170 h28" stroke={INK} strokeWidth={1} />
    <rect x={-10} y={290} width={56} height={90} fill="#57534e" stroke={INK} strokeWidth={1.5} />
    <rect x={2} y={300} width={32} height={74} fill="#78716c" stroke={INK} strokeWidth={1} />
    </>}
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

// A shop window after the other mob's been through it: showroom gutted, what's left of the glass
// hanging in the corners, cracks everywhere, boards nailed across with CLOSED sprayed on.
function BoardedUp({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const cx = x + w * 0.58, cy = y + h * 0.42;
  return <g>
    <rect x={x} y={y} width={w} height={h} fill="#111827" stroke={INK} strokeWidth={2.5} />
    <path d={`M${x} ${y} h${w * 0.2} l${-w * 0.08} ${h * 0.2} l${w * 0.05} ${h * 0.14} L${x} ${y + h * 0.5} Z`} fill="#cbe4f5" opacity={0.75} stroke={INK} strokeWidth={0.8} />
    <path d={`M${x + w} ${y + h} h${-w * 0.22} l${w * 0.06} ${-h * 0.25} l${-w * 0.04} ${-h * 0.18} L${x + w} ${y + h * 0.42} Z`} fill="#cbe4f5" opacity={0.75} stroke={INK} strokeWidth={0.8} />
    <path d={`M${x + w} ${y} h${-w * 0.14} l${w * 0.05} ${h * 0.12} Z`} fill="#cbe4f5" opacity={0.75} stroke={INK} strokeWidth={0.8} />
    {[[-0.3, -0.35], [0.35, -0.3], [0.4, 0.3], [-0.35, 0.4], [0.05, -0.45], [-0.45, 0.02]].map(([dx, dy], i) => <path key={i} d={`M${cx} ${cy} l${dx * w * 0.5} ${dy * h} l${dx * 8} ${dy * 10}`} stroke="#e2e8f0" strokeWidth={1.2} fill="none" opacity={0.8} />)}
    {[0.2, 0.52, 0.82].map((f, i) => {
      const py = y + h * f, ang = i % 2 ? -6 : 7;
      return <g key={f} transform={`rotate(${ang} ${x + w / 2} ${py})`}>
        <rect x={x - 8} y={py - 10} width={w + 16} height={20} fill={["#c08a52", "#b07a44", "#c9955e"][i]} stroke={INK} strokeWidth={1.3} />
        <path d={`M${x} ${py - 3} h${w * 0.4} M${x + w * 0.5} ${py + 4} h${w * 0.45}`} stroke="#8a5a2b" strokeWidth={1} />
        <circle cx={x - 2} cy={py} r={1.8} fill="#52525b" /><circle cx={x + w + 2} cy={py} r={1.8} fill="#52525b" />
      </g>;
    })}
    <text x={x + w / 2} y={y + h * 0.54 + 6} textAnchor="middle" fontSize={Math.min(26, w / 6)} fontWeight={900} fill="#dc2626" fontFamily="Impact, 'Arial Black', sans-serif" transform={`rotate(-6 ${x + w / 2} ${y + h * 0.54})`}>CLOSED</text>
    <text x={x + w / 2} y={y + h * 0.84 + 4} textAnchor="middle" fontSize={Math.min(12, w / 12)} fontWeight={900} fill="#111" fontFamily="sans-serif" transform={`rotate(7 ${x + w / 2} ${y + h * 0.82})`}>BACK SOON (MAYBE)</text>
  </g>;
}
// Broken glass glittering on the footpath out the front of a wrecked shop.
function GlassOnPath({ x, w }: { x: number; w: number }) {
  return <g>{Array.from({ length: 14 }, (_, i) => {
    const gx = x + ((i * 37) % w), gy = 388 + ((i * 13) % 22);
    return <path key={i} d={`M${gx} ${gy} l${4 + (i % 3) * 2} -3 l-2 ${5 + (i % 2) * 2} z`} fill="#cbe4f5" stroke="#64748b" strokeWidth={0.6} />;
  })}</g>;
}

// A pair of sneakers slung over the wire by their tied-together laces (some kid's lost them forever).
function HangingShoes({ x, y, colour, trim, delay = 0 }: { x: number; y: number; colour: string; trim: string; delay?: number }) {
  const shoe = (tx: number, ty: number, rot: number) => <g transform={`translate(${tx} ${ty}) rotate(${rot})`}>
    <path d="M-3 0 L-3 8 Q-3 12 2 12 L12 12 Q14 12 14 9.5 Q14 7 9 6 L5 4 L4 0 Z" fill={colour} stroke={INK} strokeWidth={0.9} />
    <path d="M-3 10.5 Q-3 13.5 2 13.5 L12 13.5 Q14.5 13.5 14.5 11" stroke="#f8fafc" strokeWidth={2.2} fill="none" />
    <path d="M1 4 l3 6 M4 5 l-1 5" stroke={trim} strokeWidth={1.4} />
    <path d="M5 5 l2 2 M7 6 l2 2" stroke="#f8fafc" strokeWidth={0.8} />
  </g>;
  return <g transform={`translate(${x} ${y})`}><g className={styles.batSway} style={{ animationDelay: `${delay}s`, animationDuration: "2.2s" }}>
    <path d="M0 0 L-6 18 M0 0 L7 23" stroke="#e5e7eb" strokeWidth={1} />
    {shoe(-6, 18, 80)}{shoe(7, 23, 100)}
  </g></g>;
}

// A tall Norfolk Island pine, the Gold Coast foreshore classic: straight trunk, tiers of drooping
// dark branches with bright tips, shorter towards the top. Base at (x, base), h tall; it casts a
// little shadow on the grass so it stands off the lawn.
function NorfolkPine({ x, h, base = 380 }: { x: number; h: number; base?: number }) {
  const tiers = Math.round(h / 34);
  return <g>
    <ellipse cx={x} cy={base} rx={h * 0.13} ry={4} fill="#00000030" />
    <path d={`M${x} ${base} V${base - h}`} stroke="#4a3426" strokeWidth={6} />
    {Array.from({ length: tiers }, (_, i) => {
      const y = base - h * 0.28 - (i * h * 0.7) / tiers, w = (h / 300) * (46 * (1 - i / (tiers + 1)) + 8);
      return <g key={i}>
        <path d={`M${x - w} ${y + 10} Q${x - w * 0.5} ${y - 6} ${x} ${y - 4} Q${x + w * 0.5} ${y - 6} ${x + w} ${y + 10} Q${x + w * 0.5} ${y + 4} ${x} ${y + 6} Q${x - w * 0.5} ${y + 4} ${x - w} ${y + 10} Z`} fill={i % 2 ? "#15402a" : "#123622"} stroke={INK} strokeWidth={1.4} />
        <path d={`M${x - w * 0.85} ${y + 6} Q${x - w * 0.35} ${y - 5} ${x} ${y - 3} Q${x + w * 0.35} ${y - 5} ${x + w * 0.85} ${y + 6}`} stroke="#4fae63" strokeWidth={2.2} fill="none" />
      </g>;
    })}
    <path d={`M${x - 4} ${base - h + 6} L${x} ${base - h - 12} L${x + 4} ${base - h + 6} Z`} fill="#15402a" stroke={INK} strokeWidth={1.2} />
  </g>;
}
// A breaking wave seen from the beach: a long line of swell rolling in towards you, the face
// darkening into a hollow under the lip, the white lip pitching forward with spray coming off the
// top. It stands up, throws, and collapses into whitewash. (x, y) is the left end of its base; w
// long. `surfer` puts someone carving across the face.
function FrontWave({ x, y, w, delay, surfer = false, sy = 1 }: { x: number; y: number; w: number; delay: number; surfer?: boolean; sy?: number }) {
  const n = Math.round(w / 50), seg = w / n;
  const crest = Array.from({ length: n }, (_, i) => `Q${rd(seg * i + seg / 2)} ${i % 2 ? -30 : -24} ${rd(seg * (i + 1))} ${i % 3 === 1 ? -22 : -27}`).join(" ");
  return <g transform={`translate(${x} ${y}) scale(1 ${sy})`}><g className={styles.waveFront} style={{ animationDelay: `${delay}s` }}>
    <path d={`M0 0 L0 -24 ${crest} V0 Z`} fill="#0e86a8" stroke={INK} strokeWidth={1.6} />
    <path d={`M0 -6 H${w}`} stroke="#3fb4d6" strokeWidth={7} opacity={0.7} />
    <path d={`M0 -20 ${crest.replace(/-(\d+)/g, (_, v) => `-${Number(v) - 6}`)}`} stroke="#0b4a63" strokeWidth={7} fill="none" opacity={0.85} />
    {Array.from({ length: n }, (_, i) => <path key={i} d={`M${rd(seg * i + 8)} -10 q${rd(seg * 0.3)} -4 ${rd(seg * 0.6)} 0`} stroke="#7dd3e8" strokeWidth={1.6} fill="none" opacity={0.7} />)}
    <path d={`M0 -24 ${crest}`} stroke="#f8fafc" strokeWidth={6} fill="none" strokeLinecap="round" />
    {Array.from({ length: n }, (_, i) => <path key={`c${i}`} d={`M${rd(seg * i + seg * 0.3)} -27 q6 -7 12 -2 q-4 0 -5 4`} stroke="#f8fafc" strokeWidth={2.4} fill="none" strokeLinecap="round" />)}
    {Array.from({ length: n * 2 }, (_, i) => <circle key={`s${i}`} cx={rd((w / (n * 2)) * i + 10)} cy={-32 - (i % 3) * 3} r={1.6 - (i % 2) * 0.5} fill="#f8fafc" />)}
    {surfer && <g className={styles.waveSurfer} transform={`translate(${rd(w * 0.7)} -12)`}>
      <path d="M-12 4 Q0 0 14 3 Q0 8 -12 4 Z" fill="#facc15" stroke={INK} strokeWidth={1.1} />
      <path d="M-3 3 L-5 -8 M4 3 L5 -8" stroke="#1e3a8a" strokeWidth={3} strokeLinecap="round" />
      <path d="M-5 -8 h10 v-9 h-10 z" fill="#dc2626" stroke={INK} strokeWidth={1} />
      <path d="M-5 -15 L-13 -10 M5 -15 L13 -20" stroke="#e0a982" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={0} cy={-21} r={4} fill="#e0a982" stroke={INK} strokeWidth={1} /><path d="M-4 -23 q4 -5 8 0" fill="#fde047" />
    </g>}
  </g></g>;
}
// A park bin on a post (the tweakers' takeaway).
function ParkBin({ x }: { x: number }) {
  return <g>
    <path d={`M${x} 378 V362`} stroke="#4b5563" strokeWidth={3} />
    <path d={`M${x - 9} 344 h18 l-2 20 h-14 z`} fill="#166534" stroke={INK} strokeWidth={1.3} />
    <rect x={x - 10} y={341} width={20} height={4} rx={1} fill="#14532d" stroke={INK} strokeWidth={1} />
  </g>;
}
// A beachgoer (same style as the street's commuters) dropped into the street drawing: feet at
// (x, base), h drawing-units tall. `flip` faces them left.
function Goer({ x, base, h = 50, look, pose, kid, flip = false }: { x: number; base: number; h?: number; look: number; pose?: "stand" | "walk" | "throw" | "wave"; kid?: boolean; flip?: boolean }) {
  const w = h * 0.4, body = <svg x={x - w / 2} y={base - h} width={w} height={h} overflow="visible"><BeachGoer look={look} pose={pose} kid={kid} /></svg>;
  return flip ? <g transform={`translate(${2 * x} 0) scale(-1 1)`}>{body}</g> : body;
}
// A container ship crawling along the horizon. Hull bottom at (x, y), about 120 long at s=1.
function CargoShip({ x, y, s = 1, hull = "#7f1d1d", delay = 0 }: { x: number; y: number; s?: number; hull?: string; delay?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${s})`}><g className={styles.shipSail} style={{ animationDelay: `${delay}s` }}>
    <path d="M0 -8 H120 L112 0 H6 Z" fill={hull} stroke={INK} strokeWidth={1.2} />
    {Array.from({ length: 9 }, (_, i) => <rect key={i} x={10 + i * 10} y={-16 - (i % 3 === 1 ? 6 : 0)} width={9} height={8 + (i % 3 === 1 ? 6 : 0)} fill={["#2563eb", "#f97316", "#16a34a", "#facc15", "#dc2626"][i % 5]} stroke={INK} strokeWidth={0.6} />)}
    <rect x={102} y={-24} width={12} height={16} fill="#f8fafc" stroke={INK} strokeWidth={0.8} />
    <rect x={106} y={-30} width={4} height={6} fill="#111" />
  </g></g>;
}
// The adventure playground, set back on the lawn: rubber soft-fall, a timber tower with a cubby on
// top, a twisty silver tube slide down one side and a rope net up the other, a big nest swing, and
// a flying fox running the length of it. Kids everywhere. Spans x 2450..2672, base y≈336.
function Playground() {
  return <g>
    {/* Soft-fall: yellow rubber with a blue puddle and an orange path */}
    <path d="M2450 340 L2466 314 H2656 L2672 340 Z" fill="#facc15" stroke={INK} strokeWidth={1.5} />
    <path d="M2480 326 q20 -10 44 -2 q10 8 -10 12 q-24 4 -34 -10 z" fill="#2563eb" />
    <path d="M2600 338 q8 -12 30 -20 l12 2 q-20 8 -26 18 z" fill="#ea580c" />
    {/* Flying fox: cable from the tall start pole to the low end post, a kid zooming along it */}
    <path d="M2456 336 V222 M2672 336 V292" stroke="#8b5a2b" strokeWidth={5} />
    <path d="M2456 226 L2672 298" stroke="#4b5563" strokeWidth={1.6} />
    <g className={styles.flyingFox}>
      <rect x={2452} y={222} width={10} height={6} rx={2} fill="#9ca3af" stroke={INK} strokeWidth={0.8} />
      <path d="M2457 228 V244" stroke="#111" strokeWidth={1.2} />
      <Goer x={2457} base={266} h={28} look={2} kid pose="wave" />
    </g>
    {/* Big nest swing on ropes */}
    <path d="M2468 336 L2486 268 L2504 336 M2486 268 H2532 M2514 336 L2532 268 L2550 336" stroke="#8b5a2b" strokeWidth={4} fill="none" strokeLinejoin="round" />
    <g className={styles.swingSway} style={{ transformOrigin: "2509px 270px" }}>
      <path d="M2496 270 L2498 314 M2522 270 L2520 314" stroke="#d6c7a1" strokeWidth={1.6} />
      <ellipse cx={2509} cy={316} rx={16} ry={5} fill="#ea580c" stroke={INK} strokeWidth={1.2} />
      <path d="M2495 316 h28 M2499 313 l4 6 M2507 313 l4 6 M2515 313 l4 6" stroke="#fdba74" strokeWidth={1} />
      <Goer x={2504} base={314} h={26} look={1} kid />
      <Goer x={2516} base={314} h={26} look={3} kid />
    </g>
    {/* The tower: timber posts, a cubby with grey panels and teal trim, mesh window */}
    <path d="M2566 336 V226 M2614 336 V226" stroke="#a0703f" strokeWidth={6} />
    <path d="M2566 300 L2614 280 M2566 280 L2614 300" stroke="#a0703f" strokeWidth={2.5} />
    <rect x={2558} y={226} width={64} height={40} fill="#94a3b8" stroke={INK} strokeWidth={1.6} />
    <path d="M2558 246 H2622 M2590 226 V266" stroke="#2dd4bf" strokeWidth={2.5} />
    <rect x={2566} y={230} width={20} height={13} fill="#e2e8f0" stroke={INK} strokeWidth={0.8} />
    <path d="M2570 230 v13 M2575 230 v13 M2580 230 v13 M2566 236 h20" stroke="#64748b" strokeWidth={0.6} />
    <rect x={2552} y={218} width={76} height={9} fill="#2dd4bf" stroke={INK} strokeWidth={1.4} />
    <Goer x={2604} base={246} h={26} look={5} kid pose="wave" />
    {/* Rope net up the left side */}
    <path d="M2558 236 L2528 336 M2558 236 L2546 336" stroke="#d6c7a1" strokeWidth={1.4} />
    {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${2554 - i * 4.6} ${252 + i * 14} L${2556 - i * 1.8} ${252 + i * 14}`} stroke="#d6c7a1" strokeWidth={1.4} />)}
    {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M${2531 + i * 4} 336 L${2558} ${236 + i * 2}`} stroke="#d6c7a1" strokeWidth={0.8} opacity={0.8} />)}
    <Goer x={2546} base={306} h={26} look={0} kid />
    {/* Twisty silver tube slide down the right side to a kid popping out the bottom */}
    <path d="M2622 246 C2662 244 2668 272 2640 282 C2612 292 2618 314 2652 318 C2670 321 2674 328 2678 334" stroke={INK} strokeWidth={15} fill="none" strokeLinecap="round" />
    <path d="M2622 246 C2662 244 2668 272 2640 282 C2612 292 2618 314 2652 318 C2670 321 2674 328 2678 334" stroke="#cbd5e1" strokeWidth={12} fill="none" strokeLinecap="round" />
    <path d="M2622 246 C2662 244 2668 272 2640 282 C2612 292 2618 314 2652 318 C2670 321 2674 328 2678 334" stroke="#94a3b8" strokeWidth={12} fill="none" strokeDasharray="2 5" />
    <Goer x={2690} base={338} h={26} look={4} kid pose="wave" />
    {/* Picket fence round the lot */}
    <path d="M2466 314 H2656" stroke="#f8fafc" strokeWidth={2} />
    {Array.from({ length: 25 }, (_, i) => <path key={i} d={`M${2448 + i * 9.4} 346 v-12 l2 -3 l2 3 v12`} fill="#f8fafc" stroke={INK} strokeWidth={0.7} />)}
    <path d="M2446 338 H2676 M2450 340 L2466 314 M2672 340 L2656 314" stroke="#f8fafc" strokeWidth={2.2} />
  </g>;
}
// Past Snag Alley the street opens up onto the foreshore: a mowed esplanade park with Norfolk
// pines dotted about, a council BBQ and picnic table, the adventure playground set back on the
// lawn, a frisbee game and park bins; grassy dune terraces down to the sand; the lifeguard hut,
// sunbakers, swimmers coming and going, shark fins and container ships out the back, and sets
// peeling along the sandbank. Drawn at 2250..3450 and shifted +160 to sit past the club.
function Beachfront() {
  return <g>
    <defs>
      <linearGradient id="sfSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1769a8" /><stop offset="0.55" stopColor="#1e88c7" /><stop offset="1" stopColor="#3fb4d6" /></linearGradient>
      <linearGradient id="sfSand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e9c88a" /><stop offset="1" stopColor="#f6dca6" /></linearGradient>
    </defs>
    {/* The sea, all the way back to the horizon (the park covers its left end) */}
    <rect x={2250} y={238} width={1210} height={92} fill="url(#sfSea)" />
    <path d="M2250 238 H3460" stroke="#a5d8f3" strokeWidth={3} />
    {/* Container ships crawling along the horizon */}
    <CargoShip x={3300} y={240} s={0.5} delay={0} />
    <CargoShip x={3300} y={240} s={0.42} hull="#1e3a8a" delay={-90} />
    {[[2560, 248, 40], [2760, 256, 70], [2990, 250, 50], [3200, 260, 80], [3380, 252, 40], [2880, 270, 60], [3110, 276, 70]].map(([x, y, w], i) => <path key={i} d={`M${x} ${y} h${w}`} stroke="#bfe3ff" strokeWidth={2} strokeLinecap="round" opacity={0.8} />)}
    {/* Shark fins cruising out the back */}
    {[[2940, 268, 0], [3150, 282, -7]].map(([x, y, d], i) => <g key={i} transform={`translate(${x} ${y})`}><g className={styles.finCruise} style={{ animationDelay: `${d}s` }}>
      <path d="M-10 0 Q-2 -4 0 -18 Q6 -8 12 0 Z" fill="#64748b" stroke={INK} strokeWidth={1.3} />
      <path d="M-16 1 q8 -3 16 0 t16 0" stroke="#e0f2fe" strokeWidth={1.6} fill="none" />
    </g></g>)}
    {/* Swimmers bobbing between the flags */}
    {[[3020, 304, "#e0ac69", "#7c2d12"], [3090, 312, "#f1c7a3", "#fde047"], [3170, 300, "#8d5524", "#111"]].map(([x, y, skin, hair], i) => <g key={i} transform={`translate(${x} ${y})`}><g className={styles.swimBob} style={{ animationDelay: `${-i * 0.6}s` }}>
      <circle cx={0} cy={-4} r={4.4} fill={skin as string} stroke={INK} strokeWidth={1} />
      <path d="M-4.4 -5 q4.4 -6 8.8 0" fill={hair as string} />
      {i === 1 && <path d="M4 -4 L10 -12" stroke={skin as string} strokeWidth={2.4} strokeLinecap="round" />}
      <path d="M-9 0 q4.5 -3 9 0 t9 0" stroke="#e0f2fe" strokeWidth={1.4} fill="none" />
    </g></g>)}
    {/* Sets rolling in towards the beach, front on, one with a surfer carving across the face */}
    <FrontWave x={2790} y={318} w={670} sy={1.55} delay={0} surfer />
    <FrontWave x={2790} y={318} w={670} sy={1.55} delay={-2.6} />
    <FrontWave x={2790} y={318} w={670} sy={1.55} delay={-5.2} />
    {/* Whitewash lines rolling in towards the beach */}
    {[0, 1, 2].map(i => <path key={i} className={styles.foamRoll} style={{ animationDelay: `${-i * 1.1}s` }} d="M2860 300 q30 -6 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0" stroke="#f8fafc" strokeWidth={3} fill="none" strokeLinecap="round" />)}
    {/* The beach: flat sand in front of the water, a wet band and foam washing up the shoreline */}
    <path d="M2780 380 Q2800 336 2840 326 H3460 V380 Z" fill="url(#sfSand)" stroke={INK} strokeWidth={2} />
    <path d="M2842 327 H3460" stroke="#d6b06c" strokeWidth={7} />
    {[0, -2.6, -5.2].map(d => <g key={d} className={styles.swash} style={{ animationDelay: `${d}s` }}>
      <path d={`M2842 326 H3460 V334 ${Array.from({ length: 21 }, () => "q-15 7 -30 0").join(" ")} Z`} fill="#f0f9ff" opacity={0.85} />
      <path d={`M3460 334 ${Array.from({ length: 21 }, () => "q-15 7 -30 0").join(" ")}`} stroke="#ffffff" strokeWidth={2.4} fill="none" />
    </g>)}
    <path className={styles.shoreFoam} d="M2846 324 q14 -5 28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0" stroke="#f8fafc" strokeWidth={4} fill="none" strokeLinecap="round" />
    {[[2900, 360], [3040, 348], [3180, 366], [3330, 352], [2980, 372], [3260, 340]].map(([x, y], i) => <path key={i} d={`M${x} ${y} q3 -2 6 0`} stroke="#c9a368" strokeWidth={1.5} fill="none" />)}
    {/* People wandering down for a dip and back up again */}
    {[[3050, 0, -0], [3130, 1, -4.5], [3210, 5, -2.2]].map(([x, look, d], i) => <g key={i} className={styles.dipWalk} style={{ animationDelay: `${d}s` }}>
      <Goer x={x} base={374} look={look} pose="walk" flip={i === 1} />
    </g>)}
    {/* Sunbakers, a brolly, a board stuck in the sand, a sandcastle */}
    <svg x={2924} y={354} width={60} height={18} overflow="visible"><Sunbaker look={5} towel="#38bdf8" /></svg>
    <svg x={3244} y={356} width={60} height={18} overflow="visible"><Sunbaker look={2} towel="#fde047" /></svg>
    <path d="M2912 374 L2920 330" stroke="#78350f" strokeWidth={2.5} />
    <path d="M2884 338 Q2920 306 2956 330 Q2920 324 2884 338 Z" fill="#ef4444" stroke={INK} strokeWidth={1.4} />
    <path d="M2896 330 Q2912 316 2920 316 L2920 326 Z M2930 318 Q2944 322 2948 327 L2928 326 Z" fill="#fde047" />
    <path d="M3106 374 Q3100 344 3110 322 Q3120 344 3114 374 Z" fill="#f97316" stroke={INK} strokeWidth={1.3} />
    <path d="M3110 328 V370" stroke="#fff" strokeWidth={1.5} />
    <path d="M3006 374 q8 -12 16 0 z" fill="#facc15" stroke={INK} strokeWidth={1} /><path d="M3010 368 l-6 -4 M3018 368 l6 -4" stroke="#78350f" strokeWidth={1.2} />
    {/* Patrol flags: swim between 'em */}
    {[2990, 3230].map(fx => <g key={fx}>
      <path d={`M${fx} 372 V318`} stroke="#9ca3af" strokeWidth={2.5} />
      <g className={styles.flagWave}><path d={`M${fx} 318 h22 v15 h-22 z`} fill="#facc15" stroke={INK} strokeWidth={1} /><path d={`M${fx} 318 h22 l-22 15 z`} fill="#dc2626" /></g>
    </g>)}
    {/* The lifeguard hut, up on stilts on the sand */}
    <path d="M3298 376 V350 M3352 376 V350" stroke="#a16207" strokeWidth={4} />
    <path d="M3304 376 L3346 350 M3346 376 L3304 350" stroke="#a16207" strokeWidth={1.6} />
    <rect x={3292} y={326} width={66} height={26} fill="#facc15" stroke={INK} strokeWidth={1.6} />
    <path d="M3284 328 L3325 300 L3366 328 Z" fill="#dc2626" stroke={INK} strokeWidth={1.6} />
    <rect x={3302} y={332} width={46} height={12} fill="#1e293b" />
    <text x={3325} y={341.5} textAnchor="middle" fontSize={7} fontWeight={900} fill="#facc15" fontFamily="sans-serif">LIFEGUARD</text>
    {/* The esplanade park: bright mowed grass rolling down in terraces to the sand */}
    <path d="M2250 380 V300 Q2420 290 2580 296 Q2720 302 2790 318 Q2830 330 2846 356 L2856 380 Z" fill="#8cc63f" stroke={INK} strokeWidth={2} />
    {[2290, 2370, 2450, 2530, 2610, 2690].map(sx => <path key={sx} d={`M${sx} 300 L${sx + 26} 380`} stroke="#a3d55a" strokeWidth={24} opacity={0.55} />)}
    {[[2720, 320, 2822], [2740, 340, 2840], [2770, 360, 2850]].map(([x0, y0, x1], i) => <g key={i}>
      <path d={`M${x0} ${y0} Q${(x0 + x1) / 2} ${y0 - 5} ${x1} ${y0 + 8}`} stroke="#4d8a2e" strokeWidth={4} fill="none" />
      {Array.from({ length: 4 }, (_, j) => <path key={j} d={`M${x0 + 12 + j * ((x1 - x0) / 4)} ${y0 - 1 + j * 2} v-7`} stroke="#14532d" strokeWidth={2} />)}
    </g>)}
    {/* Pines in the back of the park first */}
    <NorfolkPine x={2290} h={210} base={322} />
    <NorfolkPine x={2780} h={220} base={326} />
    <NorfolkPine x={2440} h={260} base={348} />
    {/* The playground, set back on the lawn */}
    <Playground />
    {/* Council BBQ and a picnic table */}
    <path d="M2318 318 L2346 304 L2374 318 Z" fill="#166534" stroke={INK} strokeWidth={1.4} />
    <path d="M2322 318 V340 M2370 318 V340" stroke="#4b5563" strokeWidth={3} />
    <rect x={2320} y={340} width={52} height={8} fill="#6b7280" stroke={INK} strokeWidth={1.2} />
    <rect x={2324} y={346} width={44} height={30} fill="#9ca3af" stroke={INK} strokeWidth={1.5} />
    <text x={2346} y={364} textAnchor="middle" fontSize={7} fontWeight={900} fill="#111" fontFamily="sans-serif">FREE BBQ</text>
    <rect x={2380} y={350} width={54} height={6} fill="#a16207" stroke={INK} strokeWidth={1.2} />
    <path d="M2388 356 L2382 376 M2426 356 L2432 376" stroke="#78350f" strokeWidth={4} />
    <rect x={2376} y={364} width={62} height={4} fill="#a16207" stroke={INK} strokeWidth={1} />
    <ParkBin x={2700} />
    {/* Frisbee down the far end of the lawn */}
    <Goer x={2760} base={368} look={4} pose="throw" />
    <Goer x={2836} base={352} look={1} pose="throw" flip />
    <g transform="translate(2768 322)"><g className={styles.frisbeeX}><g className={styles.frisbeeY}><ellipse cx={0} cy={0} rx={6} ry={2.2} fill="#f97316" stroke={INK} strokeWidth={0.9} /></g></g></g>
    {/* Park sign */}
    <path d="M2722 378 V356" stroke="#78350f" strokeWidth={3} />
    <rect x={2692} y={338} width={60} height={20} rx={3} fill="#166534" stroke="#f8fafc" strokeWidth={1.5} />
    <text x={2722} y={347} textAnchor="middle" fontSize={6.2} fontWeight={900} fill="#f8fafc" fontFamily="sans-serif">ESPLANADE PARK</text>
    <text x={2722} y={354.5} textAnchor="middle" fontSize={4.8} fontWeight={800} fill="#bbf7d0" fontFamily="sans-serif">NO DOGS ON BEACH</text>
    {/* Pines up front, dotted about rather than in a row */}
    <NorfolkPine x={2302} h={300} base={378} />
    <NorfolkPine x={2862} h={220} base={378} />
    {/* The last power pole, where the wires run out (clear of the lane's corner building) */}
    <rect x={2262} y={52} width={10} height={348} fill="#8a7a5f" stroke={INK} strokeWidth={1.5} />
    <path d="M2250 72 h34 M2252 104 h30" stroke="#5b4636" strokeWidth={5} />
  </g>;
}

// "Sandy Bottoms", the gentlemen's club on the corner of Snag Alley: a proper shop-width purple
// building, a big pink neon sign in a frame of chasing marquee bulbs, neon palm and cocktail, two
// blacked-out windows, a velvet rope at the door, and a pink glow on the footpath. x 2174..2420.
function StripClub() {
  const bulbs: [number, number][] = [];
  for (let x = 2204; x <= 2390; x += 8) { bulbs.push([x, 124]); bulbs.push([x, 216]); }
  for (let y = 132; y <= 208; y += 8) { bulbs.push([2200, y]); bulbs.push([2394, y]); }
  return <g>
    <ellipse cx={2297} cy={392} rx={130} ry={11} fill="#f472b6" className={styles.neonGlow} />
    <rect x={2174} y={110} width={246} height={270} fill="#2e1065" stroke={INK} strokeWidth={2.5} />
    <rect x={2170} y={102} width={254} height={12} fill="#111" stroke={INK} strokeWidth={2} />
    {Array.from({ length: 8 }, (_, i) => <line key={i} x1={2176} y1={132 + i * 32} x2={2418} y2={132 + i * 32} stroke="#3b1580" strokeWidth={1.2} />)}
    {/* The sign, in its frame of chasing bulbs */}
    <rect x={2204} y={128} width={186} height={84} rx={10} fill="#111" stroke="#f472b6" strokeWidth={2.2} />
    {bulbs.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2} fill="#fde68a" className={styles.marqueeBulb} style={{ animationDelay: `${(i % 2) * -0.4}s` }} />)}
    <text x={2297} y={170} textAnchor="middle" fontSize={34} fontStyle="italic" fontWeight={900} fill="#f9a8d4" className={styles.neonFlicker} fontFamily="'Brush Script MT', 'Segoe Script', cursive">Sandy Bottoms</text>
    <text x={2297} y={189} textAnchor="middle" fontSize={9} fontWeight={900} fill="#67e8f9" fontFamily="sans-serif" letterSpacing={3}>GENTLEMEN&apos;S CLUB</text>
    <text x={2297} y={204} textAnchor="middle" fontSize={8} fontWeight={900} fill="#fde047" fontFamily="sans-serif" letterSpacing={2}>THONGS OPTIONAL</text>
    {/* Neon palm, cocktail glass, opening hours */}
    <g className={styles.neonFlicker} style={{ animationDelay: "-0.6s" }} fill="none" strokeLinecap="round">
      <path d="M2214 254 V230 M2214 230 q-10 -5 -15 2 M2214 230 q10 -5 15 2 M2214 230 q-5 -10 -12 -7 M2214 230 q5 -10 12 -7" stroke="#4ade80" strokeWidth={2.2} />
      <path d="M2370 226 h20 l-10 12 z M2380 238 v14 M2374 252 h12" stroke="#22d3ee" strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={2386} cy={229} r={1.8} stroke="#f472b6" strokeWidth={1.5} />
    </g>
    <text x={2297} y={246} textAnchor="middle" fontSize={10} fontWeight={900} fill="#f472b6" className={styles.neonFlicker} style={{ animationDelay: "-2.6s" }} fontFamily="sans-serif" letterSpacing={2}>OPEN TIL 4AM</text>
    {/* Blacked-out windows */}
    <rect x={2184} y={264} width={86} height={34} fill="#0f0a1e" stroke="#f472b6" strokeWidth={1.4} />
    <text x={2227} y={285} textAnchor="middle" fontSize={9} fontWeight={900} fill="#f472b6" className={styles.neonFlicker} style={{ animationDelay: "-2s" }} fontFamily="sans-serif" letterSpacing={1}>LIVE SHOWS</text>
    <rect x={2324} y={264} width={86} height={34} fill="#0f0a1e" stroke="#22d3ee" strokeWidth={1.4} />
    <text x={2367} y={285} textAnchor="middle" fontSize={9} fontWeight={900} fill="#22d3ee" className={styles.neonFlicker} style={{ animationDelay: "-3.1s" }} fontFamily="sans-serif" letterSpacing={1}>COLD BEERS</text>
    {/* Door, VIP sign, velvet rope */}
    <rect x={2282} y={302} width={30} height={78} fill="#111" stroke={INK} strokeWidth={1.5} />
    <rect x={2289} y={308} width={16} height={8} rx={2} fill="#facc15" /><text x={2297} y={314.4} textAnchor="middle" fontSize={5} fontWeight={900} fill="#111" fontFamily="sans-serif">VIP</text>
    <path d="M2268 380 V360 M2326 380 V360" stroke="#d4af37" strokeWidth={2.4} />
    <circle cx={2268} cy={359} r={2.2} fill="#d4af37" /><circle cx={2326} cy={359} r={2.2} fill="#d4af37" />
    <path d="M2268 362 Q2297 376 2326 362" stroke="#b91c1c" strokeWidth={2.6} fill="none" />
  </g>;
}

// Woolies, at the Dole Lane end: a big box with the green fascia, the white "Woolworths" and the
// glowing green apple, and a long lit glass front: shelves of stock under rows of lights, yellow
// half-price tickets, checkouts, "We're here to help". x -1100..-604.
function Woolies() {
  const produce = ["#dc2626", "#f97316", "#facc15", "#16a34a", "#2563eb", "#a855f7", "#f8fafc", "#78350f"];
  return <g>
    <rect x={-1100} y={110} width={496} height={270} fill="#d1d5db" stroke={INK} strokeWidth={2.5} />
    <rect x={-1100} y={110} width={496} height={130} fill="#125c33" stroke={INK} strokeWidth={2.5} />
    <path d="M-1100 120 H-604" stroke="#1a7a45" strokeWidth={4} />
    <path d="M-1100 238 H-604" stroke="#0b3d22" strokeWidth={6} />
    <text x={-872} y={198} textAnchor="middle" fontSize={66} fontWeight={500} fill="#ffffff" className={styles.wooliesGlow} fontFamily="'Segoe UI', Helvetica, Arial, sans-serif" letterSpacing={-1.5}>Woolworths</text>
    <g transform="translate(-668 176)" className={styles.wooliesGlow}>
      <path d="M-28 -12 Q-32 20 -8 28 L0 22 L8 28 Q32 20 28 -12 Q15 -24 0 -10 Q-15 -24 -28 -12 Z" fill="none" stroke="#7ddc4f" strokeWidth={9} strokeLinejoin="round" />
      <path d="M0 -10 V16" stroke="#7ddc4f" strokeWidth={8} strokeLinecap="round" />
      <path d="M3 -15 q9 -15 20 -12 q-6 13 -20 12 z" fill="#7ddc4f" />
    </g>
    {/* The shopfront: lit glass with the store inside */}
    <rect x={-1090} y={250} width={476} height={130} fill="#fefce8" stroke={INK} strokeWidth={2} />
    {Array.from({ length: 11 }, (_, i) => <rect key={i} x={-1082 + i * 43} y={256} width={30} height={3} rx={1.5} fill="#fff" stroke="#e5e7eb" strokeWidth={0.6} />)}
    {[0, 1, 2].map(r => <g key={r}>
      <rect x={-1080} y={280 + r * 16} width={456} height={3} fill="#9ca3af" />
      {Array.from({ length: 52 }, (_, i) => <rect key={i} x={-1078 + i * 8.7} y={271 + r * 16} width={6.5} height={9} fill={produce[(i * 3 + r * 5) % produce.length]} opacity={0.85} />)}
    </g>)}
    {[-1060, -985, -900, -800, -700].map((x, i) => <g key={x}>
      <rect x={x} y={262} width={20} height={14} rx={2} fill="#facc15" stroke={INK} strokeWidth={0.8} />
      <text x={x + 10} y={273} textAnchor="middle" fontSize={10} fontWeight={900} fill="#111" fontFamily="sans-serif">{i % 2 ? "½" : "$"}</text>
    </g>)}
    <rect x={-930} y={258} width={84} height={14} rx={2} fill="#111" />
    <text x={-888} y={268} textAnchor="middle" fontSize={7.5} fontWeight={800} fill="#f8fafc" fontFamily="sans-serif">We&apos;re here to help</text>
    {/* Checkouts and the staff */}
    {[-1050, -990, -930].map(x => <g key={x}>
      <circle cx={x + 18} cy={322} r={6} fill="#e0ac69" stroke={INK} strokeWidth={1} />
      <path d={`M${x + 10} 334 q8 -6 16 0 v6 h-16 z`} fill="#16a34a" stroke={INK} strokeWidth={0.8} />
      <rect x={x} y={338} width={44} height={22} fill="#b45309" stroke={INK} strokeWidth={1.2} />
      <rect x={x + 32} y={326} width={8} height={12} fill="#111" />
      <rect x={x + 4} y={360} width={8} height={20} fill="#16a34a" stroke={INK} strokeWidth={0.8} />
    </g>)}
    {/* Self-serve and a shopper having a moment with the bagging area */}
    <rect x={-880} y={330} width={30} height={30} fill="#374151" stroke={INK} strokeWidth={1} /><rect x={-876} y={334} width={22} height={12} fill="#7dd3fc" />
    <circle cx={-838} cy={322} r={6} fill="#f1c7a3" stroke={INK} strokeWidth={1} /><path d="M-846 334 q8 -6 16 0 v14 h-16 z" fill="#2563eb" stroke={INK} strokeWidth={0.8} />
    <text x={-865} y={325} textAnchor="middle" fontSize={5} fontWeight={900} fill="#dc2626" fontFamily="sans-serif">UNEXPECTED ITEM</text>
    {/* Silver columns, glass glare, exit sign */}
    {[-940, -760].map(x => <rect key={x} x={x - 5} y={250} width={10} height={130} fill="#cbd5e1" stroke={INK} strokeWidth={1.2} />)}
    <path d="M-1070 300 l40 -40 M-1040 310 l30 -30 M-720 310 l40 -40 M-690 320 l40 -40" stroke="#ffffff" strokeWidth={4} opacity={0.5} />
    <rect x={-648} y={256} width={22} height={10} rx={1.5} fill="#16a34a" stroke={INK} strokeWidth={0.8} />
    <text x={-637} y={263.5} textAnchor="middle" fontSize={5.5} fontWeight={900} fill="#fff" fontFamily="sans-serif">EXIT</text>
  </g>;
}
// Out the front of Woolies, on the footpath: a line of trolleys and the Quiet Hour board.
function WooliesFootpath() {
  const trolley = (x: number) => <g key={x}>
    <path d={`M${x} 368 h30 l-4 16 h-22 z`} fill="none" stroke="#9ca3af" strokeWidth={1.8} />
    {[6, 12, 18, 24].map(dx => <path key={dx} d={`M${x + dx} 368 v16`} stroke="#9ca3af" strokeWidth={1} />)}
    <path d={`M${x} 368 l-6 -8 h-4`} stroke="#dc2626" strokeWidth={2.4} strokeLinecap="round" fill="none" />
    <circle cx={x + 6} cy={390} r={2.6} fill="#111" /><circle cx={x + 24} cy={390} r={2.6} fill="#111" />
  </g>;
  return <g>
    {[-800, -788, -776, -764].map(trolley)}
    <path d="M-1050 396 L-1040 352 H-1012 L-1002 396" fill="#16a34a" stroke={INK} strokeWidth={1.4} />
    <rect x={-1038} y={358} width={24} height={30} fill="#f8fafc" />
    <text x={-1026} y={368} textAnchor="middle" fontSize={5.5} fontWeight={900} fill="#16a34a" fontFamily="sans-serif">QUIET</text>
    <text x={-1026} y={375} textAnchor="middle" fontSize={5.5} fontWeight={900} fill="#16a34a" fontFamily="sans-serif">HOUR</text>
    <text x={-1026} y={383} textAnchor="middle" fontSize={4} fontWeight={700} fill="#111" fontFamily="sans-serif">MON-FRI 10:30</text>
  </g>;
}

// `sky={false}` leaves the sky transparent so a separate sky layer (with the jets in it) shows
// through behind the buildings.
// `closed`: a shop that lost the last brawl is boarded up, its showbike and parked bikes gone.
export default function Shopfronts({ sky = true, closed = {} }: { sky?: boolean; closed?: { harley?: boolean; indian?: boolean } }) {
  return <svg viewBox="-1120 0 4730 420" width="100%" height="100%" preserveAspectRatio="xMidYMax slice" aria-hidden>
    <defs>
      <linearGradient id="sfSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2f80d1" /><stop offset="1" stopColor="#8cc4f0" /></linearGradient>
      <pattern id="sfBrickRed" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#b4532a" /><path d="M0 12 H24 M12 0 V6 M0 6 H24 M0 6 V12 M24 6 V12" stroke="#8a3b1c" strokeWidth={1} /></pattern>
      <pattern id="sfBrickOrange" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#c2410c" /><path d="M0 12 H24 M12 0 V6 M0 6 H24 M0 6 V12 M24 6 V12" stroke="#9a3412" strokeWidth={1} /></pattern>
      <pattern id="sfBrickDark" width="24" height="12" patternUnits="userSpaceOnUse"><rect width="24" height="12" fill="#2b2f36" /><path d="M0 12 H24 M12 0 V6 M0 6 H24 M0 6 V12 M24 6 V12" stroke="#1b1e23" strokeWidth={1} /></pattern>
    </defs>
    {sky && <rect x={-1120} width="4730" height="420" fill="url(#sfSky)" />}
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
    {closed.harley ? <BoardedUp x={-770} y={200} w={310} h={176} /> : <>
      <path d="M-690 204 L-735 362 H-640 Z M-540 204 L-590 362 H-495 Z" fill="#fde68a" opacity={0.13} />
      <rect x={-720} y={360} width={210} height={14} rx={3} fill="#111" stroke={INK} strokeWidth={1.5} />
      <rect x={-720} y={360} width={210} height={3} fill="#f97316" />
      <ellipse cx={-615} cy={360} rx={92} ry={5} fill="#f8fafc" opacity={0.12} />
      <RoadGlide x={-701} y={360} s={1.15} flip />
      {[-700, -620, -540].map(x => <line key={x} x1={x} y1={200} x2={x} y2={376} stroke="#334155" strokeWidth={3} opacity={0.7} />)}
      <path d="M-760 210 l60 -6 M-600 214 l70 -8" stroke="#ffffff22" strokeWidth={8} />
    </>}
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
    {closed.indian ? <BoardedUp x={-440} y={170} w={360} h={206} /> : <>
      <ellipse cx={-265} cy={366} rx={90} ry={10} fill="#f8fafc" opacity={0.18} />
      <rect x={-350} y={352} width={170} height={14} rx={4} fill="#c1121f" stroke={INK} strokeWidth={1.5} />
      <ScoutBobber x={-333} y={352} s={1.05} />
      <FeatherWing x={-420} y={196} />
      <path d="M-430 186 l80 -4 M-200 300 l90 -10" stroke="#ffffff1a" strokeWidth={10} />
    </>}
    {/* Roof flags */}
    <path d="M-440 56 V4 M-60 56 V4" stroke="#9ca3af" strokeWidth={3} /><circle cx={-440} cy={4} r={3} fill="#facc15" /><circle cx={-60} cy={4} r={3} fill="#facc15" />
    <ShopFlag x={-438} y={6} brand="indian" slot={0} />
    <ShopFlag x={-58} y={6} brand="indian" slot={2} />
    {/* Glass door */}
    <rect x={-70} y={210} width={56} height={166} fill="#334155" stroke={INK} strokeWidth={2} />
    <path d="M-42 210 v166" stroke={INK} strokeWidth={1.5} />
    <rect x={-66} y={290} width={8} height={30} rx={2} fill="#c1121f" />
    {closed.indian && <BoardedUp x={-70} y={210} w={56} h={166} />}

    {/* ---- Back lanes at each end ---- */}
    <Alley x={-650} wallTop={56} wallColor="#1c1c1e" corner={false} cornerWall="#9ca3af" />
    <Woolies />
    <Alley x={2050} flip wallTop={110} wallColor="#fcd116" cornerW={76} corner={false} />
    <StripClub />
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

    {/* ---- Past Snag Alley: the esplanade park and the surf beach ---- */}
    <g transform="translate(160 0)"><Beachfront /></g>
    {/* ---- Street furniture ---- */}
    <rect x={-1120} y={380} width={4730} height={40} fill="#b9b4aa" />
    {Array.from({ length: 158 }, (_, i) => <line key={i} x1={-1120 + i * 30} y1={380} x2={-1120 + i * 30} y2={420} stroke="#a39e93" strokeWidth={1.5} />)}
    <rect x={-1120} y={380} width={4730} height={4} fill="#8f8a80" />
    <WooliesFootpath />
    <LaneCrossing x={-650} />
    <LaneCrossing x={2050} flip />
    {/* The chemist's yellow bollards (not across the doors) */}
    {[1712, 1752, 1792, 1832, 1918, 1958, 1998, 2038].map(x => <rect key={x} x={x - 3} y={384} width={6} height={20} rx={2} fill="#fcd116" stroke={INK} strokeWidth={1.1} />)}
    <LaneSign x={-520} name="DOLE LANE" />
    <LaneSign x={2108} name="SNAG ALLEY" />
    {/* The bike shops' rides parked out front, on the footpath */}
    {/* Harley row: angled into the kerb, front wheels turned out to the street, pointing back down
        the street at the Indian shop. Some baggers with batwing fairings. Drawn left to right so each
        bike's tucked-in back end sits behind its neighbour. */}
    {closed.harley ? <GlassOnPath x={1040} w={380} /> : Array.from({ length: 11 }, (_, i) => 1030 + i * 39).map((x, i) => <AngledBike key={x} x={x} y={412} s={1.1} flip fairing={i % 3 === 1}
      color={["#111", "#4338ca", "#7f1d1d", "#111", "#52525b", "#ea580c", "#1e1b4b", "#111", "#4338ca", "#3f3f46", "#9a3412"][i]} />)}
    {/* Indian row: same, angled the other way, pointing at the Harley shop. Drawn right to left. */}
    {closed.indian ? <GlassOnPath x={-430} w={360} /> : Array.from({ length: 9 }, (_, i) => -110 - i * 40).map((x, i) => <AngledBike key={x} x={x} y={412} s={1.1} fairing={i % 4 === 2}
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
    <rect x={-597} y={52} width={10} height={348} fill="#8a7a5f" stroke={INK} strokeWidth={1.5} />
    <path d="M-609 72 h34 M-607 104 h30" stroke="#5b4636" strokeWidth={5} />
    <path d="M-592 100 Q-300 160 0 140 M-592 76 Q-300 124 0 110" stroke="#1f2937" strokeWidth={2} fill="none" />
    <path d="M0 140 Q360 165 694 70 M0 110 Q360 132 702 92 M758 70 Q1580 150 2410 70 M750 92 Q1580 175 2410 104" stroke="#1f2937" strokeWidth={2} fill="none" />
    {/* The obligatory shoes on a wire (the fruit bats hanging off the wires are live, in the game) */}
    {([["midLow", 0.46, "#ef4444", "#111"], ["rightLow", 0.82, "#f8fafc", "#2563eb"], ["leftHigh", 0.62, "#111", "#facc15"]] as [keyof typeof WIRES, number, string, string][]).map(([wire, t, colour, trim], i) => {
      const at = onWire(WIRES[wire], t);
      return <HangingShoes key={`shoes${i}`} x={at.x} y={at.y} colour={colour} trim={trim} delay={-i * 0.5} />;
    })}
    {[[388, 131], [1353, 108], [1427, 110]].map(([x, y], i) => <g key={i} className={styles.wireBird} style={{ animationDelay: `${-i * 0.7}s` }}><ellipse cx={x} cy={y - 5} rx={5} ry={4} fill="#1f2937" /><circle cx={x + 4} cy={y - 9} r={2.6} fill="#1f2937" /></g>)}
  </svg>;
}
