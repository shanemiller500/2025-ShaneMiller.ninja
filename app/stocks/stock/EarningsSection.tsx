// Filename: EarningsSection.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { API_TOKEN } from '@/utils/config';
import { formatSupplyValue } from '@/utils/formatters';
import { FaExternalLinkAlt } from 'react-icons/fa';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface EarningsItem {
  symbol          : string;
  date            : string;
  epsEstimate?    : number | null;
  epsActual?      : number | null;
  revenueEstimate?: number | null;
  revenueActual?  : number | null;
  epsSurprise?    : number | null;
  quarter         : string;
  hour            : 'bmo' | 'amc' | '' | null;
  /* client-side additions */
  logo?           : string;
  weburl?         : string;
  _logoFetched?   : boolean;   // internal flag: logo already fetched
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(iso));

const PER_PAGE_OPTIONS = [20, 50, 100, -1]; // -1 == “All”

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
const EarningsSection: React.FC = () => {
  const [raw,        setRaw]        = useState<EarningsItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [perPage,    setPerPage]    = useState<number>(20);
  const [page,       setPage]       = useState(1);

  /* ---------------------- initial fetch (data only) -------------- */
  useEffect(() => {
    (async () => {
      try {
        const today = new Date();
        const from  = new Date(today); from.setMonth(from.getMonth() - 1);
        const to    = new Date(today); to.setMonth(to.getMonth() + 1);

        const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from
          .toISOString()
          .slice(0, 10)}&to=${to.toISOString().slice(0, 10)}&token=${API_TOKEN}`;

        const data = await fetch(url).then(r => r.json());

        if (!data?.earningsCalendar?.length) { setLoading(false); return; }

        /* sort by: logo items later, so we’ll resort after logos fetched */
        data.earningsCalendar.sort((a: EarningsItem, b: EarningsItem) =>
          a.date.localeCompare(b.date)
        );

        setRaw(data.earningsCalendar);
      } catch (e) {
        console.error('Earnings fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------------------- filtered list -------------------------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return raw;
    return raw.filter(e => e.symbol.toLowerCase().includes(q));
  }, [raw, search]);

  /* ---------------------- logo lazy-fetch per page --------------- */
  useEffect(() => {
    if (loading) return;

    const start = (page - 1) * (perPage === -1 ? filtered.length : perPage);
    const end   = perPage === -1 ? filtered.length : start + perPage;
    const slice = filtered.slice(start, end);

    slice.forEach(async (ev) => {
      if (ev._logoFetched || ev.logo) return;
      try {
        const p = await fetch(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${ev.symbol}&token=${API_TOKEN}`
        ).then(r => r.json());
        ev.logo   = p.logo   || '';
        ev.weburl = p.weburl || '';
      } catch {/* ignore */}
      ev._logoFetched = true;
      // Trigger re-render
      setRaw(r => [...r]);
    });
  }, [filtered, page, perPage, loading]);

  /* ---------------------- reorder: logos first ------------------- */
  const ordered = useMemo(() => {
    const withLogo    = filtered.filter(e => e.logo);
    const withoutLogo = filtered.filter(e => !e.logo);
    return [...withLogo, ...withoutLogo];
  }, [filtered]);

  /* ---------------------- pagination calc ------------------------ */
  const perPageEff  = perPage === -1 ? ordered.length : perPage;
  const totalPages  = Math.max(1, Math.ceil(ordered.length / perPageEff));
  const clampedPage = Math.min(page, totalPages);
  const start       = (clampedPage - 1) * perPageEff;
  const visible     = ordered.slice(start, start + perPageEff);

  /* ---------------------- UI ------------------------------------- */
  return (
    <section className="p-4 space-y-6 rounded">
      <h2 className="text-2xl font-bold">Upcoming Earnings</h2>

      {/* controls row */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* search */}
        <input
          type="text"
          placeholder="Search ticker…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="p-2 border rounded w-full sm:w-64 dark:border-gray-600 dark:bg-brand-950 focus:outline-none"
        />


      </div>

      {/* list */}
      {loading ? (
        <p className="text-center">Loading…</p>
      ) : ordered.length === 0 ? (
        <p className="text-center">No matching earnings.</p>
      ) : (
        <>
          <div className="grid gap-1 grid-cols-1 md:grid-cols-4">
            {visible.map(ev => (
              <div
                key={`${ev.symbol}-${ev.date}`}
                className="flex flex-col gap-1 items-center text-center p-4 border rounded
                           bg-white dark:bg-brand-950 dark:border-gray-700
                           transition-all duration-300
                           hover:-translate-y-1 hover:scale-[1.015] hover:shadow-lg
                           active:scale-95"
              >
                {/* logo */}
                {ev.logo && (
                  <img
                    src={ev.logo}
                    alt=""
                    className="w-14 h-14 object-contain rounded-md opacity-0
                               transition-opacity duration-300 hover:scale-105"
                    onLoad={e => (e.currentTarget.style.opacity = '1')}
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                )}

                {/* header row */}
                <div className="flex items-center gap-1">
                  <h3 className="font-semibold">{ev.symbol}</h3>
                  {ev.weburl && (
                    <a
                      href={ev.weburl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <FaExternalLinkAlt className="w-3 h-3 inline-block" />
                    </a>
                  )}
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {fmtDate(ev.date)} {ev.hour === 'bmo' ? '(BMO)' : ev.hour === 'amc' ? '(AMC)' : ''}
                </p>

                {/* mini grid */}
                <div className="grid grid-cols-2 gap-1 w-full text-xs">
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400">EPS Est.</span>
                    <span className="font-medium">
                      {ev.epsEstimate != null ? formatSupplyValue(ev.epsEstimate) : '--'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400">EPS Act.</span>
                    <span className="font-medium">
                      {ev.epsActual != null ? formatSupplyValue(ev.epsActual) : '--'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400">Rev. Est.</span>
                    <span className="font-medium">
                      {ev.revenueEstimate != null ? formatSupplyValue(ev.revenueEstimate) : '--'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 dark:text-gray-400">Rev. Act.</span>
                    <span className="font-medium">
                      {ev.revenueActual != null ? formatSupplyValue(ev.revenueActual) : '--'}
                    </span>
                  </div>
                </div>

                {/* surprise */}
                {ev.epsSurprise != null && (
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1
                                ${ev.epsSurprise > 0
                                  ? 'bg-green-100 text-green-800 dark:bg-green-600/20 dark:text-green-300'
                                  : ev.epsSurprise < 0
                                  ? 'bg-red-100 text-red-800 dark:bg-red-600/20 dark:text-red-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300'}`}
                  >
                    Surprise {ev.epsSurprise > 0 ? '+' : ''}
                    {formatSupplyValue(ev.epsSurprise)}
                  </span>
                )}

                <span className="text-xs text-gray-500 dark:text-gray-400">{ev.quarter}</span>
              </div>
            ))}
          </div>

          {/* pagination controls */}
          {perPage !== -1 && totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={clampedPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-40 dark:border-gray-600 bg-brand-gradient text-white"
              >
                Prev
              </button>
              <span className="text-sm">
                Page {clampedPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={clampedPage === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-40 dark:border-gray-600 bg-brand-gradient text-white"
              >
                Next
              </button>

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
          )}
        </>
      )}
    </section>
  );
};

export default EarningsSection;
