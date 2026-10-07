/* ------------------------------------------------------------------ */
/*  Population: who lives where, and newcomers.                        */
/*                                                                     */
/*  • Homes: every few seconds people are (re)assigned to houses,      */
/*    families together, best houses first. The cave sleeps 6.        */
/*  • Wanderers: now and then a lone traveller or a small family       */
/*    walks in from the wilds. If the camp is safe, fed and has room   */
/*    they join; otherwise they wait at the edge of camp.              */
/* ------------------------------------------------------------------ */
import { MAX_PEOPLE } from "./types";
import { deepRoom } from "./deepBuild";
import { HOUSING } from "../data/colony";
import { findSpawnSpot } from "./dinos";
import { shelterDone } from "./build";
import { addHuman, say } from "./humans";
import { sp } from "../data/species";
import type { Human } from "./types";
import type { World } from "./world";

export const CAVE_ROOM = 6;

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
    const safe = !w.tribe.raid && !w.dragons.list.length && w.daylight > 0.4;
    const fed = w.tribe.foodTotal(w) >= 3;
    if (!safe || !fed || strangers > 0 || residents >= Math.min(MAX_PEOPLE, this.capacity(w) + 2) || residents < 2) return;
    this.spawnWanderers(w);
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
      if (!w.flags.has("noRoom")) {
        w.flags.add("noRoom");
        w.toast("🛖", "Newcomers are waiting at the edge of camp — build or upgrade homes to make room!");
      }
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
