/* ------------------------------------------------------------------ */
/*  Dragon Riders at work.                                             */
/*                                                                     */
/*  A bonded Dragon Rider and their grown, rideable dragon are a real  */
/*  skilled crew, not a pet + its sitter. When they're on shift, fit,  */
/*  rested and it's daylight, the rider takes a job, climbs on, and    */
/*  they do it together:                                               */
/*    alert   trouble near the town or one of our people: fly at it    */
/*            (dive + breath with combat training, else breath, else    */
/*            a warning cry and a watch overhead)                       */
/*    cargo   fly supplies from the stores to a building site that's    */
/*            waiting on them (the most urgent site first)              */
/*    ferry   pick up someone with a long walk ahead and fly them there */
/*    gather  fly out to a far deposit of what the camp is lowest on,   */
/*            load up, fly it home                                      */
/*    scout   fly over land nobody has seen yet (the map fills in)      */
/*    inspect fly over a far camp / nest and report what's there        */
/*    patrol  a round over every neighbourhood of the town              */
/*  Between jobs they land and the rider works on the ground like any   */
/*  other grown-up. Exhaustion, wounds, the night and their shift all   */
/*  still apply (and a player order always comes first).               */
/*                                                                     */
/*  A job is the dragon command "duty" (dragonKeep.runCmd hands it      */
/*  here), so boarding, tiredness and wounds work as for every order.   */
/* ------------------------------------------------------------------ */
import { NODES } from "../data/colony";
import { canFly, commandDragon, dragonOf, dragonStats, flyToward, knows, landAt, landingSpot, rideable, roostOf, threatNear } from "./dragonKeep";
import { deliver, sites } from "./build";
import { go, say, stockPriorities } from "./humans";
import { P } from "./particles";
import { pick } from "./rng";
import { prioOf, siteKeyOf } from "./priority";
import { type Dragon, type DragonCmd, type Human, type Resource } from "./types";
import type { World } from "./world";

type Job = NonNullable<Dragon["duty"]>["job"];

export const DUTY_INFO: Record<Job, { icon: string; name: string }> = {
  alert: { icon: "🚨", name: "Answering an alert" },
  cargo: { icon: "📦", name: "Flying supplies to a building site" },
  ferry: { icon: "🧍", name: "Giving someone a lift" },
  gather: { icon: "⛏️", name: "Fetching supplies from far away" },
  scout: { icon: "🔭", name: "Scouting unknown land" },
  inspect: { icon: "👁️", name: "Looking over a far-off camp" },
  patrol: { icon: "🌀", name: "Patrolling the town" },
};

/** seconds between jobs (a breather on the ground, and the rider's turn at other work) */
const BREAK = [24, 40] as const;
/** a lift is worth it past this walk (px) */
const FERRY_FROM = 1100;
const SCOUT_REACH = 4200;

/** Fit to fly a job: grown + rideable, rested, fed, healthy, not on someone else's orders. */
export function dutyReady(w: World, h: Human, dr: Dragon, urgent = false) {
  if (!rideable(dr) || !canFly(dr) || dr.hp < dr.maxHp * 0.5) return false;
  if ((dr.stamina ?? 1) < (urgent ? 0.3 : 0.5) || (dr.energy ?? 1) < (urgent ? 0.2 : 0.35) || (dr.hunger ?? 0) > 0.75) return false;
  if (h.child || h.captive || h.under || h.state === "down" || h.hp < 0.45 || (h.energy < 0.25 && !urgent)) return false;
  if (h.order || h.taskId || h.riding || h.chariot || w.colony.hunt) return false;
  if (w.weather.storm > 0.6) return false;
  if (!urgent && (w.daylight < 0.3 || !w.shifts.active(w, h))) return false;
  return true;
}

/** Is this dragon's current order a rider's job (not a player's command)? */
export const onDuty = (dr: Dragon) => dr.cmd?.kind === "duty" && !!dr.duty;

/**
 * The rider's side (from humans.think, after their own dragon-call check): when the pair is free, pick
 * the most useful job and send the dragon on it (the rider walks over + climbs on, as for any flight).
 * Returns true while the rider is busy getting to their dragon for it.
 */
export function riderDutyThink(w: World, h: Human): boolean {
  const dr = dragonOf(w, h);
  if (!dr || h.aloft) return false;
  // a player's command (or a show, an expedition) comes first
  if (dr.cmd && !dr.cmd.auto) return false;
  if (dr.cmd && dr.cmd.kind !== "duty" && dr.cmd.kind !== "patrol" && dr.cmd.kind !== "home") return false;
  if (onDuty(dr) || dr.post) return false;
  if (w.elapsed < (dr.dutyAt ?? 0)) return false;
  const alert = alertFor(w, dr);
  if (!dutyReady(w, h, dr, !!alert)) return false;
  const job = alert ?? pickJob(w, h, dr);
  dr.dutyAt = w.elapsed + BREAK[0] + w.rng() * (BREAK[1] - BREAK[0]);
  if (!job) return false;
  dr.duty = { ...job, t: 0, step: 0 };
  dr.cmd = { kind: "duty", x: job.x, y: job.y, t: 0, i: 0, auto: true };
  if (Math.hypot(h.x - dr.x, h.y - dr.y) > 46) go(h, "walk", dr.x - 20 * dr.dir, dr.y + 6);
  say(h, job.job === "alert" ? `${dr.name}, with me!` : pick(w.rng, [`Come on, ${dr.name}!`, "Work to do!", "Up we go!"]));
  if (!w.flags.has(`duty:${job.job}`)) {
    w.flags.add(`duty:${job.job}`);
    w.toast(DUTY_INFO[job.job].icon, `${h.name} and ${dr.name} are off on a job: ${DUTY_INFO[job.job].name.toLowerCase()}. Dragon Riders work for the tribe between fights.`, dr.x, dr.y);
  }
  return true;
}

type Plan = { job: Job; x: number; y: number; target?: number; r?: Resource; n?: number; passenger?: number };

/** Trouble near the town (or one of our people out in the wild) this dragon can do something about. */
function alertFor(w: World, dr: Dragon): Plan | null {
  if (!knows(dr, "fire") && !knows(dr, "combat")) return null;
  const near = threatNear(w, w.camp.x, w.camp.y, 1300);
  let foe = near;
  if (!foe) {
    for (const h of w.humans) {
      if (h.child || h.under || h.captive || Math.hypot(h.x - w.camp.x, h.y - w.camp.y) < 700) continue;
      foe = threatNear(w, h.x, h.y, 420);
      if (foe) break;
    }
  }
  if (!foe) return null;
  const p = foe.kind === "dino" ? foe.d : foe.kind === "brute" ? foe.b : foe.dr;
  // a wild dragon is a job for a war-trained one
  if (foe.kind === "dragon" && !knows(dr, "combat")) return null;
  return { job: "alert", x: p.x, y: p.y, target: p.id };
}

/** The most useful thing to do right now (null = nothing worth a flight). */
function pickJob(w: World, h: Human, dr: Dragon): Plan | null {
  const st = dragonStats(dr);
  const plans: { p: Plan; score: number }[] = [];
  // a building site waiting on supplies the stores have, far from them (urgent sites first)
  if (knows(dr, "carry") && st.carry >= 2) {
    for (const s of sites(w)) {
      if (!s.need || s.locked || w.camp.stock[s.need] < 1) continue;
      const far = Math.hypot(s.x - w.camp.pileX, s.y - w.camp.pileY);
      const prio = prioOf(w, siteKeyOf(s));
      if (far < 420 && prio < 2) continue;
      plans.push({ p: { job: "cargo", x: s.x, y: s.y, r: s.need }, score: 40 + prio * 45 + Math.min(40, far / 40) });
    }
  }
  // someone with a long walk ahead: give them a lift
  if (st.carry >= 1) {
    for (const o of w.humans) {
      if (o === h || o.child || o.aloft || o.ferry || o.riding || o.under || o.captive || o.stranger || o.state !== "walk") continue;
      const d = Math.hypot(o.tx - o.x, o.ty - o.y);
      if (d < FERRY_FROM || Math.hypot(o.x - dr.x, o.y - dr.y) > 1600) continue;
      if (w.dragons.owned.some((x) => x.duty?.passenger === o.id)) continue;
      plans.push({ p: { job: "ferry", x: o.x, y: o.y, passenger: o.id, target: o.id }, score: 30 + d / 60 });
      break;
    }
  }
  // the camp's lowest supply, from a deposit too far to walk to every day
  if (knows(dr, "carry") && st.carry >= 2) {
    const want = stockPriorities(w).slice(0, 3);
    let best: { x: number; y: number; id: number; r: Resource; d: number } | null = null;
    for (const n of w.colony.nodes) {
      const def = NODES[n.kind];
      if (!n.found || n.amount <= 0 || !def.gives || !want.includes(def.gives) || (def.needs && !w.camp.learned.has(def.needs))) continue;
      const d = Math.hypot(n.x - w.camp.x, n.y - w.camp.y);
      if (d < 800 || d > 5200) continue;
      if (w.dragons.owned.some((x) => x.duty?.target === n.id)) continue;
      if (!best || d < best.d) best = { x: n.x, y: n.y, id: n.id, r: def.gives, d };
    }
    if (best) plans.push({ p: { job: "gather", x: best.x, y: best.y, target: best.id, r: best.r }, score: 28 + (want.indexOf(best.r) === 0 ? 14 : 0) });
  }
  // unknown land within reach: the map fills in as they fly over it
  const unseen = w.atlas.nearestUnseen(dr.x, dr.y, SCOUT_REACH);
  if (unseen && !w.dragons.owned.some((x) => x !== dr && x.duty?.job === "scout" && Math.hypot(x.duty.x - unseen.x, x.duty.y - unseen.y) < 800)) plans.push({ p: { job: "scout", x: unseen.x, y: unseen.y }, score: 26 });
  // a far-off camp or nest we know of, not looked over for a while
  const spot = w.atlas.inspectTarget(w);
  if (spot) plans.push({ p: { job: "inspect", x: spot.x, y: spot.y }, score: 14 });
  // a round over the neighbourhoods
  plans.push({ p: { job: "patrol", x: w.camp.x, y: w.camp.y }, score: w.tribe.zones.length > 1 ? 16 : 10 });
  plans.sort((a, b) => b.score - a.score + (w.rng() - 0.5) * 8);
  return plans[0]?.p ?? null;
}

/** Run a job (dragonKeep.runCmd hands "duty" orders here). Returns false when it's over. */
export function dutyCmd(w: World, dr: Dragon, cmd: DragonCmd, dt: number): boolean {
  const job = dr.duty;
  if (!job) return false;
  job.t += dt;
  const rider = w.humans.find((x) => x.aloft === dr.id) ?? null;
  // the rider never made it on (called away, too far): call it off
  if (!rider && job.step === 0 && cmd.t > 20) return endDuty(w, dr);
  dr.state = "fly";
  switch (job.job) {
    case "alert": {
      const foe = job.target ? w.dinoById(job.target) ?? w.rivals.byId(job.target) ?? w.dragons.byId(job.target) : null;
      if (!foe || job.t > 70) return endDuty(w, dr);
      // trained for combat: a proper attack (the usual order does the diving + breath)
      if (knows(dr, "combat")) {
        commandDragon(w, dr, "attack", { x: foe.x, y: foe.y, target: foe.id });
        if (dr.cmd) dr.cmd.auto = true;
        dr.duty = undefined;
        return true;
      }
      if (knows(dr, "fire")) {
        commandDragon(w, dr, "fire", { x: foe.x, y: foe.y });
        if (dr.cmd) dr.cmd.auto = true;
        dr.duty = undefined;
        return true;
      }
      flyToward(w, dr, foe.x, foe.y, 160, dt);
      if (job.t % 3 < dt) w.alarm(foe.x, foe.y, 600, 0.7, "🐉", false);
      return true;
    }
    case "cargo": {
      const st = dragonStats(dr);
      const site = sites(w).filter((s) => s.need === job.r && !s.locked).sort((a, b) => prioOf(w, siteKeyOf(b)) - prioOf(w, siteKeyOf(a)) || Math.hypot(a.x - job.x, a.y - job.y) - Math.hypot(b.x - job.x, b.y - job.y))[0];
      if (!dr.carrying) {
        if (!site || !job.r || w.camp.stock[job.r] < 1) return endDuty(w, dr);
        if (landAt(w, dr, w.camp.pileX + 40, w.camp.pileY + 20, dt)) {
          const n = Math.min(st.carry, w.camp.stock[job.r]);
          w.camp.stock[job.r] -= n;
          dr.carrying = { r: job.r, n };
          w.sfx("thud", dr.x, dr.y, 0.6);
          job.step = 1;
        }
        return true;
      }
      if (!site) {
        w.camp.stock[dr.carrying.r] += dr.carrying.n;
        dr.carrying = null;
        return endDuty(w, dr);
      }
      if (landAt(w, dr, site.sx + 30, site.sy + 10, dt)) {
        const used = deliver(w, site, dr.carrying.r, dr.carrying.n, dr.x, dr.y);
        const left = dr.carrying.n - used;
        if (left > 0) w.camp.stock[dr.carrying.r] += left;
        if (rider) say(rider, `${used} ${dr.carrying.r}, delivered!`);
        dr.carrying = null;
        return endDuty(w, dr);
      }
      return true;
    }
    case "ferry": {
      const p = job.passenger ? w.humans.find((x) => x.id === job.passenger) ?? null : null;
      if (!p || p.state === "down" || p.captive || job.t > 120) {
        if (p) dropPassenger(w, dr, p);
        return endDuty(w, dr);
      }
      if (job.step <= 1) {
        // fly down beside them; they climb on behind the rider
        if (p.ferry === dr.id) {
          job.step = 2;
          return true;
        }
        if (p.state !== "walk" && p.state !== "idle") return endDuty(w, dr);
        job.x = p.tx;
        job.y = p.ty;
        if (landAt(w, dr, p.x + 40, p.y + 8, dt)) {
          if (Math.hypot(p.x - dr.x, p.y - dr.y) < 70) {
            p.ferry = dr.id;
            job.step = 2;
            say(p, pick(w.rng, ["A lift! Thank you!", "Whoa, high up!", "Hold on tight…"]));
          } else go(p, "walk", dr.x - 20, dr.y + 6);
        }
        return true;
      }
      const to = landingSpot(w, job.x, job.y, dragonStats(dr).scale);
      if (landAt(w, dr, to.x, to.y, dt)) {
        dropPassenger(w, dr, p);
        go(p, "walk", job.x, job.y);
        return endDuty(w, dr);
      }
      return true;
    }
    case "gather": {
      const node = w.colony.nodes.find((n) => n.id === job.target);
      if (!dr.carrying) {
        if (!node || node.amount <= 0) return endDuty(w, dr);
        if (landAt(w, dr, node.x + 30, node.y + 10, dt)) {
          // the rider loads up what the dragon can carry (a few seconds' work)
          job.step++;
          if (rider && w.rng() < dt * 2) w.particles.burst(P.Dust, node.x, node.y, 3, 30, { size: 6, max: 0.6, color: "rgba(200,180,140,0.7)" });
          if (job.step > 60 * 3) {
            const def = NODES[node.kind];
            const n = Math.min(dragonStats(dr).carry, node.amount * def.per);
            node.amount -= Math.ceil(n / Math.max(1, def.per));
            if (node.amount <= 0) w.colony.nodes.splice(w.colony.nodes.indexOf(node), 1);
            dr.carrying = { r: def.gives!, n };
            job.step = 1;
          }
        }
        return true;
      }
      if (landAt(w, dr, w.camp.pileX + 40, w.camp.pileY + 20, dt)) {
        w.camp.stock[dr.carrying.r] += dr.carrying.n;
        w.toast("⛏️", `${dr.name} flew home ${dr.carrying.n} ${dr.carrying.r} from far away.`, dr.x, dr.y);
        dr.carrying = null;
        return endDuty(w, dr);
      }
      return true;
    }
    case "scout":
    case "inspect": {
      const d = flyToward(w, dr, job.x, job.y, 260, dt, 0.95);
      if (d < 120 || job.t > 90) {
        if (job.job === "inspect") w.atlas.inspected(w, job.x, job.y, dr);
        else if (rider && w.rng() < 0.5) say(rider, pick(w.rng, ["Never seen this before!", "What a view!", "Land ho!"]));
        // pick the next unseen patch nearby, a few times, then home
        job.step++;
        const next = job.job === "scout" && job.step < 4 ? w.atlas.nearestUnseen(dr.x, dr.y, 1600) : null;
        if (next) {
          job.x = next.x;
          job.y = next.y;
          job.t = 0;
          return true;
        }
        return endDuty(w, dr);
      }
      return true;
    }
    case "patrol": {
      const zones = w.tribe.zones.length ? w.tribe.zones : [{ x: w.camp.x, y: w.camp.y }];
      const z = zones[job.step % zones.length];
      const a = job.t * 0.5 + dr.id;
      flyToward(w, dr, z.x + Math.cos(a) * 260, z.y + Math.sin(a) * 170, 220, dt, 0.75);
      if (job.t > 22) {
        job.t = 0;
        job.step++;
      }
      // trouble on the rounds: dive at it
      if (job.t % 1 < dt) {
        const foe = alertFor(w, dr);
        if (foe) {
          dr.duty = { ...foe, t: 0, step: 0 };
          return true;
        }
      }
      return job.step < Math.max(2, zones.length);
    }
  }
  return false;
}

/** The job's done: home to land (or straight on to the next, after the break). */
function endDuty(w: World, dr: Dragon) {
  const job = dr.duty;
  if (job?.passenger) {
    const p = w.humans.find((x) => x.id === job.passenger);
    if (p && p.ferry === dr.id) dropPassenger(w, dr, p);
  }
  dr.duty = undefined;
  // land near the rider's work rather than going all the way home, when there's work right here
  const home = roostOf(w, dr);
  dr.cmd = { kind: "land", x: Math.hypot(home.x - dr.x, home.y - dr.y) < 1500 ? home.x : dr.x, y: Math.hypot(home.x - dr.x, home.y - dr.y) < 1500 ? home.y : dr.y, t: 0, auto: true };
  return true;
}

function dropPassenger(w: World, dr: Dragon, p: Human) {
  p.ferry = undefined;
  p.z = 0;
  p.x = dr.x + 26 * dr.dir;
  p.y = dr.y + 12;
  p.think = 0.3;
  if (dr.z > 30) p.hp = Math.max(0.05, p.hp - 0.1);
}

/** Per frame for someone getting a lift: sat behind the rider. */
export function ferryTick(w: World, h: Human, dt: number) {
  const dr = w.dragons.owned.find((d) => d.id === h.ferry);
  if (!dr || dr.hp <= 0 || dr.duty?.passenger !== h.id) {
    h.ferry = undefined;
    h.z = 0;
    return;
  }
  const s = dragonStats(dr).scale;
  h.x = dr.x - dr.dir * 16 * s;
  h.y = dr.y + 0.4;
  h.z = dr.z + 30 * s;
  h.dir = dr.dir;
  h.vx = dr.vx;
  h.vy = dr.vy;
  h.anim += dt;
  h.stateT += dt;
  if (h.bubble) {
    h.bubble.t -= dt;
    if (h.bubble.t <= 0) h.bubble = null;
  }
}

/** What a dragon on duty is up to (for its info card). */
export function dutyLabel(dr: Dragon) {
  if (!dr.duty) return null;
  const d = DUTY_INFO[dr.duty.job];
  return `${d.icon} ${d.name}`;
}
