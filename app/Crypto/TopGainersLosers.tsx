/* eslint-disable @next/next/no-img-element */
"use client";

import { fetchCoinCap } from "@/utils/coincap-client";

import { useEffect, useMemo, useState } from "react";

import { motion } from "framer-motion";
import { LayoutGrid, RefreshCw, Search, Table2, TrendingDown, TrendingUp, X } from "lucide-react";

import CryptoAssetPopup from "@/app/Crypto/CryptoAssetPopup";
import { heatTone } from "@/utils/heat";
import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
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

const formatUSD = (v: any) => {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return "—";
  return Math.abs(n) < 1 ? smallFmt.format(n) : currencyFmt.format(n);
};

const formatPct = (v: any) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? `${n > 0 ? "+" : ""}${n.toFixed(2)}%` : "—";
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ---------- API constants ---------- */

const COINGECKO_TOP200 =
  "/api/CoinGeckoAPI?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false";

export default function TopGainersLosers() {
  const [cryptoData, setCryptoData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const [logos, setLogos] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"gainers" | "losers">("gainers");
  const [query, setQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  // flash support (NO invalid <div> inside <tr>)
  const [tickMap, setTickMap] = useState<Record<string, { price?: number; bump?: number }>>({});

  /* -------- preload CoinGecko logos -------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(COINGECKO_TOP200);
        const json = await res.json();
        const map: Record<string, string> = {};
        (json || []).forEach((c: any) => {
          const k = c?.symbol?.toLowerCase?.();
          if (k) map[k] = c.image;
        });
        setLogos(map);
      } catch {
        /* ignore */
      }
    })();
  }, []);

      /* ✅ HARD FIX: force-enable scroll on html/body while this page is mounted */
    useEffect(() => {
      const html = document.documentElement;
      const body = document.body;

      const prev = {
        htmlOverflow: html.style.overflow,
        htmlHeight: html.style.height,
        htmlPosition: html.style.position,
        bodyOverflow: body.style.overflow,
        bodyHeight: body.style.height,
        bodyPosition: body.style.position,
        bodyTop: body.style.top,
        bodyWidth: body.style.width,
        bodyTouchAction: (body.style as any).touchAction,
      };

      // Nuke common "modal left me locked" settings
      html.style.overflow = "auto";
      html.style.height = "auto";
      html.style.position = "static";

      body.style.overflow = "auto";
      body.style.height = "auto";
      body.style.position = "static";
      body.style.top = "";
      body.style.width = "auto";
      (body.style as any).touchAction = "pan-y";

      // Also remove any scroll-behavior traps
      // (If another component set overflow hidden via class on <html>, this still helps.)
      const unlock = () => {
        html.style.overflow = "auto";
        body.style.overflow = "auto";
        (body.style as any).touchAction = "pan-y";
      };

      // Re-apply a couple times in case another component runs after mount
      const t1 = window.setTimeout(unlock, 0);
      const t2 = window.setTimeout(unlock, 50);
      const t3 = window.setTimeout(unlock, 250);

      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        window.clearTimeout(t3);

        html.style.overflow = prev.htmlOverflow;
        html.style.height = prev.htmlHeight;
        html.style.position = prev.htmlPosition;

        body.style.overflow = prev.bodyOverflow;
        body.style.height = prev.bodyHeight;
        body.style.position = prev.bodyPosition;
        body.style.top = prev.bodyTop;
        body.style.width = prev.bodyWidth;
        (body.style as any).touchAction = prev.bodyTouchAction;
      };
    }, []);

  /* -------- fetch CoinCap prices every 15s -------- */
  useEffect(() => {

    let canceled = false;

    const load = async () => {
      try {
        const res = await fetchCoinCap("assets?limit=200");
        const json = await res.json();
        const rows = Array.isArray(json.data) ? json.data : [];
        if (canceled) return;

        // bump flashes when price changes per asset
        setTickMap((prev) => {
          const next = { ...prev };
          for (const c of rows) {
            const id = c?.id;
            if (!id) continue;
            const p = parseFloat(c?.priceUsd);
            if (!Number.isFinite(p)) continue;

            const old = prev[id]?.price;
            const changed = old != null && p !== old;
            next[id] = {
              price: p,
              bump: changed ? (prev[id]?.bump || 0) + 1 : prev[id]?.bump || 0,
            };
          }
          return next;
        });

        setCryptoData(rows);
        setLastUpdated(Date.now());
      } catch (e) {
        console.error("CoinCap fetch error:", e);
        if (!canceled) setCryptoData([]);
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 15000);

    return () => {
      canceled = true;
      clearInterval(iv);
    };
  }, []);

  /* ------------ derived lists ------------- */
  const sorted = useMemo(() => {
    const list = Array.isArray(cryptoData) ? cryptoData : [];
    return [...list].sort(
      (a, b) =>
        parseFloat(b?.changePercent24Hr ?? "0") -
        parseFloat(a?.changePercent24Hr ?? "0"),
    );
  }, [cryptoData]);

  const topGainers = sorted.slice(0, 15);
  const topLosers = sorted.slice(-15).reverse();

  const activeRows = tab === "gainers" ? topGainers : topLosers;

  const filteredActive = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeRows;

    return activeRows.filter((c) => {
      const sym = String(c?.symbol ?? "").toLowerCase();
      const name = String(c?.name ?? "").toLowerCase();
      return sym.includes(q) || name.includes(q);
    });
  }, [activeRows, query]);

  const updatedLabel = useMemo(() => {
    if (!lastUpdated) return "—";
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(lastUpdated);
  }, [lastUpdated]);

  const openAsset = (c: any) => {
    setSelectedAsset(c);
    trackEvent("CryptoAssetClick", { id: c?.id, symbol: c?.symbol, tab });
  };

  const setTabAndTrack = (next: "gainers" | "losers") => {
    setTab(next);
    setQuery("");
    trackEvent("CryptoMoversTab", { tab: next });
  };

  const setViewAndTrack = (next: "table" | "grid") => {
    setViewMode(next);
    trackEvent("CryptoViewToggle", { view: next });
  };

  /** Bar length relative to the biggest move in the list */
  const maxAbs = Math.max(1, ...activeRows.map((c) => Math.abs(parseFloat(c?.changePercent24Hr ?? "0")) || 0));

  const renderTable = (rows: any[]) => (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white dark:border-white/[0.08] dark:bg-white/[0.02]">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-slate-100 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:border-white/[0.06]">
            <th className="py-2.5 pl-4 pr-2 text-left font-normal">#</th>
            <th className="px-2 py-2.5 text-left font-normal">Coin</th>
            <th className="px-2 py-2.5 text-right font-normal">Price</th>
            <th className="py-2.5 pl-2 pr-4 text-right font-normal">24h</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
          {rows.map((c, idx) => {
            const change = parseFloat(c?.changePercent24Hr ?? "0");
            const logo = logos[String(c?.symbol ?? "").toLowerCase()];
            const bump = tickMap[c?.id]?.bump || 0;
            const width = `${Math.min(100, (Math.abs(change) / maxAbs) * 100)}%`;

            return (
              <motion.tr
                key={c?.id}
                onClick={() => openAsset(c)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]"
              >
                <td className="py-2.5 pl-4 pr-2 font-mono text-[11px] tabular-nums text-slate-400">{c?.rank ?? "—"}</td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2.5">
                    {logo ? (
                      <img src={logo} alt="" className="h-6 w-6 rounded-full bg-white p-0.5 ring-1 ring-slate-200 dark:ring-white/10" loading="lazy" />
                    ) : (
                      <span className="h-6 w-6 rounded-full bg-slate-100 dark:bg-white/10" />
                    )}
                    <div className="min-w-0 leading-tight">
                      <div className="text-[13px] font-semibold text-slate-900 dark:text-white">{c?.symbol ?? "—"}</div>
                      <div className="truncate text-[11px] text-slate-400 dark:text-slate-500">{c?.name ?? "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="relative px-2 py-2.5 text-right font-mono text-[13px] tabular-nums text-slate-900 dark:text-white">
                  {bump > 0 && (
                    <motion.span
                      key={bump}
                      aria-hidden
                      className="pointer-events-none absolute inset-1 rounded-md"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 0.9 }}
                      style={{ boxShadow: change >= 0 ? "inset 0 0 0 1.5px rgba(16,185,129,.9)" : "inset 0 0 0 1.5px rgba(244,63,94,.9)" }}
                    />
                  )}
                  {formatUSD(c?.priceUsd)}
                </td>
                <td className="py-2.5 pl-2 pr-4">
                  <div className="ml-auto flex w-32 flex-col items-end gap-1 sm:w-44">
                    <span className={cn("font-mono text-[12px] tabular-nums", change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400")}>
                      {formatPct(change)}
                    </span>
                    <span className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                      <motion.span
                        className={cn("ml-auto block h-full rounded-full", change >= 0 ? "bg-emerald-400" : "bg-rose-400")}
                        initial={{ width: 0 }}
                        animate={{ width }}
                        transition={{ duration: 0.6, delay: idx * 0.02, ease: "easeOut" }}
                      />
                    </span>
                  </div>
                </td>
              </motion.tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No matches in the top 15.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const renderGrid = (rows: any[]) => (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-5">
      {rows.map((c, idx) => {
        const change = parseFloat(c?.changePercent24Hr ?? "0");
        const logo = logos[String(c?.symbol ?? "").toLowerCase()];
        const bump = tickMap[c?.id]?.bump || 0;

        return (
          <motion.button
            key={c?.id}
            type="button"
            onClick={() => openAsset(c)}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.02 }}
            className={cn(
              "group relative isolate flex h-24 flex-col justify-between overflow-hidden rounded-xl p-3 text-left ring-1 ring-inset transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-[1.04]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              heatTone(change)
            )}
          >
            {bump > 0 && (
              <motion.span
                key={bump}
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-xl"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.9 }}
                style={{ boxShadow: change >= 0 ? "inset 0 0 0 2px rgba(16,185,129,.95)" : "inset 0 0 0 2px rgba(244,63,94,.95)" }}
              />
            )}
            <div className="flex items-center justify-between gap-1">
              <span className="flex min-w-0 items-center gap-1.5">
                {logo && <img src={logo} alt="" className="h-4 w-4 rounded-full bg-white p-px" loading="lazy" />}
                <span className="truncate text-[13px] font-semibold" title={c?.name}>{c?.symbol ?? "—"}</span>
              </span>
              <span className="font-mono text-[9px] opacity-60">#{c?.rank ?? "—"}</span>
            </div>
            <div>
              <div className="font-mono text-[13px] font-semibold tabular-nums">{formatUSD(c?.priceUsd)}</div>
              <div className="font-mono text-[11px] tabular-nums opacity-80">{formatPct(change)}</div>
            </div>
          </motion.button>
        );
      })}

      {rows.length === 0 && (
        <div className="col-span-full rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          No matches in the top 15.
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-2 p-4 sm:p-6">
        <div className="mb-4 h-12 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.04]" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Gainers / Losers */}
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-white/10 dark:bg-white/[0.04]" role="group" aria-label="Movers">
          {([
            { key: "gainers", label: "Gainers", icon: TrendingUp, on: "bg-emerald-500 text-white shadow-[0_0_16px_-2px_rgba(16,185,129,0.6)]" },
            { key: "losers", label: "Losers", icon: TrendingDown, on: "bg-rose-500 text-white shadow-[0_0_16px_-2px_rgba(244,63,94,0.6)]" },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTabAndTrack(t.key)}
              aria-pressed={tab === t.key}
              className={cn(
                "relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors",
                tab === t.key ? "text-white" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              {tab === t.key && (
                <motion.span layoutId="moversPill" className={cn("absolute inset-0 rounded-lg", t.on)} transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              )}
              <t.icon className="relative h-3.5 w-3.5" />
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>

        <span className="inline-flex items-center gap-1.5 px-2 font-mono text-[11px] text-slate-400">
          <RefreshCw className="h-3 w-3" />
          15s · {updatedLabel}
        </span>

        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <label className="relative flex-1 sm:w-52 sm:flex-none">
            <span className="sr-only">Filter movers</span>
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

          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-white/10 dark:bg-white/[0.04]" role="group" aria-label="View">
            {([
              { key: "table", icon: Table2, label: "Table" },
              { key: "grid", icon: LayoutGrid, label: "Tiles" },
            ] as const).map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setViewAndTrack(v.key)}
                aria-pressed={viewMode === v.key}
                title={v.label}
                className={cn(
                  "relative inline-flex items-center rounded-lg px-2.5 py-1.5 transition-colors",
                  viewMode === v.key ? "text-white dark:text-slate-900" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                {viewMode === v.key && (
                  <motion.span layoutId="moversView" className="absolute inset-0 rounded-lg bg-slate-900 dark:bg-white" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                <v.icon className="relative h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mb-3 mt-4 font-mono text-[10px] uppercase tracking-wider text-slate-400">
        Top 15 {tab} of the top 200 by 24h change
      </p>

      <motion.div key={`${tab}-${viewMode}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        {viewMode === "table" ? renderTable(filteredActive) : renderGrid(filteredActive)}
      </motion.div>

      <CryptoAssetPopup asset={selectedAsset} logos={logos} onClose={() => setSelectedAsset(null)} />
    </div>
  );
}
