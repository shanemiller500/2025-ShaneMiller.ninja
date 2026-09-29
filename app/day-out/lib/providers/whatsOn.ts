import { unstable_cache } from "next/cache";
import type { Activity, Category } from "../types";
import { brisbaneDay, publicUrl, text } from "../normalize";
import { webSearchJson } from "../openai";

// Web-searched events for today and tomorrow around Ormeau, matched to Dad's interests.
// One search per Queensland day (server cache), and every event must link to a real page;
// anything without a valid link or date is dropped rather than shown.
const CATEGORIES: Category[] = ["Music", "War", "Motorsport"];
const SYSTEM = `You find real, upcoming events for an older bloke living in Ormeau, Queensland (between Brisbane and the Gold Coast).
Search the web. Only include events that are actually listed online for the given dates, within about 90 minutes' drive of Ormeau (Gold Coast, Brisbane, Logan, Scenic Rim, Tweed).
He likes: live music and pub gigs (rock, blues, country, cover bands), motorbike events, rides, shows and swap meets, car shows and motorsport, war and military history (museums, Anzac/RSL events, air shows).
For each event give the exact page URL where it is listed. Never invent events, venues, times or URLs; if unsure, leave it out. Return at most 10.`;

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["events"],
  properties: {
    events: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["title", "date", "time", "venue", "suburb", "category", "url", "description"],
        properties: {
          title: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: ["string", "null"], description: "24h HH:MM start time, or null if not listed" },
          venue: { type: "string" },
          suburb: { type: "string" },
          category: { type: "string", enum: CATEGORIES },
          url: { type: "string" },
          description: { type: "string", description: "One or two sentences, from the listing" },
        },
      },
    },
  },
};

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00+10:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return brisbaneDay(d);
};

export function normalizeWhatsOn(raw: unknown, day: string, fetchedAt: string): Activity[] {
  const events = Array.isArray((raw as { events?: unknown })?.events) ? (raw as { events: unknown[] }).events : [];
  const allowed = new Set([day, addDays(day, 1)]);
  const seen = new Set<string>();
  // Earliest date first, so an event listed on both days is kept once, on the first day.
  const sorted = [...events].sort((a, b) => String((a as Record<string, unknown>)?.date).localeCompare(String((b as Record<string, unknown>)?.date)));
  return sorted.flatMap((item, i) => {
    const e = item as Record<string, unknown>;
    const title = text(e.title, 140), date = text(e.date, 10), url = publicUrl(e.url);
    const category = CATEGORIES.includes(e.category as Category) ? e.category as Category : null;
    if (!title || !url || !category || !allowed.has(date)) return [];
    const key = `${title.toLowerCase()}|${url}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const time = typeof e.time === "string" && /^\d{2}:\d{2}$/.test(e.time) ? e.time : null;
    const start = new Date(`${date}T${time || "09:00"}:00+10:00`), end = new Date(`${date}T23:59:00+10:00`);
    if (!Number.isFinite(start.getTime())) return [];
    return [{
      id: `web-${date}-${i}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
      kind: "event" as const, title, category, environment: "mixed" as const,
      description: text(e.description, 400) || "Listed online. Check the event page for details.",
      venue: text(e.venue, 120), suburb: text(e.suburb, 80), region: "Around Ormeau",
      startDate: start.toISOString(), endDate: end.toISOString(),
      openingHours: time ? undefined : "Start time not listed. Check the event page.",
      source: { name: new URL(url).hostname.replace(/^www\./, ""), url, fetchedAt, ttlMinutes: 24 * 60 },
    }];
  });
}

export async function getWhatsOn(now = new Date()) {
  const day = brisbaneDay(now);
  return unstable_cache(async () => {
    const fetchedAt = new Date().toISOString();
    const raw = await webSearchJson(SYSTEM, `Find events on ${day} (today) and ${addDays(day, 1)} (tomorrow).`, "whats_on", SCHEMA, 3000);
    return { day, fetchedAt, events: normalizeWhatsOn(raw, day, fetchedAt) };
  }, ["day-out-whats-on-v2", day], { revalidate: 24 * 3600 })();
}
