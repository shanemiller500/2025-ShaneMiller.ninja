"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback, startTransition } from "react";
import { motion, useMotionValue, useAnimationFrame, animate } from "framer-motion";
import CryptoAssetPopup from "@/utils/CryptoAssetPopup";

/* Types ------------------------------------------------------------ */
interface TradeState {
  price: number;
  prev?: number;
  bump?: number;
}

/* Constants -------------------------------------------------------- */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";
const SCROLL_SPEED = 35;

/* Utilities -------------------------------------------------------- */
const currencyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

const fmt = {
  usd: (v: any) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return n != null && !Number.isNaN(n) ? currencyFmt.format(n) : "—";
  },
  compact: (v: any) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return n != null && !Number.isNaN(n) ? compactFmt.format(n) : "—";
  },
  pct: (v: any) => v != null && !Number.isNaN(parseFloat(String(v))) ? `${parseFloat(String(v)).toFixed(2)}%` : "—",
};

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

const wrap = (min: number, max: number, v: number) => {
  const range = max - min;
  if (range === 0) return min;
  return ((((v - min) % range) + range) % range) + min;
};

const cleanLogo = (url?: string) => {
  if (!url) return "";
  const s = String(url).trim();
  if (!s || s.startsWith("data:")) return "";
  return s;
};

if (!API_KEY) {
  console.error("🚨 Missing CoinCap API key! Set NEXT_PUBLIC_COINCAP_API_KEY in .env.local");
}

/* Component -------------------------------------------------------- */
export default function WidgetCrypto() {
  const [metaData, setMetaData] = useState<Record<string, any>>({});
  const [tradeInfoMap, setTradeInfoMap] = useState<Record<string, TradeState>>({});
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const isMounted = useRef(true);
  const dragIntentRef = useRef({ downX: 0, moved: false });
  const x = useMotionValue(0);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      try { socketRef.current?.close(); } catch {}
    };
  }, []);

  /* Fetch CoinCap metadata */
  useEffect(() => {
    if (!API_KEY) return;
    (async () => {
      try {
        const res = await fetch(`https://rest.coincap.io/v3/assets?limit=10&apiKey=${API_KEY}`);
        const json = await res.json();
        const map: Record<string, any> = {};
        (json.data || []).forEach((a: any) => (map[a.id] = a));
        setMetaData(map);
      } catch (e) {
        console.error("Error fetching metadata:", e);
      }
    })();
  }, []);

  /* Fetch logos from CoinGecko */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(COINGECKO_TOP200, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!alive) return;

        const map: Record<string, string> = {};
        (data || []).forEach((c: any) => {
          const sym = String(c?.symbol ?? "").toLowerCase();
          const img = String(c?.image ?? "");
          if (sym && img) map[sym] = img;
        });
        setLogos(map);
      } catch (e) {
        console.warn("CoinGecko logo preload skipped:", e);
      }
    })();
    return () => { alive = false; };
  }, []);

  const topAssetIds = useMemo(() => Object.keys(metaData), [metaData]);

  /* Seed initial prices */
  useEffect(() => {
    if (!topAssetIds.length) return;
    setTradeInfoMap((prev) => {
      if (Object.keys(prev).length) return prev;
      const init: Record<string, TradeState> = {};
      topAssetIds.forEach((id) => {
        const p = parseFloat(metaData[id]?.priceUsd || "0");
        init[id] = { price: Number.isFinite(p) ? p : 0, prev: undefined, bump: 0 };
      });
      return init;
    });
  }, [topAssetIds, metaData]);

  /* WebSocket for live updates */
  useEffect(() => {
    if (!API_KEY || !topAssetIds.length) return;

    const ws = new WebSocket(`wss://wss.coincap.io/prices?assets=${topAssetIds.join(",")}&apiKey=${API_KEY}`);
    socketRef.current = ws;

    ws.onmessage = (evt) => {
      let data: Record<string, string>;
      try {
        data = JSON.parse(evt.data);
      } catch {
        return;
      }

      startTransition(() => {
        if (!isMounted.current) return;
        setTradeInfoMap((prev) => {
          let changed = false;
          const next = { ...prev };
          Object.entries(data).forEach(([id, p]) => {
            const price = parseFloat(p);
            if (!Number.isFinite(price)) return;
            const old = prev[id]?.price;
            if (old != null && price === old) return;
            const bump = (prev[id]?.bump || 0) + 1;
            next[id] = { price, prev: old, bump };
            changed = true;
          });
          return changed ? next : prev;
        });
      });
    };

    return () => {
      try { ws.close(); } catch {}
    };
  }, [topAssetIds]);

  /* Measure content width */
  useEffect(() => {
    const measure = () => {
      if (!innerRef.current) return;
      setContentWidth(innerRef.current.scrollWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [topAssetIds]);

  /* Auto-scroll animation */
  useAnimationFrame((_, delta) => {
    if (isDragging || !contentWidth || selectedAssetId) return;
    const next = x.get() - SCROLL_SPEED * (delta / 1000);
    x.set(wrap(-contentWidth, 0, next));
  });

  const closePopup = useCallback(() => setSelectedAssetId(null), []);
  const selectedAsset = selectedAssetId ? { ...metaData[selectedAssetId], id: selectedAssetId } : null;

  const renderCard = (id: string) => {
    const md = metaData[id] || {};
    const ti = tradeInfoMap[id] || ({} as TradeState);
    const price = ti.price;
    const prev = ti.prev;
    const bump = ti.bump || 0;

    const pct24Num = parseFloat(String(md?.changePercent24Hr ?? "0"));
    const isNeg = Number.isFinite(pct24Num) ? pct24Num < 0 : false;
    const isPos = Number.isFinite(pct24Num) ? pct24Num >= 0 : false;

    const logo = cleanLogo(logos[String(md?.symbol ?? "").toLowerCase()]);

    const onCardClick = () => {
      if (dragIntentRef.current.moved) return;
      setSelectedAssetId(id);
    };

   return (
  <motion.button
    key={id}
    type="button"
    onPointerDown={(e) => {
      dragIntentRef.current.downX = e.clientX;
      dragIntentRef.current.moved = false;
    }}
    onPointerMove={(e) => {
      if (Math.abs(e.clientX - dragIntentRef.current.downX) > 6) {
        dragIntentRef.current.moved = true;
      }
    }}
    onClick={onCardClick}
    className={cn(
      "group relative overflow-hidden text-left select-none",
      "mx-1",
      "min-w-[100px] sm:min-w-[110px]",
      "rounded-xl",
      "border",
      "shadow-sm",
      "transition-colors duration-150",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60",

      isPos
        ? [
            //  MATTE GREEN  
            "bg-emerald-400",
            "border-emerald-600/50",
            "dark:bg-emerald-600",
            "dark:border-emerald-500/50",
          ].join(" ")
        : isNeg
        ? [
            //  MATTE RED
            "bg-rose-400",
            "border-rose-600/50",
            "dark:bg-rose-600",
            "dark:border-rose-500/50",
          ].join(" ")
        : [
            //  MATTE NEUTRAL
            "bg-gray-200",
            "border-gray-400/40",
            "dark:bg-gray-800/60",
            "dark:border-gray-700/40",
          ].join(" ")
    )}
    whileHover={{ y: -2, scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
  >
    {/* Subtle gradient overlay */}
    <div className="absolute inset-0 pointer-events-none dark:bg-gradient-to-br dark:from-white/5 dark:via-transparent dark:to-black/25" />

    {/* Flash on price update */}
    {prev != null && bump > 0 && (isPos || isNeg) && (
      <motion.div
        key={`flash-${id}-${bump}`}
        className="absolute inset-0 pointer-events-none rounded-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0] }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{
          background: isPos
            ? "radial-gradient(circle at center, rgba(34,197,94,0.55) 0%, rgba(34,197,94,0.22) 52%, transparent 82%)"
            : "radial-gradient(circle at center, rgba(239,68,68,0.55) 0%, rgba(239,68,68,0.22) 52%, transparent 82%)",
          mixBlendMode: "screen",
        }}
      />
    )}

    {/* Content */}
    <div className="relative z-10 px-2.5 py-2.5">
      {/* Header row with logo, symbol, and rank */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {logo && (
            <div className="relative flex-shrink-0">
              <div className="w-5 h-5 rounded-full bg-white dark:bg-gray-800 p-0.5 ring-1 ring-black/5 dark:ring-white/10 shadow-sm">
                <img src={logo} alt={md.symbol} className="w-full h-full rounded-full" loading="lazy" />
              </div>
            </div>
          )}
          <span className="text-[11px] font-semibold text-slate-800 dark:text-white truncate">
            {md?.symbol?.toUpperCase?.()}
          </span>
        </div>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-[9px] font-bold text-gray-600 dark:text-gray-300">
          #{md?.rank}
        </span>
      </div>

      {/* Price */}
      <div className="mb-1.5">
        <div className="text-sm font-semibold text-slate-800 dark:text-white tabular-nums">
          {fmt.usd(price)}
        </div>
      </div>

      {/* 24h Change */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[10px] font-bold tabular-nums",
            isPos ? "text-emerald-700 dark:text-emerald-300" :
            isNeg ? "text-rose-700 dark:text-rose-300" :
            "text-gray-700 dark:text-gray-300"
          )}
        >
          {fmt.pct(md?.changePercent24Hr)}
        </span>
        <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">24h</span>
      </div>
    </div>
  </motion.button>
);
  };

  return (
    <div className="w-full max-w-[720px] mx-auto">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-center gap-2">
         <div className="w-1.5 h-1.5 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full animate-pulse" />

          <p className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300">
            Top 10 Cryptos by Market Cap
          </p>
         <div className="w-1.5 h-1.5 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full animate-pulse" />

        </div>
      </div>

      {/* Scrolling Container */}
      <div className="relative overflow-hidden py-2">
        {/* Gradient fades */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white dark:from-brand-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white dark:from-brand-900 to-transparent z-10 pointer-events-none" />

        <motion.div
          className="flex cursor-grab active:cursor-grabbing will-change-transform"
          style={{ x }}
          drag="x"
          dragElastic={0.06}
          dragMomentum={false}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => {
            setIsDragging(false);
            if (!contentWidth) return;
            const snapped = wrap(-contentWidth, 0, x.get());
            animate(x, snapped, { type: "spring", stiffness: 260, damping: 30 });
          }}
        >
          <div className="flex items-center" ref={innerRef}>
            {topAssetIds.map(renderCard)}
          </div>
          <div className="flex items-center">
            {topAssetIds.map(renderCard)}
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="px-4 pt-2 pb-3">
        <p className="text-xs text-center text-gray-600 dark:text-gray-400">
          View more crypto data{" "}
          <a
            href="/Crypto"
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline underline-offset-2 transition-colors"
          >
            here
          </a>
        </p>
      </div>

      {/* Asset Detail Popup */}
      {selectedAsset && (
        <CryptoAssetPopup
          asset={selectedAsset}
          logos={logos}
          onClose={closePopup}
          tradeInfo={{
            price: tradeInfoMap[selectedAsset.id]?.price,
            prev: tradeInfoMap[selectedAsset.id]?.prev,
          }}
        />
      )}
    </div>
  );
}