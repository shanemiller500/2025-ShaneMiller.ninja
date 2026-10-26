/* ------------------------------------------------------------------ */
/*  The atlas: what the tribe has seen of the world (for the minimap). */
/*                                                                     */
/*  The world is split into coarse cells (4 × 4 tiles). A cell is      */
/*  revealed once one of our people walks near it, or a dragon rider   */
/*  flies over it (they see much further from up there). Landmarks     */
/*  (the desert, the Great Peaks, the volcano, the monastery…) and the */
/*  camps of the other peoples go on the map once found. Saved.        */
/* ------------------------------------------------------------------ */
import { EAST_CAVES, LM } from "./terrain";
import { MAP_H, MAP_W, OLD_MAP_H, OLD_MAP_W, TILE, type Dragon, type Resource } from "./types";
import type { World } from "./world";

/** tiles per atlas cell */
export const ATLAS_CELL = 4;
export const ATLAS_W = Math.ceil(MAP_W / ATLAS_CELL);
export const ATLAS_H = Math.ceil(MAP_H / ATLAS_CELL);
const CELL_PX = ATLAS_CELL * TILE;

/** how far people on foot see (px), and riders up on a dragon */
const FOOT_SIGHT = 520;
const AIR_SIGHT = 1100;

/** Named places that go on the map once someone has seen them. */
export const ATLAS_PLACES: { id: string; name: string; icon: string; x: number; y: number }[] = [
  { id: "camp", name: "Home", icon: "🏠", x: LM.camp.x, y: LM.camp.y },
  { id: "volcano", name: "The volcano", icon: "🌋", x: LM.volcano.x, y: LM.volcano.y },
  { id: "lake", name: "The lake", icon: "💧", x: LM.lake.x, y: LM.lake.y },
  { id: "swamp", name: "The swamp", icon: "🐸", x: LM.swamp.x, y: LM.swamp.y },
  { id: "waterfall", name: "The waterfall", icon: "🌊", x: LM.waterfall.x, y: LM.waterfall.y },
  { id: "desert", name: "The central desert", icon: "🏜️", x: LM.desert.x, y: LM.desert.y },
  { id: "oasis", name: "An oasis", icon: "🌴", x: LM.oasis.x, y: LM.oasis.y },
  { id: "peaks", name: "The Great Peaks", icon: "🏔️", x: LM.peaks.x, y: LM.peaks.y },
  { id: "monastery", name: "The monks' valley", icon: "🛕", x: LM.monastery.x, y: LM.monastery.y },
  { id: "eastLake", name: "The east lake", icon: "💧", x: LM.eastLake.x, y: LM.eastLake.y },
];

export class Atlas {
  /** 1 = seen */
  seen = new Uint8Array(ATLAS_W * ATLAS_H);
  /** found places (ATLAS_PLACES ids) */
  places = new Set<string>();
  /** cave mouths in the eastern lands someone has looked into (EAST_CAVES indexes) */
  caves = new Set<number>();
  /** when each far-off spot was last looked over by a rider ("x,y" → elapsed) */
  private looked = new Map<string, number>();
  /** bumps whenever something new is revealed (the minimap redraws its fog then) */
  version = 0;
  private tickT = 0;
  count = 0;

  isSeen(x: number, y: number) {
    const cx = Math.floor(x / CELL_PX);
    const cy = Math.floor(y / CELL_PX);
    return cx >= 0 && cy >= 0 && cx < ATLAS_W && cy < ATLAS_H && this.seen[cy * ATLAS_W + cx] === 1;
  }

  /** Reveal everything within r of (x, y). */
  reveal(x: number, y: number, r: number) {
    const c0 = Math.max(0, Math.floor((x - r) / CELL_PX));
    const c1 = Math.min(ATLAS_W - 1, Math.floor((x + r) / CELL_PX));
    const r0 = Math.max(0, Math.floor((y - r) / CELL_PX));
    const r1 = Math.min(ATLAS_H - 1, Math.floor((y + r) / CELL_PX));
    const r2 = (r + CELL_PX * 0.5) ** 2;
    let any = false;
    for (let cy = r0; cy <= r1; cy++)
      for (let cx = c0; cx <= c1; cx++) {
        const i = cy * ATLAS_W + cx;
        if (this.seen[i]) continue;
        const px = (cx + 0.5) * CELL_PX;
        const py = (cy + 0.5) * CELL_PX;
        if ((px - x) ** 2 + (py - y) ** 2 > r2) continue;
        this.seen[i] = 1;
        this.count++;
        any = true;
      }
    if (any) this.version++;
  }

  /** Once a second: our people + riders reveal what's round them; places + camps get named once seen. */
  update(w: World, dt: number) {
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = 1;
    if (!this.count) this.reveal(w.camp.x, w.camp.y, 1300);
    if (this.count * 2 >= this.seen.length) w.discover("cartographer");
    for (const h of w.humans) {
      if (h.under || h.captive || h.stranger) continue;
      this.reveal(h.x, h.y, h.aloft ? AIR_SIGHT : FOOT_SIGHT);
    }
    for (const d of w.dragons.owned) if (d.z > 40) this.reveal(d.x, d.y, d.rider ? AIR_SIGHT : FOOT_SIGHT);
    this.caveTick(w);
    for (const p of ATLAS_PLACES) {
      if (this.places.has(p.id)) continue;
      if (this.isSeen(p.x * TILE, p.y * TILE)) {
        this.places.add(p.id);
        this.version++;
        if (p.id !== "camp" && w.elapsed > 5) w.toast(p.icon, `${p.name} is on the map now.`, p.x * TILE, p.y * TILE);
        if (p.id === "desert" || p.id === "oasis") w.discover(p.id, p.x * TILE, p.y * TILE);
        if (p.id === "peaks") w.discover("greatPeaks", p.x * TILE, p.y * TILE);
      }
    }
  }

  /** One of ours at a cave mouth out east: what's hidden inside (once per cave). */
  private caveTick(w: World) {
    EAST_CAVES.forEach((c, i) => {
      if (this.caves.has(i)) return;
      const x = c.x * TILE + TILE / 2;
      const y = (c.y + 1) * TILE + TILE / 2;
      const who = w.humans.find((h) => !h.under && !h.captive && !h.stranger && !h.aloft && Math.abs(h.x - x) < 140 && Math.abs(h.y - y) < 140 && Math.hypot(h.x - x, h.y - y) < 140);
      if (!who) return;
      this.caves.add(i);
      const loot: [Resource, number][] = c.kind === "mountain" ? [["crystal", 3], ["silver", 2], ["stone", 4]] : [["gold", 2], ["copper", 3], ["bone", 3]];
      for (const [r, n] of loot) w.camp.stock[r] = (w.camp.stock[r] ?? 0) + n;
      const what = loot.map(([r, n]) => `${n} ${r}`).join(", ");
      w.toast("🕳️", c.kind === "mountain" ? `${who.name} found a hidden cave high in the peaks! Frozen crystal glitters inside: ${what}.` : `${who.name} found a cave in the desert rocks: an old hoard someone left long ago (${what}).`, x, y);
      w.discover("hiddenCave", x, y);
      w.pois.push({ x, y, t: w.elapsed });
      this.version++;
    });
  }

  /** The nearest patch nobody has seen yet (for a scouting flight), within reach of (x, y). */
  nearestUnseen(x: number, y: number, reach: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bd = reach * reach;
    for (let cy = 0; cy < ATLAS_H; cy++)
      for (let cx = 0; cx < ATLAS_W; cx++) {
        if (this.seen[cy * ATLAS_W + cx]) continue;
        const px = (cx + 0.5) * CELL_PX;
        const py = (cy + 0.5) * CELL_PX;
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bd) {
          bd = d;
          best = { x: px, y: py };
        }
      }
    return best;
  }

  /** Somewhere known but far off that a rider hasn't looked over lately: a camp, a nest, the monks. */
  inspectTarget(w: World): { x: number; y: number } | null {
    const spots: { x: number; y: number }[] = [];
    for (const t of w.sandFolk.tribes) if (t.found) spots.push(t);
    for (const t of w.snowFolk.tribes) if (t.found) spots.push(t);
    for (const t of w.forest.tribes) if (t.found) spots.push(t);
    for (const t of w.seaFolk.tribes) if (t.found) spots.push(t);
    for (const c of w.rivals.clans) spots.push(c);
    for (const n of w.dragons.nests) if (n.found) spots.push(n);
    if (w.monks.found) spots.push(w.monks.home);
    const due = spots.filter((s) => Math.hypot(s.x - w.camp.x, s.y - w.camp.y) > 1200 && w.elapsed - (this.looked.get(key(s)) ?? -9999) > 600);
    return due.sort((a, b) => Math.hypot(a.x - w.camp.x, a.y - w.camp.y) - Math.hypot(b.x - w.camp.x, b.y - w.camp.y))[0] ?? null;
  }

  /** A rider looked over something far off: what did they see? */
  inspected(w: World, x: number, y: number, dr: Dragon) {
    const k = key({ x, y });
    this.looked.set(k, w.elapsed);
    const near = (p: { x: number; y: number }) => Math.hypot(p.x - x, p.y - y) < 220;
    const sand = w.sandFolk.tribes.find(near);
    const snow = w.snowFolk.tribes.find(near);
    const tree = w.forest.tribes.find(near);
    const sea = w.seaFolk.tribes.find(near);
    const clan = w.rivals.clans.find(near);
    const nest = w.dragons.nests.find(near);
    let what = "";
    if (sand) what = `the ${sand.name} Sand camp: ${w.sandFolk.members(sand.id).length} of them${w.dragons.list.some((d) => d.sandTribe === sand.id) ? ", and a Sand Dragon" : ""}`;
    else if (snow) what = `the ${snow.name} Snow camp: ${w.snowFolk.members(snow.id).length} Snow People${snow.grudge > 0 ? ", still angry with us" : ""}`;
    else if (tree) what = `the ${tree.name} tree camp: ${w.forest.members(tree.id).length} Tree People`;
    else if (sea) what = `the ${sea.name} sea village: ${w.seaFolk.members(sea.id).length} Sea People`;
    else if (clan) what = `the ${clan.name} clan: ${w.rivals.members(clan.id).length} Neanderthals`;
    else if (nest) what = `a dragon nest with ${w.dragons.eggs.filter((e) => e.at === "nest" && e.nest === nest.id).length} eggs`;
    else if (w.monks.found && near(w.monks.home)) what = `the Mountain Monks' valley (${w.monks.list.length} monks, all well)`;
    if (what) w.toast("👁️", `${dr.name}'s rider flew over ${what}.`, x, y);
  }

  serialize() {
    // run-length: [value, count, value, count…] (the map is mostly long runs)
    const runs: number[] = [];
    let v = this.seen[0];
    let n = 0;
    for (let i = 0; i < this.seen.length; i++) {
      if (this.seen[i] === v) n++;
      else {
        runs.push(v, n);
        v = this.seen[i];
        n = 1;
      }
    }
    runs.push(v, n);
    return { w: ATLAS_W, runs, places: Array.from(this.places), caves: Array.from(this.caves) };
  }

  /** (no save: an older world — reveal the old valley the tribe has lived in all along) */
  load(d: ReturnType<Atlas["serialize"]> | undefined) {
    this.seen.fill(0);
    this.places.clear();
    this.caves.clear();
    this.count = 0;
    if (!d || d.w !== ATLAS_W) {
      for (let cy = 0; cy < Math.ceil(OLD_MAP_H / ATLAS_CELL); cy++)
        for (let cx = 0; cx < Math.ceil(OLD_MAP_W / ATLAS_CELL); cx++) this.seen[cy * ATLAS_W + cx] = 1;
    } else {
      let i = 0;
      for (let k = 0; k < d.runs.length; k += 2) {
        const v = d.runs[k];
        const n = d.runs[k + 1];
        if (v) this.seen.fill(1, i, Math.min(this.seen.length, i + n));
        i += n;
      }
      for (const p of d.places ?? []) this.places.add(p);
      for (const c of (d as { caves?: number[] }).caves ?? []) this.caves.add(c);
    }
    for (let i = 0; i < this.seen.length; i++) this.count += this.seen[i];
    this.version++;
  }
}

const key = (p: { x: number; y: number }) => `${Math.round(p.x / 200)},${Math.round(p.y / 200)}`;
