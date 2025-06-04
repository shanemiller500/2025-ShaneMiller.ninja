/* ------------------------------------------------------------------
   LiveScores – marquee ticker + rich pop-up
   • LIVE / FINAL pills
   • Live games bubble to the front
   • Sleek gradient badges + large team logos
------------------------------------------------------------------- */
'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue } from 'framer-motion'

/* ---------- types ---------- */
interface GameTeam {
  name: string
  score?: string
  points?: string
  logo?: string
}
interface Game {
  id: string
  league: string
  leagueDisplay?: string
  startTime: string
  status: string
  competition: string
  awayTeam: GameTeam
  homeTeam: GameTeam
  isFinal: boolean
  seriesText?: string
  recapLink?: string
  highlight?: string
  espnLink?: string
}

/* ---------- helpers ---------- */
const CORE_TABS = ['nba', 'nfl', 'mlb', 'nhl', 'soccer', 'mma']
const isLive = (s: string) => /live|in progress|[1-9](st|nd|rd|th)/i.test(s)
const todayET = () => {
  const fmt = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [m, d, y] = fmt.split('/')
  return `${y}${m}${d}` // 20250606
}
const CACHE_TTL = 30 * 60 * 1000
const cache: Record<string, { ts: number; data: Game[] }> = {}
const orderGames = (a: Game, b: Game) => {
  const liveA = isLive(a.status), liveB = isLive(b.status)
  if (liveA !== liveB) return liveA ? -1 : 1
  if (a.isFinal !== b.isFinal) return a.isFinal ? 1 : -1
  return 0
}

/* ---------- UI bits ---------- */
const Img = ({ src, alt, className }: { src?: string; alt: string; className: string }) =>
  src ? <img src={src} alt={alt} className={`${className} object-contain`} /> : <></>
const Badge = ({ text }: { text: string }) => (
  <span className="rounded bg-gradient-to-r from-indigo-600 to-purple-600 px-2 py-[1px] text-[10px] font-bold text-white">
    {text}
  </span>
)

/* ---------- component ---------- */
export default function LiveScores({ sport }: { sport: string }) {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sel, setSel] = useState<Game | null>(null)

  /* ---- fetch ---- */
  useEffect(() => {
    let cancelled = false
    const key = `${sport}-${todayET()}`
    const fetchData = async () => {
      setLoading(true); setError(null)
      try {
        if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) {
          setGames(cache[key].data); setLoading(false); return
        }
        const url =
          sport === 'all'
            ? 'https://u-mail.co/api/sportsGames/others'
            : `https://u-mail.co/api/sportsGames/${sport}?date=${todayET()}`
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) throw new Error(`API ${res.status}`)
        let list: Game[] = (await res.json()).games ?? []
        if (sport === 'all') list = list.filter(g => !CORE_TABS.includes(g.league))
        list.sort(orderGames)
        cache[key] = { ts: Date.now(), data: list }
        if (!cancelled) setGames(list)
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Error fetching games')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    const iv = setInterval(fetchData, 60000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [sport])

  /* ---- marquee motion ---- */
  const marquee = games.length >= 3
  const x = useMotionValue(0)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [wrapW, setWrapW] = useState(0)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!marquee) return
    const measure = () => wrapRef.current && setWrapW(wrapRef.current.offsetWidth)
    measure(); window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [marquee, games])

  useEffect(() => {
    if (!marquee || !wrapW) return
    let raf: number, last: number | null = null
    const loop = (t: number) => {
      if (last === null) last = t
      const dt = t - last; last = t
      if (!dragging && !sel) {
        let nx = x.get() - 35 * dt / 1000
        if (nx <= -wrapW) nx += wrapW
        if (nx > 0) nx -= wrapW
        x.set(nx)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [marquee, wrapW, dragging, sel])

  /* ---- card ---- */
  const Card = (g: Game) => {
    const live = isLive(g.status)
    const away = g.awayTeam.score ?? g.awayTeam.points ?? '—'
    const home = g.homeTeam.score ?? g.homeTeam.points ?? '—'
    return (
      <motion.div
        key={g.id}
        onClick={() => setSel(g)}
        whileHover={{ scale: 1.06 }}
        className="m-1 flex min-w-[240px] cursor-pointer flex-col items-center rounded-lg border bg-white p-3 shadow-sm transition dark:bg-brand-950"
      >
        <div className="mb-2 flex w-full items-center justify-between text-[10px]">
          <Badge text={g.leagueDisplay || g.league.toUpperCase()} />
          {live && <span className="animate-pulse rounded bg-red-600 px-2 py-[1px] font-bold text-white">LIVE</span>}
          {!live && g.isFinal && <span className="rounded bg-gray-500 px-2 py-[1px] font-bold text-white">FINAL</span>}
        </div>

        <div className="flex w-full items-center justify-between">
          <Img src={g.awayTeam.logo} alt={g.awayTeam.name} className="h-8 w-8" />
          <div className="flex-1 px-2 text-xs font-medium">{g.awayTeam.name}</div>
          <span className="text-lg font-bold">{away}</span>
        </div>

        <div className="my-1 h-[1px] w-full bg-gray-200 dark:bg-gray-700" />

        <div className="flex w-full items-center justify-between">
          <Img src={g.homeTeam.logo} alt={g.homeTeam.name} className="h-8 w-8" />
          <div className="flex-1 px-2 text-xs font-medium">{g.homeTeam.name}</div>
          <span className="text-lg font-bold">{home}</span>
        </div>

        <span className="mt-2 line-clamp-1 text-[10px] text-indigo-500">{g.status}</span>
      </motion.div>
    )
  }

  /* ---- pop-up ---- */
  const Pop = (g: Game) => (
    <div
      onClick={e => e.stopPropagation()}
      className="w-full max-w-sm rounded-lg bg-white p-6 text-brand-900 shadow-lg dark:bg-brand-900 dark:text-white"
    >
      <div className="mb-3 flex items-center justify-between">
        <Badge text={g.leagueDisplay || g.league.toUpperCase()} />
        {isLive(g.status) && <span className="animate-pulse rounded bg-red-600 px-2 py-[1px] text-[10px] font-bold text-white">LIVE</span>}
        {g.isFinal && <span className="rounded bg-gray-500 px-2 py-[1px] text-[10px] font-bold text-white">FINAL</span>}
      </div>

      <h3 className="mb-4 text-lg font-semibold">{g.competition}</h3>

      {[g.awayTeam, g.homeTeam].map((t, i) => (
        <div key={i} className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Img src={t.logo} alt={t.name} className="h-9 w-9" />
            <span className="font-medium">{t.name}</span>
          </div>
          <span className="text-2xl font-bold">{t.score ?? t.points ?? '—'}</span>
        </div>
      ))}

      {g.seriesText && <p className="mb-3 text-xs text-indigo-500">{g.seriesText}</p>}

      {g.recapLink && (
        <a href={g.recapLink} target="_blank" className="mb-2 block text-center text-xs text-indigo-600 underline">
          Recap / Box
        </a>
      )}
      {g.highlight && (
        <a href={g.highlight} target="_blank" className="mb-2 block text-center text-xs text-indigo-600 underline">
          Highlights
        </a>
      )}
      {g.espnLink && (
        <a href={g.espnLink} target="_blank" className="block text-center text-xs text-indigo-400 underline">
          View on ESPN ↗
        </a>
      )}

      <button
        onClick={() => setSel(null)}
        className="mt-5 w-full rounded bg-gradient-to-r from-indigo-600 to-purple-600 py-2 text-white"
      >
        Close
      </button>
    </div>
  )

  /* ---- render ---- */
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-semibold">{sport === 'all' ? 'Latest World Sports' : "Today's Games"}</h2>

      {loading && <p className="text-sm">Loading games …</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && games.length === 0 && <p className="text-sm">No games today.</p>}

      {games.length > 0 && (
        marquee ? (
          <div className="relative overflow-hidden">
            <motion.div
              style={{ x }}
              className="flex cursor-grab"
              drag="x"
              onDragStart={() => setDragging(true)}
              onDragEnd={() => { setDragging(false); const mod = (n: number, m: number) => ((n % m) + m) % m; x.set(-mod(-x.get(), wrapW)) }}
            >
              <div className="flex" ref={wrapRef}>{games.map(Card)}</div>
              <div className="flex">{games.map(Card)}</div>
            </motion.div>
          </div>
        ) : (
          <div className="flex flex-wrap">{games.map(Card)}</div>
        )
      )}

      {sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setSel(null)}>
          {Pop(sel)}
        </div>
      )}
    </section>
  )
}
