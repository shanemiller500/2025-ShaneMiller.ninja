"use client";

import React, { useEffect, useState, useRef, useMemo, JSX } from "react";
import { motion } from "framer-motion";
import { FaTable, FaThLarge } from "react-icons/fa";
import { trackEvent } from "@/utils/mixpanel";
import CryptoAssetPopup from "@/utils/CryptoAssetPopup";

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const formatUSD = (v: any) => {
  const n = parseFloat(v);
  return isNaN(n) ? "—" : currencyFmt.format(n);
};
const formatPct = (s: any) =>
  s != null ? `${parseFloat(String(s)).toFixed(2)}%` : "N/A";

/* ---------- API constants ---------- */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";

export default function LiveStreamHeatmap() {
  /* ---------- core state ---------- */
  const [tradeInfoMap, setTradeInfoMap] = useState<
    Record<string, { price: number; prev?: number; bump?: number }>
  >({});
  const [metaData, setMetaData] = useState<Record<string, any>>({});
  const [topIds, setTopIds] = useState<string[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsAvailable, setWsAvailable] = useState(true);
  const [wsClosed, setWsClosed] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [cgInfo, setCgInfo] = useState<
    Record<string, { high: number; low: number }>
  >({});

  /* ---------- refs ---------- */
  const socketRef = useRef<WebSocket | null>(null);

  /* -------- preload CoinGecko logos -------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(COINGECKO_TOP200);
        const json = await res.json();
        const map: Record<string, string> = {};
        const inf: Record<string, { high: number; low: number }> = {};
        json.forEach((c: any) => {
          const k = c.symbol?.toLowerCase?.();
          if (!k) return;
          map[k] = c.image;
          inf[k] = { high: c.high_24h, low: c.low_24h };
        });
        setLogos(map);
        setCgInfo(inf);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  /* -------- bootstrap CoinCap metadata + initial prices (FAST initial render) -------- */
  useEffect(() => {
    let canceled = false;

    (async () => {
      if (!API_KEY) {
        setWsAvailable(false);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=200&apiKey=${API_KEY}`,
        );

        if (res.status === 403) {
          setWsAvailable(false);
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (canceled) return;

        const m: Record<string, any> = {};
        const initialPrices: Record<
          string,
          { price: number; prev?: number; bump?: number }
        > = {};
        const ids: string[] = [];

        (json.data || []).forEach((a: any) => {
          if (!a?.id) return;
          m[a.id] = a;
          ids.push(a.id);

          const p = parseFloat(a.priceUsd);
          if (!Number.isNaN(p)) {
            // prev stays undefined so WS/timer can still compare "old -> new"
            // but colors will be based on changePercent24Hr until prev exists
            initialPrices[a.id] = { price: p, prev: undefined, bump: 0 };
          }
        });

        ids.sort((a, b) => (+m[a]?.rank || 9999) - (+m[b]?.rank || 9999));

        setMetaData(m);
        setTopIds(ids.slice(0, 200));
        setTradeInfoMap((prev) => ({ ...prev, ...initialPrices }));
        setLoading(false);
      } catch {
        if (!canceled) setLoading(false);
      }
    })();

    return () => {
      canceled = true;
    };
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

  /* -------- websocket stream (subscribe ONLY to top 200) -------- */
  useEffect(() => {
    if (!API_KEY || !topIds.length || !wsAvailable) return;

    // close previous socket if any
    socketRef.current?.close();
    setWsClosed(false);

    const assetsParam = topIds.join(",");
    const ws = new WebSocket(
      `wss://wss.coincap.io/prices?assets=${encodeURIComponent(
        assetsParam,
      )}&apiKey=${API_KEY}`,
    );
    socketRef.current = ws;

    const wsTimeout = window.setTimeout(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    }, 600_000);

    ws.onmessage = (e) => {
      if (typeof e.data === "string" && e.data.startsWith("Unauthorized")) {
        setWsAvailable(false);
        ws.close();
        setLoading(false);
        return;
      }

      let up: Record<string, string> | null = null;
      try {
        up = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!up) return;

      // ✅ Immediate updates + bump counter (forces flash per tick)
      setTradeInfoMap((prev) => {
        const nxt = { ...prev };
        for (const [id, ps] of Object.entries(up)) {
          const p = parseFloat(ps as string);
          if (!Number.isFinite(p)) continue;

          const old = prev[id]?.price;
          const nextBump = (prev[id]?.bump || 0) + 1;
          nxt[id] = { price: p, prev: old, bump: nextBump };
        }
        return nxt;
      });

      setLoading(false);
    };

    ws.onclose = () => {
      window.clearTimeout(wsTimeout);
      setWsClosed(true);
    };

    return () => {
      window.clearTimeout(wsTimeout);
      socketRef.current?.close();
    };
  }, [topIds, wsAvailable]);

  /* -------- polling fallback (free tier has NO websocket) -------- */
  useEffect(() => {
    if (wsAvailable) return;
    if (!API_KEY) return;

    const fetchPrices = async () => {
      try {
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=200&apiKey=${API_KEY}`,
        );
        const json = await res.json();

        const upd: Record<string, number> = {};
        const m: Record<string, any> = {};
        const ids: string[] = [];

        (json.data || []).forEach((a: any) => {
          if (!a?.id) return;
          m[a.id] = a;
          ids.push(a.id);

          const p = parseFloat(a.priceUsd);
          if (Number.isFinite(p)) upd[a.id] = p;
        });

        ids.sort((a, b) => (+m[a]?.rank || 9999) - (+m[b]?.rank || 9999));
        setTopIds(ids.slice(0, 200));
        setMetaData((prev) => ({ ...prev, ...m }));

        // ✅ Apply updates + bump counter (forces flash per poll tick)
        setTradeInfoMap((prev) => {
          const nxt = { ...prev };
          for (const [id, p] of Object.entries(upd)) {
            const old = prev[id]?.price;
            const nextBump = (prev[id]?.bump || 0) + 1;
            nxt[id] = { price: p, prev: old, bump: nextBump };
          }
          return nxt;
        });

        setLoading(false);
      } catch {
        setLoading(false);
      }
    };

    fetchPrices();
    const iv = window.setInterval(fetchPrices, 5_000);
    return () => window.clearInterval(iv);
  }, [wsAvailable]);

  /* -------- sorted IDs -------- */
  const sortedIds = useMemo(() => {
    if (topIds.length) return topIds.slice(0, 200);

    const all = Object.keys(tradeInfoMap).sort(
      (a, b) => (+metaData[a]?.rank || 9999) - (+metaData[b]?.rank || 9999),
    );
    return all.slice(0, 200);
  }, [topIds, tradeInfoMap, metaData]);

  /* -------- Metric component (kept though unused) -------- */
  const Metric = ({
    icon,
    label,
    value,
    color = "text-gray-900",
  }: {
    icon: JSX.Element;
    label: string;
    value: string;
    color?: string;
  }) => (
    <div className="flex items-center gap-2 bg-gray-100 p-2 rounded hover:scale-105 transition-transform">
      {icon}
      <div className="flex flex-col">
        <span className="text-[10px] sm:text-xs text-gray-500">{label}</span>
        <span className={`font-semibold ${color} text-xs sm:text-sm`}>
          {value}
        </span>
      </div>
    </div>
  );

  /* -------- loading spinner -------- */
  if (loading)
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="animate-spin h-16 w-16 border-t-4 border-indigo-500 rounded-full" />
      </div>
    );

  return (
    <>
      <div className="p-2 max-w-5xl mx-auto">
        {!wsAvailable && (
          <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded text-center">
            WebSocket unavailable—polling every 5&nbsp;s.
          </div>
        )}

        {/* header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Live Stream Heatmap
          </h2>
          <button
            onClick={() => {
              const next = viewMode === "grid" ? "table" : "grid";
              setViewMode(next);
              trackEvent("CryptoViewToggle", { view: next });
            }}
            className="flex items-center gap-2 bg-brand-gradient border border-gray-300 dark:border-gray-600 text-white px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            {viewMode === "grid" ? (
              <FaTable className="w-5 h-5" />
            ) : (
              <FaThLarge className="w-5 h-5" />
            )}
            <span className="hidden sm:inline text-sm font-medium">
              {viewMode === "grid" ? "Table View" : "Grid View"}
            </span>
          </button>
        </div>

        {/* grid / table */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 lg:grid-cols-5 xl:grid-cols-6">
            {sortedIds.map((id) => {
              const { price, prev, bump } = tradeInfoMap[id] || {};
              const md = metaData[id] || {};

              const pct = parseFloat(String(md.changePercent24Hr ?? ""));
              const pctPos = Number.isFinite(pct) && pct > 0;
              const pctNeg = Number.isFinite(pct) && pct < 0;

              let bg = "bg-gray-300";
              let arrow = "";

              // ✅ Always red/green immediately:
              // If prev exists, use tick direction; else use 24h % sign.
              if (prev != null && price != null) {
                if (price > prev) {
                  bg = "bg-green-500";
                  arrow = "↑";
                } else if (price < prev) {
                  bg = "bg-red-500";
                  arrow = "↓";
                } else {
                  bg = pctPos ? "bg-green-500" : pctNeg ? "bg-red-500" : "bg-gray-300";
                }
              } else {
                bg = pctPos ? "bg-green-500" : pctNeg ? "bg-red-500" : "bg-gray-300";
              }

              const logo = logos[md.symbol?.toLowerCase()];

              const tickPos = prev != null && price != null && price > prev;
              const tickNeg = prev != null && price != null && price < prev;

              return (
                <motion.div
                  key={id}
                  className={`${bg} relative overflow-hidden text-white p-2 sm:p-3 rounded-lg shadow cursor-pointer`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedAsset(md);
                    trackEvent("CryptoAssetClick", { id, ...md });
                  }}
                >
                  {/* ✅ Flash overlay on every tick (or on first render we keep it off) */}
                  {prev != null && price != null && bump != null && bump > 0 && (
                    <motion.div
                      key={`${id}-${bump}`} // forces animation replay per update
                      className="absolute inset-0 rounded-lg pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: [0, 0.55, 0],
                        scale: [1, 1.02, 1],
                      }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      style={{
                        background: tickPos
                          ? "rgba(255,255,255,0.9)"
                          : tickNeg
                            ? "rgba(0,0,0,0.35)"
                            : "transparent",
                        mixBlendMode: "overlay",
                      }}
                    />
                  )}

                  <div className="flex items-center gap-1">
                    <span className="text-[9px] sm:text-xs bg-black/40 px-1 rounded">
                      #{md.rank || "—"}
                    </span>

                    {logo && (
                      <span className="inline-flex items-center justify-center bg-white/90 rounded-full p-[2px]">
                        <img
                          src={logo}
                          alt={md.symbol}
                          className="w-4 h-4 sm:w-5 sm:h-5"
                          loading="lazy"
                        />
                      </span>
                    )}

                    <span
                      className="font-bold text-sm sm:text-lg"
                      title={md.name}
                    >
                      {md.symbol || id}
                    </span>
                  </div>

                  <div className="mt-0.5 text-[11px] sm:text-sm">
                    {formatUSD(price)}{" "}
                    <span className="font-bold">
                      {arrow || (pctPos ? "↑" : pctNeg ? "↓" : "")}
                    </span>
                  </div>

                  <div className="text-[9px] sm:text-xs">
                    {formatPct(md.changePercent24Hr)}
                  </div>
                </motion.div>
              );
            })}
          </div>
       ) : (
  <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-brand-900 shadow-sm">
    <table className="min-w-full divide-y divide-black/5 dark:divide-white/10">
      <thead className="bg-black/[0.03] dark:bg-brand-900">
        <tr>
          {["Rank", "Symbol", "Name", "Price", "24h"].map((h) => (
            <th
              key={h}
              className="px-3 sm:px-4 py-2 text-left text-[10px] sm:text-xs font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>

      <tbody className="divide-y divide-black/5 dark:divide-white/10">
        {sortedIds.map((id) => {
          const md = metaData[id] || {};
          const { price, prev, bump } = tradeInfoMap[id] || {};

          const pct = parseFloat(String(md.changePercent24Hr ?? ""));
          const pctPos = Number.isFinite(pct) && pct > 0;
          const pctNeg = Number.isFinite(pct) && pct < 0;

          const tickPos = price != null && prev != null && price > prev;
          const tickNeg = price != null && prev != null && price < prev;

          // ✅ Always red/green immediately (tick direction if available, else 24h sign)
          const pos = prev != null ? tickPos : pctPos;
          const neg = prev != null ? tickNeg : pctNeg;

          const logo = logos[String(md.symbol ?? "").toLowerCase()];

          return (
            <motion.tr
              key={`${id}-${bump ?? 0}`} // replay flash on bump changes
              className="cursor-pointer transition hover:bg-black/[0.03] dark:hover:bg-white/[0.06]"
              onClick={() => {
                setSelectedAsset(md);
                trackEvent("CryptoAssetClick", { id });
              }}
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
              <td className="px-3 sm:px-4 py-2 text-[11px] sm:text-sm font-semibold text-gray-700 dark:text-white/75">
                {md.rank ?? "—"}
              </td>

              <td className="px-3 sm:px-4 py-2">
                <div className="flex items-center gap-2">
                  {logo ? (
                    <span className="inline-flex items-center justify-center rounded-full bg-white/90 dark:bg-brand-900 p-[2px] ring-1 ring-black/10 dark:ring-white/10">
                      <img
                        src={logo}
                        alt={md.symbol}
                        className="h-5 w-5 sm:h-6 sm:w-6"
                        loading="lazy"
                      />
                    </span>
                  ) : (
                    <span className="h-5 w-5 sm:h-6 sm:w-6 rounded-full  dark:bg-brand-900" />
                  )}

                  <div className="font-extrabold text-[12px] sm:text-sm text-gray-900 dark:text-white">
                    {md.symbol ?? id}
                  </div>
                </div>
              </td>

              <td className="px-3 sm:px-4 py-2">
                <div className="text-[12px] sm:text-sm font-semibold text-gray-800 dark:text-white/80 line-clamp-1">
                  {md.name ?? "—"}
                </div>
              </td>

              <td className="px-3 sm:px-4 py-2 text-[12px] sm:text-sm font-extrabold text-gray-900 dark:text-white">
                {formatUSD(price)}
              </td>

              <td className="px-3 sm:px-4 py-2">
                <div
                  className={[
                    "inline-flex items-center gap-2 text-[12px] sm:text-sm font-extrabold",
                    pos
                      ? "text-green-600 dark:text-green-300"
                      : neg
                        ? "text-red-600 dark:text-red-300"
                        : "text-gray-700 dark:text-white/70",
                  ].join(" ")}
                >
                  <span aria-hidden>
                    {pos ? "↑" : neg ? "↓" : ""}
                  </span>
                  {formatPct(md.changePercent24Hr)}
                </div>
              </td>
            </motion.tr>
          );
        })}

        {sortedIds.length === 0 && (
          <tr>
            <td
              colSpan={5}
              className="px-4 py-4 text-sm text-gray-600 dark:text-white/70"
            >
              No rows to show.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
)}

        {/* shared crypto popup */}
        <CryptoAssetPopup
          asset={selectedAsset}
          logos={logos}
          onClose={() => setSelectedAsset(null)}
          tradeInfo={selectedAsset ? tradeInfoMap[selectedAsset.id] : undefined}
        />
      </div>

      {/* websocket-closed popup */}
      {wsClosed && (
        <div className="fixed inset-0 dark:bg-brand-900 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white dark:bg-brand-900 rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <button
              className="absolute top-4 right-4 text-indigo-500 hover:text-indigo-700 text-xl"
              onClick={() => setWsClosed(false)}
            >
              ×
            </button>
            <h3 className="text-xl font-bold mb-4">WebSocket closed</h3>
            <p className="mb-6">
              The live price stream ended automatically after&nbsp;10&nbsp;minutes.
            </p>
            <button
              className="px-4 py-2 bg-brand-gradient hover:bg-indigo-600 text-white rounded"
              onClick={() => window.location.reload()}
            >
              Start Stream Again
            </button>
          </div>
        </div>
      )}
    </>
  );
}
