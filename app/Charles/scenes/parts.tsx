/* ------------------------------------------------------------------ */
/*  Cartoon building blocks for Charles's scenes                       */
/*  Everything is deterministic (seeded) so server and client render   */
/*  the same SVG.                                                      */
/* ------------------------------------------------------------------ */

export type Season = "summer" | "winter";

/** Tiny seeded PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);

/* ---------- Pine tree ---------- */
export function Pine({
  x,
  base,
  h,
  w,
  color,
  shade,
  snow,
  sway = 0,
}: {
  x: number;
  base: number;
  h: number;
  w: number;
  color: string;
  shade: string;
  snow?: boolean;
  sway?: number;
}) {
  const tiers = 6;
  const parts: React.ReactNode[] = [];
  for (let i = tiers - 1; i >= 0; i--) {
    const t = i / (tiers - 1);
    const top = base - h + h * 0.13 * i;
    const bottom = top + h * (0.2 + 0.05 * i);
    const half = (w / 2) * (0.3 + 0.7 * t);
    const teeth = 5 + i;
    let d = `M${f(x)} ${f(top)} L${f(x + half)} ${f(bottom)}`;
    for (let k = teeth; k >= 0; k--) {
      const px = x - half + (2 * half * k) / teeth;
      d += ` L${f(px)} ${f(bottom - (k % 2 ? h * 0.035 : 0))}`;
    }
    d += " Z";
    const shadeD = `M${f(x)} ${f(top)} L${f(x + half)} ${f(bottom)} L${f(x + half * 0.2)} ${f(bottom - h * 0.02)} Z`;
    parts.push(
      <g key={i}>
        <path d={d} fill={color} />
        <path d={shadeD} fill={shade} opacity=".55" />
        {snow && (
          <path
            d={`M${f(x)} ${f(top + 2)} L${f(x + half * 0.72)} ${f(top + (bottom - top) * 0.62)} Q${f(x + half * 0.4)} ${f(top + (bottom - top) * 0.72)} ${f(
              x + half * 0.1
            )} ${f(top + (bottom - top) * 0.6)} Q${f(x - half * 0.35)} ${f(top + (bottom - top) * 0.78)} ${f(x - half * 0.8)} ${f(
              top + (bottom - top) * 0.64
            )} Z`}
            fill="#f7fbff"
          />
        )}
      </g>
    );
  }
  return (
    <g className={sway ? "cs-sway" : undefined} style={sway ? { transformOrigin: `${x}px ${base}px`, animationDelay: `${sway}s` } : undefined}>
      <rect x={x - w * 0.04} y={base - h * 0.08} width={w * 0.08} height={h * 0.1} fill="#4a3224" />
      {parts}
    </g>
  );
}

/* ---------- Aspen trunk (white bark with black "eyes") ---------- */
export function Aspen({
  x1,
  x2,
  top,
  base,
  w,
  seed,
  branches,
  snow,
}: {
  x1: number;
  x2: number;
  top: number;
  base: number;
  w: number;
  seed: number;
  branches?: boolean;
  snow?: boolean;
}) {
  const r = rng(seed);
  const marks: React.ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const t = 0.08 + r() * 0.85;
    const cx = x1 + (x2 - x1) * t + (r() - 0.5) * w * 0.4;
    const cy = top + (base - top) * t;
    const mw = w * (0.2 + r() * 0.35);
    marks.push(
      <path
        key={i}
        d={`M${f(cx - mw)} ${f(cy)} Q${f(cx)} ${f(cy - 7 - r() * 6)} ${f(cx + mw)} ${f(cy)} Q${f(cx)} ${f(cy + 4)} ${f(cx - mw)} ${f(cy)} Z`}
        fill="#2b2a2e"
        opacity={0.75 + r() * 0.2}
      />
    );
  }
  const trunk = `M${f(x1 - w / 2)} ${f(top)} L${f(x1 + w / 2)} ${f(top)} L${f(x2 + w * 0.6)} ${f(base)} L${f(x2 - w * 0.6)} ${f(base)} Z`;
  return (
    <g>
      {branches && (
        <g stroke="#8d8a86" strokeLinecap="round" fill="none">
          <path d={`M${f(x1)} ${f(top + (base - top) * 0.15)} l${f(-w * 1.6)} ${f(-w * 1.4)}`} strokeWidth={w * 0.14} />
          <path d={`M${f(x1)} ${f(top + (base - top) * 0.25)} l${f(w * 1.8)} ${f(-w * 1.2)}`} strokeWidth={w * 0.12} />
          <path d={`M${f(x1)} ${f(top + (base - top) * 0.05)} l${f(w * 1.1)} ${f(-w * 1.5)}`} strokeWidth={w * 0.1} />
        </g>
      )}
      <path d={trunk} fill="#efece4" />
      <path
        d={`M${f(x1 + w * 0.12)} ${f(top)} L${f(x1 + w / 2)} ${f(top)} L${f(x2 + w * 0.6)} ${f(base)} L${f(x2 + w * 0.15)} ${f(base)} Z`}
        fill="#b9b6b0"
        opacity=".6"
      />
      {marks}
      {snow && <path d={trunk} fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="30 90" opacity=".8" />}
    </g>
  );
}

/* ---------- A log (rail) between two points, with bark, grain, end cap, optional snow ---------- */
export function Log({
  x1,
  y1,
  x2,
  y2,
  r,
  snow,
  capEnd,
  seed = 1,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  r: number;
  snow?: boolean;
  capEnd?: "start" | "end" | "both";
  seed?: number;
}) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const rand = rng(seed);
  const grain: React.ReactNode[] = [];
  for (let i = 0; i < Math.max(3, len / 90); i++) {
    const gx = rand() * len;
    const gy = (rand() - 0.5) * r * 1.2;
    const gl = 40 + rand() * 120;
    grain.push(
      <path
        key={i}
        d={`M${f(gx)} ${f(gy)} q${f(gl / 2)} ${f((rand() - 0.5) * 6)} ${f(gl)} 0`}
        stroke="#6d3a1c"
        strokeWidth={1.6 + rand() * 1.4}
        fill="none"
        opacity=".55"
        strokeLinecap="round"
      />
    );
  }
  let snowPath = "";
  if (snow) {
    const bumps = Math.max(3, Math.round(len / 70));
    snowPath = `M-4 ${f(-r + 4)}`;
    for (let i = 0; i <= bumps; i++) {
      const bx = (len * i) / bumps;
      snowPath += ` Q${f(bx - len / bumps / 2)} ${f(-r - 12 - rand() * 12)} ${f(bx)} ${f(-r - 4)}`;
    }
    snowPath += ` L${f(len + 4)} ${f(-r + 6)} Q${f(len / 2)} ${f(-r + 14)} -4 ${f(-r + 6)} Z`;
  }
  const cap = (at: number) => (
    <g transform={`translate(${f(at)} 0)`}>
      <ellipse rx={r * 0.35} ry={r} fill="#d99a5f" />
      <ellipse rx={r * 0.22} ry={r * 0.62} fill="none" stroke="#a8683a" strokeWidth="2" />
      <ellipse rx={r * 0.1} ry={r * 0.28} fill="none" stroke="#a8683a" strokeWidth="2" />
    </g>
  );
  return (
    <g transform={`translate(${f(x1)} ${f(y1)}) rotate(${f(ang)})`}>
      <rect x={0} y={-r} width={len} height={r * 2} rx={r * 0.5} fill="url(#cs-log)" />
      {grain}
      <path d={`M${f(r * 0.4)} ${f(-r * 0.55)} L${f(len - r * 0.4)} ${f(-r * 0.55)}`} stroke="#f0b27a" strokeWidth={r * 0.18} opacity=".45" strokeLinecap="round" />
      {(capEnd === "start" || capEnd === "both") && cap(r * 0.2)}
      {(capEnd === "end" || capEnd === "both") && cap(len - r * 0.2)}
      {snow && <path d={snowPath} fill="#fbfdff" stroke="#d6e2ef" strokeWidth="2" />}
    </g>
  );
}

/* ---------- A vertical post ---------- */
export function Post({ x, top, bottom, w, snow }: { x: number; top: number; bottom: number; w: number; snow?: boolean }) {
  return (
    <g>
      <rect x={x - w / 2} y={top} width={w} height={bottom - top} rx={w * 0.2} fill="url(#cs-post)" />
      <path d={`M${f(x - w * 0.25)} ${f(top + 20)} L${f(x - w * 0.22)} ${f(bottom - 20)}`} stroke="#f0b27a" strokeWidth={w * 0.12} opacity=".35" strokeLinecap="round" />
      <path d={`M${f(x + w * 0.05)} ${f(top + 60)} l2 120 M${f(x + w * 0.2)} ${f(top + 200)} l-2 90`} stroke="#6d3a1c" strokeWidth="2.5" opacity=".5" />
      <ellipse cx={x} cy={top + 4} rx={w / 2} ry={w * 0.18} fill="#d99a5f" />
      <ellipse cx={x} cy={top + 4} rx={w * 0.3} ry={w * 0.1} fill="none" stroke="#a8683a" strokeWidth="2" />
      {snow && (
        <path
          d={`M${f(x - w / 2 - 4)} ${f(top + 8)} Q${f(x - w / 2)} ${f(top - 26)} ${f(x)} ${f(top - 24)} Q${f(x + w / 2)} ${f(top - 22)} ${f(x + w / 2 + 4)} ${f(top + 8)} Q${f(
            x
          )} ${f(top + 16)} ${f(x - w / 2 - 4)} ${f(top + 8)} Z`}
          fill="#fbfdff"
          stroke="#d6e2ef"
          strokeWidth="2"
        />
      )}
    </g>
  );
}

/* ---------- Falling snow ---------- */
export function Snowfall({
  seed,
  count,
  x = 0,
  y = 0,
  w,
  h,
  size = [2, 6],
  speed = [7, 14],
  opacity = 0.9,
}: {
  seed: number;
  count: number;
  x?: number;
  y?: number;
  w: number;
  h: number;
  size?: [number, number];
  speed?: [number, number];
  opacity?: number;
}) {
  const r = rng(seed);
  const flakes: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const fx = x + r() * w;
    const s = size[0] + r() * (size[1] - size[0]);
    const dur = speed[0] + r() * (speed[1] - speed[0]);
    const delay = -r() * dur;
    const drift = (r() - 0.3) * 120;
    flakes.push(
      <g
        key={i}
        className="cs-fall"
        style={
          {
            animationDuration: `${dur.toFixed(2)}s`,
            animationDelay: `${delay.toFixed(2)}s`,
            "--fall": `${h + 40}px`,
            "--drift": `${drift.toFixed(0)}px`,
          } as React.CSSProperties
        }
      >
        <circle
          cx={fx}
          cy={y - 20}
          r={s}
          fill="#fff"
          opacity={opacity * (0.6 + r() * 0.4)}
          className="cs-flutter"
          style={{ animationDuration: `${(2 + r() * 2).toFixed(2)}s`, animationDelay: `${(-r() * 3).toFixed(2)}s` }}
        />
      </g>
    );
  }
  return <g className="pointer-events-none">{flakes}</g>;
}

/* ---------- Twinkling sparkles (sun on snow) ---------- */
export function Sparkles({ seed, count, x, y, w, h }: { seed: number; count: number; x: number; y: number; w: number; h: number }) {
  const r = rng(seed);
  return (
    <g>
      {Array.from({ length: count }).map((_, i) => {
        const cx = x + r() * w;
        const cy = y + r() * h;
        const s = 3 + r() * 4;
        return (
          <path
            key={i}
            d={`M${f(cx)} ${f(cy - s)} L${f(cx + s * 0.25)} ${f(cy)} L${f(cx)} ${f(cy + s)} L${f(cx - s * 0.25)} ${f(cy)} Z M${f(cx - s)} ${f(cy)} L${f(
              cx
            )} ${f(cy + s * 0.25)} L${f(cx + s)} ${f(cy)} L${f(cx)} ${f(cy - s * 0.25)} Z`}
            fill="#fff"
            className="cs-twinkle"
            style={{ animationDelay: `${(-r() * 4).toFixed(2)}s`, animationDuration: `${(2.5 + r() * 2.5).toFixed(2)}s` }}
          />
        );
      })}
    </g>
  );
}

/* ---------- Butterfly (flies along a path with SMIL motion) ---------- */
export function Butterfly({ color, path, dur = 18, begin = 0 }: { color: string; path: string; dur?: number; begin?: number }) {
  return (
    <g>
      <animateMotion dur={`${dur}s`} begin={`${-begin}s`} repeatCount="indefinite" path={path} />
      <g className="cs-wing" style={{ animationDelay: `${-begin}s` }}>
        <path d="M0 0 C-14 -16 -22 -4 -16 4 C-22 10 -10 16 0 4 Z" fill={color} stroke="#3b2a3a" strokeWidth="1.2" />
        <path d="M0 0 C14 -16 22 -4 16 4 C22 10 10 16 0 4 Z" fill={color} stroke="#3b2a3a" strokeWidth="1.2" />
      </g>
      <rect x="-1.5" y="-5" width="3" height="12" rx="1.5" fill="#3b2a3a" />
    </g>
  );
}

/* ---------- Shared defs + keyframes ---------- */
export function SceneDefs() {
  return (
    <defs>
      <linearGradient id="cs-log" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d4874a" />
        <stop offset=".45" stopColor="#b0612c" />
        <stop offset="1" stopColor="#6e3517" />
      </linearGradient>
      <linearGradient id="cs-post" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#c47a41" />
        <stop offset=".55" stopColor="#9c5426" />
        <stop offset="1" stopColor="#5e2d13" />
      </linearGradient>
    </defs>
  );
}

export const SCENE_CSS = `
@keyframes cs-fall { from { transform: translate(0, 0) } to { transform: translate(var(--drift), var(--fall)) } }
@keyframes cs-flutter { 0%,100% { transform: translateX(-6px) } 50% { transform: translateX(6px) } }
@keyframes cs-sway { 0%,100% { transform: rotate(-0.8deg) } 50% { transform: rotate(0.8deg) } }
@keyframes cs-shimmer { 0%,100% { transform: rotate(-3deg) scale(1) } 50% { transform: rotate(3deg) scale(1.03) } }
@keyframes cs-grass { 0%,100% { transform: skewX(-4deg) } 50% { transform: skewX(5deg) } }
@keyframes cs-twinkle { 0%,100% { opacity: 0; transform: scale(.4) } 50% { opacity: 1; transform: scale(1) } }
@keyframes cs-drift { from { transform: translateX(-300px) } to { transform: translateX(1900px) } }
@keyframes cs-pulse { 0%,100% { opacity: .55 } 50% { opacity: .9 } }
@keyframes cs-wing { 0%,100% { transform: scaleX(1) } 50% { transform: scaleX(.2) } }
@keyframes cs-bulb { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
@keyframes cs-mote { 0% { transform: translate(0,0); opacity: 0 } 20% { opacity: .9 } 100% { transform: translate(40px,-120px); opacity: 0 } }
@keyframes cs-breath { 0% { transform: translate(0,0) scale(.3); opacity: 0 } 25% { opacity: .75 } 100% { transform: translate(26px,-18px) scale(1.4); opacity: 0 } }
.cs-fall { animation: cs-fall 10s linear infinite }
.cs-flutter { animation: cs-flutter 3s ease-in-out infinite }
.cs-sway { transform-box: view-box; animation: cs-sway 5s ease-in-out infinite }
.cs-shimmer { transform-box: fill-box; transform-origin: center; animation: cs-shimmer 2.6s ease-in-out infinite }
.cs-grass { transform-box: fill-box; transform-origin: bottom; animation: cs-grass 3.2s ease-in-out infinite }
.cs-twinkle { transform-box: fill-box; transform-origin: center; animation: cs-twinkle 3s ease-in-out infinite }
.cs-cloud { animation: cs-drift 140s linear infinite }
.cs-pulse { animation: cs-pulse 5s ease-in-out infinite }
.cs-wing { transform-box: fill-box; transform-origin: center; animation: cs-wing .22s ease-in-out infinite }
.cs-bulb { animation: cs-bulb 1.8s ease-in-out infinite }
.cs-mote { transform-box: fill-box; animation: cs-mote 7s ease-in-out infinite }
@media (prefers-reduced-motion: reduce) {
  .cs-fall, .cs-flutter, .cs-sway, .cs-shimmer, .cs-grass, .cs-twinkle, .cs-cloud, .cs-pulse, .cs-wing, .cs-bulb, .cs-mote { animation: none }
}
`;
