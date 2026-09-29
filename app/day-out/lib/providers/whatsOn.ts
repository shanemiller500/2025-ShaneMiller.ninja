import { unstable_cache } from "next/cache";
import type { Activity, Category } from "../types";
import { brisbaneDay, publicUrl, text } from "../normalize";
import { webSearchJson } from "../openai";

// Web-searched events for today and tomorrow across South East Queensland, matched to Dad's interests.
// One search per Queensland day (server cache), and every event must link to a real page;
// anything without a valid link or date is dropped rather than shown.
const CATEGORIES: Category[] = ["Music", "War", "Motorsport"];
// South East Queensland regions the search covers (also used to label each event).
const AREAS = ["Brisbane", "Gold Coast", "Sunshine Coast", "Ipswich", "Logan", "Redlands", "Moreton Bay", "Scenic Rim", "Toowoomba", "Lockyer Valley", "Noosa", "Somerset"];
const SYSTEM = `You find real, upcoming events for an older bloke living in Ormeau, Queensland.
Search the web across ALL of South East Queensland: ${AREAS.join(", ")}. Run several searches (for example each region's what's-on pages, gig guides, motorcycle club calendars, car show listings, RSL and museum events) so the list isn't just one area. Only include events actually listed online for the given dates.
He likes: live music and pub gigs (rock, blues, country, cover bands), motorbike events, rides, shows and swap meets, car shows and motorsport, war and military history (museums, Anzac/RSL events, air shows).
Never include funerals, farewells or memorials for individual people. For each event give the exact page URL where it is listed. Never invent events, venues, times or URLs; if unsure, leave it out. Return up to 15, spread across different regions where possible.`;

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["events"],
  properties: {
    events: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["title", "date", "time", "venue", "suburb", "area", "category", "url", "description"],
        properties: {
          title: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          time: { type: ["string", "null"], description: "24h HH:MM start time, or null if not listed" },
          venue: { type: "string" },
          suburb: { type: "string" },
          area: { type: "string", enum: AREAS },
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
      venue: text(e.venue, 120), suburb: text(e.suburb, 80), region: AREAS.includes(String(e.area)) ? String(e.area) : "South East Queensland",
      startDate: start.toISOString(), endDate: end.toISOString(),
      openingHours: time ? undefined : "Start time not listed. Check the event page.",
      source: { name: new URL(url).hostname.replace(/^www\./, ""), url, fetchedAt, ttlMinutes: 24 * 60 },
    }];
  });
}

// Three focused searches (run in parallel) cover far more than one broad one, which tends
// to come back as all gigs. Results are merged and de-duplicated; one failing is fine.
const THEMES = [
  "Live music only: pub gigs, rock, blues, country and cover bands, concerts, music festivals.",
  "Motorbikes, cars and motorsport only: open motorcycle rides and charity runs, bike shows, swap meets, car and hot rod shows, drag racing, speedway, circuit racing. Prefer events open to the public over members-only club rides.",
  "War and military history only: public events a visitor could go to, such as military museum exhibitions and open days, air shows, historic re-enactments, war history talks and tours, commemorative services open to the public. Exclude veterans' support and welfare sessions (yoga, fitness, morning teas, counselling, member socials).",
];

// If two visits miss the cache at the same moment, they share one search instead of paying twice.
const inFlight = new Map<string, Promise<{ day: string; fetchedAt: string; events: Activity[] }>>();

export function getWhatsOn(now = new Date()) {
  const day = brisbaneDay(now);
  const running = inFlight.get(day);
  if (running) return running;
  const request = searchDay(day).finally(() => inFlight.delete(day));
  inFlight.set(day, request);
  return request;
}

function searchDay(day: string) {
  return unstable_cache(async () => {
    const fetchedAt = new Date().toISOString();
    const ask = `Find events on ${day} (today) and ${addDays(day, 1)} (tomorrow).`;
    const results = await Promise.allSettled(THEMES.map((theme) => webSearchJson(`${SYSTEM}
This search: ${theme}`, ask, "whats_on", SCHEMA, 3000)));
    const ok = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (!ok.length) throw new Error("All event searches failed");
    const merged = { events: ok.flatMap((raw) => (Array.isArray((raw as { events?: unknown }).events) ? (raw as { events: unknown[] }).events : [])) };
    return { day, fetchedAt, events: normalizeWhatsOn(merged, day, fetchedAt) };
  }, ["day-out-whats-on-v6-seq", day], { revalidate: 24 * 3600 })();
}
