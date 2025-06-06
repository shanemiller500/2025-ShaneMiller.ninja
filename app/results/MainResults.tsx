/* app/(ai-search)/MainResults.tsx */
"use client";

import React, {
  Fragment,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from "react";
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
function WikiHover({
  term,
  children,
}: {
  term: string;
  children: string;
}) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<{
    title: string;
    extract: string;
    thumb: string | null;
  } | null>(null);

  const fetchIt = useCallback(async () => {
    if (info || !open) return;
    try {
      const r = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
          term
        )}`
      );
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
      className="relative cursor-pointer text-indigo-500 hover:underline dark:text-indigo-300"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && info && (
        <div className="absolute left-1/2 top-6 z-50 w-72 -translate-x-1/2 rounded-xl border border-indigo-600 bg-white p-4 shadow-xl dark:bg-brand-900">
          <div className="flex space-x-3">
            {info.thumb && (
              <img
                src={info.thumb}
                alt=""
                className="h-16 w-16 rounded-md object-cover"
              />
            )}
            <div className="min-w-0">
              <h3 className="mb-1 truncate font-semibold">{info.title}</h3>
              <p className="line-clamp-4 text-sm text-brand-200">
                {info.extract}
              </p>
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
      `(${keywords
        .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("|")})`,
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
export default function MainResults({
  result,
  followField,
  setFollowField,
  followSubmit,
  followClick,
}: Props) {
  const highlighted = useHighlighted(result.summary, result.keywords);

  return (
    <div className="space-y-8">
      {/* ───────────── IMAGES ───────────── */}
      {result.images.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Images</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 sm:gap-4">
            {result.images.map((img, i) => (
              <a
                key={i}
                href={img.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("Image Click", { url: img.url })}
              >
                <img
                  src={img.url}
                  alt={img.description ?? ""}
                  className="h-24 w-full rounded-md object-cover shadow sm:h-40"
                />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ───────────── ANSWER ───────────── */}
      <section className="rounded-lg bg-white p-4 shadow dark:bg-brand-950 sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Answer</h2>
        <div className="break-words leading-relaxed text-sm sm:text-base">
          {highlighted}
        </div>
      </section>

      {/* ───────────── TABLES ───────────── */}
      {result.tables.map((t, idx) => (
        <section
          key={idx}
          className="rounded-lg bg-white p-4 shadow dark:bg-brand-950 sm:p-6"
        >
          <h3 className="mb-2 text-lg font-bold">{t.title}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr>
                  {t.headers.map((h, i) => (
                    <th key={i} className="whitespace-nowrap border px-2 py-1">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td
                        key={c}
                        className="whitespace-nowrap border px-2 py-1"
                      >
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
        <section className="rounded-lg bg-white p-4 shadow dark:bg-brand-950 sm:p-6">
          <h2 className="mb-2 text-lg font-bold">
            {result.wikipedia.title}{" "}
            <span className="text-sm">(Wikipedia)</span>
          </h2>
          <p className="mb-2 text-sm sm:text-base">
            {result.wikipedia.extract}
          </p>
          <a
            href={result.wikipedia.content_urls.desktop.page}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-500 hover:underline"
            onClick={() =>
              trackEvent("Wikipedia Click", {
                page: result.wikipedia!.title,
              })
            }
          >
            Read more
          </a>
        </section>
      )}

      {/* ───────────── LINKS ───────────── */}
      {result.links.length > 0 && (
        <section className="rounded-lg bg-white p-4 shadow dark:bg-brand-950 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Supporting Links</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            {result.links.map((l, i) => (
              <LinkCard key={i} link={l} />
            ))}
          </div>
        </section>
      )}

      {/* ───────────── FOLLOW-UPS ───────────── */}
      {result.followUpQuestions.length > 0 && (
        <section className="rounded-lg bg-white p-4 shadow dark:bg-brand-950 sm:p-6">
          <h2 className="mb-3 text-lg font-semibold">Follow-up Questions</h2>
          <ul className="mb-4 space-y-1">
            {result.followUpQuestions.map((q, i) => (
              <li key={i}>
                <button
                  onClick={() => followClick(q)}
                  className="text-indigo-500 hover:underline"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>

          <form
            onSubmit={followSubmit}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              value={followField}
              onChange={(e) => setFollowField(e.target.value)}
              placeholder="Ask your own…"
              className="flex-1 rounded-md  bg-transparent px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-medium text-white"
            >
              Ask
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
