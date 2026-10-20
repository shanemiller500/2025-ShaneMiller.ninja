import { sp } from "../data/species";
import { BRUTE_TOUGH } from "./rivals";
import { dinoMaxHp, sizeOf } from "./dinos";
import type { Brute, Dino, Human } from "./types";
import type { Task } from "./tasks";
import type { World } from "./world";

/* ------------------------------------------------------------------ */
/*  Courage: strength in numbers.                                      */
/*                                                                     */
/*  People out on a job (a task the player gave them) don't just drop  */
/*  everything and run when a predator or raider turns up. Each one    */
/*  sizes up the fight: how much damage their armed band nearby can    */
/*  deal, against how much it takes to bring the threats down. A band  */
/*  that can win stands and fights; numbers make everyone bolder. Once */
/*  in, they hold until the odds turn badly or they're hurt — then     */
/*  they fall back and the usual run-for-cover takes over.             */
/* ------------------------------------------------------------------ */

export const COURAGE = {
  /** allies count when this close (px) */
  allyR: 220,
  /** threats count when this close (px) */
  threatR: 320,
  /** seconds of fighting a lone person is willing to face… */
  window: 3,
  /** …plus this much for every armed friend at their side… */
  perAlly: 1,
  /** …up to this */
  maxWindow: 9,
  /** a built Scorpion close by counts like this much damage per second */
  scorpionDps: 15,
  /** score needed to stand and fight */
  start: 1,
  /** score needed to keep fighting once in (a little stubbornness) */
  hold: 0.6,
  /** fall back when this hurt */
  breakHp: 0.35,
};

/** Tasks that aren't a job out in the world (resting, getting healed, firefighting has its own rules). */
const NOT_A_MISSION = new Set(["rest", "heal", "douse", "dismount", "ride"]);

/** Out on a job the player gave them. */
export function onMission(h: Human, task: Task | null | undefined) {
  return !!task && !NOT_A_MISSION.has(task.kind);
}

/** Can stand in a fight at all: a grown-up, on the ground, well enough, not busy elsewhere. */
export function canFight(w: World, h: Human) {
  return !h.child && !h.under && !h.aloft && !h.captive && !h.riding && !h.stranger && h.level === 0 && h.hp >= COURAGE.breakHp
    && h.state !== "down" && h.state !== "sleep" && !!w.tribe.weaponFor(w, h);
}

export type Foe = { kind: "dino"; d: Dino; dist: number } | { kind: "brute"; b: Brute; dist: number };

/** Predators, raiders and hostile Neanderthals close to `h`, nearest first. */
export function foesNear(w: World, h: Human, r = COURAGE.threatR): Foe[] {
  const out: Foe[] = [];
  w.creatureHash.each(h.x, h.y, r, (e) => {
    if (e.kind !== "dino") return;
    const d = e as Dino;
    if (d.owner || d.state === "sleep" || d.state === "knocked" || d.state === "carried" || d.state === "stuck") return;
    const def = sp(d.species);
    const predator = def.diet !== "herbivore" && sizeOf(d) > 30 && def.move !== "swim" && !(def.move === "fly" && d.z > 10);
    if (!d.raider && !predator) return;
    out.push({ kind: "dino", d, dist: Math.hypot(d.x - h.x, d.y - h.y) });
  });
  for (const b of w.rivals.brutes) {
    if (b.hp <= 0 || b.state === "flee" || b.state === "home" || !w.rivals.hostile(w, b)) continue;
    const dist = Math.hypot(b.x - h.x, b.y - h.y);
    if (dist < r) out.push({ kind: "brute", b, dist });
  }
  return out.sort((a, b) => a.dist - b.dist);
}

/** Damage it still takes to bring a foe down. */
export function toughness(f: Foe) {
  return f.kind === "dino" ? dinoMaxHp(f.d) * Math.max(0, f.d.health) : Math.max(0, f.b.hp) * BRUTE_TOUGH;
}

/** Everyone who'd fight beside `h`: armed grown-ups close by who are on a job, on guard or hunting, or already fighting. */
export function bandNear(w: World, h: Human): Human[] {
  const out: Human[] = [];
  for (const o of w.humans) {
    if (o !== h && Math.hypot(o.x - h.x, o.y - h.y) > COURAGE.allyR) continue;
    if (!canFight(w, o)) continue;
    const role = w.tribe.roleOf(o);
    const willing = o === h || role === "guard" || role === "hunter" || !!o.order || o.state === "aim" || o.state === "hunt" || !!o.rally || onMission(o, w.tasks.get(o.taskId));
    if (willing) out.push(o);
  }
  return out;
}

/** Damage per second the band can put out (hurt fighters hit softer), plus Scorpions in reach. */
export function bandDps(w: World, band: Human[], at: { x: number; y: number }) {
  let dps = 0;
  for (const o of band) {
    const wp = w.tribe.weaponFor(w, o);
    if (wp) dps += (wp.dmg / Math.max(0.5, wp.cd)) * (0.5 + 0.5 * o.hp);
  }
  for (const s of w.colony.scorpions) if (s.built >= 1 && s.hp > 0 && Math.hypot(s.x - at.x, s.y - at.y) < COURAGE.threatR) dps += COURAGE.scorpionDps;
  return dps;
}

/**
 * How winnable the fight looks: the damage the band can deal in the time they're
 * willing to stand there, over what the foes can take. ≥ 1 = "we can do this".
 * Each armed friend adds both damage and nerve — that's the strength in numbers.
 */
export function courageScore(w: World, h: Human, band: Human[], foes: Foe[]) {
  const hp = foes.reduce((s, f) => s + toughness(f), 0);
  if (hp <= 0) return Infinity;
  const nerve = Math.min(COURAGE.maxWindow, COURAGE.window + COURAGE.perAlly * Math.max(0, band.length - 1));
  return (bandDps(w, band, h) * nerve) / hp;
}
