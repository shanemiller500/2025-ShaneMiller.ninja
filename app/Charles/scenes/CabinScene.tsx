import { Aspen, Butterfly, Log, Pine, Post, rng, SceneDefs, Snowfall, Sparkles, type Season } from "./parts";

/* ------------------------------------------------------------------ */
/*  The cabin deck, traced from the real photo: log top rail + posts,  */
/*  stair handrail on the left, brace, plank deck, aspens and pines,   */
/*  and the truck parked on the left.                                  */
/*  View box 1628 x 1200, bottom-anchored like object-fit: cover.      */
/* ------------------------------------------------------------------ */
export const CABIN_VIEW = { w: 1628, h: 1200 };

export default function CabinScene({
  season,
  viewBox,
  passers,
  layer = "all",
}: {
  season: Season;
  viewBox?: string;
  passers?: React.ReactNode;
  /** "back" = sky, trees, meadow, wildlife. "front" = railing, deck, steps, weather. */
  layer?: "back" | "front" | "all";
}) {
  const back = layer !== "front";
  const front = layer !== "back";
  const winter = season === "winter";
  const pal = winter
    ? { sky1: "#9fb3c7", sky2: "#e3eaf1", far: "#9db2bd", farShade: "#8aa1ad", mid: "#4f7470", midShade: "#3c5d5a", near: "#3a5a55", nearShade: "#2b4744", ground1: "#f4f8fc", ground2: "#e3ecf5" }
    : { sky1: "#6fb9e8", sky2: "#d5eefb", far: "#6f9f86", farShade: "#5d8a73", mid: "#3d7a52", midShade: "#2f6242", near: "#2f6a45", nearShade: "#244f35", ground1: "#9cc55a", ground2: "#76a53d" };

  const r = rng(11);
  const farPines = Array.from({ length: 34 }, (_, i) => ({ x: -40 + i * 52 + r() * 20, h: 170 + r() * 110, w: 70 + r() * 30 }));
  const midPines = [
    { x: 90, h: 360, w: 170 },
    { x: 520, h: 420, w: 190 },
    { x: 760, h: 380, w: 170 },
    { x: 930, h: 470, w: 210 },
    { x: 1180, h: 520, w: 240 },
    { x: 1330, h: 400, w: 180 },
    { x: 1560, h: 480, w: 220 },
  ];
  const aspens = [
    { x1: 180, x2: 212, w: 20, base: 430, seed: 3 },
    { x1: 395, x2: 362, w: 44, base: 560, seed: 5 },
    { x1: 632, x2: 636, w: 54, base: 560, seed: 7 },
    { x1: 770, x2: 762, w: 16, base: 440, seed: 9 },
    { x1: 1045, x2: 1050, w: 20, base: 460, seed: 12 },
    { x1: 1480, x2: 1470, w: 26, base: 470, seed: 15 },
  ];

  /* summer meadow details */
  const g = rng(21);
  const tufts = Array.from({ length: 70 }, () => ({ x: g() * 1628, y: 440 + g() * 330, s: 0.7 + g() * 0.8, d: -g() * 3 }));
  const flowers = Array.from({ length: 60 }, () => ({
    x: g() * 1628,
    y: 470 + g() * 300,
    c: ["#e2553f", "#e2553f", "#8b6ad6", "#ffffff", "#f5c542"][Math.floor(g() * 5)],
  }));
  /* winter drifts */
  const drifts = Array.from({ length: 16 }, (_, i) => ({ x: i * 110 + g() * 60, y: 460 + g() * 290, w: 140 + g() * 160 }));

  // deck boards in perspective: back edge y=780, front edge y=1200
  const boards = Array.from({ length: 22 }, (_, i) => {
    const t0 = 360 + i * 62;
    const t1 = t0 + 62;
    const b = (x: number) => 900 + (x - 900) * 1.55;
    return { d: `M${t0} 780 L${t1} 780 L${b(t1)} 1200 L${b(t0)} 1200 Z`, light: i % 2 === 0, gap: `M${t1} 780 L${b(t1)} 1200` };
  });

  return (
    <svg viewBox={viewBox ?? "0 0 1628 1200"} preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <SceneDefs />
      <defs>
        <linearGradient id={`cab-sky-${season}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.sky1} />
          <stop offset="1" stopColor={pal.sky2} />
        </linearGradient>
        <linearGradient id={`cab-ground-${season}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.ground1} />
          <stop offset="1" stopColor={pal.ground2} />
        </linearGradient>
        <radialGradient id={`cab-sun-${season}`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor={winter ? "#ffffff" : "#fff6c9"} stopOpacity={winter ? 0.8 : 1} />
          <stop offset="1" stopColor={winter ? "#ffffff" : "#ffe37a"} stopOpacity="0" />
        </radialGradient>
        <clipPath id="cab-deck">
          <path d="M360 780 L1628 780 L1628 1200 L150 1200 Z" />
        </clipPath>
      </defs>

      {back && (
        <>

      {/* sky */}
      <rect width="1628" height="760" fill={`url(#cab-sky-${season})`} />
      <circle cx="1380" cy="90" r={winter ? 120 : 210} fill={`url(#cab-sun-${season})`} className="cs-pulse" />
      {!winter && <circle cx="1380" cy="90" r="46" fill="#fff4b8" />}
      {/* drifting clouds */}
      {[0, 1, 2].map((i) => (
        <g key={i} className="cs-cloud" style={{ animationDelay: `${-i * 47}s` }} opacity={winter ? 0.95 : 0.9}>
          <g transform={`translate(0 ${40 + i * 55})`} fill={winter ? "#eef2f6" : "#ffffff"}>
            <ellipse cx="0" cy="30" rx="90" ry="26" />
            <ellipse cx="-50" cy="38" rx="55" ry="20" />
            <ellipse cx="45" cy="16" rx="55" ry="30" />
          </g>
        </g>
      ))}

      {/* far ridge + far pines */}
      <path d="M0 330 Q200 250 420 300 T860 280 T1300 290 T1628 260 L1628 480 L0 480 Z" fill={winter ? "#c9d6e0" : "#8db7a0"} />
      {farPines.map((p, i) => (
        <Pine key={i} x={p.x} base={440} h={p.h} w={p.w} color={pal.far} shade={pal.farShade} snow={winter} />
      ))}

      {/* aspens behind the mid pines */}
      {aspens.map((a, i) => (
        <Aspen key={i} x1={a.x1} x2={a.x2} top={-20} base={a.base} w={a.w} seed={a.seed} branches={winter} snow={winter} />
      ))}
      {!winter &&
        aspens.map((a, i) => {
          const lr = rng(40 + i);
          return (
            <g key={`c${i}`}>
              {Array.from({ length: 9 }).map((_, k) => (
                <circle
                  key={k}
                  cx={a.x1 + (lr() - 0.5) * a.w * 7}
                  cy={-10 + lr() * 150}
                  r={30 + lr() * 40}
                  fill={["#8cc152", "#a0d468", "#7cb342", "#b5dc6f"][k % 4]}
                  className="cs-shimmer"
                  style={{ animationDelay: `${-lr() * 3}s` }}
                />
              ))}
            </g>
          );
        })}

      {/* mid pines */}
      {midPines.map((p, i) => (
        <Pine key={i} x={p.x} base={500} h={p.h} w={p.w} color={pal.mid} shade={pal.midShade} snow={winter} sway={i * 0.7 + 0.2} />
      ))}

      {/* meadow / snowfield behind the railing, running down to the bottom left */}
      <path d="M0 440 Q400 420 800 445 T1628 430 L1628 800 L0 1200 Z" fill={`url(#cab-ground-${season})`} />
      {!winter && <path d="M-20 470 Q140 430 330 440 L330 470 Q150 470 -20 520 Z" fill="#c9a878" opacity=".9" />}
      {winter &&
        drifts.map((d, i) => (
          <ellipse key={i} cx={d.x} cy={d.y} rx={d.w / 2} ry={10 + (i % 3) * 5} fill="#d4e2f0" opacity=".7" />
        ))}
      {winter && <Sparkles seed={5} count={28} x={0} y={450} w={1628} h={330} />}
      {!winter && (
        <g>
          {tufts.map((t, i) => (
            <g key={i} className="cs-grass" style={{ animationDelay: `${t.d}s` }}>
              <path
                d={`M${t.x} ${t.y} l${-6 * t.s} ${-22 * t.s} M${t.x} ${t.y} l${1 * t.s} ${-28 * t.s} M${t.x} ${t.y} l${8 * t.s} ${-20 * t.s}`}
                stroke="#5e8d2b"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
          ))}
          {flowers.map((fl, i) => (
            <g key={i}>
              <path d={`M${fl.x} ${fl.y} l0 14`} stroke="#4f7d27" strokeWidth="2" />
              <circle cx={fl.x} cy={fl.y} r="5" fill={fl.c} />
              {fl.c === "#ffffff" && <circle cx={fl.x} cy={fl.y} r="2" fill="#f5c542" />}
            </g>
          ))}
        </g>
      )}

      {/* long post shadows across the meadow (the sun sits behind the trees) */}
      <g fill={winter ? "#aabfd6" : "#3f6b22"} opacity={winter ? 0.55 : 0.28}>
        <path d="M480 770 L548 770 L470 460 L420 470 Z" />
        <path d="M1345 770 L1435 770 L1360 470 L1300 480 Z" />
      </g>

      {/* wildlife wandering through the meadow (behind the railing) */}
      {passers}

      {/* the truck, parked on the left like always */}
      <g transform="translate(-30 330)">
        <path d="M0 60 L90 20 L170 20 L210 90 L230 95 L232 190 L0 200 Z" fill="#5d6a73" />
        <path d="M20 70 L96 34 L160 34 L190 88 L20 92 Z" fill="#2a3642" />
        <path d="M40 76 L100 44 L128 44 L70 88 Z" fill="#ffffff" opacity=".18" />
        <rect x="0" y="130" width="232" height="16" fill="#46525a" />
        <circle cx="160" cy="200" r="34" fill="#1d2126" />
        <circle cx="160" cy="200" r="15" fill="#8b949b" />
        <rect x="205" y="110" width="26" height="14" rx="4" fill={winter ? "#fff6c9" : "#e9eef2"} />
        {winter && (
          <path d="M-5 62 Q40 30 92 14 Q130 4 172 14 Q200 30 212 86 L236 90 Q238 80 226 82 Q210 60 178 22 Q130 6 90 22 Q40 42 -5 62 Z" fill="#fbfdff" stroke="#d6e2ef" strokeWidth="2" />
        )}
      </g>

        </>
      )}

      {front && (
        <>
      {/* ---------- railing (back to front) ---------- */}
      <Log x1={405} y1={360} x2={1660} y2={356} r={25} capEnd="start" snow={winter} seed={2} />
      {winter && (
        <g fill="#e8f3ff" stroke="#bcd3ea" strokeWidth="1.5">
          {Array.from({ length: 18 }).map((_, i) => {
            const x = 470 + i * 64 + ((i * 37) % 23);
            const l = 16 + ((i * 53) % 30);
            return <path key={i} d={`M${x - 6} 382 L${x + 6} 382 L${x} ${382 + l} Z`} />;
          })}
        </g>
      )}
      <Post x={513} top={384} bottom={775} w={70} snow={false} />
      <Post x={1390} top={380} bottom={775} w={92} snow={false} />
      <Log x1={455} y1={573} x2={1660} y2={573} r={16} capEnd="start" snow={winter} seed={4} />
      <Log x1={330} y1={440} x2={505} y2={414} r={20} snow={winter} seed={6} />
      <Log x1={505} y1={610} x2={318} y2={760} r={18} snow={winter} seed={8} />

      {/* deck fascia + boards */}
      <rect x="350" y="760" width="1300" height="22" fill="#5b3822" />
      <rect x="350" y="758" width="1300" height="5" fill="#8a5a36" />
      <g clipPath="url(#cab-deck)">
        {boards.map((b, i) => (
          <path key={i} d={b.d} fill={b.light ? "#7c5034" : "#6f462d"} />
        ))}
        {boards.map((b, i) => (
          <path key={`g${i}`} d={b.gap} stroke="#2e1b10" strokeWidth="5" />
        ))}
        {/* sunlit plank tops */}
        {!winter && (
          <g opacity=".22">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <ellipse key={i} cx={600 + i * 190} cy={900 + (i % 2) * 120} rx="70" ry="22" fill="#ffe8a8" className="cs-pulse" style={{ animationDelay: `${-i}s` }} />
            ))}
          </g>
        )}
        {winter && (
          <g>
            <path
              d="M150 1200 L360 790 Q420 776 500 792 Q620 772 760 790 Q900 770 1040 792 Q1180 774 1320 790 Q1480 772 1628 788 L1628 1200 Z"
              fill="#f6f9fc"
            />
            {boards.map((b, i) => (
              <path key={`s${i}`} d={b.gap} stroke="#d5e1ee" strokeWidth="3" />
            ))}
            <Sparkles seed={9} count={18} x={400} y={820} w={1200} h={360} />
          </g>
        )}
      </g>

      {/* his water bowl, by the post */}
      <g transform="translate(1500 835)">
        <ellipse cx="0" cy="18" rx="44" ry="10" fill="#000" opacity=".25" />
        <path d="M-40 0 L40 0 L32 20 L-32 20 Z" fill="#2f7dd1" />
        <ellipse cx="0" cy="0" rx="40" ry="9" fill={winter ? "#e8f3ff" : "#9fd3ff"} />
        <text x="0" y="16" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">
          CHARLES
        </text>
      </g>

      {/* steps down on the left — descend leftward, following the handrails */}
      <path d="M262 936 L262 1200 L-20 1200 L-20 1131 L50 1131 L50 1067 L120 1067 L120 1003 L190 1003 L190 936 Z" fill="#5e3b25" />
      {[0, 1, 2, 3].map((i) => {
        const x0 = 190 - i * 70;
        const y = 936 + i * 64;
        return (
          <g key={`st${i}`}>
            {/* riser */}
            <rect x={x0} y={y + 14} width="72" height="50" fill="#4a2e1d" opacity=".55" />
            {/* tread */}
            <path d={`M${x0 - 4} ${y} L${x0 + 74} ${y} L${x0 + 72} ${y + 14} L${x0 - 2} ${y + 14} Z`} fill={winter ? "#f6f9fc" : "#8a5a36"} />
          </g>
        );
      })}

      {/* front-left corner post + stair handrails */}
      <Log x1={330} y1={430} x2={-40} y2={700} r={24} snow={winter} seed={10} />
      <Log x1={300} y1={700} x2={-40} y2={940} r={18} snow={winter} seed={12} />
      <Post x={311} top={372} bottom={1010} w={78} snow={winter} />
      {winter && (
        <>
          <path d="M478 386 Q480 360 513 358 Q546 360 548 386 Z" fill="#fbfdff" stroke="#d6e2ef" strokeWidth="2" />
          <path d="M1344 382 Q1348 354 1390 352 Q1432 354 1436 382 Z" fill="#fbfdff" stroke="#d6e2ef" strokeWidth="2" />
        </>
      )}

      {/* weather */}
      {winter ? (
        <>
          <Snowfall seed={1} count={80} w={1628} h={1200} size={[1.5, 3.5]} speed={[12, 20]} opacity={0.75} />
          <Snowfall seed={2} count={40} w={1628} h={1200} size={[4, 8]} speed={[7, 11]} />
        </>
      ) : (
        <>
          <Butterfly color="#f59e0b" path="M200 600 C400 480 600 700 800 560 S1200 460 1400 620 S1000 760 600 640 S300 700 200 600" dur={24} />
          <Butterfly color="#f0f4ff" path="M1300 520 C1100 600 900 480 700 600 S500 700 900 700 S1400 600 1300 520" dur={19} begin={6} />
        </>
      )}
        </>
      )}
    </svg>
  );
}
