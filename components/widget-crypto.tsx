"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  startTransition,
} from "react";
import { motion, useMotionValue } from "framer-motion";
import CryptoAssetPopup from "@/utils/CryptoAssetPopup";

/* Types ------------------------------------------------------------ */
interface TradeState {
  price: number;
  prev?: number;
  bump?: number;
}

/* Constants -------------------------------------------------------- */
const API_KEY = process.env.NEXT_PUBLIC_COINCAP_API_KEY || "";
const COINGECKO_TOP200 =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1";

const SCROLL_SPEED = 34; // px/sec (smoother + less “racing”)

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
    v != null && !Number.isNaN(parseFloat(String(v)))
      ? `${parseFloat(String(v)).toFixed(2)}%`
      : "—",
};

if (!API_KEY) {
  console.error(
    "🚨 Missing CoinCap API key! Set NEXT_PUBLIC_COINCAP_API_KEY in .env.local",
  );
}

/* Component -------------------------------------------------------- */
export default function WidgetCrypto() {
  const [metaData, setMetaData] = useState<Record<string, any>>({});
  const [tradeInfoMap, setTradeInfoMap] = useState<Record<string, TradeState>>(
    {},
  );
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const isMounted = useRef(true);

  // avoid “click opens modal” when the user was actually dragging
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
        const res = await fetch(
          `https://rest.coincap.io/v3/assets?limit=10&apiKey=${API_KEY}`,
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

useEffect(() => {
  let alive = true;

  (async () => {
    try {
      const res = await fetch(COINGECKO_TOP200, {
        headers: {
          "Accept": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

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
 
const didFetch = useRef(false);

useEffect(() => {
  if (didFetch.current) return;
  didFetch.current = true;

  (async () => {
    try {
      const res = await fetch(COINGECKO_TOP200);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const map: Record<string, string> = {};
      data?.forEach((c: any) => {
        if (c?.symbol && c?.image) {
          map[c.symbol.toLowerCase()] = c.image;
        }
      });
      setLogos(map);
    } catch (e) {
      console.warn("Logo preload skipped:", e);
    }
  })();
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

    const ws = new WebSocket(
      `wss://wss.coincap.io/prices?assets=${topAssetIds.join(",")}&apiKey=${API_KEY}`,
    );
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

    ws.onerror = () => {
      // keep it quiet; CoinCap can be flaky sometimes
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
      // scrollWidth is more stable than offsetWidth for flex rows
      setContentWidth(innerRef.current.scrollWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [topAssetIds]);

  /* Auto-scroll animation (pause when dragging or popup open) */
  useEffect(() => {
    let raf: number;
    let last: number | null = null;

    const step = (t: number) => {
      if (last === null) last = t;
      const delta = t - last;
      last = t;

      if (!isDragging && contentWidth > 0 && !selectedAssetId) {
        const current = x.get();
        let next = current - SCROLL_SPEED * (delta / 1000);

        // keep x in [-contentWidth, 0]
        if (next <= -contentWidth) next += contentWidth;
        if (next > 0) next -= contentWidth;

        x.set(next);
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isDragging, contentWidth, selectedAssetId, x]);

  const closePopup = useCallback(() => setSelectedAssetId(null), []);
  const selectedAsset = selectedAssetId
    ? { ...metaData[selectedAssetId], id: selectedAssetId }
    : null;

  const renderCard = (id: string) => {
    const md = metaData[id] || {};
    const ti = tradeInfoMap[id] || ({} as TradeState);
    const price = ti.price;
    const prev = ti.prev;
    const bump = ti.bump || 0;

    const pct24Num = parseFloat(String(md?.changePercent24Hr ?? "0"));
    const isNeg = Number.isFinite(pct24Num) ? pct24Num < 0 : false;
    const isPos = Number.isFinite(pct24Num) ? pct24Num >= 0 : false;

    const cardTone = isPos
      ? "from-emerald-500/95 to-green-600/95 border-emerald-300/30 shadow-emerald-500/10"
      : isNeg
      ? "from-rose-500/95 to-red-600/95 border-rose-300/30 shadow-rose-500/10"
      : "from-slate-500/80 to-slate-600/80 border-white/10 shadow-black/5";

    // flash stays colored
    const flashBg = isPos
      ? "radial-gradient(circle at center, rgba(34,197,94,0.90) 0%, rgba(34,197,94,0.35) 36%, rgba(34,197,94,0) 72%)"
      : "radial-gradient(circle at center, rgba(239,68,68,0.90) 0%, rgba(239,68,68,0.35) 36%, rgba(239,68,68,0) 72%)";

    const logo = logos[String(md?.symbol ?? "").toLowerCase()] || null;

    const onCardClick = () => {
      if (dragIntentRef.current.moved) return; // don’t open popup when user dragged
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
  className={[
    "relative overflow-hidden",
    "mx-0.5",
    "px-1 py-1.5 sm:px-1 sm:py-1",
    "rounded-lg sm:rounded-xl",
    "border border-white/10 dark:border-white/10",
    "shadow-sm",
    "bg-gradient-to-br",
    cardTone,
    "cursor-pointer select-none",
    "min-w-[90px] sm:min-w-[90px]",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 dark:focus-visible:ring-indigo-300/50",
  ].join(" ")}
  whileHover={{ y: -1, scale: 1.03 }}
  whileTap={{ scale: 0.985 }}
>
  {/* Flash overlay on price update */}
  {prev != null && bump > 0 && (
    <motion.div
      key={`${id}-${bump}`}
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.55, 0], scale: [1, 1.015, 1] }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      style={{ background: flashBg }}
    />
  )}

  {/* subtle vignette so text always reads on gradients */}
  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/10 via-black/0 to-black/15 dark:from-white/8 dark:via-white/0 dark:to-white/10" />

  <div className="relative z-10">
    {/* top row: logo + symbol + rank */}
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        {logo ? (
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 rounded-full blur-sm opacity-30 bg-white/70 dark:bg-black/40" />
            <div className="relative rounded-full p-0.5 shadow ring-1 ring-black/10 bg-white/95 dark:bg-white/90">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt={md?.symbol}
                className="w-4 h-4 sm:w-[18px] sm:h-[18px]"
                loading="lazy"
              />
            </div>
          </div>
        ) : (
          <div className="w-4 h-4 sm:w-[18px] sm:h-[18px] rounded-full bg-white/20 dark:bg-black/20 backdrop-blur-sm flex-shrink-0 ring-1 ring-white/10 dark:ring-black/10" />
        )}

        <div className="min-w-0">
          <div className="flex items-baseline gap-0.5">
            <span
              className={[
                "text-[10px] sm:text-[10px]",
                "font-extrabold tracking-wide",
                "text-white dark:text-slate-900",
                "drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] dark:drop-shadow-none",
              ].join(" ")}
            >
              {md?.symbol?.toUpperCase?.()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0">
        <span className="inline-flex items-center rounded-full px-1 py-0.5 ring-1 ring-white/15 dark:ring-black/10 bg-black/20 dark:bg-white/70 backdrop-blur">
          <span className="text-[8px] font-extrabold text-white/90 dark:text-slate-900">
            #{md?.rank}
          </span>
        </span>
      </div>
    </div>

    {/* price */}
    <div className="mt-1 text-center">
      <div
        className={[
          "text-[12px]",
          "font-semibold tabular-nums",
          "text-white dark:text-slate-900",
          "drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] dark:drop-shadow-none",
        ].join(" ")}
      >
        {fmt.usd(price)}
      </div>
    </div>

    {/* change pill */}
    <div className="mt-1 flex items-center justify-center">
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-white/15 dark:ring-black/10 bg-black/20 dark:bg-white/70 backdrop-blur">
        <span className="text-[10px] font-extrabold tabular-nums text-white/90 dark:text-slate-900 drop-shadow-[0_1px_1px_rgba(0,0,0,0.30)] dark:drop-shadow-none">
          {fmt.pct(md?.changePercent24Hr)}
        </span>
        <span className="text-[10px] font-semibold text-white/70 dark:text-slate-700">
          24h
        </span>
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
          <p className="text-[11px] sm:text-sm font-bold text-gray-700 dark:text-gray-300">
            Top 10 Cryptos by Market Cap
          </p>
          <div className="w-1.5 h-1.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Scrolling Cards Container */}
      <div className="relative overflow-hidden py-2">
        {/* subtle fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-white dark:from-brand-900 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-white dark:from-brand-900 to-transparent z-10 pointer-events-none" />

        <motion.div
          className="flex cursor-grab active:cursor-grabbing"
          style={{ x }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.08} // feels less “bouncy”
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => {
            setIsDragging(false);
            if (!contentWidth) return;

            // keep x snapped into [-contentWidth, 0]
            const mod = (n: number, m: number) => ((n % m) + m) % m;
            x.set(-mod(-x.get(), contentWidth));
          }}
        >
          {/* first copy */}
          <div className="flex items-center" ref={innerRef}>
            {topAssetIds.map(renderCard)}
          </div>

          {/* second copy for seamless loop */}
          <div className="flex items-center">
            {topAssetIds.map(renderCard)}
          </div>
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
