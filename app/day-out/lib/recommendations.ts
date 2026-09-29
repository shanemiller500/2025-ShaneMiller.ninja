import type { Activity, DayData, Notice, Point, Preferences, Recommendation } from "./types";
import { brisbaneDay, HOME_BASE, HOME_NAME } from "./normalize";

export function distanceKm(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad, dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function fresh(fetchedAt: string, minutes: number, now: Date): boolean {
  const age = now.getTime() - Date.parse(fetchedAt);
  return Number.isFinite(age) && age >= -60000 && age <= minutes * 60000;
}
export function relevantNotices(activity: Activity, notices: Notice[]): Notice[] {
  const names = [activity.suburb, ...(activity.stops?.map(stop => stop.name) || [])].map(name => name.toLowerCase()).filter(name => name.length > 3);
  const points: Point[] = activity.stops || (activity.latitude !== undefined && activity.longitude !== undefined ? [{ latitude: activity.latitude, longitude: activity.longitude }] : []);
  return notices.filter(notice => {
    const content = `${notice.title} ${notice.description} ${notice.areas.join(" ")}`.toLowerCase();
    return names.some(name => content.includes(name)) || notice.points?.some(point => points.some(stop => distanceKm(point, stop) < 5));
  });
}
export function recommend(data: DayData, prefs: Preferences = { freeOnly: false, interests: [] }, now = new Date()): Recommendation[] {
  const today = brisbaneDay(now);
  const local = new Date(now.getTime() + 10 * 3600_000);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
  const weather = data.weather.status === "available" && fresh(data.weather.source.fetchedAt, 30, now) && data.weather.data && fresh(data.weather.data.time, 120, now) ? data.weather.data : null;
  const surf = data.surf.status === "available" && fresh(data.surf.source.fetchedAt, 30, now) ? data.surf.data : null;
  const notices = [...data.traffic.data, ...data.news.data];
  return data.activities.flatMap(activity => {
    if (prefs.freeOnly && activity.isFree !== true) return [];
    if (activity.kind === "event") {
      if (!fresh(activity.source.fetchedAt, 120, now) || !activity.startDate || !activity.endDate || activity.endDate <= now.toISOString() || brisbaneDay(new Date(activity.startDate)) > today) return [];
    }
    if (activity.hours) {
      const { days, open, close } = activity.hours;
      const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
      if (!days.includes(local.getUTCDay()) || minutes >= toMinutes(close)) return [];
      if (toMinutes(open) - minutes > 120) return [];
    }
    let score = 50;
    const distance = activity.latitude !== undefined && activity.longitude !== undefined ? distanceKm(HOME_BASE, { latitude: activity.latitude, longitude: activity.longitude }) : undefined;
    if (distance !== undefined) score -= Math.min(30, distance / 4);
    if (prefs.interests.includes(activity.category)) score += 18;
    if (activity.isFree) score += 6;
    if (activity.kind === "event") score += 20;
    let reason = activity.kind === "event" ? "Listed for today. Check bookings before leaving." : "A local place idea. Check opening hours before leaving.";
    const outdoors = activity.environment === "outdoor";
    // Gold Coast weather must not be presented as route-wide / Brisbane conditions.
    const weatherApplies = distance !== undefined && distance <= 45;
    if (outdoors && (minutes < 360 || minutes >= 1050)) { score -= 45; reason = "An outdoor idea for daylight hours."; }
    if (weather && weatherApplies) {
      const wet = weather.rain > 0.2 || weather.rainNextHours >= 60;
      const windy = weather.wind >= 30;
      const hot = weather.temperature >= 30 || weather.maxTemperature >= 33;
      if (activity.environment === "indoor" && (wet || hot)) { score += 32; reason = wet ? "An indoor option with rain in the Gold Coast forecast." : "An indoor break from the Gold Coast heat."; }
      if (outdoors && wet) { score -= 38; reason = "Rain is in the Gold Coast forecast. Consider an indoor option."; }
      else if (outdoors && windy) { score -= 28; reason = "Windy around the Gold Coast. Check conditions at your destination."; }
      else if (outdoors && hot) { score -= 22; reason = "A hot Gold Coast forecast. Plan shade and a cooler part of the day."; }
      else if (outdoors && minutes >= 360 && minutes < 1050) { score += 14; reason = "A mild Gold Coast forecast for time outdoors. Check local conditions."; }
      if (activity.kind === "ride" && (wet || windy || hot)) score -= 25;
    }
    if (!weather && activity.kind === "ride") { score -= 15; reason = "A ride idea. Weather and road conditions need checking."; }
    if (activity.category === "Beach" && surf && surf.waveHeight >= 2) { score -= 25; reason = "Larger waves in the offshore forecast. Check Beachsafe for local conditions."; }
    const relevant = relevantNotices(activity, notices);
    if (relevant.length) { score -= 80; reason = "There are notices near this idea. Check the details before planning a visit."; }
    return [{ activity, score, reason, distanceKm: distance, notices: relevant }];
  }).sort((a, b) => b.score - a.score || a.activity.id.localeCompare(b.activity.id));
}
export function surpriseCandidates(recommendations: Recommendation[]): Recommendation[] {
  return recommendations.filter(item => item.score >= 35 && item.notices.length === 0).slice(0, 8);
}
export function directionsUrl(activity: Activity): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", `${HOME_NAME} QLD`);
  url.searchParams.set("travelmode", activity.travel === "transit" ? "transit" : "driving");
  if (activity.stops?.length) {
    const stops = activity.stops;
    url.searchParams.set("destination", `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`);
    url.searchParams.set("waypoints", stops.slice(0, -1).map(stop => `${stop.latitude},${stop.longitude}`).join("|"));
  } else {
    url.searchParams.set("destination", activity.latitude !== undefined && activity.longitude !== undefined ? `${activity.latitude},${activity.longitude}` : `${activity.venue || activity.title}, ${activity.address || activity.suburb}, Queensland`);
  }
  return url.href;
}
