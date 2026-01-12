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

  const normalizedSymbol = useMemo(
    () => (symbolInput || "").trim().toUpperCase(),
    [symbolInput]
  );

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
        const data = await fetch(
          `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${API_TOKEN}`,
          { cache: "no-store" }
        )
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
        const unique = cleaned.filter((s) =>
          seen.has(s.symbol) ? false : seen.add(s.symbol)
        );

        setSuggestions(unique);
        setOpenSuggest(true); // open when we have results
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
    const el = listRef.current?.querySelector<HTMLLIElement>(
      `li[data-idx="${activeIdx}"]`
    );
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
        fetch(`${PROXY_BASE}/quote/${symbol}`, { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`${PROXY_BASE}/profile/${symbol}`, { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`${PROXY_BASE}/metric/${symbol}`, { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`${PROXY_BASE}/news/${symbol}`, { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : []
        ),
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
    <section className="space-y-6">
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar
        newestOnTop
        closeOnClick
        pauseOnHover
      />

      {/* Header card */}
      <div className="relative overflow-visible rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-5 shadow-sm">
        {/* soft blobs */}
        <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
          <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Stock Quote
            </h2>
            <p className="mt-1 text-sm font-semibold text-gray-700 dark:text-white/70">
              Search a ticker to open the full quote + news modal.
            </p>
          </div>

          <div className="text-xs font-semibold text-gray-600 dark:text-white/60">
            Data may be delayed.
          </div>
        </div>

        {/* Search box */}
        <div className="relative mt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-8">


              <div ref={wrapRef} className="">
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
                  className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] px-4 py-3 text-sm font-extrabold text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-white/40 outline-none focus:border-black/20 dark:focus:border-white/20"
                  aria-autocomplete="list"
                  aria-expanded={openSuggest}
                  aria-controls="ticker-suggestions"
                />

                {/* Dropdown (absolute + high z-index, no weird blur clipping) */}
                <AnimatePresence initial={false}>
                  {openSuggest && suggestions.length > 0 && (
                    <motion.ul
                      id="ticker-suggestions"
                      ref={listRef}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="absolute left-0 right-0 mt-2 max-h-64 overflow-auto rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-brand-900 shadow-xl"
                      style={{ zIndex: 9999 }}
                      role="listbox"
                    >
                      {suggestions.map((s, idx) => {
                        const active = idx === activeIdx;
                        return (
                          <li
                            key={`${s.symbol}-${idx}`}
                            data-idx={idx}
                            role="option"
                            aria-selected={active}
                            className={[
                              "cursor-pointer px-4 py-3",
                              "transition",
                              active
                                ? "bg-black dark:bg-white/[0.10]"
                                : "hover:bg-black/[0.04] dark:hover:bg-white/[0.08]",
                            ].join(" ")}
                            onMouseEnter={() => setActiveIdx(idx)}
                            onMouseDown={(e) => {
                              // mousedown avoids blur-before-click issues
                              e.preventDefault();
                              handleSearch(s.symbol);
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-extrabold text-gray-900 dark:text-white">
                                  {s.symbol}
                                </div>
                                {s.description ? (
                                  <div className="truncate text-xs font-semibold text-gray-600 dark:text-white/60">
                                    {s.description}
                                  </div>
                                ) : null}
                              </div>
                              {s.type ? (
                                <span className="shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold ring-1 ring-black/10 dark:ring-white/10 bg-black/[0.03] dark:bg-white/[0.06] text-gray-800 dark:text-white/75">
                                  {s.type}
                                </span>
                              ) : null}
                            </div>
                          </li>
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
                disabled={loading && !showModal}
                className="w-full rounded-2xl px-4 py-3 text-sm font-extrabold text-gray-900 dark:text-white ring-1 ring-black/10 dark:ring-white/10 bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.10] transition disabled:opacity-50"
              >
                Clear
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

      {/* Default widgets (only when not showing modal) */}
      {!loading && (!showModal || !stockData) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MarketWidgets onSelectTicker={handleSearch} />
          <NewsWidget />
        </div>
      )}

      {/* Modal */}
      {showModal && stockData && (
        <StockQuoteModal
          stockData={stockData}
          newsData={newsData}
          onClose={() => setShowModal(false)}
        />
      )}

      <p className="text-xs text-gray-600 dark:text-white/60 text-center">
        DISCLAIMER: All displayed stock quote data is delayed by a minimum of 15 minutes.
      </p>
    </section>
  );
}
