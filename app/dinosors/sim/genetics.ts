/* ------------------------------------------------------------------ */
/*  Evolution. Every dinosaur carries a few genes (size, speed,        */
/*  toughness, colour) plus an optional rare mutation. Babies inherit  */
/*  from their parents with small random changes, and the world does   */
/*  the selecting: fast prey escape, big bodies need more food,        */
/*  armour survives fights. The "Evolve!" button jumps a million years */
/*  ahead, nudging each species the way its surroundings push it.      */
/* ------------------------------------------------------------------ */
import { SPECIES, sp } from "../data/species";
import { P } from "./particles";
import type { Rng } from "./rng";
import type { Dino, SpeciesId } from "./types";
import type { World } from "./world";

export type Mutation = "albino" | "spotted" | "glow" | "crested" | "spiky" | "feathered" | "striped";

export interface Genes {
  /** body size multiplier */
  size: number;
  /** running/walking speed multiplier */
  speed: number;
  /** toughness (health + defence) multiplier */
  tough: number;
  /** colour shift, -1 (darker) … +1 (lighter) */
  hue: number;
  mut: Mutation | null;
}

export const MUTATIONS: Record<Mutation, { icon: string; name: string; tip: string }> = {
  albino: { icon: "🤍", name: "Albino", tip: "Snow-white skin" },
  spotted: { icon: "🐆", name: "Spotted", tip: "Bold camouflage spots" },
  striped: { icon: "🦓", name: "Striped", tip: "Tiger stripes" },
  glow: { icon: "✨", name: "Glowing", tip: "Glows softly at night" },
  crested: { icon: "🪶", name: "Crested", tip: "A brand-new head crest" },
  spiky: { icon: "🦔", name: "Spiky", tip: "Extra spikes for defence" },
  feathered: { icon: "🪽", name: "Feathered", tip: "Fluffy feathers — like birds!" },
};
const MUT_LIST = Object.keys(MUTATIONS) as Mutation[];

const clampG = (v: number) => Math.max(0.7, Math.min(1.6, v));

export function baseGenes(rng: Rng): Genes {
  return { size: 0.95 + rng() * 0.1, speed: 0.95 + rng() * 0.1, tough: 0.95 + rng() * 0.1, hue: (rng() - 0.5) * 0.3, mut: null };
}

/** Mix two parents' genes, add a little random drift, maybe a mutation. */
export function inherit(rng: Rng, a: Genes, b: Genes | null, mutationChance = 0.07): Genes {
  const mate = b ?? a;
  const mix = (x: number, y: number) => clampG((rng() < 0.5 ? x : y) * 0.5 + (x + y) * 0.25 + (rng() - 0.5) * 0.12);
  let mut: Mutation | null = rng() < 0.75 ? a.mut ?? mate.mut : rng() < 0.5 ? mate.mut : null;
  if (rng() < mutationChance) mut = MUT_LIST[Math.floor(rng() * MUT_LIST.length)];
  return {
    size: mix(a.size, mate.size),
    speed: mix(a.speed, mate.speed),
    tough: mix(a.tough, mate.tough),
    hue: Math.max(-1, Math.min(1, (a.hue + mate.hue) / 2 + (rng() - 0.5) * 0.25)),
    mut,
  };
}

/** Kid-friendly trait badges for a set of genes. */
export function traitsOf(g: Genes): { icon: string; name: string }[] {
  const out: { icon: string; name: string }[] = [];
  if (g.size >= 1.15) out.push({ icon: "⬆️", name: g.size >= 1.35 ? "Huge" : "Big" });
  if (g.size <= 0.85) out.push({ icon: "🐣", name: "Small" });
  if (g.speed >= 1.15) out.push({ icon: "💨", name: g.speed >= 1.35 ? "Super fast" : "Speedy" });
  if (g.speed <= 0.85) out.push({ icon: "🐢", name: "Slow" });
  if (g.tough >= 1.15) out.push({ icon: "🛡️", name: g.tough >= 1.35 ? "Armoured" : "Tough" });
  if (g.mut) out.push({ icon: MUTATIONS[g.mut].icon, name: MUTATIONS[g.mut].name });
  return out;
}

export interface SpeciesEvo {
  /** generations since the world began */
  gen: number;
  /** million-year leaps applied with the Evolve button */
  leaps: number;
}

/** Average genes for every living species (for the Evolution panel). */
export function speciesStats(w: World) {
  const map = new Map<SpeciesId, { n: number; size: number; speed: number; tough: number; muts: Map<Mutation, number>; gen: number }>();
  for (const d of w.dinos) {
    let s = map.get(d.species);
    if (!s) {
      s = { n: 0, size: 0, speed: 0, tough: 0, muts: new Map(), gen: 0 };
      map.set(d.species, s);
    }
    s.n++;
    s.size += d.genes.size;
    s.speed += d.genes.speed;
    s.tough += d.genes.tough;
    s.gen = Math.max(s.gen, d.gen);
    if (d.genes.mut) s.muts.set(d.genes.mut, (s.muts.get(d.genes.mut) ?? 0) + 1);
  }
  return SPECIES.map((def) => {
    const s = map.get(def.id);
    const evo = w.evo[def.id];
    if (!s) return { id: def.id, n: 0, size: 1, speed: 1, tough: 1, gen: evo?.gen ?? 1, mut: null as Mutation | null };
    let mut: Mutation | null = null;
    let best = 0;
    s.muts.forEach((n, m) => {
      if (n > best) {
        best = n;
        mut = m;
      }
    });
    return { id: def.id, n: s.n, size: s.size / s.n, speed: s.speed / s.n, tough: s.tough / s.n, gen: Math.max(s.gen, evo?.gen ?? 1), mut };
  });
}

/** Called when a baby hatches: celebrate new traits + mutations. */
export function announceBirth(w: World, d: Dino) {
  const g = d.genes;
  const def = sp(d.species);
  const ev = (w.evo[d.species] ??= { gen: 1, leaps: 0 });
  ev.gen = Math.max(ev.gen, d.gen);
  if (!w.inView(d.x, d.y, 300)) return;
  if (g.mut && !w.flags.has(`mut:${d.species}:${g.mut}`)) {
    w.flags.add(`mut:${d.species}:${g.mut}`);
    w.discover("mutant", d.x, d.y);
    w.toast(MUTATIONS[g.mut].icon, `A ${MUTATIONS[g.mut].name.toLowerCase()} ${def.nick} hatched — a brand-new mutation!`, d.x, d.y, "Mutations are tiny changes in genes. Most do nothing — some help an animal survive.");
    return;
  }
  const traits = traitsOf(g).filter((t) => t.name !== "Small");
  if (traits.length && !w.flags.has("traitBirth")) {
    w.flags.add("traitBirth");
    w.toast("🧬", `This baby ${def.nick} is ${traits.map((t) => t.name.toLowerCase()).join(" + ")} — it got that from its parents!`, d.x, d.y, "Babies inherit traits from their parents. That's how evolution works over many generations.");
  }
}

/**
 * One million years pass. Each species is pushed by what's around it:
 *  - plant-eaters with hunters nearby get faster + tougher
 *  - hunters chasing fast prey get faster; big prey makes them bigger
 *  - lots of food → bigger bodies; scarce food → smaller
 *  - every leap may spread a new mutation through a species
 */
export function evolveWorld(w: World) {
  const rng = w.rng;
  const live = new Map<SpeciesId, Dino[]>();
  for (const d of w.dinos) {
    if (d.raider) continue;
    const l = live.get(d.species) ?? [];
    l.push(d);
    live.set(d.species, l);
  }
  const plants = w.plants.filter((p) => !p.stump && p.food > 0.3).length;
  const herbivores = w.dinos.filter((d) => sp(d.species).diet === "herbivore").length || 1;
  const foodRich = plants / herbivores > 18;
  const hot = w.weather.temp > 0.75;
  const changes: { s: SpeciesId; text: string; score: number }[] = [];

  live.forEach((list, id) => {
    const def = sp(id);
    const hunters = w.dinos.filter((o) => sp(o.species).diet !== "herbivore" && (sp(o.species).preyMax ?? 0) >= def.size * 0.6 && o.species !== id).length;
    // each leap a species goes one main way, chosen by what pressures it most
    type Dir = "speed" | "size" | "tough" | "small";
    const options: [Dir, number][] = [];
    if (def.diet === "herbivore") {
      if (hunters > 0) {
        options.push(["speed", def.defender ? 1 : 2]);
        options.push(["tough", def.defender ? 2.5 : 1]);
      }
      options.push(foodRich ? ["size", 1.5] : ["small", 1]);
    } else {
      const fastPrey = w.dinos.filter((o) => sp(o.species).diet === "herbivore" && o.genes.speed > 1.05).length;
      options.push(["speed", fastPrey > 3 ? 2.5 : 1.2]);
      options.push(["size", def.size > 80 ? 1.5 : 0.6]);
      options.push(["tough", 0.6]);
    }
    if (hot) options.push(["small", 1]);
    let r = rng() * options.reduce((a, [, wgt]) => a + wgt, 0);
    let dir: Dir = options[0][0];
    for (const [d, wgt] of options) {
      r -= wgt;
      if (r <= 0) {
        dir = d;
        break;
      }
    }
    let dSize = (rng() - 0.5) * 0.02;
    let dSpeed = (rng() - 0.5) * 0.02;
    let dTough = (rng() - 0.5) * 0.02;
    // trade-offs: bigger + tougher bodies are slower, small ones are quick
    if (dir === "speed") {
      dSpeed += 0.08;
      dTough -= 0.02;
    } else if (dir === "size") {
      dSize += 0.08;
      dSpeed -= 0.03;
    } else if (dir === "tough") {
      dTough += 0.08;
      dSpeed -= 0.025;
    } else {
      dSize -= 0.06;
      dSpeed += 0.03;
    }
    // a fresh mutation sometimes sweeps through a species
    const sweep = rng() < 0.22 ? MUT_LIST[Math.floor(rng() * MUT_LIST.length)] : null;
    for (const d of list) {
      d.genes.size = clampG(d.genes.size + dSize + (rng() - 0.5) * 0.03);
      d.genes.speed = clampG(d.genes.speed + dSpeed + (rng() - 0.5) * 0.03);
      d.genes.tough = clampG(d.genes.tough + dTough + (rng() - 0.5) * 0.03);
      d.genes.hue = Math.max(-1, Math.min(1, d.genes.hue + (rng() - 0.5) * 0.2));
      if (sweep && rng() < 0.6) d.genes.mut = sweep;
      d.gen += 10;
      w.particles.burst(P.Spark, d.x, d.y, 4, 30, { z: 20, vz: 40, size: 2.5, max: 0.9, color: "#b9f6ff" });
    }
    const ev = (w.evo[id] ??= { gen: 1, leaps: 0 });
    ev.leaps++;
    ev.gen = Math.max(ev.gen, ...list.map((d) => d.gen));
    const parts: string[] = [dir === "speed" ? "faster 💨" : dir === "size" ? "bigger ⬆️" : dir === "tough" ? "tougher 🛡️" : "smaller 🐣"];
    if (sweep) parts.push(`${MUTATIONS[sweep].name.toLowerCase()} ${MUTATIONS[sweep].icon}`);
    if (parts.length) changes.push({ s: id, text: `${def.nick}: ${parts.join(", ")}`, score: parts.length + rng() });
  });

  w.evoLeaps++;
  changes.sort((a, b) => b.score - a.score);
  w.discover("evolved");
  w.sfx("evolve", w.camX, w.camY, 1);
  w.flash(0.25, "#b9f6ff");
  w.toast(
    "🧬",
    changes.length ? `${w.evoLeaps} million years later… ${changes.slice(0, 2).map((c) => c.text).join(" · ")}${changes.length > 2 ? ` (+${changes.length - 2} more in 🧬)` : ""}` : "A million years later… everyone looks about the same!",
    undefined,
    undefined,
    "Evolution is slow change over many generations. Animals with helpful traits survive and pass them on.",
  );
  return changes;
}

/** Colour + feature tweaks the renderer applies on top of a species' look. */
export function lookKey(g: Genes) {
  return `${Math.round(g.hue * 4)}:${g.mut ?? ""}`;
}
