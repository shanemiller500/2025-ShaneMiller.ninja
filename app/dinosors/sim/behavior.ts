/* ------------------------------------------------------------------ */
/*  Dinosaur AI. Deterministic state machine driven by world state:    */
/*  threats > babies > thirst > hunger > sleep > shelter > eggs >      */
/*  territory > play. `think` picks a state (throttled, cheaper off-   */
/*  screen); `act` runs the current state every frame.                 */
/* ------------------------------------------------------------------ */
import { FACTS } from "../data/facts";
import { sp } from "../data/species";
import { emote, isBaby, scaleOf, setState, sizeOf, walkable } from "./dinos";
import { toss } from "./humans";
import { actRaider, bite, hitDino, thinkRaider } from "./tribe";
import { CAMP_LEVELS } from "../data/facts";
import { eatCarcass, makeCarcass } from "./carcass";
import { P } from "./particles";
import { canReach, shakeFruit, TALL } from "./plants";
import { pick } from "./rng";
import { LM } from "./terrain";
import { T, TILE, WORLD_H, WORLD_W, type Brute, type Dino, type DinoState, type Human, type Item, type SpeciesDef } from "./types";
import type { World } from "./world";

/** States that run to completion; `think` leaves them alone. */
const LOCKED = new Set<DinoState>([
  "carried",
  "knocked",
  "tussle",
  "lookUp",
  "roar",
  "annoyed",
  "faint",
  "stuck",
  "scratch",
  "wallow",
  "splash",
  "shakeTree",
  "breach",
  "attackWall",
  "ridden",
]);

const dd = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

function canEat(pred: Dino, prey: Dino) {
  const pd = sp(pred.species);
  const qd = sp(prey.species);
  if (pd.diet === "herbivore" || prey.id === pred.id || prey.species === pred.species) return false;
  if (qd.move === "swim" || (qd.move === "fly" && prey.z > 6)) return false;
  if (prey.state === "carried" || prey.state === "faint") return false;
  const max = (pd.preyMax ?? 0) * scaleOf(pred);
  return sizeOf(prey) <= max;
}

/** The scariest awake predator that could eat me. */
function findThreat(w: World, d: Dino, def: SpeciesDef): Dino | null {
  const r = def.sense * (0.55 + d.fear * 0.5);
  let best: Dino | null = null;
  let bestD = Infinity;
  w.creatureHash.each(d.x, d.y, r, (e, d2) => {
    if (e.kind !== "dino" || e.state === "sleep" || e.state === "knocked" || e.state === "carried") return;
    if (!canEat(e, d)) return;
    // creeping stalkers are only noticed up close
    if (e.state === "stalk" && d2 > (r * 0.4) ** 2) return;
    const hunting = e.state === "chase" || e.targetId === d.id;
    const near = d2 < (r * 0.55) ** 2;
    if ((hunting || near || e.hunger > 0.6) && d2 < bestD) {
      bestD = d2;
      best = e;
    }
  });
  return best;
}

/** Is this spot inside a settlement that looks too dangerous to raid for dinner? */
function guarded(w: World, d: Dino, x: number, y: number) {
  const c = w.camp;
  const R = CAMP_LEVELS[w.tribe.level].radius + 120;
  if (Math.hypot(x - c.x, y - c.y) > R) return false;
  // starving + huge predators take their chances
  return w.tribe.defense(w) > 3 + sizeOf(d) / 30 && d.hunger < 0.92;
}

function findPrey(w: World, d: Dino, def: SpeciesDef): Dino | Human | null {
  let best: Dino | Human | null = null;
  let bestScore = Infinity;
  const nearFire = (x: number, y: number) => w.campfires.some((f) => f.lit && Math.hypot(f.x - x, f.y - y) < 170);
  w.creatureHash.each(d.x, d.y, def.sense, (e, d2) => {
    let score = Math.sqrt(d2);
    if (e.kind === "dino") {
      if (!canEat(d, e)) return;
      if (e.owner && guarded(w, d, e.x, e.y)) return;
      if (isBaby(e)) score -= 120;
      if (e.health < 0.5) score -= 80;
      // stuck in tar = an easy meal
      if (e.state === "stuck") score -= 150;
    } else {
      if (w.tribe.danger === "calm" || d.hunger < 0.55 || def.size < 40 || e.captive || e.state === "hide" || e.state === "sleep" || e.state === "tossed" || e.level === 1) return;
      if (nearFire(e.x, e.y) || guarded(w, d, e.x, e.y)) return;
      // people are tempting; someone lying knocked out is an easy meal
      score += e.state === "down" ? -100 : e.child ? 40 : 80;
    }
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  });
  return best;
}

function findMeat(w: World, d: Dino, r: number, kinds: Item["kind"][]): Item | null {
  let best: Item | null = null;
  let bestD = r * r;
  // meat-eaters smell bodies from further away
  const bodies = kinds.includes("meat");
  for (const it of w.items) {
    if (it.z > 2) continue;
    if (it.kind === "carcass") {
      if (!bodies || !it.carcass || it.carcass.meat <= 0) continue;
    } else if (!kinds.includes(it.kind)) continue;
    const d2 = (it.x - d.x) ** 2 + (it.y - d.y) ** 2;
    if (d2 < bestD) {
      bestD = d2;
      best = it;
    }
  }
  return best;
}

function nearFireDanger(w: World, d: Dino) {
  const tx = Math.floor(d.x / TILE);
  const ty = Math.floor(d.y / TILE);
  for (let y = ty - 4; y <= ty + 4; y++) for (let x = tx - 4; x <= tx + 4; x++) if (w.fire.at(x, y) > 0.3 || w.lava.heatAt(x, y) > 0.2) return { x: x * TILE + 16, y: y * TILE + 16 };
  return null;
}

/** A point in the direction away from (fx, fy), walkable if possible. */
function awayFrom(w: World, d: Dino, fx: number, fy: number, dist = 360) {
  const a0 = Math.atan2(d.y - fy, d.x - fx);
  for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6]) {
    const x = d.x + Math.cos(a0 + off) * dist;
    const y = d.y + Math.sin(a0 + off) * dist;
    if (walkable(w, d, x, y) || sp(d.species).move === "fly") return { x, y };
  }
  return { x: d.x + Math.cos(a0) * dist, y: d.y + Math.sin(a0) * dist };
}

function wanderTarget(w: World, d: Dino, def: SpeciesDef) {
  // befriended dinos potter about near home (the pen, or just outside camp)
  if (d.owner) {
    const home = battleHome(w, d);
    const span = (d.warTraining ?? 0) >= 0.35 ? 50 : 180;
    return { x: home.x + (w.rng() - 0.5) * span, y: home.y + (w.rng() - 0.5) * (span * 0.65) };
  }
  const herd = d.herd ? w.herdCenters.get(d.herd) : undefined;
  if (herd && herd.n > 1 && dd(d, herd) > 160) return { x: herd.x + (w.rng() - 0.5) * 140, y: herd.y + (w.rng() - 0.5) * 100 };
  if (!d.migrant && Math.hypot(d.x - d.homeX, d.y - d.homeY) > 1300) return { x: d.homeX + (w.rng() - 0.5) * 300, y: d.homeY + (w.rng() - 0.5) * 300 };
  let fallback: { x: number; y: number } | null = null;
  for (let k = 0; k < 6; k++) {
    const a = w.rng() * Math.PI * 2;
    const r = 120 + w.rng() * 300;
    const x = (herd && herd.n > 1 ? herd.x : d.x) + Math.cos(a) * r;
    const y = (herd && herd.n > 1 ? herd.y : d.y) + Math.sin(a) * r;
    if (!walkable(w, d, x, y)) continue;
    // predators keep clear of well-defended camps
    if (def.diet !== "herbivore" && guarded(w, d, x, y)) continue;
    fallback = { x, y };
    if (def.biomes.includes(w.terrain.tileAt(x, y))) return fallback;
  }
  return fallback ?? { x: d.x + (w.rng() - 0.5) * 100, y: d.y + (w.rng() - 0.5) * 100 };
}

/** A trained pet's place on the hay inside its nearest finished pen. */
function battleHome(w: World, d: Dino) {
  const fallback = { x: w.camp.x + 160, y: w.camp.y + 150, pen: false };
  const pens = w.colony.buildings.filter((b) => b.kind === "pen" && b.built >= 1 && b.hp > 0);
  const pen = pens.sort((a, b) => Math.hypot(a.x - d.homeX, a.y - d.homeY) - Math.hypot(b.x - d.homeX, b.y - d.homeY))[0];
  if (!pen) {
    d.homeX = fallback.x;
    d.homeY = fallback.y;
    return fallback;
  }
  d.homeX = pen.x;
  d.homeY = pen.y;
  const slots = [[-22, -35], [22, -35], [-10, -19], [10, -19]] as const;
  for (let n = 0; n < slots.length; n++) {
    const [sx, sy] = slots[(d.id + n) % slots.length];
    const x = pen.x + sx;
    const y = pen.y + sy;
    if (walkable(w, d, x, y)) return { x, y, pen: true };
  }
  return { x: pen.x, y: pen.y - 27, pen: true };
}

/* ------------------------------------------------------------------ */
/*  Walkers                                                            */
/* ------------------------------------------------------------------ */

function thinkWalker(w: World, d: Dino, def: SpeciesDef) {
  const night = w.daylight < 0.3;
  const awakeTime = def.nocturnal ? true : !night;
  const baby = isBaby(d);

  // migrants just keep walking (unless something eats them)
  if (d.migrant) {
    const t = findThreat(w, d, def);
    if (!t) {
      if (d.state !== "migrate" || d.stuckT > 2) setState(d, "migrate", d.homeX, d.homeY + (w.rng() - 0.5) * 200);
      return;
    }
  }

  // 0. a dragon swooping overhead → scatter
  const dragon = w.dragons.list.find((dr) => dr.z < 200 && dr.state !== "leave" && Math.hypot(dr.x - d.x, dr.y - d.y) < 420);
  if (dragon && !d.owner) {
    const a = awayFrom(w, d, dragon.x, dragon.y, 420);
    if (d.state !== "flee") emote(d, "🐉", 1.2);
    setState(d, "flee", a.x, a.y);
    d.fear = 1;
    return;
  }

  // 1. fire / lava nearby → get away
  const hot = nearFireDanger(w, d);
  if (hot) {
    const a = awayFrom(w, d, hot.x, hot.y, 320);
    if (d.state !== "flee") emote(d, "😨", 1.2);
    setState(d, "flee", a.x, a.y);
    d.fear = Math.max(d.fear, 0.6);
    return;
  }

  // 2. predators
  if (def.diet === "herbivore" || def.size < 70) {
    const threat = findThreat(w, d, def);
    if (threat) {
      const tdef = sp(threat.species);
      const protecting = def.defender && !baby && w.dinos.some((b) => b.species === d.species && isBaby(b) && dd(b, d) < 200);
      const brave = def.defender && !baby && sizeOf(threat) < sizeOf(d) * 1.5 && (protecting || w.rng() < def.aggression + 0.25) && d.health > 0.4;
      if (brave) {
        if (d.state !== "defend") {
          emote(d, "💢", 1.5);
          w.sfx(def.sound.kind, d.x, d.y, 0.8, def.sound.pitch);
        }
        d.targetId = threat.id;
        setState(d, "defend", threat.x, threat.y);
        return;
      }
      const a = awayFrom(w, d, threat.x, threat.y, 360 + tdef.size);
      if (d.state !== "flee") {
        emote(d, "😱", 1.4);
        if (w.rng() < 0.5) w.sfx(def.sound.kind, d.x, d.y, 0.6, def.sound.pitch * 1.2);
        // alarm call spreads through the herd
        if (d.herd) for (const m of w.dinos) if (m.herd === d.herd && m !== d && dd(m, d) < 300) m.fear = Math.max(m.fear, 0.7);
      }
      d.threat = threat.id;
      d.fear = 1;
      setState(d, "flee", a.x, a.y);
      return;
    }
  }
  if (d.state === "flee" && d.fear > 0.3 && dd(d, { x: d.tx, y: d.ty }) > 30) return;

  // finish what we started: meals, drinks and trips end in act()
  if (d.state === "eat" || d.state === "drink") return;
  if ((d.state === "seekFood" || d.state === "seekWater" || d.state === "nest") && d.stateT < 25 && d.hunger < 0.9 && d.thirst < 0.9) return;

  // 3. babies stick to mum (and play)
  if (baby) {
    let parent = d.parent ? w.dinoById(d.parent) : null;
    if (!parent || parent.species !== d.species) {
      parent = w.creatureHash.nearest(d.x, d.y, 600, (e) => e.kind === "dino" && e.species === d.species && !isBaby(e as Dino)) as Dino | null;
      if (parent) d.parent = parent.id;
    }
    if (d.hunger < 0.6 && d.thirst < 0.6) {
      const pal = w.creatureHash.nearest(d.x, d.y, 160, (e) => e.kind === "dino" && e !== d && isBaby(e as Dino) && sp((e as Dino).species).diet === "herbivore" === (def.diet === "herbivore"));
      if (pal && w.rng() < 0.25) {
        d.targetId = pal.id;
        setState(d, "play", pal.x, pal.y);
        if (w.inView(d.x, d.y)) w.discover("play", d.x, d.y);
        return;
      }
      if (parent && dd(d, parent) > 70) {
        setState(d, "follow", parent.x - parent.dir * 30, parent.y + 10);
        return;
      }
    }
  }

  // 4. thirst
  if (d.thirst > 0.55) {
    const spot = w.terrain.nearestDrink(d.x, d.y);
    d.targetId = 0;
    if (spot) {
      if (dd(d, spot) < 18) {
        setState(d, "drink", spot.x, spot.y);
        emote(d, "💧", 1.2);
      } else setState(d, "seekWater", spot.x, spot.y);
      return;
    }
  }

  // 5. hunger
  const hungry = d.hunger > (def.diet === "herbivore" ? 0.5 : night && def.nocturnal ? 0.35 : 0.45);
  if (hungry) {
    if (def.diet === "herbivore") {
      const fruit = findMeat(w, d, 260, ["fruit", "berries"]);
      if (fruit) {
        d.targetId = fruit.id;
        setState(d, "seekFood", fruit.x, fruit.y);
        return;
      }
      const reach = def.reach ?? "low";
      const plant = w.plantHash.nearest(d.x, d.y, def.sense * 1.4, (p) => canReach(p, reach));
      if (plant) {
        d.targetId = plant.id;
        setState(d, "seekFood", plant.x + (d.x < plant.x ? -1 : 1) * sizeOf(d) * 0.35, plant.y + 4);
        return;
      }
      const t = w.terrain.tileAt(d.x, d.y);
      if (t === T.Grass || t === T.Jungle || t === T.Swamp) {
        d.targetId = 0;
        setState(d, "eat", d.x, d.y);
        return;
      }
    } else {
      // scavenge first (cheaper than hunting), raptors happily steal
      const meat = findMeat(w, d, def.sense, def.diet === "piscivore" ? ["fish", "meat"] : ["meat", "fish"]);
      if (meat) {
        const owner = meat.claimed ? w.dinoById(meat.claimed) : null;
        if (owner && owner !== d && owner.state === "eat") {
          if (def.size < 50) {
            d.targetId = meat.id;
            setState(d, "steal", meat.x, meat.y);
            return;
          }
          if (sizeOf(owner) < sizeOf(d) * 1.2) {
            // squabble over dinner
            startTussle(w, d, owner);
            return;
          }
        } else {
          d.targetId = meat.id;
          setState(d, "seekFood", meat.x, meat.y);
          return;
        }
      }
      if (def.diet === "piscivore") {
        const spot = w.terrain.nearestDrink(d.x, d.y);
        if (spot && w.schools.length) {
          if (dd(d, spot) < 18) {
            d.targetId = -1;
            setState(d, "eat", spot.x, spot.y);
          } else setState(d, "seekWater", spot.x, spot.y);
          d.targetId = -1;
          return;
        }
      }
      // small hunters snack on bugs + lizards when nothing bigger is around
      if (def.size < 70 && d.hunger > 0.5 && w.rng() < 0.35 && !findPrey(w, d, def)) {
        d.targetId = -2;
        setState(d, "eat", d.x, d.y);
        emote(d, pick(w.rng, ["🦗", "🦎", "🐛"]), 1.6);
        return;
      }
      // already on the hunt: keep going (act() decides when to give up)
      if ((d.state === "chase" || d.state === "stalk") && w.creatureById(d.targetId)) return;
      if (d.hunger > (def.diet === "piscivore" ? 0.8 : 0)) {
        const prey = findPrey(w, d, def);
        if (prey) {
          d.targetId = prey.id;
          const dist = dd(d, prey);
          setState(d, dist < def.sense * 0.35 ? "chase" : "stalk", prey.x, prey.y);
          if (d.state === "chase") w.sfx(def.sound.kind, d.x, d.y, 0.7, def.sound.pitch);
          return;
        }
      }
    }
  }

  // 6. sleep
  if (d.energy < 0.12 || (!awakeTime && d.energy < 0.85) || (def.nocturnal && !night && d.energy < 0.5)) {
    if (d.owner && (d.warTraining ?? 0) >= 0.35) {
      const home = battleHome(w, d);
      if (home.pen && dd(d, home) > 16) {
        setState(d, "wander", home.x, home.y);
        return;
      }
    }
    if (d.state !== "sleep") emote(d, "💤", 2);
    setState(d, "sleep", d.x, d.y);
    return;
  }
  if (d.state === "sleep") return;

  // 7. storms + blizzards → huddle under trees
  if ((w.weather.storm > 0.5 || w.weather.snow > 0.7) && def.diet === "herbivore" && d.state !== "shelter" && !d.owner) {
    const t = w.terrain.tileAt(d.x, d.y);
    if (t !== T.Forest && t !== T.Jungle) {
      const spot = w.terrain.findTile(d.x, d.y, 700, (t) => t === T.Forest || t === T.Jungle, w.rng, 30);
      if (spot) {
        setState(d, "shelter", spot.x, spot.y);
        return;
      }
    }
  }
  if (d.state === "shelter" && (w.weather.storm > 0.5 || w.weather.snow > 0.7)) return;

  // Between meals and battles, trained pets stay on watch at their pen.
  if (d.owner && (d.warTraining ?? 0) >= 0.35) {
    const home = battleHome(w, d);
    if (dd(d, home) > (home.pen ? 48 : 90)) setState(d, "wander", home.x, home.y);
    else if (d.state !== "idle" && d.state !== "wander") setState(d, "idle", d.x, d.y);
    else if (d.state === "idle" && w.rng() < 0.3) {
      const spot = wanderTarget(w, d, def);
      setState(d, "wander", spot.x, spot.y);
    }
    return;
  }

  // 8. eggs
  if (!baby && d.layT <= 0 && d.hunger < 0.5 && d.thirst < 0.5 && d.health > 0.7 && w.canLayEgg(d.species) && !d.migrant) {
    const a = w.rng() * Math.PI * 2;
    const r = w.rng() * 3 * TILE;
    setState(d, "nest", LM.nest.x * TILE + Math.cos(a) * r, LM.nest.y * TILE + Math.sin(a) * r);
    return;
  }

  // 9. territory: roar at rivals, sometimes fight
  if (def.territory > 0.5 && !baby) {
    const rival = w.creatureHash.nearest(d.x, d.y, 260, (e) => e.kind === "dino" && e !== d && sp((e as Dino).species).diet !== "herbivore" && sp((e as Dino).species).size > 80 && !isBaby(e as Dino) && (e as Dino).state !== "sleep") as Dino | null;
    if (rival && d.roarT <= 0) {
      startRoar(w, d);
      return;
    }
    if (rival && w.rng() < def.aggression * 0.12 && rival.state !== "tussle") {
      startTussle(w, d, rival);
      return;
    }
    if (d.roarT <= 0 && w.rng() < 0.3) {
      startRoar(w, d);
      return;
    }
  }

  // 10. leisure
  const r = w.rng();
  const tile = w.terrain.tileAt(d.x, d.y);
  if (r < 0.1 && def.curiosity > 0.3) {
    const poi = w.pois.find((p) => Math.hypot(p.x - d.x, p.y - d.y) < 500 && w.elapsed - p.t < 25);
    if (poi) {
      setState(d, "investigate", poi.x + (w.rng() - 0.5) * 50, poi.y + (w.rng() - 0.5) * 30);
      emote(d, "❓", 1.5);
      return;
    }
  }
  if (r < 0.16 && tile === T.Mud && def.diet === "herbivore") {
    setState(d, "wallow", d.x, d.y);
    return;
  }
  if (r < 0.2 && (tile === T.Shallow || tile === T.River)) {
    setState(d, "splash", d.x, d.y);
    return;
  }
  if (r < 0.26 && r > 0.2) {
    const tree = w.plantHash.nearest(d.x, d.y, 70, (p) => TALL.has(p.kind) && !p.stump && p.size > 0.6);
    if (tree) {
      if (tree.kind === "fruit" && tree.fruit > 0 && def.size > 70 && def.diet === "herbivore") {
        d.targetId = tree.id;
        setState(d, "shakeTree", tree.x, tree.y);
        d.dir = tree.x > d.x ? 1 : -1;
        return;
      }
      d.targetId = tree.id;
      setState(d, "scratch", tree.x, tree.y);
      return;
    }
  }
  // pachys: friendly head-bonking
  if (r < 0.34 && d.species === "pachy" && !baby) {
    const buddy = w.creatureHash.nearest(d.x, d.y, 200, (e) => e.kind === "dino" && e !== d && (e as Dino).species === "pachy" && !isBaby(e as Dino) && (e as Dino).state !== "sleep");
    if (buddy) {
      d.targetId = buddy.id;
      setState(d, "play", buddy.x, buddy.y);
      return;
    }
  }
  if (r < 0.5 && d.state !== "idle") {
    setState(d, "idle", d.x, d.y);
    return;
  }
  const t = wanderTarget(w, d, def);
  setState(d, "wander", t.x, t.y);
}

function startRoar(w: World, d: Dino) {
  setState(d, "roar", d.x, d.y);
  d.roarT = 45 + w.rng() * 60;
}

/** Trained friends defend the tribe nearby; a rider can bring one into a larger fight. */
function warTarget(w: World, d: Dino, range: number): Dino | Brute | null {
  let best: Dino | Brute | null = null;
  let distance = range;
  for (const foe of w.dinos) {
    if (foe === d || foe.owner || foe.health <= 0 || foe.state === "carried" || foe.state === "faint") continue;
    if (!foe.raider && !(sp(foe.species).diet === "carnivore" && (foe.state === "chase" || foe.state === "tussle") && Math.hypot(foe.x - w.camp.x, foe.y - w.camp.y) < 650)) continue;
    const gap = dd(d, foe);
    if (gap < distance) { best = foe; distance = gap; }
  }
  for (const foe of w.rivals.brutes) {
    if (foe.hp <= 0 || foe.captive || !w.rivals.hostile(w, foe)) continue;
    if (!foe.raid && !foe.war && Math.hypot(foe.x - w.camp.x, foe.y - w.camp.y) > 600 && !d.rider) continue;
    const gap = dd(d, foe);
    if (gap < distance) { best = foe; distance = gap; }
  }
  return best;
}

function actWarDino(w: World, d: Dino, dt: number) {
  if (!d.owner || (d.warTraining ?? 0) < 0.35 || isBaby(d)) return;
  d.spikeCd = Math.max(0, (d.spikeCd ?? 0) - dt);
  if ((d.warArmor ?? 0) > 0 && (d.spikeCd ?? 0) <= 0 && Math.hypot(d.vx, d.vy) > 28) {
    const reach = Math.max(22, sizeOf(d) * 0.38);
    const foe = warTarget(w, d, reach);
    if (foe && dd(d, foe) <= reach + (foe.kind === "dino" ? sizeOf(foe) * 0.22 : 12)) {
      d.spikeCd = 0.7;
      const force = (d.warArmor ?? 0) >= 2 ? 235 : 165;
      if (foe.kind === "dino") hitDino(w, foe, force, d.x, d.y);
      else w.rivals.hit(w, foe, force, d.x, d.y, false, "tusk");
      w.particles.burst(P.Star, foe.x, foe.y, 5, 65, { z: 20, size: 6, max: 0.6 });
      d.energy = Math.max(0, d.energy - 0.01);
    }
  }
  d.warCd = Math.max(0, (d.warCd ?? 0) - dt);
  if (d.warCd > 0) return;
  const foe = warTarget(w, d, d.rider ? Math.max(32, sizeOf(d) * 0.6) : 260);
  if (!foe) {
    if (d.state === "war") setState(d, "idle", d.x, d.y);
    return;
  }
  if (!d.rider) {
    d.targetId = foe.id;
    setState(d, "war", foe.x, foe.y);
  }
  const reach = Math.max(24, sizeOf(d) * 0.5) + (foe.kind === "dino" ? sizeOf(foe) * 0.25 : 10);
  if (dd(d, foe) > reach || (d.warCd ?? 0) > 0) return;
  d.warCd = 2.2;
  d.energy = Math.max(0, d.energy - 0.025);
  const training = d.warTraining ?? 0;
  const force = (0.12 + training * 0.12 + sp(d.species).attack * 0.08) * Math.max(0.7, Math.min(1.6, sizeOf(d) / 80));
  if (foe.kind === "dino") {
    foe.health -= force * (1 - sp(foe.species).defense * 0.4);
    foe.fear = Math.max(foe.fear, 0.6);
    if (foe.health <= 0) setState(foe, "faint", foe.x, foe.y);
    // Defending has a cost; grown armor makes pets last longer in a fight.
    d.health -= Math.max(0.005, sp(foe.species).attack * 0.035) * (1 - (d.warArmor ?? 0) * 0.3);
  } else {
    w.rivals.hit(w, foe, force, d.x, d.y);
    d.health -= 0.04 * (1 - (d.warArmor ?? 0) * 0.3);
  }
  w.sfx("bonk", foe.x, foe.y, 0.7);
}

export function startTussle(w: World, a: Dino, b: Dino | Human) {
  setState(a, "tussle", a.x, a.y);
  a.targetId = b.id;
  a.lead = true;
  if (b.kind === "dino") {
    setState(b, "tussle", b.x, b.y);
    b.targetId = a.id;
    b.lead = false;
  }
  w.sfx("tussle", a.x, a.y, 0.9);
}

function resolveTussle(w: World, d: Dino) {
  const other = w.creatureById(d.targetId);
  d.lead = false;
  setState(d, "idle", d.x, d.y);
  if (!other) return;
  const def = sp(d.species);
  if (other.kind === "human") {
    // raiders + hungry hunters bite (hurts, can knock someone out); everyday dinos give people a fright
    if (d.raider || (w.tribe.danger !== "calm" && def.diet !== "herbivore" && d.hunger > 0.5 && sizeOf(d) > 40)) {
      bite(w, d, other);
      // small hunters fling people; big ones hang on
      if (other.hp > 0 && sizeOf(d) < 70 && w.rng() < 0.4) toss(w, other, d.x);
      return;
    }
    toss(w, other, d.x);
    emote(d, "🤨", 2);
    d.hunger = Math.max(0, d.hunger - 0.05);
    return;
  }
  if (other.state !== "tussle") return;
  const odef = sp(other.species);
  if (canEat(d, other) && d.hunger > 0.3) {
    let p = 0.35 + def.attack * 0.45 * d.genes.size - odef.defense * scaleOf(other) * 0.45 * other.genes.tough + d.hunger * 0.1;
    if (isBaby(other)) p += 0.25;
    if (other.health < 0.5) p += 0.2;
    p = Math.max(0.12, Math.min(0.9, p));
    if (w.rng() < p) {
      // the prey goes down; its body stays (meat for the hunter, hide + bones for people)
      const meat = sizeOf(other) > 28 ? makeCarcass(w, other) : w.addItem("meat", other.x, other.y, { amount: Math.max(0.5, sizeOf(other) / 45) });
      w.particles.burst(P.Poof, other.x, other.y, 10, 60, { size: 14, max: 1, color: "rgba(230,220,200,0.9)" });
      w.removeDino(other);
      meat.claimed = d.id;
      d.targetId = meat.id;
      setState(d, "eat", meat.x, meat.y);
      w.sfx("chomp", d.x, d.y, 0.9);
      if (!w.flags.has("foodChain")) {
        w.flags.add("foodChain");
        w.toast("🍖", `${def.nick} caught a ${odef.nick}!`, d.x, d.y, FACTS.foodChain);
      }
      return;
    }
    // the prey wriggles free
    other.fear = 1;
    const a = awayFrom(w, other, d.x, d.y, 400);
    setState(other, "flee", a.x, a.y);
    emote(other, "💨", 1.5);
    knock(w, d, 1.2);
    return;
  }
  // predator vs predator (or squabble): bigger + luckier wins
  const mine = def.attack * sizeOf(d) * (0.6 + w.rng());
  const theirs = odef.attack * sizeOf(other) * (0.6 + w.rng());
  const loser = mine >= theirs ? other : d;
  const winner = loser === d ? other : d;
  loser.fear = 1;
  const a = awayFrom(w, loser, winner.x, winner.y, 450);
  setState(loser, "flee", a.x, a.y);
  emote(loser, "😵", 1.5);
  setState(winner, "idle", winner.x, winner.y);
  if (winner.roarT < 5) startRoar(w, winner);
}

export function knock(w: World, d: Dino, secs = 2) {
  if (d.state === "carried") return;
  setState(d, "knocked", d.x, d.y);
  d.stateT = -secs + 2;
  w.particles.spawn(P.Star, d.x, d.y, { z: sizeOf(d) * 0.5, size: 6 + sizeOf(d) / 20, max: secs });
}

/** Per-frame state handling for walkers. */
function actWalker(w: World, d: Dino, def: SpeciesDef, dt: number) {
  const reach = Math.max(14, sizeOf(d) * 0.45);
  const target = d.targetId ? w.creatureById(d.targetId) : null;
  switch (d.state) {
    case "seekFood": {
      const item = w.itemById(d.targetId);
      const plant = item ? null : w.plantById(d.targetId);
      if (!item && !plant) return setState(d, "idle");
      if (item) {
        d.tx = item.x;
        d.ty = item.y;
      }
      const there = item ? dd(d, item) < reach : dd(d, { x: d.tx, y: d.ty }) < 12;
      if (there) {
        if (item) item.claimed = d.id;
        setState(d, "eat");
        if (plant) d.dir = plant.x > d.x ? 1 : -1;
      } else if (d.stateT > 25 || d.stuckT > 2) setState(d, "idle");
      break;
    }
    case "eat": {
      if (d.targetId === -1) {
        // piscivore fishing from the shore
        d.thirst = Math.max(0, d.thirst - dt * 0.1);
        if (d.stateT > 3 && w.rng() < dt * 0.6) {
          w.particles.burst(P.Splash, d.x + d.dir * 20, d.y, 6, 50, { vz: 70, g: 200, size: 3, max: 0.7 });
          d.hunger = Math.max(0, d.hunger - 0.35);
          emote(d, "🐟", 1.4);
          w.sfx("splash", d.x, d.y, 0.6);
        }
        if (d.hunger < 0.15 || d.stateT > 14) setState(d, "idle");
        break;
      }
      if (d.targetId === -2) {
        // pouncing on bugs in the grass
        d.z = Math.abs(Math.sin(d.stateT * 6)) * 3;
        d.hunger = Math.max(0, d.hunger - dt * 0.07);
        if (d.stateT > 6) {
          d.z = 0;
          d.targetId = 0;
          setState(d, "idle");
        }
        break;
      }
      const item = w.itemById(d.targetId);
      const plant = item ? null : d.targetId ? w.plantById(d.targetId) : null;
      if (item && item.kind === "carcass") {
        // tearing meat off a body: hide + bones stay behind for people
        item.claimed = d.id;
        const done = eatCarcass(item, dt * 0.5 * (def.size / 80 + 0.5));
        d.hunger = Math.max(0, d.hunger - dt * 0.12);
        if (w.rng() < dt * 1.5) w.sfx("chomp", d.x, d.y, 0.5);
        if (w.rng() < dt * 3) w.particles.spawn(P.Crumb, item.x, item.y, { z: 6, vz: 30, vx: (w.rng() - 0.5) * 40, g: 150, size: 2, max: 0.5, color: "#c98a6a" });
        if (done || d.hunger < 0.05) {
          item.claimed = 0;
          emote(d, "😋", 1.6);
          if (def.diet !== "herbivore" && d.hunger < 0.25 && w.rng() < 0.6) setState(d, "sleep");
          else setState(d, "idle");
        }
      } else if (item) {
        item.claimed = d.id;
        const bite = dt * 0.18 * (def.size / 80 + 0.5);
        item.amount -= bite / Math.max(0.6, item.amount > 1 ? 1 : 1);
        d.hunger = Math.max(0, d.hunger - dt * 0.12);
        if (w.rng() < dt * 1.5) w.sfx("chomp", d.x, d.y, 0.5);
        if (w.rng() < dt * 3) w.particles.spawn(P.Crumb, item.x, item.y, { z: 6, vz: 30, vx: (w.rng() - 0.5) * 40, g: 150, size: 2, max: 0.5, color: "#c98a6a" });
        if (item.amount <= 0) {
          w.removeItem(item);
          emote(d, "😋", 1.6);
          if (def.diet !== "herbivore" && d.hunger < 0.25 && w.rng() < 0.6) setState(d, "sleep");
          else setState(d, "idle");
        }
      } else if (plant) {
        plant.food = Math.max(0, plant.food - dt * 0.07);
        plant.shake = Math.max(plant.shake, 0.4);
        d.hunger = Math.max(0, d.hunger - dt * 0.06);
        if (w.rng() < dt * 2 && w.inView(plant.x, plant.y, 40)) w.particles.spawn(P.Leaf, plant.x + (w.rng() - 0.5) * 20, plant.y, { z: TALL.has(plant.kind) ? 50 : 10, vz: -5, vx: (w.rng() - 0.5) * 20, size: 3, max: 1.5, color: "#6f9a3c" });
        if (w.rng() < dt * 0.4) w.sfx("munch", d.x, d.y, 0.4);
        if (plant.food < 0.08 || d.hunger < 0.05) setState(d, "idle");
      } else {
        // grazing ground cover
        d.hunger = Math.max(0, d.hunger - dt * 0.035);
        if (d.stateT > 7 || d.hunger < 0.1) setState(d, "idle");
      }
      if (d.stateT > 30) setState(d, "idle");
      break;
    }
    case "steal": {
      const item = w.itemById(d.targetId);
      if (!item) return setState(d, "idle");
      d.tx = item.x;
      d.ty = item.y;
      if (dd(d, item) < reach + 6) {
        const owner = item.claimed ? w.dinoById(item.claimed) : null;
        if (owner && owner !== d) {
          emote(owner, "😠", 2);
          owner.targetId = 0;
          setState(owner, "idle");
        }
        item.claimed = d.id;
        // dash off with a mouthful
        item.amount = Math.min(item.amount, 0.5);
        setState(d, "eat");
        emote(d, "😈", 1.5);
        w.discover("thief", d.x, d.y);
      } else if (d.stateT > 10) setState(d, "idle");
      break;
    }
    case "seekWater":
      if (dd(d, { x: d.tx, y: d.ty }) < 16) {
        if (d.targetId === -1 && def.diet === "piscivore") setState(d, "eat");
        else {
          setState(d, "drink");
          emote(d, "💧", 1.2);
        }
      } else if (d.stateT > 40 || d.stuckT > 3) setState(d, "idle");
      break;
    case "drink":
      d.thirst = Math.max(0, d.thirst - dt * 0.3);
      if (w.rng() < dt * 2) w.particles.spawn(P.Ripple, d.x + d.dir * sizeOf(d) * 0.5, d.y + 6, { size: 4, max: 1.2 });
      if (d.thirst <= 0.02 || d.stateT > 6) setState(d, "idle");
      break;
    case "stalk":
    case "chase": {
      if (!target || (target.kind === "human" && (target.state === "hide" || target.state === "tossed"))) {
        d.targetId = 0;
        return setState(d, "idle");
      }
      d.tx = target.x;
      d.ty = target.y;
      const dist = dd(d, target);
      // pounce when close, or when the prey has spotted us and bolts
      if (d.state === "stalk" && (dist < def.sense * 0.45 || (target.kind === "dino" && target.state === "flee"))) {
        setState(d, "chase");
        w.sfx(def.sound.kind, d.x, d.y, 0.7, def.sound.pitch);
      }
      const catchR = (sizeOf(d) + (target.kind === "dino" ? sizeOf(target) : 16)) * 0.32;
      if (d.state === "chase" && dist < catchR) startTussle(w, d, target);
      else if (d.state === "chase" && d.stateT > (target.kind === "human" && d.hunger > 0.4 ? 22 : 10)) {
        emote(d, "😮‍💨", 1.6);
        d.energy = Math.max(0, d.energy - 0.1);
        d.targetId = 0;
        setState(d, "idle");
      } else if (d.stateT > 30) setState(d, "idle");
      break;
    }
    case "tussle":
      if (w.rng() < dt * 14) w.particles.spawn(P.Dust, d.x + (w.rng() - 0.5) * sizeOf(d) * 0.8, d.y + (w.rng() - 0.5) * 10, { z: w.rng() * sizeOf(d) * 0.4, vz: 20, vx: (w.rng() - 0.5) * 60, size: 10 + sizeOf(d) / 8, max: 0.7, color: "rgba(225,210,180,0.8)" });
      if (w.rng() < dt * 3) w.particles.spawn(P.Star, d.x + (w.rng() - 0.5) * 30, d.y, { z: sizeOf(d) * 0.4, vz: 30, size: 6, max: 0.6 });
      // whoever started it decides how it ends
      if (d.lead && d.stateT > 1.4) resolveTussle(w, d);
      else if (!d.lead && d.stateT > 2.6) setState(d, "idle");
      break;
    case "flee":
      if (target && target.kind === "dino" && d.stateT > 1 && dd(d, { x: d.tx, y: d.ty }) < 40) {
        const a = awayFrom(w, d, target.x, target.y);
        d.tx = a.x;
        d.ty = a.y;
      }
      if (d.stateT > 8 || (dd(d, { x: d.tx, y: d.ty }) < 20 && d.fear < 0.5) || d.stuckT > 2) setState(d, "idle");
      break;
    case "defend": {
      const foe = w.dinoById(d.targetId);
      if (!foe || d.stateT > 6) return setState(d, "idle");
      d.tx = foe.x;
      d.ty = foe.y;
      if (dd(d, foe) < (sizeOf(d) + sizeOf(foe)) * 0.38) {
        // shove: predator goes flying (cartoon), then runs off
        w.particles.burst(P.Dust, foe.x, foe.y, 8, 70, { size: 10, max: 0.8, color: "rgba(220,200,170,0.7)" });
        w.sfx("bonk", foe.x, foe.y, 0.9);
        knock(w, foe, 1.4);
        foe.fear = 1;
        foe.hunger = Math.max(0, foe.hunger - 0.05);
        foe.targetId = 0;
        foe.x += (foe.x - d.x > 0 ? 1 : -1) * 30;
        emote(d, "😤", 2);
        setState(d, "idle");
      }
      break;
    }
    case "follow": {
      const p = d.parent ? w.dinoById(d.parent) : null;
      if (!p) return setState(d, "idle");
      d.tx = p.x - p.dir * (sizeOf(p) * 0.4 + 10);
      d.ty = p.y + 8;
      if (dd(d, { x: d.tx, y: d.ty }) < 12 || d.stateT > 12) setState(d, "idle");
      break;
    }
    case "play": {
      const pal = target && target.kind === "dino" ? target : null;
      if (!pal || d.stateT > 7) return setState(d, "idle");
      if (d.species === "pachy" && !isBaby(d)) {
        // run at each other → BONK
        d.tx = pal.x;
        d.ty = pal.y;
        if (dd(d, pal) < (sizeOf(d) + sizeOf(pal)) * 0.32) {
          w.sfx("bonk", d.x, d.y, 1);
          w.particles.spawn(P.Ring, (d.x + pal.x) / 2, (d.y + pal.y) / 2, { z: sizeOf(d) * 0.4, size: 6, max: 0.5, color: "rgba(255,255,255,0.9)" });
          knock(w, d, 1);
          knock(w, pal, 1);
          if (w.inView(d.x, d.y)) w.discover("headbutt", d.x, d.y);
        }
        break;
      }
      // babies circle and hop around each other
      const a = w.elapsed * 2 + d.id;
      d.tx = pal.x + Math.cos(a) * 30;
      d.ty = pal.y + Math.sin(a) * 18;
      d.z = Math.abs(Math.sin(d.stateT * 7)) * 6;
      if (w.rng() < dt * 0.8) w.particles.spawn(P.Heart, d.x, d.y, { z: sizeOf(d) * 0.8, vz: 20, size: 5, max: 1.2 });
      break;
    }
    case "sleep":
      if (w.rng() < dt * 0.5 && w.inView(d.x, d.y, 60)) w.particles.spawn(P.Note, d.x + d.dir * sizeOf(d) * 0.3, d.y, { z: sizeOf(d) * 0.35, vz: 14, vx: 6, size: 6 + sizeOf(d) / 25, max: 2, color: "z" });
      if (w.rng() < dt * 0.15) w.sfx("snore", d.x, d.y, 0.5, def.sound.pitch);
      const penRest = d.owner && (d.warTraining ?? 0) >= 0.35 && w.daylight < 0.3
        && w.colony.buildings.some((b) => b.kind === "pen" && b.built >= 1 && b.hp > 0 && Math.abs(d.x - b.x) < 48 && d.y < b.y && d.y > b.y - 65);
      if (d.fear > 0.5 || (!penRest && d.energy >= 1 && d.stateT > 10)) setState(d, "idle");
      else if (!def.nocturnal && w.daylight > 0.5 && d.energy > 0.6 && d.stateT > 5) setState(d, "idle");
      break;
    case "roar":
      if (d.stateT > 0.3 && d.stateT - dt <= 0.3) {
        w.sfx(def.sound.kind, d.x, d.y, 1.2, def.sound.pitch);
        w.particles.spawn(P.Ring, d.x + d.dir * sizeOf(d) * 0.5, d.y, { z: sizeOf(d) * 0.5, size: 10, max: 1, color: "rgba(255,255,255,0.7)" });
        w.shake(d.species === "trex" ? 4 : 2, 0.4);
        // everyone smaller nearby panics
        for (const o of w.dinos) {
          if (o === d || dd(o, d) > 520 || o.state === "carried") continue;
          if (sizeOf(o) < sizeOf(d) * 0.8) {
            o.fear = 1;
            o.think = Math.min(o.think, 0.05);
            if (o.state === "sleep") setState(o, "idle");
          }
        }
        for (const h of w.humans) if (dd(h, d) < 500 && h.state !== "hide") h.think = 0;
        if (d.species === "trex" && w.inView(d.x, d.y)) w.discover("roar", d.x, d.y);
      }
      if (d.stateT > 1.8) setState(d, "idle");
      break;
    case "lookUp":
    case "knocked":
      if (d.stateT > 2) setState(d, "idle");
      break;
    case "annoyed":
      d.z = Math.abs(Math.sin(d.stateT * 10)) * 4;
      if (w.rng() < dt * 6) w.particles.spawn(P.Steam, d.x + d.dir * sizeOf(d) * 0.4, d.y, { z: sizeOf(d) * 0.5, vz: 30, size: 5, max: 0.6, color: "rgba(255,255,255,0.8)" });
      if (d.stateT > 2.2) {
        d.z = 0;
        const t = wanderTarget(w, d, def);
        setState(d, "wander", t.x, t.y);
      }
      break;
    case "scratch": {
      const tree = w.plantById(d.targetId);
      if (tree) tree.shake = 0.7;
      d.anim += dt * 3;
      if (w.rng() < dt * 2 && tree) w.particles.spawn(P.Leaf, tree.x, tree.y, { z: 60, vz: -10, vx: (w.rng() - 0.5) * 30, size: 3, max: 2, color: "#7aa040" });
      if (d.stateT > 3) {
        emote(d, "😌", 1.4);
        if (w.inView(d.x, d.y)) w.discover("scratch", d.x, d.y);
        setState(d, "idle");
      }
      break;
    }
    case "shakeTree": {
      const tree = w.plantById(d.targetId);
      if (!tree) return setState(d, "idle");
      tree.shake = 1;
      if (d.stateT > 1.2) {
        shakeFruit(w, tree);
        if (w.inView(d.x, d.y)) w.discover("fruitShake", d.x, d.y);
        setState(d, "idle");
      }
      break;
    }
    case "wallow":
      d.muddy = Math.min(1, d.muddy + dt * 0.3);
      if (w.rng() < dt * 5) w.particles.spawn(P.Mud, d.x + (w.rng() - 0.5) * sizeOf(d) * 0.6, d.y, { vz: 50 + w.rng() * 40, vx: (w.rng() - 0.5) * 50, g: 180, size: 3, max: 0.8 });
      if (d.stateT > 5) {
        emote(d, "🥰", 1.5);
        if (w.inView(d.x, d.y)) w.discover("wallow", d.x, d.y);
        setState(d, "idle");
      }
      break;
    case "splash":
      d.wet = 1;
      d.z = Math.abs(Math.sin(d.stateT * 6)) * 5;
      if (w.rng() < dt * 8) w.particles.spawn(P.Splash, d.x + (w.rng() - 0.5) * sizeOf(d) * 0.6, d.y, { vz: 60 + w.rng() * 60, vx: (w.rng() - 0.5) * 60, g: 200, size: 2.5, max: 0.7 });
      if (w.rng() < dt * 1.5) w.sfx("splash", d.x, d.y, 0.5);
      if (d.stateT > 3) {
        d.z = 0;
        if (w.inView(d.x, d.y)) w.discover("splash", d.x, d.y);
        setState(d, "idle");
      }
      break;
    case "nest":
      if (dd(d, { x: d.tx, y: d.ty }) < 14 || (w.terrain.tileAt(d.x, d.y) === T.Nest && d.stateT > 3)) {
        w.addEgg(d.species, d.x - d.dir * sizeOf(d) * 0.3, d.y + 4, d.herd, d.id);
        emote(d, "❤️", 2);
        d.layT = 300 + w.rng() * 300;
        setState(d, "idle");
      } else if (d.stateT > 60 || d.stuckT > 3) {
        d.layT = 60;
        setState(d, "idle");
      }
      break;
    case "investigate":
      if (dd(d, { x: d.tx, y: d.ty }) < 20 || d.stateT > 15) {
        emote(d, pick(w.rng, ["❓", "👀", "🤔"]), 1.6);
        setState(d, "idle");
      }
      break;
    case "stuck":
      d.anim += dt * 6;
      if (w.rng() < dt * 3) w.particles.spawn(P.Mud, d.x, d.y, { vz: 30, vx: (w.rng() - 0.5) * 30, g: 150, size: 3, max: 0.6, color: "#1d1a17" });
      if (d.stateT > 4 + w.rng() * 0.5) {
        // wriggle out toward non-tar ground
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const x = d.x + Math.cos(a) * 90;
          const y = d.y + Math.sin(a) * 90;
          if (w.terrain.tileAt(x, y) !== T.Tar && walkable(w, d, x, y)) {
            d.x += Math.cos(a) * 50;
            d.y += Math.sin(a) * 50;
            break;
          }
        }
        emote(d, "😅", 1.5);
        setState(d, "idle");
      }
      break;
    case "migrate":
      if (d.x < -40 || d.y < -40 || d.x > WORLD_W + 40 || d.y > WORLD_H + 40) w.removeDino(d);
      else if (d.stuckT > 4) {
        d.tx = d.x < WORLD_W / 2 ? -80 : WORLD_W + 80;
        d.ty = d.y + (w.rng() - 0.5) * 400;
        d.stuckT = 0;
      }
      break;
    case "wander":
    case "shelter":
      if (dd(d, { x: d.tx, y: d.ty }) < 10 || d.stuckT > 1.5 || d.stateT > 30) {
        if (d.state === "shelter") {
          d.state = "idle";
          d.stateT = 0;
        } else setState(d, "idle");
      }
      break;
  }
}

/* ------------------------------------------------------------------ */
/*  Flyers (pterosaurs)                                                */
/* ------------------------------------------------------------------ */

function perchSpot(w: World, d: Dino) {
  return w.terrain.findTile(d.x, d.y, 900, (t) => t === T.Rock || t === T.Sand || t === T.Basalt || t === T.Cave, w.rng, 40);
}

function thinkFlyer(w: World, d: Dino, def: SpeciesDef) {
  const night = w.daylight < 0.3;
  if (d.state === "dive" || d.state === "steal") return;
  if (d.fear > 0.6 && d.state !== "flee") {
    const a = awayFrom(w, d, d.x + (w.rng() - 0.5), d.y + 1, 500);
    setState(d, "flee", a.x, a.y);
    return;
  }
  if (d.state === "flee" && d.fear > 0.3) return;
  // storms + night → land and rest
  if ((w.weather.storm > 0.4 || night || d.energy < 0.2) && d.state !== "perch" && d.state !== "sleep") {
    const s = perchSpot(w, d);
    if (s) {
      setState(d, "perch", s.x, s.y);
      return;
    }
  }
  if ((d.state === "perch" || d.state === "sleep") && d.z < 2) {
    if (night || w.weather.storm > 0.4) {
      if (d.state !== "sleep") setState(d, "sleep");
      return;
    }
    if (d.stateT < 12 || (d.energy < 0.9 && d.hunger < 0.5 && d.thirst < 0.5)) return;
  }
  if (d.state === "perch" && d.z > 2) return;

  if (d.hunger > 0.45) {
    // steal a fish from a cave person!
    const fisher = w.humans.find((h) => (h.carry === "fish" || h.state === "fish") && Math.hypot(h.x - d.x, h.y - d.y) < def.sense * 1.5);
    if (fisher && w.rng() < 0.6) {
      d.targetId = fisher.id;
      setState(d, "steal", fisher.x, fisher.y);
      w.sfx(def.sound.kind, d.x, d.y, 0.7, def.sound.pitch);
      return;
    }
    const fish = findMeat(w, d, def.sense, ["fish"]);
    if (fish) {
      d.targetId = fish.id;
      setState(d, "dive", fish.x, fish.y);
      return;
    }
    // flyers cover big distances: any school will do
    let best: { x: number; y: number; id: number } | null = null;
    let bd = Infinity;
    for (const s of w.schools) {
      const d2 = (s.x - d.x) ** 2 + (s.y - d.y) ** 2;
      if (d2 < bd && s.n > 0) {
        bd = d2;
        best = s;
      }
    }
    if (best && (d.species === "ptera" || bd < 1200 * 1200)) {
      d.targetId = best.id;
      setState(d, "dive", best.x, best.y);
      return;
    }
  }
  if (d.thirst > 0.5) {
    const s = w.terrain.nearestDrink(d.x, d.y);
    if (s) {
      d.targetId = 0;
      setState(d, "dive", s.x, s.y);
      return;
    }
  }
  if (d.energy < 0.5 && w.rng() < 0.3) {
    const s = perchSpot(w, d);
    if (s) {
      setState(d, "perch", s.x, s.y);
      return;
    }
  }
  if (d.state === "wander" && dd(d, { x: d.tx, y: d.ty }) > 40) return;
  // flocks drift together
  const herd = d.herd ? w.herdCenters.get(d.herd) : undefined;
  const cx = herd && herd.n > 1 ? herd.x : d.x;
  const cy = herd && herd.n > 1 ? herd.y : d.y;
  const a = w.rng() * Math.PI * 2;
  const r = 200 + w.rng() * 500;
  setState(d, "wander", Math.max(60, Math.min(WORLD_W - 60, cx + Math.cos(a) * r)), Math.max(60, Math.min(WORLD_H - 60, cy + Math.sin(a) * r)));
}

function actFlyer(w: World, d: Dino, def: SpeciesDef, dt: number) {
  let zTarget = 80 + (d.id % 5) * 12;
  switch (d.state) {
    case "perch":
    case "sleep": {
      const dist = dd(d, { x: d.tx, y: d.ty });
      zTarget = dist < 30 ? 0 : Math.min(80, dist * 0.4);
      if (d.state === "sleep" && w.rng() < dt * 0.3 && w.inView(d.x, d.y, 50)) w.particles.spawn(P.Note, d.x, d.y, { z: 14, vz: 12, vx: 5, size: 6, max: 2, color: "z" });
      if (d.state === "sleep" && w.daylight > 0.5 && w.weather.storm < 0.3) setState(d, "wander", d.x + 200, d.y - 100);
      break;
    }
    case "dive": {
      const s = w.schools.find((f) => f.id === d.targetId);
      const it = s ? null : w.itemById(d.targetId);
      if (s) {
        d.tx = s.x;
        d.ty = s.y;
      } else if (it) {
        d.tx = it.x;
        d.ty = it.y;
      }
      const dist = dd(d, { x: d.tx, y: d.ty });
      zTarget = Math.min(90, dist * 0.35);
      if (dist < 16 && d.z < 10) {
        w.particles.burst(P.Splash, d.x, d.y, 8, 60, { vz: 80, g: 220, size: 2.5, max: 0.7 });
        w.sfx("splash", d.x, d.y, 0.5);
        if (s && s.n > 0) {
          s.n--;
          d.hunger = Math.max(0, d.hunger - 0.5);
          emote(d, "🐟", 1.5);
        } else if (it) {
          d.hunger = Math.max(0, d.hunger - 0.5);
          w.removeItem(it);
          emote(d, "🐟", 1.5);
        } else {
          d.thirst = 0;
          emote(d, "💧", 1.2);
        }
        setState(d, "wander", d.x + (w.rng() - 0.5) * 600, d.y - 200 - w.rng() * 200);
      } else if (d.stateT > 20) setState(d, "wander", d.x, d.y);
      break;
    }
    case "steal": {
      const h = w.humans.find((x) => x.id === d.targetId);
      if (!h || (h.carry !== "fish" && h.state !== "fish")) return setState(d, "wander", d.x, d.y - 100);
      d.tx = h.x;
      d.ty = h.y;
      const dist = dd(d, h);
      zTarget = Math.min(80, dist * 0.35) + 10;
      if (dist < 20) {
        h.carry = null;
        h.carryN = 0;
        h.task = null;
        h.state = "idle";
        h.bubble = { text: "HEY!! My fish!", t: 2.5 };
        d.hunger = Math.max(0, d.hunger - 0.5);
        emote(d, "🐟", 2);
        w.sfx(def.sound.kind, d.x, d.y, 0.8, def.sound.pitch);
        w.discover("fishThief", d.x, d.y);
        setState(d, "wander", d.x + (w.rng() - 0.5) * 600, d.y - 300);
      } else if (d.stateT > 15) setState(d, "wander", d.x, d.y);
      break;
    }
    case "flee":
      zTarget = 140;
      if (d.stateT > 5) setState(d, "wander", d.x, d.y);
      break;
    case "lookUp":
    case "knocked":
      zTarget = d.z;
      if (d.stateT > 2) setState(d, "wander", d.x, d.y);
      break;
    case "annoyed":
      zTarget = 120;
      if (d.stateT > 1.5) setState(d, "flee", d.x + (w.rng() - 0.5) * 500, d.y - 200);
      break;
    default:
      if (d.state !== "wander") setState(d, "wander", d.x, d.y);
      if (dd(d, { x: d.tx, y: d.ty }) < 30) d.think = 0;
      // snatch flying bugs on the wing
      if (d.hunger > 0.35 && w.rng() < dt * (d.species === "dimorpho" ? 0.12 : 0.03)) {
        d.hunger = Math.max(0, d.hunger - 0.25);
        emote(d, "🦟", 1.2);
      }
  }
  // storms bounce flyers about
  if (w.weather.storm > 0.4 && d.z > 10) zTarget += Math.sin(w.elapsed * 3 + d.id) * 20;
  d.z += (zTarget - d.z) * Math.min(1, dt * 1.5);
  if (d.z < 0.5 && (d.state === "perch" || d.state === "sleep")) {
    d.z = 0;
    d.vx *= 0.8;
    d.vy *= 0.8;
  }
}

/* ------------------------------------------------------------------ */
/*  Swimmers (Mosasaurus)                                              */
/* ------------------------------------------------------------------ */

function thinkSwimmer(w: World, d: Dino, def: SpeciesDef) {
  if (d.state === "breach") return;
  if (d.hunger > 0.4) {
    let best: { x: number; y: number; id: number } | null = null;
    let bd = (def.sense * 2) ** 2;
    for (const s of w.schools) {
      const d2 = (s.x - d.x) ** 2 + (s.y - d.y) ** 2;
      if (d2 < bd && s.n > 0) {
        bd = d2;
        best = s;
      }
    }
    if (best) {
      d.targetId = best.id;
      setState(d, "chase", best.x, best.y);
      return;
    }
  }
  // spook dinos wading at the edge
  const wader = w.creatureHash.nearest(d.x, d.y, 160, (e) => e.kind === "dino" && sp((e as Dino).species).move === "walk");
  if (wader && wader.kind === "dino" && w.rng() < 0.3) {
    breach(w, d);
    wader.fear = 1;
    wader.think = 0;
    return;
  }
  if (w.rng() < 0.08) {
    breach(w, d);
    return;
  }
  if (d.state === "wander" && dd(d, { x: d.tx, y: d.ty }) > 30 && d.stuckT < 1) return;
  const t = w.terrain.findTile(d.x, d.y, 600, (t) => t === T.Deep, w.rng, 30);
  if (t) setState(d, "wander", t.x, t.y);
}

function breach(w: World, d: Dino) {
  setState(d, "breach", d.x, d.y);
  w.sfx("splash", d.x, d.y, 1.2);
  w.particles.burst(P.Splash, d.x, d.y, 18, 90, { vz: 120, g: 220, size: 4, max: 1 });
  w.particles.spawn(P.Ring, d.x, d.y, { size: 20, max: 1.2, color: "rgba(255,255,255,0.8)" });
  if (w.inView(d.x, d.y)) w.discover("breach", d.x, d.y);
}

function actSwimmer(w: World, d: Dino, dt: number) {
  switch (d.state) {
    case "breach":
      d.z = Math.max(0, Math.sin((d.stateT / 1.6) * Math.PI) * 60);
      if (d.stateT > 1.6) {
        d.z = 0;
        w.particles.burst(P.Splash, d.x, d.y, 16, 90, { vz: 100, g: 220, size: 4, max: 1 });
        w.sfx("splash", d.x, d.y, 1);
        setState(d, "wander", d.x, d.y);
      }
      break;
    case "chase": {
      const s = w.schools.find((f) => f.id === d.targetId);
      if (!s || s.n <= 0) return setState(d, "wander", d.x, d.y);
      d.tx = s.x;
      d.ty = s.y;
      if (dd(d, s) < 110) {
        s.n = Math.max(0, s.n - 3);
        d.hunger = Math.max(0, d.hunger - 0.5);
        w.particles.burst(P.Splash, d.x, d.y, 10, 60, { vz: 70, g: 200, size: 3, max: 0.7 });
        w.sfx("chomp", d.x, d.y, 0.8);
        setState(d, "wander", d.x, d.y);
      } else if (d.stateT > 20) setState(d, "wander", d.x, d.y);
      break;
    }
    case "lookUp":
    case "knocked":
    case "annoyed":
      if (d.stateT > 2) setState(d, "wander", d.x, d.y);
      break;
    default:
      if (d.state !== "wander") setState(d, "wander", d.x, d.y);
      if (w.rng() < dt * 0.5) w.particles.spawn(P.Ripple, d.x - d.dir * 40, d.y, { size: 6, max: 1.4 });
  }
}

/* ------------------------------------------------------------------ */
/*  Entry points                                                       */
/* ------------------------------------------------------------------ */

export function thinkDino(w: World, d: Dino) {
  const def = sp(d.species);
  const onScreen = w.inView(d.x, d.y, 300);
  // brains far from the camera tick slower (bodies still move every frame)
  const far = !w.inView(d.x, d.y, 1400);
  d.think = (onScreen ? 0.35 : far ? 1.8 : 1.1) + w.rng() * 0.35;
  if (LOCKED.has(d.state)) return;
  if (d.health <= 0) {
    setState(d, "faint", d.x, d.y);
    emote(d, "😵", 3);
    return;
  }
  if (d.stuckT > 3) {
    d.stuckT = 0;
    const t = wanderTarget(w, d, def);
    setState(d, def.move === "walk" ? "wander" : d.state, t.x, t.y);
    return;
  }
  if (d.raider) {
    thinkRaider(w, d);
    return;
  }
  if (d.rider) return;
  if (d.owner && (d.warTraining ?? 0) >= 0.35 && !isBaby(d)) {
    const foe = warTarget(w, d, 260);
    if (foe) {
      d.targetId = foe.id;
      setState(d, "war", foe.x, foe.y);
      return;
    }
  }
  if (def.move === "fly") thinkFlyer(w, d, def);
  else if (def.move === "swim") thinkSwimmer(w, d, def);
  else thinkWalker(w, d, def);
}

function actFaint(w: World, d: Dino) {
  if (d.stateT <= 2) return;
  // died in fire or lava: a charred skeleton (cartoon, not gory); otherwise a fossil for later
  if (d.burn < 4) {
    makeCarcass(w, d, { burnt: true });
    w.particles.burst(P.Smoke, d.x, d.y, 8, 30, { vz: 30, size: 10, max: 1.4, color: "rgba(60,55,50,0.6)" });
    w.removeDino(d);
    return;
  }
  w.addItem("fossil", d.x, d.y, { species: d.species });
  w.particles.burst(P.Poof, d.x, d.y, 8, 40, { size: 12, max: 1, color: "rgba(220,215,200,0.9)" });
  w.removeDino(d);
  if (!w.flags.has("fossilFact")) {
    w.flags.add("fossilFact");
    w.toast("🦴", `${d.name} the ${sp(d.species).nick} has gone to sleep forever.`, d.x, d.y, FACTS.fossil);
  }
}

export function actDino(w: World, d: Dino, dt: number) {
  const def = sp(d.species);
  if (d.state === "faint") {
    d.z = Math.max(0, d.z - dt * 60);
    return actFaint(w, d);
  }
  actWarDino(w, d, dt);
  d.roarT -= dt;
  d.layT -= dt;
  if (d.state !== "carried" && d.state !== "sleep" && def.move === "walk") {
    d.poopT -= dt;
    if (d.poopT <= 0) {
      d.poopT = 90 + w.rng() * 150;
      w.addItem("poop", d.x - d.dir * sizeOf(d) * 0.4, d.y + 2, { amount: Math.min(1.5, 0.4 + sizeOf(d) / 120) });
      emote(d, "💩", 1.4);
      w.sfx("plop", d.x, d.y, 0.5);
      if (w.inView(d.x, d.y)) w.discover("poop", d.x, d.y);
    }
  }
  if (d.raider && actRaider(w, d, dt)) return;
  if (def.move === "fly") actFlyer(w, d, def, dt);
  else if (def.move === "swim") actSwimmer(w, d, dt);
  else actWalker(w, d, def, dt);
}

/** Player tapped a dinosaur. Too many taps → grumpy. */
export function pokeDino(w: World, d: Dino) {
  const now = w.elapsed;
  d.taps = d.taps.filter((t) => now - t < 3);
  d.taps.push(now);
  const def = sp(d.species);
  if (d.state === "sleep") {
    w.discover("snore", d.x, d.y);
    if (d.taps.length < 3) return;
  }
  if (d.taps.length >= 4 && d.state !== "annoyed") {
    d.taps = [];
    setState(d, "annoyed", d.x, d.y);
    emote(d, "😤", 2.4);
    w.sfx(def.sound.kind, d.x, d.y, 1, def.sound.pitch * 1.1);
    w.discover("annoyed", d.x, d.y);
    return;
  }
  if (!LOCKED.has(d.state) && d.state !== "flee" && def.move === "walk") {
    // a little hello: look at the camera
    emote(d, pick(w.rng, ["👋", "❗", "🙂", "❓"]), 1.2);
    w.sfx(def.sound.kind, d.x, d.y, 0.45, def.sound.pitch * 1.25);
  }
}

export function lookUp(d: Dino) {
  if (d.state === "carried" || d.state === "faint" || d.state === "tussle") return;
  setState(d, "lookUp", d.x, d.y);
  emote(d, "❗", 2.5);
}

