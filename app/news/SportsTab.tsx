/* eslint-disable @next/next/no-img-element */
'use client'

import { useState, useEffect, useMemo } from 'react'
import { fetchSportsNews } from './sportsNews'
import LiveScores from './LiveScores'

interface Article {
  source: { id: string | null; name: string }
  title: string
  url: string
  urlToImage: string | null
  publishedAt: string
}

const LOGO_FALLBACK = '/images/wedding.jpg'
const CACHE_TTL = 30 * 60 * 1000
const PER_PAGE = 36

const CATEGORIES = [
  { key: 'all',    label: 'Latest World Sports' },
  { key: 'nba',    label: 'NBA'  },
  { key: 'nfl',    label: 'NFL'  },
  { key: 'mlb',    label: 'MLB'  },
  { key: 'nhl',    label: 'NHL'  },
  { key: 'soccer', label: 'Soccer' },
  { key: 'mma',    label: 'MMA'  },
]

const cached: Record<string, { ts: number; data: Article[] }> = {}

const getDomain = (u: string) => { try { return new URL(u).hostname.replace(/^www\./,'') } catch { return '' } }

const SportsTab = () => {
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setError(null)

    if (cached[tab] && Date.now() - cached[tab].ts < CACHE_TTL) {
      setArticles(cached[tab].data)
      return
    }

    setLoading(true)
    ;(async () => {
      try {
        let news: Article[] = []
        if (tab === 'all') {
          news = await fetchSportsNews()
        } else {
          const r = await fetch(`https://u-mail.co/api/sportsByCategory/${tab}`, { cache: 'no-store' })
          if (!r.ok) throw new Error(`${r.status}`)
          const j = await r.json()
          news = j.results.map((it: any) => ({
            title: it.title,
            url: it.link,
            urlToImage: it.image ?? null,
            publishedAt: it.publishedAt,
            source: { id: null, name: it.source },
          }))
        }
        if (!cancel) {
          cached[tab] = { ts: Date.now(), data: news }
          setArticles(news)
          setPage(1)
        }
      } catch (e: any) {
        if (!cancel) setError(e.message ?? 'Unknown error')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [tab])

  const uniq = useMemo(() => {
    const map = new Map<string, Article>()
    articles.forEach(a => { if (!map.has(a.url)) map.set(a.url, a) })
    return Array.from(map.values())
  }, [articles])

  const topStrip = useMemo(() => uniq.filter(a => a.urlToImage).slice(0, 4), [uniq])
  const rest = useMemo(() => uniq.filter(a => !topStrip.includes(a)), [uniq, topStrip])

  const totalPages = Math.max(1, Math.ceil(rest.length / PER_PAGE))
  const pageNews = rest.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="pb-8">
      <select value={tab} onChange={e => setTab(e.target.value)} className="block w-full rounded bg-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none dark:bg-gray-700 dark:text-gray-100 sm:hidden">
        {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>

      <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setTab(c.key)} className={`rounded px-3 py-1 text-sm ${tab === c.key ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200'}`}>
            {c.label}
          </button>
        ))}
      </div>

      <LiveScores sport={tab} />

      {error && <p className="mb-4 rounded bg-red-100 p-3 font-medium text-red-700">{error}</p>}

      {topStrip.length > 0 && (
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {topStrip.map((a, i) => {
            const logo = `https://logo.clearbit.com/${getDomain(a.url)}`
            return (
              <a key={`${a.url}-${i}`} href={a.url} target="_blank" rel="noopener noreferrer" className="relative block h-40 overflow-hidden rounded-lg shadow hover:shadow-lg">
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${a.urlToImage}')` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/0" />
                <div className="absolute inset-x-0 bottom-0 z-10 p-3 text-white">
                  <h3 className="line-clamp-2 text-sm font-semibold">{a.title}</h3>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <img src={logo} onError={e => ((e.currentTarget.src = LOGO_FALLBACK))} alt={a.source.name} className="h-4 w-4 object-contain" />
                    <span className="truncate max-w-[90px]">{a.source.name}</span>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      )}

      <section className={`transition-opacity duration-300 ${loading ? 'opacity-50' : ''}`}>
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {pageNews.map((a, i) => {
            const img = a.urlToImage
            const logo = `https://logo.clearbit.com/${getDomain(a.url)}`
            return (
              <a key={`${a.url}-${i}`} href={a.url} target="_blank" rel="noopener noreferrer" className="mb-4 inline-block w-full break-inside-avoid overflow-hidden rounded-lg shadow hover:shadow-lg bg-white dark:bg-brand-950 transition">
                {img ? (
                  <div className="relative h-48 w-full bg-cover bg-center" style={{ backgroundImage: `url('${img}')` }}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/0" />
                    <div className="absolute bottom-0 z-10 flex flex-col gap-2 p-4 text-white">
                      <h3 className="line-clamp-3 text-sm font-semibold leading-snug">{a.title}</h3>
                      <div className="flex items-center gap-2 text-xs">
                        <img src={logo} onError={e => ((e.currentTarget.src = LOGO_FALLBACK))} alt={a.source.name} className="h-4 w-4 object-contain" />
                        <span className="truncate max-w-[100px]">{a.source.name}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <h3 className="line-clamp-3 text-base font-semibold leading-snug text-gray-800 dark:text-gray-100">{a.title}</h3>
                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <img src={logo} onError={e => ((e.currentTarget.src = LOGO_FALLBACK))} alt={a.source.name} className="h-6 w-6 object-contain" />
                      <span>{a.source.name}</span>
                    </div>
                  </div>
                )}
              </a>
            )
          })}
        </div>

        <Pagination page={page} totalPages={totalPages} loading={loading} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
      </section>
    </div>
  )
}

const Pagination = ({ page, totalPages, loading, onPrev, onNext }: { page: number; totalPages: number; loading: boolean; onPrev: () => void; onNext: () => void }) => (
  <div className="mt-10 flex flex-col items-center gap-6 pb-10">
    <div className="flex gap-6">
      <button disabled={page === 1 || loading} onClick={onPrev} className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2 text-white disabled:opacity-40">Previous</button>
      <button disabled={(page === totalPages && !loading) || loading} onClick={onNext} className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2 text-white disabled:opacity-40">Next</button>
    </div>
    <span className="text-sm text-gray-700 dark:text-gray-300">Page {page} / {totalPages}</span>
    {loading && <p className="animate-pulse text-gray-500 dark:text-gray-400">Loading…</p>}
  </div>
)

export default SportsTab
