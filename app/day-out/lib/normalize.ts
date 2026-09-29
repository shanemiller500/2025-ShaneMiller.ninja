import type { Activity, Category, Point, Source } from "./types";

export const GOLD_COAST: Point = { latitude: -28.0027, longitude: 153.431 };
// Home base: distances, ranking and Directions all start from Ormeau.
export const HOME_BASE: Point = { latitude: -27.7966, longitude: 153.26 };
export const HOME_NAME = "Ormeau";
export const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export const text = (v: unknown, max = 600): string => typeof v === "string" ? v.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim().slice(0, max) : "";
export const finite = (v: unknown): number | undefined => typeof v === "number" && Number.isFinite(v) ? v : undefined;
export function publicUrl(v: unknown): string | undefined {
  try {
    const url = new URL(typeof v === "string" ? v : "");
    if (url.protocol !== "https:" || url.username || url.password || url.port || !url.hostname.includes(".") || /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname) || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(":")) return;
    return url.href;
  } catch { return; }
}
export function iso(v: unknown): string | undefined {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return;
  // Council local timestamps without offsets are in Queensland (no DST).
  const value = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(v) ? v : `${v}+10:00`;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}
export function inRegion(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && lat >= -29.2 && lat <= -26 && lng >= 151.8 && lng <= 153.8;
}
export function brisbaneDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export function categoryFor(value: string): Category {
  if (/music|concert|\bband\b|\bgig\b|blues|jazz|rock|country/i.test(value)) return "Music";
  if (/anzac|remembrance|military|veteran|\bwar\b|\barmy\b|navy|\braaf\b|air force/i.test(value)) return "War";
  if (/motor|motorbike|motorcycle|car show|hot rod|speedway|drag rac/i.test(value)) return "Motorsport";
  return "Event";
}
export function normalizeEvent(raw: unknown, source: Source): Activity | null {
  const row = record(raw);
  const title = text(row.title || row.subject, 140);
  const startDate = iso(row.start_datetime || row.startdate || row.startDateTime || row.start_date_time);
  const endDate = iso(row.end_datetime || row.enddate || row.endDateTime || row.end_date_time);
  const id = text(String(row.event_id || row.eventid || row.id || ""));
  if (!id || !title || !startDate || !endDate || endDate < startDate || /cancelled|canceled/i.test(text(row.status))) return null;
  const geo = record(row.geo_point_2d || row.geolocation);
  const latitude = finite(geo.lat) ?? finite(row.latitude);
  const longitude = finite(geo.lon) ?? finite(row.longitude);
  if (latitude !== undefined && longitude !== undefined && !inRegion(latitude, longitude)) return null;
  const price = text(row.cost, 120) || undefined;
  const category = categoryFor(`${text(row.event_type)} ${title}`);
  const image = publicUrl(row.eventimage || row.event_image || row.image_url);
  return {
    id: `bcc-${id}`, kind: "event", title, startDate, endDate,
    description: text(row.description, 1000), category,
    region: "Brisbane", suburb: text(row.suburb, 100), venue: text(row.venue || row.location, 160),
    address: text(row.address || row.location, 200), latitude, longitude,
    environment: "mixed", price, isFree: price ? /^(free|\$0(?:\.00)?)$/i.test(price.trim()) : undefined,
    bookingRequired: /^yes$/i.test(text(row.bookingsrequired)),
    imageUrl: image, imageAttribution: image ? "Brisbane City Council event listing (CC BY 4.0)" : undefined,
    source: { ...source, url: publicUrl(row.web_link || row.weblink || row.url) || source.url, updatedAt: iso(row.last_updated || row.updated_at) },
  };
}
