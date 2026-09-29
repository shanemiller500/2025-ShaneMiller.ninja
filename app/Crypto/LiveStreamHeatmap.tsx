"use client";

import { fetchCoinCap, subscribeCoinCap } from "@/utils/coincap-client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, Radio, RotateCw, Search, Table2, X, Zap } from "lucide-react";

import CryptoAssetPopup from "@/app/Crypto/CryptoAssetPopup";
import { HEAT_LEGEND, heatTone, parsePct } from "@/utils/heat";
import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface TradeInfo {
  price: number;
  direction: "up" | "down" | "neutral";
  bump: number;
}

interface CoinMeta {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  priceUsd: string;
  changePercent24Hr: string;
  marketCapUsd?: string;
  volumeUsd24Hr?: string;
}

type StreamStatus = "connecting" | "live" | "error";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COINGECKO_TOP200 =
  "/api/CoinGeckoAPI?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false";

const PAGE_SIZE = 78;
const SESSION_TIMEOUT_MS = 300_000; // 5 minutes - this is for the entire session

/* Formatters (created once) */
const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const smallFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumSignificantDigits: 4,
});
const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const formatUsd = (v: number | string | undefined): string => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!Number.isFinite(n)) return "—";
  return Math.abs(n) < 1 ? smallFmt.format(n) : currencyFmt.format(n);
};

const formatPct = (v: string | number | null | undefined): string => {
  if (v == null) return "—";
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? `${n > 0 ? "+" : ""}${n.toFixed(2)}%` : "—";
};

const formatCompact = (v: string | number | undefined): string => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? `$${compactFmt.format(n)}` : "—";
};

/** Bigger tiles for the biggest coins — a treemap feel on a plain grid. */
const tileSpan = (rank: number) =>
  rank <= 2 ? "col-span-2 row-span-2" : rank <= 6 ? "col-span-2" : "";

/* ------------------------------------------------------------------ */
/*  CoinImage Component                                                */
/* ------------------------------------------------------------------ */
interface CoinImageProps {
  src?: string;
  alt?: string;
  className?: string;
}

const CoinImage = memo(function CoinImage({ src, alt, className }: CoinImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!src || error) {
    return <div className={`${className} rounded-full bg-black/10 dark:bg-white/20`} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.15s" }}
    />
  );
});

/* ------------------------------------------------------------------ */
/*  Tick flash — a glowing inset ring on every live price update       */
/* ------------------------------------------------------------------ */
function TickFlash({ bump, direction, className = "" }: { bump: number; direction: TradeInfo["direction"]; className?: string }) {
  if (!bump || direction === "neutral") return null;
  const glow =
    direction === "up"
      ? "inset 0 0 0 2px rgba(16,185,129,0.95), 0 0 22px rgba(16,185,129,0.55)"
      : "inset 0 0 0 2px rgba(244,63,94,0.95), 0 0 22px rgba(244,63,94,0.55)";
  return (
    <motion.span
      key={bump}
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${className}`}
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
      style={{ boxShadow: glow }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  HeatTile Component                                                 */
/* ------------------------------------------------------------------ */
interface TileProps {
  id: string;
  meta: CoinMeta;
  tradeInfo?: TradeInfo;
  logo?: string;
  onSelect: (meta: CoinMeta) => void;
}

const HeatTile = memo(function HeatTile({ id, meta, tradeInfo, logo, onSelect }: TileProps) {
  const pct = parseFloat(String(meta.changePercent24Hr ?? ""));
  const rank = Number(meta.rank) || 999;
  const big = rank <= 2;
  const wide = rank <= 6;
  const direction = tradeInfo?.direction ?? "neutral";

  return (
    <button
      type="button"
      onClick={() => onSelect(meta)}
      title={`${meta.name ?? id} · ${formatPct(pct)} 24h`}
      className={[
        "group relative isolate flex flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left ring-1 ring-inset",
        "transition-[transform,filter] duration-200 ease-out hover:z-10 hover:-translate-y-0.5 hover:brightness-[1.04] active:scale-[0.98]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        tileSpan(rank),
        heatTone(pct),
        big ? "sm:p-4" : "",
      ].join(" ")}
    >
      <TickFlash bump={tradeInfo?.bump ?? 0} direction={direction} className="rounded-xl" />
      {/* sheen */}
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white/25 via-transparent to-transparent dark:from-white/[0.06]" />

      <div className="flex items-start justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`shrink-0 rounded-full bg-white/90 p-0.5 shadow-sm ${big ? "sm:p-1" : ""}`}>
            <CoinImage src={logo} alt="" className={big ? "h-4 w-4 sm:h-7 sm:w-7" : "h-4 w-4"} />
          </span>
          <span className={`truncate font-semibold ${big ? "text-sm sm:text-lg" : "text-[12px]"}`}>
            {meta.symbol || id}
          </span>
        </div>
        <span className="shrink-0 font-mono text-[9px] tabular-nums opacity-60">#{meta.rank || "—"}</span>
      </div>

      {big && <div className="hidden truncate text-xs opacity-70 sm:block">{meta.name}</div>}

      <div className={wide ? "flex items-end justify-between gap-2" : ""}>
        <div className={`flex items-center gap-1 font-mono font-semibold tabular-nums tracking-tight ${big ? "text-base sm:text-2xl" : wide ? "text-[15px]" : "text-[12px]"}`}>
          <span className="truncate">{formatUsd(tradeInfo?.price ?? meta.priceUsd)}</span>
          {direction !== "neutral" && (
            <span aria-hidden className="text-[9px] opacity-70">{direction === "up" ? "▲" : "▼"}</span>
          )}
        </div>
        <div className={`font-mono tabular-nums opacity-80 ${big ? "text-xs sm:text-sm" : "text-[10px]"}`}>
          {formatPct(pct)}
        </div>
      </div>
    </button>
  );
});

/* ------------------------------------------------------------------ */
/*  TableRow Component                                                 */
/* ------------------------------------------------------------------ */
const TableRow = memo(function TableRow({ id, meta, tradeInfo, logo, onSelect }: TileProps) {
  const pct = parseFloat(String(meta.changePercent24Hr ?? ""));
  const direction = tradeInfo?.direction ?? "neutral";

  return (
    <tr
      onClick={() => onSelect(meta)}
      className="group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]"
    >
      <td className="py-2.5 pl-4 pr-2 font-mono text-[11px] tabular-nums text-slate-400">{meta.rank ?? "—"}</td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="rounded-full bg-white p-0.5 ring-1 ring-slate-200 dark:ring-white/10">
            <CoinImage src={logo} alt="" className="h-5 w-5" />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="text-[13px] font-semibold text-slate-900 dark:text-white">{meta.symbol ?? id}</div>
            <div className="truncate text-[11px] text-slate-400 dark:text-slate-500">{meta.name ?? "—"}</div>
          </div>
        </div>
      </td>
      <td className="relative px-2 py-2.5 text-right font-mono text-[13px] tabular-nums text-slate-900 dark:text-white">
        <TickFlash bump={tradeInfo?.bump ?? 0} direction={direction} className="rounded-md" />
        {formatUsd(tradeInfo?.price ?? meta.priceUsd)}
      </td>
      <td className="px-2 py-2.5 text-right">
        <span className={`inline-block min-w-[4.5rem] rounded-md px-1.5 py-0.5 text-center font-mono text-[11px] tabular-nums ring-1 ring-inset ${heatTone(pct)}`}>
          {formatPct(pct)}
        </span>
      </td>
      <td className="hidden px-2 py-2.5 text-right font-mono text-[12px] tabular-nums text-slate-500 dark:text-slate-400 sm:table-cell">
        {formatCompact(meta.marketCapUsd)}
      </td>
      <td className="hidden py-2.5 pl-2 pr-4 text-right font-mono text-[12px] tabular-nums text-slate-500 dark:text-slate-400 md:table-cell">
        {formatCompact(meta.volumeUsd24Hr)}
      </td>
    </tr>
  );
});

/* ------------------------------------------------------------------ */
/*  WebSocket Hook                                                     */
/* ------------------------------------------------------------------ */
function usePriceStream(
  assetIds: string[],
  enabled: boolean,
  onPriceUpdate: (updates: Record<string, number>) => void
) {
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [sessionEnded, setSessionEnded] = useState(false);
  const [session, setSession] = useState(0);
  const restart = useCallback(() => {
    setSessionEnded(false);
    setSession((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !assetIds.length || sessionEnded) return;
    const stop = subscribeCoinCap(assetIds, (data) => {
      const updates: Record<string, number> = {};
      for (const [id, value] of Object.entries(data)) {
        const price = Number(value);
        if (Number.isFinite(price)) updates[id] = price;
      }
      if (Object.keys(updates).length) onPriceUpdate(updates);
    }, setStatus);
    const timer = setTimeout(() => {
      stop();
      setStatus("error");
      setSessionEnded(true);
    }, SESSION_TIMEOUT_MS);
    return () => { clearTimeout(timer); stop(); };
  }, [assetIds, enabled, onPriceUpdate, sessionEnded, session]);

  return { status, sessionEnded, restart };
}

/* ------------------------------------------------------------------ */
/*  LiveStreamHeatmap Component                                        */
/* ------------------------------------------------------------------ */
export default function LiveStreamHeatmap() {
  const [tradeInfoMap, setTradeInfoMap] = useState<Record<string, TradeInfo>>({});
  const [metaData, setMetaData] = useState<Record<string, CoinMeta>>({});
  const [topIds, setTopIds] = useState<string[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<CoinMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [query, setQuery] = useState("");
  const [ticks, setTicks] = useState(0);

  /* Fetch CoinGecko logos */
  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const res = await fetch(COINGECKO_TOP200);
        if (!res.ok) return;
        const json = await res.json();
        if (canceled) return;

        const logoMap: Record<string, string> = {};
        for (const c of json || []) {
          const key = c.symbol?.toLowerCase?.();
          if (key && c.image) logoMap[key] = c.image;
        }
        setLogos(logoMap);
      } catch (e) {
        console.warn("Failed to fetch CoinGecko data:", e);
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  /* Fetch CoinCap metadata */
  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const res = await fetchCoinCap("assets?limit=200");
        if (canceled) return;

        const json = await res.json();
        if (canceled) return;

        const meta: Record<string, CoinMeta> = {};
        const initialPrices: Record<string, TradeInfo> = {};
        const ids: string[] = [];

        for (const a of json.data || []) {
          if (!a?.id) continue;
          meta[a.id] = a;
          ids.push(a.id);

          const p = parseFloat(a.priceUsd);
          if (Number.isFinite(p)) initialPrices[a.id] = { price: p, direction: "neutral", bump: 0 };
        }

        ids.sort((a, b) => (+meta[a]?.rank || 9999) - (+meta[b]?.rank || 9999));

        setMetaData(meta);
        setTopIds(ids.slice(0, 200));
        setTradeInfoMap(initialPrices);
        setLoading(false);
      } catch (e) {
        console.error("Failed to fetch initial data:", e);
        if (!canceled) {
          setLoadError(e instanceof Error ? e.message : "Crypto data is unavailable.");
          setLoading(false);
        }
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  /* Streamed set = the loaded page; the filter only changes what's shown */
  const streamIds = useMemo(() => topIds.slice(0, visibleCount), [topIds, visibleCount]);

  const shownIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return streamIds;
    return topIds.filter((id) => {
      const m = metaData[id];
      return m?.symbol?.toLowerCase().includes(q) || m?.name?.toLowerCase().includes(q);
    });
  }, [query, streamIds, topIds, metaData]);

  /* Market breadth across the whole top 200 */
  const breadth = useMemo(() => {
    let up = 0, down = 0, sum = 0, n = 0;
    let best: CoinMeta | null = null, worst: CoinMeta | null = null;
    for (const id of topIds) {
      const m = metaData[id];
      if (!m) continue;
      const p = parsePct(m.changePercent24Hr);
      if (p > 0) up++;
      else if (p < 0) down++;
      sum += p;
      n++;
      if (!best || p > parsePct(best.changePercent24Hr)) best = m;
      if (!worst || p < parsePct(worst.changePercent24Hr)) worst = m;
    }
    return { up, down, avg: n ? sum / n : 0, best, worst, total: n };
  }, [topIds, metaData]);

  /* Price update handler */
  const handlePriceUpdate = useCallback((updates: Record<string, number>) => {
    setTradeInfoMap((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const [id, newPrice] of Object.entries(updates)) {
        const existing = prev[id];
        const oldPrice = existing?.price;

        if (oldPrice === undefined) {
          next[id] = { price: newPrice, direction: "neutral", bump: 1 };
          changed = true;
        } else if (newPrice !== oldPrice) {
          next[id] = {
            price: newPrice,
            direction: newPrice > oldPrice ? "up" : "down",
            bump: (existing?.bump || 0) + 1,
          };
          changed = true;
        }
      }

      return changed ? next : prev;
    });
    const count = Object.keys(updates).length;
    if (count) setTicks((t) => t + count);
  }, []);

  /* WebSocket connection */
  const { status, sessionEnded, restart } = usePriceStream(
    streamIds,
    !loading && streamIds.length > 0,
    handlePriceUpdate
  );

  /* Get logo for asset */
  const getLogoUrl = useCallback(
    (symbol: string): string | undefined => {
      const sym = symbol?.toLowerCase();
      return logos[sym] || (sym ? `https://assets.coincap.io/assets/icons/${sym}@2x.png` : undefined);
    },
    [logos]
  );

  /* Click handlers */
  const handleAssetClick = useCallback((asset: CoinMeta) => {
    if (!asset) return;
    setSelectedAsset(asset);
    trackEvent("CryptoAssetClick", { ...asset });
  }, []);

  const setView = useCallback((next: "grid" | "table") => {
    setViewMode(next);
    trackEvent("CryptoViewToggle", { view: next });
  }, []);

  const handleLoadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(topIds.length, c + PAGE_SIZE));
  }, [topIds.length]);

  /* Loading / error states */
  if (loadError) {
    return (
      <div role="alert" className="m-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
        {loadError}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mb-5 h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.04]" />
        <div className="grid auto-rows-[92px] grid-flow-dense grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className={`animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04] ${tileSpan(i + 1)}`}
              style={{ animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  const live = status === "live" && !sessionEnded;
  const upShare = breadth.total ? (breadth.up / breadth.total) * 100 : 50;

  return (
    <>
      <div className="p-3 sm:p-5">
        {/* ── Market readout ─────────────────────────────────────────── */}
        <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-200/70 dark:border-white/[0.08] dark:bg-white/[0.06] sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="bg-white p-4 dark:bg-[#1f1f23]">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-slate-400">
              <span>Market breadth</span>
              <span className="tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">{breadth.up}▲</span>{" "}
                <span className="text-rose-500 dark:text-rose-400">{breadth.down}▼</span>
              </span>
            </div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-rose-400/80 dark:bg-rose-500/60">
              <motion.div
                className="h-full rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.6)] dark:bg-emerald-400/90"
                initial={{ width: 0 }}
                animate={{ width: `${upShare}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {Math.round(upShare)}% of the top {breadth.total} are up today
            </div>
          </div>

          <Readout label="Avg 24h" value={formatPct(breadth.avg)} tone={breadth.avg >= 0 ? "up" : "down"} />
          <Readout
            label="Top gainer"
            value={breadth.best ? `${breadth.best.symbol} ${formatPct(breadth.best.changePercent24Hr)}` : "—"}
            tone="up"
            onClick={breadth.best ? () => handleAssetClick(breadth.best!) : undefined}
          />
          <Readout
            label="Top loser"
            value={breadth.worst ? `${breadth.worst.symbol} ${formatPct(breadth.worst.changePercent24Hr)}` : "—"}
            tone="down"
            onClick={breadth.worst ? () => handleAssetClick(breadth.worst!) : undefined}
          />
        </div>

        {/* ── Toolbar ────────────────────────────────────────────────── */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* Stream status */}
          <button
            type="button"
            onClick={status === "error" ? restart : undefined}
            className={[
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider ring-1 transition-colors",
              live
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20"
                : status === "error"
                  ? "cursor-pointer bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20"
                  : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20",
            ].join(" ")}
          >
            {live ? (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
            ) : status === "error" ? (
              <RotateCw className="h-3 w-3" />
            ) : (
              <Radio className="h-3 w-3 animate-pulse" />
            )}
            {live ? "Streaming" : status === "error" ? "Reconnect" : "Connecting"}
          </button>

          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
            <Zap className="h-3 w-3 text-amber-500" />
            {ticks.toLocaleString()} ticks
          </span>

          <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
            {/* Filter */}
            <label className="relative flex-1 sm:w-56 sm:flex-none">
              <span className="sr-only">Filter coins</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter symbol or name"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-8 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear filter"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>

            {/* View toggle */}
            <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-white/10 dark:bg-white/[0.04]" role="group" aria-label="View">
              {([
                { key: "grid", icon: LayoutGrid, label: "Heatmap" },
                { key: "table", icon: Table2, label: "Table" },
              ] as const).map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setView(v.key)}
                  aria-pressed={viewMode === v.key}
                  title={v.label}
                  className={`relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === v.key ? "text-white dark:text-slate-900" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {viewMode === v.key && (
                    <motion.span layoutId="heatmapViewPill" className="absolute inset-0 rounded-lg bg-slate-900 dark:bg-white" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                  )}
                  <v.icon className="relative h-3.5 w-3.5" />
                  <span className="relative hidden sm:inline">{v.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legend + count */}
        <div className="mt-3 mb-3 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-wider text-slate-400">
          <span className="tabular-nums">
            {query ? `${shownIds.length} match${shownIds.length === 1 ? "" : "es"}` : `${shownIds.length} / ${topIds.length} coins`}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="hidden sm:inline">24h</span>
            <span className="flex overflow-hidden rounded-sm">
              {HEAT_LEGEND.map((cls, i) => (
                <span key={i} className={`h-2.5 w-4 ring-0 ${cls}`} />
              ))}
            </span>
          </span>
        </div>

        {/* ── Views ──────────────────────────────────────────────────── */}
        {viewMode === "grid" ? (
          <div className="grid auto-rows-[92px] grid-flow-dense grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {shownIds.map((id) => (
              <HeatTile
                key={id}
                id={id}
                meta={metaData[id] || ({ id } as CoinMeta)}
                tradeInfo={tradeInfoMap[id]}
                logo={getLogoUrl(metaData[id]?.symbol)}
                onSelect={handleAssetClick}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white dark:border-white/[0.08] dark:bg-white/[0.02]">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-100 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:border-white/[0.06]">
                  <th className="py-2.5 pl-4 pr-2 text-left font-normal">#</th>
                  <th className="px-2 py-2.5 text-left font-normal">Coin</th>
                  <th className="px-2 py-2.5 text-right font-normal">Price</th>
                  <th className="px-2 py-2.5 text-right font-normal">24h</th>
                  <th className="hidden px-2 py-2.5 text-right font-normal sm:table-cell">Mkt cap</th>
                  <th className="hidden py-2.5 pl-2 pr-4 text-right font-normal md:table-cell">Vol 24h</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {shownIds.map((id) => (
                  <TableRow
                    key={id}
                    id={id}
                    meta={metaData[id] || ({ id } as CoinMeta)}
                    tradeInfo={tradeInfoMap[id]}
                    logo={getLogoUrl(metaData[id]?.symbol)}
                    onSelect={handleAssetClick}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {shownIds.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            No coins match &ldquo;{query}&rdquo; in the top {topIds.length}.
          </div>
        )}

        {/* Paging */}
        {!query && (
          <div className="mt-5 flex items-center justify-center gap-2">
            {visibleCount < topIds.length && (
              <button
                type="button"
                onClick={handleLoadMore}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/20"
              >
                Load {Math.min(PAGE_SIZE, topIds.length - visibleCount)} more
              </button>
            )}
            {visibleCount > PAGE_SIZE && (
              <button
                type="button"
                onClick={() => setVisibleCount(PAGE_SIZE)}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Show top {PAGE_SIZE}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Asset Detail Modal */}
      <CryptoAssetPopup
        asset={selectedAsset}
        logos={logos}
        onClose={() => setSelectedAsset(null)}
        tradeInfo={selectedAsset ? tradeInfoMap[selectedAsset.id] : undefined}
      />

      {/* WebSocket Session Ended Modal (portaled so the panel can't trap it) */}
      {createPortal(
      <AnimatePresence>
        {sessionEnded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stream-ended-title"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 text-center shadow-2xl dark:border-white/10 dark:bg-[#1f1f23]"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 ring-1 ring-amber-200 dark:bg-amber-400/10 dark:ring-amber-400/20">
                <Zap className="h-5 w-5" />
              </div>
              <h3 id="stream-ended-title" className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                Stream paused
              </h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                The live feed pauses after 5 minutes to go easy on the API. You received {ticks.toLocaleString()} ticks.
              </p>
              <button
                type="button"
                onClick={restart}
                autoFocus
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-600 dark:bg-white dark:text-slate-900 dark:hover:bg-indigo-300"
              >
                <RotateCw className="h-4 w-4" />
                Resume stream
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Readout cell                                                       */
/* ------------------------------------------------------------------ */
function Readout({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  tone: "up" | "down";
  onClick?: () => void;
}) {
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
