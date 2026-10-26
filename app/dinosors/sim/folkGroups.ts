/* ------------------------------------------------------------------ */
/*  Folk groups: the Tree, Sea + Sand People live + move in groups,    */
/*  the way the clans do, instead of each one drifting off alone.      */
/*                                                                     */
/*  A group is a family, a patrol, a raiding party, a camp's settlers, */
/*  a caravan or a war band. It has a leader; whoever's in it heads    */
/*  for the same spot (spread round it, not on top of each other),     */
/*  strays get pulled back, and when one of them is hit the rest of    */
/*  the group close by turns on the attacker. Members are tagged with  */
/*  Brute.grp; the groups themselves are saved here.                   */
/* ------------------------------------------------------------------ */
import { setB } from "./rivals";
import { makeRng, type Rng } from "./rng";
import type { Brute } from "./types";
import type { World } from "./world";

export type FolkSide = "tree" | "sea" | "sand" | "snow";
export type GroupKind = "family" | "patrol" | "raid" | "camp" | "caravan" | "war" | "hunt";

export const GROUP_INFO: Record<GroupKind, { icon: string; name: string; size: [number, number]; spread: number; armed: boolean }> = {
  camp: { icon: "⛺", name: "settlers", size: [6, 8], spread: 90, armed: false },
  family: { icon: "👪", name: "family", size: [3, 5], spread: 55, armed: false },
  patrol: { icon: "🛡️", name: "patrol", size: [3, 4], spread: 70, armed: true },
  raid: { icon: "⚔️", name: "raiding party", size: [5, 7], spread: 80, armed: true },
  caravan: { icon: "🐪", name: "caravan", size: [4, 6], spread: 75, armed: false },
  war: { icon: "🔥", name: "war band", size: [7, 10], spread: 95, armed: true },
  hunt: { icon: "🏹", name: "hunting party", size: [3, 5], spread: 80, armed: true },
};

export interface FolkGroup {
  id: number;
  side: FolkSide;
  tribe: number;
  kind: GroupKind;
  leader: number;
  /** where the group is headed / gathered (px) */
  x: number;
  y: number;
}

const sideOf = (b: Brute): FolkSide | null => (b.tree ? "tree" : b.sea ? "sea" : b.sand ? "sand" : b.snow ? "snow" : null);
const tribeOf = (b: Brute) => b.tree ?? b.sea ?? b.sand ?? b.snow ?? 0;

/** stray this far beyond the group's spread and you get called back */
const STRAY = 3.2;

export class FolkGroups {
  list: FolkGroup[] = [];
  private ids = 1;
  private byId = new Map<number, FolkGroup>();
  /** group id → its members (rebuilt once a second) */
  private index = new Map<number, Brute[]>();
  private tickT = 0;
  /** its own dice (so the rest of the world plays out the same) */
  private rng: Rng;

  constructor(seed = 1) {
    this.rng = makeRng(seed * 97 + 5);
  }

  get(id: number | undefined) {
    return id ? this.byId.get(id) ?? null : null;
  }

  of(b: Brute) {
    return this.get(b.grp);
  }

  /** Make a group of these folk (they leave any group they were in). */
  make(side: FolkSide, tribe: number, kind: GroupKind, members: Brute[], x: number, y: number): FolkGroup | null {
    if (!members.length) return null;
    const g: FolkGroup = { id: this.ids++, side, tribe, kind, leader: members[0].id, x: Math.round(x), y: Math.round(y) };
    this.list.push(g);
    this.byId.set(g.id, g);
    for (const b of members) b.grp = g.id;
    this.index.set(g.id, [...members]);
    return g;
  }

  members(w: World, g: FolkGroup): Brute[] {
    const l = this.index.get(g.id);
    if (l) return l.filter((b) => b.grp === g.id && b.hp > 0);
    return w.rivals.brutes.filter((b) => b.grp === g.id && b.hp > 0);
  }

  /** The group's leader (a new one steps up if they're gone). */
  leader(w: World, g: FolkGroup): Brute | null {
    const ms = this.members(w, g);
    const cur = ms.find((b) => b.id === g.leader);
    if (cur) return cur;
    const next = ms.sort((a, b) => (b.age ?? 0) - (a.age ?? 0))[0] ?? null;
    if (next) g.leader = next.id;
    return next;
  }

  /**
   * Where a member should wander to: the leader picks (with `pick`, the faction's own idea of a
   * good spot) and everyone else takes a place round the same spot.
   */
  spot(w: World, b: Brute, pick: () => { x: number; y: number } | null): { x: number; y: number } | null {
    const g = this.of(b);
    if (!g) return pick();
    const lead = this.leader(w, g);
    if (!lead || lead === b) {
      const p = pick();
      if (p) {
        g.x = Math.round(p.x);
        g.y = Math.round(p.y);
      }
      return p;
    }
    // a place in the group's circle (stable per member, so they don't swap spots)
    const ms = this.members(w, g);
    const i = Math.max(0, ms.indexOf(b));
    const a = (i / Math.max(1, ms.length)) * Math.PI * 2 + g.id;
    const r = GROUP_INFO[g.kind].spread * (0.45 + (i % 3) * 0.22);
    return { x: g.x + Math.cos(a) * r, y: g.y + Math.sin(a) * r * 0.65 };
  }

  /** One of them was hit: groupmates within reach turn on whoever did it. */
  rally(w: World, b: Brute, engage: (mate: Brute) => void, reach = 420) {
    const g = this.of(b);
    if (!g) return;
    for (const m of this.members(w, g)) {
      if (m === b || m.state === "fight" || m.state === "flee" || m.hp < 0.35 || (m.age ?? 999) < 60) continue;
      if (Math.hypot(m.x - b.x, m.y - b.y) > reach) continue;
      engage(m);
    }
  }

  /** Everyone in a group heads somewhere together (a caravan route, a patrol point, a new camp). */
  moveTo(w: World, g: FolkGroup, x: number, y: number, state: Brute["state"] = "walk") {
    g.x = Math.round(x);
    g.y = Math.round(y);
    const ms = this.members(w, g);
    ms.forEach((m, i) => {
      const a = (i / Math.max(1, ms.length)) * Math.PI * 2 + g.id;
      const r = GROUP_INFO[g.kind].spread * 0.5;
      setB(m, state, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.65);
    });
  }

  /** Once a second: tidy up, and call back anyone who's wandered off from their group. */
  update(w: World, dt: number) {
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = 1;
    this.index.clear();
    const loose: Brute[] = [];
    for (const b of w.rivals.brutes) {
      const side = sideOf(b);
      if (!side) continue;
      const g = b.grp ? this.byId.get(b.grp) : null;
      if (!g || g.side !== side || g.tribe !== tribeOf(b)) {
        b.grp = undefined;
        loose.push(b);
        continue;
      }
      const l = this.index.get(g.id);
      if (l) l.push(b);
      else this.index.set(g.id, [b]);
    }
    // anyone not in a group (born since, or their group broke up) joins a family or the camp's settlers
    for (const b of loose) {
      const side = sideOf(b)!;
      const tribe = tribeOf(b);
      const home = this.list.find((g) => g.side === side && g.tribe === tribe && (g.kind === "family" || g.kind === "camp") && (this.index.get(g.id)?.length ?? 0) < GROUP_INFO[g.kind].size[1] + 1);
      if (home) {
        b.grp = home.id;
        const l = this.index.get(home.id);
        if (l) l.push(b);
        else this.index.set(home.id, [b]);
      } else {
        const g = this.make(side, tribe, "family", [b], b.x, b.y);
        if (g) this.index.set(g.id, [b]);
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i];
      const ms = this.index.get(g.id) ?? [];
      if (!ms.length) {
        this.list.splice(i, 1);
        this.byId.delete(g.id);
        continue;
      }
      const lead = this.leader(w, g);
      if (!lead) continue;
      const spread = GROUP_INFO[g.kind].spread;
      for (const m of ms) {
        if (m === lead || m.band || m.raid || m.captive || m.onDragon || m.mount) continue;
        if (m.state !== "idle" && m.state !== "wander" && m.state !== "walk") continue;
        const off = Math.hypot(m.x - lead.x, m.y - lead.y);
        if (off > spread * STRAY) setB(m, "walk", lead.x + (this.rng() - 0.5) * spread, lead.y + (this.rng() - 0.5) * spread * 0.6);
      }
    }
  }

  /** A tribe's gone (razed, united into another): its groups go with it (or join the new tribe). */
  retribe(side: FolkSide, from: number, to: number | null) {
    for (const g of this.list) {
      if (g.side !== side || g.tribe !== from) continue;
      if (to === null) g.tribe = -1;
      else g.tribe = to;
    }
  }

  serialize() {
    return { ids: this.ids, list: this.list.map((g) => ({ ...g })) };
  }

  load(d: ReturnType<FolkGroups["serialize"]> | undefined) {
    this.list = [];
    this.byId.clear();
    this.index.clear();
    if (!d) return;
    this.ids = d.ids ?? 1;
    for (const g of d.list ?? []) {
      this.list.push({ ...g });
      this.byId.set(g.id, this.list[this.list.length - 1]);
    }
  }
}

/** Split a founding band into groups: the camp's settlers, families, and a patrol. */
export function foundingGroups(w: World, side: FolkSide, tribe: number, folk: Brute[], at: { x: number; y: number }) {
  if (!folk.length) return;
  const grown = folk.filter((b) => (b.age ?? 999) >= 60);
  const young = folk.filter((b) => (b.age ?? 999) < 60);
  const patrol = grown.slice(0, Math.min(3, Math.max(0, grown.length - 3)));
  const rest = grown.slice(patrol.length);
  if (patrol.length >= 2) w.groups.make(side, tribe, "patrol", patrol, at.x, at.y);
  // families of two or three grown-ups with the little ones shared out
  const fams: Brute[][] = [];
  for (let i = 0; i < rest.length; i += 3) fams.push(rest.slice(i, i + 3));
  young.forEach((y, i) => fams[i % Math.max(1, fams.length)]?.push(y));
  if (!fams.length && young.length) fams.push(young);
  fams.forEach((f, i) => w.groups.make(side, tribe, i === 0 ? "camp" : "family", f, at.x, at.y));
}
