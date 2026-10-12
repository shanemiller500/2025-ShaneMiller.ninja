/* ------------------------------------------------------------------ */
/*  The almanac: the big seasonal events of the world, planned a whole */
/*  season ahead (so they can be foreseen) and played out with real    */
/*  effects: droughts stall plants + crops, cold snaps bring blizzards,*/
/*  meteor showers leave fragments (and fires), predators migrate      */
/*  through, families arrive in spring, the volcano erupts after days  */
/*  of grumbling.                                                      */
/*                                                                     */
/*  Forecasts: the sky watchers' knowledge (sky.ts) decides what they  */
/*  notice, how early and how exactly. Not every guess is right; some  */
/*  warnings are false alarms.                                         */
/*                                                                     */
/*  Time here is game hours (hoursOf), so it follows the clock.        */
/* ------------------------------------------------------------------ */
import { sp } from "../data/species";
import { setState, spawnGroup } from "./dinos";
import { pick } from "./rng";
import { SEASONS, SEASON_DAYS, hoursOf, hoursToSeconds, seasonAt, seasonStartHours, type SeasonId } from "./seasons";
import { T, TILE, WORLD_H, WORLD_W, type SpeciesId, type WeatherKind } from "./types";
import type { World } from "./world";

export type AlmanacKind = "drought" | "heatWave" | "coldSnap" | "floodRains" | "meteorShower" | "predators" | "newcomers" | "eruption";

interface AlmanacDef {
  name: string;
  icon: string;
  /** chance each season brings one */
  chance: Partial<Record<SeasonId, number>>;
  /** how long it lasts (game hours) */
  hours: [number, number];
  /** starts in the evening (meteor showers) */
  night?: boolean;
  /** the weather it brings while it lasts */
  weather?: WeatherKind;
  /** sky knowledge level needed to name it ahead of time (99 = the sky can't tell) */
  sky: number;
  /** what watchers say before they can name it (from level 2) */
  vague?: string;
  start: string;
  end?: string;
}

export const ALMANAC: Record<AlmanacKind, AlmanacDef> = {
  drought: { name: "Drought", icon: "🏜️", chance: { summer: 0.45 }, hours: [24, 44], weather: "clear", sky: 4, start: "A drought! No rain is coming: plants and crops barely grow until it breaks.", end: "The drought has broken." },
  heatWave: { name: "Heat wave", icon: "🥵", chance: { summer: 0.4, spring: 0.05 }, hours: [8, 16], weather: "hot", sky: 3, start: "A heat wave! Crops wilt in the heat until it passes.", end: "The heat wave is over." },
  coldSnap: { name: "Cold snap", icon: "🥶", chance: { winter: 0.65, autumn: 0.15 }, hours: [12, 24], weather: "blizzard", sky: 3, start: "A cold snap! A blizzard is blowing in: everyone needs fires and warm homes.", end: "The cold snap has passed." },
  floodRains: { name: "Spring floods", icon: "🌊", chance: { spring: 0.45 }, hours: [8, 16], weather: "heavyRain", sky: 3, start: "The spring rains! Days of downpour: plants shoot up, but it's hard to work outside.", end: "The spring rains have eased off." },
  meteorShower: { name: "Meteor shower", icon: "🌠", chance: { autumn: 0.55, summer: 0.15, winter: 0.1, spring: 0.1 }, hours: [5, 7], night: true, sky: 5, vague: "Something unusual is happening in the sky…", start: "A meteor shower! Shooting stars all night, and some will land. Look for meteor fragments where they hit (and watch for fires).", end: "The meteor shower has faded." },
  predators: { name: "Predator migration", icon: "🐾", chance: { autumn: 0.4, spring: 0.25 }, hours: [10, 16], sky: 99, start: "A pack of predators is migrating through! Keep people close to camp until they've passed." },
  newcomers: { name: "Travellers", icon: "🚶", chance: { spring: 0.7, summer: 0.2 }, hours: [2, 4], sky: 99, start: "Spring brings travellers across the land." },
  eruption: { name: "Eruption", icon: "🌋", chance: { spring: 0.08, summer: 0.12, autumn: 0.08, winter: 0.05 }, hours: [6, 6], sky: 5, vague: "The fire mountain feels restless…", start: "The volcano is erupting! Stay clear of the mountain.", end: "The volcano has settled down." },
};

const KINDS = Object.keys(ALMANAC) as AlmanacKind[];
/** Kinds the sky watchers might foresee (and so might wrongly "foresee" too). */
const FORESEEABLE = KINDS.filter((k) => ALMANAC[k].sky < 99);

/** How often the watchers notice something real (and how rarely they're fooled), by level. */
const ACCURACY = [0, 0, 0.5, 0.65, 0.85, 0.95];
/** How far ahead they notice (game hours), and how far off their timing can be. */
const LEAD = [0, 0, 12, 12, 30, 48];
const SPREAD = [0, 0, 8, 8, 5, 2];

export interface AlmanacEvent {
  kind: AlmanacKind;
  /** game hour it starts + how long it lasts */
  at: number;
  hours: number;
  /** 0 planned, 1 under way, 2 over */
  state: 0 | 1 | 2;
  /** a false alarm: something the watchers may "see" that never comes */
  phantom?: boolean;
  /** the dice for noticing it, and for how far off the guess is (-1..1) */
  luck: number;
  err: number;
  /** what the tribe has been told: 0 nothing, 1 a vague feeling, 2 named */
  told: 0 | 1 | 2;
  /** eruptions: grumbles so far */
  omens: number;
}

export interface Forecast {
  icon: string;
  text: string;
  /** hours until (as the watchers guess it) */
  inHours: number;
}

export class Almanac {
  events: AlmanacEvent[] = [];
  /** last season planned (seasons are planned one ahead) */
  planned = -1;
  private lastSeason = -1;
  private toldSeason = -1;
  /** meteors on their way down (game hours of landing + where) */
  private falling: { x: number; y: number; at: number }[] = [];
  private meteorT = 0;

  active(kind: AlmanacKind) {
    return this.events.some((e) => e.kind === kind && e.state === 1);
  }

  /** Plant regrowth under the current events. */
  plantsMul() {
    return (this.active("drought") ? 0.15 : 1) * (this.active("floodRains") ? 1.5 : 1);
  }

  farmsMul() {
    return (this.active("drought") ? 0.2 : 1) * (this.active("heatWave") ? 0.6 : 1);
  }

  update(w: World, dt: number) {
    if (!w.randomEvents.enabled || w.extinction.wasteland) return;
    const now = hoursOf(w);
    const s = seasonAt(w.day);
    if (this.lastSeason !== s.index) {
      if (this.lastSeason >= 0) w.toast(s.def.icon, s.def.arrives);
      this.lastSeason = s.index;
    }
    // this season and the next are always planned, so what's coming can be foreseen
    while (this.planned < s.index + 1) this.plan(w, ++this.planned, now);
    for (const e of this.events) {
      if (e.state === 0 && e.kind === "eruption" && !e.phantom) this.omen(w, e, now);
      if (e.state === 0 && now >= e.at) {
        if (e.phantom) {
          e.state = 2;
          if (e.told) w.sky.misses++;
        } else this.start(w, e);
      } else if (e.state === 1) {
        if (now >= e.at + e.hours) this.end(w, e);
        else this.during(w, e, dt);
      }
    }
    this.land(w, now);
    this.events = this.events.filter((e) => e.state !== 2 || now - (e.at + e.hours) < 48);
    this.foretell(w, now);
  }

  /** Roll the events for season n (only ones that can still happen). */
  private plan(w: World, n: number, now: number) {
    const def = SEASONS[n % 4];
    const start = seasonStartHours(n);
    const len = SEASON_DAYS * 24;
    for (const kind of KINDS) {
      const d = ALMANAC[kind];
      const chance = d.chance[def.id] ?? 0;
      if (w.rng() >= chance) continue;
      const hours = d.hours[0] + w.rng() * (d.hours[1] - d.hours[0]);
      const at = d.night ? start + Math.floor(w.rng() * SEASON_DAYS) * 24 + 21 : start + w.rng() * Math.max(1, len - hours);
      if (at < now + 1) continue;
      this.events.push({ kind, at, hours, state: 0, luck: w.rng(), err: w.rng() * 2 - 1, told: 0, omens: 0 });
    }
    // now and then something the watchers might wrongly think they see
    const seasonal = FORESEEABLE.filter((k) => (ALMANAC[k].chance[def.id] ?? 0) > 0);
    if (seasonal.length && w.rng() < 0.3) {
      const kind = pick(w.rng, seasonal);
      const at = start + w.rng() * len;
      if (at > now + 1) this.events.push({ kind, at, hours: 1, state: 0, phantom: true, luck: w.rng(), err: w.rng() * 2 - 1, told: 0, omens: 0 });
    }
    this.events.sort((a, b) => a.at - b.at);
  }

  private start(w: World, e: AlmanacEvent) {
    const d = ALMANAC[e.kind];
    e.state = 1;
    if (e.told) w.sky.hits++;
    else if (w.sky.level() >= d.sky) w.sky.misses++;
    // the weather it brings, held for as long as it lasts
    if (d.weather && w.weather.auto) {
      w.weather.set(w, d.weather, false, true);
      w.weather.timer = hoursToSeconds(e.hours) / Math.max(1, w.timeSpeed);
    }
    switch (e.kind) {
      case "predators": {
        const species = pick(w.rng, ["raptor", "allo", "dilo"] as SpeciesId[]);
        const fromWest = w.rng() < 0.5;
        const y = (36 + w.rng() * 44) * TILE;
        const pack = spawnGroup(w, species, fromWest ? 40 : WORLD_W - 40, y, species === "allo" ? 2 : 4, { migrant: true });
        for (const p of pack) {
          p.homeX = fromWest ? WORLD_W + 100 : -100;
          p.homeY = y + (w.rng() - 0.5) * 300;
          setState(p, "migrate", p.homeX, p.homeY);
        }
        if (pack[0]) w.toast("🐾", `${d.start} (${sp(species).nick}s)`, pack[0].x, pack[0].y);
        return;
      }
      case "newcomers":
        if (w.population.spawnWanderers(w).length) w.toast(d.icon, d.start);
        return;
      case "eruption":
        if (w.volcano.trigger(w, false)) w.toast(d.icon, d.start, w.volcano.x, w.volcano.y);
        return;
      default:
        w.toast(d.icon, d.start);
    }
  }

  private during(w: World, e: AlmanacEvent, dt: number) {
    if (e.kind !== "meteorShower" || w.daylight > 0.45) return;
    this.meteorT -= dt;
    if (this.meteorT > 0) return;
    this.meteorT = 5 + w.rng() * 6;
    // somewhere out in the land, well away from the camp + homes
    for (let k = 0; k < 12; k++) {
      const x = 200 + w.rng() * (WORLD_W - 400);
      const y = 200 + w.rng() * (WORLD_H - 500);
      if (Math.hypot(x - w.camp.x, y - w.camp.y) < 650) continue;
      if (w.shelters.some((s) => Math.hypot(s.x - x, s.y - y) < 400)) continue;
      const t = w.terrain.tileAt(x, y);
      if (t === T.Mountain || t === T.Deep || t === T.Shallow || t === T.River || t === T.Volcano) continue;
      w.meteor(x, y, 0.3 + w.rng() * 0.3, true);
      this.falling.push({ x, y, at: hoursOf(w) + 0.25 });
      return;
    }
  }

  /** Where a shower meteor came down, a little deposit of fragments to collect. */
  private land(w: World, now: number) {
    if (!this.falling.length) return;
    for (const f of this.falling.filter((f) => now >= f.at)) {
      const amount = 2 + Math.floor(w.rng() * 3);
      w.colony.nodes.push({ id: w.nextId(), kind: "meteorite", x: f.x, y: f.y, amount, max: amount, found: true, variant: Math.floor(w.rng() * 4) });
      if (!w.flags.has("showerFind")) {
        w.flags.add("showerFind");
        w.toast("☄️", "A shooting star came down out there: meteor fragments to collect!", f.x, f.y);
      }
    }
    this.falling = this.falling.filter((f) => now < f.at);
  }

  private end(w: World, e: AlmanacEvent) {
    const d = ALMANAC[e.kind];
    e.state = 2;
    if (d.end) w.toast(d.icon, d.end);
    // the held weather lets go soon after
    if (d.weather && w.weather.auto) w.weather.timer = Math.min(w.weather.timer, 20);
  }

  /** The volcano grumbles a day and a few hours before it goes (everyone can hear that). */
  private omen(w: World, e: AlmanacEvent, now: number) {
    const due = e.omens === 0 ? e.at - 24 : e.omens === 1 ? e.at - 8 : Infinity;
    if (now < due || w.volcano.phase !== "idle") return;
    e.omens++;
    w.volcano.trigger(w, true);
    w.toast("🌋", e.omens === 1 ? "The fire mountain is grumbling…" : "The fire mountain is grumbling again, louder this time…", w.volcano.x, w.volcano.y);
  }

  /** What the sky watchers think is coming, as they'd put it. */
  forecasts(w: World, now = hoursOf(w)): Forecast[] {
    const lv = w.sky.level();
    if (lv < 2) return [];
    const out: Forecast[] = [];
    const acc = ACCURACY[lv];
    for (const e of this.events) {
      if (e.state !== 0) continue;
      const d = ALMANAC[e.kind];
      const named = lv >= d.sky;
      if (!named && !(d.vague && lv >= 2)) continue;
      // real events are noticed if the dice are kind; false alarms fool the less skilled
      if (e.phantom ? e.luck < acc : e.luck >= acc) continue;
      const guess = e.at + e.err * SPREAD[lv];
      const inHours = guess - now;
      if (inHours > (named ? LEAD[lv] : 12) || inHours < -2) continue;
      out.push(named ? { icon: d.icon, text: `${d.name} ${when(inHours)}`, inHours } : { icon: "🔭", text: d.vague!, inHours });
    }
    // season reckoning: the next season, a day ahead
    if (lv >= 4) {
      const s = seasonAt(w.day);
      const next = seasonStartHours(s.index + 1) - now;
      if (next <= 24) out.push({ icon: SEASONS[(s.index + 1) % 4].icon, text: `${SEASONS[(s.index + 1) % 4].name} ${when(next)}`, inHours: next });
    }
    return out.sort((a, b) => a.inHours - b.inHours);
  }

  /** Tell the tribe when something first shows up in the forecasts (and again once it's named). */
  private foretell(w: World, now: number) {
    const lv = w.sky.level();
    if (lv < 2) return;
    const acc = ACCURACY[lv];
    for (const e of this.events) {
      if (e.state !== 0) continue;
      const d = ALMANAC[e.kind];
      const named = lv >= d.sky;
      const level: 1 | 2 = named ? 2 : 1;
      if (e.told >= level || (!named && !d.vague)) continue;
      if (e.phantom ? e.luck < acc : e.luck >= acc) continue;
      const inHours = e.at + e.err * SPREAD[lv] - now;
      if (inHours > (named ? LEAD[lv] : 12)) continue;
      e.told = level;
      w.toast("🔭", named ? `Sky watchers: ${d.name.toLowerCase()} likely ${when(inHours)}.` : d.vague!);
    }
    if (lv >= 4) {
      const s = seasonAt(w.day);
      const next = seasonStartHours(s.index + 1) - now;
      if (next <= 24 && this.toldSeason !== s.index + 1) {
        this.toldSeason = s.index + 1;
        const nd = SEASONS[(s.index + 1) % 4];
        w.toast(nd.icon, `Sky watchers: ${nd.name.toLowerCase()} begins ${when(next)}.${nd.id === "winter" ? " Fill the food stores!" : ""}`);
      }
    }
  }

  serialize() {
    const r = (n: number) => Math.round(n * 10) / 10;
    return {
      planned: this.planned,
      events: this.events.map((e) => ({ k: e.kind, at: r(e.at), h: r(e.hours), s: e.state, p: e.phantom ? 1 : 0, l: r(e.luck * 100) / 100, e: r(e.err * 100) / 100, t: e.told, o: e.omens })),
    };
  }

  load(d: ReturnType<Almanac["serialize"]> | undefined, w: World) {
    this.lastSeason = seasonAt(w.day).index;
    this.toldSeason = -1;
    if (!d) return;
    this.planned = d.planned ?? -1;
    this.events = (d.events ?? []).filter((e) => e.k in ALMANAC).map((e) => ({ kind: e.k as AlmanacKind, at: e.at, hours: e.h, state: e.s as 0 | 1 | 2, phantom: !!e.p, luck: e.l, err: e.e, told: e.t as 0 | 1 | 2, omens: e.o ?? 0 }));
  }
}

/** "within the hour" / "in about 5 hours" / "in about a day" */
function when(hours: number) {
  if (hours <= 1) return "within the hour";
  if (hours < 20) return `in about ${Math.round(hours)} hours`;
  const days = Math.round(hours / 24);
  return days <= 1 ? "in about a day" : `in about ${days} days`;
}
