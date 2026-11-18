/* ------------------------------------------------------------------ */
/*  The mountain ranges' animals (terrain generation 5: RANGES).       */
/*                                                                     */
/*   • Mountain goats: white, woolly, bearded, on the snow-capped      */
/*     ranges (Sentinel, Icefang) up on the high snowfields + scree.   */
/*   • Bighorn sheep: sandy, curling-horned, on the rocky ranges       */
/*     (Mossback, Redrock), up on the bare stone.                      */
/*   • Mountain lions: one or two on every range, lone ambush hunters  */
/*     that stalk the goats + bighorns among the rocks and pines.      */
/*                                                                     */
/*  Each keeps to its own range: one that strays off it (chasing, or   */
/*  pushed) heads back up. Goats + bighorns are sure-footed: scree +   */
/*  snow don't slow them. The ranges keep their numbers topped up the  */
/*  way the Great Peaks do (SnowLife): a first herd arrives a little   */
/*  into the game, and newcomers walk in now and then if they dwindle. */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { addDino, findSpawnSpot, setState } from "./dinos";
import { makeRng, type Rng } from "./rng";
import { passAt, RANGES } from "./terrain";
import { MAP_H, MAP_W, T, TILE, type Dino, type SpeciesId } from "./types";
import type { World } from "./world";

const LIST: SpeciesId[] = ["mountainLion", "mountainGoat", "bighorn"];
export const MOUNTAIN_SPECIES = new Set<SpeciesId>(LIST);
export const isMountainBeast = (d: Pick<Dino, "species">) => MOUNTAIN_SPECIES.has(d.species);
/** The climbers: scree + snow don't slow them. */
const CLIMBERS = new Set<SpeciesId>(["mountainGoat", "bighorn", "mountainLion"]);

/** Who lives on a range: goats on the snowy ones, bighorns on the rocky ones, lions on all of them. */
export function rangeSpecies(k: number): SpeciesId[] {
  const r = RANGES[k];
  return r ? ["mountainLion", r.snowy ? "mountainGoat" : "bighorn"] : [];
}
/** How many of each a range keeps (topped up to at least half this). */
const KEEP: Partial<Record<SpeciesId, number>> = { mountainLion: 2, mountainGoat: 6, bighorn: 6 };
/** On its range but this far from home (px): it drifts back toward home (the herd stays together). */
const ROAM = 420;
/** A lion gives up a chase that's taken it off its range and this far from home (px). */
const LEASH = 700;

const rangeAt = (w: World, x: number, y: number) => {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 0;
  return w.terrain.range[ty * MAP_W + tx];
};

/** The range an animal lives on (from its home; -1 = none). */
export const homeRange = (w: World, d: Pick<Dino, "homeX" | "homeY">) => rangeAt(w, d.homeX, d.homeY) - 1;

/** Ground a climber moves over at full speed. */
export function sureFooted(d: Pick<Dino, "species">, t: T) {
  return CLIMBERS.has(d.species) && (t === T.Rock || t === T.Snow || t === T.Ice || t === T.Dirt);
}

const homesOf = new WeakMap<World, { x: number; y: number }[][]>();

/**
 * A range's homes (px): open ground up on its slopes, spread along it. Goats + bighorns stay high (the
 * scree + snowfields), the lions a little lower (rocks + the pine belt). Always the same spots for a world.
 */
export function rangeHomes(w: World, k: number, high = true): { x: number; y: number }[] {
  let all = homesOf.get(w);
  if (!all) {
    all = [];
    homesOf.set(w, all);
  }
  const key = k * 2 + (high ? 0 : 1);
  if (all[key]) return all[key];
  const out: { x: number; y: number }[] = [];
  const r = RANGES[k];
  const t = w.terrain;
  if (!w.nav.version) w.nav.sync(w);
  if (r && t.hasRanges) {
    const [lo, hi] = high ? [0.45, 0.8] : [0.25, 0.6];
    // walk the crest; on each stretch, take the best open slope spot either side
    for (let s = 0; s < r.pts.length - 1; s++) {
      const [ax, ay] = r.pts[s];
      const [bx, by] = r.pts[s + 1];
      for (const f of [0.3, 0.75]) {
        const cx = ax + (bx - ax) * f;
        const cy = ay + (by - ay) * f;
        let best: { x: number; y: number } | null = null;
        let bs = -Infinity;
        for (let dy = -r.w; dy <= r.w; dy++) {
          for (let dx = -r.w; dx <= r.w; dx++) {
            const tx = Math.round(cx + dx);
            const ty = Math.round(cy + dy);
            if (tx < 1 || ty < 1 || tx >= MAP_W - 1 || ty >= MAP_H - 1) continue;
            const i = ty * MAP_W + tx;
            if (t.range[i] !== k + 1) continue;
            const e = t.rangeHeight[i];
            if (e < lo || e > hi) continue;
            const px = tx * TILE + TILE / 2;
            const py = ty * TILE + TILE / 2;
            if (!w.nav.passable("dino", px, py)) continue;
            const score = -Math.abs(e - (lo + hi) / 2) * 4 + (t.detail(tx, ty) - 0.5) * 0.3;
            if (score > bs) {
              bs = score;
              best = { x: px, y: py };
            }
          }
        }
        if (best && !out.some((o) => Math.hypot(o.x - best!.x, o.y - best!.y) < 200)) out.push(best);
      }
    }
  }
  all[key] = out;
  return out;
}

/** Somewhere to roam to: open ground on its own range, within a stroll of home (or null). */
export function rangeWander(w: World, d: Dino): { x: number; y: number } | null {
  const k = homeRange(w, d);
  if (k < 0) return null;
  for (let i = 0; i < 12; i++) {
    const a = w.rng() * Math.PI * 2;
    const r = 40 + w.rng() * 260;
    const x = d.homeX + Math.cos(a) * r;
    const y = d.homeY + Math.sin(a) * r * 0.7;
    if (rangeAt(w, x, y) === k + 1 && w.nav.passable("dino", x, y)) return { x, y };
  }
  return { x: d.homeX, y: d.homeY };
}

/** May one lay an egg? Up to the ranges' number for its kind. */
export function mountainMayLay(w: World, s: SpeciesId) {
  let n = 0;
  for (const d of w.dinos) if (d.species === s && !d.under) n++;
  for (const e of w.eggs) if (e.species === s) n++;
  const ranges = RANGES.filter((_, k) => rangeSpecies(k).includes(s)).length;
  return n < (KEEP[s] ?? 2) * ranges;
}

/**
 * A mountain animal's own brain, before the usual one (behavior.ts). True = handled.
 * It keeps to its range: stepped off it (or roamed a long way along it), it heads back up toward home.
 * Hunting, fleeing, eating + going for a drink are left to the usual brain (thirsty, it may go down to water).
 */
export function mountainThink(w: World, d: Dino): boolean {
  if (d.owner || d.rider || d.raider || d.clan || d.caged || d.netted) return false;
  // a lion chasing something right off its range lets it go
  if (d.state === "chase" && Math.hypot(d.x - d.homeX, d.y - d.homeY) > LEASH && rangeAt(w, d.x, d.y) !== homeRange(w, d) + 1 && homeRange(w, d) >= 0) {
    d.targetId = 0;
    setState(d, "wander", d.homeX + (w.rng() - 0.5) * 140, d.homeY + (w.rng() - 0.5) * 100);
    return true;
  }
  if (d.state !== "idle" && d.state !== "wander") return false;
  if (d.thirst > 0.6 || d.hunger > 0.75) return false;
  const k = homeRange(w, d);
  if (k < 0) return false;
  const off = rangeAt(w, d.x, d.y) !== k + 1;
  const far = Math.hypot(d.x - d.homeX, d.y - d.homeY) > ROAM;
  if (!off && !far) return false;
  // (already on the way back)
  if (d.state === "wander" && Math.hypot(d.tx - d.homeX, d.ty - d.homeY) < 120) return false;
  setState(d, "wander", d.homeX + (w.rng() - 0.5) * 140, d.homeY + (w.rng() - 0.5) * 100);
  return true;
}

/** Keeps the ranges stocked (like SnowLife on the Great Peaks): its own dice + a slow tick. */
export class MountainLife {
  /** off in bare test worlds (and wherever wildlife is off); on in every real game */
  enabled = true;
  seeded = false;
  private rng: Rng;
  private tickT = 0;
  private backT: Record<string, number> = {};
  private passT = 0;

  /** The first time one of ours goes over a pass: its name, and the range it crosses. */
  private passTick(w: World) {
    for (const h of w.humans) {
      if (h.stranger || h.child || h.aloft) continue;
      const at = passAt(Math.floor(h.x / TILE), Math.floor(h.y / TILE));
      if (!at) continue;
      const flag = `pass:${at.pass.name}`;
      if (w.flags.has(flag)) continue;
      w.flags.add(flag);
      const kind = at.range.snowy ? "the snow-capped" : at.range.dry ? "the red rock of the" : "the rocky";
      w.toast("🏔️", `${h.name} is over the ${at.pass.name}, through ${kind} ${at.range.name}! Mountain goats, bighorn sheep + mountain lions live up on the ranges, and there's ore on their slopes.`, h.x, h.y);
    }
  }

  constructor(seed = 1) {
    this.rng = makeRng(seed * 151 + 29);
  }

  update(w: World, dt: number) {
    if (!this.enabled || !w.terrain.hasRanges) return;
    this.passT -= dt;
    if (this.passT <= 0) {
      this.passT = 2;
      this.passTick(w);
    }
    if (!w.wildlife.enabled || w.extinction.wasteland) return;
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = 5;
    if (!this.seeded) {
      if (w.elapsed < 150) return;
      this.seeded = true;
      for (let k = 0; k < RANGES.length; k++) {
        for (const s of rangeSpecies(k)) this.arrive(w, k, s, s === "mountainLion" ? 1 : 4);
      }
      return;
    }
    for (let k = 0; k < RANGES.length; k++) {
      for (const s of rangeSpecies(k)) {
        let n = 0;
        for (const d of w.dinos) if (d.species === s && !d.under && !d.caged && homeRange(w, d) === k) n++;
        if (n >= Math.ceil((KEEP[s] ?? 2) / 2)) continue;
        const key = `${k}:${s}`;
        const t = (this.backT[key] = (this.backT[key] ?? 300 * (0.7 + this.rng() * 0.6)) - 5);
        if (t > 0) continue;
        delete this.backT[key];
        this.arrive(w, k, s, s === "mountainLion" ? 1 : 3);
      }
    }
  }

  /** `n` of a species turn up on range `k` (out of view when they can). Returns them. */
  arrive(w: World, k: number, s: SpeciesId, n: number): Dino[] {
    const def = sp(s);
    const homes = rangeHomes(w, k, s !== "mountainLion");
    const out: Dino[] = [];
    if (!homes.length) return out;
    const base = homes[Math.floor(this.rng() * homes.length)];
    const herd = def.herd > 0.3 && n > 1 ? w.nextId() : 0;
    for (let i = 0; i < n; i++) {
      let spot: { x: number; y: number } | null = null;
      for (let tries = 0; tries < 8 && !spot; tries++) {
        const p = findSpawnSpot(w, def, base.x + (this.rng() - 0.5) * 70, base.y + (this.rng() - 0.5) * 50, 110);
        if (p && w.nav.passable("dino", p.x, p.y) && rangeAt(w, p.x, p.y) === k + 1 && (tries > 4 || !w.inView(p.x, p.y, 80))) spot = p;
      }
      if (!spot) continue;
      out.push(addDino(w, s, spot.x, spot.y, { growth: 1, herd, homeX: base.x, homeY: base.y, hunger: 0.25, thirst: 0.2 }));
    }
    return out;
  }

  serialize() {
    return { seeded: this.seeded };
  }

  load(d: { seeded?: boolean } | undefined) {
    this.enabled = true;
    this.seeded = !!d?.seeded;
  }
}
