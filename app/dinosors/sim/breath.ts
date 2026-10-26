/* ------------------------------------------------------------------ */
/*  Dragon breath that isn't fire, and the ground it leaves behind.    */
/*                                                                     */
/*  • Hot Sand Breath (Sand Dragons): a blast of super-heated sand.    */
/*    It scorches whatever it hits, and leaves a patch of glowing hot  */
/*    sand under a drifting dust plume (hard to see through). The      */
/*    patch burns anyone standing in it, then cools: dull red, then    */
/*    plain sand. Where it landed on grass or dirt, a drift of sand    */
/*    stays behind for good.                                           */
/*  • Frost (Ice Dragons): a freezing blast that chills + slows        */
/*    everything it touches and ices the ground over for a while.     */
/*                                                                     */
/*  Patches are a small pooled list, ticked a few times a second.      */
/* ------------------------------------------------------------------ */
import type { BreathKind } from "../data/dragons";
import { setState, emote, sizeOf } from "./dinos";
import { hurtHuman } from "./injury";
import { P } from "./particles";
import { isWaterTile } from "./terrain";
import { MAP_W, T, TILE, type Dragon } from "./types";
import type { World } from "./world";
import { hitChariot } from "./chariots";
import { hitDino } from "./tribe";
import { hitScorpionsAt, sideOfDragon } from "./factions";

export type HazardKind = "hotSand" | "frost";

export interface Hazard {
  kind: HazardKind;
  x: number;
  y: number;
  r: number;
  /** seconds since it landed */
  t: number;
  /** seconds until it's gone (hot sand cools, ice melts) */
  life: number;
  /** a dragon of ours made it (it doesn't hurt our own people) */
  ours?: boolean;
}

/** how many patches can be about at once (the oldest goes first) */
const MAX_PATCHES = 36;
const HOT_LIFE = 16;
const FROST_LIFE = 22;
/** patches closer than this merge into the one already there (refreshed + a bit bigger) */
const MERGE = 46;

/** 0..1: how hot / frozen a patch still is. */
export const strength = (h: Hazard) => Math.max(0, 1 - h.t / h.life);

export class Hazards {
  list: Hazard[] = [];
  private tickT = 0;

  add(w: World, kind: HazardKind, x: number, y: number, r: number, ours = false) {
    if (isWaterTile(w.terrain.tileAt(x, y)) && kind === "hotSand") {
      // hot sand hissing into water: just steam
      w.particles.burst(P.Steam, x, y, 5, 30, { size: 14, max: 1.2, color: "rgba(235,235,230,0.6)" });
      return null;
    }
    const near = this.list.find((h) => h.kind === kind && Math.abs(h.x - x) < MERGE && Math.abs(h.y - y) < MERGE);
    if (near) {
      near.t = Math.min(near.t, near.life * 0.15);
      near.r = Math.min(near.r + 4, r * 1.6);
      return near;
    }
    const h: Hazard = { kind, x, y, r, t: 0, life: kind === "hotSand" ? HOT_LIFE : FROST_LIFE, ...(ours ? { ours } : {}) };
    if (this.list.length >= MAX_PATCHES) this.expire(w, this.list.shift()!);
    this.list.push(h);
    return h;
  }

  update(w: World, dt: number) {
    if (!this.list.length) return;
    for (const h of this.list) h.t += dt;
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].t < this.list[i].life) continue;
      this.expire(w, this.list[i]);
      this.list.splice(i, 1);
    }
    // the little effects only where someone can see
    for (const h of this.list) {
      if (!w.inView(h.x, h.y, h.r + 40)) continue;
      const s = strength(h);
      if (h.kind === "hotSand" && w.rng() < dt * 6 * s) w.particles.spawn(P.Ember, h.x + (w.rng() - 0.5) * h.r * 1.4, h.y + (w.rng() - 0.5) * h.r * 0.8, { z: 2, vz: 18 + w.rng() * 20, size: 2 + w.rng() * 2.5, max: 0.7, color: w.rng() < 0.5 ? "#ffb347" : "#ff6a2a" });
      if (h.kind === "hotSand" && s > 0.45 && w.rng() < dt * 2.5) w.particles.spawn(P.Smoke, h.x + (w.rng() - 0.5) * h.r, h.y, { vz: 14, vx: w.weather.windX * 10, size: 22 + w.rng() * 18, max: 2.2, color: "rgba(214,184,128,0.5)" });
      if (h.kind === "frost" && w.rng() < dt * 3 * s) w.particles.spawn(P.Spark, h.x + (w.rng() - 0.5) * h.r * 1.4, h.y + (w.rng() - 0.5) * h.r * 0.8, { z: 4, vz: 10, size: 2, max: 0.8, color: "#e8f8ff" });
    }
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = 0.5;
    for (const h of this.list) this.touch(w, h, strength(h));
  }

  /** Twice a second: burn / chill whatever is standing in a patch. */
  private touch(w: World, h: Hazard, s: number) {
    if (s <= 0.05) return;
    const r2 = h.r * h.r;
    const inside = (p: { x: number; y: number }) => (p.x - h.x) ** 2 + (p.y - h.y) ** 2 < r2;
    for (const p of w.humans) {
      if (p.under || p.aloft || p.ferry || p.level || !inside(p)) continue;
      if (h.ours && !p.captive && !p.stranger) continue;
      if (h.kind === "hotSand") hurtHuman(w, p, 0.05 * s, h.x, h.y, "burn");
      else {
        p.slowT = Math.max(p.slowT ?? 0, 1.2);
        p.warmth = Math.max(0, p.warmth - 0.06 * s);
      }
    }
    for (const b of w.rivals.brutes) {
      if (b.z > 10 || b.snatched || !inside(b)) continue;
      // the Sand People's thick wrappings + sandals: hot sand barely bothers them
      if (h.kind === "hotSand") w.rivals.hit(w, b, (b.sand ? 0.01 : 0.05) * s, h.x, h.y, true, "fire");
      else b.slowT = Math.max(b.slowT ?? 0, 1.2);
    }
    for (const d of w.dinos) {
      if (d.under || d.z > 10 || !inside(d)) continue;
      if (h.kind === "hotSand") {
        d.health -= 0.025 * s;
        d.fear = Math.min(1, d.fear + 0.3);
        if (d.state !== "flee" && !d.owner && d.health > 0) setState(d, "flee", d.x + (d.x - h.x) * 3, d.y + (d.y - h.y) * 3);
      } else d.slowT = Math.max(d.slowT ?? 0, 1.2);
    }
  }

  /** A patch has gone cold / melted. Hot sand that landed on grass or dirt leaves a drift of sand. */
  private expire(w: World, h: Hazard) {
    if (h.kind !== "hotSand") return;
    const tx = Math.floor(h.x / TILE);
    const ty = Math.floor(h.y / TILE);
    const t = w.terrain.tiles[ty * MAP_W + tx] as T;
    if ((t === T.Grass || t === T.Dirt || t === T.Rock) && !w.colony.occupied(w).has(ty * MAP_W + tx)) w.terrain.setTile(tx, ty, T.Sand);
  }

  serialize() {
    const r = Math.round;
    return this.list.map((h) => [h.kind === "hotSand" ? 0 : 1, r(h.x), r(h.y), r(h.r), Math.round(h.t * 10) / 10, h.ours ? 1 : 0] as const);
  }

  load(d: ReturnType<Hazards["serialize"]> | undefined) {
    this.list = (d ?? []).map(([k, x, y, r, t, ours]) => ({ kind: k === 0 ? ("hotSand" as const) : ("frost" as const), x, y, r, t, life: k === 0 ? HOT_LIFE : FROST_LIFE, ...(ours ? { ours: true } : {}) }));
  }
}

/**
 * One puff of non-fire breath landing at (fx, fy): hurts what's there (fire's rules for who and
 * how hard, softened), and lays a patch on the ground. `mul` = how hot / cold it runs.
 */
export function breathBlast(w: World, dr: Dragon, fx: number, fy: number, kind: BreathKind, mul = 1) {
  const ours = !!dr.owner;
  const r = 66;
  const frost = kind === "frost";
  if (w.inView(fx, fy, 220)) {
    for (let k = 0; k < 6; k++) {
      const t = w.rng();
      w.particles.spawn(frost ? P.Spark : P.Ember, dr.x + (fx - dr.x) * t + (w.rng() - 0.5) * 26, dr.y + (fy - dr.y) * t, { z: dr.z * (1 - t) + 6, vz: frost ? 6 : 24, vx: dr.vx * 0.3, size: frost ? 3 + w.rng() * 3 : 3 + w.rng() * 4, max: 0.6, color: frost ? (w.rng() < 0.5 ? "#e9fbff" : "#9fd8ff") : w.rng() < 0.4 ? "#ffcf7a" : w.rng() < 0.7 ? "#e2a24c" : "#ff7a2a" });
    }
    w.particles.spawn(P.Smoke, fx, fy, { z: 10, vz: 18, size: 30, max: 1.6, color: frost ? "rgba(225,245,255,0.55)" : "rgba(222,190,130,0.6)" });
  }
  w.sfx(frost ? "whoosh" : "ignite", fx, fy, 0.6, frost ? 1.5 : 0.5);
  w.hazards.add(w, frost ? "frost" : "hotSand", fx, fy, r * 0.75, ours);
  // a frosty blast ices over still shallow water for a while
  const dmgH = (frost ? 0.18 : 0.26) * mul;
  for (const h of w.humans) {
    if (h.chariot || h.under || h.aloft === dr.id) continue;
    if (ours && !h.captive && !h.stranger) continue;
    if (Math.hypot(h.x - fx, h.y - fy) > r) continue;
    const home = h.state === "hide" || h.state === "sleep" || h.state === "rest" ? w.shelters.find((s) => s.id === h.home) : null;
    if (home && home.tier >= 3) continue;
    hurtHuman(w, h, dmgH, fx, fy, frost ? "cold" : "burn");
    if (frost) {
      h.slowT = Math.max(h.slowT ?? 0, 3.5);
      h.warmth = Math.max(0, h.warmth - 0.25);
    }
  }
  for (const b of [...w.rivals.brutes]) {
    if (b.snatched || b.onDragon || Math.hypot(b.x - fx, b.y - fy) > r) continue;
    // a Sand Dragon never scorches its own people
    if (dr.sandTribe && b.sand === dr.sandTribe) continue;
    w.rivals.hit(w, b, (frost ? 0.16 : 0.22) * mul, fx, fy, true, "fire");
    if (frost) b.slowT = Math.max(b.slowT ?? 0, 3.5);
  }
  for (const d of w.dinos) {
    if (d.under || (ours && d.owner) || Math.hypot(d.x - fx, d.y - fy) > r + sizeOf(d) * 0.3) continue;
    hitDino(w, d, (frost ? 12 : 16) * mul, fx, fy);
    if (frost) {
      d.slowT = Math.max(d.slowT ?? 0, 4);
      emote(d, "🥶", 1.4);
    }
  }
  for (const ch of [...w.colony.chariots]) if (!ours && Math.hypot(ch.x - fx, ch.y - fy) < r + 40) hitChariot(w, ch, 5 * mul, dr.name);
  if (!ours) for (const o of w.dragons.owned) if (Math.hypot(o.x - fx, o.y - fy) < r + 40 && Math.abs(o.z - dr.z * 0.5) < 160) {
    o.hp -= 12 * mul;
    o.hit = 1;
    if (frost) o.stamina = Math.max(0, (o.stamina ?? 1) - 0.02);
  }
  // our Scorpions: an enemy's breath chips them, our own dragons' never does (factions.ts)
  hitScorpionsAt(w, fx, fy, r * 0.8, (frost ? 6 : 10) * mul, sideOfDragon(dr));
  // hot sand scours plants + timber; frost does neither
  if (!frost) {
    w.burnPlantsAt(fx, fy, 0.25);
    for (const b of w.colony.buildings) if (Math.hypot(b.x - fx, b.y - fy) < 56) b.hp -= 8;
  }
}
