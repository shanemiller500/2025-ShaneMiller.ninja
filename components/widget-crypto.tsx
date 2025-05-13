"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  JSX,
} from "react";
import { motion, useMotionValue, AnimatePresence } from "framer-motion";
import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import {
  FaDollarSign,
  FaChartLine,
  FaChartPie,
  FaCoins,
  FaDatabase,
  FaWarehouse,
  FaGlobeAmericas,
  FaLink,
} from "react-icons/fa";

/* ------------------------------------------------------------------ */
/*  Shared helpers (currency, percent, etc.)                          */
/* ------------------------------------------------------------------ */
const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});
const usd = (v: number | string | null | undefined) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return n != null && !Number.isNaN(n) ? currencyFmt.format(n) : "—";
};
const compact = (v: number | string | null | undefined) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return n != null && !Number.isNaN(n) ? compactFmt.format(n) : "—";
};
const pct = (v: number | string | null | undefined) =>
  v != null ? `${parseFloat(String(v)).toFixed(2)}%` : "N/A";
const host = (u: string) => {
  try {
    return new URL(u.includes("://") ? u : `https://${u}`)
      .hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/*  Inline CryptoAssetPopup component                                 */
/* ------------------------------------------------------------------ */
type TradeInfo = { price: number; prev?: number };
interface PopupProps {
  asset: any | null;
  logos: Record<string, string>;
  onClose: () => void;
  tradeInfo?: TradeInfo;
}

const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";

function CryptoAssetPopup({
  asset,
  logos,
  onClose,
  tradeInfo,
}: PopupProps) {
  const [timeframe, setTimeframe] = useState<"1" | "7" | "30">("1");
  const [chartLoading, setChartLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const canvasKey = asset ? `${asset.id}-${timeframe}` : "placeholder";

  /* destroy helper */
  const destroyChart = () => {
    chartRef.current?.destroy();
    chartRef.current = null;
    if (canvasRef.current) Chart.getChart(canvasRef.current)?.destroy();
  };

  /* load chart ------------------------------------------------------ */
  useEffect(() => {
    if (!asset) return;

    destroyChart();
    setChartLoading(true);

    const ctrl = new AbortController();
    const { signal } = ctrl;
    const interval =
      timeframe === "1" ? "m1" : timeframe === "7" ? "m30" : "h2";

    (async () => {
      try {
        const end = Date.now();
        const start = end - parseInt(timeframe, 10) * 86_400_000;
        const res = await fetch(
          `https://rest.coincap.io/v3/assets/${asset.id}/history?interval=${interval}&start=${start}&end=${end}&apiKey=${API_KEY}`,
          { signal },
        );
        if (signal.aborted) return;
        const json = await res.json();
        const raw = json.data || [];
        const pts =
          raw.length > 0
            ? raw.map((p: any) => ({
                x: new Date(p.time),
                y: parseFloat(p.priceUsd),
              }))
            : [
                { x: new Date(start), y: parseFloat(asset.priceUsd) },
                { x: new Date(end), y: parseFloat(asset.priceUsd) },
              ];

        if (signal.aborted || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d")!;
        chartRef.current = new Chart(ctx, {
          type: "line",
          data: { datasets: [{ data: pts, fill: true, pointRadius: 0 }] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { type: "time" }, y: {} },
          },
        });
      } catch (e: any) {
        if (e.name !== "AbortError") console.error("Chart load error:", e);
      } finally {
        if (!signal.aborted) setChartLoading(false);
      }
    })();

    return () => {
      ctrl.abort();
      destroyChart();
    };
  }, [asset, timeframe]);

  if (!asset) return null;

  const logo = logos[asset.symbol?.toLowerCase()] ?? null;
  const priceNum =
    tradeInfo?.price != null ? tradeInfo.price : parseFloat(asset.priceUsd);
  const prevNum = tradeInfo?.prev ?? priceNum;
  const priceColor = priceNum >= prevNum ? "text-green-600" : "text-red-600";

  /* tiny metric card */
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

  return (
    <AnimatePresence>
      <motion.div
        key="popup-bg"
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 overflow-y-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          key="popup-card"
          className="relative bg-white dark:bg-brand-900 rounded-lg shadow-lg w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto px-4 py-5 sm:p-6 hover:scale-[1.02] transition-transform"
          initial={{ y: 32, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 32, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* close */}
          <button
            className="absolute top-3 right-4 text-indigo-600 hover:text-indigo-800 text-2xl hover:scale-110 transition-transform"
            onClick={onClose}
          >
            ×
          </button>

          {/* header */}
          <div className="flex items-center gap-2 mb-1">
            {logo && (
              <span className="inline-flex items-center justify-center bg-white/90 rounded-full p-[3px]">
                <img
                  src={logo}
                  alt={asset.symbol}
                  className="w-6 h-6 sm:w-8 sm:h-8"
                />
              </span>
            )}
            <h3 className="text-lg sm:text-2xl font-bold">{asset.name}</h3>
          </div>
          <p className="text-indigo-600 mb-4 text-sm sm:text-base">
            #{asset.rank} • {asset.symbol.toUpperCase()}
          </p>

          {/* timeframe buttons */}
          <div className="flex gap-2 mb-3">
            {([
              ["1", "1D"],
              ["7", "7D"],
              ["30", "30D"],
            ] as const).map(([tf, label]) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  timeframe === tf
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* chart */}
          <div className="relative w-full h-40 sm:h-48 mb-4">
            {chartLoading && (
              <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10">
                <svg
                  className="w-8 h-8 animate-spin text-indigo-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
              </div>
            )}
            <canvas key={canvasKey} ref={canvasRef} className="w-full h-full" />
          </div>

          {/* metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] sm:text-sm">
            <Metric
              icon={<FaDollarSign className="text-indigo-600" />}
              label="Price"
              value={usd(priceNum)}
              color={priceColor}
            />
            <Metric
              icon={<FaChartLine className="text-indigo-600" />}
              label="24h Change"
              value={pct(asset.changePercent24Hr)}
              color={
                parseFloat(asset.changePercent24Hr) >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }
            />
            <Metric
              icon={<FaChartPie className="text-indigo-600" />}
              label="Market Cap"
              value={compact(asset.marketCapUsd)}
            />
            <Metric
              icon={<FaCoins className="text-indigo-600" />}
              label="Volume (24h)"
              value={compact(asset.volumeUsd24Hr)}
            />
            <Metric
              icon={<FaDatabase className="text-indigo-600" />}
              label="Supply"
              value={compact(asset.supply)}
            />
            <Metric
              icon={<FaWarehouse className="text-indigo-600" />}
              label="Max Supply"
              value={asset.maxSupply ? compact(asset.maxSupply) : "—"}
            />
            <Metric
              icon={<FaGlobeAmericas className="text-indigo-600" />}
              label="VWAP (24h)"
              value={asset.vwap24Hr ? compact(asset.vwap24Hr) : "—"}
            />
          </div>

          {/* explorer */}
          {asset.explorer &&
            (() => {
              const h = host(asset.explorer);
              if (!h) return null;
              const href = asset.explorer.includes("://")
                ? asset.explorer
                : `https://${asset.explorer}`;
              return (
                <div className="mt-4 text-center text-[11px] sm:text-sm">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-indigo-600 hover:underline hover:scale-105 transition-transform"
                  >
                    <FaLink />
                    {h}
                  </a>
                </div>
              );
            })()}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  WidgetCrypto main component                                       */
/* ------------------------------------------------------------------ */

const API_KEY_ENV = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";

if (!API_KEY_ENV) {
  console.error(
    "🚨 Missing CoinCap API key! Please set NEXT_PUBLIC_COINCAP_API_KEY in .env.local and restart your dev server.",
  );
}

const WidgetCrypto: React.FC = () => {
  const [metaData, setMetaData] = useState<Record<string, any>>({});
  const [tradeInfoMap, setTradeInfoMap] = useState<
    Record<string, { price: number; prevPrice?: number }>
  >({});
  const socketRef = useRef<WebSocket | null>(null);

  const [logos, setLogos] = useState<Record<string, string>>({});
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  /* marquee motion */
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const speed = 50;

  /* fetch initial CoinCap data */
  useEffect(() => {
    if (!API_KEY_ENV) return;
    (async () => {
      try {
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=10&apiKey=${API_KEY_ENV}`,
        );
        const json = await res.json();
        const map: Record<string, any> = {};
        (json.data || []).forEach((a: any) => (map[a.id] = a));
        setMetaData(map);
      } catch (e) {
        console.error("Error fetching metadata:", e);
      }
    })();
  }, []);

  /* preload logos */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(COINGECKO_TOP200);
        const data = await res.json();
        const map: Record<string, string> = {};
        data.forEach((c: any) => (map[c.symbol.toLowerCase()] = c.image));
        setLogos(map);
      } catch (e) {
        console.error("Logo preload error:", e);
      }
    })();
  }, []);

  const topAssetIds = useMemo(() => Object.keys(metaData), [metaData]);

  /* seed initial prices */
  useEffect(() => {
    if (topAssetIds.length && !Object.keys(tradeInfoMap).length) {
      const initial: Record<string, { price: number }> = {};
      topAssetIds.forEach((id) => {
        const usdPrice = parseFloat(metaData[id]?.priceUsd || "0");
        initial[id] = { price: usdPrice };
      });
      setTradeInfoMap(initial);
    }
  }, [topAssetIds, metaData]);

  /* live price stream */
  useEffect(() => {
    if (!API_KEY_ENV || !topAssetIds.length) return;
    const ws = new WebSocket(
      `wss://wss.coincap.io/prices?assets=${topAssetIds.join(",")}&apiKey=${API_KEY_ENV}`,
    );
    socketRef.current = ws;

    ws.onmessage = (evt) => {
      let data: any;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }
      setTradeInfoMap((prev) => {
        const next = { ...prev };
        Object.entries(data).forEach(([id, priceStr]) => {
          const price = parseFloat(priceStr as string);
          next[id] = { price, prevPrice: prev[id]?.price };
        });
        return next;
      });
    };
    return () => ws.close();
  }, [topAssetIds]);

  /* marquee size */
  useEffect(() => {
    const measure = () =>
      innerRef.current && setContentWidth(innerRef.current.offsetWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [topAssetIds]);

  /* marquee auto-scroll */
  useEffect(() => {
    let raf: number;
    let last: number | null = null;
    const step = (t: number) => {
      if (last === null) last = t;
      const delta = t - last;
      last = t;
      if (!isDragging && contentWidth) {
        let newX = x.get() - speed * (delta / 1000);
        if (newX <= -contentWidth) newX += contentWidth;
        if (newX > 0) newX -= contentWidth;
        x.set(newX);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isDragging, contentWidth, x]);

  /* helpers */
  const closePopup = useCallback(() => setSelectedAssetId(null), []);
  const selectedAsset = selectedAssetId
    ? { ...metaData[selectedAssetId], id: selectedAssetId }
    : null;

  const renderCard = (id: string) => {
    const md = metaData[id];
    const ti = tradeInfoMap[id] || {};
    const price = ti.price;
    const prev = ti.prevPrice;
    let bg = "bg-gray-400 dark:bg-gray-600";
    if (prev !== undefined) {
      bg =
        price > prev
          ? "bg-green-500 dark:bg-green-700"
          : price < prev
          ? "bg-red-500 dark:bg-red-700"
          : "bg-gray-500 dark:bg-gray-600";
    }
    return (
      <motion.div
        key={id}
        onClick={() => setSelectedAssetId(id)}
        className={`${bg} m-1 p-2 rounded text-white text-center cursor-pointer whitespace-nowrap`}
        whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
      >
        <div className="text-xs">#{md?.rank}</div>
        <div className="flex items-center justify-center font-bold text-sm p-1">
          {logos[md?.symbol.toLowerCase()] && (
            <img
              src={logos[md.symbol.toLowerCase()]}
              alt={md.symbol}
              className="w-5 h-5 pr-1"
            />
          )}
          {md?.symbol.toUpperCase()}
        </div>
        <div className="text-xs">{usd(price)}</div>
        <div className="text-xs">{pct(md?.changePercent24Hr)}</div>
      </motion.div>
    );
  };

  /* render widget --------------------------------------------------- */
  return (
    <div className="max-w-[700px] overflow-hidden relative">
      <div className="p-2">
        <p className="text-xs text-gray-500 text-center">Top 10 Ranked Cryptos</p>
      </div>

      <motion.div
        className="flex cursor-grab"
        style={{ x }}
        drag="x"
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => {
          setIsDragging(false);
          const mod = (n: number, m: number) => ((n % m) + m) % m;
          x.set(-mod(-x.get(), contentWidth));
        }}
      >
        <div className="flex" ref={innerRef}>
          {topAssetIds.map(renderCard)}
        </div>
        <div className="flex">{topAssetIds.map(renderCard)}</div>
      </motion.div>

      <div className="p-2">
        <p className="text-xs text-gray-500 text-center">
          See more{" "}
          <a href="/Crypto" className="underline text-indigo-500">
            here
          </a>
          .
        </p>
      </div>

      {/* popup */}
      <CryptoAssetPopup
        asset={selectedAsset}
        logos={logos}
        onClose={closePopup}
        tradeInfo={selectedAsset ? tradeInfoMap[selectedAsset.id] : undefined}
      />
    </div>
  );
};

export default WidgetCrypto;
