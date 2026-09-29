"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { IconBadge, type IconBadgeTone } from "@/components/ui/icon-badge";
import { SmartImage } from "../lib/SmartImage";

/* Shared building blocks for the news tabs, styled to match DashboardShell. */

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/* ------------------------------------------------------------------ */
/*  Panel header: icon badge, title, mono caption, optional controls   */
/* ------------------------------------------------------------------ */
export function PanelHeader({
  icon,
  tone,
  title,
  caption,
  children,
}: {
  icon: LucideIcon;
  tone: IconBadgeTone;
  title: string;
  caption?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200/70 px-4 py-4 dark:border-white/[0.08] sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <IconBadge icon={icon} tone={tone} size="lg" label={title} />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
          {caption && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{caption}</p>
          )}
        </div>
      </div>
      {children && <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section label: mono caption with an accent dot                     */
/* ------------------------------------------------------------------ */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
        {children}
      </h3>
      {right && <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{right}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notice: error or empty state                                       */
/* ------------------------------------------------------------------ */
export function Notice({ tone = "info", children }: { tone?: "info" | "error"; children: ReactNode }) {
  return tone === "error" ? (
    <div className="mb-4 flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-200">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      {children}
    </div>
  ) : (
    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center font-mono text-xs text-slate-400 dark:border-white/10 dark:text-slate-500">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Source line: logo, name, date                                      */
/* ------------------------------------------------------------------ */
function SourceLine({ logos, source, date, light }: { logos: string[]; source: string; date: string; light?: boolean }) {
  return (
    <div className={`flex min-w-0 items-center gap-1.5 text-[11px] ${light ? "text-white/85" : "text-slate-500 dark:text-slate-400"}`}>
      {logos.length > 0 && (
        <span className={`h-4 w-4 shrink-0 overflow-hidden rounded-full ${light ? "bg-white/20 ring-1 ring-white/30" : "bg-white ring-1 ring-slate-200 dark:ring-white/10"}`}>
          <SmartImage candidates={logos} alt={source} className="h-full w-full object-contain p-0.5" />
        </span>
      )}
      <span className="truncate font-medium">{source}</span>
      <span className="opacity-40">·</span>
      <time className="shrink-0 font-mono text-[10px] opacity-80" dateTime={date}>{shortDate(date)}</time>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StoryCard: image overlay card, or a text card when there's no image */
/* ------------------------------------------------------------------ */
export function StoryCard({
  title,
  description,
  source,
  publishedAt,
  images,
  logos,
  onOpen,
  badge,
  extra,
  onExtra,
  size = "card",
}: {
  title: string;
  description?: string | null;
  source: string;
  publishedAt: string;
  images: string[];
  logos: string[];
  onOpen: () => void;
  /** Small label pinned top-left, e.g. "Top story" */
  badge?: string;
  /** Number of other outlets covering the same story */
  extra?: number;
  onExtra?: () => void;
  size?: "hero" | "feature" | "card";
}) {
  const more = !!extra && extra > 0 && onExtra && (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onExtra();
      }}
      className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-900 ring-1 ring-black/10 transition hover:bg-white dark:bg-slate-900/90 dark:text-white dark:ring-white/10"
      aria-label={`See ${extra} more sources`}
    >
      <Layers className="h-3 w-3" aria-hidden />+{extra}
    </button>
  );

  if (images.length > 0) {
    const height = size === "hero" ? "h-60 sm:h-72 md:h-80" : size === "feature" ? "h-48" : "h-44 sm:h-48";
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
        className={`group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-100 text-left outline-none transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-12px_rgba(15,23,42,0.35)] focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-white/[0.08] dark:bg-white/[0.04] ${height}`}
      >
        <SmartImage
          candidates={images}
          alt={title}
          wrapperClassName="absolute inset-0"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
        {(badge || more) && (
          <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
            {badge ? (
              <span className="rounded-full bg-indigo-500 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white shadow-[0_0_18px_-2px_rgba(99,102,241,0.6)]">
                {badge}
              </span>
            ) : <span />}
            {more}
          </div>
        )}
        <div className={`absolute inset-x-0 bottom-0 text-white ${size === "hero" ? "p-5 sm:p-6" : "p-3.5"}`}>
          <h3 className={`font-semibold leading-snug ${size === "hero" ? "mb-2 font-aspekta text-xl tracking-tight line-clamp-3 sm:text-2xl md:text-3xl" : "mb-1.5 text-sm line-clamp-2"}`}>
            {title}
          </h3>
          {size === "hero" && description && (
            <p className="mb-3 hidden max-w-2xl text-sm text-white/75 line-clamp-2 sm:block">{description}</p>
          )}
          <SourceLine logos={logos} source={source} date={publishedAt} light />
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className="group flex w-full cursor-pointer flex-col rounded-2xl border border-slate-200/70 bg-white p-4 text-left outline-none transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_-16px_rgba(15,23,42,0.3)] focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/15"
    >
      {badge && (
        <span className="mb-2 self-start rounded-full bg-indigo-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
          {badge}
        </span>
      )}
      <div className="flex-1">
      <h3 className="text-sm font-semibold leading-snug text-slate-900 transition-colors line-clamp-3 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
        {title}
      </h3>
      {description && <p className="mt-1.5 text-xs leading-relaxed text-slate-500 line-clamp-2 dark:text-slate-400">{description}</p>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-white/[0.06]">
        <SourceLine logos={logos} source={source} date={publishedAt} />
        {more}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Grid + pagination                                                  */
/* ------------------------------------------------------------------ */
export const cardGrid = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

export function Pagination({
  page,
  totalPages,
  loading,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  const base = "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60";
  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-200/70 pt-5 dark:border-white/[0.08]">
      <button
        disabled={page === 1 || loading}
        onClick={onPrev}
        className={`${base} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]`}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Previous
      </button>
      <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {loading ? "Loading…" : `Page ${page} / ${totalPages}`}
      </span>
      <button
        disabled={page === totalPages || loading}
        onClick={onNext}
        className={`${base} bg-indigo-500 text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.6)] hover:bg-indigo-600`}
      >
        Next
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
