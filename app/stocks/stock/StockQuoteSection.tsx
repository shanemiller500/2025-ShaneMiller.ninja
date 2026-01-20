// Filename: StockQuoteSection.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import "react-toastify/dist/ReactToastify.css";

import { API_TOKEN } from "@/utils/config";
import MarketWidgets from "./MarketWidgets";
import NewsWidget from "./NewsWidget";
import StockQuoteModal from "./StockQuoteModal";

const PROXY_BASE = "https://u-mail.co/api/finnhubProxy";

interface QuoteData {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  v: number;
  t: number;
}

type Suggestion = { symbol: string; description?: string; type?: string };

function useDebouncedValue<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const cleanLogo = (url?: string) => {
  if (!url) return "";
  try {
    return new URL(url).toString();
  } catch {
    return "";
  }
};

export default function StockQuoteSection() {
  const [symbolInput, setSymbolInput] = useState("");
  const debounced = useDebouncedValue(symbolInput, 250);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [openSuggest, setOpenSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const [stockData, setStockData] = useState<{
    profile: any;
    quote: QuoteData;
    metric: any;
  } | null>(null);

  const [newsData, setNewsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const normalizedSymbol = useMemo(() => (symbolInput || "").trim().toUpperCase(), [symbolInput]);

  /* ─────────────────────────  Suggestion profiles cache  ───────────────────────── */
  const [suggestionProfiles, setSuggestionProfiles] = useState<Record<string, any>>({});
  const inflightProfilesRef = useRef<Set<string>>(new Set());
  const profileCacheRef = useRef<Record<string, { t: number; p: any }>>({});
  const PROFILE_TTL = 6 * 60 * 60 * 1000; // 6h in-memory cache

  const ensureProfileForSuggestion = async (sym: string) => {
    if (!sym) return;
    if (suggestionProfiles[sym]) return;

    const hit = profileCacheRef.current[sym];
    const now = Date.now();
    if (hit?.p && now - hit.t < PROFILE_TTL) {
      setSuggestionProfiles((prev) => ({ ...prev, [sym]: hit.p }));
      return;
    }

    if (inflightProfilesRef.current.has(sym)) return;
    inflightProfilesRef.current.add(sym);

    try {
      const r = await fetch(`${PROXY_BASE}/profile/${sym}`, { cache: "no-store" });
      const p = r.ok ? await r.json() : null;
      if (!p) return;

      profileCacheRef.current = {
        ...profileCacheRef.current,
        [sym]: { t: Date.now(), p },
      };

      setSuggestionProfiles((prev) => ({ ...prev, [sym]: p }));
    } catch {
      // ignore
    } finally {
      inflightProfilesRef.current.delete(sym);
    }
  };

  /* ─────────────────────────── Autocomplete ─────────────────────────── */
  useEffect(() => {
    let cancel = false;

    (async () => {
      const q = debounced.trim();
      if (!q) {
        setSuggestions([]);
        setOpenSuggest(false);
        setActiveIdx(-1);
        return;
      }

      try {
        const data = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${API_TOKEN}`, {
          cache: "no-store",
        })
          .then((r) => (r.ok ? r.json() : { result: [] }))
          .catch(() => ({ result: [] }));

        if (cancel) return;

        const rows = Array.isArray(data?.result) ? data.result : [];
        const cleaned: Suggestion[] = rows
          .map((i: any) => ({
            symbol: String(i.symbol || "").toUpperCase(),
            description: i.description ? String(i.description) : "",
            type: i.type ? String(i.type) : "",
          }))
          .filter((s: Suggestion) => !!s.symbol)
          .slice(0, 12);

        const seen = new Set<string>();
        const unique = cleaned.filter((s) => (seen.has(s.symbol) ? false : seen.add(s.symbol)));

        setSuggestions(unique);
        setOpenSuggest(true);
        setActiveIdx(-1);
      } catch {
        if (!cancel) {
          setSuggestions([]);
          setOpenSuggest(false);
          setActiveIdx(-1);
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [debounced]);

  /* Prefetch profiles for the visible suggestions (so logos become backgrounds) */
  useEffect(() => {
    if (!openSuggest || suggestions.length === 0) return;
    let cancelled = false;

    (async () => {
      // stagger a bit so it feels smooth and doesn’t spike
      for (let i = 0; i < suggestions.length; i++) {
        if (cancelled) return;
        const sym = suggestions[i]?.symbol;
        if (sym) {
          // eslint-disable-next-line no-await-in-loop
          await ensureProfileForSuggestion(sym);
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 90));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSuggest, suggestions]);

  /* ─────────────────────── Close dropdown on outside click ─────────── */
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (!wrapRef.current?.contains(t)) {
        setOpenSuggest(false);
        setActiveIdx(-1);
      }
    };
    window.addEventListener("pointerdown", onDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onDown, { capture: true } as any);
  }, []);

  /* ─────────────────────────── Keep active item visible ─────────────── */
  useEffect(() => {
    if (activeIdx < 0) return;
    const el = listRef.current?.querySelector<HTMLLIElement>(`li[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  /* ─────────────────────────── Search handler ───────────────────────── */
  const handleSearch = async (sym?: string) => {
    const symbol = (sym ?? symbolInput).trim().toUpperCase();
    if (!symbol) return;

    setLoading(true);
    setError("");
    setOpenSuggest(false);
    setActiveIdx(-1);

    try {
      const [quote, profile, metric, news] = await Promise.all([
        fetch(`${PROXY_BASE}/quote/${symbol}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/profile/${symbol}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/metric/${symbol}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
        fetch(`${PROXY_BASE}/news/${symbol}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
      ]);

      if (!quote || typeof quote.c !== "number" || quote.c <= 0) {
        toast.error(`No data found for “${symbol}.” Try another symbol.`);
        setStockData(null);
        setNewsData([]);
        setShowModal(false);
        return;
      }

      let profileData = profile || {};
      if (!profileData.name) {
        profileData = {
          ...profileData,
          name: symbol,
          ticker: symbol,
          exchange: profileData.exchange ?? "",
          logo: profileData.logo ?? "",
        };
      }

      setStockData({ profile: profileData, quote, metric });
      setNewsData(Array.isArray(news) ? news : []);
      setShowModal(true);

      setSymbolInput("");
      setSuggestions([]);
      setOpenSuggest(false);
    } catch (err: any) {
      toast.error(err?.message || "Something went wrong. Please try again.");
      setError(err?.message || "Error fetching data");
      setStockData(null);
      setNewsData([]);
      setShowModal(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSymbolInput("");
    setSuggestions([]);
    setOpenSuggest(false);
    setActiveIdx(-1);
    setStockData(null);
    setNewsData([]);
    setError("");
    setShowModal(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpenSuggest(false);
      setActiveIdx(-1);
      return;
    }

    const hasList = openSuggest && suggestions.length > 0;

    if (e.key === "Enter") {
      e.preventDefault();
      if (hasList && activeIdx >= 0) {
        handleSearch(suggestions[activeIdx].symbol);
      } else {
        handleSearch();
      }
      return;
    }

    if (!hasList) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
      return;
    }
  };

  /* ────────────────────────────── Render ────────────────────────────── */
  return (
    <section className="space-y-3">
      <ToastContainer position="top-right" autoClose={4000} hideProgressBar newestOnTop closeOnClick pauseOnHover />

      {/* Header card */}
      <div className="relative overflow-visible rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 shadow-sm">
        {/* soft blobs */}
        <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
          <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">Stock Quote</h2>
            <p className="mt-1 text-xs sm:text-sm font-semibold text-gray-600 dark:text-white/60">
              Search a ticker. The dropdown is styled like your heatmap tiles now.
            </p>
          </div>
        </div>

        {/* Search box */}
        <div className="relative mt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-8">
              <div ref={wrapRef} className="relative">
                <input
                  ref={inputRef}
                  value={symbolInput}
                  onChange={(e) => {
                    setSymbolInput(e.target.value);
                    setOpenSuggest(true);
                  }}
                  onKeyDown={onKeyDown}
                  onFocus={() => {
                    if (suggestions.length) setOpenSuggest(true);
                  }}
                  placeholder="AAPL, TSLA, NVDA…"
                  inputMode="text"
                  autoCapitalize="characters"
                  className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.06] px-4 py-3 text-sm font-extrabold text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-white/40 outline-none focus:border-black/20 dark:focus:border-white/20 shadow-[0_0_0_0_rgba(0,0,0,0)] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.14)] transition"
                  aria-autocomplete="list"
                  aria-expanded={openSuggest}
                  aria-controls="ticker-suggestions"
                />

                {/* Dropdown */}
                <AnimatePresence initial={false}>
                  {openSuggest && suggestions.length > 0 && (
                    <motion.ul
                      id="ticker-suggestions"
                      ref={listRef}
                      initial={{ opacity: 0, y: 10, scale: 0.99 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.99 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className={cn(
                        "absolute left-0 right-0 mt-2 max-h-72 overflow-auto",
                        "rounded-2xl border border-black/10 dark:border-white/10",
                        "bg-white/90 dark:bg-brand-900/85 backdrop-blur-xl",
                        "shadow-[0_24px_60px_-18px_rgba(0,0,0,0.45)]"
                      )}
                      style={{
                        zIndex: 9999,
                        WebkitOverflowScrolling: "touch" as any,
                      }}
                      role="listbox"
                    >
                      {suggestions.map((s, idx) => {
                        const active = idx === activeIdx;

                        const p = suggestionProfiles[s.symbol] || {};
                        const logo = cleanLogo(p?.logo) || "";

                        return (
                          <motion.li
                            key={`${s.symbol}-${idx}`}
                            data-idx={idx}
                            role="option"
                            aria-selected={active}
                            onMouseEnter={() => setActiveIdx(idx)}
                            onFocus={() => setActiveIdx(idx)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSearch(s.symbol);
                            }}
                            whileHover={{ y: -1.5, scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            transition={{ duration: 0.12 }}
                            className={cn(
                              "relative cursor-pointer select-none",
                              "mx-2 my-2 rounded-2xl overflow-hidden",
                              "ring-1 ring-black/10 dark:ring-white/10",
                              "shadow-sm",
                              active
                                ? "shadow-[0_18px_40px_-22px_rgba(99,102,241,0.55)] ring-indigo-500/30 dark:ring-indigo-400/30"
                                : "hover:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.35)]"
                            )}
                          >
                            {/* Logo-as-background layer */}
                            <div
                              className="absolute inset-0"
                              style={{
                                backgroundImage: logo ? `url(${logo})` : undefined,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                opacity: logo ? 0.42 : 0,
                                transform: "scale(1.05)",
                                filter: "saturate(1.1) contrast(1.05)",
                              }}
                            />

                            {/* Heatmap-style overlays (legibility + vibe) */}
                            <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-white/55 dark:from-black/65 dark:via-black/45 dark:to-black/25" />
                            <div className="absolute inset-0 opacity-70">
                              <div className="absolute -top-10 -left-10 h-28 w-28 rounded-full bg-indigo-500/10 blur-2xl" />
                              <div className="absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-fuchsia-500/10 blur-2xl" />
                            </div>

                            {/* Shine sweep */}
                            <div
                              className={cn(
                                "pointer-events-none absolute -inset-10 rotate-12 opacity-0 transition duration-200",
                                "bg-gradient-to-r from-transparent via-white/35 to-transparent",
                                active ? "opacity-70" : "group-hover:opacity-60"
                              )}
                            />

                            {/* Content */}
                            <div className="relative px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    {/* Small logo chip (so even if bg is subtle you still SEE it) */}
                                    <div className="h-8 w-8 rounded-xl bg-white/80 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center overflow-hidden">
                                      {logo ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={logo}
                                          alt=""
                                          className="h-6 w-6 object-contain"
                                          loading="lazy"
                                          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                                        />
                                      ) : (
                                        <span className="text-[10px] font-black text-gray-700 dark:text-white/70">
                                          {s.symbol.slice(0, 2)}
                                        </span>
                                      )}
                                    </div>

                                    <div className="text-sm font-black tracking-tight text-gray-900 dark:text-white">
                                      {s.symbol}
                                    </div>

                                    {p?.exchange ? (
                                      <span className="hidden sm:inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold bg-black/[0.04] dark:bg-white/[0.08] text-gray-700 dark:text-white/70 ring-1 ring-black/10 dark:ring-white/10">
                                        {String(p.exchange)}
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="mt-1">
                                    <div className="text-xs font-semibold text-gray-700 dark:text-white/70 truncate">
                                      {p?.name || s.description || "—"}
                                    </div>
                                  </div>
                                </div>

                                {s.type ? (
                                  <span className="shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold ring-1 ring-black/10 dark:ring-white/10 bg-black/[0.03] dark:bg-white/[0.06] text-gray-800 dark:text-white/75">
                                    {s.type}
                                  </span>
                                ) : null}
                              </div>

                              {/* subtle bottom “press enter” / active hint */}
                              <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-gray-600 dark:text-white/55">
                                <span className="truncate">{p?.weburl ? "Has website + logo" : "Fetching profile…"}</span>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 font-black ring-1",
                                    active
                                      ? "bg-indigo-600/15 text-indigo-800 ring-indigo-500/20 dark:text-indigo-200 dark:ring-indigo-400/20"
                                      : "bg-black/[0.03] text-gray-700 ring-black/10 dark:bg-white/[0.06] dark:text-white/70 dark:ring-white/10"
                                  )}
                                >
                                  {active ? "Enter" : "↵"}
                                </span>
                              </div>
                            </div>
                          </motion.li>
                        );
                      })}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="sm:col-span-4 flex sm:flex-col gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => handleSearch()}
                disabled={loading || !normalizedSymbol}
                className="w-full rounded-2xl px-4 py-3 text-sm font-extrabold text-white shadow-sm ring-1 ring-black/10 dark:ring-white/10 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50"
              >
                {loading ? "Searching…" : "Search"}
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="w-full rounded-2xl px-4 py-3 text-sm font-extrabold ring-1 ring-black/10 dark:ring-white/10 bg-white/70 dark:bg-white/[0.06] text-gray-900 dark:text-white hover:bg-white dark:hover:bg-white/[0.10] transition"
              >
                Reset
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      {/* Default widgets */}
      {!loading && (!showModal || !stockData) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <MarketWidgets onSelectTicker={handleSearch} />
          <NewsWidget />
        </div>
      )}

      {/* Modal */}
      {showModal && stockData && (
        <StockQuoteModal stockData={stockData} newsData={newsData} onClose={() => setShowModal(false)} />
      )}

      <p className="text-xs text-gray-600 dark:text-white/60 text-center">
        DISCLAIMER: All displayed stock quote data is delayed by a minimum of 15 minutes.
      </p>
    </section>
  );
}
