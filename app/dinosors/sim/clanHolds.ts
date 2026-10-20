/* ------------------------------------------------------------------ */
/*  Holds: part of our town taken by a clan after a raid.              */
/*                                                                     */
/*  If a raid breaks through and they're still standing inside, they   */
/*  may dig in and hold that part of the town: their banner goes up    */
/*  and they wreck the place over time (buildings, huts, walls), and   */
/*  help themselves to our stores if they're inside it.                */
/*                                                                     */
/*  We get it back by fighting them out, or by a siege: with our       */
/*  people all round it nothing gets through from their camp, their    */
/*  food runs out, they weaken, and one by one they give up and go.    */
/* ------------------------------------------------------------------ */
import { P } from "./particles";
import { pick } from "./rng";
import { say, setB, type Rivals } from "./rivals";
import type { Brute, ClanHold } from "./types";
import type { World } from "./world";

/** How far a hold reaches. */
export const HOLD_R = 170;
/** Our people within this much past the edge count toward the siege. */
const SIEGE_R = 260;

/** They dig in where they stand: around the nearest building or hut. */
export function occupy(w: World, r: Rivals, party: Brute[]): ClanHold | null {
  if (!party.length) return null;
  const clan = r.clan(party[0].clan);
  if (!clan) return null;
  const cx = party.reduce((s, b) => s + b.x, 0) / party.length;
  const cy = party.reduce((s, b) => s + b.y, 0) / party.length;
  let x = cx;
  let y = cy;
  let bd = 320;
  for (const t of [...w.colony.buildings.filter((b) => b.built >= 1), ...w.shelters.filter((s) => s.stage > 0)]) {
    const d = Math.hypot(t.x - cx, t.y - cy);
    if (d < bd) {
      bd = d;
      x = t.x;
      y = t.y;
    }
  }
  const hold: ClanHold = { id: w.nextId(), clan: clan.id, x, y, r: HOLD_R, food: 20, t: 0, cut: false };
  r.holds.push(hold);
  for (const b of party) {
    if (b.clan !== clan.id || b.captive) continue;
    b.hold = hold.id;
    b.raid = false;
    b.war = 0;
    setB(b, "walk", x + (w.rng() - 0.5) * hold.r, y + (w.rng() - 0.5) * hold.r * 0.6);
    say(b, pick(w.rng, ["OURS NOW!", "Stay! Smash!", "Mine place!"]), 2);
  }
  w.sfx("drums", x, y, 1.1, 0.7);
  w.toast("🚩", `The ${clan.name} clan has taken part of our town! They'll wreck it bit by bit. Fight them out, or surround them with people and starve them out.`, x, y);
  w.alarm(x, y, 600, 0.9, "😱", false);
  return hold;
}

/** The occupiers' brains: fight anyone who comes, otherwise mill about smashing things. */
export function holdThink(w: World, r: Rivals, b: Brute, prey: (b: Brute, hold: ClanHold) => { id: number; x: number; y: number } | null): boolean {
  const hold = r.holds.find((x) => x.id === b.hold);
  if (!hold) {
    b.hold = undefined;
    return false;
  }
  const h = prey(b, hold);
  if (h) {
    b.targetId = h.id;
    setB(b, "fight", h.x, h.y);
    return true;
  }
  if (b.state !== "wander" || b.stateT > 6) {
    const a = w.rng() * Math.PI * 2;
    setB(b, "wander", hold.x + Math.cos(a) * hold.r * 0.6, hold.y + Math.sin(a) * hold.r * 0.4);
  }
  if (w.rng() < 0.04) say(b, pick(w.rng, ["Smash!", "Our place!", "Ha ha!", hold.food < 4 ? "Hungry…" : "Ugh."]), 1.4);
  return true;
}

/** Once a second: supplies, the siege, starving, wrecking, and whether we've won it back. */
export function holdsTick(w: World, r: Rivals, dt: number) {
  for (const hold of [...r.holds]) {
    const clan = r.clan(hold.clan);
    const members = r.brutes.filter((b) => b.hold === hold.id && b.hp > 0);
    if (!clan || !members.length) {
      r.holds.splice(r.holds.indexOf(hold), 1);
      for (const b of members) b.hold = undefined;
      w.toast("🏳️", `We took back that part of the town!${hold.food <= 0 ? " The siege starved them out." : ""}`, hold.x, hold.y);
      w.celebrate("Ours again!");
      continue;
    }
    hold.t += dt;
    // a siege: our people all round it, nothing gets through from their camp
    const ours = w.humans.filter((h) => !h.child && !h.captive && !h.stranger && h.state !== "down" && Math.hypot(h.x - hold.x, h.y - hold.y) < hold.r + SIEGE_R).length;
    const was = hold.cut;
    hold.cut = ours >= 2;
    if (hold.cut && !was && !w.flags.has(`siege${hold.id}`)) {
      w.flags.add(`siege${hold.id}`);
      w.toast("⛺", `We've surrounded them: no more food reaches the ${clan.name} clan's hold. Keep them penned in and they'll starve out.`, hold.x, hold.y);
    }
    if (!hold.cut && clan.food > 1) {
      const got = Math.min(clan.food - 1, 0.08 * dt);
      clan.food -= got;
      hold.food = Math.min(25, hold.food + got);
    }
    hold.food = Math.max(0, hold.food - 0.02 * members.length * dt);
    // our stores inside it get eaten
    const pile = w.camp;
    if (Math.hypot(pile.pileX - hold.x, pile.pileY - hold.y) < hold.r + 40 && w.rng() < dt * 0.25) {
      for (const k of ["cooked", "meat", "fish", "crop", "berries"] as const) {
        if (pile.stock[k] >= 1) {
          pile.stock[k] -= 1;
          hold.food += 1;
          break;
        }
      }
    }
    // starving: they weaken, and one by one they give up and go home
    if (hold.food <= 0) {
      if (!w.flags.has(`starve${hold.id}`)) {
        w.flags.add(`starve${hold.id}`);
        w.toast("🍖", `The ${clan.name} clan's hold is out of food! They're weakening… keep the siege on.`, hold.x, hold.y);
      }
      for (const b of members) {
        r.hit(w, b, 0.01 * dt, b.x, b.y, true);
        if (r.brutes.includes(b) && w.rng() < dt * 0.03) {
          b.hold = undefined;
          setB(b, "flee", clan.x, clan.y + 20);
          say(b, "Hungry! Go home!", 2);
        }
      }
    }
    // wrecking the place
    let smashed = false;
    for (const s of w.colony.buildings) {
      if (s.built < 1 || Math.hypot(s.x - hold.x, s.y - hold.y) > hold.r) continue;
      s.hp -= dt * 0.8 * members.length;
      smashed = true;
    }
    for (const s of w.shelters) {
      if (s.stage <= 0 || Math.hypot(s.x - hold.x, s.y - hold.y) > hold.r) continue;
      s.hp = Math.max(0, s.hp - dt * 0.0012 * members.length);
      smashed = true;
    }
    for (const wl of w.tribe.walls) {
      if (wl.built < 1 || wl.hp <= 0 || Math.hypot(wl.tx * 32 + 16 - hold.x, wl.ty * 32 + 16 - hold.y) > hold.r) continue;
      wl.hp -= dt * 0.5 * members.length;
      smashed = true;
    }
    if (smashed && w.rng() < dt * 0.6) {
      const m = pick(w.rng, members);
      w.particles.burst(P.Crumb, m.x + m.dir * 14, m.y, 5, 50, { z: 14, vz: 60, g: 200, size: 3, max: 0.7, color: "#8a6238" });
      w.sfx("thud", m.x, m.y, 0.5, 0.8);
    }
  }
}
