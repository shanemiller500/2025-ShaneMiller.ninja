/* eslint-disable @next/next/no-img-element */
"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, GitCompareArrows, Images, Maximize2, Search, X } from "lucide-react";

import { Lightbox, type LightboxImage } from "@/components/ui/lightbox";
import { Modal } from "@/components/ui/modal";
import { BioSkeleton, BioTab, FactsGrid, FamilyTab, Label, PowersTab, QuoteCard, ReadMore, WikiLink, useBio } from "./bio-panels";
import { loadGallery, type Gallery } from "./lib/gallery";
import { ALIGNMENT, STATS, STAT_LABEL, alignmentOf, clean, type Hero, type StatKey } from "./lib/roster";

const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ */
/*  Radar — 6-axis power chart, one or two characters                  */
/* ------------------------------------------------------------------ */
const SERIES = [
  { stroke: "#6366f1", fill: "rgba(99,102,241,0.22)" },
  { stroke: "#f43f5e", fill: "rgba(244,63,94,0.18)" },
];

/** Plain-English read of a character's stat shape. */
export function readShape(h: Hero): { title: string; detail: string } {
  const vals = STATS.map((k) => ({ k, v: h.powerstats[k] }));
  const top = vals.reduce((m, x) => (x.v > m.v ? x : m));
  const low = vals.reduce((m, x) => (x.v < m.v ? x : m));
  const avg = h.total / STATS.length;
  const spread = top.v - low.v;
  if (avg >= 90) return { title: "Maxed out", detail: "Near the outer edge on every stat — a huge, almost perfect hexagon." };
  if (spread <= 20) return { title: "Balanced all-rounder", detail: `Even shape with no weak spot; every stat sits between ${low.v} and ${top.v}.` };
  if (avg < 40) return { title: "Street-level", detail: `A small shape: they lean on ${STAT_LABEL[top.k].toLowerCase()} (${top.v}) more than raw power.` };
  return {
    title: `${STAT_LABEL[top.k]} specialist`,
    detail: `The shape spikes toward ${STAT_LABEL[top.k]} (${top.v}) and caves in at ${STAT_LABEL[low.k]} (${low.v}).`,
  };
}

export function Radar({
  heroes,
  size = 280,
  labels = true,
  highlight = null,
  onHighlight,
}: {
  heroes: Hero[];
  size?: number;
  labels?: boolean;
  /** Stat to emphasise (linked with StatBars hover) */
  highlight?: StatKey | null;
  onHighlight?: (k: StatKey | null) => void;
}) {
  const c = size / 2;
  const r = size / 2 - (labels ? 54 : 10);
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / STATS.length - Math.PI / 2;
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)] as const;
  };
  const ring = (v: number) => STATS.map((_, i) => pt(i, v).join(",")).join(" ");
  const single = heroes.length === 1;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label={`Power stats radar for ${heroes.map((h) => `${h.name}: ${STATS.map((k) => `${STAT_LABEL[k]} ${h.powerstats[k]}`).join(", ")}`).join("; ")}`}
      onMouseLeave={() => onHighlight?.(null)}
    >
      {/* scale rings: 25 / 50 / 75 / 100 */}
      {[25, 50, 75, 100].map((v) => (
        <polygon
          key={v}
          points={ring(v)}
          fill={v === 100 ? "currentColor" : "none"}
          strokeWidth="1"
          strokeDasharray={v === 100 ? undefined : "2 3"}
          className="text-slate-50 stroke-slate-200 dark:text-white/[0.02] dark:stroke-white/[0.08]"
        />
      ))}
      {/* axes */}
      {STATS.map((k, i) => {
        const [x, y] = pt(i, 100);
        const on = highlight === k;
        return (
          <line key={k} x1={c} y1={c} x2={x} y2={y} strokeWidth={on ? 1.5 : 1} className={on ? "stroke-indigo-400" : "stroke-slate-200 dark:stroke-white/[0.08]"} />
        );
      })}
      {/* scale numbers up the top axis */}
      {labels &&
        [50, 100].map((v) => {
          const [x, y] = pt(0, v);
          return (
            <text key={v} x={x + 4} y={y + 3} className="fill-slate-300 font-mono dark:fill-slate-600" style={{ fontSize: 8 }}>
              {v}
            </text>
          );
        })}
      <circle cx={c} cy={c} r="1.5" className="fill-slate-300 dark:fill-slate-600" />

      {/* shapes */}
      {heroes.map((h, si) => {
        const pts = STATS.map((k, i) => pt(i, h.powerstats[k]).join(",")).join(" ");
        return (
          <g key={`${h.id}-${si}`}>
            <motion.polygon
              points={pts}
              fill={SERIES[si].fill}
              stroke={SERIES[si].stroke}
              strokeWidth="2"
              strokeLinejoin="round"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{ transformOrigin: `${c}px ${c}px`, filter: `drop-shadow(0 0 6px ${SERIES[si].stroke}66)` }}
            />
            {STATS.map((k, i) => {
              const [x, y] = pt(i, h.powerstats[k]);
              return (
                <motion.circle
                  key={k}
                  cx={x}
                  cy={y}
                  r={highlight === k ? 4.5 : 3}
                  fill={SERIES[si].stroke}
                  stroke="white"
                  strokeWidth="1.5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                />
              );
            })}
          </g>
        );
      })}

      {/* corner labels: stat name + value(s) */}
      {labels &&
        STATS.map((k, i) => {
          const [x, y] = pt(i, 100);
          const [lx, ly] = pt(i, 128);
          const anchor = Math.abs(lx - c) < 4 ? "middle" : lx > c ? "start" : "end";
          const dx = anchor === "start" ? -14 : anchor === "end" ? 14 : 0;
          const on = highlight === k;
          return (
            <g
              key={k}
              onMouseEnter={() => onHighlight?.(k)}
              className={onHighlight ? "cursor-default" : undefined}
            >
              {/* generous invisible hit area */}
              <circle cx={x} cy={y} r="18" fill="transparent" />
              <text
                x={lx + dx}
                y={ly - (single ? 5 : 6)}
                textAnchor={anchor}
                className={on ? "fill-indigo-600 font-mono dark:fill-indigo-300" : "fill-slate-500 font-mono dark:fill-slate-400"}
                style={{ fontSize: 9, letterSpacing: 0.6, fontWeight: on ? 700 : 500 }}
              >
                {STAT_LABEL[k].toUpperCase()}
              </text>
              <text x={lx + dx} y={ly + 7} textAnchor={anchor} className="font-mono" style={{ fontSize: 11, fontWeight: 600 }}>
                {heroes.map((h, si) => (
                  <tspan key={si} fill={single ? undefined : SERIES[si].stroke} className={single ? "fill-slate-900 dark:fill-white" : undefined}>
                    {si > 0 ? " · " : ""}
                    {h.powerstats[k]}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}
    </svg>
  );
}

/** One-line legend explaining how to read the radar. */
export function RadarHowTo({ compare = false }: { compare?: boolean }) {
  return (
    <p className="text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
      {compare
        ? "Each corner is one stat, scored 0 (center) to 100 (outer edge). Whichever shape reaches further toward a corner wins that stat; where the shapes overlap, they're evenly matched."
        : "Each corner is one stat, scored 0 (center) to 100 (outer edge). A bigger shape means more overall power; spikes show what they're best at, dents show weak spots."}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  StatBars                                                           */
/* ------------------------------------------------------------------ */
const statColor = (v: number) =>
  v >= 85 ? "from-rose-500 to-amber-400" : v >= 60 ? "from-violet-500 to-indigo-400" : v >= 35 ? "from-sky-500 to-cyan-400" : "from-slate-400 to-slate-300";

export function StatBars({
  hero,
  compact = false,
  highlight = null,
  onHighlight,
}: {
  hero: Hero;
  compact?: boolean;
  highlight?: StatKey | null;
  onHighlight?: (k: StatKey | null) => void;
}) {
  return (
    <div className={compact ? "space-y-1" : "space-y-1"} onMouseLeave={() => onHighlight?.(null)}>
      {STATS.map((k, i) => {
        const v = hero.powerstats[k];
        return (
          <div
            key={k}
            onMouseEnter={() => onHighlight?.(k)}
            className={cn("flex items-center gap-2 rounded-lg transition-colors", !compact && "px-1.5 py-1", highlight === k && "bg-indigo-50 dark:bg-indigo-400/10")}
          >
            <span className={cn("shrink-0 font-mono uppercase tracking-wider text-slate-400", compact ? "w-7 text-[8px]" : "w-24 text-[10px]")}>
              {compact ? STAT_LABEL[k].slice(0, 3) : STAT_LABEL[k]}
            </span>
            <span className={cn("relative flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]", compact ? "h-1" : "h-1.5")}>
              <motion.span
                className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", statColor(v))}
                initial={{ width: 0 }}
                animate={{ width: `${v}%` }}
                transition={{ duration: 0.7, delay: i * 0.05, ease: "easeOut" }}
              />
            </span>
            {!compact && <span className="w-7 shrink-0 text-right font-mono text-[11px] tabular-nums text-slate-700 dark:text-slate-200">{v}</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Portrait                                                           */
/* ------------------------------------------------------------------ */
export function Portrait({ hero, size = "md", className = "" }: { hero: Hero; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  const [ok, setOk] = useState(true);
  return (
    <div className={cn("relative overflow-hidden bg-slate-100 dark:bg-white/[0.04]", className)}>
      {ok ? (
        <img src={hero.images[size]} alt={hero.name} loading="lazy" decoding="async" onError={() => setOk(false)} className="h-full w-full object-cover object-top" />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-mono text-xl font-semibold text-slate-300">{hero.name.slice(0, 2).toUpperCase()}</div>
      )}
    </div>
  );
}

export function AlignmentChip({ hero }: { hero: Hero }) {
  const a = ALIGNMENT[alignmentOf(hero)];
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ring-1", a.chip)}>{a.label}</span>;
}

/* ------------------------------------------------------------------ */
/*  HeroCard                                                           */
/* ------------------------------------------------------------------ */
export const HeroCard = memo(function HeroCard({ hero, rank, onSelect }: { hero: Hero; rank?: number; onSelect: (h: Hero) => void }) {
  const a = ALIGNMENT[alignmentOf(hero)];
  return (
    <button
      type="button"
      onClick={() => onSelect(hero)}
      className="group relative isolate block aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-900 text-left ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-16px_var(--glow)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:ring-white/[0.08]"
      style={{ ["--glow" as string]: a.hex }}
    >
      <Portrait hero={hero} className="absolute inset-0 -z-10 transition-transform duration-500 group-hover:scale-105" />
      {/* scrims */}
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
      <span aria-hidden className="absolute inset-x-0 top-0 h-px opacity-0 transition-opacity group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${a.hex}, transparent)` }} />

      <div className="flex items-start justify-between p-2.5">
        {rank != null ? (
          <span className="rounded-md bg-black/50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white/80 backdrop-blur">#{rank}</span>
        ) : (
          <span />
        )}
        <span className="rounded-md bg-black/50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white backdrop-blur" title="Total power (of 600)">
          {hero.total}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.hex, boxShadow: `0 0 8px ${a.hex}` }} />
          <span className="font-mono text-[9px] uppercase tracking-wider text-white/60">{a.label}</span>
        </div>
        <h3 className="mt-1 truncate text-sm font-semibold text-white">{hero.name}</h3>
        {clean(hero.biography.fullName) && clean(hero.biography.fullName) !== hero.name && (
          <p className="truncate text-[11px] text-white/55">{hero.biography.fullName}</p>
        )}
        {/* mini stats reveal on hover */}
        <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr]">
          <div className="overflow-hidden">
            <div className="flex items-end gap-1 pt-2.5" aria-hidden>
              {STATS.map((k) => (
                <span key={k} className="flex flex-1 flex-col items-center gap-1">
                  <span className="relative h-8 w-full overflow-hidden rounded-sm bg-white/10">
                    <span className="absolute inset-x-0 bottom-0 rounded-sm" style={{ height: `${hero.powerstats[k]}%`, background: a.hex }} />
                  </span>
                  <span className="font-mono text-[7px] uppercase text-white/50">{STAT_LABEL[k].slice(0, 3)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
});

/* ------------------------------------------------------------------ */
/*  HeroModal                                                          */
/* ------------------------------------------------------------------ */
function PowerPanel({ hero }: { hero: Hero }) {
  const [hl, setHl] = useState<StatKey | null>(null);
  const shape = readShape(hero);
  return (
    <div className="mt-5 rounded-2xl border border-slate-200/70 p-4 dark:border-white/[0.08]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Power profile</p>
        <p className="font-mono text-[11px] text-slate-400">
          Total <span className="font-semibold text-slate-900 dark:text-white">{hero.total}</span>/600
        </p>
      </div>
      <div className="mt-3 grid items-center gap-4 sm:grid-cols-[1fr_220px]">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{shape.title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{shape.detail}</p>
          <div className="mt-3">
            <StatBars hero={hero} highlight={hl} onHighlight={setHl} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-[240px]">
          <Radar heroes={[hero]} size={260} highlight={hl} onHighlight={setHl} />
        </div>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
        <RadarHowTo />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Gallery                                                            */
/* ------------------------------------------------------------------ */
function useGallery(hero: Hero | null) {
  const [state, setState] = useState<{ id: number | null; loading: boolean; gallery: Gallery | null; error: boolean }>({
    id: null,
    loading: false,
    gallery: null,
    error: false,
  });
  useEffect(() => {
    if (!hero) return;
    let alive = true;
    setState({ id: hero.id, loading: true, gallery: null, error: false });
    loadGallery(hero)
      .then((g) => alive && setState({ id: hero.id, loading: false, gallery: g, error: false }))
      .catch(() => alive && setState({ id: hero.id, loading: false, gallery: null, error: true }));
    return () => {
      alive = false;
    };
  }, [hero]);
  return state;
}

/** Whole image, never cropped: contained artwork over a blurred fill of itself. */
function FullPortrait({ hero, count, onOpen }: { hero: Hero; count: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View ${hero.name} full size`}
      className="group relative block aspect-[3/4] w-full overflow-hidden bg-slate-900 sm:aspect-auto sm:h-full sm:min-h-[460px]"
    >
      <img src={hero.images.lg} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
      <img src={hero.images.lg} alt={hero.name} className="relative h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]" />
      <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white backdrop-blur transition group-hover:bg-black/75">
        <Maximize2 className="h-3 w-3" />
        {count > 1 ? `${count} images` : "Full size"}
      </span>
    </button>
  );
}

const GRID_MAX = 15;

function GallerySection({
  loading,
  error,
  gallery,
  onOpen,
}: {
  loading: boolean;
  error: boolean;
  gallery: Gallery | null;
  onOpen: (i: number) => void;
}) {
  const imgs = gallery?.images ?? [];
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
          <Images className="h-3 w-3" />
          Gallery{imgs.length ? ` · ${imgs.length}` : ""}
        </p>
        {gallery?.pageUrl && (
          <a href={gallery.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-slate-400 transition hover:text-indigo-600 dark:hover:text-indigo-300">
            Marvel Database <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>

      {loading ? (
        <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-slate-100 dark:bg-white/[0.05]" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      ) : error ? (
        <p className="mt-2 text-[12px] text-slate-400">Couldn&apos;t reach the Marvel Database right now.</p>
      ) : imgs.length === 0 ? (
        <p className="mt-2 text-[12px] text-slate-400">No extra artwork found for this character.</p>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
          {imgs.slice(0, GRID_MAX).map((im, i) => (
            <button
              key={im.id}
              type="button"
              onClick={() => onOpen(i + 1)}
              title={im.caption}
              aria-label={`Open ${im.caption}`}
              className="group relative aspect-[3/4] overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-white/[0.05] dark:ring-white/[0.08]"
            >
              <img src={im.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </button>
          ))}
          {imgs.length > GRID_MAX && (
            <button
              type="button"
              onClick={() => onOpen(GRID_MAX + 1)}
              className="flex aspect-[3/4] flex-col items-center justify-center rounded-lg bg-slate-900 font-mono text-white transition hover:bg-indigo-600 dark:bg-white/10"
            >
              <span className="text-base font-semibold">+{imgs.length - GRID_MAX}</span>
              <span className="text-[9px] uppercase tracking-wider text-white/60">more</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type HeroTab = "overview" | "bio" | "powers" | "family" | "gallery";

export function HeroModal({ hero, open, onClose, onCompare }: { hero: Hero | null; open: boolean; onClose: () => void; onCompare: (h: Hero) => void }) {
  const a = hero ? ALIGNMENT[alignmentOf(hero)] : ALIGNMENT.neutral;
  const active = open ? hero : null;

  const { loading: galLoading, gallery, error: galError } = useGallery(active);
  const { loading: bioLoading, bio, error: bioError } = useBio(active);
  const [viewer, setViewer] = useState<number | null>(null);
  const [tab, setTab] = useState<HeroTab>("overview");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setViewer(null);
    setTab("overview");
  }, [hero?.id, open]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  const viewerImages: LightboxImage[] = hero
    ? [
        { src: hero.images.lg, thumb: hero.images.sm, alt: hero.name, caption: `${hero.name} · portrait` },
        ...(gallery?.images ?? []).map((im) => ({ src: im.full, thumb: im.thumb, alt: im.caption, caption: im.caption, href: im.source })),
      ]
    : [];

  const powerCount = bio?.powers.reduce((n, s) => n + s.items.length, 0) ?? 0;
  const TABS: { key: HeroTab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "bio", label: "Bio", count: bio?.history.length || undefined },
    { key: "powers", label: "Powers", count: powerCount || undefined },
    { key: "family", label: "Family" },
    { key: "gallery", label: "Gallery", count: gallery?.images.length || undefined },
  ];

  const same = (x: string, y: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "") === y.toLowerCase().replace(/[^a-z0-9]/g, "");
  const subtitle = hero
    ? [bio?.realName || clean(hero.biography.fullName), bio?.currentAlias && !same(bio.currentAlias, hero.name) ? `now ${bio.currentAlias}` : ""]
        .filter((v) => v && !same(v, hero.name) && v !== "Inapplicable")
        .join(" · ")
    : "";

  return (
    <Modal open={open} onClose={onClose} labelledBy="hero-modal-title" size="lg" accent={a.hex}>
      {hero && (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="grid sm:grid-cols-[minmax(0,240px)_1fr]">
            {/* portrait column — pinned while the file scrolls */}
            <div className="relative sm:sticky sm:top-0 sm:h-[min(92dvh,760px)] sm:self-start">
              <FullPortrait hero={hero} count={viewerImages.length} onOpen={() => setViewer(0)} />
              <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-1.5 sm:hidden">
                <AlignmentChip hero={hero} />
              </div>
            </div>

            {/* details column */}
            <div className="relative isolate min-w-0">
              <div aria-hidden className="pointer-events-none absolute -top-16 right-0 -z-10 h-48 w-64 rounded-full opacity-20 blur-3xl" style={{ background: a.hex }} />

              <div className="px-5 pt-5 sm:px-7 sm:pt-7">
                <div className="flex flex-wrap items-center gap-2 pr-8">
                  <span className="hidden sm:inline-flex">
                    <AlignmentChip hero={hero} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">#{hero.id}</span>
                  {bio?.pageUrl && <WikiLink href={bio.pageUrl}>Wiki file</WikiLink>}
                </div>
                <h3 id="hero-modal-title" className="mt-2 font-aspekta text-2xl font-[650] tracking-tight text-slate-900 dark:text-white">
                  {hero.name}
                </h3>
                {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
              </div>

              {/* section tabs */}
              <div className="sticky top-0 z-10 mt-4 border-b border-slate-100 bg-white/90 px-5 backdrop-blur-xl dark:border-white/[0.06] dark:bg-[#1a1a1d]/90 sm:px-7">
                <div role="tablist" aria-label="Character file sections" className="-mb-px flex gap-4 overflow-x-auto no-scrollbar">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.key}
                      onClick={() => setTab(t.key)}
                      className={cn(
                        "relative shrink-0 py-2.5 text-[13px] font-medium transition-colors",
                        tab === t.key ? "text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      )}
                    >
                      {t.label}
                      {t.count ? <span className="ml-1 font-mono text-[10px] text-slate-400">{t.count}</span> : null}
                      {tab === t.key && <motion.span layoutId="heroTabLine" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full" style={{ background: a.hex }} />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-5 pb-7 pt-5 sm:px-7">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
                    {tab === "overview" && (
                      <>
                        {bioLoading ? (
                          <BioSkeleton lines={4} />
                        ) : bio?.overview ? (
                          <ReadMore text={bio.overview} limit={520} />
                        ) : null}
                        {bio && <QuoteCard bio={bio} accent={a.hex} />}
                        <PowerPanel hero={hero} />
                        <div className="mt-5">
                          <Label>Profile</Label>
                          <FactsGrid hero={hero} bio={bio} />
                        </div>
                        <button
                          type="button"
                          onClick={() => onCompare(hero)}
                          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-indigo-600 dark:bg-white dark:text-slate-900 dark:hover:bg-indigo-300"
                        >
                          <GitCompareArrows className="h-3.5 w-3.5" />
                          Compare {hero.name.split(" ")[0]} with…
                        </button>
                      </>
                    )}
                    {tab === "bio" && <BioTab bio={bio} loading={bioLoading} error={bioError} />}
                    {tab === "powers" && <PowersTab bio={bio} loading={bioLoading} error={bioError} />}
                    {tab === "family" && <FamilyTab hero={hero} bio={bio} loading={bioLoading} />}
                    {tab === "gallery" && <GallerySection loading={galLoading} error={galError} gallery={gallery} onOpen={setViewer} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      )}
      <Lightbox
        images={viewerImages}
        index={viewer ?? 0}
        open={viewer !== null && viewerImages.length > 0}
        onClose={() => setViewer(null)}
        onIndexChange={setViewer}
        referrerPolicy="no-referrer"
      />
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  HeroPicker — searchable select                                     */
/* ------------------------------------------------------------------ */
export function HeroPicker({
  roster,
  value,
  onChange,
  accent,
  label,
}: {
  roster: Hero[];
  value: Hero | null;
  onChange: (h: Hero) => void;
  accent: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? roster.filter((h) => `${h.name} ${h.biography.fullName}`.toLowerCase().includes(s)) : roster;
    return list.slice(0, 40);
  }, [q, roster]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    setTimeout(() => input.current?.focus(), 0);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  const pick = (h: Hero) => {
    onChange(h);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={wrap} className="relative">
      <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
        {label}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-2 text-left transition hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
      >
        {value ? <Portrait hero={value} size="xs" className="h-11 w-11 shrink-0 rounded-xl" /> : <span className="h-11 w-11 shrink-0 rounded-xl bg-slate-100 dark:bg-white/[0.06]" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{value?.name ?? "Pick a character"}</span>
          <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">{value ? `Power ${value.total}` : "—"}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute inset-x-0 z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 shadow-[0_24px_60px_-18px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-[#1f1f23]/95">
          <label className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-white/[0.06]">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, matches.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
                if (e.key === "Enter" && matches[idx]) { e.preventDefault(); pick(matches[idx]); }
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Search characters"
              aria-label="Search characters"
              className="w-full border-0 bg-transparent p-0 text-[13px] text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:ring-0 dark:text-white"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label="Clear" className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <ul role="listbox" className="max-h-72 overflow-auto p-1">
            {matches.map((h, i) => (
              <li
                key={h.id}
                role="option"
                aria-selected={i === idx}
                onMouseEnter={() => setIdx(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(h);
                }}
                className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5", i === idx && "bg-slate-100 dark:bg-white/[0.06]")}
              >
                <Portrait hero={h} size="xs" className="h-8 w-8 shrink-0 rounded-lg" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-slate-800 dark:text-slate-200">{h.name}</span>
                <span className="font-mono text-[10px] tabular-nums text-slate-400">{h.total}</span>
              </li>
            ))}
            {matches.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-400">No match</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

