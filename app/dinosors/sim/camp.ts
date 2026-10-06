/* ------------------------------------------------------------------ */
/*  The cave-people's camp: a shared stockpile, a tech goal they work  */
/*  toward, crafting sequences (shown step by step), campfires and     */
/*  shelters that go up in stages.                                     */
/* ------------------------------------------------------------------ */
import { FACTS, TECH, TECH_ORDER } from "../data/facts";
import { HOUSING } from "../data/colony";
import { P } from "./particles";
import { LM, cliffY } from "./terrain";
import { TILE, type Campfire, type Resource, type Shelter, type ShelterPlan, type TechId } from "./types";
import { shelterDone, stagesOf } from "./build";
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
  farming: ["Save the best seeds", "Dig a field", "Plant + water", "Crops!"],
  palisade: ["Sharpen the logs", "Dig a trench", "Stand them up!"],
  bow: ["Bend a springy branch", "Twist a strong string", "Feather the arrows", "Twang!"],
  tower: ["Pick tall logs", "Lash a platform", "Climb up!"],
  crossbow: ["Carve the stock", "Fit the bow", "Load a bolt", "Thunk!"],
  stonewall: ["Shape square stones", "Stack them up", "Rock solid!"],
  medicine: ["Pick healing leaves", "Crush them into paste", "Wrap the wound", "All better!"],
  taming: ["Find a gentle giant", "Offer some berries", "Move slowly…", "Friends!"],
  smelting: ["Build a clay furnace", "Pile in ore + charcoal", "Pump the bellows!", "Glowing metal!"],
  scorpion: ["Carve a huge bow", "Twist the torsion ropes", "Fit the slider", "THWACK!"],
  firefighting: ["Weave grass beaters", "Dig a fire break", "Pass the water along!", "Fire's out!"],
};

export class Camp {
  x = LM.camp.x * TILE + TILE / 2;
  y = LM.camp.y * TILE + TILE / 2;
  caveX = LM.cave.x * TILE + TILE / 2;
  caveY = 0;
  stock: Stock = { stick: 0, stone: 0, grass: 0, leaves: 0, wood: 0, fish: 0, berries: 2, meat: 0, cooked: 0, crop: 0, water: 0, clay: 0, iron: 0, gold: 0, obsidian: 0, flint: 0, tar: 0, salt: 0, hide: 0, bone: 0, tooth: 0 };
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
      const st = stagesOf(site)[site.stage];
      const need = st.need;
      if (need === "wood" && !this.learned.has("axe")) return null;
      if (this.stock[need] < st.n - site.have) return need;
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
    return w.shelters.find((s) => !shelterDone(s)) ?? null;
  }

  ensureShelterSite(w: World) {
    if (this.activeShelter(w)) return;
    const n = w.shelters.length;
    const a = -0.6 + n * 1.1;
    this.addShelter(w, this.x + Math.cos(a) * 130, this.y + 40 + Math.sin(a) * 60);
  }

  addShelter(w: World, x: number, y: number, plan: ShelterPlan = "hut") {
    const s: Shelter = { id: w.nextId(), x, y, stage: 0, have: 0, plan, tier: plan === "tent" ? 0 : 2, hp: 1, up: false, upHave: {} };
    w.shelters.push(s);
    w.shelterVersion++;
    return s;
  }

  /** Plan the next housing tier for a finished home. */
  startUpgrade(w: World, s: Shelter) {
    if (!shelterDone(s) || s.up || !HOUSING[s.tier + 1]) return false;
    s.up = true;
    s.upHave = {};
    const next = HOUSING[s.tier + 1];
    w.toast(next.icon, `Builders will turn this ${HOUSING[s.tier].name.toLowerCase()} into a ${next.name.toLowerCase()}.`, s.x, s.y);
    return true;
  }

  upgradeShelter(w: World, s: Shelter) {
    if (!HOUSING[s.tier + 1]) return;
    // salvage: half of what the old home was made of goes back on the stockpile
    const old = s.tier === 0 && s.plan === "tent" ? { stick: 3, leaves: 3 } : HOUSING[s.tier].cost;
    const back: string[] = [];
    for (const [r, n] of Object.entries(old) as [Resource, number][]) {
      const k = Math.floor(n / 2);
      if (k > 0) {
        this.stock[r] += k;
        back.push(`${k} ${r}`);
      }
    }
    if (back.length && !w.flags.has("salvageTip")) {
      w.flags.add("salvageTip");
      w.toast("♻️", `Old materials salvaged: ${back.join(", ")} back on the stockpile.`, s.x, s.y);
    }
    s.tier++;
    s.up = false;
    s.upHave = {};
    s.hp = 1;
    w.shelterVersion++;
    const t = HOUSING[s.tier];
    w.particles.burst(P.Dust, s.x, s.y, 12, 60, { size: 9, max: 1, color: "rgba(170,150,120,0.55)" });
    w.sfx("build", s.x, s.y, 0.9);
    w.celebrate(t.hearth ? "Warm home!" : "Nice!");
    w.toast(t.icon, `Upgraded to a ${t.name}! Room for ${t.cap}${t.hearth ? ", with a cosy hearth inside" : ""}.`, s.x, s.y);
    if (s.tier >= 4) w.discover("stoneHouse", s.x, s.y);
  }

  relight(w: World, f: Campfire) {
    f.lit = true;
    f.fuel = 1;
    w.sfx("ignite", f.x, f.y, 0.6);
    w.particles.burst(P.Spark, f.x, f.y, 6, 30, { vz: 40, g: 160, size: 2, max: 0.5, color: "#ffe680" });
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
    const stage = stagesOf(s)[s.stage];
    if (!stage || stage.need !== r) return 0;
    const used = Math.min(n, stage.n - s.have);
    s.have += used;
    return used;
  }

  advanceShelter(w: World, s: Shelter) {
    if (shelterDone(s)) return;
    s.stage++;
    s.have = 0;
    w.shelterVersion++;
    w.particles.burst(P.Dust, s.x, s.y, 10, 60, { size: 8, max: 1, color: "rgba(160,130,90,0.5)" });
    w.sfx("build", s.x, s.y, 0.8);
    if (shelterDone(s)) {
      const first = !this.learned.has("shelter");
      this.learned.add("shelter");
      s.hp = 1;
      w.celebrate("Home!");
      w.discover("shelterDone", s.x, s.y);
      if (first) w.toast(HOUSING[s.tier].icon, `A ${HOUSING[s.tier].name.toLowerCase()}! Now they can stay dry in storms. Tap it to see who lives there.`, s.x, s.y, TECH.shelter.fact);
      if (this.goal === "shelter") {
        this.goal = null;
        this.pickGoal();
      }
    }
  }

  private relightT = 0;

  update(w: World, dt: number) {
    // somebody always gets the fire going again once it's dry
    const out = this.learned.has("fire") ? w.campfires.find((f) => !f.lit) : undefined;
    if (out && w.weather.rain < 0.3 && w.weather.snow < 0.5 && this.stock.stick >= 2) {
      this.relightT += dt;
      if (this.relightT > 12) {
        this.relightT = 0;
        this.stock.stick -= 2;
        this.relight(w, out);
      }
    } else this.relightT = 0;
    // fire + falling rocks wear houses down; a broken home falls back to rubble (a blueprint)
    for (const s of w.shelters) {
      if (s.stage === 0) continue;
      const tx = Math.floor(s.x / TILE);
      const ty = Math.floor((s.y - 12) / TILE);
      const heat = w.fire.at(tx, ty) + w.lava.heatAt(tx, ty) * 2;
      if (heat > 0.3) s.hp -= dt * 0.08 * heat * (1 - HOUSING[s.tier].protect * 0.8);
      if (s.hp <= 0) {
        s.hp = 1;
        s.stage = 0;
        s.have = 0;
        s.up = false;
        s.upHave = {};
        w.shelterVersion++;
        w.particles.burst(P.Smoke, s.x, s.y - 10, 12, 40, { vz: 30, size: 14, max: 2, color: "rgba(60,55,50,0.6)" });
        w.toast("🔥", `A ${HOUSING[s.tier].name.toLowerCase()} burned down! Builders can raise it again.`, s.x, s.y);
      }
    }
    for (const f of w.campfires) {
      if (!f.lit) continue;
      const sheltered = w.colony.kits.has("hideCovers") || w.shelters.some((s) => shelterDone(s) && Math.hypot(s.x - f.x, s.y - f.y) < 70);
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
