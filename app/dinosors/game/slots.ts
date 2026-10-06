/* ------------------------------------------------------------------ */
/*  Saved games ("slots") in IndexedDB.                                */
/*                                                                     */
/*   • latest  – overwritten every 30 s + whenever you leave the page; */
/*               the game always reopens the newest save there is.     */
/*   • auto    – a snapshot every 5 minutes of play (newest 12 kept),  */
/*               so you can go back to an earlier point in time.       */
/*   • manual  – "Save as…": named by you, put in groups, renamed,     */
/*               deleted. Never pruned.                                */
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
const KEEP_AUTOS = 12;

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
  const all = (await tx<Slot[]>("readonly", (s) => s.getAll())) ?? [];
  return all.map(strip).sort((a, b) => b.savedAt - a.savedAt);
}

export async function getSlot(id: string): Promise<Slot | null> {
  return tx<Slot>("readonly", (s) => s.get(id));
}

export async function putSlot(slot: Slot) {
  await tx("readwrite", (s) => s.put(slot));
  if (slot.kind === "auto") await pruneAutos();
}

export async function deleteSlot(id: string) {
  await tx("readwrite", (s) => s.delete(id));
}

export async function updateSlot(id: string, patch: Partial<Pick<SlotMeta, "name" | "group">>) {
  const s = await getSlot(id);
  if (!s) return;
  await tx("readwrite", (st) => st.put({ ...s, ...patch }));
}

/** Turn an autosave (or the latest save) into a named save that's never pruned. */
export async function keepSlot(id: string, name: string, group: string) {
  const s = await getSlot(id);
  if (!s) return null;
  const copy: Slot = { ...s, id: newId(), kind: "manual", name, group };
  await putSlot(copy);
  return copy;
}

async function pruneAutos() {
  const autos = (await listSlots()).filter((s) => s.kind === "auto");
  for (const s of autos.slice(KEEP_AUTOS)) await deleteSlot(s.id);
}

/** The newest save of any kind (what "continue" loads). */
export async function newestSlot(): Promise<Slot | null> {
  const list = await listSlots();
  return list[0] ? getSlot(list[0].id) : null;
}

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
