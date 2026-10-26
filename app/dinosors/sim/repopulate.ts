/* ------------------------------------------------------------------ */
/*  Wildlife: the wild dinosaurs keep coming back.                     */
/*                                                                     */
/*  • Good years + lean years: every so often a few species boom (lots */
/*    of eggs, big herds) while a few others dip, so the valley never  */
/*    looks the same twice; the rest drift back to normal.             */
/*  • Under its number, a species lays more often.                     */
/*  • Never gone for good: when a species is down to its last one or   */
/*    none at all, a mother comes back into its old home range and     */
/*    lays a clutch of eggs there (sea reptiles give birth to live     */
/*    young out at sea instead, as they really did).                   */
/* ------------------------------------------------------------------ */
import { SPECIES, sp } from "../data/species";
import { addDino, findSpawnSpot, setState } from "./dinos";
import { inTown } from "./feast";
import { SNOW_SPECIES } from "./snowBeasts";
import { TILE, WORLD_W, type SpeciesId } from "./types";
import type { World } from "./world";

/** Where each species lives (tiles): where a returning mother nests. */
export const HOMES: Partial<Record<SpeciesId, { x: number; y: number }>> = {
  trike: { x: 112, y: 56 },
  para: { x: 92, y: 72 },
  stego: { x: 122, y: 66 },
  brachio: { x: 44, y: 48 },
  apato: { x: 100, y: 76 },
  ankylo: { x: 146, y: 58 },
  iguano: { x: 62, y: 72 },
  pachy: { x: 132, y: 50 },
  trex: { x: 116, y: 40 },
  raptor: { x: 34, y: 30 },
  allo: { x: 22, y: 62 },
  carno: { x: 146, y: 38 },
  dilo: { x: 18, y: 74 },
  spino: { x: 108, y: 86 },
  compy: { x: 46, y: 62 },
  mosa: { x: 30, y: 100 },
  plesio: { x: 70, y: 104 },
  plio: { x: 150, y: 100 },
  ptera: { x: 90, y: 24 },
  dimorpho: { x: 24, y: 18 },
  // the eastern lands
  camel: { x: 190, y: 54 },
  dinoScorpion: { x: 196, y: 64 },
};

/** Fewest of a species (adults, young + eggs) the valley ever has. */
export const MIN_KEEP = 2;
/** How long a boom / a lean spell lasts (s). */
const SPELL = [420, 840] as const;

/** The usual number of a species (before booms and lean years). */
export function baseCap(s: SpeciesId) {
  const def = sp(s);
  if (def.diet === "herbivore") return def.size >= 150 ? 5 : 7;
  return def.size >= 120 ? 3 : 4;
}

export class Wildlife {
  /** per species: × its usual number (0.4 lean … 2.3 boom) */
  boom: Partial<Record<SpeciesId, number>> = {};
  /** seconds till the next good-year / lean-year shuffle */
  spellT = 240;
  /** seconds till each species can be helped back again */
  backT: Partial<Record<SpeciesId, number>> = {};
  private tickT = 0;
  /** off in bare test worlds (no wildlife to keep up); on in every real game, new or loaded */
  enabled = true;

  serialize() {
    return { boom: { ...this.boom }, spellT: Math.round(this.spellT) };
  }

  load(d: { boom?: Partial<Record<SpeciesId, number>>; spellT?: number } | undefined) {
    this.boom = { ...(d?.boom ?? {}) };
    this.spellT = d?.spellT ?? 240;
    this.backT = {};
    this.enabled = true;
  }

  cap(s: SpeciesId) {
    return Math.max(MIN_KEEP, Math.round(baseCap(s) * (this.boom[s] ?? 1)));
  }

  /** How many of a species are out there (wild + tame, young, and eggs). */
  count(w: World, s: SpeciesId) {
    let n = 0;
    for (const d of w.dinos) if (d.species === s && !d.under) n++;
    for (const e of w.eggs) if (e.species === s) n++;
    return n;
  }

  update(w: World, dt: number) {
    if (!this.enabled || w.extinction.wasteland) return;
    for (const k of Object.keys(this.backT) as SpeciesId[]) this.backT[k] = (this.backT[k] ?? 0) - dt;
    this.spellT -= dt;
    if (this.spellT <= 0) this.shuffle(w);
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = 5;
    for (const def of SPECIES) {
      const s = def.id;
      // the snowy peaks keep their own numbers (snowBeasts.ts SnowLife)
      if (SNOW_SPECIES.has(s)) continue;
      const n = this.count(w, s);
      // gone (or nearly): a mother comes home and lays a clutch
      if (n < MIN_KEEP && (this.backT[s] ?? 0) <= 0) {
        this.backT[s] = 70 + w.rng() * 80;
        this.comeBack(w, s, n);
        continue;
      }
      // well over this year's number (a lean year after a boom): now and then one wanders off out of the valley
      if (n > this.cap(s) + 2 && def.move !== "swim" && w.rng() < 0.15) this.moveOn(w, s);
      // under its number: the grown-ups lay sooner (more so in a boom)
      if (n < this.cap(s)) {
        const soon = (this.boom[s] ?? 1) > 1.4 ? 25 : 70;
        for (const d of w.dinos) if (d.species === s && !d.owner && d.growth >= 1 && d.layT > soon) d.layT = Math.min(d.layT, soon + w.rng() * soon);
      }
    }
  }

  /** One grown-up of a crowded species heads off over the hills (it walks out at the map's edge). */
  moveOn(w: World, s: SpeciesId) {
    const d = w.dinos.find((x) => x.species === s && !x.owner && !x.rider && !x.chariot && !x.raider && !x.migrant && !x.under && x.growth >= 1 && x.state !== "chase" && x.state !== "stalk" && x.state !== "nest" && !w.eggs.some((e) => e.parent === x.id));
    if (!d) return false;
    d.migrant = true;
    const tx = d.x < WORLD_W / 2 ? -80 : WORLD_W + 80;
    d.homeX = tx;
    d.homeY = d.y;
    setState(d, "migrate", tx, d.y + (w.rng() - 0.5) * 400);
    return true;
  }

  /** A new spell: a couple of species boom, a couple go lean, the rest settle back to normal. */
  shuffle(w: World) {
    this.spellT = SPELL[0] + w.rng() * (SPELL[1] - SPELL[0]);
    const ids = SPECIES.map((d) => d.id).filter((s) => !SNOW_SPECIES.has(s));
    for (const s of ids) this.boom[s] = 1;
    const pickOut = (n: number) => {
      const out: SpeciesId[] = [];
      while (out.length < n) {
        const s = ids[Math.floor(w.rng() * ids.length)];
        if (!out.includes(s) && this.boom[s] === 1) out.push(s);
      }
      return out;
    };
    const up = pickOut(2 + Math.floor(w.rng() * 2));
    const down = pickOut(2 + Math.floor(w.rng() * 2));
    // big hunters only ever boom a little (the valley can't feed many)
    for (const s of up) this.boom[s] = sp(s).diet !== "herbivore" && sp(s).size >= 120 ? 1.4 + w.rng() * 0.2 : 1.7 + w.rng() * 0.6;
    for (const s of down) this.boom[s] = 0.4 + w.rng() * 0.25;
    const names = up.map((s) => sp(s).nick);
    w.toast("🥚", `A good year for ${names.slice(0, -1).join(", ")}${names.length > 1 ? " and " : ""}${names[names.length - 1]}: lots of eggs, and their herds will grow. Others have a leaner time.`, undefined, undefined, "Animal numbers really do rise and fall over the years with food, weather and predators.");
  }

  /** Bring a species back: a mother + a clutch of eggs at its home (or live young at sea). */
  comeBack(w: World, s: SpeciesId, had: number) {
    const def = sp(s);
    const spot = homeSpot(w, s);
    if (!spot) return false;
    const mum = addDino(w, s, spot.x, spot.y, { homeX: spot.x, homeY: spot.y, hunger: 0.2, thirst: 0.2 });
    mum.layT = 400 + w.rng() * 200;
    if (def.move === "swim") {
      for (let i = 0; i < 2; i++) {
        const p = findSpawnSpot(w, def, spot.x, spot.y, 120);
        if (p) addDino(w, s, p.x, p.y, { growth: 0.15 + w.rng() * 0.2, parent: mum.id, herd: mum.herd, homeX: spot.x, homeY: spot.y });
      }
    } else {
      const eggs = def.diet === "herbivore" ? 3 : 2;
      for (let i = 0; i < eggs; i++) {
        const a = (i / eggs) * Math.PI * 2;
        w.addEgg(s, mum.x + Math.cos(a) * 18, mum.y + 10 + Math.sin(a) * 8, mum.herd, mum.id, 50 + w.rng() * 50);
      }
    }
    if (had === 0) {
      w.toast(def.emoji, def.move === "swim" ? `The ${def.nick} are back! A mother and her young swam into the valley's waters.` : `The ${def.nick} are back! A mother came home and laid a clutch of eggs.`, mum.x, mum.y);
    }
    return true;
  }
}

/** A quiet spot in a species' home range: not in the town, not right where the player is looking. */
function homeSpot(w: World, s: SpeciesId) {
  const def = sp(s);
  const h = HOMES[s] ?? { x: 20 + w.rng() * 140, y: 20 + w.rng() * 80 };
  const hx = h.x * TILE;
  const hy = h.y * TILE;
  for (let k = 0; k < 40; k++) {
    const r = k < 20 ? 160 : 600;
    const p = findSpawnSpot(w, def, hx + (w.rng() - 0.5) * r, hy + (w.rng() - 0.5) * r, 200);
    if (!p || inTown(w, p.x, p.y, 250)) continue;
    if (k < 30 && w.inView(p.x, p.y, 100)) continue;
    return p;
  }
  // the town has grown over its old range: it nests further out, on the far side from the camp
  const a0 = Math.atan2(hy - w.camp.y, hx - w.camp.x);
  for (let k = 0; k < 40; k++) {
    const a = a0 + (w.rng() - 0.5) * (0.6 + k * 0.08);
    const r = 1100 + k * 40;
    const p = findSpawnSpot(w, def, w.camp.x + Math.cos(a) * r, w.camp.y + Math.sin(a) * r * 0.8, 260);
    if (p && !inTown(w, p.x, p.y, 250)) return p;
  }
  return null;
}
