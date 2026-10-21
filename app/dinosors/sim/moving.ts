/* ------------------------------------------------------------------ */
/*  Moving buildings + homes: a crew picks it up and carries it.       */
/*                                                                     */
/*  Tap a building (or a home), press Move, tap the new spot. A crew   */
/*  (bigger buildings, more people) walks over and stands round it,    */
/*  everyone heaves it up together, they carry it across the map with  */
/*  it floating along over their heads, and set it down where you      */
/*  picked. Blueprints that aren't built yet just slide over.          */
/*                                                                     */
/*  While it's in the air the building doesn't block anything; its     */
/*  real position only changes when it's set down, so a save in the    */
/*  middle simply keeps it where it was.                               */
/* ------------------------------------------------------------------ */
import { BUILDINGS } from "../data/colony";
import { go, say } from "./humans";
import { shelterTiles } from "./nav";
import { P } from "./particles";
import { pick } from "./rng";
import { issue, type Task } from "./tasks";
import { TILE, type Building, type BuildingKind, type Human, type Shelter } from "./types";
import type { World } from "./world";

export type MoveRef = { kind: "building" | "shelter" | "wall" | "farm"; id: number };

interface SiteJob { ref: MoveRef; fromX: number; fromY: number; toX: number; toY: number; phase: "gather" | "shape" | "place"; t: number }
const siteJobs = new WeakMap<World, Map<number, SiteJob>>();
const sitesOf = (w: World) => { let m = siteJobs.get(w); if (!m) siteJobs.set(w, (m = new Map())); return m; };

interface MoveJob {
  ref: MoveRef;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  phase: "gather" | "lift" | "carry" | "drop" | "done";
  t: number;
  /** how far round the building the crew stands */
  r: number;
}

/** Too big, or not a thing you pick up. */
const FIXED = new Set<BuildingKind>(["bridge", "path", "pyramid", "chamber", "shelterDeep"]);
/** How high a carried building rides over the crew's heads. */
const LIFT_Z = 24;

/** Moves under way, by task id (orders aren't saved: a saved game keeps the building where it was). */
const jobs = new WeakMap<World, Map<number, MoveJob>>();
const jobsOf = (w: World) => {
  let m = jobs.get(w);
  if (!m) jobs.set(w, (m = new Map()));
  return m;
};

function objOf(w: World, ref: MoveRef) {
  if (ref.kind === "building") return w.colony.buildings.find((b) => b.id === ref.id) ?? null;
  if (ref.kind === "shelter") return w.shelters.find((s) => s.id === ref.id) ?? null;
  if (ref.kind === "wall") return w.tribe.walls.find((s) => s.id === ref.id) ?? null;
  return w.tribe.farms.find((s) => s.id === ref.id) ?? null;
}

const at = (w: World, ref: MoveRef) => {
  const o = objOf(w, ref);
  return o && ref.kind === "wall" ? { x: (o as import("./types").Wall).tx * TILE + TILE / 2, y: (o as import("./types").Wall).ty * TILE + TILE / 2 } : o ? { x: (o as Building | Shelter | import("./types").Farm).x, y: (o as Building | Shelter | import("./types").Farm).y } : null;
};

/** People needed to carry it. */
export function crewSize(w: World, ref: MoveRef) {
  if (ref.kind === "wall" || ref.kind === "farm") return ref.kind === "wall" ? 2 : 1;
  if (ref.kind === "shelter") return 4;
  const b = objOf(w, ref) as Building | null;
  if (!b) return 2;
  const def = BUILDINGS[b.kind];
  return Math.max(2, Math.min(6, 2 + Math.floor((def.w * def.h) / 2)));
}

export function canMove(w: World, ref: MoveRef): string | null {
  const o = objOf(w, ref);
  if (!o) return "It's gone.";
  if (ref.kind === "wall" || ref.kind === "farm") {
    if (ref.kind === "wall") {
      const wl = o as import("./types").Wall;
      if (w.colony.scorpions.some((s) => s.mount === "wall" && s.tx === wl.tx && s.ty === wl.ty)) return "Move the Scorpion off this wall first.";
    }
    if (Array.from(sitesOf(w).values()).some((j) => j.ref.kind === ref.kind && j.ref.id === ref.id)) return "It's already being moved.";
    return null;
  }
  if (ref.kind === "building" && FIXED.has((o as Building).kind)) return `The ${BUILDINGS[(o as Building).kind].name.toLowerCase()} is far too big (or too rooted) to pick up.`;
  if ((o as Building | Shelter).lift || Array.from(jobsOf(w).values()).some((j) => j.ref.id === ref.id && j.phase !== "done")) return "It's already being moved.";
  return null;
}

/** Can it go down at (x, y)? (Checked as if it weren't standing where it is now.) */
export function moveSpotOk(w: World, ref: MoveRef, x: number, y: number): string | null {
  const o = objOf(w, ref);
  if (!o) return "It's gone.";
  if (ref.kind === "wall") return w.tribe.relocateWall(w, o as import("./types").Wall, Math.floor(x / TILE), Math.floor(y / TILE), true) ? null : "That wall needs clear, solid ground.";
  if (ref.kind === "farm") return w.tribe.relocateFarm(w, o as import("./types").Farm, x, y, true) ? null : "That farm needs clear, fertile ground.";
  const movable = o as Building | Shelter;
  const had = movable.lift;
  movable.lift = { x: movable.x, y: movable.y, z: 0 };
  let why: string | null = null;
  if (ref.kind === "building") why = w.colony.canPlace(w, (o as Building).kind, x, y);
  else {
    const occ = w.colony.occupied(w);
    for (const i of shelterTiles(x, y)) {
      const px = (i % 160) * TILE + TILE / 2;
      if (occ.has(i) || !w.nav.passable("human", px, y)) {
        why = "Not enough clear ground there for a home.";
        break;
      }
    }
  }
  movable.lift = had;
  return why;
}

/** Give the order: a crew comes to carry it to (x, y). Returns why not, or null. */
export function startMove(w: World, ref: MoveRef, x: number, y: number, people?: Human[]): string | null {
  const o = objOf(w, ref);
  const no = canMove(w, ref) ?? moveSpotOk(w, ref, x, y);
  if (no || !o) return no ?? "It's gone.";
  if (ref.kind === "wall" || ref.kind === "farm") {
    const origin = at(w, ref)!;
    const target = ref.kind === "wall" ? { x: Math.floor(x / TILE) * TILE + TILE / 2, y: Math.floor(y / TILE) * TILE + TILE / 2 } : { x, y };
    if (Math.hypot(origin.x - target.x, origin.y - target.y) < 8) return null;
    const need = crewSize(w, ref);
    const crew = (people?.length ? people : w.humans).filter((h) => !h.child && !h.stranger && !h.captive && !h.under && !h.aloft && !h.riding && h.state !== "down" && h.hp > 0.3)
      .sort((a, b) => (a.taskId ? 400 : 0) - (b.taskId ? 400 : 0) + Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y)).slice(0, need);
    if (!crew.length) return "Nobody is free to reshape it.";
    const label = ref.kind === "wall" ? "Reshape the wall" : "Move the farm";
    const task = issue(w, crew, { kind: "moveBuilding", icon: "🔷", label, x: target.x, y: target.y, target: ref.id });
    if (!task) return "Nobody is free to reshape it.";
    sitesOf(w).set(task.id, { ref, fromX: origin.x, fromY: origin.y, toX: target.x, toY: target.y, phase: "gather", t: 0 });
    w.toast("🔷", `${crew.length} ${crew.length === 1 ? "worker is" : "workers are"} on the way to ${ref.kind === "wall" ? "levitate and reshape the stones" : "move the farm"}.`, origin.x, origin.y);
    return null;
  }
  const movable = o as Building | Shelter;
  // a blueprint that isn't built yet just slides over
  const built = ref.kind === "building" ? (o as Building).built > 0.02 : (o as Shelter).stage > 0;
  if (!built) {
    place(w, ref, movable, x, y);
    return null;
  }
  const need = crewSize(w, ref);
  const crew = (people?.length ? people : w.humans)
    .filter((h) => !h.child && !h.stranger && !h.captive && !h.under && !h.aloft && !h.riding && h.state !== "down" && h.hp > 0.3)
    .sort((a, b) => (people?.length ? 0 : (a.taskId ? 400 : 0) - (b.taskId ? 400 : 0)) + Math.hypot(a.x - movable.x, a.y - movable.y) - Math.hypot(b.x - movable.x, b.y - movable.y))
    .slice(0, need);
  if (!crew.length) return "Nobody is free to carry it.";
  const name = ref.kind === "building" ? BUILDINGS[(o as Building).kind].name.toLowerCase() : "home";
  const t = issue(w, crew, { kind: "moveBuilding", icon: "🚚", label: `Carry the ${name}`, x, y, target: o.id });
  if (!t) return "Nobody is free to carry it.";
  const def = ref.kind === "building" ? BUILDINGS[(o as Building).kind] : null;
  jobsOf(w).set(t.id, { ref, fromX: movable.x, fromY: movable.y, toX: x, toY: y, phase: "gather", t: 0, r: def ? Math.max(24, def.w * TILE * 0.5 + 6) : 30 });
  w.toast("🚚", `${crew.length} ${crew.length === 1 ? "person is" : "people are"} coming to pick up the ${name}${crew.length < need ? ` (it really needs ${need})` : ""}.`, movable.x, movable.y);
  return null;
}

/** Where crew member i of n stands round a centre (spots on blocked ground move round to the front). */
function slot(w: World, job: MoveJob, i: number, n: number, cx: number, cy: number) {
  const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.6;
  const s = { x: cx + Math.cos(a) * job.r, y: cy + 6 + Math.sin(a) * job.r * 0.5 };
  if (w.nav.passable("human", s.x, s.y)) return s;
  const front = { x: cx + (i - (n - 1) / 2) * 16, y: cy + 16 };
  return w.nav.passable("human", front.x, front.y) ? front : { x: cx + (i - (n - 1) / 2) * 16, y: cy + 34 };
}

/** Close enough to grab hold (exact spots can be awkward round big buildings). */
const atHand = (job: MoveJob, p: Human, s: { x: number; y: number }, cx: number, cy: number) => Math.hypot(p.x - s.x, p.y - s.y) < 12 || Math.hypot(p.x - cx, (p.y - cy) * 1.4) < job.r + 26;

/** One crew member's part (from taskThink). */
export function moveThink(w: World, h: Human, t: Task, done: () => void): boolean {
  const site = sitesOf(w).get(t.id);
  if (site) {
    if (!objOf(w, site.ref)) { done(); return false; }
    const x = site.phase === "gather" ? site.fromX : site.toX;
    const y = site.phase === "gather" ? site.fromY : site.toY;
    if (Math.hypot(h.x - x, h.y - y) > 22) go(h, "walk", x, y + 18);
    else go(h, "lift", h.x, h.y);
    return true;
  }
  const job = jobsOf(w).get(t.id);
  if (!job || job.phase === "done" || !objOf(w, job.ref)) {
    done();
    return false;
  }
  const crew = w.humans.filter((p) => t.people.includes(p.id));
  const i = crew.indexOf(h);
  if (job.phase === "gather") {
    const s = slot(w, job, i, crew.length, job.fromX, job.fromY);
    if (!atHand(job, h, s, job.fromX, job.fromY) || (Math.hypot(h.x - s.x, h.y - s.y) > 8 && h.state !== "lift" && h.state !== "walk")) go(h, "walk", s.x, s.y);
    else {
      go(h, "lift", s.x, s.y);
      h.dir = job.fromX > h.x ? 1 : -1;
    }
    return true;
  }
  if (job.phase === "lift" || job.phase === "drop") {
    if (h.state !== "lift") go(h, "lift", h.x, h.y);
    return true;
  }
  // carrying: walk your corner of it over to the new spot
  const s = slot(w, job, i, crew.length, job.toX, job.toY);
  if (Math.hypot(h.x - s.x, h.y - s.y) > 6) go(h, "walk", s.x, s.y);
  else go(h, "lift", s.x, s.y);
  return true;
}

/** Per frame: crews heave, carry and set down; the building rides along over their heads. */
export function moveTick(w: World, dt: number) {
  for (const [id, job] of Array.from(sitesOf(w).entries())) {
    const task = w.tasks.get(id);
    const crew = task ? w.humans.filter((p) => task.people.includes(p.id) && p.state !== "down") : [];
    if (!crew.length || !objOf(w, job.ref)) { sitesOf(w).delete(id); continue; }
    job.t += dt;
    if (job.phase === "gather" && (crew.every((p) => Math.hypot(p.x - job.fromX, p.y - job.fromY) < 38) || job.t > 12)) {
      job.phase = "shape"; job.t = 0;
      w.particles.burst(P.Dust, job.fromX, job.fromY, 18, 65, { size: 9, max: 0.9, color: "rgba(155,185,240,0.8)" });
      w.sfx("whoosh", job.fromX, job.fromY, 0.7);
    } else if (job.phase === "shape" && job.t > 0.65) { job.phase = "place"; job.t = 0; }
    else if (job.phase === "place" && (crew.every((p) => Math.hypot(p.x - job.toX, p.y - job.toY) < 38) || job.t > 14)) {
      const o = objOf(w, job.ref);
      const ok = job.ref.kind === "wall" ? !!o && w.tribe.relocateWall(w, o as import("./types").Wall, Math.floor(job.toX / TILE), Math.floor(job.toY / TILE))
        : !!o && w.tribe.relocateFarm(w, o as import("./types").Farm, job.toX, job.toY);
      if (!ok) w.toast("🔷", "The new spot is blocked; the pieces stayed where they were.", job.toX, job.toY);
      else {
        w.particles.burst(P.Dust, job.toX, job.toY, 18, 65, { size: 9, max: 0.9, color: "rgba(155,185,240,0.8)" });
        w.sfx("thud", job.toX, job.toY, 0.7);
        w.toast("🔷", job.ref.kind === "wall" ? "Stones reshaped in place." : "Farm moved and replanted.", job.toX, job.toY);
      }
      sitesOf(w).delete(id);
      for (const p of crew) { p.think = 0; if (p.state === "lift") go(p, "idle", p.x, p.y); }
    }
    else if (job.phase === "place" && w.rng() < dt * 10) {
      const progress = Math.min(1, job.t / 3);
      const x = job.fromX + (job.toX - job.fromX) * progress;
      const y = job.fromY + (job.toY - job.fromY) * progress;
      w.particles.burst(P.Dust, x, y - 22, 2, 15, { size: 5, max: 0.45, color: "rgba(155,185,240,0.8)" });
    }
  }
  const all = jobsOf(w);
  for (const [id, job] of Array.from(all.entries())) {
    const t = w.tasks.get(id);
    const o = objOf(w, job.ref) as Building | Shelter | null;
    const crew = t ? w.humans.filter((p) => t.people.includes(p.id) && p.state !== "down") : [];
    if (!o || !crew.length) {
      // the crew is gone: it stays (or is set back down) where it was
      if (o) {
        o.lift = undefined;
        w.colony.version++;
        w.shelterVersion++;
      }
      all.delete(id);
      continue;
    }
    job.t += dt;
    switch (job.phase) {
      case "gather": {
        const ready = crew.filter((p, i) => atHand(job, p, slot(w, job, i, crew.length, job.fromX, job.fromY), job.fromX, job.fromY)).length;
        if (ready === crew.length || (job.t > 30 && ready >= 1)) {
          job.phase = "lift";
          job.t = 0;
          // anyone indoors steps out first
          if (job.ref.kind === "shelter") for (const p of w.humans) if ((p.state === "sleep" || p.state === "hide" || p.state === "rest") && Math.hypot(p.x - o.x, p.y - o.y) < 30) go(p, "idle", p.x + 30, p.y + 20);
          for (const p of crew) if (w.rng() < 0.7) say(p, pick(w.rng, ["Lift!", "Heave!", "One, two, three!", "Hup!"]));
          w.sfx("grunt", o.x, o.y, 0.7);
        }
        break;
      }
      case "lift": {
        const k = Math.min(1, job.t / 1.2);
        o.lift = { x: o.x, y: o.y, z: LIFT_Z * k };
        if (k >= 1) {
          job.phase = "carry";
          job.t = 0;
          w.colony.version++;
          w.shelterVersion++;
          w.particles.burst(P.Dust, o.x, o.y, 10, 50, { size: 10, max: 0.7, color: "rgba(160,130,90,0.55)" });
        }
        break;
      }
      case "carry": {
        // the building floats over the middle of the crew, bobbing with their steps
        let cx = 0;
        let cy = 0;
        for (const p of crew) {
          cx += p.x;
          cy += p.y;
        }
        cx /= crew.length;
        cy = cy / crew.length - 6;
        const lx = o.lift?.x ?? o.x;
        const ly = o.lift?.y ?? o.y;
        const k = Math.min(1, dt * 6);
        o.lift = { x: lx + (cx - lx) * k, y: ly + (cy - ly) * k, z: LIFT_Z + Math.sin(w.elapsed * 9) * 1.5 };
        const there = crew.every((p, i) => atHand(job, p, slot(w, job, i, crew.length, job.toX, job.toY), job.toX, job.toY));
        if (there || job.t > 120) {
          job.phase = "drop";
          job.t = 0;
          for (const p of crew) if (w.rng() < 0.6) say(p, pick(w.rng, ["Down!", "Gently…", "Here!"]));
        }
        if (w.rng() < dt * 0.4) say(crew[Math.floor(w.rng() * crew.length)], pick(w.rng, ["Heavy!", "Watch your feet!", "Left… left…", "Nearly there!"]));
        break;
      }
      case "drop": {
        const k = Math.max(0, 1 - job.t / 0.8);
        o.lift = { x: o.lift?.x ?? job.toX, y: o.lift?.y ?? job.toY, z: LIFT_Z * k };
        if (k <= 0) {
          let x = job.toX;
          let y = job.toY;
          // something got built there meanwhile: the nearest clear spot (else back where it came from)
          if (moveSpotOk(w, job.ref, x, y)) {
            const alt = nearbySpot(w, job.ref, x, y);
            x = alt?.x ?? job.fromX;
            y = alt?.y ?? job.fromY;
          }
          place(w, job.ref, o, x, y);
          w.particles.burst(P.Dust, o.x, o.y, 14, 60, { size: 12, max: 0.8, color: "rgba(160,130,90,0.6)" });
          w.sfx("thud", o.x, o.y, 0.9);
          for (const p of crew) if (w.rng() < 0.5) p.bubble = { text: pick(w.rng, ["Done!", "Ta-da!", "Phew!"]), t: 1.6 };
          job.phase = "done";
          all.delete(id);
          if (t) {
            for (const p of crew) {
              p.think = 0;
              if (p.state === "lift") go(p, "idle", p.x, p.y);
            }
          }
        }
        break;
      }
    }
  }
}

function nearbySpot(w: World, ref: MoveRef, x: number, y: number) {
  for (let r = TILE; r <= TILE * 5; r += TILE) for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (!moveSpotOk(w, ref, px, py)) return { x: px, y: py };
  }
  return null;
}

/** Put it down at (x, y) for real. */
function place(w: World, ref: MoveRef, o: Building | Shelter, x: number, y: number) {
  o.lift = undefined;
  if (ref.kind === "building") {
    const b = o as Building;
    const def = BUILDINGS[b.kind];
    const fp = w.colony.footprint(b.kind, x, y);
    b.tx = fp.tx;
    b.ty = fp.ty;
    b.x = (fp.tx + fp.w / 2) * TILE;
    b.y = (fp.ty + fp.h) * TILE - (def.solid ? 0 : TILE / 2);
  } else {
    o.x = x;
    o.y = y;
  }
  w.colony.version++;
  w.shelterVersion++;
  w.nav.sync(w);
}

/** Is this person busy carrying (for the pose)? */
export const carrying = (w: World, h: Human) => w.tasks.get(h.taskId)?.kind === "moveBuilding";
