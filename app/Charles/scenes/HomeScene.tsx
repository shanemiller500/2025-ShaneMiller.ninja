import { rng, SceneDefs, Snowfall, type Season } from "./parts";
import { WildlifeDefs } from "./wildlife";

/* ------------------------------------------------------------------ */
/*  The front entryway at home, traced from the real photo: white      */
/*  six-panel door with black hardware, tall sidelight, quatrefoil rug,*/
/*  dark console with toy bins, the mountain-lake canvas, shoe bench.  */
/*  View box 1600 x 1000, bottom-anchored.                             */
/* ------------------------------------------------------------------ */
export const HOME_VIEW = { w: 1600, h: 1000 };

function Panel({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#e4e1db" />
      <path d={`M${x} ${y + h} L${x} ${y} L${x + w} ${y}`} stroke="#c9c4bb" strokeWidth="6" fill="none" />
      <path d={`M${x + w} ${y} L${x + w} ${y + h} L${x} ${y + h}`} stroke="#ffffff" strokeWidth="6" fill="none" />
      <rect x={x + 14} y={y + 14} width={w - 28} height={h - 28} fill="#f3f1ec" />
      <path d={`M${x + 14} ${y + h - 14} L${x + 14} ${y + 14} L${x + w - 14} ${y + 14}`} stroke="#ffffff" strokeWidth="4" fill="none" />
      <path d={`M${x + w - 14} ${y + 14} L${x + w - 14} ${y + h - 14} L${x + 14} ${y + h - 14}`} stroke="#d6d1c8" strokeWidth="4" fill="none" />
    </g>
  );
}

export default function HomeScene({
  season,
  viewBox,
  outside,
  room,
}: {
  season: Season;
  viewBox?: string;
  /** Drawn in the sidelight glass, behind the fence and porch column (passing cars). */
  outside?: React.ReactNode;
  /** Drawn over the room (headlight glare). */
  room?: React.ReactNode;
}) {
  const winter = season === "winter";
  const r = rng(77);
  const lights = Array.from({ length: 34 }, (_, i) => {
    const x = 10 + i * 47;
    const y = 22 + Math.sin((i / 33) * Math.PI * 4) * 14 + 16;
    return { x, y, c: ["#ff5a5a", "#ffd23f", "#3ddc97", "#4fa3ff", "#ff8be0"][i % 5], d: -r() * 2 };
  });
  const motes = Array.from({ length: 18 }, () => ({ x: 560 + r() * 280, y: 560 + r() * 360, d: -r() * 7, s: 1.5 + r() * 2.5 }));

  return (
    <svg viewBox={viewBox ?? "0 0 1600 1000"} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <SceneDefs />
      <WildlifeDefs />
      <defs>
        <linearGradient id="hm-wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ece6dd" />
          <stop offset="1" stopColor="#d6cfc4" />
        </linearGradient>
        <linearGradient id="hm-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9d8872" />
          <stop offset="1" stopColor="#7f6b58" />
        </linearGradient>
        <linearGradient id="hm-art-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6c9a8" />
          <stop offset=".55" stopColor="#bcd3ea" />
          <stop offset="1" stopColor="#7fa6cf" />
        </linearGradient>
        <linearGradient id={`hm-outside-${season}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={winter ? "#c3cfda" : "#9fd3f5"} />
          <stop offset="1" stopColor={winter ? "#e9eef3" : "#e3f4fd"} />
        </linearGradient>
        <linearGradient id="hm-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3c4" stopOpacity=".0" />
          <stop offset=".4" stopColor="#fff3c4" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff3c4" stopOpacity=".55" />
        </linearGradient>
        <pattern id="hm-rug" width="56" height="56" patternUnits="userSpaceOnUse">
          <rect width="56" height="56" fill="#efe5d3" />
          <path
            d="M28 4 C38 4 38 18 28 18 C38 18 52 18 52 28 C52 38 38 38 38 28 C38 38 38 52 28 52 C18 52 18 38 28 38 C18 38 4 38 4 28 C4 18 18 18 18 28 C18 18 18 4 28 4 Z"
            fill="none"
            stroke="#1f1d22"
            strokeWidth="5"
          />
        </pattern>
        <pattern id="hm-weave" width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill="#c9a574" />
          <path d="M0 7 L7 0 M7 14 L14 7" stroke="#a9844f" strokeWidth="2.5" />
          <path d="M0 0 L14 14" stroke="#dcbd8e" strokeWidth="1.5" />
        </pattern>
        <clipPath id="hm-glass">
          <rect x="752" y="96" width="78" height="758" />
        </clipPath>
        <clipPath id="hm-art">
          <rect x="962" y="120" width="112" height="290" />
          <rect x="1086" y="86" width="132" height="360" />
          <rect x="1230" y="160" width="200" height="300" />
        </clipPath>
      </defs>

      {/* wall + baseboard + floor */}
      <rect width="1600" height="890" fill="url(#hm-wall)" />
      <rect y="860" width="1600" height="30" fill="#f4f1eb" />
      <path d="M0 890 L1600 890 L1600 1000 L0 1000 Z" fill="url(#hm-floor)" />
      {Array.from({ length: 9 }).map((_, i) => (
        <path key={i} d={`M${-200 + i * 250} 1000 L${300 + i * 140} 890`} stroke="#6f5c4b" strokeWidth="3" opacity=".6" />
      ))}
      {[920, 955].map((y) => (
        <path key={y} d={`M0 ${y} L1600 ${y}`} stroke="#6f5c4b" strokeWidth="2" opacity=".35" />
      ))}

      {/* coats on hooks + shoe bench (left) */}
      <rect x="20" y="240" width="250" height="16" rx="4" fill="#7a5a3c" />
      <path d="M40 256 Q20 420 34 640 L150 640 Q160 420 120 256 Z" fill="#23283a" />
      <path d="M140 256 Q126 380 140 520 L240 520 Q250 380 220 256 Z" fill="#e0588a" />
      <path d="M150 300 L230 300" stroke="#c2406e" strokeWidth="6" />
      <rect x="10" y="690" width="280" height="36" rx="8" fill="url(#hm-weave)" />
      <rect x="22" y="726" width="18" height="160" fill="#b99567" />
      <rect x="262" y="726" width="18" height="160" fill="#b99567" />
      <rect x="22" y="800" width="258" height="10" fill="#b99567" />
      {/* shoes */}
      <path d="M50 790 q30 -22 70 0 l0 12 l-70 0 Z" fill="#3b4a6b" />
      <path d="M140 792 q26 -18 60 0 l0 10 l-60 0 Z" fill="#f2f2f2" stroke="#999" />
      <path d="M60 872 q30 -20 64 0 l0 12 l-64 0 Z" fill="#1f1f1f" />
      {/* the orange crocs from the photo */}
      <g transform="translate(300 950) rotate(-12)">
        <ellipse cx="0" cy="0" rx="42" ry="16" fill="#ff6b35" />
        <circle cx="-14" cy="-3" r="3" fill="#c94f22" />
        <circle cx="0" cy="-5" r="3" fill="#c94f22" />
        <circle cx="14" cy="-3" r="3" fill="#c94f22" />
      </g>

      {/* door casing */}
      <rect x="296" y="24" width="580" height="866" fill="#f7f5f1" />
      <rect x="296" y="24" width="580" height="866" fill="none" stroke="#dcd6cc" strokeWidth="4" />

      {/* sidelight window: what's outside */}
      <rect x="736" y="80" width="110" height="790" fill="#f3f1ec" />
      <g clipPath="url(#hm-glass)">
        <rect x="740" y="90" width="100" height="770" fill={`url(#hm-outside-${season})`} />
        {/* yard */}
        <path d="M740 470 Q790 450 840 470 L840 860 L740 860 Z" fill={winter ? "#f4f8fc" : "#79b84a"} />
        {!winter && (
          <g className="cs-sway" style={{ transformOrigin: "790px 470px" }}>
            <circle cx="760" cy="300" r="60" fill="#5f9e3a" />
            <circle cx="820" cy="260" r="50" fill="#72b04a" />
          </g>
        )}
        {winter && (
          <g>
            <circle cx="770" cy="300" r="46" fill="#6d8784" />
            <circle cx="770" cy="286" r="30" fill="#ffffff" opacity=".8" />
            {/* a snowman in the yard, staring in */}
            <circle cx="812" cy="648" r="22" fill="#fff" stroke="#cfdbe8" strokeWidth="2" />
            <circle cx="812" cy="612" r="15" fill="#fff" stroke="#cfdbe8" strokeWidth="2" />
            <circle cx="807" cy="609" r="2" fill="#222" />
            <circle cx="817" cy="609" r="2" fill="#222" />
            <path d="M812 614 l12 3 l-12 2 Z" fill="#ff8c2a" />
          </g>
        )}
        {/* the street: cars go by here */}
        {outside}
        {/* fence */}
        <g fill={winter ? "#8d7f73" : "#a78a6b"}>
          <rect x="740" y="520" width="100" height="8" />
          <rect x="740" y="548" width="100" height="8" />
          <rect x="770" y="505" width="8" height="70" />
        </g>
        {/* porch column + porch floor */}
        <rect x="778" y="90" width="40" height="700" fill="#e9e6df" />
        <rect x="810" y="90" width="8" height="700" fill="#c9c4bb" />
        <rect x="740" y="760" width="100" height="100" fill={winter ? "#e1e7ee" : "#cfc8bd"} />
        {winter && <Snowfall seed={31} count={26} x={740} y={90} w={100} h={770} size={[1.5, 3.5]} speed={[6, 10]} />}
        {/* glass reflection */}
        <path d="M740 140 L840 60 L840 110 L740 190 Z" fill="#fff" opacity=".22" />
        <path d="M740 600 L840 520 L840 540 L740 620 Z" fill="#fff" opacity=".15" />
        {winter && (
          <g fill="#ffffff" opacity=".7">
            <path d="M740 90 Q770 96 752 128 Q746 110 740 130 Z" />
            <path d="M840 860 Q806 850 826 820 Q832 840 840 812 Z" />
          </g>
        )}
      </g>
      <rect x="752" y="96" width="78" height="758" fill="none" stroke="#ffffff" strokeWidth="8" />

      {/* the door */}
      <rect x="318" y="46" width="402" height="840" fill="#f6f4f0" />
      <rect x="318" y="46" width="402" height="840" fill="none" stroke="#d9d4cb" strokeWidth="3" />
      <Panel x={360} y={96} w={140} h={150} />
      <Panel x={538} y={96} w={140} h={150} />
      <Panel x={360} y={290} w={140} h={290} />
      <Panel x={538} y={290} w={140} h={290} />
      <Panel x={360} y={624} w={140} h={220} />
      <Panel x={538} y={624} w={140} h={220} />
      {[120, 460, 800].map((y) => (
        <rect key={y} x="312" y={y} width="12" height="46" rx="2" fill="#1c1c1e" />
      ))}
      <circle cx="519" cy="270" r="5" fill="#2a2a2a" />
      {/* hardware */}
      <circle cx="690" cy="470" r="17" fill="#1c1c1e" />
      <rect x="687" y="462" width="6" height="16" rx="3" fill="#4a4a4f" />
      <circle cx="690" cy="532" r="15" fill="#1c1c1e" />
      <path d="M690 526 L640 530 Q628 536 640 542 L690 540 Z" fill="#1c1c1e" />
      {/* light across the door */}
      <path d="M318 46 L720 46 L720 300 L318 520 Z" fill="#fff" opacity=".12" />

      {winter && (
        <g>
          {/* wreath */}
          <circle cx="519" cy="190" r="58" fill="none" stroke="#2f6b3a" strokeWidth="30" />
          {Array.from({ length: 14 }).map((_, i) => {
            const a = (i / 14) * Math.PI * 2;
            return <circle key={i} cx={519 + Math.cos(a) * 58} cy={190 + Math.sin(a) * 58} r="7" fill={i % 3 ? "#3f8a4a" : "#d93a3a"} />;
          })}
          <path d="M500 240 L519 250 L538 240 L548 280 L519 262 L490 280 Z" fill="#d93a3a" />
        </g>
      )}

      {/* light switch */}
      <rect x="892" y="440" width="44" height="64" rx="4" fill="#f7f5f1" stroke="#cfc9bf" strokeWidth="2" />
      {[902, 912, 922].map((x) => (
        <rect key={x} x={x} y="460" width="6" height="18" rx="2" fill="#e2ddd4" stroke="#bdb6aa" />
      ))}

      {/* mountain-lake canvas triptych */}
      <g>
        <rect x="966" y="124" width="112" height="290" fill="#000" opacity=".15" />
        <rect x="1090" y="90" width="132" height="360" fill="#000" opacity=".15" />
        <rect x="1234" y="164" width="200" height="300" fill="#000" opacity=".15" />
        <g clipPath="url(#hm-art)">
          <rect x="960" y="80" width="480" height="390" fill="url(#hm-art-sky)" />
          <path d="M960 280 L1030 200 L1080 250 L1150 150 L1200 220 L1260 170 L1340 250 L1440 200 L1440 300 L960 300 Z" fill="#6a7fa0" />
          <path d="M1150 150 L1130 180 L1150 176 L1170 184 Z M1260 170 L1244 196 L1262 192 L1278 198 Z" fill="#fff" />
          <path d="M960 300 L1440 300 L1440 470 L960 470 Z" fill="#8fb5dc" />
          <path d="M960 300 L1030 380 L1080 330 L1150 430 L1200 360 L1260 410 L1340 330 L1440 380 L1440 300 Z" fill="#7b95b8" opacity=".6" />
          {[975, 1000, 1020, 1380, 1405, 1425].map((x, i) => (
            <path key={x} d={`M${x} ${300 - (i % 2) * 10} l-14 0 l14 -70 l14 70 Z`} fill="#26433a" />
          ))}
          <path d="M960 300 L1440 300" stroke="#fff" strokeWidth="2" opacity=".6" />
        </g>
      </g>

      {/* console table */}
      <g>
        <rect x="930" y="560" width="470" height="28" rx="4" fill="#443731" />
        <rect x="930" y="560" width="470" height="7" rx="3" fill="#5c4b42" />
        <rect x="944" y="588" width="176" height="176" fill="#3a2f2a" />
        <path d="M956 600 L1108 752 M1108 600 L956 752" stroke="#5a4a41" strokeWidth="10" />
        <rect x="956" y="600" width="152" height="152" fill="none" stroke="#5a4a41" strokeWidth="8" />
        <rect x="1128" y="588" width="258" height="84" fill="#3a2f2a" />
        <rect x="1140" y="600" width="234" height="60" fill="none" stroke="#5a4a41" strokeWidth="6" />
        <circle cx="1257" cy="630" r="7" fill="#8e8a86" />
        <rect x="944" y="588" width="22" height="310" fill="#322823" />
        <rect x="1364" y="588" width="22" height="310" fill="#322823" />
        <rect x="944" y="820" width="442" height="16" fill="#3a2f2a" />
        {/* toy bins */}
        <rect x="1140" y="730" width="110" height="90" rx="6" fill="#dbe6ef" opacity=".7" />
        <rect x="1160" y="750" width="30" height="30" fill="#ffd23f" />
        <rect x="1196" y="760" width="40" height="22" fill="#ff5a5a" />
        <rect x="1262" y="740" width="100" height="80" rx="6" fill="#f2c230" />
        <rect x="1262" y="740" width="100" height="14" rx="4" fill="#d9a915" />
        {/* stuff on top: sunglasses, cap, mug, keys */}
        <g transform="translate(1060 548)">
          <circle cx="-14" cy="0" r="11" fill="none" stroke="#ffffff" strokeWidth="4" />
          <circle cx="14" cy="0" r="11" fill="none" stroke="#ffffff" strokeWidth="4" />
          <path d="M-3 0 L3 0" stroke="#fff" strokeWidth="4" />
          <circle cx="-14" cy="0" r="8" fill="#2c3e55" />
          <circle cx="14" cy="0" r="8" fill="#2c3e55" />
        </g>
        <path d="M1280 560 Q1300 520 1340 526 Q1362 532 1360 560 Z" fill="#1f2d4d" />
        <path d="M1340 556 L1380 560 L1340 562 Z" fill="#c8323a" />
        <rect x="1196" y="520" width="34" height="40" rx="5" fill="#f5f5f5" />
        <path d="M1230 530 q14 10 0 22" stroke="#f5f5f5" strokeWidth="5" fill="none" />
        <path d="M1140 556 l14 -10 l10 10 Z" fill="#c0c4c9" />
      </g>

      {/* gray slipcovered chair on the right */}
      <path d="M1450 640 Q1520 610 1620 620 L1620 1000 L1470 1000 Q1440 820 1450 640 Z" fill="#8795a2" />
      <path d="M1470 700 Q1540 680 1620 690" stroke="#72808d" strokeWidth="6" fill="none" />

      {/* the rug in front of the door */}
      <path d="M340 892 L870 892 L940 1000 L270 1000 Z" fill="url(#hm-rug)" />
      <path d="M340 892 L870 892 L940 1000 L270 1000 Z" fill="none" stroke="#d8ccb6" strokeWidth="8" />

      {winter ? (
        <g>
          {/* snow boots + melt puddle */}
          <ellipse cx="820" cy="965" rx="80" ry="16" fill="#bfe1ff" opacity=".6" />
          <path d="M770 900 L800 900 L802 950 L830 952 Q836 966 822 968 L770 968 Z" fill="#20242c" />
          <path d="M770 900 L800 900 L800 912 L770 912 Z" fill="#e9ecef" />
          <path d="M840 906 L868 906 L870 952 L896 954 Q902 966 888 968 L840 968 Z" fill="#20242c" />
          <path d="M840 906 L868 906 L868 918 L840 918 Z" fill="#e9ecef" />
          {/* mittens + beanie on the bench */}
          <path d="M40 690 Q44 660 70 662 Q96 664 96 690 Z" fill="#c43b4b" />
          <rect x="40" y="684" width="56" height="8" rx="3" fill="#f3f3f3" />
          <path d="M200 688 q-4 -26 12 -28 q10 0 12 10 l8 -4 q6 4 0 12 l-2 10 Z" fill="#3b82c4" />
          {/* string lights */}
          <path d={`M0 30 ${lights.map((l) => `L${l.x} ${l.y - 6}`).join(" ")}`} stroke="#2b3b2b" strokeWidth="2.5" fill="none" />
          {lights.map((l, i) => (
            <g key={i}>
              <circle cx={l.x} cy={l.y + 4} r="14" fill={l.c} opacity=".35" className="cs-bulb" style={{ animationDelay: `${l.d}s` }} />
              <ellipse cx={l.x} cy={l.y + 4} rx="6" ry="9" fill={l.c} className="cs-bulb" style={{ animationDelay: `${l.d}s` }} />
            </g>
          ))}
        </g>
      ) : (
        <g>
          {/* afternoon sunbeam from the sidelight, with dust motes */}
          <path d="M752 300 L830 300 L760 1000 L470 1000 Z" fill="url(#hm-beam)" className="cs-pulse" />
          {motes.map((m, i) => (
            <circle key={i} cx={m.x} cy={m.y} r={m.s} fill="#fff8d6" className="cs-mote" style={{ animationDelay: `${m.d}s` }} />
          ))}
          {/* flip-flops by the bench */}
          <g transform="translate(160 952)">
            <ellipse cx="0" cy="0" rx="30" ry="11" fill="#27c4b5" />
            <ellipse cx="34" cy="6" rx="30" ry="11" fill="#27c4b5" />
            <path d="M-6 0 l10 -8 l10 8 M28 6 l10 -8 l10 8" stroke="#fff" strokeWidth="3" fill="none" />
          </g>
        </g>
      )}

      {room}

      {/* soft ceiling-light falloff */}
      <rect width="1600" height="1000" fill="url(#hm-wall)" opacity="0" />
      <radialGradient id="hm-vig" cx=".5" cy=".35" r=".8">
        <stop offset=".6" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity=".18" />
      </radialGradient>
      <rect width="1600" height="1000" fill="url(#hm-vig)" />
    </svg>
  );
}
