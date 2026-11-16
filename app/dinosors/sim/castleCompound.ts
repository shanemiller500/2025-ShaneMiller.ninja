import { BUILDINGS } from "../data/colony";
import { sp } from "../data/species";
import { shelterDone } from "./build";
import { MAP_W, TILE, type Dino, type Dragon, type Shelter } from "./types";
import type { World } from "./world";

export interface CastlePoint { x: number; y: number }
export interface CastleWing extends CastlePoint { ids: number[] }
export interface CastleCompound {
  id: number;
  origin: CastlePoint;
  wings: CastleWing[];
  garden: CastlePoint;
  pads: CastlePoint[];
  rest: CastlePoint;
}
interface Rect { x: number; y: number; rx: number; ry: number }
const scheduler = new WeakMap<World, { signature: string; next: number }>();
const DX = 64, DY = 96, ROOMS_PER_WING = 3;

/** Apartment ids remain intact: families, beds, upgrades and construction retain their identity. */
export function wingUnits(w: World, s: Shelter): Shelter[] {
  const wing = w.castleCompounds?.flatMap((c) => c.wings).find((g) => g.ids.includes(s.id));
  if (!wing) return [s];
  const units = w.shelters.filter((o) => wing.ids.includes(o.id) && shelterDone(o) && o.hp > 0 && !o.lift).sort((a, b) => a.id - b.id);
  return units.length ? units : [s];
}

export function compoundOf(w: World, id: number) {
  return w.castleCompounds?.find((c) => c.wings.some((g) => g.ids.includes(id))) ?? null;
}

function slots(n: number): CastlePoint[] {
  const out = [{ x: 0, y: 0 }, { x: DX, y: 0 }, { x: DX * 2, y: 0 }, { x: DX * 3, y: 0 }];
  for (let row = 1; out.length < Math.max(n, 10); row++) out.push({ x: 0, y: row * DY }, { x: DX * 3, y: row * DY });
  return out.slice(0, n);
}

function fixedRects(w: World, moving: Set<number>): Rect[] {
  const rects: Rect[] = [];
  for (const b of w.colony.buildings) {
    if (b.lift || b.kind === "path" || b.kind === "bridge" || b.kind === "boneTorch") continue;
    const def = BUILDINGS[b.kind];
    rects.push({ x: b.tx * TILE + (def?.w ?? 2) * TILE / 2, y: b.ty * TILE + (def?.h ?? 2) * TILE / 2, rx: (def?.w ?? 2) * TILE / 2 + 5, ry: (def?.h ?? 2) * TILE / 2 + 5 });
  }
  for (const s of w.shelters) if (!moving.has(s.id) && !s.lift) rects.push({ x: s.x, y: s.y - 14, rx: 34, ry: 27 });
  for (const t of w.tribe.walls) rects.push({ x: (t.tx + 0.5) * TILE, y: (t.ty + 0.5) * TILE, rx: 17, ry: 17 });
  for (const t of w.tribe.towers) rects.push({ x: t.x, y: t.y - 16, rx: 36, ry: 36 });
  for (const f of w.tribe.farms) rects.push({ x: f.x, y: f.y, rx: 38, ry: 26 });
  for (const f of w.campfires) rects.push({ x: f.x, y: f.y, rx: 24, ry: 20 });
  for (const s of w.colony.scorpions) if (s.mount === "ground") rects.push({ x: s.x, y: s.y, rx: 25, ry: 22 });
  for (const c of w.castleCompounds ?? []) if (!c.wings.some((g) => g.ids.some((id) => moving.has(id)))) {
    rects.push({ ...c.garden, rx: 54, ry: 46 }, ...c.pads.map((p) => ({ ...p, rx: 43, ry: 36 })), { ...c.rest, rx: 64, ry: 38 });
  }
  return rects;
}
const overlaps = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < a.rx + b.rx && Math.abs(a.y - b.y) < a.ry + b.ry;

function courtyardRect(origin: CastlePoint, wings: CastleWing[]): Rect {
  const bottom = Math.max(origin.y + 202, ...wings.map((g) => g.y + 20));
  return { x: origin.x + 96, y: (origin.y + 16 + bottom) / 2, rx: 63, ry: (bottom - origin.y - 16) / 2 };
}

function safe(w: World, r: Rect, obstacles: Rect[]) {
  if (obstacles.some((o) => overlaps(r, o))) return false;
  for (let y = r.y - r.ry; y <= r.y + r.ry; y += 12) for (let x = r.x - r.rx; x <= r.x + r.rx; x += 12) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (!w.colony.footing(w, tx, ty) || w.fire.at(tx, ty) > 0.05 || w.lava.heatAt(tx, ty) > 0.05) return false;
  }
  return true;
}

function facility(w: World, target: CastlePoint, rx: number, ry: number, obstacles: Rect[], outside = false): CastlePoint | null {
  for (let ring = 0; ring <= 6; ring++) for (let k = 0; k < (ring ? 12 : 1); k++) {
    const a = k * Math.PI / 6;
    const p = { x: target.x + Math.cos(a) * ring * TILE, y: target.y + Math.sin(a) * ring * TILE };
    if (outside && w.tribe.walledIn(w, p.x, p.y)) continue;
    if (safe(w, { ...p, rx, ry }, obstacles)) return p;
  }
  return null;
}

function plan(w: World, homes: Shelter[], origin: CastlePoint): CastleCompound | null {
  const obstacles = fixedRects(w, new Set(homes.map((s) => s.id)));
  const wings: CastleWing[] = [];
  const offsets = slots(Math.ceil(homes.length / ROOMS_PER_WING));
  const protectedCamp = homes.some((s) => w.tribe.walledIn(w, s.x, s.y));
  for (let i = 0; i < offsets.length; i++) {
    const p = { x: origin.x + offsets[i].x, y: origin.y + offsets[i].y };
    if (protectedCamp && !w.tribe.walledIn(w, p.x, p.y)) return null;
    const r = { x: p.x, y: p.y - 15, rx: 31, ry: 28 };
    if (!safe(w, r, obstacles)) return null;
    wings.push({ ...p, ids: homes.slice(i * ROOMS_PER_WING, (i + 1) * ROOMS_PER_WING).map((s) => s.id) });
    obstacles.push(r);
  }
  const garden = { x: origin.x + DX * 1.5, y: origin.y + DY * 1.5 };
  const gardenRect = { ...garden, rx: 54, ry: 46 };
  const court = courtyardRect(origin, wings);
  if (!safe(w, gardenRect, obstacles) || !safe(w, court, obstacles)) return null;
  obstacles.push(court);
  // A broad open approach stays clear between the residential wings and animal grounds.
  const pads: CastlePoint[] = [];
  for (const x of [origin.x + 16, origin.x + DX * 3 - 16]) {
    const p = facility(w, { x, y: origin.y + Math.max(240, Math.ceil(offsets.length / 2) * 44) }, 43, 36, obstacles);
    if (!p) return null;
    pads.push(p); obstacles.push({ ...p, rx: 47, ry: 40 });
  }
  const rest = facility(w, { x: garden.x, y: Math.max(...pads.map((p) => p.y)) + 94 }, 64, 38, obstacles, true);
  if (!rest) return null;
  return { id: homes[0].id, origin, wings, garden, pads, rest };
}

/** One bounded cleanup after housing changes; never shuffle the camp every frame. */
export function organizeCastles(w: World, force = false) {
  if (w.extinction.wasteland || w.tribe.raid || w.shelters.some((s) => s.lift || s.up)) return 0;
  w.castleCompounds = w.castleCompounds.filter((c) => c.wings.some((g) => g.ids.some((id) => w.shelters.some((s) => s.id === id))));
  const eligible = w.shelters.filter((s) => s.tier >= 4 && shelterDone(s) && s.hp > 0 && !s.lift && !s.up).sort((a, b) => a.id - b.id);
  const signature = eligible.map((s) => `${s.id}:${s.tier}`).join(",");
  const previous = scheduler.get(w);
  if (!force && previous && (previous.next > w.elapsed || previous.signature === signature)) return 0;
  scheduler.set(w, { signature, next: w.elapsed + 12 });
  let moved = 0;
  const remaining = new Set(eligible);
  while (remaining.size) {
    const seed = remaining.values().next().value!;
    const homes = [seed]; remaining.delete(seed);
    for (let i = 0; i < homes.length; i++) for (const other of Array.from(remaining)) {
      if (Math.hypot(other.x - homes[i].x, other.y - homes[i].y) <= 360) { remaining.delete(other); homes.push(other); }
    }
    homes.sort((a, b) => a.id - b.id);
    if (homes.length < 3) continue;
    const old = compoundOf(w, seed.id);
    if (old && old.wings.flatMap((g) => g.ids).length === homes.length && homes.every((s) => old.wings.some((g) => g.ids.includes(s.id)))) continue;
    const mean = { x: homes.reduce((n, s) => n + s.x, 0) / homes.length - DX * 1.5, y: homes.reduce((n, s) => n + s.y, 0) / homes.length - DY };
    const candidates: CastlePoint[] = old ? [old.origin] : [];
    for (let ring = 0; ring <= 8; ring++) for (let k = 0; k < (ring ? 12 : 1); k++) {
      const a = k * Math.PI / 6;
      candidates.push({ x: Math.round((mean.x + Math.cos(a) * ring * 48) / TILE) * TILE + TILE / 2, y: Math.round((mean.y + Math.sin(a) * ring * 48) / TILE) * TILE });
    }
    let result: CastleCompound | null = null;
    for (const p of candidates) { result = plan(w, homes, p); if (result) break; }
    if (!result) { scheduler.set(w, { signature: "", next: w.elapsed + 30 }); continue; }
    // Commit together only after every room, garden and animal space has a valid location.
    for (const wing of result.wings) for (const id of wing.ids) {
      const s = homes.find((h) => h.id === id)!;
      const dx = wing.x - s.x, dy = wing.y - s.y;
      for (const h of w.humans) if (h.home === id && ["sleep", "hide", "rest"].includes(h.state) && Math.hypot(h.x - s.x, h.y - s.y) < 45) {
        h.x += dx; h.y += dy; h.tx = h.x; h.ty = h.y; h.path = null;
      }
      s.x = wing.x; s.y = wing.y; moved++;
    }
    const ids = new Set(homes.map((s) => s.id));
    w.castleCompounds = w.castleCompounds.filter((c) => !c.wings.some((g) => g.ids.some((id) => ids.has(id))));
    w.castleCompounds.push(result);
  }
  if (moved) {
    w.shelterVersion++; w.tribe.zoneT = 0;
    w.population.assignHomes(w);
    w.toast("🏰", "Castle tidied: shared residential wings, a garden, dragon landing pads and a dinosaur rest yard. Every resident keeps their bed.");
  }
  return moved;
}

/** Reserved spaces participate in placement checks and stay free of wild regrowth. */
export function castleGroundRects(w: World): Rect[] {
  return (w.castleCompounds ?? []).flatMap((c) => [courtyardRect(c.origin, c.wings), ...c.pads.map((p) => ({ ...p, rx: 43, ry: 36 })), { ...c.rest, rx: 64, ry: 38 }]);
}
export function castleReserved(w: World, x: number, y: number) { return castleGroundRects(w).some((r) => Math.abs(r.x - x) < r.rx && Math.abs(r.y - y) < r.ry); }

export function castleDragonPad(w: World, dr: Dragon): CastlePoint | null {
  if (!w.dragons.owned.includes(dr) || (dr.growth ?? 1) < 0.4) return null;
  const pads = (w.castleCompounds ?? []).flatMap((c) => c.pads);
  const index = w.dragons.owned.filter((d) => (d.growth ?? 1) >= 0.4).sort((a, b) => a.id - b.id).findIndex((d) => d.id === dr.id);
  const p = pads[index];
  const own = new Set((w.castleCompounds ?? []).flatMap((c) => c.wings.flatMap((g) => g.ids)));
  return p && safe(w, { ...p, rx: 24, ry: 20 }, fixedRects(w, own)) ? p : null;
}

export function castleDinoRest(w: World, d: Dino): CastlePoint | null {
  if (!d.owner || d.rider || d.raider || d.under || sp(d.species).move !== "walk") return null;
  const yard = [...(w.castleCompounds ?? [])].sort((a, b) => Math.hypot(a.rest.x - d.x, a.rest.y - d.y) - Math.hypot(b.rest.x - d.x, b.rest.y - d.y))[0]?.rest;
  if (!yard || w.tribe.walledIn(w, yard.x, yard.y)) return null;
  const pets = w.dinos.filter((o) => o.owner && !o.rider && !o.raider && !o.under && sp(o.species).move === "walk").sort((a, b) => a.id - b.id);
  const i = pets.findIndex((o) => o.id === d.id);
  if (i < 0 || i >= 6) return null;
  const p = { x: yard.x + (i % 3 - 1) * 38, y: yard.y + (Math.floor(i / 3) - 0.5) * 34 };
  return w.nav.passable("dino", p.x, p.y) && w.fire.at(Math.floor(p.x / TILE), Math.floor(p.y / TILE)) < 0.05 ? p : null;
}

/** Mark a facility's tiles for the ordinary structure placement checks. */
export function castleReservedTiles(w: World): number[] {
  const out: number[] = [];
  for (const r of castleGroundRects(w)) for (let ty = Math.floor((r.y - r.ry) / TILE); ty <= Math.floor((r.y + r.ry) / TILE); ty++) for (let tx = Math.floor((r.x - r.rx) / TILE); tx <= Math.floor((r.x + r.rx) / TILE); tx++) out.push(ty * MAP_W + tx);
  return out;
}
