/* ------------------------------------------------------------------ */
/*  Shade + seating: hide awnings, log seating rings and covered rest  */
/*  areas. People drift there in their free time (more on hot days),   */
/*  shelter under the covered ones from rain, and an evening crowd     */
/*  spills from a full campfire onto a seating ring beside it.         */
/*  Sitting there rests them: a little healing + energy, and a chat.   */
/*  Seats are claimed like campfire seats (Human.fireId + seat).       */
/* ------------------------------------------------------------------ */
import { go, homeArea, say } from "./humans";
import { pick } from "./rng";
import type { Building, BuildingKind, Human } from "./types";
import type { World } from "./world";

export interface ShadeDef {
  /** seats under / around it */
  seats: number;
  /** keeps the rain off */
  covered: boolean;
  /** how far round the centre people sit */
  r: number;
}

export const SHADE: Partial<Record<BuildingKind, ShadeDef>> = {
  canopy: { seats: 4, covered: true, r: 18 },
  seatRing: { seats: 8, covered: false, r: 34 },
  pavilion: { seats: 8, covered: true, r: 30 },
};

/** How far people will walk to sit in the shade. */
const REACH = 900;

export const isShade = (b: Building) => !!SHADE[b.kind] && b.built >= 1 && b.hp > 0;

const seatAt = (b: Building, n: number) => {
  const def = SHADE[b.kind]!;
  const a = (n / def.seats) * Math.PI * 2 + 0.4;
  return { x: b.x + Math.cos(a) * def.r, y: b.y + 4 + Math.sin(a) * def.r * 0.45 };
};

function taken(w: World, b: Building, me: Human) {
  const out = new Set<number>();
  for (const o of w.humans) {
    if (o === me || o.fireId !== b.id || o.seat === undefined) continue;
    const s = seatAt(b, o.seat);
    if (o.state === "relax" || (o.state === "walk" && Math.hypot(o.tx - s.x, o.ty - s.y) < 4)) out.add(o.seat);
  }
  return out;
}

/**
 * A shade seat for this person: near home, with room, friends there count for a bit.
 * `covered` = only ones with a roof (rain); `nearFire` = only seating within reach of a lit fire.
 */
export function pickShade(w: World, h: Human, o: { covered?: boolean; nearFire?: boolean; reach?: number; from?: { x: number; y: number } } = {}) {
  const from = o.from ?? homeArea(w, h);
  let best: { b: Building; seat: number } | null = null;
  let bestScore = Infinity;
  for (const b of w.colony.buildings) {
    if (!isShade(b)) continue;
    const def = SHADE[b.kind]!;
    if (o.covered && !def.covered) continue;
    if (o.nearFire && !w.campfires.some((f) => f.lit && Math.hypot(f.x - b.x, f.y - b.y) < 170)) continue;
    const d = Math.hypot(b.x - from.x, b.y - from.y);
    if (d > (o.reach ?? REACH)) continue;
    const seats = taken(w, b, h);
    const mine = h.fireId === b.id && h.seat !== undefined && !seats.has(h.seat);
    if (!mine && seats.size >= def.seats) continue;
    const score = d + seats.size * 30 - (mine ? 150 : 0);
    if (score < bestScore) {
      bestScore = score;
      let seat = mine ? h.seat! : 0;
      if (!mine) while (seats.has(seat)) seat++;
      best = { b, seat };
    }
  }
  if (!best) return null;
  h.fireId = best.b.id;
  h.seat = best.seat;
  return { b: best.b, ...seatAt(best.b, best.seat) };
}

/** Walk to a shade seat and sit (true if there was one). */
export function goRelax(w: World, h: Human, o: Parameters<typeof pickShade>[2] = {}) {
  const s = pickShade(w, h, o);
  if (!s) return false;
  if (Math.hypot(h.x - s.x, h.y - s.y) < 6) go(h, "relax", s.x, s.y);
  else go(h, "walk", s.x, s.y);
  return true;
}

/** Just walked up to a claimed shade seat: sit down (true if so). */
export function sitIfAtShade(w: World, h: Human) {
  if (h.seat === undefined || !h.fireId) return false;
  const b = w.colony.buildings.find((x) => x.id === h.fireId);
  if (!b || !isShade(b)) return false;
  const s = seatAt(b, h.seat);
  if (Math.hypot(h.x - s.x, h.y - s.y) > 8) return false;
  go(h, "relax", s.x, s.y);
  return true;
}

/** Per frame while sitting in the shade: rest up, chat, then get back to things. */
export function relaxTick(w: World, h: Human, dt: number) {
  const b = w.colony.buildings.find((x) => x.id === h.fireId);
  if (!b || !isShade(b)) {
    go(h, "idle", h.x, h.y);
    return;
  }
  // a bit of rest: healing and energy come back faster than standing about
  h.hp = Math.min(1, h.hp + dt * (b.kind === "pavilion" ? 0.006 : 0.004));
  h.energy = Math.min(1, h.energy + dt * 0.01);
  if (w.rng() < dt * 0.04) say(h, pick(w.rng, ["Ahh, shade.", "Nice spot.", "Did you see that dino?", "My feet hurt.", "Lovely breeze."]));
  // a while in the shade, then back to work (unless it's still pouring and this one has a roof)
  const raining = w.weather.rain > 0.55 && SHADE[b.kind]!.covered;
  if (h.stateT > (raining ? 60 : 18 + (h.id % 7) * 2)) {
    go(h, "idle", h.x, h.y);
    h.think = 0;
  }
}

/** How many shade structures a zone round (x, y) has (the planner spreads them out). */
export function shadeNear(w: World, x: number, y: number, r: number) {
  return w.colony.buildings.filter((b) => SHADE[b.kind] && Math.hypot(b.x - x, b.y - y) < r).length;
}

export const SHADE_KINDS = Object.keys(SHADE) as BuildingKind[];
