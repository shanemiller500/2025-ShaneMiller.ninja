import styles from "../day-out.module.css";

// A tall, skinny Canary/Washingtonia-style palm: a ringed trunk with a slight lean, a shaggy brown
// skirt of dead fronds under the crown (where the roaches live), and a crown of green fronds that
// sway. viewBox 120×300, base of the trunk at (60, 300). `lean` flips the lean to the left.
const INK = "#111";
// Rounded so server and browser trig agree exactly (hydration).
const rd = (n: number) => Math.round(n * 100) / 100;

export default function PalmTree({ lean = 1, variant = 0 }: { lean?: 1 | -1; variant?: number }) {
  const top = 60 + lean * 10, green = ["#3f8f3a", "#4d9a42", "#357a36"][variant % 3], dark = "#2a5f2a";
  const fronds = [-150, -120, -85, -55, -20, 10, 40, 75];
  return <svg viewBox="0 0 120 300" width="100%" height="100%" aria-hidden overflow="visible">
    <path d={`M54 300 Q${56 + lean * 4} 160 ${top - 4} 62 L${top + 4} 62 Q${64 + lean * 4} 160 66 300 Z`} fill="#a0805a" stroke={INK} strokeWidth={2} />
    {Array.from({ length: 22 }, (_, i) => {
      const y = 290 - i * 10.5, t = (300 - y) / 238, x = 60 + (top - 60) * t * t;
      return <path key={i} d={`M${x - 6} ${y} q6 3 12 0`} stroke="#6b5235" strokeWidth={1.4} fill="none" />;
    })}
    {/* Skirt of dead fronds */}
    <path d={`M${top - 16} 66 q-4 18 2 34 l6 -10 l4 14 l5 -12 l5 14 l4 -14 l6 10 q6 -16 2 -36 z`} fill="#8a6a3e" stroke={INK} strokeWidth={1.4} />
    <g className={styles.palmCrown} style={{ transformOrigin: `${top}px 60px`, animationDelay: `${-variant * 0.9}s` }}>
      {fronds.map((a, i) => {
        const rad = (a * Math.PI) / 180, len = 58 + (i % 3) * 8, ex = rd(top + Math.cos(rad) * len), ey = rd(60 + Math.sin(rad) * len * 0.75 + 26);
        const cx = rd(top + Math.cos(rad) * len * 0.5), cy = rd(60 + Math.sin(rad) * len * 0.5 - 10);
        return <g key={a}>
          <path d={`M${top} 60 Q${cx} ${cy} ${ex} ${ey}`} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />
          <path d={`M${top} 60 Q${cx} ${cy} ${ex} ${ey}`} stroke={i % 2 ? green : dark} strokeWidth={7} fill="none" strokeLinecap="round" strokeDasharray="5 2" />
        </g>;
      })}
      <circle cx={top} cy={60} r={7} fill="#5b4636" stroke={INK} strokeWidth={1.4} />
    </g>
  </svg>;
}
