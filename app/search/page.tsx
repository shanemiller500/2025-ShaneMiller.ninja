"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { trackEvent } from "@/utils/mixpanel";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const SUGGESTIONS = [
  "Best laptop for React dev 2026",
  "Explain quantum computing like I'm 12",
  "Denver to Gold Coast trip checklist",
  "Compare Rivian vs Tesla charging networks",
  "Build a Next.js API with caching",
  "What's the healthiest fast food order",
];

const HINTS_COUNT = 3;

/* ------------------------------------------------------------------ */
/*  SearchPage Component                                               */
/* ------------------------------------------------------------------ */
export default function SearchPage() {
  const [search, setSearch] = useState<string>("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const hints = useMemo(() => {
    const now = new Date();
    const idx = (now.getDate() + now.getHours()) % SUGGESTIONS.length;
    return Array.from({ length: HINTS_COUNT }, (_, i) =>
      SUGGESTIONS[(idx + i) % SUGGESTIONS.length]
    );
  }, []);

  useEffect(() => {
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

  const handleSearch = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;

    trackEvent("Home AI Search Initiated", { query: q });
    router.push(`/results?query=${encodeURIComponent(q)}`);
  };

  const go = (q: string): void => {
    setSearch(q);
    trackEvent("Home AI Search Initiated", { query: q });
    router.push(`/results?query=${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#1D1D20]">
      
      {/* ═══════════════ MASTHEAD ═══════════════ */}
      <header className="border-b-4 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20]">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-neutral-900 dark:text-neutral-100" style={{ fontFamily: '"Playfair Display", serif' }}>
                The Search
              </h1>
              <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400 font-semibold mt-0.5" style={{ fontFamily: '"Courier New", monospace' }}>
                AI-Powered Research
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-0.5">Today</p>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-300">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════ HERO SECTION ═══════════════ */}
      <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        
        {/* Hero Headline */}
        <div className="text-center mb-12 md:mb-16">

          <h2 className="text-5xl md:text-7xl lg:text-8xl font-black leading-none mb-6 text-neutral-900 dark:text-neutral-100" style={{ fontFamily: '"Playfair Display", serif' }}>
            Fast Answers,
            <br />
            <span className="text-red-600 dark:text-red-400">Real Sources</span>
          </h2>

          <p className="text-lg md:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed" style={{ fontFamily: '"Merriweather", serif' }}>
            AI-powered research that cites its sources. No guesswork, just facts backed by credible references.
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-12">
          <div className="relative mb-4">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="What would you like to discover today?"
              className="w-full border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] text-neutral-900 dark:text-neutral-100 px-6 py-5 md:py-6 text-lg md:text-xl outline-none focus:bg-neutral-50 dark:focus:bg-neutral-900 transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
              style={{ fontFamily: '"Merriweather", serif' }}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-8 py-4 md:py-5 text-base md:text-lg font-bold uppercase tracking-wider hover:bg-red-600 dark:hover:bg-red-400 hover:text-white transition-all shadow-lg"
          >
            Begin Research
          </button>
        </form>

        {/* Suggested Searches */}
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
            <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-neutral-900 dark:text-neutral-100">
              Popular Inquiries
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {hints.map((q, idx) => (
              <button
                key={q}
                onClick={() => go(q)}
                className="group text-left p-5 border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1D1D20] hover:border-neutral-900 dark:hover:border-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all"
              >
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-xl font-black text-neutral-300 dark:text-neutral-700 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" style={{ fontFamily: '"Playfair Display", serif' }}>
                    {idx + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-neutral-900 dark:text-neutral-100 line-clamp-2" style={{ fontFamily: '"Merriweather", serif' }}>
                    {q}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 pt-16 border-t-2 border-neutral-200 dark:border-neutral-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Feature 1 */}
            <div className="text-center md:text-left">
              <div className="inline-block mb-4">
                <div className="w-12 h-12 border-2 border-neutral-900 dark:border-neutral-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <h4 className="text-lg font-black mb-2 text-neutral-900 dark:text-neutral-100" style={{ fontFamily: '"Playfair Display", serif' }}>
                Cited Sources
              </h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed" style={{ fontFamily: '"Merriweather", serif' }}>
                Every answer includes direct links to original sources for verification and deeper research.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="text-center md:text-left">
              <div className="inline-block mb-4">
                <div className="w-12 h-12 border-2 border-neutral-900 dark:border-neutral-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <h4 className="text-lg font-black mb-2 text-neutral-900 dark:text-neutral-100" style={{ fontFamily: '"Playfair Display", serif' }}>
                Lightning Fast
              </h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed" style={{ fontFamily: '"Merriweather", serif' }}>
                Get comprehensive answers in seconds, complete with images, tables, and related questions.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="text-center md:text-left">
              <div className="inline-block mb-4">
                <div className="w-12 h-12 border-2 border-neutral-900 dark:border-neutral-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <h4 className="text-lg font-black mb-2 text-neutral-900 dark:text-neutral-100" style={{ fontFamily: '"Playfair Display", serif' }}>
                Privacy First
              </h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed" style={{ fontFamily: '"Merriweather", serif' }}>
                Your searches are private. No tracking, no data selling, no advertising profile building.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-20 text-center border-t-2 border-neutral-200 dark:border-neutral-700 pt-12">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400 mb-4">
            Ready to Start?
          </p>
          <button
            onClick={() => inputRef.current?.focus()}
            className="inline-flex items-center gap-3 border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] text-neutral-900 dark:text-neutral-100 px-8 py-4 text-sm font-bold uppercase tracking-wider hover:bg-neutral-900 dark:hover:bg-neutral-100 hover:text-white dark:hover:text-neutral-900 transition-all"
          >
            <span>Type Your Question Above</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M5 10l7-7m0 0l7 7m-7-7v18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] mt-20 py-8">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              Powered by <a className="font-semibold text-neutral-600 dark:text-neutral-300 transition-colors duration-200 hover:text-neutral-900 dark:hover:text-white hover:underline underline-offset-4" target="_blank" rel="noopener noreferrer" href="https://holdmybeer.info/">Hold My Beer CO</a> AI Research Technology
            </p>
            <div className="flex items-center gap-6 text-xs text-neutral-500 dark:text-neutral-400">
              <span>© 2025 The Search</span>
              <span>•</span>
              <span>Privacy-First Design</span>
            </div>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap');
      `}</style>
    </div>
  );
}