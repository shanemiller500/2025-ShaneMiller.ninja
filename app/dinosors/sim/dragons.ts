/* ------------------------------------------------------------------ */
/*  Dragons (fantasy!). Rare, huge and dangerous. A state machine:     */
/*                                                                     */
/*   arrive → circle the settlement → strafe it with fire breath, or   */
/*   hunt a big dinosaur → land + eat → leave.  Badly hurt → flee.     */
/*                                                                     */
/*  They fly over walls. Fire breath lights trees + thatch, scorches   */
/*  whatever it touches and sends everybody running. Scorpions do      */
/*  extra damage to them; archers can hit them too.                    */
/*                                                                     */
/*  Some wild dragons live here, at nests in the mountains (see        */
/*  dragonNests.ts): they perch, hunt, defend the nest and chase egg   */
/*  thieves, and go home instead of leaving. Dragons the tribe hatched */
/*  live in `owned` (see dragonKeep.ts), never in `list`, so nothing   */
/*  that fights wild dragons ever turns on them.                       */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { sizeOf, setState, emote } from "./dinos";
import { tileOf } from "./nav";
import { P } from "./particles";
import { makeRng, pick, type Rng } from "./rng";
import { MAP_W, TILE, WORLD_H, WORLD_W, type Dino, type Dragon, type DragonEgg, type DragonNest, type Resource } from "./types";
import { hurtHuman } from "./injury";
import type { World } from "./world";
import { BREEDS, type DragonBreed } from "../data/dragons";
import { dropEgg, eggSpot, nestEggs, nestLost, nestsUpdate } from "./dragonNests";
import { newDragonStats, ownedUpdate } from "./dragonKeep";

/** Where dragon-world ids start (far above anything the world numbers itself). */
const DRAGON_IDS = 100_000_000;

const NAMES = ["Emberwing", "Ashfang", "Cinderclaw", "Scorchtail", "Pyrrha", "Smoulder", "Blazebeak"];
const MAX_HP = 2600;

export class Dragons {
  /** wild dragons in the sky (visitors + the ones that live at nests) */
  list: Dragon[] = [];
  /** the tribe's own dragons */
  owned: Dragon[] = [];
  nests: DragonNest[] = [];
  eggs: DragonEgg[] = [];
  /** incubation shelter fuel (building id → seconds of heat) */
  fuel: Record<number, number> = {};
  /** dragon fire soaked into each Neanderthal camp (clan id → heat) */
  scorch: Record<number, number> = {};
  /** nests have been placed in this world */
  seeded = false;
  /** seconds until the next look for hidden nests */
  seeT = 0;
  /** seconds until tamed dragons next scan for threats */
  scanT = 0;
  /** fire-breath damage ticks */
  pulse = 0;
  /** dice for nests + eggs (separate from the world's, see seedNests) */
  rng: Rng = makeRng(1);
  /**
   * Nests, eggs and the dragons that live here / hatch here number themselves from their own
   * range, so adding them never shifts anyone else's id (lots of behaviour varies by id).
   */
  idSeq = DRAGON_IDS;

  nextId() {
    return this.idSeq++;
  }
  /** seconds until a dragon might visit by itself */
  timer = 1500;
  private breathT = 0;

  byId(id: number) {
    return this.list.find((d) => d.id === id) ?? null;
  }

  /** One of ours or a wild one. */
  anyById(id: number) {
    return this.list.find((d) => d.id === id) ?? this.owned.find((d) => d.id === id) ?? null;
  }

  /** Every dragon (for drawing). */
  all() {
    return this.owned.length ? [...this.list, ...this.owned] : this.list;
  }

  /** Is a wild dragon a threat to the settlement right now (not one asleep on its far-off nest)? */
  menacing(w: World) {
    return this.list.some((d) => d.state !== "leave" && d.state !== "flee" && (d.state !== "perch" && d.state !== "home" ? Math.hypot(d.x - w.camp.x, d.y - w.camp.y) < 1800 : false));
  }

  /** Bring a dragon in from the edge of the world. */
  summon(w: World, toward?: { x: number; y: number }) {
    if (this.list.length >= 2) return null;
    const side = Math.floor(w.rng() * 4);
    const x = side === 0 ? -200 : side === 1 ? WORLD_W + 200 : 200 + w.rng() * (WORLD_W - 400);
    const y = side === 2 ? -200 : side === 3 ? WORLD_H + 200 : 200 + w.rng() * (WORLD_H - 400);
    const goal = toward ?? { x: w.camp.x, y: w.camp.y };
    const dr: Dragon = {
      id: w.nextId(),
      kind: "dragon",
      name: pick(w.rng, NAMES),
      x,
      y,
      z: 300,
      vx: 0,
      vy: 0,
      dir: goal.x > x ? 1 : -1,
      hp: MAX_HP,
      maxHp: MAX_HP,
      state: "arrive",
      t: 0,
      target: 0,
      tx: goal.x,
      ty: goal.y,
      breath: 0,
      anim: 0,
      hue: Math.floor(w.rng() * 3),
      passes: 0,
      hit: 0,
    };
    // the classic three colour schemes are three breeds (no extra dice: visits play out as before)
    dr.breed = (["fire", "swift", "heavy"] as DragonBreed[])[dr.hue % 3];
    dr.hp = dr.maxHp = BREEDS[dr.breed!].hp;
    this.list.push(dr);
    w.sfx("screech", goal.x, goal.y, 1.2, 0.45);
    w.toast("🐉", `A dragon — ${dr.name} — is flying toward the ${toward ? "valley" : "settlement"}!`, goal.x, goal.y);
    w.discover("dragon", goal.x, goal.y);
    return dr;
  }

  update(w: World, dt: number) {
    // natural visits are rare (and gentle in Calm mode: they only hunt dinos)
    const calm = w.tribe.danger === "calm";
    this.timer -= dt * (w.tribe.danger === "wild" ? 1.8 : 1);
    if (this.timer <= 0) {
      this.timer = 1300 + w.rng() * 900;
      if (w.elapsed > 900 && !w.tribe.raid) {
        const herd = w.dinos.find((d) => sp(d.species).diet === "herbivore" && sizeOf(d) > 70);
        this.summon(w, calm && herd ? { x: herd.x, y: herd.y } : undefined);
      }
    }
    this.breathT -= dt;
    for (const dr of [...this.list]) this.step(w, dr, dt, calm);
    nestsUpdate(w, dt);
    this.scanT -= dt;
    ownedUpdate(w, dt);
    if (this.scanT <= 0) this.scanT = 1;
  }

  private fly(dr: Dragon, tx: number, ty: number, speed: number, dt: number, tz: number) {
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
    if (Math.abs(dr.vx) > 10) dr.dir = dr.vx > 0 ? 1 : -1;
    dr.anim += dt * (dr.z > 20 ? 5 : 1.5);
    return d;
  }

  private step(w: World, dr: Dragon, dt: number, calm: boolean) {
    dr.t += dt;
    dr.hit = Math.max(0, dr.hit - dt * 3);
    dr.breath = Math.max(0, dr.breath - dt * 2);
    const c = w.camp;
    if (dr.hp < dr.maxHp * 0.35 && dr.state !== "flee" && dr.state !== "leave") {
      this.go(dr, "flee");
      const a = Math.atan2(dr.y - c.y, dr.x - c.x);
      dr.tx = dr.x + Math.cos(a) * 6000;
      dr.ty = dr.y + Math.sin(a) * 6000;
      w.sfx("screech", dr.x, dr.y, 1, 0.6);
      w.toast("🛡️", `${dr.name} is hurt and flees! The tribe drove off a dragon!`, dr.x, dr.y);
      w.discover("dragonSlayer", dr.x, dr.y);
      w.celebrate("Dragon gone!");
    }
    if (dr.nest && this.resident(w, dr, dt)) return;
    switch (dr.state) {
      case "arrive": {
        const d = this.fly(dr, dr.tx, dr.ty, 300, dt, 230);
        if (d < 420) this.go(dr, "circle");
        break;
      }
      case "circle": {
        const cx = dr.tx;
        const cy = dr.ty;
        const a = dr.t * 0.55 + dr.id;
        this.fly(dr, cx + Math.cos(a) * 380, cy + Math.sin(a) * 260, 260, dt, 190);
        if (dr.t > 7 + (dr.id % 4)) this.decide(w, dr, calm);
        break;
      }
      case "strafe": {
        const d = this.fly(dr, dr.tx, dr.ty, 340, dt, 95);
        const nearCamp = Math.hypot(dr.x - c.x, dr.y - c.y) < 380;
        if (nearCamp) this.breathe(w, dr, dt);
        if (d < 60 || dr.t > 9) {
          dr.passes++;
          if (dr.passes >= 2 + (dr.id % 2)) this.decide(w, dr, true);
          else {
            dr.tx = c.x;
            dr.ty = c.y;
            this.go(dr, "circle");
          }
        }
        break;
      }
      case "hunt": {
        const prey = w.dinoById(dr.target);
        if (!prey || prey.owner) {
          this.decide(w, dr, true);
          break;
        }
        const d = this.fly(dr, prey.x, prey.y, 330, dt, Math.hypot(prey.x - dr.x, prey.y - dr.y) < 260 ? 40 : 160);
        if (d < 220) this.breathe(w, dr, dt);
        if (d < 50 && dr.z < 70) this.grab(w, dr, prey);
        else if (dr.t > 25) this.decide(w, dr, true);
        break;
      }
      case "land":
        this.fly(dr, dr.tx, dr.ty, 160, dt, 0);
        if (dr.z < 3) {
          dr.z = 0;
          this.go(dr, "eat");
        }
        break;
      case "eat":
        dr.vx = dr.vy = 0;
        dr.anim += dt * 2;
        if (w.rng() < dt * 2) w.particles.spawn(P.Crumb, dr.x + dr.dir * 40, dr.y, { z: 6, vz: 40, vx: (w.rng() - 0.5) * 40, g: 200, size: 2.5, max: 0.6, color: "#b5523a" });
        if (dr.t > 14 && dr.nest) this.go(dr, "home");
        else if (dr.t > 14) {
          this.go(dr, "leave");
          const a = w.rng() * Math.PI * 2;
          dr.tx = dr.x + Math.cos(a) * 7000;
          dr.ty = dr.y + Math.sin(a) * 7000;
        }
        break;
      case "flee":
      case "leave":
        if (dr.state === "leave" && dr.nest) {
          this.go(dr, "home");
          break;
        }
        this.fly(dr, dr.tx, dr.ty, dr.state === "flee" ? 420 : 300, dt, 320);
        if (dr.x < -400 || dr.y < -400 || dr.x > WORLD_W + 400 || dr.y > WORLD_H + 400) {
          this.list.splice(this.list.indexOf(dr), 1);
          if (dr.nest) nestLost(w, dr);
        }
        break;
    }
    // everyone below gets nervous
    if (dr.z < 240 && w.rng() < dt * 1.5) w.alarm(dr.x, dr.y, 420, 0.5, "🐉", dr.state === "strafe" || dr.state === "hunt");
  }

  private go(dr: Dragon, s: Dragon["state"]) {
    dr.state = s;
    dr.t = 0;
  }

  /** Circle done: attack the settlement, hunt a dino, or give up if it looks too well defended. */
  private decide(w: World, dr: Dragon, done: boolean) {
    const c = w.camp;
    const strength = w.tribe.defense(w);
    const scared = strength > 10 && dr.hp < dr.maxHp * 0.8;
    if (!done && !scared && w.tribe.danger !== "calm" && w.humans.length && Math.hypot(dr.tx - c.x, dr.ty - c.y) < 600) {
      // fly a line straight over the camp
      const a = w.rng() * Math.PI * 2;
      dr.tx = c.x + Math.cos(a) * 520;
      dr.ty = c.y + Math.sin(a) * 380;
      this.go(dr, "strafe");
      w.sfx("screech", dr.x, dr.y, 1.1, 0.5);
      return;
    }
    let best: Dino | null = null;
    let bs = -Infinity;
    for (const d of w.dinos) {
      const def = sp(d.species);
      if (def.move !== "walk" || d.owner || d.raider) continue;
      const dist = Math.hypot(d.x - dr.x, d.y - dr.y);
      if (dist > 2200) continue;
      const s = sizeOf(d) * 2 - dist * 0.1 - (Math.hypot(d.x - c.x, d.y - c.y) < 600 ? 300 : 0);
      if (s > bs) {
        bs = s;
        best = d;
      }
    }
    if (best && dr.passes < 6) {
      dr.target = best.id;
      this.go(dr, "hunt");
      return;
    }
    this.go(dr, "leave");
    const a = w.rng() * Math.PI * 2;
    dr.tx = dr.x + Math.cos(a) * 7000;
    dr.ty = dr.y + Math.sin(a) * 7000;
  }

  private grab(w: World, dr: Dragon, prey: Dino) {
    w.particles.burst(P.Poof, prey.x, prey.y, 12, 70, { size: 14, max: 1, color: "rgba(230,220,200,0.9)" });
    w.sfx("chomp", prey.x, prey.y, 1.2, 0.6);
    w.toast("🐉", `${dr.name} snatched a ${sp(prey.species).nick}!`, prey.x, prey.y);
    w.alarm(prey.x, prey.y, 700, 1, "😱", true);
    w.removeDino(prey);
    // land somewhere quiet to eat (a chance for brave hunters…)
    const c = w.camp;
    const a = Math.atan2(dr.y - c.y, dr.x - c.x);
    dr.tx = Math.max(200, Math.min(WORLD_W - 200, dr.x + Math.cos(a) * 300));
    dr.ty = Math.max(200, Math.min(WORLD_H - 200, dr.y + Math.sin(a) * 200));
    this.go(dr, "land");
  }

  /** A cone of fire in front of the dragon. */
  private breathe(w: World, dr: Dragon, dt: number) {
    dr.breath = 1;
    const fx = dr.x + dr.vx * 0.35;
    const fy = dr.y + dr.vy * 0.35;
    if (w.inView(fx, fy, 200)) {
      for (let k = 0; k < 3; k++) {
        const t = w.rng();
        w.particles.spawn(P.Ember, dr.x + (fx - dr.x) * t + (w.rng() - 0.5) * 30, dr.y + (fy - dr.y) * t, { z: dr.z * (1 - t) + 4, vz: 20, vx: dr.vx * 0.3, size: 4 + w.rng() * 4, max: 0.6, color: w.rng() < 0.5 ? "#ffd447" : "#ff6a1f" });
      }
    }
    if (this.breathT > 0) return;
    this.breathT = 0.18;
    w.sfx("ignite", fx, fy, 0.7, 0.7);
    // light whatever is under the flames
    const tx = Math.floor(fx / TILE);
    const ty = Math.floor(fy / TILE);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (w.rng() < 0.6) w.fire.ignite(w, tx + dx, ty + dy, 0.8);
    w.burnPlantsAt(fx, fy, 0.6);
    const r = 70;
    for (const d of w.dinos) {
      if (Math.hypot(d.x - fx, d.y - fy) > r + sizeOf(d) * 0.3 || sp(d.species).move === "swim") continue;
      d.health -= 0.18;
      d.burn = 0;
      d.fear = 1;
      emote(d, "🔥", 1.2);
      if (sp(d.species).move === "walk" && d.state !== "flee") setState(d, "flee", d.x + (d.x - fx) * 4, d.y + (d.y - fy) * 4);
    }
    for (const h of w.humans) {
      if (Math.hypot(h.x - fx, h.y - fy) > r) continue;
      const home = h.state === "hide" || h.state === "sleep" || h.state === "rest" ? w.shelters.find((s) => s.id === h.home) : null;
      if (home && home.tier >= 3) continue; // stone + reinforced houses keep the fire out
      hurtHuman(w, h, 0.32, fx, fy, "burn");
    }
    // walls + huts + buildings scorch
    const i = tileOf(fx, fy);
    const wl = w.tribe.wallAt(i % MAP_W, Math.floor(i / MAP_W));
    if (wl && wl.built >= 1) wl.hp -= wl.kind === "polygon" ? 4 : wl.kind === "stone" ? 6 : 28;
    for (const s of w.shelters) if (Math.hypot(s.x - fx, s.y - fy) < 60 && s.stage > 0) s.hp = Math.max(0, s.hp - (s.tier >= 4 ? 0.01 : s.tier >= 3 ? 0.04 : 0.12));
    for (const b of w.colony.buildings) if (Math.hypot(b.x - fx, b.y - fy) < 60) b.hp -= b.kind === "blacksmith" ? 4 : 20;
    for (const s of w.colony.scorpions) if (Math.hypot(s.x - fx, s.y - fy) < 50) s.hp -= 15;
  }

  /** A bolt or arrow struck a dragon. */
  hit(w: World, dr: Dragon, dmg: number) {
    dr.hp -= dmg;
    dr.hit = 1;
    w.particles.burst(P.Star, dr.x, dr.y, 2, 30, { z: dr.z + 20, size: 6, max: 0.6 });
    w.sfx("thunk", dr.x, dr.y, 0.9, 0.7);
    if (dr.hp <= 0) {
      // cartoon crash-landing: a poof of smoke, a feast, and a shiny scale
      w.particles.burst(P.Poof, dr.x, dr.y, 18, 90, { size: 18, max: 1.4, color: "rgba(220,210,200,0.95)" });
      w.addItem("meat", dr.x, dr.y, { amount: 4 });
      w.camp.stock.gold += 3;
      w.toast("🏆", `${dr.name} crashed down and limped away! The tribe found 3 gold dragon scales.`, dr.x, dr.y);
      w.discover("dragonSlayer", dr.x, dr.y);
      w.celebrate("Hooray!");
      this.list.splice(this.list.indexOf(dr), 1);
      if (dr.nest) nestLost(w, dr);
      w.events.push({ type: "removed", id: dr.id });
    } else if (dr.state === "circle" || dr.state === "eat") {
      // being shot makes it angry: go straight for whoever is shooting
      if (dr.state === "eat") {
        this.go(dr, "leave");
        dr.tx = dr.x + (w.rng() - 0.5) * 6000;
        dr.ty = dr.y - 6000;
      }
    }
  }

  /* ------------------------------ wild dragons at home ------------------------------ */

  /** A wild dragon that lives at a nest. Returns true if it handled this frame. */
  private resident(w: World, dr: Dragon, dt: number): boolean {
    const nest = this.nests.find((n) => n.id === dr.nest);
    if (!nest) {
      dr.nest = undefined;
      return false;
    }
    const nx = nest.x + 34;
    const ny = nest.y - 8;
    switch (dr.state) {
      case "perch": {
        dr.x += (nx - dr.x) * Math.min(1, dt * 2);
        dr.y += (ny - dr.y) * Math.min(1, dt * 2);
        dr.z = Math.max(0, dr.z - dt * 80);
        dr.vx = dr.vy = 0;
        dr.anim += dt * 0.8;
        dr.hp = Math.min(dr.maxHp, dr.hp + dt * dr.maxHp * 0.004);
        // anyone creeping up on the nest gets driven off
        const intruder = w.humans.find((h) => !h.aloft && !h.under && !h.captive && h.state !== "down" && Math.hypot(h.x - nest.x, h.y - nest.y) < 300);
        if (intruder) {
          dr.foe = intruder.id;
          this.go(dr, "defend");
          w.sfx("screech", dr.x, dr.y, 1.1, 0.45);
          if (nest.found || !w.flags.has("nestDefend")) {
            w.flags.add("nestDefend");
            w.toast("🐉", `${dr.name} rises off its nest to drive ${intruder.name} away!`, dr.x, dr.y);
          }
          return true;
        }
        if (dr.t > 60 + (dr.id % 50)) {
          dr.t = 0;
          // now and then it goes raiding the settlement (rarely, never in Calm), else hunting
          if (w.tribe.danger !== "calm" && w.elapsed > 1800 && this.rng() < 0.1 && !w.tribe.raid) {
            dr.tx = w.camp.x;
            dr.ty = w.camp.y;
            this.go(dr, "arrive");
            w.toast("🐉", `${dr.name} has left its nest… and it's heading for the settlement!`, dr.x, dr.y);
            w.sfx("screech", w.camp.x, w.camp.y, 1.2, 0.45);
          } else if (this.rng() < 0.7) this.decide(w, dr, true);
        }
        return true;
      }
      case "home": {
        const d = this.fly(dr, nx, ny, 260, dt, Math.hypot(nx - dr.x, ny - dr.y) > 200 ? 220 : 0);
        if (d < 20 && dr.z < 6) {
          dr.z = 0;
          this.go(dr, "perch");
          // an egg gone from the nest: furious, it goes looking for whoever has it
          const thief = w.humans.find((h) => h.egg && this.eggs.find((e) => e.id === h.egg)?.nest === nest.id && Math.hypot(h.x - nest.x, h.y - nest.y) < 1800);
          if (thief) {
            dr.foe = thief.id;
            this.go(dr, "chase");
          }
        }
        return true;
      }
      case "defend": {
        const h = w.humans.find((x) => x.id === dr.foe);
        if (!h || h.state === "down" || h.aloft || Math.hypot(h.x - nest.x, h.y - nest.y) > 650 || dr.t > 25) {
          this.go(dr, "home");
          return true;
        }
        const d = this.fly(dr, h.x, h.y, 300, dt, Math.hypot(h.x - dr.x, h.y - dr.y) < 260 ? 60 : 150);
        if (d < 190) this.breathe(w, dr, dt);
        return true;
      }
      case "chase": {
        const h = w.humans.find((x) => x.id === dr.foe);
        const egg = this.eggs.find((e) => e.nest === nest.id && (e.at === "carried" || e.at === "ground") && (e.at === "ground" || e.carrier === dr.foe));
        if (egg && egg.at === "ground") {
          // the egg was dropped: swoop down and take it home
          if (this.fly(dr, egg.x, egg.y, 320, dt, 20) < 40) {
            egg.at = "nest";
            egg.carrier = 0;
            const spot = eggSpot(nest, nestEggs(w, nest).length - 1);
            egg.x = spot.x;
            egg.y = spot.y;
            w.toast("🐉", `${dr.name} snatched its egg back!`, dr.x, dr.y);
            this.go(dr, "home");
          }
          return true;
        }
        const near = h ? Math.hypot(h.x - w.camp.x, h.y - w.camp.y) < 420 : false;
        if (!h || !egg || dr.t > 60 || dr.hp < dr.maxHp * 0.5 || (near && w.tribe.defense(w) > 6)) {
          if (h && egg && dr.t > 3) w.toast("🛡️", `${dr.name} gave up the chase!`, dr.x, dr.y);
          this.go(dr, "home");
          return true;
        }
        const d = this.fly(dr, h.x, h.y, 330, dt, Math.hypot(h.x - dr.x, h.y - dr.y) < 280 ? 55 : 160);
        if (d < 180) {
          this.breathe(w, dr, dt);
          if (h.hp < 0.4 && h.egg) dropEgg(w, egg, h);
        }
        return true;
      }
    }
    return false;
  }

  /* ------------------------------ saving ------------------------------ */

  serialize() {
    const r = (n: number) => Math.round(n * 10) / 10;
    const dragon = (d: Dragon) => ({
      id: d.id, name: d.name, x: r(d.x), y: r(d.y), hp: Math.round(d.hp), breed: d.breed, nest: d.nest,
      ...(d.owner ? {
        owner: true, age: r(d.age ?? 0), skills: d.skills, partner: d.partner, stamina: r(d.stamina ?? 1), energy: r(d.energy ?? 1),
        hunger: r(d.hunger ?? 0), auto: d.auto !== false, roost: d.roost, rare: d.rare || undefined, carrying: d.carrying || undefined,
      } : {}),
    });
    return {
      timer: Math.round(this.timer),
      seeded: this.seeded,
      // only dragons that live here are saved (a visitor in the sky is just passing through)
      wild: this.list.filter((d) => d.nest).map(dragon),
      owned: this.owned.map(dragon),
      nests: this.nests.map((n) => ({ ...n, x: r(n.x), y: r(n.y), layT: Math.round(n.layT), emptyT: Math.round(n.emptyT) })),
      eggs: this.eggs.map((e) => ({ ...e, at: e.at === "carried" ? ("ground" as const) : e.at, carrier: 0, heat: r(e.heat), progress: Math.round(e.progress * 1000) / 1000, health: Math.round(e.health * 1000) / 1000, hatchT: 0 })),
      fuel: this.fuel,
    };
  }

  load(w: World, d: ReturnType<Dragons["serialize"]> | undefined) {
    this.clear();
    if (!d) return;
    this.timer = d.timer ?? 1500;
    this.seeded = !!d.seeded;
    this.rng = makeRng(w.seed * 31 + 7 + Math.floor(w.elapsed));
    this.nests = (d.nests ?? []).map((n) => ({ ...n, loot: { ...(n.loot as Partial<Record<Resource, number>>) } }));
    this.eggs = (d.eggs ?? []).map((e) => ({ ...e }));
    this.fuel = { ...(d.fuel ?? {}) };
    const make = (s: (typeof d.wild)[number], owned: boolean): Dragon => {
      const breed = (s.breed ?? "fire") as DragonBreed;
      const o = s as typeof s & Partial<Dragon>;
      const dr: Dragon = {
        id: s.id, kind: "dragon", name: s.name, x: s.x, y: s.y, z: 0, vx: 0, vy: 0, dir: 1, hp: s.hp, maxHp: BREEDS[breed].hp,
        state: owned ? "idle" : "perch", t: 0, target: 0, tx: s.x, ty: s.y, breath: 0, anim: 0, hue: 0, passes: 0, hit: 0, breed, nest: s.nest,
      };
      if (owned) {
        Object.assign(dr, {
          owner: true, age: o.age ?? 0, skills: { ...(o.skills ?? {}) }, partner: o.partner, stamina: o.stamina ?? 1, energy: o.energy ?? 1,
          hunger: o.hunger ?? 0, auto: o.auto !== false, roost: o.roost, rare: !!o.rare, carrying: o.carrying ?? null, cmd: null, fireCd: 0, burst: 0, lesson: null,
        });
      }
      return dr;
    };
    for (const s of d.wild ?? []) this.list.push(make(s, false));
    for (const s of d.owned ?? []) this.owned.push(make(s, true));
    for (const dr of this.owned) {
      dr.growth = Math.min(1, ((dr.age ?? 0) / 1260) * (dr.rare ? 1.15 : 1));
      const hp = dr.hp;
      dr.maxHp = 1;
      dr.hp = 1;
      newStats(dr);
      dr.hp = Math.min(dr.maxHp, hp);
    }
    // ids came from the save: keep new ones clear of them
    const ids = [...this.nests.map((n) => n.id), ...this.eggs.map((e) => e.id), ...this.list.map((x) => x.id), ...this.owned.map((x) => x.id)];
    this.idSeq = Math.max(DRAGON_IDS, ...ids.filter((id) => id >= DRAGON_IDS).map((id) => id + 1));
    w.reserveIds(Math.max(0, ...ids.filter((id) => id < DRAGON_IDS)));
  }

  clear() {
    this.list = [];
    this.owned = [];
    this.nests = [];
    this.eggs = [];
    this.fuel = {};
    this.scorch = {};
    this.seeded = false;
    this.idSeq = DRAGON_IDS;
  }
}

/** (kept separate so dragonKeep's import cycle resolves lazily) */
function newStats(dr: Dragon) {
  newDragonStats(dr);
}
