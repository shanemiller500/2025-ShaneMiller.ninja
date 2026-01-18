/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

export type NewsArticle = {
  title: string;
  description?: string;
  url: string;
  publishedAt: string;
  content?: string | null;

  urlToImage?: string | null;
  image?: string | null;
  images?: string[];
  thumbnails?: string[];

  source?: {
    name: string;
    imageCandidates?: string[];
  };
};

export type ArticleGroup = {
  key: string;
  title: string;
  items: NewsArticle[];
  rep: NewsArticle;
};

const API_BASE = "https://u-mail.co/api/NewsAPI";
const IMG_PROXY = `${API_BASE}/img?url=`;

const bad = (s?: string | null) =>
  !s || ["none", "null", "n/a"].includes(String(s).toLowerCase());

const normalize = (s: string) => {
  const t = String(s || "").trim();
  if (!t) return "";
  if (t.startsWith("//")) return `https:${t}`;
  return t;
};

const uniqStrings = (arr: string[]) => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of arr) {
    const k = normalize(s);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
};

const normalizeTitleKey = (t: string) =>
  String(t || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”‘’"']/g, "")
    .replace(/\s*[-–—:|]\s*/g, " - ")
    .slice(0, 140);

const firstImg = (html?: string | null) =>
  html?.match(/<img[^>]+src=['"]([^'"]+)['"]/i)?.[1] ?? null;

/** heuristic: higher score = likely better quality */
function scoreImageUrl(u: string) {
  const url = normalize(u);
  if (!url) return -9999;

  let score = 0;
  const low = url.toLowerCase();

  // avoid very small thumbs
  if (low.includes("60x60")) score -= 50;
  if (low.includes("/60/60/")) score -= 50;
  if (low.includes("thumbnail/60x60")) score -= 60;

  // prefer “master” / original / large
  if (low.includes("/master/")) score += 30;
  if (low.includes("quality=85")) score += 5;
  if (low.includes("fit=max")) score += 5;

  // detect width query params
  const wMatch =
    low.match(/[?&](width|w)=(\d{2,4})/) ||
    low.match(/\/(\d{2,4})\/(\d{2,4})\//); // sometimes /700/460/
  if (wMatch) {
    const maybeW = Number(wMatch[wMatch.length - 1]);
    if (Number.isFinite(maybeW)) score += Math.min(60, Math.floor(maybeW / 20));
  }

  // prefer common large image hints
  if (low.includes("1600x900")) score += 40;
  if (low.includes("992x558")) score += 25;
  if (low.includes("608x456")) score += 15;
  if (low.includes("384x288")) score += 8;
  if (low.includes("144x108")) score -= 10;

  // tiny icon-ish images
  if (low.endsWith(".ico")) score -= 20;

  return score;
}

/**
 * candidates:
 * - pull all known fields
 * - sort by score (best first)
 * - append proxy versions AFTER originals (fallback)
 */
function getImageCandidates(a: NewsArticle) {
  const raw = [
    a.urlToImage,
    a.image,
    ...(Array.isArray(a.images) ? a.images : []),
    ...(Array.isArray(a.thumbnails) ? a.thumbnails : []),
    firstImg(a.content ?? null),
  ].filter((s): s is string => !bad(s));

  const base = uniqStrings(raw);

  // sort best first (so we try highest quality before small thumbs)
  base.sort((x, y) => scoreImageUrl(y) - scoreImageUrl(x));

  // proxy fallbacks last
  const proxied = base.map((u) => `${IMG_PROXY}${encodeURIComponent(u)}`);

  return uniqStrings([...base, ...proxied]);
}

export function groupByTitle(articles: NewsArticle[]): ArticleGroup[] {
  const map = new Map<string, NewsArticle[]>();

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const key = normalizeTitleKey(a.title);
    if (!key) continue;

    const arr = map.get(key);
    if (arr) arr.push(a);
    else map.set(key, [a]);
  }

  const groups: ArticleGroup[] = [];

  // ✅ ES5-safe
  map.forEach((items, key) => {
    items.sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
    groups.push({
      key,
      title: items[0]?.title || key,
      items,
      rep: items[0],
    });
  });

  groups.sort((a, b) => +new Date(b.rep.publishedAt) - +new Date(a.rep.publishedAt));
  return groups;
}

/* -------------------------------------------------- */
/* SmartImage                                          */
/* - renders NOTHING if all candidates fail             */
/* -------------------------------------------------- */
function SmartImage({
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
        referrerPolicy="no-referrer"
        onError={() => setIdx((i) => i + 1)}
      />
    </div>
  );
}

/* -------------------------------------------------- */
/* UI                                                  */
/* -------------------------------------------------- */
export default function NewsGroupedCarousel({
  articles,
}: {
  articles: NewsArticle[];
}) {
  const groups = useMemo(() => groupByTitle(articles), [articles]);

  // only show groups that have multiple sources OR at least 2 items
  const multi = useMemo(
    () => groups.filter((g) => g.items.length >= 2),
    [groups]
  );

  const [open, setOpen] = useState<ArticleGroup | null>(null);

  if (!multi.length) return null;

  return (
    <>
      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Same story, multiple sources
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              Swipe / scroll sideways to compare coverage.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {multi.slice(0, 12).map((g) => (
            <GroupRow key={g.key} group={g} onOpen={() => setOpen(g)} />
          ))}
        </div>
      </section>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-white shadow-xl dark:bg-brand-900"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-white/10">
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-base font-extrabold text-gray-900 dark:text-white">
                  {open.title}
                </h3>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  {open.items.length} sources
                </p>
              </div>

              <button
                onClick={() => setOpen(null)}
                className="rounded-xl bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-800 dark:bg-white/10 dark:hover:bg-white/15"
              >
                Close
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {open.items.map((a) => (
                  <PopupCard key={a.url || `${a.title}-${a.publishedAt}`} a={a} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GroupRow({
  group,
  onOpen,
}: {
  group: ArticleGroup;
  onOpen: () => void;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = (dx: number) => {
    const el = rowRef.current;
    if (!el) return;
    el.scrollBy({ left: dx, behavior: "smooth" });
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-brand-900">
      <div className="mb-2 flex items-center justify-between gap-3">
        <button
          onClick={onOpen}
          className="line-clamp-1 text-left text-sm font-extrabold text-gray-900 hover:underline dark:text-white"
          title={group.title}
        >
          {group.title}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollBy(-420)}
            className="rounded-xl bg-black/[0.04] px-3 py-1.5 text-xs font-bold text-gray-900 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.10]"
          >
            ◀
          </button>
          <button
            onClick={() => scrollBy(420)}
            className="rounded-xl bg-black/[0.04] px-3 py-1.5 text-xs font-bold text-gray-900 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.10]"
          >
            ▶
          </button>
          <button
            onClick={onOpen}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1.5 text-xs font-bold text-white"
          >
            View all
          </button>
        </div>
      </div>

      {/* horizontal slider */}
      <div
        ref={rowRef}
        className="no-scrollbar flex gap-3 overflow-x-auto overscroll-x-contain pb-1"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {group.items.slice(0, 10).map((a) => (
          <SlideCard key={a.url || `${a.title}-${a.publishedAt}`} a={a} />
        ))}
      </div>
    </div>
  );
}

function SlideCard({ a }: { a: NewsArticle }) {
  const candidates = getImageCandidates(a);
  const hasImg = candidates.length > 0;

  const sourceName = a.source?.name || "Source";
  const date = new Date(a.publishedAt).toLocaleString(undefined, { month: "short", day: "numeric" });

  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative w-[260px] flex-shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md dark:border-white/10 dark:bg-brand-900"
    >
      {/* ✅ if no image candidates, do NOT render a placeholder */}
      {hasImg ? (
        <div className="relative h-32">
          <SmartImage
            candidates={candidates}
            alt={a.title}
            wrapperClassName="absolute inset-0"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/0" />
        </div>
      ) : null}

      <div className={`p-3 ${hasImg ? "" : "pt-3"}`}>
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-gray-600 dark:text-gray-300">
          <span className="truncate">{sourceName}</span>
          <span className="opacity-70">{date}</span>
        </div>

        <h4 className="line-clamp-3 text-sm font-semibold text-gray-900 dark:text-white">
          {a.title}
        </h4>

        {a.description ? (
          <p className="mt-2 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
            {a.description}
          </p>
        ) : null}
      </div>
    </a>
  );
}

function PopupCard({ a }: { a: NewsArticle }) {
  const candidates = getImageCandidates(a);
  const hasImg = candidates.length > 0;

  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md dark:border-white/10 dark:bg-brand-900"
    >
      {/* ✅ no image block if none */}
      {hasImg ? (
        <div className="relative h-40">
          <SmartImage
            candidates={candidates}
            alt={a.title}
            wrapperClassName="absolute inset-0"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/0" />
        </div>
      ) : null}

      <div className="p-4">
        <div className="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
          {a.source?.name || "Source"} •{" "}
          {new Date(a.publishedAt).toLocaleString(undefined, { month: "short", day: "numeric" })}
        </div>

        <h4 className="line-clamp-3 text-sm font-extrabold text-gray-900 dark:text-white">
          {a.title}
        </h4>

        {a.description ? (
          <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-gray-400">
            {a.description}
          </p>
        ) : null}
      </div>
    </a>
  );
}
