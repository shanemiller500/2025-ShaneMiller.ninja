import type { Notice, Point, Provider } from "../types";
import { finite, inRegion, iso, record, text } from "../normalize";
import { fetchSource } from "./http";

export const TRAFFIC_SOURCE = { name: "QLDTraffic / TMR", url: "https://qldtraffic.qld.gov.au/", attribution: "State of Queensland (Department of Transport and Main Roads), CC BY 4.0" };
function geometryPoints(raw: unknown): Point[] {
  const geometry = record(raw);
  if (geometry.type === "GeometryCollection" && Array.isArray(geometry.geometries)) return geometry.geometries.flatMap(geometryPoints);
  const coordinates = geometry.coordinates;
  const pairs = geometry.type === "Point" ? [coordinates] : geometry.type === "LineString" && Array.isArray(coordinates) ? coordinates : [];
  return pairs.flatMap(pair => {
    if (!Array.isArray(pair)) return [];
    const longitude = finite(pair[0]), latitude = finite(pair[1]);
    return inRegion(latitude, longitude) ? [{ latitude: latitude!, longitude: longitude! }] : [];
  });
}
export function normalizeTraffic(raw: unknown, fetchedAt: string, now = Date.now()): Notice[] {
  const body = record(raw);
  if (!Array.isArray(body.features)) throw new Error("Invalid traffic response");
  const published = iso(body.published);
  if (!published || now - Date.parse(published) > 2 * 3600_000) throw new Error("Stale traffic feed");
  return body.features.flatMap(feature => {
    const item = record(feature), props = record(item.properties), road = record(props.road_summary), duration = record(props.duration);
    const points = geometryPoints(item.geometry);
    const region = text(road.local_government_area);
    if (!points.length && !/gold coast|brisbane|scenic rim|logan|redland|ipswich|moreton|sunshine|tweed/i.test(region)) return [];
    if (props.status !== "Published") return [];
    const startDate = iso(duration.start), endDate = iso(duration.end);
    if (startDate && Date.parse(startDate) > now || endDate && Date.parse(endDate) < now) return [];
    const title = text(props.description, 180);
    if (!title || props.id === undefined) return [];
    return [{
      id: `traffic-${String(props.id)}`, title, description: text(`${text(record(props.impact).impact_type)}. ${text(props.advice)} ${text(props.information)}`, 500),
      kind: "traffic" as const, severity: "warning" as const, areas: [text(road.locality), text(road.road_name)].filter(Boolean), points, startDate, endDate,
      source: { ...TRAFFIC_SOURCE, fetchedAt, updatedAt: iso(props.last_updated) || published },
    }];
  });
}
export async function getTraffic(): Promise<Provider<Notice[]>> {
  const key = process.env.QLD_TRAFFIC_API_KEY?.trim();
  if (!key) return { status: "unconfigured", data: [], source: { ...TRAFFIC_SOURCE, fetchedAt: new Date().toISOString() }, note: "Road-condition data is unavailable. Check QLDTraffic before leaving." };
  const url = new URL("https://api.qldtraffic.qld.gov.au/v2/events");
  url.searchParams.set("apikey", key);
  const result = await fetchSource(url.href, 300);
  return { status: "available", data: normalizeTraffic(result.body, result.fetchedAt), source: { ...TRAFFIC_SOURCE, fetchedAt: result.fetchedAt }, note: "Reported disruptions only. Coverage does not confirm the condition of every road." };
}
