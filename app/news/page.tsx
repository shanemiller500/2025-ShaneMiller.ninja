'use client';

import { useState } from 'react';
import NewsTab   from './NewsTab';
import SportsTab from './SportsTab';

import WidgetNews    from '@/components/widget-news';
import WidgetWeather from '@/components/widget-weather';
import CryptoWidget  from '@/components/widget-crypto';
import WidgetSearch  from '@/components/widget-search';

export default function Page() {
  const [tab, setTab] = useState<'All' | 'Sports'>('All');

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6">
      {/* Header ------------------------------------------------------ */}
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">
        The&nbsp;Miller&nbsp;Gazette
      </h1>

      {/* Tab bar ----------------------------------------------------- */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setTab('All')}
          className={`px-4 py-2 rounded ${
            tab === 'All'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300'
          }`}
        >
          All&nbsp;News
        </button>
        <button
          onClick={() => setTab('Sports')}
          className={`px-4 py-2 rounded ${
            tab === 'Sports'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300'
          }`}
        >
          Sports&nbsp;News
        </button>
      </div>

      {/* Main row: active tab + sidebar ----------------------------- */}
      <div className="flex flex-col lg:flex-row gap-8">
        <main className="flex-1 w-full lg:max-w-[720px]">
          {tab === 'All' ? <NewsTab /> : <SportsTab />}
        </main>

        <aside className="w-full lg:w-[300px] space-y-6">
          <WidgetSearch />
          <WidgetWeather />
          <CryptoWidget />
          <WidgetNews />
        </aside>
      </div>
    </div>
  );
}
