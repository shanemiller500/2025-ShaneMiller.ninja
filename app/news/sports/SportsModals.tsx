/* eslint-disable @next/next/no-img-element */
"use client";

import { getDomain, favicon, uniqStrings, badUrl, normalizeUrl } from "../lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface SportsArticle {
  source: { id: string | null; name: string; image?: string | null };
  title: string;
  url: string;
  urlToImage: string | null;
  images?: string[];
  publishedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Re-exports from shared lib (keeps backward compatibility)          */
/* ------------------------------------------------------------------ */
export { SmartImage } from "../lib/SmartImage";
export { getDomain, favicon, uniqStrings };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const normalize = (s: string) => normalizeUrl(s);

const bad = (s?: string | null): boolean => badUrl(s);

export const stableKey = (a: SportsArticle): string =>
  a.url?.trim() || `${a.title}-${a.publishedAt}`;

export const getImageCandidates = (a: SportsArticle): string[] => {
  const sources = [a.urlToImage, ...(Array.isArray(a.images) ? a.images : [])]
    .filter((s): s is string => !bad(s))
    .map(normalize);
  return uniqStrings(sources);
};

export const getLogoCandidates = (a: SportsArticle): string[] => {
  const domain = getDomain(a.url);
  const fromSource = a.source.image && !bad(a.source.image) ? [normalize(a.source.image)] : [];
  const fallback = domain ? [favicon(domain)] : [];
  return uniqStrings([...fromSource, ...fallback]);
};
