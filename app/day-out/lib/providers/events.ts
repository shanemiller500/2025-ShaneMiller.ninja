import type { Activity, Provider } from "../types";
import { normalizeEvent, record } from "../normalize";
import { fetchSource } from "./http";

export const EVENTS_SOURCE = { name: "Brisbane City Council", url: "https://data.brisbane.qld.gov.au/explore/dataset/brisbane-city-council-events/", attribution: "Brisbane City Council, CC BY 4.0" };
export async function getEvents(): Promise<Provider<Activity[]>> {
  const result = await fetchSource("https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/brisbane-city-council-events/exports/json", 3600);
  const rows = Array.isArray(result.body) ? result.body : record(result.body).results;
  if (!Array.isArray(rows)) throw new Error("Invalid events response");
  const source = { ...EVENTS_SOURCE, fetchedAt: result.fetchedAt };
  const events = rows.slice(0, 2500).map(row => normalizeEvent(row, source)).filter((event): event is Activity => event !== null);
  if (rows.length && !events.length) throw new Error("Events schema not recognized");
  return { status: "available", source, data: Array.from(new Map(events.map(event => [event.id, event])).values()), note: "Brisbane council listings. Other regional event calendars are linked in Explore; they are not yet aggregated." };
}
