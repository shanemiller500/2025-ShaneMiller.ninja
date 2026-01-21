// Filename: WidgetCrypto.tsx
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

const wrap = (min: number, max: number, v: number) => {
  const range = max - min;
  if (range === 0) return min;
  return ((((v - min) % range) + range) % range) + min;
};

/* Constants -------------------------------------------------------- */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";

// px/sec (smooth, not racing)
const SCROLL_SPEED = 34;

/* Utilities -------------------------------------------------------- */
const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const fmt = {
  usd: (v: any) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return n != null && !Number.isNaN(n) ? currencyFmt.format(n) : "—";
  },
  compact: (v: any) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    return n != null && !Number.isNaN(n) ? compactFmt.format(n) : "—";
  },
  pct: (v: any) =>
    v != null && !Number.isNaN(parseFloat(String(v))) ? `${parseFloat(String(v)).toFixed(2)}%` : "—",
};

const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

function cleanLogo(url?: string) {
  if (!url) return "";
  const s = String(url).trim();
  if (!s) return "";
  if (s.startsWith("data:")) return "";
  return s;
}

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
      try {
        socketRef.current?.close();
      } catch {}
    };
  }, []);

  /* Fetch initial CoinCap metadata */
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

  /* Fetch logos once (CoinGecko) */
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

    return () => {
      alive = false;
    };
  }, []);

  const topAssetIds = useMemo(() => Object.keys(metaData), [metaData]);

  /* Seed initial prices from metadata */
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

  /* WebSocket for live price updates */
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
      try {
        ws.close();
      } catch {}
    };
  }, [topAssetIds]);

  /* Measure content width for infinite scroll */
  useEffect(() => {
    const measure = () => {
      if (!innerRef.current) return;
      setContentWidth(innerRef.current.scrollWidth);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [topAssetIds]);

  /* Smooth auto-scroll (no jitter) */
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

    const accent = isPos
      ? "from-emerald-500/30 via-emerald-500/10 to-transparent"
      : isNeg
      ? "from-rose-500/30 via-rose-500/10 to-transparent"
      : "from-slate-500/25 via-slate-500/10 to-transparent";

    // BOOSTED flash so it’s visible
    const flashBg = isPos
      ? "radial-gradient(circle at center, rgba(34,197,94,0.98) 0%, rgba(34,197,94,0.55) 36%, rgba(34,197,94,0) 70%)"
      : "radial-gradient(circle at center, rgba(239,68,68,0.98) 0%, rgba(239,68,68,0.55) 36%, rgba(239,68,68,0) 70%)";

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
          "mx-0.5",
          "min-w-[92px] sm:min-w-[92px]",
          "rounded-lg sm:rounded-xl",
          "border border-black/10 dark:border-white/10",
          "bg-white/75 dark:bg-white/[0.06]",
          "shadow-sm",
          "ring-1 ring-black/5 dark:ring-white/5",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 dark:focus-visible:ring-indigo-300/50"
        )}
        whileHover={{ y: -1, scale: 1.03 }}
        whileTap={{ scale: 0.985 }}
      >
        {/* big logo background */}
        <div
          className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.08]"
          style={{
            backgroundImage: logo ? `url(${logo})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: logo ? 0.55 : 0,
            filter: "saturate(1.15) contrast(1.06)",
          }}
        />

        {/* heatmap-y blobs + accent */}
        <div className="absolute inset-0 opacity-100">
          <div className="absolute -top-10 -left-12 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />
          <div className="absolute -bottom-14 -right-14 h-44 w-44 rounded-full bg-fuchsia-500/10 blur-2xl" />
          <div className={cn("absolute inset-0 bg-gradient-to-r", accent)} />
        </div>

{/* POP FX: flash + ring glow + auto shine sweep */}
{prev != null && bump > 0 && (isPos || isNeg) && (
  <>
    {/* 1) Big color flash */}
    <motion.div
      key={`flash-${id}-${bump}`}
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0, scale: 1 }}
      animate={{
        opacity: [0, 1, 0.9, 0.25, 0],
        scale: [1, 1.03, 1.015, 1.01, 1],
      }}
      transition={{
        duration: 0.45,
        times: [0, 0.12, 0.22, 0.55, 1],
        ease: "easeOut",
      }}
      style={{
        background: flashBg,
        mixBlendMode: "screen",
        filter: "saturate(2.1) contrast(1.25)",
        willChange: "opacity, transform",
      }}
    />

    {/* 2) Edge glow ring (makes the whole card pop) */}
    <motion.div
      key={`ring-${id}-${bump}`}
      className="absolute inset-0 pointer-events-none rounded-lg sm:rounded-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 0.35, 0] }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      style={{
        boxShadow: isPos
          ? "0 0 0 1px rgba(34,197,94,0.25), 0 0 26px rgba(34,197,94,0.55), 0 0 60px rgba(34,197,94,0.30)"
          : "0 0 0 1px rgba(239,68,68,0.25), 0 0 26px rgba(239,68,68,0.55), 0 0 60px rgba(239,68,68,0.30)",
      }}
    />

    {/* 3) Auto “shine sweep” (triggers on flash) */}
    <motion.div
      key={`shine-${id}-${bump}`}
      className="pointer-events-none absolute inset-0"
      initial={{ opacity: 0, x: "-55%" }}
      animate={{ opacity: [0, 0.9, 0], x: ["-55%", "55%"] }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      style={{ willChange: "transform, opacity" }}
    >
      <div className="absolute -inset-y-10 left-0 w-[55%] rotate-12 bg-gradient-to-r from-transparent via-white/45 to-transparent blur-[1px]" />
    </motion.div>

    {/* 4) Short “color boost” overlay (helps text + background feel energized) */}
    <motion.div
      key={`boost-${id}-${bump}`}
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.22, 0] }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{
        background: isPos
          ? "radial-gradient(circle at 30% 30%, rgba(34,197,94,0.22), transparent 60%)"
          : "radial-gradient(circle at 30% 30%, rgba(239,68,68,0.22), transparent 60%)",
        mixBlendMode: "overlay",
      }}
    />
  </>
)}

{/* Keep your vignette (it helps legibility) */}
<div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/10 via-black/0 to-black/15 dark:from-white/10 dark:via-white/0 dark:to-white/10" />

         {/* content */}
        <div className="relative z-10 px-2 py-2">
          {/* top row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-black/10 dark:ring-white/10 bg-black/5 dark:bg-white/10 backdrop-blur">
              <span
                className={cn(
                  "truncate",
                  "text-[10px] sm:text-[10px]",
                  "font-extrabold tracking-wide",
                  "text-gray-900 dark:text-white",
                  "drop-shadow-[0_1px_1px_rgba(255,255,255,0.25)] dark:drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
                )}
              >
                {md?.symbol?.toUpperCase?.()}
              </span>
              </span>
            </div>

            <span className="inline-flex items-center rounded-full px-1 py-0.5 ring-1 ring-black/10 dark:ring-white/10 bg-black/5 dark:bg-white/10 backdrop-blur">
              <span className="text-[8px] font-extrabold text-gray-900/80 dark:text-white/85">#{md?.rank}</span>
            </span>
          </div>

          {/* price */}
          <div className="mt-1 text-center">
            <div className="text-[12px] font-semibold tabular-nums text-gray-900 dark:text-white">
              {fmt.usd(price)}
            </div>
          </div>

          {/* change pill */}
          <div className="mt-1 flex items-center justify-center">
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-black/10 dark:ring-white/10 bg-black/5 dark:bg-white/10 backdrop-blur">
              <span
                className={cn(
                  "text-[10px] font-extrabold tabular-nums",
                  isPos ? "text-emerald-700 dark:text-emerald-200" : isNeg ? "text-rose-700 dark:text-rose-200" : "text-gray-800 dark:text-white/80"
                )}
              >
                {fmt.pct(md?.changePercent24Hr)}
              </span>
              <span className="text-[10px] font-semibold text-gray-600 dark:text-white/55">24h</span>
            </span>
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
          <div className="w-1.5 h-1.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-pulse" />
          <p className="text-[11px] sm:text-sm font-bold text-gray-700 dark:text-gray-300">Top 10 Cryptos by Market Cap</p>
          <div className="w-1.5 h-1.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Scrolling Cards Container */}
      <div className="relative overflow-hidden py-2">
        <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-white dark:from-brand-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white dark:from-brand-900 to-transparent z-10 pointer-events-none" />

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

          <div className="flex items-center">{topAssetIds.map(renderCard)}</div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="px-4 pt-2 pb-3">
        <p className="text-[11px] text-center text-gray-600 dark:text-gray-400">
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
