import type { Provider, Weather } from "../types";
import { finite, record } from "../normalize";
import { fetchSource } from "./http";

export const WEATHER_SOURCE = { name: "Open-Meteo", url: "https://open-meteo.com/", attribution: "Weather data by Open-Meteo (CC BY 4.0)" };
export async function getWeather(): Promise<Provider<Weather | null>> {
  const result = await fetchSource("https://api.open-meteo.com/v1/forecast?latitude=-28.0027&longitude=153.431&current=temperature_2m,precipitation,wind_speed_10m,weather_code&hourly=precipitation_probability&daily=temperature_2m_max&forecast_days=2&timezone=Australia%2FBrisbane&timeformat=unixtime", 600);
  const body = record(result.body), current = record(body.current), hourly = record(body.hourly), daily = record(body.daily);
  const temperature = finite(current.temperature_2m), rain = finite(current.precipitation), wind = finite(current.wind_speed_10m), code = finite(current.weather_code), timestamp = finite(current.time);
  if ([temperature, rain, wind, code, timestamp].some(x => x === undefined)) throw new Error("Incomplete weather");
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const probabilities = Array.isArray(hourly.precipitation_probability) ? hourly.precipitation_probability : [];
  const next = times.flatMap((time, index) => typeof time === "number" && time >= timestamp! && time <= timestamp! + 14400 && finite(probabilities[index]) !== undefined ? [probabilities[index] as number] : []);
  const maxTemperature = Array.isArray(daily.temperature_2m_max) ? finite(daily.temperature_2m_max[0]) : undefined;
  if (!next.length || maxTemperature === undefined) throw new Error("Incomplete forecast");
  const time = new Date(timestamp! * 1000).toISOString();
  if (Date.now() - Date.parse(time) > 2 * 3600_000) throw new Error("Old forecast");
  return { status: "available", source: { ...WEATHER_SOURCE, fetchedAt: result.fetchedAt, updatedAt: time }, data: { temperature: temperature!, rain: rain!, wind: wind!, code: code!, time, rainNextHours: Math.max(...next), maxTemperature } };
}
