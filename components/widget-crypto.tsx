"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  JSX,
  startTransition,
} from "react";
import { motion, useMotionValue } from "framer-motion";
import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import CryptoAssetPopup from "@/utils/CryptoAssetPopup";

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

type TradeState = { price: number; prev?: number; bump?: number };

const WidgetCrypto: React.FC = () => {
  const [metaData, setMetaData] = useState<Record<string, any>>({});
  const [tradeInfoMap, setTradeInfoMap] = useState<Record<string, TradeState>>(
    {},
  );
  const socketRef = useRef<WebSocket | null>(null);

  const [logos, setLogos] = useState<Record<string, string>>({});
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  /* marquee motion */
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const speed = 50;

  /* is-mounted flag for safe async state updates */
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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
    if (!topAssetIds.length) return;

    setTradeInfoMap((prev) => {
      if (Object.keys(prev).length) return prev; // already seeded
      const init: Record<string, TradeState> = {};
      topAssetIds.forEach((id) => {
        const p = parseFloat(metaData[id]?.priceUsd || "0");
        init[id] = {
          price: Number.isFinite(p) ? p : 0,
          prev: undefined,
          bump: 0,
        };
      });
      return init;
    });
  }, [topAssetIds, metaData]);

  /* live price stream */
  useEffect(() => {
    if (!API_KEY_ENV || !topAssetIds.length) return;

    const ws = new WebSocket(
      `wss://wss.coincap.io/prices?assets=${topAssetIds.join(",")}&apiKey=${API_KEY_ENV}`,
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
          const next = { ...prev };
          Object.entries(data).forEach(([id, p]) => {
            const price = parseFloat(p);
            if (!Number.isFinite(price)) return;

            const old = prev[id]?.price;
            const bump = (prev[id]?.bump || 0) + 1;
            next[id] = { price, prev: old, bump };
          });
          return next;
        });
      });
    };

    return () => ws.close();
  }, [topAssetIds]);

  /* marquee size */
  useEffect(() => {
    const measure = () => {
      if (innerRef.current) setContentWidth(innerRef.current.offsetWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [topAssetIds]);

  /* marquee auto-scroll (pause when popup open) */
  useEffect(() => {
    let raf: number;
    let last: number | null = null;

    const step = (t: number) => {
      if (last === null) last = t;
      const delta = t - last;
      last = t;

      if (!isDragging && contentWidth && !selectedAssetId) {
        const current = x.get();
        let next = current - speed * (delta / 1000);
        if (next <= -contentWidth) next += contentWidth;
        if (next > 0) next -= contentWidth;
        x.set(next);
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isDragging, contentWidth, selectedAssetId]);

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

    // ✅ YOUR RULE:
    // If % string starts with "-" (or numeric < 0) => red, else green.
    const pct24Num = parseFloat(String(md?.changePercent24Hr ?? "0"));
    const isRed = Number.isFinite(pct24Num) ? pct24Num < 0 : false;

    // ✅ inline style so it ALWAYS applies
    const bgColor = isRed ? "rgb(239 68 68)" : "rgb(34 197 94)"; // red-500 / green-500

    const logo = logos[String(md?.symbol ?? "").toLowerCase()] || null;

    return (
      <motion.div
        key={id}
        onClick={() => setSelectedAssetId(id)}
        className="relative overflow-hidden m-1 p-2 rounded text-white text-center cursor-pointer whitespace-nowrap"
        style={{ backgroundColor: bgColor }}
        whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
      >
        {/* optional flash (kept exactly like you had it) */}
        {prev != null && bump > 0 && (
          <motion.div
            key={`${id}-${bump}`}
            className="absolute inset-0 rounded pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0], scale: [1, 1.03, 1] }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            style={{
              background:
                price > (prev ?? price)
                  ? "rgba(255,255,255,0.9)"
                  : "rgba(0,0,0,0.35)",
              mixBlendMode: "overlay",
            }}
          />
        )}

        <div className="text-xs">#{md?.rank}</div>
        <div className="flex items-center justify-center font-bold text-sm p-1">
          {logo && <img src={logo} alt={md.symbol} className="w-5 h-5 pr-1" />}
          {md?.symbol?.toUpperCase?.()}
        </div>
        <div className="text-xs">{usd(price)}</div>
        <div className="text-xs">{pct(md?.changePercent24Hr)}</div>
      </motion.div>
    );
  };

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
          More Crypto data{" "}
          <a href="/Crypto" className="underline text-indigo-500">
            here
          </a>
        </p>
      </div>

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
};

export default WidgetCrypto;
