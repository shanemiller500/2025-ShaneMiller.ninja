/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';
import { trackEvent } from '@/utils/mixpanel';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';

interface Artwork {
  id: number;
  title: string;
  artist_display: string;
  image_id: string | null;
  place_of_origin: string | null;
}

const FIELDS =
  'id,title,artist_display,image_id,place_of_origin';
const AUTO_MS = 6_000;
const BASE_W = 1000;

/* IIIF helper */
const iiif = (id: string | null, w = BASE_W) =>
  id ? `https://www.artic.edu/iiif/2/${id}/full/${w},/0/default.jpg` : '';

export default function ArtworksCarousel() {
  const [arts, setArts] = useState<Artwork[]>([]);
  const [idx, setIdx] = useState(0);
  const [auto, setAuto] = useState(true);
  const [imgSrc, setImgSrc] = useState('');

  const timer = useRef<NodeJS.Timeout | null>(null);
  const thumbs = useRef<HTMLDivElement | null>(null);

  /* -------- fetch once -------- */
  useEffect(() => {
    (async () => {
      const r = await fetch(
        `https://api.artic.edu/api/v1/artworks?page=1&limit=30&fields=${FIELDS}`
      );
      const j = await r.json();
      const list = j.data as Artwork[];
      setArts(list);
      if (list.length) setImgSrc(iiif(list[0].image_id)); // show first
    })().catch(console.error);
  }, []);

  /* -------- preload next -------- */
  useEffect(() => {
    if (!arts.length) return;
    const next = iiif(arts[idx].image_id);
    if (next === imgSrc) return;
    const img = new Image();
    img.src = next;
    img.onload = () => setImgSrc(next);
  }, [idx, arts, imgSrc]);

  /* -------- analytics -------- */
  useEffect(() => trackEvent('Carousel Viewed'), []);
  useEffect(() => {
    arts.length && trackEvent('Artwork Viewed', { id: arts[idx].id, idx });
  }, [idx, arts]);

  /* -------- autoplay -------- */
  const start = useCallback(() => {
    if (timer.current || !arts.length) return;
    timer.current = setInterval(
      () => setIdx(i => (i + 1) % arts.length),
      AUTO_MS
    );
  }, [arts.length]);
  const stop = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => {
    auto ? start() : stop();
    return stop;
  }, [auto, start]);

  /* -------- nav helpers -------- */
  const next = useCallback(
    () => setIdx(i => (i + 1) % arts.length),
    [arts.length]
  );
  const prev = useCallback(
    () => setIdx(i => (i ? i - 1 : arts.length - 1)),
    [arts.length]
  );

  /* keyboard */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [next, prev]);

  /* thumb autoscroll */
  useEffect(() => {
    const row   = thumbs.current;
    const thumb = row?.children[idx] as HTMLElement | undefined;
    if (!row || !thumb) return;

    // where should row.scrollLeft be so that thumb is centered?
    const offset =
      thumb.offsetLeft - (row.clientWidth / 2 - thumb.clientWidth / 2);

    row.scrollTo({ left: offset, behavior: 'smooth' });
  }, [idx]);

  /* swipe */
  const swipe = useSwipeable({
    onSwipedLeft: next,
    onSwipedRight: prev,
    trackTouch: true,
  });

  /* -------- loader / empty -------- */
  if (!arts.length || !imgSrc)
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="h-14 w-14 rounded-full border-4 border-stone-300 dark:border-neutral-600 border-t-transparent animate-spin" />
      </div>
    );

  const art = arts[idx];

  /* -------- UI -------- */
  return (
    <section
      className="w-full max-w-6xl px-4 select-none"
      onMouseEnter={stop}
      onMouseLeave={() => auto && start()}
      {...swipe}
    >
      {/* main frame */}
      <div className="relative mx-auto h-[70vh] w-full rounded-lg overflow-hidden bg-stone-100 dark:bg-neutral-800">
        <img
          src={imgSrc}
          alt={art.title}
          className="absolute inset-0 h-full w-full object-contain transition-opacity duration-300"
        />

        {/* caption */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[92%] sm:w-3/4 lg:w-1/2 bg-white/20 dark:bg-neutral-800/40  dark:border-neutral-700 rounded-md p-4 shadow-lg">
          <h2 className="text-lg font-semibold text-neutral-900 ">
            {art.title}
          </h2>
          <p className="text-sm text-neutral-900">
            {art.artist_display}
          </p>
          {art.place_of_origin && (
            <p className="text-xs mt-1 text-neutral-900">
              {art.place_of_origin}
            </p>
          )}
        </div>

        {/* arrows */}
        <button
          onClick={prev}
          aria-label="Prev"
          className="absolute top-1/2 left-3 -translate-y-1/2 bg-white/80 dark:bg-neutral-700/60 hover:bg-white dark:hover:bg-neutral-700 backdrop-blur p-2 rounded-full shadow"
        >
          <ChevronLeft className="h-5 w-5 text-neutral-800 dark:text-neutral-100" />
        </button>
        <button
          onClick={next}
          aria-label="Next"
          className="absolute top-1/2 right-3 -translate-y-1/2 bg-white/80 dark:bg-neutral-700/60 hover:bg-white dark:hover:bg-neutral-700 backdrop-blur p-2 rounded-full shadow"
        >
          <ChevronRight className="h-5 w-5 text-neutral-800 dark:text-neutral-100" />
        </button>

        {/* play / pause */}
        <button
          onClick={() => {
            setAuto(a => !a);
            stop();
          }}
          aria-label="Toggle autoplay"
          className="absolute bottom-4 right-4 bg-white/80 dark:bg-neutral-700/60 hover:bg-white dark:hover:bg-neutral-700 backdrop-blur p-2 rounded-full shadow"
        >
          {auto ? (
            <Pause className="h-5 w-5 text-neutral-800 dark:text-neutral-100" />
          ) : (
            <Play className="h-5 w-5 text-neutral-800 dark:text-neutral-100" />
          )}
        </button>
      </div>

      {/* thumbnails */}
      <div
        ref={thumbs}
        className="mt-6 flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-stone-300 dark:scrollbar-thumb-neutral-600"
      >
        {arts.map((a, i) => (
          <button
            key={a.id}
            onClick={() => setIdx(i)}
            className={`flex-shrink-0 border-2 rounded-md overflow-hidden ${
              i === idx
                ? 'border-stone-800 dark:border-yellow-400 shadow'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <img
              src={iiif(a.image_id, 200) || '/placeholder.svg'}
              alt={a.title}
              className="h-20 w-32 object-cover"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
