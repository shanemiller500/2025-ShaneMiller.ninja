'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ListFilter,
  Loader2,
  Minus,
  Search,
  SearchX,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { formatSupplyValue } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { IconBadge } from '@/components/ui/icon-badge';

interface EarningsItem {
  symbol: string;
  date: string;
  epsEstimate?: number | null;
  epsActual?: number | null;
  revenueEstimate?: number | null;
  revenueActual?: number | null;
  epsSurprise?: number | null;
  quarter: string;
  hour: 'bmo' | 'amc' | '' | null;
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(iso),
  );

const PER_PAGE_OPTIONS = [20, 50, 100, -1];
const PROXY_BASE = 'https://u-mail.co/api/finnhubProxy';

const hourBadge = (hour: EarningsItem['hour']) => {
  if (hour === 'bmo') return { label: 'BMO', cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-200' };
  if (hour === 'amc') return { label: 'AMC', cls: 'bg-violet-500/15 text-violet-700 dark:text-violet-200' };
  return null;
};

const safeNum = (v: any) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));

const EarningsSection: React.FC = () => {
  const [raw, setRaw] = useState<EarningsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [perPage, setPerPage] = useState<number>(20);
  const [page, setPage] = useState(1);

  // Fetch earnings calendar via proxy
  useEffect(() => {
    (async () => {
      try {
        const today = new Date();
        const from = new Date(today);
        from.setMonth(from.getMonth() - 1);
        const to = new Date(today);
        to.setMonth(to.getMonth() + 1);

        const resp = await fetch(
          `${PROXY_BASE}/calendar/earnings?from=${from.toISOString().slice(0, 10)}&to=${to
            .toISOString()
            .slice(0, 10)}`,
        );
        const data = await resp.json();

        const list: EarningsItem[] = Array.isArray(data?.earningsCalendar) ? data.earningsCalendar : [];
        if (!list.length) {
          setRaw([]);
          setLoading(false);
          return;
        }

        // sort by date then symbol
        list.sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
        setRaw(list);
      } catch (e) {
        console.error('Earnings fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? raw.filter((e) => e.symbol.toLowerCase().includes(q)) : raw;
  }, [raw, search]);

  const ordered = filtered;

  // Pagination
  const perPageEff = perPage === -1 ? ordered.length : perPage;
  const totalPages = Math.max(1, Math.ceil(ordered.length / perPageEff));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * perPageEff;
  const visible = ordered.slice(start, start + perPageEff);

  const rangeLabel = useMemo(() => {
    if (!ordered.length) return '';
    const a = ordered[0]?.date;
    const b = ordered[ordered.length - 1]?.date;
    if (!a || !b) return '';
    return `${fmtDate(a)} → ${fmtDate(b)}`;
  }, [ordered]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-6">
      {/* Header card (same vibe as your IPO “first one”) */}
      <div className="mb-5 rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <IconBadge icon={BarChart3} tone="violet" size="lg" label="Earnings" />
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Upcoming Earnings
              </h2>
            </div>
            <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-white/70">
              Search tickers and scan EPS + revenue at a glance.
              {rangeLabel ? <span className="ml-2 text-xs font-bold opacity-80">({rangeLabel})</span> : null}
            </p>
          </div>

          <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
            <div className="relative w-full sm:w-64">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-white/35"
                aria-hidden
              />
              <input
                type="text"
                placeholder="Search ticker…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.06] pl-10 pr-4 py-3 text-sm font-semibold outline-none focus:border-indigo-500/50 dark:focus:border-indigo-300/40"
              />
            </div>

            <div className="relative w-full sm:w-36">
              <ListFilter
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-white/35"
                aria-hidden
              />
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(parseInt(e.target.value, 10));
                  setPage(1);
                }}
                className="w-full appearance-none rounded-xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/[0.06] pl-9 pr-3 py-3 text-sm font-semibold outline-none focus:border-indigo-500/50 dark:focus:border-indigo-300/40"
              >
                {PER_PAGE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === -1 ? 'All' : opt} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm font-semibold text-gray-600 dark:text-white/70">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500 dark:text-indigo-400" aria-hidden />
          Loading earnings…
        </div>
      ) : ordered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm font-semibold text-gray-600 dark:text-white/70">
          <IconBadge icon={SearchX} tone="neutral" size="lg" />
          No matching earnings.
        </div>
      ) : (
        <>
          {/* Mobile-first cards, desktop becomes 2–4 columns */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((ev) => {
              const hb = hourBadge(ev.hour);

              const epsEst = safeNum(ev.epsEstimate);
              const epsAct = safeNum(ev.epsActual);
              const revEst = safeNum(ev.revenueEstimate);
              const surprise = safeNum(ev.epsSurprise);

              const hasSurprise = surprise != null;
              const pos = hasSurprise && surprise! > 0;
              const neg = hasSurprise && surprise! < 0;

              const surprisePill = hasSurprise
                ? pos
                  ? 'bg-green-500/15 text-green-700 dark:text-green-300'
                  : neg
                    ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                    : 'bg-black/[0.04] dark:bg-white/[0.08] text-gray-700 dark:text-white/70'
                : '';

              return (
                <motion.div
                  key={`${ev.symbol}-${ev.date}-${ev.quarter}`}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 shadow-sm"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                          {ev.symbol}
                        </span>

                        {hb && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${hb.cls}`}>
                            {hb.label}
                          </span>
                        )}

                        <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold bg-black/[0.03] dark:bg-white/[0.06] text-gray-800 dark:text-white/80 ring-1 ring-black/10 dark:ring-white/10">
                          {ev.quarter}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-white/60">
                        <CalendarDays className="h-3.5 w-3.5 text-gray-400 dark:text-white/40" aria-hidden />
                        {fmtDate(ev.date)}
                      </div>
                    </div>

                    {/* Surprise */}
                    {hasSurprise && (
                      <div className={`rounded-2xl px-3 py-2 text-right ring-1 ring-black/10 dark:ring-white/10 ${surprisePill}`}>
                        <div className="flex items-center justify-end gap-1 text-[10px] font-bold opacity-80">
                          {pos ? (
                            <TrendingUp className="h-3 w-3" aria-hidden />
                          ) : neg ? (
                            <TrendingDown className="h-3 w-3" aria-hidden />
                          ) : (
                            <Minus className="h-3 w-3" aria-hidden />
                          )}
                          EPS Surprise
                        </div>
                        <div className="text-sm font-black">
                          {surprise! > 0 ? '+' : ''}
                          {formatSupplyValue(surprise)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metrics */}
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] p-3">
                      <IconBadge icon={Target} tone="indigo" size="sm" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-gray-600 dark:text-white/60">EPS Est.</div>
                        <div className="mt-0.5 text-sm font-extrabold text-gray-900 dark:text-white">
                          {epsEst != null ? formatSupplyValue(epsEst) : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] p-3">
                      <IconBadge icon={CheckCircle2} tone={epsAct != null ? 'emerald' : 'neutral'} size="sm" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-gray-600 dark:text-white/60">EPS Act.</div>
                        <div className="mt-0.5 text-sm font-extrabold text-gray-900 dark:text-white">
                          {epsAct != null ? formatSupplyValue(epsAct) : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/[0.04] p-3">
                      <IconBadge icon={DollarSign} tone="sky" size="sm" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-gray-600 dark:text-white/60">Rev. Est.</div>
                        <div className="mt-0.5 text-sm font-extrabold text-gray-900 dark:text-white">
                          {revEst != null ? formatSupplyValue(revEst) : '—'}
                        </div>
                      </div>
                    </div>

                    
                  </div>

           
                </motion.div>
              );
            })}
          </div>

          {/* Pagination */}
          {perPage !== -1 && totalPages > 1 && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={clampedPage === 1}
                className="inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                Prev
              </Button>

              <span className="text-sm font-semibold">
                Page {clampedPage} / {totalPages}
              </span>

              <Button
                variant="secondary"
                size="md"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={clampedPage === totalPages}
                className="inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-white/60">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" aria-hidden />
            Tip: search is instant — try “AAPL”, “NVDA”, “TSLA”.
          </div>
        </>
      )}
    </section>
  );
};

export default EarningsSection;
