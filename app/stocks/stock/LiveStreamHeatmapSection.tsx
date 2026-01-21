/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { API_TOKEN } from "@/utils/config";
import StockQuoteModal from "./StockQuoteModal";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const PROXY_BASE = "https://u-mail.co/api/finnhubProxy";

const SYMBOLS = [
  "AAPL",
  "MSFT",
  "AMZN",
  "GOOGL",
  "TSLA",
  "META",
  "NVDA",
  "PYPL",
  "ASML",
  "ADBE",
  "CMCSA",
  "CSCO",
  "PEP",
  "NFLX",
  "AVGO",
  "INTU",
  "AMD",
  "IBM",
  "TXN",
  "QCOM",
  "COST",
  "ABBV",
  "CRM",
  "ACN",
  "T",
  "NKE",
  "NEE",
  "DHR",
  "ORCL",
  "UNH",
  "FIS",
  "BMY",
  "LLY",
  "CVX",
  "LIN",
  "SBUX",
  "HD",
  "AMGN",
  "MDT",
  "HON",
  "MO",
  "NVO",
  "MMM",
  "VRTX",
  "REGN",
  "TMO",
  "LMT",
  "NOW",
  "ZM",
  "MA",
  "CME",
  "UPS",
  "TMUS",
  "CHTR",
  "SNOW",
] as const;

type SymbolT = (typeof SYMBOLS)[number];
type MarketState = "open" | "premarket" | "afterhours" | "closed";

interface TradeInfo {
  timestamp: number;
  price: number; // last price (quote.c or trade.p)
  prevClose?: number; // quote.pc (yesterday close)
  prevTick?: number; // last tick for direction
  percentChange: number; // (price - prevClose)/prevClose when available, else tick change
  dir: "up" | "down" | "flat";
  flashKey: number;
}

/* Heatmap batching */
const BATCH_SIZE = 5; // 4-6 is safest with finnhub free-ish limits
const BETWEEN_BATCH_DELAY_MS = 950;
const BETWEEN_ITEM_DELAY_MS = 220;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const LOGO_FALLBACK =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="%23EEF2FF"/><text x="50%" y="54%" font-family="Arial" font-size="7" text-anchor="middle" fill="%234C1D95">Logo Loading...</text></svg>';

const usd = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";

const pctText = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(2)}%` : "";

const safeJson = async (r: Response) => {
  try {
    return await r.json();
  } catch {
    return null;
  }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithBackoff(url: string, tries = 5) {
  let lastErr: any = null;

  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);

      // 429 from proxy/finnhub
      if (r.status === 429) {
        const wait = Math.min(12000, 900 * Math.pow(2, i));
        await sleep(wait);
        continue;
      }

      return r;
    } catch (e) {
      lastErr = e;
      const wait = Math.min(12000, 900 * Math.pow(2, i));
      await sleep(wait);
    }
  }

  throw lastErr ?? new Error("fetch failed");
}

const calcMarketState = (): MarketState => {
  const now = new Date();
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = est.getDay();
  const mins = est.getHours() * 60 + est.getMinutes();

  const pre = 4 * 60;
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  const aft = 20 * 60;

  let state: MarketState = "closed";
  if (day !== 0 && day !== 6) {
    if (mins >= open && mins < close) state = "open";
    else if (mins >= pre && mins < open) state = "premarket";
    else if (mins >= close && mins < aft) state = "afterhours";
  }
  return state;
};

const cleanLogo = (url?: string) => {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.protocol === "http:") u.protocol = "https:";
    return u.toString();
  } catch {
    return "";
  }
};


const extractDomain = (raw?: string) => {
  if (!raw) return "";
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const clearbitLogo = (domain: string) => (domain ? `https://logo.clearbit.com/${domain}` : "");

/* localStorage cache (24h) */
const CACHE_KEY = "heatmap_profiles_v3";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedProfile = {
  t: number;
  profile: any;
  logo: string;
};

function loadCache(): Record<string, CachedProfile> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CachedProfile>;
    const now = Date.now();

    const next: Record<string, CachedProfile> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v?.t && now - v.t < CACHE_TTL_MS) next[k] = v;
    }
    return next;
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CachedProfile>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

/* ================================================================== */
/*  Component                                                         */
/* ================================================================== */
const LiveStreamHeatmapSection: React.FC = () => {
  const [tradeInfoMap, setTradeInfoMap] = useState<Record<string, TradeInfo>>({});
  const [symbolLogos, setSymbolLogos] = useState<Record<string, string>>({});
  const [symbolProfiles, setSymbolProfiles] = useState<Record<string, any>>({});
  const [marketState, setMarketState] = useState<MarketState>("closed");
  const [wsConnected, setWsConnected] = useState(false);

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [selectedStockData, setSelectedStockData] = useState<any | null>(null);
  const [selectedNewsData, setSelectedNewsData] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const stoppedRef = useRef(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const quoteRunIdRef = useRef(0);


  // cache in memory + localStorage
  const profileCacheRef = useRef<Record<string, CachedProfile>>({});
  const inflightProfileRef = useRef<Set<string>>(new Set());

  /* ------------------------------------------------------------------ */
  /*  Bootstrap: seed tiles + cache hydrate                              */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    // seed tiles so the grid paints instantly (no "undefined")
    setTradeInfoMap((prev) => {
      const next = { ...prev };
      const now = Date.now();
      for (const sym of SYMBOLS) {
        if (!next[sym]) {
          next[sym] = {
            timestamp: now,
            price: NaN,
            prevClose: undefined,
            prevTick: undefined,
            percentChange: 0,
            dir: "flat",
            flashKey: now,
          };
        }
      }
      return next;
    });

    // seed logos with fallback so images are instant
    setSymbolLogos((prev) => {
      const next = { ...prev };
      for (const sym of SYMBOLS) if (!next[sym]) next[sym] = LOGO_FALLBACK;
      return next;
    });

    // hydrate cache
    profileCacheRef.current = loadCache();
    const cached = profileCacheRef.current;

    const logos: Record<string, string> = {};
    const profs: Record<string, any> = {};
    for (const sym of SYMBOLS) {
      const hit = cached[sym];
      if (hit?.logo) logos[sym] = hit.logo;
      if (hit?.profile) profs[sym] = hit.profile;
    }
    if (Object.keys(logos).length) setSymbolLogos((p) => ({ ...p, ...logos }));
    if (Object.keys(profs).length) setSymbolProfiles((p) => ({ ...p, ...profs }));
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Market clock                                                      */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const tick = () => setMarketState(calcMarketState());
    tick();
    const int = window.setInterval(tick, 60_000);
    return () => window.clearInterval(int);
  }, []);

  /* ------------------------------------------------------------------ */
  /*  Profiles/logos (cached, one symbol)                                */
  /* ------------------------------------------------------------------ */
  const ensureProfile = async (sym: string) => {
    // If we already have a non-fallback logo OR a profile name, we're good
    const existingLogo = symbolLogos[sym];
    if (symbolProfiles[sym]?.name || (existingLogo && existingLogo !== LOGO_FALLBACK)) return;

    const cacheHit = profileCacheRef.current[sym];
    if (cacheHit?.profile || cacheHit?.logo) {
      if (cacheHit.logo) setSymbolLogos((p) => ({ ...p, [sym]: cacheHit.logo }));
      if (cacheHit.profile) setSymbolProfiles((p) => ({ ...p, [sym]: cacheHit.profile }));
      return;
    }

    if (inflightProfileRef.current.has(sym)) return;
    inflightProfileRef.current.add(sym);

    try {
      const r = await fetchWithBackoff(`${PROXY_BASE}/profile/${sym}`, 4);
      const p = await safeJson(r);
      if (!r.ok) return;

      const finnhubLogo = cleanLogo(p?.logo);
      const domain =
        extractDomain(p?.weburl) || extractDomain(p?.url) || extractDomain(p?.website) || "";
      const cb = domain ? clearbitLogo(domain) : "";
      const resolvedLogo = finnhubLogo || cb || "";

      if (p) setSymbolProfiles((prev) => ({ ...prev, [sym]: p || {} }));
      if (resolvedLogo) setSymbolLogos((prev) => ({ ...prev, [sym]: resolvedLogo }));

      profileCacheRef.current = {
        ...profileCacheRef.current,
        [sym]: { t: Date.now(), profile: p || {}, logo: resolvedLogo || LOGO_FALLBACK },
      };
      saveCache(profileCacheRef.current);
    } finally {
      inflightProfileRef.current.delete(sym);
    }
  };

  useEffect(() => {
  let cancelled = false;

  const run = async () => {
    // Load the first screen worth ASAP (mobile first)
    const FIRST = 12;
    for (const sym of SYMBOLS.slice(0, FIRST)) {
      if (cancelled) return;
      try {
        await ensureProfile(sym);
      } catch {}
      await sleep(120);
    }

    // Then load the rest slowly
    for (const sym of SYMBOLS.slice(FIRST)) {
      if (cancelled) return;
      try {
        await ensureProfile(sym);
      } catch {}
      await sleep(450);
    }
  };

  run();
  return () => {
    cancelled = true;
  };
  // IMPORTANT: only run once
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  /* ------------------------------------------------------------------ */
  /*  Quote logic: MATCH THE MODAL                                       */
  /* ------------------------------------------------------------------ */
  const applyQuote = (sym: string, price: number, prevCloseMaybe?: number) => {
    setTradeInfoMap((prev) => {
      const prevEntry = prev[sym];
      const prevTick = prevEntry?.price;

      const pc = typeof prevCloseMaybe === "number" && prevCloseMaybe > 0 ? prevCloseMaybe : prevEntry?.prevClose;

      // percent should be daily change vs prevClose when available (modal behavior)
      const baseForPct =
        typeof pc === "number" && pc > 0
          ? pc
          : typeof prevTick === "number" && Number.isFinite(prevTick) && prevTick > 0
          ? prevTick
          : null;

      const percentChange =
        typeof baseForPct === "number" && baseForPct > 0 ? ((price - baseForPct) / baseForPct) * 100 : 0;

      // dir should be tick direction if we have it, else daily direction
      const dir: TradeInfo["dir"] =
        typeof prevTick === "number" && Number.isFinite(prevTick) && prevTick > 0
          ? price > prevTick
            ? "up"
            : price < prevTick
            ? "down"
            : "flat"
          : typeof pc === "number" && pc > 0
          ? price > pc
            ? "up"
            : price < pc
            ? "down"
            : "flat"
          : prevEntry?.dir ?? "flat";

      return {
        ...prev,
        [sym]: {
          timestamp: Date.now(),
          price,
          prevClose: pc,
          prevTick,
          percentChange,
          dir,
          flashKey: Date.now(),
        },
      };
    });
  };

  const fetchQuoteAndSetTile = async (sym: string) => {
    const r = await fetchWithBackoff(`${PROXY_BASE}/quote/${sym}`, 5);
    const q = await safeJson(r);

    if (!r.ok) return;

    const price = Number(q?.c);
    if (!Number.isFinite(price) || price <= 0) return;

    const prevClose = Number(q?.pc);
    const pc = Number.isFinite(prevClose) && prevClose > 0 ? prevClose : undefined;

    applyQuote(sym, price, pc);
  };

  /* ------------------------------------------------------------------ */
  /*  Batch loader: QUOTES FIRST (colors + last price), then profiles    */
  /* ------------------------------------------------------------------ */
useEffect(() => {
  const runId = ++quoteRunIdRef.current;
  let cancelled = false;

  const stillValid = () => !cancelled && runId === quoteRunIdRef.current;

  const run = async () => {
    // 1) Quotes first for ALL symbols
    for (let start = 0; start < SYMBOLS.length; start += BATCH_SIZE) {
      if (!stillValid()) return;
      const batch = SYMBOLS.slice(start, start + BATCH_SIZE);

      for (let i = 0; i < batch.length; i++) {
        if (!stillValid()) return;
        try {
          await fetchQuoteAndSetTile(batch[i]);
        } catch {}
        await sleep(BETWEEN_ITEM_DELAY_MS);
      }

      await sleep(BETWEEN_BATCH_DELAY_MS);
    }

    // 2) Profiles/logos AFTER (slow)
    const FIRST = 12;
    const firstBatch = SYMBOLS.slice(0, FIRST);

    for (let i = 0; i < firstBatch.length; i++) {
      if (!stillValid()) return;
      try {
        await ensureProfile(firstBatch[i]);
      } catch {}
      await sleep(320);
    }

    const rest = SYMBOLS.slice(FIRST);
    for (let i = 0; i < rest.length; i++) {
      if (!stillValid()) return;
      try {
        await ensureProfile(rest[i]);
      } catch {}
      await sleep(900);
    }
  };

  run();

  return () => {
    cancelled = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  /* ------------------------------------------------------------------ */
  /*  WebSocket (only when not closed)                                   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!API_TOKEN) {
      console.warn("Finnhub WS token missing (API_TOKEN is empty).");
      setWsConnected(false);
      return;
    }

    stoppedRef.current = false;

    const safeClose = (sock: WebSocket | null) => {
      if (!sock) return;
      try {
        sock.onopen = null;
        sock.onclose = null;
        sock.onerror = null;
        sock.onmessage = null;
        if (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING) {
          sock.close();
        }
      } catch {}
    };

    const connect = (attempt = 0) => {
      if (stoppedRef.current) return;

      // hard guarantee: only 1 socket instance alive
      safeClose(socketRef.current);

      const wsUrl = `wss://ws.finnhub.io?token=${API_TOKEN}`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (stoppedRef.current) return;
        setWsConnected(true);
        // subscribe once
        for (const s of SYMBOLS) {
          try {
            ws.send(JSON.stringify({ type: "subscribe", symbol: s }));
          } catch {}
        }
        console.log("Finnhub WS OPEN");
      };

      ws.onmessage = (evt) => {
        if (stoppedRef.current) return;

        let msg: any;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }

        if (msg?.type === "error") {
          console.warn("Finnhub WS error msg:", msg);
          setWsConnected(false);
          safeClose(ws);
          return;
        }

        if (msg?.type !== "trade" || !Array.isArray(msg.data)) return;

        // Finnhub docs: t is UNIX milliseconds
        const updates = msg.data as Array<{ s: string; p: number; t: number; v?: number }>;

        setTradeInfoMap((prev) => {
          const next = { ...prev };
          for (const u of updates) {
            const sym = u.s;
            if (!SYMBOLS.includes(sym as SymbolT)) continue;

            const price = Number(u.p);
            if (!Number.isFinite(price) || price <= 0) continue;

            const prevEntry = prev[sym];
            const prevTick = prevEntry?.price;
            const prevClose = prevEntry?.prevClose;

            // percent should be daily when prevClose exists, else tick-to-tick
            const base =
              typeof prevClose === "number" && prevClose > 0
                ? prevClose
                : typeof prevTick === "number" && Number.isFinite(prevTick) && prevTick > 0
                ? prevTick
                : null;

            const percentChange =
              typeof base === "number" && base > 0 ? ((price - base) / base) * 100 : 0;

            const dir =
              typeof prevTick === "number" && Number.isFinite(prevTick) && prevTick > 0
                ? price > prevTick
                  ? "up"
                  : price < prevTick
                  ? "down"
                  : "flat"
                : typeof prevClose === "number" && prevClose > 0
                ? price > prevClose
                  ? "up"
                  : price < prevClose
                  ? "down"
                  : "flat"
                : prevEntry?.dir ?? "flat";

            next[sym] = {
              timestamp: typeof u.t === "number" && u.t > 0 ? u.t : Date.now(),
              price,
              prevClose,
              prevTick,
              percentChange,
              dir,
              flashKey: Date.now(),
            };
          }
          return next;
        });
      };

      ws.onerror = (e) => {
        if (stoppedRef.current) return;
        console.warn("Finnhub WS ERROR", e);
        setWsConnected(false);
        safeClose(ws);
      };

      ws.onclose = (evt) => {
        if (stoppedRef.current) return;

        setWsConnected(false);
        console.warn("Finnhub WS CLOSE", {
          code: evt.code,
          reason: evt.reason,
          wasClean: evt.wasClean,
        });

        // 1008 is commonly policy/unauthorized or too many connections
        if (evt.code === 1008) return;

        // exponential-ish backoff
        const wait = Math.min(15000, 1200 * Math.pow(2, attempt));
        if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
        reconnectRef.current = window.setTimeout(() => connect(attempt + 1), wait);
      };
    };

    // connect once (small delay optional)
    const t = window.setTimeout(() => connect(0), 800);

    return () => {
      stoppedRef.current = true;
      window.clearTimeout(t);
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
      safeClose(socketRef.current);
      socketRef.current = null;
    };
    // IMPORTANT: do not depend on tradeInfoMap or SYMBOLS changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  /* ------------------------------------------------------------------ */
  /*  Modal fetch                                                       */
  /* ------------------------------------------------------------------ */
  const openSymbolModal = async (sym: string) => {
    setModalLoading(true);
    try {
      await ensureProfile(sym);

      const [quote, profile, metric, news] = await Promise.all([
        fetch(`${PROXY_BASE}/quote/${sym}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/profile/${sym}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/metric/${sym}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/news/${sym}`).then((r) => (r.ok ? r.json() : [])),
      ]);

      if (!quote || typeof quote.c !== "number" || quote.c <= 0) return;

      let profileData = profile || symbolProfiles[sym] || {};
      if (!profileData.name) {
        profileData = {
          ...profileData,
          name: sym,
          ticker: sym,
          exchange: profileData.exchange ?? "",
          logo: profileData.logo ?? "",
        };
      }

      setSelectedStockData({ profile: profileData, quote, metric });
      setSelectedNewsData(Array.isArray(news) ? news : []);
      setSelectedSymbol(sym);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedSymbol(null);
    setSelectedStockData(null);
    setSelectedNewsData([]);
  };

  /* ------------------------------------------------------------------ */
  /*  Derived UI                                                        */
  /* ------------------------------------------------------------------ */
  const banner =
    marketState === "closed"
      ? "Markets Closed — Showing Last Price as of market close."
      : marketState === "premarket"
      ? "Pre-Market Trading"
      : marketState === "afterhours"
      ? "After-Hours Trading"
      : null;

  const bannerColor = marketState === "closed" ? "text-red-600" : "text-yellow-500";

  const sub =
    marketState === "open" ? "Live" : marketState === "premarket" ? "Pre" : marketState === "afterhours" ? "After" : "Closed";

  const statusPill =
    marketState === "open"
      ? "bg-green-500/15 text-green-700 dark:text-green-200 ring-green-500/20"
      : marketState === "closed"
      ? "bg-red-500/15 text-red-700 dark:text-red-200 ring-red-500/20"
      : "bg-yellow-500/15 text-yellow-800 dark:text-yellow-200 ring-yellow-500/20";

  const wsPill = wsConnected
    ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 ring-indigo-500/20"
    : "bg-gray-500/10 text-gray-700 dark:text-gray-300 ring-white/10";

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */
  return (
    <>
      <ToastContainer position="top-right" autoClose={3500} hideProgressBar pauseOnHover />

      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-brand-900 shadow-sm">
        {/* header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Exchange Heatmap</h2>

                <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusPill}`} title="Market session">
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {sub}
                </span>

                <span className={`hidden sm:inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${wsPill}`} title="WebSocket status">
                  {wsConnected ? "Stream OK" : marketState === "closed" ? "Stream paused" : "Reconnecting"}
                </span>
              </div>

              <p className="mt-2 text-xs font-semibold text-gray-600 dark:text-white/60">
                Live price updates when markets are open. Off-hours shows last price & daily % change. Click on card for more details.
              </p>
            </div>
          </div>

          {banner && <div className={`mt-3 text-center text-xs font-semibold ${bannerColor} animate-pulse`}>{banner}</div>}
        </div>

        {/* grid */}
        <div className="px-3 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-2">
            {SYMBOLS.map((sym) => {
              const info = tradeInfoMap[sym];
              const logo = symbolLogos[sym] || symbolProfiles[sym]?.logo || LOGO_FALLBACK;

              const p = info?.percentChange ?? 0;

              // stronger, exchange-like coloring based on daily percent change
              const baseBg =
                p >= 2
                  ? "bg-emerald-400/80 dark:bg-emerald-700/45"
                  : p >= 0.2
                  ? "bg-emerald-300/70 dark:bg-emerald-700/30"
                  : p <= -2
                  ? "bg-rose-400/80 dark:bg-rose-700/45"
                  : p <= -0.2
                  ? "bg-rose-300/70 dark:bg-rose-700/30"
                  : "bg-gray-100 dark:bg-brand-900/60";

              const flashBg =
                info?.dir === "up"
                  ? "bg-emerald-500/55 dark:bg-emerald-500/25"
                  : info?.dir === "down"
                  ? "bg-rose-500/55 dark:bg-rose-500/25"
                  : "bg-white/0";

              const price = usd(info?.price);
              const ptxt = pctText(info?.percentChange);

              const pctColor =
                (info?.percentChange ?? 0) >= 0 ? "text-emerald-900 dark:text-emerald-200" : "text-rose-900 dark:text-rose-200";

              return (
                <motion.button
                  key={sym}
                  type="button"
                  onClick={() => openSymbolModal(sym)}
                  // onMouseEnter={() => ensureProfile(sym)}
                  className={`relative aspect-square w-full overflow-hidden rounded-xl border border-gray-200/60 dark:border-white/10 ${baseBg} shadow-sm`}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  title={`${sym} details`}
                >
                  {/* center logo */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-white/35 dark:bg-black/0" />
                    <img
                      src={logo}
                      alt={sym}
                      className="h-13 w-13 object-contain opacity-85"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = LOGO_FALLBACK;
                      }}
                    />
                    
                  </div>

                  {/* flash overlay */}
                  <AnimatePresence initial={false}>
                    {info?.flashKey ? (
                      <motion.div
                        key={`${sym}-${info.flashKey}`}
                        className={`absolute inset-0 ${flashBg}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      />
                    ) : null}
                  </AnimatePresence>

                  {/* top-left */}
                  <div className="absolute left-2 top-2 rounded-md bg-white/75 dark:bg-black/25 px-2 py-1 text-[10px] font-extrabold tracking-wide text-gray-900 dark:text-white ring-1 ring-black/5 dark:ring-white/10">
                    {sym}
                    {symbolProfiles[sym]?.name ? (
                      <div className="mt-0.5 max-w-[92px] text-[9px] font-semibold text-gray-700/90 dark:text-white/70 line-clamp-1">
                        {symbolProfiles[sym]?.name}
                      </div>
                    ) : null}
                  </div>

                  {/* bottom strip */}
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 px-2 py-1.5 bg-white/80 dark:bg-black/30">
                    <span className="text-[11px] font-semibold text-gray-900 dark:text-white">{price}</span>
                    <span className={`text-[11px] font-semibold ${pctColor}`}>{ptxt}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
            See more stock market data{" "}
            <a href="/stocks" className="text-indigo-600 dark:text-indigo-300 underline">
              here
            </a>
            .
          </p>
        </div>
      </section>

      {/* Modal loading */}
      {modalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-2xl bg-white/10 p-4 shadow-xl ring-1 ring-white/10">
            <div className="animate-spin h-10 w-10 border-t-4 border-indigo-400 rounded-full" />
          </div>
        </div>
      )}

      {selectedSymbol && selectedStockData && (
        <StockQuoteModal stockData={selectedStockData} newsData={selectedNewsData} onClose={closeModal} />
      )}
    </>
  );
};

export default LiveStreamHeatmapSection;
