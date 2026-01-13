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
  seriesText?: string;
  recapLink?: string;
  highlight?: string;
  espnLink?: string;
}

const CORE_TABS = ["nba", "nfl", "mlb", "nhl", "soccer", "mma"] as const;
const CACHE_TTL = 30 * 60 * 1000;
const cache: Record<string, { ts: number; data: Game[] }> = {};

const isLive = (s: string) => /live|in progress|[1-9](st|nd|rd|th)|q[1-4]/i.test(s);

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
  const liveA = isLive(a.status);
  const liveB = isLive(b.status);
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
      ? "bg-red-600 text-white animate-pulse"
      : kind === "final"
      ? "bg-gray-600 text-white"
      : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white";
  return <span className={`rounded px-2 py-[2px] text-[10px] font-bold ${cls}`}>{text}</span>;
};

export default function LiveScores({ sport }: { sport: string }) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<Game | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState(false);

  /* ------------------------------ */
  /* marquee motion (like example)  */
  /* ------------------------------ */
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const speed = 40; // px/sec (tune)

  /* is-mounted flag for safe async state updates */
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  /* Pause auto-scroll when user interacting or modal open (same concept as crypto) */
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

        const url =
          sport === "all"
            ? "https://u-mail.co/api/sportsGames/others"
            : `https://u-mail.co/api/sportsGames/${sport}?date=${todayET()}`;

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Games API ${res.status}`);

        let list: Game[] = (await res.json())?.games ?? [];
        if (sport === "all") list = list.filter((g) => !CORE_TABS.includes(g.league as any));

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
  /* marquee auto-scroll (crypto style) */
  /* - uses motion value x
  /* - pauses on drag, interaction, or modal open
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

        // wrap like your crypto widget
        if (next <= -contentWidth) next += contentWidth;
        if (next > 0) next -= contentWidth;

        x.set(next);
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isDragging, contentWidth, games.length, x]);

  const title = sport === "all" ? "Latest World Sports (Live)" : "Today's Games";

  const cards = useMemo(() => {
    return games.map((g) => {
      const live = isLive(g.status);
      const away = g.awayTeam.score ?? g.awayTeam.points ?? "—";
      const home = g.homeTeam.score ?? g.homeTeam.points ?? "—";

      return (
        <motion.div
          key={g.id}
          role="button"
          tabIndex={0}
          onClick={() => setSel(g)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setSel(g);
          }}
          whileTap={{ scale: 0.985 }}
          className="
            snap-start w-[260px] shrink-0 select-none
            rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm hover:shadow-md
            dark:border-white/10 dark:bg-brand-900
          "
        >
          <div className="mb-2 flex items-center justify-between">
            <Chip kind="league" text={g.leagueDisplay || g.league.toUpperCase()} />
            {live ? <Chip kind="live" text="LIVE" /> : g.isFinal ? <Chip kind="final" text="FINAL" /> : null}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Img src={g.awayTeam.logo} alt={g.awayTeam.name} className="h-8 w-8" />
              <div className="max-w-[150px] truncate text-xs font-semibold text-gray-900 dark:text-white">
                {g.awayTeam.name}
              </div>
            </div>
            <div className="text-lg font-extrabold text-gray-900 dark:text-white">{away}</div>
          </div>

          <div className="my-2 h-px w-full bg-gray-200 dark:bg-white/10" />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Img src={g.homeTeam.logo} alt={g.homeTeam.name} className="h-8 w-8" />
              <div className="max-w-[150px] truncate text-xs font-semibold text-gray-900 dark:text-white">
                {g.homeTeam.name}
              </div>
            </div>
            <div className="text-lg font-extrabold text-gray-900 dark:text-white">{home}</div>
          </div>

          <div className="mt-2 line-clamp-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">
            {g.status}
          </div>
        </motion.div>
      );
    });
  }, [games]);

  const onDragEnd = useCallback(() => {
    setIsDragging(false);

    // snap back to a clean loop boundary (same idea as crypto widget)
    const mod = (n: number, m: number) => ((n % m) + m) % m;
    if (contentWidth > 0) x.set(-mod(-x.get(), contentWidth));
  }, [contentWidth, x]);

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>

        </div>
        <div className="hidden text-xs font-semibold text-gray-500 dark:text-gray-400 sm:block">
          Updates every 60s
        </div>
      </div>

      {loading && <p className="text-sm text-gray-600 dark:text-gray-300">Loading games…</p>}
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      {!loading && !error && games.length === 0 && <p className="text-sm text-gray-600 dark:text-gray-300">No games today.</p>}

      {games.length > 0 && (
        <div className="relative">
          {/* wrapper keeps fades + allows touch scrolling when user wants */}
          <div
            ref={scrollRef}
            className="no-scrollbar overflow-hidden overscroll-x-contain touch-pan-x pb-2"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {/* marquee row (crypto-style) */}
            <motion.div
              className="flex w-max cursor-grab active:cursor-grabbing"
              style={{ x }}
              drag={canScroll ? "x" : false}
              dragElastic={0.02}
              dragMomentum={false}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={onDragEnd}
            >
              {/* innerRef is used to measure contentWidth */}
              <div className="flex" ref={innerRef}>
                <div className="flex w-max gap-3 px-0">{cards}</div>
              </div>

              {/* duplicate for seamless loop */}
              <div className="flex w-max gap-3 px-0">{cards}</div>
            </motion.div>
          </div>

          {canScroll && (
            <>
              <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent dark:from-brand-900" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent dark:from-brand-900" />
            </>
          )}
        </div>
      )}

      {sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSel(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-5 shadow-xl dark:bg-brand-900">
            <div className="mb-3 flex items-center justify-between">
              <Chip kind="league" text={sel.leagueDisplay || sel.league.toUpperCase()} />
              {isLive(sel.status) ? <Chip kind="live" text="LIVE" /> : sel.isFinal ? <Chip kind="final" text="FINAL" /> : null}
            </div>

            <h3 className="text-base font-bold text-gray-900 dark:text-white">{sel.competition}</h3>
            <p className="mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">{sel.status}</p>

            <div className="mt-5 space-y-3">
              {[sel.awayTeam, sel.homeTeam].map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-gray-50 p-3 dark:bg-white/5">
                  <div className="flex items-center gap-3">
                    <Img src={t.logo} alt={t.name} className="h-10 w-10" />
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">{t.name}</div>
                  </div>
                  <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{t.score ?? t.points ?? "—"}</div>
                </div>
              ))}
            </div>

            {sel.seriesText && <p className="mt-4 text-xs font-semibold text-gray-600 dark:text-gray-300">{sel.seriesText}</p>}

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {sel.recapLink && (
                <a
                  href={sel.recapLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-gray-900 px-3 py-2 text-center text-xs font-bold text-white hover:bg-gray-800 dark:bg-white/10 dark:hover:bg-white/15"
                >
                  Recap / Box
                </a>
              )}
              {sel.highlight && (
                <a
                  href={sel.highlight}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-indigo-600 px-3 py-2 text-center text-xs font-bold text-white hover:bg-indigo-500"
                >
                  Highlights
                </a>
              )}
              {sel.espnLink && (
                <a
                  href={sel.espnLink}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-purple-600 px-3 py-2 text-center text-xs font-bold text-white hover:bg-purple-500"
                >
                  ESPN ↗
                </a>
              )}
            </div>

            <button
              onClick={() => setSel(null)}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-2.5 text-sm font-bold text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
