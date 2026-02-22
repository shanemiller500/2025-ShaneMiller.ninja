/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { trackEvent } from "@/utils/mixpanel";
import { SmartImage } from "../lib/SmartImage";
import { getDomain, uniqStrings, badUrl, withProxyFallback, normalizeUrl } from "../lib/utils";

import type { Article } from "./AllNewsTab";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export type ArticleGroup = {
  key: string;
  title: string;
  items: Article[];
  rep: Article;
  newestAt: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const firstImg = (html?: string | null) =>
  html?.match(/<img[^>]+src=['"]([^'"]+)['"]/i)?.[1] ?? null;

export const getImageCandidates = (a: Article, width?: number): string[] => {
  const sources = [
    a.urlToImage,
    a.image,
    a.images?.[0],
    a.thumbnails?.[0],
    firstImg(a.content),
  ].filter((s): s is string => !badUrl(s));
  return withProxyFallback(uniqStrings(sources), width);
};

export const getLogoCandidates = (a: Article): string[] => {
  const domain = getDomain(a.url);
  const fromApi = Array.isArray(a.source.imageCandidates)
    ? a.source.imageCandidates
    : [];
  const fallback = domain
    ? [
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
        `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
        `https://logo.clearbit.com/${encodeURIComponent(domain)}?size=128`,
      ]
    : [];
  return withProxyFallback(uniqStrings([...fromApi, ...fallback]));
};

export const stableKey = (a: Article): string =>
  a.url?.trim() || `${a.title}-${a.publishedAt}`;

/* ------------------------------------------------------------------ */
/*  GroupModal                                                         */
/* ------------------------------------------------------------------ */
export function GroupModal({
  open,
  group,
  onClose,
  onArticleClick,
}: {
  open: boolean;
  group: ArticleGroup | null;
  onClose: () => void;
  onArticleClick: (article: Article) => void;
}) {
  /* ESC key */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* Lock scroll */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !group) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-black/55 backdrop-blur-sm cursor-pointer"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col bg-white dark:bg-brand-900 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 flex items-start justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                {group.items.length} source{group.items.length === 1 ? "" : "s"}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-50 leading-snug line-clamp-2">
              {group.title}
            </h3>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              Latest:{" "}
              {new Date(group.newestAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2 bg-gray-50 dark:bg-gray-950">
          {group.items.map((a) => {
            const logos = getLogoCandidates(a);
            const imgs = getImageCandidates(a);
            const hasImage = imgs.length > 0;

            return (
              <button
                key={stableKey(a)}
                onClick={() => {
                  trackEvent("Article Clicked", {
                    title: a.title,
                    url: a.url,
                    source: a.source.name,
                    grouped: true,
                  });
                  onArticleClick(a);
                }}
                className="group block w-full text-left overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-brand-900 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200"
              >
                <div className="flex gap-3 p-3">
                  {hasImage && (
                    <div className="relative h-14 w-20 sm:h-16 sm:w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                      <SmartImage
                        candidates={imgs}
                        alt={a.title}
                        wrapperClassName="absolute inset-0"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      {logos.length > 0 && (
                        <div className="h-4 w-4 rounded overflow-hidden bg-gray-50 dark:bg-gray-800 flex-shrink-0">
                          <SmartImage
                            candidates={logos}
                            alt={a.source.name}
                            className="h-full w-full object-contain"
                          />
                        </div>
                      )}
                      <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                        {a.source.name || getDomain(a.url)}
                      </span>
                      <span className="text-[10px] text-gray-300 dark:text-gray-600">·</span>
                      <time className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500" dateTime={a.publishedAt}>
                        {new Date(a.publishedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-50 leading-snug line-clamp-2 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                      {a.title}
                    </p>

                    {a.description && (
                      <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                        {a.description}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
