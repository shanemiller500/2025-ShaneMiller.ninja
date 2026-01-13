/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FaTable,
  FaThLarge,
  FaArrowUp,
  FaArrowDown,
  FaSyncAlt,
  FaSearch,
  FaTrophy,
  FaSkullCrossbones,
} from "react-icons/fa";
import { trackEvent } from "@/utils/mixpanel";
import CryptoAssetPopup from "@/utils/CryptoAssetPopup";

/* ---------- helpers ---------- */
const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const formatUSD = (v: any) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? currencyFmt.format(n) : "—";
};

const formatPct = (v: any) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ---------- API constants ---------- */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";

/* ---------- small UI pieces ---------- */
function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "up" | "down";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold ring-1",
        tone === "up" &&
          "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-300/20",
        tone === "down" &&
          "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:bg-rose-400/10 dark:text-rose-200 dark:ring-rose-300/20",
        tone === "neutral" &&
          "bg-black/[0.03] text-gray-700 ring-black/10 dark:bg-white/[0.06] dark:text-white/75 dark:ring-white/10",
      )}
    >
      {children}
    </span>
  );
}

function SegButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex-1 sm:flex-none rounded-xl px-4 py-2 text-xs font-extrabold transition",
        "ring-1 ring-black/10 dark:ring-white/10",
        active
          ? "bg-indigo-600/15 text-indigo-800 dark:text-indigo-200"
          : "bg-white/70 dark:bg-white/[0.06] text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white",
      )}
    >
      <span className="inline-flex items-center gap-2">
        <span className="text-indigo-600 dark:text-indigo-300">{icon}</span>
        {label}
      </span>
    </button>
  );
}

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

  /* ✅ FIX SCROLL: if any modal/popup previously left body locked, unlock it on this page */
  useEffect(() => {
    const prev = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = "auto";
    document.body.style.touchAction = "auto";
    return () => {
      document.body.style.overflow = prev;
      document.body.style.touchAction = prevTouch;
    };
  }, []);

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
    if (!API_KEY) {
      setLoading(false);
      return;
    }

    let canceled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=200&apiKey=${API_KEY}`,
        );
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

  const renderTable = (rows: any[]) => (
    <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] shadow-sm">
      <table className="min-w-full divide-y divide-black/5 dark:divide-white/10">
        <thead className="bg-black/[0.03] dark:bg-white/[0.06]">
          <tr>
            {["Rank", "Symbol", "Name", "Price", "24h"].map((h) => (
              <th
                key={h}
                className="px-1 sm:px-2 py-2 text-left text-[10px] sm:text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-black/5 dark:divide-white/10">
          {rows.map((c) => {
            const change = parseFloat(c?.changePercent24Hr ?? "0");
            const pos = Number.isFinite(change) && change >= 0;
            const neg = Number.isFinite(change) && change < 0;

            const logo = logos[String(c?.symbol ?? "").toLowerCase()];
            const bump = tickMap[c?.id]?.bump || 0;

            // ✅ motion.tr is still a <tr> — children are ONLY <td>, so no hydration error
            return (
              <motion.tr
                key={`${c?.id}-${bump}`} // replay flash on bump changes
                className="cursor-pointer transition hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
                onClick={() => openAsset(c)}
                initial={false}
                animate={{
                  backgroundColor: bump
                    ? pos
                      ? "rgba(16,185,129,0.18)"
                      : neg
                        ? "rgba(244,63,94,0.18)"
                        : "rgba(0,0,0,0)"
                    : "rgba(0,0,0,0)",
                }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <td className="px-1 sm:px-2 py-2 text-[11px] sm:text-sm font-semibold text-gray-700 dark:text-white/75">
                  {c?.rank ?? "—"}
                </td>

                <td className="px-1 sm:px-2 py-2">
                  <div className="flex items-center gap-2">
                    {logo ? (
                      <span className="inline-flex items-center justify-center rounded-full bg-white/90 dark:bg-white/10 p-[2px] ring-1 ring-black/10 dark:ring-white/10">
                        <img
                          src={logo}
                          alt={c?.symbol}
                          className="h-5 w-5 sm:h-6 sm:w-6"
                          loading="lazy"
                        />
                      </span>
                    ) : (
                      <span className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-black/10 dark:bg-white/10" />
                    )}
                    <div className="font-extrabold text-[12px] sm:text-sm text-gray-900 dark:text-white">
                      {c?.symbol ?? "—"}
                    </div>
                  </div>
                </td>

                <td className="px-1 sm:px-2 py-2">
                  <div className="text-[12px] sm:text-sm font-semibold text-gray-800 dark:text-white/80 line-clamp-1">
                    {c?.name ?? "—"}
                  </div>
                </td>

                <td className="px-1 sm:px-2 py-2 text-[12px] sm:text-sm font-extrabold text-gray-900 dark:text-white">
                  {formatUSD(c?.priceUsd)}
                </td>

                <td className="px-1 sm:px-2 py-2">
                  <div
                    className={cn(
                      "inline-flex items-center gap-2 text-[12px] sm:text-sm font-extrabold",
                      pos
                        ? "text-green-600 dark:text-green-300"
                        : "text-red-600 dark:text-red-300",
                    )}
                  >
                    {pos ? <FaArrowUp /> : <FaArrowDown />}
                    {formatPct(c?.changePercent24Hr)}
                  </div>
                </td>
              </motion.tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-4 text-sm text-gray-600 dark:text-white/70">
                No matches in the top 15.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

const renderGrid = (rows: any[]) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 lg:grid-cols-5 xl:grid-cols-6">
    {rows.map((c) => {
      const change = parseFloat(c?.changePercent24Hr ?? "0");
      const pos = Number.isFinite(change) && change > 0;
      const neg = Number.isFinite(change) && change < 0;

      // ✅ heat map background (do NOT change)
      const bg = pos ? "bg-green-500" : neg ? "bg-red-500" : "bg-gray-300";

      const logo = logos[String(c?.symbol ?? "").toLowerCase()];
      const bump = tickMap[c?.id]?.bump || 0;

      return (
        <motion.div
          key={`${c?.id}-${bump}`}
          className={`${bg} relative overflow-hidden text-white p-2 sm:p-3 rounded-lg shadow cursor-pointer`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => openAsset(c)}
        >
          {/* (optional) subtle flash like heatmap — safe in grid */}
          {bump > 0 && (
            <motion.div
              key={`${c?.id}-flash-${bump}`}
              className="absolute inset-0 rounded-lg pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.35, 0], scale: [1, 1.02, 1] }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              style={{
                background: pos
                  ? "rgba(255,255,255,0.85)"
                  : neg
                    ? "rgba(0,0,0,0.30)"
                    : "transparent",
                mixBlendMode: "overlay",
              }}
            />
          )}

          <div className="flex items-center gap-1">
            <span className="text-[9px] sm:text-xs bg-black/40 px-1 rounded">
              #{c?.rank ?? "—"}
            </span>

            {logo && (
              <span className="inline-flex items-center justify-center bg-white/90 rounded-full p-[2px]">
                <img
                  src={logo}
                  alt={c?.symbol}
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  loading="lazy"
                />
              </span>
            )}

            <span className="font-bold text-sm sm:text-lg" title={c?.name}>
              {c?.symbol ?? "—"}
            </span>
          </div>

          <div className="mt-0.5 text-[11px] sm:text-sm">{formatUSD(c?.priceUsd)}</div>

          <div className="text-[9px] sm:text-xs">
            {formatPct(change)} {pos ? "↑" : neg ? "↓" : ""}
          </div>
        </motion.div>
      );
    })}

    {rows.length === 0 && (
      <div className="col-span-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 text-sm text-gray-700 dark:text-white/70">
        No matches in the top 15.
      </div>
    )}
  </div>
);


  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 shadow-sm">
          <div className="text-sm font-extrabold text-gray-900 dark:text-white">
            Loading crypto data…
          </div>
          <div className="mt-2 h-2 w-56 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <motion.div
              className="h-full w-1/2 bg-indigo-500/60"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    // ✅ scroll-safe padding + no overflow-hidden anywhere
    <div className="min-h-screen  py-6 pb-24">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-5 shadow-sm">
          <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
            <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
          </div>

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Crypto Market Movers
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pill tone="neutral">
                  <FaSyncAlt className="opacity-80" />
                  Updates every 15s
                </Pill>
                <Pill tone="neutral">Last: {updatedLabel}</Pill>
                <Pill tone={tab === "gainers" ? "up" : "down"}>
                  {tab === "gainers" ? <FaTrophy /> : <FaSkullCrossbones />}
                  {tab === "gainers" ? "Top gainers" : "Top losers"}
                </Pill>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-3">
              {/* View toggle */}
              <button
                onClick={() => {
                  const next = viewMode === "table" ? "grid" : "table";
                  setViewMode(next);
                  trackEvent("CryptoViewToggle", { view: next });
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-extrabold text-white shadow-sm ring-1 ring-black/10 dark:ring-white/10 bg-brand-gradient hover:opacity-95 active:scale-[0.99] transition"
              >
                {viewMode === "table" ? <FaThLarge className="w-4 h-4" /> : <FaTable className="w-4 h-4" />}
                <span>{viewMode === "table" ? "Grid view" : "Table view"}</span>
              </button>

              {/* Tabs */}
              <div className="inline-flex w-full sm:w-auto rounded-2xl gap-2 p-1 bg-black/[0.03] dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/10">
                <SegButton
                  active={tab === "gainers"}
                  label="Gainers"
                  icon={<FaArrowUp />}
                  onClick={() => {
                    setTab("gainers");
                    setQuery("");
                    trackEvent("CryptoMoversTab", { tab: "gainers" });
                  }}
                />
                <SegButton
                  active={tab === "losers"}
                  label="Losers"
                  icon={<FaArrowDown />}
                  onClick={() => {
                    setTab("losers");
                    setQuery("");
                    trackEvent("CryptoMoversTab", { tab: "losers" });
                  }}
                />
              </div>
            </div>
          </div>          
        </div>

        {/* Content */}
        <div className="mt-5">
          {viewMode === "table" ? renderTable(filteredActive) : renderGrid(filteredActive)}
        </div>

        {/* Popup */}
        <CryptoAssetPopup
          asset={selectedAsset}
          logos={logos}
          onClose={() => setSelectedAsset(null)}
        />
      </div>
    </div>
  );
}