"use client";

import { fetchCoinCap, subscribeCoinCap } from "@/utils/coincap-client";

import React, { useEffect, useState, useRef, useMemo, useCallback, startTransition } from "react";
import { motion, useMotionValue, useAnimationFrame, animate } from "framer-motion";
import CryptoAssetPopup from "@/app/Crypto/CryptoAssetPopup";
import { WidgetCard } from "@/components/ui/widget-card";

/* Types ------------------------------------------------------------ */
interface TradeState {
  price: number;
  prev?: number;
  bump?: number;
}

/* Constants -------------------------------------------------------- */

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


/* Component -------------------------------------------------------- */
export default function WidgetCrypto() {
  const [metaData, setMetaData] = useState<Record<string, any>>({});
  const [tradeInfoMap, setTradeInfoMap] = useState<Record<string, TradeState>>({});
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const innerRef = useRef<HTMLDivElement | null>(null);
  const isMounted = useRef(true);
  const dragIntentRef = useRef({ downX: 0, moved: false });
  const x = useMotionValue(0);

  const [modalLoading, setModalLoading] = useState(false);
  const openTimerRef = useRef<number | null>(null);


  useEffect(() => {
  isMounted.current = true;
  return () => {
    isMounted.current = false;

    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }

  };
}, []);


  /* Fetch CoinCap metadata */
  useEffect(() => {

    (async () => {
      try {
        const res = await fetchCoinCap(`assets?limit=10`);
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
    if (!topAssetIds.length) return;

    const stop = subscribeCoinCap(topAssetIds, (data) => {
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
    });

    return stop;
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

  const closePopup = useCallback(() => {
  if (openTimerRef.current) {
    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
  }
  setModalLoading(false);
  setSelectedAssetId(null);
}, []);

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
  if (modalLoading) return; // prevent double-taps while loading

  // cancel any previous open
  if (openTimerRef.current) {
    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
  }

  setModalLoading(true);

  openTimerRef.current = window.setTimeout(() => {
    if (!isMounted.current) return;
    setSelectedAssetId(id);
    setModalLoading(false);
    openTimerRef.current = null;
  }, 1000); 
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
      "mx-1 min-w-[112px] rounded-xl",
      "border border-slate-200/70 bg-white dark:border-white/[0.08] dark:bg-white/[0.03]",
      "transition-colors duration-150 hover:border-slate-300 dark:hover:border-white/20",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
    )}
    whileHover={{ y: -2 }}
    whileTap={{ scale: 0.98 }}
  >
    {/* Flash on price update */}
    {prev != null && bump > 0 && (isPos || isNeg) && (
      <motion.div
        key={`flash-${id}-${bump}`}
        className="absolute inset-0 pointer-events-none rounded-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.35, 0] }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{
          background: isPos
            ? "radial-gradient(circle at center, rgba(34,197,94,0.55) 0%, rgba(34,197,94,0.22) 52%, transparent 82%)"
            : "radial-gradient(circle at center, rgba(239,68,68,0.55) 0%, rgba(239,68,68,0.22) 52%, transparent 82%)",
        }}
      />
    )}

    {/* Content */}
    <div className="relative z-10 p-2.5">
      {/* Header row with logo, symbol, and rank */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {logo && (
            <div className="relative flex-shrink-0">
              <div className="w-5 h-5 rounded-full">
                <img src={logo} alt={md.symbol} className="w-full h-full rounded-full" loading="lazy" />
              </div>
            </div>
          )}
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">
            {md?.symbol?.toUpperCase?.()}
          </span>
        </div>
        <span className="text-[10px] font-medium text-slate-300 dark:text-slate-600 tabular-nums">
          #{md?.rank}
        </span>
      </div>

      {/* Price */}
      <div className="mb-1.5">
        <div className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
          {fmt.usd(price)}
        </div>
      </div>

      {/* 24h Change */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[11px] font-medium tabular-nums",
            isPos ? "text-emerald-600 dark:text-emerald-400" :
            isNeg ? "text-rose-500 dark:text-rose-400" :
            "text-slate-500"
          )}
        >
          {fmt.pct(md?.changePercent24Hr)}
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">24h</span>
      </div>
    </div>
  </motion.button>
);
  };

  return (
    <WidgetCard title="Crypto" subtitle="Top 10 by market cap · live" href="/Crypto" hrefLabel="More crypto data" flush>
      {/* Scrolling Container */}
      <div className="relative overflow-hidden pb-4">
        {/* Gradient fades */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-[#232326] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-[#232326] to-transparent z-10 pointer-events-none" />

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

      {modalLoading && (
  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
    <div className="rounded-xl bg-white/10 px-4 py-3 text-white text-sm backdrop-blur">
      Loading…
    </div>
  </div>
)}
    </WidgetCard>
  );
}