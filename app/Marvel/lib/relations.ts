import type { Hero } from "./roster";
import { api, wikiUrl } from "./wiki";

export const relationName = (label: string) => label.replace(/\s*\([^)]*\)/g, "").trim();
const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Only use unambiguous roster names; a shared alias must not show the wrong face. */
export function relationRoster(heroes: Iterable<Hero>): Map<string, Hero> {
  const found = new Map<string, Hero>();
  const ambiguous = new Set<string>();
  for (const hero of Array.from(heroes)) {
    for (const name of [hero.name, hero.biography.fullName]) {
      const k = key(name);
      if (!k || ambiguous.has(k)) continue;
      if (found.has(k) && found.get(k)?.id !== hero.id) {
        found.delete(k);
        ambiguous.add(k);
      } else found.set(k, hero);
    }
  }
  return found;
}

export const rosterRelative = (label: string, roster: Map<string, Hero>) => roster.get(key(relationName(label)));

export interface RelationPortrait { src: string; href: string; page: string }
const portraitCache = new Map<string, Promise<RelationPortrait | null>>();

/** Try exact Marvel Database character pages when a relative is outside the roster. */
export function loadRelationPortrait(label: string): Promise<RelationPortrait | null> {
  const name = relationName(label);
  const k = key(name);
  if (!k || name.length < 3) return Promise.resolve(null);
  if (!portraitCache.has(k)) {
    const titles = [`${name} (Earth-616)`, `${name} (Multiverse)`];
    const request = api({ action: "query", titles: titles.join("|"), prop: "pageimages", piprop: "thumbnail", pithumbsize: "180", redirects: "1" })
      .then((data) => {
        const page = Object.values<{ title: string; thumbnail?: { source?: string } }>(data.query?.pages ?? {})
          .find((p) => titles.includes(p.title) && p.thumbnail?.source?.startsWith("https://"));
        return page ? { src: page.thumbnail!.source!, href: wikiUrl(page.title), page: page.title } : null;
      })
      .catch(() => null);
    portraitCache.set(k, request);
  }
  return portraitCache.get(k)!;
}

export async function loadLargeRelationPortrait(page: string): Promise<string | null> {
  const data = await api({ action: "query", titles: page, prop: "pageimages", piprop: "thumbnail", pithumbsize: "640" });
  const result = Object.values<{ thumbnail?: { source?: string } }>(data.query?.pages ?? {})[0];
  return result?.thumbnail?.source?.startsWith("https://") ? result.thumbnail.source : null;
}
