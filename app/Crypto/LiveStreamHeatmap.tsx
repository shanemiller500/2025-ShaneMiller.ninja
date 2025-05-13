"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  JSX,
  useCallback,
} from "react";
import { motion } from "framer-motion";
import {

  FaTable,
  FaThLarge,
} from "react-icons/fa";
import { trackEvent } from "@/utils/mixpanel";
import CryptoAssetPopup from "@/utils/CryptoAssetPopup"; // <-- new import

/* ---------- helpers ---------- */
const formatValue = (v: any) => {
  const n = parseFloat(v);
  return isNaN(n)
    ? "N/A"
    : n.toLocaleString("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
};

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
const shortenUrl = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

/* ---------- API constants ---------- */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";

export default function LiveStreamHeatmap() {
  /* ---------- core state ---------- */
  const [tradeInfoMap, setTradeInfoMap] = useState<
    Record<string, { price: number; prev?: number }>
  >({});
  const [metaData, setMetaData] = useState<Record<string, any>>({});
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
          const k = c.symbol.toLowerCase();
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

  /* -------- fetch CoinCap metadata -------- */
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!API_KEY) return;
      const res = await fetch(
        `https://rest.coincap.io/v3/assets?limit=201&apiKey=${API_KEY}`,
      );
      if (res.status === 403) {
        setWsAvailable(false);
        setLoading(false);
        return;
      }
      const json = await res.json();
      if (canceled) return;
      const m: Record<string, any> = {};
      (json.data || []).forEach((a: any) => (m[a.id] = a));
      setMetaData(m);
    })();
    return () => {
      canceled = true;
    };
  }, []);

  /* -------- websocket stream -------- */
  useEffect(() => {
    if (!API_KEY || !Object.keys(metaData).length || !wsAvailable) return;

    const ws = new WebSocket(
      `wss://wss.coincap.io/prices?assets=ALL&apiKey=${API_KEY}`,
    );
    socketRef.current = ws;

    const wsTimeout = setTimeout(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    }, 300_000);

    ws.onmessage = (e) => {
      if (typeof e.data === "string" && e.data.startsWith("Unauthorized")) {
        setWsAvailable(false);
        ws.close();
        setLoading(false);
        return;
      }
      let up;
      try {
        up = JSON.parse(e.data);
      } catch {
        return;
      }
      setTradeInfoMap((prev) => {
        const nxt = { ...prev };
        Object.entries(up).forEach(([id, ps]) => {
          if (!metaData[id] || +metaData[id].rank > 200) return;
          const p = parseFloat(ps as string);
          nxt[id] = { price: p, prev: prev[id]?.price };
        });
        return nxt;
      });
      setLoading(false);
    };

    ws.onclose = () => {
      clearTimeout(wsTimeout);
      setWsClosed(true);
    };

    return () => {
      clearTimeout(wsTimeout);
      socketRef.current?.close();
    };
  }, [metaData, wsAvailable]);

  /* -------- polling fallback -------- */
  useEffect(() => {
    if (wsAvailable) return;
    const fetchPrices = async () => {
      const res = await fetch(
        `https://rest.coincap.io/v3/assets?limit=201&apiKey=${API_KEY}`,
      );
      const json = await res.json();
      const upd: Record<string, any> = {};
      (json.data || []).forEach((a: any) => (upd[a.id] = a.priceUsd));
      setTradeInfoMap((prev) => {
        const nxt = { ...prev };
        Object.entries(upd).forEach(([id, ps]) => {
          const p = parseFloat(ps as string);
          nxt[id] = { price: p, prev: prev[id]?.price };
        });
        return nxt;
      });
      setLoading(false);
    };
    fetchPrices();
    const iv = setInterval(fetchPrices, 10_000);
    return () => clearInterval(iv);
  }, [wsAvailable]);

  /* -------- sorted IDs -------- */
  const sortedIds = useMemo(() => {
    const all = Object.keys(tradeInfoMap).sort(
      (a, b) => (+metaData[a]?.rank || 9999) - (+metaData[b]?.rank || 9999),
    );
    return all.slice(0, 200);
  }, [tradeInfoMap, metaData]);

  /* -------- Metric component -------- */
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
        <span className={`font-semibold ${color} text-xs sm:text-sm`}>{value}</span>
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
      <div className="p-4 max-w-5xl mx-auto">
        {!wsAvailable && (
          <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded text-center">
            WebSocket unavailable—polling every 10&nbsp;s.
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
            className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-white px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            {viewMode === "grid" ? <FaTable className="w-5 h-5" /> : <FaThLarge className="w-5 h-5" />}
            <span className="hidden sm:inline text-sm font-medium">
              {viewMode === "grid" ? "Table View" : "Grid View"}
            </span>
          </button>
        </div>

        {/* grid / table */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 lg:grid-cols-5 xl:grid-cols-6">
            {sortedIds.map((id) => {
              const { price, prev } = tradeInfoMap[id] || {};
              const md = metaData[id] || {};
              let bg = "bg-gray-300",
                arrow = "";
              if (prev != null) {
                if (price > prev) (bg = "bg-green-500"), (arrow = "↑");
                else if (price < prev) (bg = "bg-red-500"), (arrow = "↓");
              }
              const logo = logos[md.symbol?.toLowerCase()];
              return (
                <motion.div
                  key={id}
                  className={`${bg} text-white p-2 sm:p-3 rounded-lg shadow cursor-pointer`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedAsset(md);
                    trackEvent("CryptoAssetClick", { id, ...md });
                  }}
                >
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
                    <span className="font-bold text-sm sm:text-lg" title={md.name}>
                      {md.symbol || id}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] sm:text-sm">
                    {formatUSD(price)} <span className="font-bold">{arrow}</span>
                  </div>
                  <div className="text-[9px] sm:text-xs">{formatPct(md.changePercent24Hr)}</div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-100 text-brand-900">
                <tr>
                  {["Rank", "Symbol", "Name", "Price (USD)", "24 h %"].map((h) => (
                    <th
                      key={h}
                      className="px-2 sm:px-4 py-1 sm:py-2 uppercase text-[9px] sm:text-xs text-left"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedIds.map((id) => {
                  const md = metaData[id] || {};
                  const { price, prev } = tradeInfoMap[id] || {};
                  const pos = price != null && prev != null && price > prev;
                  const neg = price != null && prev != null && price < prev;
                  const bgRow = pos
                    ? "bg-green-500"
                    : neg
                    ? "bg-red-500"
                    : "bg-white dark:bg-brand-900";
                  const textColor = pos || neg ? "text-white" : "text-gray-900 dark:text-white";
                  const logo = logos[md.symbol?.toLowerCase()];
                  return (
                    <tr
                      key={id}
                      className={`${bgRow} ${textColor} transition-transform duration-200 ease-out hover:scale-105 cursor-pointer`}
                      onClick={() => {
                        setSelectedAsset(md);
                        trackEvent("CryptoAssetClick", { id });
                      }}
                    >
                      <td className="px-2 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-sm">{md.rank}</td>
                      <td className="px-2 sm:px-4 py-1 sm:py-2 flex items-center gap-1 font-semibold text-[11px] sm:text-sm">
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
                        {md.symbol}
                      </td>
                      <td className="px-2 sm:px-4 py-1 sm:py-2 italic text-[11px] sm:text-sm">
                        {md.name}
                      </td>
                      <td className="px-2 sm:px-4 py-1 sm:py-2 text-[11px] sm:text-sm">
                        {formatUSD(price)}
                      </td>
                      <td
                        className={`px-2 sm:px-4 py-1 sm:py-2 text-[11px] sm:text-sm ${
                          pos ? "text-green-700" : neg ? "text-red-700" : ""
                        }`}
                      >
                        {formatPct(md.changePercent24Hr)} {pos ? "↑" : neg ? "↓" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* shared crypto popup */}
        <CryptoAssetPopup
          asset={selectedAsset}
          logos={logos}
          onClose={() => setSelectedAsset(null)}
          tradeInfo={
            selectedAsset ? tradeInfoMap[selectedAsset.id] : undefined
          }
        />
      </div>

      {/* websocket-closed popup (unchanged) */}
      {wsClosed && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white dark:bg-brand-900 rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <button
              className="absolute top-4 right-4 text-indigo-500 hover:text-indigo-700 text-xl"
              onClick={() => setWsClosed(false)}
            >
              ×
            </button>
            <h3 className="text-xl font-bold mb-4">WebSocket closed</h3>
            <p className="mb-6">
              The live price stream ended automatically after&nbsp;5&nbsp;minutes.
            </p>
            <button
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded"
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
