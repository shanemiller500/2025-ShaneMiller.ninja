"use client";

import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export interface DashboardTab<K extends string> {
  key: K;
  label: string;
  /** Small mono caption under the label */
  hint: string;
  icon: ReactNode;
}

interface DashboardShellProps<K extends string> {
  /** Mono path shown above the title, e.g. "~/crypto" */
  path: string;
  /** Text in the pulsing status pill next to the path */
  liveLabel: string;
  title: string;
  description: ReactNode;
  tabs: DashboardTab<K>[];
  renderPanel: (key: K) => ReactNode;
  onTabChange?: (key: K) => void;
  /** Unique id prefix so two shells never collide */
  id: string;
  /** Optional sidebar shown beside the panels on large screens (below them on small ones) */
  aside?: ReactNode;
}

/**
 * Shared layout for the market dashboards: grid/aurora backdrop, mono header,
 * sticky tab bar (arrow keys, Home/End, #hash deep links) and panels that stay
 * mounted after first visit so live streams and fetched data survive tab switches.
 */
export function DashboardShell<K extends string>({
  path,
  liveLabel,
  title,
  description,
  tabs,
  renderPanel,
  onTabChange,
  id,
  aside,
}: DashboardShellProps<K>) {
  const first = tabs[0].key;
  const [activeTab, setActiveTab] = useState<K>(first);
  const [visited, setVisited] = useState<Set<K>>(() => new Set<K>([first]));
  const tabRefs = useRef<Partial<Record<K, HTMLButtonElement | null>>>({});

  const selectTab = useCallback(
    (key: K, focus = false) => {
      setActiveTab(key);
      setVisited((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
      if (focus) tabRefs.current[key]?.focus();
      window.history.replaceState(null, "", key === first ? window.location.pathname : `#${key}`);
    },
    [first]
  );

  useEffect(() => {
    const fromHash = window.location.hash.replace("#", "");
    const match = tabs.find((t) => t.key === fromHash);
    if (match) selectTab(match.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = (key: K) => {
    selectTab(key);
    onTabChange?.(key);
  };

  const handleKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.key === activeTab);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    selectTab(tabs[next].key, true);
    onTabChange?.(tabs[next].key);
  };

  return (
    <div className="relative isolate min-h-screen pb-16">
      {/* Backdrop: fine grid + aurora */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] text-slate-300/70 dark:text-white/[0.07] [mask-image:radial-gradient(ellipse_at_top,black_25%,transparent_72%)]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 left-1/2 -z-10 h-72 w-[46rem] max-w-full -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-300/25 via-indigo-300/25 to-rose-300/25 blur-3xl dark:from-emerald-500/10 dark:via-indigo-500/15 dark:to-rose-500/10"
      />

      <div className="space-y-6 pt-8 sm:pt-12">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="max-w-2xl">
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-indigo-500 dark:text-indigo-300">{path}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-50/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              {liveLabel}
            </span>
          </div>
          <h1 className="mt-4 font-aspekta text-4xl font-[650] tracking-tight text-slate-900 dark:text-white md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        </header>

        {/* ── Tab bar ──────────────────────────────────────────────────── */}
        {/* A single-tab page (a standalone tool) skips the tab bar. */}
        {tabs.length > 1 && (
        <div
          role="tablist"
          aria-label={`${title} sections`}
          onKeyDown={handleKeys}
          className="sticky top-2 z-30 -mx-1 flex gap-1 overflow-x-auto no-scrollbar rounded-2xl border border-slate-200/70 bg-white/80 p-1 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#1D1D20]/80"
        >
          {tabs.map((t) => {
            const isActive = t.key === activeTab;
            return (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[t.key] = el;
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${t.key}`}
                aria-selected={isActive}
                aria-controls={`${id}-panel-${t.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => handleClick(t.key)}
                className={[
                  "group relative flex min-w-[8.5rem] flex-1 shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500/60",
                  isActive
                    ? "text-slate-900 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
                ].join(" ")}
              >
                {isActive && (
                  <motion.span
                    layoutId={`${id}TabsIndicator`}
                    className="absolute inset-0 rounded-xl bg-slate-900/[0.04] ring-1 ring-slate-900/10 dark:bg-white/[0.06] dark:ring-white/10"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  >
                    <span className="absolute inset-x-4 -bottom-px h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
                  </motion.span>
                )}
                <span
                  className={[
                    "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? "bg-indigo-500 text-white shadow-[0_0_18px_-2px_rgba(99,102,241,0.6)]"
                      : "bg-slate-100 text-slate-400 group-hover:text-slate-600 dark:bg-white/[0.05] dark:text-slate-500",
                  ].join(" ")}
                >
                  {t.icon}
                </span>
                <span className="relative min-w-0 leading-tight">
                  <span className="block truncate text-[13px] font-semibold">{t.label}</span>
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {t.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        )}

        {/* ── Panels ───────────────────────────────────────────────────── */}
        <div className={aside ? "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start" : "contents"}>
        <div className={aside ? "min-w-0" : "contents"}>
        {tabs.map((t) => {
          if (!visited.has(t.key)) return null;
          const isActive = t.key === activeTab;
          return (
            <motion.section
              key={t.key}
              id={`${id}-panel-${t.key}`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-${t.key}`}
              hidden={!isActive}
              initial={false}
              animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="rounded-3xl border border-slate-200/70 bg-white/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-white/[0.02]"
            >
              {renderPanel(t.key)}
            </motion.section>
          );
        })}
        </div>
        {aside && <aside className="min-w-0">{aside}</aside>}
        </div>
      </div>
    </div>
  );
}
