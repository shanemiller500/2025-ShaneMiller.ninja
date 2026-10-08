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
