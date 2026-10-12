/* ------------------------------------------------------------------ */
/*  Saved games ("slots") in IndexedDB.                                */
/*                                                                     */
/*   • latest  – overwritten every 30 s + whenever you leave the page; */
/*               the game always reopens the newest save there is.     */
/*   • auto    – a snapshot every 5 minutes of play.                    */
/*               so you can go back to an earlier point in time.       */
/*   • manual  – "Save as…": named by you, put in groups, renamed,     */
/*               deleted.                                              */
/*   • total   – 10 slots maximum, including latest; oldest archives  */
/*               are removed first.                                    */
/*                                                                     */
/*  Everything is best-effort: if IndexedDB is unavailable the game    */
/*  still runs on its localStorage save.                               */
/* ------------------------------------------------------------------ */

export type SlotKind = "latest" | "auto" | "manual";

export interface SlotMeta {
  id: string;
  kind: SlotKind;
  name: string;
  group: string;
  savedAt: number;
  day: number;
  /** in-game hour */
  time: number;
  people: number;
  level: string;
  /** small JPEG data URL of the view when it was saved */
  thumb?: string;
}

export interface Slot extends SlotMeta {
  data: string;
}

const DB = "dinosors-slots";
const STORE = "slots";
export const LATEST_ID = "latest";
export const MAX_SLOTS = 10;

let dbp: Promise<IDBDatabase | null> | null = null;

function db(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | null> {
  return db().then(
    (d) =>
      new Promise<T | null>((resolve) => {
        if (!d) return resolve(null);
        try {
          const t = d.transaction(STORE, mode);
          const r = fn(t.objectStore(STORE));
          t.oncomplete = () => resolve(r ? (r.result as T) : null);
          t.onerror = () => resolve(null);
          t.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

const strip = (s: Slot): SlotMeta => {
  const { data, ...meta } = s;
  void data;
  return meta;
};

/** Every saved game, newest first (without the heavy world data). */
export async function listSlots(): Promise<SlotMeta[]> {
  // Bring older libraries that already exceed the cap into line on first open.
  await trimSlots();
  const all = (await tx<Slot[]>("readonly", (s) => s.getAll())) ?? [];
  return all.map(strip).sort((a, b) => b.savedAt - a.savedAt);
}

export async function getSlot(id: string): Promise<Slot | null> {
  return tx<Slot>("readonly", (s) => s.get(id));
}

export async function putSlot(slot: Slot) {
  const d = await db();
  if (!d) return;
  await new Promise<void>((resolve) => {
    try {
      const t = d.transaction(STORE, "readwrite");
      const s = t.objectStore(STORE);
      const read = s.getAll();
      read.onsuccess = () => {
        for (const id of oldestToRemove(read.result as Slot[], slot)) s.delete(id);
        s.put(slot);
      };
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
      t.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function deleteSlot(id: string) {
  await tx("readwrite", (s) => s.delete(id));
}

export async function updateSlot(id: string, patch: Partial<Pick<SlotMeta, "name" | "group">>) {
  const s = await getSlot(id);
  if (!s) return;
  await tx("readwrite", (st) => st.put({ ...s, ...patch }));
}

/** Copy an autosave or the latest save into a named slot. */
export async function keepSlot(id: string, name: string, group: string) {
  const s = await getSlot(id);
  if (!s) return null;
  const copy: Slot = { ...s, id: newId(), kind: "manual", name, group };
  await putSlot(copy);
  return copy;
}

/** Keep the new save and the latest slot; discard oldest other saves first. */
export function oldestToRemove(existing: SlotMeta[], incoming?: SlotMeta): string[] {
  const entries = incoming ? [...existing.filter((s) => s.id !== incoming.id), incoming] : existing;
  const excess = Math.max(0, entries.length - MAX_SLOTS);
  if (!excess) return [];
  return entries
    .filter((s) => s.id !== LATEST_ID && s.id !== incoming?.id)
    .sort((a, b) => a.savedAt - b.savedAt || a.id.localeCompare(b.id))
    .slice(0, excess)
    .map((s) => s.id);
}

async function trimSlots() {
  const d = await db();
  if (!d) return;
  await new Promise<void>((resolve) => {
    try {
      const t = d.transaction(STORE, "readwrite");
      const s = t.objectStore(STORE);
      const read = s.getAll();
      read.onsuccess = () => {
        for (const id of oldestToRemove(read.result as Slot[])) s.delete(id);
      };
      t.oncomplete = () => resolve();
      t.onerror = () => resolve();
      t.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** The newest save of any kind (what "continue" loads). */
export async function newestSlot(): Promise<Slot | null> {
  const all = (await tx<Slot[]>("readonly", (s) => s.getAll())) ?? [];
  let best: Slot | null = null;
  for (const s of all) if (!best || s.savedAt > best.savedAt) best = s;
  return best;
}

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
