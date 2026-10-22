/* ------------------------------------------------------------------ */
/*  Dragon roasts + the feast table.                                   */
/*                                                                     */
/*  A dead dinosaur lying in (or just outside) the town never rots:    */
/*  either people cut it up, or one of our dragons walks over and      */
/*  roasts it with a long, gentle breath of fire (cooking fire: it     */
/*  doesn't light the town). The dragon eats its share; the rest is    */
/*  roast meat. One person comes with a platter and carries it all to  */
/*  the feast table by the campfire, and whenever people get peckish   */
/*  they line up at the table for a plate (a long queue at dinner      */
/*  time, nobody at all in between) until it's all eaten.              */
/* ------------------------------------------------------------------ */
import { canFly, landAt, walkToward, warTrained } from "./dragonKeep";
import { go, say } from "./humans";
import { P } from "./particles";
import { pick } from "./rng";
import type { Dragon, Human, Item } from "./types";
import type { World } from "./world";

/** How much roast the table holds. */
export const TABLE_MAX = 40;
/** Seconds of fire to roast a body. */
export const ROAST_FOR = 4;
/** How far past the camp's edge a body still counts as "close to town". */
const NEAR = 300;

/** The feast table: beside the campfire. */
export function feastTable(w: World) {
  const f = w.campfires.find((x) => x.lit) ?? w.campfires[0];
  const x = f ? f.x : w.camp.x;
  const y = f ? f.y : w.camp.y;
  return { x: x + 70, y: y + 34 };
}

/** Is this spot in the town (inside the walls, round the camp, or among its homes + buildings)? */
export function inTown(w: World, x: number, y: number, pad = 0) {
  if (Math.hypot(x - w.camp.x, y - w.camp.y) < 650 + pad) return true;
  if (w.tribe.walls.length && w.tribe.walledIn(w, x, y)) return true;
  for (const s of w.shelters) if (Math.hypot(s.x - x, s.y - y) < 140 + pad) return true;
  for (const b of w.colony.buildings) if (Math.hypot(b.x - x, b.y - y) < 180 + pad) return true;
  return false;
}

const bodies = (w: World) => w.items.filter((it) => it.kind === "carcass" && !!it.carcass);
const roastable = (it: Item) => !!it.carcass && it.carcass.meat > 0.5 && !it.carcass.burnt && !it.carcass.cooked && !it.claimed;

/** Can this dragon go and cook? */
function canCook(w: World, dr: Dragon) {
  if (dr.auto === false || (dr.growth ?? 0) < 0.4 || (dr.skills?.fire ?? 0) < 0.3 || dr.hp < dr.maxHp * 0.4 || dr.state === "sleep") return false;
  if (w.humans.some((h) => h.aloft === dr.id)) return false;
  // a dragon on patrol / guard duty sticks to its job
  if (dr.post || dr.cmd || warTrained(dr)) return false;
  if (w.colony.hunt?.crew.some((m) => m.ride === "dragon" && m.mount === dr.id)) return false;
  return !dr.foe;
}

/** Once a second: bodies in town are kept fresh, dragons are sent to roast them, the server + queue are tidied. */
export function feastTick(w: World) {
  const f = w.colony.feast;
  const all = bodies(w);
  for (const it of all) it.carcass!.town = inTown(w, it.x, it.y, NEAR);
  // a dragon for every body in town still waiting to be roasted
  const cooking = new Set(w.dragons.owned.map((d) => d.cook).filter(Boolean));
  for (const it of all) {
    if (!it.carcass!.town || !roastable(it) || cooking.has(it.id)) continue;
    if (f.food >= TABLE_MAX) break;
    const free = w.dragons.owned.filter((d) => !d.cook && canCook(w, d));
    const dr = free.sort((a, b) => Math.hypot(a.x - it.x, a.y - it.y) - Math.hypot(b.x - it.x, b.y - it.y))[0];
    if (!dr) break;
    dr.cook = it.id;
    dr.cookT = 0;
    cooking.add(it.id);
    if (!w.flags.has("dragonCook")) {
      w.flags.add("dragonCook");
      w.toast("🔥", `${dr.name} smells dinner: it's off to roast the dead dinosaur with its fire! Bodies in town never go rotten now: a dragon cooks them, and the roast goes on the feast table by the fire.`, it.x, it.y);
    }
  }
  // the queue: only people still alive, free and hungry stay in it
  f.queue = f.queue.filter((id) => {
    const h = w.humans.find((x) => x.id === id);
    return !!h && h.state !== "down" && !h.taskId && !h.order && !h.chariot && !h.aloft && !h.captive && f.food > 0;
  });
  // somebody to carry the roast over (a cook first)
  const roast = all.some((it) => (it.carcass!.roast ?? 0) > 0);
  const server = w.humans.find((h) => h.id === f.server);
  const busy = (h: Human) => h.child || h.stranger || h.captive || h.under || h.chariot || h.aloft || h.riding || h.state === "down" || h.taskId || h.order || h.state === "sleep";
  if (server && (busy(server) || (!roast && !server.carryN))) {
    f.server = 0;
  }
  if (!f.server && roast && f.food < TABLE_MAX) {
    const free = w.humans.filter((h) => !busy(h) && h.carry === null && !f.queue.includes(h.id));
    const cook = free.find((h) => w.tribe.roleOf(h) === "cook") ?? free.sort((a, b) => Math.hypot(a.x - w.camp.x, a.y - w.camp.y) - Math.hypot(b.x - w.camp.x, b.y - w.camp.y))[0];
    if (cook) {
      f.server = cook.id;
    }
  }
}

/* ------------------------------ the dragon ------------------------------ */

/** A dragon off to roast a body (true = busy with it). Called from its Auto mode. */
export function cookThink(w: World, dr: Dragon, dt: number): boolean {
  if (!dr.cook) return false;
  const it = w.items.find((x) => x.id === dr.cook);
  if (!it || !it.carcass || !roastable(it) || !canCook(w, dr)) {
    dr.fireAt = undefined;
    dr.cook = undefined;
    dr.cookT = 0;
    return false;
  }
  const c = it.carcass;
  // stand beside it, head toward it
  const side = dr.x < it.x ? -1 : 1;
  const off = 46 + c.size * 0.35;
  const spot = { x: it.x + side * off, y: it.y + 6 };
  const d = Math.hypot(spot.x - dr.x, spot.y - dr.y);
  if (d > 26 || dr.z > 2) {
    if (canFly(dr) && (dr.z > 6 || d > 280)) {
      landAt(w, dr, spot.x, spot.y, dt);
      dr.state = "fly";
    } else {
      walkToward(w, dr, spot.x, spot.y, dt);
      dr.state = "walk";
    }
    return true;
  }
  dr.vx = dr.vy = 0;
  dr.state = "idle";
  dr.dir = it.x > dr.x ? 1 : -1;
  // a slow, low cooking flame (no burst: it doesn't set the town alight)
  dr.cookT = (dr.cookT ?? 0) + dt;
  dr.breath = 1;
  dr.fireAt = { x: it.x, y: it.y };
  const mx = dr.x + dr.dir * 30;
  if (w.inView(it.x, it.y, 200)) {
    for (let i = 0; i < 3; i++) {
      const t = w.rng();
      w.particles.spawn(P.Ember, mx + (it.x - mx) * t, dr.y + (it.y - dr.y) * t + (w.rng() - 0.5) * 8, { z: 22 * (1 - t) + 6, vz: 20 + w.rng() * 30, vx: (it.x - mx) * 0.4, size: 3 + w.rng() * 3, max: 0.45, color: w.rng() < 0.5 ? "#ffb02e" : "#ff6a1f" });
    }
    if (w.rng() < dt * 5) w.particles.spawn(P.Smoke, it.x + (w.rng() - 0.5) * c.size * 0.4, it.y - 8, { vz: 34, vx: w.weather.windX * 8, size: 12 + w.rng() * 8, max: 1.6, color: "rgba(235,225,215,0.45)" });
  }
  if (w.rng() < dt * 2) w.sfx("whoosh", dr.x, dr.y, 0.35, 0.4);
  if ((dr.cookT ?? 0) < ROAST_FOR) return true;
  // done: the dragon has its share, the rest is roast for the table (the hide's scorched off; the bones stay to gather)
  const share = Math.max(1, Math.round(c.meat * 0.25));
  const roast = Math.max(1, Math.round(c.meat - share));
  c.roast = (c.roast ?? 0) + roast;
  c.meat = 0;
  c.hide = 0;
  c.cooked = true;
  it.amount = 0;
  dr.hunger = Math.max(0, (dr.hunger ?? 0) - 0.15 * share);
  dr.cook = undefined;
  dr.cookT = 0;
  dr.fireAt = undefined;
  w.sfx("munch", dr.x, dr.y, 0.8, 0.6);
  w.particles.burst(P.Smoke, it.x, it.y - 6, 6, 30, { size: 14, max: 1.6, color: "rgba(240,230,220,0.5)" });
  say2(w, dr, "🍖");
  w.toast("🍖", `${dr.name} roasted the ${it.species ?? "dinosaur"}: ${roast} portions of roast for the feast table (and a big bite for itself)!`, it.x, it.y);
  return true;
}

function say2(w: World, dr: Dragon, text: string) {
  w.particles.spawn(P.Note, dr.x, dr.y, { z: 60, vz: 22, size: 14, max: 1.4, color: text });
}

/* ------------------------------ people ------------------------------ */

/** The server carries roast to the table; hungry people line up and eat. True = handled. */
export function feastThink(w: World, h: Human, hasTask: boolean): boolean {
  const f = w.colony.feast;
  const table = feastTable(w);
  if (f.server === h.id) return serve(w, h, table);
  if (h.carry === "cooked" && h.carryN > 0 && !h.taskId) {
    // dropped from serving with roast in hand: put it on the table anyway
    return serve(w, h, table);
  }
  const at = f.queue.indexOf(h.id);
  if (at < 0) {
    if (!f.food || hasTask || h.order || h.riding || h.state === "sleep") return false;
    // peckish (sooner when the table's piled high): join the end of the line
    const want = f.food > 12 ? 0.2 : 0.38;
    if (h.hunger < want || f.queue.length >= f.food) return false;
    f.queue.push(h.id);
    if (f.queue.length >= 4 && !w.flags.has("feastQueue")) {
      w.flags.add("feastQueue");
      w.toast("🍽️", "Dinner time! A line forms at the feast table for dragon-roasted meat.", table.x, table.y);
    }
    return queueStep(w, h, f.queue.length - 1, table);
  }
  return queueStep(w, h, at, table);
}

/** Where the n-th person in line stands (the line runs back from the table). */
export function queueSpot(table: { x: number; y: number }, n: number) {
  const row = Math.floor(n / 8);
  const col = n % 8;
  return { x: table.x - 36 - col * 17, y: table.y + 6 + row * 20 + (col % 2) * 3 };
}

function queueStep(w: World, h: Human, n: number, table: { x: number; y: number }) {
  const f = w.colony.feast;
  const spot = n === 0 ? { x: table.x - 22, y: table.y + 4 } : queueSpot(table, n);
  if (Math.hypot(h.x - spot.x, h.y - spot.y) > 8) {
    go(h, "walk", spot.x, spot.y);
    return true;
  }
  if (n > 0) {
    if (h.state !== "idle") go(h, "idle", h.x, h.y);

    return true;
  }
  // at the front: a plate of roast
  if (f.frontId !== h.id) {
    f.frontId = h.id;
    f.frontAt = w.elapsed;
    go(h, "idle", h.x, h.y);
    h.dir = 1;
    return true;
  }
  if (w.elapsed - f.frontAt < 1.6) return true;
  f.food = Math.max(0, f.food - 1);
  f.queue.shift();
  f.frontId = 0;
  f.eaten++;
  h.hunger = -0.3;
  h.energy = Math.min(1, h.energy + 0.2);
  w.particles.burst(P.Crumb, h.x, h.y, 4, 30, { z: 14, vz: 40, g: 200, size: 2.2, max: 0.5, color: "#a0522d" });
  w.sfx("munch", h.x, h.y, 0.5);
  say(h, pick(w.rng, ["Yum! Dragon roast!", "Best roast ever!", "Thank you, dragon!", "Smoky and good!"]));
  // off to sit and eat it
  go(h, "walk", table.x + 30 + (w.rng() - 0.5) * 120, table.y + 40 + w.rng() * 40);
  return true;
}

function serve(w: World, h: Human, table: { x: number; y: number }) {
  const f = w.colony.feast;
  if (h.carry === "cooked" && h.carryN > 0) {
    if (Math.hypot(h.x - table.x, h.y - table.y) > 18) {
      go(h, "walk", table.x, table.y - 4);
      return true;
    }
    f.food = Math.min(TABLE_MAX, f.food + h.carryN);
    h.carry = null;
    h.carryN = 0;
    w.sfx("clack", table.x, table.y, 0.4);

    go(h, "idle", h.x, h.y);
    return true;
  }
  const body = bodies(w)
    .filter((it) => (it.carcass!.roast ?? 0) > 0)
    .sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
  if (!body || f.food >= TABLE_MAX) {
    if (f.server === h.id) f.server = 0;
    return false;
  }
  if (Math.hypot(h.x - body.x, h.y - body.y) > 24) {
    go(h, "walk", body.x, body.y + 10);
    return true;
  }
  const c = body.carcass!;
  const n = Math.min(c.roast ?? 0, 6, TABLE_MAX - f.food);
  c.roast = (c.roast ?? 0) - n;
  h.carry = "cooked";
  h.carryN = n;
  w.sfx("chop", body.x, body.y, 0.35);

  return true;
}
