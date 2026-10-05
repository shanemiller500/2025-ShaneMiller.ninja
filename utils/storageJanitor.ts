/* ------------------------------------------------------------------ */
/*  localStorage is ~5 MB per site and shared by every project here.   */
/*  When it fills up, saves (and Firebase sign-in) start failing. The  */
/*  janitor frees room by deleting *re-downloadable caches only* —     */
/*  never settings, favourites, saved items or game progress.          */
/* ------------------------------------------------------------------ */

/** Caches other pages rebuild from the network the next time they're needed. */
const CACHE_KEYS = [
  "usaNewsCache", // news
  "market_profiles_v1", // stocks
  "widgetWeatherCache_v2", // weather widget
  "travelExplorerFeatured_v3", // country explorer
  "day-out-whats-on-seq", // day out events
];
const CACHE_PREFIXES = ["travel_ai_v2_", "places_v1_"];
/** leftovers from older builds of the games */
const STALE_KEYS = ["dinosors:emailForSignIn"];

const LIMIT = 5 * 1024 * 1024;

const isCache = (k: string) => CACHE_KEYS.includes(k) || CACHE_PREFIXES.some((p) => k.startsWith(p)) || STALE_KEYS.includes(k);

/** Rough bytes used (UTF-16 → 2 bytes per char). */
export function storageUsed() {
  let n = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      n += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
    }
  } catch {
    /* storage blocked */
  }
  return n;
}

/** Delete re-downloadable caches. Returns how many bytes were freed. */
export function clearCaches() {
  let freed = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isCache(k)) keys.push(k);
    }
    for (const k of keys) {
      freed += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
      localStorage.removeItem(k);
    }
  } catch {
    /* storage blocked */
  }
  return freed;
}

/** Called when a game starts: if storage is getting full, make room. */
export function tidyStorage() {
  try {
    for (const k of STALE_KEYS) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
  if (storageUsed() > LIMIT * 0.7) clearCaches();
}

/** setItem that clears caches and tries again if storage is full. */
export function safeSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    if (!clearCaches()) return false;
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }
}
