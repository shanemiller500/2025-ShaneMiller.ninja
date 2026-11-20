/* ------------------------------------------------------------------ */
/*  Animals at their food, made visible.                               */
/*                                                                     */
/*   • Grazers (the plant-eaters, goats + bighorns too) crop the grass */
/*     where they graze: a patch of short, nibbled grass is left that  */
/*     grows back over a few minutes. They strip the berries off a     */
/*     bush before the leaves, and trim the low plants they browse     */
/*     down (they grow back): the herds keep the undergrowth down.     */
/*   • A meat-eater at a kill (a body, a lump of meat) guards it:      */
/*     anything smaller that comes close gets a snarl + a lunge and    */
/*     runs off.                                                       */
/*                                                                     */
/*  None of it rolls the world's dice (w.rng), so the rest of the      */
/*  world plays out exactly as before. Grazed patches aren't saved     */
/*  (they're only grass growing back).                                 */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { emote, setState, sizeOf, walkable } from "./dinos";
import { isLavaFolk } from "./lavaFolk";
import { P } from "./particles";
import { TALL } from "./plants";
import { T, type Dino, type Item, type Plant } from "./types";
import type { World } from "./world";

/** A patch of cropped grass: age 0 = just grazed, 1 = grown back. */
export interface Graze {
  x: number;
  y: number;
  r: number;
  age: number;
  /** a few stubble marks' layout */
  seed: number;
}

/** Seconds for grazed grass to grow back. */
const REGROW = 160;
const MAX_PATCHES = 320;
const patches = new WeakMap<World, Graze[]>();
export const grazedPatches = (w: World): readonly Graze[] => patches.get(w) ?? [];

/** Grass a grazer crops (goats + bighorns crop the thin mountain turf too). */
export function grazeable(w: World, d: Dino, x: number, y: number) {
  const t = w.terrain.tileAt(x, y);
  if (t === T.Grass || t === T.Jungle || t === T.Swamp || t === T.Forest) return true;
  return mountainGrazer(d) && (t === T.Rock || t === T.Dirt);
}
const mountainGrazer = (d: Dino) => d.species === "mountainGoat" || d.species === "bighorn";

/** Crop the grass under its mouth (once a second or so while it grazes). */
export function cropGrass(w: World, d: Dino) {
  const x = d.x + d.dir * sizeOf(d) * 0.4;
  const y = d.y + 2;
  const t = w.terrain.tileAt(x, y);
  // (bare rock + dirt: nothing to show, it's nibbling lichen)
  const shows = t === T.Grass || t === T.Jungle || t === T.Swamp || t === T.Forest;
  if (shows) {
    let list = patches.get(w);
    if (!list) patches.set(w, (list = []));
    const r = Math.min(26, 9 + sizeOf(d) * 0.12);
    const near = list.find((g) => Math.hypot(g.x - x, g.y - y) < g.r * 0.7);
    if (near) {
      // grazing the same spot down further: it gets barer + a little wider
      near.age = 0;
      near.r = Math.min(34, near.r + 1.5);
    } else {
      if (list.length >= MAX_PATCHES) list.shift();
      list.push({ x, y, r, age: 0, seed: (d.id * 7 + Math.floor(w.elapsed)) % 997 });
    }
  }
  if (w.inView(x, y, 40)) {
    // tufts flicked up as it tears the grass
    for (let k = 0; k < 2; k++) {
      const s = Math.sin(w.elapsed * 13.7 + d.id + k * 2.1);
      w.particles.spawn(P.Leaf, x + s * 6, y, { z: 4, vz: 22 + k * 8, vx: s * 18, g: 120, size: 2, max: 0.6, color: shows ? "#7fa24a" : "#9a9a7a" });
    }
    w.sfx("munch", x, y, 0.3, 1.2);
  }
}

/** Grazed grass grows back (every frame). */
export function grazeTick(w: World, dt: number) {
  const list = patches.get(w);
  if (!list?.length) return;
  for (const g of list) g.age += dt / REGROW;
  if (list[0].age >= 1 || list.some((g) => g.age >= 1)) patches.set(w, list.filter((g) => g.age < 1));
}

/** A berry bush still with berries on it (they go first). */
export const hasBerries = (p: Plant) => (p.kind === "bush" || p.kind === "fruit") && p.fruit > 0 && !p.stump;

/**
 * Browsing a plant (every frame while it eats one): the berries come off first, one by one, then
 * it trims a low plant down (smaller; it grows back), so the herds keep the undergrowth down.
 */
export function browse(w: World, d: Dino, p: Plant, dt: number, stateT: number) {
  const tick = Math.floor(stateT * 0.8) !== Math.floor((stateT - dt) * 0.8);
  if (hasBerries(p)) {
    if (tick) {
      p.fruit = Math.max(0, p.fruit - 1);
      p.shake = 1;
      d.hunger = Math.max(0, d.hunger - 0.06);
      if (stateT < 1.5 + dt) emote(d, "🫐", 1.4);
      if (w.inView(p.x, p.y, 40)) {
        for (let k = 0; k < 3; k++) {
          const s = Math.sin(w.elapsed * 9.1 + k * 2.4 + d.id);
          w.particles.spawn(P.Crumb, p.x + s * 10, p.y, { z: TALL.has(p.kind) ? 40 : 12, vz: 30, vx: s * 30, g: 160, size: 2.4, max: 0.6, color: k % 2 ? "#7a2a6a" : "#c0304a" });
        }
      }
    }
    return;
  }
  if (!TALL.has(p.kind) && !p.planted) {
    p.size = Math.max(0.32, p.size - dt * 0.012);
    w.plantsDirty = true;
  }
}

/* ------------------------------ guarding a kill ------------------------------ */

const lungeAt = new WeakMap<Dino, number>();

/**
 * A meat-eater at its meal (every frame while it eats a body / meat): a smaller animal that comes close
 * gets a snarl and a lunge, and runs for it. (Something as big or bigger is the old squabble: behavior.ts.)
 */
export function guardKill(w: World, d: Dino, item: Item) {
  const def = sp(d.species);
  if (def.diet === "herbivore" || isLavaFolk(d) || d.owner) return;
  if ((lungeAt.get(d) ?? 0) > w.elapsed) return;
  const me = sizeOf(d);
  const R = 70 + me * 0.9;
  const pest = w.creatureHash.nearest(item.x, item.y, R, (e) => {
    if (e.kind !== "dino" || e === d) return false;
    const o = e as Dino;
    if (o.species === d.species || o.owner || o.rider || o.caged || isLavaFolk(o) || sp(o.species).move !== "walk") return false;
    if (o.state === "sleep" || o.state === "knocked" || o.state === "carried" || o.state === "faint" || o.state === "flee" || o.state === "tussle") return false;
    return sizeOf(o) < me * 0.9;
  }) as Dino | null;
  if (!pest) return;
  lungeAt.set(d, w.elapsed + 2.5);
  // the snarl + lunge: it turns, jaws open, a hop toward them…
  d.dir = pest.x > d.x ? 1 : -1;
  const a = Math.atan2(pest.y - d.y, pest.x - d.x);
  const hop = Math.min(18, me * 0.15);
  const nx = d.x + Math.cos(a) * hop;
  const ny = d.y + Math.sin(a) * hop;
  if (walkable(w, d, nx, ny)) {
    d.x = nx;
    d.y = ny;
  }
  emote(d, "😠", 1.5);
  w.sfx(def.sound.kind, d.x, d.y, 0.6, def.sound.pitch * 1.1);
  w.particles.burst(P.Dust, d.x, d.y, 4, 30, { size: 6, max: 0.6 });
  // …and they run for it
  pest.fear = 1;
  if (pest.targetId === item.id) pest.targetId = 0;
  const dist = 260 + me;
  const b = Math.atan2(pest.y - d.y, pest.x - d.x);
  let fx = pest.x + Math.cos(b) * dist;
  let fy = pest.y + Math.sin(b) * dist;
  if (!walkable(w, pest, fx, fy)) {
    fx = pest.x + Math.cos(b + 0.8) * dist;
    fy = pest.y + Math.sin(b + 0.8) * dist;
  }
  setState(pest, "flee", fx, fy);
  emote(pest, "💨", 1.3);
  if (!w.flags.has("guardKill") && w.inView(d.x, d.y, 100)) {
    w.flags.add("guardKill");
    w.toast("🍖", `The ${def.nick} guards its meal: it snarls and lunges, and the ${sp(pest.species).nick} runs off!`, d.x, d.y);
  }
}
