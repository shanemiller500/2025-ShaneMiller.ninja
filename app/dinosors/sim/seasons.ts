/* ------------------------------------------------------------------ */
/*  Seasons. A year is four seasons of SEASON_DAYS days, starting in   */
/*  spring on day 1. The season is worked out from the day, so there's */
/*  nothing to save. Other systems read it:                            */
/*    weather   which weather comes next + how warm it is              */
/*    plants    how fast they grow back      farms  how fast crops grow */
/*    dinos     nesting (egg laying)          events which are likely    */
/*    people    the tribe stocks up on food before winter              */
/* ------------------------------------------------------------------ */
import { DAY_SECONDS } from "./world";
import type { WeatherKind } from "./types";
import type { World } from "./world";

export type SeasonId = "spring" | "summer" | "autumn" | "winter";

/** Days in each season (a year is four of them). */
export const SEASON_DAYS = 3;
export const YEAR_DAYS = SEASON_DAYS * 4;

export interface SeasonDef {
  id: SeasonId;
  name: string;
  icon: string;
  /** added to the weather's temperature (0..1 scale) */
  temp: number;
  /** plant regrowth + crop growth multipliers */
  plants: number;
  farms: number;
  /** how fast dinosaurs come into nesting condition */
  eggs: number;
  /** weights for the next weather (1 when not listed; 0 = never this season) */
  weather: Partial<Record<WeatherKind, number>>;
  /** extra weathers that can follow these ones this season (winter snow after cloud, summer heat after clear…) */
  extra: Partial<Record<WeatherKind, WeatherKind[]>>;
  /** how much food the tribe aims to keep (autumn: stock up for winter) */
  stockpile: number;
  /** said when it begins */
  arrives: string;
}

export const SEASONS: SeasonDef[] = [
  {
    id: "spring", name: "Spring", icon: "🌱", temp: 0, plants: 1.4, farms: 1.2, eggs: 2,
    weather: { rain: 1.4, heavyRain: 1, snow: 0.15, blizzard: 0, hot: 0.3 },
    extra: { clear: ["rain"] },
    stockpile: 1, arrives: "Spring! Plants grow back fast, the rains come and dinosaurs start nesting.",
  },
  {
    id: "summer", name: "Summer", icon: "☀️", temp: 0.12, plants: 1, farms: 1.3, eggs: 1,
    weather: { hot: 2.5, clear: 1.5, snow: 0, blizzard: 0, fog: 0.4 },
    extra: { cloudy: ["hot"], windy: ["hot"] },
    stockpile: 1, arrives: "Summer: long warm days, good crops… and the odd heat wave or drought.",
  },
  {
    id: "autumn", name: "Autumn", icon: "🍂", temp: -0.08, plants: 0.6, farms: 0.9, eggs: 0.6,
    weather: { windy: 1.8, fog: 1.6, rain: 1.2, hot: 0.2, snow: 0.4, blizzard: 0 },
    extra: { clear: ["windy"] },
    stockpile: 1.7, arrives: "Autumn. Plants slow down. Wise tribes fill their food stores before winter.",
  },
  {
    id: "winter", name: "Winter", icon: "❄️", temp: -0.25, plants: 0.2, farms: 0, eggs: 0.2,
    weather: { snow: 3, blizzard: 1.5, hot: 0, rain: 0.3, heavyRain: 0.2, storm: 0.2 },
    extra: { cloudy: ["snow"], fog: ["snow"], windy: ["snow"], clear: ["cloudy"] },
    stockpile: 1.3, arrives: "Winter is here. Crops won't grow; fires, warm homes and full stores keep the tribe going.",
  },
];

/** The season on a given day (day 1 is the first day of spring). */
export function seasonAt(day: number) {
  const d = Math.max(0, day - 1);
  const n = Math.floor(d / SEASON_DAYS);
  return { def: SEASONS[n % 4], index: n, dayOf: (d % SEASON_DAYS) + 1, year: Math.floor(d / YEAR_DAYS) + 1 };
}

export function season(w: World) {
  return seasonAt(w.day).def;
}

/** Game hours since the world began (the calendar the almanac + forecasts use). */
export const hoursOf = (w: World) => (w.day - 1) * 24 + w.time;
/** Game hours when season number n starts. */
export const seasonStartHours = (n: number) => n * SEASON_DAYS * 24;
/** Real seconds for a stretch of game hours (at normal clock speed). */
export const hoursToSeconds = (h: number) => (h / 24) * DAY_SECONDS;
