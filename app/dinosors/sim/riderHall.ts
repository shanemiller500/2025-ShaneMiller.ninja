/* ------------------------------------------------------------------ */
/*  The Dragon Riders' Colosseum: where the dragon people live.        */
/*                                                                     */
/*  Built round the dragon pit like an arena: tiers of arched stone    */
/*  rooms looking down into it, dragon-head pillars at the great gate, */
/*  braziers and banners on top. Everyone bonded to a dragon (its      */
/*  rider, its keeper) has a room of their own, right behind the spot  */
/*  where their dragon sleeps; they go there to sleep + shelter.       */
/*                                                                     */
/*  It grows with the pit (wider as the pit is dug out) and with the   */
/*  people in it (another tier for every few who move in).             */
/* ------------------------------------------------------------------ */
import { pitCentre, pitOf, pitRadius, pitSpot } from "./shows";
import { MAP_H, MAP_W, TILE, type Building, type Dragon, type Human } from "./types";
import type { World } from "./world";

export const MAX_TIERS = 3;

/** The finished colosseum (and the one under construction, for placing). */
export const hallOf = (w: World): Building | null => w.colony.buildings.find((b) => b.kind === "riderHall" && b.built >= 1 && b.hp > 0) ?? null;
const anyHall = (w: World) => w.colony.buildings.find((b) => b.kind === "riderHall") ?? null;

/** Their dragon: the one they ride, or the one they keep. */
export function dragonFor(w: World, h: Human): Dragon | null {
  return w.dragons.owned.find((d) => d.partner === h.id || d.keeper === h.id) ?? null;
}

/** Everyone who lives in the colosseum: dragon riders + keepers (and dragon keepers between dragons). */
export function hallFolk(w: World): Human[] {
  return w.humans.filter((h) => !h.child && !h.stranger && !h.captive && (!!dragonFor(w, h) || w.tribe.roleOf(h) === "dragonKeeper"));
}

/** How many tiers of rooms it has risen to. */
export const hallTiers = (w: World) => Math.min(MAX_TIERS, 1 + Math.floor(hallFolk(w).length / 4));

/** The colosseum's rim (room ring) round the pit. */
export function hallRing(pit: Building) {
  const c = pitCentre(pit);
  const rx = pitRadius(pit) + 40;
  return { cx: c.x, cy: c.y, rx, ry: pitRadius(pit) * 0.7 + 30 };
}

/** Where someone's room is: on the rim right behind the spot where their dragon sleeps. */
export function roomOf(w: World, h: Human): { x: number; y: number; a: number } | null {
  const hall = hallOf(w);
  const pit = pitOf(w);
  if (!hall || !pit) return null;
  const folk = hallFolk(w);
  const i = folk.indexOf(h);
  if (i < 0) return null;
  const c = pitCentre(pit);
  const dr = dragonFor(w, h);
  let a: number;
  if (dr) {
    const n = w.dragons.owned.indexOf(dr);
    const s = pitSpot(pit, Math.max(0, n), Math.max(1, w.dragons.owned.length));
    a = Math.atan2((s.y - c.y) / 0.5, s.x - c.x);
    // more than one person for a dragon (rider + keeper): rooms side by side
    const mates = folk.filter((o) => dragonFor(w, o) === dr);
    a += (mates.indexOf(h) - (mates.length - 1) / 2) * 0.22;
  } else a = (i / Math.max(1, folk.length)) * Math.PI * 2 + 1.1;
  // (just inside the wall: it's reached through the great gate, from the arena)
  const r = hallRing(pit);
  return { x: r.cx + Math.cos(a) * (r.rx - 44), y: r.cy + Math.sin(a) * (r.ry - 32) + 4, a };
}

/** The great gate at the front: half its width as an angle round the ring. */
export const GATE_HALF = 0.26;

/**
 * The tiles the colosseum's walls stand on: a solid ring round the pit that nobody walks through,
 * except at the great gate at the front.
 */
export function hallTiles(w: World): number[] {
  const hall = w.colony.buildings.find((b) => b.kind === "riderHall" && b.built >= 0.4 && b.hp > 0);
  const pit = pitOf(w);
  if (!hall || !pit) return [];
  const r = hallRing(pit);
  const inner = 1 - 12 / r.rx;
  const outer = 1 + 26 / r.rx;
  const out: number[] = [];
  const x0 = Math.max(0, Math.floor((r.cx - r.rx * outer) / TILE));
  const x1 = Math.min(MAP_W - 1, Math.ceil((r.cx + r.rx * outer) / TILE));
  const y0 = Math.max(0, Math.floor((r.cy - r.ry * outer) / TILE));
  const y1 = Math.min(MAP_H - 1, Math.ceil((r.cy + r.ry * outer) / TILE));
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const dx = (tx * TILE + TILE / 2 - r.cx) / r.rx;
      const dy = (ty * TILE + TILE / 2 - r.cy) / r.ry;
      const e = Math.hypot(dx, dy);
      if (e < inner || e > outer) continue;
      if (Math.abs(Math.atan2(dy, dx) - Math.PI / 2) < GATE_HALF) continue;
      out.push(ty * MAP_W + tx);
    }
  }
  return out;
}

/** Changes whenever the walls move or grow (so the walking map is rebuilt). */
export function hallKey(w: World) {
  const hall = w.colony.buildings.find((b) => b.kind === "riderHall" && b.built >= 0.4 && b.hp > 0);
  const pit = pitOf(w);
  return hall && pit ? `${hall.id}:${Math.round(pit.x)}:${Math.round(pit.y)}:${Math.round(pitRadius(pit) / 8)}` : "";
}

/** Is this person tucked up in their room right now? (drawn as inside) */
export function inRoom(w: World, h: Human) {
  if (h.state !== "sleep" && h.state !== "hide" && h.state !== "rest") return false;
  const room = roomOf(w, h);
  return !!room && Math.hypot(h.x - room.x, h.y - room.y) < 16;
}

/** Build tool: the colosseum always goes round the dragon pit (returns why not). */
export function placeHall(w: World): string | null {
  const pit = pitOf(w);
  if (!pit) return "Build a dragon pit first: the colosseum is built round it.";
  if (anyHall(w)) return "There's already a Dragon Riders' Colosseum round the pit.";
  const b: Building = { id: w.nextId(), kind: "riderHall", tx: pit.tx, ty: pit.ty, x: pit.x, y: pit.y, built: 0, have: {}, hp: 1600 };
  w.colony.buildings.push(b);
  w.colony.version++;
  return null;
}

/** Once a second: the dragon people move in (and a tier goes up as more arrive). */
export function hallTick(w: World) {
  const hall = hallOf(w);
  if (!hall) return;
  // its ground is kept clear: nothing grows up through the tiers (timber to the stores)
  const pit = pitOf(w);
  if (pit) {
    const r = hallRing(pit);
    let n = 0;
    for (let i = w.plants.length - 1; i >= 0; i--) {
      const p = w.plants[i];
      if (Math.hypot((p.x - r.cx) / (r.rx + 60), (p.y - r.cy) / (r.ry + 50)) > 1) continue;
      w.plants.splice(i, 1);
      if (p.size > 0.5 && !p.stump) w.camp.stock.wood += 1;
      n++;
    }
    if (n) w.plantsDirty = true;
  }
  const n = hallFolk(w).length;
  const tiers = hallTiers(w);
  if (n && !w.flags.has("hallOpen")) {
    w.flags.add("hallOpen");
    w.toast("🏛️", `The Dragon Riders' Colosseum is open! ${n} dragon ${n === 1 ? "person moves" : "people move"} into rooms right behind where their dragons sleep.`, hall.x, hall.y);
  }
  if (tiers > 1 && !w.flags.has(`hallTier${tiers}`)) {
    w.flags.add(`hallTier${tiers}`);
    w.toast("🏛️", `The colosseum rises another tier: room for ${n} dragon riders + keepers now.`, hall.x, hall.y);
  }
}
