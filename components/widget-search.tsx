"use client";

import { useState, FormEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { WidgetHeader } from "@/components/ui/widget-header";
import { Button } from "@/components/ui/button";

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
      <WidgetHeader title="The Search" subtitle="Quick Research" href="/search" />

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
        <Button type="submit" fullWidth>
          Search
        </Button>
      </form>
    </div>
  );
}
