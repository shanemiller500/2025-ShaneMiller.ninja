/**
 * gallery.ts — extra images for a character from the Marvel Database wiki
 * (marvel.fandom.com, MediaWiki API, CORS-enabled via origin=*).
 *
 * The wiki names pages "<real name> (Earth-616)", so we try the character's
 * full name, hero name and aliases, then fall back to search. Images are
 * hot-linked from Fandom's CDN, which only serves them when no third-party
 * Referer is sent, so <img> tags must use referrerPolicy="no-referrer".
 */

import type { Hero } from "./roster";
import { api, resolveWikiPage, wikiUrl } from "./wiki";

const MAX_IMAGES = 30;

export interface GalleryImage {
  /** Wiki file title, e.g. "File:Amazing Spider-Man Vol 2 539 Textless.jpg" */
  id: string;
  thumb: string;
  full: string;
  width: number;
  height: number;
  caption: string;
  /** Wiki page for attribution / "open original" */
  source: string;
}

export interface Gallery {
  page: string | null;
  pageUrl: string | null;
  images: GalleryImage[];
}

const SKIP = /logo|icon|signature|symbol|flag|sketch|cropped|\.svg|\.gif/i;

const captionOf = (fileTitle: string) =>
  fileTitle
    .replace(/^File:/, "")
    .replace(/\.(jpe?g|png|webp)$/i, "")
    .replace(/_/g, " ")
    .trim();

async function imagesOn(title: string): Promise<GalleryImage[]> {
  const j = await api({
    action: "query",
    titles: title,
    generator: "images",
    gimlimit: "80",
    prop: "imageinfo",
    iiprop: "url|size|mime",
    iiurlwidth: "640",
  });
  return Object.values<any>(j.query?.pages ?? {})
    .map((p) => ({ p, ii: p.imageinfo?.[0] }))
    .filter(({ p, ii }) => ii && /image\/(jpe?g|png|webp)/.test(ii.mime) && ii.width >= 300 && ii.height >= 300 && !SKIP.test(p.title))
    .map(({ p, ii }) => ({
      id: p.title,
      thumb: ii.thumburl ?? ii.url,
      full: ii.url,
      width: ii.width,
      height: ii.height,
      caption: captionOf(p.title),
      source: ii.descriptionurl ?? wikiUrl(p.title),
    }));
}

/* ── Cache: one lookup per character per page load ───────────────────── */
const cache = new Map<number, Promise<Gallery>>();
const pageCache = new Map<string, Promise<Gallery>>();

export function loadGalleryForPage(page: string): Promise<Gallery> {
  if (!pageCache.has(page)) {
    const request = (async (): Promise<Gallery> => {
      const seen = new Set<string>();
      const images: GalleryImage[] = [];
      for (const title of [`${page}/Gallery`, page]) {
        const list = await imagesOn(title).catch(() => []);
        for (const image of list) {
          if (seen.has(image.id)) continue;
          seen.add(image.id);
          images.push(image);
        }
        if (images.length >= MAX_IMAGES) break;
      }
      return { page, pageUrl: wikiUrl(page), images: images.slice(0, MAX_IMAGES) };
    })().catch((error) => { pageCache.delete(page); throw error; });
    pageCache.set(page, request);
  }
  return pageCache.get(page)!;
}

export function loadGallery(h: Hero): Promise<Gallery> {
  if (!cache.has(h.id)) {
    const p = (async (): Promise<Gallery> => {
      const page = await resolveWikiPage(h);
      if (!page) return { page: null, pageUrl: null, images: [] };
      return loadGalleryForPage(page);
    })().catch((e) => {
      cache.delete(h.id);
      throw e;
    });
    cache.set(h.id, p);
  }
  return cache.get(h.id)!;
}
