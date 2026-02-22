import type { LiteCountry } from "./types";
import { CACHE_FEATURED_KEY, FEATURED_PICK_COUNT, WIKI_CLAMP_LENGTH } from "./constants";

export const lc = (s: string) => (s || "").toLowerCase();
export const fmt = (n?: number) => (typeof n === "number" ? n.toLocaleString() : "—");
export const cToF = (c: number): number => Math.round(c * 1.8 + 32);

export function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export function clampText(s?: string, max = WIKI_CLAMP_LENGTH): string {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

export function getFeatured(mini: LiteCountry[]): LiteCountry[] {
  try {
    const raw = localStorage.getItem(CACHE_FEATURED_KEY);
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      const map = new Map(mini.map((c) => [c.cca3, c]));
      const picked = ids.map((id) => map.get(id)).filter(Boolean) as LiteCountry[];
      if (picked.length >= Math.min(FEATURED_PICK_COUNT, mini.length)) {
        return picked.slice(0, FEATURED_PICK_COUNT);
      }
    }
  } catch { /* localStorage unavailable */ }

  const shuffled = [...mini].sort(() => Math.random() - 0.5).slice(0, FEATURED_PICK_COUNT);
  try {
    localStorage.setItem(CACHE_FEATURED_KEY, JSON.stringify(shuffled.map((c) => c.cca3)));
  } catch { /* localStorage unavailable */ }
  return shuffled;
}

export function getBestTime(lat?: number): { label: string; classes: string } {
  if (lat == null) return { label: "Year-round destination", classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" };
  if (Math.abs(lat) < 15) return { label: "Dry season: Nov–Apr", classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" };
  if (lat >= 15) return { label: "Peak season: May–Sep", classes: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300" };
  return { label: "Peak season: Oct–Mar", classes: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" };
}

export function getLocalTime(timezones?: string[]): string | null {
  if (!timezones?.[0]) return null;
  const match = timezones[0].match(/UTC([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return null;
  const sign = match[1] === "+" ? 1 : -1;
  const h = parseInt(match[2], 10);
  const m = parseInt(match[3] || "0", 10);
  const offsetMs = sign * (h * 60 + m) * 60 * 1000;
  const utcMs = Date.now() + new Date().getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + offsetMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function getPackList(temp?: number): string[] {
  const base = ["Passport + visa documents", "Travel insurance info", "Local currency + backup card"];
  if (temp == null) return [...base, "Check weather forecast before packing"];
  if (temp < 0)  return [...base, "Heavy winter coat & thermals", "Waterproof boots", "Hat, gloves & scarf"];
  if (temp < 10) return [...base, "Warm jacket + sweaters", "Comfortable waterproof shoes"];
  if (temp < 20) return [...base, "Light jacket for evenings", "Comfortable walking shoes"];
  if (temp < 30) return [...base, "Light breathable clothing", "Sunscreen SPF 50+"];
  return [...base, "Very light clothing", "Sunscreen SPF 50+ & sun hat", "Insect repellent", "Rehydration salts"];
}
