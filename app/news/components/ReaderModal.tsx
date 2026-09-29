"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
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

// Hairline colour across the top of the modal, per news section.
const ACCENT_HEX: Record<AccentColor, string> = {
  indigo: "#6366f1",
  orange: "#f97316",
  emerald: "#10b981",
  rose: "#f43f5e",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ReaderModal({ open, article, onClose, accent = "indigo" }: Props) {
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

  return (
    <Modal open={open && !!article} onClose={onClose} labelledBy="reader-title" accent={ACCENT_HEX[accent]} size="lg">
      {article && (
        <>
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-200/70 px-4 py-3 pr-14 dark:border-white/[0.08] sm:px-6 sm:py-4">
            {article.logoCandidates.length > 0 && (
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-white p-1.5 ring-1 ring-slate-200 dark:ring-white/10">
                <SmartImage candidates={article.logoCandidates} alt={article.sourceName} className="h-full w-full object-contain" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{article.sourceName}</p>
              <time className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500" dateTime={article.publishedAt}>
                {new Date(article.publishedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </time>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8 md:px-12">
              <h1 id="reader-title" className="mb-5 font-aspekta text-2xl font-[650] leading-tight tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
                {article.title}
              </h1>

              {article.description && (
                <p className="mb-6 border-b border-slate-200/70 pb-6 text-base leading-relaxed text-slate-600 dark:border-white/[0.08] dark:text-slate-300 sm:text-lg">
                  {article.description}
                </p>
              )}

              {article.imageCandidates.length > 0 && (
                <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.04] sm:mb-8">
                  <SmartImage candidates={article.imageCandidates} alt={article.title} wrapperClassName="aspect-video" className="h-full w-full object-cover" />
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  <span className="font-mono text-xs uppercase tracking-wider">Loading article…</span>
                </div>
              )}

              {error && !loading && (
                <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
                  <p className="text-sm font-medium text-rose-700 dark:text-rose-200">{error}</p>
                  <p className="mt-1 text-xs text-rose-600/80 dark:text-rose-300/70">Read the full article on the original site below.</p>
                </div>
              )}

              {content && <article className="article-reader" dangerouslySetInnerHTML={{ __html: content }} />}

              {/* Footer CTA */}
              <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-slate-200/70 pt-6 dark:border-white/[0.08] sm:flex-row sm:items-center">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Continue reading at</p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{article.sourceName}</p>
                </div>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.6)] transition hover:bg-indigo-600"
                >
                  Read full article
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
