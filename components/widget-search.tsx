"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { WidgetCard } from "@/components/ui/widget-card";

export default function WidgetSearch() {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    router.push(`/results?query=${encodeURIComponent(q)}`);
  };

  return (
    <WidgetCard title="Search" subtitle="Quick research, AI-summarized">
      <form onSubmit={handleSearch} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ask anything…"
          aria-label="Search"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400/50 dark:focus:bg-white/[0.06]"
        />
        <button
          type="submit"
          aria-label="Search"
          disabled={!search.trim()}
          className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-indigo-600 disabled:bg-slate-200 disabled:text-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-indigo-300 dark:disabled:bg-white/10 dark:disabled:text-slate-500"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </form>
    </WidgetCard>
  );
}
