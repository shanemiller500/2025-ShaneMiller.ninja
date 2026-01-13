"use client";

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import MainResults, { SearchHistoryItem } from "./MainResults";
import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const LS_KEY = "searchHistory";
const LS_TIME = "searchHistoryTs";
const TTL = 30 * 60 * 1000; // 30 min

function clampText(s: string, n: number) {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1) + "…";
}

export default function Results() {
  const params = useSearchParams();

  const [query, setQ] = useState("");
  const [follow, setF] = useState("");
  const [hist, setH] = useState<SearchHistoryItem[]>([]);
  const [busy, setB] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  /* ---------- load + prune local history ---------- */
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    const ts = Number(localStorage.getItem(LS_TIME));
    if (raw && ts && Date.now() - ts < TTL) setH(JSON.parse(raw));
  }, []);

  /* ---------- persist history ---------- */
  useEffect(() => {
    if (hist.length) {
      localStorage.setItem(LS_KEY, JSON.stringify(hist));
      localStorage.setItem(LS_TIME, Date.now().toString());
    }
  }, [hist]);

  /* ---------- scheduled auto-clear ---------- */
  useEffect(() => {
    const id = setInterval(() => {
      setH([]);
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_TIME);
    }, TTL);
    return () => clearInterval(id);
  }, []);

  /* ---------- “/ to focus” ---------- */
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

  /* ---------- search helper ---------- */
  const run = async (q: string) => {
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

      setH((h) => [item, ...h.map((x) => ({ ...x, isOpen: false }))].slice(0, 10));
    } catch (e: any) {
      console.error("search error", e);
      setErr(typeof e?.message === "string" ? e.message : "Something went wrong.");
    } finally {
      setB(false);
      setQ("");
      // keep follow clear in submitFollow handler
    }
  };

  /* ---------- handlers ---------- */
  const submitMain = (e: FormEvent) => {
    e.preventDefault();
    run(query);
  };

  const submitFollow = (e: FormEvent) => {
    e.preventDefault();
    if (follow.trim()) {
      run(follow);
      setF("");
    }
  };

  const followTap = (q: string) => run(q);

  const toggle = (idx: number) => {
    setH((h) =>
      h.map((it, i) => (i === idx ? { ...it, isOpen: !it.isOpen } : it))
    );
  };

  const clearAll = () => {
    setH([]);
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_TIME);
    trackEvent("AI Search History Cleared", {});
  };

  const active = useMemo(() => hist.find((x) => x.isOpen) ?? hist[0] ?? null, [hist]);

  /* ---------- read ?query=… once ---------- */
  useEffect(() => {
    const q = params.get("query");
    if (q) {
      setQ(q);
      run(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-white text-brand-900 dark:bg-brand-900 dark:text-gray-100">
      {/* ───────────────── HEADER ───────────────── */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-brand-900/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          {/* Logo / Home */}
          <a href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-sm" />
            <div className="leading-tight">
              <div className="text-sm font-extrabold tracking-tight text-indigo-700 dark:text-indigo-300">
                AI Search
              </div>
              <div className="text-[11px] opacity-70">Answers + sources</div>
            </div>
          </a>

          {/* Search bar */}
          <form onSubmit={submitMain} className="flex w-full flex-col gap-2 sm:flex-row sm:flex-1 sm:items-center">
            <div className="flex flex-1 items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm dark:border-white/10 dark:bg-white/5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="opacity-70" aria-hidden="true">
                <path
                  d="M10.5 19a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M16.7 16.7 21 21"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>

              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search anything…"
                aria-label="Search query"
                className="w-full bg-transparent text-sm outline-none placeholder:opacity-60 sm:text-base"
              />

            </div>

            <button
              disabled={busy}
              className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:opacity-60 sm:text-base"
            >
              {busy ? "Searching…" : "Search"}
            </button>

            <button
              type="button"
              onClick={clearAll}
              className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 sm:text-base"
            >
              Clear
            </button>
          </form>
        </div>
      </header>

      {/* ───────────────── LOADER OVERLAY ───────────────── */}
      {busy && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/70 backdrop-blur dark:bg-brand-900/70">
          <div className="h-14 w-14 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="mt-4 text-sm opacity-80">Fetching fresh results…</p>
          <p className="mt-1 text-xs opacity-60">This is the part where it looks like magic.</p>
        </div>
      )}

      {/* ───────────────── BODY ───────────────── */}
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 sm:py-8 lg:grid-cols-12">
        {/* Left: history rail (desktop) */}
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-[84px] rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold opacity-80">Recent</div>
              <div className="text-xs opacity-60">{hist.length}/10</div>
            </div>

            {!hist.length && !busy ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm opacity-70 dark:border-white/10">
                No searches yet. Try something spicy.
              </div>
            ) : (
              <div className="space-y-2">
                {hist.map((it, i) => (
                  <button
                    key={i}
                    onClick={() => toggle(i)}
                    className={[
                      "w-full rounded-2xl border px-3 py-3 text-left transition",
                      it.isOpen
                        ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500/60 dark:bg-indigo-500/10"
                        : "border-gray-200 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5",
                    ].join(" ")}
                  >
                    <div className="text-sm font-semibold">
                      {clampText(it.query, 80)}
                    </div>
                    <div className="mt-1 text-xs opacity-70">
                      {it.isFinanceRelated ? "Finance-aware answer" : "General answer"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Right: active result */}
        <section className="lg:col-span-8">
          {/* mobile accordion */}
          <div className="space-y-3 lg:hidden">
            {!hist.length && !busy && (
              <div className="rounded-3xl border border-gray-200 bg-white p-5 text-sm opacity-70 shadow-sm dark:border-white/10 dark:bg-white/5">
                Enter a query above to start searching.
              </div>
            )}

            {hist.map((it, i) => (
              <div key={i} className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
                <button
                  onClick={() => toggle(i)}
                  className="flex w-full items-center justify-between px-4 py-4 text-left"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold sm:text-base">{it.query}</div>
                    <div className="mt-1 text-xs opacity-60">
                      {it.isFinanceRelated ? "Finance-aware answer" : "Answer + sources"}
                    </div>
                  </div>
                  <div className="ml-3 rounded-full border border-gray-200 px-3 py-1 text-sm opacity-70 dark:border-white/10">
                    {it.isOpen ? "−" : "+"}
                  </div>
                </button>

                {it.isOpen && (
                  <div className="border-t border-gray-200 px-4 py-5 dark:border-white/10">
                    {err && (
                      <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                        {err}
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
              </div>
            ))}
          </div>

          {/* desktop: single active result */}
          <div className="hidden lg:block">
            {!active && !busy ? (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 text-sm opacity-70 shadow-sm dark:border-white/10 dark:bg-white/5">
                Search above to generate your first result.
              </div>
            ) : active ? (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide opacity-60">
                      Result
                    </div>
                    <h1 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
                      {active.query}
                    </h1>
                  </div>

                  
                </div>

                {err && (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                    {err}
                  </div>
                )}

                <MainResults
                  result={active}
                  followField={follow}
                  setFollowField={setF}
                  followSubmit={submitFollow}
                  followClick={followTap}
                />
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

export const dynamic = "force-dynamic";
