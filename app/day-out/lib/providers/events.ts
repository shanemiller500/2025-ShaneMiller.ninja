import type { Activity, Provider } from "../types";
import { normalizeEvent, record } from "../normalize";
import { unstable_cache } from "next/cache";

export const EVENTS_SOURCE = { name: "Brisbane City Council", url: "https://data.brisbane.qld.gov.au/explore/dataset/brisbane-city-council-events/", attribution: "Brisbane City Council, CC BY 4.0" };
const EVENTS_URL = "https://data.brisbane.qld.gov.au/api/explore/v2.1/catalog/datasets/brisbane-city-council-events/exports/json";

// The full council export exceeds Next's 2 MB data-cache limit. Cache only the
// upcoming activities that the app can display, along with their fetch time.
const cachedEvents = unstable_cache(async () => {
  const response = await fetch(EVENTS_URL, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Source unavailable");
  const body = await response.text();
  if (body.length > 8_000_000) throw new Error("Source too large");
  const parsed: unknown = JSON.parse(body);
  const rows = Array.isArray(parsed) ? parsed : record(parsed).results;
  if (!Array.isArray(rows)) throw new Error("Invalid events response");
  const fetchedAt = new Date().toISOString();
  const source = { ...EVENTS_SOURCE, fetchedAt };
  const normalized = rows.map(row => normalizeEvent(row, source)).filter((event): event is Activity => event !== null);
  if (rows.length && !normalized.length) throw new Error("Events schema not recognized");
  const events = Array.from(new Map(normalized.filter(event => event.endDate! > fetchedAt).map(event => [event.id, event])).values())
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!))
    .slice(0, 200);
  return { fetchedAt, events };
}, ["day-out-events-v2"], { revalidate: 3600 });

export async function getEvents(): Promise<Provider<Activity[]>> {
  const { fetchedAt, events } = await cachedEvents();
  return { status: "available", source: { ...EVENTS_SOURCE, fetchedAt }, data: events, note: "Brisbane council listings. Other regional event calendars are linked in Explore; they are not yet aggregated." };
}
