/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, useMotionValue } from "framer-motion";
import { X, ExternalLink } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface GameTeam {
  name: string;
  score?: string;
  points?: string;
  logo?: string;
}

interface Game {
  id: string;
  league: string;
  leagueDisplay?: string;
  startTime: string;
  status: string;
  competition: string;
  awayTeam: GameTeam;
  homeTeam: GameTeam;
  isFinal: boolean;
  isLive?: boolean;
  seriesText?: string;
  recapLink?: string;
  highlight?: string;
  espnLink?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const CACHE_TTL = 15 * 1000;
const cache: Record<string, { ts: number; data: Game[] }> = {};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const isLiveText = (s: string) =>
  /live|in progress|halftime|half time|end of|quarter|period|overtime|\bot\b|q[1-4]\b|p[1-9]\b/i.test(
    s
  );

const todayET = () => {
  const fmt = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [m, d, y] = fmt.split("/");
  return `${y}${m}${d}`;
};

const orderGames = (a: Game, b: Game) => {
  const liveA = !!a.isLive || isLiveText(a.status);
  const liveB = !!b.isLive || isLiveText(b.status);
  if (liveA !== liveB) return liveA ? -1 : 1;
  if (a.isFinal !== b.isFinal) return a.isFinal ? 1 : -1;
  return +new Date(b.startTime) - +new Date(a.startTime);
};

/* ------------------------------------------------------------------ */
/*  SafeImg                                                            */
/* ------------------------------------------------------------------ */
function SafeImg({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className: string;
}) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={`${className} object-contain`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setOk(false)}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  GameModal                                                          */
/* ------------------------------------------------------------------ */
function GameModal({ game, onClose }: { game: Game; onClose: () => void }) {
  const live = !!game.isLive || isLiveText(game.status);
  const awayScore = game.awayTeam.score ?? game.awayTeam.points ?? "—";
  const homeScore = game.homeTeam.score ?? game.homeTeam.points ?? "—";

  const gameTime = new Date(game.startTime);
  const timeString = gameTime.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const dateString = gameTime.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-black/55 backdrop-blur-sm cursor-pointer"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col bg-white dark:bg-brand-900 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 min-w-0">
            {/* Live / Final badge */}
            {live ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-50 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900/40 px-2 py-0.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
                </span>
                <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wider">
                  Live
                </span>
              </span>
            ) : game.isFinal ? (
              <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-brand-900 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Final
              </span>
            ) : null}

            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {game.leagueDisplay || game.league.toUpperCase()}
              </p>
              <time className="text-xs text-gray-400 dark:text-gray-500">
                {dateString} · {timeString}
              </time>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain bg-gray-50 dark:bg-brand-900">
          <div className="p-4 sm:p-6">
            {/* Game title */}
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-50 leading-snug mb-1">
              {game.competition}
            </h2>
            {game.status && (
              <p
                className={`text-xs font-medium mb-5 ${
                  live
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {game.status}
              </p>
            )}

            {/* Scoreboard */}
            <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-brand-900 overflow-hidden shadow-sm mb-4">
              {/* Away team */}
              <div className="flex items-center border-b border-gray-100 dark:border-gray-800">
                <div className="flex-1 flex items-center gap-3 p-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-lg bg-gray-50 dark:bg-brand-900 border border-gray-100 dark:border-gray-700 flex-shrink-0">
                    <SafeImg
                      src={game.awayTeam.logo}
                      alt={game.awayTeam.name}
                      className="h-9 w-9 sm:h-10 sm:w-10"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mb-0.5">
                      Away
                    </p>
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {game.awayTeam.name}
                    </p>
                  </div>
                </div>
                <div className="w-16 sm:w-20 text-center p-4 bg-gray-50 dark:bg-brand-900/50 border-l border-gray-100 dark:border-gray-800">
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-50 tabular-nums">
                    {awayScore}
                  </span>
                </div>
              </div>

              {/* Home team */}
              <div className="flex items-center">
                <div className="flex-1 flex items-center gap-3 p-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-lg bg-gray-50 dark:bg-brand-900 border border-gray-100 dark:border-gray-700 flex-shrink-0">
                    <SafeImg
                      src={game.homeTeam.logo}
                      alt={game.homeTeam.name}
                      className="h-9 w-9 sm:h-10 sm:w-10"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium mb-0.5">
                      Home
                    </p>
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {game.homeTeam.name}
                    </p>
                  </div>
                </div>
                <div className="w-16 sm:w-20 text-center p-4 bg-gray-50 dark:bg-brand-900/50 border-l border-gray-100 dark:border-gray-800">
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-50 tabular-nums">
                    {homeScore}
                  </span>
                </div>
              </div>
            </div>

            {/* Series info */}
            {game.seriesText && (
              <div className="rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/40 p-3 mb-4">
                <p className="text-[10px] text-orange-500 dark:text-orange-400 font-medium uppercase tracking-wider mb-1">
                  Series
                </p>
                <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">
                  {game.seriesText}
                </p>
              </div>
            )}

            {/* Action links */}
            {(game.espnLink || game.recapLink || game.highlight) && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-3">
                  More Coverage
                </p>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  {game.espnLink && (
                    <a
                      href={game.espnLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
                    >
                      View on ESPN
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {game.recapLink && (
                    <a
                      href={game.recapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-brand-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Game Recap
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {game.highlight && (
                    <a
                      href={game.highlight}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-brand-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      ▶ Highlights
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LiveScores                                                         */
/* ------------------------------------------------------------------ */
export default function LiveScores({ sport }: { sport: string }) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Game | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState(false);

  const innerRef = useRef<HTMLDivElement | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const speed = 40; // px/sec

  const interactingRef = useRef(false);
  const modalOpenRef = useRef(false);
  useEffect(() => {
    modalOpenRef.current = !!sel;
  }, [sel]);

  /* Fetch data */
  useEffect(() => {
    let cancelled = false;
    const key = `${sport}-${todayET()}`;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) {
          if (!cancelled) setGames(cache[key].data);
          return;
        }
        const url =
          sport === "all"
            ? `https://u-mail.co/api/sportsGames/live?date=${todayET()}`
            : `https://u-mail.co/api/sportsGames/${sport}?date=${todayET()}`;

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Games API ${res.status}`);
        const json = await res.json();
        const list: Game[] = Array.isArray(json?.games) ? json.games : [];
        list.sort(orderGames);
        cache[key] = { ts: Date.now(), data: list };
        if (!cancelled) setGames(list);
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error)?.message || "Error fetching games");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    const iv = setInterval(fetchData, 60_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [sport]);

  /* Measure content width for marquee */
  useEffect(() => {
    const measure = () => {
      const el = innerRef.current;
      if (!el) return;
      setContentWidth(el.scrollWidth || el.offsetWidth || 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [games.length]);

  /* Measure overflow for fades */
  useEffect(() => {
    const outer = scrollRef.current;
    if (!outer) return;
    const measure = () => setCanScroll(outer.scrollWidth > outer.clientWidth + 8);
    measure();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(outer);
    }
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [games.length]);

  /* Interaction tracking */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const on = () => (interactingRef.current = true);
    const off = () => (interactingRef.current = false);
    el.addEventListener("pointerdown", on, { passive: true });
    el.addEventListener("pointerup", off, { passive: true });
    el.addEventListener("pointercancel", off, { passive: true });
    el.addEventListener("touchstart", on, { passive: true });
    el.addEventListener("touchend", off, { passive: true });
    el.addEventListener("wheel", on, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", on);
      el.removeEventListener("pointerup", off);
      el.removeEventListener("pointercancel", off);
      el.removeEventListener("touchstart", on);
      el.removeEventListener("touchend", off);
      el.removeEventListener("wheel", on);
    };
  }, []);

  /* Marquee auto-scroll */
  useEffect(() => {
    let raf = 0;
    let last: number | null = null;
    const step = (t: number) => {
      if (last === null) last = t;
      const delta = t - last;
      last = t;
      const idle =
        !isDragging && !interactingRef.current && !modalOpenRef.current;
      if (idle && contentWidth > 0 && games.length > 0) {
        const current = x.get();
        let next = current - speed * (delta / 1000);
        if (next <= -contentWidth) next += contentWidth;
        if (next > 0) next -= contentWidth;
        x.set(next);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isDragging, contentWidth, games.length, x]);

  const title = sport === "all" ? "Live Now" : "Today's Games";

  const cards = useMemo(() => {
    return games.map((g) => {
      const live = !!g.isLive || isLiveText(g.status);
      const away = g.awayTeam.score ?? g.awayTeam.points ?? "—";
      const home = g.homeTeam.score ?? g.homeTeam.points ?? "—";

      return (
        <motion.div
          key={`${g.league}-${g.id}`}
          role="button"
          tabIndex={0}
          onClick={() => setSel(g)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setSel(g);
          }}
          whileTap={{ scale: 0.97 }}
          className="snap-start w-[240px] sm:w-[260px] shrink-0 select-none rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-brand-900 p-3.5 hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200 cursor-pointer"
        >
          {/* League + Status */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {g.leagueDisplay || g.league.toUpperCase()}
            </span>
            {live ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 text-[9px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide border border-orange-100 dark:border-orange-900/30">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                Live
              </span>
            ) : g.isFinal ? (
              <span className="rounded-md bg-gray-100 dark:bg-brand-900 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Final
              </span>
            ) : null}
          </div>

          {/* Away team */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-gray-50 dark:bg-brand-900 border border-gray-100 dark:border-gray-700 flex items-center justify-center overflow-hidden">
                <SafeImg
                  src={g.awayTeam.logo}
                  alt={g.awayTeam.name}
                  className="h-6 w-6"
                />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[110px]">
                {g.awayTeam.name}
              </span>
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-gray-50 tabular-nums">
              {away}
            </span>
          </div>

          <div className="my-2 h-px bg-gray-100 dark:bg-brand-900" />

          {/* Home team */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 flex-shrink-0 rounded-lg bg-gray-50 dark:bg-brand-900 border border-gray-100 dark:border-gray-700 flex items-center justify-center overflow-hidden">
                <SafeImg
                  src={g.homeTeam.logo}
                  alt={g.homeTeam.name}
                  className="h-6 w-6"
                />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[110px]">
                {g.homeTeam.name}
              </span>
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-gray-50 tabular-nums">
              {home}
            </span>
          </div>

          {/* Status text */}
          <p className="mt-2.5 pt-2.5 border-t border-gray-50 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-500 truncate">
            {g.status}
          </p>
        </motion.div>
      );
    });
  }, [games]);

  const onDragEnd = useCallback(() => {
    setIsDragging(false);
    const mod = (n: number, m: number) => ((n % m) + m) % m;
    if (contentWidth > 0) x.set(-mod(-x.get(), contentWidth));
  }, [contentWidth, x]);

  return (
    <section className="mb-5 sm:mb-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-orange-500" />
          <h2 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            {title}
          </h2>
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          Updates every 60s
        </span>
      </div>

      {loading && (
        <p className="text-xs text-gray-400 dark:text-gray-500 py-2">
          Loading games…
        </p>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 p-3">
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {!loading && !error && games.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {sport === "all" ? "No live games right now." : "No games today."}
        </p>
      )}

      {games.length > 0 && (
        <div className="relative">
          <div
            ref={scrollRef}
            className="no-scrollbar overflow-hidden overscroll-x-contain touch-pan-x pb-1"
          >
            <motion.div
              className="flex w-max cursor-grab active:cursor-grabbing"
              style={{ x }}
              drag={canScroll ? "x" : false}
              dragElastic={0.02}
              dragMomentum={false}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={onDragEnd}
            >
              <div className="flex gap-2.5" ref={innerRef}>
                {cards}
              </div>
              <div className="flex gap-2.5">{cards}</div>
            </motion.div>
          </div>

          {canScroll && (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white dark:from-gray-900 to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white dark:from-gray-900 to-transparent" />
            </>
          )}
        </div>
      )}

      {sel && <GameModal game={sel} onClose={() => setSel(null)} />}
    </section>
  );
}
