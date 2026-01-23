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
      className="relative cursor-pointer font-bold text-red-700 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 border-b-2 border-red-200 dark:border-red-800 hover:border-red-400 dark:hover:border-red-600 transition-colors"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && info && (
        <div className="absolute left-1/2 top-full mt-2 z-50 w-80 -translate-x-1/2 border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] p-4 shadow-2xl">
          <div className="flex gap-3">
            {info.thumb && (
              <img 
                src={info.thumb} 
                alt="" 
                className="w-16 h-16 object-cover border border-neutral-300 dark:border-neutral-700" 
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-black mb-1 uppercase tracking-wide text-neutral-900 dark:text-neutral-100">{info.title}</h3>
              <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400 line-clamp-3">{info.extract}</p>
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
    <div>
      {/* ═══════════════ MAGAZINE MASONRY GRID ═══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* ───────── LEAD STORY: ANSWER ───────── */}
          <article className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] p-8">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-neutral-200 dark:border-neutral-700">
              <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
              <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-neutral-900 dark:text-neutral-100">Analysis</h3>
            </div>
            
            <div className="prose prose-lg max-w-none">
              <p className="text-lg leading-relaxed text-neutral-900 dark:text-neutral-100" style={{ fontFamily: '"Merriweather", serif', textAlign: 'justify' }}>
                {highlighted}
              </p>
            </div>
          </article>

          {/* ───────── IMAGES GALLERY ───────── */}
          {result.images.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
                <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-neutral-900 dark:text-neutral-100">Visual Evidence</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {result.images.map((img, i) => (
                  <a
                    key={i}
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackEvent("Image Click", { url: img.url })}
                    className="group relative aspect-square overflow-hidden border-2 border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-900 hover:border-red-600 dark:hover:border-red-400 transition-all"
                  >
                    <img
                      src={img.url}
                      alt={img.description ?? ""}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {img.description && (
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                        <p className="text-[10px] text-white font-semibold uppercase tracking-wider">
                          {img.description}
                        </p>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* ───────── TABLES ───────── */}
          {result.tables.map((t, idx) => (
            <section key={idx}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
                <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-neutral-900 dark:text-neutral-100">{t.title}</h3>
              </div>
              
              <div className="border-2 border-neutral-900 dark:border-neutral-100 overflow-hidden bg-white dark:bg-[#1D1D20]">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900">
                      <tr>
                        {t.headers.map((h, i) => (
                          <th key={i} className="px-4 py-3 text-left text-xs uppercase tracking-wider font-bold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.rows.map((row, r) => (
                        <tr key={r} className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-900">
                          {row.map((cell, c) => (
                            <td key={c} className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}

          {/* ───────── FOLLOW-UPS ───────── */}
          {result.followUpQuestions.length > 0 && (
            <section className="border-t-2 border-neutral-900 dark:border-neutral-100 pt-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
                <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-neutral-900 dark:text-neutral-100">Continue Reading</h3>
              </div>

              <div className="space-y-3 mb-6">
                {result.followUpQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => followClick(q)}
                    className="w-full text-left p-4 border-2 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#1D1D20] hover:border-neutral-900 dark:hover:border-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl font-black text-neutral-300 dark:text-neutral-700 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" style={{ fontFamily: '"Playfair Display", serif' }}>
                        {i + 1}.
                      </span>
                      <span className="text-sm leading-relaxed text-neutral-900 dark:text-neutral-100" style={{ fontFamily: '"Merriweather", serif' }}>
                        {q}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom follow-up */}
              <form onSubmit={followSubmit} className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] p-4">
                <label className="block text-xs uppercase tracking-wider font-bold mb-3 text-neutral-900 dark:text-neutral-100">
                  Ask Your Own Question
                </label>
                <div className="flex gap-2">
                  <input
                    value={followField}
                    onChange={(e) => setFollowField(e.target.value)}
                    placeholder="Type your question..."
                    className="flex-1 px-4 py-3 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1D1D20] text-neutral-900 dark:text-neutral-100 outline-none focus:border-neutral-900 dark:focus:border-neutral-100 transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
                    style={{ fontFamily: '"Merriweather", serif' }}
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-bold uppercase tracking-wider hover:bg-red-600 dark:hover:bg-red-400 transition-colors"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>

        {/* RIGHT COLUMN - SIDEBAR */}
        <div className="space-y-8">
          
          {/* ───────── WIKIPEDIA FEATURE ───────── */}
          {result.wikipedia && (
            <aside className="border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] p-6">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                <svg className="w-4 h-4 text-neutral-900 dark:text-neutral-100" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm.14 19.995v-3.92h-.53l-1.89 3.92h-1.52l2.2-4.48c-1.3-.28-2.22-1.19-2.22-2.52 0-1.48 1.11-2.68 2.85-2.68h2.64v9.68h-1.53zm0-5.16v-3.17h-.94c-.94 0-1.55.56-1.55 1.48s.55 1.48 1.45 1.48l1.04.21z"/>
                </svg>
                <h3 className="text-xs uppercase tracking-wider font-bold text-neutral-900 dark:text-neutral-100">Encyclopedia</h3>
              </div>

              <h4 className="text-xl font-black leading-tight mb-3 text-neutral-900 dark:text-neutral-100" style={{ fontFamily: '"Playfair Display", serif' }}>
                {result.wikipedia.title}
              </h4>

              <p className="text-sm leading-relaxed mb-4 text-neutral-700 dark:text-neutral-300" style={{ fontFamily: '"Merriweather", serif' }}>
                {result.wikipedia.extract}
              </p>

              <a
                href={result.wikipedia.content_urls.desktop.page}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full text-center px-4 py-3 border-2 border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-bold uppercase tracking-wider hover:bg-white dark:hover:bg-[#1D1D20] hover:text-neutral-900 dark:hover:text-neutral-100 transition-all"
                onClick={() => trackEvent("Wikipedia Click", { page: result.wikipedia!.title })}
              >
                Read Full Article →
              </a>
            </aside>
          )}

          {/* ───────── SOURCES ───────── */}
          {result.links.length > 0 && (
            <aside>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
                <h3 className="text-xs uppercase tracking-[0.3em] font-bold text-neutral-900 dark:text-neutral-100">Sources</h3>
              </div>

              <div className="space-y-4">
                {result.links.map((l, i) => (
                  <LinkCard key={i} link={l} index={i + 1} />
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}