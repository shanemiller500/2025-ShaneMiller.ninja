/* ------------------------------------------------------------------ */
/*  Sky watching: the first steps of astronomy (game progression, not  */
/*  a history lesson). On clear nights one grown-up lies back and      */
/*  studies the sky; the tribe's sky knowledge grows, and with it:     */
/*    1. the moon's faces (a moon phase on the clock)                  */
/*    2. weather sense: vague warnings of rough weather (often right)  */
/*    3. sky lore: named forecasts with a rough time, earlier + surer  */
/*  Forecasts read the weather that's really coming next              */
/*  (Weather.upcoming), but aren't always right.                      */
/* ------------------------------------------------------------------ */
import { DAY_SECONDS } from "./world";
import { go, say } from "./humans";
import { pick } from "./rng";
import type { Human, WeatherKind } from "./types";
import { season } from "./seasons";
import type { World } from "./world";

export const SKY_LEVELS: { at: number; name: string; icon: string; text: string }[] = [
  { at: 0, name: "Looking up", icon: "👀", text: "" },
  { at: 60, name: "Moon counting", icon: "🌙", text: "The sky watchers have learned the moon's faces. Tonight's moon now shows on the clock." },
  { at: 200, name: "Weather sense", icon: "🌥️", text: "The sky watchers have started to feel rough weather coming. They'll warn the tribe (they aren't always right)." },
  { at: 450, name: "Sky lore", icon: "✨", text: "Sky lore! The watchers can now name the weather that's coming and roughly when, well ahead of time." },
  { at: 800, name: "Season reckoning", icon: "📅", text: "Season reckoning! The watchers can tell when the next season is coming, and see droughts and long rains days ahead." },
  { at: 1300, name: "Sky & fire signs", icon: "🌠", text: "The watchers read the deepest signs now: meteor showers and the fire mountain's moods, days before they come." },
];

/** Sky knowledge gained per second of stargazing. */
const GAIN = 1;
/** Rough weather worth a warning. */
const ROUGH = new Set<WeatherKind>(["storm", "heavyRain", "snow", "blizzard", "hot"]);
const ROUGH_NAME: Partial<Record<WeatherKind, string>> = { storm: "a storm", heavyRain: "heavy rain", snow: "snow", blizzard: "a blizzard", hot: "a heat wave" };
/** How far ahead (seconds) and how often right, by level. */
const SENSE = { 2: { lead: 45, right: 0.75 }, 3: { lead: 100, right: 0.9 } } as const;
/** The moon goes round in this many days. */
export const MOON_DAYS = 8;
const MOONS = ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"];
const MOON_NAMES = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];

export class Sky {
  /** the tribe's sky knowledge (see SKY_LEVELS) */
  knowledge = 0;
  /** who's stargazing tonight */
  watcher = 0;
  /** the weather change a warning was given for (Weather.changes), so each gets one */
  warnedFor = -1;
  /** what the warning said was coming (null = nothing / "rough") */
  warnedKind: WeatherKind | "rough" | "same" | null = null;
  hits = 0;
  misses = 0;
  private checkedFor = -1;

  level() {
    let n = 0;
    SKY_LEVELS.forEach((l, i) => {
      if (this.knowledge >= l.at) n = i;
    });
    return n;
  }

  /** Tonight's moon (an 8-day cycle). */
  moon(w: World) {
    const k = Math.floor(((w.day - 1 + w.time / 24) / MOON_DAYS) * 8 + 0.5) % 8;
    return { icon: MOONS[k], name: MOON_NAMES[k] };
  }

  update(w: World, dt: number) {
    this.watch(w, dt);
    this.score(w);
    if (this.level() >= 2) this.forecast(w);
  }

  /** Pick tonight's stargazer and let them learn. */
  private watch(w: World, dt: number) {
    const wt = w.weather;
    const clear = w.daylight < 0.3 && wt.cloud < 0.55 && wt.rain < 0.2 && wt.fog < 0.4 && !w.tribe.raid && !w.dragons.list.length;
    const cur = this.watcher ? w.humans.find((h) => h.id === this.watcher) : undefined;
    if (cur && cur.state !== "stargaze") this.watcher = 0;
    if (!clear) {
      if (cur?.state === "stargaze") go(cur, "idle", cur.x, cur.y);
      this.watcher = 0;
      return;
    }
    if (this.watcher && cur) {
      const before = this.level();
      this.knowledge += dt * GAIN;
      if (w.rng() < dt * 0.04) say(cur, pick(w.rng, ["So many stars…", "The moon moved!", "That one's bright.", "Ooh, a shooting star!"]));
      const after = this.level();
      if (after > before) {
        const l = SKY_LEVELS[after];
        w.toast(l.icon, l.text, cur.x, cur.y);
        if (after === 1) w.discover("skyWatcher");
      }
      return;
    }
    // someone relaxing by a fire (or with nothing to do) looks up for the night
    const pickOne = (ok: (h: Human) => boolean) => w.humans.find((h) => !h.child && !h.stranger && !h.under && !h.captive && h.hp > 0.5 && !h.taskId && !h.order && w.tribe.roleOf(h) !== "guard" && ok(h));
    const h = pickOne((o) => o.state === "sitFire") ?? pickOne((o) => o.state === "idle");
    if (!h) return;
    this.watcher = h.id;
    go(h, "stargaze", h.x, h.y);
    if (!w.flags.has("firstStargaze")) {
      w.flags.add("firstStargaze");
      w.toast("✨", `${h.name} is lying back watching the stars. On clear nights the tribe slowly learns the sky.`, h.x, h.y);
    }
  }

  /** Warn about rough weather that's on its way (sometimes wrongly). */
  private forecast(w: World) {
    const wt = w.weather;
    if (!wt.auto || !wt.upcoming || this.warnedFor === wt.changes) return;
    const sense = SENSE[this.level() >= 3 ? 3 : 2];
    if (wt.timer > sense.lead) return;
    this.warnedFor = wt.changes;
    // more of the same isn't news (and isn't scored)
    if (wt.upcoming === wt.kind) {
      this.warnedKind = "same";
      return;
    }
    const rough = ROUGH.has(wt.upcoming);
    const right = w.rng() < sense.right;
    // wrong guesses are still sensible ones: weather that can happen this season
    const plausible = Array.from(ROUGH).filter((k) => k !== wt.upcoming && k !== wt.kind && (season(w).weather[k] ?? 1) > 0);
    // calm ahead: usually silence, now and then a false alarm
    if (!rough) {
      if (!right && plausible.length && w.rng() < 0.4) this.announce(w, pick(w.rng, plausible), wt.timer);
      else this.warnedKind = null;
      return;
    }
    // rough ahead: a wrong guess names the wrong thing (or misses it altogether)
    if (right) this.announce(w, wt.upcoming, wt.timer);
    else if (plausible.length && w.rng() < 0.5) this.announce(w, pick(w.rng, plausible), wt.timer);
    else this.warnedKind = null;
  }

  private announce(w: World, kind: WeatherKind, inSeconds: number) {
    if (this.level() >= 3) {
      const hours = Math.max(1, Math.round((inSeconds * 24) / DAY_SECONDS));
      this.warnedKind = kind;
      w.toast("🔭", `Sky watchers: ${ROUGH_NAME[kind] ?? "bad weather"} is likely within about ${hours} hour${hours === 1 ? "" : "s"}.`);
    } else {
      this.warnedKind = "rough";
      w.toast("🔭", "The sky watchers don't like the look of the sky… rough weather may be coming.");
    }
  }

  /** When the weather actually changes, was the warning right? */
  private score(w: World) {
    const wt = w.weather;
    if (this.checkedFor === wt.changes) return;
    const prev = this.checkedFor;
    this.checkedFor = wt.changes;
    // only the weather's own changes count (not ones forced by a world event), and not skipped ones
    if (prev < 0 || this.warnedFor !== wt.changes - 1 || wt.forced || this.warnedKind === "same") return;
    const rough = ROUGH.has(wt.kind);
    const said = this.warnedKind;
    if (said === null) {
      if (rough) this.misses++;
      return;
    }
    if (said === "rough" ? rough : said === wt.kind) this.hits++;
    else this.misses++;
  }

  serialize() {
    return { knowledge: Math.round(this.knowledge), hits: this.hits, misses: this.misses };
  }

  load(d: ReturnType<Sky["serialize"]> | undefined) {
    if (!d) return;
    this.knowledge = d.knowledge ?? 0;
    this.hits = d.hits ?? 0;
    this.misses = d.misses ?? 0;
  }
}
