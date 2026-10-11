import { sp } from "../data/species";
import { deliver, siteByKey, siteKey, sites } from "./build";
import { issue } from "./tasks";
import { isBaby, setState, sizeOf } from "./dinos";
import { tileOf } from "./nav";
import { TILE, type Dino, type Resource } from "./types";
import type { World } from "./world";

export type WorkSkill = "hauler" | "riding" | "heavy" | "runner";
type Work = NonNullable<Dino["work"]>;

export function workOf(d: Dino): Work {
  return d.work ??= { skills: {}, focus: null, trainer: 0, practice: 0, harness: 0, auto: true, cargo: "stone", cargoN: 0, job: null, source: null, site: "", targetX: d.x, targetY: d.y, manual: false, loadT: 0, helper: 0 };
}

export function eligible(d: Dino, skill: WorkSkill) {
  const def = sp(d.species);
  if (def.diet !== "herbivore" || def.move !== "walk" || isBaby(d) || def.aggression >= 0.45) return false;
  const size = sizeOf(d);
  if (skill === "riding") return size >= 50 && def.fear < 0.8 && d.species !== "pachy";
  if (skill === "heavy") return (size >= 85 || d.species === "ankylo") && def.hp >= 115 && d.species !== "para";
  if (skill === "runner") return size >= 45 && size < 130 && def.speed >= 18;
  return size >= 45 && def.hp >= 75;
}

export function capacity(d: Dino) {
  const work = workOf(d);
  const level = Math.max(work.skills.hauler ?? 0, work.skills.heavy ?? 0, work.skills.runner ?? 0);
  if (level < 0.35 || !work.harness) return 0;
  const size = sizeOf(d);
  return Math.floor(((d.species === "apato" || d.species === "brachio") ? 230 : size >= 95 ? 115 : 55) * (0.7 + level * 0.6) * (work.harness > 1 ? 1.3 : 1));
}

export function trainingStage(d: Dino) {
  const level = Math.max(0, ...Object.values(workOf(d).skills));
  return level >= 1 ? "Expert" : level >= 0.7 ? "Experienced" : level >= 0.35 ? "Trained" : d.owner ? "Friendly" : "Wild";
}

export function canWork(d: Dino) {
  return d.owner && d.health > 0 && d.state !== "faint" && !d.rider && capacity(d) > 0;
}

function safe(w: World, d: Dino, x: number, y: number) {
  const cls = ((d.species === "apato" || d.species === "brachio") && !isBaby(d)) || sizeOf(d) >= 110 ? "hugeDino" : sizeOf(d) > 34 ? "bigDino" : "dino";
  const i = tileOf(x, y);
  return w.nav.ok(cls, i) && w.fire.heat[i] < 0.2 && w.lava.heat[i] < 0.15 && !w.rivals.brutes.some((b) => Math.hypot(b.x - x, b.y - y) < 110);
}

function approach(w: World, d: Dino, x: number, y: number) {
  if (safe(w, d, x, y)) return { x, y };
  for (let radius = 1; radius <= 4; radius++) for (let a = 0; a < 12; a++) {
    const angle = a * Math.PI / 6;
    const px = x + Math.cos(angle) * radius * TILE;
    const py = y + Math.sin(angle) * radius * TILE;
    if (safe(w, d, px, py)) return { x: px, y: py };
  }
  return null;
}

export function commandCollect(w: World, d: Dino, source: "stock" | "mine", resource: Resource, x: number, y: number) {
  if (!canWork(d)) return false;
  const target = approach(w, d, x, y);
  if (!target) return false;
  const work = workOf(d);
  work.source = source;
  work.cargo = resource;
  work.job = "collect";
  work.site = "";
  work.targetX = target.x;
  work.targetY = target.y;
  work.manual = true;
  work.loadT = 0;
  d.think = 0;
  return true;
}

export function commandDeliver(w: World, d: Dino, key: string, x: number, y: number) {
  const work = workOf(d);
  if (!canWork(d) || !work.cargoN || !work.cargo) return false;
  const target = approach(w, d, x, y);
  if (!target) return false;
  work.job = "deliver";
  work.site = key;
  work.targetX = target.x;
  work.targetY = target.y;
  work.manual = true;
  work.loadT = 0;
  d.think = 0;
  return true;
}

export function commandTravel(w: World, d: Dino, x: number, y: number) {
  if (!d.owner || (workOf(d).skills.riding ?? 0) < 0.35) return false;
  const target = approach(w, d, x, y);
  if (!target) return false;
  const work = workOf(d);
  work.job = "travel";
  work.targetX = target.x;
  work.targetY = target.y;
  work.manual = true;
  work.loadT = 0;
  d.think = 0;
  return true;
}

export function thinkWorkDino(w: World, d: Dino) {
  const work = d.work;
  if (!work || !d.owner || d.rider || d.health <= 0 || d.hunger > 0.88 || d.thirst > 0.88 || d.energy < 0.12 || w.tribe.raid) return false;
  if (work.focus) { setState(d, "idle", d.x, d.y); return true; }
  if (work.job) {
    setState(d, "work", work.targetX, work.targetY);
    return true;
  }
  if (work.manual) { setState(d, "idle", d.x, d.y); return true; }
  if (!work.auto || !canWork(d)) return false;
  if (work.cargoN && work.cargo) {
    const site = sites(w).filter((s) => !s.locked && s.need === work.cargo).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
    const drop = site ? approach(w, d, site.sx, site.sy) : approach(w, d, w.colony.dropOff(w, d.x, d.y, work.cargo).x, w.colony.dropOff(w, d.x, d.y, work.cargo).y);
    if (drop) { work.job = "deliver"; work.site = site ? siteKey(site) : ""; work.targetX = drop.x; work.targetY = drop.y; setState(d, "work", drop.x, drop.y); return true; }
  }
  const mineLoad = Object.entries(w.mineLoads).find(([r, n]) => (n ?? 0) > 0 && Math.max(work.skills.runner ?? 0, work.skills.hauler ?? 0, work.skills.heavy ?? 0) >= 0.35 && r);
  if (mineLoad) {
    const target = approach(w, d, w.camp.caveX, w.camp.caveY);
    if (target) { work.source = "mine"; work.cargo = mineLoad[0] as Resource; work.job = "collect"; work.targetX = target.x; work.targetY = target.y; setState(d, "work", target.x, target.y); return true; }
  }
  const site = sites(w).filter((s) => !s.locked && !!s.need && w.camp.stock[s.need] > 0).sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
  if (site?.need) {
    const drop = w.colony.dropOff(w, site.x, site.y, site.need);
    const target = approach(w, d, drop.x, drop.y);
    if (target) { work.source = "stock"; work.cargo = site.need; work.site = siteKey(site); work.job = "collect"; work.targetX = target.x; work.targetY = target.y; setState(d, "work", target.x, target.y); return true; }
  }
  return false;
}

export function actWorkDino(w: World, d: Dino, dt: number) {
  const work = d.work;
  if (!work?.job || d.state !== "work") return;
  if (Math.hypot(d.x - work.targetX, d.y - work.targetY) > Math.max(22, sizeOf(d) * 0.28)) { work.loadT = 0; return; }
  d.vx *= 0.5; d.vy *= 0.5;
  if (work.job !== "travel") {
    let helper = w.humans.find((h) => h.id === work.helper && w.tasks.get(h.taskId)?.kind === "handleDino" && !h.under && h.state !== "down");
    if (!helper) {
      helper = w.humans.filter((h) => !h.child && !h.under && !h.stranger && !h.captive && !h.riding && !h.taskId && h.state !== "down").sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))[0];
      if (!helper) return;
      work.helper = helper.id;
      issue(w, [helper], { kind: "handleDino", icon: "📦", label: `${work.job === "collect" ? "Load" : "Unload"} ${d.name}`, x: d.x, y: d.y, target: d.id });
      return;
    }
    if (helper.state !== "loadDino" || Math.hypot(helper.x - d.x, helper.y - d.y) > sizeOf(d) * 0.45 + 36) return;
    if (w.rng() < dt * 3) helper.bubble = { text: work.job === "collect" ? "Loading!" : "Unloading!", t: 0.8 };
  }
  work.loadT += dt;
  if (work.loadT < (work.job === "travel" ? 0.2 : 2)) return;
  work.loadT = 0;
  const releaseHelper = () => {
    const h = w.humans.find((person) => person.id === work.helper);
    if (h) {
      const task = w.tasks.get(h.taskId);
      if (task?.kind === "handleDino") w.tasks.finish(w, task);
      if (h.state === "loadDino") { h.state = "idle"; h.think = 0; }
    }
    work.helper = 0;
  };
  if (work.job === "travel") { work.job = null; setState(d, "idle", d.x, d.y); return; }
  if (work.job === "collect" && work.cargo) {
    const stock = work.source === "mine" ? w.mineLoads : w.camp.stock;
    const n = Math.min(capacity(d) - work.cargoN, stock[work.cargo] ?? 0);
    if (n > 0) { stock[work.cargo] = (stock[work.cargo] ?? 0) - n; work.cargoN += n; w.toast("📦", `${d.name} loaded ${n} ${work.cargo}.`, d.x, d.y); }
    work.job = null;
    releaseHelper();
    // A direct collection order leaves the packed load ready for the player's destination.
    if (work.cargoN && work.site) {
      const site = siteByKey(w, work.site);
      const target = site && approach(w, d, site.sx, site.sy);
      if (target) { work.job = "deliver"; work.targetX = target.x; work.targetY = target.y; }
    }
    d.think = 0;
    return;
  }
  if (work.job === "deliver" && work.cargo && work.cargoN) {
    const site = siteByKey(w, work.site);
    const n = site ? deliver(w, site, work.cargo, work.cargoN, d.x, d.y) : 0;
    work.cargoN -= n;
    if (!site) { w.camp.stock[work.cargo] += work.cargoN; work.cargoN = 0; }
    if (n) w.toast("🏗️", `${d.name} delivered ${n} ${work.cargo}.`, d.x, d.y);
    work.job = null; work.site = ""; work.manual = false;
    releaseHelper();
    d.think = 0;
  }
}
