/**
 * wiki.ts — Marvel Database wiki (marvel.fandom.com) access shared by the
 * gallery and bio loaders: MediaWiki API helper + "which page is this
 * character?" resolver, cached per character so it runs once.
 *
 * The wiki names pages "<real name> (Earth-616)". We try the real name and hero
 * name, verify it's a genuine character article, then fall back to a search that
 * only accepts pages matching the character (by name or by a redirect such as
 * "Wolverine (Logan)" -> "James Howlett (Earth-616)").
 */

import { clean, type Hero } from "./roster";

const API = "https://marvel.fandom.com/api.php";
const WIKI = "https://marvel.fandom.com/wiki/";

export const wikiUrl = (title: string) => `${WIKI}${encodeURIComponent(title.replace(/ /g, "_"))}`;

export const api = async (params: Record<string, string>) => {
  const u = new URL(API);
  Object.entries({ format: "json", origin: "*", ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`Wiki request failed (${r.status})`);
  return r.json();
};

/** Wiki pages are "<name> (<reality>)"; most characters live on Earth-616, cosmic beings on Multiverse. */
const REALITIES = [" (Earth-616)", " (Multiverse)"];
const isCharacterPage = (t: string) => REALITIES.some((r) => t.endsWith(r));
/** "Peter Parker (Earth-616)" beats "James Howlett (Skrull) (Earth-616)" */
const isCleanTitle = (t: string) => /^[^()]+ \((Earth-616|Multiverse)\)$/.test(t);
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Name part of a page title: "Peter Parker (Earth-616)" -> "Peter Parker" */
const baseName = (t: string) => t.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*\([^)]*\)\s*$/, "");

/** Real character articles carry a "<year> Character Debuts" category; teams/programs/objects don't. */
async function isCharacterArticle(title: string): Promise<boolean> {
  const j = await api({ action: "query", titles: title, prop: "categories", cllimit: "max", clshow: "!hidden" });
  const page: any = Object.values(j.query?.pages ?? {})[0];
  return (page?.categories ?? []).some((c: any) => /Character Debuts$/.test(c.title));
}

/** Name before any parenthetical: "Wolverine (Logan)" -> "Wolverine" */
const leadName = (t: string) => t.split(" (")[0];

async function findPage(h: Hero): Promise<string | null> {
  // Only the real name and hero name — aliases are too ambiguous (Wolverine's include "Death" and "Weapon X")
  const names = [clean(h.biography.fullName), h.name].filter(Boolean).filter((n, i, a) => a.indexOf(n) === i);
  const known = new Set(names.map(norm));
  const titles = names.flatMap((n) => REALITIES.map((r) => `${n}${r}`));

  // 1) Direct hits: "<name> (Earth-616)" for each known name, following redirects
  const j = await api({ action: "query", titles: titles.join("|"), redirects: "1" });
  const forward = new Map<string, string>();
  for (const n of j.query?.normalized ?? []) forward.set(n.from, n.to);
  for (const r of j.query?.redirects ?? []) forward.set(r.from, r.to);
  const existing = new Set(
    Object.values<any>(j.query?.pages ?? {})
      .filter((p) => !("missing" in p))
      .map((p) => p.title as string)
  );
  const final = (t: string) => {
    let cur = t;
    for (let i = 0; i < 3 && forward.has(cur); i++) cur = forward.get(cur)!;
    return cur;
  };
  const direct = Array.from(new Set(titles.map(final).filter((t) => existing.has(t) && isCharacterPage(t))));
  // Respect priority (real name, then hero name) and skip non-character pages
  for (const t of direct.slice(0, 4)) {
    if (await isCharacterArticle(t).catch(() => false)) return t;
  }

  // 2) Search by hero name; accept a result only if its own name, or a redirect to it
  //    (e.g. "Wolverine (Logan)" -> "James Howlett (Earth-616)"), matches this character.
  const s = await api({ action: "query", list: "search", srsearch: h.name, srlimit: "15", srnamespace: "0" });
  const results: string[] = (s.query?.search ?? []).map((x: any) => x.title).filter(isCharacterPage).slice(0, 8);
  if (!results.length) return null;
  const rd = await api({ action: "query", titles: results.join("|"), prop: "redirects", rdlimit: "max" });
  const redirectsOf = new Map<string, string[]>();
  for (const p of Object.values<any>(rd.query?.pages ?? {})) redirectsOf.set(p.title, (p.redirects ?? []).map((r: any) => r.title));
  const heroKey = norm(h.name);
  const matches = (t: string) =>
    known.has(norm(baseName(t))) || (redirectsOf.get(t) ?? []).some((r) => norm(leadName(r)) === heroKey);
  // prefer the main reality and clean titles, keep search rank otherwise
  const ranked = results
    .filter(matches)
    .sort((x, y) => Number(isCleanTitle(y)) - Number(isCleanTitle(x)) || Number(y.endsWith(REALITIES[0])) - Number(x.endsWith(REALITIES[0])));
  for (const t of ranked.slice(0, 3)) {
    if (await isCharacterArticle(t).catch(() => false)) return t;
  }
  return null;
}

const pageCache = new Map<number, Promise<string | null>>();

/** Wiki article title for a character, or null when there's no reliable match. */
export function resolveWikiPage(h: Hero): Promise<string | null> {
  if (!pageCache.has(h.id)) {
    const p = findPage(h).catch((e) => {
      pageCache.delete(h.id);
      throw e;
    });
    pageCache.set(h.id, p);
  }
  return pageCache.get(h.id)!;
}
