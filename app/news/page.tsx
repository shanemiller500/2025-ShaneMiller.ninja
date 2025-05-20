// Filename: page.tsx
'use client';

import { useState } from 'react';
import NewsTab    from './NewsTab';
import SportsTab  from './SportsTab';
import FinanceTab from './FinanceTab';

/* widgets */
import WidgetNews    from '@/components/widget-news';
import WidgetWeather from '@/components/widget-weather';
import CryptoWidget  from '@/components/widget-crypto';
import WidgetSearch  from '@/components/widget-search';
import StockWidget from '@/app/stocks/stock/LiveStreamTickerWidget';


/* lucide icons */
import { Newspaper, Trophy, LineChart } from 'lucide-react';

export default function Page() {
  const [tab, setTab] = useState<'All' | 'Sports' | 'Finance'>('All');
  const handleTab = (value: 'All' | 'Sports' | 'Finance') => setTab(value);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      {/* Header ---------------------------------------------------- */}
      <div className="mb-6 flex items-center gap-3">
        <Newspaper className="h-8 w-8 shrink-0 text-indigo-600 sm:h-9 sm:w-9 lg:h-10 lg:w-10" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 sm:text-3xl lg:text-4xl">
          The&nbsp;Miller&nbsp;Gazette
        </h1>
      </div>

      {/* Tab switcher — mobile <select> --------------------------- */}
      <div className="mb-4 sm:hidden">
        <label htmlFor="tab-select" className="sr-only">Choose section</label>
        <select
          id="tab-select"
          value={tab}
          onChange={e => handleTab(e.target.value as any)}
          className="w-full rounded border border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="All">All News</option>
          <option value="Sports">Sports News</option>
          <option value="Finance">Finance News</option>
        </select>
      </div>

      {/* Tab buttons — visible ≥ sm ------------------------------- */}
      <div
        className="no-scrollbar mb-6 hidden overflow-x-auto space-x-4 sm:flex"
        role="tablist"
        aria-label="News sections"
      >
        <button
          role="tab"
          aria-selected={tab === 'All'}
          onClick={() => handleTab('All')}
          className={`flex items-center gap-2 whitespace-nowrap rounded px-4 py-2 transition ${
            tab === 'All'
              ? 'bg-brand-gradient text-white'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200'
          }`}
        >
          <Newspaper className="h-4 w-4 shrink-0" />
          All&nbsp;News
        </button>

        <button
          role="tab"
          aria-selected={tab === 'Sports'}
          onClick={() => handleTab('Sports')}
          className={`flex items-center gap-2 whitespace-nowrap rounded px-4 py-2 transition ${
            tab === 'Sports'
              ? 'bg-brand-gradient text-white'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200'
          }`}
        >
          <Trophy className="h-4 w-4 shrink-0" />
          Sports&nbsp;News
        </button>

        <button
          role="tab"
          aria-selected={tab === 'Finance'}
          onClick={() => handleTab('Finance')}
          className={`flex items-center gap-2 whitespace-nowrap rounded px-4 py-2 transition ${
            tab === 'Finance'
              ? 'bg-brand-gradient text-white'
              : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200'
          }`}
        >
          <LineChart className="h-4 w-4 shrink-0" />
          Finance&nbsp;News
        </button>
      </div>

      {/* Main row: active tab + sidebar --------------------------- */}
      <div className="flex flex-col gap-8 lg:flex-row">
        <main className="w-full flex-1 lg:max-w-[720px]">
          {tab === 'All' ? (
            <NewsTab />
          ) : tab === 'Sports' ? (
            <SportsTab />
          ) : (
            <FinanceTab />
          )}
        </main>

        <aside className="w-full space-y-6 lg:w-[300px]">
          <WidgetSearch />
          <WidgetWeather />
          <StockWidget />
          <CryptoWidget />
          <WidgetNews />
        </aside>
      </div>
    </div>
  );
}
