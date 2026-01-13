"use client";

import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/utils/mixpanel";

const SUGGESTIONS = [
  "Best laptop for React dev 2026",
  "Explain quantum computing like I’m 12",
  "Denver to Gold Coast trip checklist",
  "Compare Rivian vs Tesla charging networks",
  "Build a Next.js API with caching",
  "What’s the healthiest fast food order",
];

export default function Home() {
  const [search, setSearch] = useState<string>("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hints = useMemo(() => {
    // light rotation feel without being too “random”
    const now = new Date();
    const idx = (now.getDate() + now.getHours()) % SUGGESTIONS.length;
    return [
      SUGGESTIONS[idx],
      SUGGESTIONS[(idx + 1) % SUGGESTIONS.length],
      SUGGESTIONS[(idx + 2) % SUGGESTIONS.length],
    ];
  }, []);

  useEffect(() => {
    // Quick “/ to focus” like modern search apps
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;

    trackEvent("Home AI Search Initiated", { query: q });
    router.push(`/results?query=${encodeURIComponent(q)}`);
  };

  const go = (q: string) => {
    setSearch(q);
    trackEvent("Home AI Search Initiated", { query: q });
    router.push(`/results?query=${encodeURIComponent(q)}`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-brand-900 dark:bg-brand-900 dark:text-gray-100">
      {/* background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-indigo-300/30 blur-3xl dark:bg-indigo-500/20" />
        <div className="absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-purple-300/30 blur-3xl dark:bg-purple-500/20" />
        <div className="absolute -bottom-28 right-10 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/10" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 py-10">
        {/* top mini nav */}
        <div className="mb-10 flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-sm" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">AI Search</div>
            </div>
          </div>

          
        </div>

        {/* hero */}
        <div className="w-full">
          <h1 className="text-center text-4xl font-extrabold tracking-tight sm:text-6xl">
           Fast answers{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              real sources
            </span>
            
          </h1>
          {/* <p className="mx-auto mt-4 max-w-2xl text-center text-base opacity-80 sm:text-lg">
           Fast answers + real sources
          </p> */}
        </div>

        {/* search bar */}
        <form onSubmit={handleSearch} className="mt-10 w-full max-w-2xl">
          <div className="rounded-3xl border border-gray-200 bg-white/80 p-2 shadow-xl backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-brand-900">
                {/* icon */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="opacity-70"
                  aria-hidden="true"
                >
                  <path
                    d="M10.5 19a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M16.7 16.7 21 21"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  ref={inputRef}
                  type="text"
                  className="w-full bg-transparent text-sm outline-none placeholder:opacity-60 sm:text-base"
                  placeholder="Search anything…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />

                
              </div>

              <button
                type="submit"
                className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.99] sm:text-base"
              >
                Search
              </button>
            </div>

      
          </div>
        </form>

        {/* suggestion chips */}
        <div className="mt-8 w-full max-w-2xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">
              Try one of these
            </p>
            <p className="text-xs opacity-60 sm:hidden">Press / to focus</p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {hints.map((q) => (
              <button
                key={q}
                onClick={() => go(q)}
                className="rounded-2xl border border-gray-200 bg-white/70 px-4 py-3 text-left text-sm shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="line-clamp-2">{q}</div>
              </button>
            ))}
          </div>
        </div>

        {/* footer */}
        <div className="mt-14 text-center text-xs opacity-60">
           Privacy-first UI. No weird clutter.
        </div>
      </main>
    </div>
  );
}
