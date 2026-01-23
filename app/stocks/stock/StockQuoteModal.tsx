// stockquoteModal.tsx
/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatSupplyValue, formatDate, formatDateWeirdValue } from "@/utils/formatters";
import {
  FaArrowUp,
  FaArrowDown,
  FaExternalLinkAlt,
  FaSearch,
  FaClock,
  FaChartLine,
  FaNewspaper,
  FaTimes,
  FaRegCopy,
  FaCheck,
  FaRegStar,
  FaStar,
  FaDollarSign,
  FaExchangeAlt,
} from "react-icons/fa";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface QuoteData {
  c: number; // current
  d: number; // change
  dp: number; // percent
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // prev close
  v: number; // volume (if provided)
  t: number; // unix seconds
}
interface StockData {
  profile: any;
  quote: QuoteData;
  metric: any;
}

interface Props {
  stockData: StockData;
  newsData: any[];
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const fmt = (v: number | undefined | null, d = 2) =>
  v == null || Number.isNaN(v as any) ? "—" : parseFloat(String(v)).toFixed(d);

const fmtDateTime = (ms: number) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(ms);

const timeAgo = (ms: number) => {
  if (!ms || Number.isNaN(ms)) return "—";
  const d = Date.now() - ms;
  if (d < 60_000) return `${Math.floor(d / 1_000)}s ago`;
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return formatDate(ms);
};

const logoFromUrl = (url?: string) => {
  try {
    const h = new URL(url ?? "").hostname.replace(/^www\./, "");
    return h ? `https://logo.clearbit.com/${h}?size=64` : "";
  } catch {
    return "";
  }
};

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function safePublishedMs(n: any): number {
  if (typeof n?.datetime === "number" && n.datetime > 0) return n.datetime * 1000;
  if (typeof n?.datetime === "string") {
    const d = Date.parse(n.datetime);
    return Number.isNaN(d) ? 0 : d;
  }
  for (const k of ["publishedAt", "published_at", "date", "time"]) {
    const v = n?.[k];
    if (typeof v === "number" && v > 0) return v > 10_000_000_000 ? v : v * 1000;
    if (typeof v === "string") {
      const d = Date.parse(v);
      if (!Number.isNaN(d)) return d;
    }
  }
  return 0;
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/* ------------------------------------------------------------------ */
/*  LocalStorage keys                                                 */
/* ------------------------------------------------------------------ */
const STAR_KEY = "stockQuoteStarred"; // array of tickers

function getStarred(): string[] {
  try {
    const raw = localStorage.getItem(STAR_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function setStarred(tickers: string[]) {
  try {
    localStorage.setItem(STAR_KEY, JSON.stringify(tickers));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/*  Tiny UI pieces                                                    */
/* ------------------------------------------------------------------ */
function ArrowBadge({ up }: { up: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold ring-1",
        up
          ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-300/20"
          : "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:bg-rose-400/10 dark:text-rose-200 dark:ring-rose-300/20"
      )}
    >
      {up ? <FaArrowUp /> : <FaArrowDown />}
      {up ? "Up" : "Down"}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-3 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute -top-10 -left-10 h-28 w-28 rounded-full bg-indigo-500/10 blur-2xl" />
        <div className="absolute -bottom-12 -right-12 h-32 w-32 rounded-full bg-fuchsia-500/10 blur-2xl" />
      </div>
      <div className="relative">
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
          {label}
        </div>
        <div className="mt-1 text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">{value}</div>
        {sub && <div className="mt-1 text-[11px] font-semibold text-gray-500 dark:text-white/50">{sub}</div>}
      </div>
    </div>
  );
}

function SegButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex-1 sm:flex-none rounded-xl px-4 py-2 text-xs font-extrabold transition",
        "ring-1 ring-black/10 dark:ring-white/10",
        active
          ? "bg-indigo-600/15 text-indigo-800 dark:text-indigo-200"
          : "bg-white/60 dark:bg-white/[0.06] text-gray-700 dark:text-white/70 hover:text-gray-900 dark:hover:text-white"
      )}
    >
      <span className="inline-flex items-center gap-2">
        <span className="text-indigo-600 dark:text-indigo-300">{icon}</span>
        {label}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function StockQuoteModal({ stockData, newsData, onClose }: Props) {
  const [tab, setTab] = useState<"overview" | "metrics" | "news">("overview");
  const [newsPage, setNewsPage] = useState(1);
  const [newsQuery, setNewsQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [starred, setStarredState] = useState<string[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const profile = stockData?.profile ?? {};
  const quote = stockData?.quote ?? ({} as QuoteData);
  const ticker: string = profile?.ticker ?? "—";

  const getMetric = (k: string) => stockData?.metric?.metric?.[k] ?? null;

  const lastMs = useMemo(() => {
    const t = quote?.t;
    if (typeof t === "number" && t > 0) return t * 1000;
    return Date.now();
  }, [quote?.t]);

  const isUp = (quote?.dp ?? 0) >= 0;
  const arrowColor = isUp ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300";

  /* ------------------------- modal behavior -------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setTab("news");
        setTimeout(() => {
          const el = document.getElementById("newsSearchInput") as HTMLInputElement | null;
          el?.focus();
        }, 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    // ✅ lock background scroll, but DO NOT kill touch scrolling
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  /* --------------------------- starred ------------------------------ */
  useEffect(() => setStarredState(getStarred()), []);
  const isStarred = useMemo(() => starred.includes(ticker), [starred, ticker]);

  const toggleStar = () => {
    const next = isStarred ? starred.filter((t) => t !== ticker) : [...starred, ticker];
    setStarredState(next);
    setStarred(next);
  };

  /* --------------------------- copy ------------------------------ */
  const copySummary = async () => {
    const line1 = `${profile?.name ?? "Company"} (${ticker})`;
    const line2 = `Price: $${formatSupplyValue(quote?.c ?? 0)} • ${isUp ? "▲" : "▼"} ${fmt(quote?.dp ?? 0, 2)}% (${fmt(
      quote?.d ?? 0,
      2
    )})`;
    const line3 = `As of: ${fmtDateTime(lastMs)}`;
    try {
      await navigator.clipboard.writeText(`${line1}\n${line2}\n${line3}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  /* --------------------------- news paging/search ------------------- */
  const newsPerPage = 8;

  const filteredNews = useMemo(() => {
    const q = newsQuery.trim().toLowerCase();
    const list = Array.isArray(newsData) ? newsData : [];
    if (!q) return list;

    return list.filter((n) => {
      const headline = String(n?.headline ?? n?.title ?? "").toLowerCase();
      const summary = String(n?.summary ?? n?.description ?? "").toLowerCase();
      const src = safeHost(String(n?.url ?? ""));
      return headline.includes(q) || summary.includes(q) || src.includes(q);
    });
  }, [newsData, newsQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredNews.length / newsPerPage));
  const page = clamp(newsPage, 1, totalPages);

  useEffect(() => setNewsPage(1), [newsQuery, ticker]);

  const paginatedNews = filteredNews.slice((page - 1) * newsPerPage, page * newsPerPage);

  // ✅ whenever tab changes, scroll the modal body to top (mobile friendly)
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab, ticker]);

  /* ------------------------------------------------------------------ */
  /*  Render                                                           */
  /* ------------------------------------------------------------------ */
  return (
    <div
      ref={overlayRef}
      onMouseDown={onOverlayClick}
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/70 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
    >
      {/* ✅ full-height shell */}
      <div className="h-[100dvh] w-full flex items-end sm:items-center justify-center">
        {/* ✅ card becomes a flex column; header sticky; body scrolls */}
        <div
          className={cn(
            "relative w-full sm:max-w-5xl",
            "h-[100dvh] sm:h-auto sm:max-h-[88vh]",
            "flex flex-col",
            "bg-white dark:bg-brand-900",
            "border border-gray-200/70 dark:border-white/10",
            "shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.75)]",
            "rounded-t-2xl sm:rounded-2xl overflow-hidden"
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* ambient */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.55] dark:opacity-[0.45]">
            <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="absolute top-20 right-10 h-56 w-56 rounded-full bg-sky-400/15 blur-3xl" />
          </div>

          {/* ✅ Sticky header (close always visible) */}
          <div className="relative z-20 sticky top-0 border-b border-gray-200/70 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-brand-900/85">
            <div className="px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    {profile?.logo ? (
                      <div className="relative">
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 blur-md" />
                        <img
                          src={profile.logo}
                          alt=""
                          className="relative h-15 w-40 sm:h-16 sm:w-16 rounded-2xl bg-white/80 dark:bg-white/5 object-contain p-2 ring-1 ring-gray-200/70 dark:ring-white/10 shadow-sm"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                      </div>
                    ) : (
                      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 ring-1 ring-gray-200/70 dark:ring-white/10 shadow-sm" />
                    )}

                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-extrabold tracking-tight truncate text-gray-900 dark:text-white">
                        {profile?.name ?? "Company"}
                        <span className="ml-2 text-gray-500 dark:text-white/60 font-bold">({ticker})</span>
                      </h3>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-white/60">
                        <span className="inline-flex items-center gap-2 rounded-full bg-gray-100/80 px-2.5 py-1 font-semibold ring-1 ring-gray-200/70 dark:bg-white/10 dark:ring-white/10">
                          <FaClock className="opacity-70" />
                          {fmtDateTime(lastMs)}
                        </span>
                        {profile?.exchange && (
                          <span className="rounded-full bg-gray-100/80 px-2.5 py-1 font-semibold ring-1 ring-gray-200/70 dark:bg-white/10 dark:ring-white/10">
                            {profile.exchange}
                          </span>
                        )}
                        <ArrowBadge up={isUp} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="flex items-end gap-3">
                      <div className="inline-flex items-center gap-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600/10 ring-1 ring-black/10 dark:bg-indigo-400/10 dark:ring-white/10">
                          <FaDollarSign className="text-indigo-600 dark:text-indigo-300" />
                        </span>
                        <div className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                          ${formatSupplyValue(quote?.c ?? 0)}
                        </div>
                      </div>

                      <div className={cn("flex items-center gap-2 text-sm font-extrabold", arrowColor)}>
                        {isUp ? <FaArrowUp /> : <FaArrowDown />}
                        <span>
                          {isUp ? "+" : ""}
                          {fmt(quote?.d ?? 0, 2)}
                        </span>
                        <span className="text-gray-500 dark:text-white/60 font-bold">
                          ({isUp ? "+" : ""}
                          {fmt(quote?.dp ?? 0, 2)}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                     
                      {profile?.weburl && (
                        <a
                          href={profile.weburl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-xl px-3 py-2 text-xs font-extrabold ring-1 ring-black/10 dark:ring-white/10 bg-white/70 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.10] transition"
                        >
                          <FaExternalLinkAlt className="text-gray-700 dark:text-white/70" />
                          <span className="hidden sm:inline">Site</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="inline-flex sm:w-auto rounded-2xl gap-1  ring-black/10 dark:ring-white/10">
                      <SegButton active={tab === "overview"} label="Overview" icon={<FaChartLine />} onClick={() => setTab("overview")} />
                      <SegButton active={tab === "metrics"} label="Metrics" icon={<FaExchangeAlt />} onClick={() => setTab("metrics")} />
                      <SegButton active={tab === "news"} label="News" icon={<FaNewspaper />} onClick={() => setTab("news")} />
                    </div>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-black/10 dark:ring-white/10 bg-white/80 dark:bg-white/[0.08] hover:bg-white dark:hover:bg-white/[0.12] text-gray-900 dark:text-white transition"
                  aria-label="Close"
                  title="Close (Esc)"
                >
                  <FaTimes />
                </button>
              </div>
            </div>
            <div className="h-[2px] w-full bg-gradient-to-r from-indigo-500/40 via-fuchsia-500/30 to-sky-500/30" />
          </div>

          {/* ✅ Scrollable body (the important part) */}
          <div
            ref={bodyRef}
            className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5"
            style={{ WebkitOverflowScrolling: "touch" as any }}
          >
            {/* OVERVIEW */}
            {tab === "overview" && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard label="Open" value={`$${formatSupplyValue(quote?.o ?? 0)}`} />
                  <StatCard label="High" value={`$${formatSupplyValue(quote?.h ?? 0)}`} />
                  <StatCard label="Low" value={`$${formatSupplyValue(quote?.l ?? 0)}`} />
                  <StatCard label="Prev Close" value={`$${formatSupplyValue(quote?.pc ?? 0)}`} />
                </div>

                <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-1 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">About</h4>
                      {profile?.weburl && (
                        <a
                          href={profile.weburl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-xs font-extrabold text-indigo-700 dark:text-indigo-200 hover:underline"
                        >
                          Website <FaExternalLinkAlt className="text-[10px]" />
                        </a>
                      )}
                    </div>

                    <div className="mt-3 space-y-2 text-xs text-gray-700 dark:text-white/70">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-white/50 font-semibold">Industry</span>
                        <span className="font-extrabold text-gray-900 dark:text-white text-right">{profile?.finnhubIndustry ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-white/50 font-semibold">Country</span>
                        <span className="font-extrabold text-gray-900 dark:text-white text-right">{profile?.country ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-white/50 font-semibold">IPO</span>
                        <span className="font-extrabold text-gray-900 dark:text-white text-right">{profile?.ipo ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-white/50 font-semibold">Market Cap</span>
                        <span className="font-extrabold text-gray-900 dark:text-white text-right">
                          ${formatSupplyValue(getMetric("marketCapitalization"))}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.06] p-3">
  <div className="text-[11px] font-extrabold uppercase tracking-wide text-gray-600 dark:text-white/60">
    Snapshot
  </div>

  <div className="mt-2 text-xs text-gray-700 dark:text-white/70 leading-relaxed">
    <span className="font-extrabold text-gray-900 dark:text-white">{ticker}</span> is{" "}
    <span
      className={cn(
        "font-extrabold",
        isUp ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"
      )}
    >
      {isUp ? "green" : "red"}
    </span>{" "}
    today at{" "}
    <span
      className={cn(
        "font-extrabold",
        isUp ? "text-emerald-700 dark:text-emerald-200" : "text-rose-700 dark:text-rose-200"
      )}
    >
      ${formatSupplyValue(quote?.c ?? 0)}
    </span>{" "}
    (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-extrabold",
        isUp ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"
      )}
    >
      {isUp ? "▲" : "▼"} {fmt(quote?.dp ?? 0, 2)}%
    </span>
    ).
  </div>
</div>

                  </div>

                  <div className="lg:col-span-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 shadow-sm">
                    <div className="flex items-end justify-between gap-3">
                      <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">Key metrics</h4>
                      <button
                        type="button"
                        onClick={() => setTab("metrics")}
                        className="text-xs font-extrabold text-indigo-700 dark:text-indigo-200 hover:underline"
                      >
                        View all →
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <StatCard label="P/E (TTM)" value={fmt(getMetric("peTTM"))} />
                      <StatCard label="P/S (TTM)" value={fmt(getMetric("psTTM"))} />
                      <StatCard label="Beta" value={fmt(getMetric("beta"))} />
                      <StatCard
                        label="52W High"
                        value={`$${formatSupplyValue(getMetric("52WeekHigh"))}`}
                        sub={String(formatDateWeirdValue(getMetric("52WeekHighDate")) || "")}
                      />
                      <StatCard
                        label="52W Low"
                        value={`$${formatSupplyValue(getMetric("52WeekLow"))}`}
                        sub={String(formatDateWeirdValue(getMetric("52WeekLowDate")) || "")}
                      />
                      <StatCard label="Div Yield" value={`${fmt(getMetric("currentDividendYieldTTM"))}%`} />
                    </div>

                    <div className="mt-3 text-[11px] text-gray-500 dark:text-white/45">
                      Some tickers/providers don’t return every metric.
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* METRICS */}
            {tab === "metrics" && (
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">Metrics</h4>
                  <span className="text-xs text-gray-500 font-semibold dark:text-white/50">TTM where available</span>
                </div>

                <div className="mt-3 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20">
                  <div className="divide-y divide-gray-200/70 dark:divide-white/10">
                    {[
                      ["Market Cap", `$${formatSupplyValue(getMetric("marketCapitalization"))}`],
                      ["P/E (TTM)", fmt(getMetric("peTTM"))],
                      ["P/S (TTM)", fmt(getMetric("psTTM"))],
                      ["Dividend Yield", `${fmt(getMetric("currentDividendYieldTTM"))}%`],
                      ["Beta", fmt(getMetric("beta"))],
                      ["52-Week High", `$${formatSupplyValue(getMetric("52WeekHigh"))}`],
                      ["High Date", formatDateWeirdValue(getMetric("52WeekHighDate"))],
                      ["52-Week Low", `$${formatSupplyValue(getMetric("52WeekLow"))}`],
                      ["Low Date", formatDateWeirdValue(getMetric("52WeekLowDate"))],
                    ].map(([k, v]) => (
                      <div key={k as string} className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="text-xs font-semibold text-gray-600 dark:text-white/65">{k}</span>
                        <span className="text-xs font-extrabold text-gray-900 dark:text-white text-right">{v as any}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-gray-500 dark:text-white/45">
                  Tip: Missing values usually mean the provider didn’t report them for this symbol.
                </div>
              </div>
            )}

            {/* NEWS */}
            {tab === "news" && (
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-4 shadow-sm">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">Latest news</h4>
                    <p className="mt-1 text-xs text-gray-600 dark:text-white/60">
                      Headlines for <span className="font-bold">{ticker}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      disabled={page === 1}
                      onClick={() => setNewsPage((p) => Math.max(1, p - 1))}
                      className="rounded-xl px-3 py-2 text-xs font-extrabold ring-1 ring-gray-200/70 bg-white/70 hover:bg-white disabled:opacity-40 dark:ring-white/10 dark:bg-white/10 dark:hover:bg-white/15"
                    >
                      Prev
                    </button>
                    <div className="text-xs font-bold text-gray-600 dark:text-white/70">
                      {page} / {totalPages}
                    </div>
                    <button
                      disabled={page === totalPages}
                      onClick={() => setNewsPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded-xl px-3 py-2 text-xs font-extrabold ring-1 ring-gray-200/70 bg-white/70 hover:bg-white disabled:opacity-40 dark:ring-white/10 dark:bg-white/10 dark:hover:bg-white/15"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 px-3 py-2">
                  <FaSearch className="text-gray-500 dark:text-white/45" />
                  <input
                    id="newsSearchInput"
                    value={newsQuery}
                    onChange={(e) => setNewsQuery(e.target.value)}
                    placeholder="Search headlines…"
                    className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-400 dark:placeholder:text-white/35"
                  />
                  {newsQuery && (
                    <button
                      type="button"
                      onClick={() => setNewsQuery("")}
                      className="rounded-xl px-3 py-2 text-xs font-extrabold ring-1 ring-black/10 dark:ring-white/10 bg-white/60 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.10]"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {paginatedNews.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.06] p-4 text-sm text-gray-700 dark:text-white/70">
                    No news matches your search.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {paginatedNews.map((n, i) => {
                      const imgAvail = typeof n.image === "string" && n.image.trim();
                      const headline = n.headline ?? n.title ?? "Untitled article";
                      const url = String(n.url || "");
                      const publishedMs = safePublishedMs(n);
                      const srcLogo = logoFromUrl(url);
                      const host = safeHost(url);

                      return (
                        <a
                          key={`${n.id ?? url}-${i}`}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative flex gap-3 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-black/20 p-3 transition hover:-translate-y-[1px] hover:shadow-md"
                        >
                          <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                            <div className="absolute -top-10 -left-12 h-40 w-40 rounded-full bg-indigo-500/10 blur-2xl" />
                            <div className="absolute -bottom-14 -right-14 h-44 w-44 rounded-full bg-fuchsia-500/10 blur-2xl" />
                          </div>

                          {imgAvail ? (
                            <img
                              src={n.image}
                              alt=""
                              className="relative h-20 w-28 shrink-0 rounded-xl object-cover bg-gray-100 ring-1 ring-black/10 dark:bg-white/5 dark:ring-white/10"
                              onError={(e) => (e.currentTarget.style.display = "none")}
                            />
                          ) : (
                            <div className="relative h-20 w-28 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 ring-1 ring-black/10 dark:ring-white/10 flex items-center justify-center text-gray-700 text-xs font-black dark:text-white/70">
                              NEWS
                            </div>
                          )}

                          <div className="relative min-w-0 flex-1">
                            <div className="text-sm font-extrabold leading-snug line-clamp-2 text-gray-900 group-hover:underline dark:text-white">
                              {headline}
                            </div>

                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-white/60">
                              {srcLogo ? (
                                <img
                                  src={srcLogo}
                                  alt=""
                                  className="h-4 w-4 rounded bg-white/70 ring-1 ring-black/10 dark:bg-white/10 dark:ring-white/10"
                                  onError={(e) => (e.currentTarget.style.display = "none")}
                                />
                              ) : null}
                              <span className="truncate max-w-[10rem] font-semibold">{host}</span>
                              <span className="text-gray-400 dark:text-white/30">•</span>
                              <span className="font-semibold">{timeAgo(publishedMs)}</span>

                              <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-gray-100/80 px-2 py-0.5 text-[11px] font-bold text-gray-700 ring-1 ring-black/10 dark:bg-white/10 dark:text-white/70 dark:ring-white/10">
                                Open <FaExternalLinkAlt className="text-[10px]" />
                              </span>
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 pb-3 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={onClose}
                className="w-full sm:w-auto rounded-2xl px-5 py-3 text-sm font-extrabold bg-indigo-500/50 dark:bg-indigo-900/40 text-gray-900 dark:text-white hover:opacity-95 active:scale-[0.99] transition"
              >
                Close
              </button>

              
            </div>
<p className="text-xs text-gray-600 dark:text-white/60 text-center">
        DISCLAIMER: All displayed stock quote data is delayed by a minimum of 15 minutes.
      </p>
            <div className="h-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
