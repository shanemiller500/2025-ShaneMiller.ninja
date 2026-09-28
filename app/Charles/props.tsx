/* ------------------------------------------------------------------ */
/*  Cartoon prop art (no emoji): critters, foods, poop, stink clouds.  */
/*  Every drawing lives in a 64x64 box with a warm ink outline so it   */
/*  matches the scenes and Charles.                                    */
/* ------------------------------------------------------------------ */

export type PropKind =
  | "squirrel"
  | "deer"
  | "rabbit"
  | "bag"
  | "snow"
  | "butterfly"
  | "bee"
  | "box"
  | "bike"
  | "dog"
  | "spider"
  | "fly"
  | "pizza"
  | "chicken"
  | "hotdog"
  | "sandwich"
  | "cheese"
  | "cookie"
  | "bacon"
  | "burger"
  | "bone"
  | "ball"
  | "heart"
  | "bell";

const INK = "#2a1f1a";
const S = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function art(kind: PropKind) {
  switch (kind) {
    case "squirrel":
      return (
        <>
          <path d="M38 58 C60 52 62 24 50 12 C43 5 33 10 37 18 C43 28 47 40 34 50 Z" fill="#b8692f" {...S} />
          <path d="M44 20 C48 28 49 38 42 48" stroke="#d99058" strokeWidth="3" fill="none" strokeLinecap="round" />
          <ellipse cx="26" cy="44" rx="12" ry="14" fill="#c47a3c" {...S} />
          <ellipse cx="24" cy="47" rx="6" ry="9" fill="#f0d2a8" />
          <circle cx="22" cy="25" r="10" fill="#c47a3c" {...S} />
          <path d="M18 17 L20 8 L25 16 Z" fill="#c47a3c" {...S} />
          <circle cx="18" cy="24" r="2.2" fill={INK} />
          <circle cx="12.5" cy="28" r="1.8" fill={INK} />
          <path d="M22 38 q-5 2 -4 7 M28 38 q-2 4 1 7" stroke={INK} strokeWidth="2" fill="none" />
        </>
      );
    case "deer":
      return (
        <>
          <path d="M16 36 C16 28 28 26 40 28 C48 29 50 36 48 42 C40 46 24 46 16 42 Z" fill="#b0713f" {...S} />
          {[20, 26, 40, 45].map((x) => (
            <path key={x} d={`M${x} 42 L${x - 1} 60`} stroke={INK} strokeWidth="4" strokeLinecap="round" />
          ))}
          <path d="M44 32 C48 24 50 18 52 14 L58 16 C58 22 54 28 48 34 Z" fill="#b0713f" {...S} />
          <ellipse cx="55" cy="14" rx="6" ry="4.5" fill="#b0713f" {...S} />
          <path d="M52 10 L50 3 M50 3 L47 1 M50 3 L52 0 M56 10 L58 3 M58 3 L61 1" stroke="#6b4a2a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <circle cx="56" cy="13" r="1.4" fill={INK} />
          <circle cx="61" cy="15" r="1.6" fill={INK} />
          <path d="M16 34 l-5 -3 l2 6 Z" fill="#fff" {...S} strokeWidth="1.6" />
          <circle cx="30" cy="34" r="1.6" fill="#f3e2c8" />
          <circle cx="36" cy="36" r="1.4" fill="#f3e2c8" />
        </>
      );
    case "rabbit":
      return (
        <>
          <ellipse cx="34" cy="46" rx="16" ry="13" fill="#efeae4" {...S} />
          <circle cx="18" cy="48" r="5" fill="#fff" {...S} />
          <circle cx="44" cy="34" r="10" fill="#efeae4" {...S} />
          <path d="M40 26 C36 12 38 4 42 4 C46 4 46 14 44 25" fill="#efeae4" {...S} />
          <path d="M47 25 C48 12 52 6 55 8 C58 11 53 20 49 27" fill="#efeae4" {...S} />
          <path d="M41 22 C39 12 40 8 42 8 C44 9 44 16 43 22" fill="#f5b9c4" />
          <circle cx="48" cy="33" r="1.8" fill={INK} />
          <circle cx="53.5" cy="37" r="1.5" fill="#e88a9a" />
          <path d="M36 58 l8 0" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        </>
      );
    case "bag":
      return (
        <>
          <path d="M16 22 C12 34 12 50 18 58 C28 62 40 62 48 58 C54 48 52 32 48 22 Z" fill="#f6f8fb" fillOpacity=".92" {...S} />
          <path d="M20 22 C18 12 26 8 28 20 M40 20 C40 8 48 10 46 22" fill="none" {...S} />
          <path d="M22 30 C24 40 22 50 26 56 M38 28 C40 40 38 50 42 56" stroke="#c9d3de" strokeWidth="2" fill="none" />
          <circle cx="32" cy="40" r="6" fill="none" stroke="#e05555" strokeWidth="2.2" />
        </>
      );
    case "snow":
      return (
        <>
          <path d="M12 40 C8 30 18 24 24 28 C26 18 40 16 44 26 C52 22 60 32 54 40 C58 48 48 54 40 50 C34 56 22 56 18 50 C10 52 6 44 12 40 Z" fill="#fbfdff" {...S} stroke="#8fa8c2" />
          <path d="M20 44 C28 48 40 48 48 44" stroke="#c9dbee" strokeWidth="3" fill="none" strokeLinecap="round" />
          {[
            [16, 58],
            [32, 62],
            [46, 58],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="2.4" fill="#fff" stroke="#8fa8c2" strokeWidth="1.2" />
          ))}
        </>
      );
    case "butterfly":
      return (
        <>
          <path d="M32 32 C18 10 4 18 10 30 C4 42 18 48 32 36 Z" fill="#f59e0b" {...S} />
          <path d="M32 32 C46 10 60 18 54 30 C60 42 46 48 32 36 Z" fill="#f59e0b" {...S} />
          <circle cx="16" cy="26" r="3" fill="#fff" />
          <circle cx="48" cy="26" r="3" fill="#fff" />
          <rect x="30" y="22" width="4" height="22" rx="2" fill={INK} />
          <path d="M31 22 q-4 -8 -8 -8 M33 22 q4 -8 8 -8" stroke={INK} strokeWidth="1.8" fill="none" />
        </>
      );
    case "bee":
      return (
        <>
          <ellipse cx="24" cy="22" rx="10" ry="8" fill="#dff3ff" fillOpacity=".85" {...S} strokeWidth="1.8" />
          <ellipse cx="38" cy="20" rx="10" ry="8" fill="#dff3ff" fillOpacity=".85" {...S} strokeWidth="1.8" />
          <ellipse cx="32" cy="38" rx="18" ry="13" fill="#f7c531" {...S} />
          <path d="M26 26 C24 34 24 42 26 50 M36 25 C34 34 34 42 36 51" stroke={INK} strokeWidth="5" fill="none" />
          <circle cx="47" cy="34" r="2" fill={INK} />
          <path d="M14 40 l-6 2 l6 2" fill={INK} />
        </>
      );
    case "box":
      return (
        <>
          <path d="M8 24 L32 14 L56 24 L56 50 L32 60 L8 50 Z" fill="#c99459" {...S} />
          <path d="M8 24 L32 34 L56 24 M32 34 L32 60" fill="none" {...S} />
          <path d="M32 34 L56 24 L56 50 L32 60 Z" fill="#b07b43" />
          <path d="M20 19 L44 29 L44 36" stroke="#e8d3a8" strokeWidth="5" fill="none" />
          <rect x="14" y="36" width="12" height="9" fill="#fff" transform="skewY(22)" />
        </>
      );
    case "bike":
      return (
        <>
          <circle cx="14" cy="44" r="11" fill="none" stroke={INK} strokeWidth="3.4" />
          <circle cx="50" cy="44" r="11" fill="none" stroke={INK} strokeWidth="3.4" />
          <path d="M14 44 L26 26 L42 26 L50 44 M26 26 L32 44 L42 26 M32 44 L14 44" stroke="#e0474c" strokeWidth="3.2" fill="none" strokeLinejoin="round" />
          <path d="M22 22 L30 22 M42 26 L40 18 L46 16" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      );
    case "dog":
      return (
        <>
          <path d="M12 34 C12 26 24 24 38 26 C46 27 48 34 46 40 C38 44 22 44 12 40 Z" fill="#e2a64a" {...S} />
          {[16, 22, 38, 43].map((x) => (
            <path key={x} d={`M${x} 40 L${x} 56`} stroke="#c68a32" strokeWidth="5" strokeLinecap="round" />
          ))}
          <path d="M12 32 C6 28 4 22 8 20" stroke="#e2a64a" strokeWidth="5" fill="none" strokeLinecap="round" />
          <circle cx="48" cy="24" r="10" fill="#e2a64a" {...S} />
          <path d="M52 26 L62 28 C62 32 56 34 52 32 Z" fill="#e2a64a" {...S} />
          <path d="M42 18 C38 22 38 32 42 34 C46 30 46 22 42 18 Z" fill="#b97a26" {...S} strokeWidth="1.8" />
          <circle cx="51" cy="21" r="1.8" fill={INK} />
          <circle cx="62" cy="28" r="1.8" fill={INK} />
        </>
      );
    case "spider":
      return (
        <>
          {[-1, 1].map((side) =>
            [0, 1, 2, 3].map((i) => (
              <path
                key={`${side}${i}`}
                d={`M32 36 Q${32 + side * 14} ${24 + i * 6} ${32 + side * 24} ${30 + i * 8}`}
                stroke={INK}
                strokeWidth="2.6"
                fill="none"
                strokeLinecap="round"
              />
            ))
          )}
          <ellipse cx="32" cy="40" rx="9" ry="10" fill="#26222a" {...S} />
          <circle cx="32" cy="28" r="6" fill="#26222a" {...S} />
          <circle cx="30" cy="27" r="1.4" fill="#fff" />
          <circle cx="34" cy="27" r="1.4" fill="#fff" />
        </>
      );
    case "fly":
      return (
        <>
          <ellipse cx="24" cy="24" rx="10" ry="7" fill="#e6f3ff" fillOpacity=".85" {...S} strokeWidth="1.6" transform="rotate(-25 24 24)" />
          <ellipse cx="40" cy="24" rx="10" ry="7" fill="#e6f3ff" fillOpacity=".85" {...S} strokeWidth="1.6" transform="rotate(25 40 24)" />
          <ellipse cx="32" cy="38" rx="9" ry="12" fill="#2f3a3f" {...S} />
          <circle cx="28" cy="28" r="3" fill="#b3261e" />
          <circle cx="36" cy="28" r="3" fill="#b3261e" />
        </>
      );
    case "pizza":
      return (
        <>
          <path d="M8 16 C24 8 42 8 58 16 L33 60 Z" fill="#f7c948" {...S} />
          <path d="M8 16 C24 8 42 8 58 16 L56 21 C40 13 24 13 10 21 Z" fill="#d7903f" {...S} />
          <circle cx="26" cy="26" r="5" fill="#d8423a" {...S} strokeWidth="1.6" />
          <circle cx="40" cy="28" r="4.5" fill="#d8423a" {...S} strokeWidth="1.6" />
          <circle cx="33" cy="42" r="4" fill="#d8423a" {...S} strokeWidth="1.6" />
        </>
      );
    case "chicken":
      return (
        <>
          <path d="M14 30 C10 16 26 6 38 12 C48 18 46 32 38 38 C32 42 20 42 14 30 Z" fill="#c9782f" {...S} />
          <path d="M20 22 C24 16 32 14 36 18" stroke="#e7a45b" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M36 38 L48 50" stroke="#f4ecdc" strokeWidth="7" strokeLinecap="round" />
          <circle cx="50" cy="48" r="4.5" fill="#f4ecdc" {...S} />
          <circle cx="47" cy="54" r="4.5" fill="#f4ecdc" {...S} />
        </>
      );
    case "hotdog":
      return (
        <>
          <path d="M6 34 C6 26 58 26 58 34 C58 46 6 46 6 34 Z" fill="#e8b563" {...S} />
          <path d="M4 32 C4 26 60 26 60 32 C60 38 4 38 4 32 Z" fill="#c64b36" {...S} />
          <path d="M10 31 l6 -3 l6 3 l6 -3 l6 3 l6 -3 l6 3 l6 -3 l6 3" stroke="#f7d43a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </>
      );
    case "sandwich":
      return (
        <>
          <path d="M8 46 L56 46 L32 14 Z" fill="#f2d08a" {...S} />
          <path d="M12 42 L52 42" stroke="#6cbf4a" strokeWidth="5" strokeLinecap="round" />
          <path d="M14 38 L50 38" stroke="#e0765c" strokeWidth="4" strokeLinecap="round" />
          <path d="M8 50 L56 50 L56 46 L8 46 Z" fill="#e3b86b" {...S} />
        </>
      );
    case "cheese":
      return (
        <>
          <path d="M6 44 L58 44 L58 30 L20 16 Z" fill="#f7d046" {...S} />
          <path d="M6 44 L58 44 L58 30 L6 30 Z" fill="#f2c233" {...S} />
          <circle cx="20" cy="37" r="3" fill="#d9a520" />
          <circle cx="36" cy="38" r="4" fill="#d9a520" />
          <circle cx="50" cy="35" r="2.4" fill="#d9a520" />
        </>
      );
    case "cookie":
      return (
        <>
          <circle cx="32" cy="32" r="22" fill="#d6a15a" {...S} />
          {[
            [24, 24],
            [38, 22],
            [30, 36],
            [42, 38],
            [20, 40],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="3.2" fill="#5a3418" />
          ))}
        </>
      );
    case "bacon":
      return (
        <>
          <path d="M6 28 C14 20 20 36 28 28 C36 20 42 36 50 28 C54 24 58 26 60 28 L60 40 C54 36 50 48 42 40 C34 32 28 48 20 40 C14 34 10 42 6 40 Z" fill="#c84b3d" {...S} />
          <path d="M8 34 C16 28 20 42 28 34 C36 26 42 42 50 34" stroke="#f6c7b6" strokeWidth="3" fill="none" />
        </>
      );
    case "burger":
      return (
        <>
          <path d="M8 30 C8 12 56 12 56 30 Z" fill="#e0a24e" {...S} />
          <path d="M6 32 L58 32 L54 38 L10 38 Z" fill="#6cbf4a" {...S} strokeWidth="1.8" />
          <path d="M8 38 L56 38 L50 44 L14 44 Z" fill="#f7c531" {...S} strokeWidth="1.8" />
          <rect x="8" y="42" width="48" height="8" rx="4" fill="#6b3a1e" {...S} />
          <path d="M8 50 L56 50 C56 58 8 58 8 50 Z" fill="#e0a24e" {...S} />
          <circle cx="24" cy="20" r="1.4" fill="#fff4d6" />
          <circle cx="34" cy="17" r="1.4" fill="#fff4d6" />
          <circle cx="42" cy="22" r="1.4" fill="#fff4d6" />
        </>
      );
    case "bone":
      return (
        <>
          <path
            d="M18 26 C10 18 2 28 10 32 C2 36 10 46 18 38 L46 38 C54 46 62 36 54 32 C62 28 54 18 46 26 Z"
            fill="#e8c48b"
            {...S}
          />
          <path d="M20 30 L44 30" stroke="#f7e1b8" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "ball":
      return (
        <>
          <circle cx="32" cy="32" r="20" fill="#d4e83a" {...S} />
          <path d="M16 20 C26 28 26 38 16 46 M48 18 C38 26 38 38 48 46" stroke="#fff" strokeWidth="3" fill="none" />
        </>
      );
    case "heart":
      return <path d="M32 54 C8 38 6 22 16 16 C24 11 30 16 32 22 C34 16 40 11 48 16 C58 22 56 38 32 54 Z" fill="#ef4f6a" {...S} />;
    case "bell":
      return (
        <>
          <path d="M32 10 C20 10 16 22 16 32 C16 40 12 44 10 48 L54 48 C52 44 48 40 48 32 C48 22 44 10 32 10 Z" fill="#f2c233" {...S} />
          <circle cx="32" cy="52" r="5" fill="#d99a1e" {...S} />
          <path d="M24 20 C22 26 22 32 22 38" stroke="#fff3b0" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      );
  }
}

export function PropArt({ kind, size = 48, className }: { kind: PropKind; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true" overflow="visible">
      {art(kind)}
    </svg>
  );
}

/** A proper cartoon poop pile. No face. Just facts. */
export function PoopArt({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 56" width={size} height={(size * 56) / 64} aria-hidden="true" overflow="visible">
      <defs>
        <linearGradient id="poop-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5a33" />
          <stop offset="1" stopColor="#4e3019" />
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="52" rx="27" ry="4" fill="#000" opacity=".25" />
      <path d="M6 46 C4 38 12 34 18 36 L46 36 C52 34 60 38 58 46 C56 52 8 52 6 46 Z" fill="url(#poop-shade)" stroke="#2e1c0f" strokeWidth="2.2" />
      <path d="M12 36 C10 28 18 24 24 26 L42 26 C48 24 54 28 52 36 Z" fill="url(#poop-shade)" stroke="#2e1c0f" strokeWidth="2.2" />
      <path d="M18 26 C18 18 26 14 32 16 C38 14 46 18 44 26 Z" fill="url(#poop-shade)" stroke="#2e1c0f" strokeWidth="2.2" />
      <path d="M26 17 C26 10 32 6 36 4 C36 10 40 12 36 17 Z" fill="url(#poop-shade)" stroke="#2e1c0f" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M14 42 C22 40 30 41 36 41" stroke="#b07a4a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M18 31 C24 30 30 30 34 31" stroke="#b07a4a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M24 21 C28 20 31 20 33 21" stroke="#b07a4a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** A styled, lumpy green stink cloud with rising stink squiggles. */
export function StinkCloud({ size = 120, seed = 0 }: { size?: number; seed?: number }) {
  const tint = ["#9ccc3d", "#a3d14a", "#8fc234"][seed % 3];
  return (
    <svg viewBox="0 0 120 100" width={size} height={(size * 100) / 120} aria-hidden="true" overflow="visible">
      <defs>
        <radialGradient id={`stink-${seed % 3}`} cx=".4" cy=".35" r=".75">
          <stop offset="0" stopColor="#e4f7a6" />
          <stop offset=".55" stopColor={tint} />
          <stop offset="1" stopColor="#5f8f1f" />
        </radialGradient>
      </defs>
      <path
        d="M20 70 C6 70 4 52 18 48 C14 32 32 22 44 30 C48 14 72 12 78 28 C92 20 110 32 104 48 C118 52 116 72 100 72 C96 84 78 86 70 78 C62 88 40 88 34 78 C28 82 18 80 20 70 Z"
        fill={`url(#stink-${seed % 3})`}
        stroke="#4d7a18"
        strokeWidth="3"
        strokeLinejoin="round"
        opacity=".92"
      />
      <path d="M30 50 C34 42 44 40 50 44 M64 36 C70 32 80 34 82 40" stroke="#f3ffd0" strokeWidth="4" fill="none" strokeLinecap="round" opacity=".8" />
      <circle cx="46" cy="62" r="5" fill="#6f9e24" opacity=".55" />
      <circle cx="78" cy="58" r="4" fill="#6f9e24" opacity=".55" />
      <g stroke="#6f9e24" strokeWidth="3.4" fill="none" strokeLinecap="round" className="stink-lines">
        <path d="M38 22 C32 16 42 12 36 4" />
        <path d="M60 16 C54 10 64 6 58 -2" />
        <path d="M84 22 C78 16 88 12 82 4" />
      </g>
    </svg>
  );
}

/** Three sound-wave arcs: a bark, visualized. */
export function BarkWaves({ size = 46 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" overflow="visible">
      <g fill="none" strokeLinecap="round">
        {[10, 18, 26].map((r, i) => (
          <path key={r} d={`M${6 + r * 0.2} ${24 - r} A${r} ${r} 0 0 1 ${6 + r * 0.2} ${24 + r}`} stroke="#2a1f1a" strokeWidth={6.5 - i} transform="translate(6 0)" />
        ))}
        {[10, 18, 26].map((r, i) => (
          <path key={`w${r}`} d={`M${6 + r * 0.2} ${24 - r} A${r} ${r} 0 0 1 ${6 + r * 0.2} ${24 + r}`} stroke="#ffffff" strokeWidth={3.6 - i * 0.6} transform="translate(6 0)" />
        ))}
      </g>
    </svg>
  );
}
