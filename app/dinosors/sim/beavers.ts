/* ------------------------------------------------------------------ */
/*  Beavers (giant ones: Castoroides of the Ice Age) and their dams.   */
/*                                                                     */
/*  A pair settles on a small stream (STREAMS), well away from camp,   */
/*  where it runs narrow between dry banks. They build a dam across    */
/*  it a stick at a time: off to a tree near the stream, gnaw (some    */
/*  trees come down, chewed to a stump), carry the stick back in their */
/*  teeth, push it into the dam. The dam grows. Finished, it backs the */
/*  stream up into a little pond behind it (the land there floods to   */
/*  shallow water, for good), fish move in, the beavers build a lodge  */
/*  in it, and from then on they swim out, dive for fish, and sit and  */
/*  eat them. The fish come back, slowly.                              */
/*                                                                     */
/*  Nothing here is saved: where the dams go comes from the terrain    */
/*  (the same every time), and a finished dam is known by its pond     */
/*  (pond tiles are terrain edits, which are). Beavers + pond fish use */
/*  their own dice, so the rest of the world plays out the same.       */
/* ------------------------------------------------------------------ */
import { addDino, emote, setState, sizeOf } from "./dinos";
import { P } from "./particles";
import { makeRng, pick, type Rng } from "./rng";
import { isWaterTile, STREAMS } from "./terrain";
import { MAP_H, MAP_W, T, TILE, type Dino, type FishSchool, type Plant } from "./types";
import type { World } from "./world";

export const isBeaver = (d: Pick<Dino, "species">) => d.species === "beaver";

/** Sticks a dam takes. */
export const DAM_STICKS = 12;
/** Beavers per dam, and how many dams the land has at most. */
const PAIR = 2;
const MAX_DAMS = 5;
/** No dam this close to the camp (px). */
const CAMP_CLEAR = 1100;
/** How far a beaver goes for a tree (px from its dam). */
const TREE_R = 360;
/** Seconds: gnawing a stick off a tree, diving for a fish, eating it. */
const CHEW = 3;
const DIVE = 1.6;
const EAT = 4.5;
/** Seconds between fishing trips (each beaver). */
const FISH_EVERY = 45;
/** Seconds before a lost beaver is replaced (someone ate it). */
const REPLACE = 240;
/** The pond behind a dam: an oval this big (tiles), this far upstream (tiles). */
const POND = { rx: 3.2, ry: 2.1, up: 3 };

export interface DamSite {
  id: number;
  /** the dam: a row of stream tiles, bank to bank */
  ty: number;
  tx0: number;
  tx1: number;
  /** the pond's middle (px) + size (px) */
  px: number;
  py: number;
  rx: number;
  ry: number;
  /** sticks in so far */
  sticks: number;
  done: boolean;
}

interface Life {
  rng: Rng;
  acc: number;
  sites: DamSite[] | null;
  seeded: boolean;
  /** each dam: when a lost beaver may next be replaced */
  backAt: Map<number, number>;
}
const lives = new WeakMap<World, Life>();
function lifeOf(w: World): Life {
  let l = lives.get(w);
  if (!l) lives.set(w, (l = { rng: makeRng(w.seed * 271 + 17), acc: 0, sites: null, seeded: false, backAt: new Map() }));
  return l;
}

const tileAt = (w: World, tx: number, ty: number) => (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H ? T.Deep : (w.terrain.tiles[ty * MAP_W + tx] as T));
const dryLand = (t: T) => t === T.Grass || t === T.Dirt || t === T.Sand || t === T.Forest || t === T.Jungle;

/** Is this tile inside a site's pond oval? */
function inPondTile(s: DamSite, tx: number, ty: number) {
  const x = tx * TILE + TILE / 2;
  const y = ty * TILE + TILE / 2;
  return ((x - s.px) / s.rx) ** 2 + ((y - s.py) / s.ry) ** 2 <= 1;
}

/**
 * Where the dams go: along each small stream in this world, the first narrow stretch (1–3 tiles of
 * water between dry banks, no rapids) about a third and two thirds of the way down, well away from
 * camp, with dry land upstream to flood. The same every time for a world.
 */
export function damSites(w: World): DamSite[] {
  const l = lifeOf(w);
  if (l.sites) return l.sites;
  const out: DamSite[] = [];
  const t = w.terrain;
  // one dam per stream (the first good stretch, about a third of the way down, else two thirds)
  for (const st of STREAMS) {
    if (t.gen < st.gen || out.length >= MAX_DAMS) continue;
    const had = out.length;
    for (const frac of [0.35, 0.65, 0.5]) {
      if (out.length > had) break;
      // a point that far along the stream
      const seg = Math.min(st.pts.length - 2, Math.floor(frac * (st.pts.length - 1)));
      const k = frac * (st.pts.length - 1) - seg;
      const sx = Math.round(st.pts[seg][0] + (st.pts[seg + 1][0] - st.pts[seg][0]) * k);
      const sy = Math.round(st.pts[seg][1] + (st.pts[seg + 1][1] - st.pts[seg][1]) * k);
      let best: DamSite | null = null;
      for (let dy = -4; dy <= 4 && !best; dy++) {
        const ty = sy + dy;
        // the run of stream water across this row
        let tx0 = -1;
        for (let x = sx - 4; x <= sx + 4; x++) if (tileAt(w, x, ty) === T.River) {
          tx0 = x;
          break;
        }
        if (tx0 < 0) continue;
        let tx1 = tx0;
        while (tileAt(w, tx1 + 1, ty) === T.River && tx1 - tx0 < 4) tx1++;
        if (tx1 - tx0 > 2 || !dryLand(tileAt(w, tx0 - 1, ty)) || !dryLand(tileAt(w, tx1 + 1, ty))) continue;
        let rapid = false;
        for (let x = tx0; x <= tx1; x++) if (t.rapids[ty * MAP_W + x]) rapid = true;
        if (rapid) continue;
        const cx = ((tx0 + tx1 + 1) / 2) * TILE;
        const px = cx;
        const py = (ty - POND.up) * TILE + TILE / 2;
        if (Math.hypot(px - w.camp.x, py - w.camp.y) < CAMP_CLEAR) continue;
        // (not on a volcano's slopes: the Lava Monsters would have them)
        if (w.volcanoes.some((v) => Math.hypot(px - v.x, py - v.y) < 1000)) continue;
        if (out.some((o) => Math.hypot(o.px - px, o.py - py) < 600)) continue;
        const site: DamSite = { id: out.length + 1, ty, tx0, tx1, px, py, rx: POND.rx * TILE, ry: POND.ry * TILE, sticks: 0, done: false };
        // there must be room to flood: mostly dry land (or stream) upstream, no deep water, no cliffs
        let ok = 0;
        let bad = 0;
        for (let y = ty - 6; y < ty; y++) for (let x = tx0 - 4; x <= tx1 + 4; x++) {
          if (!inPondTile(site, x, y)) continue;
          const tt = tileAt(w, x, y);
          // (a pond already flooded there, in a save: it was land before)
          const was = x >= 0 && y >= 0 && x < MAP_W && y < MAP_H ? (t.base[y * MAP_W + x] as T) : T.Deep;
          if (dryLand(tt) || tt === T.River || (tt === T.Shallow && (dryLand(was) || was === T.River))) ok++;
          else bad++;
        }
        if (ok < 8 || bad > 2) continue;
        best = site;
      }
      if (best) out.push(best);
    }
  }
  // a dam built before (in a save) shows as its pond: it's finished
  for (const s of out) if (pondFlooded(w, s)) {
    s.done = true;
    s.sticks = DAM_STICKS;
  }
  l.sites = out;
  return out;
}

/** The pond is there: its middle is shallow water where the land used to be dry. */
function pondFlooded(w: World, s: DamSite) {
  const tx = Math.floor(s.px / TILE);
  const ty = Math.floor(s.py / TILE);
  const i = ty * MAP_W + tx;
  return w.terrain.tiles[i] === T.Shallow && w.terrain.base[i] !== T.Shallow;
}

/** Inside a site's pond (px). */
export function inPond(s: DamSite, x: number, y: number) {
  return ((x - s.px) / s.rx) ** 2 + ((y - s.py) / s.ry) ** 2 < 0.85;
}

const siteOf = (w: World, d: Dino) => damSites(w).find((s) => Math.hypot(s.px - d.homeX, s.py - d.homeY) < 40) ?? null;
const pondFish = (w: World, s: DamSite) => w.schools.find((f) => f.pond === s.id) ?? null;

/* ------------------------------ the brain ------------------------------ */

type Job =
  | { kind: "tree"; plant: number }
  | { kind: "chew"; plant: number; until: number }
  | { kind: "carry" }
  | { kind: "fish" }
  | { kind: "dive"; until: number }
  /** caught one: swims to the bank (x, y) with it, then sits up and eats it (until: 0 = not there yet) */
  | { kind: "eat"; until: number; x: number; y: number };
const jobs = new WeakMap<Dino, Job>();
const fishAt = new WeakMap<Dino, number>();

/** What it's holding (for the art): a stick in its teeth, or a fish in its paws. */
export function beaverHolding(d: Dino): "stick" | "fish" | null {
  const j = jobs.get(d);
  return j?.kind === "carry" ? "stick" : j?.kind === "eat" ? "fish" : null;
}
/** Under the water, diving for a fish (for the art). */
export const beaverDiving = (d: Dino) => jobs.get(d)?.kind === "dive";

/** Its brain (thinkDino calls it). Always decides. */
export function beaverThink(w: World, d: Dino): boolean {
  if (d.state === "faint" || d.state === "knocked" || d.state === "carried" || d.state === "tussle") return false;
  d.hunger = 0;
  d.thirst = 0;
  d.layT = 1e9;
  const s = siteOf(w, d);
  if (!s) return false;
  const l = lifeOf(w);
  const job = jobs.get(d);
  // a fish to eat: out onto the bank with it
  if (job?.kind === "eat" && !job.until) {
    setState(d, "wander", job.x, job.y);
    return true;
  }
  // in the middle of something with a timer (gnawing, diving, eating): the per-frame part finishes it
  if (job && "until" in job) return true;
  // trouble close by (a predator, one of ours): into the pond (or the stream), with a slap of the tail
  if (d.fear > 0.5) {
    const safe = s.done ? { x: s.px, y: s.py } : { x: ((s.tx0 + s.tx1 + 1) / 2) * TILE, y: s.ty * TILE + TILE / 2 };
    if (Math.hypot(d.x - safe.x, d.y - safe.y) > 30) {
      setState(d, "wander", safe.x, safe.y);
      if (l.rng() < 0.4) {
        emote(d, "💦", 1.2);
        w.sfx("splash", d.x, d.y, 0.6, 1.3);
      }
      return true;
    }
  }
  if (w.inView(d.x, d.y, -60)) w.discover("beaver", d.x, d.y);
  if (!s.done) return buildThink(w, d, s, l);
  return pondThink(w, d, s, l);
}

/** Building: to a tree, gnaw a stick off, carry it to the dam. */
function buildThink(w: World, d: Dino, s: DamSite, l: Life) {
  const job = jobs.get(d);
  const damX = ((s.tx0 + s.tx1 + 1) / 2) * TILE + (l.rng() - 0.5) * (s.tx1 - s.tx0 + 1) * TILE * 0.6;
  const damY = s.ty * TILE + TILE / 2 - 6;
  if (job?.kind === "carry") {
    setState(d, "wander", damX, damY);
    return true;
  }
  if (job?.kind === "tree") {
    const p = w.plants.find((x) => x.id === job.plant && !x.stump);
    if (p) {
      setState(d, "wander", p.x + (d.x < p.x ? -14 : 14), p.y + 4);
      return true;
    }
  }
  const tree = treeNear(w, s, l);
  if (!tree) {
    // nothing left to gnaw near here: it rests by the stream
    setState(d, "idle", d.x, d.y);
    return true;
  }
  jobs.set(d, { kind: "tree", plant: tree.id });
  setState(d, "wander", tree.x + (d.x < tree.x ? -14 : 14), tree.y + 4);
  return true;
}

/** A tree (or a big bush) near the dam that still has wood on it. */
function treeNear(w: World, s: DamSite, l: Life): Plant | null {
  const cx = ((s.tx0 + s.tx1 + 1) / 2) * TILE;
  const cy = s.ty * TILE;
  const list = w.plants.filter((p) => !p.stump && p.burnt < 0.5 && p.size > 0.35 && (p.kind === "broadleaf" || p.kind === "conifer" || p.kind === "fruit" || p.kind === "palm" || p.kind === "bush" || p.kind === "reeds")
    && Math.abs(p.x - cx) < TREE_R && Math.hypot(p.x - cx, p.y - cy) < TREE_R && !isWaterTile(w.terrain.tileAt(p.x, p.y)));
  if (!list.length) return null;
  list.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  return list[Math.floor(l.rng() * Math.min(5, list.length))];
}

/** A finished dam: swim, fish, sit on the lodge, eat. */
function pondThink(w: World, d: Dino, s: DamSite, l: Life) {
  const fish = pondFish(w, s);
  if ((fishAt.get(d) ?? 0) <= w.elapsed && fish && fish.n > 0) {
    jobs.set(d, { kind: "fish" });
    setState(d, "wander", fish.x, fish.y);
    return true;
  }
  if (d.state === "wander" && Math.hypot(d.tx - d.x, d.ty - d.y) > 8 && d.stateT < 15) return true;
  if (d.state === "idle" && d.stateT < 5 + (d.id % 5)) return true;
  // a lazy lap of the pond, a sit on the lodge, a groom on the bank
  const r = l.rng();
  if (r < 0.45) {
    const a = l.rng() * Math.PI * 2;
    setState(d, "wander", s.px + Math.cos(a) * s.rx * 0.6, s.py + Math.sin(a) * s.ry * 0.6);
  } else if (r < 0.75) {
    setState(d, "wander", s.px + s.rx * 0.25, s.py - s.ry * 0.1);
  } else {
    setState(d, "idle", d.x, d.y);
    if (l.rng() < 0.5) emote(d, pick(l.rng, ["🦫", "💤", "✨"]), 1.4);
  }
  return true;
}

/** Per frame (actDino calls it): gnawing, carrying, diving, eating. False = walk as usual. */
export function beaverAct(w: World, d: Dino, dt: number): boolean {
  const job = jobs.get(d);
  if (!job) return false;
  const s = siteOf(w, d);
  if (!s) return false;
  const l = lifeOf(w);
  d.strike = Math.max(0, (d.strike ?? 0) - dt);
  switch (job.kind) {
    case "tree": {
      const p = w.plants.find((x) => x.id === job.plant && !x.stump);
      if (!p) {
        jobs.delete(d);
        d.think = 0;
        return false;
      }
      if (Math.hypot(d.x - p.x, d.y - p.y) < 22) {
        jobs.set(d, { kind: "chew", plant: p.id, until: w.elapsed + CHEW });
        setState(d, "idle", d.x, d.y);
        d.dir = p.x > d.x ? 1 : -1;
      }
      return false;
    }
    case "chew": {
      d.vx = d.vy = 0;
      d.strike = 0.6 + Math.sin(w.elapsed * 22) * 0.4;
      if (l.rng() < dt * 8 && w.inView(d.x, d.y, 60)) w.particles.spawn(P.Crumb, d.x + d.dir * 10, d.y, { z: 10, vz: 40, g: 200, size: 2, max: 0.5, color: "#d9b57a" });
      if (w.elapsed < job.until) return true;
      const p = w.plants.find((x) => x.id === job.plant);
      // now and then the whole tree comes down: a beaver-gnawed stump is left
      if (p && !p.stump && l.rng() < 0.3) {
        p.stump = true;
        p.decay = 35;
        p.fruit = 0;
        w.plantsDirty = true;
        w.sfx("timber", p.x, p.y, 0.5, 1.3);
      }
      jobs.set(d, { kind: "carry" });
      d.strike = 0;
      d.think = 0;
      return false;
    }
    case "carry": {
      const dx = ((s.tx0 + s.tx1 + 1) / 2) * TILE;
      const dy = s.ty * TILE + TILE / 2;
      if (Math.abs(d.x - dx) < (s.tx1 - s.tx0 + 1) * TILE * 0.6 + 10 && Math.abs(d.y - dy) < 24) {
        jobs.delete(d);
        s.sticks = Math.min(DAM_STICKS, s.sticks + 1);
        emote(d, "🪵", 1.2);
        w.sfx("knock", dx, dy, 0.5, 1.2);
        w.particles.burst(P.Splash, d.x, d.y, 4, 30, { size: 4, max: 0.5, color: "rgba(200,225,240,0.8)" });
        if (s.sticks >= DAM_STICKS && !s.done) finishDam(w, s);
        d.think = 0;
      }
      return false;
    }
    case "fish": {
      const f = pondFish(w, s);
      if (!f || f.n <= 0) {
        jobs.delete(d);
        fishAt.set(d, w.elapsed + FISH_EVERY);
        return false;
      }
      d.tx = f.x;
      d.ty = f.y;
      if (Math.hypot(d.x - f.x, d.y - f.y) < 26) {
        jobs.set(d, { kind: "dive", until: w.elapsed + DIVE });
        setState(d, "idle", d.x, d.y);
        w.sfx("splash", d.x, d.y, 0.6, 1.2);
        w.particles.burst(P.Splash, d.x, d.y, 6, 40, { size: 5, max: 0.6, color: "rgba(200,225,240,0.85)" });
      }
      return false;
    }
    case "dive": {
      d.vx = d.vy = 0;
      if (w.elapsed < job.until) return true;
      const f = pondFish(w, s);
      // (it doesn't always catch one)
      if (f && f.n > 0 && l.rng() < 0.75) {
        f.n--;
        const bank = bankSpot(w, s, d.x, d.y);
        jobs.set(d, { kind: "eat", until: 0, x: bank.x, y: bank.y });
        emote(d, "🐟", 2);
        w.particles.burst(P.Splash, d.x, d.y, 5, 30, { size: 4, max: 0.5, color: "rgba(200,225,240,0.85)" });
        if (!w.flags.has("beaverFish") && w.inView(d.x, d.y, 200)) {
          w.flags.add("beaverFish");
          w.toast("🦫", "A beaver dived into its pond and came up with a fish! It sits and nibbles it, holding it in its paws.", d.x, d.y);
        }
      } else {
        jobs.delete(d);
        fishAt.set(d, w.elapsed + FISH_EVERY * 0.4);
        emote(d, "💦", 1.2);
      }
      d.think = 0;
      return true;
    }
    case "eat": {
      // swimming it to the bank first
      if (!job.until) {
        d.tx = job.x;
        d.ty = job.y;
        if (Math.hypot(d.x - job.x, d.y - job.y) > 14 && d.stateT < 12) return false;
        job.until = w.elapsed + EAT;
        setState(d, "idle", d.x, d.y);
        d.dir = s.px > d.x ? 1 : -1;
      }
      d.vx = d.vy = 0;
      d.strike = 0.4 + Math.sin(w.elapsed * 14) * 0.3;
      if (l.rng() < dt * 1.5) w.sfx("munch", d.x, d.y, 0.4, 1.4);
      if (w.elapsed < job.until) return true;
      jobs.delete(d);
      d.strike = 0;
      fishAt.set(d, w.elapsed + FISH_EVERY * (0.8 + l.rng() * 0.6));
      emote(d, "😋", 1.6);
      d.think = 0;
      return false;
    }
  }
  return false;
}

/** A dry spot on the pond's edge, nearest (x, y): where it sits to eat. */
function bankSpot(w: World, s: DamSite, x: number, y: number) {
  const a0 = Math.atan2((y - s.py) / s.ry, (x - s.px) / s.rx);
  for (let k = 0; k < 12; k++) {
    const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.45;
    const bx = s.px + Math.cos(a) * (s.rx + 14);
    const by = s.py + Math.sin(a) * (s.ry + 12);
    if (!isWaterTile(w.terrain.tileAt(bx, by)) && by < s.ty * TILE) return { x: bx, y: by };
  }
  return { x: s.px + s.rx * 0.25, y: s.py - s.ry * 0.05 - 4 };
}

/** The last stick goes in: the stream backs up behind the dam into a pond, and fish move in. */
export function finishDam(w: World, s: DamSite) {
  s.done = true;
  s.sticks = DAM_STICKS;
  const tx0 = Math.floor((s.px - s.rx) / TILE) - 1;
  const tx1 = Math.ceil((s.px + s.rx) / TILE) + 1;
  const ty0 = Math.floor((s.py - s.ry) / TILE) - 1;
  for (let ty = ty0; ty < s.ty; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (!inPondTile(s, tx, ty)) continue;
      const t = tileAt(w, tx, ty);
      if (dryLand(t) || t === T.River || t === T.Swamp || t === T.Mud) w.terrain.setTile(tx, ty, T.Shallow);
    }
  }
  // what grew there is under water now
  const before = w.plants.length;
  w.plants = w.plants.filter((p) => !inPond(s, p.x, p.y));
  if (w.plants.length !== before) w.plantsDirty = true;
  stockPond(w, s);
  w.particles.burst(P.Splash, s.px, s.py, 16, 80, { size: 7, max: 1, color: "rgba(200,225,240,0.85)" });
  w.sfx("splash", s.px, s.py, 1, 0.9);
  if (!w.flags.has("beaverDam") || w.inView(s.px, s.py, 200)) {
    w.flags.add("beaverDam");
    w.toast("🦫", "The beavers finished their dam! The stream is backing up into a little pond behind it, and fish are moving in. They'll build a lodge in it and go fishing.", s.px, s.py);
  }
  w.discover("beaverDam", s.px, s.py);
}

/** Fish for the pond (a school of its own: it comes back slowly, without the world's dice). */
function stockPond(w: World, s: DamSite) {
  if (pondFish(w, s)) return;
  const school: FishSchool = { id: w.nextId(), x: s.px, y: s.py, vx: 0, vy: 0, n: 6, t: s.id * 3.1, pond: s.id, regrow: 0 };
  w.schools.push(school);
}

/** The lodge: a dome of sticks + mud in a finished pond (px), or null. */
export function lodgeOf(s: DamSite) {
  return s.done ? { x: s.px + s.rx * 0.25, y: s.py - s.ry * 0.05 } : null;
}

/* ------------------------------ their numbers ------------------------------ */

/** Once a second: each dam site has its pair of beavers, and every finished pond has its fish. */
export function beaverTick(w: World, dt: number) {
  const l = lifeOf(w);
  l.acc += dt;
  if (l.acc < 1) return;
  l.acc = 0;
  if (!w.wildlife.enabled || w.extinction.wasteland) return;
  const sites = damSites(w);
  for (const s of sites) if (s.done) stockPond(w, s);
  for (const s of sites) {
    const n = w.dinos.filter((d) => isBeaver(d) && Math.hypot(d.homeX - s.px, d.homeY - s.py) < 40).length;
    if (n >= PAIR) continue;
    // the first ones are there from the start; a lost one is replaced after a while, out of sight
    if (l.seeded && (w.elapsed < (l.backAt.get(s.id) ?? 0) || w.inView(s.px, s.py, 400))) continue;
    for (let k = n; k < PAIR; k++) {
      const a = l.rng() * Math.PI * 2;
      const x = ((s.tx0 + s.tx1 + 1) / 2) * TILE + Math.cos(a) * 60;
      const y = s.ty * TILE + Math.sin(a) * 30;
      const shared = w.rng;
      w.rng = l.rng;
      try {
        const d = addDino(w, "beaver", x, y, { growth: 1, homeX: s.px, homeY: s.py, hunger: 0, thirst: 0 });
        d.layT = 1e9;
      } finally {
        w.rng = shared;
      }
    }
    if (l.seeded) l.backAt.set(s.id, w.elapsed + REPLACE);
  }
  l.seeded = true;
}

/** Everything the art needs about the dams. */
export function beaverDams(w: World) {
  return lives.get(w)?.sites ?? [];
}
export const beaverSize = (d: Dino) => sizeOf(d);
