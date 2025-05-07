"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  JSX,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import { trackEvent } from "@/utils/mixpanel";

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
const formatPrice = (v: any) => {
  const n = parseFloat(v);
  if (isNaN(n)) return "N/A";
  if (n > 0 && n < 0.01) return n.toString();
  return formatValue(v);
};

/* ---------- API constants ---------- */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";

/* =================================================================== */
export default function TopGainersLosers() {
  const [cryptoData, setCryptoData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [logos, setLogos] = useState<Record<string, string>>({}); // symbol → img

  /* chart refs */
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<any>(null);

  /* -------- preload CoinGecko logos (once) -------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(COINGECKO_TOP200);
        const json = await res.json();
        const map: Record<string, string> = {};
        json.forEach((c: any) => {
          map[c.symbol.toLowerCase()] = c.image;
        });
        setLogos(map);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  /* -------- fetch CoinCap prices every 15 s -------- */
  useEffect(() => {
    if (!API_KEY) return;

    const load = async () => {
      try {
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=200&apiKey=${API_KEY}`
        );
        const json = await res.json();
        setCryptoData(Array.isArray(json.data) ? json.data : []);
      } catch (e) {
        console.error("CoinCap fetch error:", e);
        setCryptoData([]);
      } finally {
        setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  /* ------------ derived lists ------------- */
  const sorted = useMemo(
    () =>
      [...cryptoData].sort(
        (a, b) =>
          parseFloat(b.changePercent24Hr) - parseFloat(a.changePercent24Hr)
      ),
    [cryptoData]
  );

  const topGainers = sorted.slice(0, 15);
  const topLosers = sorted.slice(-15).reverse();

  /* ------------ popup chart -------------- */
  useEffect(() => {
    if (!selectedAsset) return;

    chartRef.current?.destroy?.();

    (async () => {
      const end = Date.now();
      const start = end - 864e5;
      const res = await fetch(
        `https://rest.coincap.io/v3/assets/${selectedAsset.id}/history?interval=m1&start=${start}&end=${end}&apiKey=${API_KEY}`
      );
      const json = await res.json();
      const points = (json.data || []).map((p: any) => ({
        x: new Date(p.time),
        y: parseFloat(p.priceUsd),
      }));

      const ctx = canvasRef.current!.getContext("2d")!;
      chartRef.current = new Chart(ctx, {
        type: "line",
        data: {
          datasets: [
            {
              data: points,
              borderColor: "#84e2ff",
              backgroundColor: "rgba(84,75,255,.6)",
              pointRadius: 0,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { type: "time" }, y: {} },
        },
      });
    })();
  }, [selectedAsset]);

  /* ------------- mixpanel + close handler ------------- */
  useEffect(() => {
    if (selectedAsset)
      trackEvent("CryptoAssetPopupOpen", { id: selectedAsset.id });
  }, [selectedAsset]);

  const closePopup = useCallback(() => {
    if (selectedAsset)
      trackEvent("CryptoAssetPopupClose", { id: selectedAsset.id });
    setSelectedAsset(null);
  }, [selectedAsset]);

  /* --------------- UI helpers --------------- */
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
    <div className="flex items-center gap-2 bg-gray-100 p-2 rounded">
      {icon}
      <div className="flex flex-col">
        <span className="text-[10px] sm:text-xs text-gray-500">{label}</span>
        <span className={`font-semibold ${color} text-xs sm:text-sm`}>
          {value}
        </span>
      </div>
    </div>
  );

  /* ------------- table row --------------- */
  const TableRows = ({ rows }: { rows: any[] }) =>
    rows.map((c) => {
      const pos = parseFloat(c.changePercent24Hr) >= 0;
      const logo = logos[c.symbol.toLowerCase()];
      return (
        <tr
          key={c.id}
          className="hover:bg-gray-50 dark:hover:bg-indigo-500 cursor-pointer"
          onClick={() => {
            setSelectedAsset(c);
            trackEvent("CryptoAssetClick", { id: c.id });
          }}
        >
          <td className="px-2 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-sm">
            {c.rank}
          </td>
          <td className="px-2 sm:px-4 py-1 sm:py-2 flex items-center gap-1 font-semibold text-[11px] sm:text-sm">
            {logo && (
              <span className="inline-flex items-center justify-center bg-white/90 rounded-full p-[2px]">
                <img
                  src={logo}
                  alt={c.symbol}
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  loading="lazy"
                />
              </span>
            )}
            {c.symbol}
          </td>
          <td className="px-2 sm:px-4 py-1 sm:py-2 italic text-[11px] sm:text-sm">
            {c.name}
          </td>
          <td className="px-2 sm:px-4 py-1 sm:py-2 text-[11px] sm:text-sm">
            ${formatPrice(c.priceUsd)}
          </td>
          <td
            className={`px-2 sm:px-4 py-1 sm:py-2 text-[11px] sm:text-sm ${
              pos ? "text-green-600" : "text-red-600"
            }`}
          >
            {formatValue(c.changePercent24Hr)}% {pos ? "↑" : "↓"}
          </td>
        </tr>
      );
    });

  /* ------------- grid card --------------- */
  const GridCards = ({ rows }: { rows: any[] }) =>
    rows.map((c) => {
      const change = parseFloat(c.changePercent24Hr);
      const bg =
        change > 0
          ? "bg-green-500"
          : change < 0
          ? "bg-red-500"
          : "bg-gray-400";
      const logo = logos[c.symbol.toLowerCase()];
      return (
        <motion.div
          key={c.id}
          className={`${bg} text-white p-2 sm:p-3 rounded-lg shadow cursor-pointer`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setSelectedAsset(c);
            trackEvent("CryptoAssetClick", { id: c.id });
          }}
        >
          <div className="flex items-center gap-1">
            <span className="text-[9px] sm:text-xs bg-black/40 px-1 rounded">
              #{c.rank}
            </span>
            {logo && (
              <span className="inline-flex items-center justify-center bg-white/90 rounded-full p-[2px]">
                <img
                  src={logo}
                  alt={c.symbol}
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  loading="lazy"
                />
              </span>
            )}
            <span className="font-bold text-sm sm:text-lg">{c.symbol}</span>
          </div>
          <div className="mt-0.5 text-[11px] sm:text-sm">
            ${formatPrice(c.priceUsd)}
          </div>
          <div className="text-[9px] sm:text-xs opacity-80">
            {formatValue(change)}%
          </div>
        </motion.div>
      );
    });

  /* --------------- render --------------- */
  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading crypto data…</p>
      </div>
    );

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-5xl mx-auto">
        {/* header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">
            Crypto Market Movers
          </h1>
          <button
            onClick={() => {
              const nxt = viewMode === "table" ? "grid" : "table";
              setViewMode(nxt);
              trackEvent("CryptoViewToggle", { view: nxt });
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 sm:px-4 rounded"
          >
            {viewMode === "table" ? <FaThLarge /> : <FaTable />}
            <span className="hidden sm:inline">
              {viewMode === "table" ? "Grid" : "Table"}
            </span>
          </button>
        </div>

        {/* table / grid */}
        {viewMode === "table" ? (
          <>
            {["Top 15 Gainers", "Top 15 Losers"].map((title, idx) => (
              <section className="mb-8" key={title}>
                <h2 className="font-semibold text-lg sm:text-xl mb-1">
                  {title}
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-100 text-brand-900">
                      <tr>
                        {["Rank", "Symbol", "Name", "Price (USD)", "24h %"].map(
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
                      <TableRows rows={idx === 0 ? topGainers : topLosers} />
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="font-semibold text-lg sm:text-xl mb-3">
                Top 15 Gainers
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <GridCards rows={topGainers} />
              </div>
            </section>

            <section className="mb-8">
              <h2 className="font-semibold text-lg sm:text-xl mb-3">
                Top 15 Losers
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <GridCards rows={topLosers} />
              </div>
            </section>
          </>
        )}

        {/* popup */}
        <AnimatePresence>
          {selectedAsset && (
            <motion.div
              className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePopup}
            >
              <motion.div
                className="relative bg-white dark:bg-brand-900 rounded-lg shadow-lg w-full max-w-sm sm:max-w-md px-4 py-5 sm:p-6 overflow-y-auto max-h-[90vh]"
                initial={{ y: 32, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 32, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* close */}
                <button
                  className="absolute top-3 right-4 text-indigo-600 hover:text-indigo-800 text-2xl"
                  onClick={closePopup}
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
                  <h3 className="text-lg sm:text-2xl font-bold">
                    {selectedAsset.name}
                  </h3>
                </div>
                <p className="text-indigo-600 mb-4 text-sm sm:text-base">
                  #{selectedAsset.rank} • {selectedAsset.symbol.toUpperCase()}
                </p>

                {/* 24-hour chart */}
                <div className="w-full h-40 sm:h-48 mb-4">
                  <canvas ref={canvasRef} className="w-full h-full" />
                </div>

                {/* metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] sm:text-sm">
                  <Metric
                    icon={<FaDollarSign className="text-indigo-600" />}
                    label="Price"
                    value={`$${formatPrice(selectedAsset.priceUsd)}`}
                    color={
                      parseFloat(selectedAsset.changePercent24Hr) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  />
                  <Metric
                    icon={<FaChartLine className="text-indigo-600" />}
                    label="24h Change"
                    value={`${formatValue(selectedAsset.changePercent24Hr)}%`}
                    color={
                      parseFloat(selectedAsset.changePercent24Hr) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  />
                  <Metric
                    icon={<FaChartPie className="text-indigo-600" />}
                    label="Market Cap"
                    value={`$${formatValue(selectedAsset.marketCapUsd)}`}
                  />
                  <Metric
                    icon={<FaCoins className="text-indigo-600" />}
                    label="Volume (24h)"
                    value={`$${formatValue(selectedAsset.volumeUsd24Hr)}`}
                  />
                  <Metric
                    icon={<FaDatabase className="text-indigo-600" />}
                    label="Supply"
                    value={formatValue(selectedAsset.supply)}
                  />
                  <Metric
                    icon={<FaWarehouse className="text-indigo-600" />}
                    label="Max Supply"
                    value={
                      selectedAsset.maxSupply
                        ? formatValue(selectedAsset.maxSupply)
                        : "N/A"
                    }
                  />
                  <Metric
                    icon={<FaGlobeAmericas className="text-indigo-600" />}
                    label="VWAP (24h)"
                    value={
                      selectedAsset.vwap24Hr
                        ? formatValue(selectedAsset.vwap24Hr)
                        : "N/A"
                    }
                  />
                </div>

                {/* explorer */}
                {selectedAsset.explorer && (
                  <div className="mt-4 text-center text-[11px] sm:text-sm">
                    <a
                      href={selectedAsset.explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-indigo-600 hover:underline"
                    >
                      <FaLink />
                      {new URL(selectedAsset.explorer).hostname.replace(/^www\./, "")}
                    </a>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
