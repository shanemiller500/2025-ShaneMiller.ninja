import type { Provider, Surf } from "../types";
import { finite, record } from "../normalize";
import { fetchSource } from "./http";

export const SURF_SOURCE = { name: "Open-Meteo / DWD", url: "https://open-meteo.com/en/docs/marine-weather-api", attribution: "Marine forecast: Open-Meteo and DWD (CC BY 4.0)" };
export async function getSurf(): Promise<Provider<Surf | null>> {
  const result = await fetchSource("https://marine-api.open-meteo.com/v1/marine?latitude=-28.05&longitude=153.5&hourly=wave_height,wave_period&forecast_days=2&timezone=Australia%2FBrisbane&timeformat=unixtime", 900);
  const hourly = record(record(result.body).hourly);
  if (!Array.isArray(hourly.time) || !Array.isArray(hourly.wave_height) || !Array.isArray(hourly.wave_period)) throw new Error("Invalid marine response");
  const index = hourly.time.findIndex(t => typeof t === "number" && t * 1000 >= Date.now() - 3600_000 && t * 1000 <= Date.now());
  const waveHeight = finite(hourly.wave_height[index]), wavePeriod = finite(hourly.wave_period[index]);
  if (index < 0 || waveHeight === undefined || wavePeriod === undefined) throw new Error("No current forecast");
  const time = new Date(hourly.time[index] * 1000).toISOString();
  return { status: "available", source: { ...SURF_SOURCE, fetchedAt: result.fetchedAt, updatedAt: time }, data: { waveHeight, wavePeriod, time }, note: "Offshore model near Gold Coast. Not breaking surf, tide, patrol or beach-closure information." };
}
