"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Loader2 } from "lucide-react";
import { SmartImage } from "../lib/SmartImage";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ReadableArticle {
  title: string;
  url: string;
  publishedAt: string;
  sourceName: string;
  description?: string | null;
  imageCandidates: string[];
  logoCandidates: string[];
}

export type AccentColor = "indigo" | "orange" | "emerald" | "rose";

interface Props {
  open: boolean;
  article: ReadableArticle | null;
  onClose: () => void;
  accent?: AccentColor;
}

const ACCENT_BTN: Record<AccentColor, string> = {
  indigo:
    "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white",
  orange:
    "bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-400 text-white",
  emerald:
    "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white",
  rose: "bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-400 text-white",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ReaderModal({
  open,
  article,
  onClose,
  accent = "indigo",
}: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Fetch article content */
  useEffect(() => {
    if (!open || !article) {
      setContent(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/parse-article?url=${encodeURIComponent(article.url)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setContent(d.content);
      })
      .catch(() => setError("Could not load article content."))
      .finally(() => setLoading(false));
  }, [open, article]);

  /* ESC to close */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* Lock body scroll */
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !article) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-4xl max-h-[82vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-brand-900 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">

        {/* Drag handle — mobile only */}
        <div className="flex-shrink-0 flex justify-center pt-2.5 pb-1 sm:hidden bg-white dark:bg-brand-900">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-brand-900">
          <div className="flex items-center gap-3 min-w-0">
            {article.logoCandidates.length > 0 && (
              <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-gray-50 dark:bg-brand-900 border border-gray-100 dark:border-gray-700 overflow-hidden p-1">
                <SmartImage
                  candidates={article.logoCandidates}
                  alt={article.sourceName}
                  className="h-full w-full object-contain"
                />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-900 dark:text-gray-100 truncate">
                {article.sourceName}
              </p>
              <time
                className="text-xs text-gray-400 dark:text-gray-500"
                dateTime={article.publishedAt}
              >
                {new Date(article.publishedAt).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain bg-gray-50 dark:bg-brand-900">
          <div className="px-4 sm:px-8 md:px-12 py-6 sm:py-8 max-w-3xl mx-auto">

            {/* Headline */}
            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-brand-900 dark:text-gray-50 leading-tight mb-5">
              {article.title}
            </h1>

            {/* Lead / description */}
            {article.description && (
              <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
                {article.description}
              </p>
            )}

            {/* Hero image */}
            {article.imageCandidates.length > 0 && (
              <div className="mb-6 sm:mb-8 rounded-xl overflow-hidden bg-gray-100 dark:bg-brand-900 shadow-sm">
                <SmartImage
                  candidates={article.imageCandidates}
                  alt={article.title}
                  wrapperClassName="aspect-video"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center gap-3 py-16 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm text-gray-500">Loading article…</span>
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 p-4 mb-6">
                <p className="text-sm text-rose-700 dark:text-rose-400 font-medium">
                  {error}
                </p>
                <p className="text-xs text-rose-500 dark:text-rose-500 mt-1">
                  Read the full article on the original site below.
                </p>
              </div>
            )}

            {/* Article content */}
            {content && (
              <article
                className="article-reader"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}

            {/* Footer CTA */}
            <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-medium text-gray-400 dark:text-gray-500 mb-0.5">
                  Continue reading at
                </p>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {article.sourceName}
                </p>
              </div>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm ${ACCENT_BTN[accent]}`}
              >
                Read Full Article
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>

            {/* Mobile close button — always reachable at the bottom */}
            <div className="mt-6 pb-2 sm:hidden">
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-brand-900 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="h-4 w-4" />
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
