"use client";

/* ------------------------------------------------------------------ */
/*  Shared UI bits: buttons, portraits, stat bars, radar, badges        */
/* ------------------------------------------------------------------ */

import { memo, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ARCHETYPE_INFO } from "../engine/fighters";
import type { Alignment, Archetype, Stats } from "../engine/types";
import { STAT_KEYS } from "../engine/types";
import { stinger } from "../audio/audio";

export const STAT_LABEL: Record<keyof Stats, string> = {
  intelligence: "INT",
  strength: "STR",
  speed: "SPD",
  durability: "DUR",
  power: "PWR",
  combat: "CMB",
};

export const STAT_COLOR: Record<keyof Stats, string> = {
  intelligence: "#60a5fa",
  strength: "#f87171",
  speed: "#facc15",
  durability: "#4ade80",
  power: "#c084fc",
  combat: "#fb923c",
};

export const ALIGN_INFO: Record<Alignment, { label: string; color: string }> = {
  good: { label: "HERO", color: "#3b82f6" },
  bad: { label: "VILLAIN", color: "#ef4444" },
  neutral: { label: "NEUTRAL", color: "#a3a3a3" },
};

/** Angled arcade button. */
export function ArcadeButton({
  children,
  tone = "primary",
  className = "",
  big = false,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "ghost" | "danger" | "gold"; big?: boolean }) {
  const tones = {
    primary: "bg-red-600 hover:bg-red-500 text-white border-black",
    gold: "bg-yellow-400 hover:bg-yellow-300 text-black border-black",
    danger: "bg-slate-800 hover:bg-red-700 text-white border-black",
    ghost: "bg-white/10 hover:bg-white/20 text-white border-white/30",
  } as const;
  return (
    <button
      {...rest}
      onMouseEnter={(e) => {
        stinger("hover");
        rest.onMouseEnter?.(e);
      }}
      onClick={(e) => {
        stinger("confirm");
        rest.onClick?.(e);
      }}
      className={`mfw-btn ${tones[tone]} ${big ? "px-7 py-3 text-xl" : "px-4 py-2 text-sm"} border-2 font-black uppercase italic tracking-wide transition-transform active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${className}`}
    >
      <span className="inline-block not-italic" style={{ transform: "skewX(8deg)" }}>
        {children}
      </span>
    </button>
  );
}

/** Portrait with graceful fallback (some dataset images 404). */
export const Portrait = memo(function Portrait({
  src,
  alt,
  className = "",
  color = "#334155",
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  color?: string;
  eager?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  if (broken || !src)
    return (
      <div className={`flex items-center justify-center font-black text-white/80 ${className}`} style={{ background: `linear-gradient(160deg, ${color}, #0b0b12)` }} aria-label={alt}>
        <span className="text-2xl">{alt.slice(0, 1)}</span>
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => setBroken(true)}
      className={`object-cover ${className}`}
    />
  );
});

export function StatBars({ stats, compare, compact = false }: { stats: Stats; compare?: Stats; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      {STAT_KEYS.map((k) => (
        <div key={k} className="flex items-center gap-2">
          <span className="w-9 text-[11px] font-black tracking-wider text-white/70">{STAT_LABEL[k]}</span>
          <div className="relative h-2.5 flex-1 skew-x-[-12deg] overflow-hidden bg-white/10">
            <div className="absolute inset-y-0 left-0 transition-[width] duration-500" style={{ width: `${stats[k]}%`, background: STAT_COLOR[k] }} />
            {compare && <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${compare[k]}%` }} />}
          </div>
          <span className="w-7 text-right text-xs font-bold tabular-nums">{stats[k]}</span>
        </div>
      ))}
    </div>
  );
}

/** Hexagon radar of the six stats (optionally overlaid with a second fighter). */
export function Radar({ stats, compare, size = 180, color = "#ef4444", compareColor = "#3b82f6" }: { stats: Stats; compare?: Stats; size?: number; color?: string; compareColor?: string }) {
  const c = size / 2;
  const r = size / 2 - 22;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)];
  };
  const poly = (s: Stats) => STAT_KEYS.map((k, i) => pt(i, s[k]).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Stat radar">
      {[25, 50, 75, 100].map((v) => (
        <polygon key={v} points={STAT_KEYS.map((_, i) => pt(i, v).join(",")).join(" ")} fill="none" stroke="rgba(255,255,255,0.15)" />
      ))}
      {compare && <polygon points={poly(compare)} fill={compareColor + "44"} stroke={compareColor} strokeWidth={2} />}
      <polygon points={poly(stats)} fill={color + "55"} stroke={color} strokeWidth={2.5} />
      {STAT_KEYS.map((k, i) => {
        const [x, y] = pt(i, 122);
        return (
          <text key={k} x={x} y={y} fill="rgba(255,255,255,0.75)" fontSize={10} fontWeight={900} textAnchor="middle" dominantBaseline="middle">
            {STAT_LABEL[k]}
          </text>
        );
      })}
    </svg>
  );
}

export function Badge({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span className="inline-block skew-x-[-10deg] px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-black" style={{ background: color }}>
      <span className="inline-block skew-x-[10deg]">{children}</span>
    </span>
  );
}

export function ArchetypeBadge({ a }: { a: Archetype }) {
  return <Badge color={ARCHETYPE_INFO[a].color}>{ARCHETYPE_INFO[a].label}</Badge>;
}

export function AlignBadge({ a }: { a: Alignment }) {
  return <Badge color={ALIGN_INFO[a].color}>{ALIGN_INFO[a].label}</Badge>;
}

/** Comic panel heading */
export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="select-none">
      <h2 className="mfw-title text-3xl sm:text-5xl">{children}</h2>
      {sub && <p className="mt-1 text-xs font-bold uppercase tracking-[0.25em] text-white/50">{sub}</p>}
    </div>
  );
}

export const powerTotal = (s: Stats) => STAT_KEYS.reduce((a, k) => a + s[k], 0);
