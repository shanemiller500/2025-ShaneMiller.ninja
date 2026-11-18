import { BUILDINGS } from "../data/colony";
import { sp } from "../data/species";
import { shelterDone } from "./build";
import { canMove } from "./moving";
import { MAP_W, TILE, type Dino, type Dragon, type Shelter } from "./types";
import type { World } from "./world";

export interface CastlePoint { x: number; y: number }
export interface CastleWing extends CastlePoint { ids: number[] }
export interface CastleCompound {
  layout?: "keep";
  halfWidth?: number;
  id: number;
  origin: CastlePoint;
  wings: CastleWing[];
  garden: CastlePoint;
  pads: CastlePoint[];
  rest: CastlePoint | null;
}
interface Rect { x: number; y: number; rx: number; ry: number }
const scheduler = new WeakMap<World, { signature: string; next: number }>();

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

export const keepHeight = (rooms: number) => Math.min(6, 3 + Math.ceil(rooms / 8)) * 24;
const keepRect = (c: CastleCompound): Rect => ({ x: c.origin.x, y: c.origin.y - 16, rx: c.halfWidth ?? 64, ry: 24 });

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
  for (const p of w.props) rects.push({ x: p.x, y: p.y, rx: p.kind === "chamber" ? 56 : 24, ry: p.kind === "chamber" ? 48 : 24 });
  for (const c of w.castleCompounds ?? []) if (!c.wings.some((g) => g.ids.some((id) => moving.has(id)))) {
    rects.push(...compoundRects(c));
  }
  return rects;
}
const overlaps = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < a.rx + b.rx && Math.abs(a.y - b.y) < a.ry + b.ry;

function courtyardRect(origin: CastlePoint, wings: CastleWing[]): Rect {
  const bottom = Math.max(origin.y + 202, ...wings.map((g) => g.y + 20));
  return { x: origin.x + 96, y: (origin.y + 16 + bottom) / 2, rx: 63, ry: (bottom - origin.y - 16) / 2 };
}

function compoundRects(c: CastleCompound): Rect[] {
  return [c.layout === "keep" ? keepRect(c) : courtyardRect(c.origin, c.wings), ...(c.layout === "keep" ? [{ x: c.origin.x, y: c.origin.y + 30, rx: (c.halfWidth ?? 64) + 12, ry: 26 }] : []), ...c.pads.map((p) => ({ ...p, rx: 43, ry: 36 })), ...(c.rest ? [{ ...c.rest, rx: 64, ry: 38 }] : [])];
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

function plan(w: World, homes: Shelter[], origin: CastlePoint, halfWidth: number): CastleCompound | null {
  const obstacles = fixedRects(w, new Set(homes.map((s) => s.id)));
  const protectedCamp = homes.some((s) => w.tribe.walledIn(w, s.x, s.y));
  if (protectedCamp && !w.tribe.walledIn(w, origin.x, origin.y)) return null;
  const body = { x: origin.x, y: origin.y - 16, rx: halfWidth, ry: 24 };
  if (!safe(w, body, obstacles) || !safe(w, { x: origin.x, y: origin.y + 24, rx: 14, ry: 12 }, obstacles)) return null;
  obstacles.push(body);
  const wings: CastleWing[] = [{ ...origin, ids: homes.map((s) => s.id) }];
  // The garden is part of the roof, so a packed camp does not need an empty courtyard first.
  const garden = { ...origin };
  const pads: CastlePoint[] = [];
  for (const x of [origin.x - 72, origin.x + 72]) {
    const p = facility(w, { x, y: origin.y + 92 }, 43, 36, obstacles);
    if (!p) continue;
    pads.push(p); obstacles.push({ ...p, rx: 47, ry: 40 });
  }
  const rest = facility(w, { x: origin.x, y: Math.max(origin.y + 170, ...pads.map((p) => p.y + 94)) }, 64, 38, obstacles, true);
  return { id: homes[0].id, layout: "keep", halfWidth, origin, wings, garden, pads, rest };
}

/** One bounded cleanup after housing changes; never shuffle the camp every frame. */
export function organizeCastles(w: World, force = false) {
  if (w.extinction.wasteland) return 0;
  w.castleCompounds = w.castleCompounds.filter((c) => c.wings.some((g) => g.ids.some((id) => w.shelters.some((s) => s.id === id))));
  const eligible = w.shelters.filter((s) => s.tier >= 4 && shelterDone(s) && s.hp > 0).sort((a, b) => a.id - b.id);
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
    if (homes.length < 2) continue;
    if (homes.some((s) => s.lift || canMove(w, { kind: "shelter", id: s.id }))) {
      scheduler.set(w, { signature: "", next: w.elapsed + 5 });
      continue;
    }
    const old = compoundOf(w, seed.id);
    if (old?.layout === "keep" && homes.every((s) => old.wings[0].ids.includes(s.id))) continue;
    const mean = { x: homes.reduce((n, s) => n + s.x, 0) / homes.length, y: homes.reduce((n, s) => n + s.y, 0) / homes.length };
    const candidates: CastlePoint[] = old ? [old.origin] : [];
    candidates.push(...[...homes].sort((a, b) => Math.hypot(a.x - mean.x, a.y - mean.y) - Math.hypot(b.x - mean.x, b.y - mean.y)).map((s) => ({ x: s.x, y: s.y })));
    for (let ring = 0; ring <= 8; ring++) for (let k = 0; k < (ring ? 12 : 1); k++) {
      const a = k * Math.PI / 6;
      candidates.push({ x: Math.round((mean.x + Math.cos(a) * ring * 48) / TILE) * TILE + TILE / 2, y: Math.round((mean.y + Math.sin(a) * ring * 48) / TILE) * TILE });
    }
    let result: CastleCompound | null = null;
    for (const width of [64, 48, 32]) {
      for (const p of candidates) { result = plan(w, homes, p, width); if (result) break; }
      if (result) break;
    }
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
    w.toast("🏰", "Homes combined into one castle. Every resident keeps their room and bed.");
  }
  return moved;
}

/** Reserved spaces participate in placement checks and stay free of wild regrowth. */
export function castleGroundRects(w: World): Rect[] {
  return (w.castleCompounds ?? []).flatMap(compoundRects);
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
  const yard = (w.castleCompounds ?? []).map((c) => c.rest).filter((p): p is CastlePoint => !!p).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
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

/** Physical ground under the single keep, separate from the walkable garden and animal spaces. */
export function castleBodyTiles(w: World): number[] {
  const out: number[] = [];
  for (const c of w.castleCompounds ?? []) if (c.layout === "keep") {
    const r = keepRect(c);
    for (let ty = Math.floor((r.y - r.ry) / TILE); ty < Math.floor((c.origin.y + 6) / TILE); ty++)
      for (let tx = Math.floor((r.x - r.rx) / TILE); tx <= Math.floor((r.x + r.rx) / TILE); tx++) out.push(ty * MAP_W + tx);
  }
  return out;
}

export function keepMoveFits(w: World, id: number, x: number, y: number): boolean {
  const c = compoundOf(w, id);
  return !!c && safe(w, { ...keepRect(c), x, y: y - 16 }, fixedRects(w, new Set(c.wings.flatMap((g) => g.ids))));
}
