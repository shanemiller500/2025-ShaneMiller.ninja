/* ------------------------------------------------------------------ */
/*  Priorities: Low · Normal · High · Urgent for anything queued.      */
/*                                                                     */
/*  One shared table keyed by what the thing is: a building site       */
/*  ("building:12", "scorpion:4", "wall:88", "tower:3", "shelter:7",   */
/*  "upgrade:7"), a mine order ("mine:<cell>"), a player task          */
/*  ("task:<id>"). Anything not in it is Normal.                       */
/*                                                                     */
/*  How workers use it:                                                */
/*   • builders take the highest-priority site first (then defences,   */
/*     then the nearest), and a High / Urgent site takes a bigger crew */
/*   • an Urgent site pulls in everyone free to help (gatherers,       */
/*     haulers, cooks…): its missing materials are gathered first, the */
/*     stores are hauled to it, then it's built                        */
/*   • gatherers fetch what the highest-priority site is short of      */
/*   • miners dig High + Urgent orders before the rest                 */
/*   • Dragon Riders fly cargo to the most urgent site first           */
/*   • Low waits until there's nothing better to do                    */
/*  Survival comes first regardless: fleeing danger, fires, hunger.   */
/* ------------------------------------------------------------------ */
import { siteKey, type Site } from "./build";
import type { World } from "./world";

export type Prio = 0 | 1 | 2 | 3;
export const NORMAL: Prio = 1;
export const URGENT: Prio = 3;

export const PRIOS: { id: Prio; name: string; icon: string; color: string }[] = [
  { id: 0, name: "Low", icon: "⬇", color: "#94a3b8" },
  { id: 1, name: "Normal", icon: "•", color: "#e2e8f0" },
  { id: 2, name: "High", icon: "⬆", color: "#fbbf24" },
  { id: 3, name: "Urgent", icon: "‼", color: "#f43f5e" },
];

export const siteKeyOf = (s: Pick<Site, "kind" | "id">) => siteKey(s);
export const mineKey = (cell: number) => `mine:${cell}`;
export const taskKey = (id: number) => `task:${id}`;

export class Priorities {
  private map = new Map<string, Prio>();
  /** bumps on every change (the UI + renderer badges watch it) */
  version = 0;
  private cleanT = 10;

  get(key: string): Prio {
    return this.map.get(key) ?? NORMAL;
  }

  set(key: string, p: Prio) {
    if (p === NORMAL) this.map.delete(key);
    else this.map.set(key, p);
    this.version++;
  }

  /** Everything not Normal (for the build queue list + map badges). */
  entries() {
    return Array.from(this.map.entries());
  }

  /** The highest priority among mine orders (miners check it before digging anything else). */
  topMine(): Prio {
    let top: Prio = 0;
    for (const [k, p] of Array.from(this.map)) if (k.startsWith("mine:") && p > top) top = p;
    return top;
  }

  /** Now and then: forget finished sites, dug cells and ended tasks. */
  update(w: World, dt: number) {
    this.cleanT -= dt;
    if (this.cleanT > 0 || !this.map.size) return;
    this.cleanT = 10;
    const live = new Set(w.buildSites().map((s) => siteKey(s)));
    for (const k of Array.from(this.map.keys())) {
      const [kind, rest] = k.split(":");
      const id = Number(rest);
      const gone = kind === "mine" ? !w.mine.orders.has(id) : kind === "task" ? !w.tasks.get(id) : !live.has(k);
      if (gone) {
        this.map.delete(k);
        this.version++;
      }
    }
  }

  serialize() {
    return this.entries();
  }

  load(d: [string, number][] | undefined) {
    this.map.clear();
    for (const [k, p] of d ?? []) if (p >= 0 && p <= 3 && p !== NORMAL) this.map.set(k, p as Prio);
    this.version++;
  }
}

/** A thing's priority (Normal if nobody set one). */
export function prioOf(w: World, key: string): Prio {
  return w.priority.get(key);
}

/** A building site's priority. */
export const sitePrio = (w: World, s: Pick<Site, "kind" | "id">) => w.priority.get(siteKey(s));

/** How many people a site can use, by its priority (×crew cap). */
export const PRIO_CREW = [0.5, 1, 1.6, 2.5] as const;

/** Is there an Urgent site that could use help right now? */
export function urgentSite(w: World) {
  for (const s of w.buildSites()) if (!s.locked && sitePrio(w, s) === URGENT) return s;
  return null;
}
