/* ------------------------------------------------------------------ */
/*  The dragon pit + dragon shows.                                     */
/*                                                                     */
/*  The pit is where the tribe's dragons live (they sleep there) and   */
/*  where their keepers put on shows: of an evening (or whenever you   */
/*  press Put on a show) keepers lead their dragons into the arena for */
/*  tricks: bounding hops, spins, roars, puffs of fire into the sky,   */
/*  and loops through the air once they can fly. Everyone free comes  */
/*  to sit round the rim and cheer, and goes home rested + happy.      */
/* ------------------------------------------------------------------ */
import { go, say } from "./humans";
import { P } from "./particles";
import { pick } from "./rng";
import { TILE, type Building, type Dragon, type Human } from "./types";
import type { World } from "./world";
import { canFly, dragonStats } from "./dragonKeep";
import { keeperOf } from "./keepers";
import { BUILDINGS } from "../data/colony";

/** How long a show runs (seconds). */
export const SHOW_SECONDS = 50;
/** Most people in the audience. */
const AUDIENCE = 16;

export interface Show {
  pit: number;
  t: number;
  /** dragons performing (ids) */
  acts: number[];
  /** people watching (ids) */
  crowd: number[];
}

export const pitOf = (w: World): Building | null => w.colony.buildings.find((b) => b.kind === "dragonPit" && b.built >= 1 && b.hp > 0) ?? null;

/** The arena floor's centre (the pit is a sunken bowl a bit above its base line). */
export const pitCentre = (b: Building) => ({ x: b.x, y: b.y - TILE * 1.6 });
/** How far the pit has been dug out (1 = as built). */
export const pitScale = (b: Building) => b.grow ?? 1;
/** Arena radius (horizontal). */
export const pitRadius = (b: Building) => TILE * 2.4 * pitScale(b);
/** The biggest the tribe will dig it (each pit joined into it lets it go bigger). */
export const PIT_MAX = 4;
export const pitMax = (b: Building) => PIT_MAX + (b.merged ?? 0) * 1.2;
/** Pits whose rims are this close (or overlapping) join into one. */
export const PIT_JOIN = 260;

/** How big the pit should be for the dragons we have: room for every one of them (big ones need more). */
export function pitWant(w: World, pit?: Building | null) {
  let area = 0;
  for (const d of w.dragons.owned) area += dragonStats(d).scale ** 2;
  return Math.max(1, Math.min(pit ? pitMax(pit) : PIT_MAX, 0.9 + 0.6 * Math.sqrt(area)));
}

/**
 * A second pit finished next to the first: they're dug into one great pit, centred between them, bigger than
 * either (the colosseum round it moves with it). Returns the pit that was joined in, if any.
 */
export function joinPits(w: World): Building | null {
  const main = pitOf(w);
  if (!main) return null;
  const other = w.colony.buildings.find((b) => b !== main && b.kind === "dragonPit" && b.built >= 1 && b.hp > 0
    && Math.hypot(pitCentre(b).x - pitCentre(main).x, pitCentre(b).y - pitCentre(main).y) < pitRadius(main) + pitRadius(b) + PIT_JOIN);
  if (!other) return null;
  const def = BUILDINGS.dragonPit;
  // the new middle, weighted by how big each one was
  const a = pitScale(main) ** 2;
  const b = pitScale(other) ** 2;
  const x = (main.x * a + other.x * b) / (a + b);
  const y = (main.y * a + other.y * b) / (a + b);
  const gap = Math.hypot(main.x - other.x, main.y - other.y);
  main.merged = (main.merged ?? 0) + 1 + (other.merged ?? 0);
  // big enough to take in both (and the ground between)
  main.grow = Math.min(pitMax(main), Math.max(pitScale(main), pitScale(other)) + 0.8 + gap / (TILE * 2.4) * 0.35);
  main.x = x;
  main.y = y;
  main.tx = Math.round(x / TILE - def.w / 2);
  main.ty = Math.round((y + TILE / 2) / TILE - def.h);
  main.hp = Math.max(main.hp, other.hp);
  w.colony.buildings.splice(w.colony.buildings.indexOf(other), 1);
  for (const h of w.colony.buildings) if (h.kind === "riderHall") {
    h.x = main.x;
    h.y = main.y;
    h.tx = main.tx;
    h.ty = main.ty;
  }
  w.colony.version++;
  clearPitFloor(w, main);
  const c = pitCentre(main);
  w.particles.burst(P.Dust, c.x, c.y, 24, pitRadius(main), { size: 16, max: 1.4, color: "rgba(170,145,100,0.55)" });
  w.sfx("rumble", c.x, c.y, 1, 0.8);
  w.toast("🏟️", `The two dragon pits are dug into one great pit, with a shady overhang at the back for the dragons to rest out of the sun!`, c.x, c.y);
  return other;
}

/* ------------------------------ the shade ------------------------------ */

/** The shady strip under the rock overhang at the back of the arena. */
export function pitShade(b: Building) {
  const c = pitCentre(b);
  const r = pitRadius(b);
  return { x: c.x, y: c.y - r * 0.5 * 0.42, rx: r * 0.62, ry: r * 0.5 * 0.26 };
}

/** The hot middle of the day: dragons rest in the shade. */
export const hotHours = (w: World) => w.time >= 11 && w.time <= 16.5 && w.daylight > 0.55 && w.weather.rain < 0.3;

/** Dragon n's spot in the shade (spread along the overhang, two rows once it's crowded). */
export function pitShadeSpot(b: Building, n: number, of: number) {
  const s = pitShade(b);
  const per = Math.max(1, Math.ceil(of / 2));
  const row = of > 4 && n >= per ? 1 : 0;
  const k = row ? n - per : n;
  const cols = row ? of - per : Math.min(of, of > 4 ? per : of);
  // the back row a half-step over from the front one, so nobody lies on top of anyone
  const f = cols <= 1 ? 0.5 : (k + (row ? 0.5 : 0)) / (cols - (row ? 0 : 1));
  return { x: s.x - s.rx * 0.85 + Math.min(1, f) * s.rx * 1.7, y: s.y - s.ry * 0.45 + row * Math.max(s.ry * 1.1, 36) };
}

/** Every frame: dig the pit out wider whenever the dragons have outgrown it (it never shrinks). */
export function pitGrow(w: World, dt: number) {
  // a second pit finished beside it: dig them into one
  if (Math.floor(w.elapsed) !== Math.floor(w.elapsed - dt)) joinPits(w);
  const pit = pitOf(w);
  if (!pit) return;
  // the arena floor is kept clear: anything growing in it is dug out (the timber goes to the stores)
  // (every couple of seconds of game time)
  if (Math.floor(w.elapsed / 2) !== Math.floor((w.elapsed - dt) / 2)) clearPitFloor(w, pit);
  const want = pitWant(w, pit);
  const now = pitScale(pit);
  if (now >= want - 0.01) return;
  pit.grow = Math.min(want, now + dt * 0.012);
  const c = pitCentre(pit);
  if (w.rng() < dt * 3) {
    const a = w.rng() * Math.PI * 2;
    const r = pitRadius(pit);
    w.particles.burst(P.Dust, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.5, 3, 30, { size: 12, max: 1, color: "rgba(170,145,100,0.55)" });
  }
  const step = Math.floor(want * 4);
  if (!w.flags.has(`pitDig${pit.id}:${step}`)) {
    w.flags.add(`pitDig${pit.id}:${step}`);
    w.toast("🏟️", `The dragons are outgrowing their pit: the tribe is digging it out wider so they have room to walk about and sleep (${w.dragons.owned.length} dragon${w.dragons.owned.length === 1 ? "" : "s"}).`, c.x, c.y);
  }
}

/** Dig out any trees + bushes standing inside the arena. */
export function clearPitFloor(w: World, pit: Building) {
  const c = pitCentre(pit);
  const r = pitRadius(pit) + 16;
  let n = 0;
  for (let i = w.plants.length - 1; i >= 0; i--) {
    const p = w.plants[i];
    // (the drawn bowl is 0.7 as deep as it is wide, rim included)
    if (Math.hypot(p.x - c.x, (p.y - c.y) / 0.7) > r) continue;
    w.plants.splice(i, 1);
    n++;
    if (p.size > 0.5 && !p.stump) w.camp.stock.wood += 1;
    if (n < 6) w.particles.burst(P.Leaf, p.x, p.y - 12, 6, 50, { z: 16, size: 3, max: 0.8, color: "#6b9a3f" });
  }
  if (n) w.plantsDirty = true;
  return n;
}

/** Where dragon n of the troupe sleeps / stands in the pit (one ring, then an inner ring too once there are lots). */
export function pitSpot(b: Building, n: number, of: number) {
  const c = pitCentre(b);
  const outer = of <= 6 ? of : Math.ceil(of * 0.62);
  const inner = n >= outer;
  const k = inner ? n - outer : n;
  const ring = inner ? of - outer : outer;
  const a = (k / Math.max(1, ring)) * Math.PI * 2 + (inner ? 0.9 : 0.3);
  const r = pitRadius(b) * (inner ? 0.26 : 0.6);
  return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.5 };
}

/** Somewhere on the arena floor to wander to. */
export function pitWanderSpot(w: World, b: Building) {
  const c = pitCentre(b);
  const a = w.rng() * Math.PI * 2;
  const r = pitRadius(b) * 0.72 * Math.sqrt(w.rng());
  return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.5 };
}

/** A seat on the rim for audience member n. */
function rimSeat(b: Building, n: number) {
  const c = pitCentre(b);
  const a = (n / AUDIENCE) * Math.PI * 2 + 0.15;
  const r = pitRadius(b) + 38;
  return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.55 + 6 };
}

/** Can a show go on right now? (Returns why not.) */
export function showReady(w: World): string | null {
  if (w.dragons.show) return "A show is already on!";
  const pit = pitOf(w);
  if (!pit) return "Build a dragon pit first.";
  if (w.tribe.raid) return "Not during a raid!";
  if (!w.dragons.owned.some((d) => keeperOf(w, d) && d.hp > d.maxHp * 0.4 && !d.cmd)) return "No dragon (with its keeper) is ready to perform.";
  return null;
}

/** Start a show (the player's button, or the evening one). */
export function startShow(w: World, quiet = false): string | null {
  const why = showReady(w);
  if (why) return why;
  const pit = pitOf(w)!;
  const acts = w.dragons.owned.filter((d) => keeperOf(w, d) && d.hp > d.maxHp * 0.4 && !d.cmd).map((d) => d.id);
  const c = pitCentre(pit);
  const crowd = w.humans
    .filter((h) => !h.stranger && !h.captive && !h.under && !h.aloft && h.state !== "down" && !h.taskId && !h.order && w.tribe.roleOf(h) !== "dragonKeeper" && Math.hypot(h.x - c.x, h.y - c.y) < 1400)
    .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))
    .slice(0, AUDIENCE)
    .map((h) => h.id);
  w.dragons.show = { pit: pit.id, t: 0, acts, crowd };
  for (const id of crowd) {
    const h = w.humans.find((x) => x.id === id)!;
    h.think = 0;
  }
  w.sfx("drums", c.x, c.y, 1);
  if (!quiet) w.toast("🎪", `Dragon show in the pit! ${acts.length} dragon${acts.length > 1 ? "s" : ""} and their keepers perform; ${crowd.length} come to watch.`, c.x, c.y);
  return null;
}

/** Per frame: run the show (dragons + keepers do tricks, the crowd cheers), and plan the evening one. */
export function showsUpdate(w: World, dt: number) {
  pitGrow(w, dt);
  const s = w.dragons.show;
  if (!s) {
    // an evening show, once a day, when there's a pit and a dragon to show off
    if (w.time >= 18 && w.time < 19.5 && w.dragons.lastShowDay !== w.day && !w.tribe.raid && w.dragons.owned.length) {
      w.dragons.lastShowDay = w.day;
      startShow(w);
    }
    return;
  }
  const pit = w.colony.buildings.find((b) => b.id === s.pit);
  s.t += dt;
  if (!pit || s.t > SHOW_SECONDS || w.tribe.raid) {
    endShow(w, !!pit && s.t > SHOW_SECONDS);
    return;
  }
  const c = pitCentre(pit);
  const acts = s.acts.map((id) => w.dragons.owned.find((d) => d.id === id)).filter((d): d is Dragon => !!d);
  acts.forEach((d, i) => perform(w, pit, d, i, acts.length, s.t, dt));
  // the crowd
  if (w.rng() < dt * 1.2) {
    const id = s.crowd[Math.floor(w.rng() * s.crowd.length)];
    const h = id ? w.humans.find((x) => x.id === id) : null;
    if (h && h.state === "watch") say(h, pick(w.rng, ["Wooo!", "Again! Again!", "Look at it go!", "So cool!", "Fire! FIRE!", "Bravo!"]));
  }
  if (w.rng() < dt * 0.6) w.sfx("cheer", c.x, c.y, 0.4);
}

/** One dragon's act: into the arena, then tricks (hops, spins, roars, fire, loops in the air). */
function perform(w: World, pit: Building, d: Dragon, i: number, of: number, t: number, dt: number) {
  const k = keeperOf(w, d);
  const c = pitCentre(pit);
  const spot = pitSpot(pit, i, of);
  const st = dragonStats(d);
  d.cmd = null;
  d.state = "play";
  // walk (or glide) into place first
  const dd = Math.hypot(spot.x - d.x, spot.y - d.y);
  if (t < 8 && dd > 10) {
    const sp = 70 + 60 * (d.growth ?? 0);
    d.x += ((spot.x - d.x) / (dd || 1)) * Math.min(dd, sp * dt);
    d.y += ((spot.y - d.y) / (dd || 1)) * Math.min(dd, sp * dt);
    d.z = Math.max(0, d.z - dt * 80);
    d.anim += dt * 3;
    d.dir = spot.x > d.x ? 1 : -1;
  } else {
    // the tricks, round and round (each dragon a little out of step with the next)
    const beat = Math.floor((t + i * 1.7) / 3.5) % 5;
    const local = (t + i * 1.7) % 3.5;
    if (beat === 0 || beat === 1) {
      // bounding hops
      if (!d.hop) d.hop = 1.2;
    } else if (beat === 2) {
      // a spin + a roar
      d.dir = Math.floor(local * 4) % 2 ? 1 : -1;
      if (local < dt * 1.5) w.sfx("screech", d.x, d.y, 0.5, 1.4 - st.scale * 0.3);
    } else if (beat === 3) {
      // a plume of fire straight up (no ground fire: it's a show)
      if ((d.skills?.fire ?? 0) >= 0.3 && (d.growth ?? 0) >= 0.25) {
        d.breath = 1;
        if (w.rng() < dt * 14) w.particles.spawn(P.Ember, d.x + d.dir * 40 * st.scale, d.y, { z: 40 * st.scale + w.rng() * 20, vz: 160 + w.rng() * 80, vx: (w.rng() - 0.5) * 40, g: 60, size: 4 + w.rng() * 4, max: 0.9, color: w.rng() < 0.5 ? "#ffd447" : "#ff6a1f" });
      } else if (!d.hop) d.hop = 0.8;
    } else {
      // a loop through the air over the pit (flyers), else a big bow
      if (canFly(d)) {
        const a = local * 1.8;
        d.x = c.x + Math.cos(a + i) * pitRadius(pit) * 0.8;
        d.y = c.y + Math.sin(a + i) * pitRadius(pit) * 0.35;
        d.z = 40 + Math.sin(local * 0.9) * 50;
        d.dir = Math.cos(a + i + Math.PI / 2) > 0 ? 1 : -1;
        d.anim += dt * 6;
      } else d.anim += dt * 0.5;
    }
    if (beat !== 4) d.z = Math.max(0, d.z - dt * 90);
  }
  // the keeper stands in front, directing it
  if (k && !k.aloft) {
    const kx = c.x + (i - (of - 1) / 2) * 34;
    const ky = c.y + pitRadius(pit) * 0.45;
    if (Math.hypot(k.x - kx, k.y - ky) > 8 && k.state !== "walk") go(k, "walk", kx, ky);
    else if (Math.hypot(k.x - kx, k.y - ky) <= 8 && k.state !== "show") go(k, "show", kx, ky);
    if (k.state === "show" && w.rng() < dt * 0.3) say(k, pick(w.rng, ["Hup!", "Spin!", "Up, up!", "Show them, " + d.name + "!", "Ta-daa!"]));
  }
}

/** Is this person in the show's audience? (Walks them to a rim seat and keeps them there.) */
export function watchThink(w: World, h: Human): boolean {
  const s = w.dragons.show;
  if (!s) return false;
  const n = s.crowd.indexOf(h.id);
  if (n < 0) return false;
  const pit = w.colony.buildings.find((b) => b.id === s.pit);
  if (!pit) return false;
  const seat = rimSeat(pit, n);
  if (Math.hypot(h.x - seat.x, h.y - seat.y) > 8) go(h, "walk", seat.x, seat.y);
  else {
    go(h, "watch", seat.x, seat.y);
    h.dir = pitCentre(pit).x > h.x ? 1 : -1;
  }
  return true;
}

/** Curtain: the crowd goes home rested and cheerful; dragons go back to their spots. */
function endShow(w: World, finished: boolean) {
  const s = w.dragons.show!;
  w.dragons.show = null;
  const pit = w.colony.buildings.find((b) => b.id === s.pit);
  for (const id of s.crowd) {
    const h = w.humans.find((x) => x.id === id);
    if (!h) continue;
    if (finished && h.state === "watch") {
      h.energy = Math.min(1, h.energy + 0.25);
      h.warmth = Math.min(1, h.warmth + 0.1);
      if (w.rng() < 0.4) say(h, pick(w.rng, ["Best show ever!", "I love dragons!", "Can we see it again?"]));
    }
    if (h.state === "watch") go(h, "idle", h.x, h.y);
    h.think = 0;
  }
  for (const id of s.acts) {
    const d = w.dragons.owned.find((x) => x.id === id);
    if (!d) continue;
    d.breath = 0;
    d.z = 0;
    const k = keeperOf(w, d);
    if (k && k.state === "show") go(k, "idle", k.x, k.y);
  }
  if (finished && pit) {
    w.toast("🎪", "What a show! The crowd heads home rested and cheering.", pit.x, pit.y);
    w.celebrate("Dragon show!");
    w.discover("dragonShow", pit.x, pit.y);
  }
}
