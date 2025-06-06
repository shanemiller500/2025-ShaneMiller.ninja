/* app/(ai-search)/results.tsx */
"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import MainResults, { SearchHistoryItem } from "./MainResults";
import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */
const LS_KEY  = "searchHistory";
const LS_TIME = "searchHistoryTs";
const TTL     = 30 * 60 * 1000;            // 30 min

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function Results() {
  const params          = useSearchParams();
  const [query,  setQ]  = useState("");
  const [follow, setF]  = useState("");
  const [hist,   setH]  = useState<SearchHistoryItem[]>([]);
  const [busy,   setB]  = useState(false);

  /* ---------- load + prune local history ---------- */
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    const ts  = Number(localStorage.getItem(LS_TIME));
    if (raw && ts && Date.now() - ts < TTL) setH(JSON.parse(raw));
  }, []);

  /* ---------- persist history ---------- */
  useEffect(() => {
    if (hist.length) {
      localStorage.setItem(LS_KEY,  JSON.stringify(hist));
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

  /* ---------- search helper ---------- */
  const run = async (q: string) => {
    if (!q) return;
    setB(true);
    trackEvent("AI Search Submitted", { query: q });

    try {
      const res = await fetch("https://u-mail.co/api/search", {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify({ query: q }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      const item: SearchHistoryItem = {
        query       : q,
        summary     : data.summary ?? "",
        links       : data.links   ?? [],
        images      : data.images  ?? [],
        tables      : data.tables  ?? [],
        followUpQuestions : data.followUpQuestions ?? [],
        wikipedia        : data.wikipedia ?? null,
        keywords         : data.keywords  ?? [],
        isFinanceRelated : data.isFinanceRelated ?? false,
        isOpen      : true,
      };

      setH(h => [item, ...h.map(x => ({ ...x, isOpen: false }))].slice(0, 10));
    } catch (err) {
      console.error("search error", err);
    } finally {
      setB(false);
      setQ("");
    }
  };

  /* ---------- handlers ---------- */
  const submitMain   = (e: FormEvent) => { e.preventDefault(); run(query.trim()); };
  const submitFollow = (e: FormEvent) => { e.preventDefault(); if (follow.trim()) { run(follow.trim()); setF(""); } };
  const followTap    = (q: string) => run(q);
  const toggle       = (idx: number) => setH(h => h.map((it,i)=>i===idx?{...it,isOpen:!it.isOpen}:it));
  const clearAll     = () => { setH([]); localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_TIME); };

  /* ---------- read ?query=… once ---------- */
  useEffect(() => {
    const q = params.get("query");
    if (q) { setQ(q); run(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------------------------------------------------
     UI
  ---------------------------------------------------------------- */
  return (
    <>
      {/* HEADER */}
{/* ───────────────── HEADER ───────────────── */}
<header className="sticky top-0 z-40 bg-white/80 backdrop-blur dark:bg-brand-950 rounded-b-lg shadow-sm">
  <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
    {/* Logo / Home */}
    <a
      href="/"
      className="shrink-0 text-2xl font-bold text-indigo-600 dark:text-indigo-400"
    >
      AI&nbsp;Search
    </a>

    {/* Search bar */}
    <form
      onSubmit={submitMain}
      className="flex w-full flex-col gap-2 sm:flex-row sm:flex-1"
    >
      <input
        value={query}
        onChange={e => setQ(e.target.value)}
        placeholder="Search anything…"
        aria-label="Search query"
        className="flex-1 rounded-full border border-indigo-300 bg-transparent px-4 py-2 text-sm outline-none placeholder:opacity-70 dark:border-indigo-700"
      />

      {/* On really small screens the button fills the line below the input,
          on ≥sm it tucks next to the input. */}
      <button
        disabled={busy}
        className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "…" : "Search"}
      </button>
    </form>

    {/* Clear — sits on its own row on narrow screens, inline on ≥sm */}
    <button
      onClick={clearAll}
      className="shrink-0 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white sm:ml-2"
    >
      Clear
    </button>
  </div>
</header>


      {/* FULL-SCREEN LOADER */}
      {busy && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-900/80 backdrop-blur-sm">
          <span className="h-14 w-14 animate-spin rounded-full border-4 border-t-transparent border-indigo-500" />
          <p className="mt-4 text-brand-200">Fetching fresh results…</p>
        </div>
      )}

      {/* BODY */}
{/* ────────────── BODY ────────────── */}
<main className="mx-auto max-w-6xl space-y-6 px-4 pt-6 pb-28 sm:pb-24">
  {/* Empty-state prompt */}
  {!hist.length && !busy && (
    <p className="text-base sm:text-lg text-brand-300">
      Enter a query to start searching.
    </p>
  )}

  {/* Result accordion */}
  {hist.map((it, i) => (
    <div
      key={i}
      className="overflow-hidden rounded-lg"
    >
      {/* Toggle bar */}
      <button
        onClick={() => toggle(i)}
        className="flex w-full items-center justify-between bg-white px-4 py-3 text-left dark:bg-brand-900"
      >
        <span className="truncate pr-4 text-sm font-medium sm:text-base">
          {it.query}
        </span>
        <span className="text-lg">{it.isOpen ? "−" : "+"}</span>
      </button>

      {/* Expanded content */}
      {it.isOpen && (
        <div className="bg-white px-4 py-6 dark:bg-brand-950">
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
</main>

    </>
  );
}
