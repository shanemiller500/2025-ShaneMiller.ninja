// StockQuoteModal.tsx
/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe,
  Search,
  Star,
  X,
} from "lucide-react";

import { Modal } from "@/components/ui/modal";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
export interface QuoteData {
  c: number; // current
  d: number; // change
  dp: number; // percent
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // prev close
  v?: number;
  t: number; // unix seconds
}

export interface StockData {
  profile: any;
  quote: QuoteData;
  metric: any;
}

interface Props {
  open: boolean;
  /** Symbol being shown — known before data arrives, so the header can render immediately */
  symbol: string | null;
  stockData: StockData | null;
  newsData: any[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
}

type Tab = "overview" | "metrics" | "news";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const cn = (...xs: Array<string | false | null | undefined>) => xs.filter(Boolean).join(" ");

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return n != null && Number.isFinite(n) ? n : null;
};

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });

const fmt = {
  usd: (v: unknown) => {
    const n = num(v);
    return n == null || n === 0 ? "—" : usdFmt.format(n);
  },
  /** Finnhub reports market cap in millions of USD */
  mcap: (millions: unknown) => {
    const n = num(millions);
    return n == null ? "—" : `$${compactFmt.format(n * 1_000_000)}`;
  },
  n: (v: unknown, d = 2) => {
    const n = num(v);
    return n == null ? "—" : n.toFixed(d);
  },
  pct: (v: unknown, signed = true) => {
    const n = num(v);
    return n == null ? "—" : `${signed && n > 0 ? "+" : ""}${n.toFixed(2)}%`;
  },
  date: (v: unknown) => {
    if (!v) return "—";
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  },
};

const fmtDateTime = (ms: number) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(ms);

const timeAgo = (ms: number) => {
  if (!ms || Number.isNaN(ms)) return "";
  const d = Date.now() - ms;
  if (d < 3_600_000) return `${Math.max(1, Math.floor(d / 60_000))}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  return `${Math.floor(d / 86_400_000)}d ago`;
};

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function publishedMs(n: any): number {
  if (typeof n?.datetime === "number" && n.datetime > 0) return n.datetime * 1000;
  for (const k of ["datetime", "publishedAt", "published_at", "date", "time"]) {
    const v = n?.[k];
    if (typeof v === "number" && v > 0) return v > 10_000_000_000 ? v : v * 1000;
    if (typeof v === "string") {
      const d = Date.parse(v);
      if (!Number.isNaN(d)) return d;
    }
  }
  return 0;
}

/* Starred tickers (per browser) */
const STAR_KEY = "stockQuoteStarred";
const readStars = (): string[] => {
  try {
    const arr = JSON.parse(localStorage.getItem(STAR_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};
const writeStars = (list: string[]) => {
  try {
    localStorage.setItem(STAR_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
};

/* ------------------------------------------------------------------ */
/*  Small pieces                                                      */
/* ------------------------------------------------------------------ */
function RangeBar({
  label,
  low,
  high,
  value,
  marker,
  lowLabel,
  highLabel,
}: {
  label: string;
  low: number | null;
  high: number | null;
  value: number | null;
  marker?: { value: number | null; label: string };
  lowLabel?: string;
  highLabel?: string;
}) {
  const ok = low != null && high != null && value != null && high > low;
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - low!) / (high! - low!)) * 100));
  return (
    <div className="rounded-2xl border border-slate-200/70 p-4 dark:border-white/[0.08]">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-slate-400">
        <span>{label}</span>
        {ok && <span className="tabular-nums">{Math.round(pos(value!))}% of range</span>}
      </div>
      <div className="relative mt-3 h-1.5 rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400 opacity-80">
        {ok && marker?.value != null && (
          <span
            title={marker.label}
            className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400 dark:bg-slate-500"
            style={{ left: `${pos(marker.value)}%` }}
          />
        )}
        {ok && (
          <motion.span
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-900 shadow-[0_0_0_3px_rgba(99,102,241,0.25)] dark:border-[#1a1a1d] dark:bg-white"
            initial={{ left: "50%" }}
            animate={{ left: `${pos(value!)}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 24 }}
          />
        )}
      </div>
      <div className="mt-2 flex justify-between font-mono text-xs tabular-nums">
        <span className="text-rose-500 dark:text-rose-400">
          {fmt.usd(low)}
          {lowLabel && <span className="ml-1.5 text-[10px] text-slate-400">{lowLabel}</span>}
        </span>
        <span className="text-emerald-600 dark:text-emerald-400">
          {highLabel && <span className="mr-1.5 text-[10px] text-slate-400">{highLabel}</span>}
          {fmt.usd(high)}
        </span>
      </div>
    </div>
  );
}

function StatGrid({ items, loading }: { items: { label: string; value: string; sub?: string }[]; loading?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-200/70 dark:border-white/[0.08] dark:bg-white/[0.06] sm:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="bg-white p-3.5 dark:bg-[#1a1a1d]">
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{s.label}</div>
          <div className={cn("mt-1.5 truncate font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white", loading && "animate-pulse text-slate-300 dark:text-slate-600")}>
            {loading ? "····" : s.value}
          </div>
          {s.sub && !loading && <div className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function StockQuoteModal({ open, symbol, stockData, newsData, loading = false, error, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [newsPage, setNewsPage] = useState(1);
  const [newsQuery, setNewsQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [stars, setStars] = useState<string[]>([]);

  const profile = stockData?.profile ?? {};
  const quote = stockData?.quote ?? ({} as QuoteData);
  const ticker: string = profile?.ticker || symbol || "—";
  const metric = (k: string) => stockData?.metric?.metric?.[k] ?? null;

  const lastMs = typeof quote?.t === "number" && quote.t > 0 ? quote.t * 1000 : Date.now();
  const up = (quote?.dp ?? 0) >= 0;

  /* Reset per symbol */
  useEffect(() => {
    setTab("overview");
    setNewsQuery("");
    setNewsPage(1);
  }, [symbol]);

  useEffect(() => setStars(readStars()), []);
  const isStarred = stars.includes(ticker);
  const toggleStar = () => {
    const next = isStarred ? stars.filter((t) => t !== ticker) : [...stars, ticker];
    setStars(next);
    writeStars(next);
  };

  /* Ctrl/Cmd+K jumps to news search */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setTab("news");
        setTimeout(() => document.getElementById("stockNewsSearch")?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const copySummary = async () => {
    const text = [
      `${profile?.name ?? ticker} (${ticker})`,
      `Price: ${fmt.usd(quote?.c)} · ${up ? "▲" : "▼"} ${fmt.pct(quote?.dp)} (${fmt.n(quote?.d)})`,
      `As of: ${fmtDateTime(lastMs)}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  /* News filter + paging */
  const PER_PAGE = 6;
  const filteredNews = useMemo(() => {
    const q = newsQuery.trim().toLowerCase();
    const list = Array.isArray(newsData) ? newsData : [];
    if (!q) return list;
    return list.filter((n) =>
      `${n?.headline ?? n?.title ?? ""} ${n?.summary ?? ""} ${n?.source ?? ""}`.toLowerCase().includes(q)
    );
  }, [newsData, newsQuery]);
  const totalPages = Math.max(1, Math.ceil(filteredNews.length / PER_PAGE));
  const page = Math.min(Math.max(1, newsPage), totalPages);
  const pageNews = filteredNews.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  useEffect(() => setNewsPage(1), [newsQuery]);

  const busy = loading && !stockData;

  const keyStats = [
    { label: "Open", value: fmt.usd(quote?.o) },
    { label: "Prev close", value: fmt.usd(quote?.pc) },
    { label: "Market cap", value: fmt.mcap(metric("marketCapitalization")) },
    { label: "P/E (TTM)", value: fmt.n(metric("peTTM")) },
    { label: "P/S (TTM)", value: fmt.n(metric("psTTM")) },
    { label: "Beta", value: fmt.n(metric("beta")) },
    { label: "Div yield", value: num(metric("currentDividendYieldTTM")) ? fmt.pct(metric("currentDividendYieldTTM"), false) : "—" },
    { label: "Volume", value: num(quote?.v) ? compactFmt.format(quote.v!) : "—" },
  ];

  const metricRows: [string, string][] = [
    ["Market cap", fmt.mcap(metric("marketCapitalization"))],
    ["P/E (TTM)", fmt.n(metric("peTTM"))],
    ["P/S (TTM)", fmt.n(metric("psTTM"))],
    ["P/B", fmt.n(metric("pbQuarterly") ?? metric("pbAnnual"))],
    ["EPS (TTM)", fmt.usd(metric("epsTTM"))],
    ["Dividend yield", num(metric("currentDividendYieldTTM")) ? fmt.pct(metric("currentDividendYieldTTM"), false) : "—"],
    ["Beta", fmt.n(metric("beta"))],
    ["ROE (TTM)", num(metric("roeTTM")) != null ? fmt.pct(metric("roeTTM"), false) : "—"],
    ["Net margin (TTM)", num(metric("netProfitMarginTTM")) != null ? fmt.pct(metric("netProfitMarginTTM"), false) : "—"],
    ["52-week high", `${fmt.usd(metric("52WeekHigh"))}  ·  ${fmt.date(metric("52WeekHighDate"))}`],
    ["52-week low", `${fmt.usd(metric("52WeekLow"))}  ·  ${fmt.date(metric("52WeekLowDate"))}`],
    ["52-week return", num(metric("52WeekPriceReturnDaily")) != null ? fmt.pct(metric("52WeekPriceReturnDaily")) : "—"],
    ["10-day avg volume", num(metric("10DayAverageTradingVolume")) != null ? `${compactFmt.format(metric("10DayAverageTradingVolume") * 1_000_000)}` : "—"],
  ];

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "metrics", label: "Metrics" },
    { key: "news", label: "News", count: Array.isArray(newsData) ? newsData.length : 0 },
  ];

  return (
    <Modal open={open} onClose={onClose} labelledBy="stock-modal-title" size="lg" accent={up ? "#10b981" : "#f43f5e"} hideClose>
      {/* Ambient */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 overflow-hidden">
        <div className={cn("absolute -top-24 left-1/4 h-56 w-[28rem] rounded-full blur-3xl", up ? "bg-emerald-300/25 dark:bg-emerald-500/10" : "bg-rose-300/25 dark:bg-rose-500/10")} />
        <div className="absolute -top-20 right-0 h-48 w-72 rounded-full bg-indigo-300/20 blur-3xl dark:bg-indigo-500/10" />
      </div>

      {/* Header */}
      <div className="shrink-0 px-5 pt-4 sm:px-7 sm:pt-6">
        <div className="flex items-start gap-3">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:ring-white/10">
            {profile?.logo ? (
              <img src={profile.logo} alt="" className="h-10 w-10 object-contain" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
            ) : (
              <span className="font-mono text-sm font-semibold text-slate-400">{ticker.slice(0, 2)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 id="stock-modal-title" className="truncate text-lg font-semibold text-slate-900 dark:text-white">
                {busy ? <span className="inline-block h-5 w-40 animate-pulse rounded bg-slate-100 align-middle dark:bg-white/[0.06]" /> : profile?.name ?? ticker}
              </h3>
              <span className="font-mono text-xs uppercase text-slate-400">{ticker}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider">
              {profile?.exchange && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                  {String(profile.exchange).replace(/,.*$/, "")}
                </span>
              )}
              {profile?.finnhubIndustry && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">{profile.finnhubIndustry}</span>
              )}
              {profile?.country && (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">{profile.country}</span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" onClick={copySummary} title="Copy summary" aria-label="Copy summary" className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white">
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={toggleStar}
              title={isStarred ? "Unstar" : "Star this ticker"}
              aria-label={isStarred ? "Unstar" : "Star this ticker"}
              aria-pressed={isStarred}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Star className={cn("h-4 w-4", isStarred && "fill-amber-400 text-amber-400")} />
            </button>
            {profile?.weburl && (
              <a href={profile.weburl} target="_blank" rel="noopener noreferrer" title="Company website" aria-label="Company website" className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-white/10 dark:hover:text-white">
                <Globe className="h-4 w-4" />
              </a>
            )}
            <button type="button" onClick={onClose} autoFocus title="Close (Esc)" aria-label="Close" className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-white/10 dark:hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Price */}
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              {busy ? "Fetching quote…" : `As of ${fmtDateTime(lastMs)}`}
            </div>
            {busy ? (
              <div className="mt-2 h-9 w-48 animate-pulse rounded-lg bg-slate-100 dark:bg-white/[0.06]" />
            ) : (
              <>
                <div className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                  {fmt.usd(quote?.c)}
                </div>
                <div className={cn("mt-1 inline-flex items-center gap-1 font-mono text-sm tabular-nums", up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400")}>
                  {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {up ? "+" : ""}
                  {fmt.n(quote?.d)} ({fmt.pct(quote?.dp)})<span className="text-slate-400">· today</span>
                </div>
              </>
            )}
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-white/10 dark:bg-white/[0.04]" role="tablist" aria-label="Quote sections">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors",
                  tab === t.key ? "text-white dark:text-slate-900" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                {tab === t.key && (
                  <motion.span layoutId="stockModalTab" className="absolute inset-0 rounded-lg bg-slate-900 dark:bg-white" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                <span className="relative">
                  {t.label}
                  {t.count ? <span className="ml-1 font-mono text-[10px] opacity-60">{t.count}</span> : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-slate-100 px-5 pb-6 pt-5 dark:border-white/[0.06] sm:px-7" style={{ WebkitOverflowScrolling: "touch" }}>
        {error ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
            {error}
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
              {tab === "overview" && (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <RangeBar label="Day range" low={num(quote?.l)} high={num(quote?.h)} value={num(quote?.c)} marker={{ value: num(quote?.o), label: "Open" }} />
                    <RangeBar
                      label="52-week range"
                      low={num(metric("52WeekLow"))}
                      high={num(metric("52WeekHigh"))}
                      value={num(quote?.c)}
                      lowLabel={fmt.date(metric("52WeekLowDate")) !== "—" ? fmt.date(metric("52WeekLowDate")) : undefined}
                      highLabel={fmt.date(metric("52WeekHighDate")) !== "—" ? fmt.date(metric("52WeekHighDate")) : undefined}
                    />
                  </div>
                  <StatGrid items={keyStats} loading={busy} />
                  {(profile?.ipo || profile?.shareOutstanding) && (
                    <div className="flex flex-wrap gap-x-6 gap-y-1 px-1 font-mono text-[11px] text-slate-400">
                      {profile?.ipo && <span>IPO · {fmt.date(profile.ipo)}</span>}
                      {num(profile?.shareOutstanding) != null && <span>Shares out · {compactFmt.format(profile.shareOutstanding * 1_000_000)}</span>}
                      {profile?.currency && <span>Currency · {profile.currency}</span>}
                    </div>
                  )}
                </div>
              )}

              {tab === "metrics" && (
                <div className="overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/[0.08]">
                  {metricRows.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-2.5 last:border-0 dark:border-white/[0.05]">
                      <span className="text-[13px] text-slate-500 dark:text-slate-400">{k}</span>
                      <span className={cn("text-right font-mono text-[13px] tabular-nums text-slate-900 dark:text-white", busy && "animate-pulse text-slate-300")}>{busy ? "····" : v}</span>
                    </div>
                  ))}
                  <p className="bg-slate-50 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:bg-white/[0.02]">
                    TTM where available · not every symbol reports every metric
                  </p>
                </div>
              )}

              {tab === "news" && (
                <div>
                  <div className="flex items-center gap-2">
                    <label className="relative flex-1">
                      <span className="sr-only">Search headlines</span>
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        id="stockNewsSearch"
                        value={newsQuery}
                        onChange={(e) => setNewsQuery(e.target.value)}
                        placeholder="Search headlines  (Ctrl K)"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                      />
                    </label>
                    <div className="flex items-center gap-1 font-mono text-[11px] tabular-nums text-slate-400">
                      <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setNewsPage(page - 1)} className="rounded-lg p-1.5 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-white">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {page}/{totalPages}
                      <button type="button" aria-label="Next page" disabled={page === totalPages} onClick={() => setNewsPage(page + 1)} className="rounded-lg p-1.5 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 dark:hover:bg-white/10 dark:hover:text-white">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {busy ? (
                    <div className="mt-3 space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-white/[0.04]" />
                      ))}
                    </div>
                  ) : pageNews.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                      {newsQuery ? "No headlines match your search." : `No recent news for ${ticker}.`}
                    </div>
                  ) : (
                    <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.05]">
                      {pageNews.map((n, i) => {
                        const url = String(n?.url || "");
                        const host = safeHost(url);
                        const img = typeof n?.image === "string" && n.image.trim() ? n.image : "";
                        return (
                          <li key={`${n?.id ?? url}-${i}`}>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="group -mx-2 flex gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-white/[0.04]">
                                {img && <img src={img} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" onError={(e) => (e.currentTarget.style.display = "none")} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                                  {host && <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`} alt="" className="h-3 w-3 rounded-sm" referrerPolicy="no-referrer" />}
                                  <span className="truncate">{n?.source || host}</span>
                                  <span>· {timeAgo(publishedMs(n))}</span>
                                </div>
                                <h4 className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                                  {n?.headline ?? n?.title ?? "Untitled"}
                                </h4>
                              </div>
                              <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-indigo-500" />
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        <p className="mt-5 text-center text-[11px] text-slate-400 dark:text-slate-500">
          Data delayed ~15 min · Provided by Finnhub · Not financial advice
        </p>
      </div>
    </Modal>
  );
}
