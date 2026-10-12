/* ------------------------------------------------------------------ */
/*  Sonic firefighting (fantasy tech!).                                */
/*                                                                     */
/*  Once the tribe invents 🔊 Sonic firefighting it can build a sonic   */
/*  fire station. Smiths make ultrasonic fire emitters there, and the  */
/*  station stores them (the armory count). When a fire breaks out     */
/*  near camp or near a station, a crew runs to the station, takes an  */
/*  emitter each, and blasts the flames with ultrasonic vibration      */
/*  from a safe distance: the waves shake the fire apart and starve it */
/*  of air, so no water is needed. When it's out they put the emitters */
/*  back. No emitters (or no station)? The old bucket brigade it is.   */
/* ------------------------------------------------------------------ */
import { go, say } from "./humans";
import { P } from "./particles";
import { pick } from "./rng";
import { TILE, type Human } from "./types";
import { fireNear, issue } from "./tasks";
import type { World } from "./world";

export const EMITTER = "sonicEmitter";

export const SONIC = {
  /** how far an emitter reaches */
  range: 150,
  /** how far back the crew stands from the flames */
  stand: 105,
  /** blast radius where the waves land */
  radius: TILE * 2.4,
  /** seconds between pulses */
  every: 0.45,
  /** how far from a station (or camp) the crew will go */
  reach: 1600,
  /** most people on one fire */
  crew: 3,
};

export const sonicReady = (w: World) => w.camp.learned.has("sonicFire") && w.colony.finished("fireStation");

/** Emitters on the rack at the station. */
export const storedEmitters = (w: World) => w.colony.armory[EMITTER] ?? 0;
/** Emitters out with the crew. */
export const carriedEmitters = (w: World) => w.humans.filter((h) => h.sonic).length;

function station(w: World, x: number, y: number) {
  const all = w.colony.buildings.filter((b) => b.kind === "fireStation" && b.built >= 1);
  all.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  return all[0] ? w.colony.door(all[0]) : null;
}

/**
 * The sonic way to put out a fire (called first by douseThink).
 * Returns false when there's no station / emitter, so the bucket brigade takes over.
 */
export function sonicDouse(w: World, h: Human, done: () => void): boolean {
  if (h.child || !sonicReady(w)) return false;
  const fire = fireNear(w, h.x, h.y, SONIC.reach) ?? fireNear(w, w.camp.x, w.camp.y, SONIC.reach);
  if (!h.sonic) {
    if (!fire || storedEmitters(w) <= 0) return false;
    const st = station(w, h.x, h.y);
    if (!st) return false;
    if (Math.hypot(h.x - st.x, h.y - st.y) > 22) {
      go(h, "walk", st.x, st.y);
      h.task = null;
      return true;
    }
    w.colony.armory[EMITTER] = storedEmitters(w) - 1;
    h.sonic = true;
    h.carry = null;
    h.carryN = 0;
    say(h, pick(w.rng, ["Grab an emitter!", "Sound on!", "To the fire!"]));
    w.sfx("hum", h.x, h.y, 0.6, 1.4);
    return true;
  }
  if (!fire) {
    done();
    return returnEmitter(w, h);
  }
  const d = Math.hypot(fire.x - h.x, fire.y - h.y);
  if (d > SONIC.range + (h.state === "sonic" ? 40 : 0)) {
    // walk up to a safe blasting distance (on the near side of the flames)
    const k = SONIC.stand / (d || 1);
    go(h, "walk", fire.x + (h.x - fire.x) * k, fire.y + (h.y - fire.y) * k);
    h.task = null;
    return true;
  }
  h.aim = { x: fire.x, y: fire.y };
  h.dir = fire.x >= h.x ? 1 : -1;
  if (h.state !== "sonic") go(h, "sonic", h.x, h.y);
  return true;
}

/** Fire's out: take the emitter back to the station rack. Returns true while walking back. */
export function returnEmitter(w: World, h: Human): boolean {
  if (!h.sonic) return false;
  const st = station(w, h.x, h.y);
  if (!st) {
    // the station is gone: the emitter just goes in the stores
    h.sonic = false;
    w.colony.armory[EMITTER] = storedEmitters(w) + 1;
    return false;
  }
  if (Math.hypot(h.x - st.x, h.y - st.y) > 22) {
    go(h, "walk", st.x, st.y);
    return true;
  }
  h.sonic = false;
  h.aim = undefined;
  w.colony.armory[EMITTER] = storedEmitters(w) + 1;
  say(h, "Emitter back on the rack.");
  go(h, "idle", h.x, h.y);
  return false;
}

/** Per frame while blasting: pulses of ultrasound shake the flames out where they land. */
export function sonicTick(w: World, h: Human, dt: number) {
  const aim = h.aim;
  if (!h.sonic || !aim) {
    go(h, "idle", h.x, h.y);
    h.think = 0;
    return;
  }
  h.vx = h.vy = 0;
  h.dir = aim.x >= h.x ? 1 : -1;
  h.anim += dt * 6;
  // every emitter pulses on its own beat
  if (h.stateT % SONIC.every < dt) {
    const n = w.fire.extinguish(w, aim.x, aim.y, SONIC.radius);
    // the waves passing through on the way cool the edge of the fire too
    w.fire.extinguish(w, (aim.x + h.x) / 2, (aim.y + h.y) / 2, TILE * 0.9);
    w.particles.spawn(P.Ring, aim.x, aim.y, { size: 10, max: 0.5, color: "rgba(140,230,255,0.85)" });
    if (n) w.particles.burst(P.Steam, aim.x, aim.y - 8, 3, 24, { vz: 30, size: 12, max: 1, color: "rgba(220,235,245,0.55)" });
    w.sfx("hum", h.x, h.y, 0.35, 2.4);
  }
  if (w.rng() < dt * 0.15) say(h, pick(w.rng, ["Shake it out!", "Hold steady!", "It's going out!", "More power!"]));
  // flames gone here (after a good blast): sweep to the next patch in reach, or back to thinking
  if (h.stateT > 1.2 && w.fire.at(Math.floor(aim.x / TILE), Math.floor(aim.y / TILE)) <= 0.02 && h.stateT % 0.5 < dt) {
    const next = fireNear(w, h.x, h.y, SONIC.range + 40);
    if (next) h.aim = next;
    else {
      go(h, "idle", h.x, h.y);
      h.think = 0;
    }
  }
  if (h.stateT > 30) {
    go(h, "idle", h.x, h.y);
    h.think = 0;
  }
}

/**
 * The station's alarm: a fire near camp or a station gets a sonic crew (one per emitter, up to 3),
 * picked from whoever is free and closest to the station.
 */
export function sonicDispatch(w: World) {
  if (!sonicReady(w)) return;
  const stations = w.colony.buildings.filter((b) => b.kind === "fireStation" && b.built >= 1);
  let fire: { x: number; y: number } | null = null;
  for (const b of stations) fire = fire ?? fireNear(w, b.x, b.y, SONIC.reach);
  fire = fire ?? fireNear(w, w.camp.x, w.camp.y, SONIC.reach);
  if (!fire) return;
  const f = fire;
  const onIt = w.humans.filter((h) => h.sonic || (w.tasks.get(h.taskId)?.kind === "douse")).length;
  const want = Math.min(SONIC.crew, storedEmitters(w) + carriedEmitters(w)) - onIt;
  if (want <= 0) return;
  const st = stations[0];
  const free = w.humans
    .filter((h) => !h.child && !h.under && !h.stranger && !h.captive && !h.aloft && !h.riding && h.state !== "down" && !h.taskId && !h.order && h.hp > 0.5)
    .filter((h) => {
      const r = w.tribe.roleOf(h);
      return r !== "guard" || !w.tribe.raid;
    })
    .sort((a, b) => Math.hypot(a.x - st.x, a.y - st.y) - Math.hypot(b.x - st.x, b.y - st.y))
    .slice(0, want);
  if (!free.length) return;
  const t = issue(w, free, { kind: "douse", icon: "🔊", label: "Sonic fire crew: put it out!", x: f.x, y: f.y, target: 0 });
  if (t && !w.flags.has(`sonicCall${Math.floor(w.elapsed / 120)}`)) {
    w.flags.add(`sonicCall${Math.floor(w.elapsed / 120)}`);
    w.toast("🚒", `Fire! The sonic fire crew (${free.map((h) => h.name).join(", ")}) is grabbing emitters at the station.`, f.x, f.y);
  }
  if (!w.flags.has("sonicFirst")) {
    w.flags.add("sonicFirst");
    w.discover("sonicFire", f.x, f.y);
  }
}
