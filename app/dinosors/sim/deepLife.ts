/* ------------------------------------------------------------------ */
/*  The Deep, Phase 5: milestones, landmarks and cave life.            */
/*                                                                    */
/*  - Depth milestones pay out once each (gifts + a sticker).          */
/*  - Dug-out landmarks (mother lode, giant skeleton, resonant geode,  */
/*    meteor core) reward the tribe — more on the matching civ path.  */
/*  - Troglodons: blind cave lizards that wake when a cavern is        */
/*    breached. They hunt miners in the dark, hate lamplight, and the  */
/*    crew fights back (better with weapons).                          */
/* ------------------------------------------------------------------ */
import { LANDMARKS, MILESTONES, MINE_W, TROG, type LandmarkKind } from "../data/mine";
import { finished, lit } from "./deepBuild";
import { N, idx, type Mine } from "./mine";
import { hurtMiner, type Miner } from "./miners";
import type { Resource } from "./types";
import type { World } from "./world";

export interface Critter {
  id: number;
  x: number;
  y: number;
  hp: number;
  face: 1 | -1;
  path: number[];
  pi: number;
  thinkT: number;
  biteT: number;
  /** seconds hit-flash */
  hit: number;
  anim: number;
}

const cx = (i: number) => i % MINE_W;
const cy = (i: number) => Math.floor(i / MINE_W);
const cellOf = (o: { x: number; y: number }) => idx(Math.floor(o.x), Math.floor(o.y));
const gift = (w: World, g: Partial<Record<Resource, number>>) => {
  for (const [r, n] of Object.entries(g) as [Resource, number][]) w.camp.stock[r] += n;
};

export function updateDeepLife(w: World, dt: number) {
  const mine = w.mine;
  milestones(w);
  village(w);
  if (mine.critters.length) critters(w, dt);
}

/* ------------------------------ milestones ------------------------------ */

function milestones(w: World) {
  const mine = w.mine;
  for (const m of MILESTONES) {
    if (mine.milestones.has(m.id) || mine.stats.deepest < m.row) continue;
    mine.milestones.add(m.id);
    gift(w, m.gift);
    w.toast(m.icon, `${m.name}! ${m.text} (${Object.entries(m.gift).map(([r, n]) => `+${n} ${r}`).join(", ")})`);
    w.discover(m.id);
    w.celebrate(m.name);
  }
}

function village(w: World) {
  const mine = w.mine;
  if (w.discoveries.has("deepVillage") || mine.builds.length < 3) return;
  const has = (k: string) => mine.builds.some((b) => b.kind === k && finished(b));
  if (has("home") && has("vault") && has("mushroom")) {
    w.discover("deepVillage");
    w.toast("🏘️", "A real village under the ground: homes, a vault and a farm in the Deep!");
  }
}

/* ------------------------------ landmarks ------------------------------ */

/** Called when a landmark is first broken into, and when its last cell is dug. */
export function landmarkEvent(w: World, kind: LandmarkKind, first: boolean, done: boolean) {
  const mine = w.mine;
  const L = LANDMARKS[kind];
  if (first && !done) w.toast(L.icon, `${L.name}! ${L.signal}`);
  if (!done || mine.landmarksDone.has(kind)) return;
  mine.landmarksDone.add(kind);
  const res = w.civ.path === "resonance";
  const old = w.civ.path === "traditional";
  switch (kind) {
    case "lode":
      gift(w, { iron: old ? 18 : 12 });
      w.discover("motherLode");
      w.toast(L.icon, `${L.done} (+${old ? 18 : 12} iron${old ? " — the Old Ways know how to use it" : ""})`);
      break;
    case "skeleton":
      gift(w, { bone: 10, tooth: 4 });
      w.addItem("fossil", w.camp.x + 70, w.camp.y + 40, { species: "brachio" });
      w.discover("giantFossil");
      w.toast(L.icon, `${L.done} One bone was carried up to show off at camp.`);
      break;
    case "geode":
      if (res) {
        w.civ.energy = Math.max(w.civ.energy, Math.min(w.civ.cap + 150, w.civ.energy + 150));
        w.civ.tuned.add("crystal");
        w.toast(L.icon, `${L.done} It rings in tune with your Resonance: +150 energy and crystal is now perfectly tuned!`);
      } else {
        gift(w, { crystal: 6 });
        w.toast(L.icon, `${L.done} (+6 crystal)`);
      }
      w.discover("geode");
      break;
    case "core":
      gift(w, res ? { meteorite: 4 } : { gold: 4 });
      if (res) w.civ.energy += 250;
      w.discover("meteorCore");
      w.toast(L.icon, `${L.done}${res ? " Your Resonance grid drinks in its power: +250 energy!" : " (+4 gold)"}`);
      break;
  }
  w.celebrate(L.name);
}

/* ------------------------------ troglodons ------------------------------ */

/** A breached cavern wakes 1–2 troglodons a little way inside it. */
export function wakeCavern(w: World, at: number) {
  const mine = w.mine;
  if (cy(at) < 30 || mine.critters.length >= 6) return;
  const n = mine.rand() < 0.5 ? 1 : mine.rand() < 0.7 ? 0 : 2;
  if (!n) return;
  const spots = within(mine, at, 4, 12);
  for (let k = 0; k < n && spots.length; k++) {
    const s = spots.splice(Math.floor(mine.rand() * spots.length), 1)[0];
    mine.critters.push({ id: mine.nextCritterId++, x: cx(s) + 0.5, y: cy(s) + 0.5, hp: TROG.hp, face: 1, path: [], pi: 0, thinkT: 2 + mine.rand() * 2, biteT: 0, hit: 0, anim: mine.rand() * 10 });
  }
  if (!w.flags.has("trogWarn")) {
    w.flags.add("trogWarn");
    w.toast("🦎", "Something pale moved in the cavern… Troglodons live down here. They hate lamplight.");
  }
}

/** Open, dark cells a troglodon could walk (they won't step into lamplight). */
function dark(mine: Mine, i: number) {
  const x = cx(i);
  const y = cy(i);
  return mine.passable(x, y) && x !== 4 && !lit(mine, x, y) && !mine.buildAt.has(i);
}

function within(mine: Mine, from: number, dmin: number, dmax: number) {
  const out: number[] = [];
  const dist = new Map([[from, 0]]);
  const q = [from];
  for (let h = 0; h < q.length && h < 900; h++) {
    const i = q[h];
    const d = dist.get(i)!;
    if (d >= dmin && d <= dmax && dark(mine, i)) out.push(i);
    if (d >= dmax) continue;
    for (const j of [i - 1, i + 1, i - MINE_W, i + MINE_W]) {
      if (j < 0 || j >= N || dist.has(j) || !mine.passable(cx(j), cy(j))) continue;
      dist.set(j, d + 1);
      q.push(j);
    }
  }
  return out;
}

function pathTo(mine: Mine, from: number, goal: (i: number) => boolean, max = 600): number[] | null {
  const prev = new Map([[from, from]]);
  const q = [from];
  for (let h = 0; h < q.length && h < max; h++) {
    const i = q[h];
    if (i !== from && goal(i)) {
      const out: number[] = [];
      for (let k = i; k !== from; k = prev.get(k)!) out.push(k);
      return out.reverse();
    }
    for (const j of [i - 1, i + 1, i - MINE_W, i + MINE_W]) {
      if (j < 0 || j >= N || prev.has(j) || !dark(mine, j)) continue;
      prev.set(j, i);
      q.push(j);
    }
  }
  return null;
}

function critters(w: World, dt: number) {
  const mine = w.mine;
  for (const c of [...mine.critters]) {
    c.anim += dt;
    c.hit = Math.max(0, c.hit - dt);
    c.biteT = Math.max(0, c.biteT - dt);
    const here = cellOf(c);
    // caught in lamplight (or a cave-in): scurry off, or vanish into a crack
    if (!dark(mine, here)) {
      const out = pathTo(mine, here, (i) => dark(mine, i), 200);
      if (out) {
        c.path = out;
        c.pi = 0;
      } else if (!mine.passable(cx(here), cy(here)) || lit(mine, cx(here), cy(here))) {
        mine.critters.splice(mine.critters.indexOf(c), 1);
        continue;
      }
    }
    // the closest miner in the dark
    let prey: Miner | null = null;
    let pd = TROG.sense;
    for (const m of mine.crew) {
      const d = Math.max(Math.abs(m.x - c.x), Math.abs(m.y - c.y));
      if (d < pd && !lit(mine, Math.floor(m.x), Math.floor(m.y))) {
        pd = d;
        prey = m;
      }
    }
    if (prey && Math.hypot(prey.x - c.x, prey.y - c.y) < 1.25) {
      c.face = prey.x > c.x ? 1 : -1;
      c.path = [];
      if (c.biteT <= 0) {
        c.biteT = TROG.biteEvery;
        mine.sfx.push({ s: "chomp", cell: here });
        prey.bubble = { text: "A troglodon!", t: 1.6 };
        hurtMiner(w, prey, TROG.bite, "bite");
      }
    } else {
      c.thinkT -= dt;
      if (c.thinkT <= 0 || (prey && !c.path.length)) {
        c.thinkT = 0.9 + mine.rand() * 0.6;
        if (prey) {
          const target = cellOf(prey);
          const p = pathTo(mine, here, (i) => Math.abs(cx(i) - cx(target)) + Math.abs(cy(i) - cy(target)) <= 1);
          if (p) {
            c.path = p;
            c.pi = 0;
          }
        } else if (mine.rand() < 0.4) {
          const spots = within(mine, here, 2, 6);
          if (spots.length) {
            const s = spots[Math.floor(mine.rand() * spots.length)];
            const p = pathTo(mine, here, (i) => i === s);
            if (p) {
              c.path = p;
              c.pi = 0;
            }
          }
        }
      }
      if (c.path.length && c.pi < c.path.length) {
        const to = c.path[c.pi];
        const tx = cx(to) + 0.5;
        const ty = cy(to) + 0.5;
        const dx = tx - c.x;
        const dy = ty - c.y;
        const d = Math.hypot(dx, dy);
        const sp = TROG.speed * (prey ? 1.4 : 1);
        if (dx) c.face = dx > 0 ? 1 : -1;
        if (d <= sp * dt) {
          c.x = tx;
          c.y = ty;
          c.pi++;
          if (c.pi < c.path.length && !dark(mine, c.path[c.pi])) c.path = [];
        } else {
          c.x += (dx / d) * sp * dt;
          c.y += (dy / d) * sp * dt;
        }
      }
    }
    // the crew fights back
    for (const m of mine.crew) {
      if (Math.hypot(m.x - c.x, m.y - c.y) > 1.35) continue;
      m.fightT = (m.fightT ?? 0) + dt;
      if (m.fightT < 1.1) continue;
      m.fightT = 0;
      const h = w.humans.find((x) => x.id === m.id);
      const wp = h ? w.tribe.weaponFor(w, h) : null;
      c.hp -= 0.3 * (wp ? 1 + wp.tier * 0.35 : 1);
      c.hit = 0.25;
      m.face = c.x > m.x ? 1 : -1;
      mine.sfx.push({ s: "thunk", cell: here });
      if (c.hp <= 0) {
        mine.critters.splice(mine.critters.indexOf(c), 1);
        for (const [r, n] of Object.entries(TROG.loot) as [Resource, number][]) m.carry[r] = (m.carry[r] ?? 0) + n;
        m.bubble = { text: "Got it!", t: 1.6 };
        mine.stats.trogs = (mine.stats.trogs ?? 0) + 1;
        if (!w.discoveries.has("troglodon")) {
          w.discover("troglodon");
          w.toast("🦎", `${h?.name ?? "A miner"} fought off a troglodon! Its hide and bones go up the lift.`);
        }
        break;
      }
    }
  }
}

export { cellOf as critterCell };
