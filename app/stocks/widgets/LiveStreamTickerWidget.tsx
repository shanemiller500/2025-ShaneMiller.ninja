"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { API_TOKEN } from "@/utils/config";
import StockQuoteModal from "../StockQuoteModal";

/* Types ------------------------------------------------------------ */
const SYMBOLS = ["AAPL", "MSFT", "AMZN", "GOOGL", "TSLA", "META", "NVDA", "JPM", "V", "NFLX", "AMD", "IBM"] as const;
type Symbol = (typeof SYMBOLS)[number];
type MarketState = "open" | "premarket" | "afterhours" | "closed";

interface TradeInfo {
  timestamp: number;
  price: number;
  prevClose?: number;
  prevTick?: number;
  percentChange: number;
  dir?: "up" | "down" | "flat";
  flashKey: number;
}

/* Constants -------------------------------------------------------- */
const PROXY_BASE = "https://u-mail.co/api/finnhubProxy";
const WS_RECONNECT_DELAY = 2500;
const LOGO_FALLBACK = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="%23EEF2FF"/><text x="50%" y="54%" font-family="Arial" font-size="7" text-anchor="middle" fill="%234C1D95">Logo Loading...</text></svg>';

/* Utilities -------------------------------------------------------- */
const fmt = {
  usd: (n: number | null | undefined) => typeof n === "number" && Number.isFinite(n) ? `$${n.toFixed(2)}` : "—",
  pct: (n: number | null | undefined) => typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(2)}%` : "",
};

const safeJson = async (r: Response) => {
  try { return await r.json(); } catch { return null; }
};

const cleanLogo = (url?: string) => {
  if (!url) return "";
  try { return new URL(url).toString(); } catch { return ""; }
};

const calcMarketState = (): MarketState => {
  const now = new Date();
  const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = est.getDay();
  const mins = est.getHours() * 60 + est.getMinutes();

  if (day === 0 || day === 6) return "closed";
  if (mins >= 570 && mins < 960) return "open"; // 9:30 AM - 4:00 PM
  if (mins >= 240 && mins < 570) return "premarket"; // 4:00 AM - 9:30 AM
  if (mins >= 960 && mins < 1200) return "afterhours"; // 4:00 PM - 8:00 PM
  return "closed";
};

/* Component -------------------------------------------------------- */
export default function LiveStreamTickerWidget() {
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

  /* Update market state every minute */
  useEffect(() => {
    const tick = () => setMarketState(calcMarketState());
    tick();
    const interval = window.setInterval(tick, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  /* Fetch initial quotes to set prices and colors immediately */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.all(
        SYMBOLS.map(async (sym, i) => {
          try {
            await new Promise((r) => setTimeout(r, i * 120));
            const r = await fetch(`${PROXY_BASE}/quote/${sym}`);
            const q = await safeJson(r);
            if (cancelled || !q || typeof q.c !== "number" || q.c <= 0 || typeof q.pc !== "number" || q.pc <= 0) return;

            const price = q.c;
            const prevClose = q.pc;
            const percentChange = ((price - prevClose) / prevClose) * 100;
            const dir: TradeInfo["dir"] = price > prevClose ? "up" : price < prevClose ? "down" : "flat";

            setTradeInfoMap((prev) => ({
              ...prev,
              [sym]: { timestamp: Date.now(), price, prevClose, prevTick: undefined, percentChange, dir, flashKey: Date.now() },
            }));
          } catch (err) {
            console.error(`Initial quote fetch error for ${sym}:`, err);
          }
        })
      );
    })();

    return () => { cancelled = true; };
  }, []);

  /* Fetch company profiles and logos */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await Promise.all(
        SYMBOLS.map(async (sym, i) => {
          try {
            await new Promise((r) => setTimeout(r, i * 120));
            const r = await fetch(`${PROXY_BASE}/profile/${sym}`);
            const p = await safeJson(r);
            if (cancelled) return;

            const logo = cleanLogo(p?.logo);
            if (logo) setSymbolLogos((prev) => ({ ...prev, [sym]: logo }));
            setSymbolProfiles((prev) => ({ ...prev, [sym]: p || {} }));
          } catch (err) {
            console.error(`Profile fetch error for ${sym}:`, err);
          }
        })
      );
    })();

    return () => { cancelled = true; };
  }, []);

  /* WebSocket connection for live price updates - stays open indefinitely */
  useEffect(() => {
    if (!API_TOKEN) return;

    stoppedRef.current = false;

    const safeClose = (sock: WebSocket | null) => {
      if (!sock) return;
      try {
        if (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING) {
          sock.close();
        }
      } catch {}
    };

    const connect = () => {
      if (stoppedRef.current) return;

      safeClose(socketRef.current);

      const ws = new WebSocket(`wss://ws.finnhub.io?token=${API_TOKEN}`);
      socketRef.current = ws;

      ws.onopen = () => {
        if (stoppedRef.current) return;
        setWsConnected(true);

        SYMBOLS.forEach((s) => {
          try {
            ws.send(JSON.stringify({ type: "subscribe", symbol: s }));
          } catch {}
        });
      };

      ws.onclose = (evt) => {
        if (stoppedRef.current) return;
        setWsConnected(false);

        if (process.env.NODE_ENV === "development") {
          console.warn("Finnhub WS closed:", { code: evt.code, reason: evt.reason });
        }

        if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
        reconnectRef.current = window.setTimeout(() => {
          if (!stoppedRef.current) connect();
        }, WS_RECONNECT_DELAY);
      };

      ws.onerror = () => {
        if (stoppedRef.current) return;
        setWsConnected(false);

        if (process.env.NODE_ENV === "development") {
          console.warn("Finnhub WS error (no details available)");
        }

        safeClose(ws);
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
          setWsConnected(false);
          if (process.env.NODE_ENV === "development") {
            console.warn("Finnhub message error:", msg);
          }
          safeClose(ws);
          return;
        }

        if (msg?.type !== "trade" || !Array.isArray(msg.data) || !msg.data.length) return;

        const updates = msg.data as Array<{ s: string; p: number; t: number }>;

        setTradeInfoMap((prev) => {
          const next = { ...prev };

          for (const u of updates) {
            const sym = u.s;
            if (!SYMBOLS.includes(sym as Symbol)) continue;

            const price = Number(u.p);
            if (!Number.isFinite(price) || price <= 0) continue;

            const prevEntry = prev[sym];
            const prevTick = prevEntry?.price;
            const prevClose = prevEntry?.prevClose;
            const base = typeof prevClose === "number" && prevClose > 0 ? prevClose : prevTick;
            const percentChange = typeof base === "number" && base > 0 ? ((price - base) / base) * 100 : 0;
            const dir: TradeInfo["dir"] = typeof prevTick === "number" ? 
              price > prevTick ? "up" : price < prevTick ? "down" : "flat" : prevEntry?.dir ?? "flat";

            next[sym] = {
              timestamp: u.t || Date.now(),
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
    };

    const timer = window.setTimeout(connect, 500);

    return () => {
      stoppedRef.current = true;
      window.clearTimeout(timer);
      if (reconnectRef.current) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      safeClose(socketRef.current);
    };
  }, []);

  /* Open stock detail modal */
  const openSymbolModal = async (sym: string) => {
    setModalLoading(true);
    try {
      const [quote, profile, metric, news] = await Promise.all([
        fetch(`${PROXY_BASE}/quote/${sym}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/profile/${sym}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/metric/${sym}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/news/${sym}`).then((r) => (r.ok ? r.json() : [])),
      ]);

      if (!quote || typeof quote.c !== "number" || quote.c <= 0) {
        toast.error(`No data found for "${sym}".`);
        return;
      }

      let profileData = profile || {};
      if (!profileData.name) {
        profileData = { ...profileData, name: sym, ticker: sym, exchange: profileData.exchange ?? "", logo: profileData.logo ?? "" };
      }

      setSelectedStockData({ profile: profileData, quote, metric });
      setSelectedNewsData(Array.isArray(news) ? news : []);
      setSelectedSymbol(sym);
    } catch (err: any) {
      toast.error(err?.message || "Failed to fetch symbol data.");
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedSymbol(null);
    setSelectedStockData(null);
    setSelectedNewsData([]);
  };

  /* UI state */
  const banner = marketState === "closed" ? "Markets Closed" : 
    marketState === "premarket" ? "Pre-Market Trading" : 
    marketState === "afterhours" ? "After-Hours Trading" : null;

  const bannerColor = marketState === "closed" ? "text-red-600" : "text-yellow-500";
  const sub = marketState === "open" ? "Live" : marketState === "premarket" ? "Pre" : marketState === "afterhours" ? "After" : "Closed";
  
  const statusPill = marketState === "open" ? "bg-green-500/15 text-green-700 dark:text-green-200 ring-green-500/20" :
    marketState === "closed" ? "bg-red-500/15 text-red-700 dark:text-red-200 ring-red-500/20" :
    "bg-yellow-500/15 text-yellow-800 dark:text-yellow-200 ring-yellow-500/20";
  
  const wsPill = wsConnected ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 ring-indigo-500/20" :
    "bg-gray-500/10 text-gray-700 dark:text-gray-300 ring-white/10";

  return (
    <>
      <ToastContainer position="top-right" autoClose={4000} hideProgressBar pauseOnHover />

      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-brand-900 shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Live Stock Ticker</h2>
                <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusPill}`} title="Market session">
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                  {sub}
                </span>
                <span className={`hidden sm:inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${wsPill}`} title="WebSocket status">
                  {wsConnected ? "Stream OK" : "Stream reconnecting"}
                </span>
              </div>
            </div>
          </div>

          {banner && (
            <div className={`mt-4 text-center text-xs font-semibold ${bannerColor} animate-pulse`}>
              {banner}
            </div>
          )}
        </div>

        <div className="px-3 pb-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-2">
            {SYMBOLS.map((sym) => {
              const info = tradeInfoMap[sym];
              const logo = symbolLogos[sym] || symbolProfiles[sym]?.logo || "";
              const dir = info?.dir ?? "flat";

              const baseBg = dir === "up" ? "bg-green-200/80 dark:bg-green-800/40" :
                dir === "down" ? "bg-red-200/80 dark:bg-red-800/40" : "bg-gray-100 dark:bg-brand-900/60";

              const flashBg = dir === "up" ? "bg-green-400/70 dark:bg-green-500/35" :
                dir === "down" ? "bg-red-400/70 dark:bg-red-500/35" : "bg-white/0";

              const pctColor = (info?.percentChange ?? 0) >= 0 ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200";

              return (
                <motion.button
                  key={sym}
                  type="button"
                  onClick={() => openSymbolModal(sym)}
                  className={`relative aspect-square w-full overflow-hidden rounded-xl border border-gray-200/60 dark:border-white/10 ${baseBg} shadow-sm`}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  title={`${sym} details`}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <img src={logo || LOGO_FALLBACK} alt={sym} className="h-13 w-13 object-contain opacity-80" loading="lazy" />
                  </div>

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

                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 px-2 py-1.5 bg-white/75 dark:bg-black/30">
                    <span className="text-[11px] font-semibold text-gray-900 dark:text-white">{fmt.usd(info?.price)}</span>
                    <span className={`text-[11px] font-semibold ${pctColor}`}>{fmt.pct(info?.percentChange)}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <p className="mt-4 mb-4 text-xs text-gray-500 dark:text-gray-400 text-center">
            See more stock market data{" "}
            <a href="/stocks" className="text-indigo-600 dark:text-indigo-300 underline">here</a>.
          </p>
        </div>
      </section>

      {modalLoading && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="rounded-xl bg-white/10 px-4 py-3 text-white text-sm backdrop-blur">Loading…</div>
        </div>
      )}

      {selectedSymbol && selectedStockData && (
        <StockQuoteModal stockData={selectedStockData} newsData={selectedNewsData} onClose={closeModal} />
      )}
    </>
  );
}