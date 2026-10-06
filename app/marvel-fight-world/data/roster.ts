/* ------------------------------------------------------------------ */
/*  Fighter roster: the shared Superhero dataset → FighterDefs          */
/*                                                                      */
/*  Reuses app/Marvel's cached dataset fetch (one request, shared with  */
/*  the Character Lab). A few Marvel characters are mislabeled in the   */
/*  dataset's publisher field ("Rune King Thor", "Evil Deadpool",        */
/*  "Anti-Venom"), so they're added back by id.                         */
/* ------------------------------------------------------------------ */

import { useEffect, useState } from "react";

import { loadDataset, normalizeHero, type Hero } from "@/app/Marvel/lib/roster";
import { buildFighter } from "../engine/fighters";
import { SIGNATURE_NAMES } from "../engine/moves";
import { offlineFighters } from "./offlineRoster";
import type { FighterDef } from "../engine/types";

/** Thor, Deadpool, Venom — Marvel characters with a mislabeled publisher. */
const EXTRA_MARVEL_IDS = new Set([659, 213, 687]);

export interface Roster {
  offline?: boolean;
  fighters: FighterDef[];
  byId: Map<number, FighterDef>;
  heroes: Map<number, Hero>;
  featured: FighterDef[];
}

let cache: Promise<Roster> | null = null;

export function loadFightRoster(): Promise<Roster> {
  if (!cache) {
    cache = loadDataset()
      .then((all) => {
        const heroes = all
          .filter((h) => h?.biography?.publisher === "Marvel Comics" || EXTRA_MARVEL_IDS.has(h?.id))
          .map((h) => normalizeHero({ ...h, biography: { ...h.biography, publisher: "Marvel Comics" } }));
        const fighters = heroes.map(buildFighter);
        // Featured cast first (in their listed order), then by overall power
        const featuredOrder = new Map(SIGNATURE_NAMES.map((n, i) => [n, i]));
        fighters.sort((a, b) => {
          const fa = featuredOrder.get(a.name);
          const fb = featuredOrder.get(b.name);
          if (fa !== undefined || fb !== undefined) return (fa ?? 999) - (fb ?? 999);
          const ta = Object.values(a.stats).reduce((s, v) => s + v, 0);
          const tb = Object.values(b.stats).reduce((s, v) => s + v, 0);
          return tb - ta;
        });
        return {
          fighters,
          byId: new Map(fighters.map((f) => [f.id, f])),
          heroes: new Map(heroes.map((h) => [h.id, h])),
          featured: fighters.filter((f) => f.custom),
        };
      })
      .catch(() => {
        const fighters = offlineFighters();
        return { offline: true, fighters, byId: new Map(fighters.map((f) => [f.id, f])), heroes: new Map<number, Hero>(), featured: fighters };
      });
  }
  return cache;
}

export function useFightRoster() {
  const [state, setState] = useState<{ roster: Roster | null; error: string | null }>({ roster: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    loadFightRoster()
      .then((roster) => alive && setState({ roster, error: null }))
      .catch((e) => alive && setState({ roster: null, error: e?.message ?? "Couldn't load the roster." }));
    return () => {
      alive = false;
    };
  }, [attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

/* ── Portrait images for the canvas (cached per URL) ───────────────── */
const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

export function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  // Offline portrait cards are graphic badges; canvas fighters use their
  // procedural cowl instead of placing the badge over the face.
  if (url.startsWith("data:image/svg+xml")) return Promise.resolve(null);
  if (!imageCache.has(url)) {
    imageCache.set(
      url,
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      })
    );
  }
  return imageCache.get(url)!;
}

export async function preloadPortraits(defs: FighterDef[]) {
  const imgs = await Promise.all(defs.map((d) => loadImage(d.portrait.md)));
  return new Map(defs.map((d, i) => [d.id, imgs[i]]));
}
