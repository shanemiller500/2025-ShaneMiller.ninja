/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface FinanceArticle {
  source: { id: string | null; name: string; image?: string | null; imageCandidates?: string[] };
  title: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
export const getDomain = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const favicon = (domain: string) =>
  domain ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}` : "";

export const stableKey = (a: FinanceArticle) => a.url?.trim() || `${a.title}-${a.publishedAt}`;

const bad = (s?: string | null) => !s || ["none", "null", "n/a"].includes(String(s).toLowerCase());

const normalize = (s: string) => {
  const t = s.trim();
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("http://")) return t.replace("http://", "https://");
  return t;
};

export const uniqStrings = (arr: string[]) => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of arr) {
    const k = s.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
};

export const getImageCandidates = (a: FinanceArticle) => {
  const sources = [a.urlToImage].filter((s): s is string => !bad(s)).map(normalize);
  return uniqStrings(sources);
};

export const getLogoCandidates = (a: FinanceArticle) => {
  const domain = getDomain(a.url);
  const fromApi = (a.source.imageCandidates?.length ? a.source.imageCandidates : [a.source.image])
    .filter((s): s is string => !bad(s))
    .map(normalize);

  const generated = domain
    ? [
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
        `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
      ]
    : [];

  return uniqStrings([...fromApi, ...generated]);
};

/* ------------------------------------------------------------------ */
/*  SmartImage                                                         */
/* ------------------------------------------------------------------ */
export function SmartImage({
  candidates,
  alt,
  className,
  wrapperClassName,
}: {
  candidates: string[];
  alt: string;
  className?: string;
  wrapperClassName?: string;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => setIdx(0), [candidates.join("|")]);

  const src = candidates[idx];
  if (!src) return null;

  return (
    <div className={wrapperClassName}>
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        decoding="async"
        onError={() => setIdx((i) => i + 1)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ReaderModal                                                        */
/* ------------------------------------------------------------------ */
export function ReaderModal({
  open,
  article,
  onClose,
}: {
  open: boolean;
  article: FinanceArticle | null;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !article) {
      setContent(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/parse-article?url=${encodeURIComponent(article.url)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setContent(data.content);
        }
      })
      .catch((err) => {
        setError("Failed to load article");
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, article]);

  // ESC key handler
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !article) return null;

  const images = getImageCandidates(article);
  const domain = getDomain(article.url);
  const logos = getLogoCandidates(article);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      {/* backdrop */}
      <div
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-black/90 cursor-pointer"
      />

      {/* panel - MAGAZINE STYLE */}
      <div className="relative z-10 w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden border-2 sm:border-4 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] shadow-2xl isolate">
        {/* Header - NEWSPAPER MASTHEAD - flex-shrink-0 */}
        <div className="flex-shrink-0 border-b-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20]">
          <div className="flex items-center justify-between gap-2 sm:gap-4 p-3 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-600 dark:bg-green-400 rounded-full shrink-0"></div>
              {logos.length > 0 && (
                <SmartImage
                  candidates={logos}
                  alt={article.source.name}
                  className="h-6 w-6 sm:h-8 sm:w-8 object-contain shrink-0 border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-neutral-800 p-0.5 sm:p-1"
                />
              )}
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] font-black text-neutral-900 dark:text-neutral-100 truncate">
                  {article.source.name || domain}
                </p>
                <time className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold text-neutral-500 dark:text-neutral-400" dateTime={article.publishedAt}>
                  {new Date(article.publishedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </div>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-neutral-900 px-2 py-1 sm:px-4 sm:py-2 text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-widest font-black text-neutral-900 dark:text-neutral-100 hover:bg-green-600 hover:text-white hover:border-green-600 dark:hover:bg-green-400 dark:hover:text-neutral-900 dark:hover:border-green-400 transition-all"
            >
              Close
            </button>
          </div>
        </div>

        {/* Content - scrollable area */}
        <div className="flex-1 overflow-y-auto overscroll-contain bg-white dark:bg-[#1D1D20]">
          {/* Article Body - MAGAZINE LAYOUT */}
          <div className="p-4 sm:p-8 md:p-12">
            {/* HEADLINE */}
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-neutral-900 dark:text-neutral-100 mb-4 sm:mb-6 leading-[1.1] uppercase border-b-4 border-green-600 dark:border-green-400 pb-4 sm:pb-6">
              {article.title}
            </h1>

            {/* HERO IMAGE */}
            {images.length > 0 && (
              <div className="mb-6 sm:mb-8 border-2 sm:border-4 border-neutral-900 dark:border-neutral-100 overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                <SmartImage
                  candidates={images}
                  alt={article.title}
                  wrapperClassName="aspect-[16/9]"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-12 sm:py-20 border-2 border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-900">
                <div className="w-3 h-3 bg-green-600 dark:bg-green-400 rounded-full animate-pulse mb-4"></div>
                <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] font-black text-neutral-900 dark:text-neutral-100">Loading Story...</span>
              </div>
            )}

            {error && (
              <div className="border-2 sm:border-4 border-green-600 dark:border-green-400 bg-white dark:bg-neutral-900 p-4 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full"></div>
                  <h3 className="text-[10px] sm:text-xs uppercase tracking-[0.3em] font-black text-neutral-900 dark:text-neutral-100">Error</h3>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 mb-2">{error}</p>
                <p className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400">Read the full article on the original site below.</p>
              </div>
            )}

            {/* ARTICLE CONTENT */}
            {content && (
              <article
                className="prose prose-sm sm:prose-lg max-w-none
                          prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-headings:text-neutral-900 dark:prose-headings:text-neutral-100 prose-headings:border-b-2 prose-headings:border-neutral-900 dark:prose-headings:border-neutral-100 prose-headings:pb-2 prose-headings:mb-4
                          prose-p:text-neutral-900 dark:prose-p:text-neutral-100 prose-p:leading-relaxed prose-p:text-sm sm:prose-p:text-lg prose-p:mb-4 sm:prose-p:mb-6
                          prose-a:text-green-600 dark:prose-a:text-green-400 prose-a:no-underline prose-a:font-bold hover:prose-a:underline
                          prose-strong:text-neutral-900 dark:prose-strong:text-neutral-100 prose-strong:font-black
                          prose-img:border-2 sm:prose-img:border-4 prose-img:border-neutral-900 dark:prose-img:border-neutral-100 prose-img:my-4 sm:prose-img:my-8 prose-img:w-full
                          prose-blockquote:border-l-4 prose-blockquote:border-green-600 dark:prose-blockquote:border-green-400 prose-blockquote:bg-neutral-100 dark:prose-blockquote:bg-neutral-900 prose-blockquote:py-4 prose-blockquote:px-4 sm:prose-blockquote:px-6 prose-blockquote:not-italic prose-blockquote:font-light
                          prose-code:bg-neutral-900 dark:prose-code:bg-neutral-100 prose-code:text-white dark:prose-code:text-neutral-900 prose-code:px-2 prose-code:py-1 prose-code:font-mono prose-code:text-xs sm:prose-code:text-sm
                          prose-ul:list-square prose-ul:pl-4 sm:prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-4 sm:prose-ol:pl-6
                          prose-li:text-neutral-900 dark:prose-li:text-neutral-100 prose-li:mb-2"
                style={{ fontFamily: '"Merriweather", serif', textAlign: "justify" }}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}

            {/* READ MORE SECTION */}
            <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t-4 border-neutral-900 dark:border-neutral-100">
              <div className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-neutral-900 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full"></div>
                      <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] font-black text-neutral-900 dark:text-neutral-100">Continue Reading</p>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-neutral-700 dark:text-neutral-300">{article.source.name || domain}</p>
                  </div>
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 border-2 border-neutral-900 dark:border-neutral-100 bg-green-600 dark:bg-green-400 px-4 sm:px-6 py-2 sm:py-3 text-[10px] sm:text-xs uppercase tracking-wider sm:tracking-widest font-black text-white dark:text-neutral-900 hover:bg-neutral-900 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-900 hover:border-neutral-900 dark:hover:border-neutral-100 transition-all"
                  >
                    Read Full Article
                    <span>→</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
