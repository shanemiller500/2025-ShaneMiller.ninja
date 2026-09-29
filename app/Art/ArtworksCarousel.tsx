/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Info, Loader2, Pause, Play } from "lucide-react";
import { trackEvent } from "@/utils/mixpanel";
import { Segmented } from "@/components/ui/segmented";
import { type ArtQuery, type Artwork, searchArtworks } from "./lib";

// Curated rooms to wander through.
const ROOMS = [
  { key: "highlights", label: "Highlights", query: { highlight: true, type: "Painting" } },
  { key: "impressionism", label: "Impressionism", query: { q: "impressionism" } },
  { key: "van-gogh", label: "Van Gogh", query: { q: "van gogh" } },
  { key: "hokusai", label: "Japanese prints", query: { q: "hokusai" } },
  { key: "portrait", label: "Portraits", query: { q: "portrait", type: "Painting" } },
  { key: "landscape", label: "Landscapes", query: { q: "landscape", type: "Painting" } },
] as const satisfies readonly { key: string; label: string; query: ArtQuery }[];
type Room = (typeof ROOMS)[number]["key"];
const AUTOPLAY_MS = 8000;

export default function ArtworksCarousel({ onOpen }: { onOpen: (a: Artwork) => void }) {
  const [room, setRoom] = useState<Room>("highlights");
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovering, setHovering] = useState(false);
  const [error, setError] = useState(false);
  const thumbs = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setArtworks([]); setIndex(0); setError(false);
    searchArtworks(ROOMS.find((r) => r.key === room)!.query, 1, 20, ctrl.signal)
      .then(({ data }) => setArtworks(data))
      .catch((e) => { if ((e as Error).name !== "AbortError") setError(true); });
    trackEvent("Art Room Viewed", { room });
    return () => ctrl.abort();
  }, [room]);

  const next = useCallback(() => artworks.length && setIndex((i) => (i + 1) % artworks.length), [artworks.length]);
  const prev = useCallback(() => artworks.length && setIndex((i) => (i - 1 + artworks.length) % artworks.length), [artworks.length]);

  // Autoplay (paused while hovering)
  useEffect(() => {
    if (!playing || hovering || artworks.length < 2) return;
    const id = window.setInterval(next, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [playing, hovering, artworks.length, next]);

  // Arrow keys, unless a dialog or input has focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("[role=dialog]") || (e.target as HTMLElement)?.closest("input,textarea")) return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Keep the active thumbnail centred
  useEffect(() => {
    const strip = thumbs.current, thumb = strip?.children[index] as HTMLElement | undefined;
    if (strip && thumb) strip.scrollTo({ left: thumb.offsetLeft - strip.clientWidth / 2 + thumb.clientWidth / 2, behavior: "smooth" });
  }, [index]);

  const swipe = useSwipeable({ onSwipedLeft: next, onSwipedRight: prev, trackTouch: true });
  const art = artworks[index];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 overflow-x-auto no-scrollbar">
        <Segmented id="artRoom" ariaLabel="Gallery room" value={room} onChange={setRoom} options={ROOMS.map((r) => ({ key: r.key, label: r.label }))} className="w-max" />
      </div>

      {/* The gallery wall */}
      <div
        {...swipe}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className="relative h-[62vh] min-h-[420px] select-none overflow-hidden rounded-3xl border border-slate-200/70 bg-[radial-gradient(ellipse_at_top,#2a2724,#0e0d0c_70%)] dark:border-white/[0.08] sm:h-[70vh]"
      >
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top,rgba(255,236,200,0.2),transparent_70%)]" />

        {!art && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-white/60">
              {error ? "The gallery is closed right now. Try again soon." : <><Loader2 className="h-4 w-4 animate-spin" />Hanging the paintings…</>}
            </span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {art && (
            <motion.button
              key={art.id}
              type="button"
              onClick={() => onOpen(art)}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.45 }}
              className="absolute inset-0 flex items-center justify-center px-14 pb-32 pt-8 sm:px-20"
              aria-label={`Details for ${art.title}`}
            >
              <img
                src={art.image}
                alt={art.title}
                className="max-h-full w-auto max-w-full bg-[#1c1a17] object-contain shadow-[0_30px_60px_-15px_rgba(0,0,0,0.85)] ring-[10px] ring-[#1c1a17] outline outline-2 outline-[#b08d57]/60"
              />
            </motion.button>
          )}
        </AnimatePresence>

        {art && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-5 pb-5 pt-16 sm:px-8">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-wider text-amber-300/90">{[art.date, art.origin].filter(Boolean).join(" · ")}</p>
                <h2 className="mt-1 truncate font-serif text-xl italic text-white sm:text-2xl">{art.title}</h2>
                <p className="mt-0.5 line-clamp-1 text-sm text-white/70">{art.artistShort}</p>
              </div>
              <button type="button" onClick={() => onOpen(art)}
                className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20">
                <Info className="h-3.5 w-3.5" aria-hidden />Details
              </button>
            </div>
          </div>
        )}

        {artworks.length > 1 && <>
          {([["prev", prev, ChevronLeft, "left-3"], ["next", next, ChevronRight, "right-3"]] as const).map(([name, go, Icon, side]) => (
            <button key={name} type="button" onClick={go} aria-label={name === "prev" ? "Previous artwork" : "Next artwork"}
              className={`absolute top-1/2 ${side} -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/25`}>
              <Icon className="h-5 w-5" />
            </button>
          ))}
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <span className="rounded-full bg-black/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white/80 ring-1 ring-white/15 backdrop-blur">{index + 1} / {artworks.length}</span>
            <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause slideshow" : "Play slideshow"}
              className="rounded-full bg-white/10 p-2 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/25">
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          </div>
          {/* Autoplay progress */}
          {playing && !hovering && <motion.div key={`${index}-${room}`} className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-amber-400/80"
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: AUTOPLAY_MS / 1000, ease: "linear" }} />}
        </>}
      </div>

      {/* Thumbnails */}
      <div ref={thumbs} className="mt-4 flex gap-2.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {artworks.map((a, i) => (
          <button key={a.id} type="button" onClick={() => setIndex(i)} aria-label={`Show ${a.title}`}
            className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-xl transition sm:w-32 ${i === index ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1a1a1d]" : "opacity-55 hover:opacity-100"}`}>
            <img src={a.image} alt="" loading="lazy" className="h-full w-full bg-slate-200 object-cover dark:bg-white/[0.06]" />
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Swipe on mobile · arrow keys on desktop · click a painting for its story</p>
    </div>
  );
}
