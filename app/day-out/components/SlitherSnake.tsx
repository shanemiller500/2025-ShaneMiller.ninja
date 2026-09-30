import styles from "../day-out.module.css";

// A hoop snake before it hoops: stretched out and slithering along the road. The body is a
// chain of segments that ripple up and down (CSS). Faces right; viewBox 120×30.
const INK = "#111";
const SEGMENTS = Array.from({ length: 12 }, (_, i) => ({ x: 6 + i * 8.2, r: 2.6 + i * 0.36, delay: -i * 90 }));

export default function SlitherSnake() {
  return <svg viewBox="0 0 120 30" width="100%" height="100%" aria-hidden overflow="visible">
    {/* Outline pass first so the body reads as one smooth tube */}
    {SEGMENTS.map((sg, i) => <circle key={`o${i}`} className={styles.slitherSeg} style={{ animationDelay: `${sg.delay}ms` }} cx={sg.x} cy={20} r={sg.r + 1.6} fill={INK} />)}
    {SEGMENTS.map((sg, i) => <circle key={`f${i}`} className={styles.slitherSeg} style={{ animationDelay: `${sg.delay}ms` }} cx={sg.x} cy={20} r={sg.r} fill={i % 3 === 1 ? "#c9a86a" : "#7a5c2e"} />)}
    <g className={styles.slitherSeg} style={{ animationDelay: "-1080ms" }}>
      <ellipse cx={108} cy={19} rx={9} ry={6.5} fill="#7a5c2e" stroke={INK} strokeWidth={1.6} />
      <circle cx={110} cy={16.5} r={1.8} fill="#ffd23f" stroke={INK} strokeWidth={0.8} />
      <path className={styles.snakeTongue} d="M116 20 h5 l2 -2 m-2 2 l2 2" stroke="#d62828" strokeWidth={1.3} fill="none" strokeLinecap="round" />
    </g>
  </svg>;
}
