/* Work schedules share the existing jobs, sleep states, forge and energy grid. */
import type { Human } from "./types";
import type { World } from "./world";
import { pyramidAwake } from "../data/civ";

export type ShiftMode = "all" | "split";
export type Shift = "day" | "night";

export class Shifts {
  mode: ShiftMode = "all";
  auto = true;
  /** Steady energy per second, recomputed with the other grid loads. */
  draw = 0;
  powered = new Set<number>();
  private checkT = 0;

  workers(w: World) { return w.humans.filter((h) => !h.child && !h.stranger && !h.captive); }
  pyramid(w: World) { return w.colony.buildings.some(pyramidAwake); }
  active(w: World, h: Human) {
    if (this.mode === "all" || !h.shift) return true;
    // A predictable per-person offset lets the next crew take over gradually.
    const offset = (h.id % 9) * 0.11;
    const hour = (w.time - offset + 24) % 24;
    // Guards overlap around sunrise and sunset, including the stagger offset.
    if (w.tribe.roleOf(h) === "guard") return h.shift === "day" ? hour >= 5.5 && hour < 18.5 : hour < 6.5 || hour >= 17.5;
    return h.shift === "day" ? hour >= 6 && hour < 18 : hour < 6 || hour >= 18;
  }
  poweredOutfit(_w: World, h: Human) { return this.powered.has(h.id) && (h.gear.outfit === "nightLit" || h.gear.outfit === "nightArmor"); }

  setMode(w: World, mode: ShiftMode) {
    this.mode = mode;
    if (mode === "all") {
      for (const h of w.humans) { h.shift = undefined; h.shiftManual = false; }
      this.powered.clear(); this.draw = 0;
    } else this.balance(w);
  }
  assign(w: World, h: Human, shift: Shift) {
    if (h.child || h.stranger || h.captive) return;
    this.mode = "split";
    h.shift = shift;
    h.shiftManual = true;
  }
  balance(w: World) {
    if (this.mode !== "split") return;
    const people = this.workers(w);
    if (!people.length) return;
    const foodLow = w.tribe.foodTotal(w) < people.length * 2;
    const projects = w.colony.buildings.some((b) => b.built < 1);
    const danger = w.tribe.danger !== "calm" || !!w.tribe.raid;
    const score = (h: Human) => {
      const r = w.tribe.roleOf(h);
      return (r === "guard" ? 100 + (danger ? 20 : 0) : 0)
        + (r === "miner" ? 88 : 0) + (r === "builder" ? 65 + (projects ? 16 : 0) : 0)
        + (r === "gatherer" ? 55 + (foodLow ? 12 : 0) : 0)
        + (r === "technician" ? 52 : 0) + (r === "farmer" ? 30 - (w.weather.storm > 0.5 ? 12 : 0) : 0)
        + (r === "researcher" ? 45 : 0) + (h.gear.outfit?.startsWith("night") ? 16 : 0)
        + (h.id % 11) / 20;
    };
    const target = people.length < 2 ? 0 : Math.max(1, Math.floor(people.length * (danger ? 0.46 : projects || foodLow ? 0.42 : 0.38)));
    const fixedNight = people.filter((h) => h.shiftManual && h.shift === "night").length;
    const flexible = people.filter((h) => !h.shiftManual).sort((a, b) => score(b) - score(a));
    const night = Math.max(0, target - fixedNight);
    const guards = people.filter((h) => w.tribe.roleOf(h) === "guard");
    const dayGuards = guards.filter((h) => h.shiftManual && h.shift === "day").length;
    const guardNightLimit = guards.length > 1 && !dayGuards ? guards.length - 1 : guards.length;
    let nightCount = 0;
    let nightGuards = fixedNight && guards.filter((h) => h.shiftManual && h.shift === "night").length || 0;
    for (const h of flexible) {
      const guard = w.tribe.roleOf(h) === "guard";
      if (nightCount < night && (!guard || nightGuards < guardNightLimit)) {
        h.shift = "night"; nightCount++; if (guard) nightGuards++;
      } else h.shift = "day";
    }
  }
  update(w: World, dt: number) {
    this.checkT -= dt;
    if (this.checkT > 0) return;
    this.checkT = 1;
    if (this.auto) this.balance(w);
    const previousDraw = this.draw;
    this.powered.clear();
    this.draw = 0;
    if (this.mode !== "split" || !this.pyramid(w) || w.civ.energy <= 0.5 || !w.civ.has("energyLitClothing")) return;
    const equipped = this.workers(w).filter((h) => h.shift === "night" && this.active(w, h) && (h.gear.outfit === "nightLit" || h.gear.outfit === "nightArmor"));
    // Keep existing grid loads paid first; lights cost little, tools more.
    const spare = Math.max(0, w.civ.gen - (w.civ.use - previousDraw) + Math.min(w.civ.energy / 60, 1));
    for (const h of equipped) {
      const cost = w.civ.has("advancedNightOps") ? 0.055 : 0.035;
      if (this.draw + cost > spare) break;
      this.powered.add(h.id);
      this.draw += cost;
    }
  }
  load(d?: { mode?: ShiftMode; auto?: boolean }) {
    this.mode = d?.mode === "split" ? "split" : "all";
    this.auto = d?.auto !== false;
    this.checkT = 0;
  }
  serialize() { return { mode: this.mode, auto: this.auto }; }
}
