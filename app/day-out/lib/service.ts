import type { Activity, DayData, Notice, Provider, Source, Surf, Weather } from "./types";
import { getWeather, WEATHER_SOURCE } from "./providers/weather";
import { getSurf, SURF_SOURCE } from "./providers/surf";
import { getEvents, EVENTS_SOURCE } from "./providers/events";
import { getTraffic, TRAFFIC_SOURCE } from "./providers/traffic";
import { getNews, NEWS_SOURCE } from "./providers/news";
import { PLACES } from "./providers/places";

function result<T>(settled: PromiseSettledResult<Provider<T>>, fallback: T, source: Omit<Source, "fetchedAt">): Provider<T> {
  return settled.status === "fulfilled" ? settled.value : { status: "unavailable", data: fallback, source: { ...source, fetchedAt: new Date().toISOString() }, note: "This source could not be refreshed. Please check the source directly." };
}
export async function getDayData(): Promise<DayData> {
  const [weather, surf, events, traffic, news] = await Promise.allSettled([getWeather(), getSurf(), getEvents(), getTraffic(), getNews()]);
  const eventResult = result<Activity[]>(events, [], EVENTS_SOURCE);
  return {
    generatedAt: new Date().toISOString(), activities: [...PLACES, ...eventResult.data],
    weather: result<Weather | null>(weather, null, WEATHER_SOURCE), surf: result<Surf | null>(surf, null, SURF_SOURCE),
    events: eventResult, traffic: result<Notice[]>(traffic, [], TRAFFIC_SOURCE), news: result<Notice[]>(news, [], NEWS_SOURCE),
  };
}
