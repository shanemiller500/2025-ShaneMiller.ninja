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
import { hitChariot } from "./chariots";
import { assignWards } from "./warGuard";
import { sp } from "../data/species";
import { sizeOf, setState, emote } from "./dinos";
import { tileOf } from "./nav";
import { P } from "./particles";
import { makeRng, pick, type Rng } from "./rng";
import { MAP_W, TILE, WORLD_H, WORLD_W, type Brute, type Dino, type Dragon, type DragonEgg, type DragonNest, type Human, type Resource } from "./types";
import { hurtHuman } from "./injury";
import { killHuman, say as sayB } from "./rivals";
import { say as sayH } from "./humans";
import { colorsOf } from "./clanTowns";
import { favored } from "./clanRite";
import type { World } from "./world";
import { BREEDS, GROW_SECONDS, type DragonBreed } from "../data/dragons";
import { dropEgg, eggSpot, nestEggs, nestLost, nestsUpdate } from "./dragonNests";
import { dismountDragon, dragonRiderOf, newDragonStats, ownedUpdate, warTrained } from "./dragonKeep";
import { assignKeepers } from "./keepers";
import { showsUpdate, type Show } from "./shows";

const d0 = (dr: Dragon) => Math.hypot(dr.tx - dr.x, dr.ty - dr.y);

/** Where dragon-world ids start (far above anything the world numbers itself). */
const DRAGON_IDS = 100_000_000;

const NAMES = ["Emberwing", "Ashfang", "Cinderclaw", "Scorchtail", "Pyrrha", "Smoulder", "Blazebeak"];
const MAX_HP = 2600;

/** A body a dragon let go of, falling through the air (into the volcano, or onto the ground). */
interface Fall {
  id: number;
  brute: boolean;
  x: number;
  y: number;
  z: number;
  vz: number;
  volcano: boolean;
  /** it dies when it lands (the volcano always kills) */
  lethal: boolean;
  msg: string;
}

/**
 * The volcano's crater, for a falling body: bodies sort just in front of the mountain (whose foot
 * is 150 below its middle) and drop until they reach the crater mouth, 150 above it.
 */
const CRATER_Y = 152;
const CRATER_Z = 296;

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
  /** every nest has been topped up to its clutch of three (older saves) */
  topped = false;
  /** seconds until the next look for hidden nests */
  seeT = 0;
  /** seconds until tamed dragons next scan for threats */
  scanT = 0;
  /** a dragon show going on in the pit (see shows.ts) */
  show: Show | null = null;
  /** bodies falling from dragons' claws */
  falls: Fall[] = [];
  lastShowDay = 0;
  private keeperT = 0;
  /** seconds until guards are next matched to the people out in the wild */
  private guardT = 0;
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
    this.fallsUpdate(w, dt);
    nestsUpdate(w, dt);
    this.scanT -= dt;
    ownedUpdate(w, dt);
    this.keeperT -= dt;
    if (this.keeperT <= 0) {
      this.keeperT = 2;
      assignKeepers(w);
    }
    showsUpdate(w, dt);
    this.guardT -= dt;
    if (this.guardT <= 0) {
      this.guardT = 1;
      assignWards(w);
    }
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
    dr.oddsT = Math.max(0, (dr.oddsT ?? 0) - dt);
    // left alone for a bit, a wild dragon's wounds close up
    dr.calmT = (dr.calmT ?? 99) + dt;
    if (dr.calmT > 10 && dr.hp < dr.maxHp) dr.hp = Math.min(dr.maxHp, dr.hp + dt * dr.maxHp * 0.005);
    const c = w.camp;
    // badly hurt: one that lives here flies home to its nest to heal (it'll be back); a visitor flees for good
    if (dr.nest && dr.hp < dr.maxHp * (dr.fury ? 0.12 : 0.35) && dr.state !== "home" && dr.state !== "perch" && dr.state !== "offering") {
      if (dr.prey) this.release(w, dr, true);
      this.go(dr, "home");
      if (!w.flags.has(`healHome${dr.id}`)) {
        w.flags.add(`healHome${dr.id}`);
        w.toast("🛡️", `${dr.name} is hurt and flies back to its nest to heal! The tribe drove it off… for now.`, dr.x, dr.y);
        w.discover("dragonSlayer", dr.x, dr.y);
        w.celebrate("Dragon gone!");
      }
    } else if (!dr.nest && dr.hp < dr.maxHp * (dr.fury ? 0.12 : 0.35) && dr.state !== "flee" && dr.state !== "leave") {
      if (dr.prey) this.release(w, dr, true);
      this.go(dr, "flee");
      const a = Math.atan2(dr.y - c.y, dr.x - c.x);
      dr.tx = dr.x + Math.cos(a) * 6000;
      dr.ty = dr.y + Math.sin(a) * 6000;
      w.sfx("screech", dr.x, dr.y, 1, 0.6);
      w.toast("🛡️", `${dr.name} is hurt and flees! The tribe drove off a dragon!`, dr.x, dr.y);
      w.discover("dragonSlayer", dr.x, dr.y);
      w.celebrate("Dragon gone!");
    }
    // called down to a clan's altar (clanRite.ts runs the rest)
    if (dr.state === "offering") {
      this.offeringStep(w, dr, dt);
      return;
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
      case "snatch":
        this.snatchStep(w, dr, dt);
        break;
      case "carry":
        this.carryStep(w, dr, dt, dr.x, dr.y);
        break;
      case "strafe": {
        const d = this.fly(dr, dr.tx, dr.ty, 340, dt, 95);
        // over our camp, or over the clan town it's attacking
        const town = dr.atClan ? w.rivals.clan(dr.atClan) : null;
        const cx = town?.x ?? c.x;
        const cy = town?.y ?? c.y;
        const nearCamp = Math.hypot(dr.x - cx, dr.y - cy) < 380;
        if (nearCamp) this.breathe(w, dr, dt);
        // snatching a Neanderthal off the ground as it goes over
        if (town && nearCamp && !dr.prey && this.rng() < dt * 0.25) {
          const b = w.rivals.brutes.find((x) => x.clan === town.id && !x.snatched && x.hp > 0 && !favored(w, x.clan, dr) && Math.hypot(x.x - dr.x, x.y - dr.y) < 260);
          if (b) {
            dr.foe = b.id;
            dr.preyBrute = true;
            this.go(dr, "snatch");
            break;
          }
        }
        if (d < 60 || dr.t > 9) {
          dr.passes++;
          if (dr.passes >= (dr.fury ? 5 : 2 + (dr.id % 2))) this.decide(w, dr, true);
          else {
            // circle round whichever town it's attacking (ours, or the clan's)
            dr.tx = cx;
            dr.ty = cy;
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

  /** Down to the altar it's been called to, and stay put while the clan feeds it. */
  private offeringStep(w: World, dr: Dragon, dt: number) {
    const rite = w.rivals.rite;
    if (!dr.riteClan || !rite || rite.dragon !== dr.id) {
      dr.riteClan = undefined;
      dr.spread = 0;
      dr.skyFire = false;
      this.afterPrey(dr);
      return;
    }
    const d = Math.hypot(dr.tx - dr.x, dr.ty - dr.y);
    if (d > 30 || dr.z > 4) {
      this.fly(dr, dr.tx, dr.ty, 260, dt, d < 140 ? 0 : 150);
      if (d < 40 && dr.z < 6) dr.z = 0;
      return;
    }
    dr.vx = dr.vy = 0;
    dr.z = 0;
    dr.anim += dt * 1.2;
  }

  private go(dr: Dragon, s: Dragon["state"]) {
    dr.state = s;
    dr.t = 0;
  }

  /** Circle done: attack the settlement, hunt a dino, or give up if it looks too well defended. */
  private decide(w: World, dr: Dragon, done: boolean) {
    const c = w.camp;
    // mid-attack on a clan town: another pass over it
    const was = dr.atClan ? w.rivals.clan(dr.atClan) : null;
    if (!done && was && !favored(w, was.id, dr)) {
      const a = this.rng() * Math.PI * 2;
      dr.tx = was.x + Math.cos(a) * 520;
      dr.ty = was.y + Math.sin(a) * 380;
      this.go(dr, "strafe");
      return;
    }
    dr.atClan = undefined;
    // the clans' towns are dragon country too (a raging parent only wants us)
    const towns = w.rivals.clans.filter((cl) => !favored(w, cl.id, dr));
    if (!done && !dr.waveOn && towns.length && this.rng() < 0.35) {
      const town = towns.sort((a, b) => Math.hypot(a.x - dr.x, a.y - dr.y) - Math.hypot(b.x - dr.x, b.y - dr.y))[0];
      const a = this.rng() * Math.PI * 2;
      dr.atClan = town.id;
      dr.tx = town.x + Math.cos(a) * 520;
      dr.ty = town.y + Math.sin(a) * 380;
      this.go(dr, "strafe");
      w.sfx("screech", town.x, town.y, 1, 0.5);
      if (!w.flags.has(`dragonClan${dr.id}`)) {
        w.flags.add(`dragonClan${dr.id}`);
        w.toast("🐉", `${dr.name} is attacking the ${town.name} clan's ${colorsOf(town).length > 1 || (town.campTier ?? 0) >= 4 ? "town" : "camp"}!`, town.x, town.y);
      }
      return;
    }
    const strength = w.tribe.defense(w);
    const scared = strength > 10 && dr.hp < dr.maxHp * 0.8 && !dr.fury;
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
    // a war chariot's shields take the fire for the crew behind them
    for (const ch of [...w.colony.chariots]) if (Math.hypot(ch.x - fx, ch.y - fy) < r + 46) hitChariot(w, ch, dr.fury ? 16 : 7, dr.name);
    for (const h of w.humans) {
      if (h.chariot) continue;
      if (Math.hypot(h.x - fx, h.y - fy) > r * (dr.fury ? 1.4 : 1)) continue;
      const home = h.state === "hide" || h.state === "sleep" || h.state === "rest" ? w.shelters.find((s) => s.id === h.home) : null;
      if (home && home.tier >= 3 && !dr.fury) continue; // stone + reinforced houses keep the fire out (not a furious dragon's)
      hurtHuman(w, h, dr.fury ? 0.5 : 0.32, fx, fy, "burn");
    }
    // Neanderthals in the flames, and their camps' stores
    for (const b of [...w.rivals.brutes]) if (!b.snatched && !favored(w, b.clan, dr) && Math.hypot(b.x - fx, b.y - fy) < r) w.rivals.hit(w, b, dr.fury ? 0.4 : 0.25, fx, fy, true);
    for (const cl of w.rivals.clans) if (Math.hypot(cl.x - fx, cl.y - fy) < 160) {
      cl.food = Math.max(0, cl.food - 0.4);
      cl.campWork = 0;
    }
    // walls + huts + buildings scorch
    const i = tileOf(fx, fy);
    const wl = w.tribe.wallAt(i % MAP_W, Math.floor(i / MAP_W));
    // a furious dragon's fire melts stone
    if (wl && wl.built >= 1) wl.hp -= (wl.kind === "polygon" ? 4 : wl.kind === "stone" ? 6 : 28) * (dr.fury ? 8 : 1);
    if (dr.fury && w.rng() < 0.3) w.particles.burst(P.Ember, fx, fy, 6, 50, { z: 4, vz: 40, size: 4, max: 0.9, color: "#ff8a2a" });
    for (const s of w.shelters) if (Math.hypot(s.x - fx, s.y - fy) < 60 && s.stage > 0) s.hp = Math.max(0, s.hp - (s.tier >= 4 ? 0.01 : s.tier >= 3 ? 0.04 : 0.12) * (dr.fury ? 4 : 1));
    for (const b of w.colony.buildings) if (Math.hypot(b.x - fx, b.y - fy) < 60) b.hp -= b.kind === "blacksmith" ? 4 : 20;
    for (const s of w.colony.scorpions) if (Math.hypot(s.x - fx, s.y - fy) < 50) s.hp -= 15;
  }

  /** A bolt or arrow struck a dragon. */
  hit(w: World, dr: Dragon, dmg: number) {
    // thick scales: a wild dragon takes half of any hit (a furious parent shrugs off almost everything: 50x harder)
    dmg *= 0.5;
    if (dr.fury) dmg /= 50;
    if (dr.prey && this.rng() < 0.1) this.release(w, dr, true);
    dr.hp -= dmg;
    dr.hit = 1;
    dr.calmT = 0;
    // smart: hurt + outmatched, it doesn't fight to the end: it breaks off to heal
    if (!dr.owner && !dr.fury && dr.hp > 0 && dr.hp < dr.maxHp * 0.6 && !(dr.oddsT ?? 0) && !["flee", "leave", "home", "perch", "offering"].includes(dr.state)) {
      dr.oddsT = 3;
      if (this.foesNear(w, dr.x, dr.y) > (dr.hp / dr.maxHp) * 18) {
        dr.oddsT = 30;
        if (dr.prey) this.release(w, dr, true);
        if (dr.nest) this.go(dr, "home");
        else {
          this.go(dr, "flee");
          const a = Math.atan2(dr.y - w.camp.y, dr.x - w.camp.x);
          dr.tx = dr.x + Math.cos(a) * 6000;
          dr.ty = dr.y + Math.sin(a) * 6000;
        }
        w.sfx("screech", dr.x, dr.y, 0.9, 0.7);
        w.toast("🐉", `${dr.name} knows it can't win this fight: it breaks off and flies ${dr.nest ? "back to its nest" : "away"} to heal.`, dr.x, dr.y);
      }
    }
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

  /** How much the town can throw at a dragon here: Scorpions, our war dragons, armed people. */
  foesNear(w: World, x: number, y: number) {
    let n = 0;
    for (const s of w.colony.scorpions) if (s.built >= 1 && s.hp > 0 && Math.hypot(s.x - x, s.y - y) < 760) n += 2 + s.tier;
    for (const o of this.owned) if (warTrained(o) && o.hp > o.maxHp * 0.3 && Math.hypot(o.x - x, o.y - y) < 900) n += 5 * (0.5 + (o.growth ?? 0) * 0.5) * (1 + (o.vet ?? 0));
    for (const h of w.humans) {
      if (h.child || h.state === "down" || Math.hypot(h.x - x, h.y - y) > 450) continue;
      const role = w.tribe.roleOf(h);
      if (role === "guard" || role === "hunter" || role === "dragonSlayer") n += 1;
    }
    return n;
  }

  /* ------------------------------ wild dragons at home ------------------------------ */

  /** A parent come to win its stolen baby back from the town. */
  private reclaimStep(w: World, dr: Dragon, nest: DragonNest, dt: number) {
    const baby = this.owned.find((o) => o.id === dr.foe && o.fromNest === nest.id);
    if (!baby || dr.t > 45) {
      if (baby) w.toast("🛡️", `${dr.name} couldn't get to ${baby.name} and gave up… for now.`, dr.x, dr.y);
      dr.foe = undefined;
      this.go(dr, "home");
      return;
    }
    const near = Math.hypot(baby.x - dr.x, baby.y - dr.y);
    this.fly(dr, baby.x, baby.y, 340, dt, Math.max(baby.z + 10, near < 220 ? 30 : 180));
    if (near > 50 || Math.abs(dr.z - baby.z) > 60) return;
    // a tussle for the baby: its rider + a war dragon by its side make it much harder
    const rider = dragonRiderOf(w, baby);
    const guarded = !!rider && (rider.aloft === baby.id || Math.hypot(rider.x - baby.x, rider.y - baby.y) < 140);
    const friends = this.owned.some((o) => o !== baby && warTrained(o) && Math.hypot(o.x - baby.x, o.y - baby.y) < 320);
    const chance = 0.55 - (warTrained(baby) ? 0.25 : 0) - (guarded ? 0.15 : 0) - (friends ? 0.15 : 0) + (dr.fury ? 0.2 : 0);
    if (this.rng() < chance) this.takeBack(w, dr, baby, nest);
    else {
      w.toast("🛡️", `${baby.name} fought to stay with us${guarded ? ` and ${rider!.name}` : ""}! ${dr.name} backs off.`, baby.x, baby.y);
      this.hit(w, dr, dr.maxHp * 0.08);
      dr.foe = undefined;
      this.go(dr, "home");
    }
  }

  /** It got its baby back: the little one goes wild again and flies home with its parent. */
  private takeBack(w: World, dr: Dragon, baby: Dragon, nest: DragonNest) {
    const on = w.humans.find((h) => h.aloft === baby.id);
    if (on) {
      const z = baby.z;
      dismountDragon(w, on);
      if (z > 20) {
        on.z = z;
        this.dropBody(w, baby, on, false, false, "");
      }
    }
    const rider = baby.partner ? w.humans.find((h) => h.id === baby.partner) : null;
    if (rider && rider.dragon === baby.id) rider.dragon = undefined;
    this.owned.splice(this.owned.indexOf(baby), 1);
    Object.assign(baby, {
      owner: false, young: true, nest: nest.id, cmd: null, partner: undefined, rider: 0, keeper: undefined, trainer: undefined, foe: undefined,
      lesson: null, burst: 0, carrying: null, roost: undefined, prey: undefined, auto: undefined,
    });
    baby.state = "home";
    baby.t = 0;
    this.list.push(baby);
    dr.foe = undefined;
    this.go(dr, "home");
    w.sfx("screech", dr.x, dr.y, 1.4, 0.5);
    w.toast("🐉", `${dr.name} won its baby ${baby.name} back! They fly home to the nest together. It'll grow up wild there, fighting beside its parent and guarding the eggs.`, dr.x, dr.y);
  }

  /** A wild youngster at its parents' nest. */
  private youngStep(w: World, dr: Dragon, nest: DragonNest, dt: number) {
    if ((dr.growth ?? 0) < 1) {
      dr.age = (dr.age ?? 0) + dt;
      const before = dr.growth ?? 0;
      dr.growth = Math.min(1, (dr.age ?? 0) / GROW_SECONDS);
      if (Math.floor(before * 4) !== Math.floor(dr.growth * 4)) newDragonStats(dr);
    }
    const big = (dr.growth ?? 0) > 0.3;
    const parent = nest.parent ? this.byId(nest.parent) : null;
    // side by side with its parent when it goes out to fight
    if (big && parent && parent.z > 6 && ["defend", "chase", "reclaim", "strafe", "arrive", "circle", "snatch", "hunt"].includes(parent.state)) {
      const d = this.fly(dr, parent.x - parent.dir * 80, parent.y + 34, 340, dt, Math.max(40, parent.z - 20));
      dr.state = "defend";
      if (parent.breath > 0.5 && d < 220) this.breathe(w, dr, dt);
      return true;
    }
    // guarding the eggs: anyone creeping up on the nest
    if (big && dr.hp > dr.maxHp * 0.4) {
      const h = w.humans.find((x) => !x.aloft && !x.under && !x.captive && x.state !== "down" && Math.hypot(x.x - nest.x, x.y - nest.y) < 260);
      if (h) {
        const d = this.fly(dr, h.x, h.y, 300, dt, Math.hypot(h.x - dr.x, h.y - dr.y) < 240 ? 60 : 140);
        dr.state = "defend";
        if (d < 170) this.breathe(w, dr, dt);
        return true;
      }
    }
    // home: beside the nest
    const px = nest.x - 46;
    const py = nest.y + 10;
    const d = this.fly(dr, px, py, 240, dt, Math.hypot(px - dr.x, py - dr.y) > 160 ? 160 : 0);
    if (d < 18 && dr.z < 6) {
      dr.z = 0;
      dr.vx = dr.vy = 0;
      dr.state = "perch";
      dr.anim += dt * 0.8;
      dr.hp = Math.min(dr.maxHp, dr.hp + dt * dr.maxHp * 0.004);
    } else dr.state = "home";
    return true;
  }

  /** A wild dragon that lives at a nest. Returns true if it handled this frame. */
  private resident(w: World, dr: Dragon, dt: number): boolean {
    const nest = this.nests.find((n) => n.id === dr.nest);
    if (!nest) {
      dr.nest = undefined;
      return false;
    }
    const nx = nest.x + 34;
    const ny = nest.y - 8;
    // a youngster raised here: grows up beside its parent, guards the eggs, fights at its side
    if (dr.young) return this.youngStep(w, dr, nest, dt);
    // its eggs are gone (stolen), or one hatched in the town: it hunts people
    const stolen = this.eggs.some((e) => e.nest === nest.id && e.at !== "nest") || this.owned.some((d) => d.fromNest === nest.id);
    if (dr.fury) dr.furyT = (dr.furyT ?? 0) - dt;
    // swooping on someone it's spotted on a raid / an attack
    if ((dr.state === "circle" || dr.state === "strafe") && (dr.fury || stolen) && this.rng() < dt * 0.12) {
      const prey = this.preyFor(w, dr, 520, dr.x, dr.y, !!dr.fury);
      if (prey) {
        dr.foe = prey.id;
        dr.preyBrute = false;
        this.go(dr, "snatch");
      }
    }
    switch (dr.state) {
      case "snatch":
        this.snatchStep(w, dr, dt);
        return true;
      case "carry":
        this.carryStep(w, dr, dt, nx, ny);
        return true;
      case "reclaim":
        this.reclaimStep(w, dr, nest, dt);
        return true;
      case "fetch": {
        // branches for the nest it's building
        const d = this.fly(dr, dr.tx, dr.ty, 220, dt, d0(dr) > 80 ? 120 : 10);
        if (d < 40) {
          w.particles.burst(P.Leaf, dr.x, dr.y, 8, 50, { z: 20, size: 3, max: 0.9, color: "#6b9a3f" });
          this.go(dr, "home");
        }
        return true;
      }
      case "perch": {
        dr.x += (nx - dr.x) * Math.min(1, dt * 2);
        dr.y += (ny - dr.y) * Math.min(1, dt * 2);
        dr.z = Math.max(0, dr.z - dt * 80);
        dr.vx = dr.vy = 0;
        dr.anim += dt * 0.8;
        dr.hp = Math.min(dr.maxHp, dr.hp + dt * dr.maxHp * 0.004);
        // its baby is being raised in the town: now and then it comes to win it back
        const baby = this.owned.find((o) => o.fromNest === nest.id);
        if (baby) {
          dr.reclaimT = (dr.reclaimT ?? 300 + this.rng() * 240) - dt;
          if (dr.reclaimT <= 0 && dr.hp > dr.maxHp * 0.7 && w.tribe.danger !== "calm") {
            dr.reclaimT = 420 + this.rng() * 300;
            dr.foe = baby.id;
            this.go(dr, "reclaim");
            w.sfx("screech", baby.x, baby.y, 1.3, 0.45);
            w.toast("🐉", `${dr.name} is coming to take its baby ${baby.name} back! Keep ${baby.name}'s rider close and defend it!`, baby.x, baby.y);
            w.alarm(baby.x, baby.y, 700, 0.8, "😱", false);
            return true;
          }
        }
        // anyone creeping up on the nest gets driven off (unless it's too hurt: then it just watches)
        const intruder = dr.hp < dr.maxHp * 0.4 ? null : w.humans.find((h) => !h.aloft && !h.under && !h.captive && h.state !== "down" && Math.hypot(h.x - nest.x, h.y - nest.y) < 300);
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
        // furious: when the time comes, it goes for the town (a raging attack in waves)
        if (dr.fury && (dr.furyT ?? 0) <= 0 && dr.hp > dr.maxHp * 0.3) {
          dr.waveOn = true;
          dr.passes = 0;
          dr.tx = w.camp.x;
          dr.ty = w.camp.y;
          this.go(dr, "arrive");
          w.sfx("screech", w.camp.x, w.camp.y, 1.5, 0.3);
          w.toast("😡", `${dr.name} is coming for the town, full of rage! It's huge now, its fire melts stone, and arrows barely scratch it. Get everyone inside!`, w.camp.x, w.camp.y);
          w.alarm(w.camp.x, w.camp.y, 1400, 1, "😱", false);
          return true;
        }
        // expecting: back and forth with branches for the nest
        if (dr.gravid && dr.t > 14) {
          dr.t = 0;
          const a = this.rng() * Math.PI * 2;
          dr.tx = nest.x + Math.cos(a) * (300 + this.rng() * 400);
          dr.ty = nest.y + Math.sin(a) * (200 + this.rng() * 260);
          this.go(dr, "fetch");
          return true;
        }
        // its eggs are gone: it goes hunting for people (the smarter it gets, the more it takes the ones who'd fight it)
        if (stolen && dr.t > 35 + (dr.id % 20)) {
          dr.t = 0;
          const prey = this.preyFor(w, dr, 2800, nest.x, nest.y, !!dr.fury);
          if (prey && this.rng() < 0.75) {
            dr.foe = prey.id;
            dr.preyBrute = false;
            this.go(dr, "snatch");
            if (!w.flags.has(`hunt${dr.id}`)) {
              w.flags.add(`hunt${dr.id}`);
              w.toast("🐉", `${dr.name} knows its eggs were taken. It's hunting people now: it goes for hunters and anyone caught outside the walls!`, prey.x, prey.y);
            }
            return true;
          }
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
          } else if (this.rng() < 0.3 && w.rivals.brutes.some((b) => !b.snatched && !favored(w, b.clan, dr) && Math.hypot(b.x - nest.x, b.y - nest.y) < 2600)) {
            // a Neanderthal makes a meal too (not one from a clan that's fed it)
            const b = w.rivals.brutes.filter((x) => !x.snatched && x.hp > 0 && !favored(w, x.clan, dr)).sort((a, o) => Math.hypot(a.x - nest.x, a.y - nest.y) - Math.hypot(o.x - nest.x, o.y - nest.y))[0];
            dr.foe = b.id;
            dr.preyBrute = true;
            this.go(dr, "snatch");
          } else if (this.rng() < 0.7) this.decide(w, dr, true);
        }
        return true;
      }
      case "home": {
        const d = this.fly(dr, nx, ny, 260, dt, Math.hypot(nx - dr.x, ny - dr.y) > 200 ? 220 : 0);
        if (d < 20 && dr.z < 6) {
          dr.z = 0;
          this.go(dr, "perch");
          if (dr.waveOn) {
            dr.waveOn = false;
            dr.waves = (dr.waves ?? 0) + 1;
            dr.furyT = 200 + this.rng() * 80;
            if ((dr.waves ?? 0) >= 3) {
              dr.fury = false;
              newDragonStats(dr);
              w.toast("🐉", `${dr.name}'s rage has burned itself out. It's back on its nest, but it hasn't forgotten.`, dr.x, dr.y);
            }
          }
          // an egg gone from the nest: furious, it goes looking for whoever has it
          const thief = w.humans.find((h) => (h.egg || h.egg2) && this.eggs.find((e) => (e.id === h.egg || e.id === h.egg2))?.nest === nest.id && Math.hypot(h.x - nest.x, h.y - nest.y) < 1800);
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
        let egg = this.eggs.find((e) => e.nest === nest.id && (e.at === "carried" || e.at === "ground") && (e.at === "ground" || e.carrier === dr.foe));
        // its first thief got clean away: go after another one with an egg
        if (!egg) {
          const other = this.eggs.find((e) => e.nest === nest.id && e.at === "carried");
          if (other) {
            egg = other;
            dr.foe = other.carrier;
          }
        }
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

  /* ------------------------------ snatching people ------------------------------ */

  /**
   * Who a vengeful dragon goes for: hunters, slayers, egg runners + the keepers of its stolen eggs
   * first, then anyone outside the walls (anyone at all once it's furious). Never children.
   */
  private preyFor(w: World, dr: Dragon, r: number, x: number, y: number, fury: boolean) {
    let best: Human | null = null;
    let bs = -Infinity;
    for (const h of w.humans) {
      if (h.child || h.under || h.aloft || h.captive || h.snatched || h.stranger || h.chariot) continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d > r) continue;
      const inside = w.tribe.walledIn(w, h.x, h.y);
      if (inside && !fury) continue;
      const role = w.tribe.roleOf(h);
      const keeperOfMine = this.eggs.some((e) => e.keeper === h.id && e.nest === dr.nest) || this.owned.some((o) => o.keeper === h.id && o.fromNest === dr.nest);
      const s = (keeperOfMine ? 900 : 0) + (role === "hunter" || role === "dragonSlayer" || role === "eggRunner" ? 500 : 0) + (inside ? 0 : 200) + (h.state === "down" ? 150 : 0) - d * 0.3;
      if (s > bs) {
        bs = s;
        best = h;
      }
    }
    return best;
  }

  /** Whoever it's after (one of ours, or a Neanderthal). */
  private preyEntity(w: World, dr: Dragon, id: number | undefined) {
    if (!id) return null;
    if (dr.preyBrute) return w.rivals.byId(id);
    return w.humans.find((x) => x.id === id) ?? null;
  }

  /** What it does after dropping / losing its prey. */
  private afterPrey(dr: Dragon) {
    dr.preyBrute = false;
    this.go(dr, dr.waveOn ? "circle" : dr.nest ? "home" : "leave");
    if (!dr.nest && dr.state === "leave") {
      const a = this.rng() * Math.PI * 2;
      dr.tx = dr.x + Math.cos(a) * 7000;
      dr.ty = dr.y + Math.sin(a) * 7000;
    }
  }

  /** Swooping on someone. */
  private snatchStep(w: World, dr: Dragon, dt: number) {
    const p = this.preyEntity(w, dr, dr.foe);
    const gone = !p || p.snatched || ("under" in p && (p.under || p.aloft)) || (p.kind === "brute" && p.hp <= 0);
    if (gone || dr.t > 25) {
      this.afterPrey(dr);
      return;
    }
    const d = this.fly(dr, p.x, p.y, 360, dt, Math.hypot(p.x - dr.x, p.y - dr.y) < 200 ? 24 : 160);
    if (d < 34 && dr.z < 50) {
      if (p.kind === "human") this.grabPerson(w, dr, p);
      else {
        p.snatched = dr.id;
        dr.prey = p.id;
        this.go(dr, "carry");
        w.sfx("screech", dr.x, dr.y, 1.2, 0.5);
        w.toast("🐉", `${dr.name} snatched ${p.name} the Neanderthal right out of the camp!`, p.x, p.y);
      }
    }
  }

  /** Carrying them off: to the volcano (else its nest). */
  private carryStep(w: World, dr: Dragon, dt: number, nx: number, ny: number) {
    const p = this.preyEntity(w, dr, dr.prey);
    if (!p) {
      dr.prey = undefined;
      this.afterPrey(dr);
      return;
    }
    const v = w.volcano;
    const toVolcano = Math.hypot(v.x - dr.x, v.y - dr.y) < 3200;
    const tx = toVolcano ? v.x : nx;
    const ty = toVolcano ? v.y : ny;
    const d = this.fly(dr, tx, ty, 300, dt, toVolcano ? 440 : 60);
    if (d >= 90 || (toVolcano && dr.z < 380)) return;
    if (p.kind === "human") {
      this.dropPrey(w, dr, p, toVolcano);
      return;
    }
    // a Neanderthal: let go over the volcano (we watch them fall), or eaten at the nest
    dr.prey = undefined;
    const clan = w.rivals.clan(p.clan);
    if (toVolcano) this.dropBody(w, dr, p, true, true, `${dr.name} dropped ${p.name} of the ${clan?.name ?? "?"} clan into the volcano!`);
    else {
      p.snatched = undefined;
      w.sfx("chomp", dr.x, dr.y, 1.2, 0.5);
      w.toast("🐉", `${dr.name} ate ${p.name} the Neanderthal.`, dr.x, dr.y);
      w.rivals.kill(w, p);
    }
    this.afterPrey(dr);
  }

  /** The volcano spits (a body just went in): a burst of lava + a rolling cloud of smoke out of the crater. */
  lavaPuff(w: World) {
    const v = w.volcano;
    const y = v.y + CRATER_Y;
    w.particles.burst(P.Ember, v.x, y, 40, 160, { z: CRATER_Z, vz: 220, g: 260, size: 5, max: 1.4, color: "#ff6a1f" });
    w.particles.burst(P.Ember, v.x, y, 20, 120, { z: CRATER_Z + 10, vz: 260, g: 300, size: 4, max: 1.2, color: "#ffd447" });
    w.particles.burst(P.Smoke, v.x, y, 14, 60, { z: CRATER_Z + 20, vz: 70, size: 26, max: 3, color: "rgba(50,40,36,0.75)" });
    w.sfx("boom", v.x, v.y, 1.1, 0.7);
  }

  /**
   * Let go of someone in the air. Over the volcano they fall into the crater (the lava + smoke come
   * when they hit it); anywhere else they fall to the ground. Either way you see the body fall.
   */
  dropBody(w: World, dr: Dragon, p: Human | Brute, volcano: boolean, lethal: boolean, msg: string) {
    p.snatched = undefined;
    p.falling = true;
    let x = p.x;
    let y = p.y;
    let z = Math.max(0, dr.z - 26);
    if (volcano) {
      // same spot on screen, but sorted in front of the mountain so we see it go into the crater
      const v = w.volcano;
      const screenY = dr.y + 2 - z;
      x = v.x + Math.max(-36, Math.min(36, dr.x - v.x));
      y = v.y + CRATER_Y;
      z = Math.max(CRATER_Z + 4, y - screenY);
    }
    p.x = x;
    p.y = y;
    p.z = z;
    this.falls.push({ id: p.id, brute: p.kind === "brute", x, y, z, vz: 30, volcano, lethal, msg });
    w.sfx("whoosh", x, y, 0.8, 0.5);
    if (p.kind === "human") sayH(p, "AAAAAAAH!");
    else sayB(p, "AAAARGH!", 2);
  }

  /** Bodies falling: when they land, the volcano spits (or they hit the ground). */
  private fallsUpdate(w: World, dt: number) {
    for (const f of [...this.falls]) {
      const p: Human | Brute | null = f.brute ? w.rivals.byId(f.id) : w.humans.find((h) => h.id === f.id) ?? null;
      if (!p) {
        this.falls.splice(this.falls.indexOf(f), 1);
        continue;
      }
      f.vz -= 620 * dt;
      f.z += f.vz * dt;
      const floor = f.volcano ? CRATER_Z : 0;
      p.x = f.x;
      p.y = f.y;
      p.z = Math.max(floor, f.z);
      p.vx = p.vy = 0;
      p.anim += dt * 12;
      if (p.kind === "human") p.state = "tossed";
      if (f.z > floor) continue;
      this.falls.splice(this.falls.indexOf(f), 1);
      p.falling = false;
      if (f.volcano) {
        this.lavaPuff(w);
        // gone into the crater (what's left is up there, not down at the foot of the mountain)
        p.y = w.volcano.y - 150;
        p.z = 0;
        if (p.kind === "human") killHuman(w, p, `${f.msg} A puff of lava and smoke…`);
        else {
          w.toast("🌋", `${f.msg} A puff of lava and smoke…`, p.x, p.y);
          w.rivals.kill(w, p);
        }
        continue;
      }
      p.z = 0;
      w.particles.burst(P.Dust, p.x, p.y, 10, 60, { size: 12, max: 0.9, color: "rgba(160,135,100,0.6)" });
      w.sfx("thud", p.x, p.y, 1, 0.6);
      if (p.kind === "human") {
        if (f.lethal) killHuman(w, p, f.msg);
        else hurtHuman(w, p, Math.min(0.6, f.z < 0 ? 0.35 : 0.2), p.x, p.y, "rock");
      } else if (f.lethal) {
        w.toast("🐉", f.msg, p.x, p.y);
        w.rivals.kill(w, p);
      } else w.rivals.hit(w, p, 0.3, p.x, p.y, true);
    }
  }

  /** Grab a person in its claws. */
  private grabPerson(w: World, dr: Dragon, h: Human) {
    h.snatched = dr.id;
    h.egg = undefined;
    h.egg2 = undefined;
    h.riding = 0;
    dr.prey = h.id;
    this.go(dr, "carry");
    w.sfx("screech", dr.x, dr.y, 1.2, 0.5);
    w.sfx("yelp", h.x, h.y, 1);
    w.toast("🐉", `${dr.name} snatched ${h.name} into the sky!`, h.x, h.y);
    w.alarm(h.x, h.y, 700, 1, "😱", true);
  }

  /** It lets go: over the volcano (a puff of lava + smoke), back at its nest (eaten), or dropped when hit. */
  private dropPrey(w: World, dr: Dragon, h: Human, volcano: boolean) {
    dr.prey = undefined;
    if (volcano) this.dropBody(w, dr, h, true, true, `${dr.name} dropped ${h.name} into the volcano!`);
    else {
      h.snatched = undefined;
      w.sfx("chomp", dr.x, dr.y, 1.2, 0.5);
      killHuman(w, h, `${dr.name} carried ${h.name} back to its nest and ate them.`);
    }
    this.afterPrey(dr);
  }

  /** Let go of whoever it's carrying (they fall and get hurt, but live). */
  release(w: World, dr: Dragon, hitWhileCarrying: boolean) {
    const p = this.preyEntity(w, dr, dr.prey);
    dr.prey = undefined;
    if (p && p.kind === "brute") {
      // they fall (and get hurt landing, but live)
      this.dropBody(w, dr, p, false, false, "");
      this.afterPrey(dr);
      return;
    }
    const h = p;
    if (!h) return;
    this.dropBody(w, dr, h, false, false, "");
    if (hitWhileCarrying) w.toast("🎯", `Hit! ${dr.name} dropped ${h.name}!`, h.x, h.y);
    if (dr.state === "carry") this.afterPrey(dr);
  }

  /* ------------------------------ saving ------------------------------ */

  serialize() {
    const r = (n: number) => Math.round(n * 10) / 10;
    const dragon = (d: Dragon) => ({
      id: d.id, name: d.name, x: r(d.x), y: r(d.y), hp: Math.round(d.hp), breed: d.breed, nest: d.nest,
      ...(d.fury ? { fury: true, furyT: Math.round(d.furyT ?? 0), waves: d.waves ?? 0 } : {}),
      ...(d.fromNest ? { fromNest: d.fromNest } : {}),
      ...(d.young ? { young: true, age: r(d.age ?? 0) } : {}),
      ...(d.vet ? { vet: Math.round(d.vet * 100) / 100 } : {}),
      ...(d.tint !== undefined ? { tint: d.tint, marks: d.marks, eye: d.eye } : {}),
      ...(d.hatchedBy ? { hatchedBy: d.hatchedBy } : {}),
      ...(d.owner ? {
        owner: true, age: r(d.age ?? 0), skills: d.skills, partner: d.partner, stamina: r(d.stamina ?? 1), energy: r(d.energy ?? 1),
        hunger: r(d.hunger ?? 0), auto: d.auto !== false, keeper: d.keeper, roost: d.roost, rare: d.rare || undefined, carrying: d.carrying || undefined,
      } : {}),
    });
    return {
      timer: Math.round(this.timer),
      seeded: this.seeded,
      topped: this.topped,
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
    this.topped = !!(d as { topped?: boolean }).topped;
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
      const look = s as { tint?: number; marks?: Dragon["marks"]; eye?: string; hatchedBy?: number };
      if (look.tint !== undefined) Object.assign(dr, { tint: look.tint, marks: look.marks, eye: look.eye });
      if (look.hatchedBy) dr.hatchedBy = look.hatchedBy;
      if (owned) {
        Object.assign(dr, {
          owner: true, age: o.age ?? 0, skills: { ...(o.skills ?? {}) }, partner: o.partner, stamina: o.stamina ?? 1, energy: o.energy ?? 1,
          hunger: o.hunger ?? 0, auto: o.auto !== false, keeper: o.keeper, roost: o.roost, rare: !!o.rare, carrying: o.carrying ?? null, cmd: null, fireCd: 0, burst: 0, lesson: null,
        });
      }
      return dr;
    };
    for (const s of d.wild ?? []) {
      const dr = make(s, false);
      const o = s as { fury?: boolean; furyT?: number; waves?: number; young?: boolean; age?: number };
      if (o.fury) Object.assign(dr, { fury: true, furyT: o.furyT ?? 120, waves: o.waves ?? 0, maxHp: BREEDS[dr.breed ?? "fire"].hp });
      if (o.young) {
        dr.young = true;
        dr.age = o.age ?? 0;
        dr.growth = Math.min(1, dr.age / GROW_SECONDS);
        const hp = dr.hp;
        newStats(dr);
        dr.hp = Math.min(dr.maxHp, hp);
      }
      this.list.push(dr);
    }
    for (const s of d.owned ?? []) {
      const dr = make(s, true);
      const from = (s as { fromNest?: number }).fromNest;
      if (from) dr.fromNest = from;
      const vet = (s as { vet?: number }).vet;
      if (vet) dr.vet = vet;
      this.owned.push(dr);
    }
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
    this.falls = [];
    this.seeded = false;
    this.idSeq = DRAGON_IDS;
    this.show = null;
  }
}

/** (kept separate so dragonKeep's import cycle resolves lazily) */
function newStats(dr: Dragon) {
  newDragonStats(dr);
}
