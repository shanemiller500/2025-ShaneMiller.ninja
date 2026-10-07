/* ------------------------------------------------------------------ */
/*  Random world events: little surprises every minute or two. Calm    */
/*  events are common; disruptive ones are rare and have cooldowns.    */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { setState, spawnGroup } from "./dinos";
import { LM } from "./terrain";
import { TILE, WORLD_H, WORLD_W, type SpeciesId } from "./types";
import type { World } from "./world";

type EventId = "migration" | "hatch" | "storm" | "fish" | "rumble" | "star" | "trex" | "flock" | "stampede" | "glint" | "stalker" | "snowstorm";

const WEIGHTS: [EventId, number, number][] = [
  // id, weight, cooldown (s)
  ["migration", 3, 150],
  ["hatch", 3, 60],
  ["fish", 2, 90],
  ["star", 3, 40],
  ["flock", 2, 120],
  ["stampede", 1.5, 200],
  ["trex", 1, 300],
  ["storm", 1, 400],
  ["rumble", 1, 300],
  ["glint", 1.5, 240],
  ["stalker", 1, 260],
  ["snowstorm", 0.6, 600],
];

export interface ShootingStar {
  t: number;
  /** 0..1 start across the screen */
  a: number;
  b: number;
}

export class RandomEvents {
  timer = 45;
  enabled = true;
  stars: ShootingStar[] = [];
  private last = new Map<EventId, number>();

  update(w: World, dt: number) {
    // no migrations or visitors into a burning wasteland
    if (w.extinction.wasteland) return;
    for (const s of this.stars) s.t += dt;
    this.stars = this.stars.filter((s) => s.t < 1.6);
    if (!this.enabled) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 55 + w.rng() * 65;
    const now = w.elapsed;
    const options = WEIGHTS.filter(([id, , cd]) => now - (this.last.get(id) ?? -1e9) > cd && this.allowed(w, id));
    const total = options.reduce((s, [, wt]) => s + wt, 0);
    let r = w.rng() * total;
    for (const [id, wt] of options) {
      r -= wt;
      if (r <= 0) {
        this.last.set(id, now);
        this.fire(w, id);
        return;
      }
    }
  }

  private allowed(w: World, id: EventId) {
    switch (id) {
      case "star":
        return w.daylight < 0.2;
      case "storm":
        return w.weather.kind !== "storm" && w.weather.auto;
      case "rumble":
        return !w.volcano.active && w.volcano.cooldown <= 0;
      case "hatch":
        return true;
      case "glint":
        return w.colony.nodes.some((n) => !n.found) && w.daylight > 0.6;
      case "stalker":
        return w.tribe.danger !== "calm" && !w.tribe.raid && w.humans.length > 0;
      case "snowstorm":
        return w.weather.auto && w.weather.kind !== "snow" && w.weather.kind !== "blizzard" && w.elapsed > 600;
      case "trex":
        return w.dinos.filter((d) => d.species === "trex").length < 3;
      case "flock":
        return w.dinos.filter((d) => d.species === "ptera").length < 7;
      default:
        return w.dinos.length < 100;
    }
  }

  fire(w: World, id: EventId) {
    const rng = w.rng;
    switch (id) {
      case "glint": {
        // sunlight catches something in the rocks: a hidden deposit near camp is spotted
        const c = w.camp;
        const hidden = w.colony.nodes.filter((n) => !n.found).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
        const n = hidden[0];
        if (n) w.colony.discoverAround(w, n.x, n.y, 10);
        break;
      }
      case "stalker": {
        // a hungry predator prowls the edge of camp, sizing it up
        const c = w.camp;
        const a = rng() * Math.PI * 2;
        const species: SpeciesId = w.tribe.raidsWon >= 3 ? "allo" : "raptor";
        const [d] = spawnGroup(w, species, c.x + Math.cos(a) * 900, c.y + Math.abs(Math.sin(a)) * 700, 1, { hunger: 0.85 });
        if (d) {
          setState(d, "stalk", c.x + Math.cos(a) * 420, c.y + Math.abs(Math.sin(a)) * 320);
          d.think = 6;
          w.toast("👀", `A hungry ${sp(species).nick} is stalking around the camp…`, d.x, d.y);
        }
        break;
      }
      case "snowstorm":
        w.weather.set(w, rng() < 0.4 ? "blizzard" : "snow", false);
        break;
      case "migration": {
        const species = (["para", "iguano", "trike", "apato"] as SpeciesId[])[Math.floor(rng() * 4)];
        const fromWest = rng() < 0.5;
        const y = (40 + rng() * 40) * TILE;
        const x = fromWest ? 40 : WORLD_W - 40;
        const herd = spawnGroup(w, species, x, y, 5 + Math.floor(rng() * 3), { migrant: true });
        for (const d of herd) {
          // migrants remember the far edge as "home" and keep heading there
          d.homeX = fromWest ? WORLD_W + 100 : -100;
          d.homeY = y + (rng() - 0.5) * 300;
          setState(d, "migrate", d.homeX, d.homeY);
        }
        if (herd[0]) w.toast(sp(species).emoji, `A herd of ${sp(species).nick} is migrating through!`, herd[0].x, herd[0].y, "Many dinosaurs travelled long distances to find food.");
        break;
      }
      case "hatch": {
        const egg = w.eggs[Math.floor(rng() * w.eggs.length)];
        if (egg) {
          egg.hatchAt = Math.min(egg.hatchAt, egg.t + 8);
          w.toast("🥚", "An egg is wobbling in the nest…", egg.x, egg.y);
        } else {
          const s = (["trike", "para", "stego", "pachy"] as SpeciesId[])[Math.floor(rng() * 4)];
          const e = w.addEgg(s, LM.nest.x * TILE + (rng() - 0.5) * 80, LM.nest.y * TILE + (rng() - 0.5) * 50, 0, 0, 30);
          w.toast("🥚", "Somebody left a new egg in the nest!", e.x, e.y);
        }
        break;
      }
      case "storm":
        w.weather.set(w, "storm", false);
        break;
      case "fish": {
        const x = (20 + rng() * 120) * TILE;
        for (let i = 0; i < 3; i++) w.addSchool(x + (rng() - 0.5) * 300, (102 + rng() * 6) * TILE);
        w.toast("🐟", "A big swarm of fish arrived at the beach!", x, 100 * TILE);
        break;
      }
      case "rumble":
        w.volcano.trigger(w, true);
        break;
      case "star":
        this.stars.push({ t: 0, a: rng(), b: rng() });
        w.toast("🌠", "A falling star! Make a wish!");
        break;
      case "trex": {
        const x = rng() < 0.5 ? 60 : WORLD_W - 60;
        const [d] = spawnGroup(w, "trex", x, (40 + rng() * 30) * TILE, 1);
        if (d) {
          d.hunger = 0.6;
          w.toast("🦖", "A wandering T. rex has arrived…", d.x, d.y);
        }
        break;
      }
      case "flock": {
        const x = rng() < 0.5 ? 80 : WORLD_W - 80;
        const y = (20 + rng() * 40) * TILE;
        const flock = spawnGroup(w, "ptera", x, y, 4 + Math.floor(rng() * 3));
        for (const d of flock) setState(d, "wander", WORLD_W / 2 + (rng() - 0.5) * 800, y + (rng() - 0.5) * 400);
        if (flock[0]) w.toast("🪽", "A flock of Pteranodons is flying in!", flock[0].x, flock[0].y);
        break;
      }
      case "stampede": {
        const herbs = w.dinos.filter((d) => d.herd && sp(d.species).diet === "herbivore" && sp(d.species).move === "walk");
        const lead = herbs[Math.floor(rng() * herbs.length)];
        if (!lead) break;
        const a = rng() * Math.PI * 2;
        for (const d of herbs) {
          if (d.herd !== lead.herd) continue;
          d.fear = 1;
          setState(d, "flee", d.x + Math.cos(a) * 700, Math.max(80, Math.min(WORLD_H - 80, d.y + Math.sin(a) * 500)));
          d.emote = { icon: "💨", t: 2 };
        }
        w.shake(4, 2);
        w.sfx("stampede", lead.x, lead.y, 1);
        w.toast("💨", `STAMPEDE! The ${sp(lead.species).nick} herd is running!`, lead.x, lead.y, "Herds stampede when they get scared — safety in numbers!");
        break;
      }
    }
  }
}
