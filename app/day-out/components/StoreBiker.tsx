import styles from "../day-out.module.css";

// A biker from one of the bike shops, in the shop's colours: Harley blokes in black leather with an
// orange bar-and-shield patch and a bandana; Indian blokes in a red vest with a cream "Indian"
// script patch and an open-face lid. `look` (0-2) varies the beard and gut. Faces right; viewBox
// 50×100, feet at y=98. `walking` swings the legs; `flipping` throws the bird at the rival shop;
// `laughing` has him cracking up, shaking, gob wide open.
const INK = "#111", SKIN = "#e0a982";

export default function StoreBiker({ brand, look = 0, walking = false, flipping = false, laughing = false }: { brand: "harley" | "indian"; look?: number; walking?: boolean; flipping?: boolean; laughing?: boolean }) {
  const harley = brand === "harley";
  const vest = harley ? "#18181b" : "#b91c1c", trim = harley ? "#f97316" : "#f3e6c8";
  const beard = ["#57534e", "#d6d3d1", "#7c2d12"][look % 3], gut = look % 3 === 1 ? 6 : look % 3 === 2 ? 3 : 0;
  return <svg viewBox="0 0 50 100" width="100%" height="100%" aria-hidden overflow="visible"><g className={laughing ? styles.bikerLaugh : undefined}>
    <g className={walking ? styles.bludgerLegs : undefined}>
      <path d="M19 66 L17 95 M29 66 L31 95" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <path d="M19 66 L17 95 M29 66 L31 95" stroke="#1e3a8a" strokeWidth={5} strokeLinecap="round" />
    </g>
    <path d="M11 97 h12 M25 97 h12" stroke={INK} strokeWidth={5} strokeLinecap="round" />
    {/* T-shirt and gut, then the vest over the top with the shop patch on the back */}
    <path d={`M12 34 q12 -8 24 0 q${4 + gut} 16 2 34 h-26 q-4 -16 0 -34 z`} fill={harley ? "#f8fafc" : "#111"} stroke={INK} strokeWidth={1.8} />
    <path d="M12 34 q5 -4 11 -5 l1 38 h-12 q-4 -16 0 -33 z" fill={vest} stroke={INK} strokeWidth={1.6} />
    <path d="M12 34 q5 -4 11 -5" stroke={trim} strokeWidth={2} fill="none" />
    {harley
      ? <g transform="translate(13 42)"><path d="M0 0 h9 l-1 4 q-1 4 -3.5 6 q-2.5 -2 -3.5 -6 z" fill="#f97316" stroke="#fff" strokeWidth={0.8} /><rect x={-1} y={2.5} width={11} height={2.6} fill="#111" /></g>
      : <text x={17.5} y={50} textAnchor="middle" fontSize={7.5} fontStyle="italic" fontWeight={900} fill="#f3e6c8" fontFamily="'Brush Script MT', 'Segoe Script', cursive">Indian</text>}
    <path d="M14 66 h22" stroke="#78350f" strokeWidth={3} />
    <rect x={23} y={64} width={5} height={4} fill="#d4d4d8" />
    {/* Arm: down by his side, or up and forward with the middle finger out */}
    {flipping
      ? <g className={styles.birdThrust}>
        <path d="M32 38 L44 26" stroke={harley ? "#f8fafc" : "#111"} strokeWidth={6} strokeLinecap="round" />
        <path d="M38 32 L45 24" stroke={SKIN} strokeWidth={5} strokeLinecap="round" />
        <circle cx={46} cy={22} r={3.6} fill={SKIN} stroke={INK} strokeWidth={1} />
        <path d="M47 20 l1.5 -8" stroke={SKIN} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M47 20 l1.5 -8" stroke={INK} strokeWidth={0.6} fill="none" opacity={0.6} />
      </g>
      : <>
        <path d="M33 38 L37 56" stroke={harley ? "#f8fafc" : "#111"} strokeWidth={6} strokeLinecap="round" />
        <path d="M36 52 L38 60" stroke={SKIN} strokeWidth={5} strokeLinecap="round" />
      </>}
    {/* Head, shades, beard, and a bandana (Harley) or an open-face lid (Indian) */}
    <circle cx={26} cy={20} r={9.5} fill={SKIN} stroke={INK} strokeWidth={1.8} />
    <path d={`M18 22 q2 ${12 + look % 3 * 2} 10 ${13 + look % 3 * 2} q8 -2 8 -14 q-4 3 -9 2 q-5 1 -9 -1 z`} fill={beard} stroke={INK} strokeWidth={1.1} />
    {flipping && <path d="M29 26 q3 -2 6 0 q-3 3 -6 0 z" fill={INK} />}
    {laughing && <path d="M27 24 q5 -1 9 0 q-2 8 -5 8 q-3 0 -4 -8 z" fill="#7f1d1d" stroke={INK} strokeWidth={1} />}
    <rect x={26} y={16} width={11} height={4} rx={2} fill={INK} />
    {harley
      ? <><path d="M16 15 q10 -12 21 -1 l-1 3 h-20 z" fill="#f97316" stroke={INK} strokeWidth={1.2} /><path d="M17 15 l-5 5 M17 15 l-6 1" stroke="#f97316" strokeWidth={2.2} strokeLinecap="round" /><circle cx={24} cy={11} r={1} fill="#111" /><circle cx={30} cy={10} r={1} fill="#111" /></>
      : <><path d="M15 18 q0 -14 12 -14 q11 0 11 12 l-1 2 h-22 z" fill="#f3e6c8" stroke={INK} strokeWidth={1.4} /><path d="M16 12 h21" stroke="#b91c1c" strokeWidth={2.5} /></>}
  </g></svg>;
}
