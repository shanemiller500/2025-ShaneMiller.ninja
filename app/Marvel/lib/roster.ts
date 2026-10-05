/**
 * roster.ts — Marvel character data.
 *
 * Marvel shut down its public developer API (every gateway.marvel.com endpoint
 * returns 500 and developer.marvel.com redirects away), so this uses the
 * open-source Superhero API dataset (akabab/superhero-api, MIT) served from
 * jsDelivr: no key, CDN-cached, filtered to Marvel Comics characters.
 */

export const DATA_URL = "https://cdn.jsdelivr.net/gh/akabab/superhero-api@0.3.0/api/all.json";
export const DATA_SOURCE = "akabab/superhero-api";

export const STATS = ["intelligence", "strength", "speed", "durability", "power", "combat"] as const;
export type StatKey = (typeof STATS)[number];

export const STAT_LABEL: Record<StatKey, string> = {
  intelligence: "Intelligence",
  strength: "Strength",
  speed: "Speed",
  durability: "Durability",
  power: "Power",
  combat: "Combat",
};

export type Alignment = "good" | "bad" | "neutral";

export interface Hero {
  id: number;
  name: string;
  slug: string;
  powerstats: Record<StatKey, number>;
  appearance: { gender: string; race: string | null; height: string[]; weight: string[]; eyeColor: string; hairColor: string };
  biography: {
    fullName: string;
    alterEgos: string;
    aliases: string[];
    placeOfBirth: string;
    firstAppearance: string;
    publisher: string;
    alignment: Alignment | "-";
  };
  work: { occupation: string; base: string };
  connections: { groupAffiliation: string; relatives: string };
  images: { xs: string; sm: string; md: string; lg: string };
  /** Sum of the six stats (0–600) */
  total: number;
}

export const ALIGNMENT: Record<Alignment, { label: string; chip: string; hex: string }> = {
  good: {
    label: "Hero",
    chip: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/20",
    hex: "#38bdf8",
  },
  bad: {
    label: "Villain",
    chip: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20",
    hex: "#f43f5e",
  },
  neutral: {
    label: "Neutral",
    chip: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20",
    hex: "#f59e0b",
  },
};

export const alignmentOf = (h: Hero): Alignment =>
  h.biography.alignment === "good" || h.biography.alignment === "bad" ? h.biography.alignment : "neutral";

/** Treat the dataset's placeholder strings as empty. */
export const clean = (v: string | null | undefined) => {
  const s = String(v ?? "").trim();
  return !s || s === "-" || s === "null" || /^no alter egos/i.test(s) ? "" : s;
};

/** Split comma/semicolon lists like "Avengers, X-Men; Defenders" into unique items. */
export const splitList = (v: string | null | undefined, max = 12) =>
  Array.from(new Set(clean(v).split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean))).slice(0, max);

/** Raw dataset row → Hero (numeric stats + total). Shared with other projects (e.g. marvel-fight-world). */
export function normalizeHero(h: any): Hero {
  const powerstats = Object.fromEntries(STATS.map((k) => [k, Number(h.powerstats?.[k]) || 0])) as Record<StatKey, number>;
  return { ...h, powerstats, total: STATS.reduce((s, k) => s + powerstats[k], 0) } as Hero;
}

/* ── Module-level cache: one fetch of the whole dataset per page load ── */
let rawCache: Promise<any[]> | null = null;

/** The full dataset (all publishers), fetched once and shared. */
export function loadDataset(): Promise<any[]> {
  if (!rawCache) {
    rawCache = fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`Character data unavailable (${r.status})`);
        return r.json();
      })
      .catch((e) => {
        rawCache = null; // allow retry
        throw e;
      });
  }
  return rawCache;
}

let cache: Promise<Hero[]> | null = null;

export function loadRoster(): Promise<Hero[]> {
  if (!cache) {
    cache = loadDataset()
      .then((all) =>
        all
          .filter((h) => h?.biography?.publisher === "Marvel Comics")
          .map(normalizeHero)
          .sort((a, b) => b.total - a.total)
      )
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}
