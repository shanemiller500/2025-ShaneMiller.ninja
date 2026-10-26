/* ------------------------------------------------------------------ */
/*  Dragon Shields (fantasy tech: the Resonance's frequency pylons).   */
/*                                                                     */
/*  Tall crystal-topped pylons set round the edge of the settlement.   */
/*  Each covers a circle; shields near each other knit their circles   */
/*  into one wider field (and overlapping fields hum stronger). They   */
/*  never hurt a dragon: they rattle it.                               */
/*                                                                     */
/*  A hostile dragon (wild, or a Sand People war dragon) coming into   */
/*  the field wakes the pylons: they charge up (a second or two), the   */
/*  hum rises into visible frequency rings, and the dragon inside gets  */
/*  irritated (it slows, wobbles, shakes its head) and then, rattled,  */
/*  it turns tail: out of the field, and on away from the town. A      */
/*  dragon that lives nearby goes home; a visitor leaves the valley.   */
/*  Big, furious or raging dragons shrug a weak hum off, so stronger   */
/*  (upgraded) shields repel them more reliably.                       */
/*                                                                     */
/*  They run on the settlement's energy grid (civ.energy): a little    */
/*  idle hum, and a real draw while they're pushing a dragon away. No  */
/*  energy: the pylons go dark and dragons fly straight through.       */
/*                                                                     */
/*  Charge + who's rattled are moment-to-moment (not saved); the       */
/*  shields themselves + their upgrades are saved with the buildings.  */
/* ------------------------------------------------------------------ */
import type { Cost } from "../data/colony";
import { flyToward } from "./dragonKeep";
import { P } from "./particles";
import type { Building, Dragon, Resource } from "./types";
import type { World } from "./world";

export type ShieldUp = "radius" | "force" | "eff" | "speed" | "link";
export interface ShieldLevels {
  radius: number;
  force: number;
  eff: number;
  speed: number;
  link: number;
}

export const SHIELD = {
  /** field radius (px) at level 0, and per Radius upgrade */
  r: 400,
  rUp: 95,
  /** seconds to charge from cold, and how much faster each Activation upgrade makes it */
  charge: 2.6,
  chargeUp: 0.6,
  /** energy / second while pushing one dragon (less per Efficiency upgrade) */
  drain: 1.8,
  effUp: 0.22,
  /** repelling strength at level 0, and per Force upgrade */
  force: 1,
  forceUp: 0.65,
  /** shields this much further apart than their radii still knit into one field (more with Coverage upgrades) */
  linkReach: 1.12,
  linkUp: 0.12,
  /** how long a rattled dragon keeps flying away after it's out of the field (s) */
  away: 14,
  max: 3,
};

export const SHIELD_UPS: Record<ShieldUp, { icon: string; name: string; tip: string; cost: (lvl: number) => Cost }> = {
  radius: { icon: "⭕", name: "Wider field", tip: "The field reaches further out.", cost: (l) => ({ copper: 2 + l, quartz: 1 + l }) },
  force: { icon: "💥", name: "Stronger hum", tip: "Rattles bigger, angrier dragons (fury + rage resist a weak hum).", cost: (l) => ({ crystal: 1 + l, magnetite: 1 + l }) },
  eff: { icon: "🔋", name: "Efficient coils", tip: "Uses less energy while it pushes a dragon away.", cost: (l) => ({ copper: 2 + l * 2 }) },
  speed: { icon: "⚡", name: "Quick start", tip: "Charges up faster when a dragon comes in.", cost: (l) => ({ quartz: 1 + l, copper: 1 }) },
  link: { icon: "🔗", name: "Field links", tip: "Knits into neighbouring shields from further off, and overlapping fields hum harder.", cost: (l) => ({ magnetite: 1 + l, shaped: 1 + l }) },
};
export const SHIELD_UP_ORDER: ShieldUp[] = ["radius", "force", "eff", "speed", "link"];

const levels = (b: Building): ShieldLevels => b.shield ?? { radius: 0, force: 0, eff: 0, speed: 0, link: 0 };
export const shieldRadius = (b: Building) => SHIELD.r + levels(b).radius * SHIELD.rUp;
const shieldForce = (b: Building) => SHIELD.force + levels(b).force * SHIELD.forceUp;
const chargeTime = (b: Building) => Math.max(0.6, SHIELD.charge - levels(b).speed * SHIELD.chargeUp);
const drainOf = (b: Building) => SHIELD.drain * (1 - levels(b).eff * SHIELD.effUp);

/** What the field is doing right now (per world, not saved). */
interface ShieldState {
  /** 0..1 charge per shield id */
  charge: Map<number, number>;
  /** dragons inside the field this frame (for the art) → the shield pushing them */
  pushing: Map<number, number>;
}
const states = new WeakMap<World, ShieldState>();
function stateOf(w: World) {
  let s = states.get(w);
  if (!s) states.set(w, (s = { charge: new Map(), pushing: new Map() }));
  return s;
}

/** The finished, standing shields. */
export function shieldsOf(w: World) {
  return w.colony.buildings.filter((b) => b.kind === "dragonShield" && b.built >= 1 && b.hp > 0);
}

/** Is the grid able to run them? */
export const shieldsPowered = (w: World) => w.civ.energy > 0.5;

/** Hostile to the town: a wild dragon (not one at the monks' rite) or a Sand People war dragon. */
const hostile = (dr: Dragon) => !dr.owner && !dr.monkRite && dr.state !== "offering";

/** How hard a dragon is to rattle (1 = an ordinary adult). */
export function resistOf(dr: Dragon) {
  return 1 + (dr.fury ? 3 : 0) + (dr.rage ?? 0) * 0.8 + (dr.vet ?? 0) * 0.5 + (dr.breed === "heavy" || dr.breed === "mountain" ? 0.3 : 0) + (dr.young ? -0.4 : 0);
}

/** The shields whose (knitted) field covers (x, y), and how hard the hum is there. */
export function fieldAt(w: World, x: number, y: number, list = shieldsOf(w)) {
  let power = 0;
  let near: Building | null = null;
  let nd = Infinity;
  let n = 0;
  let link = 0;
  for (const b of list) {
    const d = Math.hypot(b.x - x, b.y - y);
    if (d > shieldRadius(b)) continue;
    n++;
    power += shieldForce(b) * (1 - (d / shieldRadius(b)) * 0.35);
    link = Math.max(link, levels(b).link);
    if (d < nd) {
      nd = d;
      near = b;
    }
  }
  // overlapping fields reinforce each other (more so with Field links)
  if (n > 1) power *= 1 + 0.12 * (n - 1) * (1 + link * 0.5);
  return { power, near, n };
}

/** Which shields knit together (for the art + the coverage view): pairs whose fields reach each other. */
export function shieldLinks(w: World, list = shieldsOf(w)) {
  const out: [Building, Building][] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i];
    const b = list[j];
    const reach = (shieldRadius(a) + shieldRadius(b)) * (SHIELD.linkReach + Math.max(levels(a).link, levels(b).link) * SHIELD.linkUp) * 0.5;
    if (Math.hypot(a.x - b.x, a.y - b.y) < reach * 1.6) out.push([a, b]);
  }
  return out;
}

/** For the renderer: each shield's charge (0..1), and which dragon each one is pushing. */
export function shieldView(w: World) {
  const s = stateOf(w);
  return { charge: s.charge, pushing: s.pushing, powered: shieldsPowered(w) };
}

/** Upgrade one shield (pays from the stores). Returns why not, or null. */
export function upgradeShield(w: World, b: Building, key: ShieldUp): string | null {
  if (b.kind !== "dragonShield") return "That isn't a Dragon Shield.";
  const lv = levels(b);
  if (lv[key] >= SHIELD.max) return `${SHIELD_UPS[key].name} is already at its best.`;
  const cost = SHIELD_UPS[key].cost(lv[key]);
  if (!w.colony.affordable(w, cost)) return `Needs ${Object.entries(cost).map(([r, n]) => `${n} ${r}`).join(", ")}.`;
  for (const [r, n] of Object.entries(cost) as [Resource, number][]) w.camp.stock[r] -= n;
  b.shield = { ...lv, [key]: lv[key] + 1 };
  w.particles.burst(P.Spark, b.x, b.y - 40, 16, 70, { z: 30, size: 3, max: 0.8, color: "#8ff4ff" });
  w.sfx("zap", b.x, b.y, 0.6, 1.4);
  return null;
}

/**
 * Every frame (from Dragons.update): charge the pylons near hostile dragons, rattle the dragons in a
 * charged field, and draw energy while they push. Cheap: a handful of shields × a handful of dragons.
 */
export function shieldsTick(w: World, dt: number) {
  const st = stateOf(w);
  st.pushing.clear();
  const list = shieldsOf(w);
  if (!list.length) {
    st.charge.clear();
    return;
  }
  const powered = shieldsPowered(w);
  const hot = new Set<number>();
  if (powered) {
    for (const dr of w.dragons.list) {
      if (!hostile(dr)) continue;
      for (const b of list) {
        // the pylons wake as one comes near (a little beyond the field's edge)
        if (Math.hypot(b.x - dr.x, b.y - dr.y) < shieldRadius(b) * 1.18) hot.add(b.id);
      }
    }
  }
  for (const b of list) {
    const c = st.charge.get(b.id) ?? 0;
    st.charge.set(b.id, hot.has(b.id) ? Math.min(1, c + dt / chargeTime(b)) : Math.max(0, c - dt * (powered ? 0.4 : 2)));
  }
  if (!powered) return;
  for (const dr of w.dragons.list) {
    if (!hostile(dr)) continue;
    const f = fieldAt(w, dr.x, dr.y, list);
    if (!f.near || (st.charge.get(f.near.id) ?? 0) < 1) continue;
    // in a live field: it gets more and more rattled (a weak hum barely bothers a strong dragon)
    const eff = f.power / resistOf(dr);
    const r = dr.repel ?? { k: 0, x: f.near.x, y: f.near.y, t: 0, away: 0 };
    r.k = Math.min(1.5, Math.max(0, r.k + dt * (eff * 0.75 - 0.18)));
    r.x = f.near.x;
    r.y = f.near.y;
    r.t += dt;
    r.away = SHIELD.away;
    dr.repel = r;
    st.pushing.set(dr.id, f.near.id);
    w.civ.energy = Math.max(0, w.civ.energy - drainOf(f.near) * dt);
    if (w.inView(dr.x, dr.y, 200) && w.rng() < dt * 10) w.particles.spawn(P.Spark, dr.x + (w.rng() - 0.5) * 70, dr.y + (w.rng() - 0.5) * 30, { z: dr.z + 10 + w.rng() * 40, vz: 20, size: 2.5, max: 0.45, color: w.rng() < 0.5 ? "#9ff4ff" : "#d5b8ff" });
    if (!w.flags.has("dragonShieldWorks")) {
      w.flags.add("dragonShieldWorks");
      w.discover("dragonShield", dr.x, dr.y);
      w.toast("🛡️", `The Dragon Shield is humming! ${dr.name} is caught in the frequency: rattled, it'll turn away from the town (it isn't hurt). Shields draw energy while they push.`, dr.x, dr.y);
    }
  }
}

/**
 * A rattled dragon's turn (from the dragon brains, before anything else). True = the shield has it:
 * it flies out of the field and away, wobbling, and does nothing else. While only irritated
 * (not yet rattled) it slows and wobbles but keeps its own plan. Returns false once it's over.
 */
export function repelStep(w: World, dr: Dragon, dt: number): boolean {
  const r = dr.repel;
  if (!r) return false;
  const inField = stateOf(w).pushing.has(dr.id);
  if (!inField) {
    // out of the field (or the shields went dark): it keeps clear for a while, then it's over
    r.k = Math.max(0, r.k - dt * 0.12);
    r.away -= dt;
    if (r.away <= 0 || r.k <= 0.05) {
      dr.repel = undefined;
      afterRepel(w, dr);
      return false;
    }
  }
  // irritated, not yet rattled: slowed + wobbling, but still flying its own plan
  if (r.k < 1 && inField) {
    const slow = 1 - Math.min(0.7, r.k * 0.8) * Math.min(1, dt * 4);
    dr.vx *= slow;
    dr.vy *= slow;
    dr.bank = Math.sin(w.elapsed * 7 + dr.id) * 0.25 * r.k;
    return false;
  }
  if (r.k < 1 && !inField) return false;
  // rattled: out of here, the long way round from the pylon, swaying + shaking its head
  if (dr.prey === undefined && dr.state !== "flee") dr.state = "flee";
  const a = Math.atan2(dr.y - r.y, dr.x - r.x) + Math.sin(w.elapsed * 1.7 + dr.id) * 0.35;
  const far = 900;
  flyToward(w, dr, dr.x + Math.cos(a) * far, dr.y + Math.sin(a) * far * 0.7, Math.max(120, dr.z), dt, inField ? 0.85 : 1);
  dr.bank = Math.sin(w.elapsed * 6 + dr.id) * 0.32;
  dr.breath = 0;
  dr.fireAt = undefined;
  if (inField && w.rng() < dt * 0.6) {
    w.sfx("screech", dr.x, dr.y, 0.7, 1.25);
    if (w.rng() < 0.5) dr.dir = dr.dir === 1 ? -1 : 1;
  }
  return true;
}

/** Shaken off: a dragon with a home goes there; a visitor leaves the valley (it doesn't simply vanish). */
function afterRepel(w: World, dr: Dragon) {
  if (dr.owner || dr.sandTribe) return;
  if (dr.nest) {
    dr.state = "home";
    dr.t = 0;
    return;
  }
  const a = Math.atan2(dr.y - w.camp.y, dr.x - w.camp.x);
  dr.state = "leave";
  dr.t = 0;
  dr.tx = dr.x + Math.cos(a) * 7000;
  dr.ty = dr.y + Math.sin(a) * 7000;
}
