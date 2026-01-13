// SportsNews.tsx
'use client'

export interface Article {
  title: string
  description: string
  url: string
  urlToImage: string | null
  publishedAt: string
  source: {
    id: string | null
    name: string
    image?: string | null
  }
  image: string | null
  sourceLogo: string | null
}

const LOGO_FALLBACK = '/images/wedding.jpg'

const safeDomain = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export async function fetchSportsNews(): Promise<Article[]> {
  const res = await fetch('https://u-mail.co/api/sportsNews', { cache: 'no-store' })
  if (!res.ok) throw new Error(`Sports News API error: ${res.status}`)

  const data = await res.json()
  const results: any[] = Array.isArray(data?.results) ? data.results : []

  return results.map((item) => {
    const url = String(item.link || '')
    const domain = safeDomain(url)
    const clearbit = domain ? `https://logo.clearbit.com/${domain}` : null

    const sourceLogo = item.sourceLogo ?? null
    const urlToImage = item.image ?? null

    return {
      title: item.title,
      description: item.description ?? '',
      url,
      urlToImage,
      publishedAt: item.publishedAt,
      source: {
        id: null,
        name: item.source ?? domain ?? 'Unknown',
        image: sourceLogo ?? clearbit ?? LOGO_FALLBACK,
      },
      image: urlToImage,
      sourceLogo: sourceLogo ?? clearbit,
    }
  })
}
