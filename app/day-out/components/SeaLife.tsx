import styles from "../day-out.module.css";

// Things going on out on the water at the beach end. Everything travels right-to-left (in from the
// open sea) and is drawn facing left.
const INK = "#111";

// A ski boat towing a water-skier. viewBox 200×50, waterline y≈40; boat at the left (bow at x=0),
// rope back to the skier. `skier` false = they've stacked it and the rope's trailing.
export function SkiBoat({ skier = true }: { skier?: boolean }) {
  return <svg viewBox="0 0 200 50" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M0 34 Q8 22 26 22 H70 L66 40 H10 Q2 40 0 34 Z" fill="#f8fafc" stroke={INK} strokeWidth={1.6} />
    <path d="M4 32 H68" stroke="#dc2626" strokeWidth={3} />
    <path d="M30 22 L36 12 H44 L42 22" fill="#93c5fd" stroke={INK} strokeWidth={1.2} opacity={0.85} />
    <circle cx={50} cy={16} r={4.5} fill="#e0a982" stroke={INK} strokeWidth={1} /><path d="M46 14 q4 -5 9 0" fill="#111" />
    <rect x={66} y={26} width={8} height={12} fill="#27272a" stroke={INK} strokeWidth={1} />
    <path className={styles.wakeFoam} d="M74 40 q14 -4 28 0 t28 0 t28 0 t28 0" stroke="#f8fafc" strokeWidth={3} fill="none" />
    {skier
      ? <>
        <path d="M74 30 Q120 28 150 24" stroke="#facc15" strokeWidth={1.2} fill="none" />
        <g className={styles.skierLean}>
          <path d="M146 40 h26 M148 38 h26" stroke="#f97316" strokeWidth={2.5} strokeLinecap="round" />
          <path d="M156 38 L160 26 M164 38 L162 26" stroke="#e0a982" strokeWidth={3.2} strokeLinecap="round" />
          <path d="M156 28 h10 v-12 h-10 z" fill="#2563eb" stroke={INK} strokeWidth={1} />
          <path d="M158 18 L150 24 M164 18 L152 25" stroke="#e0a982" strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={161} cy={11} r={4.4} fill="#e0a982" stroke={INK} strokeWidth={1} /><path d="M157 9 q4 -5 8 0" fill="#7c2d12" />
          <path d="M176 40 q6 -8 14 -4" stroke="#f8fafc" strokeWidth={2.5} fill="none" />
        </g>
      </>
      : <path d="M74 30 Q110 40 150 38" stroke="#facc15" strokeWidth={1.2} fill="none" />}
  </svg>;
}
// The skier after the stack: head, one arm up, a ski poking out of the water. viewBox 40×30.
export function StackedSkier() {
  return <svg viewBox="0 0 40 30" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M28 24 L34 6" stroke="#f97316" strokeWidth={3} strokeLinecap="round" />
    <g className={styles.flailArm} style={{ transformOrigin: "14px 22px" }}><path d="M14 22 L8 8" stroke="#e0a982" strokeWidth={3} strokeLinecap="round" /></g>
    <circle cx={18} cy={20} r={5} fill="#e0a982" stroke={INK} strokeWidth={1} /><path d="M13 18 q5 -6 10 0" fill="#7c2d12" />
    <path d="M2 26 q6 -4 12 0 t12 0 t12 0" stroke="#e0f2fe" strokeWidth={2} fill="none" />
  </svg>;
}
// A jet ski, rider standing up, rooster tail of spray out the back. viewBox 80×40.
export function JetSki({ colour = "#facc15" }: { colour?: string }) {
  return <svg viewBox="0 0 80 40" width="100%" height="100%" aria-hidden overflow="visible">
    <path className={styles.wakeFoam} d="M44 34 q8 -10 16 -6 q10 -12 18 -4" stroke="#f8fafc" strokeWidth={4} fill="none" strokeLinecap="round" />
    <path d="M2 30 Q10 22 24 22 H44 L42 34 H8 Q2 34 2 30 Z" fill={colour} stroke={INK} strokeWidth={1.5} />
    <path d="M6 30 H42" stroke="#111" strokeWidth={2} />
    <path d="M18 22 L14 14 L22 14" stroke="#111" strokeWidth={2} fill="none" />
    <path d="M28 22 L26 10 M34 22 L32 10" stroke="#e0a982" strokeWidth={3} strokeLinecap="round" />
    <path d="M24 12 h12 v-10 h-12 z" fill="#111" stroke={INK} strokeWidth={1} />
    <path d="M26 4 L16 12" stroke="#e0a982" strokeWidth={2.4} strokeLinecap="round" />
    <circle cx={30} cy={-3} r={4.4} fill="#e0a982" stroke={INK} strokeWidth={1} /><rect x={25} y={-5} width={7} height={2.6} rx={1.3} fill="#111" />
  </svg>;
}
// A parasail rig: the tow boat down on the water, the line up to a striped chute and the punter
// dangling under it. viewBox 220×200, waterline y≈192. `rider` false = they've come off.
export function Parasail({ rider = true }: { rider?: boolean }) {
  return <svg viewBox="0 0 220 200" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M0 186 Q6 176 20 176 H58 L54 192 H8 Q0 192 0 186 Z" fill="#f8fafc" stroke={INK} strokeWidth={1.5} />
    <path d="M4 184 H56" stroke="#2563eb" strokeWidth={3} />
    <path d="M56 178 L190 52" stroke="#111" strokeWidth={1} />
    <path className={styles.wakeFoam} d="M58 192 q12 -4 24 0 t24 0 t24 0" stroke="#f8fafc" strokeWidth={2.5} fill="none" />
    <g className={styles.chuteSway} style={{ transformOrigin: "190px 52px" }}>
      <path d="M160 20 Q190 -14 220 20 Q205 14 190 16 Q175 14 160 20 Z" fill="#facc15" stroke={INK} strokeWidth={1.5} />
      <path d="M172 10 Q190 -6 208 10 L204 16 Q190 12 176 16 Z" fill="#dc2626" />
      <path d="M162 20 L190 52 M218 20 L190 52 M176 17 L190 52 M204 17 L190 52" stroke="#4b5563" strokeWidth={0.8} />
      {rider && <g>
        <path d="M184 52 h12 v8 h-12 z" fill="#2563eb" stroke={INK} strokeWidth={1} />
        <path d="M186 60 L184 72 M194 60 L196 72" stroke="#e0a982" strokeWidth={3} strokeLinecap="round" />
        <path d="M186 52 L182 44 M194 52 L198 44" stroke="#e0a982" strokeWidth={2.4} strokeLinecap="round" />
        <circle cx={190} cy={46} r={4.4} fill="#e0a982" stroke={INK} strokeWidth={1} /><path d="M186 44 q4 -5 8 0" fill="#fde047" />
      </g>}
    </g>
  </svg>;
}
// A parasailer dropping out of the sky, limbs everywhere. viewBox 30×40.
export function FallingRider() {
  return <svg viewBox="0 0 30 40" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M9 18 h12 v10 h-12 z" fill="#2563eb" stroke={INK} strokeWidth={1} />
    <path d="M11 28 L6 38 M19 28 L25 38 M10 20 L2 12 M20 20 L28 12" stroke="#e0a982" strokeWidth={3} strokeLinecap="round" />
    <circle cx={15} cy={12} r={5} fill="#e0a982" stroke={INK} strokeWidth={1} /><ellipse cx={15} cy={14} rx={2} ry={1.6} fill={INK} />
    <path d="M10 10 q5 -6 10 0" fill="#fde047" />
  </svg>;
}
// A pod of dolphins leaping one after another. Drawn facing right (the game flips the pod to face
// the way it is swimming). viewBox 200×60, waterline y≈52.
export function DolphinPod() {
  return <svg viewBox="0 0 200 60" width="100%" height="100%" aria-hidden overflow="visible">
    {[0, 1, 2, 3].map(i => <g key={i} transform={`translate(${10 + i * 46} 52)`}>
      <g className={styles.dolphinJump} style={{ animationDelay: `${i * 0.28}s` }}>
        <path d="M0 0 Q6 -22 26 -24 Q34 -24 38 -20 L46 -22 L40 -16 Q38 -8 30 -6 Q14 -4 0 0 Z" fill="#64748b" stroke={INK} strokeWidth={1.3} />
        <path d="M4 -4 Q14 -10 30 -8" stroke="#cbd5e1" strokeWidth={2.5} fill="none" />
        <path d="M18 -22 L20 -32 L26 -23 Z" fill="#64748b" stroke={INK} strokeWidth={1} />
        <path d="M0 0 L-6 -6 M0 0 L-6 4" stroke="#475569" strokeWidth={3} strokeLinecap="round" />
        <circle cx={31} cy={-18} r={1.2} fill={INK} />
      </g>
    </g>)}
    <path d="M0 54 q8 -4 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0" stroke="#e0f2fe" strokeWidth={1.6} fill="none" />
  </svg>;
}
// A humpback breaching: out of the water, belly grooves, pectoral fins. viewBox 160×120,
// waterline y≈112.
export function WhaleBreach() {
  return <svg viewBox="0 0 160 120" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M40 112 Q30 60 70 20 Q90 4 104 10 Q112 18 104 36 Q92 70 96 112 Z" fill="#1e293b" stroke={INK} strokeWidth={2} />
    <path d="M56 106 Q52 70 80 34 Q92 22 100 26" stroke="#f1f5f9" strokeWidth={10} fill="none" opacity={0.9} />
    {[0, 1, 2, 3].map(i => <path key={i} d={`M${64 + i * 6} ${100 - i * 4} Q${66 + i * 6} ${70 - i * 6} ${86 + i * 3} ${40 - i * 2}`} stroke="#94a3b8" strokeWidth={1.2} fill="none" />)}
    <path d="M58 70 Q30 64 16 82 Q36 78 60 82 Z" fill="#334155" stroke={INK} strokeWidth={1.4} />
    <circle cx={96} cy={22} r={2} fill="#f8fafc" />
    <path d="M10 114 q20 -20 40 -6 q20 -18 40 0 q20 -16 40 0 q12 -8 24 2" stroke="#f8fafc" strokeWidth={5} fill="none" strokeLinecap="round" />
  </svg>;
}
// A whale's tail fluke lifting out of the water, plus a spout. viewBox 80×60, waterline y≈54.
export function WhaleTail() {
  return <svg viewBox="0 0 80 60" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M36 54 Q38 34 40 26 Q26 18 10 22 Q22 26 30 32 Q34 30 40 26 Q46 30 50 32 Q58 26 70 22 Q54 18 40 26" fill="#1e293b" stroke={INK} strokeWidth={1.6} />
    <path d="M36 54 Q38 36 40 28 Q42 36 44 54 Z" fill="#1e293b" stroke={INK} strokeWidth={1.4} />
    <path d="M20 26 h4 M54 26 h4" stroke="#94a3b8" strokeWidth={1} />
    <path d="M0 56 q8 -4 16 0 t16 0 t16 0 t16 0 t16 0" stroke="#e0f2fe" strokeWidth={2} fill="none" />
  </svg>;
}
// Steve, host of "Steve's Wild Oz": khaki shirt and shorts, big boots, an Akubra, and no sense of
// self-preservation. Faces right; viewBox 50×100, feet on y=98. "hold" shows off a bluebottle on a
// stick; "zapped" is him lit up and frazzled; "hop" is him hopping about clutching his leg.
export function Bazza({ pose = "walk" }: { pose?: "walk" | "hold" | "zapped" | "hop" }) {
  const SKIN = "#e0a982", KHAKI = "#a3926a";
  return <svg viewBox="0 0 50 100" width="100%" height="100%" aria-hidden overflow="visible">
    <g className={pose === "zapped" ? styles.zapShake : undefined}>
      <g className={pose === "walk" ? styles.bludgerLegs : undefined}>
        <path d={pose === "hop" ? "M20 66 L18 96 M30 66 L36 78 L28 84" : "M20 66 L18 96 M30 66 L32 96"} stroke={SKIN} strokeWidth={5} strokeLinecap="round" fill="none" />
      </g>
      <path d="M13 96 h10 M27 96 h10" stroke="#3f2a14" strokeWidth={5} strokeLinecap="round" />
      <path d="M15 56 h20 l2 12 h-24 z" fill={KHAKI} stroke={INK} strokeWidth={1.4} />
      <path d="M14 32 q11 -6 22 0 l1 26 h-24 z" fill={KHAKI} stroke={INK} strokeWidth={1.5} />
      <path d="M25 30 v26 M18 38 h5 M28 38 h5" stroke="#7c6c48" strokeWidth={1.2} />
      {pose === "hold" && <><path d="M34 36 L44 28" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" /><path d="M44 28 L50 6" stroke="#78350f" strokeWidth={1.6} />
        <ellipse cx={51} cy={4} rx={5} ry={3.4} fill="#60a5fa" opacity={0.85} stroke="#1d4ed8" strokeWidth={0.8} /><path d="M49 7 q-2 8 1 16 M52 7 q2 8 -1 16" stroke="#3b82f6" strokeWidth={1} fill="none" /></>}
      {pose === "hop" && <path d="M34 36 L34 72" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" />}
      {pose === "zapped" && <path d="M16 36 L6 20 M34 36 L44 20" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" />}
      {pose === "walk" && <path d="M34 36 L38 54" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" />}
      <path d="M16 36 L12 54" stroke={SKIN} strokeWidth={4.5} strokeLinecap="round" />
      {pose === "hop" && <ellipse cx={34} cy={76} rx={4} ry={3} fill="#ef4444" opacity={0.8} />}
      <circle cx={25} cy={20} r={9} fill={SKIN} stroke={INK} strokeWidth={1.5} />
      {pose === "zapped"
        ? <><path d="M20 17 a2 2 0 1 1 3 2 M27 17 a2 2 0 1 1 3 2" stroke={INK} strokeWidth={1.1} fill="none" /><ellipse cx={26} cy={25} rx={3} ry={2.4} fill={INK} /></>
        : <><circle cx={28} cy={18} r={1.1} fill={INK} /><path d={pose === "hop" ? "M24 25 q3 -2 6 0" : "M23 24 q4 4 8 0"} stroke={INK} strokeWidth={1.2} fill={pose === "hold" ? INK : "none"} /></>}
      <path d="M12 14 q13 -4 26 0 l-3 -3 q-2 -8 -10 -8 q-8 0 -10 8 z" fill="#78350f" stroke={INK} strokeWidth={1.2} />
      <path d="M9 14 h32" stroke="#5b3a1e" strokeWidth={2.5} strokeLinecap="round" />
      {pose === "zapped" && <g stroke="#fde047" strokeWidth={2} fill="none" strokeLinejoin="round"><path d="M4 8 l4 4 l-3 2 l5 5" /><path d="M46 10 l-4 4 l3 2 l-5 5" /><path d="M22 -2 l3 4 l-3 1 l3 4" /></g>}
    </g>
  </svg>;
}

// The VMR boat (Volunteer Marine Rescue): a white catamaran, blue tower at the back, RESCUE down
// the hull in big blue letters, crew in the back. Faces left; viewBox 220×80, waterline y≈70.
// `tow` trails a tow rope out the back; `hook` has a crewie reaching down with the boat hook.
export function VMRBoat({ tow = false, hook = false }: { tow?: boolean; hook?: boolean }) {
  return <svg viewBox="0 0 220 80" width="100%" height="100%" aria-hidden overflow="visible">
    {tow && <path d="M206 52 Q240 62 270 54" stroke="#facc15" strokeWidth={1.6} fill="none" />}
    <path className={styles.wakeFoam} d="M196 70 q12 -4 24 0 t24 0" stroke="#f8fafc" strokeWidth={3} fill="none" />
    <path d="M150 18 L168 2 H192 L188 40 H152 Z" fill="#1d4ed8" stroke={INK} strokeWidth={1.4} />
    <rect x={164} y={-2} width={22} height={4} rx={1.5} fill="#dc2626" className={styles.marqueeBulb} />
    <path d="M40 40 L58 18 H150 L156 40 Z" fill="#f8fafc" stroke={INK} strokeWidth={1.5} />
    <path d="M60 22 H146 L150 33 H52 Z" fill="#1e293b" />
    <text x={70} y={38.5} fontSize={6.5} fontWeight={900} fill="#dc2626" fontFamily="sans-serif">VMR</text>
    <text x={88} y={38.5} fontSize={4.5} fontWeight={800} fill="#111" fontFamily="sans-serif">24 Hour Marine Assistance</text>
    <path d="M0 54 Q6 40 30 40 H204 L200 66 H14 Q2 66 0 54 Z" fill="#f8fafc" stroke={INK} strokeWidth={1.8} />
    <path d="M6 52 H202" stroke="#1f2937" strokeWidth={3} />
    {"RESCUE".split("").map((ch, i) => <g key={i}>
      <rect x={62 + i * 22} y={43} width={20} height={20} fill="#f8fafc" stroke="#1f2937" strokeWidth={1.2} />
      <text x={72 + i * 22} y={59} textAnchor="middle" fontSize={15} fontWeight={900} fill="#1d4ed8" fontFamily="sans-serif">{ch}</text>
    </g>)}
    <text x={30} y={50} textAnchor="middle" fontSize={6} fontWeight={900} fontStyle="italic" fill="#1d4ed8" fontFamily="sans-serif">MARINE</text>
    <text x={30} y={57} textAnchor="middle" fontSize={6} fontWeight={900} fontStyle="italic" fill="#1d4ed8" fontFamily="sans-serif">RESCUE</text>
    <circle cx={50} cy={53} r={5} fill="#dc2626" /><text x={50} y={56} textAnchor="middle" fontSize={7} fontWeight={900} fill="#fff" fontFamily="sans-serif">1</text>
    {/* Crew on the back deck in hi-vis */}
    {[176, 192].map(cx => <g key={cx}>
      <path d={`M${cx - 6} 40 q6 -8 12 0 z`} fill="#f97316" stroke={INK} strokeWidth={1} />
      <circle cx={cx} cy={27} r={4.5} fill="#e0a982" stroke={INK} strokeWidth={1} />
      {cx === 192
        // The deckie on the hook: blonde mullet, business up front, party flowing out the back.
        ? <><path d={`M${cx - 4.8} 25 q4.8 -7.5 9.6 0 q-2 -2 -4.8 -2 q-3 0 -4.8 2 z`} fill="#fde047" stroke={INK} strokeWidth={0.6} /><path d={`M${cx + 3} 24 q6 1 6 14 q-3 -4 -7 -7 q2 -3 1 -7 z`} fill="#fde047" stroke={INK} strokeWidth={0.6} /></>
        : <path d={`M${cx - 4.5} 25 q4.5 -6 9 0 z`} fill="#1d4ed8" />}
    </g>)}
    {hook && <><path d="M196 34 L216 48" stroke="#e0a982" strokeWidth={3} strokeLinecap="round" /><path d="M210 40 L236 74 q2 4 -2 5" stroke="#9ca3af" strokeWidth={2} fill="none" /></>}
  </svg>;
}
// A runabout that's carked it: smoke out of the outboard, the skipper waving his arms. Faces left;
// viewBox 100×44, waterline y≈38.
export function BrokenBoat() {
  return <svg viewBox="0 0 100 44" width="100%" height="100%" aria-hidden overflow="visible">
    {[0, 1, 2].map(i => <circle key={i} cx={86} cy={16} r={3 + i} fill="#6b7280" opacity={0.7} className={styles.smokePuff} style={{ animationDelay: `${-i * 0.8}s` }} />)}
    <path d="M0 30 Q6 22 18 22 H80 L78 36 H8 Q0 36 0 30 Z" fill="#f8fafc" stroke={INK} strokeWidth={1.5} />
    <path d="M4 29 H78" stroke="#16a34a" strokeWidth={3} />
    <path d="M30 22 L36 13 H46 L44 22" fill="#93c5fd" stroke={INK} strokeWidth={1.1} opacity={0.85} />
    <rect x={80} y={20} width={8} height={18} fill="#27272a" stroke={INK} strokeWidth={1} />
    <g className={styles.flailArm} style={{ transformOrigin: "58px 16px" }}><path d="M58 16 L52 2" stroke="#e0a982" strokeWidth={3} strokeLinecap="round" /></g>
    <path d="M54 22 q6 -8 12 0 z" fill="#dc2626" stroke={INK} strokeWidth={1} />
    <circle cx={60} cy={10} r={4.5} fill="#e0a982" stroke={INK} strokeWidth={1} /><path d="M56 8 q4 -5 8 0 z" fill="#facc15" />
    <path d="M0 40 q8 -4 16 0 t16 0 t16 0 t16 0 t16 0 t16 0" stroke="#e0f2fe" strokeWidth={1.6} fill="none" />
  </svg>;
}
// A floater: someone face down in the water after the shark had a go. Cartoon, no gore. viewBox 50×20.
export function Floater() {
  return <svg viewBox="0 0 50 20" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M10 9 L2 3 M12 11 L4 17" stroke="#e0a982" strokeWidth={2.6} strokeLinecap="round" />
    <path d="M12 6 h20 v8 h-20 z" fill="#2563eb" stroke={INK} strokeWidth={1} />
    <path d="M32 6 h10 v8 h-10 z" fill="#facc15" stroke={INK} strokeWidth={1} />
    <path d="M42 8 h6 M42 12 h6" stroke="#e0a982" strokeWidth={2.6} strokeLinecap="round" />
    <circle cx={9} cy={10} r={4.6} fill="#7c2d12" stroke={INK} strokeWidth={1} />
    <path d="M0 16 q6 -3 12 0 t12 0 t12 0 t12 0" stroke="#e0f2fe" strokeWidth={1.6} fill="none" />
  </svg>;
}

// A helicopter, side-on: bubble cockpit with the pilot, tail boom and fin, skids, and the rotors
// blurring round. Livery 0 is a red joy-flight chopper, 1 a yellow news chopper. Faces left;
// viewBox 120×60.
export function Helicopter({ livery = 0 }: { livery?: 0 | 1 }) {
  const body = livery ? "#facc15" : "#dc2626", stripe = livery ? "#1d4ed8" : "#f8fafc", label = livery ? "COAST NEWS" : "JOYFLIGHTS";
  return <svg viewBox="0 0 120 60" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M50 26 L112 22 L112 28 L52 34 Z" fill={body} stroke={INK} strokeWidth={1.4} />
    <path d="M106 22 L114 8 L118 8 L114 26 Z" fill={body} stroke={INK} strokeWidth={1.2} />
    <g className={styles.tailRotor} style={{ transformOrigin: "114px 22px" }}><path d="M114 14 V30" stroke="#374151" strokeWidth={2.4} strokeLinecap="round" /></g>
    <path d="M14 50 H62 M22 50 L26 42 M52 50 L48 42" stroke="#374151" strokeWidth={2.4} strokeLinecap="round" />
    <path d="M8 30 Q8 12 30 10 H52 Q66 12 66 30 Q60 42 34 42 H16 Q8 40 8 30 Z" fill={body} stroke={INK} strokeWidth={1.6} />
    <path d="M10 34 Q30 38 64 32" stroke={stripe} strokeWidth={3} fill="none" />
    <path d="M12 28 Q14 16 30 14 H40 V30 Z" fill="#7dd3fc" stroke={INK} strokeWidth={1.2} />
    <circle cx={30} cy={22} r={4} fill="#e0a982" stroke={INK} strokeWidth={0.8} /><path d="M26 20 q4 -5 8 0 z" fill="#111" />
    <text x={52} y={28} textAnchor="middle" fontSize={5} fontWeight={900} fill={stripe} fontFamily="sans-serif">{label}</text>
    <path d="M36 10 V4" stroke="#374151" strokeWidth={2.4} />
    <ellipse cx={36} cy={3} rx={48} ry={2.6} fill="#11111155" className={styles.rotorBlur} />
  </svg>;
}
// A pilot who bailed out, drifting down under a little round parachute. viewBox 40×56.
export function PilotChute() {
  return <svg viewBox="0 0 40 56" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M2 16 Q20 -6 38 16 Q29 12 20 14 Q11 12 2 16 Z" fill="#f97316" stroke={INK} strokeWidth={1.2} />
    <path d="M10 6 Q20 -2 30 6 L27 12 Q20 9 13 12 Z" fill="#f8fafc" />
    <path d="M3 16 L18 38 M37 16 L22 38 M14 13 L19 38 M26 13 L21 38" stroke="#4b5563" strokeWidth={0.6} />
    <path d="M16 38 h8 v8 h-8 z" fill="#1e3a8a" stroke={INK} strokeWidth={0.8} />
    <path d="M17 46 L15 54 M23 46 L25 54 M16 39 L12 32 M24 39 L28 32" stroke="#e0a982" strokeWidth={2} strokeLinecap="round" />
    <circle cx={20} cy={34} r={3.6} fill="#e0a982" stroke={INK} strokeWidth={0.8} /><ellipse cx={20} cy={35.4} rx={1.4} ry={1.1} fill={INK} />
  </svg>;
}
// What's left: a tail boom sticking up out of the water, bubbles coming up. viewBox 50×40.
export function ChopperWreck() {
  return <svg viewBox="0 0 50 40" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M18 34 L30 6 L36 8 L26 36 Z" fill="#dc2626" stroke={INK} strokeWidth={1.2} />
    <path d="M30 6 L38 0 L40 3 L35 9 Z" fill="#dc2626" stroke={INK} strokeWidth={1} />
    {[[12, 26], [40, 28], [8, 32]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.8} fill="#e0f2fe" className={styles.smokePuff} style={{ animationDelay: `${-i * 0.7}s` }} />)}
    <path d="M0 36 q6 -4 12 0 t12 0 t12 0 t12 0" stroke="#e0f2fe" strokeWidth={2} fill="none" />
  </svg>;
}

// Stefan's pink offshore race boat: a long, low pink hull with the rainbow stripe, the 444 race
// number, the "Stefan" signature down the side, a bubble canopy, and a rooster tail of spray that
// goes on forever. Bow at the left (it races right-to-left); viewBox 260×70, waterline y≈58.
export function StefanBoat() {
  const rainbow = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#a855f7"];
  return <svg viewBox="0 0 260 70" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Rooster tail and wake */}
    <path className={styles.wakeFoam} d="M190 50 Q230 20 300 6 Q280 30 320 26 Q290 46 330 50" stroke="#f8fafc" strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.9} />
    <path d="M196 54 Q240 36 300 30 Q270 46 320 48 Q270 58 200 58 Z" fill="#f8fafc" opacity={0.85} />
    <path className={styles.wakeFoam} d="M20 62 q30 -5 60 0 t60 0 t60 0 t60 0 t60 0" stroke="#e0f2fe" strokeWidth={3} fill="none" />
    {/* Hull */}
    <path d="M0 44 Q40 30 120 28 H196 L200 54 H26 Q8 52 0 44 Z" fill="#f472b6" stroke="#111" strokeWidth={1.8} />
    <path d="M6 48 Q40 46 200 50 L200 54 H26 Q12 53 6 48 Z" fill="#f9fafb" stroke="#111" strokeWidth={1} />
    {rainbow.map((c, i) => <path key={c} d={`M150 ${33 + i * 2.6} L196 ${33 + i * 2.6}`} stroke={c} strokeWidth={2.6} />)}
    {/* Canopy */}
    <path d="M86 28 Q96 14 122 14 Q140 14 146 28 Z" fill="#f472b6" stroke="#111" strokeWidth={1.4} />
    <path d="M96 26 Q102 18 118 18 Q130 18 134 26 Z" fill="#1e293b" />
    <path d="M168 28 V18 M176 28 V20" stroke="#4b5563" strokeWidth={3} strokeLinecap="round" />
    {/* 444 and the signature */}
    <rect x={56} y={33} width={30} height={14} rx={1.5} fill="#f8fafc" stroke="#111" strokeWidth={1.2} />
    <text x={71} y={44.5} textAnchor="middle" fontSize={12} fontWeight={900} fill="#111" fontFamily="Impact, 'Arial Black', sans-serif">444</text>
    <text x={122} y={45} textAnchor="middle" fontSize={17} fontStyle="italic" fontWeight={700} fill="#1e1b4b" fontFamily="'Brush Script MT', 'Segoe Script', cursive">Stefan</text>
  </svg>;
}
