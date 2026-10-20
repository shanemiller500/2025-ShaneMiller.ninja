/* ------------------------------------------------------------------ */
/*  The dragon rite: a clan with an altar makes friends with a dragon  */
/*  by feeding it one of our people.                                   */
/*                                                                     */
/*  A captive is tied to the altar and the whole clan dances round it  */
/*  in a ring, beating drums and chanting. A dragon is called down: it */
/*  lands, eats the offering (blood everywhere), then flings its wings */
/*  wide and breathes fire straight up into the sky. The clan jumps    */
/*  for joy: the dragon is happy. While it stays happy it won't strafe */
/*  their town or carry any of them off to the volcano.                */
/*                                                                     */
/*  Until the dragon has eaten, our people can still save the captive: */
/*  get to the altar while the dancers are down (or busy).             */
/* ------------------------------------------------------------------ */
import { P } from "./particles";
import { pick } from "./rng";
import { altarOf, lvOf } from "./clanLife";
import { killHuman, say, setB, type Rivals } from "./rivals";
import type { Brute, Clan, Dragon, Human } from "./types";
import type { World } from "./world";

export type RitePhase = "gather" | "call" | "feast" | "roar";

export interface Rite {
  clan: number;
  victim: number;
  dragon: number;
  phase: RitePhase;
  t: number;
  /** seconds into the whole rite */
  all: number;
  drumT: number;
}

/** How long a fed dragon stays friendly (seconds). */
export const FAVOR_TIME = 900;
const DANCE_R = 74;

/** Is this dragon friends with that clan right now? */
export function favored(w: World, clanId: number, dr: Dragon) {
  const c = w.rivals.clan(clanId);
  return !!c && c.favor === dr.id && (c.favorT ?? 0) > 0;
}

/** Captives held at the camp itself (not still in a pit, not being carried). */
function heldAt(w: World, r: Rivals, clan: Clan): Human | null {
  for (const h of r.captives(w, clan.id)) {
    if (r.traps.some((t) => t.caught === h.id) || r.brutes.some((b) => b.captive === h.id)) continue;
    if (Math.hypot(h.x - clan.x, h.y - clan.y) < 320) return h;
  }
  return null;
}

/** A wild dragon that can answer the call. */
function answerer(w: World, x: number, y: number): Dragon | null {
  let best: Dragon | null = null;
  let bd = Infinity;
  for (const dr of w.dragons.list) {
    if (dr.owner || dr.fury || dr.waveOn || dr.prey || dr.riteClan || dr.hp < dr.maxHp * 0.5) continue;
    if (["flee", "snatch", "carry", "chase", "defend", "offering"].includes(dr.state)) continue;
    const d = Math.hypot(dr.x - x, dr.y - y);
    if (d < bd) {
      bd = d;
      best = dr;
    }
  }
  return best;
}

/** Once a second per clan: favour wears off; a clan with an altar + a captive holds a rite. */
export function riteTick(w: World, r: Rivals, clan: Clan, dt: number) {
  if (clan.favorT) {
    clan.favorT = Math.max(0, clan.favorT - dt);
    if (!clan.favorT) clan.favor = undefined;
  }
  if (r.rite || !lvOf(clan, "dragonAltar")) return;
  clan.riteT = (clan.riteT ?? 60) - dt;
  if (clan.riteT > 0) return;
  const h = heldAt(w, r, clan);
  if (!h || (clan.favorT ?? 0) > FAVOR_TIME * 0.5) {
    clan.riteT = 30;
    return;
  }
  const a = altarOf(clan);
  let dr = answerer(w, a.x, a.y);
  // nobody about: the drums carry for miles, and one comes
  if (!dr && w.dragons.list.length < 2) dr = w.dragons.summon(w, a);
  if (!dr) {
    clan.riteT = 60;
    return;
  }
  startRite(w, r, clan, h, dr);
}

export function startRite(w: World, r: Rivals, clan: Clan, h: Human, dr: Dragon) {
  const a = altarOf(clan);
  clan.riteT = 320 + w.rng() * 200;
  r.rite = { clan: clan.id, victim: h.id, dragon: dr.id, phase: "gather", t: 0, all: 0, drumT: 0 };
  h.x = a.x;
  h.y = a.y + 8;
  h.z = 0;
  say(h, "No! NO!", 3);
  for (const b of r.members(clan.id)) {
    if (b.raid || b.war || b.captive || b.snatched || b.weapon === "catapult" || b.ambush) continue;
    if (Math.hypot(b.x - a.x, b.y - a.y) > 700) continue;
    b.haul = undefined;
    setB(b, "dance", b.x, b.y);
  }
  w.sfx("drums", a.x, a.y, 1.2, 0.7);
  w.toast("🔥", `The ${clan.name} clan has tied ${h.name} to their dragon altar and is drumming to call ${dr.name} down! Rescue ${h.name} before the dragon lands!`, a.x, a.y);
  w.alarm(a.x, a.y, 400, 0.6, "😱", false);
}

function endRite(w: World, r: Rivals, rescued: boolean) {
  const rite = r.rite!;
  r.rite = null;
  const dr = w.dragons.byId(rite.dragon);
  if (dr) {
    dr.riteClan = undefined;
    dr.spread = 0;
    dr.skyFire = false;
    if (dr.state === "offering") {
      dr.state = dr.nest ? "home" : "leave";
      dr.t = 0;
      if (!dr.nest) {
        const a = w.rng() * Math.PI * 2;
        dr.tx = dr.x + Math.cos(a) * 7000;
        dr.ty = dr.y + Math.sin(a) * 7000;
      }
    }
  }
  for (const b of r.members(rite.clan)) if (b.state === "dance") {
    b.z = 0;
    setB(b, "idle", b.x, b.y);
    b.think = 0;
    if (rescued) say(b, pick(w.rng, ["NO!", "Grrr!", "Offering gone!"]), 1.6);
  }
}

/** Every frame while a rite is on. */
export function riteUpdate(w: World, r: Rivals, dt: number) {
  const rite = r.rite;
  if (!rite) return;
  const clan = r.clan(rite.clan);
  const h = w.humans.find((o) => o.id === rite.victim) ?? null;
  const dr = w.dragons.byId(rite.dragon);
  const eaten = rite.phase === "roar";
  if (!clan || (!eaten && (!h || h.captive !== clan.id)) || !dr || (rite.phase !== "gather" && dr.state !== "offering")) {
    endRite(w, r, !!h && !h.captive);
    return;
  }
  rite.t += dt;
  rite.all += dt;
  const a = altarOf(clan);
  if (h && !eaten) {
    h.x = a.x;
    h.y = a.y + 8;
    h.z = 0;
    if (w.rng() < dt * 0.3) say(h, pick(w.rng, ["Help!!", "Somebody!", "Not the dragon!"]), 2);
  }
  // the ring of dancers (each takes a slot that keeps going round)
  const dancers = r.members(clan.id).filter((b) => b.state === "dance");
  dancers.forEach((b, i) => danceStep(w, b, a.x, a.y, i, dancers.length, rite.all, dt));
  rite.drumT -= dt;
  if (rite.drumT <= 0) {
    rite.drumT = 1.6;
    w.sfx("drums", a.x, a.y, 0.8, 0.7 + w.rng() * 0.1);
  }
  switch (rite.phase) {
    case "gather":
      if (rite.t > 4) {
        rite.phase = "call";
        rite.t = 0;
        dr.riteClan = clan.id;
        dr.state = "offering";
        dr.t = 0;
        dr.prey = undefined;
        dr.tx = a.x + 80;
        dr.ty = a.y + 4;
        w.sfx("screech", a.x, a.y, 1.2, 0.5);
      }
      break;
    case "call":
      if (dr.z < 4 && Math.hypot(dr.x - dr.tx, dr.y - dr.ty) < 40) {
        rite.phase = "feast";
        rite.t = 0;
        dr.dir = a.x > dr.x ? 1 : -1;
      } else if (rite.t > 70) endRite(w, r, false);
      break;
    case "feast":
      dr.anim += dt * 2;
      if (rite.t > 1.6 && h) {
        // the offering is taken
        w.particles.burst(P.Splash, h.x, h.y, 26, 120, { z: 14, vz: 120, g: 320, size: 4, max: 1, color: "#b3121e" });
        w.particles.burst(P.Crumb, h.x, h.y, 18, 90, { z: 10, vz: 90, g: 260, size: 3, max: 1.2, color: "#7d0a12" });
        w.particles.burst(P.Splash, h.x + dr.dir * 12, h.y - 4, 12, 70, { z: 30, vz: 60, size: 5, max: 0.8, color: "#d4202c" });
        w.sfx("chomp", h.x, h.y, 1.3, 0.5);
        clan.altarBlood = 1;
        killHuman(w, h, `${dr.name} ate ${h.name} at the ${clan.name} clan's dragon altar. The clan is chanting.`);
        rite.phase = "roar";
        rite.t = 0;
        w.sfx("roar", dr.x, dr.y, 1.4, 0.6);
        for (const b of dancers) {
          setB(b, "cheer", b.x, b.y);
          say(b, pick(w.rng, ["YAAAA!", "DRAGON HAPPY!", "OOGA! OOGA!", "HOO HOO!"]), 2.4);
        }
      }
      break;
    case "roar": {
      // wings flung wide, fire up into the sky
      dr.spread = Math.min(1, (dr.spread ?? 0) + dt * 2.5);
      dr.skyFire = true;
      dr.breath = 1;
      dr.anim += dt * 2;
      if (w.inView(dr.x, dr.y, 300)) {
        for (let k = 0; k < 4; k++) {
          w.particles.spawn(P.Ember, dr.x + dr.dir * 34 + (w.rng() - 0.5) * 16, dr.y, { z: 70 + w.rng() * 20, vz: 260 + w.rng() * 160, vx: (w.rng() - 0.5) * 60, g: 120, size: 5 + w.rng() * 5, max: 1.2, color: w.rng() < 0.5 ? "#ffd447" : "#ff6a1f" });
        }
        if (w.rng() < dt * 4) w.particles.spawn(P.Smoke, dr.x + dr.dir * 34, dr.y, { z: 260, vz: 50, size: 22, max: 2.2, color: "rgba(60,50,45,0.5)" });
      }
      if (rite.t > 4.5) {
        clan.favor = dr.id;
        clan.favorT = FAVOR_TIME;
        w.toast("🐉", `${dr.name} spread its wings and breathed fire at the sky: it's happy with the ${clan.name} clan. It won't attack them or drop them in the volcano for a good while.`, a.x, a.y);
        endRite(w, r, false);
        // keep the cheering going a moment
        for (const b of r.members(clan.id)) if (b.state === "cheer") b.stateT = 0;
      }
      break;
    }
  }
}

/** Round and round the altar, stamping and hopping. */
function danceStep(w: World, b: Brute, ax: number, ay: number, i: number, n: number, t: number, dt: number) {
  const ang = (i / Math.max(1, n)) * Math.PI * 2 + t * 0.7;
  const tx = ax + Math.cos(ang) * DANCE_R;
  const ty = ay + 6 + Math.sin(ang) * DANCE_R * 0.5;
  const d = Math.hypot(tx - b.x, ty - b.y);
  const sp = d > 60 ? 70 : 52;
  if (d > 1) {
    const k = Math.min(1, (sp * dt) / d);
    b.vx = ((tx - b.x) * k) / Math.max(dt, 1e-4);
    b.vy = ((ty - b.y) * k) / Math.max(dt, 1e-4);
    b.x += (tx - b.x) * k;
    b.y += (ty - b.y) * k;
    if (Math.abs(b.vx) > 4) b.dir = b.vx > 0 ? 1 : -1;
  }
  b.anim += dt * 3;
  b.z = d < 30 ? Math.abs(Math.sin(t * 6 + i * 1.3)) * 6 : 0;
  if (w.rng() < dt * 0.12) say(b, pick(w.rng, ["OOGA!", "DRA-GON!", "HOO! HOO!", "Ugga ugga!", "Come! Eat!", "BOOM BOOM!"]), 1.4);
}

/** Bodies for the rite states (true = handled). */
export function riteAct(w: World, r: Rivals, b: Brute, dt: number): boolean {
  if (b.state === "dance") {
    if (!r.rite || r.rite.clan !== b.clan) {
      b.z = 0;
      setB(b, "idle", b.x, b.y);
    }
    return true;
  }
  if (b.state === "cheer") {
    b.vx = b.vy = 0;
    b.anim += dt * 4;
    b.z = Math.abs(Math.sin(b.stateT * 7 + b.id)) * 16;
    if (w.rng() < dt * 0.3) say(b, pick(w.rng, ["YAAA!", "HAPPY DRAGON!", "Hoo hoo!", "WE STRONG!"]), 1.4);
    if (b.stateT > 5) {
      b.z = 0;
      setB(b, "idle", b.x, b.y);
    }
    return true;
  }
  return false;
}
