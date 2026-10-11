/* ------------------------------------------------------------------ */
/*  Player orders → tasks.                                             */
/*                                                                     */
/*  Select people, click something in the world, and `inferCommand`    */
/*  works out what that means (tree → chop, rock → mine, water →       */
/*  fetch, dino → hunt / befriend / ride, wall → build / repair /      */
/*  defend, hurt friend → heal …). `issue` turns it into a Task on the */
/*  board with those people assigned.                                  */
/*                                                                     */
/*  Each person runs their part through `taskThink`. When they finish  */
/*  they look for other unfinished player tasks to help with, and only */
/*  go back to running themselves (auto mode) when there are none.     */
/* ------------------------------------------------------------------ */
import { NODES, RIDEABLE, TAMEABLE, WEAPON_BY_ID } from "../data/colony";
import { sp } from "../data/species";
import { deliver, siteByKey, siteKey, siteOnTop, sites, wallMaxHp, wallStretch, work, type Site } from "./build";
import { isBaby, setState, emote, sizeOf } from "./dinos";
import { go, say, sourceFor } from "./humans";
import { condition } from "./injury";
import { carcassStage, cutTime, harvesters, hasYield, STAGE_LABEL } from "./carcass";
import { RES_INFO } from "../data/colony";
import { TALL } from "./plants";
import { pick } from "./rng";
import { isWaterTile } from "./terrain";
import { tileOf } from "./nav";
import { MAP_W, T, TILE, type Brute, type Dino, type Dragon, type Human, type Item, type Plant, type Resource, type WeaponKind } from "./types";
import type { World } from "./world";

export type TaskKind =
  | "chop"
  | "mine"
  | "forage"
  | "water"
  | "fish"
  | "dig"
  | "build"
  | "repair"
  | "hunt"
  | "heal"
  | "tame"
  | "train"
  | "ride"
  | "dismount"
  | "guard"
  | "defend"
  | "operate"
  | "move"
  | "haul"
  | "tend"
  | "rest"
  | "farm"
  | "smith"
  | "douse"
  | "butcher"
  | "raid";

export interface Task {
  id: number;
  kind: TaskKind;
  icon: string;
  label: string;
  x: number;
  y: number;
  /** plant / node / dino / human / item / structure id (0 = a place) */
  target: number;
  /** resource this harvest brings home */
  res?: Resource;
  /** construction: the site keys this order covers */
  group?: string[];
  /** build orders: centres (x, y pairs) of every site this order has taken on, so it can spread to the next blueprint along */
  area?: number[];
  /** build orders: how many times in a row the crew found nothing they could do yet */
  stall?: number;
  /** stand on the wall walkway */
  top?: boolean;
  weapon?: WeaponKind;
  people: number[];
  done: number[];
  /** other idle people may pitch in */
  open: boolean;
  t: number;
}

export interface Command {
  kind: TaskKind;
  icon: string;
  label: string;
  x: number;
  y: number;
  target: number;
  res?: Resource;
  group?: string[];
  top?: boolean;
  /** weapon kinds to choose from (hunting / fighting) */
  weapons?: WeaponKind[];
  /** other things this click could mean */
  alts?: Command[];
}

const PER_PERSON = new Set<TaskKind>(["chop", "mine", "forage", "water", "fish", "dig", "move", "tend", "rest", "haul"]);

export class TaskBoard {
  list: Task[] = [];

  get(id: number) {
    return id ? this.list.find((t) => t.id === id) ?? null : null;
  }

  add(w: World, c: Command, people: Human[], weapon?: WeaponKind): Task {
    const t: Task = {
      id: w.nextId(),
      kind: c.kind,
      icon: c.icon,
      label: c.label,
      x: c.x,
      y: c.y,
      target: c.target,
      res: c.res,
      group: c.group,
      top: c.top,
      weapon,
      people: people.map((p) => p.id),
      done: [],
      open: c.kind === "build" || c.kind === "repair" || c.kind === "douse" || c.kind === "butcher",
      t: 0,
    };
    this.list.push(t);
    return t;
  }

  remove(t: Task) {
    const i = this.list.indexOf(t);
    if (i >= 0) this.list.splice(i, 1);
  }

  update(w: World, dt: number) {
    for (const t of [...this.list]) {
      t.t += dt;
      // drop people who left (gone, joined another task)
      t.people = t.people.filter((id) => w.humans.some((h) => h.id === id && h.taskId === t.id));
      if (!t.people.length && !t.open) this.remove(t);
      else if (!t.people.length && t.t > 240) this.remove(t);
      else {
        // build orders keep picking up blueprints next to what they're building (new ones too)
        if (t.kind === "build" && (Math.floor(t.t) !== Math.floor(t.t - dt) || !taskAlive(w, t))) growBuild(w, t);
        if (!taskAlive(w, t)) this.finish(w, t);
      }
    }
  }

  /** The whole task is done: release everyone onto their next job. */
  finish(w: World, t: Task) {
    this.remove(t);
    for (const id of t.people) {
      const h = w.humans.find((x) => x.id === id);
      if (h && h.taskId === t.id) release(w, h);
    }
  }

  clear() {
    this.list = [];
  }
}

/* ------------------------------------------------------------------ */
/*  Inference: what does clicking (x, y) mean for these people?        */
/* ------------------------------------------------------------------ */

export interface Picked {
  dino: Dino | null;
  human: Human | null;
  dragon: Dragon | null;
  brute?: Brute | null;
}

function armoryKinds(w: World, people: Human[]): WeaponKind[] {
  const kinds = new Set<WeaponKind>();
  for (const [id, n] of Object.entries(w.colony.armory)) if (n > 0 && WEAPON_BY_ID[id]) kinds.add(WEAPON_BY_ID[id].kind);
  for (const h of people) {
    const wp = h.gear.weapon ? WEAPON_BY_ID[h.gear.weapon] : null;
    if (wp) kinds.add(wp.kind);
  }
  const L = w.camp.learned;
  if (L.has("spear")) kinds.add("spear");
  if (L.has("bow") || L.has("crossbow")) kinds.add("bow");
  if (L.has("axe") && kinds.size > 0) kinds.add("axe");
  return Array.from(kinds);
}

export function inferCommand(w: World, people: Human[], x: number, y: number, picked: Picked): Command | null {
  if (!people.length) return null;
  if (w.plantsDirty) {
    w.plantHash.rebuild(w.plants);
    w.plantsDirty = false;
  }
  const adults = people.filter((p) => !p.child);
  const L = w.camp.learned;
  const kinds = armoryKinds(w, people);
  const armed = kinds.length > 0 && adults.length > 0;

  if (picked.brute) {
    const b = picked.brute;
    if (!armed) return { kind: "move", icon: "😬", label: "Nobody has a weapon to fight a Neanderthal!", x: b.x, y: b.y, target: 0 };
    return { kind: "hunt", icon: "🪓", label: `Fight ${b.name} the Neanderthal`, x: b.x, y: b.y, target: b.id, weapons: kinds };
  }
  if (picked.dragon) {
    const d = picked.dragon;
    return { kind: "hunt", icon: "🐉", label: `Attack ${d.name}!`, x: d.x, y: d.y, target: d.id, weapons: kinds.filter((k) => k === "bow" || k === "spear") };
  }
  if (picked.dino) {
    const d = picked.dino;
    const def = sp(d.species);
    const rider = people.find((p) => p.riding === d.id);
    if (rider) return { kind: "dismount", icon: "⬇️", label: `Hop off the ${def.nick}`, x: d.x, y: d.y, target: d.id };
    const hunt: Command = { kind: "hunt", icon: def.diet === "herbivore" ? "🏹" : "⚔️", label: `${def.diet === "herbivore" ? "Hunt" : "Fight"} the ${def.nick}`, x: d.x, y: d.y, target: d.id, weapons: kinds };
    if (d.owner && L.has("taming") && (d.warTraining ?? 0) < 1) {
      const ride: Command | undefined = RIDEABLE.has(d.species) && !isBaby(d)
        ? { kind: "ride", icon: "🏇", label: `Ride ${d.name}`, x: d.x, y: d.y, target: d.id } : undefined;
      return { kind: "train", icon: "🛡️", label: `Train ${d.name} for battle`, x: d.x, y: d.y, target: d.id, alts: ride ? [ride] : undefined };
    }
    if (d.owner && RIDEABLE.has(d.species) && !isBaby(d)) {
      return { kind: "ride", icon: "🏇", label: `Ride ${d.name} the ${def.nick}`, x: d.x, y: d.y, target: d.id };
    }
    if (TAMEABLE.has(d.species) && def.diet === "herbivore" && !d.raider) {
      const tame: Command = { kind: "tame", icon: "🤝", label: L.has("taming") ? `Befriend the ${def.nick}` : `Befriend (invent 🐾 Taming)`, x: d.x, y: d.y, target: d.id };
      if (d.owner) return { kind: "tame", icon: "💚", label: `${d.name} is a friend`, x: d.x, y: d.y, target: d.id };
      if (L.has("taming")) return { ...tame, alts: armed ? [hunt] : undefined };
      return armed ? { ...hunt, alts: [tame] } : tame;
    }
    if (d.owner) return { kind: "move", icon: "💚", label: `${d.name} is a friend`, x: d.x, y: d.y, target: 0 };
    if (!armed) return { kind: "move", icon: "😬", label: "Nobody has a weapon yet!", x: d.x, y: d.y, target: 0 };
    return hunt;
  }
  if (picked.human && !people.includes(picked.human)) {
    const o = picked.human;
    if (condition(o) !== "healthy") return { kind: "heal", icon: "🩹", label: `Help ${o.name}`, x: o.x, y: o.y, target: o.id };
    return null;
  }
  // a Neanderthal camp: raid it (beat whoever's home, take their food, bring our people back)
  const enemy = w.rivals.clans.find((k) => Math.hypot(k.x - x, k.y - y) < 110);
  if (enemy) {
    if (!armed) return { kind: "move", icon: "😬", label: "Nobody has a weapon to raid a Neanderthal camp!", x: enemy.x, y: enemy.y, target: 0 };
    const held = w.rivals.captives(w, enemy.id).length;
    return { kind: "raid", icon: "⚔️", label: `Raid the ${enemy.name} camp${held ? ` + free ${held} of ours` : ""}`, x: enemy.x, y: enemy.y, target: enemy.id, weapons: kinds };
  }
  // dinosaur bodies: harvest them
  const body = carcassAt(w, x, y);
  if (body) return butcherCommand(body);

  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);

  // Scorpions
  for (const s of w.colony.scorpions) {
    if (Math.hypot(s.x - x, s.y - 8 - y) > 26) continue;
    const site = sites(w).find((k) => k.kind === "scorpion" && k.id === s.id);
    if (site && !site.repair && s.built < 1) return buildCmd(site, "🎯", "Build the Scorpion");
    if (site && s.up) return buildCmd(site, "⬆️", "Upgrade the Scorpion");
    if (site?.repair) return { ...buildCmd(site, "🔧", "Repair the Scorpion"), kind: "repair" };
    const spot = w.colony.crewSpot(s);
    return { kind: "operate", icon: "🎯", label: s.crew ? "Take over the Scorpion" : "Crew the Scorpion", x: spot.x, y: spot.y, target: s.id, top: spot.top };
  }
  // towers
  for (const t of w.tribe.towers) {
    if (x < t.tx * TILE - 6 || x > (t.tx + 2) * TILE + 6 || y < t.ty * TILE - 90 || y > (t.ty + 2) * TILE + 4) continue;
    const site = sites(w).find((k) => k.kind === "tower" && k.id === t.id);
    if (site) return site.repair ? { ...buildCmd(site, "🔧", "Repair the tower"), kind: "repair" } : buildCmd(site, "🗼", "Build the watchtower");
    return { kind: "defend", icon: "🗼", label: "Climb the tower + keep watch", x: t.x, y: t.y, target: t.id, top: true };
  }
  // walls, gates, stairs
  const wl = w.tribe.wallAt(tx, ty) ?? w.tribe.wallAt(tx, Math.floor((y + 14) / TILE));
  if (wl) {
    const cx = wl.tx * TILE + TILE / 2;
    const cy = wl.ty * TILE + TILE / 2;
    if (wl.built < 1 || wl.upgrade || wl.boneUp) {
      const group = Array.from(wallStretch(w, wl)).map((id) => `wall:${id}`);
      const site = sites(w).find((k) => k.kind === "wall" && k.id === wl.id);
      if (site) return { ...buildCmd(site, wl.bone || wl.boneUp ? "🦴" : wl.part === "gate" ? "🚪" : wl.part === "stairs" ? "🪜" : "🧱", `Build this ${wl.part === "wall" ? "wall" : wl.part} (${group.length} piece${group.length > 1 ? "s" : ""})`), group };
    }
    if (wl.hp < wallMaxHp(wl) * 0.95) {
      const group = Array.from(wallStretch(w, wl)).filter((id) => {
        const o = w.tribe.walls.find((q) => q.id === id);
        return o && o.built >= 1 && o.hp < wallMaxHp(o) * 0.95;
      });
      return { kind: "repair", icon: "🔧", label: "Repair the wall", x: cx, y: cy + 20, target: wl.id, group: (group.length ? group : [wl.id]).map((id) => `wall:${id}`) };
    }
    if (wl.part === "stairs") return { kind: "defend", icon: "🪜", label: "Climb up + defend", x: cx, y: cy, target: wl.id, top: false };
    const defend: Command = { kind: "defend", icon: "🛡️", label: wl.part === "gate" ? "Guard the gate" : "Defend from the wall", x: cx, y: cy, target: wl.id, top: wl.part !== "gate" };
    return defend;
  }
  // homes
  for (const s of w.shelters) {
    if (Math.abs(s.x - x) > 32 || y > s.y + 8 || y < s.y - 58) continue;
    const site = sites(w).find((k) => (k.kind === "shelter" || k.kind === "upgrade") && k.id === s.id);
    if (site && site.repair) return { ...buildCmd(site, "🔧", "Fix the house"), kind: "repair" };
    if (site) return buildCmd(site, site.kind === "upgrade" ? "⬆️" : "🛖", site.kind === "upgrade" ? "Upgrade the home" : "Build the home");
    return { kind: "rest", icon: "🛌", label: "Go inside + rest", x: s.x, y: s.y + 6, target: s.id };
  }
  // buildings
  for (const b of w.colony.buildings) {
    const fp = { x0: b.tx * TILE, x1: (b.tx + bw(b.kind)) * TILE, y0: b.ty * TILE - 30, y1: b.y + 6 };
    if (x < fp.x0 || x > fp.x1 || y < fp.y0 || y > fp.y1) continue;
    const site = sites(w).find((k) => k.kind === "building" && k.id === b.id);
    if (site) return site.repair ? { ...buildCmd(site, "🔧", "Repair it"), kind: "repair" } : buildCmd(site, "🔨", "Build it");
    const door = w.colony.door(b);
    if (b.kind === "healer") return { kind: "rest", icon: "🌿", label: "Rest at the healing hut", x: door.x, y: door.y, target: b.id };
    if ((b.kind === "workshop" || b.kind === "blacksmith") && w.colony.queue.length) return { kind: "smith", icon: "⚒️", label: "Work the forge", x: door.x, y: door.y, target: b.id };
    if (b.kind === "waterStore") return { kind: "water", icon: "💧", label: "Fetch water", x, y, target: 0, res: "water" };
  }
  // campfires
  const fire = w.campfires.find((f) => Math.hypot(f.x - x, f.y - y) < 26);
  if (fire) return { kind: "tend", icon: "🔥", label: fire.lit ? "Tend the fire" : "Light the fire", x: fire.x + 22, y: fire.y + 4, target: fire.id };
  // fields
  const farm = w.tribe.farms.find((f) => Math.hypot(f.x - x, (f.y - y) * 1.6) < 40);
  if (farm) return { kind: "farm", icon: "🌾", label: farm.planted ? (farm.growth >= 1 ? "Harvest the field" : "Tend the crops") : "Plant the field", x: farm.x, y: farm.y, target: farm.id };
  // deposits
  for (const n of w.colony.nodes) {
    if (!n.found || Math.hypot(n.x - x, n.y - 6 - y) > 28) continue;
    const def = NODES[n.kind];
    if (def.needs && !L.has(def.needs)) return { kind: "move", icon: "🔒", label: `Invent Stone tools to dig ${def.name.toLowerCase()}`, x, y, target: 0 };
    if (!def.gives) return { kind: "dig", icon: "⛏️", label: `Dig the ${def.name.toLowerCase()}`, x: n.x, y: n.y + 14, target: n.id };
    return { kind: "mine", icon: def.icon, label: `Mine ${def.name.toLowerCase()}`, x: n.x, y: n.y + 14, target: n.id, res: def.gives };
  }
  // boulders
  const boulder = w.props.find((p) => p.kind === "boulder" && Math.hypot(p.x - x, p.y - 8 - y) < 24);
  if (boulder) return { kind: "mine", icon: "🪨", label: "Break up the boulder", x: boulder.x + 18, y: boulder.y + 6, target: boulder.id, res: "stone" };
  // things on the ground
  const item = w.items.find((i) => Math.hypot(i.x - x, i.y - y) < 22 && i.kind !== "poop");
  if (item) {
    if (item.kind === "meat") return { kind: "haul", icon: "🍖", label: "Drag the meat home", x: item.x, y: item.y, target: item.id };
    if (item.kind === "fruit" || item.kind === "berries" || item.kind === "fish" || item.kind === "stick" || item.kind === "stone") return { kind: "forage", icon: "🧺", label: "Pick it up", x: item.x, y: item.y, target: item.id, res: itemRes(item) };
  }
  // plants
  let plant: Plant | null = null;
  w.plantHash.each(x, y + 20, 46, (p) => {
    if (!p.stump && Math.abs(p.x - x) < 26 && y < p.y + 8 && y > p.y - (TALL.has(p.kind) ? 120 : 34) * p.size) {
      plant = p;
      return true;
    }
  });
  if (plant) {
    const p = plant as Plant;
    if (TALL.has(p.kind)) {
      const chop: Command = L.has("axe") ? { kind: "chop", icon: "🪓", label: "Chop down the tree", x: p.x, y: p.y, target: p.id, res: "wood" } : { kind: "chop", icon: "🪵", label: "Snap off sticks (invent 🪓 for logs)", x: p.x, y: p.y, target: p.id, res: "stick" };
      if (p.kind === "fruit" && p.fruit > 0) return { kind: "forage", icon: "🍎", label: "Pick fruit", x: p.x, y: p.y, target: p.id, res: "berries", alts: [chop] };
      return chop;
    }
    if (p.food > 0.25) return { kind: "forage", icon: p.kind === "bush" ? "🫐" : "🍃", label: p.kind === "bush" ? "Pick berries" : "Gather leaves", x: p.x, y: p.y, target: p.id, res: p.kind === "bush" ? "berries" : "leaves" };
  }
  // the ground itself
  const tile = w.terrain.tiles[ty * MAP_W + tx] as T;
  if (isWaterTile(tile)) {
    const fishy = w.schools.some((s) => Math.hypot(s.x - x, s.y - y) < 160);
    const water: Command = { kind: "water", icon: "💧", label: "Fetch water", x, y, target: 0, res: "water" };
    if (fishy) return { kind: "fish", icon: "🎣", label: "Go fishing", x, y, target: 0, res: "fish", alts: [water] };
    return water;
  }
  if (tile === T.Tar) return { kind: "mine", icon: "🛢️", label: "Scoop tar (carefully!)", x, y, target: 0, res: "tar" };
  if (tile === T.Rock || tile === T.Basalt) return { kind: "mine", icon: "🪨", label: "Quarry stone", x, y, target: 0, res: "stone" };
  if (w.fire.at(tx, ty) > 0.1) return L.has("firefighting") ? { kind: "douse", icon: "🪣", label: "Put out the fire!", x, y, target: 0 } : { kind: "move", icon: "🔒", label: "Invent 🪣 Fire fighting to put fires out", x, y, target: 0 };
  if (tile === T.Grass) {
    const move: Command = armed ? { kind: "guard", icon: "🛡️", label: "Stand guard here", x, y, target: 0 } : { kind: "move", icon: "👣", label: "Go here", x, y, target: 0 };
    return { ...move, alts: [{ kind: "forage", icon: "🌾", label: "Cut grass", x, y, target: 0, res: "grass" }] };
  }
  return armed ? { kind: "guard", icon: "🛡️", label: "Stand guard here", x, y, target: 0, alts: [{ kind: "move", icon: "👣", label: "Just go here", x, y, target: 0 }] } : { kind: "move", icon: "👣", label: "Go here", x, y, target: 0 };
}

const bw = (k: string) => ({ storage: 2, workshop: 2, blacksmith: 2, foodStore: 2, waterStore: 1, healer: 2, pen: 3, post: 1, trap: 1, bridge: 1, path: 1 })[k] ?? 1;

function buildCmd(site: Site, icon: string, label: string): Command {
  return { kind: "build", icon, label: site.locked ? `${label} (needs an invention)` : label, x: site.sx, y: site.sy, target: site.id, group: [siteKey(site)] };
}

function itemRes(it: Item): Resource {
  return it.kind === "fish" ? "fish" : it.kind === "stick" ? "stick" : it.kind === "stone" ? "stone" : it.kind === "bones" ? "bone" : "berries";
}

/** A dinosaur body under the pointer (they're big, so the hit box is too). */
export function carcassAt(w: World, x: number, y: number): Item | null {
  let best: Item | null = null;
  let bd = Infinity;
  for (const it of w.items) {
    const c = it.carcass;
    if (!c || !hasYield(it)) continue;
    const L = Math.max(24, c.size);
    if (Math.abs(it.x - x) > L * 0.6 || y < it.y - L * 0.45 || y > it.y + 12) continue;
    const d = Math.hypot(it.x - x, it.y - y);
    if (d < bd) {
      bd = d;
      best = it;
    }
  }
  return best;
}

/** "Harvest the T. rex (🍖 8 · hide 5 · 🦴 7)". */
export function carcassSummary(it: Item) {
  const c = it.carcass!;
  const parts: string[] = [];
  if (c.meat >= 1) parts.push(`${RES_INFO.meat.icon}${Math.round(c.meat)}`);
  if (c.hide >= 1) parts.push(`${RES_INFO.hide.icon}${Math.round(c.hide)}`);
  if (c.bone >= 1) parts.push(`${RES_INFO.bone.icon}${Math.round(c.bone)}`);
  if (c.tooth >= 1) parts.push(`${RES_INFO.tooth.icon}${Math.round(c.tooth)}`);
  return parts.join(" ");
}

function butcherCommand(it: Item): Command {
  const nick = it.species ? sp(it.species).nick : "dino";
  const stage = carcassStage(it.carcass!);
  const label = stage === "bones" ? `Collect the ${nick} bones` : `Harvest the ${nick}`;
  return { kind: "butcher", icon: "🔪", label: `${label} · ${carcassSummary(it)}`, x: it.x, y: it.y, target: it.id };
}

/* ------------------------------------------------------------------ */
/*  Issuing + running tasks                                            */
/* ------------------------------------------------------------------ */

export function issue(w: World, people: Human[], c: Command, weapon?: WeaponKind): Task | null {
  const crew = people.filter((h) => h.state !== "down" && !h.stranger);
  if (!crew.length) return null;
  // kids only take gentle jobs
  const kidOk = c.kind === "forage" || c.kind === "move" || c.kind === "rest" || c.kind === "water" || c.kind === "haul";
  const workers = crew.filter((h) => !h.child || kidOk);
  if (!workers.length) {
    for (const h of crew) say(h, "I'm too little!");
    return null;
  }
  if (c.kind === "hunt" || c.kind === "guard" || c.kind === "defend" || c.kind === "operate" || c.kind === "raid") {
    // fighters only: kids head home instead
    for (const h of crew) if (h.child) say(h, "I'll stay safe!");
  }
  const t = w.tasks.add(w, c, workers, weapon);
  const more = c.kind === "build" ? growBuild(w, t) : 0;
  if (more) t.label = `${c.label} + ${more} more nearby`;
  for (const h of workers) {
    const old = w.tasks.get(h.taskId);
    if (old && old !== t) old.people = old.people.filter((id) => id !== h.id);
    h.taskId = t.id;
    h.taskStep = 0;
    h.order = null;
    h.site = "";
    h.task = null;
    h.wantTop = false;
    if (weapon) w.colony.equipKind(h, weapon);
    if (h.state === "operate") leaveScorpion(w, h);
    if (h.state !== "carry" && h.state !== "haul") go(h, "idle", h.x, h.y);
    h.think = 0;
    say(h, more ? pick(w.rng, ["We build it all!", "All of it? Okay!", "Lots to build!"]) : pick(w.rng, ["On it!", "Okay!", "Ugh! (yes)", "Right away!", "Me go!"]));
  }
  return t;
}

/** Blueprints this close to one already in a build order join it (chained, so a whole deck or wall line comes along). */
const BUILD_LINK = TILE * 3.5;

/**
 * Grow a build order over the unbuilt blueprints around it: anything
 * within reach of the spot the player picked, or of another site the
 * order has already taken on. Returns how many sites were added.
 */
function growBuild(w: World, t: Task): number {
  const all = sites(w);
  const group = new Set(t.group ?? []);
  const area = t.area ?? (t.area = [t.x, t.y]);
  const known = (x: number, y: number) => {
    for (let k = 0; k < area.length; k += 2) if (area[k] === x && area[k + 1] === y) return true;
    return false;
  };
  for (const s of all) if (group.has(siteKey(s)) && !known(s.x, s.y)) area.push(s.x, s.y);
  const free = all.filter((s) => !s.locked && !s.repair && !group.has(siteKey(s)));
  let added = 0;
  for (let grew = true; grew; ) {
    grew = false;
    for (let i = free.length - 1; i >= 0; i--) {
      const s = free[i];
      let close = false;
      for (let k = 0; k < area.length && !close; k += 2) close = Math.hypot(s.x - area[k], s.y - area[k + 1]) < BUILD_LINK;
      if (!close) continue;
      group.add(siteKey(s));
      area.push(s.x, s.y);
      free.splice(i, 1);
      added++;
      grew = true;
    }
  }
  if (added) t.group = Array.from(group);
  return added;
}

/** Leave the current task (done or cancelled) and look for more player work. */
export function release(w: World, h: Human) {
  const t = w.tasks.get(h.taskId);
  if (t) {
    if (!t.done.includes(h.id)) t.done.push(h.id);
    t.people = t.people.filter((id) => id !== h.id);
  }
  h.taskId = 0;
  h.taskStep = 0;
  h.site = "";
  h.wantTop = false;
  if (h.order && t && (t.kind === "hunt" || t.kind === "guard" || t.kind === "defend")) h.order = null;
  joinTask(w, h);
}

/** Pick up another unfinished player task nearby (prefer the closest). */
export function joinTask(w: World, h: Human, idleOnly = false): boolean {
  if (h.child || h.stranger || h.captive || h.taskId) return false;
  let best: Task | null = null;
  let bd = idleOnly ? 700 : 1600;
  for (const t of w.tasks.list) {
    // closed tasks belong to the people the player picked
    if (!t.open) continue;
    if (!taskAlive(w, t)) continue;
    const d = Math.hypot(t.x - h.x, t.y - h.y);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  if (!best) return false;
  best.people.push(h.id);
  h.taskId = best.id;
  h.taskStep = 0;
  h.site = "";
  say(h, idleOnly ? "I'll help!" : "Next job!");
  return true;
}

/** Is there still something to do for this task? */
function taskAlive(w: World, t: Task): boolean {
  switch (t.kind) {
    case "build":
    case "repair": {
      const all = sites(w);
      return (t.group ?? []).some((k) => all.some((s) => siteKey(s) === k && !s.locked));
    }
    case "hunt":
      return !!(w.dinoById(t.target) || w.dragons.byId(t.target) || w.rivals.byId(t.target));
    case "raid":
      return !!w.rivals.clan(t.target);
    case "heal": {
      const p = w.humans.find((x) => x.id === t.target);
      return !!p && p.hp < 0.95;
    }
    case "tame": {
      const d = w.dinoById(t.target);
      return !!d && !d.owner && w.camp.learned.has("taming");
    }
    case "train": {
      const d = w.dinoById(t.target);
      return !!d && d.owner && (d.warTraining ?? 0) < 1 && w.camp.learned.has("taming");
    }
    case "ride":
      return !!w.dinoById(t.target);
    case "operate":
      return w.colony.scorpions.some((s) => s.id === t.target && s.built >= 1);
    case "haul":
      return w.items.some((i) => i.id === t.target);
    case "douse":
      return fireNear(w, t.x, t.y, 260) !== null;
    case "smith":
      return !!w.colony.current(w);
    case "butcher": {
      const it = w.items.find((i) => i.id === t.target);
      return !!it && hasYield(it);
    }
    case "farm":
      return w.tribe.farms.some((f) => f.id === t.target);
    default:
      // per-person jobs end when everyone assigned has done their part
      return t.people.length > 0;
  }
}

function personDone(w: World, h: Human, t: Task) {
  if (!t.done.includes(h.id)) t.done.push(h.id);
  t.people = t.people.filter((id) => id !== h.id);
  h.taskId = 0;
  h.taskStep = 0;
  h.site = "";
  h.wantTop = false;
  if (PER_PERSON.has(t.kind) && !t.people.length) w.tasks.remove(t);
  joinTask(w, h);
}

const near = (h: Human, x: number, y: number, r: number) => Math.hypot(h.x - x, h.y - y) < r;

/** Run this person's part of their task. Returns true if it decided what to do. */
export function taskThink(w: World, h: Human): boolean {
  const t = w.tasks.get(h.taskId);
  if (!t) {
    h.taskId = 0;
    return false;
  }
  switch (t.kind) {
    case "chop":
    case "mine":
    case "forage":
    case "water":
    case "fish":
    case "dig":
      return harvestThink(w, h, t);
    case "build":
    case "repair": {
      const group = new Set(t.group ?? []);
      if (buildThink(w, h, (s) => group.has(siteKey(s)))) {
        t.stall = 0;
        return true;
      }
      if (!taskAlive(w, t)) {
        personDone(w, h, t);
        return false;
      }
      // nothing to do this moment (no materials found yet, a busy stretch): stay on the job and look
      // again shortly; only after a long wait go help elsewhere
      t.stall = (t.stall ?? 0) + 1;
      if (t.stall > 12) {
        say(h, "Can't find materials…");
        personDone(w, h, t);
        return false;
      }
      say(h, "Looking for materials…");
      h.think = 2.5;
      return true;
    }
    case "raid": {
      const clan = w.rivals.clan(t.target);
      if (!clan) {
        say(h, pick(w.rng, ["We won!", "They're gone!", "Ha!"]));
        personDone(w, h, t);
        return false;
      }
      // beat whoever is at home (or on the way) first
      let foe: ReturnType<typeof w.rivals.byId> = null;
      let fd = 420;
      for (const b of w.rivals.members(clan.id)) {
        const d = Math.min(Math.hypot(b.x - h.x, b.y - h.y), Math.hypot(b.x - clan.x, b.y - clan.y) + 80);
        if (d < fd) {
          fd = d;
          foe = b;
        }
      }
      if (foe && Math.hypot(h.x - clan.x, h.y - clan.y) < 900) {
        h.order = { kind: "hunt", id: foe.id };
        return false; // roleThink runs the fight
      }
      h.order = null;
      if (Math.hypot(h.x - clan.x, h.y - clan.y) < 50) {
        // nobody home: carry off their food (captives walk free once no one guards them)
        const got = w.rivals.plunder(w, clan);
        say(h, got ? "Food for us!" : "Nothing here…");
        if (got) w.toast("⚔️", `Raided the ${clan.name} camp: ${got} food carried home!`, clan.x, clan.y);
        personDone(w, h, t);
        return false;
      }
      go(h, "walk", clan.x + (w.rng() - 0.5) * 40, clan.y + 20);
      return true;
    }
    case "hunt": {
      const d = w.dinoById(t.target);
      const dr = w.dragons.byId(t.target) ?? w.rivals.byId(t.target);
      if (!d && !dr) {
        say(h, pick(w.rng, ["Got it!", "Done!", "Phew!"]));
        personDone(w, h, t);
        return false;
      }
      h.order = { kind: "hunt", id: t.target };
      return false; // roleThink runs the hunt
    }
    case "guard":
    case "defend":
      h.order = { kind: "guard", x: t.x, y: t.y, top: t.top };
      h.wantTop = !!t.top;
      return false;
    case "operate": {
      const s = w.colony.scorpions.find((x) => x.id === t.target);
      if (!s || s.built < 1) {
        personDone(w, h, t);
        return false;
      }
      const spot = w.colony.crewSpot(s);
      if (near(h, spot.x, spot.y, 10) && (h.level === 1) === spot.top) {
        if (s.crew && s.crew !== h.id) {
          const other = w.humans.find((o) => o.id === s.crew);
          if (other) leaveScorpion(w, other);
        }
        s.crew = h.id;
        go(h, "operate", h.x, h.y);
      } else {
        h.wantTop = spot.top;
        go(h, "walk", spot.x, spot.y);
      }
      return true;
    }
    case "move":
      if (h.taskStep === 1 && near(h, t.x, t.y, 12)) {
        personDone(w, h, t);
        go(h, "idle", h.x, h.y);
        return true;
      }
      h.taskStep = 1;
      go(h, "walk", t.x + (h.id % 3) * 10 - 10, t.y + ((h.id >> 2) % 3) * 8 - 8);
      return true;
    case "heal": {
      const p = w.humans.find((x) => x.id === t.target);
      if (!p || p.hp >= 0.95 || p === h) {
        personDone(w, h, t);
        return false;
      }
      if (near(h, p.x + 14, p.y, 12)) {
        go(h, "heal", h.x, h.y);
        h.targetId = p.id;
        h.dir = p.x > h.x ? 1 : -1;
      } else go(h, "walk", p.x + 14, p.y);
      return true;
    }
    case "tame":
    case "ride": {
      const d = w.dinoById(t.target);
      if (!d) {
        personDone(w, h, t);
        return false;
      }
      if (t.kind === "ride" && d.owner) {
        if (near(h, d.x, d.y, sizeOf(d) * 0.5 + 16)) {
          mount(w, h, d);
          personDone(w, h, t);
          return true;
        }
        go(h, "walk", d.x - d.dir * 10, d.y + 6);
        return true;
      }
      if (!w.camp.learned.has("taming")) {
        say(h, "We need to learn Taming!");
        personDone(w, h, t);
        return false;
      }
      if (d.owner) {
        personDone(w, h, t);
        return false;
      }
      const reach = sizeOf(d) * 0.55 + 26;
      if (near(h, d.x, d.y, reach)) {
        go(h, "tame", h.x, h.y);
        h.targetId = d.id;
        h.dir = d.x > h.x ? 1 : -1;
      } else go(h, "walk", d.x + (h.x < d.x ? -reach * 0.8 : reach * 0.8), d.y + 6);
      return true;
    }
    case "train": {
      const d = w.dinoById(t.target);
      if (!d || !d.owner || (d.warTraining ?? 0) >= 1) {
        personDone(w, h, t);
        return false;
      }
      const reach = sizeOf(d) * 0.5 + 24;
      if (near(h, d.x, d.y, reach)) {
        go(h, "train", h.x, h.y);
        h.targetId = d.id;
      } else go(h, "walk", d.x - d.dir * reach * 0.7, d.y + 8);
      return true;
    }
    case "dismount":
      dismount(w, h);
      personDone(w, h, t);
      return true;
    case "haul": {
      const it = w.items.find((i) => i.id === t.target);
      if (!it) {
        personDone(w, h, t);
        return false;
      }
      if (it.draggedBy && it.draggedBy !== h.id) {
        personDone(w, h, t);
        return false;
      }
      if (it.draggedBy === h.id) go(h, "haul", w.camp.pileX - 30, w.camp.pileY + 16);
      else {
        h.targetId = it.id;
        go(h, "hunt", it.x, it.y);
      }
      return true;
    }
    case "tend": {
      const f = w.campfires.find((x) => x.id === t.target);
      if (!f) {
        personDone(w, h, t);
        return false;
      }
      if (near(h, t.x, t.y, 12)) {
        if (w.camp.stock.stick > 0 || f.fuel > 0.3) {
          if (!f.lit && w.camp.learned.has("fire")) w.camp.relight(w, f);
          if (w.camp.stock.stick > 0) w.camp.stock.stick--;
          f.fuel = 1;
          say(h, "Nice and toasty!");
        } else say(h, "No sticks!");
        personDone(w, h, t);
        return true;
      }
      go(h, "walk", t.x, t.y);
      return true;
    }
    case "rest": {
      if (h.hp >= 0.97 && h.taskStep === 2) {
        personDone(w, h, t);
        go(h, "idle", h.x, h.y + 16);
        return false;
      }
      if (near(h, t.x, t.y, 12)) {
        h.taskStep = 2;
        go(h, "rest", h.x, h.y);
      } else go(h, "walk", t.x, t.y);
      return true;
    }
    case "farm": {
      const f = w.tribe.farms.find((x) => x.id === t.target);
      if (!f || h.taskStep === 2) {
        personDone(w, h, t);
        return false;
      }
      if (near(h, f.x, f.y, 14)) {
        h.targetId = f.id;
        h.taskStep = 2;
        go(h, "farm", h.x, h.y);
      } else go(h, "walk", f.x, f.y);
      return true;
    }
    case "smith": {
      if (!w.colony.current(w)) {
        personDone(w, h, t);
        return false;
      }
      const st = w.colony.station(w);
      if (near(h, st.x, st.y, 12)) go(h, "smith", h.x, h.y);
      else go(h, "walk", st.x, st.y);
      return true;
    }
    case "douse":
      return douseThink(w, h, () => personDone(w, h, t));
    case "butcher": {
      const it = w.items.find((i) => i.id === t.target);
      if (!it || !hasYield(it)) {
        if (!h.carry) {
          say(h, pick(w.rng, ["All done!", "Picked clean!", "That's everything."]));
          personDone(w, h, t);
          return false;
        }
        return true;
      }
      return butcherThink(w, h, it);
    }
  }
  return false;
}

/* ------------------------------ harvesting bodies ------------------------------ */

/** Next thing to cut off: whatever the camp is shortest of, among what's on the body. */
function wantFrom(w: World, it: Item): Resource {
  const c = it.carcass!;
  const s = w.camp.stock;
  const opts = (["meat", "hide", "tooth", "bone"] as Resource[]).filter((r) => c[r as "meat"] > 0);
  opts.sort((a, b) => (s[a] ?? 0) - (s[b] ?? 0));
  return opts[0] ?? "bone";
}

/** Walk to the body, cut a load, carry it home, repeat until it's picked clean. */
export function butcherThink(w: World, h: Human, it: Item): boolean {
  if (h.carry) {
    if (h.state !== "carry") {
      const drop = w.colony.dropOff(w, h.x, h.y, h.carry);
      go(h, "carry", drop.x, drop.y);
    }
    return true;
  }
  const c = it.carcass!;
  const reach = Math.max(14, c.size * 0.42) + 12;
  const side = h.x < it.x ? -1 : 1;
  const sx = it.x + side * reach * 0.85;
  const sy = it.y + 8;
  h.task = wantFrom(w, it);
  h.targetId = -it.id;
  if (Math.hypot(h.x - it.x, h.y - it.y) < reach + 6) {
    go(h, "gather", h.x, h.y);
    h.dir = it.x > h.x ? 1 : -1;
  } else go(h, "walk", sx, sy);
  return true;
}

/**
 * Auto job: a body lying near camp gets harvested (by hunters + idle gatherers),
 * unless a predator is still eating it.
 */
export function autoButcher(w: World, h: Human, radius: number): boolean {
  if (h.child || h.stranger) return false;
  const camp = w.camp;
  let best: Item | null = null;
  let bd = radius;
  for (const it of w.items) {
    if (!it.carcass || !hasYield(it)) continue;
    const dc = Math.hypot(it.x - camp.x, it.y - camp.y);
    if (dc > radius) continue;
    if (it.claimed && w.dinoById(it.claimed)) continue;
    if (harvesters(w, it) >= Math.min(4, 1 + Math.floor(it.carcass.size / 50)) && h.targetId !== -it.id) continue;
    if (w.dinos.some((d) => w.tribe.hostile(w, d) && Math.hypot(d.x - it.x, d.y - it.y) < 220)) continue;
    const d = Math.hypot(it.x - h.x, it.y - h.y) * 0.6 + dc * 0.4;
    if (d < bd) {
      bd = d;
      best = it;
    }
  }
  if (!best) return false;
  if (!w.flags.has("butcherTip")) {
    w.flags.add("butcherTip");
    say(h, "Let's harvest it!");
  }
  return butcherThink(w, h, best);
}

void cutTime;
void STAGE_LABEL;

/* ------------------------------ harvesting ------------------------------ */

function harvestThink(w: World, h: Human, t: Task): boolean {
  // step 2: carrying the load home; once it's dropped off, this person is done
  if (h.taskStep === 2) {
    if (h.carry) return true;
    say(h, pick(w.rng, ["Done!", "There!", "All yours."]));
    personDone(w, h, t);
    return false;
  }
  if (h.taskStep === 1 && (h.state === "walk" || h.state === "gather" || h.state === "fish")) return true;
  const src = harvestSource(w, h, t);
  if (!src) {
    say(h, "Nothing left here!");
    personDone(w, h, t);
    return false;
  }
  if (h.carry) {
    // hands full from before: drop it off first
    const drop = w.colony.dropOff(w, h.x, h.y, h.carry);
    go(h, "carry", drop.x, drop.y);
    return true;
  }
  h.task = t.kind === "fish" ? "fish" : src.res;
  h.targetId = src.id;
  h.taskStep = 1;
  go(h, "walk", src.x, src.y);
  return true;
}

function harvestSource(w: World, h: Human, t: Task): { x: number; y: number; id: number; res: Resource } | null {
  const res = (t.res ?? "stick") as Resource;
  if (t.kind === "dig" || (t.kind === "mine" && t.target && w.colony.nodeById(t.target))) {
    const n = w.colony.nodeById(t.target);
    if (n) return { x: n.x + (h.x < n.x ? -18 : 18), y: n.y + 10, id: n.id, res: (NODES[n.kind].gives ?? "stone") as Resource };
    if (t.kind === "dig") return null;
  }
  if (t.kind === "forage" && t.target) {
    const it = w.items.find((i) => i.id === t.target);
    if (it) return { x: it.x, y: it.y, id: -it.id, res };
  }
  if ((t.kind === "chop" || t.kind === "forage") && t.target) {
    const p = w.plants.find((x) => x.id === t.target);
    const ok = p && !p.stump && (t.kind === "chop" || p.food > 0.2 || p.fruit > 0);
    if (ok && !claimedByOther(w, h, p.id, t)) return { x: p.x + (h.x < p.x ? -16 : 16), y: p.y + 6, id: p.id, res };
    // that one's taken or gone: find a similar one close by
    const alt = w.plantHash.nearest(t.x, t.y, 260, (q) => !q.stump && q.burnt < 0.5 && !claimedByOther(w, h, q.id, t) && (t.kind === "chop" ? TALL.has(q.kind) && (res === "stick" || q.size > 0.5) : q.food > 0.3 && (q.kind === "bush" || q.kind === "fern" || q.kind === "cycad")));
    if (alt) return { x: alt.x + (h.x < alt.x ? -16 : 16), y: alt.y + 6, id: alt.id, res };
    return null;
  }
  if (t.kind === "mine" && t.target) {
    const b = w.props.find((p) => p.id === t.target && p.kind === "boulder");
    if (b) return { x: b.x + 18, y: b.y + 6, id: b.id, res: "stone" };
  }
  if (t.kind === "water" || t.kind === "fish") {
    const s = t.kind === "water" ? w.colony.nearestWater(w, t.x, t.y, 600) : w.terrain.nearestDrink(t.x, t.y, 600);
    return s ? { x: s.x, y: s.y, id: 0, res: t.kind === "fish" ? "fish" : "water" } : null;
  }
  if (res === "tar") {
    const tile = w.terrain.findTile(t.x, t.y, 120, (k) => k !== T.Tar && k !== T.Deep && k !== T.Mountain && k !== T.Cliff, w.rng, 30);
    return tile ? { ...tile, id: 0, res: "tar" } : null;
  }
  if (res === "grass" || res === "stone") {
    if (t.kind === "mine" && !t.target) return { x: t.x, y: t.y + 8, id: 0, res };
    const s = sourceFor(w, h, res);
    return s ? { ...s, res } : { x: t.x, y: t.y, id: 0, res };
  }
  const s = sourceFor(w, h, res);
  return s ? { ...s, res } : null;
}

function claimedByOther(w: World, h: Human, id: number, t: Task) {
  return w.humans.some((o) => o !== h && o.taskId === t.id && o.targetId === id && o.taskStep === 1 && (o.state === "gather" || o.state === "walk"));
}

/** Called when a gather finishes for someone on a task: they're now carrying it home. */
export function taskCarrying(w: World, h: Human) {
  if (h.taskId) h.taskStep = 2;
}

/* ------------------------------ building ------------------------------ */

/** Builders haul bundles: more with baskets, lots more on a dino. */
const carryCap = (w: World, h: Human) => (w.camp.learned.has("basket") ? 6 : 3) * (h.riding ? 3 : 1);

/** The builder brain: works through sites that pass `allow`. Returns false when there's nothing to do. */
export function buildThink(w: World, h: Human, allow: (s: Site) => boolean): boolean {
  const camp = w.camp;
  const list = sites(w).filter((s) => !s.locked && allow(s));
  if (!list.length) return false;
  // Repairs and deliverable upgrades count as work too. If one site is short
  // of an unobtainable material, try the next site instead of idling.
  const score = (x: Site) => Math.hypot(x.sx - h.x, x.sy - h.y) - (x.repair ? 300 : 0)
    - (h.carry && x.need === h.carry ? 400 : 0) - (x.need === null ? 120 : 0)
    + Math.hypot(x.x - camp.x, x.y - camp.y) * 0.2;
  const preferred = h.site ? list.find((x) => siteKey(x) === h.site) : undefined;
  list.sort((a, b) => (a === preferred ? -1 : b === preferred ? 1 : score(a) - score(b)));
  for (const s of list) {
    const top = siteOnTop(w, s);
    const spot = standSpot(w, h, s, top);
    if (s.need === null || s.repair) {
      h.site = siteKey(s);
      if (near(h, spot.x, spot.y, 18)) go(h, s.repair ? "repair" : "build", h.x, h.y);
      else {
        h.wantTop = top;
        go(h, "walk", spot.x, spot.y);
      }
      h.task = null;
      return true;
    }
    if (h.carry === s.need && h.carryN > 0) {
      h.site = siteKey(s);
      h.wantTop = top;
      go(h, "carry", spot.x, spot.y);
      return true;
    }
    if (h.carry) {
      const drop = w.colony.dropOff(w, h.x, h.y, h.carry);
      go(h, "carry", drop.x, drop.y);
      h.site = "";
      return true;
    }
    if (camp.stock[s.need] > 0) {
      h.site = siteKey(s);
      if (near(h, camp.pileX, camp.pileY, 34)) {
        const n = Math.min(camp.stock[s.need], carryCap(w, h));
        camp.stock[s.need] -= n;
        h.carry = s.need;
        h.carryN = n;
        h.wantTop = top;
        go(h, "carry", spot.x, spot.y);
      } else {
        h.task = null;
        go(h, "walk", camp.pileX - 10, camp.pileY + 10);
      }
      return true;
    }
    const src = sourceFor(w, h, s.need) ?? sourceFor(w, h, s.need, s.x, s.y) ?? sourceFor(w, h, s.need, h.x, h.y);
    if (!src) continue;
    h.site = siteKey(s);
    h.task = s.need;
    h.targetId = src.id;
    go(h, "walk", src.x, src.y);
    return true;
  }
  h.site = "";
  return false;
}

/** Somewhere a builder can actually stand next to the site (blueprints in a wall line, corners…). */
function standSpot(w: World, h: Human, s: Site, top: boolean) {
  if (top || w.nav.ok("human", tileOf(s.sx, s.sy))) return { x: s.sx, y: s.sy };
  const j = w.nav.nearestOk("human", tileOf(s.x, s.y), h.x, h.y, 3);
  if (j < 0) return { x: s.sx, y: s.sy };
  return { x: (j % MAP_W) * TILE + TILE / 2, y: Math.floor(j / MAP_W) * TILE + TILE / 2 + 6 };
}

/** Carrying materials arrived at a site. Returns true if the site took them. */
export function deliverToSite(w: World, h: Human): boolean {
  const s = siteByKey(w, h.site);
  if (!s || !h.carry) return false;
  const used = deliver(w, s, h.carry, h.carryN, h.x, h.y);
  if (!used) return false;
  h.carryN -= used;
  if (h.carryN <= 0) {
    h.carry = null;
    h.carryN = 0;
  }
  const after = siteByKey(w, h.site);
  if (after && after.need === null) go(h, "build", h.x, h.y);
  else go(h, "idle", h.x, h.y);
  return true;
}

/** Per-frame hammering. Returns false if this person isn't on a site. */
export function buildAct(w: World, h: Human, dt: number): boolean {
  if (!h.site) return false;
  const s = siteByKey(w, h.site);
  if (!s) {
    h.site = "";
    go(h, "idle", h.x, h.y);
    h.think = 0;
    return true;
  }
  const r = work(w, s, dt);
  if (r !== "work") {
    if (r === "done") h.site = "";
    go(h, "idle", h.x, h.y);
    h.think = 0;
  }
  return true;
}

/* ------------------------------ riding ------------------------------ */

/** Assign the nearest available adults to trained, rideable battle pets. */
export function rallyBattlePets(w: World): number[] {
  const riders: number[] = [];
  const people = w.humans.filter((h) => !h.child && !h.stranger && !h.captive && h.state !== "down" && !h.riding);
  const pets = w.dinos.filter((d) => d.owner && !d.rider && !isBaby(d) && RIDEABLE.has(d.species) && (d.warTraining ?? 0) >= 1 && d.health > 0 && d.state !== "faint");
  for (const d of pets) {
    if (!people.length) break;
    people.sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y));
    const h = people.shift()!;
    if (issue(w, [h], { kind: "ride", icon: "🏇", label: `Ride ${d.name}`, x: d.x, y: d.y, target: d.id })) riders.push(h.id);
  }
  return riders;
}

export function mount(w: World, h: Human, d: Dino) {
  if (d.rider || h.riding || h.child) return;
  h.riding = d.id;
  d.rider = h.id;
  setState(d, "ridden", d.x, d.y);
  h.x = d.x;
  h.y = d.y;
  emote(d, "😊", 1.5);
  say(h, "Yee-haw!");
  w.sfx(sp(d.species).sound.kind, d.x, d.y, 0.7, sp(d.species).sound.pitch);
  w.discover("rider", d.x, d.y);
  if (!w.flags.has("riderFact")) {
    w.flags.add("riderFact");
    w.toast("🏇", `${h.name} is riding ${d.name}! Riders travel fast and carry three times as much.`, d.x, d.y);
  }
}

export function dismount(w: World, h: Human) {
  const d = h.riding ? w.dinoById(h.riding) : null;
  h.riding = 0;
  if (d) {
    d.rider = 0;
    setState(d, "idle", d.x, d.y);
    d.think = 1;
    h.x = d.x + (d.dir > 0 ? -1 : 1) * (sizeOf(d) * 0.3 + 8);
    h.y = d.y + 8;
  }
  h.level = 0;
  h.path = null;
}

export function leaveScorpion(w: World, h: Human) {
  for (const s of w.colony.scorpions) if (s.crew === h.id) s.crew = 0;
  if (h.state === "operate") go(h, "idle", h.x, h.y);
}

/* ------------------------------ fire brigade ------------------------------ */

export function fireNear(w: World, x: number, y: number, r: number): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bd = r;
  w.fire.active.forEach((i) => {
    const fx = (i % MAP_W) * TILE + TILE / 2;
    const fy = Math.floor(i / MAP_W) * TILE + TILE / 2;
    const d = Math.hypot(fx - x, fy - y);
    if (d < bd) {
      bd = d;
      best = { x: fx, y: fy };
    }
  });
  return best;
}

/** Get water (store or river), run to the nearest flames, throw it. */
export function douseThink(w: World, h: Human, done: () => void): boolean {
  const c = w.camp;
  const fire = fireNear(w, h.x, h.y, 900) ?? fireNear(w, c.x, c.y, 900);
  const skins = w.colony.kits.has("waterSkins");
  if (!fire) {
    done();
    return false;
  }
  if (h.carry === "water") {
    if (near(h, fire.x, fire.y + 26, 22)) go(h, "douse", h.x, h.y);
    else go(h, "carry", fire.x, fire.y + 26);
    h.site = "douse";
    return true;
  }
  if (c.stock.water > 0 && near(h, c.pileX, c.pileY, 34)) {
    const n = Math.min(c.stock.water, skins ? 4 : 2);
    c.stock.water -= n;
    h.carry = "water";
    h.carryN = n;
    go(h, "carry", fire.x, fire.y + 26);
    h.site = "douse";
    return true;
  }
  if (c.stock.water > 0) {
    go(h, "walk", c.pileX - 10, c.pileY + 10);
    h.task = null;
    return true;
  }
  const s = w.colony.nearestWater(w, h.x, h.y, 1400);
  if (!s) {
    done();
    return false;
  }
  h.task = "water";
  h.targetId = 0;
  h.site = "douse";
  go(h, "walk", s.x, s.y);
  return true;
}

/** Dino the player could be pointing at (for the hover hint). */
export function describeDino(d: Dino) {
  return sp(d.species).nick;
}

