/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, useMotionValue } from "framer-motion";

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
  isLive?: boolean; // ✅ new
  seriesText?: string;
  recapLink?: string;
  highlight?: string;
  espnLink?: string;
}

const CACHE_TTL = 15 * 1000; // ✅ live scoreboard = refreshy
const cache: Record<string, { ts: number; data: Game[] }> = {};

// A bit more inclusive than before (covers soccer halves, periods, OT, etc.)
const isLiveText = (s: string) =>
  /live|in progress|halftime|half time|end of|quarter|period|overtime|\bot\b|q[1-4]\b|p[1-9]\b/i.test(s);

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

/* ------------------------------ */
/* Safe image component (no crash)*/
/* ------------------------------ */
const Img = ({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className: string;
}) => {
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
};

const Chip = ({ kind, text }: { kind: "league" | "live" | "final"; text: string }) => {
  const cls =
    kind === "live"
      ? "border-2 border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
      : kind === "final"
      ? "border-2 border-neutral-500 dark:border-neutral-400 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
      : "border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] text-neutral-900 dark:text-neutral-100";
  return <span className={`px-2.5 py-1 text-[9px] uppercase tracking-[0.08em] font-bold ${cls}`}>{text}</span>;
};

/* ------------------------------ */
/* Game Detail Modal (ESPN-style) */
/* ------------------------------ */
function GameModal({ game, onClose }: { game: Game; onClose: () => void }) {
  const live = !!game.isLive || isLiveText(game.status);
  const awayScore = game.awayTeam.score ?? game.awayTeam.points ?? "—";
  const homeScore = game.homeTeam.score ?? game.homeTeam.points ?? "—";

  // Format game time
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

  // ESC key handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Disable body scroll when modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      {/* backdrop */}
      <div
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-black/90 cursor-pointer"
      />

      {/* panel - ESPN SCOREBOARD STYLE */}
      <div className="relative z-10 w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden border-2 sm:border-4 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b-2 border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100">
          <div className="flex items-center justify-between gap-2 sm:gap-4 p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-600 dark:bg-red-500 rounded-full shrink-0"></div>
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] font-black text-white dark:text-neutral-900">
                {game.leagueDisplay || game.league.toUpperCase()}
              </span>
              {live && (
                <span className="px-2 py-0.5 text-[8px] sm:text-[9px] uppercase tracking-wider font-black bg-red-600 text-white animate-pulse">
                  LIVE
                </span>
              )}
              {game.isFinal && !live && (
                <span className="px-2 py-0.5 text-[8px] sm:text-[9px] uppercase tracking-wider font-black bg-neutral-600 dark:bg-neutral-400 text-white dark:text-neutral-900">
                  FINAL
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs uppercase tracking-wider font-black text-white dark:text-neutral-900 hover:bg-white/20 dark:hover:bg-neutral-900/20 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Competition & Status Banner */}
          <div className="bg-neutral-100 dark:bg-neutral-900 border-b-2 border-neutral-900 dark:border-neutral-100 p-3 sm:p-4">
            <h2 className="text-sm sm:text-lg font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
              {game.competition}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] uppercase tracking-wider font-bold text-neutral-600 dark:text-neutral-400">
              <span>{dateString}</span>
              <span className="w-1 h-1 bg-neutral-400 rounded-full"></span>
              <span>{timeString}</span>
              {game.status && (
                <>
                  <span className="w-1 h-1 bg-neutral-400 rounded-full"></span>
                  <span className={live ? "text-red-600 dark:text-red-400" : ""}>{game.status}</span>
                </>
              )}
            </div>
          </div>

          {/* Scoreboard - ESPN STYLE */}
          <div className="p-3 sm:p-6">
            {/* Team Rows */}
            <div className="border-2 border-neutral-900 dark:border-neutral-100 overflow-hidden">
              {/* Away Team */}
              <div className="flex items-center bg-white dark:bg-[#1D1D20] border-b-2 border-neutral-900 dark:border-neutral-100">
                <div className="flex-1 flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-600">
                    <Img src={game.awayTeam.logo} alt={game.awayTeam.name} className="h-8 w-8 sm:h-12 sm:w-12" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold text-neutral-500 dark:text-neutral-400">Away</div>
                    <div className="text-sm sm:text-lg font-black text-neutral-900 dark:text-neutral-100 truncate">{game.awayTeam.name}</div>
                  </div>
                </div>
                <div className="w-20 sm:w-28 text-center p-3 sm:p-4 bg-neutral-100 dark:bg-neutral-900 border-l-2 border-neutral-900 dark:border-neutral-100">
                  <div className="text-2xl sm:text-4xl font-black text-neutral-900 dark:text-neutral-100 tabular-nums">{awayScore}</div>
                </div>
              </div>

              {/* Home Team */}
              <div className="flex items-center bg-white dark:bg-[#1D1D20]">
                <div className="flex-1 flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-600">
                    <Img src={game.homeTeam.logo} alt={game.homeTeam.name} className="h-8 w-8 sm:h-12 sm:w-12" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] sm:text-[10px] uppercase tracking-wider font-bold text-neutral-500 dark:text-neutral-400">Home</div>
                    <div className="text-sm sm:text-lg font-black text-neutral-900 dark:text-neutral-100 truncate">{game.homeTeam.name}</div>
                  </div>
                </div>
                <div className="w-20 sm:w-28 text-center p-3 sm:p-4 bg-neutral-100 dark:bg-neutral-900 border-l-2 border-neutral-900 dark:border-neutral-100">
                  <div className="text-2xl sm:text-4xl font-black text-neutral-900 dark:text-neutral-100 tabular-nums">{homeScore}</div>
                </div>
              </div>
            </div>

            {/* Series Text */}
            {game.seriesText && (
              <div className="mt-4 p-3 sm:p-4 border-2 border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 bg-red-600 dark:bg-red-400 rounded-full"></div>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-black text-neutral-500 dark:text-neutral-400">Series</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-neutral-800 dark:text-neutral-200">{game.seriesText}</p>
              </div>
            )}

            {/* Action Links - ESPN STYLE */}
            <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {game.espnLink && (
                <a
                  href={game.espnLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border-2 border-neutral-900 dark:border-neutral-100 bg-red-600 dark:bg-red-500 px-4 py-3 text-[10px] sm:text-xs uppercase tracking-widest font-black text-white hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
                >
                  <span>View on ESPN</span>
                  <span>→</span>
                </a>
              )}

              {game.recapLink && (
                <a
                  href={game.recapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border-2 border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 px-4 py-3 text-[10px] sm:text-xs uppercase tracking-widest font-black text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                >
                  <span>Game Recap</span>
                  <span>→</span>
                </a>
              )}

              {game.highlight && (
                <a
                  href={game.highlight}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] px-4 py-3 text-[10px] sm:text-xs uppercase tracking-widest font-black text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <span>▶ Highlights</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t-2 border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-900 p-3 sm:p-4">
          <button
            onClick={onClose}
            className="w-full border-2 border-neutral-900 dark:border-neutral-100 bg-white dark:bg-[#1D1D20] py-2.5 sm:py-3 text-[10px] sm:text-xs uppercase tracking-widest font-black text-neutral-900 dark:text-neutral-100 hover:bg-neutral-900 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LiveScores({ sport }: { sport: string }) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Game | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState(false);

  /* marquee motion */
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

  /* ------------------------------ */
  /* fetch                          */
  /* ------------------------------ */
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

        // ✅ NEW:
        // - "all" => live across ALL leagues
        // - specific => that league for today
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
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Error fetching games");
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

  /* ------------------------------ */
  /* measure width (marquee)        */
  /* ------------------------------ */
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

  /* ------------------------------ */
  /* measure overflow (for fades)   */
  /* ------------------------------ */
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

  /* ------------------------------ */
  /* pointer/touch/wheel tracking   */
  /* ------------------------------ */
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

  /* ------------------------------ */
  /* marquee auto-scroll            */
  /* ------------------------------ */
  useEffect(() => {
    let raf = 0;
    let last: number | null = null;

    const step = (t: number) => {
      if (last === null) last = t;
      const delta = t - last;
      last = t;

      const idle = !isDragging && !interactingRef.current && !modalOpenRef.current;

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

  const title = sport === "all" ? "Live Now (All Sports)" : "Today's Games";

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
          whileTap={{ scale: 0.985 }}
          className="
            snap-start w-[280px] shrink-0 select-none
            border-2 border-neutral-900 dark:border-neutral-100 bg-white p-4 text-left shadow-lg hover:shadow-xl
            dark:bg-[#1D1D20] transition-shadow
          "
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-red-600 dark:bg-red-400 rounded-full"></div>
              <Chip kind="league" text={g.leagueDisplay || g.league.toUpperCase()} />
            </div>
            {live ? <Chip kind="live" text="LIVE" /> : g.isFinal ? <Chip kind="final" text="FINAL" /> : null}
          </div>

          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Img src={g.awayTeam.logo} alt={g.awayTeam.name} className="h-9 w-9 shrink-0" />
              <div className="truncate text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {g.awayTeam.name}
              </div>
            </div>
            <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tabular-nums shrink-0">{away}</div>
          </div>

          <div className="my-3 h-[2px] w-full bg-neutral-200 dark:bg-neutral-700" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Img src={g.homeTeam.logo} alt={g.homeTeam.name} className="h-9 w-9 shrink-0" />
              <div className="truncate text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {g.homeTeam.name}
              </div>
            </div>
            <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 tabular-nums shrink-0">{home}</div>
          </div>

          <div className="mt-3 pt-3 border-t-2 border-neutral-200 dark:border-neutral-700">
            <div className="line-clamp-1 text-[10px] uppercase tracking-[0.08em] font-bold text-neutral-600 dark:text-neutral-400">
              {g.status}
            </div>
          </div>
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
    <section className="mt-6">
      <div className="mb-4 flex items-center justify-between gap-3 pb-3 border-b-2 border-neutral-900 dark:border-neutral-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></div>
          <h2 className="text-base font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">{title}</h2>
        </div>
        <div className="hidden text-[9px] uppercase tracking-[0.08em] font-bold text-neutral-600 dark:text-neutral-400 sm:block">
          Updates every 60s
        </div>
      </div>

      {loading && <p className="text-sm font-bold text-neutral-600 dark:text-neutral-400">Loading games…</p>}
      {error && <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 border-2 border-neutral-900 dark:border-neutral-100 bg-neutral-100 dark:bg-neutral-900 p-3">{error}</p>}

      {!loading && !error && games.length === 0 && (
        <p className="text-sm font-bold text-neutral-600 dark:text-neutral-400">
          {sport === "all" ? "No live games right now." : "No games today."}
        </p>
      )}

      {games.length > 0 && (
        <div className="relative">
          <div
            ref={scrollRef}
            className="no-scrollbar overflow-hidden overscroll-x-contain touch-pan-x pb-2"
            style={{ WebkitOverflowScrolling: "touch" }}
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
              <div className="flex" ref={innerRef}>
                <div className="flex w-max gap-3 px-0">{cards}</div>
              </div>
              <div className="flex w-max gap-3 px-0">{cards}</div>
            </motion.div>
          </div>

          {canScroll && (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent dark:from-[#1D1D20]" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent dark:from-[#1D1D20]" />
            </>
          )}
        </div>
      )}

      {sel && <GameModal game={sel} onClose={() => setSel(null)} />}
    </section>
  );
}
