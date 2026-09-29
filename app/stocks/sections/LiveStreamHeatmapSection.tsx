/* eslint-disable @next/next/no-img-element */
"use client";
/**
 * LiveStreamHeatmapSection.tsx — Exchange Heatmap with live price tiles.
 *
 * All REST fetching (quotes, profiles, logos) is delegated to the shared
 * marketStore via useMarketData. The component only owns:
 *   - Local market-clock state (no API calls — pure JS)
 *   - Tick-direction state derived from incoming tickerMap updates
 *   - View state (filter, sort, tiles/table)
 *
 * WebSocket is managed by the store (single shared connection).
 */

import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LayoutGrid, Radio, Search, Table2, WifiOff, X } from "lucide-react";

import { Segmented } from "@/components/ui/segmented";
import { HEAT_LEGEND, HEAT_SCALES, heatTone, tickGlow } from "@/utils/heat";
import { useMarketData } from "../hooks/useMarketData";
import { useQuoteModal } from "../hooks/useQuoteModal";
import { HEATMAP_SYMBOLS } from "../lib/tickers";
import type { TickerData } from "../lib/types";

/* ─── Types / constants ────────────────────────────────────────────── */
type MarketState = "open" | "premarket" | "afterhours" | "closed";
type Dir = "up" | "down" | "flat";
type SortKey = "default" | "change" | "symbol";

const SESSION: Record<MarketState, { label: string; pill: string }> = {
  open:       { label: "Market open",  pill: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20" },
  premarket:  { label: "Pre-market",   pill: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20" },
  afterhours: { label: "After hours",  pill: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20" },
  closed:     { label: "Market closed", pill: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/[0.05] dark:text-slate-400 dark:ring-white/10" },
};

/* ─── Helpers ──────────────────────────────────────────────────────── */
const usd = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) && n > 0
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";

const pctText = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? `${n > 0 ? "+" : ""}${n.toFixed(2)}%` : "—";

const calcMarketState = (): MarketState => {
  const now = new Date();
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = est.getDay();
  const mins = est.getHours() * 60 + est.getMinutes();
  if (day === 0 || day === 6) return "closed";
  if (mins >= 570 && mins < 960) return "open";
  if (mins >= 240 && mins < 570) return "premarket";
  if (mins >= 960 && mins < 1200) return "afterhours";
  return "closed";
};

/** First three names get 2×2 tiles, the next four 2×1 — a treemap feel on a plain grid. */
const tileSpan = (i: number) => (i < 3 ? "col-span-2 row-span-2" : i < 7 ? "col-span-2" : "");

/* ─── Tile ─────────────────────────────────────────────────────────── */
const HeatTile = memo(function HeatTile({
  sym,
  td,
  dir,
  bump,
  span,
  size,
  onSelect,
}: {
  sym: string;
  td?: TickerData;
  dir: Dir;
  bump: number;
  span: string;
  size: "lg" | "md" | "sm";
  onSelect: (s: string) => void;
}) {
  const dp = td?.quote?.dp ?? 0;
  const logo = td?.logo || td?.profile?.logo || "";
  const name = td?.profile?.name ?? "";
  const logoBox = size === "lg" ? "h-16 w-16 sm:h-20 sm:w-20" : size === "md" ? "h-11 w-11" : "h-9 w-9";
  const logoImg = size === "lg" ? "h-10 w-10 sm:h-12 sm:w-12" : size === "md" ? "h-7 w-7" : "h-6 w-6";

  return (
    <button
      type="button"
      onClick={() => onSelect(sym)}
      title={`${name || sym} · ${pctText(dp)} today`}
      className={[
        "group relative isolate flex flex-col overflow-hidden rounded-xl p-2.5 text-left ring-1 ring-inset",
        "transition-[transform,filter] duration-200 ease-out hover:z-10 hover:-translate-y-0.5 hover:brightness-[1.04] active:scale-[0.98]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        span,
        heatTone(td ? dp : null, HEAT_SCALES.stocks),
        size === "lg" ? "sm:p-4" : "",
      ].join(" ")}
    >
      {/* tick glow */}
      {bump > 0 && dir !== "flat" && (
        <motion.span
          key={bump}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={{ boxShadow: tickGlow(dir) }}
        />
      )}
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white/30 via-transparent to-transparent dark:from-white/[0.06]" />

      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className={`font-mono font-semibold tracking-tight ${size === "lg" ? "text-base sm:text-xl" : "text-[12px]"}`}>{sym}</div>
          {size !== "sm" && name && <div className="truncate text-[10px] opacity-70 sm:text-[11px]">{name}</div>}
        </div>
        {dir !== "flat" && bump > 0 && (
          <span aria-hidden className="font-mono text-[9px] opacity-70">{dir === "up" ? "▲" : "▼"}</span>
        )}
      </div>

      {/* logo */}
      <div className="flex flex-1 items-center justify-center py-1">
        <span className={`flex items-center justify-center rounded-2xl bg-white shadow-[0_4px_14px_-4px_rgba(15,23,42,0.25)] ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-105 ${logoBox}`}>
          {logo ? (
            <img src={logo} alt="" loading="lazy" className={`object-contain ${logoImg}`} onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
          ) : (
            <span className="font-mono text-[10px] font-semibold text-slate-400">{sym.slice(0, 3)}</span>
          )}
        </span>
      </div>

      <div className="flex items-end justify-between gap-1.5 font-mono tabular-nums">
        <span className={`truncate font-semibold ${size === "lg" ? "text-sm sm:text-lg" : "text-[11px]"}`}>{usd(td?.quote?.c)}</span>
        <span className={`shrink-0 opacity-80 ${size === "lg" ? "text-xs sm:text-sm" : "text-[10px]"}`}>{td ? pctText(dp) : ""}</span>
      </div>
    </button>
  );
});

/* ─── Component ────────────────────────────────────────────────────── */
const LiveStreamHeatmapSection: React.FC = () => {
  const { tickerMap, wsConnected } = useMarketData(HEATMAP_SYMBOLS, "medium");
  const { openQuote, quoteModal } = useQuoteModal();

  // Tick direction per symbol (vs previous observed price)
  const [ticks, setTicks] = useState<Record<string, { dir: Dir; bump: number }>>({});
  const [tickCount, setTickCount] = useState(0);
  const prevPricesRef = useRef<Record<string, number>>({});

  useEffect(() => {
    let changed = 0;
    setTicks((prev) => {
      const next = { ...prev };
      for (const sym of HEATMAP_SYMBOLS) {
        const price = tickerMap[sym]?.quote?.c;
        if (typeof price !== "number" || price <= 0) continue;
        const last = prevPricesRef.current[sym];
        prevPricesRef.current[sym] = price;
        if (last == null || last === price) continue;
        changed++;
        next[sym] = { dir: price > last ? "up" : "down", bump: (prev[sym]?.bump ?? 0) + 1 };
      }
      return changed ? next : prev;
    });
    if (changed) setTickCount((c) => c + changed);
  }, [tickerMap]);

  // Market clock — pure JS, no API calls
  const [marketState, setMarketState] = useState<MarketState>("closed");
  useEffect(() => {
    const tick = () => setMarketState(calcMarketState());
    tick();
    const int = window.setInterval(tick, 60_000);
    return () => window.clearInterval(int);
  }, []);

  // View state
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("default");
  const [view, setView] = useState<"tiles" | "table">("tiles");

  const loaded = useMemo(() => HEATMAP_SYMBOLS.filter((s) => tickerMap[s]), [tickerMap]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list: string[] = [...HEATMAP_SYMBOLS];
    if (q) list = list.filter((s) => s.toLowerCase().includes(q) || (tickerMap[s]?.profile?.name ?? "").toLowerCase().includes(q));
    if (sort === "change") list.sort((a, b) => (tickerMap[b]?.quote?.dp ?? -999) - (tickerMap[a]?.quote?.dp ?? -999));
    if (sort === "symbol") list.sort((a, b) => a.localeCompare(b));
    return list;
  }, [query, sort, tickerMap]);

  const breadth = useMemo(() => {
    let up = 0, down = 0, sum = 0;
    let best: string | null = null, worst: string | null = null;
    for (const s of loaded) {
      const dp = tickerMap[s]?.quote?.dp ?? 0;
      if (dp > 0) up++;
      else if (dp < 0) down++;
      sum += dp;
      if (!best || dp > (tickerMap[best]?.quote?.dp ?? 0)) best = s;
      if (!worst || dp < (tickerMap[worst]?.quote?.dp ?? 0)) worst = s;
    }
    return { up, down, avg: loaded.length ? sum / loaded.length : 0, best, worst, n: loaded.length };
  }, [loaded, tickerMap]);

  const session = SESSION[marketState];
  const treemap = sort === "default" && !query;
  const upShare = breadth.n ? (breadth.up / breadth.n) * 100 : 50;

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="p-3 sm:p-5">
      {/* ── Readout ─────────────────────────────────────────────────── */}
      <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-200/70 dark:border-white/[0.08] dark:bg-white/[0.06] sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="bg-white p-4 dark:bg-[#1f1f23]">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-slate-400">
            <span>Breadth · {breadth.n} names</span>
            <span className="tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">{breadth.up}▲</span>{" "}
              <span className="text-rose-500 dark:text-rose-400">{breadth.down}▼</span>
            </span>
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-rose-400/80 dark:bg-rose-500/60">
            <motion.div
              className="h-full rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
              initial={{ width: 0 }}
              animate={{ width: `${upShare}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{Math.round(upShare)}% of tracked names are up today</div>
        </div>
        <Readout label="Avg change" value={pctText(breadth.avg)} tone={breadth.avg >= 0 ? "up" : "down"} />
        <Readout
          label="Leader"
          value={breadth.best ? `${breadth.best} ${pctText(tickerMap[breadth.best]?.quote?.dp)}` : "—"}
          tone="up"
          onClick={breadth.best ? () => openQuote(breadth.best!) : undefined}
        />
        <Readout
          label="Laggard"
          value={breadth.worst ? `${breadth.worst} ${pctText(tickerMap[breadth.worst]?.quote?.dp)}` : "—"}
          tone="down"
          onClick={breadth.worst ? () => openQuote(breadth.worst!) : undefined}
        />
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider ring-1 ${session.pill}`}>
          <span className="relative flex h-1.5 w-1.5">
            {marketState === "open" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
          </span>
          {session.label}
        </span>
        <span className="inline-flex items-center gap-1.5 px-1 font-mono text-[11px] text-slate-400" title="Shared WebSocket">
          {wsConnected ? <Radio className="h-3 w-3 text-emerald-500" /> : <WifiOff className="h-3 w-3" />}
          {wsConnected ? `${tickCount} ticks` : marketState === "closed" ? "stream paused" : "reconnecting"}
        </span>

        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="relative flex-1 sm:w-48 sm:flex-none">
            <span className="sr-only">Filter symbols</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter"
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-8 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear filter" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>

          <Segmented
            id="stocksSort"
            value={sort}
            onChange={setSort}
            options={[
              { key: "default", label: "Map" },
              { key: "change", label: "% chg" },
              { key: "symbol", label: "A–Z" },
            ]}
          />
          <Segmented
            id="stocksView"
            value={view}
            onChange={setView}
            options={[
              { key: "tiles", label: <LayoutGrid className="h-3.5 w-3.5" />, title: "Tiles" },
              { key: "table", label: <Table2 className="h-3.5 w-3.5" />, title: "Table" },
            ]}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="mb-3 mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-slate-400">
        <span className="tabular-nums">{query ? `${shown.length} match${shown.length === 1 ? "" : "es"}` : `${loaded.length} / ${HEATMAP_SYMBOLS.length} loaded`}</span>
        <span className="flex items-center gap-1.5">
          <span className="hidden sm:inline">Today · ±2.5%</span>
          <span className="flex overflow-hidden rounded-sm">
            {HEAT_LEGEND.map((cls, i) => (
              <span key={i} className={`h-2.5 w-4 ${cls}`} />
            ))}
          </span>
        </span>
      </div>

      {/* ── Views ───────────────────────────────────────────────────── */}
      {view === "tiles" ? (
        <div className="grid auto-rows-[112px] grid-flow-dense grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {shown.map((sym, i) => {
            const span = treemap ? tileSpan(i) : "";
            const size = treemap && i < 3 ? "lg" : treemap && i < 7 ? "md" : "sm";
            return (
              <HeatTile
                key={sym}
                sym={sym}
                td={tickerMap[sym]}
                dir={ticks[sym]?.dir ?? "flat"}
                bump={ticks[sym]?.bump ?? 0}
                span={span}
                size={size}
                onSelect={openQuote}
              />
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white dark:border-white/[0.08] dark:bg-white/[0.02]">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-slate-100 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:border-white/[0.06]">
                <th className="py-2.5 pl-4 pr-2 text-left font-normal">Company</th>
                <th className="px-2 py-2.5 text-right font-normal">Price</th>
                <th className="px-2 py-2.5 text-right font-normal">Change</th>
                <th className="hidden px-2 py-2.5 text-right font-normal sm:table-cell">Day range</th>
                <th className="py-2.5 pl-2 pr-4 text-right font-normal">Today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {shown.map((sym) => {
                const td = tickerMap[sym];
                const dp = td?.quote?.dp ?? 0;
                const t = ticks[sym];
                const logo = td?.logo || td?.profile?.logo || "";
                return (
                  <tr key={sym} onClick={() => openQuote(sym)} className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                    <td className="py-2.5 pl-4 pr-2">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 dark:ring-white/10">
                          {logo ? <img src={logo} alt="" className="h-5 w-5 object-contain" loading="lazy" /> : <span className="font-mono text-[9px] text-slate-400">{sym.slice(0, 2)}</span>}
                        </span>
                        <div className="min-w-0 leading-tight">
                          <div className="font-mono text-[13px] font-semibold text-slate-900 dark:text-white">{sym}</div>
                          <div className="max-w-[180px] truncate text-[11px] text-slate-400 dark:text-slate-500">{td?.profile?.name ?? "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="relative px-2 py-2.5 text-right font-mono text-[13px] tabular-nums text-slate-900 dark:text-white">
                      {t?.bump ? (
                        <motion.span key={t.bump} aria-hidden className="pointer-events-none absolute inset-1 rounded-md" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.9 }} style={{ boxShadow: t.dir === "flat" ? undefined : tickGlow(t.dir) }} />
                      ) : null}
                      {usd(td?.quote?.c)}
                    </td>
                    <td className={`px-2 py-2.5 text-right font-mono text-[12px] tabular-nums ${dp >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}`}>
                      {td ? `${(td.quote.d ?? 0) >= 0 ? "+" : ""}${(td.quote.d ?? 0).toFixed(2)}` : "—"}
                    </td>
                    <td className="hidden px-2 py-2.5 text-right font-mono text-[11px] tabular-nums text-slate-400 sm:table-cell">
                      {td ? `${usd(td.quote.l)} – ${usd(td.quote.h)}` : "—"}
                    </td>
                    <td className="py-2.5 pl-2 pr-4 text-right">
                      <span className={`inline-block min-w-[4.5rem] rounded-md px-1.5 py-0.5 text-center font-mono text-[11px] tabular-nums ring-1 ring-inset ${heatTone(td ? dp : null, HEAT_SCALES.stocks)}`}>
                        {td ? pctText(dp) : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {shown.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          No symbols match &ldquo;{query}&rdquo;.
        </div>
      )}

      <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-wider text-slate-400">
        Live ticks while markets are open · off-hours shows last price &amp; daily change
      </p>

      {quoteModal}
    </div>
  );
};

export default LiveStreamHeatmapSection;

/* ─── Small pieces ─────────────────────────────────────────────────── */
function Readout({ label, value, tone, onClick }: { label: string; value: string; tone: "up" | "down"; onClick?: () => void }) {
  const color = tone === "up" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`bg-white p-4 text-left dark:bg-[#1f1f23] ${onClick ? "transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]" : ""}`}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-2 truncate font-mono text-base font-semibold tabular-nums ${color}`}>{value}</div>
    </Tag>
  );
}
