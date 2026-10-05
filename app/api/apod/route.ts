import { NextResponse } from "next/server";

/* ------------------------------------------------------------------ */
/*  Astronomy Picture of the Day, read straight from NASA's pages.     */
/*                                                                     */
/*  APOD moved from apod.nasa.gov to science.nasa.gov/apod. NASA's own */
/*  api.nasa.gov/planetary/apod still scrapes the old pages, follows   */
/*  the redirect and returns the site's generic title + NASA logo for  */
/*  every date ("NASA Science"), and errors for today. The old         */
/*  apYYMMDD.html addresses still redirect to the right new page, so   */
/*  we read that page's metadata ourselves and return the same JSON    */
/*  shape the API used to.                                             */
/*                                                                     */
/*  GET /api/apod                         today (US Eastern date)      */
/*  GET /api/apod?date=YYYY-MM-DD         one day                      */
/*  GET /api/apod?start_date=…&end_date=… a range (max 14 days)        */
/*  GET /api/apod?count=N                 N random days (max 6)        */
/* ------------------------------------------------------------------ */

export const runtime = "nodejs";

const FIRST_DAY = "1995-06-16";
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE = 14;
const MAX_COUNT = 6;

export interface Apod {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  thumbnail_url?: string;
  media_type: "image" | "video";
  copyright?: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
/** APOD publishes on US Eastern time. */
const todayEastern = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const meta = (html: string, prop: string) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i"))?.[1] ??
  html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, "i"))?.[1];

/** Parse one APOD page from science.nasa.gov. Returns null if it isn't a real APOD page. */
function parse(html: string, date: string): Apod | null {
  const ogTitle = meta(html, "og:title");
  const ogImage = meta(html, "og:image");
  if (!ogTitle || !/^APOD:/i.test(decode(ogTitle))) return null;
  // "APOD: 2025 January 1 - Alpha Centauri: The Closest Star System - NASA Science"
  const title = decode(ogTitle)
    .replace(/\s+[-–]\s+NASA Science$/i, "")
    .replace(/^APOD:\s*\d{4}\s+\w+\s+\d{1,2}\s+[-–]\s+/i, "")
    .trim();

  const expl = html.match(/<p[^>]*>\s*(?:<[^>]+>\s*)*Explanation:?([\s\S]*?)<\/p>/i)?.[1];
  const explanation = expl ? decode(expl) : decode(meta(html, "og:description") ?? "");

  const creditCell = html.match(/>\s*Credit\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i)?.[1];
  const credit = creditCell ? decode(creditCell) : "";
  const copyright = /copyright/i.test(credit) ? credit.replace(/^.*?Copyright:?\s*/i, "").trim() : undefined;

  // videos are embedded from YouTube / Vimeo
  const embed = html.match(/<iframe[^>]+src="(https:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com\/embed|player\.vimeo\.com\/video)\/[^"]+)"/i)?.[1];
  const image = ogImage && !/nasa-logo/i.test(ogImage) ? decode(ogImage) : undefined;
  if (embed) {
    const yt = embed.match(/embed\/([\w-]{6,})/)?.[1];
    return {
      date,
      title,
      explanation,
      url: decode(embed),
      media_type: "video",
      thumbnail_url: yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : image,
      copyright,
    };
  }
  if (!image) return null;
  // the og:image is a 1280px rendition; the original lives at the same path without it
  const original = image.replace(/\/jcr:content\/renditions\/.*$/, "");
  return { date, title, explanation, url: image, hdurl: original !== image ? original : undefined, media_type: "image", copyright };
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** WordPress slugs look like "apod-2026-october-4-supernumerary-rainbows-…" */
const slugPrefix = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return `apod-${y}-${MONTHS[m - 1]}-${d}-`;
};
const cacheFor = (date: string) => (date >= addDays(todayEastern(), -1) ? 1800 : 86_400 * 7);

/**
 * Recent APODs have no redirect from the old address, so ask science.nasa.gov's
 * WordPress API which article belongs to which day (one call covers a range).
 */
async function articleLinks(from: string, to: string): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  const params = new URLSearchParams({
    after: `${addDays(from, -1)}T00:00:00`,
    before: `${addDays(to, 1)}T23:59:59`,
    search: "APOD",
    per_page: "50",
    _fields: "slug,link",
  });
  try {
    const res = await fetch(`https://science.nasa.gov/wp-json/wp/v2/image-article?${params}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: cacheFor(to) },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return links;
    const list = (await res.json()) as { slug?: string; link?: string }[];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const hit = list.find((a) => a.slug?.startsWith(slugPrefix(d)));
      if (hit?.link) links.set(d, hit.link);
    }
  } catch {
    /* fall through: no links */
  }
  return links;
}

async function fetchPage(url: string, date: string): Promise<Apod | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "shanemiller.ninja APOD viewer", Accept: "text/html" },
      redirect: "follow",
      // old days never change; today's page may still be getting published
      next: { revalidate: cacheFor(date) },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return parse(await res.text(), date);
  } catch {
    return null;
  }
}

/** One day: the old address (still redirects for older days), else look the article up. */
async function fetchDay(date: string, known?: string): Promise<Apod | null> {
  if (known) return fetchPage(known, date);
  const [y, m, d] = date.split("-");
  const legacy = await fetchPage(`https://apod.nasa.gov/apod/ap${y.slice(2)}${m}${d}.html`, date);
  if (legacy) return legacy;
  const link = (await articleLinks(date, date)).get(date);
  return link ? fetchPage(link, date) : null;
}

const json = (body: unknown, status = 200, maxAge = 1800) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=86400` } });

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const today = todayEastern();
  const valid = (d: string | null): d is string => !!d && DAY_RE.test(d) && d >= FIRST_DAY && d <= today;

  const count = q.get("count");
  if (count) {
    const n = Math.min(MAX_COUNT, Math.max(1, Number(count) || 1));
    const span = (Date.parse(today) - Date.parse(FIRST_DAY)) / 86_400_000;
    const out: Apod[] = [];
    // a few archive days are gaps or odd pages: draw extra and keep the good ones
    for (let tries = 0; out.length < n && tries < n + 4; tries++) {
      const day = addDays(FIRST_DAY, Math.floor(Math.random() * span));
      const a = await fetchDay(day);
      if (a && !out.some((o) => o.date === a.date)) out.push(a);
    }
    return out.length ? json(out, 200, 0) : json({ error: "NASA's APOD pages aren't answering." }, 502, 0);
  }

  const start = q.get("start_date");
  if (start) {
    const end = q.get("end_date") ?? today;
    if (!valid(start) || !valid(end) || start > end) return json({ error: "Bad date range." }, 400);
    const from = addDays(end, -(MAX_RANGE - 1)) > start ? addDays(end, -(MAX_RANGE - 1)) : start;
    const days: string[] = [];
    for (let d = from; d <= end; d = addDays(d, 1)) days.push(d);
    // one lookup finds the new-style pages for the whole range
    const links = await articleLinks(from, end);
    const found = (await Promise.all(days.map((d) => fetchDay(d, links.get(d))))).filter((a): a is Apod => !!a);
    return found.length ? json(found) : json({ error: "NASA's APOD pages aren't answering." }, 502);
  }

  const date = q.get("date") ?? today;
  if (!valid(date)) return json({ error: "Bad date." }, 400);
  const a = await fetchDay(date);
  // today's page may not be published yet: the client falls back to an earlier day
  return a ? json(a, 200, date === today ? 1800 : 86_400) : json({ error: `No APOD for ${date} yet.` }, 404, 300);
}
