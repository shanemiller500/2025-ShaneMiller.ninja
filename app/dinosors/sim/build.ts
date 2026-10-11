/* ------------------------------------------------------------------ */
/*  Construction sites. Every blueprint — wall, gate, stairs, tower,   */
/*  hut, home upgrade, building, Scorpion — looks the same to a        */
/*  builder: "what does it still need, where do I stand, and how do I  */
/*  hammer it". Builders (auto job or player orders) work through      */
/*  them: fetch from the stockpile, gather if it's empty, carry it     */
/*  over, build, then move on to the next unfinished piece.            */
/* ------------------------------------------------------------------ */
import { BUILDINGS, HOUSING, SCORPION_TIERS, TENT_STAGES, buildingCost, buildingWork, type Cost } from "../data/colony";
import { PYRAMID_STAGES } from "../data/civ";
import { SHELTER_STAGES } from "../data/facts";
import { P } from "./particles";
import { MAP_W, TILE, type Resource, type Shelter, type TechId, type Tower, type Wall } from "./types";
import type { World } from "./world";

export type SiteKind = "wall" | "tower" | "shelter" | "upgrade" | "building" | "scorpion";

export type UpgradeKind = "all" | "homes" | "towers" | "scorpions" | "walls";

/** Queue one available tier per structure; builders collect materials afterward. */
export function queueUpgrades(w: World, kind: UpgradeKind = "all") {
  const counts = { homes: 0, towers: 0, scorpions: 0, walls: 0 };
  if (kind === "all" || kind === "homes") for (const s of w.shelters) {
    if (!shelterDone(s) || s.up || !HOUSING[s.tier + 1] || (HOUSING[s.tier + 1].polygon && !w.civ.polygonAge)) continue;
    s.up = true;
    s.upHave = {};
    counts.homes++;
  }
  if (kind === "all" || kind === "towers") for (const t of w.tribe.towers) {
    if (w.tribe.upgradeTower(w, t)) counts.towers++;
  }
  if (kind === "all" || kind === "scorpions") for (const s of w.colony.scorpions) {
    const next = SCORPION_TIERS[s.tier];
    if (!next || s.up || s.built < 1 || (next.at === "blacksmith" && !w.colony.finished("blacksmith"))) continue;
    s.up = true;
    s.have = {};
    counts.scorpions++;
  }
  if (kind === "all" || kind === "walls") for (const wall of w.tribe.walls) {
    if (wall.built < 1 || wall.hp <= 0 || wall.upgrade) continue;
    const next = wall.kind === "palisade" && w.camp.learned.has("stonewall") ? "stone" : wall.kind === "stone" && w.civ.polygonAge ? "polygon" : null;
    if (!next) continue;
    wall.upgrade = true;
    wall.upTo = next;
    wall.have = 0;
    counts.walls++;
  }
  if (counts.walls) w.tribe.version++;
  return counts;
}

export interface Site {
  kind: SiteKind;
  id: number;
  /** structure centre */
  x: number;
  y: number;
  /** where builders stand */
  sx: number;
  sy: number;
  /** next material it needs (null = everything delivered → hammer time) */
  need: Resource | null;
  /** damaged: only needs a builder's time */
  repair: boolean;
  /** waiting on an invention (or a civilization research) */
  locked: string | null;
}

export const siteKey = (s: { kind: SiteKind; id: number }) => `${s.kind}:${s.id}`;

/* ------------------------------ walls ------------------------------ */

export const WALL_HP = { palisade: 220, stone: 600, polygon: 900 } as const;
/** Dressed masonry (Old Ways) toughens every stone piece. Set by the civ system each tick. */
export const STONE_MUL = { v: 1 };

export function wallMaxHp(wl: Wall) {
  return WALL_HP[wl.kind] * (wl.kind === "palisade" ? 1 : STONE_MUL.v) * (wl.part === "gate" ? (wl.bone ? 1.25 : 0.85) : wl.part === "stairs" ? 0.6 : 1);
}

/** Bones for one grand bone gate. */
export const BONE_GATE = { r: "bone" as Resource, n: 5 };

/** What a piece is (or becomes, once its upgrade is built). */
export const wallTarget = (wl: Wall) => (wl.upgrade ? wl.upTo ?? "stone" : wl.kind);

/** Material + units for one wall piece (or its upgrade). */
export function wallNeed(wl: Wall): { r: Resource; n: number } {
  // a bone gate: planned fresh, or a finished piece being rebuilt as one
  if (wl.boneUp || (wl.bone && wl.built < 1 && wl.hp <= 0 && !wl.upgrade)) return BONE_GATE;
  if (wallTarget(wl) === "polygon") return { r: "shaped", n: wl.part === "gate" ? 3 : 2 };
  const stone = wl.kind === "stone" || wl.upgrade;
  if (wl.part === "gate") return stone ? { r: "stone", n: 3 } : { r: "wood", n: 2 };
  if (wl.part === "stairs") return stone ? { r: "stone", n: 2 } : { r: "stick", n: 2 };
  return stone ? { r: "stone", n: 2 } : { r: "stick", n: 2 };
}

export const TOWER_STAGES: { need: Resource; n: number }[] = [
  { need: "wood", n: 2 },
  { need: "wood", n: 2 },
  { need: "stone", n: 2 },
];
/** Once the tribe knows stone walls, towers go up in stone (same number of stages). */
export const STONE_TOWER_STAGES: { need: Resource; n: number }[] = [
  { need: "stone", n: 3 },
  { need: "stone", n: 3 },
  { need: "stone", n: 2 },
];
/** Rebuilding a finished wooden tower in stone. */
export const STONE_TOWER_UP = { need: "stone" as Resource, n: 6 };
export const towerStages = (t: Tower) => (t.stone ? STONE_TOWER_STAGES : TOWER_STAGES);
export const towerMaxHp = (t: Tower) => (t.stone ? 900 : 400);

/** Stone towers come with a Scorpion: plan one on top if there isn't one yet. */
export function armTower(w: World, t: Tower) {
  if (!t.stone || !w.camp.learned.has("scorpion")) return;
  if (w.colony.scorpions.some((s) => s.tx >= t.tx && s.tx <= t.tx + 1 && s.ty >= t.ty && s.ty <= t.ty + 1)) return;
  const s = w.colony.addScorpion(w, t.x, t.y);
  if (typeof s !== "string") w.toast("🎯", "A Scorpion is planned on top of the stone tower!", t.x, t.y - 60);
}

export function stagesOf(s: Shelter) {
  return s.plan === "tent" ? TENT_STAGES : SHELTER_STAGES;
}
export const shelterDone = (s: Shelter) => s.stage >= stagesOf(s).length;

function firstMissing(cost: Cost, have: Partial<Record<Resource, number>>): Resource | null {
  for (const [r, n] of Object.entries(cost) as [Resource, number][]) if ((have[r] ?? 0) < n) return r;
  return null;
}

/* ------------------------------ listing ------------------------------ */

export function sites(w: World): Site[] {
  const out: Site[] = [];
  const L = w.camp.learned;
  for (const wl of w.tribe.walls) {
    const pending = wl.built < 1 || wl.upgrade || !!wl.boneUp;
    const hurt = wl.built >= 1 && !wl.upgrade && wl.hp < wallMaxHp(wl) * 0.6;
    if (!pending && !hurt) continue;
    const x = wl.tx * TILE + TILE / 2;
    const y = wl.ty * TILE + TILE / 2;
    const target = wallTarget(wl);
    const tech: TechId = target === "palisade" ? "palisade" : "stonewall";
    const { r, n } = wallNeed(wl);
    const locked = target === "polygon" ? (w.civ.polygonAge ? null : "precisionStone") : L.has(tech) ? null : tech;
    out.push({ kind: "wall", id: wl.id, x, y, sx: x, sy: y + 20, need: pending && wl.have < n ? r : null, repair: !pending, locked });
  }
  for (const t of w.tribe.towers) {
    const done = t.stage >= towerStages(t).length;
    if (done && t.up) {
      out.push({ kind: "tower", id: t.id, x: t.x, y: t.y, sx: t.x, sy: t.y + 22, need: t.have < STONE_TOWER_UP.n ? STONE_TOWER_UP.need : null, repair: false, locked: L.has("stonewall") ? null : "stonewall" });
      continue;
    }
    const hurt = done && t.hp < towerMaxHp(t) * 0.75;
    if (done && !hurt) continue;
    const st = towerStages(t)[t.stage];
    out.push({ kind: "tower", id: t.id, x: t.x, y: t.y, sx: t.x, sy: t.y + 22, need: st && t.have < st.n ? st.need : null, repair: !st, locked: L.has("tower") ? null : "tower" });
  }
  for (const s of w.shelters) {
    if (!shelterDone(s)) {
      const st = stagesOf(s)[s.stage];
      const needAxe = st.need === "wood" && !L.has("axe");
      out.push({ kind: "shelter", id: s.id, x: s.x, y: s.y, sx: s.x + 26, sy: s.y + 8, need: s.have < st.n ? st.need : null, repair: false, locked: needAxe ? "axe" : null });
    } else if (s.up && HOUSING[s.tier + 1]) {
      out.push({ kind: "upgrade", id: s.id, x: s.x, y: s.y, sx: s.x + 26, sy: s.y + 8, need: firstMissing(HOUSING[s.tier + 1].cost, s.upHave), repair: false, locked: null });
    } else if (s.hp < 0.6) {
      out.push({ kind: "upgrade", id: s.id, x: s.x, y: s.y, sx: s.x + 26, sy: s.y + 8, need: null, repair: true, locked: null });
    }
  }
  for (const b of w.colony.buildings) {
    const def = BUILDINGS[b.kind];
    if (b.built >= 1 && b.hp >= def.hp * 0.6) continue;
    const d = w.colony.door(b);
    const locked = def.tech && !L.has(def.tech) ? def.tech : def.civ && !w.civ.has(def.civ) ? def.civ : null;
    out.push({ kind: "building", id: b.id, x: b.x, y: b.y, sx: d.x, sy: d.y, need: b.built < 1 ? firstMissing(buildingCost(b), b.have) : null, repair: b.built >= 1, locked });
  }
  for (const s of w.colony.scorpions) {
    const spot = w.colony.crewSpot(s);
    if (s.built < 1) out.push({ kind: "scorpion", id: s.id, x: s.x, y: s.y, sx: spot.x, sy: spot.y + (spot.top ? 0 : 0), need: firstMissing(SCORPION_TIERS[0].cost, s.have), repair: false, locked: L.has("scorpion") ? null : "scorpion" });
    else if (s.up && SCORPION_TIERS[s.tier]) {
      const next = SCORPION_TIERS[s.tier];
      const locked = next.at === "blacksmith" && !w.colony.finished("blacksmith");
      out.push({ kind: "scorpion", id: s.id, x: s.x, y: s.y, sx: spot.x, sy: spot.y, need: firstMissing(next.cost, s.have), repair: false, locked: locked ? "smelting" : null });
    } else if (s.hp < SCORPION_TIERS[s.tier - 1].hp * 0.6) out.push({ kind: "scorpion", id: s.id, x: s.x, y: s.y, sx: spot.x, sy: spot.y, need: null, repair: true, locked: null });
  }
  return out;
}

export function siteByKey(w: World, key: string): Site | null {
  if (!key) return null;
  const [kind, id] = key.split(":");
  return sites(w).find((s) => s.kind === kind && s.id === Number(id)) ?? null;
}

/** Do builders stand on the wall walkway for this site? (Scorpions on walls/towers.) */
export function siteOnTop(w: World, s: Site) {
  if (s.kind !== "scorpion") return false;
  const sc = w.colony.scorpions.find((x) => x.id === s.id);
  return !!sc && sc.mount !== "ground" && sc.built >= 1;
}

/* ------------------------------ deliver + work ------------------------------ */

/** Unload carried materials into a site (walls share the load with neighbours). Returns units used. */
export function deliver(w: World, s: Site, r: Resource, n: number, hx: number, hy: number): number {
  let used = 0;
  switch (s.kind) {
    case "wall": {
      for (const wl of w.tribe.walls) {
        if (n - used < 1) break;
        if (!(wl.built < 1 || wl.upgrade || wl.boneUp)) continue;
        const need = wallNeed(wl);
        if (need.r !== r || wl.have >= need.n) continue;
        const x = wl.tx * TILE + TILE / 2;
        const y = wl.ty * TILE + TILE / 2;
        if (wl.id !== s.id && Math.hypot(x - hx, y - hy) > 90) continue;
        const take = Math.min(n - used, need.n - wl.have);
        wl.have += take;
        used += take;
      }
      break;
    }
    case "tower": {
      const t = w.tribe.towers.find((x) => x.id === s.id);
      if (t && t.up && t.stage >= towerStages(t).length) {
        if (r === STONE_TOWER_UP.need) {
          used = Math.min(n, STONE_TOWER_UP.n - t.have);
          t.have += used;
        }
        break;
      }
      const st = t && towerStages(t)[t.stage];
      if (t && st && st.need === r) {
        used = Math.min(n, st.n - t.have);
        t.have += used;
      }
      break;
    }
    case "shelter": {
      const sh = w.shelters.find((x) => x.id === s.id);
      const st = sh && stagesOf(sh)[sh.stage];
      if (sh && st && st.need === r) {
        used = Math.min(n, st.n - sh.have);
        sh.have += used;
      }
      break;
    }
    case "upgrade": {
      const sh = w.shelters.find((x) => x.id === s.id);
      const next = sh && HOUSING[sh.tier + 1];
      if (sh && next) {
        const want = (next.cost[r] ?? 0) - (sh.upHave[r] ?? 0);
        used = Math.max(0, Math.min(n, want));
        sh.upHave[r] = (sh.upHave[r] ?? 0) + used;
      }
      break;
    }
    case "building": {
      const b = w.colony.buildings.find((x) => x.id === s.id);
      if (b) {
        const want = (buildingCost(b)[r] ?? 0) - (b.have[r] ?? 0);
        used = Math.max(0, Math.min(n, want));
        b.have[r] = (b.have[r] ?? 0) + used;
      }
      break;
    }
    case "scorpion": {
      const sc = w.colony.scorpions.find((x) => x.id === s.id);
      if (sc) {
        const cost = sc.built < 1 ? SCORPION_TIERS[0].cost : SCORPION_TIERS[sc.tier]?.cost ?? {};
        const want = (cost[r] ?? 0) - (sc.have[r] ?? 0);
        used = Math.max(0, Math.min(n, want));
        sc.have[r] = (sc.have[r] ?? 0) + used;
      }
      break;
    }
  }
  return used;
}

/** Shared hammering timer per site (several builders speed it up). True when finished. */
function progress(w: World, s: Site, dt: number, need: number) {
  const k = siteKey(s);
  const t = (w.workT.get(k) ?? 0) + dt;
  if (t < need) {
    w.workT.set(k, t);
    return false;
  }
  w.workT.delete(k);
  return true;
}

const chips = (w: World, x: number, y: number, color: string, dt: number) => {
  if (w.rng() < dt * 5) w.particles.spawn(P.Crumb, x + (w.rng() - 0.5) * 24, y - 10, { z: 16, vz: 40, vx: (w.rng() - 0.5) * 40, g: 160, size: 2, max: 0.5, color });
  if (w.rng() < dt * 3) w.sfx("knock", x, y, 0.4);
};

/**
 * A builder hammers a site for dt seconds. Returns "done" when that site
 * is finished, "work" while busy, or "wait" if it still needs materials.
 */
export function work(w: World, s: Site, dt: number): "done" | "work" | "wait" {
  if (s.need && !s.repair) return "wait";
  switch (s.kind) {
    case "wall": {
      if (s.repair) {
        const wl = w.tribe.walls.find((x) => x.id === s.id);
        if (!wl) return "done";
        wl.hp = Math.min(wallMaxHp(wl), wl.hp + dt * 45);
        chips(w, s.x, s.y, wl.kind === "palisade" ? "#a07a4a" : "#9a958c", dt);
        return wl.hp >= wallMaxHp(wl) ? "done" : "work";
      }
      // hammer the nearest stocked piece around here (a crew finishes a whole stretch)
      let best: Wall | null = null;
      let bd = 110;
      for (const wl of w.tribe.walls) {
        if (!(wl.built < 1 || wl.upgrade || wl.boneUp) || wl.have < wallNeed(wl).n) continue;
        const d = Math.hypot(wl.tx * TILE + 16 - s.x, wl.ty * TILE + 16 - s.y);
        if (d < bd) {
          bd = d;
          best = wl;
        }
      }
      if (!best) return "done";
      if (best.boneUp) {
        // up go the tusks + the rib cage: the old gate (or wall) becomes the grand bone entrance
        best.boneUp = false;
        best.bone = true;
        if (best.part !== "gate") best.open = !w.tribe.raid;
        best.part = "gate";
        best.have = 0;
        best.hp = wallMaxHp(best);
        w.tribe.version++;
        w.particles.burst(P.Crumb, best.tx * TILE + 16, best.ty * TILE + 10, 10, 60, { z: 20, vz: 60, g: 160, size: 3, max: 0.8, color: "#efe4c8" });
        if (!w.flags.has("boneGateDone")) {
          w.flags.add("boneGateDone");
          w.toast("🦴", "The grand bone gate is up! Walk through the giant rib cage; the bone doors slam shut on dinos.", best.tx * TILE, best.ty * TILE);
        }
        return best.id === s.id ? "done" : "work";
      }
      if (best.upgrade) {
        // the old logs (or blocks) come down and go back on the stockpile for other jobs
        if (best.built >= 1) {
          const old = wallNeed({ ...best, upgrade: false, upTo: undefined });
          w.camp.stock[old.r] += old.n;
          w.particles.burst(P.Crumb, best.tx * TILE + 16, best.ty * TILE + 16, 5, 40, { z: 10, vz: 40, g: 160, size: 2.5, max: 0.6, color: "#a07a4a" });
          if (!w.flags.has("refundTip")) {
            w.flags.add("refundTip");
            w.toast("♻️", "Upgrading to stone: the old logs go back on the stockpile for other jobs.", best.tx * TILE, best.ty * TILE);
          }
        }
        best.kind = best.upTo ?? "stone";
        best.upTo = undefined;
        best.upgrade = false;
        best.built = 0.01;
      }
      const fast = (w.colony.kits.has("torch") ? 1.5 : 1) * (best.kind === "polygon" && w.colony.kits.has("precision") ? 1.5 : 1);
      best.built = Math.min(1, best.built + dt * 0.9 * fast * (best.kind === "polygon" ? 0.7 : 1));
      chips(w, best.tx * TILE + 16, best.ty * TILE + 16, best.kind === "palisade" ? "#a07a4a" : best.kind === "polygon" ? "#b9b1a2" : "#9a958c", dt);
      if (best.built >= 1) {
        best.hp = wallMaxHp(best);
        best.have = 0;
        w.tribe.version++;
        if (!w.flags.has("firstWall")) {
          w.flags.add("firstWall");
          w.toast("🪵", "A wall! Dinos can't walk through it (but they can bash it…). Add a gate + stairs!", s.x, s.y);
        }
        if (best.part === "gate" && !w.flags.has("firstGate")) {
          w.flags.add("firstGate");
          w.toast("🚪", "Gate built! People use the side door; tap it to open or close it for everyone.", s.x, s.y);
        }
        return best.id === s.id ? "done" : "work";
      }
      return "work";
    }
    case "tower": {
      const t = w.tribe.towers.find((x) => x.id === s.id);
      if (!t) return "done";
      chips(w, t.x, t.y - 30, t.stone || t.up ? "#9a948a" : "#a07a4a", dt);
      if (s.repair) {
        t.hp = Math.min(towerMaxHp(t), t.hp + dt * 40);
        return t.hp >= towerMaxHp(t) ? "done" : "work";
      }
      if (t.up) {
        // rebuild the wooden tower in stone (guards keep using it meanwhile)
        if (!progress(w, s, dt, 6)) return "work";
        t.up = false;
        t.stone = true;
        t.have = 0;
        t.hp = towerMaxHp(t);
        w.tribe.version++;
        w.sfx("build", t.x, t.y, 0.9);
        w.toast("🏰", "Stone tower! Much tougher than wood.", t.x, t.y);
        armTower(w, t);
        return "done";
      }
      if (!progress(w, s, dt, 3.5)) return "work";
      t.stage++;
      t.have = 0;
      w.tribe.version++;
      w.sfx("build", t.x, t.y, 0.8);
      if (t.stage >= towerStages(t).length) {
        t.hp = towerMaxHp(t);
        w.toast(t.stone ? "🏰" : "🗼", t.stone ? "Stone tower finished! Guards climb up to see further and shoot better." : "Watchtower finished! Guards climb up to see further and shoot better. Put a Scorpion on top!", t.x, t.y);
        w.celebrate("Tower!");
        armTower(w, t);
        return "done";
      }
      return "done";
    }
    case "shelter": {
      const sh = w.shelters.find((x) => x.id === s.id);
      if (!sh) return "done";
      chips(w, sh.x, sh.y - 10, "#a07a4a", dt);
      if (!progress(w, s, dt, 3.5)) return "work";
      w.camp.advanceShelter(w, sh);
      return "done";
    }
    case "upgrade": {
      const sh = w.shelters.find((x) => x.id === s.id);
      if (!sh) return "done";
      chips(w, sh.x, sh.y - 10, sh.tier >= 2 ? "#9a958c" : "#a07a4a", dt);
      if (s.repair) {
        sh.hp = Math.min(1, sh.hp + dt * 0.12);
        return sh.hp >= 1 ? "done" : "work";
      }
      if (!progress(w, s, dt, 5)) return "work";
      w.camp.upgradeShelter(w, sh);
      return "done";
    }
    case "building": {
      const b = w.colony.buildings.find((x) => x.id === s.id);
      if (!b) return "done";
      const def = BUILDINGS[b.kind];
      chips(w, b.x, b.y - 12, b.kind === "blacksmith" || b.kind === "path" ? "#9a958c" : "#a07a4a", dt);
      if (s.repair) {
        b.hp = Math.min(def.hp, b.hp + dt * 40);
        return b.hp >= def.hp ? "done" : "work";
      }
      const before = b.built;
      const stoneWork = b.kind === "pyramid" || b.kind === "obelisk" || b.kind === "stoneCircle";
      const fast = (w.colony.kits.has("torch") ? 1.5 : 1) * (stoneWork && w.colony.kits.has("precision") ? 1.5 : 1) * (stoneWork && w.civ.has("levitation") && w.colony.finished("levPad") ? 1.6 : 1);
      // the pyramid's stages each run 0.4 → 1 (it stays solid between stages)
      const span = b.kind === "pyramid" && (b.stage ?? 0) > 0 ? 0.6 : 1;
      b.built = Math.min(1, b.built + (dt * fast * span) / buildingWork(b));
      if (before < 0.4 && b.built >= 0.4) w.colony.version++;
      if (b.built >= 1 && b.kind === "pyramid" && (b.stage ?? 0) < PYRAMID_STAGES.length - 1) {
        const st = PYRAMID_STAGES[(b.stage ?? 0) + 1];
        b.stage = (b.stage ?? 0) + 1;
        b.built = 0.4;
        b.have = {};
        w.colony.version++;
        w.sfx("build", b.x, b.y, 1);
        w.shake(3, 0.4);
        w.toast("🔺", `Pyramid: ${PYRAMID_STAGES[b.stage - 1].name} done! Next: ${st.name}.`, b.x, b.y);
        return "done";
      }
      if (b.built >= 1 && b.kind === "pyramid") {
        // activation needs a charge from the grid
        const need = PYRAMID_STAGES[PYRAMID_STAGES.length - 1].energy ?? 0;
        if (!w.civ.spend(need)) {
          b.built = 0.99;
          if (!w.flags.has("pyramidCharge")) {
            w.flags.add("pyramidCharge");
            w.toast("🔋", `The pyramid needs ${need} stored energy to wake up. Build more energy towers!`, b.x, b.y);
          }
          return "wait";
        }
        w.flash(0.5, "#c8f4ff");
        w.discover("pyramid", b.x, b.y);
        w.celebrate("THE PYRAMID WAKES!");
      }
      if (b.built >= 1) {
        b.hp = def.hp;
        w.colony.version++;
        w.sfx("build", b.x, b.y, 0.8);
        if (b.kind === "spikes" || b.kind === "barricade" || b.kind === "totem") {
          if (!w.flags.has(`built-${b.kind}`)) {
            w.flags.add(`built-${b.kind}`);
            w.toast(def.icon, `${def.name} up! ${def.tip}`, b.x, b.y);
          }
          w.discover("boneDefense", b.x, b.y);
        } else w.toast(def.icon, `${def.name} finished!`, b.x, b.y);
        return "done";
      }
      return "work";
    }
    case "scorpion": {
      const sc = w.colony.scorpions.find((x) => x.id === s.id);
      if (!sc) return "done";
      chips(w, sc.x, sc.y - 10, "#a07a4a", dt);
      if (s.repair) {
        sc.hp = Math.min(SCORPION_TIERS[sc.tier - 1].hp, sc.hp + dt * 40);
        return sc.hp >= SCORPION_TIERS[sc.tier - 1].hp ? "done" : "work";
      }
      if (sc.built < 1) {
        sc.built = Math.min(1, sc.built + dt / 6);
        if (sc.built >= 1) {
          sc.hp = SCORPION_TIERS[0].hp;
          sc.have = {};
          w.colony.version++;
          w.sfx("build", sc.x, sc.y, 0.8);
          w.toast("🎯", "Scorpion ready! Someone has to crew it — guards will jump on it when danger comes.", sc.x, sc.y);
          return "done";
        }
        return "work";
      }
      // upgrade
      if (!progress(w, s, dt, 6)) return "work";
      sc.tier++;
      sc.up = false;
      sc.have = {};
      sc.hp = SCORPION_TIERS[sc.tier - 1].hp;
      w.toast("🎯", `Upgraded to a ${SCORPION_TIERS[sc.tier - 1].name}!`, sc.x, sc.y);
      w.sfx("build", sc.x, sc.y, 0.8);
      return "done";
    }
  }
}

/** All unbuilt wall pieces joined to this one (a stretch the player drew). */
export function wallStretch(w: World, start: Wall): Set<number> {
  const out = new Set<number>([start.id]);
  const pending = (wl: Wall) => wl.built < 1 || wl.upgrade || !!wl.boneUp || wl.hp < wallMaxHp(wl) * 0.6;
  const q = [start];
  while (q.length) {
    const cur = q.pop()!;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const o = w.tribe.wallAt(cur.tx + dx, cur.ty + dy);
        if (!o || out.has(o.id) || !pending(o)) continue;
        out.add(o.id);
        q.push(o);
      }
  }
  return out;
}

export const wallTile = (wl: Wall) => wl.ty * MAP_W + wl.tx;
