/* ------------------------------------------------------------------ */
/*  Yetis and dragons hate each other.                                 */
/*                                                                     */
/*  A dragon that comes in over a Yeti's snow (or a Yeti that sees one */
/*  low enough to reach) starts a fight to the death: neither breaks   */
/*  off, and one of them wins.                                         */
/*   • The dragon makes strafing runs: a dive in low, breathing fire   */
/*     (frost, hot sand: whatever its breath is) on the Yeti, then a   */
/*     climb out and round again.                                      */
/*   • The Yeti stands its ground on the snow, roaring, hurling blocks */
/*     of ice up at it, and clubbing it when it comes in low. On its   */
/*     own snow in a blizzard or at night it fights harder.            */
/*  Wild dragons + the Sand People's go looking for a fight; our own   */
/*  dragons never pick one, but fight back when a Yeti attacks them    */
/*  (without dropping whatever they were told to do).                  */
/*                                                                     */
/*  Fights are moment-to-moment (not saved): a reload ends them.       */
/* ------------------------------------------------------------------ */
import { breathOf } from "../data/dragons";
import { dinoMaxHp, emote, setState } from "./dinos";
import { flyToward } from "./dragonKeep";
import { harmDragon } from "./dragonPeril";
import { P } from "./particles";
import { downDino } from "./tribe";
import type { Dino, Dragon } from "./types";
import type { World } from "./world";

/** A Yeti picks a fight with a dragon this close (px)… */
const FEUD_R = 420;
/** …flying no higher than this (it can't reach one up in the clouds). */
const FEUD_Z = 260;
/** a Yeti's ice block: range (px), seconds between throws, share of a dragon's strength */
const ICE = { r: 340, cd: 2.1, dmg: 0.09 };
/** clubbing a dragon that comes in low */
const CLUB = { r: 80, z: 70, cd: 1.2, dmg: 0.09 };
/** a dragon's breath on a Yeti: per puff (every BREATH_CD s), in Yeti hit points */
const BREATH = { r: 210, cd: 0.45, dmg: 15 };

interface Duel {
  yeti: number;
  dragon: number;
  iceCd: number;
  clubCd: number;
  breathCd: number;
  t: number;
  /** this fight's luck for each side (a real contest: either can win) */
  yLuck: number;
  dLuck: number;
}

const duelsOf = new WeakMap<World, Duel[]>();
const duels = (w: World) => {
  let l = duelsOf.get(w);
  if (!l) duelsOf.set(w, (l = []));
  return l;
};

const dragonById = (w: World, id: number) => w.dragons.list.find((d) => d.id === id) ?? w.dragons.owned.find((d) => d.id === id) ?? null;

/** Is this Yeti / dragon in a fight right now? */
export const yetiDueling = (w: World, d: Dino) => duels(w).some((x) => x.yeti === d.id);
const dragonDuel = (w: World, dr: Dragon) => duels(w).find((x) => x.dragon === dr.id) ?? null;

/** A Yeti's fury: on its snow in a blizzard or at night it hits harder. */
const yetiMight = (w: World) => 1 + (w.weather.snow > 0.5 || w.weather.storm > 0.5 ? 0.3 : 0) + (w.daylight < 0.3 ? 0.2 : 0);
/** A dragon's breath strength (big, battle-hardened or raging ones burn hotter). */
const dragonMight = (dr: Dragon) => (1 + (dr.vet ?? 0) * 0.4 + (dr.rage ?? 0) * 0.25 + (dr.fury ? 0.8 : 0)) * (dr.young ? 0.5 : 1);

/** Hurt a Yeti directly (a fight between beasts: no turning on whoever's nearest). */
function hurtYeti(w: World, y: Dino, dmg: number) {
  y.health -= dmg / dinoMaxHp(y);
  emote(y, "💢", 0.8);
  if (y.health <= 0) downDino(w, y);
}

/** Every frame (from Dragons.update): start fights, trade blows, call the winner. Cheap: a few Yetis × a few dragons. */
export function feudTick(w: World, dt: number) {
  const list = duels(w);
  const yetis = w.dinos.filter((d) => d.species === "yeti" && !d.owner && d.health > 0);
  // new fights
  for (const y of yetis) {
    if (y.holding || list.some((x) => x.yeti === y.id)) continue;
    for (const dr of [...w.dragons.list, ...w.dragons.owned]) {
      if (dr.hp <= 0 || dr.monkRite || dr.z > FEUD_Z || dragonDuel(w, dr)) continue;
      if (Math.abs(dr.x - y.x) > FEUD_R || Math.hypot(dr.x - y.x, dr.y - y.y) > FEUD_R) continue;
      // ours never go looking for one: only a Yeti that's right by them starts it
      if (dr.owner && Math.hypot(dr.x - y.x, dr.y - y.y) > 230) continue;
      list.push({ yeti: y.id, dragon: dr.id, iceCd: 0.6, clubCd: 0, breathCd: 1, t: 0, yLuck: 0.75 + w.rng() * 0.55, dLuck: 0.75 + w.rng() * 0.55 });
      w.sfx("roar", y.x, y.y, 1.2, 0.35);
      w.alarm(y.x, y.y, 700, 0.6, "😱", false);
      y.fear = 0;
      setState(y, "defend", y.x, y.y);
      if (!w.flags.has("yetiDragonFeud") && w.humans.some((h) => Math.hypot(h.x - y.x, h.y - y.y) < 2400)) {
        w.flags.add("yetiDragonFeud");
        w.toast("❄️", `A Yeti and ${dr.name} are fighting! Yetis and dragons hate each other: it's a fight to the death, and only one will walk (or fly) away.`, y.x, y.y);
      }
      break;
    }
  }
  // the fights
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i];
    const y = w.dinos.find((d) => d.id === f.yeti);
    const dr = dragonById(w, f.dragon);
    const yAlive = !!y && y.health > 0 && w.dinos.includes(y);
    const dAlive = !!dr && dr.hp > 0;
    if (!yAlive || !dAlive) {
      list.splice(i, 1);
      announce(w, y, dr, yAlive, dAlive);
      if (yAlive && y) setState(y, "wander", y.homeX, y.homeY);
      if (dAlive && dr && !dr.owner && !dr.sandTribe) {
        dr.fireAt = undefined;
        dr.state = dr.nest ? "home" : "circle";
        dr.t = 0;
      }
      continue;
    }
    f.t += dt;
    f.iceCd = Math.max(0, f.iceCd - dt);
    f.clubCd = Math.max(0, f.clubCd - dt);
    f.breathCd = Math.max(0, f.breathCd - dt);
    const d = Math.hypot(dr.x - y.x, dr.y - y.y);
    // the Yeti: faces it, roars, keeps on its snow; ice from range, a club when it's low
    if (y.state !== "defend") setState(y, "defend", y.x, y.y);
    y.dir = dr.x > y.x ? 1 : -1;
    y.vx *= 0.7;
    y.vy *= 0.7;
    const might = yetiMight(w) * f.yLuck;
    if (!f.clubCd && d < CLUB.r && dr.z < CLUB.z) {
      f.clubCd = CLUB.cd;
      y.strike = 1;
      w.sfx("thud", dr.x, dr.y, 1, 0.5);
      w.particles.burst(P.Star, dr.x, dr.y, 4, 40, { z: dr.z + 20, size: 6, max: 0.6 });
      harmDragon(w, dr, dr.maxHp * CLUB.dmg * might, "yeti");
    } else if (!f.iceCd && d < ICE.r && dr.z < FEUD_Z) {
      f.iceCd = ICE.cd;
      y.strike = 1;
      w.sfx("whoosh", y.x, y.y, 0.8, 0.55);
      if (w.inView(dr.x, dr.y, 200)) w.particles.burst(P.Spark, dr.x, dr.y, 10, 80, { z: dr.z + 20, vz: 40, g: 200, size: 4, max: 0.7, color: "#d9f4ff" });
      // the higher and further it is, the likelier the block misses
      if (w.rng() < 0.85 - (dr.z / FEUD_Z) * 0.35 - (d / ICE.r) * 0.2) harmDragon(w, dr, dr.maxHp * ICE.dmg * might, "yeti");
    }
    if (dr.hp <= 0) continue;
    // the dragon's breath (ours too: it fights back from wherever it is)
    if (!f.breathCd && d < BREATH.r && dr.z < 200) {
      f.breathCd = BREATH.cd;
      dr.breath = 1;
      dr.fireAt = { x: y.x, y: y.y };
      const kind = dr.sandTribe ? "sand" : breathOf(dr.breed);
      if (w.inView(y.x, y.y, 200)) w.particles.burst(kind === "frost" ? P.Spark : P.Ember, y.x, y.y, 8, 60, { z: 30, vz: 40, size: 4, max: 0.6, color: kind === "frost" ? "#e9fbff" : kind === "sand" ? "#e2b46a" : "#ff8a2a" });
      // (frost does less to a beast of the snows)
      hurtYeti(w, y, BREATH.dmg * dragonMight(dr) * f.dLuck * (kind === "frost" ? 0.55 : 1));
    }
  }
}

/**
 * A wild (or Sand People's) dragon's turn while it's fighting a Yeti (from the dragon brains, before
 * anything else). True = the fight has it: strafing runs over the Yeti, low to breathe, high to escape.
 */
export function duelStep(w: World, dr: Dragon, dt: number): boolean {
  if (dr.owner) return false;
  const f = dragonDuel(w, dr);
  if (!f) return false;
  const y = w.dinos.find((d) => d.id === f.yeti);
  if (!y || y.health <= 0) return false;
  dr.state = "strafe";
  const pass = f.t % 6;
  const out = pass > 3.8;
  const a = Math.atan2(dr.y - y.y, dr.x - y.x);
  const gx = out ? y.x + Math.cos(a) * 300 : y.x - Math.cos(a) * 50;
  const gy = out ? y.y + Math.sin(a) * 200 : y.y - Math.sin(a) * 30;
  flyToward(w, dr, gx, gy, out ? 190 : 60, dt, 1.05);
  return true;
}

/** Who won (told when anyone of ours is about, or it was one of our dragons). */
function announce(w: World, y: Dino | undefined, dr: Dragon | null, yAlive: boolean, dAlive: boolean) {
  const at = y ?? dr;
  if (!at) return;
  const near = w.humans.some((h) => !h.under && Math.hypot(h.x - at.x, h.y - at.y) < 2400) || !!dr?.owner;
  if (!near) return;
  const name = dr?.name ?? "the dragon";
  if (yAlive && !dAlive) w.toast("❄️", `The Yeti won: ${name} came down in the snow, beaten by blocks of ice and the Yeti's fists.`, at.x, at.y);
  else if (dAlive && !yAlive) w.toast("🐉", `${name} won: the Yeti lies still in the snow.`, at.x, at.y);
}
