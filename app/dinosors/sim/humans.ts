/* ------------------------------------------------------------------ */
/*  Cave people: a small state machine per person. They gather for     */
/*  the camp's current goal, fish, build, sit by the fire, hide from   */
/*  dinosaurs and storms, and sleep in the cave at night.              */
/* ------------------------------------------------------------------ */
import { CAVE_NAMES, SHELTER_STAGES } from "../data/facts";
import { sp } from "../data/species";
import { sizeOf } from "./dinos";
import { P } from "./particles";
import { clamp, pick } from "./rng";
import { LM, groundSpeed, isWalkTile } from "./terrain";
import { T, TILE, type Dino, type Human, type HumanState, type Plant, type Resource } from "./types";
import type { World } from "./world";
import { TALL } from "./plants";

const HAIR = ["#3b2416", "#5a3a22", "#1f1a17", "#8a4b23", "#c58f4a"];
const SKIN = ["#e0b48a", "#c98e62", "#a86b45", "#7c4c2f", "#f0c9a0"];
const FUR = ["#8a5a2b", "#a87a45", "#6e4a2a", "#b8956a", "#5b4636"];

export function addHuman(w: World, x: number, y: number, child = false, o: Partial<Human> = {}): Human {
  const h: Human = {
    id: w.nextId(),
    kind: "human",
    name: pick(w.rng, CAVE_NAMES),
    child,
    x,
    y,
    z: 0,
    vz: 0,
    vx: 0,
    vy: 0,
    dir: 1,
    state: "idle",
    stateT: 0,
    think: w.rng(),
    tx: x,
    ty: y,
    targetId: 0,
    task: null,
    carry: null,
    carryN: 0,
    anim: w.rng() * 10,
    bubble: null,
    hair: pick(w.rng, HAIR),
    skin: pick(w.rng, SKIN),
    fur: pick(w.rng, FUR),
    energy: 0.8,
    hunger: 0.2,
    fear: 0,
    ...o,
  };
  w.humans.push(h);
  return h;
}

export function say(h: Human, text: string, t = 2.2) {
  h.bubble = { text, t };
}

function go(h: Human, s: HumanState, x: number, y: number) {
  if (h.state !== s) h.stateT = 0;
  h.state = s;
  h.tx = x;
  h.ty = y;
}

const WALKING = new Set<HumanState>(["walk", "carry", "flee", "explore"]);

function walkOk(w: World, x: number, y: number) {
  const t = w.terrain.tileAt(x, y);
  if (!isWalkTile(t) || t === T.Tar) return false;
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  return w.lava.heatAt(tx, ty) < 0.1 && w.fire.at(tx, ty) < 0.2;
}

function move(w: World, h: Human, dt: number) {
  const dx = h.tx - h.x;
  const dy = h.ty - h.y;
  const d = Math.hypot(dx, dy);
  const base = h.child ? 30 : 36;
  const speed = (h.state === "flee" ? base * 2.3 : base) * groundSpeed(w.terrain.tileAt(h.x, h.y));
  if (d < 3) {
    h.vx = 0;
    h.vy = 0;
    return true;
  }
  let a = Math.atan2(dy, dx);
  const look = 14;
  if (!walkOk(w, h.x + Math.cos(a) * look, h.y + Math.sin(a) * look)) {
    for (const off of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
      if (walkOk(w, h.x + Math.cos(a + off) * look, h.y + Math.sin(a + off) * look)) {
        a += off;
        break;
      }
    }
  }
  const s = Math.min(speed, d / dt);
  h.vx = Math.cos(a) * s;
  h.vy = Math.sin(a) * s;
  const nx = h.x + h.vx * dt;
  const ny = h.y + h.vy * dt;
  if (walkOk(w, nx, ny) || !walkOk(w, h.x, h.y)) {
    h.x = nx;
    h.y = ny;
  }
  if (Math.abs(h.vx) > 3) h.dir = h.vx > 0 ? 1 : -1;
  h.anim += (s * dt) / 7;
  return false;
}

function dangerNear(w: World, h: Human): Dino | null {
  let worst: Dino | null = null;
  let best = Infinity;
  w.creatureHash.each(h.x, h.y, 230, (e, d2) => {
    if (e.kind !== "dino") return;
    const def = sp(e.species);
    if (def.move === "swim" || (def.move === "fly" && e.z > 10)) return;
    if (e.state === "sleep" || e.state === "carried" || e.state === "knocked") return;
    const scary = (def.diet !== "herbivore" && sizeOf(e) > 30) || (sizeOf(e) > 70 && (e.state === "flee" || e.state === "defend" || e.state === "annoyed"));
    const r = def.diet !== "herbivore" ? 230 : 120;
    if (scary && d2 < r * r && d2 < best) {
      best = d2;
      worst = e;
    }
  });
  return worst;
}

function nearPlant(w: World, x: number, y: number, r: number, ok: (p: Plant) => boolean) {
  return w.plantHash.nearest(x, y, r, ok);
}

/** Find somewhere to collect a resource. */
function sourceFor(w: World, h: Human, r: Resource): { x: number; y: number; id: number } | null {
  const cx = w.camp.x;
  const cy = w.camp.y;
  switch (r) {
    case "stick":
    case "wood": {
      const p = nearPlant(w, cx, cy, 900, (p) => TALL.has(p.kind) && !p.stump && p.burnt < 0.5 && (r === "stick" || p.size > 0.6));
      return p ? { x: p.x + (p.x > cx ? -16 : 16), y: p.y + 6, id: p.id } : null;
    }
    case "leaves":
    case "berries": {
      const p = nearPlant(w, cx, cy, 900, (p) => (p.kind === "bush" || p.kind === "fern" || p.kind === "cycad") && p.food > 0.3 && !p.stump);
      return p ? { x: p.x + 14, y: p.y + 4, id: p.id } : null;
    }
    case "stone": {
      const b = w.props.find((p) => p.kind === "boulder" && Math.hypot(p.x - cx, p.y - cy) < 900);
      if (b) return { x: b.x + 18, y: b.y + 6, id: b.id };
      const t = w.terrain.findTile(cx, cy - 40, 700, (t) => t === T.Rock || t === T.Basalt, w.rng, 80);
      return t ? { ...t, id: 0 } : null;
    }
    case "grass": {
      const t = w.terrain.findTile(cx, cy, 500, (t) => t === T.Grass, w.rng, 60);
      return t ? { ...t, id: 0 } : null;
    }
    case "fish": {
      const s = w.terrain.nearestDrink(cx + 300, cy + 40, 1400);
      return s ? { ...s, id: 0 } : null;
    }
  }
}

function shelterSpot(w: World): { x: number; y: number } {
  const s = w.shelters.find((s) => s.stage >= SHELTER_STAGES.length);
  if (s) return { x: s.x, y: s.y + 6 };
  return { x: w.camp.caveX, y: w.camp.caveY };
}

function think(w: World, h: Human) {
  const camp = w.camp;
  h.think = 0.4 + w.rng() * 0.5;
  if (h.state === "tossed" || h.state === "lookUp" || h.state === "celebrate") return;
  if (h.state === "craft" && camp.crafting?.by === h.id) return;

  // 1. danger → run for the cave (or stand with spears by the fire)
  const threat = dangerNear(w, h);
  if (threat) {
    const def = sp(threat.species);
    const brave = !h.child && camp.learned.has("spear") && Math.hypot(h.x - camp.x, h.y - camp.y) < 220 && def.size < 110;
    if (brave) {
      say(h, pick(w.rng, ["Shoo!", "Go away!", "Hyaaa!"]));
      threat.fear = Math.min(1, threat.fear + 0.5);
      if (w.rng() < 0.5) w.scare(threat, h.x, h.y);
      go(h, "idle", h.x, h.y);
      h.dir = threat.x > h.x ? 1 : -1;
      return;
    }
    if (h.state !== "flee" && h.state !== "hide") {
      say(h, pick(w.rng, ["Eek!", "RUN!", "Dino!!", "Aaah!"]));
      w.sfx("yelp", h.x, h.y, 0.6);
      if (h.carry && h.carry !== "fish") {
        h.carry = null;
        h.carryN = 0;
      }
    }
    const s = shelterSpot(w);
    go(h, "flee", s.x, s.y);
    return;
  }

  // 2. storms + night → shelter / cave
  const night = w.daylight < 0.25;
  if (w.weather.rain > 0.55 || w.weather.storm > 0.5 || (night && h.energy < 0.6)) {
    if (h.state === "hide" || h.state === "sleep") return;
    const s = shelterSpot(w);
    if (Math.hypot(h.x - s.x, h.y - s.y) < 14) {
      go(h, night ? "sleep" : "hide", h.x, h.y);
      if (w.weather.storm > 0.5 && w.rng() < 0.3) say(h, "Brrr!");
    } else go(h, "walk", s.x, s.y);
    return;
  }
  if (h.state === "hide" && h.stateT < 4) return;
  if (h.state === "sleep") {
    if (!night || h.energy > 0.95) go(h, "idle", h.x, h.y + 20);
    else return;
  }
  if (h.state === "flee" || h.state === "hide") go(h, "walk", camp.x + (w.rng() - 0.5) * 120, camp.y + (w.rng() - 0.5) * 60);

  // busy with something that finishes on its own
  if (h.state === "gather" || h.state === "fish" || h.state === "build" || h.state === "eat") return;
  if (h.state === "carry" || h.state === "walk" || h.state === "explore") {
    if (Math.hypot(h.tx - h.x, h.ty - h.y) > 6) return;
  }

  // 3. hungry → eat from the stockpile
  if (h.hunger > 0.6 && camp.stock.fish + camp.stock.berries > 0) {
    if (Math.hypot(h.x - camp.pileX, h.y - camp.pileY) < 20) go(h, "eat", h.x, h.y);
    else go(h, "walk", camp.pileX - 14, camp.pileY + 8);
    return;
  }

  // 4. evening by the fire
  const fire = w.campfires.find((f) => f.lit);
  if (fire && (w.daylight < 0.45 || (h.child && w.rng() < 0.2))) {
    const a = (h.id * 2.4) % (Math.PI * 2);
    const sx = fire.x + Math.cos(a) * 34;
    const sy = fire.y + Math.sin(a) * 18;
    if (Math.hypot(h.x - sx, h.y - sy) < 6) go(h, "sitFire", sx, sy);
    else go(h, "walk", sx, sy);
    return;
  }

  if (h.child) {
    const r = w.rng();
    if (r < 0.35) go(h, "walk", camp.x + (w.rng() - 0.5) * 220, camp.y + (w.rng() - 0.5) * 120);
    else if (r < 0.5) go(h, "celebrate", h.x, h.y);
    else if (r < 0.6) say(h, pick(w.rng, ["Dino!", "Hee hee", "Look!", "Rawr!"]));
    else go(h, "idle", h.x, h.y);
    return;
  }

  // 5. craft when the goal is ready
  if (camp.ready() && !camp.crafting && !w.humans.some((o) => o !== h && o.task === "craft")) {
    h.task = "craft";
    go(h, "walk", camp.craftX + 12, camp.craftY);
    return;
  }

  // 6. build the shelter stage if the materials are in
  const site = camp.activeShelter(w);
  if (site) {
    const st = SHELTER_STAGES[site.stage];
    if (site.have >= st.n && !w.humans.some((o) => o !== h && o.task === "build")) {
      h.task = "build";
      go(h, "walk", site.x + 26, site.y + 6);
      return;
    }
    // carry materials from the pile to the site
    if (site.have < st.n && camp.stock[st.need] > 0 && !h.carry) {
      const n = Math.min(camp.stock[st.need], camp.learned.has("basket") ? 2 : 1);
      camp.stock[st.need] -= n;
      h.carry = st.need;
      h.carryN = n;
      go(h, "carry", site.x + 20, site.y + 4);
      return;
    }
  }

  // 7. gather what the camp needs most (or fish / sticks for the fire)
  let need = camp.missing(w);
  if (!need) {
    const r = w.rng();
    if (r < 0.25) need = "fish";
    else if (r < 0.35 && camp.stock.stick < 8) need = "stick";
    else if (r < 0.45) need = "berries";
  }
  if (need) {
    const src = sourceFor(w, h, need);
    if (src) {
      h.task = need;
      h.targetId = src.id;
      go(h, "walk", src.x, src.y);
      return;
    }
  }

  // 8. leisure: chat, explore, wander
  const r = w.rng();
  if (r < 0.2) {
    const friend = w.humans.find((o) => o !== h && Math.hypot(o.x - h.x, o.y - h.y) < 80 && (o.state === "idle" || o.state === "talk"));
    if (friend) {
      go(h, "talk", h.x, h.y);
      h.dir = friend.x > h.x ? 1 : -1;
      say(h, pick(w.rng, ["Ooga?", "Booga!", "Ugh.", "Mmm, fire.", "Big dino!", "Rock good.", "Hungry…"]));
      w.sfx("babble", h.x, h.y, 0.5);
      return;
    }
  }
  if (r < 0.28) {
    const lm = pick(w.rng, [LM.lake, LM.beach, LM.feeding, LM.waterfall]);
    go(h, "explore", lm.x * TILE + (w.rng() - 0.5) * 200, lm.y * TILE + 120 + (w.rng() - 0.5) * 100);
    return;
  }
  go(h, "walk", camp.x + (w.rng() - 0.5) * 260, camp.y + (w.rng() - 0.5) * 140);
}

function arrive(w: World, h: Human) {
  const camp = w.camp;
  if (h.state === "carry") {
    const site = camp.activeShelter(w);
    if (site && h.carry && Math.hypot(h.x - site.x, h.y - site.y) < 50) {
      const used = camp.deliverToShelter(w, site, h.carry, h.carryN);
      const left = h.carryN - used;
      if (left > 0) camp.stock[h.carry] += left;
    } else if (h.carry) {
      camp.stock[h.carry] += h.carryN;
      if (h.carry === "fish") say(h, "Fish!");
    }
    h.carry = null;
    h.carryN = 0;
    h.task = null;
    go(h, "idle", h.x, h.y);
    return;
  }
  if (h.state === "walk") {
    if (h.task === "craft") {
      if (camp.startCraft(w, h.id)) {
        go(h, "craft", h.x, h.y);
        h.dir = -1;
        say(h, "Hmm…", 3);
      } else h.task = null;
      return;
    }
    if (h.task === "build") {
      go(h, "build", h.x, h.y);
      h.dir = -1;
      return;
    }
    if (h.task === "fish") {
      go(h, "fish", h.x, h.y);
      return;
    }
    if (h.task === null) {
      go(h, "idle", h.x, h.y);
      return;
    }
    go(h, "gather", h.x, h.y);
    return;
  }
  if (h.state === "explore") {
    go(h, "idle", h.x, h.y);
    if (w.rng() < 0.5) say(h, pick(w.rng, ["Ooh!", "Pretty!", "Water!", "Wow."]));
  }
}

function finishGather(w: World, h: Human) {
  const r = h.task as Resource;
  const basket = w.camp.learned.has("basket");
  const plant = h.targetId ? w.plants.find((p) => p.id === h.targetId) : undefined;
  if (r === "wood") {
    if (!w.camp.learned.has("axe")) {
      h.task = null;
      return;
    }
    if (plant && !plant.stump) {
      plant.stump = true;
      plant.food = 0;
      plant.fruit = 0;
      plant.shake = 1;
      w.sfx("timber", plant.x, plant.y, 0.8);
      for (let i = 0; i < 6; i++) w.particles.spawn(P.Leaf, plant.x, plant.y, { z: 30 + w.rng() * 50, vx: (w.rng() - 0.5) * 60, vz: 20, g: 40, size: 4, max: 1.6, color: "#6b8f3c" });
    }
  } else if (plant && (r === "leaves" || r === "berries")) {
    plant.food = Math.max(0, plant.food - 0.3);
    plant.shake = 0.6;
  } else if (plant && r === "stick") plant.shake = 0.5;
  h.carry = r;
  h.carryN = r === "wood" ? 1 + (basket ? 1 : 0) : basket ? 2 : 1;
  h.task = null;
  go(h, "carry", w.camp.pileX - 10 + (w.rng() - 0.5) * 20, w.camp.pileY + 10);
}

export function updateHuman(w: World, h: Human, dt: number) {
  h.stateT += dt;
  h.hunger = clamp(h.hunger + dt * 0.0025, 0, 1);
  h.energy = clamp(h.energy + (h.state === "sleep" ? dt * 0.03 : -dt * 0.002), 0, 1);
  h.fear = Math.max(0, h.fear - dt * 0.2);
  if (h.bubble) {
    h.bubble.t -= dt;
    if (h.bubble.t <= 0) h.bubble = null;
  }

  if (h.state === "tossed") {
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.z += h.vz * dt;
    h.vz -= 420 * dt;
    if (!walkOk(w, h.x, h.y) && h.z < 20) {
      h.vx *= -0.5;
      h.vy *= -0.5;
    }
    if (h.z <= 0 && h.vz < 0) {
      h.z = 0;
      w.particles.burst(P.Dust, h.x, h.y, 6, 40, { size: 6, max: 0.8, color: "rgba(170,150,110,0.6)" });
      w.particles.spawn(P.Star, h.x, h.y, { z: 22, size: 6, max: 1.8 });
      say(h, "Ow ow ow!");
      const s = shelterSpot(w);
      go(h, "flee", s.x, s.y);
    }
    return;
  }
  if (h.state === "lookUp") {
    if (h.stateT > 3.5) go(h, "idle", h.x, h.y);
    return;
  }

  h.think -= dt;
  if (h.think <= 0) think(w, h);

  switch (h.state) {
    case "walk":
    case "carry":
    case "flee":
    case "explore":
      if (move(w, h, dt)) {
        if (h.state === "flee") {
          go(h, "hide", h.x, h.y);
          break;
        }
        arrive(w, h);
      } else if (h.stateT > 40) go(h, "idle", h.x, h.y);
      break;
    case "gather":
      h.anim += dt * 4;
      if (h.stateT > (h.task === "wood" ? 4 : 2.2)) finishGather(w, h);
      else if (w.rng() < dt * 2 && w.inView(h.x, h.y, 50)) {
        w.particles.spawn(h.task === "wood" ? P.Crumb : P.Leaf, h.x + h.dir * 8, h.y, { z: 10, vz: 30, vx: (w.rng() - 0.5) * 30, g: 120, size: 2.5, max: 0.6, color: h.task === "stone" ? "#9a958c" : "#7a9a4a" });
        if (h.task === "wood") w.sfx("chop", h.x, h.y, 0.5);
      }
      break;
    case "fish": {
      const dur = w.camp.learned.has("fishing") ? 5 : 11;
      if (h.stateT > dur) {
        const lucky = w.camp.learned.has("fishing") || w.rng() < 0.55;
        if (lucky) {
          h.carry = "fish";
          h.carryN = w.camp.learned.has("basket") ? 2 : 1;
          say(h, "Got one!");
          w.particles.burst(P.Splash, h.x + h.dir * 14, h.y - 4, 5, 40, { vz: 60, g: 200, size: 2, max: 0.6 });
          w.sfx("splash", h.x, h.y, 0.5);
        } else say(h, "Nope.");
        h.task = null;
        if (h.carry) go(h, "carry", w.camp.pileX, w.camp.pileY + 10);
        else go(h, "idle", h.x, h.y);
      }
      break;
    }
    case "build": {
      const site = w.camp.activeShelter(w);
      if (!site) {
        h.task = null;
        go(h, "idle", h.x, h.y);
        break;
      }
      if (w.rng() < dt * 6) {
        w.particles.spawn(P.Crumb, site.x + (w.rng() - 0.5) * 30, site.y - 10, { z: 20, vz: 40, vx: (w.rng() - 0.5) * 40, g: 160, size: 2, max: 0.5, color: "#a07a4a" });
        if (w.rng() < 0.4) w.sfx("knock", site.x, site.y, 0.4);
      }
      if (h.stateT > 4) {
        w.camp.advanceShelter(w, site);
        h.task = null;
        go(h, "idle", h.x, h.y);
      }
      break;
    }
    case "craft":
      if (w.camp.crafting?.by !== h.id) {
        h.task = null;
        go(h, "idle", h.x, h.y);
      }
      break;
    case "eat":
      if (h.stateT > 2.5) {
        const camp = w.camp;
        const fish = camp.stock.fish > 0;
        if (fish) camp.stock.fish--;
        else if (camp.stock.berries > 0) camp.stock.berries--;
        h.hunger = 0;
        const cooked = fish && w.campfires.some((f) => f.lit);
        say(h, cooked ? "Yum! Cooked!" : "Munch munch");
        go(h, "idle", h.x, h.y);
      }
      break;
    case "celebrate":
      h.z = Math.abs(Math.sin(h.stateT * 8)) * 8;
      if (h.stateT > 3) {
        h.z = 0;
        go(h, "idle", h.x, h.y);
      }
      break;
    case "talk":
      if (h.stateT > 3) go(h, "idle", h.x, h.y);
      break;
    case "sitFire":
      if (w.rng() < dt * 0.05) say(h, pick(w.rng, ["Warm…", "Mmm.", "Story time!", "Stars!"]));
      break;
    case "sleep":
      if (w.rng() < dt * 0.3 && w.inView(h.x, h.y, 50)) w.particles.spawn(P.Note, h.x, h.y, { z: 16, vz: 12, vx: 6, size: 8, max: 1.6, color: "z" });
      break;
  }
}

/** A predator caught a cave person: cartoon yeet, nobody gets hurt. */
export function toss(w: World, h: Human, fromX: number) {
  const dir = h.x >= fromX ? 1 : -1;
  h.state = "tossed";
  h.stateT = 0;
  h.vx = dir * (120 + w.rng() * 80);
  h.vy = (w.rng() - 0.5) * 60;
  h.vz = 240 + w.rng() * 80;
  h.z = 4;
  h.carry = null;
  h.task = null;
  say(h, "WAAAH!");
  w.sfx("yelp", h.x, h.y, 0.9);
  w.discover("tossed", h.x, h.y);
}

export function setHumanState(h: Human, s: HumanState) {
  go(h, s, h.x, h.y);
}
