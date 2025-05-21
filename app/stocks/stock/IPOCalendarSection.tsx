// Filename: IPOCalendarSection.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { API_TOKEN } from '@/utils/config';
import { FaExternalLinkAlt } from 'react-icons/fa';

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
  logo?    : string;
  weburl?  : string;
  _logoFetched?: boolean;      // internal flag
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(iso));

const PER_PAGE_OPTIONS = [20, 50, 100, -1]; // -1 → “All”

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
const IPOCalendarSection: React.FC = () => {
  const [raw,       setRaw]       = useState<IPOEvent[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [perPage,   setPerPage]   = useState<number>(20);
  const [page,      setPage]      = useState(1);

  /* ------------------------ fetch raw list once ------------------ */
  useEffect(() => {
    (async () => {
      try {
        const url = `https://finnhub.io/api/v1/calendar/ipo?from=2024-01-01&to=2025-01-01&token=${API_TOKEN}`;
        const data = await fetch(url).then(r => r.json());
        if (!data?.ipoCalendar?.length) { setLoading(false); return; }

        // sort by date ascending
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

  /* ------------------------ filter by search --------------------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? raw.filter(ev =>
          `${ev.symbol} ${ev.name}`.toLowerCase().includes(q)
        )
      : raw;
  }, [raw, search]);

  /* ------------------------ lazy-fetch logos per page ------------ */
  useEffect(() => {
    if (loading) return;

    const start = (page - 1) * (perPage === -1 ? filtered.length : perPage);
    const end   = perPage === -1 ? filtered.length : start + perPage;
    const slice = filtered.slice(start, end);

    slice.forEach(async ev => {
      if (ev._logoFetched || ev.logo) return;
      try {
        const p = await fetch(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${ev.symbol}&token=${API_TOKEN}`
        ).then(r => r.json());
        ev.logo   = p.logo   || '';
        ev.weburl = p.weburl || '';
      } catch {/* ignore */}
      ev._logoFetched = true;
      setRaw(r => [...r]); // trigger re-render
    });
  }, [filtered, page, perPage, loading]);

  /* ------------------------ reorder: logos first ----------------- */
  const ordered = useMemo(() => {
    const withLogo    = filtered.filter(e => e.logo);
    const withoutLogo = filtered.filter(e => !e.logo);
    return [...withLogo, ...withoutLogo];
  }, [filtered]);

  /* ------------------------ pagination math ---------------------- */
  const perPageEff  = perPage === -1 ? ordered.length : perPage;
  const totalPages  = Math.max(1, Math.ceil(ordered.length / perPageEff));
  const clampedPage = Math.min(page, totalPages);
  const start       = (clampedPage - 1) * perPageEff;
  const visible     = ordered.slice(start, start + perPageEff);

  /* ----------------------------- UI ------------------------------ */
  return (
    <section className="p-4 space-y-6 rounded">
      <h2 className="text-2xl font-bold">IPO Calendar</h2>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* search */}
        <input
          type="text"
          placeholder="Search by company or ticker…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="p-2 border rounded w-full sm:w-72 dark:border-gray-600 dark:bg-brand-950 focus:outline-none"
        />

        {/* per-page selector */}
        <select
          value={perPage}
          onChange={e => { setPerPage(parseInt(e.target.value)); setPage(1); }}
          className="p-2 border rounded w-28 dark:border-gray-600 dark:bg-brand-950 focus:outline-none"
        >
          {PER_PAGE_OPTIONS.map(opt => (
            <option key={opt} value={opt}>
              {opt === -1 ? 'All' : opt} / page
            </option>
          ))}
        </select>
      </div>

      {/* body */}
      {loading ? (
        <p className="text-center">Loading…</p>
      ) : ordered.length === 0 ? (
        <p className="text-center">No matching IPOs.</p>
      ) : (
        <>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
            {visible.map(ev => (
              <div
                key={`${ev.symbol}-${ev.date}`}
                className="flex flex-col items-center text-center gap-2 p-4 border rounded
                           bg-white dark:bg-brand-950 dark:border-gray-700
                           transition-all duration-300
                           hover:-translate-y-1 hover:scale-[1.015] hover:shadow-lg
                           active:scale-95"
              >
                {ev.logo && (
                  <img
                    src={ev.logo}
                    alt=""
                    className="w-16 h-16 object-contain rounded-md opacity-0
                               transition-opacity duration-300 hover:scale-105"
                    onLoad={e => (e.currentTarget.style.opacity = '1')}
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                )}

                <h3 className="font-semibold leading-tight">
                  {ev.symbol}
                  <span className="ml-1 text-gray-500 dark:text-gray-400 text-sm font-normal">
                    ({ev.exchange})
                  </span>
                </h3>

                <p className="text-xs text-gray-600 dark:text-gray-400">{fmtDate(ev.date)}</p>
                <p className="text-sm truncate">{ev.name}</p>

                <p className="text-sm">
                  Price&nbsp;<span className="font-medium">{ev.price || 'TBA'}</span>
                </p>

                {ev.weburl && (
                  <a
                    href={ev.weburl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 text-xs hover:underline"
                  >
                    Website <FaExternalLinkAlt className="inline-block w-3 h-3" />
                  </a>
                )}

                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium
                              ${ev.status === 'priced'
                                ? 'bg-green-100 text-green-800 dark:bg-green-600/20 dark:text-green-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-600/20 dark:text-amber-200'}`}
                >
                  {ev.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>

          {/* pagination */}
          {perPage !== -1 && totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={clampedPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-40 dark:border-gray-600"
              >
                Prev
              </button>
              <span className="text-sm">
                Page {clampedPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={clampedPage === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-40 dark:border-gray-600"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default IPOCalendarSection;
