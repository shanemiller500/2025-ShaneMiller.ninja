/* ------------------------------------------------------------------ */
/*  Losing people.                                                     */
/*                                                                     */
/*  Knocked out is serious now: a friend has to get to them and patch  */
/*  them up in time. Left alone too long (or hurt again while they're  */
/*  down) and they don't make it: they're gone from the game for good, */
/*  and the tribe carries on without them. (Calm mode: nobody dies.)   */
/*                                                                     */
/*  Everyone who leaves the game goes through `removeHuman`, so no     */
/*  dragon, dino, chariot, job or feast queue is left waiting for      */
/*  somebody who isn't there any more.                                 */
/*                                                                     */
/*  And if the tribe's nearly gone, wandering families find the empty  */
/*  camp sooner (population.ts): build the community up again.         */
/* ------------------------------------------------------------------ */
import { P } from "./particles";
import type { Human, ItemKind, Resource } from "./types";
import type { World } from "./world";

/** Seconds a knocked-out person can wait for help. */
export const DOWN_FOR = 90;

/** Take someone out of the game, letting go of everything tied to them. */
export function removeHuman(w: World, h: Human) {
  if (!w.humans.includes(h)) return;
  // what they were carrying drops where they fell
  if (h.carry && h.carryN > 0) {
    const item = ({ stick: "stick", stone: "stone", meat: "meat", fish: "fish", berries: "berries" } as Partial<Record<Resource, ItemKind>>)[h.carry];
    if (item) w.addItem(item, h.x, h.y, { amount: Math.max(1, h.carryN) });
    else w.camp.stock[h.carry] += h.carryN;
    h.carry = null;
    h.carryN = 0;
  }
  // a dragon egg in their arms falls to the ground (it can be picked up again)
  for (const id of [h.egg, h.egg2]) {
    const egg = id ? w.dragons.eggs.find((e) => e.id === id) : null;
    if (egg && egg.at === "carried") {
      egg.at = "ground";
      egg.carrier = 0;
      egg.x = h.x;
      egg.y = h.y;
    }
  }
  // the dino they rode / were bonded to
  if (h.riding) {
    const d = w.dinoById(h.riding);
    if (d) {
      if (d.rider === h.id) d.rider = d.passengers?.shift() ?? 0;
      d.passengers = (d.passengers ?? []).filter((id) => id !== h.id);
      if (!d.rider && d.state === "ridden") d.state = "idle";
    }
  }
  for (const d of w.dinos) {
    if (d.work?.partner === h.id) d.work.partner = undefined;
    if (d.rider === h.id) d.rider = 0;
  }
  // their dragon: no rider, no keeper, no trainer (it'll get a new one in time)
  for (const dr of w.dragons.owned) {
    if (dr.partner === h.id) dr.partner = undefined;
    if (dr.keeper === h.id) dr.keeper = undefined;
    if (dr.trainer === h.id) dr.trainer = undefined;
    if (dr.rider === h.id) dr.rider = undefined;
  }
  // jobs, the raid unit, the feast table
  for (const t of w.tasks.list) t.people = t.people.filter((id) => id !== h.id);
  const hunt = w.colony.hunt;
  if (hunt) hunt.crew = hunt.crew.filter((m) => m.id !== h.id);
  const f = w.colony.feast;
  f.queue = f.queue.filter((id) => id !== h.id);
  if (f.server === h.id) f.server = 0;
  if (f.frontId === h.id) f.frontId = 0;
  const i = w.humans.indexOf(h);
  if (i >= 0) w.humans.splice(i, 1);
  w.events.push({ type: "removed", id: h.id });
  w.tribe.lost = (w.tribe.lost ?? 0) + (h.stranger ? 0 : 1);
}

/** Someone didn't make it: a quiet fade, a toast, and they're gone. */
export function dies(w: World, h: Human, msg: string) {
  if (!w.humans.includes(h)) return;
  w.particles.burst(P.Poof, h.x, h.y, 10, 50, { size: 12, max: 1.1, color: "rgba(235,228,210,0.9)" });
  w.particles.spawn(P.Heart, h.x, h.y, { z: 20, vz: 25, size: 7, max: 1.6, color: "#9aa4b2" });
  w.sfx("thud", h.x, h.y, 0.6, 0.5);
  removeHuman(w, h);
  w.toast("🕊️", msg, h.x, h.y);
  w.alarm(h.x, h.y, 400, 0.6, "😢", false);
  if (!w.humans.some((o) => !o.stranger)) {
    w.toast("🏚️", "The whole tribe is gone… The camp stands empty. Wanderers will find it before long: build the community up again.", w.camp.x, w.camp.y);
  }
}

/**
 * Knocked out: the clock is running. Returns true if they died this tick.
 * (Called every frame for someone who's down; being patched up resets the clock.)
 */
export function downTick(w: World, h: Human, dt: number) {
  if (w.tribe.danger === "calm") return false;
  h.downT = (h.downT ?? 0) + dt;
  if (h.helpedAt !== undefined && w.elapsed - h.helpedAt < 1) h.downT = Math.min(h.downT, 5);
  if (h.downT > DOWN_FOR * 0.5 && !h.fading) {
    h.fading = true;
    if (!h.stranger) w.toast("⚠️", `${h.name} is fading fast! Get someone to them to patch them up, or they won't make it.`, h.x, h.y);
  }
  if (h.downT < DOWN_FOR) return false;
  dies(w, h, `${h.name} didn't make it. Nobody reached them in time. The tribe will remember them.`);
  return true;
}

/** Back on their feet: the clock's off. */
export function upAgain(h: Human) {
  h.downT = 0;
  h.fading = false;
}
