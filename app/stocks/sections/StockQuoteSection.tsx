// Filename: StockQuoteSection.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { ArrowRight, CornerDownLeft, Search, X } from "lucide-react";

import { API_TOKEN } from "@/utils/config";
import MarketWidgets from "../widgets/MarketWidgets";
import NewsWidget from "../widgets/NewsWidget";
import { useQuoteModal } from "../hooks/useQuoteModal";

const PROXY_BASE = "https://u-mail.co/api/finnhubProxy";

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

  const { openQuote, quoteModal, quoteLoading: loading } = useQuoteModal();

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
  const handleSearch = (sym?: string) => {
    const symbol = (sym ?? symbolInput).trim().toUpperCase();
    if (!symbol) return;
    setOpenSuggest(false);
    setActiveIdx(-1);
    setSymbolInput("");
    setSuggestions([]);
    void openQuote(symbol);
  };

  const handleClear = () => {
    setSymbolInput("");
    setSuggestions([]);
    setOpenSuggest(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
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
  const visibleSuggestions = suggestions.filter((x) => !noProfileSetRef.current.has(x.symbol));

  return (
    <section className="space-y-3 p-3 sm:p-5">
      {/* ── Search bar ───────────────────────────────────────────────── */}
      <div ref={wrapRef} className="relative z-20">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 transition focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:focus-within:border-indigo-400/40">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
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
            placeholder="Search a ticker or company — AAPL, Tesla, NVDA…"
            inputMode="text"
            autoCapitalize="characters"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-sm text-slate-900 shadow-none outline-none ring-0 focus:border-0 focus:ring-0 placeholder:font-sans placeholder:text-slate-400 dark:text-white"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={openSuggest && visibleSuggestions.length > 0}
            aria-controls="ticker-suggestions"
            aria-activedescendant={activeIdx >= 0 ? `ticker-opt-${activeIdx}` : undefined}
          />
          {symbolInput && !loading && (
            <button type="button" onClick={handleClear} aria-label="Clear search" className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={loading || !normalizedSymbol}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-indigo-300 dark:disabled:bg-white/10 dark:disabled:text-slate-500"
          >
            {loading ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <ArrowRight className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Quote</span>
          </button>
        </div>

        {/* Suggestions */}
        <AnimatePresence initial={false}>
          {openSuggest && visibleSuggestions.length > 0 && (
            <motion.ul
              id="ticker-suggestions"
              ref={listRef}
              role="listbox"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              className="absolute inset-x-0 mt-2 max-h-80 overflow-auto rounded-2xl border border-slate-200/70 bg-white/95 p-1.5 shadow-[0_24px_60px_-18px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-[#1f1f23]/95"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {visibleSuggestions.map((sug, idx) => {
                const active = idx === activeIdx;
                const prof = suggestionProfiles[sug.symbol] || {};
                const logo = cleanLogo(prof?.logo) || "";
                return (
                  <li
                    key={`${sug.symbol}-${idx}`}
                    id={`ticker-opt-${idx}`}
                    data-idx={idx}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => {
                      setActiveIdx(idx);
                      ensureProfileForSuggestion(sug.symbol);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSearch(sug.symbol);
                    }}
                    className={cn(
                      "flex cursor-pointer select-none items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
                      active ? "bg-slate-100 dark:bg-white/[0.06]" : "hover:bg-slate-50 dark:hover:bg-white/[0.03]"
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 dark:ring-white/10">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" className="h-6 w-6 object-contain" loading="lazy" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
                      ) : (
                        <span className="font-mono text-[10px] font-semibold text-slate-400">{sug.symbol.slice(0, 2)}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[13px] font-semibold text-slate-900 dark:text-white">{sug.symbol}</span>
                        {prof?.exchange && (
                          <span className="hidden truncate font-mono text-[10px] uppercase tracking-wider text-slate-400 sm:inline">
                            {String(prof.exchange).replace(/,.*$/, "")}
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{prof?.name || sug.description || "—"}</span>
                    </span>
                    {active ? (
                      <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    ) : sug.type ? (
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-slate-400">{sug.type}</span>
                    ) : null}
                  </li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* ── Market widgets + news ────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[1fr_360px]">
        <MarketWidgets onSelectTicker={handleSearch} />
        <NewsWidget />
      </div>

      {quoteModal}

      <p className="pt-1 text-center font-mono text-[10px] uppercase tracking-wider text-slate-400">
        Data delayed ~15 min · Finnhub · Not financial advice
      </p>
    </section>
  );
}
