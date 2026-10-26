/* ------------------------------------------------------------------ */
/*  Mountain Monks: a small, completely peaceful order living in a     */
/*  high valley of the Great Peaks.                                    */
/*                                                                     */
/*  • Protected: they are their own kind (never Humans, Brutes or      */
/*    Dinos), so no fighter, predator, dragon, Scorpion, raid or wild  */
/*    beast ever picks them as a target, and they never fight anyone.  */
/*    `isProtected` is the rule anything new should check.             */
/*  • Up to about ten of them. They live together round a few stone    */
/*    huts, a shrine with a bell, and lines of prayer flags; they walk */
/*    the mountain paths in a procession (one leader with a lantern,   */
/*    the rest following in a line along the trail they leave),       */
/*    meditate in a ring, and watch the sky at dusk.                   */
/*  • New monks come as pilgrims up the valleys, one at a time.        */
/*  • Once a year, on the last day of winter, they climb to the high   */
/*    ledge and offer themselves to the dragons: a quiet ceremony of   */
/*    light. A dragon comes down, the monks walk into the light one    */
/*    by one and are gone with it, and the two eldest walk home to     */
/*    start again. Fantasy, and shown that way: no harm is ever drawn. */
/*                                                                     */
/*  Cheap: at most ~10 of them, one shared trail for the procession,   */
/*  and when nobody is looking they tick four times a second.          */
/* ------------------------------------------------------------------ */
import { BREEDS, DRAGON_NAMES } from "../data/dragons";
import { nodePos } from "./nav";
import { P } from "./particles";
import { makeRng, pick, type Rng } from "./rng";
import { YEAR_DAYS } from "./seasons";
import { LM } from "./terrain";
import { TILE, type Dragon } from "./types";
import type { World } from "./world";

export const MAX_MONKS = 10;
/** the eldest stay home from the offering and start the order again */
const ELDERS = 2;
const WALK = 22;
/** pilgrims arrive about this often (s) while there's room */
const PILGRIM_EVERY = [170, 280] as const;
const MONK_NAMES = ["Tenzin", "Norbu", "Kalsang", "Pema", "Dawa", "Jigme", "Lhamo", "Sonam", "Tashi", "Yeshe", "Karma", "Dorje", "Nima", "Chodak", "Rinchen", "Wangmo"];

export type MonkState = "walk" | "sit" | "meditate" | "gaze" | "sleep" | "kneel" | "ascend" | "chant";

export interface Monk {
  id: number;
  kind: "monk";
  name: string;
  x: number;
  y: number;
  /** height off the ground (rising into the light at the offering) */
  z: number;
  dir: 1 | -1;
  state: MonkState;
  stateT: number;
  anim: number;
  tx: number;
  ty: number;
  /** place in the procession (0 = the leader) */
  slot: number;
  /** robe shade (saffron … maroon) */
  robe: number;
  age: number;
  /** 0..1 how far into the light (the offering) */
  glow: number;
  /** a pilgrim still on the way up */
  pilgrim?: boolean;
  path?: number[] | null;
  pathI?: number;
  bubble: { text: string; t: number } | null;
}

export interface MonkPlace {
  x: number;
  y: number;
  kind: "hut" | "shrine" | "flags" | "altar" | "cairn";
}

type Activity = "rest" | "meditate" | "walk" | "gaze" | "sleep" | "rite";

export interface MonkRite {
  phase: "gather" | "climb" | "call" | "offer" | "depart" | "return";
  t: number;
  dragon: number;
  /** a dragon that came only for the rite (it leaves afterwards) */
  visitor: boolean;
  offered: number;
}

/** Walks round the high valley (tile coords): out and back along the carved paths. */
const ROUTES: [number, number][][] = [
  [[240, 41], [237, 44], [244, 47]],
  [[234, 46], [224, 47], [234, 46]],
  [[245, 55], [244, 63], [245, 54]],
  [[250, 38], [254, 29], [250, 38]],
];
const ALTAR_ROUTE: [number, number][] = [[250, 37], [254, 28], [LM.altar.x, LM.altar.y + 1]];
/** where pilgrims start up the valleys */
const PILGRIM_FROM: [number, number][] = [[208, 50], [239, 86], [284, 57]];

const T2P = (p: [number, number]) => ({ x: p[0] * TILE + TILE / 2, y: p[1] * TILE + TILE / 2 });

/** Nobody may target these (the global neutrality rule): Mountain Monks, and dragons answering their rite. */
export function isProtected(e: { kind: string; monkRite?: boolean }) {
  return e.kind === "monk" || !!e.monkRite;
}

export class Monks {
  list: Monk[] = [];
  places: MonkPlace[] = [];
  rite: MonkRite | null = null;
  /** the last year they made their offering */
  lastRite = -1;
  /** our people have found the monastery */
  found = false;
  seeded = false;
  /** off in bare test worlds */
  enabled = true;
  rng: Rng;
  activity: Activity = "rest";
  /** the procession's route (world px) + how far along it the leader is */
  route: { x: number; y: number }[] = [];
  leg = 0;
  /** the leader's footsteps (followers walk along them) */
  trail: { x: number; y: number }[] = [];
  private ids = 7e8;
  private pilgrimT = 120;
  private acc = 0;
  private lastActivityAt = -999;

  constructor(seed = 1) {
    this.rng = makeRng(seed * 71 + 13);
  }

  get home() {
    return T2P([LM.monastery.x, LM.monastery.y]);
  }

  get altar() {
    return T2P([LM.altar.x, LM.altar.y]);
  }

  byId(id: number) {
    return this.list.find((m) => m.id === id) ?? null;
  }

  /* ------------------------------ setting up ------------------------------ */

  /** The monastery: huts, a shrine, prayer flags, the altar ledge, and the first monks. */
  seed(w: World) {
    this.seeded = true;
    if (!this.enabled) return;
    const h = this.home;
    const at = (dx: number, dy: number) => this.groundNear(w, h.x + dx, h.y + dy);
    this.places = [];
    for (const [dx, dy] of [[-120, -50], [-30, -80], [70, -60]] as const) {
      const p = at(dx, dy);
      if (p) this.places.push({ ...p, kind: "hut" });
    }
    const shrine = at(10, 30);
    if (shrine) this.places.push({ ...shrine, kind: "shrine" });
    const flags = at(-90, 40);
    if (flags) this.places.push({ ...flags, kind: "flags" });
    const cairn = at(140, 10);
    if (cairn) this.places.push({ ...cairn, kind: "cairn" });
    const a = this.groundNear(w, this.altar.x, this.altar.y) ?? this.altar;
    this.places.push({ ...a, kind: "altar" });
    const n = 6 + Math.floor(this.rng() * 2);
    for (let i = 0; i < n; i++) this.add(h.x + (this.rng() - 0.5) * 120, h.y + 30 + (this.rng() - 0.5) * 50, 40 + this.rng() * 40);
    this.restack();
  }

  /** Open ground near a spot (the snowfields + meadows of the valley), or null. */
  private groundNear(w: World, x: number, y: number) {
    for (let r = 0; r < 200; r += 16) {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + r;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r * 0.7;
        if (w.nav.passable("dino", px, py)) return { x: Math.round(px), y: Math.round(py) };
      }
    }
    return null;
  }

  private add(x: number, y: number, age: number, o: Partial<Monk> = {}): Monk {
    const used = new Set(this.list.map((m) => m.name));
    const free = MONK_NAMES.filter((n) => !used.has(n));
    const m: Monk = {
      id: this.ids++,
      kind: "monk",
      name: pick(this.rng, free.length ? free : MONK_NAMES),
      x,
      y,
      z: 0,
      dir: this.rng() < 0.5 ? 1 : -1,
      state: "sit",
      stateT: 0,
      anim: this.rng() * 10,
      tx: x,
      ty: y,
      slot: 0,
      robe: Math.floor(this.rng() * 3),
      age,
      glow: 0,
      bubble: null,
      ...o,
    };
    this.list.push(m);
    return m;
  }

  /** Eldest first: the eldest leads the procession. */
  private restack() {
    const settled = this.list.filter((m) => !m.pilgrim).sort((a, b) => b.age - a.age);
    settled.forEach((m, i) => (m.slot = i));
  }

  /* ------------------------------ per frame ------------------------------ */

  update(w: World, dt: number) {
    if (!this.enabled) return;
    if (!this.seeded) this.seed(w);
    if (!this.list.length && !this.places.length) return;
    // nobody watching: four times a second is plenty
    const near = w.inView(this.home.x, this.home.y, 1600) || (this.rite && w.inView(this.altar.x, this.altar.y, 1600));
    this.acc += dt;
    if (!near && this.acc < 0.25) return;
    const step = this.acc;
    this.acc = 0;
    for (const m of this.list) {
      m.age += step / 60;
      m.stateT += step;
      if (m.bubble) {
        m.bubble.t -= step;
        if (m.bubble.t <= 0) m.bubble = null;
      }
    }
    this.findTick(w);
    this.pilgrims(w, step);
    // the day before: word goes round; the day itself: the offering
    const year = Math.floor((w.day - 1) / YEAR_DAYS);
    if (this.found && (w.day - 1) % YEAR_DAYS === YEAR_DAYS - 2 && w.time > 9 && !w.flags.has(`monkRiteSoon${year}`)) {
      w.flags.add(`monkRiteSoon${year}`);
      w.toast("🏔️", "The Mountain Monks are preparing for tomorrow: their yearly offering to the dragons, at the high ledge, around midday.", this.home.x, this.home.y);
    }
    if (!this.rite && this.riteDue(w)) this.startRite(w);
    if (this.rite) this.riteTick(w, step);
    else {
      this.schedule(w);
      this.live(w, step);
    }
  }

  /** Our people (or a dragon rider overhead) come near: the monastery is found. */
  private findTick(w: World) {
    if (this.found) return;
    const h = this.home;
    const close = w.humans.some((p) => !p.captive && !p.under && Math.hypot(p.x - h.x, p.y - h.y) < 900) || w.dragons.owned.some((d) => d.rider && Math.hypot(d.x - h.x, d.y - h.y) < 1100);
    if (!close) return;
    this.found = true;
    w.toast("🏔️", `Mountain Monks! A small, peaceful order lives up here in the Great Peaks: ${this.list.length} of them. They walk the mountain paths together, meditate and watch the sky. Nobody ever harms them, and they harm no one.`, h.x, h.y);
    w.discover("monks", h.x, h.y);
  }

  /** What the order is doing at this time of day. */
  private schedule(w: World) {
    const hr = w.time;
    const want: Activity = hr < 5 || hr >= 21 ? "sleep" : hr < 7 ? "meditate" : hr < 11 ? "walk" : hr < 14 ? "rest" : hr < 17 ? "walk" : hr < 19 ? "gaze" : "meditate";
    // a walk runs to its end before the next thing
    if (this.activity === "walk" && this.route.length && this.leg < this.route.length) return;
    if (want === this.activity && !(want === "walk" && this.leg >= this.route.length)) return;
    if (want === "walk" && this.activity === "walk") {
      // walked one route already this stretch: rest a while
      this.activity = "rest";
      this.lastActivityAt = w.elapsed;
      return;
    }
    if (want === "walk" && w.elapsed - this.lastActivityAt < 40) return;
    this.activity = want;
    this.lastActivityAt = w.elapsed;
    if (want === "walk") this.startWalk(ROUTES[Math.floor(this.rng() * ROUTES.length)].map(T2P));
  }

  private startWalk(pts: { x: number; y: number }[]) {
    this.route = [...pts, this.home];
    this.leg = 0;
    this.trail = [];
    const lead = this.leader();
    if (lead) {
      lead.path = null;
      this.trail.push({ x: lead.x, y: lead.y });
    }
  }

  private leader() {
    return this.list.filter((m) => !m.pilgrim && m.glow === 0).sort((a, b) => a.slot - b.slot)[0] ?? null;
  }

  /** Everyday life: the procession, or each to their place. */
  private live(w: World, dt: number) {
    const lead = this.leader();
    const settled = this.list.filter((m) => !m.pilgrim);
    if (this.activity === "walk" && lead) {
      this.procession(w, lead, settled, dt);
      return;
    }
    const spots = this.spotsFor(this.activity, settled.length);
    settled.forEach((m, i) => {
      const s = spots[i % spots.length];
      if (Math.hypot(s.x - m.x, s.y - m.y) > 6) this.walkTo(w, m, s.x, s.y, dt, WALK * 0.9);
      else {
        const st: MonkState = this.activity === "sleep" ? "sleep" : this.activity === "meditate" ? "meditate" : this.activity === "gaze" ? "gaze" : "sit";
        if (m.state !== st) {
          m.state = st;
          m.stateT = 0;
        }
        m.dir = this.activity === "meditate" ? (m.x < this.home.x ? 1 : -1) : m.dir;
        m.anim += dt * 0.5;
      }
    });
    if (this.activity === "meditate" && w.rng() < dt * 0.15 && w.inView(this.home.x, this.home.y, 400)) w.particles.spawn(P.Note, this.home.x + (w.rng() - 0.5) * 60, this.home.y + 20, { z: 30, vz: 18, size: 7, max: 2, color: "#ffd98a" });
    if (this.activity === "gaze" && w.rng() < dt * 0.05) {
      const m = settled[Math.floor(w.rng() * settled.length)];
      if (m) m.bubble = { text: pick(this.rng, ["The sky is clear.", "Look… the first star.", "Wind from the west.", "So quiet."]), t: 2.4 };
    }
  }

  /** Where everyone sits for an activity: a ring round the shrine, along the cairn, by the huts. */
  private spotsFor(a: Activity, n: number) {
    const shrine = this.places.find((p) => p.kind === "shrine") ?? this.home;
    const out: { x: number; y: number }[] = [];
    if (a === "sleep") {
      const huts = this.places.filter((p) => p.kind === "hut");
      for (let i = 0; i < n; i++) {
        const hut = huts[i % Math.max(1, huts.length)] ?? this.home;
        out.push({ x: hut.x - 14 + (Math.floor(i / Math.max(1, huts.length)) % 3) * 14, y: hut.y + 16 });
      }
      return out;
    }
    if (a === "gaze") {
      const cairn = this.places.find((p) => p.kind === "cairn") ?? this.home;
      for (let i = 0; i < n; i++) out.push({ x: cairn.x - 50 + i * 16, y: cairn.y + 20 + (i % 2) * 8 });
      return out;
    }
    for (let i = 0; i < n; i++) {
      const ang = (i / Math.max(1, n)) * Math.PI * 2;
      const r = a === "meditate" ? 46 : 70;
      out.push({ x: shrine.x + Math.cos(ang) * r, y: shrine.y + 10 + Math.sin(ang) * r * 0.55 });
    }
    return out;
  }

  /** The leader walks the route; everyone else follows in a line along the trail they leave. */
  private procession(w: World, lead: Monk, settled: Monk[], dt: number) {
    if (this.leg < this.route.length) {
      const goal = this.route[this.leg];
      if (this.walkTo(w, lead, goal.x, goal.y, dt, WALK)) {
        this.leg++;
        lead.path = null;
      }
    }
    // breadcrumbs every 12 px
    const last = this.trail[this.trail.length - 1];
    if (!last || Math.hypot(lead.x - last.x, lead.y - last.y) > 12) {
      this.trail.push({ x: lead.x, y: lead.y });
      if (this.trail.length > 260) this.trail.shift();
    }
    for (const m of settled) {
      if (m === lead) continue;
      const k = Math.max(0, this.trail.length - 1 - m.slot * 2);
      const p = this.trail[k] ?? lead;
      const d = Math.hypot(p.x - m.x, p.y - m.y);
      if (d > 4) this.step(m, p.x, p.y, dt, Math.min(WALK * 1.35, WALK * (0.7 + d / 40)));
      else m.state = "walk";
    }
    if (w.rng() < dt * 0.04) lead.bubble = { text: pick(this.rng, ["Om…", "Step by step.", "Mind the ice.", "Breathe."]), t: 2 };
  }

  /** Walk toward a spot along a proper path. Returns true on arrival. */
  private walkTo(w: World, m: Monk, x: number, y: number, dt: number, speed: number) {
    if (Math.hypot(x - m.x, y - m.y) < 8) {
      m.path = null;
      return true;
    }
    if (m.tx !== x || m.ty !== y || m.path === undefined) {
      m.tx = x;
      m.ty = y;
      m.path = null;
    }
    if (!m.path) {
      if (w.nav.lineClear("dino", m.x, m.y, x, y)) m.path = [];
      else {
        const p = w.nav.find(w, "dino", m.x, m.y, 0, x, y, 0, 6000);
        if (p === undefined) return false;
        m.path = p ?? [];
      }
      m.pathI = 0;
    }
    let gx = x;
    let gy = y;
    if (m.path.length && (m.pathI ?? 0) < m.path.length) {
      const np = nodePos(m.path[m.pathI ?? 0]);
      gx = np.x;
      gy = np.y;
      if (Math.hypot(gx - m.x, gy - m.y) < 10) m.pathI = (m.pathI ?? 0) + 1;
    }
    this.step(m, gx, gy, dt, speed);
    return false;
  }

  private step(m: Monk, x: number, y: number, dt: number, speed: number) {
    const dx = x - m.x;
    const dy = y - m.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const s = Math.min(d, speed * dt);
    m.x += (dx / d) * s;
    m.y += (dy / d) * s;
    if (Math.abs(dx) > 0.5) m.dir = dx > 0 ? 1 : -1;
    m.anim += dt * 4;
    m.state = "walk";
  }

  /** New monks walk up the valleys now and then (the order rebuilds after its offering). */
  private pilgrims(w: World, dt: number) {
    for (const m of this.list) {
      if (!m.pilgrim) continue;
      if (this.walkTo(w, m, this.home.x + (this.rng() - 0.5) * 40, this.home.y + 30, dt, WALK)) {
        m.pilgrim = false;
        this.restack();
        if (this.found) w.toast("🏔️", `A pilgrim, ${m.name}, has climbed up to join the Mountain Monks (${this.list.length} now).`, m.x, m.y);
      }
    }
    if (this.rite || this.list.length >= MAX_MONKS) return;
    this.pilgrimT -= dt;
    if (this.pilgrimT > 0) return;
    this.pilgrimT = PILGRIM_EVERY[0] + this.rng() * (PILGRIM_EVERY[1] - PILGRIM_EVERY[0]);
    const from = T2P(PILGRIM_FROM[Math.floor(this.rng() * PILGRIM_FROM.length)]);
    const at = this.groundNear(w, from.x, from.y);
    if (at) this.add(at.x, at.y, 18 + this.rng() * 20, { pilgrim: true, state: "walk" });
  }

  /* ------------------------------ the yearly offering ------------------------------ */

  /** Day number within the year → time for the offering? (the last day of winter, midday) */
  riteDue(w: World) {
    const year = Math.floor((w.day - 1) / YEAR_DAYS);
    const lastDay = (w.day - 1) % YEAR_DAYS === YEAR_DAYS - 1;
    return lastDay && w.time >= 10 && w.time < 15 && year > this.lastRite && this.list.filter((m) => !m.pilgrim).length >= 3;
  }

  /** Start the offering now (from the schedule, or the 🔔 button in the info card). */
  startRite(w: World) {
    if (this.rite) return "The offering is already under way.";
    if (this.list.filter((m) => !m.pilgrim).length < 3) return "There are too few monks for the offering.";
    this.lastRite = Math.floor((w.day - 1) / YEAR_DAYS);
    this.rite = { phase: "gather", t: 0, dragon: 0, visitor: false, offered: 0 };
    this.activity = "rite";
    if (this.found) w.toast("🔔", "The Mountain Monks ring their bell: today is their yearly offering to the dragons. They gather, then walk in a line up to the high ledge…", this.home.x, this.home.y);
    return null;
  }

  private riteTick(w: World, dt: number) {
    const r = this.rite!;
    r.t += dt;
    const settled = this.list.filter((m) => !m.pilgrim);
    const ledge = this.places.find((p) => p.kind === "altar") ?? this.altar;
    switch (r.phase) {
      case "gather": {
        const spots = this.spotsFor("meditate", settled.length);
        settled.forEach((m, i) => {
          const s = spots[i];
          if (Math.hypot(s.x - m.x, s.y - m.y) > 6) this.walkTo(w, m, s.x, s.y, dt, WALK);
          else m.state = "chant";
        });
        if (w.rng() < dt * 0.6 && w.inView(this.home.x, this.home.y, 500)) w.particles.spawn(P.Note, this.home.x + (w.rng() - 0.5) * 70, this.home.y + 10, { z: 30, vz: 20, size: 8, max: 2.2, color: "#ffd98a" });
        if (r.t > 22) {
          r.phase = "climb";
          r.t = 0;
          this.startWalk(ALTAR_ROUTE.map(T2P));
          this.route = this.route.slice(0, -1); // (no walk home: they stop at the ledge)
        }
        return;
      }
      case "climb": {
        const lead = this.leader();
        if (lead) this.procession(w, lead, settled, dt);
        if (this.leg >= this.route.length || r.t > 240) {
          r.phase = "call";
          r.t = 0;
          r.dragon = this.callDragon(w, ledge)?.id ?? 0;
        }
        return;
      }
      case "call": {
        // kneel in a line along the ledge, facing out
        settled.forEach((m, i) => {
          const s = { x: ledge.x - 70 + i * 16, y: ledge.y + 34 + (i % 2) * 6 };
          if (Math.hypot(s.x - m.x, s.y - m.y) > 5) this.walkTo(w, m, s.x, s.y, dt, WALK);
          else {
            m.state = "kneel";
            m.dir = 1;
          }
        });
        const dr = w.dragons.list.find((d) => d.id === r.dragon) ?? null;
        if (!dr) {
          r.dragon = this.callDragon(w, ledge)?.id ?? 0;
          if (!r.dragon && r.t > 30) this.endRite(w, false);
          return;
        }
        if (dr.z < 2 && Math.hypot(dr.x - (ledge.x + 110), dr.y - ledge.y) < 40 && r.t > 6) {
          r.phase = "offer";
          r.t = 0;
          if (this.found) w.toast("🐉", `${dr.name} has come down to the ledge. One by one, the monks walk into the light…`, ledge.x, ledge.y);
        }
        return;
      }
      case "offer": {
        // the eldest stay; one by one the rest walk to the dragon, kneel, and rise into the light
        const order = settled.slice().sort((a, b) => a.age - b.age);
        const going = order.slice(0, Math.max(0, order.length - ELDERS));
        const cur = going.find((m) => m.glow < 1);
        if (!cur) {
          r.phase = "depart";
          r.t = 0;
          return;
        }
        const dr = w.dragons.list.find((d) => d.id === r.dragon);
        const spot = { x: (dr?.x ?? ledge.x + 110) - 46, y: (dr?.y ?? ledge.y) + 8 };
        // (a few slow steps toward the dragon; if the ledge is too rough to reach it, the light comes to them)
        if (cur.glow === 0 && Math.hypot(spot.x - cur.x, spot.y - cur.y) > 5 && r.t < 8) {
          this.walkTo(w, cur, spot.x, spot.y, dt, WALK * 0.8);
          return;
        }
        cur.state = "ascend";
        cur.glow = Math.min(1, cur.glow + dt / 4.5);
        cur.z = cur.glow * 70;
        if (w.inView(cur.x, cur.y, 300) && w.rng() < dt * 12) w.particles.spawn(P.Star, cur.x + (w.rng() - 0.5) * 20, cur.y, { z: cur.z + 10, vz: 40, size: 4, max: 1.2, color: "#fff2b8" });
        if (cur.glow >= 1) {
          r.offered++;
          r.t = 0;
          w.particles.burst(P.Star, cur.x, cur.y, 14, 50, { z: cur.z + 20, size: 5, max: 1.4, color: "#ffe9a8" });
          this.list.splice(this.list.indexOf(cur), 1);
        }
        return;
      }
      case "depart": {
        const dr = w.dragons.list.find((d) => d.id === r.dragon);
        if (dr) dr.spread = Math.max(0, 1 - r.t / 4);
        if (r.t > 5) {
          if (this.found) w.discover("monkOffering", ledge.x, ledge.y);
          if (this.found) w.toast("🏔️", `The offering is done: ${r.offered} monk${r.offered === 1 ? "" : "s"} went with the dragon. The ${this.list.length === 1 ? "last monk walks" : `${this.list.length} eldest walk`} home to begin again; new pilgrims will come.`, ledge.x, ledge.y);
          this.endRite(w, true);
        }
        return;
      }
    }
  }

  /** An Ice Dragon of the peaks answers (any wild one if there's none); else one flies in just for this. */
  private callDragon(w: World, ledge: { x: number; y: number }): Dragon | null {
    const free = (d: Dragon) => !d.owner && !d.sandTribe && !d.fury && !d.prey && !d.monkRite && d.hp > d.maxHp * 0.5;
    let dr = w.dragons.list.filter((d) => free(d) && d.breed === "ice").sort((a, b) => Math.hypot(a.x - ledge.x, a.y - ledge.y) - Math.hypot(b.x - ledge.x, b.y - ledge.y))[0] ?? null;
    let visitor = false;
    if (!dr) {
      const def = BREEDS.ice;
      dr = {
        id: w.dragons.nextId(), kind: "dragon", name: pick(w.dragons.rng, DRAGON_NAMES), x: ledge.x + 900, y: ledge.y - 700, z: 320, vx: 0, vy: 0, dir: -1,
        hp: def.hp, maxHp: def.hp, state: "arrive", t: 0, target: 0, tx: ledge.x, ty: ledge.y, breath: 0, anim: 0, hue: 0, passes: 0, hit: 0, breed: "ice", growth: 1,
      };
      w.dragons.list.push(dr);
      visitor = true;
    }
    dr.monkRite = true;
    if (this.rite) this.rite.visitor = visitor;
    return dr;
  }

  /** The dragon at the rite: down to the ledge, wings spread, then away (from Dragons.update). */
  riteDragonStep(w: World, dr: Dragon, dt: number) {
    const r = this.rite;
    const ledge = this.places.find((p) => p.kind === "altar") ?? this.altar;
    dr.t += dt;
    dr.hit = Math.max(0, dr.hit - dt * 3);
    if (!r || r.dragon !== dr.id || r.phase === "return") {
      dr.monkRite = undefined;
      dr.spread = 0;
      return;
    }
    if (r.phase === "depart" && r.t > 3) {
      // off it goes, carrying the light
      this.glide(dr, ledge.x + 1400, ledge.y - 900, 380, 280, dt);
      if (w.inView(dr.x, dr.y, 300) && w.rng() < dt * 10) w.particles.spawn(P.Star, dr.x, dr.y, { z: dr.z, vz: -10, size: 4, max: 1, color: "#fff2b8" });
      return;
    }
    const spot = { x: ledge.x + 110, y: ledge.y };
    const d = Math.hypot(spot.x - dr.x, spot.y - dr.y);
    if (d > 30 || dr.z > 2) {
      this.glide(dr, spot.x, spot.y, d < 150 ? 0 : 160, 240, dt);
      return;
    }
    dr.z = 0;
    dr.vx = dr.vy = 0;
    dr.dir = -1;
    dr.state = "offering";
    dr.spread = r.phase === "offer" ? Math.min(1, (dr.spread ?? 0) + dt * 0.6) : dr.spread ?? 0;
    dr.anim += dt * 1.2;
  }

  private glide(dr: Dragon, tx: number, ty: number, tz: number, speed: number, dt: number) {
    const dx = tx - dr.x;
    const dy = ty - dr.y;
    const d = Math.hypot(dx, dy);
    const k = Math.min(1, dt * 1.6);
    const s = d > 1 ? Math.min(speed, d / Math.max(dt, 0.016)) : 0;
    dr.vx += ((dx / (d || 1)) * s - dr.vx) * k;
    dr.vy += ((dy / (d || 1)) * s - dr.vy) * k;
    dr.x += dr.vx * dt;
    dr.y += dr.vy * dt;
    dr.z += (tz - dr.z) * Math.min(1, dt * 1.2);
    if (tz === 0 && dr.z < 3 && d < 34) dr.z = 0;
    if (Math.abs(dr.vx) > 10) dr.dir = dr.vx > 0 ? 1 : -1;
    dr.anim += dt * (dr.z > 8 ? 4.6 : 1.4);
    dr.state = dr.z > 8 ? "circle" : "offering";
  }

  private endRite(w: World, done: boolean) {
    const r = this.rite;
    if (r) {
      const dr = w.dragons.list.find((d) => d.id === r.dragon);
      if (dr) {
        dr.monkRite = undefined;
        dr.spread = 0;
        // a dragon that came only for the rite flies off home beyond the peaks
        if (r.visitor) w.dragons.list.splice(w.dragons.list.indexOf(dr), 1);
        else dr.state = "home";
      }
    }
    this.rite = null;
    this.activity = "rest";
    for (const m of this.list) {
      m.glow = 0;
      m.z = 0;
      m.path = null;
    }
    this.restack();
    if (done) this.pilgrimT = 80;
  }

  /* ------------------------------ save ------------------------------ */

  serialize() {
    const r = Math.round;
    return {
      seeded: this.seeded,
      found: this.found,
      lastRite: this.lastRite,
      ids: this.ids,
      places: this.places.map((p) => ({ ...p })),
      monks: this.list.filter((m) => m.glow === 0).map((m) => ({ name: m.name, x: r(m.x), y: r(m.y), age: Math.round(m.age * 10) / 10, robe: m.robe, pilgrim: m.pilgrim || undefined })),
    };
  }

  load(w: World, d: ReturnType<Monks["serialize"]> | undefined) {
    this.list = [];
    this.places = [];
    this.rite = null;
    this.activity = "rest";
    this.enabled = true;
    if (!d) {
      this.seeded = false;
      return;
    }
    this.seeded = !!d.seeded;
    this.found = !!d.found;
    this.lastRite = d.lastRite ?? -1;
    this.ids = Math.max(7e8, d.ids ?? 7e8);
    this.places = (d.places ?? []).map((p) => ({ ...p }));
    for (const m of d.monks ?? []) this.add(m.x, m.y, m.age, { name: m.name, robe: m.robe, pilgrim: !!m.pilgrim });
    // a rite cut short by the save: the dragon goes home
    for (const dr of w.dragons.list) if (dr.monkRite) dr.monkRite = undefined;
    this.restack();
  }
}
