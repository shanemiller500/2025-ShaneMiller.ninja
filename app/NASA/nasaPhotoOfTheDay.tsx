/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Dice5, ExternalLink, Loader2, Maximize2, Telescope } from "lucide-react";

import { trackEvent } from "@/utils/mixpanel";
import { Modal } from "@/components/ui/modal";
import { IconBadge } from "@/components/ui/icon-badge";

const API_KEY = process.env.NEXT_PUBLIC_NASA_API_KEY || "DEMO_KEY";
const API = "https://api.nasa.gov/planetary/apod";
const FIRST_APOD = "1995-06-16";
const PAGE_DAYS = 12;

interface APOD {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  thumbnail_url?: string;
  media_type?: "image" | "video" | "other";
  copyright?: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const pretty = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" });
// Videos get their YouTube/Vimeo thumbnail (thumbs=true) so the grid never has holes.
const still = (a: APOD) => (a.media_type === "video" ? a.thumbnail_url || "" : a.url);

async function apod(params: Record<string, string>) {
  const res = await fetch(`${API}?${new URLSearchParams({ api_key: API_KEY, thumbs: "true", ...params })}`);
  if (!res.ok) throw new Error(`APOD ${res.status}`);
  return res.json();
}

export default function NasaPhotoOfTheDay() {
  const [hero, setHero] = useState<APOD | null>(null);
  const [heroLoading, setHeroLoading] = useState(true);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [pickDate, setPickDate] = useState("");

  const [gallery, setGallery] = useState<APOD[]>([]);
  const [oldest, setOldest] = useState<string | null>(null);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [viewer, setViewer] = useState<number | null>(null);

  const loadHero = useCallback(async (params: Record<string, string>) => {
    setHeroLoading(true); setHeroError(null); setExpanded(false);
    try {
      const data = await apod(params);
      setHero(Array.isArray(data) ? data[0] : data);
    } catch {
      setHeroError("NASA's picture server didn't answer. Try again in a moment.");
    } finally {
      setHeroLoading(false);
    }
  }, []);

  const loadGallery = useCallback(async (endDay: string) => {
    setGalleryLoading(true);
    try {
      const start = addDays(endDay, -(PAGE_DAYS - 1));
      const data: APOD[] = await apod({ start_date: start < FIRST_APOD ? FIRST_APOD : start, end_date: endDay });
      setGallery((prev) => [...prev, ...(Array.isArray(data) ? data.reverse() : [])]);
      setOldest(start);
    } catch { /* keep what we have */ } finally {
      setGalleryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHero({});
    void loadGallery(addDays(iso(new Date()), -1));
  }, [loadHero, loadGallery]);

  const current = viewer !== null ? gallery[viewer] : null;
  const step = (n: number) => setViewer((v) => (v === null ? v : (v + n + gallery.length) % gallery.length));

  return (
    <div className="p-4 sm:p-6">
      {/* Controls: time travel + random */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconBadge icon={Telescope} tone="indigo" size="lg" label="APOD" />
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">Astronomy Picture of the Day</h2>
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">A new corner of the universe every day since 1995</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.04]">
            <CalendarDays className="h-3.5 w-3.5 text-indigo-500" aria-hidden />
            <span className="sr-only">Pick a date</span>
            <input type="date" min={FIRST_APOD} max={iso(new Date())} value={pickDate}
              onChange={(e) => { setPickDate(e.target.value); if (e.target.value) { void loadHero({ date: e.target.value }); trackEvent("APOD Date Picked", { date: e.target.value }); } }}
              className="bg-transparent font-mono text-[11px] text-slate-700 outline-none dark:text-slate-200 dark:[color-scheme:dark]" />
          </label>
          <button type="button" onClick={() => { setPickDate(""); void loadHero({ count: "1" }); trackEvent("APOD Random"); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
            <Dice5 className="h-3.5 w-3.5 text-indigo-500" aria-hidden />Random day
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-[#05060d] shadow-[0_30px_80px_-30px_rgba(79,70,229,0.55)] dark:border-white/[0.08]">
        <div className="iss-stars relative grid min-h-[320px] place-items-center sm:min-h-[460px]">
          {heroLoading && <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-white/60"><Loader2 className="h-4 w-4 animate-spin" />Pointing the telescope…</span>}
          {!heroLoading && heroError && <span className="px-6 text-center font-mono text-[11px] uppercase tracking-wider text-rose-300">{heroError}</span>}
          {!heroLoading && hero && (hero.media_type === "video" ? (
            <div className="relative aspect-video w-full">
              <iframe src={hero.url} title={hero.title} className="absolute inset-0 h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          ) : (
            <motion.button key={hero.date} type="button" onClick={() => window.open(hero.hdurl || hero.url, "_blank", "noopener")}
              initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}
              className="group relative block w-full" aria-label="Open the full-resolution image">
              <img src={hero.url} alt={hero.title} referrerPolicy="no-referrer" className="max-h-[70vh] w-full object-contain" />
              <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-white opacity-0 ring-1 ring-white/20 backdrop-blur transition group-hover:opacity-100">
                <Maximize2 className="h-3 w-3" />HD
              </span>
            </motion.button>
          ))}
        </div>
        {hero && !heroLoading && (
          <div className="border-t border-white/10 bg-gradient-to-b from-slate-950 to-[#05060d] p-5 sm:p-7">
            <p className="font-mono text-[10px] uppercase tracking-wider text-indigo-300">{pretty(hero.date)}{hero.copyright ? ` · © ${hero.copyright.replace(/\s+/g, " ").trim()}` : ""}</p>
            <h3 className="mt-1.5 font-aspekta text-2xl font-[650] tracking-tight text-white sm:text-3xl">{hero.title}</h3>
            <p className={`mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-300 ${expanded ? "" : "line-clamp-4"}`}>{hero.explanation}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setExpanded((e) => !e)} className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10">
                {expanded ? "Show less" : "Read the full story"}
              </button>
              <a href={`https://apod.nasa.gov/apod/ap${hero.date.slice(2).replace(/-/g, "")}.html`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3 py-2 text-xs font-semibold text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.6)] transition hover:bg-indigo-600">
                On apod.nasa.gov <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Recent days */}
      <h3 className="mb-3 mt-8 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />Recent days
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {gallery.map((a, i) => (
          <motion.button key={a.date} type="button" onClick={() => { setViewer(i); trackEvent("APOD Gallery Opened", { date: a.date }); }}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i % PAGE_DAYS) * 0.03 }}
            className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-900 text-left outline-none transition hover:shadow-[0_16px_40px_-18px_rgba(79,70,229,0.6)] focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-white/[0.08]">
            {still(a) && <img src={still(a)} alt={a.title} loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
            <span className="absolute left-2.5 top-2.5 rounded-full bg-black/50 px-2 py-0.5 font-mono text-[10px] text-white ring-1 ring-white/15 backdrop-blur">{a.date}</span>
            {a.media_type === "video" && <span className="absolute right-2.5 top-2.5 rounded-full bg-rose-500 px-2 py-0.5 font-mono text-[10px] uppercase text-white">Video</span>}
            <p className="absolute inset-x-0 bottom-0 line-clamp-2 p-3 text-sm font-semibold leading-snug text-white">{a.title}</p>
          </motion.button>
        ))}
        {galleryLoading && Array.from({ length: 4 }, (_, i) => <div key={`s${i}`} className="aspect-square animate-pulse rounded-2xl bg-slate-100 dark:bg-white/[0.04]" />)}
      </div>
      {oldest && oldest > FIRST_APOD && (
        <div className="mt-6 flex justify-center">
          <button type="button" disabled={galleryLoading} onClick={() => loadGallery(addDays(oldest, -1))}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.6)] transition hover:bg-indigo-600 disabled:opacity-50">
            {galleryLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Go further back
          </button>
        </div>
      )}

      {/* Viewer */}
      <Modal open={!!current} onClose={() => setViewer(null)} labelledBy="apod-title" size="xl" accent="#818cf8">
        {current && (
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="iss-stars relative grid place-items-center bg-[#05060d]">
              {current.media_type === "video"
                ? <div className="relative aspect-video w-full"><iframe src={current.url} title={current.title} className="absolute inset-0 h-full w-full" allowFullScreen /></div>
                : <img src={current.url} alt={current.title} referrerPolicy="no-referrer" className="max-h-[65vh] w-full object-contain" />}
              {gallery.length > 1 && (["prev", "next"] as const).map((dir) => (
                <button key={dir} type="button" onClick={() => step(dir === "prev" ? -1 : 1)} aria-label={dir === "prev" ? "Previous day" : "Next day"}
                  className={`absolute top-1/2 -translate-y-1/2 ${dir === "prev" ? "left-3" : "right-3"} rounded-full bg-white/10 p-2.5 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/25`}>
                  {dir === "prev" ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </button>
              ))}
            </div>
            <div className="p-5 sm:p-7">
              <p className="font-mono text-[10px] uppercase tracking-wider text-indigo-500 dark:text-indigo-300">{pretty(current.date)}{current.copyright ? ` · © ${current.copyright.replace(/\s+/g, " ").trim()}` : ""}</p>
              <h2 id="apod-title" className="mt-1.5 font-aspekta text-2xl font-[650] tracking-tight text-slate-900 dark:text-white">{current.title}</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{current.explanation}</p>
              {current.media_type !== "video" && (
                <a href={current.hdurl || current.url} target="_blank" rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.6)] transition hover:bg-indigo-600">
                  Full resolution <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
