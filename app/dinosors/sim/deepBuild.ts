/* ------------------------------------------------------------------ */
/*  The Deep, Phase 4: building in the dug-out space.                  */
/*                                                                    */
/*  Burrow homes, a vault, glowshroom farms, crystal lamps and a mess  */
/*  hall go into open tunnel. A placed building is a site: a miner    */
/*  fetches its materials from the lift (out of the camp stockpile),  */
/*  carries them over and builds it. Finished rooms are reinforced:   */
/*  their cells never cave in and they hold up the roof around them.  */
/* ------------------------------------------------------------------ */
import { DEEP_DEFS, FLOODED, LAMP_REACH, LIFT_X, M, MATERIALS, MINE_W, PUMP_REACH, type DeepKind } from "../data/mine";
import { idx, inMine, toolsOf, type Mine } from "./mine";
import type { Resource } from "./types";
import type { World } from "./world";

export interface DeepBuilding {
  id: number;
  kind: DeepKind;
  /** top-left cell */
  x: number;
  y: number;
  /** 0..1 built */
  built: number;
  /** materials are down here */
  have: boolean;
  /** mushrooms: 0..1 toward the next harvest */
  grow: number;
}

export function cellsOf(b: { kind: DeepKind; x: number; y: number }) {
  const d = DEEP_DEFS[b.kind];
  const out: number[] = [];
  for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) out.push(idx(b.x + dx, b.y + dy));
  return out;
}

/** Why a building can't go here (or null). x, y = its top-left cell. */
export function canPlaceDeep(mine: Mine, kind: DeepKind, x: number, y: number): string | null {
  const d = DEEP_DEFS[kind];
  const reach = mine.reach();
  for (let dy = 0; dy < d.h; dy++)
    for (let dx = 0; dx < d.w; dx++) {
      const a = x + dx;
      const b = y + dy;
      if (!inMine(a, b)) return "Too close to the edge.";
      const i = idx(a, b);
      if (a === LIFT_X || mine.cells[i] === M.Shaft) return "Keep the lift shaft clear.";
      if (mine.cells[i] !== M.Open) return `Dig out a ${d.w}×${d.h} space first.`;
      if (!reach[i]) return "Your miners can't get there yet.";
      if (mine.buildAt.has(i)) return "Something is already built there.";
      if (mine.water[i] > 0.3) return "It's flooded — pump it out first.";
    }
  if (d.floor) for (let dx = 0; dx < d.w; dx++) if (!MATERIALS[mine.at(x + dx, y + d.h) as M].solid) return "Needs solid rock under the whole floor.";
  return null;
}

export function placeDeep(w: World, kind: DeepKind, x: number, y: number): DeepBuilding | string {
  const mine = w.mine;
  const why = canPlaceDeep(mine, kind, x, y);
  if (why) return why;
  const b: DeepBuilding = { id: mine.nextBuildId++, kind, x, y, built: 0, have: false, grow: 0 };
  mine.builds.push(b);
  for (const i of cellsOf(b)) mine.orders.delete(i);
  mine.reindex();
  return b;
}

/** Take a building down: half the materials go back on the stockpile. */
export function demolishDeep(w: World, id: number) {
  const mine = w.mine;
  const b = mine.builds.find((x) => x.id === id);
  if (!b) return false;
  if (b.have) for (const [r, n] of Object.entries(DEEP_DEFS[b.kind].cost) as [Resource, number][]) w.camp.stock[r] += Math.floor(n / 2);
  mine.builds.splice(mine.builds.indexOf(b), 1);
  mine.reindex();
  return true;
}

export const finished = (b: DeepBuilding) => b.built >= 1;

/** People the finished burrow homes add to the tribe's room. */
export function deepRoom(mine: Mine) {
  return mine.builds.reduce((a, b) => a + (finished(b) ? DEEP_DEFS[b.kind].room ?? 0 : 0), 0);
}

export function hasVault(mine: Mine) {
  return mine.builds.some((b) => b.kind === "vault" && finished(b));
}

/** Is a finished crystal lamp lighting this cell? */
export function lit(mine: Mine, x: number, y: number) {
  return mine.builds.some((b) => b.kind === "lamp" && finished(b) && Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) <= LAMP_REACH);
}

/** Farms grow, lamps keep the air clear. */
export function updateDeepBuilds(w: World, dt: number) {
  const mine = w.mine;
  if (!mine.builds.length) return;
  for (const b of mine.builds) {
    if (!finished(b)) continue;
    if (b.kind === "mushroom") {
      // damp rock nearby = faster
      let wet = 0;
      for (const i of cellsOf(b)) for (const j of [i - 1, i + 1, i - MINE_W, i + MINE_W]) if (j >= 0 && j < mine.water.length && mine.water[j] > 0.05) wet = 1;
      const flooded = cellsOf(b).some((i) => mine.water[i] > 0.6);
      if (flooded) continue;
      b.grow += dt / (wet ? 35 : 60);
      if (b.grow >= 1) {
        b.grow = 0;
        w.camp.stock.crop += 2;
        mine.hauled.crop = (mine.hauled.crop ?? 0) + 2;
        mine.crates.push({ y: b.y, t: 0 });
        if (!w.flags.has("firstShrooms")) {
          w.flags.add("firstShrooms");
          w.toast("🍄", "The first glowshroom harvest came up the lift!");
        }
      }
    } else if (b.kind === "pump") {
      // find the wettest cell in reach and pump it; the water goes up the pipe to the camp
      let best = -1;
      let bw = 0.04;
      for (let dy = -PUMP_REACH; dy <= PUMP_REACH; dy++)
        for (let dx = -PUMP_REACH; dx <= PUMP_REACH; dx++) {
          const x = b.x + dx;
          const y = b.y + 1 + dy;
          if (!inMine(x, y)) continue;
          const i = idx(x, y);
          if (mine.water[i] > bw) {
            bw = mine.water[i];
            best = i;
          }
        }
      if (best >= 0) {
        const got = mine.pump(best % MINE_W, Math.floor(best / MINE_W), dt * 0.9, toolsOf(w));
        const cap = 60 + mine.builds.filter((x) => x.kind === "pump" && finished(x)).length * 40;
        if (w.camp.stock.water < cap) w.camp.stock.water = Math.min(cap, w.camp.stock.water + got * 2);
        mine.pumped += got * 2;
        b.grow = (b.grow + dt * 3) % 1;
        if (bw > FLOODED && !w.flags.has("pumpStation")) {
          w.flags.add("pumpStation");
          w.toast("🚰", "The pump station is draining the flood and piping the water up to camp!");
        }
      }
    } else if (b.kind === "lamp" && mine.gas.size) {
      for (const i of Array.from(mine.gas.keys())) {
        const x = i % MINE_W;
        const y = Math.floor(i / MINE_W);
        if (Math.max(Math.abs(b.x - x), Math.abs(b.y - y)) <= LAMP_REACH) mine.gas.delete(i);
      }
    }
  }
}

export { DEEP_DEFS };
