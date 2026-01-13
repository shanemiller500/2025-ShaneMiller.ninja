'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { FaExternalLinkAlt } from 'react-icons/fa';
import { motion } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface IPOEvent {
  symbol   : string;
  name     : string;
  date     : string;
  exchange : string;
  price    : string;
  shares   : string;
  status   : string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  }).format(new Date(iso));

const PER_PAGE_OPTIONS = [20, 50, 100, -1];
const PROXY_BASE       = 'https://u-mail.co/api/finnhubProxy';

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
const IPOCalendarSection: React.FC = () => {
  const [raw,     setRaw]     = useState<IPOEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [perPage, setPerPage] = useState<number>(20);
  const [page,    setPage]    = useState(1);

  /* Fetch IPO calendar via proxy */
  useEffect(() => {
    (async () => {
      try {
        const from = '2024-01-01';
        const to   = '2025-01-01';
        const resp = await fetch(
          `${PROXY_BASE}/calendar/ipo?from=${from}&to=${to}`
        );
        const data = await resp.json();
        if (!Array.isArray(data.ipoCalendar) || data.ipoCalendar.length === 0) {
          setLoading(false);
          return;
        }
        data.ipoCalendar.sort((a: IPOEvent, b: IPOEvent) =>
          a.date.localeCompare(b.date)
        );
        setRaw(data.ipoCalendar);
      } catch (err) {
        console.error('Error fetching IPO calendar:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* Filter by search text */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? raw.filter(ev =>
          `${ev.symbol} ${ev.name}`.toLowerCase().includes(q)
        )
      : raw;
  }, [raw, search]);

  /* Pagination */
  const effPerPage  = perPage === -1 ? filtered.length : perPage;
  const totalPages  = Math.max(1, Math.ceil(filtered.length / effPerPage));
  const clampedPage = Math.min(page, totalPages);
  const visible     = filtered.slice((clampedPage - 1) * effPerPage, clampedPage * effPerPage);

 return (
  <section className="mx-auto max-w-6xl px-4 py-6 pb-24">
    {/* Header / controls card */}
    <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-5 shadow-sm">
      {/* soft blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-45">
        <div className="absolute -top-16 -left-20 h-60 w-60 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -right-16 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            IPO Calendar
          </h2>
          <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-white/70">
            Search tickers/companies.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by company or ticker…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.06]
                         px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-white/40
                         outline-none ring-0 focus:border-indigo-500/50 dark:focus:border-indigo-300/40"
            />
            {search.trim() && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-1 text-xs font-extrabold
                           bg-black/[0.03] dark:bg-white/[0.06] text-gray-700 dark:text-white/70
                           hover:text-gray-900 dark:hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(+e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-36 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.06]
                       px-4 py-3 text-sm font-extrabold text-gray-900 dark:text-white outline-none
                       focus:border-indigo-500/50 dark:focus:border-indigo-300/40"
          >
            {PER_PAGE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === -1 ? "All" : opt} / page
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>

    {/* Body */}
    <div className="mt-5">
      {loading ? (
        <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-black/10 dark:bg-white/10 animate-pulse" />
            <div className="flex-1">
              <div className="h-3 w-40 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
              <div className="mt-2 h-3 w-64 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-3xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.06] animate-pulse"
              />
            ))}
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-6 shadow-sm text-center">
          <div className="text-lg font-extrabold text-gray-900 dark:text-white">
            No matching IPOs
          </div>
          <div className="mt-2 text-sm font-semibold text-gray-700 dark:text-white/70">
            Try a different ticker/company name.
          </div>
        </div>
      ) : (
        <>
          {/* Result meta */}
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-gray-700 dark:text-white/70">
              Showing{" "}
              <span className="font-extrabold text-gray-900 dark:text-white">
                {visible.length}
              </span>{" "}
              of{" "}
              <span className="font-extrabold text-gray-900 dark:text-white">
                {filtered.length}
              </span>
              {perPage !== -1 ? (
                <>
                  {" "}
                  • Page{" "}
                  <span className="font-extrabold text-gray-900 dark:text-white">
                    {clampedPage}
                  </span>{" "}
                  /{" "}
                  <span className="font-extrabold text-gray-900 dark:text-white">
                    {totalPages}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {/* Grid */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {visible.map((ev, idx) => {
              const priced = String(ev.status || "").toLowerCase() === "priced";
              const badge = priced
                ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-300/20"
                : "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-300/20";

              return (
                <motion.button
                  key={`${ev.symbol}-${ev.date}-${idx}`}
                  type="button"
                  onClick={() => {
                    // future-proof: if you later add a modal, wire it here
                    // openIpoModal(ev)
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group text-left relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10
                             bg-white/80 dark:bg-white/[0.06] p-4 shadow-sm
                             hover:shadow-md transition"
                >
                  <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition">
                    <div className="absolute -top-10 -right-10 h-36 w-36 rounded-full bg-indigo-400/10 blur-2xl" />
                    <div className="absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-fuchsia-400/10 blur-2xl" />
                  </div>

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm sm:text-base font-black text-gray-900 dark:text-white">
                          {ev.symbol}
                        </div>
                        <div className="text-[11px] font-bold text-gray-500 dark:text-white/50">
                          {ev.exchange ? `(${ev.exchange})` : ""}
                        </div>
                      </div>

                      <div className="mt-1 text-[11px] sm:text-xs font-semibold text-gray-600 dark:text-white/60">
                        {ev.date ? fmtDate(ev.date) : "—"}
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 ${badge}`}
                    >
                      {String(ev.status || "tba").toUpperCase()}
                    </span>
                  </div>

                  <div className="relative mt-3">
                    <div className="text-sm font-extrabold text-gray-900 dark:text-white line-clamp-2">
                      {ev.name || "—"}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-gray-700 dark:text-white/70">
                        Price{" "}
                        <span className="font-extrabold text-gray-900 dark:text-white">
                          {ev.price || "TBA"}
                        </span>
                      </div>

                      {/* optional external link slot for the future */}
                      {/* <span className="inline-flex items-center gap-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-200 opacity-0 group-hover:opacity-100 transition">
                        Details <FaExternalLinkAlt className="text-[10px]" />
                      </span> */}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Pagination */}
          {perPage !== -1 && totalPages > 1 && (
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={clampedPage === 1}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-extrabold
                             border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.06]
                             text-gray-900 dark:text-white
                             disabled:opacity-40 disabled:cursor-not-allowed
                             hover:bg-black/[0.03] dark:hover:bg-white/[0.08] transition"
                >
                  Prev
                </button>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={clampedPage === totalPages}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-extrabold
                             border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.06]
                             text-gray-900 dark:text-white
                             disabled:opacity-40 disabled:cursor-not-allowed
                             hover:bg-black/[0.03] dark:hover:bg-white/[0.08] transition"
                >
                  Next
                </button>
              </div>

              <div className="text-center sm:text-right text-sm font-semibold text-gray-700 dark:text-white/70">
                Page{" "}
                <span className="font-extrabold text-gray-900 dark:text-white">
                  {clampedPage}
                </span>{" "}
                /{" "}
                <span className="font-extrabold text-gray-900 dark:text-white">
                  {totalPages}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  </section>
);

};

export default IPOCalendarSection;
