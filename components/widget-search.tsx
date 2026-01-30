"use client";

import React, { useState, FormEvent, useRef } from "react";
import { useRouter } from "next/navigation";

export default function WidgetSearch() {
  const [search, setSearch] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;

    router.push(`/results?query=${encodeURIComponent(q)}`);
  };

  return (
    <div className="w-full rounded-2xl border border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] p-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
        <div className="w-1.5 h-1.5 bg-red-600 dark:bg-red-400 rounded-full"></div>
        <div>
          <a href="/search">
          <div className="text-xs font-black uppercase tracking-wide text-neutral-900 dark:text-neutral-100" style={{ fontFamily: '"Playfair Display", serif' }}>
            The Search
          </div>
          </a>
          <div className="text-[9px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Quick Research
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSearch} className="space-y-2">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ask anything..."
          className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1D1D20] text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:focus:border-neutral-100 transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
          style={{ fontFamily: '"Merriweather", serif' }}
        />

        <button
          type="submit"
          className="w-full rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-xs font-bold uppercase tracking-wider hover:bg-red-600 dark:hover:bg-red-400 hover:text-white dark:hover:text-white transition-all"
        >
          Search
        </button>
      </form>
    </div>
  );
}