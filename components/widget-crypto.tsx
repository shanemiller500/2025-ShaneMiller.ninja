"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
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

const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";

if (!API_KEY) {
  console.error(
    "🚨 Missing CoinCap API key! Please set NEXT_PUBLIC_COINCAP_API_KEY in .env.local and restart your dev server.",
  );
}

const WidgetCrypto: React.FC = () => {
  /* ------------------------------ state ------------------------------ */
  const [metaData, setMetaData] = useState<{ [id: string]: any }>({});
  const [tradeInfoMap, setTradeInfoMap] = useState<
    Record<string, { price: number; prevPrice?: number }>
  >({});
  const socketRef = useRef<WebSocket | null>(null);

  const [logos, setLogos] = useState<Record<string, string>>({});
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<"1" | "7" | "30">("1");
  const [chartLoading, setChartLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);

  /* ---------------------------- marquee ----------------------------- */
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const speed = 50;

  /* ----------------------- format helpers --------------------------- */
  const currencyFmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formatUSD = (v: number | string) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return isNaN(n) ? "—" : currencyFmt.format(n);
  };
  const formatNumber = (v: number | string) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return isNaN(n)
      ? "—"
      : n.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  };
  const formatPercent = (v: number | string) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (isNaN(n)) return "—";
    const sign = n > 0 ? "+" : n < 0 ? "-" : "";
    return `${sign}${Math.abs(n).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}%`;
  };

  /* ---------------------- fetch initial data ------------------------ */
  useEffect(() => {
    if (!API_KEY) return;
    (async () => {
      try {
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=10&apiKey=${API_KEY}`,
        );
        const json = await res.json();
        const map: { [id: string]: any } = {};
        (Array.isArray(json.data) ? json.data : []).forEach((asset: any) => {
          map[asset.id] = asset;
        });
        setMetaData(map);
      } catch (err) {
        console.error("Error fetching metadata:", err);
      }
    })();
  }, []);

  /* ---------------------- preload coin logos ------------------------ */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(COINGECKO_TOP200);
        const data = await res.json();
        const map: Record<string, string> = {};
        data.forEach((c: any) => {
          map[c.symbol.toLowerCase()] = c.image;
        });
        setLogos(map);
      } catch (e) {
        console.error("Error fetching logos:", e);
      }
    })();
  }, []);

  /* ------------------ helper arrays / memoization ------------------- */
  const topAssetIds = useMemo(() => Object.keys(metaData), [metaData]);

  /* ----------------------- seed initial prices ---------------------- */
  useEffect(() => {
    if (topAssetIds.length && !Object.keys(tradeInfoMap).length) {
      const initial: Record<string, { price: number }> = {};
      topAssetIds.forEach((id) => {
        const usd = metaData[id]?.priceUsd;
        if (usd) initial[id] = { price: parseFloat(usd) };
      });
      setTradeInfoMap(initial);
    }
  }, [metaData, topAssetIds]);

  /* ----------------------- live price WebSocket --------------------- */
  useEffect(() => {
    if (!API_KEY || !topAssetIds.length) return;

    const timer = setTimeout(() => {
      socketRef.current = new WebSocket(
        `wss://wss.coincap.io/prices?assets=${topAssetIds.join(
          ",",
        )}&apiKey=${API_KEY}`,
      );

      socketRef.current.onmessage = (evt) => {
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

      socketRef.current.onerror = (err) => console.error("WS error:", err);
    }, 1500);

    return () => {
      clearTimeout(timer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [topAssetIds]);

  /* ----------------------- measure marquee -------------------------- */
  useEffect(() => {
    const measure = () =>
      innerRef.current && setContentWidth(innerRef.current.offsetWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [topAssetIds]);

  /* ----------------------- auto-scroll marquee ----------------------- */
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

  /* -------------------- fetch chart history ------------------------- */
  useEffect(() => {
    if (!selectedAssetId) return;
    chartRef.current?.destroy?.();
    let cancelled = false;
    setChartLoading(true);

    (async () => {
      try {
        const end = Date.now();
        const days = parseInt(timeframe, 10);
        const start = end - days * 86_400_000;
        const res = await fetch(
          `https://rest.coincap.io/v3/assets/${selectedAssetId}/history?interval=m1&start=${start}&end=${end}&apiKey=${API_KEY}`,
        );
        const json = await res.json();
        const points = (json.data || []).map((p: any) => ({
          x: new Date(p.time),
          y: parseFloat(p.priceUsd),
        }));

        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          if (ctx) {
            chartRef.current = new Chart(ctx, {
              type: "line",
              data: { datasets: [{ data: points, fill: true, pointRadius: 0 }] },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { type: "time" }, y: {} },
              },
            });
          }
        }
      } catch (e) {
        console.error("Chart load error:", e);
      } finally {
        if (!cancelled) setTimeout(() => setChartLoading(false), 80);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedAssetId, timeframe]);

  /* ------------------------- helpers UI ----------------------------- */
  const closePopup = useCallback(() => setSelectedAssetId(null), []);
  const selectedAsset = selectedAssetId
    ? { ...metaData[selectedAssetId], id: selectedAssetId }
    : null;

  const renderCard = (id: string) => {
    const md = metaData[id];
    const ti = tradeInfoMap[id] || {};
    const price = ti.price;
    const prev = ti.prevPrice;

    let bg = "bg-gray-300 dark:bg-gray-600";
    if (prev !== undefined) {
      bg =
        price > prev
          ? "bg-green-500 dark:bg-green-700"
          : price < prev
          ? "bg-red-500 dark:bg-red-700"
          : "bg-gray-500 dark:bg-gray-600";
    }

    return (
      <div
        key={id}
        onClick={() => setSelectedAssetId(id)}
        className={`${bg} m-1 p-2 rounded text-white text-center cursor-pointer whitespace-nowrap`}
      >
        <div className="text-xs">#{md?.rank}</div>
        <div className="flex items-center justify-center font-bold text-sm p-1">
          {logos[md?.symbol.toLowerCase()] && (
            <img
              src={logos[md.symbol.toLowerCase()]}
              alt={md.symbol}
              className="w-4 h-4"
            />
          )}
          {md?.symbol.toUpperCase()}
        </div>
        <div className="text-xs">
          {price ? formatUSD(price) : "Loading..."}
        </div>
        <div className="text-xs">{formatPercent(md?.changePercent24Hr)}</div>
      </div>
    );
  };

  /* ---------------------------- render ------------------------------ */
  return (
    <div className="max-w-[700px] overflow-hidden relative">
      {/* ---------- marquee ---------- */}
      <div className="p-2">
        <p className="text-xs text-gray-500 text-center">
          Top 10 Ranked Cryptos
        </p>
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

      {/* ---------- popup ---------- */}
      <AnimatePresence>
        {selectedAsset && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePopup}
          >
            <motion.div
              className="relative bg-white dark:bg-brand-900 p-6 rounded-lg shadow-lg w-full max-w-xs sm:max-w-md max-h-[90vh] overflow-y-auto"
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 32, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={closePopup}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>

              {/* header */}
              <div className="flex items-center gap-2 mb-4">
                {logos[selectedAsset.symbol.toLowerCase()] && (
                  <img
                    src={logos[selectedAsset.symbol.toLowerCase()]}
                    alt={selectedAsset.symbol}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full"
                  />
                )}
                <div>
                  <h3 className="text-xl font-bold">{selectedAsset.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    #{selectedAsset.rank} •{" "}
                    {selectedAsset.symbol.toUpperCase()}
                  </p>
                </div>
              </div>

              {/* timeframe buttons */}
              <div className="flex gap-2 mb-4">
                {[
                  ["1", "1D"],
                  ["7", "7D"],
                  ["30", "30D"],
                ].map(([tf, label]) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf as any)}
                    className={`px-3 py-1 rounded-full ${
                      timeframe === tf
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* chart */}
              <div className="relative w-full h-40 mb-6">
                {chartLoading && (
                  <div className="absolute inset-0 bg-white/50 dark:bg-brand-900/50 flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-4 border-indigo-600 rounded-full border-t-transparent"></div>
                  </div>
                )}
                <canvas ref={canvasRef} className="w-full h-full" />
              </div>

              {/* stats grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {([
                  [
                    FaDollarSign,
                    "Price",
                    formatUSD(tradeInfoMap[selectedAssetId!].price),
                  ],
                  [
                    FaChartLine,
                    "24h %",
                    formatPercent(selectedAsset.changePercent24Hr),
                  ],
                  [
                    FaChartPie,
                    "Market Cap",
                    formatUSD(selectedAsset.marketCapUsd),
                  ],
                  [
                    FaCoins,
                    "24h Vol",
                    formatUSD(selectedAsset.volumeUsd24Hr),
                  ],
                  [
                    FaDatabase,
                    "Supply",
                    formatNumber(selectedAsset.supply),
                  ],
                  [
                    FaWarehouse,
                    "Max Supply",
                    selectedAsset.maxSupply
                      ? formatNumber(selectedAsset.maxSupply)
                      : "—",
                  ],
                  [
                    FaGlobeAmericas,
                    "VWAP 24h",
                    selectedAsset.vwap24Hr
                      ? formatNumber(selectedAsset.vwap24Hr)
                      : "—",
                  ],
                ] as const).map(([Icon, label, value]) => (
                  <div
                    key={label as string}
                    className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded"
                  >
                    {React.createElement(Icon as any)}
                    <div>
                      <span className="text-xs">{label}</span>
                      <br />
                      <span className="font-semibold">{value}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* explorer link */}
              {selectedAsset.explorer &&
                (() => {
                  try {
                    const url = new URL(
                      selectedAsset.explorer.includes("://")
                        ? selectedAsset.explorer
                        : `https://${selectedAsset.explorer}`,
                    );
                    return (
                      <div className="mt-5 text-center">
                        <a
                          href={url.href}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                        >
                          <FaLink />
                          {url.hostname.replace(/^www\./, "")}
                        </a>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WidgetCrypto;
