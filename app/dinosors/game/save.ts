/* ------------------------------------------------------------------ */
/*  Local persistence. Everything is wrapped in try/catch: private     */
/*  windows, full storage or blocked site data just mean "no save".    */
/*                                                                     */
/*  Fast path: localStorage (synchronous, loads before the first       */
/*  frame). If it's full, the world goes to IndexedDB instead and a    */
/*  tiny marker remembers that, so the next visit loads it from there. */
/*  Cloud saves (Firebase) sit on top of this, debounced, in useCloud. */
/* ------------------------------------------------------------------ */
import { safeSetItem } from "@/utils/storageJanitor";
import { SAVE_VERSION, World, type SaveData } from "../sim/world";

const WORLD_KEY = "dinosors:world:v1";
const IDB_MARK = "dinosors:world:idb";
const SETTINGS_KEY = "dinosors:settings:v1";
const DB = "dinosors";
const STORE = "saves";

export interface Settings {
  muted: boolean;
  volume: number;
  /** first-visit hint already shown */
  welcomed: boolean;
}

export const DEFAULT_SETTINGS: Settings = { muted: false, volume: 0.8, welcomed: false };

/** Any save version this build understands (v1 = before the colony upgrade). */
export function readSave(raw: string | null): World | null {
  if (!raw) return null;
  const data = JSON.parse(raw) as SaveData;
  if (!data || typeof data.v !== "number" || data.v < 1 || data.v > SAVE_VERSION) return null;
  return World.deserialize(data);
}

/** Set when the local save existed but couldn't be read (it's kept safe as a rescue slot). */
export let lastLoadError: string | null = null;

export function loadWorld(): World | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(WORLD_KEY);
    return readSave(raw);
  } catch (err) {
    // never lose a world: park the unreadable save as its own slot before anything overwrites it
    lastLoadError = err instanceof Error ? err.message : String(err);
    console.error("[dinosors] couldn't load the local save:", err);
    if (raw) {
      const data = raw;
      void import("./slots").then(({ putSlot, newId }) =>
        putSlot({ id: `rescue-${newId()}`, kind: "manual", name: "Rescued save (couldn't open)", group: "Rescued", savedAt: Date.now(), day: 0, time: 0, people: 0, level: "?", data }),
      );
    }
    return null;
  }
}

export function saveWorld(w: World) {
  let json: string;
  try {
    json = JSON.stringify(w.serialize());
  } catch {
    return false;
  }
  try {
    if (safeSetItem(WORLD_KEY, json)) {
      localStorage.removeItem(IDB_MARK);
      return true;
    }
  } catch {
    /* fall through to IndexedDB */
  }
  void idbPut(json).then((ok) => {
    try {
      if (ok) {
        localStorage.removeItem(WORLD_KEY);
        localStorage.setItem(IDB_MARK, "1");
      }
    } catch {
      /* ignore */
    }
  });
  return true;
}

/** Is the latest local world parked in IndexedDB (localStorage was full)? */
export function hasIdbWorld() {
  try {
    return localStorage.getItem(IDB_MARK) === "1";
  } catch {
    return false;
  }
}

export async function loadIdbWorld(): Promise<string | null> {
  return idbGet();
}

export function clearWorld() {
  try {
    localStorage.removeItem(WORLD_KEY);
    localStorage.removeItem(IDB_MARK);
  } catch {
    /* ignore */
  }
  void idbPut(null);
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(json: string | null): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      if (json === null) tx.objectStore(STORE).delete("world");
      else tx.objectStore(STORE).put(json, "world");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbGet(): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get("world");
      req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  try {
    safeSetItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
