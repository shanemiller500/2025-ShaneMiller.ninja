/* ------------------------------------------------------------------ */
/*  Dragons (fantasy!). Rare, huge and dangerous. A state machine:     */
/*                                                                     */
/*   arrive → circle the settlement → strafe it with fire breath, or   */
/*   hunt a big dinosaur → land + eat → leave.  Badly hurt → flee.     */
/*                                                                     */
/*  They fly over walls. Fire breath lights trees + thatch, scorches   */
/*  whatever it touches and sends everybody running. Scorpions do      */
/*  extra damage to them; archers can hit them too.                    */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { sizeOf, setState, emote } from "./dinos";
import { tileOf } from "./nav";
import { P } from "./particles";
import { pick } from "./rng";
import { MAP_W, TILE, WORLD_H, WORLD_W, type Dino, type Dragon } from "./types";
import { hurtHuman } from "./injury";
import type { World } from "./world";

const NAMES = ["Emberwing", "Ashfang", "Cinderclaw", "Scorchtail", "Pyrrha", "Smoulder", "Blazebeak"];
const MAX_HP = 2600;

export class Dragons {
  list: Dragon[] = [];
  /** seconds until a dragon might visit by itself */
  timer = 1500;
  private breathT = 0;

  byId(id: number) {
    return this.list.find((d) => d.id === id) ?? null;
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
        if (dr.t > 14) {
          this.go(dr, "leave");
          const a = w.rng() * Math.PI * 2;
          dr.tx = dr.x + Math.cos(a) * 7000;
          dr.ty = dr.y + Math.sin(a) * 7000;
        }
        break;
      case "flee":
      case "leave":
        this.fly(dr, dr.tx, dr.ty, dr.state === "flee" ? 420 : 300, dt, 320);
        if (dr.x < -400 || dr.y < -400 || dr.x > WORLD_W + 400 || dr.y > WORLD_H + 400) this.list.splice(this.list.indexOf(dr), 1);
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
    if (wl && wl.built >= 1) wl.hp -= wl.kind === "stone" ? 6 : 28;
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

  clear() {
    this.list = [];
  }
}
