/* ------------------------------------------------------------------ */
/*  Population: who lives where, and newcomers.                        */
/*                                                                     */
/*  • Homes: every few seconds people are (re)assigned to houses,      */
/*    families together, best houses first. The cave sleeps 6.        */
/*  • Wanderers: now and then a lone traveller or a small family       */
/*    walks in from the wilds. If the camp is safe, fed and has room   */
/*    they join; otherwise they wait at the edge of camp.              */
/* ------------------------------------------------------------------ */
import { BASE_PEOPLE, MAX_PEOPLE } from "./types";
import { deepRoom } from "./deepBuild";
import { HOUSING } from "../data/colony";
import { findSpawnSpot } from "./dinos";
import { shelterDone } from "./build";
import { addHuman, say } from "./humans";
import { sp } from "../data/species";
import type { Human } from "./types";
import type { World } from "./world";

export const CAVE_ROOM = 6;

/**
 * Is the tribe settled enough to grow past BASE_PEOPLE? Well fed, not under attack, nobody down,
 * and a roof for everyone it has.
 */
export function stableTribe(w: World) {
  const people = w.humans.filter((h) => !h.stranger);
  const food = w.tribe.foodTotal(w);
  return !w.tribe.raid && !w.dragons.menacing(w) && food >= people.length * 1.2 && !people.some((h) => h.state === "down") && w.population.capacity(w) >= people.length;
}

/** How many people the tribe can grow to right now: BASE_PEOPLE, or up to MAX_PEOPLE once it's stable. */
export function peopleCap(w: World) {
  return stableTribe(w) ? MAX_PEOPLE : BASE_PEOPLE;
}

export class Population {
  /** seconds until the next wanderers might show up */
  timer = 260;
  private homeT = 0;
  joined = 0;

  capacity(w: World) {
    let n = CAVE_ROOM;
    const hall = w.civ.has("greatHalls") ? 2 : 0;
    for (const s of w.shelters) if (shelterDone(s)) n += HOUSING[s.tier].cap + hall;
    // burrow homes down in the Deep
    n += deepRoom(w.mine);
    return n;
  }

  update(w: World, dt: number) {
    if (w.extinction.wasteland) return;
    this.homeT -= dt;
    if (this.homeT <= 0) {
      this.homeT = 4;
      this.assignHomes(w);
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 300 + w.rng() * 260;
    const residents = w.humans.filter((h) => !h.stranger).length;
    const strangers = w.humans.length - residents;
    // the tribe's (nearly) all gone: a wandering family finds the camp soon, and moves straight in to start again
    // (only once a real tribe has been lost: a world that never had people stays empty)
    if (residents < 2 && w.tribe.lost > 0) {
      this.timer = 90 + w.rng() * 60;
      if (!strangers && w.daylight > 0.25) this.restart(w, residents);
      return;
    }
    const safe = !w.tribe.raid && !w.dragons.menacing(w) && w.daylight > 0.4;
    const fed = w.tribe.foodTotal(w) >= 3;
    if (!safe || !fed || strangers > 0 || residents < 2 || residents >= peopleCap(w)) return;
    // full up: no newcomers till there's room, and the player is told (again every few minutes)
    if (residents >= this.capacity(w) + 2) return this.needHomes(w, residents);
    this.spawnWanderers(w);
  }

  private homesToldAt = -Infinity;

  /** Out of room: tell the player how many homes are short (every few minutes while it lasts). */
  needHomes(w: World, residents = w.humans.filter((o) => !o.stranger).length) {
    if (w.elapsed - this.homesToldAt < 240) return;
    this.homesToldAt = w.elapsed;
    const room = this.capacity(w);
    const cap = peopleCap(w);
    const huts = Math.max(1, Math.ceil((Math.min(cap, residents + 10) - room) / 4));
    w.toast("🛖", `More homes needed! ${residents} people, room for ${room}. Build or upgrade about ${huts} more home${huts === 1 ? "" : "s"} so newcomers can join and families can grow${cap > BASE_PEOPLE ? ` (up to ${MAX_PEOPLE} people)` : residents >= BASE_PEOPLE - 5 ? ` (past ${BASE_PEOPLE} once the tribe is stable: well fed, safe and housed)` : ""}.`, w.camp.x, w.camp.y);
  }

  /** The camp stands (almost) empty: a family of wanderers comes and settles in for good. */
  restart(w: World, residents: number) {
    const before = w.humans.length;
    this.spawnWanderers(w);
    const fresh = w.humans.slice(before);
    // they don't wait at the edge: there's nobody to ask, so they move in
    for (const h of fresh) h.stranger = false;
    if (fresh.length < 2) {
      const at = fresh[0] ?? { x: w.camp.x, y: w.camp.y + 600 };
      const fam = fresh[0]?.family ?? w.nextId();
      while (w.humans.length - before < 2) addHuman(w, at.x + (w.humans.length % 3) * 16, at.y + 10, false, { family: fam });
    }
    const n = w.humans.length - before;
    this.joined += n;
    if (n) w.toast("🏕️", residents ? `A family of ${n} wanderers joins the last of the tribe: together they'll build the community up again.` : `A family of ${n} wanderers found the empty camp and moved in. Build the community up again!`, w.camp.x, w.camp.y);
  }

  /** A lone traveller or a family appears at the edge of the map and heads for camp. */
  spawnWanderers(w: World) {
    const c = w.camp;
    let spot: { x: number; y: number } | null = null;
    for (let k = 0; k < 20 && !spot; k++) {
      const a = w.rng() * Math.PI * 2;
      const x = c.x + Math.cos(a) * 1500;
      const y = c.y + Math.sin(a) * 1000;
      const s = findSpawnSpot(w, sp("trike"), x, y, 200);
      if (s && w.nav.passable("human", s.x, s.y)) spot = s;
    }
    if (!spot) return [];
    const family = w.rng() < 0.55;
    const n = family ? 2 + (w.rng() < 0.5 ? 1 : 0) : 1;
    const fam = w.nextId();
    const out: Human[] = [];
    for (let i = 0; i < n; i++) {
      const kid = family && i >= 2;
      const h = addHuman(w, spot.x + i * 14, spot.y + (i % 2) * 10, kid, { stranger: true, family: fam, age: kid ? 60 : 400 });
      out.push(h);
    }
    out[0].bubble = { text: family ? "Hello? Is it safe?" : "Hello-o?", t: 3 };
    w.toast(family ? "👨‍👩‍👧" : "🚶", family ? `A family of ${n} is walking toward the camp!` : "A traveller is walking toward the camp!", spot.x, spot.y);
    return out;
  }

  /** A wanderer reached camp. */
  arrived(w: World, h: Human) {
    const residents = w.humans.filter((o) => !o.stranger).length;
    const room = residents < this.capacity(w) + 2;
    const family = w.humans.filter((o) => o.stranger && o.family === h.family);
    if (!room) {
      this.needHomes(w, residents);
      say(h, "No room…");
      h.think = 8;
      return;
    }
    for (const o of family) {
      o.stranger = false;
      o.think = 0;
      say(o, o.child ? "Yay, friends!" : "Thank you!");
    }
    this.joined += family.length;
    w.celebrate("Welcome!");
    w.discover("family", h.x, h.y);
    w.toast(family.length > 1 ? "👨‍👩‍👧" : "🙋", family.length > 1 ? `A family of ${family.length} joined the tribe!` : `${h.name} joined the tribe!`, h.x, h.y);
  }

  /** Give everyone a bed: families stay together, nicest houses first. */
  assignHomes(w: World) {
    const homes = w.shelters.filter((s) => shelterDone(s)).sort((a, b) => b.tier - a.tier);
    const free = new Map(homes.map((s) => [s.id, HOUSING[s.tier].cap + (w.civ.has("greatHalls") ? 2 : 0)]));
    const people = w.humans.filter((h) => !h.stranger);
    // Once a distant settlement has homes, seed it with residents instead of
    // leaving everyone assigned to the original ring around the cave.
    if (homes.some((s) => Math.hypot(s.x - w.camp.x, s.y - w.camp.y) > 380) && people.length >= homes.length) {
      const groups = new Map<number, Human[]>();
      for (const h of people) groups.set(h.family || -h.id, [...(groups.get(h.family || -h.id) ?? []), h]);
      for (const group of Array.from(groups.values())) {
        for (const h of group) {
          const familyHome = group.find((o) => o !== h && o.home && o.home === group[0].home && (free.get(o.home) ?? 0) > 0)?.home;
          const chosen = familyHome ? homes.find((s) => s.id === familyHome) : homes.filter((s) => (free.get(s.id) ?? 0) > 0)
            .sort((a, b) => {
              const ca = HOUSING[a.tier].cap + (w.civ.has("greatHalls") ? 2 : 0);
              const cb = HOUSING[b.tier].cap + (w.civ.has("greatHalls") ? 2 : 0);
              return (ca - (free.get(a.id) ?? 0)) / ca - (cb - (free.get(b.id) ?? 0)) / cb || Number(b.id === h.home) - Number(a.id === h.home) || a.id - b.id;
            })[0];
          h.home = chosen?.id ?? 0;
          if (chosen) free.set(chosen.id, (free.get(chosen.id) ?? 0) - 1);
        }
      }
      return;
    }
    // keep people where they are if there's still room
    for (const h of people) {
      const left = free.get(h.home);
      if (left !== undefined && left > 0) free.set(h.home, left - 1);
      else h.home = 0;
    }
    const byFamily = new Map<number, Human[]>();
    for (const h of people) if (!h.home) byFamily.set(h.family || -h.id, [...(byFamily.get(h.family || -h.id) ?? []), h]);
    for (const group of Array.from(byFamily.values())) {
      for (const h of group) {
        // a house where the rest of the family already lives, else any with room
        const fam = people.find((o) => o !== h && o.family && o.family === h.family && o.home && (free.get(o.home) ?? 0) > 0);
        const pick = fam ? fam.home : homes.find((s) => (free.get(s.id) ?? 0) > 0)?.id;
        if (!pick) continue;
        h.home = pick;
        free.set(pick, (free.get(pick) ?? 0) - 1);
      }
    }
  }

  serialize() {
    return { timer: Math.round(this.timer), joined: this.joined };
  }

  load(d: { timer?: number; joined?: number } | undefined) {
    if (!d) return;
    this.timer = d.timer ?? this.timer;
    this.joined = d.joined ?? 0;
  }
}
