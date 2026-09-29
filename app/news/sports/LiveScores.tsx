/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, useMotionValue } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { SectionLabel, Notice } from "../components/NewsKit";

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
function StatusPill({ live, final }: { live: boolean; final: boolean }) {
  if (live)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/60 bg-rose-50 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
        </span>
        Live
      </span>
    );
  if (final)
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">Final</span>;
  return null;
}

function TeamRow({ team, label, score }: { team: GameTeam; label: string; score: string }) {
  return (
    <div className="flex items-center">
      <div className="flex flex-1 items-center gap-3 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/10 sm:h-14 sm:w-14">
          <SafeImg src={team.logo} alt={team.name} className="h-9 w-9 sm:h-10 sm:w-10" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
          <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{team.name}</p>
        </div>
      </div>
      <div className="w-16 self-stretch border-l border-slate-200/70 bg-slate-50 p-4 text-center dark:border-white/[0.08] dark:bg-white/[0.02] sm:w-20">
        <span className="font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-white sm:text-4xl">{score}</span>
      </div>
    </div>
  );
}

function GameModal({ game, onClose }: { game: Game | null; onClose: () => void }) {
  const live = !!game && (!!game.isLive || isLiveText(game.status));
  const time = game ? new Date(game.startTime) : null;
  const link = "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition";
  const secondary = `${link} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]`;

  return (
    <Modal open={!!game} onClose={onClose} labelledBy="game-title" accent={live ? "#f43f5e" : "#6366f1"} size="lg">
      {game && time && (
        <>
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-200/70 px-4 py-3 pr-14 dark:border-white/[0.08] sm:px-6 sm:py-4">
            <StatusPill live={live} final={game.isFinal} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{game.leagueDisplay || game.league.toUpperCase()}</p>
              <time className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {time.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} ·{" "}
                {time.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })}
              </time>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
            <h2 id="game-title" className="font-aspekta text-xl font-[650] leading-snug tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              {game.competition}
            </h2>
            {game.status && (
              <p className={`mb-5 mt-1 font-mono text-[11px] uppercase tracking-wider ${live ? "text-rose-600 dark:text-rose-300" : "text-slate-400 dark:text-slate-500"}`}>{game.status}</p>
            )}

            <div className="mb-4 divide-y divide-slate-200/70 overflow-hidden rounded-2xl border border-slate-200/70 bg-white dark:divide-white/[0.08] dark:border-white/[0.08] dark:bg-white/[0.02]">
              <TeamRow team={game.awayTeam} label="Away" score={game.awayTeam.score ?? game.awayTeam.points ?? "—"} />
              <TeamRow team={game.homeTeam} label="Home" score={game.homeTeam.score ?? game.homeTeam.points ?? "—"} />
            </div>

            {game.seriesText && (
              <div className="mb-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-indigo-500 dark:text-indigo-300">Series</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{game.seriesText}</p>
              </div>
            )}

            {(game.espnLink || game.recapLink || game.highlight) && (
              <div className="border-t border-slate-200/70 pt-4 dark:border-white/[0.08]">
                <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">More coverage</p>
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  {game.espnLink && (
                    <a href={game.espnLink} target="_blank" rel="noopener noreferrer" className={`${link} bg-indigo-500 text-white shadow-[0_0_18px_-4px_rgba(99,102,241,0.6)] hover:bg-indigo-600`}>
                      View on ESPN <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  )}
                  {game.recapLink && (
                    <a href={game.recapLink} target="_blank" rel="noopener noreferrer" className={secondary}>
                      Game recap <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  )}
                  {game.highlight && (
                    <a href={game.highlight} target="_blank" rel="noopener noreferrer" className={secondary}>
                      ▶ Highlights
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
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
          className="w-[240px] shrink-0 cursor-pointer select-none rounded-2xl border border-slate-200/70 bg-white p-3.5 outline-none transition hover:border-slate-300 hover:shadow-[0_12px_30px_-16px_rgba(15,23,42,0.35)] focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-white/15 sm:w-[260px]"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{g.leagueDisplay || g.league.toUpperCase()}</span>
            <StatusPill live={live} final={g.isFinal} />
          </div>
          {[{ team: g.awayTeam, score: away }, { team: g.homeTeam, score: home }].map(({ team, score }, i) => (
            <div key={i} className={`flex items-center justify-between gap-2 ${i ? "mt-2 border-t border-slate-100 pt-2 dark:border-white/[0.06]" : ""}`}>
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200 dark:bg-white/[0.04] dark:ring-white/10">
                  <SafeImg src={team.logo} alt={team.name} className="h-6 w-6" />
                </div>
                <span className="max-w-[110px] truncate text-sm font-medium text-slate-900 dark:text-white">{team.name}</span>
              </div>
              <span className="font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">{score}</span>
            </div>
          ))}
          <p className="mt-2.5 truncate border-t border-slate-100 pt-2.5 font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:border-white/[0.06] dark:text-slate-500">{g.status}</p>
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
    <section className="mb-6">
      <SectionLabel right="Updates every 60s">{title}</SectionLabel>
      {loading && <p className="py-2 font-mono text-[11px] uppercase tracking-wider text-slate-400">Loading games…</p>}
      {error && <Notice tone="error">{error}</Notice>}
      {!loading && !error && games.length === 0 && <Notice>{sport === "all" ? "No live games right now." : "No games today."}</Notice>}

      {games.length > 0 && (
        <div className="relative">
          <div
            ref={scrollRef}
            className={`no-scrollbar overflow-hidden overscroll-x-contain touch-pan-x pb-1 ${canScroll ? "[mask-image:linear-gradient(90deg,transparent,black_24px,black_calc(100%-48px),transparent)]" : ""}`}
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

        </div>
      )}

      <GameModal game={sel} onClose={() => setSel(null)} />
    </section>
  );
}
