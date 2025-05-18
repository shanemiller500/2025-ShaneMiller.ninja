// Filename: SportsTab.tsx
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { fetchSportsNews } from './sportsNews';

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                   */
/* ------------------------------------------------------------------ */

interface Article {
  source: { id: string | null; name: string };
  title: string;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
}

interface GameTeam {
  name: string;
  score: string;
  logo: string;
}

interface Game {
  id: string;
  league: string;
  date: string;
  status: string;          // e.g. “3rd Q”, “Top 7th”, “Final”
  competition: string;     // e.g. “Regular Season”
  homeTeam: GameTeam;
  awayTeam: GameTeam;
}

const LOGO_FALLBACK = '/images/wedding.jpg';

const isLive = (s: string) =>
  s.toLowerCase().includes('live') ||
  s.toLowerCase().includes('in progress') ||
  /[1-9](st|nd|rd|th)/i.test(s);

const isFinal = (s: string) =>
  s.toLowerCase().includes('final') ||
  s.toLowerCase().includes('finished') ||
  s.toLowerCase().includes('ft'); // “full-time” for soccer

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

/* ------------------------------------------------------------------ */
/*  Cache & constants                                                 */
/* ------------------------------------------------------------------ */

const CACHE_TTL = 30 * 60 * 1000;
const cachedNews: Record<string, { ts: number; data: Article[] }> = {};
const cachedGames: Record<string, { ts: number; data: Game[] }> = {};

const PER_PAGE = 36;
const CATEGORIES = [
  { key: 'all',    label: 'Latest World Sports' },
  { key: 'nba',    label: 'NBA' },
  { key: 'nfl',    label: 'NFL' },
  { key: 'mlb',    label: 'MLB' },
  { key: 'nhl',    label: 'NHL' },
  { key: 'soccer', label: 'Soccer' },
  { key: 'mma',    label: 'MMA' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function SportsTab() {
  /* ----- state ----- */
  const [subTab, setSubTab]     = useState('all');
  const [page, setPage]         = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [games, setGames]               = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError]     = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  /* ----- fetch news ----- */
  useEffect(() => {
    let cancel = false;
    setError(null);

    if (cachedNews[subTab] && Date.now() - cachedNews[subTab].ts < CACHE_TTL) {
      setArticles(cachedNews[subTab].data);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        let news: Article[] = [];
        if (subTab === 'all') {
          news = await fetchSportsNews();
        } else {
          const res = await fetch(
            `https://u-mail.co/api/sportsByCategory/${subTab}`,
            { cache: 'no-store' }
          );
          if (!res.ok) throw new Error(`API ${subTab} error: ${res.status}`);
          const json = await res.json();
          news = (json.results as any[]).map((item) => ({
            title: item.title,
            url: item.link,
            urlToImage: item.image ?? null,
            publishedAt: item.publishedAt,
            source: { id: null, name: item.source },
          }));
        }
        if (!cancel) {
          cachedNews[subTab] = { ts: Date.now(), data: news };
          setArticles(news);
          setPage(1);
        }
      } catch (e: any) {
        if (!cancel) setError(e.message ?? 'Unknown error');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [subTab]);

  /* ----- fetch games ----- */
  useEffect(() => {
    if (subTab === 'all') {
      setGames([]); return;
    }
    let cancel = false;
    setGamesError(null);

    const fetchGames = async () => {
      setGamesLoading(true);
      try {
        const url = `https://u-mail.co/api/sportsGames/${subTab}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Games API ${res.status}`);
        const json = await res.json();

        const raw = json.games ?? json.results ?? [];        // <— accept either field
        const arr: Game[] = raw.map((g: any) => ({
          ...g,
          league: g.league ?? subTab,
        }));

        if (!cancel) {
          cachedGames[subTab] = { ts: Date.now(), data: arr };
          setGames(arr);
        }
      } catch (e: any) {
        if (!cancel) setGamesError(e.message ?? 'Unknown error');
      } finally {
        if (!cancel) setGamesLoading(false);
      }
    };

    if (!(cachedGames[subTab] && Date.now() - cachedGames[subTab].ts < CACHE_TTL))
      fetchGames();
    else setGames(cachedGames[subTab].data);

    const iv = setInterval(fetchGames, 60_000);
    return () => { cancel = true; clearInterval(iv); };
  }, [subTab]);

  /* ------------------------------------------------------------------ */
  /*  Marquee logic (only if ≥3 games)                                  */
  /* ------------------------------------------------------------------ */

  const useMarquee = games.length >= 3;
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const x = useMotionValue(0);
  const [isDragging, setIsDragging] = useState(false);
  const speed = 20; // px / sec gentle crawl

  useEffect(() => {
    if (!useMarquee) return;
    const measure = () => {
      if (innerRef.current) setContentWidth(innerRef.current.offsetWidth);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [useMarquee, games]);

  useEffect(() => {
    if (!useMarquee || !contentWidth) return;
    let raf: number; let last: number | null = null;
    const step = (t: number) => {
      if (last == null) last = t;
      const dt = t - last; last = t;
      if (!isDragging && !selectedGame) {
        let next = x.get() - speed * (dt / 1000);
        if (next <= -contentWidth) next += contentWidth;
        if (next > 0) next -= contentWidth;
        x.set(next);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [useMarquee, contentWidth, isDragging, selectedGame]);

  /* ------------------------------------------------------------------ */
  /*  Paging helpers                                                    */
  /* ------------------------------------------------------------------ */

  const totalPages = Math.max(1, Math.ceil(articles.length / PER_PAGE));

  // deduplicate by URL before slicing
  const visibleNews = useMemo(() => {
    const uniq: Article[] = [];
    const seen = new Set<string>();
    for (const a of articles) {
      if (!seen.has(a.url)) {
        seen.add(a.url);
        uniq.push(a);
      }
    }
    return uniq.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  }, [articles, page]);

  /* ------------------------------------------------------------------ */
  /*  Render helpers                                                    */
  /* ------------------------------------------------------------------ */

  const GameBadge = ({ txt }: { txt: string }) => (
    <span className="rounded bg-gray-200 px-1 text-[9px] font-semibold
                     dark:bg-gray-700 dark:text-gray-300">
      {txt}
    </span>
  );

  const renderGameCard = (g: Game) => (
    <motion.div
      key={`${g.id}-${g.league}`}       // <— guard against duplicate IDs
      onClick={() => setSelectedGame(g)}
      className="relative m-1 min-w-[220px] cursor-pointer rounded border mt-3
                 bg-white p-2 text-xs shadow-sm transition hover:scale-[1.04]
                 dark:bg-brand-950"
      whileHover={{ scale: 1.06 }}
    >
      {isLive(g.status) && (
        <span className="absolute -top-2 -right-2 animate-pulse
                         rounded bg-red-600 px-2 py-[1px]
                         text-[10px] font-bold text-white">
          LIVE
        </span>
      )}
      {!isLive(g.status) && isFinal(g.status) && (
        <span className="absolute -top-2 -right-2
                         rounded bg-gray-700 px-2 py-[1px]
                         text-[10px] font-bold text-white">
          FINAL
        </span>
      )}

      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold">{g.league.toUpperCase()}</span>
        <span className="text-gray-500">
          {new Date(g.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="mb-1 flex items-center gap-1 truncate text-[10px] text-gray-500">
        {g.competition}
        {isLive(g.status) && <GameBadge txt={g.status} />}
      </div>

      {/* Away */}
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <img src={g.awayTeam.logo} className="h-5 w-5 object-contain" />
          <span className="font-medium">{g.awayTeam.name}</span>
        </div>
        <span className="text-base font-bold">{g.awayTeam.score}</span>
      </div>

      {/* Home */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <img src={g.homeTeam.logo} className="h-5 w-5 object-contain" />
          <span className="font-medium">{g.homeTeam.name}</span>
        </div>
        <span className="text-base font-bold">{g.homeTeam.score}</span>
      </div>
    </motion.div>
  );

  /* ------------------------------------------------------------------ */
  /*  JSX                                                               */
  /* ------------------------------------------------------------------ */

  return (
    <div className="pb-6">
      {/* ---- sub-tabs ---- */}
      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setSubTab(c.key)}
            className={`basis-1/2 sm:basis-auto flex-grow sm:flex-grow-0
              rounded px-2 py-1 text-xs sm:px-3 sm:text-sm
              ${
                subTab === c.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200'
              }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* ---- scoreboard ---- */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-medium">Today's Games</h2>
        {gamesLoading ? (
          <p className="text-sm">Loading games …</p>
        ) : gamesError ? (
          <p className="text-sm text-red-600">{gamesError}</p>
        ) : games.length === 0 ? (
          <p className="text-sm">No games today.</p>
        ) : useMarquee ? (
          <div className="relative overflow-hidden">
            <motion.div
              className="flex cursor-grab"
              style={{ x }}
              drag="x"
              onDragStart={() => setIsDragging(true)}
              onDragEnd={() => {
                setIsDragging(false);
                const mod = (n: number, m: number) => ((n % m) + m) % m;
                x.set(-mod(-x.get(), contentWidth));
              }}
            >
              <div className="flex" ref={innerRef}>
                {games.map(renderGameCard)}
              </div>
              <div className="flex">{games.map(renderGameCard)}</div>
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-wrap">{games.map(renderGameCard)}</div>
        )}
      </section>

      {/* ---- news masonry ---- */}
      {error && (
        <p className="mb-4 rounded bg-red-100 p-3 font-medium text-red-700">
          {error}
        </p>
      )}
      <section>
        <div className={`transition-opacity duration-300 ${loading && 'opacity-50'}`}>
          <div className="columns-1 gap-2 space-y-2 sm:columns-2 md:columns-3">
            {visibleNews.map((a, i) => {
              const hasImg = !!a.urlToImage;
              return (
                <a
                  key={`${a.url}-${i}`}         
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-inside-avoid block transform rounded-lg bg-white shadow transition hover:scale-[1.02] hover:shadow-xl dark:bg-brand-950"
                >
                  {hasImg && (
                    <img
                      src={a.urlToImage!}
                      alt={a.title}
                      className="h-40 w-full object-cover sm:h-36"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                  <div className={`p-4 ${hasImg ? 'mt-1' : ''}`}>
                    <div className="mb-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <img
                        src={`https://logo.clearbit.com/${getDomain(a.url)}`}
                        alt={a.source.name}
                        className="h-6 w-6 object-contain"
                        onError={(e) => (e.currentTarget.src = LOGO_FALLBACK)}
                      />
                      <span className="truncate max-w-[140px]">{a.source.name}</span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(a.publishedAt).toLocaleDateString()}
                    </span>
                    <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-gray-800 dark:text-gray-100">
                      {a.title}
                    </h3>
                  </div>
                </a>
              );
            })}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            loading={loading}
            onPrev={() => setPage(page - 1)}
            onNext={() => setPage(page + 1)}
          />
        </div>
      </section>

      {/* ---- game popup ---- */}
      {selectedGame && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setSelectedGame(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-lg bg-brand-900 p-4 text-white shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {selectedGame.awayTeam.name} @ {selectedGame.homeTeam.name}
              </h3>
              {isLive(selectedGame.status) && (
                <span className="animate-pulse rounded bg-red-600 px-2 py-[1px] text-[11px] font-bold">
                  LIVE
                </span>
              )}
              {!isLive(selectedGame.status) && isFinal(selectedGame.status) && (
                <span className="rounded bg-gray-700 px-2 py-[1px] text-[11px] font-bold">
                  FINAL
                </span>
              )}
            </div>

            <p className="mb-2 text-sm text-gray-400">
              {selectedGame.league.toUpperCase()} •{' '}
              {new Date(selectedGame.date).toLocaleString([], {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>

            {isLive(selectedGame.status) && (
              <p className="mb-4 text-sm font-semibold text-yellow-300">
                Current&nbsp;Play: {selectedGame.status}
              </p>
            )}

            <p className="mb-4 text-sm text-gray-400">{selectedGame.competition}</p>

            <div className="space-y-3">
              {[selectedGame.awayTeam, selectedGame.homeTeam].map((t, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={t.logo} className="h-6 w-6 object-contain" />
                    <span className="font-medium">{t.name}</span>
                  </div>
                  <span className="text-xl font-bold">{t.score}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedGame(null)}
              className="mt-6 w-full rounded bg-indigo-600 py-2"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pagination                                                         */
/* ------------------------------------------------------------------ */
function Pagination({
  page, totalPages, loading, onPrev, onNext,
}: {
  page: number; totalPages: number; loading: boolean;
  onPrev: () => void; onNext: () => void;
}) {
  return (
    <div className="mt-8 flex flex-col items-center gap-4 pb-8">
      <div className="flex gap-4">
        <button
          disabled={page === 1 || loading}
          onClick={onPrev}
          className="rounded bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-white disabled:opacity-40"
        >
          Previous
        </button>
        <button
          disabled={(page === totalPages && !loading) || loading}
          onClick={onNext}
          className="rounded bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-white disabled:opacity-40"
        >
          Next
        </button>
      </div>
      <span className="text-sm text-gray-700 dark:text-gray-300">
        Page {page} / {totalPages}
      </span>
      {loading && <p className="text-gray-500 dark:text-gray-400">Loading …</p>}
    </div>
  );
}
