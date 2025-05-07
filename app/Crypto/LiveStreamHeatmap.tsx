"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  JSX,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import {
  FaDollarSign,
  FaChartLine,
  FaCoins,
  FaDatabase,
  FaWarehouse,
  FaChartPie,
  FaGlobeAmericas,
  FaLink,
  FaTable,
  FaThLarge,
} from "react-icons/fa";
import { trackEvent } from "@/utils/mixpanel";

/* ------------- helpers ------------- */
const formatValue = (v: any) =>
  isNaN(+v)
    ? "N/A"
    : (+v).toLocaleString("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });

const formatPrice = (v: any) => {
  const n = +v;
  if (isNaN(n)) return "N/A";
  if (n > 0 && n < 0.01) return n.toString();
  return formatValue(v);
};

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});
const formatUSD = (v: number | null | undefined) =>
  v != null ? currencyFmt.format(v) : "—";
const formatCompact = (v: number | null | undefined) =>
  v != null ? compactFmt.format(v) : "N/A";
const formatPct = (s: any) =>
  s != null ? `${parseFloat(String(s)).toFixed(2)}%` : "N/A";
const shortenUrl = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

/* ------------- API constants ------------- */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";

/* =================================================================== */
export default function LiveStreamHeatmap() {
  const [tradeInfoMap, setTradeInfoMap] = useState<
    Record<string, { price: number; prev?: number }>
  >({});
  const [metaData, setMetaData] = useState<Record<string, any>>({});
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsAvailable, setWsAvailable] = useState(true);
  const [wsClosed, setWsClosed] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [logos, setLogos] = useState<Record<string, string>>({}); // symbol → img
  const [cgInfo, setCgInfo] = useState<Record<string, { high: number; low: number }>>(
    {}
  );

  const socketRef = useRef<WebSocket | null>(null);

  /* chart refs */
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<any>(null);

  /* ------------ preload CoinGecko logos ------------- */
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

  /* ------------ fetch metadata ------------- */
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!API_KEY) return;
      const res = await fetch(
        `https://rest.coincap.io/v3/assets?limit=201&apiKey=${API_KEY}`
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

  /* ------------ websocket stream ------------- */
  useEffect(() => {
    if (!API_KEY || !Object.keys(metaData).length || !wsAvailable) return;

    const ws = new WebSocket(
      `wss://wss.coincap.io/prices?assets=ALL&apiKey=${API_KEY}`
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

  /* ------------ polling fallback ------------- */
  useEffect(() => {
    if (wsAvailable) return;
    const fetchPrices = async () => {
      const res = await fetch(
        `https://rest.coincap.io/v3/assets?limit=201&apiKey=${API_KEY}`
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

  /* ------------ sorted ids (top 200) ------------- */
  const sortedIds = useMemo(() => {
    const all = Object.keys(tradeInfoMap).sort(
      (a, b) => (+metaData[a]?.rank || 9999) - (+metaData[b]?.rank || 9999)
    );
    return all.slice(0, 200);
  }, [tradeInfoMap, metaData]);

  /* ------------ 24-hour chart ------------- */
  useEffect(() => {
    if (!selectedAsset) return;
    (async () => {
      chartInstanceRef.current?.destroy?.();
      const end = Date.now();
      const start = end - 864e5;
      const res = await fetch(
        `https://rest.coincap.io/v3/assets/${selectedAsset.id}/history?interval=m1&start=${start}&end=${end}&apiKey=${API_KEY}`
      );
      const json = await res.json();
      const data = (json.data || []).map((p: any) => ({
        x: new Date(p.time),
        y: +p.priceUsd,
      }));
      const ctx = canvasRef.current!.getContext("2d")!;
      chartInstanceRef.current = new Chart(ctx, {
        type: "line",
        data: {
          datasets: [
            {
              data,
              borderColor: "#84e2ff",
              backgroundColor: "rgba(84,75,255,.6)",
              pointRadius: 0,
              fill: true,
            },
          ],
        },
        options: {
          scales: { x: { type: "time" }, y: {} },
          plugins: { legend: { display: false } },
          elements: { line: { tension: 0.3 } },
          maintainAspectRatio: false,
        },
      });
    })();
  }, [selectedAsset]);

  /* ------------ metric widget ------------- */
  const Metric = ({
    icon,
    label,
    value,
    valueColor = "text-gray-900",
  }: {
    icon: JSX.Element;
    label: string;
    value: string;
    valueColor?: string;
  }) => (
    <div className="flex items-center gap-2 bg-gray-100 p-2 rounded">
      {icon}
      <div className="flex flex-col">
        <span className="text-xs text-gray-500">{label}</span>
        <span className={`font-semibold ${valueColor}`}>{value}</span>
      </div>
    </div>
  );

  /* ------------ table rows ------------- */
  const TableRows = ({ rows }: { rows: string[] }) =>
    rows.map((id) => {
      const md = metaData[id] || {};
      const { price, prev } = tradeInfoMap[id] || {};
      const pos = price != null && prev != null && price > prev;
      const neg = price != null && prev != null && price < prev;
      const bgRow =
        pos ? "bg-green-500" : neg ? "bg-red-500" : "bg-white dark:bg-gray-400";
      const logo = logos[md.symbol?.toLowerCase()];

      return (
        <tr
          key={id}
          className={`${bgRow} hover:bg-gray-50 hover:text-brand-900 dark:hover:text-gray-50 dark:hover:bg-gray-600 cursor-pointer text-white shadow-[0_0_2px_white] dark:text-brand-900`}
          onClick={() => {
            setSelectedAsset(md);
            trackEvent("CryptoAssetClick", { id });
          }}
        >
          <td className="px-2 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-sm">
            {md.rank}
          </td>
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
              pos ? "text-green-700" : "text-red-700"
            }`}
          >
            {formatPct(md.changePercent24Hr)} {pos ? "↑" : neg ? "↓" : ""}
          </td>
        </tr>
      );
    });

  /* ------------ loading ------------- */
  if (loading)
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
        <div className="animate-spin h-16 w-16 border-t-4 border-indigo-500 rounded-full" />
      </div>
    );

  /* ------------ render ------------- */
  return (
    <>
      <div className="p-4 max-w-5xl mx-auto">
        {!wsAvailable && (
          <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded text-center">
            WebSocket unavailable—polling every 10&nbsp;s.
          </div>
        )}

        {/* header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Live Stream Heatmap</h2>
          <button
            onClick={() => {
              const next = viewMode === "grid" ? "table" : "grid";
              setViewMode(next);
              trackEvent("CryptoViewToggle", { view: next });
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded"
          >
            {viewMode === "grid" ? <FaTable /> : <FaThLarge />}
            <span className="hidden sm:inline">
              {viewMode === "grid" ? "Table" : "Grid"}
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
                    <span
                      className="font-bold text-sm sm:text-lg"
                      title={md.name}
                    >
                      {md.symbol || id}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] sm:text-sm">
                    {formatUSD(price)}{" "}
                    <span className="font-bold">{arrow}</span>
                  </div>
                  <div className="text-[9px] sm:text-xs">
                    {formatPct(md.changePercent24Hr)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-100 text-brand-900">
                <tr>
                  {["Rank", "Symbol", "Name", "Price (USD)", "24 h %"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-2 sm:px-4 py-1 sm:py-2 uppercase text-[9px] sm:text-xs text-left"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                <TableRows rows={sortedIds} />
              </tbody>
            </table>
          </div>
        )}

        {/* popup */}
        <AnimatePresence>
          {selectedAsset && (
            <motion.div
              className="fixed inset-0 bg-black/60 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAsset(null)}
            >
              <motion.div
                className="relative bg-white dark:bg-brand-900 rounded-xl shadow-xl w-full sm:max-w-md max-h-[90vh] h-full sm:h-auto p-6 pb-8 overflow-y-auto"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* close */}
                <button
                  className="absolute top-4 right-4 text-indigo-500 hover:text-indigo-700 text-xl"
                  onClick={() => setSelectedAsset(null)}
                >
                  ×
                </button>

                {/* header with logo */}
                <div className="flex items-center gap-2 mb-1">
                  {logos[selectedAsset.symbol.toLowerCase()] && (
                    <span className="inline-flex items-center justify-center bg-white/90 rounded-full p-[3px]">
                      <img
                        src={logos[selectedAsset.symbol.toLowerCase()]}
                        alt={selectedAsset.symbol}
                        className="w-6 h-6 sm:w-8 sm:h-8"
                      />
                    </span>
                  )}
                  <h3 className="text-2xl font-bold">{selectedAsset.name}</h3>
                </div>
                <p className="text-indigo-500 mb-4">
                  {selectedAsset.symbol.toUpperCase()} • Rank{" "}
                  {selectedAsset.rank}
                </p>

                {/* chart */}
                <div className="w-full h-48 mb-4">
                  <canvas ref={canvasRef} className="w-full h-full" />
                </div>

                {/* metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <Metric
                    icon={<FaDollarSign className="text-indigo-500" />}
                    label="Price"
                    value={formatUSD(tradeInfoMap[selectedAsset.id]?.price)}
                    valueColor={
                      (tradeInfoMap[selectedAsset.id]?.price ?? 0) >=
                      (tradeInfoMap[selectedAsset.id]?.prev ?? 0)
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  />
                  <Metric
                    icon={<FaChartLine className="text-indigo-500" />}
                    label="24 h Change"
                    value={formatPct(selectedAsset.changePercent24Hr)}
                    valueColor={
                      +selectedAsset.changePercent24Hr >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }
                  />
                  <Metric
                    icon={<FaChartLine className="text-green-600" />}
                    label="High 24 h"
                    value={formatUSD(
                      cgInfo[selectedAsset.symbol.toLowerCase()]?.high
                    )}
                    valueColor="text-green-600"
                  />
                  <Metric
                    icon={<FaChartLine className="text-red-600 rotate-180" />}
                    label="Low 24 h"
                    value={formatUSD(
                      cgInfo[selectedAsset.symbol.toLowerCase()]?.low
                    )}
                    valueColor="text-red-600"
                  />
                  <Metric
                    icon={<FaChartPie className="text-indigo-500" />}
                    label="Market Cap"
                    value={formatCompact(+selectedAsset.marketCapUsd)}
                  />
                  <Metric
                    icon={<FaCoins className="text-indigo-500" />}
                    label="Volume (24 h)"
                    value={formatCompact(+selectedAsset.volumeUsd24Hr)}
                  />
                  <Metric
                    icon={<FaDatabase className="text-indigo-500" />}
                    label="Supply"
                    value={formatCompact(+selectedAsset.supply)}
                  />
                  <Metric
                    icon={<FaWarehouse className="text-indigo-500" />}
                    label="Max Supply"
                    value={formatCompact(+selectedAsset.maxSupply || 0)}
                  />
                </div>

                {/* explorer */}
                {selectedAsset.explorer && (
                  <div className="mt-4 text-center text-sm">
                    <a
                      href={selectedAsset.explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-indigo-600 hover:underline"
                    >
                      <FaLink className="text-indigo-500" />
                      {shortenUrl(selectedAsset.explorer)}
                    </a>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* websocket-closed popup */}
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
