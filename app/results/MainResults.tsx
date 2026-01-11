"use client";

import React, { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/utils/mixpanel";
import LinkCard from "./LinkCard";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
export interface SearchHistoryItem {
  query: string;
  summary: string;
  links: { url: string; title: string; snippet?: string; thumbnail?: string | null }[];
  images: { url: string; description?: string }[];
  tables: { title: string; headers: string[]; rows: string[][] }[];
  followUpQuestions: string[];
  wikipedia: {
    title: string;
    extract: string;
    content_urls: { desktop: { page: string } };
  } | null;
  keywords: string[];
  isFinanceRelated: boolean;
  isOpen: boolean;
}

/* ------------------------------------------------------------------ */
/*  Wikipedia hover helper                                            */
/* ------------------------------------------------------------------ */
function WikiHover({ term, children }: { term: string; children: string }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<{ title: string; extract: string; thumb: string | null } | null>(null);

  const fetchIt = useCallback(async () => {
    if (info || !open) return;
    try {
      const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`);
      const j = await r.json();
      setInfo({
        title: j.title,
        extract: j.extract,
        thumb: j.thumbnail?.source ?? null,
      });
    } catch {
      setInfo({ title: term, extract: "No article found.", thumb: null });
    }
  }, [term, open, info]);

  useEffect(() => {
    if (open) fetchIt();
  }, [open, fetchIt]);

  return (
    <span
      className="relative cursor-pointer font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && info && (
        <div className="absolute left-1/2 top-7 z-50 w-80 -translate-x-1/2 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-brand-900">
          <div className="flex gap-3">
            {info.thumb && <img src={info.thumb} alt="" className="h-16 w-16 rounded-xl object-cover" />}
            <div className="min-w-0">
              <h3 className="mb-1 truncate text-sm font-extrabold">{info.title}</h3>
              <p className="line-clamp-4 text-xs opacity-80">{info.extract}</p>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Keyword highlighter                                               */
/* ------------------------------------------------------------------ */
function useHighlighted(text: string, keywords: string[]) {
  return useMemo(() => {
    if (!keywords.length) return text;

    const regex = new RegExp(
      `(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
      "gi"
    );

    return text
      .split(regex)
      .filter(Boolean)
      .map((chunk, i) =>
        keywords.some((k) => k.toLowerCase() === chunk.toLowerCase()) ? (
          <WikiHover key={i} term={chunk}>
            {chunk}
          </WikiHover>
        ) : (
          <Fragment key={i}>{chunk}</Fragment>
        )
      );
  }, [text, keywords]);
}

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */
interface Props {
  result: SearchHistoryItem;
  followField: string;
  setFollowField: React.Dispatch<React.SetStateAction<string>>;
  followSubmit: (e: React.FormEvent) => void;
  followClick: (q: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export default function MainResults({ result, followField, setFollowField, followSubmit, followClick }: Props) {
  const highlighted = useHighlighted(result.summary, result.keywords);

  return (
    <div className="space-y-6">
      {/* ───────────── QUICK META ───────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold opacity-80 dark:border-white/10 dark:bg-white/5">
          {result.isFinanceRelated ? "Finance-aware" : "General"}
        </span>
        {!!result.links?.length && (
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs opacity-70 dark:border-white/10 dark:bg-white/5">
            {result.links.length} sources
          </span>
        )}
        {!!result.images?.length && (
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs opacity-70 dark:border-white/10 dark:bg-white/5">
            {result.images.length} images
          </span>
        )}
      </div>

      {/* ───────────── IMAGES ───────────── */}
      {result.images.length > 0 && (
        <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold tracking-tight sm:text-base">Images</h2>
            <p className="text-xs opacity-60">Click to open</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
            {result.images.map((img, i) => (
              <a
                key={i}
                href={img.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("Image Click", { url: img.url })}
                className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-brand-900"
              >
                <img
                  src={img.url}
                  alt={img.description ?? ""}
                  className="h-28 w-full object-cover transition duration-300 group-hover:scale-[1.03] sm:h-36"
                />
                <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2 line-clamp-2 text-xs text-white">
                    {img.description ?? "Open image"}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ───────────── ANSWER ───────────── */}
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold tracking-tight sm:text-base">Answer</h2>
          <span className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1 text-xs font-semibold text-white">
            AI Summary
          </span>
        </div>

        <div className="break-words leading-relaxed text-sm opacity-90 sm:text-base">
          {highlighted}
        </div>
      </section>

      {/* ───────────── TABLES ───────────── */}
      {result.tables.map((t, idx) => (
        <section
          key={idx}
          className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6"
        >
          <h3 className="mb-3 text-sm font-extrabold tracking-tight sm:text-base">{t.title}</h3>
          <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
            <table className="min-w-full text-xs sm:text-sm">
              <thead className="bg-gray-50 dark:bg-brand-900">
                <tr>
                  {t.headers.map((h, i) => (
                    <th key={i} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((row, r) => (
                  <tr key={r} className="border-t border-gray-200 dark:border-white/10">
                    {row.map((cell, c) => (
                      <td key={c} className="whitespace-nowrap px-3 py-2 opacity-90">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* ───────────── WIKIPEDIA ───────────── */}
      {result.wikipedia && (
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="min-w-0 truncate text-sm font-extrabold tracking-tight sm:text-base">
              {result.wikipedia.title}
            </h2>
            <span className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs opacity-70 dark:border-white/10 dark:bg-white/5">
              Wikipedia
            </span>
          </div>

          <p className="mb-3 text-sm opacity-90 sm:text-base">{result.wikipedia.extract}</p>

          <a
            href={result.wikipedia.content_urls.desktop.page}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
            onClick={() => trackEvent("Wikipedia Click", { page: result.wikipedia!.title })}
          >
            Read more
            <span aria-hidden="true">→</span>
          </a>
        </section>
      )}

      {/* ───────────── LINKS ───────────── */}
      {result.links.length > 0 && (
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-extrabold tracking-tight sm:text-base">Supporting Links</h2>
            <p className="text-xs opacity-60">Open in a new tab</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {result.links.map((l, i) => (
              <LinkCard key={i} link={l} />
            ))}
          </div>
        </section>
      )}

      {/* ───────────── FOLLOW-UPS ───────────── */}
      {result.followUpQuestions.length > 0 && (
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold tracking-tight sm:text-base">Follow-ups</h2>
            <span className="text-xs opacity-60">Tap one or ask your own</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {result.followUpQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => followClick(q)}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-left text-sm shadow-sm transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                {q}
              </button>
            ))}
          </div>

          <form onSubmit={followSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={followField}
              onChange={(e) => setFollowField(e.target.value)}
              placeholder="Ask your own follow-up…"
              className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none placeholder:opacity-60 dark:border-white/10 dark:bg-white/5"
            />
            <button
              type="submit"
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
            >
              Ask
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
