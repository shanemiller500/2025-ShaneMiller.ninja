// Filename: StockQuoteSection.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const isLikelyUsTicker = (sym: string) => {
  const s = String(sym || "").trim().toUpperCase();
  if (!s) return false;

  // Fast reject: most non-US symbols contain a dot suffix (2330.TW, 2222.SR, VOD.L, etc.)
  // still allow a single class-suffix like BRK.B
  if (s.includes(".")) {
    return /^[A-Z]{1,5}\.[A-Z]$/.test(s); // BRK.B, BF.B, etc.
  }

  // Basic US ticker shape
  return /^[A-Z]{1,6}$/.test(s);
};

const isAllowedUsExchange = (exchangeRaw: any) => {
  const ex = String(exchangeRaw || "").toUpperCase();
  if (!ex) return false;

  return (
    ex.includes("NASDAQ") ||
    ex.includes("NMS") || // NASDAQ Global Market (often includes NMS)
    ex.includes("NYSE") ||
    ex.includes("NEW YORK STOCK EXCHANGE")
  );
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
  const suggestionProfilesRef = useRef<Record<string, any>>({});
  useEffect(() => {
    suggestionProfilesRef.current = suggestionProfiles;
  }, [suggestionProfiles]);

  // Negative cache: symbols that have no profile/logo available via proxy.
  const [noProfile, setNoProfile] = useState<Record<string, true>>({});
  const noProfileSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    noProfileSetRef.current = new Set(Object.keys(noProfile));
  }, [noProfile]);

  const noProfileRef = useRef<Record<string, { t: number; status: number }>>({});
  const inflightProfilesRef = useRef<Set<string>>(new Set());
  const profileCacheRef = useRef<Record<string, { t: number; p: any }>>({});

  const PROFILE_TTL = 6 * 60 * 60 * 1000; // 6h in-memory cache
  const NO_PROFILE_TTL = 6 * 60 * 60 * 1000; // 6h negative cache

  // Concurrency + queue for profile fetches
  const PROFILE_MAX_CONCURRENCY = 3;
  const profileQueueRef = useRef<string[]>([]);
  const activeProfileFetchesRef = useRef(0);

  // Optional: track failures to avoid hot-looping the same broken symbol
  const profileFailRef = useRef<Record<string, { t: number; c: number }>>({});
  const FAIL_TTL = 30_000; // 30s cooldown after repeated failures

  const prefetchRunRef = useRef(0);

  const ensureProfileForSuggestion = useCallback(async (symRaw: string) => {
    const sym = String(symRaw || "").trim().toUpperCase();
    if (!sym) return;

    // already loaded
    if (suggestionProfilesRef.current[sym]) return;

    // negative-cache hit (we already learned this symbol doesn't have a profile)
    const neg = noProfileRef.current[sym];
    const now = Date.now();
    if (neg && now - neg.t < NO_PROFILE_TTL) return;

    // TTL cache hit
    const hit = profileCacheRef.current[sym];
    if (hit?.p && now - hit.t < PROFILE_TTL) {
      setSuggestionProfiles((prev) => (prev[sym] ? prev : { ...prev, [sym]: hit.p }));
      return;
    }

    // short cooldown if it keeps failing for other reasons
    const fail = profileFailRef.current[sym];
    if (fail && now - fail.t < FAIL_TTL && fail.c >= 2) return;

    // de-dupe inflight per symbol
    if (inflightProfilesRef.current.has(sym)) return;
    inflightProfilesRef.current.add(sym);

    const enqueue = () => {
      if (!profileQueueRef.current.includes(sym)) {
        profileQueueRef.current.push(sym);
      }
      inflightProfilesRef.current.delete(sym);
    };

    if (activeProfileFetchesRef.current >= PROFILE_MAX_CONCURRENCY) {
      enqueue();
      return;
    }

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const pump = async () => {
      while (
        activeProfileFetchesRef.current < PROFILE_MAX_CONCURRENCY &&
        profileQueueRef.current.length > 0
      ) {
        const next = profileQueueRef.current.shift()!;
        ensureProfileForSuggestion(next); // fire & forget
        await sleep(0);
      }
    };

    activeProfileFetchesRef.current += 1;

    try {
      const url = `${PROXY_BASE}/profile/${encodeURIComponent(sym)}`;

      // 1 retry max for overload-ish responses (NOT for "no profile")
      let attempt = 0;
      let p: any = null;

      while (attempt < 2 && !p) {
        attempt += 1;

        const r = await fetch(url, { cache: "no-store" });

        if (!r.ok) {
          // Treat 500/404 as "no profile" for this proxy.
          if (r.status === 500 || r.status === 404) {
            noProfileRef.current[sym] = { t: Date.now(), status: r.status };
            setNoProfile((prev) => (prev[sym] ? prev : { ...prev, [sym]: true }));

            // Immediately hide from the dropdown to reduce clutter.
            setSuggestions((prev) => prev.filter((x) => x.symbol !== sym));

            // Human note for you:
            // Some tickers simply don't have a profile/logo on this endpoint.
            console.info(`[profiles] No profile/logo for ${sym} (proxy ${r.status}) → hiding from dropdown.`);

            return;
          }

          // retry only for rate-limit / transient server issues
          const retryable = r.status === 429 || r.status === 502 || r.status === 503 || r.status === 504;
          if (retryable && attempt < 2) {
            await sleep(350 + Math.floor(Math.random() * 250));
            continue;
          }

          break;
        }

        p = await r.json();
        if (!p) break;

        // If we did get a profile, only keep it if it's NYSE/NASDAQ.
        // Otherwise hide it from the dropdown to keep things "major US only".
        if (p && !isAllowedUsExchange(p.exchange)) {
          noProfileRef.current[sym] = { t: Date.now(), status: 204 }; // "not in our allowed exchange set"
          setNoProfile((prev) => (prev[sym] ? prev : { ...prev, [sym]: true }));
          setSuggestions((prev) => prev.filter((x) => x.symbol !== sym));

          // Human note:
          console.info(`[profiles] ${sym} exchange "${p.exchange || "?"}" is not NYSE/NASDAQ → hiding from dropdown.`);
          return;
        }
      }

      if (!p) {
        const prev = profileFailRef.current[sym];
        profileFailRef.current[sym] = { t: Date.now(), c: (prev?.c ?? 0) + 1 };
        return;
      }

      if (profileFailRef.current[sym]) delete profileFailRef.current[sym];

      profileCacheRef.current = {
        ...profileCacheRef.current,
        [sym]: { t: Date.now(), p },
      };

      setSuggestionProfiles((prev) => (prev[sym] ? prev : { ...prev, [sym]: p }));
    } catch {
      const prev = profileFailRef.current[sym];
      profileFailRef.current[sym] = { t: Date.now(), c: (prev?.c ?? 0) + 1 };
    } finally {
      inflightProfilesRef.current.delete(sym);
      activeProfileFetchesRef.current -= 1;
      void pump();
    }
  }, []);

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
        .filter((s: Suggestion) => !!s.symbol && isLikelyUsTicker(s.symbol))
        .slice(0, 20); // grab a few more before it de-dupe + later hide


        const seen = new Set<string>();
        const unique = cleaned.filter((s) => (seen.has(s.symbol) ? false : seen.add(s.symbol)));

        // Filter out anything we already learned has no profile.
        const filtered = unique.filter((s) => !noProfileSetRef.current.has(s.symbol));

        setSuggestions(filtered);
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

  /* Prefetch profiles for suggestions (kept small to reduce noisy 500s) */
  useEffect(() => {
    if (!openSuggest || suggestions.length === 0) return;

    const runId = ++prefetchRunRef.current;
    let cancelled = false;

    const PREFETCH_LIMIT = 6;
    const list = suggestions.slice(0, PREFETCH_LIMIT);

    (async () => {
      for (let i = 0; i < list.length; i++) {
        if (cancelled) return;
        if (runId !== prefetchRunRef.current) return;

        const sym = list[i]?.symbol;
        if (sym) ensureProfileForSuggestion(sym);

        // stagger
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 70));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openSuggest, suggestions, ensureProfileForSuggestion]);

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

    // opportunistic: fetch profile for the active item
    const sym = suggestions[activeIdx]?.symbol;
    if (sym) ensureProfileForSuggestion(sym);
  }, [activeIdx, suggestions, ensureProfileForSuggestion]);

  /* ─────────────────────────── Search handler ───────────────────────── */
  const handleSearch = async (sym?: string) => {
    const symbol = (sym ?? symbolInput).trim().toUpperCase();
    if (!symbol) return;

    setLoading(true);
    setError("");
    setOpenSuggest(false);
    setActiveIdx(-1);

    try {
      // Quote first (fast-fail)
      const quote = await fetch(`${PROXY_BASE}/quote/${encodeURIComponent(symbol)}`, { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null
      );

      if (!quote || typeof quote.c !== "number" || quote.c <= 0) {
        toast.error(`No data found for “${symbol}.” Try another symbol.`);
        setStockData(null);
        setNewsData([]);
        setShowModal(false);
        return;
      }

      const [profile, metric, news] = await Promise.all([
        fetch(`${PROXY_BASE}/profile/${encodeURIComponent(symbol)}`, { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`${PROXY_BASE}/metric/${encodeURIComponent(symbol)}`, { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`${PROXY_BASE}/news/${encodeURIComponent(symbol)}`, { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : []
        ),
      ]);

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
                      {suggestions
                        .filter((s) => !noProfileSetRef.current.has(s.symbol)) // extra guard
                        .map((s, idx) => {
                          const active = idx === activeIdx;

                          const p = suggestionProfiles[s.symbol] || {};
                          const logo = cleanLogo(p?.logo) || "";

                          return (
                            <motion.li
                              key={`${s.symbol}-${idx}`}
                              data-idx={idx}
                              role="option"
                              aria-selected={active}
                              onMouseEnter={() => {
                                setActiveIdx(idx);
                                ensureProfileForSuggestion(s.symbol);
                              }}
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

                              {/* Heatmap-style overlays */}
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
                                      <div className="h-8 w-8 rounded-xl bg-white/80 dark:bg-white/10 ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center overflow-hidden">
                                        {logo ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={logo}
                                            alt=""
                                            className="h-6 w-6 object-contain"
                                            loading="lazy"
                                            onError={(e) =>
                                              ((e.currentTarget as HTMLImageElement).style.display = "none")
                                            }
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
                className="w-full rounded-2xl px-4 py-3 text-sm font-extrabold shadow-sm ring-1 ring-black/10 dark:ring-white/10 bg-indigo-500/50 dark:bg-indigo-900/40 text-gray-900 dark:text-white hover:opacity-95 active:scale-[0.99] transition disabled:opacity-50"
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
