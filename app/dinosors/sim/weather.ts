/* ------------------------------------------------------------------ */
/*  Weather: a target state that the live values ease toward, plus a   */
/*  gentle auto-cycle. Other systems read rain / wind / fog / temp.    */
/* ------------------------------------------------------------------ */
import { FACTS } from "../data/facts";
import type { WeatherKind } from "./types";
import type { World } from "./world";

interface Params {
  cloud: number;
  rain: number;
  wind: number;
  fog: number;
  temp: number;
  storm: number;
  /** 0..1 snowfall */
  snow: number;
}

const PRESETS: Record<WeatherKind, Params> = {
  clear: { cloud: 0.1, rain: 0, wind: 0.15, fog: 0, temp: 0.55, storm: 0, snow: 0 },
  cloudy: { cloud: 0.6, rain: 0, wind: 0.3, fog: 0, temp: 0.5, storm: 0, snow: 0 },
  rain: { cloud: 0.8, rain: 0.45, wind: 0.35, fog: 0.05, temp: 0.45, storm: 0, snow: 0 },
  heavyRain: { cloud: 0.95, rain: 0.85, wind: 0.5, fog: 0.1, temp: 0.4, storm: 0.2, snow: 0 },
  storm: { cloud: 1, rain: 0.95, wind: 0.9, fog: 0.05, temp: 0.4, storm: 1, snow: 0 },
  fog: { cloud: 0.5, rain: 0, wind: 0.05, fog: 0.75, temp: 0.4, storm: 0, snow: 0 },
  windy: { cloud: 0.4, rain: 0, wind: 1, fog: 0, temp: 0.5, storm: 0, snow: 0 },
  hot: { cloud: 0, rain: 0, wind: 0.1, fog: 0, temp: 0.95, storm: 0, snow: 0 },
  snow: { cloud: 0.8, rain: 0, wind: 0.3, fog: 0.1, temp: 0.12, storm: 0, snow: 0.6 },
  blizzard: { cloud: 1, rain: 0, wind: 1, fog: 0.35, temp: 0.04, storm: 0.25, snow: 1 },
};

export const WEATHER_LABEL: Record<WeatherKind, { icon: string; label: string }> = {
  clear: { icon: "☀️", label: "Sunny" },
  cloudy: { icon: "⛅", label: "Cloudy" },
  rain: { icon: "🌦️", label: "Rain" },
  heavyRain: { icon: "🌧️", label: "Downpour" },
  storm: { icon: "⛈️", label: "Storm" },
  fog: { icon: "🌫️", label: "Fog" },
  windy: { icon: "💨", label: "Windy" },
  hot: { icon: "🥵", label: "Heatwave" },
  snow: { icon: "🌨️", label: "Snow" },
  blizzard: { icon: "❄️", label: "Blizzard" },
};

/** Which weather tends to follow which (auto mode). */
const NEXT: Record<WeatherKind, WeatherKind[]> = {
  clear: ["clear", "cloudy", "windy", "hot", "fog"],
  cloudy: ["clear", "rain", "windy", "cloudy", "snow"],
  rain: ["cloudy", "heavyRain", "clear"],
  heavyRain: ["rain", "storm", "cloudy"],
  storm: ["heavyRain", "rain"],
  fog: ["clear", "cloudy"],
  windy: ["clear", "cloudy", "rain"],
  hot: ["clear", "windy", "cloudy"],
  snow: ["cloudy", "snow", "blizzard", "clear"],
  blizzard: ["snow", "cloudy"],
};

export class Weather implements Params {
  kind: WeatherKind = "clear";
  cloud = 0.1;
  rain = 0;
  wind = 0.15;
  fog = 0;
  temp = 0.55;
  storm = 0;
  snow = 0;
  windAngle = 0.3;
  windX = 0;
  windY = 0;
  /** ground wetness 0..1 → puddles */
  wet = 0;
  /** 0..1 rainbow visibility */
  rainbow = 0;
  /** seconds until auto weather change */
  timer = 90;
  auto = true;
  private boltT = 6;
  private wasRaining = false;

  set(w: World, kind: WeatherKind, manual = true) {
    this.kind = kind;
    this.timer = manual ? 120 + w.rng() * 60 : 70 + w.rng() * 110;
    if (kind === "storm") {
      w.alarm(w.camX, w.camY, 3000, 0.15, "🌩️");
      w.toast("⛈️", "A storm is rolling in!");
    }
    if (kind === "fog" && !w.flags.has("fogFact")) {
      w.flags.add("fogFact");
      w.toast("🌫️", "Spooky fog…", undefined, undefined, FACTS.fog);
    }
    if ((kind === "snow" || kind === "blizzard") && !w.flags.has("snowFact")) {
      w.flags.add("snowFact");
      w.discover("snow");
      w.toast(kind === "blizzard" ? "❄️" : "🌨️", kind === "blizzard" ? "A blizzard! Everyone needs a warm fire or a snug house." : "It's snowing! People get cold without fires and houses.");
    } else if (kind === "blizzard") w.toast("❄️", "A blizzard is blowing in — get inside!");
    if (kind === "windy" && !w.flags.has("windFact")) {
      w.flags.add("windFact");
      w.toast("💨", "Whoosh! Watch the trees and the flyers.", undefined, undefined, FACTS.wind);
    }
  }

  update(w: World, dt: number) {
    const p = PRESETS[this.kind];
    const k = Math.min(1, dt * 0.25);
    this.cloud += (p.cloud - this.cloud) * k;
    this.rain += (p.rain - this.rain) * k;
    this.wind += (p.wind - this.wind) * k;
    this.fog += (p.fog - this.fog) * k;
    this.temp += (p.temp - this.temp) * k * 0.5;
    this.storm += (p.storm - this.storm) * k;
    this.snow += (p.snow - this.snow) * k;
    this.windAngle += (Math.sin(w.elapsed * 0.05) * 0.4 - 0) * dt * 0.05;
    const gust = 1 + Math.sin(w.elapsed * 1.3) * 0.25 * this.wind;
    this.windX = Math.cos(this.windAngle) * this.wind * 10 * gust;
    this.windY = Math.sin(this.windAngle) * this.wind * 3 * gust;

    this.wet = Math.max(0, Math.min(1, this.wet + dt * (this.rain * 0.05 - (1 - this.rain) * 0.008 * (0.5 + this.temp))));

    // rainbow when rain stops during daytime
    const raining = this.rain > 0.25;
    if (this.wasRaining && !raining && w.daylight > 0.6) {
      this.rainbow = 1;
      w.discover("rainbow");
      w.toast("🌈", "A rainbow!", undefined, undefined, FACTS.rainbow);
    }
    this.wasRaining = raining;
    if (this.rainbow > 0) this.rainbow = Math.max(0, this.rainbow - dt / 40);
    if (raining && !w.flags.has("rainFact")) {
      w.flags.add("rainFact");
      w.toast("🌧️", "Rain! Plants grow faster and fires go out.", undefined, undefined, FACTS.rain);
    }

    // storms throw lightning
    if (this.storm > 0.5) {
      this.boltT -= dt;
      if (this.boltT <= 0) {
        this.boltT = 4 + w.rng() * 9;
        const x = w.camX + (w.rng() - 0.5) * 2600;
        const y = w.camY + (w.rng() - 0.5) * 1800;
        w.lightning(x, y, false);
      }
    }

    if (this.auto) {
      this.timer -= dt;
      if (this.timer <= 0) {
        const opts = NEXT[this.kind];
        this.set(w, opts[Math.floor(w.rng() * opts.length)], false);
      }
    }
  }
}
