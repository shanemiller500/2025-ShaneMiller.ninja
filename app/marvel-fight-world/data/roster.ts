/* ------------------------------------------------------------------ */
/*  Character roster — the free Superhero API dataset (akabab)          */
/*                                                                      */
/*  Same source as the Marvel Lab project: one static JSON file served  */
/*  from jsDelivr. It is fetched once per page load, kept in memory and */
/*  mirrored to sessionStorage so navigating back is instant.            */
/*  If the CDN is unreachable, a small built-in roster keeps the game   */
/*  playable.                                                            */
/* ------------------------------------------------------------------ */

import { buildFighter, type HeroLike } from "../engine/fighters";
import { SIGNATURE_NAMES } from "../engine/moves";
import type { FighterDef, Stats } from "../engine/types";
import { STAT_KEYS } from "../engine/types";

export const DATA_URL = "https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json";
const IMG = "https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/images";
const SESSION_KEY = "mfw:roster:v1";

/** Full dataset row (only the fields we use are typed). */
export interface Hero extends HeroLike {
  slug: string;
  total: number;
  appearance: { gender: string; race: string | null; height: string[]; weight: string[]; eyeColor: string; hairColor: string };
  biography: {
    fullName: string;
    alterEgos: string;
    aliases: string[];
    placeOfBirth: string;
    firstAppearance: string;
    publisher: string | null;
    alignment: string;
  };
  work: { occupation: string; base: string };
  connections: { groupAffiliation: string; relatives: string };
}

/**
 * The dataset files a few famous Marvel characters under an alternate-form
 * "publisher" (e.g. Thor → "Rune King Thor"). They are still Marvel, so they
 * are allow-listed by name + real name.
 */
const MARVEL_EXTRAS: Record<string, string> = {
  Thor: "Thor Odinson",
  Deadpool: "Wade Wilson",
  Venom: "Eddie Brock",
};

function isMarvel(h: { name: string; biography?: { publisher?: string | null; fullName?: string } }) {
  if (h?.biography?.publisher === "Marvel Comics") return true;
  const real = MARVEL_EXTRAS[h.name];
  return !!real && h.biography?.fullName === real;
}

export function normalizeHero(h: any): Hero {
  const powerstats = Object.fromEntries(STAT_KEYS.map((k) => [k, Number(h.powerstats?.[k]) || 0])) as Stats;
  return { ...h, powerstats, total: STAT_KEYS.reduce((s, k) => s + powerstats[k], 0) } as Hero;
}

/** Characters whose dataset entry is nothing but zeros can't fight sensibly; give them a modest baseline. */
function playableStats(s: Stats): Stats {
  const sum = STAT_KEYS.reduce((a, k) => a + s[k], 0);
  if (sum > 0) return Object.fromEntries(STAT_KEYS.map((k) => [k, Math.max(8, s[k])])) as Stats;
  return { intelligence: 40, strength: 30, speed: 35, durability: 40, power: 35, combat: 45 };
}

/* ── Offline fallback (the polished roster) ───────────────────────── */
const img = (slug: string) => ({ xs: `${IMG}/xs/${slug}.jpg`, sm: `${IMG}/sm/${slug}.jpg`, md: `${IMG}/md/${slug}.jpg`, lg: `${IMG}/lg/${slug}.jpg` });
const FALLBACK: [number, string, string, string, string, number[]][] = [
  [620, "spider-man", "Spider-Man", "Peter Parker", "good", [90, 55, 67, 75, 74, 85]],
  [332, "hulk", "Hulk", "Bruce Banner", "good", [88, 100, 63, 100, 98, 85]],
  [717, "wolverine", "Wolverine", "Logan", "good", [63, 32, 50, 100, 89, 100]],
  [346, "iron-man", "Iron Man", "Tony Stark", "good", [100, 85, 58, 85, 100, 64]],
  [659, "thor", "Thor", "Thor Odinson", "good", [69, 100, 83, 100, 100, 100]],
  [149, "captain-america", "Captain America", "Steve Rogers", "good", [69, 19, 38, 55, 60, 100]],
  [106, "black-panther", "Black Panther", "T'Challa", "good", [88, 16, 30, 60, 41, 100]],
  [226, "doctor-strange", "Doctor Strange", "Stephen Strange", "good", [100, 10, 12, 84, 100, 60]],
  [213, "deadpool", "Deadpool", "Wade Wilson", "neutral", [69, 32, 50, 100, 100, 100]],
  [687, "venom", "Venom", "Eddie Brock", "bad", [75, 57, 65, 84, 86, 84]],
  [423, "magneto", "Magneto", "Max Eisenhardt", "bad", [88, 80, 27, 84, 91, 80]],
  [655, "thanos", "Thanos", "Thanos", "bad", [100, 100, 33, 100, 100, 80]],
];

export function fallbackHeroes(): Hero[] {
  return FALLBACK.map(([id, slug, name, fullName, alignment, st]) =>
    normalizeHero({
      id,
      slug: `${id}-${slug}`,
      name,
      powerstats: Object.fromEntries(STAT_KEYS.map((k, i) => [k, st[i]])),
      appearance: { gender: "-", race: null, height: ["-", "-"], weight: ["-", "-"], eyeColor: "-", hairColor: "-" },
      biography: { fullName, alterEgos: "-", aliases: [], placeOfBirth: "-", firstAppearance: "-", publisher: "Marvel Comics", alignment },
      work: { occupation: "-", base: "-" },
      connections: { groupAffiliation: "-", relatives: "-" },
      images: img(`${id}-${slug}`),
    })
  );
}

/* ── Loader ───────────────────────────────────────────────────────── */
export interface Roster {
  heroes: Hero[];
  fighters: FighterDef[];
  byId: Map<number, FighterDef>;
  heroById: Map<number, Hero>;
  offline: boolean;
}

let cache: Promise<Roster> | null = null;

function readSession(): any[] | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(rows: any[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(rows));
  } catch {
    /* quota / private mode — memory cache still works */
  }
}

export function buildRoster(rows: any[], offline = false): Roster {
  const heroes = rows
    .filter(isMarvel)
    .map(normalizeHero)
    .map((h) => ({ ...h, powerstats: playableStats(h.powerstats) }));
  // Signature fighters first (in roster order), then everyone else by power total
  const sig = (h: Hero) => {
    const i = SIGNATURE_NAMES.indexOf(h.name);
    return i < 0 ? 999 : i;
  };
  heroes.sort((a, b) => sig(a) - sig(b) || b.total - a.total || a.name.localeCompare(b.name));
  const fighters = heroes.map(buildFighter);
  return {
    heroes,
    fighters,
    byId: new Map(fighters.map((f) => [f.id, f])),
    heroById: new Map(heroes.map((h) => [h.id, h])),
    offline,
  };
}

/** Load once; later calls share the same promise. */
export function loadRoster(): Promise<Roster> {
  if (!cache) {
    const cached = typeof window !== "undefined" ? readSession() : null;
    cache = cached
      ? Promise.resolve(buildRoster(cached))
      : fetch(DATA_URL)
          .then((r) => {
            if (!r.ok) throw new Error(`Character data unavailable (${r.status})`);
            return r.json();
          })
          .then((all: any[]) => {
            // Only keep the Marvel rows in session storage (≈⅓ of the file)
            const rows = all.filter(isMarvel);
            writeSession(rows);
            return buildRoster(rows);
          })
          .catch(() => buildRoster(fallbackHeroes(), true));
  }
  return cache;
}
