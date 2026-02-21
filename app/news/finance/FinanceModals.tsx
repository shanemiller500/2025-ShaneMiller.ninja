/* eslint-disable @next/next/no-img-element */
"use client";

import { getDomain, uniqStrings, badUrl, normalizeUrl } from "../lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface FinanceArticle {
  source: {
    id: string | null;
    name: string;
    image?: string | null;
    imageCandidates?: string[];
  };
  title: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Re-exports from shared lib (keeps backward compatibility)          */
/* ------------------------------------------------------------------ */
export { SmartImage } from "../lib/SmartImage";
export { getDomain, uniqStrings };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const normalize = (s: string) => normalizeUrl(s);

const bad = (s?: string | null): boolean => badUrl(s);

export const stableKey = (a: FinanceArticle): string =>
  a.url?.trim() || `${a.title}-${a.publishedAt}`;

export const getImageCandidates = (a: FinanceArticle): string[] => {
  const sources = [a.urlToImage].filter((s): s is string => !bad(s)).map(normalize);
  return uniqStrings(sources);
};

export const getLogoCandidates = (a: FinanceArticle): string[] => {
  const domain = getDomain(a.url);
  const fromApi = (
    a.source.imageCandidates?.length
      ? a.source.imageCandidates
      : a.source.image
      ? [a.source.image]
      : []
  )
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
