"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  JSX,
} from "react";
import { motion } from "framer-motion";
import {
  FaTable,
  FaThLarge,
} from "react-icons/fa";
import { trackEvent } from "@/utils/mixpanel";
import CryptoAssetPopup from "../../utils/CryptoAssetPopup"; // <-- new import

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

/* ---------- API constants ---------- */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";

export default function TopGainersLosers() {
  const [cryptoData, setCryptoData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [logos, setLogos] = useState<Record<string, string>>({});

  /* -------- preload CoinGecko logos -------- */
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

  /* -------- fetch CoinCap prices every 15s -------- */
  useEffect(() => {
    if (!API_KEY) return;
    const load = async () => {
      try {
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=200&apiKey=${API_KEY}`,
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
          parseFloat(b.changePercent24Hr) - parseFloat(a.changePercent24Hr),
      ),
    [cryptoData],
  );
  const topGainers = sorted.slice(0, 15);
  const topLosers = sorted.slice(-15).reverse();

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
    <div className="flex items-center gap-2 bg-gray-100 p-2 rounded hover:scale-105 transition-transform">
      {icon}
      <div className="flex flex-col">
        <span className="text-[10px] sm:text-xs text-gray-500">{label}</span>
        <span className={`font-semibold ${color} text-xs sm:text-sm`}>{value}</span>
      </div>
    </div>
  );

  const TableRows = ({ rows }: { rows: any[] }) =>
    rows.map((c) => {
      const pos = parseFloat(c.changePercent24Hr) >= 0;
      const logo = logos[c.symbol.toLowerCase()];
      return (
        <tr
          key={c.id}
          className="transition-transform duration-200 ease-in hover:scale-95 cursor-pointer"
          onClick={() => {
            setSelectedAsset(c);
            trackEvent("CryptoAssetClick", { id: c.id });
          }}
        >
          <td className="px-2 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-sm">{c.rank}</td>
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
            {formatUSD(c.priceUsd)}
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

  const GridCards = ({ rows }: { rows: any[] }) =>
    rows.map((c) => {
      const change = parseFloat(c.changePercent24Hr);
      const bg =
        change > 0 ? "bg-green-500" : change < 0 ? "bg-red-500" : "bg-gray-400";
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
          <div className="mt-0.5 text-[11px] sm:text-sm">{formatUSD(c.priceUsd)}</div>
          <div className="text-[9px] sm:text-xs opacity-80">
            {formatValue(change)}%
          </div>
        </motion.div>
      );
    });

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
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Crypto Market Movers
          </h1>
          <button
            onClick={() => {
              const next = viewMode === "table" ? "grid" : "table";
              setViewMode(next);
              trackEvent("CryptoViewToggle", { view: next });
            }}
            className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-white px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            {viewMode === "table" ? <FaThLarge className="w-5 h-5" /> : <FaTable className="w-5 h-5" />}
            <span className="hidden sm:inline text-sm font-medium">
              {viewMode === "table" ? "Grid View" : "Table View"}
            </span>
          </button>
        </div>

        {/* table / grid */}
        {viewMode === "table" ? (
          <>
            {["Top 15 Gainers", "Top 15 Losers"].map((title, idx) => (
              <section className="mb-8" key={title}>
                <h2 className="font-semibold text-lg sm:text-xl mb-1">{title}</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-100 text-brand-900">
                      <tr>
                        {["Rank", "Symbol", "Name", "Price (USD)", "24h %"].map((h) => (
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
              <h2 className="font-semibold text-lg sm:text-xl mb-3">Top 15 Gainers</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <GridCards rows={topGainers} />
              </div>
            </section>
            <section className="mb-8">
              <h2 className="font-semibold text-lg sm:text-xl mb-3">Top 15 Losers</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <GridCards rows={topLosers} />
              </div>
            </section>
          </>
        )}

        {/* shared crypto popup */}
        <CryptoAssetPopup
          asset={selectedAsset}
          logos={logos}
          onClose={() => setSelectedAsset(null)}
        />
      </div>
    </div>
  );
}
