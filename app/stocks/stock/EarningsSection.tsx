'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { formatSupplyValue } from '@/utils/formatters';

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
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(iso));

const PER_PAGE_OPTIONS = [20, 50, 100, -1];
const PROXY_BASE       = 'https://u-mail.co/api/finnhubProxy';

const EarningsSection: React.FC = () => {
  const [raw,     setRaw]     = useState<EarningsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [perPage, setPerPage] = useState<number>(20);
  const [page,    setPage]    = useState(1);

  // 1) Fetch earnings calendar via our proxy
  useEffect(() => {
    (async () => {
      try {
        const today = new Date();
        const from  = new Date(today);
        from.setMonth(from.getMonth() - 1);
        const to    = new Date(today);
        to.setMonth(to.getMonth() + 1);

        const resp = await fetch(
          `${PROXY_BASE}/calendar/earnings?from=${
            from.toISOString().slice(0,10)
          }&to=${to.toISOString().slice(0,10)}`
        );
        const data = await resp.json();
        if (!data?.earningsCalendar?.length) {
          setLoading(false);
          return;
        }

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

  // 2) Filter by search term
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? raw.filter(e => e.symbol.toLowerCase().includes(q))
      : raw;
  }, [raw, search]);

  // 3) No more logo/profile fetch

  // 4) No reordering by logo—just use filtered directly
  const ordered = filtered;

  // 5) Pagination maths
  const perPageEff  = perPage === -1 ? ordered.length : perPage;
  const totalPages  = Math.max(1, Math.ceil(ordered.length / perPageEff));
  const clampedPage = Math.min(page, totalPages);
  const start       = (clampedPage - 1) * perPageEff;
  const visible     = ordered.slice(start, start + perPageEff);

  return (
    <section className="p-4 space-y-6 rounded">
      <h2 className="text-2xl font-bold">Upcoming Earnings</h2>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search ticker…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="p-2 border rounded w-full sm:w-64 dark:border-gray-600 dark:bg-brand-950 focus:outline-none"
        />
      </div>

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
                <h3 className="font-semibold">{ev.symbol}</h3>

                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {fmtDate(ev.date)}{' '}
                  {ev.hour === 'bmo' ? '(BMO)' : ev.hour === 'amc' ? '(AMC)' : ''}
                </p>

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

                {ev.epsSurprise != null && (
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1
                                ${ev.epsSurprise > 0
                                  ? 'bg-green-100 text-green-800 dark:bg-green-600/20 dark:text-green-300'
                                  : ev.epsSurprise < 0
                                  ? 'bg-red-100 text-red-800 dark:bg-red-600/20 dark:text-red-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300'}`}
                  >
                    Surprise {ev.epsSurprise > 0 ? '+' : ''}{formatSupplyValue(ev.epsSurprise)}
                  </span>
                )}

                <span className="text-xs text-gray-500 dark:text-gray-400">{ev.quarter}</span>
              </div>
            ))}
          </div>

          {/* pagination + per-page selector */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
            {perPage !== -1 && totalPages > 1 && (
              <div className="flex items-center gap-2">
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
        </>
      )}
    </section>
  );
};

export default EarningsSection;
