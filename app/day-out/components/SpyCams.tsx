import styles from "../day-out.module.css";

// Big Brother's kit: the little cameras strapped to trees and emus, and the not-at-all-suspicious
// "birds" doing laps of the street.
const INK = "#111";

// A small surveillance camera on a bracket, panning about, red light blinking. The bracket's at the
// left; it looks right. viewBox 30×20.
export function MiniCam() {
  return <svg viewBox="0 0 30 20" width="100%" height="100%" aria-hidden overflow="visible">
    <rect x={0} y={4} width={4} height={10} fill="#9ca3af" stroke={INK} strokeWidth={0.8} />
    <g className={styles.camPan}>
      <path d="M3 9 L9 11" stroke="#6b7280" strokeWidth={2} />
      <rect x={8} y={7} width={15} height={8} rx={2} fill="#e5e7eb" stroke={INK} strokeWidth={0.9} />
      <path d="M7 6 h17" stroke="#9ca3af" strokeWidth={1.6} />
      <circle cx={23.5} cy={11} r={2.6} fill="#111" /><circle cx={24} cy={10.4} r={0.8} fill="#7dd3fc" />
      <circle cx={11} cy={9.5} r={1.1} fill="#ef4444" className={styles.camLed} />
    </g>
  </svg>;
}

// A "bird". It has a lens for an eye, an aerial with a blinking light, rivets, a serial number on
// the wing, and two little propellers keeping it up. Totally a real bird. Faces right; viewBox 50×34.
export function SpyBird() {
  return <svg viewBox="0 0 50 34" width="100%" height="100%" aria-hidden overflow="visible">
    <path d="M14 8 V2 M34 8 V2" stroke="#374151" strokeWidth={1.4} />
    <ellipse cx={14} cy={2} rx={9} ry={1.6} fill="#11111166" className={styles.rotorBlur} />
    <ellipse cx={34} cy={2} rx={9} ry={1.6} fill="#11111166" className={styles.rotorBlur} style={{ animationDelay: "-.04s" }} />
    <path d="M6 18 L0 14 L1 22 Z" fill="#6b7280" stroke={INK} strokeWidth={0.8} />
    <rect x={6} y={10} width={30} height={16} rx={6} fill="#9ca3af" stroke={INK} strokeWidth={1.2} />
    <path d="M12 10 V26 M24 10 V26" stroke="#6b7280" strokeWidth={0.8} />
    {[[9, 13], [9, 23], [33, 13], [33, 23]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={0.8} fill="#374151" />)}
    <g className={styles.gullFlap} style={{ transformOrigin: "20px 14px" }}>
      <path d="M12 14 Q20 2 30 4 Q26 10 26 14 Z" fill="#cbd5e1" stroke={INK} strokeWidth={1} />
    </g>
    <text x={19} y={23} textAnchor="middle" fontSize={4} fontWeight={900} fill="#1f2937" fontFamily="monospace">BIRD-07</text>
    <circle cx={40} cy={14} r={7} fill="#cbd5e1" stroke={INK} strokeWidth={1.1} />
    <circle cx={42} cy={14} r={4} fill="#111" /><circle cx={43} cy={13} r={1.3} fill="#7dd3fc" />
    <path d="M46 16 L50 17 L46 18 Z" fill="#f59e0b" stroke={INK} strokeWidth={0.6} />
    <path d="M38 7 L36 -3" stroke="#374151" strokeWidth={1} />
    <circle cx={36} cy={-3.5} r={1.4} fill="#ef4444" className={styles.camLed} />
    <path d="M18 26 V31 M26 26 V31" stroke="#374151" strokeWidth={1.4} />
  </svg>;
}

// The repair van: a white van, "PRISON ISLAND CCTV" down the side, "Welcome to the Penitentiary",
// bars on the back window, ladder on the roof rack, orange beacon flashing. The body flips with
// `faceLeft` but the writing stays the right way round. viewBox 200×90, wheels on y=88.
export function CCTVVan({ faceLeft = false }: { faceLeft?: boolean }) {
  return <svg viewBox="0 0 200 90" width="100%" height="100%" aria-hidden overflow="visible">
    <g transform={faceLeft ? "translate(200 0) scale(-1 1)" : undefined}>
      <path d="M30 10 H150 M30 4 H150 M40 4 V10 M60 4 V10 M80 4 V10 M100 4 V10 M120 4 V10 M140 4 V10" stroke="#9ca3af" strokeWidth={2} />
      <rect x={86} y={0} width={10} height={6} rx={2} fill="#f97316" stroke={INK} strokeWidth={0.8} className={styles.camLed} />
      <path d="M6 14 H150 L170 18 Q188 30 194 50 V74 H6 Z" fill="#f8fafc" stroke={INK} strokeWidth={2} />
      <path d="M152 18 L168 20 Q182 30 186 46 H152 Z" fill="#1e293b" stroke={INK} strokeWidth={1.4} />
      <rect x={12} y={22} width={24} height={20} fill="#1e293b" stroke={INK} strokeWidth={1.2} />
      <path d="M17 22 V42 M22 22 V42 M27 22 V42 M32 22 V42" stroke="#9ca3af" strokeWidth={1.6} />
      <path d="M6 60 H194" stroke="#dc2626" strokeWidth={4} />
      <rect x={186} y={54} width={8} height={6} rx={1.5} fill="#fef08a" stroke={INK} strokeWidth={0.8} />
      {[40, 160].map(cx => <g key={cx}><circle cx={cx} cy={76} r={12} fill="#111" /><circle cx={cx} cy={76} r={5} fill="#9ca3af" /></g>)}
    </g>
    <text x={faceLeft ? 108 : 92} y={34} textAnchor="middle" fontSize={13} fontWeight={900} fill="#1e3a8a" fontFamily="Impact, 'Arial Black', sans-serif" letterSpacing={0.5}>PRISON ISLAND</text>
    <text x={faceLeft ? 108 : 92} y={48} textAnchor="middle" fontSize={11} fontWeight={900} fill="#dc2626" fontFamily="Impact, 'Arial Black', sans-serif" letterSpacing={2}>📹 CCTV</text>
    <text x={faceLeft ? 108 : 92} y={57} textAnchor="middle" fontSize={6.4} fontStyle="italic" fontWeight={800} fill="#111" fontFamily="sans-serif">Welcome to the Penitentiary</text>
  </svg>;
}
// The CCTV tech: hard hat, hi-vis, tool belt, the enthusiasm of a man on his twelfth callout.
// Faces right; viewBox 40×100, feet on y=98. "walk" or "climb" (arms up, on the ladder).
export function CCTVTech({ pose = "walk" }: { pose?: "walk" | "climb" }) {
  const SKIN = "#e0ac69";
  return <svg viewBox="0 0 40 100" width="100%" height="100%" aria-hidden overflow="visible">
    <g className={pose === "walk" ? styles.bludgerLegs : undefined}><path d="M17 64 L15 95 M24 64 L26 95" stroke="#1e3a8a" strokeWidth={5} strokeLinecap="round" /></g>
    <path d="M10 97 h9 M22 97 h9" stroke="#3f2a14" strokeWidth={4} strokeLinecap="round" />
    <path d="M11 34 q9 -6 18 0 l2 30 h-22 z" fill="#f97316" stroke={INK} strokeWidth={1.5} />
    <path d="M11 44 h20 M11 52 h20" stroke="#e5e7eb" strokeWidth={2.4} />
    <path d="M10 62 h21" stroke="#78350f" strokeWidth={3} /><rect x={24} y={60} width={5} height={7} fill="#4b5563" />
    {pose === "climb"
      ? <path d="M12 38 L8 18 M28 38 L32 18" stroke={SKIN} strokeWidth={4.2} strokeLinecap="round" />
      : <path d="M12 38 L9 56 M28 38 L31 56" stroke={SKIN} strokeWidth={4.2} strokeLinecap="round" />}
    <circle cx={21} cy={22} r={8.5} fill={SKIN} stroke={INK} strokeWidth={1.5} />
    <circle cx={24} cy={21} r={1.1} fill={INK} /><path d="M21 27 h6" stroke={INK} strokeWidth={1.1} />
    <path d="M11 19 q10 -13 20 0 l3 1 h-26 z" fill="#facc15" stroke={INK} strokeWidth={1.2} />
  </svg>;
}
