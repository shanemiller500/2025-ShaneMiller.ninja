/* eslint-disable @next/next/no-img-element */
"use client";

import { Layers } from "lucide-react";
import { trackEvent } from "@/utils/mixpanel";
import { Modal } from "@/components/ui/modal";
import { SmartImage } from "../lib/SmartImage";
import { getDomain, uniqStrings, badUrl, withProxyFallback } from "../lib/utils";
import { shortDate } from "../components/NewsKit";

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
  return (
    <Modal open={open && !!group} onClose={onClose} labelledBy="group-title" size="lg">
      {group && (
        <>
          <div className="shrink-0 border-b border-slate-200/70 px-4 py-4 pr-14 dark:border-white/[0.08] sm:px-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
              <Layers className="h-3 w-3" aria-hidden />
              {group.items.length} source{group.items.length === 1 ? "" : "s"}
            </span>
            <h3 id="group-title" className="mt-2 text-base font-semibold leading-snug text-slate-900 line-clamp-2 dark:text-white">
              {group.title}
            </h3>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Latest · {shortDate(group.newestAt)}</p>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 sm:p-4">
            {group.items.map((a) => {
              const logos = getLogoCandidates(a);
              const imgs = getImageCandidates(a);
              return (
                <button
                  key={stableKey(a)}
                  onClick={() => {
                    trackEvent("Article Clicked", { title: a.title, url: a.url, source: a.source.name, grouped: true });
                    onArticleClick(a);
                  }}
                  className="group flex w-full gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 text-left transition hover:border-slate-300 hover:shadow-[0_8px_24px_-14px_rgba(15,23,42,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/15"
                >
                  {imgs.length > 0 && (
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-white/[0.04]">
                      <SmartImage candidates={imgs} alt={a.title} wrapperClassName="absolute inset-0" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {logos.length > 0 && (
                        <span className="h-4 w-4 shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-slate-200 dark:ring-white/10">
                          <SmartImage candidates={logos} alt={a.source.name} className="h-full w-full object-contain p-0.5" />
                        </span>
                      )}
                      <span className="truncate font-medium">{a.source.name || getDomain(a.url)}</span>
                      <span className="opacity-40">·</span>
                      <time className="font-mono text-[10px]" dateTime={a.publishedAt}>{shortDate(a.publishedAt)}</time>
                    </div>
                    <p className="text-sm font-semibold leading-snug text-slate-900 transition-colors line-clamp-2 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-300">
                      {a.title}
                    </p>
                    {a.description && <p className="mt-1 text-xs leading-relaxed text-slate-500 line-clamp-2 dark:text-slate-400">{a.description}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
