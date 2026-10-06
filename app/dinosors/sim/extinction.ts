/* ------------------------------------------------------------------ */
/*  The extinction asteroid. Only the player can call it down. It runs  */
/*  as a short cinematic: the sky turns, animals panic, the rock grows  */
/*  in the sky, a countdown, the flash, then a shockwave rolls across  */
/*  the map killing most life, lighting fires and waking the volcano.  */
/*  Ash hangs in the air afterwards. A Deep shelter or a charged       */
/*  Resonance shield gives people a chance — never a promise.          */
/* ------------------------------------------------------------------ */
import { BUILDINGS } from "../data/colony";
import { SHIELD_HOLD } from "../data/civ";
import { sp } from "../data/species";
import { emote, setState, sizeOf } from "./dinos";
import { go, say } from "./humans";
import { P } from "./particles";
import { downDino } from "./tribe";
import { MAP_W, T, TILE, WORLD_H, WORLD_W, type Human } from "./types";
import type { World } from "./world";

export type ExtPhase = "idle" | "omen" | "incoming" | "impact" | "aftermath" | "ended" | "ruins";

export const EXT_TIMES = { omen: 7, incoming: 10, impact: 7, aftermath: 14 };

export interface ExtStats {
  dinosBefore: number;
  dinosLost: number;
  peopleBefore: number;
  peopleLost: number;
  sheltered: number;
  shieldHeld: boolean;
  buildingsLost: number;
}

export class Extinction {
  phase: ExtPhase = "idle";
  t = 0;
  /** where it lands */
  x = 0;
  y = 0;
  /** shockwave radius */
  wave = 0;
  stats: ExtStats | null = null;
  /** 0..1 how dark the ash sky is (fades over many minutes after) */
  ash = 0;
  version = 0;
  private hit = new Set<number>();
  private safe = new Set<number>();

  get active() {
    return this.phase === "omen" || this.phase === "incoming" || this.phase === "impact" || this.phase === "aftermath";
  }

  /** Seconds left before impact (for the countdown). */
  countdown() {
    if (this.phase === "omen") return EXT_TIMES.omen - this.t + EXT_TIMES.incoming;
    if (this.phase === "incoming") return EXT_TIMES.incoming - this.t;
    return 0;
  }

  trigger(w: World) {
    if (this.active) return false;
    // it comes down out in the wilds, a good way from camp: far enough to watch, close enough to matter
    const a = w.rng() * Math.PI * 2;
    this.x = Math.max(400, Math.min(WORLD_W - 400, w.camp.x + Math.cos(a) * 1500));
    this.y = Math.max(400, Math.min(WORLD_H - 400, w.camp.y + Math.sin(a) * 900));
    this.phase = "omen";
    this.t = 0;
    this.wave = 0;
    this.hit.clear();
    this.safe.clear();
    this.stats = {
      dinosBefore: w.dinos.length,
      dinosLost: 0,
      peopleBefore: w.humans.length,
      peopleLost: 0,
      sheltered: 0,
      shieldHeld: false,
      buildingsLost: 0,
    };
    this.version++;
    w.sfx("rumble", w.camX, w.camY, 1.2);
    w.toast("🌘", "The sky is changing colour… something is wrong.", undefined, undefined);
    w.discover("omen");
    return true;
  }

  update(w: World, dt: number) {
    if (this.phase === "idle") return;
    if (this.phase === "ruins" || this.phase === "ended") {
      // the ash slowly clears over a few in-game days
      this.ash = Math.max(this.phase === "ended" ? 0.6 : 0, this.ash - dt * 0.002);
      return;
    }
    this.t += dt;
    switch (this.phase) {
      case "omen":
        this.ash = Math.min(0.25, this.ash + dt * 0.04);
        if (w.rng() < dt * 1.5) this.unrest(w);
        if (this.t >= EXT_TIMES.omen) this.next(w, "incoming");
        break;
      case "incoming":
        if (w.rng() < dt * 2) this.unrest(w);
        if (Math.floor(this.t) !== Math.floor(this.t - dt)) {
          const left = Math.ceil(EXT_TIMES.incoming - this.t);
          if (left <= 5 && left > 0) w.sfx("tick", w.camX, w.camY, 0.7, 1 + (5 - left) * 0.1);
        }
        w.shake(Math.min(6, this.t * 0.6), 0.2);
        if (this.t >= EXT_TIMES.incoming) this.impact(w);
        break;
      case "impact":
        this.wave += dt * 900;
        this.ash = Math.min(0.85, this.ash + dt * 0.12);
        this.sweep(w);
        if (w.rng() < dt * 6) this.debris(w);
        if (this.t >= EXT_TIMES.impact) this.next(w, "aftermath");
        break;
      case "aftermath":
        this.ash = Math.min(0.75, this.ash + dt * 0.02);
        if (w.rng() < dt * 1.5) this.debris(w);
        if (this.t >= EXT_TIMES.aftermath) {
          this.next(w, "ended");
          w.toast("🌑", "THE AGE ENDS.");
        }
        break;
    }
  }

  private next(w: World, p: ExtPhase) {
    this.phase = p;
    this.t = 0;
    this.version++;
    if (p === "incoming") {
      w.toast("☄️", "AN ASTEROID! It's coming down — everyone take cover!", this.x, this.y);
      w.sfx("whoosh", this.x, this.y, 1.4, 0.4);
      this.takeCover(w);
    }
  }

  /** Animals panic, flyers flee, people look up. */
  private unrest(w: World) {
    for (const d of w.dinos) {
      if (d.owner || d.state === "carried" || w.rng() > 0.25) continue;
      const def = sp(d.species);
      if (def.move === "fly") setState(d, "flee", d.x + (w.rng() - 0.5) * 600, -400);
      else if (def.move === "walk") {
        const a = Math.atan2(d.y - this.y, d.x - this.x);
        setState(d, "flee", d.x + Math.cos(a) * 500, d.y + Math.sin(a) * 400);
      }
      if (w.rng() < 0.3) emote(d, "😱", 1.5);
    }
    if (w.rng() < 0.5) w.sfx("roar", w.camX + (w.rng() - 0.5) * 600, w.camY, 0.5, 0.7 + w.rng() * 0.5);
  }

  /** Where each person runs: the deep shelter, the shield dome, else home. */
  private takeCover(w: World) {
    const bunker = w.colony.buildings.find((b) => b.kind === "shelterDeep" && b.built >= 1);
    const shield = w.colony.buildings.find((b) => b.kind === "resShield" && b.built >= 1);
    for (const h of w.humans) {
      if (h.state === "down") continue;
      h.order = null;
      if (bunker) {
        const d = w.colony.door(bunker);
        go(h, "walk", d.x + (w.rng() - 0.5) * 30, d.y - 4);
      } else if (shield) go(h, "walk", shield.x + (w.rng() - 0.5) * 120, shield.y + 20 + (w.rng() - 0.5) * 80);
      say(h, "RUN!", 2);
    }
  }

  private impact(w: World) {
    this.next(w, "impact");
    w.flash(1, "#fffbe8");
    w.shake(30, 3);
    w.sfx("boom", this.x, this.y, 2, 0.5);
    w.sfx("boom", w.camX, w.camY, 1.6, 0.4);
    w.particles.spawn(P.Ring, this.x, this.y, { size: 60, max: 2.5, color: "rgba(255,240,200,0.95)" });
    w.particles.burst(P.Dust, this.x, this.y, 50, 400, { size: 26, max: 3, color: "rgba(120,95,80,0.7)" });
    // a crater
    const tx = Math.floor(this.x / TILE);
    const ty = Math.floor(this.y / TILE);
    for (let dy = -6; dy <= 6; dy++)
      for (let dx = -6; dx <= 6; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > 6.2) continue;
        const i = (ty + dy) * MAP_W + tx + dx;
        const t = w.terrain.tiles[i] as T | undefined;
        if (t === undefined || t === T.Deep) continue;
        w.terrain.setTile(tx + dx, ty + dy, d < 3.5 ? T.Basalt : T.Dirt);
        if (d >= 3.5) w.fire.ignite(w, tx + dx, ty + dy, 1);
      }
    // fragments of the rock itself lie around the crater
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + w.rng();
      const x = this.x + Math.cos(a) * 260;
      const y = this.y + Math.sin(a) * 200;
      w.colony.nodes.push({ id: w.nextId(), kind: "meteorite", x, y, amount: 4, max: 4, found: true, variant: k % 4 });
    }
    // the volcano wakes
    if (w.volcano.phase === "idle") w.volcano.mega(w);
    // who is safe?
    const bunker = w.colony.buildings.find((b) => b.kind === "shelterDeep" && b.built >= 1);
    const shield = w.colony.buildings.find((b) => b.kind === "resShield" && b.built >= 1);
    const held = !!shield && w.civ.energy >= SHIELD_HOLD;
    if (held) w.civ.energy -= SHIELD_HOLD;
    if (this.stats) this.stats.shieldHeld = held;
    for (const h of w.humans) {
      let safe = false;
      if (bunker) {
        const d = w.colony.door(bunker);
        // inside (or right at the door): a good chance, never a certainty
        if (Math.hypot(h.x - d.x, h.y - d.y) < 70) safe = w.rng() < 0.85;
      }
      if (!safe && held && shield && Math.hypot(h.x - shield.x, h.y - shield.y) < 420) safe = w.rng() < 0.9;
      if (safe) {
        this.safe.add(h.id);
        h.state = "hide";
      }
    }
    if (this.stats) this.stats.sheltered = this.safe.size;
    if (held && shield) {
      w.particles.spawn(P.Ring, shield.x, shield.y, { size: 120, max: 2.5, color: "rgba(140,230,255,0.9)" });
      w.toast("🌀", "The Resonance shield is holding!", shield.x, shield.y);
    } else if (shield) {
      w.toast("🌀", `The Resonance shield flickered out — it needed ${SHIELD_HOLD} stored energy.`, shield.x, shield.y);
    }
  }

  /** The shockwave rolls outward: whatever it reaches takes the blow. */
  private sweep(w: World) {
    const R = this.wave;
    const shield = w.colony.buildings.find((b) => b.kind === "resShield" && b.built >= 1);
    const dome = (x: number, y: number) => !!this.stats?.shieldHeld && !!shield && Math.hypot(x - shield.x, y - shield.y) < 420;
    for (const d of [...w.dinos]) {
      if (this.hit.has(d.id)) continue;
      if (Math.hypot(d.x - this.x, d.y - this.y) > R) continue;
      this.hit.add(d.id);
      if (dome(d.x, d.y)) continue;
      const def = sp(d.species);
      // a few small, burrowing or deep-water animals make it through
      const small = sizeOf(d) < 26;
      const deep = def.move === "swim";
      const survive = deep ? 0.55 : small ? 0.3 : 0.06;
      if (w.rng() < survive) {
        d.health = Math.max(0.1, d.health - 0.5);
        continue;
      }
      if (this.stats) this.stats.dinosLost++;
      if (def.move === "fly" || def.move === "swim") w.removeDino(d);
      else downDino(w, d);
    }
    for (const h of [...w.humans]) {
      if (this.hit.has(h.id)) continue;
      if (Math.hypot(h.x - this.x, h.y - this.y) > R) continue;
      this.hit.add(h.id);
      if (this.safe.has(h.id) || dome(h.x, h.y)) continue;
      // a strong stone home helps a little
      const home = h.home ? w.shelters.find((s) => s.id === h.home) : null;
      const inHome = home && Math.hypot(home.x - h.x, home.y - h.y) < 60 && home.tier >= 3;
      if (w.rng() < (inHome ? 0.35 : 0.1)) {
        h.hp = Math.min(h.hp, 0.25);
        continue;
      }
      this.kill(w, h);
    }
    // buildings, walls, homes and plants in the wave's path
    for (const b of w.colony.buildings) {
      if (this.hit.has(-b.id) || Math.hypot(b.x - this.x, b.y - this.y) > R) continue;
      this.hit.add(-b.id);
      if (dome(b.x, b.y) || b.kind === "shelterDeep" || b.kind === "pyramid") {
        b.hp -= BUILDINGS[b.kind].hp * 0.2;
        continue;
      }
      if (b.built >= 1 && this.stats) this.stats.buildingsLost++;
      b.built = Math.min(b.built, 0.05);
      b.have = {};
      b.hp = BUILDINGS[b.kind].hp;
    }
    w.colony.version++;
    for (const wl of w.tribe.walls) {
      const x = wl.tx * TILE + 16;
      const y = wl.ty * TILE + 16;
      if (this.hit.has(-wl.id - 1e6) || Math.hypot(x - this.x, y - this.y) > R) continue;
      this.hit.add(-wl.id - 1e6);
      if (dome(x, y)) continue;
      wl.hp -= wl.kind === "palisade" ? 9999 : wl.kind === "stone" ? 500 : 350;
    }
    for (const s of w.shelters) {
      if (this.hit.has(-s.id - 2e6) || Math.hypot(s.x - this.x, s.y - this.y) > R) continue;
      this.hit.add(-s.id - 2e6);
      if (!dome(s.x, s.y)) s.hp -= s.tier >= 3 ? 0.5 : 1.2;
    }
    for (const p of w.plants) {
      if (p.burnt >= 1 || Math.hypot(p.x - this.x, p.y - this.y) > R) continue;
      if (dome(p.x, p.y)) continue;
      p.burnt = Math.max(p.burnt, 0.6 + w.rng() * 0.4);
      p.shake = 1;
    }
    // fire along the front
    for (let k = 0; k < 8; k++) {
      const a = w.rng() * Math.PI * 2;
      const x = this.x + Math.cos(a) * R;
      const y = this.y + Math.sin(a) * R;
      if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H || dome(x, y)) continue;
      if (w.rng() < 0.35) w.fire.ignite(w, Math.floor(x / TILE), Math.floor(y / TILE), 0.8);
    }
    w.plantsDirty = true;
  }

  private kill(w: World, h: Human) {
    w.particles.burst(P.Dust, h.x, h.y, 6, 40, { size: 8, max: 0.8, color: "rgba(90,80,70,0.6)" });
    const i = w.humans.indexOf(h);
    if (i >= 0) w.humans.splice(i, 1);
    w.events.push({ type: "removed", id: h.id });
    if (this.stats) this.stats.peopleLost++;
  }

  /** Burning rocks rain down. */
  private debris(w: World) {
    const x = Math.max(100, Math.min(WORLD_W - 100, this.x + (w.rng() - 0.5) * 3600));
    const y = Math.max(100, Math.min(WORLD_H - 100, this.y + (w.rng() - 0.5) * 2400));
    if (w.meteors.length < 6) w.meteor(x, y);
  }

  /** "Observe the ruins": close the summary, keep watching the ashen world. */
  observe() {
    if (this.phase === "ended") {
      this.phase = "ruins";
      this.version++;
    }
  }

  clear() {
    this.phase = "idle";
    this.t = 0;
    this.wave = 0;
    this.ash = 0;
    this.stats = null;
    this.hit.clear();
    this.safe.clear();
    this.version++;
  }

  serialize() {
    if (this.phase === "idle") return undefined;
    return { phase: this.phase, t: Math.round(this.t * 10) / 10, x: Math.round(this.x), y: Math.round(this.y), ash: Math.round(this.ash * 100) / 100, stats: this.stats };
  }

  load(d: ReturnType<Extinction["serialize"]>) {
    if (!d) return;
    // a save made mid-impact picks up as the aftermath (the wave doesn't run twice)
    this.phase = d.phase === "impact" ? "aftermath" : d.phase;
    this.t = d.phase === "impact" ? 0 : d.t;
    this.x = d.x;
    this.y = d.y;
    this.ash = d.ash;
    this.stats = d.stats;
    this.version++;
  }
}

