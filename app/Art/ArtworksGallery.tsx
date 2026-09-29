/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Search, X } from "lucide-react";
import { type Artwork, searchArtworks } from "./lib";

const SUGGESTED = ["Monet", "Seurat", "Hopper", "Cassatt", "Rembrandt", "Egypt", "Samurai", "Cats"];

// The collection: search anything, masonry wall of results, load more at the bottom.
export default function ArtworksGallery({ onOpen }: { onOpen: (a: Artwork) => void }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Artwork[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  // Debounce typing into a search
  useEffect(() => {
    const t = input.trim();
    const id = window.setTimeout(() => setQuery(t), 400);
    return () => window.clearTimeout(id);
  }, [input]);

  useEffect(() => { void load(query, 1); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load(q: string, p: number) {
    ctrl.current?.abort();
    const c = new AbortController(); ctrl.current = c;
    setLoading(true); setError(null);
    try {
      // No search yet: show the museum's own highlights.
      const res = await searchArtworks(q ? { q } : { highlight: true }, p, 24, c.signal);
      setItems((prev) => (p === 1 ? res.data : [...prev, ...res.data.filter((a) => !prev.some((x) => x.id === a.id))]));
      setPage(p); setTotalPages(res.totalPages);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Couldn't reach the collection right now.");
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }

  return (
    <div>
      <div className="border-b border-slate-200/70 px-4 py-4 dark:border-white/[0.08] sm:px-6">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 transition focus-within:border-indigo-400 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] dark:border-white/10 dark:bg-white/[0.04]">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search 41,000+ works: artist, subject, place…" aria-label="Search the collection"
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-500" aria-hidden />}
          {input && <button type="button" onClick={() => setInput("")} aria-label="Clear search" className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="h-3.5 w-3.5" /></button>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Try</span>
          {SUGGESTED.map((s) => (
            <button key={s} type="button" onClick={() => setInput(s)}
              className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition ${query.toLowerCase() === s.toLowerCase() ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:text-slate-300"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <h3 className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {input.trim() ? `${items.length} works for “${input.trim()}”${page < totalPages ? " so far" : ""}` : "Highlights from the collection"}
        </h3>

        {error && <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-200">{error}</div>}
        {!loading && !error && items.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center font-mono text-xs text-slate-400 dark:border-white/10">Nothing in the collection matches that. Try another word.</p>}

        {/* Masonry via CSS columns */}
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
          {items.map((a, i) => (
            <motion.button
              key={a.id}
              type="button"
              onClick={() => onOpen(a)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i % 24, 12) * 0.03 }}
              className="group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-100 text-left outline-none transition hover:shadow-[0_16px_40px_-18px_rgba(15,23,42,0.5)] focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-white/[0.08] dark:bg-white/[0.04]"
              aria-label={`Open ${a.title}`}
            >
              <img src={a.image} alt={a.title} loading="lazy"
                className="block min-h-[120px] w-full transition-transform duration-500 group-hover:scale-[1.04]" />
              <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-10 opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                <p className="line-clamp-2 font-serif text-sm italic text-white">{a.title}</p>
                <p className="line-clamp-1 font-mono text-[10px] uppercase tracking-wider text-amber-300/90">{a.artistShort}{a.date ? ` · ${a.date}` : ""}</p>
              </div>
            </motion.button>
          ))}
        </div>

        {items.length > 0 && page < totalPages && (
          <div className="mt-6 flex justify-center">
            <button type="button" disabled={loading} onClick={() => load(query, page + 1)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.6)] transition hover:bg-indigo-600 disabled:opacity-50">
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Load more works
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
