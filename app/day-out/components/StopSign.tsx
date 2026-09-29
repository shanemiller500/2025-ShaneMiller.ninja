// A roadside STOP sign. `holes` adds shotgun damage. viewBox 60×120.
const INK = "#111";

export default function StopSign({ holes = 0 }: { holes?: number }) {
  const shots = [[22, 24], [36, 30], [28, 38], [40, 18], [18, 36], [32, 22], [26, 30], [38, 40]].slice(0, holes * 4);
  return <svg viewBox="0 0 60 120" width="100%" height="100%" aria-hidden overflow="visible">
    <rect x={27} y={50} width={6} height={70} fill="#9aa0a6" stroke={INK} strokeWidth={2.5} />
    <polygon points="18,4 42,4 58,20 58,44 42,60 18,60 2,44 2,20" fill="#d32f2f" stroke={INK} strokeWidth={3} />
    <polygon points="20,9 40,9 53,22 53,42 40,55 20,55 7,42 7,22" fill="none" stroke="#fff" strokeWidth={2} />
    <text x={30} y={37} textAnchor="middle" fontSize={15} fontWeight={900} fill="#fff" fontFamily="sans-serif">STOP</text>
    {shots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.2} fill="#141517" stroke="#ffb3b3" strokeWidth={0.8} />)}
  </svg>;
}
