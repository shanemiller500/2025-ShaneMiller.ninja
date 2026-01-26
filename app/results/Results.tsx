"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { trackEvent } from "@/utils/mixpanel";
import MainResults, { SearchHistoryItem } from "./MainResults";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const LS_KEY = "searchHistory";
const LS_TIME = "searchHistoryTs";
const TTL_MS = 30 * 60 * 1000;
const MAX_HISTORY_ITEMS = 10;
const HISTORY_DISPLAY_LIMIT = 6;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function clampText(s: string, n: number): string {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + "…";
}

/* ------------------------------------------------------------------ */
/*  Results Component                                                  */
/* ------------------------------------------------------------------ */
export default function Results() {
  const params = useSearchParams();

  const [query, setQ] = useState("");
  const [follow, setF] = useState("");
  const [hist, setH] = useState<SearchHistoryItem[]>([]);
  const [busy, setB] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    const ts = Number(localStorage.getItem(LS_TIME));
    if (raw && ts && Date.now() - ts < TTL_MS) setH(JSON.parse(raw));
  }, []);

  useEffect(() => {
    if (hist.length) {
      localStorage.setItem(LS_KEY, JSON.stringify(hist));
      localStorage.setItem(LS_TIME, Date.now().toString());
    }
  }, [hist]);

  useEffect(() => {
    const id = setInterval(() => {
      setH([]);
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_TIME);
    }, TTL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const run = async (q: string): Promise<void> => {
    const cleaned = (q || "").trim();
    if (!cleaned) return;

    setErr(null);
    setB(true);
    trackEvent("AI Search Submitted", { query: cleaned });

    try {
      const res = await fetch("https://u-mail.co/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: cleaned }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Search failed");
      }

      const data = await res.json();

      const item: SearchHistoryItem = {
        query: cleaned,
        summary: data.summary ?? "",
        links: data.links ?? [],
        images: data.images ?? [],
        tables: data.tables ?? [],
        followUpQuestions: data.followUpQuestions ?? [],
        wikipedia: data.wikipedia ?? null,
        keywords: data.keywords ?? [],
        isFinanceRelated: data.isFinanceRelated ?? false,
        isOpen: true,
      };

      setH((h) => [item, ...h.map((x) => ({ ...x, isOpen: false }))].slice(0, MAX_HISTORY_ITEMS));
    } catch (e: any) {
      console.error("search error", e);
      setErr(typeof e?.message === "string" ? e.message : "Something went wrong.");
    } finally {
      setB(false);
      setQ("");
    }
  };

  const submitMain = (e: FormEvent): void => {
    e.preventDefault();
    run(query);
  };

  const submitFollow = (e: FormEvent): void => {
    e.preventDefault();
    if (follow.trim()) {
      run(follow);
      setF("");
    }
  };

  const followTap = (q: string): Promise<void> => run(q);

  const toggle = (idx: number): void => {
    setH((h) =>
      h.map((it, i) => (i === idx ? { ...it, isOpen: !it.isOpen } : it))
    );
  };

  const clearAll = (): void => {
    setH([]);
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_TIME);
    trackEvent("AI Search History Cleared", {});
  };

  const active = useMemo(() => hist.find((x) => x.isOpen) ?? hist[0] ?? null, [hist]);

  useEffect(() => {
    const q = params.get("query");
    if (q) {
      setQ(q);
      run(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#1D1D20]">
      
      {/* ───────────────── MASTHEAD ───────────────── */}
      <header className="border-b-4 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20]">
        <div className="mx-auto max-w-[1400px] px-6 py-8">
          {/* Top bar - Logo + Date */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b border-neutral-200 dark:border-neutral-700">
            <div>
              <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-1 text-neutral-900 dark:text-neutral-100" style={{ fontFamily: '"Playfair Display", serif' }}>
                The Search
              </h1>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400 font-semibold" style={{ fontFamily: '"Courier New", monospace' }}>
                AI-Powered Research · Est. 2025
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-1">Today</p>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-300">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>

          {/* Search Bar */}
          <form onSubmit={submitMain}>
            <div className="relative mb-4">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQ(e.target.value)}
                placeholder="What would you like to discover today?"
                className="w-full border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] text-neutral-900 dark:text-neutral-100 px-6 py-5 text-lg outline-none focus:bg-neutral-50 dark:focus:bg-neutral-900 transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
                style={{ fontFamily: '"Merriweather", serif' }}
              />
              
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 md:flex-none bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-8 py-3 text-sm font-bold uppercase tracking-wider hover:bg-neutral-700 dark:hover:bg-neutral-300 disabled:opacity-50 transition-colors"
              >
                {busy ? "Researching..." : "Search"}
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] text-neutral-900 dark:text-neutral-100 px-6 py-3 text-sm font-bold uppercase tracking-wider hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Clear History
              </button>
            </div>
          </form>
        </div>
      </header>

      {/* ───────────────── LOADER ───────────────── */}
      {busy && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 dark:bg-[#1D1D20]/95">
          <div className="w-16 h-16 border-4 border-neutral-200 dark:border-neutral-700 border-t-neutral-900 dark:border-t-neutral-100 rounded-full animate-spin"></div>
          <p className="mt-6 text-sm font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Researching</p>
        </div>
      )}

      {/* ───────────────── MAIN CONTENT ───────────────── */}
      <main className="mx-auto max-w-[1400px] px-6 py-10">
        
        {/* Desktop Layout: Magazine Style */}
        <div className="hidden lg:block">
          {!active && !busy ? (
            <div className="text-center py-24">
              <div className="inline-block border-4 border-neutral-900 dark:border-neutral-100 p-12 bg-white dark:bg-[#1D1D20]">
                <svg className="w-16 h-16 mx-auto mb-4 text-neutral-300 dark:text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2"/>
                </svg>
                <p className="text-sm uppercase tracking-widest text-neutral-400 dark:text-neutral-500 font-bold">No Active Search</p>
                <p className="mt-2 text-neutral-600 dark:text-neutral-400 italic" style={{ fontFamily: '"Merriweather", serif' }}>
                  Submit a query to begin your research
                </p>
              </div>
            </div>
          ) : active ? (
            <div>
              {/* Hero Query Header */}
              <div className="mb-12 pb-8 border-b-2 border-neutral-900 dark:border-neutral-100">
                <div className="flex items-start gap-8">
                  {/* Large decorative number */}
                  <div className="hidden xl:block text-[120px] font-black leading-none text-neutral-900 dark:text-neutral-100 opacity-10" style={{ fontFamily: '"Playfair Display", serif' }}>
                    1
                  </div>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-[0.3em] text-red-600 dark:text-red-400 font-bold mb-3">
                      {active.isFinanceRelated ? "Financial Analysis" : "Research Report"}
                    </p>
                    <h2 className="text-4xl md:text-5xl font-black leading-tight mb-4 text-neutral-900 dark:text-neutral-100" style={{ fontFamily: '"Playfair Display", serif' }}>
                      {active.query}
                    </h2>
                    <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-neutral-400 dark:bg-neutral-600 rounded-full"></div>
                        {active.links.length} sources cited
                      </span>
                      {active.images.length > 0 && (
                        <span className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-neutral-400 dark:bg-neutral-600 rounded-full"></div>
                          {active.images.length} images
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {err && (
                <div className="mb-8 border-l-4 border-red-600 bg-red-50 p-6">
                  <p className="font-bold text-red-900 mb-1">Error</p>
                  <p className="text-sm text-red-700">{err}</p>
                </div>
              )}

              {/* Magazine Grid Layout */}
              <MainResults
                result={active}
                followField={follow}
                setFollowField={setF}
                followSubmit={submitFollow}
                followClick={followTap}
              />
            </div>
          ) : null}

          {/* Sidebar: Recent Searches */}
          {hist.length > 0 && (
            <aside className="mt-16 pt-12 border-t-2 border-neutral-200 dark:border-neutral-700">
              <h3 className="text-2xl font-black mb-6 text-neutral-900 dark:text-neutral-100" style={{ fontFamily: '"Playfair Display", serif' }}>
                Recent Searches
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {hist.slice(0, HISTORY_DISPLAY_LIMIT).map((it, i) => (
                  <button
                    key={i}
                    onClick={() => toggle(i)}
                    className={[
                      "text-left p-5 border-2 transition-all group",
                      it.isOpen 
                        ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900" 
                        : "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1D1D20] text-neutral-900 dark:text-neutral-100 hover:border-neutral-400 dark:hover:border-neutral-600"
                    ].join(" ")}
                  >
                    <p className="text-xs uppercase tracking-wider text-red-600 dark:text-red-400 mb-2 font-bold">
                      {it.isFinanceRelated ? "Finance" : "General"}
                    </p>
                    <h4 className="font-bold text-sm leading-snug line-clamp-2 mb-1">
                      {it.query}
                    </h4>
                    <p className="text-xs opacity-60">
                      {it.links.length} sources
                    </p>
                  </button>
                ))}
              </div>
            </aside>
          )}
        </div>

        {/* Mobile Layout: Accordion */}
        <div className="lg:hidden space-y-6">
          {!hist.length && !busy && (
            <div className="border-2 border-neutral-200 dark:border-neutral-700 p-8 text-center bg-white dark:bg-[#1D1D20]">
              <svg className="w-12 h-12 mx-auto mb-4 text-neutral-300 dark:text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2"/>
              </svg>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 italic" style={{ fontFamily: '"Merriweather", serif' }}>
                Begin your search above
              </p>
            </div>
          )}

          {hist.map((it, i) => (
            <article key={i} className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] overflow-hidden">
              <button
                onClick={() => toggle(i)}
                className="w-full p-6 text-left"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-red-600 dark:text-red-400 font-bold mb-2">
                      {it.isFinanceRelated ? "Finance" : "Research"}
                    </p>
                    <h3 className="text-xl font-black leading-tight text-neutral-900 dark:text-neutral-100" style={{ fontFamily: '"Playfair Display", serif' }}>
                      {it.query}
                    </h3>
                  </div>
                  <div className="text-2xl font-bold text-neutral-300 dark:text-neutral-700">
                    {it.isOpen ? "−" : "+"}
                  </div>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {it.links.length} sources • {it.isOpen ? "Hide" : "Show"} details
                </p>
              </button>

              {it.isOpen && (
                <div className="border-t-2 border-neutral-900 dark:border-neutral-100 p-6 bg-neutral-50 dark:bg-neutral-900">
                  {err && (
                    <div className="mb-6 border-l-4 border-red-600 bg-red-50 dark:bg-red-950/30 p-4">
                      <p className="text-sm text-red-700 dark:text-red-400">{err}</p>
                    </div>
                  )}
                  <MainResults
                    result={it}
                    followField={follow}
                    setFollowField={setF}
                    followSubmit={submitFollow}
                    followClick={followTap}
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      </main>

      {/* Footer */}
       <footer className="border-t-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] mt-20 py-8">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              Powered by <a className="font-semibold text-neutral-600 dark:text-neutral-300 transition-colors duration-200 hover:text-neutral-900 dark:hover:text-white hover:underline underline-offset-4" target="_blank" rel="noopener noreferrer" href="https://holdmybeer.info/">Hold My Beer CO</a> AI Research Technology
            </p>
            <div className="flex items-center gap-6 text-xs text-neutral-500 dark:text-neutral-400">
              <span>© 2025 The Search</span>
              <span>•</span>
              <span>Privacy-First Design</span>
            </div>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap');
      `}</style>
    </div>
  );
}

export const dynamic = "force-dynamic";