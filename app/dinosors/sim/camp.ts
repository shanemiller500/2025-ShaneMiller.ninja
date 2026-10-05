/* ------------------------------------------------------------------ */
/*  The cave-people's camp: a shared stockpile, a tech goal they work  */
/*  toward, crafting sequences (shown step by step), campfires and     */
/*  shelters that go up in stages.                                     */
/* ------------------------------------------------------------------ */
import { FACTS, SHELTER_STAGES, TECH, TECH_ORDER } from "../data/facts";
import { P } from "./particles";
import { LM, cliffY } from "./terrain";
import { TILE, type Campfire, type Resource, type Shelter, type TechId } from "./types";
import type { World } from "./world";

export type Stock = Record<Resource, number>;

export interface Crafting {
  tech: TechId;
  by: number;
  t: number;
  /** total seconds */
  dur: number;
  /** fire attempts that fizzled */
  fails: number;
}

/** Craft steps the renderer + UI show (index by progress). */
export const CRAFT_STEPS: Record<TechId, string[]> = {
  tools: ["Find a hard stone", "Chip, chip, chip!", "A sharp edge!"],
  fire: ["Pile sticks + dry grass", "Strike stones for sparks", "Blow on the smoke…", "FIRE!"],
  spear: ["Pick a straight stick", "Tie on a sharp stone", "Spear ready!"],
  fishing: ["Bend a stick", "Twist grass into line", "Gone fishing!"],
  axe: ["Shape a big stone", "Tie it to a handle", "Chop chop!"],
  basket: ["Collect long grass", "Weave over, under…", "A basket!"],
  shelter: ["Plan the hut"],
};

export class Camp {
  x = LM.camp.x * TILE + TILE / 2;
  y = LM.camp.y * TILE + TILE / 2;
  caveX = LM.cave.x * TILE + TILE / 2;
  caveY = 0;
  stock: Stock = { stick: 0, stone: 0, grass: 0, leaves: 0, wood: 0, fish: 0, berries: 2 };
  learned = new Set<TechId>();
  goal: TechId | null = "tools";
  crafting: Crafting | null = null;
  /** player-chosen goal sticks until done */
  manualGoal = false;

  constructor(seed: number) {
    this.caveY = (Math.round(cliffY(LM.cave.x, seed)) + 1) * TILE + 2;
  }

  get pileX() {
    return this.x + 70;
  }
  get pileY() {
    return this.y + 6;
  }
  get craftX() {
    return this.x - 46;
  }
  get craftY() {
    return this.y + 4;
  }

  available(t: TechId) {
    if (this.learned.has(t)) return false;
    return (TECH[t].after ?? []).every((a) => this.learned.has(a));
  }

  /** What resource does the current goal still need most? */
  missing(w: World): Resource | null {
    // shelters under construction come first once they exist
    const site = this.activeShelter(w);
    if (site) {
      const need = SHELTER_STAGES[site.stage].need;
      if (need === "wood" && !this.learned.has("axe")) return null;
      if (this.stock[need] < SHELTER_STAGES[site.stage].n - site.have) return need;
    }
    if (!this.goal) return null;
    const needs = TECH[this.goal].needs;
    let worst: Resource | null = null;
    let gap = 0;
    for (const [r, n] of Object.entries(needs) as [Resource, number][]) {
      const g = n - this.stock[r];
      if (g > gap) {
        gap = g;
        worst = r;
      }
    }
    return worst;
  }

  ready() {
    if (!this.goal || this.goal === "shelter" || this.crafting) return false;
    const needs = TECH[this.goal].needs;
    return (Object.entries(needs) as [Resource, number][]).every(([r, n]) => this.stock[r] >= n);
  }

  pickGoal() {
    if (this.goal && !this.learned.has(this.goal) && this.available(this.goal)) return;
    this.manualGoal = false;
    this.goal = TECH_ORDER.find((t) => this.available(t)) ?? null;
  }

  setGoal(w: World, t: TechId) {
    if (!this.available(t)) return false;
    this.goal = t;
    this.manualGoal = true;
    if (t === "shelter") this.ensureShelterSite(w);
    w.toast(TECH[t].icon, `The cave people will work on: ${TECH[t].name}`);
    return true;
  }

  activeShelter(w: World): Shelter | null {
    return w.shelters.find((s) => s.stage < SHELTER_STAGES.length) ?? null;
  }

  ensureShelterSite(w: World) {
    if (this.activeShelter(w)) return;
    const n = w.shelters.length;
    const a = -0.6 + n * 1.1;
    this.addShelter(w, this.x + Math.cos(a) * 130, this.y + 40 + Math.sin(a) * 60);
  }

  addShelter(w: World, x: number, y: number) {
    const s: Shelter = { id: w.nextId(), x, y, stage: 0, have: 0 };
    w.shelters.push(s);
    return s;
  }

  startCraft(w: World, humanId: number) {
    if (!this.goal || !this.ready()) return false;
    const t = this.goal;
    for (const [r, n] of Object.entries(TECH[t].needs) as [Resource, number][]) this.stock[r] -= n;
    this.crafting = { tech: t, by: humanId, t: 0, dur: t === "fire" ? 9 : 6, fails: 0 };
    return true;
  }

  /** Called every frame while somebody is crafting. Returns true when done. */
  updateCraft(w: World, dt: number) {
    const c = this.crafting;
    if (!c) return false;
    const rng = w.rng;
    c.t += dt;
    const x = this.craftX;
    const y = this.craftY;
    const prog = c.t / c.dur;
    if (c.tech === "fire") {
      if (prog > 0.25 && prog < 0.7 && rng() < dt * 10) {
        w.particles.spawn(P.Spark, x + (rng() - 0.5) * 10, y, { z: 6, vz: 40 + rng() * 40, vx: (rng() - 0.5) * 60, g: 200, size: 2, max: 0.4, color: "#ffe680" });
        if (rng() < 0.2) w.sfx("clack", x, y, 0.5);
      }
      // a wet world makes fire-starting fail sometimes
      if (prog > 0.5 && prog < 0.55 && c.fails < 2 && w.weather.rain > 0.3 && rng() < dt * 8) {
        c.fails++;
        c.t = c.dur * 0.3;
        w.say(c.by, "Too wet!");
        w.particles.spawn(P.Steam, x, y, { vz: 20, size: 8, max: 1, color: "rgba(200,200,200,0.5)" });
      }
      if (prog > 0.55 && rng() < dt * 6) w.particles.spawn(P.Smoke, x, y, { z: 4, vz: 20, size: 6, max: 1.4, color: "rgba(160,160,160,0.5)" });
    } else if (rng() < dt * 5) {
      w.particles.spawn(P.Spark, x, y, { z: 6, vz: 30, vx: (rng() - 0.5) * 40, g: 160, size: 1.5, max: 0.3, color: "#e8e2d0" });
      if (rng() < 0.3) w.sfx("clack", x, y, 0.4);
    }
    if (c.t < c.dur) return false;

    this.learned.add(c.tech);
    this.crafting = null;
    const def = TECH[c.tech];
    if (c.tech === "fire") {
      this.lightCampfire(w);
      w.discover("fireMade", x, y);
      w.celebrate("FIRE!!");
      w.toast("🔥", "The cave people made FIRE!", x, y, def.fact);
    } else {
      w.celebrate("Yay!");
      w.toast(def.icon, `They figured out: ${def.name}!`, x, y, def.fact);
    }
    this.goal = null;
    this.pickGoal();
    if (this.goal === "shelter") this.ensureShelterSite(w);
    return true;
  }

  lightCampfire(w: World) {
    let f = w.campfires[0];
    if (!f) {
      f = { id: w.nextId(), x: this.x, y: this.y + 14, lit: true, fuel: 1, cook: 0 } satisfies Campfire;
      w.campfires.push(f);
    }
    f.lit = true;
    f.fuel = 1;
    w.sfx("ignite", f.x, f.y, 0.8);
  }

  /** Shelter stage delivery + building. */
  deliverToShelter(w: World, s: Shelter, r: Resource, n: number) {
    const stage = SHELTER_STAGES[s.stage];
    if (!stage || stage.need !== r) return 0;
    const used = Math.min(n, stage.n - s.have);
    s.have += used;
    return used;
  }

  advanceShelter(w: World, s: Shelter) {
    if (s.stage >= SHELTER_STAGES.length) return;
    s.stage++;
    s.have = 0;
    w.particles.burst(P.Dust, s.x, s.y, 10, 60, { size: 8, max: 1, color: "rgba(160,130,90,0.5)" });
    w.sfx("build", s.x, s.y, 0.8);
    if (s.stage >= SHELTER_STAGES.length) {
      const first = !this.learned.has("shelter");
      this.learned.add("shelter");
      w.celebrate("Home!");
      w.discover("shelterDone", s.x, s.y);
      if (first) w.toast("🛖", "A shelter! Now they can stay dry in storms.", s.x, s.y, TECH.shelter.fact);
      if (this.goal === "shelter") {
        this.goal = null;
        this.pickGoal();
      }
    }
  }

  update(w: World, dt: number) {
    for (const f of w.campfires) {
      if (!f.lit) continue;
      const sheltered = w.shelters.some((s) => s.stage >= 3 && Math.hypot(s.x - f.x, s.y - f.y) < 70);
      if (w.weather.rain > 0.6 && !sheltered && w.rng() < dt * 0.05 * w.weather.rain) {
        f.lit = false;
        w.particles.burst(P.Steam, f.x, f.y, 6, 20, { vz: 30, size: 10, max: 1.5, color: "rgba(220,220,220,0.6)" });
        w.sfx("hiss", f.x, f.y, 0.7);
        w.toast("💧", "The rain put out the campfire!");
      }
      // fires slowly eat sticks; the tribe feeds them
      f.fuel = Math.max(0, f.fuel - dt * 0.004);
      if (f.fuel <= 0) f.lit = false;
      if (f.fuel < 0.6 && this.stock.stick > 0) {
        this.stock.stick--;
        f.fuel = 1;
      }
      if (w.inView(f.x, f.y, 200)) {
        if (w.rng() < dt * 6) w.particles.spawn(P.Ember, f.x + (w.rng() - 0.5) * 8, f.y, { z: 6, vz: 40 + w.rng() * 30, vx: (w.rng() - 0.5) * 10 + w.weather.windX * 2, size: 1.6, max: 1, color: "#ffc35a" });
        if (w.rng() < dt * 2) w.particles.spawn(P.Smoke, f.x, f.y, { z: 14, vz: 26, vx: w.weather.windX * 4, size: 7, max: 2.2, color: "rgba(120,120,120,0.3)" });
      }
      // cooking turns raw fish into a feast
      if (this.stock.fish > 0) {
        f.cook += dt;
        if (f.cook > 12) {
          f.cook = 0;
          if (!w.flags.has("cooked")) {
            w.flags.add("cooked");
            w.toast("🍢", "Cooking fish over the fire!", f.x, f.y, FACTS.cooked);
          }
        }
      }
    }
  }
}
