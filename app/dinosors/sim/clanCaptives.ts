/* ------------------------------------------------------------------ */
/*  Captives put to work.                                              */
/*                                                                     */
/*  Anyone the clan carries off is made to wear the clan's rags, roped */
/*  to the other captives, and sent out on chores: fetching food,      */
/*  wood, or bones for whatever the clan is building. A brute keeps    */
/*  an eye on them (but out on a chore they're easier to rescue).      */
/*                                                                     */
/*  Hard labour wears them down (worse when the clan is short of       */
/*  food), and some don't survive it. Left there long enough, some     */
/*  give up waiting to be rescued and join the clan for good: they     */
/*  take up the clan's ways, keep their own looks, and in time they    */
/*  start families there (rivals.ts: births).                          */
/* ------------------------------------------------------------------ */
import { removeHuman } from "./death";
import { GROWN_AGE, killHuman, say as sayB, type Rivals } from "./rivals";
import { say } from "./humans";
import { pick } from "./rng";
import { canAfford, costOf, nextProject } from "./clanLife";
import type { Clan, Human } from "./types";
import type { World } from "./world";

/** Seconds a captive holds out before they might join the clan. */
export const HOLD_OUT = 480;
const SPEED = 26;

/** Held at the camp itself and free to be worked (not in a pit, carried, or tied to the altar). */
export function workable(w: World, r: Rivals, h: Human) {
  if (!h.captive || h.snatched || h.falling) return false;
  if (r.traps.some((t) => t.caught === h.id) || r.brutes.some((b) => b.captive === h.id) || r.rite?.victim === h.id) return false;
  return true;
}

/** What the clan needs fetching most. */
function needOf(clan: Clan): "food" | "wood" | "bones" {
  if (clan.food < 15) return "food";
  const k = nextProject(clan);
  if (k && !canAfford(clan, k)) {
    const n = costOf(clan, k);
    if ((clan.bones ?? 0) < n.bones) return "bones";
    if ((clan.wood ?? 0) < n.wood) return "wood";
  }
  return "food";
}

/** Every frame: captives doing their chores (their own brains are switched off while held). */
export function captivesUpdate(w: World, r: Rivals, dt: number) {
  for (const h of [...w.humans]) {
    if (!h.captive) continue;
    const clan = r.clan(h.captive);
    if (!clan || !workable(w, r, h)) {
      h.chore = null;
      continue;
    }
    h.clanGarb = clan.id;
    h.captiveT = (h.captiveT ?? 0) + dt;
    // children and the night: sit tied up at the camp
    if (h.child || w.daylight < 0.3) {
      h.chore = null;
      h.state = "captive";
      h.hp = Math.min(1, h.hp + dt * 0.002);
      continue;
    }
    if (!h.chore) {
      const a = w.rng() * Math.PI * 2;
      const d = 150 + w.rng() * 160;
      const x = clan.x + Math.cos(a) * d;
      const y = clan.y + Math.sin(a) * d * 0.7;
      if (!w.nav.passable("human", x, y)) continue;
      h.chore = { x, y, r: needOf(clan), t: 0, back: false };
    }
    const c = h.chore;
    const tx = c.back ? clan.x + ((h.id % 5) - 2) * 14 : c.x;
    const ty = c.back ? clan.y + 24 : c.y;
    const dist = Math.hypot(tx - h.x, ty - h.y);
    // hard work wears them down (harder when the clan is going hungry)
    h.hp -= dt * (0.0005 + (clan.food < 2 ? 0.0006 : 0));
    if (h.hp < 0.06) {
      killHuman(w, h, `${h.name} collapsed from hard labour at the ${clan.name} camp. We were too late…`);
      continue;
    }
    if (dist > 4) {
      const k = Math.min(1, (SPEED * dt) / dist);
      h.x += (tx - h.x) * k;
      h.y += (ty - h.y) * k;
      h.dir = tx > h.x ? 1 : -1;
      h.anim += dt * 2;
      h.state = c.back ? "carry" : "walk";
      continue;
    }
    if (!c.back) {
      h.state = "gather";
      h.anim += dt * 2;
      c.t += dt;
      if (c.t > 5) {
        c.back = true;
        c.t = 0;
      }
      continue;
    }
    // delivered
    if (c.r === "food") clan.food += 1.2;
    else clan[c.r] = (clan[c.r] ?? 0) + 1;
    h.chore = null;
    h.state = "captive";
    // the overseer grunts at them
    const boss = r.brutes.find((b) => b.clan === clan.id && Math.hypot(b.x - h.x, b.y - h.y) < 200);
    if (boss && w.rng() < 0.3) sayB(boss, pick(w.rng, ["WORK!", "More!", "Faster!", "Ugh. Good."]), 1.5);
    else if (w.rng() < 0.2) say(h, pick(w.rng, ["My back…", "Someone, help us…", "When will they come?"]));
  }
}

/** Once a second: held long enough, some give up and join the clan. */
export function captivesSlow(w: World, r: Rivals, dt: number) {
  for (const h of [...w.humans]) {
    if (!h.captive || h.child || !workable(w, r, h) || (h.captiveT ?? 0) < HOLD_OUT) continue;
    if (w.rng() >= dt * 0.006) continue;
    const clan = r.clan(h.captive);
    if (clan) join(w, r, h, clan);
  }
}

/** One of ours becomes one of theirs. */
function join(w: World, r: Rivals, h: Human, clan: Clan) {
  // let go of anything that tied them to us
  const dr = h.dragon ? w.dragons.owned.find((d) => d.id === h.dragon) : null;
  if (dr && dr.partner === h.id) dr.partner = undefined;
  removeHuman(w, h);
  const b = r.addBrute(w, clan, h.x, h.y, { name: h.name, age: GROWN_AGE, turned: true, weapon: "club", look: { skin: h.skin, hair: h.hair, fur: h.fur } });
  sayB(b, "I'm one of you now.", 3);
  w.toast("💔", `${h.name} gave up waiting to be rescued and joined the ${clan.name} clan. They live their way now, and in time they may start a family there.`, h.x, h.y);
}
