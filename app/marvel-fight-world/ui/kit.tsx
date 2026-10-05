"use client";

/* eslint-disable @next/next/no-img-element */
import { type ButtonHTMLAttributes, type ReactNode, memo } from "react";
import { motion } from "framer-motion";

import { Radar } from "@/app/Marvel/components";
import type { Hero } from "@/app/Marvel/lib/roster";
import { ARCHETYPE_INFO } from "../engine/fighters";
import type { FighterDef, StatKey } from "../engine/types";
import { STAT_KEYS } from "../engine/types";
import { audio } from "../audio/audio";

export const P_COLORS = ["#22d3ee", "#fb7185"] as const;

export const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

/* ── Global arcade styles (keyframes) ──────────────────────────────── */
export function ArcadeStyles() {
  return (
    <style>{`
      @keyframes fw-stripes { from { background-position: 0 0; } to { background-position: 120px 0; } }
      @keyframes fw-shine { 0% { transform: translateX(-120%) skewX(-20deg); } 100% { transform: translateX(320%) skewX(-20deg); } }
      @keyframes fw-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      @keyframes fw-pulse { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
      @keyframes fw-scan { from { background-position: 0 0; } to { background-position: 0 6px; } }
      .fw-stripes { background-image: repeating-linear-gradient(115deg, rgba(255,255,255,0.035) 0 18px, transparent 18px 60px); animation: fw-stripes 3s linear infinite; }
      .fw-scan::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.12) 0 1px, transparent 1px 3px); animation: fw-scan .6s linear infinite; }
      .fw-shine::before { content: ""; position: absolute; top: 0; bottom: 0; width: 35%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent); animation: fw-shine 2.6s ease-in-out infinite; }
      .fw-display { font-family: var(--font-aspekta), "Arial Black", system-ui, sans-serif; font-style: italic; letter-spacing: -0.01em; }
      .fw-outline { -webkit-text-stroke: 2px #05060a; paint-order: stroke fill; }
      .fw-no-scrollbar::-webkit-scrollbar { display: none; } .fw-no-scrollbar { scrollbar-width: none; }
      .fw-pad [data-pad-menu] [data-pad-focused] { outline: 3px solid #fde047 !important; outline-offset: 3px; box-shadow: 0 0 28px rgba(253,224,71,.55); }
      .fw-thin-scroll::-webkit-scrollbar { width: 8px; } .fw-thin-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,.25); border-radius: 8px; }
    `}</style>
  );
}

/* ── Controller button glyph (Xbox colours) ────────────────────────── */
export function PadBtn({ children, c = "#94a3b8" }: { children: ReactNode; c?: string }) {
  return (
    <span className="inline-grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-black leading-none text-slate-950" style={{ background: c, boxShadow: `0 0 10px ${c}66` }}>
      {children}
    </span>
  );
}

/* ── Backdrop ──────────────────────────────────────────────────────── */
export function Backdrop({ tint = "#4f46e5", image }: { tint?: string; image?: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#05060a]">
      {image && <img src={image} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl" />}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% 120%, ${tint}55, transparent 60%), radial-gradient(ellipse at 0% 0%, #0e749044, transparent 50%), radial-gradient(ellipse at 100% 0%, #be185d44, transparent 50%)` }} />
      <div className="fw-stripes absolute inset-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_60%,#05060a)]" />
    </div>
  );
}

/* ── Buttons ───────────────────────────────────────────────────────── */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "ghost" | "danger" | "cyan" | "rose" | "gold";
  size?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
};

const TONES = {
  primary: "bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-400 text-slate-950 shadow-[0_0_30px_-6px_rgba(251,191,36,0.8)]",
  gold: "bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-400 text-slate-950 shadow-[0_0_30px_-6px_rgba(251,191,36,0.8)]",
  cyan: "bg-gradient-to-r from-cyan-300 to-sky-500 text-slate-950 shadow-[0_0_30px_-6px_rgba(34,211,238,0.8)]",
  rose: "bg-gradient-to-r from-rose-300 to-pink-500 text-slate-950 shadow-[0_0_30px_-6px_rgba(251,113,133,0.8)]",
  danger: "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-[0_0_30px_-6px_rgba(239,68,68,0.8)]",
  ghost: "bg-white/[0.06] text-white ring-1 ring-white/15 hover:bg-white/[0.12]",
};
const SIZES = { sm: "px-4 py-2 text-sm", md: "px-6 py-3 text-base", lg: "px-8 py-4 text-xl", xl: "px-12 py-5 text-3xl" };

export function ArcadeButton({ tone = "primary", size = "md", className, children, onClick, onMouseEnter, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      onMouseEnter={(e) => {
        audio.ui("move");
        onMouseEnter?.(e);
      }}
      onClick={(e) => {
        audio.unlock();
        audio.ui("select");
        onClick?.(e);
      }}
      className={cn(
        "fw-display group relative isolate inline-flex -skew-x-12 items-center justify-center gap-2 overflow-hidden rounded-md font-[650] uppercase tracking-wide transition",
        "hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-40",
        TONES[tone],
        SIZES[size],
        tone !== "ghost" && "fw-shine",
        className
      )}
    >
      <span className="inline-flex skew-x-12 items-center gap-2">{children}</span>
    </button>
  );
}

export function Keycap({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <kbd
      className="inline-flex min-w-[1.9em] items-center justify-center rounded-md border-b-[3px] border-black/60 bg-white/90 px-1.5 py-0.5 font-mono text-[0.78em] font-bold text-slate-900 shadow"
      style={color ? { background: color } : undefined}
    >
      {children}
    </kbd>
  );
}

/* ── Stats ─────────────────────────────────────────────────────────── */
const STAT_SHORT: Record<StatKey, string> = { intelligence: "INT", strength: "STR", speed: "SPD", durability: "DUR", power: "PWR", combat: "CMB" };
const STAT_COLOR: Record<StatKey, string> = {
  intelligence: "from-violet-400 to-fuchsia-400",
  strength: "from-orange-400 to-red-500",
  speed: "from-cyan-300 to-sky-500",
  durability: "from-emerald-300 to-green-500",
  power: "from-yellow-300 to-amber-500",
  combat: "from-rose-300 to-pink-500",
};

export function StatBars({ def, compact = false }: { def: FighterDef; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      {STAT_KEYS.map((k, i) => (
        <div key={k} className="flex items-center gap-2">
          <span className={cn("w-9 shrink-0 font-mono font-bold text-white/55", compact ? "text-[10px]" : "text-[11px]")}>{STAT_SHORT[k]}</span>
          <span className={cn("relative flex-1 -skew-x-12 overflow-hidden rounded-sm bg-white/10", compact ? "h-2" : "h-2.5")}>
            <motion.span
              key={`${def.id}-${k}`}
              className={cn("absolute inset-y-0 left-0 bg-gradient-to-r", STAT_COLOR[k])}
              initial={{ width: 0 }}
              animate={{ width: `${def.stats[k]}%` }}
              transition={{ duration: 0.55, delay: i * 0.04, ease: "easeOut" }}
            />
          </span>
          <span className={cn("w-7 shrink-0 text-right font-mono font-bold tabular-nums text-white", compact ? "text-[10px]" : "text-xs")}>{def.stats[k]}</span>
        </div>
      ))}
    </div>
  );
}

/** Reuses the Character Lab radar (expects a Hero-like object). */
export function StatRadar({ defs, size = 220 }: { defs: FighterDef[]; size?: number }) {
  const heroes = defs.map((d) => ({ id: d.id, name: d.name, powerstats: d.stats }) as unknown as Hero);
  return (
    <div className="dark text-white">
      <Radar heroes={heroes} size={size} />
    </div>
  );
}

export function ArchetypeChip({ def }: { def: FighterDef }) {
  const a = ARCHETYPE_INFO[def.archetype];
  return (
    <span className="inline-flex -skew-x-12 items-center rounded-sm px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-slate-950" style={{ background: a.color }}>
      <span className="skew-x-12">{a.label}</span>
    </span>
  );
}

export function AlignmentChip({ def }: { def: FighterDef }) {
  const map = { good: ["Hero", "#38bdf8"], bad: ["Villain", "#f43f5e"], neutral: ["Neutral", "#f59e0b"] } as const;
  const [label, color] = map[def.alignment];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider" style={{ color }}>
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
      {label}
    </span>
  );
}

/** Portrait tile used by the select grid (memoized: 270+ of these). */
export const FighterTile = memo(function FighterTile({
  def,
  p1,
  p2,
  favorite,
  onPick,
  onHover,
}: {
  def: FighterDef;
  p1: boolean;
  p2: boolean;
  favorite: boolean;
  onPick: (d: FighterDef) => void;
  onHover: (d: FighterDef) => void;
}) {
  const ring = p1 && p2 ? "linear-gradient(135deg,#22d3ee 50%,#fb7185 50%)" : p1 ? "#22d3ee" : p2 ? "#fb7185" : undefined;
  return (
    <button
      type="button"
      onClick={() => onPick(def)}
      onMouseEnter={() => onHover(def)}
      onFocus={() => onHover(def)}
      title={def.name}
      className={cn(
        "group relative aspect-[3/4] w-full overflow-hidden rounded-md bg-slate-900 text-left outline-none transition duration-150",
        "hover:z-10 hover:scale-[1.06] focus-visible:z-10 focus-visible:scale-[1.06]",
        ring ? "z-10 scale-[1.04]" : "ring-1 ring-white/10"
      )}
      style={ring ? { boxShadow: `0 0 0 3px ${p1 && !p2 ? "#22d3ee" : p2 && !p1 ? "#fb7185" : "#fff"}, 0 0 26px ${p1 ? "#22d3ee" : "#fb7185"}` } : undefined}
    >
      <img src={def.portrait.sm} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-110" />
      <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
      {def.custom && <span className="absolute left-1 top-1 rounded-sm bg-amber-300 px-1 text-[9px] font-black leading-[14px] text-slate-950 shadow">★</span>}
      {favorite && <span className="absolute right-1 top-0.5 text-[11px] text-rose-400">♥</span>}
      <span className="fw-display absolute inset-x-1 bottom-1 truncate text-[11px] font-[650] uppercase leading-tight text-white">{def.name}</span>
      {(p1 || p2) && (
        <span className="absolute right-1 top-1 flex gap-0.5">
          {p1 && <span className="rounded-sm bg-cyan-300 px-1 text-[9px] font-black text-slate-950">1P</span>}
          {p2 && <span className="rounded-sm bg-rose-400 px-1 text-[9px] font-black text-slate-950">2P</span>}
        </span>
      )}
    </button>
  );
});

export function ScreenTitle({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {kicker && <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-amber-300">{kicker}</p>}
        <h1 className="fw-display fw-outline text-4xl font-[650] uppercase text-white md:text-5xl">{title}</h1>
      </div>
      {right}
    </div>
  );
}
