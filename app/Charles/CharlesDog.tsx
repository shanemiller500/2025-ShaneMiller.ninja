"use client";

import { forwardRef } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export type Pose =
  | "stand"
  | "sit"
  | "lie"
  | "sleep"
  | "jump"
  | "squat"
  | "fart"
  | "sniff"
  | "headtilt"
  | "alert"
  | "beg"
  | "chomp"
  | "hump";

export type Mood = "happy" | "sassy" | "alert" | "smug" | "hungry" | "offended";

export interface DogRefs {
  jaw: SVGGElement | null;
  pupils: SVGGElement | null;
}

interface CharlesDogProps {
  pose: Pose;
  mood: Mood;
  walking: boolean;
  running: boolean;
  wag: "none" | "slow" | "fast";
  thinking: boolean;
  /** Snow on his coat and foggy breath (winter, outdoors). */
  winter?: boolean;
  /** Receives the DOM nodes animated every frame (lip sync + eye tracking). */
  partsRef: React.RefObject<DogRefs>;
}

/* ------------------------------------------------------------------ */
/*  Pose table: CSS transforms per body part (SVG view-box pixels)     */
/* ------------------------------------------------------------------ */
interface PartPose {
  upper?: string; // everything above the legs
  head?: string;
  frontNear?: string;
  frontFar?: string;
  backNear?: string;
  backFar?: string;
  tail?: string;
  haunch?: number; // folded rear-leg opacity
  backLegs?: number; // standing rear-leg opacity
  lid?: number; // 0 wide open .. 1 closed
}

const POSES: Record<Pose, PartPose> = {
  stand: { lid: 0.3 },
  alert: { upper: "rotate(-4deg)", head: "rotate(-10deg) translateY(-4px)", lid: 0.05, tail: "rotate(-12deg)" },
  sit: { upper: "rotate(-22deg)", head: "rotate(16deg)", haunch: 1, backLegs: 0, lid: 0.34, tail: "rotate(40deg)" },
  beg: {
    upper: "rotate(-24deg)",
    head: "rotate(8deg)",
    frontNear: "rotate(-55deg) translateY(-6px)",
    haunch: 1,
    backLegs: 0,
    lid: 0,
    tail: "rotate(40deg)",
  },
  lie: {
    upper: "translateY(56px)",
    head: "rotate(-4deg)",
    frontNear: "translateY(58px) rotate(-82deg)",
    frontFar: "translateY(58px) rotate(-78deg)",
    haunch: 1,
    backLegs: 0,
    lid: 0.45,
    tail: "rotate(60deg)",
  },
  sleep: {
    upper: "translateY(56px)",
    head: "rotate(22deg) translate(-6px, 10px)",
    frontNear: "translateY(58px) rotate(-82deg)",
    frontFar: "translateY(58px) rotate(-78deg)",
    haunch: 1,
    backLegs: 0,
    lid: 1,
    tail: "rotate(70deg)",
  },
  jump: {
    upper: "rotate(-10deg)",
    head: "rotate(-6deg)",
    frontNear: "rotate(-38deg)",
    frontFar: "rotate(-30deg)",
    backNear: "rotate(32deg)",
    backFar: "rotate(26deg)",
    lid: 0,
    tail: "rotate(-18deg)",
  },
  chomp: {
    upper: "rotate(-14deg)",
    head: "rotate(-14deg)",
    frontNear: "rotate(-30deg)",
    frontFar: "rotate(-24deg)",
    backNear: "rotate(24deg)",
    lid: 0,
    tail: "rotate(-18deg)",
  },
  squat: {
    upper: "rotate(-17deg)",
    backNear: "rotate(-24deg) translateY(4px)",
    backFar: "rotate(-20deg) translateY(4px)",
    tail: "rotate(-30deg)",
    head: "rotate(-4deg)",
    lid: 0.55,
  },
  hump: {
    upper: "rotate(-26deg) translateY(-6px)",
    head: "rotate(14deg)",
    frontNear: "rotate(-62deg) translateY(-4px)",
    frontFar: "rotate(-56deg) translateY(-4px)",
    lid: 0.55,
    tail: "rotate(-20deg)",
  },
  fart: { upper: "rotate(3deg)", tail: "rotate(-34deg)", head: "rotate(-6deg)", lid: 0.6 },
  sniff: { head: "rotate(34deg) translateY(10px)", upper: "rotate(4deg)", lid: 0.3 },
  headtilt: { head: "rotate(-16deg)", lid: 0.15 },
};

/* Pivots in view-box coordinates */
const PIVOT = {
  upper: "230px 192px",
  head: "248px 120px",
  frontNear: "230px 180px",
  frontFar: "214px 184px",
  backNear: "112px 174px",
  backFar: "124px 180px",
  tail: "98px 146px",
  jaw: "280px 116px",
};

function part(pivot: string, transform?: string): React.CSSProperties {
  return {
    transformBox: "view-box",
    transformOrigin: pivot,
    transform: transform ?? "none",
    transition: "transform 380ms cubic-bezier(.34,1.4,.64,1), opacity 250ms",
  };
}

/* Brow shapes per mood: [far brow, near brow] */
const BROWS: Record<Mood, [string, string]> = {
  sassy: ["rotate(-8deg) translateY(-2px)", "rotate(10deg) translateY(1px)"],
  smug: ["rotate(-6deg) translateY(-3px)", "rotate(-4deg) translateY(-1px)"],
  happy: ["translateY(-3px)", "translateY(-3px)"],
  alert: ["translateY(-4px) rotate(4deg)", "translateY(-4px) rotate(-4deg)"],
  hungry: ["rotate(10deg) translateY(-2px)", "rotate(-12deg) translateY(-3px)"],
  offended: ["rotate(14deg) translateY(1px)", "rotate(-14deg) translateY(1px)"],
};

/* ---------- palette: a glossy black coat, lit from above ---------- */
const FUR = "url(#charles-fur)";
const HEAD = "url(#charles-head)";
const DEEP = "#111217";
const DARK = "#1c1d24";
const MID = "#272932";
const LIGHT = "#434857";
const RIM = "#8a95b4";

/** Fluffy tufted outline: spiky scallops around (part of) an ellipse. */
function tufts(cx: number, cy: number, rx: number, ry: number, n: number, spike: number, a0 = 0, a1 = 360) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const step = (a1 - a0) / n;
  const pt = (a: number, grow: number) =>
    `${(cx + (rx + grow) * Math.cos(rad(a))).toFixed(1)} ${(cy + (ry + grow) * Math.sin(rad(a))).toFixed(1)}`;
  let d = `M${pt(a0, 0)}`;
  for (let i = 0; i < n; i++) {
    const wobble = (i % 3) - 1;
    d += ` Q${pt(a0 + (i + 0.5) * step, spike + wobble * 1.5)} ${pt(a0 + (i + 1) * step, 0)}`;
  }
  return a1 - a0 >= 360 ? `${d} Z` : `${d} L${cx} ${cy} Z`;
}

const TAIL_TUFTS: [number, number, number][] = [
  [101, 130, 10],
  [97, 113, 10],
  [103, 97, 10],
  [116, 86, 10],
  [132, 82, 9],
  [145, 89, 8],
  [148, 101, 7],
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const CharlesDog = forwardRef<SVGSVGElement, CharlesDogProps>(function CharlesDog(
  { pose, mood, walking, running, wag, thinking, partsRef, winter = false },
  ref
) {
  const p = POSES[pose];
  const moving = walking || running;
  const lid = mood === "hungry" && pose === "stand" ? 0.05 : p.lid ?? 0.3;
  const [farBrow, nearBrow] = BROWS[mood];
  const puppyEyes = pose === "beg" || mood === "hungry";

  const legAnim = (phase: "a" | "b") =>
    moving ? `charles-leg-${phase} ${running ? 0.28 : 0.55}s ease-in-out infinite` : undefined;

  const backLeg = (fill: string, paw: string) => (
    <>
      <path d="M112 206 C106 216 100 226 100 238 C100 248 104 256 106 262 L126 264 C124 256 122 248 124 240 C128 230 136 220 138 208 Z" fill={fill} />
      <path d="M100 263 C98 271 132 273 135 265 C135 258 102 256 100 263 Z" fill={paw} />
    </>
  );
  const frontLeg = (fill: string, paw: string) => (
    <>
      <path d="M214 172 C212 198 218 222 220 244 C221 252 220 258 218 263 L244 265 C242 258 241 252 241 244 C241 222 248 198 248 170 Z" fill={fill} />
      <path d="M213 263 C211 271 249 273 251 265 C251 258 215 256 213 263 Z" fill={paw} />
    </>
  );

  return (
    <svg
      ref={ref}
      viewBox="0 0 360 290"
      className="h-full w-full overflow-visible"
      role="img"
      aria-label="Charles, a black Lab and Chow mix, drawn as a cartoon"
    >
      <style>{DOG_CSS}</style>
      <defs>
        <linearGradient id="charles-fur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3e4c" />
          <stop offset=".45" stopColor="#23252d" />
          <stop offset="1" stopColor="#121318" />
        </linearGradient>
        <radialGradient id="charles-head" cx="45%" cy="25%" r="80%">
          <stop offset="0" stopColor="#474c5c" />
          <stop offset=".5" stopColor="#262830" />
          <stop offset="1" stopColor="#15161b" />
        </radialGradient>
        <radialGradient id="charles-iris" cx="38%" cy="32%" r="72%">
          <stop offset="0" stopColor="#f2b35c" />
          <stop offset=".6" stopColor="#a8561c" />
          <stop offset="1" stopColor="#5a2a0a" />
        </radialGradient>
        <linearGradient id="charles-collar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7a5230" />
          <stop offset="1" stopColor="#3b2413" />
        </linearGradient>
        <filter id="charles-soft-shadow" x="-30%" y="-200%" width="160%" height="500%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        {/* a thin ink outline so he matches the cartoon scenes */}
        <filter id="charles-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="1.3" result="grown" />
          <feFlood floodColor="#07070a" result="ink" />
          <feComposite in="ink" in2="grown" operator="in" result="outline" />
          <feMerge>
            <feMergeNode in="outline" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="charles-eye-far">
          <ellipse cx="270" cy="82" rx="7.2" ry="6.8" />
        </clipPath>
        <clipPath id="charles-eye-near">
          <ellipse cx="294" cy="84" rx="6.8" ry="6.4" />
        </clipPath>
      </defs>

      {/* soft contact shadow */}
      <g filter="url(#charles-soft-shadow)" style={{ transition: "opacity 300ms" }} opacity={pose === "jump" || pose === "chomp" ? 0.25 : 1}>
        <ellipse cx="176" cy="272" rx={pose === "lie" || pose === "sleep" ? 136 : 112} ry="10" fill="#000" opacity=".35" />
        <ellipse cx="176" cy="270" rx={pose === "lie" || pose === "sleep" ? 110 : 86} ry="5" fill="#000" opacity=".45" />
      </g>

      <g filter="url(#charles-ink)">
        {/* ---------- far legs ---------- */}
        <g style={{ ...part(PIVOT.backFar, p.backFar), opacity: p.backLegs ?? 1 }}>
          <g style={{ transformBox: "view-box", transformOrigin: PIVOT.backFar, animation: legAnim("b") }}>
            <g transform="translate(14 1)">{backLeg(DEEP, "#0c0c10")}</g>
          </g>
        </g>
        <g style={part(PIVOT.frontFar, p.frontFar)}>
          <g style={{ transformBox: "view-box", transformOrigin: PIVOT.frontFar, animation: legAnim("a") }}>
            <g transform="translate(-16 1)">{frontLeg(DEEP, "#0c0c10")}</g>
          </g>
        </g>

        {/* ---------- upper body ---------- */}
        <g style={part(PIVOT.upper, p.upper)}>
          <g className={moving ? "charles-bob" : undefined}>
            {/* tail: fluffy chow plume curled over the back */}
            <g style={part(PIVOT.tail, p.tail)}>
              <g
                className={wag === "none" ? undefined : wag === "fast" ? "charles-wag-fast" : "charles-wag"}
                style={{ transformBox: "view-box", transformOrigin: PIVOT.tail }}
              >
                <path d="M104 142 C88 118 94 86 122 80 C146 76 154 100 138 110" fill="none" stroke={DARK} strokeWidth="19" strokeLinecap="round" />
                {TAIL_TUFTS.map(([x, y, r], i) => (
                  <path key={i} d={tufts(x, y, r, r, 7, 4.5)} fill={DARK} />
                ))}
                <path d="M99 132 C91 112 98 94 116 86 C128 82 138 83 144 88" fill="none" stroke={LIGHT} strokeWidth="3" strokeLinecap="round" opacity=".8" />
                {winter && <path d="M104 92 Q116 76 134 78 Q124 84 112 94 Z" fill="#fbfdff" />}
              </g>
            </g>

            {/* folded rear leg (sit / lie) */}
            <g style={{ opacity: p.haunch ?? 0, transition: "opacity 250ms" }}>
              <path d="M92 190 C92 168 112 160 134 166 C154 172 156 200 142 212 C126 222 96 214 92 190 Z" fill={FUR} />
              <path d="M128 210 C142 218 164 220 178 214 C182 221 175 227 162 227 C146 227 132 222 128 210 Z" fill={DARK} />
              <path d="M102 176 C112 168 128 168 140 176" stroke={RIM} strokeOpacity=".35" strokeWidth="3" fill="none" strokeLinecap="round" />
            </g>

            {/* torso: deep chest, tucked waist */}
            <path
              d="M100 150 C98 128 120 118 150 120 C180 122 205 118 226 122 C250 126 262 146 260 170 C258 192 244 208 222 210 C200 211 180 204 160 200 C140 197 126 204 112 202 C96 198 92 175 100 150 Z"
              fill={FUR}
            />
            <path d="M130 197 C160 205 200 210 232 206 C220 213 190 215 160 207 Z" fill={DEEP} opacity=".7" />
            <ellipse cx="226" cy="160" rx="20" ry="30" fill={LIGHT} opacity=".35" />
            <path d="M108 136 C130 122 180 121 226 124" stroke={RIM} strokeOpacity=".55" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M120 146 C150 136 190 136 214 140" stroke={RIM} strokeOpacity=".18" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M150 162 q8 -3 16 0 M172 172 q8 -3 16 0 M138 178 q8 -3 14 0 M190 186 q7 -2 13 0" stroke={LIGHT} strokeWidth="2" fill="none" opacity=".6" strokeLinecap="round" />
            {winter && (
              <g fill="#fbfdff">
                <path d="M128 124 Q140 112 158 118 Q170 114 180 121 Q160 126 128 126 Z" />
                <path d="M190 120 Q202 112 214 118 Q222 116 226 122 Q208 124 190 122 Z" />
                <circle cx="146" cy="140" r="2" />
                <circle cx="176" cy="134" r="1.6" />
                <circle cx="206" cy="142" r="1.8" />
              </g>
            )}

            {/* chow mane + chest ruff */}
            <path d={tufts(240, 138, 28, 32, 16, 7)} fill={DARK} />
            <path d={tufts(244, 134, 20, 24, 12, 5)} fill={MID} />
            <path d={tufts(250, 172, 14, 14, 7, 7, 10, 170)} fill={DARK} />
            <path d="M232 150 l-4 7 M242 162 l-2 8 M254 164 l2 7 M226 132 l-6 3" stroke={LIGHT} strokeWidth="1.8" strokeLinecap="round" />

            {/* ---------- head ---------- */}
            <g style={part(PIVOT.head, p.head)}>
              <g className={thinking ? "charles-think" : undefined} style={{ transformBox: "view-box", transformOrigin: PIVOT.head }}>
                {/* far ear, floppy */}
                <path
                  className="charles-ear-far"
                  d="M236 72 C220 70 208 88 212 112 C220 110 234 98 248 82 Z"
                  fill="#15161b"
                  style={{ transformBox: "view-box", transformOrigin: "240px 76px" }}
                />
                {/* skull */}
                <path d="M226 96 C224 70 244 56 266 57 C288 58 302 72 303 90 L301 104 C297 118 281 128 262 128 C244 128 228 116 226 96 Z" fill={HEAD} />
                <path d={tufts(246, 114, 17, 12, 8, 5, 40, 200)} fill={DARK} />
                <ellipse cx="266" cy="67" rx="17" ry="6" fill={LIGHT} opacity=".55" />
                <path d="M248 64 C258 58 274 58 284 62" stroke={RIM} strokeOpacity=".5" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                {winter && <path d="M250 60 Q262 50 278 56 Q286 58 288 64 Q268 60 250 62 Z" fill="#fbfdff" />}

                {/* mouth interior (revealed when the jaw opens) */}
                <path d="M278 110 C292 114 312 114 326 110 C328 124 314 136 296 134 C284 132 278 124 278 110 Z" fill="#5a1c2c" />

                {/* jaw: rotated every frame for lip sync */}
                <g
                  ref={(el) => {
                    partsRef.current.jaw = el;
                  }}
                  style={{ transformBox: "view-box", transformOrigin: PIVOT.jaw }}
                >
                  <path d="M289 116 C295 135 314 137 321 120 C312 122 300 122 289 116 Z" fill="#7a4f8a" />
                  <path d="M305 118 L305 130" stroke="#5d3a6b" strokeWidth="1.2" />
                  <circle cx="300" cy="127" r="1.8" fill="#2a1535" />
                  <circle cx="310" cy="125" r="1.4" fill="#2a1535" />
                  <circle cx="296" cy="122" r="1.1" fill="#2a1535" />
                  <path d="M287 115 l2 -4 l2 4 M313 115 l2 -4 l2 4" fill="#f6f1e7" />
                  <path d="M278 112 C292 122 312 124 324 116 C324 126 312 136 294 135 C282 133 276 124 278 112 Z" fill={DARK} />
                  <path d="M286 128 C294 132 306 132 314 128" stroke={LIGHT} strokeWidth="1.6" fill="none" opacity=".6" />
                </g>

                {/* upper muzzle */}
                <path d="M280 86 C298 82 318 84 330 93 C337 100 335 111 327 115 C312 119 294 118 280 113 Z" fill={MID} />
                <path d="M286 90 C300 86 316 87 326 94" stroke="#5a6175" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".7" />
                <path d="M278 112 C292 118 312 118 326 114" stroke="#08080b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                <path d="M280 111 q-4 2 -3 6" stroke="#08080b" strokeWidth="2" fill="none" strokeLinecap="round" />
                <circle cx="304" cy="105" r="1" fill="#5a6175" />
                <circle cx="310" cy="103" r="1" fill="#5a6175" />
                <circle cx="311" cy="108" r="1" fill="#5a6175" />
                {/* the snaggle tooth, as seen in every photo */}
                <path d="M298 114 L301 122 L304 114 Z" fill="#f6f1e7" />
                {/* nose */}
                <path d="M320 92 C328 87 339 89 340 97 C341 104 333 108 325 106 C318 105 315 96 320 92 Z" fill="#0b0b0e" />
                <ellipse cx="330" cy="93" rx="4.2" ry="2" fill="#fff" opacity=".45" />
                <path d="M326 101 q3 2 6 0" stroke="#34343c" strokeWidth="1.2" fill="none" />

                {/* eyes: dark rims, amber irises, big catchlights */}
                <ellipse cx="270" cy="82" rx="8.6" ry="8.2" fill="#0b0b0e" />
                <ellipse cx="294" cy="84" rx="8.2" ry="7.8" fill="#0b0b0e" />
                <ellipse cx="270" cy="82" rx="7.2" ry="6.8" fill="url(#charles-iris)" />
                <ellipse cx="294" cy="84" rx="6.8" ry="6.4" fill="url(#charles-iris)" />
                <g
                  ref={(el) => {
                    partsRef.current.pupils = el;
                  }}
                >
                  <g
                    style={{
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      transform: puppyEyes ? "scale(1.45)" : "none",
                      transition: "transform 300ms",
                    }}
                  >
                    <circle cx="271" cy="82" r="3.4" fill="#070404" />
                    <circle cx="295" cy="84" r="3.2" fill="#070404" />
                  </g>
                  <circle cx="268" cy="79.5" r="2" fill="#fff" />
                  <circle cx="292.3" cy="81.6" r="1.8" fill="#fff" />
                  <circle cx="273" cy="85" r=".9" fill="#fff" opacity=".8" />
                  <circle cx="297" cy="87" r=".8" fill="#fff" opacity=".8" />
                </g>
                {/* lids: resting half-lid = deadpan */}
                <g clipPath="url(#charles-eye-far)">
                  <rect
                    x="262"
                    y="75"
                    width="17"
                    height="14"
                    fill="#2b2d36"
                    style={{ transformBox: "view-box", transformOrigin: "270px 75.2px", transform: `scaleY(${lid})`, transition: "transform 250ms" }}
                  />
                  <rect x="262" y="75" width="17" height="14" fill="#2b2d36" className="charles-blink" style={{ transformBox: "view-box", transformOrigin: "270px 75.2px" }} />
                </g>
                <g clipPath="url(#charles-eye-near)">
                  <rect
                    x="286"
                    y="77.4"
                    width="16"
                    height="13.2"
                    fill="#2b2d36"
                    style={{ transformBox: "view-box", transformOrigin: "294px 77.6px", transform: `scaleY(${lid})`, transition: "transform 250ms" }}
                  />
                  <rect x="286" y="77.4" width="16" height="13.2" fill="#2b2d36" className="charles-blink" style={{ transformBox: "view-box", transformOrigin: "294px 77.6px" }} />
                </g>

                {/* brows */}
                <path
                  d="M261 71 C266 67.5 273 67.5 278 71"
                  stroke="#626a80"
                  strokeWidth="2.8"
                  fill="none"
                  strokeLinecap="round"
                  style={{ transformBox: "view-box", transformOrigin: "270px 70px", transform: farBrow, transition: "transform 250ms" }}
                />
                <path
                  d="M287 75 C291.5 73.5 297 74.5 301 77"
                  stroke="#626a80"
                  strokeWidth="2.8"
                  fill="none"
                  strokeLinecap="round"
                  style={{ transformBox: "view-box", transformOrigin: "294px 75px", transform: nearBrow, transition: "transform 250ms" }}
                />

                {/* near ear: soft rose fold, flipped inside like the photos */}
                <g
                  className="charles-ear-near"
                  style={{
                    transformBox: "view-box",
                    transformOrigin: "274px 64px",
                    transform: pose === "alert" || mood === "alert" ? "rotate(-14deg) translateY(-3px)" : "none",
                    transition: "transform 200ms",
                  }}
                >
                  <path d="M264 66 C272 50 296 44 309 55 C315 66 309 82 300 90 C295 80 286 72 272 71 Z" fill="#17181d" />
                  <path d="M282 58 C291 52 301 52 306 58 C305 66 301 73 297 78 C293 70 288 65 283 62 Z" fill="#6b4034" />
                  <path d="M270 60 C280 50 296 48 306 54" stroke={RIM} strokeOpacity=".45" strokeWidth="2" fill="none" strokeLinecap="round" />
                </g>

              </g>
            </g>

            {/* collar + tag */}
            <path d="M232 118 C236 138 248 152 268 154" fill="none" stroke="url(#charles-collar)" strokeWidth="8.5" strokeLinecap="round" />
            <path d="M234 120 C238 138 250 150 268 152" fill="none" stroke="#d8a95a" strokeWidth="1" strokeDasharray="2 5" />
            <rect x="248" y="142" width="10" height="10" rx="2" fill="none" stroke="#e0b252" strokeWidth="2.6" transform="rotate(35 253 147)" />
            <g className="charles-tag" style={{ transformBox: "view-box", transformOrigin: "262px 154px" }}>
              <line x1="262" y1="154" x2="262" y2="162" stroke="#c3c6ce" strokeWidth="1.5" />
              <g transform="translate(262 170)">
                <circle cx="0" cy="-7" r="4.5" fill="#f5832f" />
                <circle cx="6.5" cy="-2" r="4.5" fill="#f5832f" />
                <circle cx="4" cy="6" r="4.5" fill="#f5832f" />
                <circle cx="-4" cy="6" r="4.5" fill="#f5832f" />
                <circle cx="-6.5" cy="-2" r="4.5" fill="#f5832f" />
                <circle cx="0" cy="0" r="6" fill={thinking ? "#67e8f9" : "#e1e3e8"} stroke="#9ea2ab" style={{ transition: "fill 200ms" }} />
                {thinking && <circle cx="0" cy="0" r="9" fill="#67e8f9" opacity=".35" className="charles-ping" />}
              </g>
            </g>
          </g>
        </g>

        {/* ---------- near legs (in front of body) ---------- */}
        <g style={{ ...part(PIVOT.backNear, p.backNear), opacity: p.backLegs ?? 1 }}>
          <g style={{ transformBox: "view-box", transformOrigin: PIVOT.backNear, animation: legAnim("a") }}>
            <path d="M92 150 C82 178 92 206 118 214 C134 218 146 206 144 186 C142 166 130 150 110 146 Z" fill={FUR} />
            <path d="M98 160 C92 176 96 194 110 204" stroke={RIM} strokeOpacity=".3" strokeWidth="3" fill="none" strokeLinecap="round" />
            {backLeg(FUR, DARK)}
            <path d={tufts(106, 236, 5, 6, 4, 4, 120, 250)} fill={DARK} />
            <path d="M110 266 v-3 M117 267 v-3 M124 266 v-3" stroke={LIGHT} strokeWidth="1.4" strokeLinecap="round" />
          </g>
        </g>
        <g style={part(PIVOT.frontNear, p.frontNear)}>
          <g style={{ transformBox: "view-box", transformOrigin: PIVOT.frontNear, animation: legAnim("b") }}>
            {frontLeg(FUR, DARK)}
            <path d="M226 186 C226 206 229 226 230 244" stroke={RIM} strokeOpacity=".3" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d={tufts(215, 200, 5, 7, 4, 4, 110, 250)} fill={DARK} />
            <path d="M224 267 v-3 M232 268 v-3 M240 267 v-3" stroke={LIGHT} strokeWidth="1.4" strokeLinecap="round" />
          </g>
        </g>
      </g>

      {/* cold-morning breath: outside the ink outline, but following the head */}
      {winter && (
        <g style={part(PIVOT.upper, p.upper)}>
          <g style={part(PIVOT.head, p.head)}>
            <g fill="#ffffff">
              <circle cx="346" cy="104" r="7" className="charles-breath" />
              <circle cx="346" cy="104" r="5" className="charles-breath" style={{ animationDelay: "-1.2s" }} />
            </g>
          </g>
        </g>
      )}
    </svg>
  );
});

export default CharlesDog;

/* ------------------------------------------------------------------ */
/*  Keyframes (kept next to the drawing they animate)                  */
/* ------------------------------------------------------------------ */
const DOG_CSS = `
@keyframes charles-leg-a { 0%,100% { transform: rotate(18deg) } 50% { transform: rotate(-18deg) } }
@keyframes charles-leg-b { 0%,100% { transform: rotate(-18deg) } 50% { transform: rotate(18deg) } }
@keyframes charles-wag { 0%,100% { transform: rotate(-8deg) } 50% { transform: rotate(10deg) } }
@keyframes charles-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
@keyframes charles-blink { 0%,92%,100% { transform: scaleY(0) } 95% { transform: scaleY(1) } }
@keyframes charles-ear { 0%,86%,100% { transform: rotate(0) } 90% { transform: rotate(-12deg) } 94% { transform: rotate(4deg) } }
@keyframes charles-tag { 0%,100% { transform: rotate(-6deg) } 50% { transform: rotate(6deg) } }
@keyframes charles-think { 0%,100% { transform: rotate(-4deg) } 50% { transform: rotate(-10deg) translateY(-2px) } }
@keyframes charles-ping { 0% { opacity: .5; transform: scale(.6) } 100% { opacity: 0; transform: scale(1.6) } }
@keyframes charles-breath { 0% { transform: translate(0,0) scale(.3); opacity: 0 } 25% { opacity: .7 } 100% { transform: translate(22px,-16px) scale(1.6); opacity: 0 } }
.charles-wag { animation: charles-wag .7s ease-in-out infinite }
.charles-wag-fast { animation: charles-wag .18s ease-in-out infinite }
.charles-bob { animation: charles-bob .28s ease-in-out infinite }
.charles-blink { transform: scaleY(0); animation: charles-blink 4.7s infinite }
.charles-ear-far { animation: charles-ear 6s infinite }
.charles-tag { animation: charles-tag 1.6s ease-in-out infinite }
.charles-think { animation: charles-think 1.2s ease-in-out infinite }
.charles-ping { transform-box: fill-box; transform-origin: center; animation: charles-ping 1s ease-out infinite }
.charles-breath { transform-box: fill-box; transform-origin: center; animation: charles-breath 2.4s ease-out infinite }
@media (prefers-reduced-motion: reduce) {
  .charles-wag, .charles-wag-fast, .charles-bob, .charles-ear-far, .charles-tag, .charles-think, .charles-ping, .charles-breath { animation: none }
}
`;
