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
    <div className="w-full rounded-2xl bg-white p-4 shadow-lg dark:bg-brand-900">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="leading-tight">
            <div className="text-sm font-extrabold text-brand-900 dark:text-gray-100">
              AI Search
            </div>
            <div className="text-[11px] opacity-70">
              Quick answers + sources
            </div>
          </div>
        </div>

        
      </div>

      {/* Form */}
      <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/5">
      

          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search anything…"
            className="
                        w-full
                        bg-transparent
                        text-sm
                        text-brand-900
                        outline-none
                        border-0
                        ring-0
                        focus:outline-none
                        focus:ring-0
                        focus:border-0
                        appearance-none
                        placeholder:opacity-60
                        dark:text-gray-100
                      "
          />
        </div>

        <button
          type="submit"
          className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99]"
        >
          Search 
        </button>
      </form>
    </div>
  );
}
