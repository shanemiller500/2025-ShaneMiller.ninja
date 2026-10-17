/* ------------------------------------------------------------------ */
/*  Sinkings through time — ships lost in the two world wars, from     */
/*  Wikipedia's monthly "List of shipwrecks" articles (CC BY-SA 4.0),  */
/*  baked by scripts/atlas/build-sinkings.mjs. Only entries the lists  */
/*  give a position for can be mapped; `months` says how many that is. */
/* ------------------------------------------------------------------ */

export const SINKINGS_URL = "/atlas/sinkings.json";

export type CauseKey = "submarine" | "mine" | "aircraft" | "warship" | "scuttled" | "weather" | "grounding" | "collision" | "fire" | "other";

/** Read from each entry's text by keyword — a guide, not a verdict. */
export const CAUSES: { key: CauseKey; label: string; color: string; blurb: string }[] = [
  { key: "submarine", label: "Submarine", color: "#f43f5e", blurb: "Torpedoed, or sunk by a submarine." },
  { key: "mine", label: "Mine", color: "#f59e0b", blurb: "Struck a mine." },
  { key: "aircraft", label: "Aircraft", color: "#a78bfa", blurb: "Bombed or torpedoed from the air." },
  { key: "warship", label: "Gunfire & warships", color: "#38bdf8", blurb: "Shelled, depth-charged, rammed or sunk in a naval action." },
  { key: "scuttled", label: "Scuttled", color: "#94a3b8", blurb: "Sunk deliberately by her own crew or captors." },
  { key: "weather", label: "Weather & ice", color: "#22d3ee", blurb: "Storms, gales, ice — or foundered." },
  { key: "grounding", label: "Ran aground", color: "#a3e635", blurb: "Wrecked on rocks, reefs or shore." },
  { key: "collision", label: "Collision", color: "#fb923c", blurb: "Collided with another ship." },
  { key: "fire", label: "Fire & explosion", color: "#ef4444", blurb: "Caught fire or exploded." },
  { key: "other", label: "Other / unstated", color: "#64748b", blurb: "The entry doesn't say clearly how she was lost." },
];
export const causeOf = (k: string) => CAUSES.find((c) => c.key === k) ?? CAUSES[CAUSES.length - 1];

export type EraKey = "ww1" | "ww2";
/** The wars' dates; the lists' peacetime entries outside them stay off the replay. */
export const ERAS: Record<EraKey, { label: string; short: string; start: number; end: number }> = {
  ww1: { label: "World War I", short: "1914–18", start: Date.UTC(1914, 6, 28), end: Date.UTC(1918, 10, 11, 23) },
  ww2: { label: "World War II", short: "1939–45", start: Date.UTC(1939, 8, 1), end: Date.UTC(1945, 8, 2, 23) },
};

export interface SinkingCols {
  /** days since 1900-01-01 (UTC) */
  day: number[];
  lng: number[];
  lat: number[];
  cause: number[];
  lost: (number | null)[];
  ship: string[];
  flag: (string | null)[];
  desc: string[];
  page: number[];
}
export interface SinkingsFile {
  generated: string;
  causes: CauseKey[];
  pages: string[];
  /** "1917-04": [entries listed that month, entries with a position] */
  months: Record<string, [number, number]>;
  cols: SinkingCols;
}

const DAY0 = Date.UTC(1900, 0, 1);
export const dayToMs = (d: number) => DAY0 + d * 86_400_000;
export const monthKey = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
export const fmtDay = (t: number) => new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
export const fmtMonth = (t: number) => new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" });

/** Rows inside an era, oldest first (the file is already sorted by day). */
export function eraRows(f: SinkingsFile, era: EraKey): number[] {
  const { start, end } = ERAS[era];
  const out: number[] = [];
  const c = f.cols;
  for (let i = 0; i < c.day.length; i++) {
    const t = dayToMs(c.day[i]);
    if (t >= start && t <= end) out.push(i);
  }
  return out;
}

/** GeoJSON for the map — `t` drives the time filter, the rest the drawer. */
export function sinkingFeatures(f: SinkingsFile, rows: number[], causes: Set<string>): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const c = f.cols;
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const i of rows) {
    const cause = f.causes[c.cause[i]] ?? "other";
    if (!causes.has(cause)) continue;
    features.push({
      type: "Feature",
      id: i,
      geometry: { type: "Point", coordinates: [c.lng[i], c.lat[i]] },
      properties: { i, t: dayToMs(c.day[i]), cause, lost: c.lost[i], ship: c.ship[i], flag: c.flag[i], desc: c.desc[i], page: f.pages[c.page[i]] ?? null },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Running totals up to the cursor: ships mapped, lives stated, and by cause. */
export function tally(f: SinkingsFile, rows: number[], causes: Set<string>, cursor: number) {
  const c = f.cols;
  const byCause: Record<string, number> = {};
  let ships = 0;
  let lives = 0;
  const recent: number[] = [];
  for (const i of rows) {
    const t = dayToMs(c.day[i]);
    if (t > cursor) break;
    const cause = f.causes[c.cause[i]] ?? "other";
    byCause[cause] = (byCause[cause] ?? 0) + 1;
    if (!causes.has(cause)) continue;
    ships++;
    lives += c.lost[i] ?? 0;
    recent.push(i);
    if (recent.length > 4) recent.shift();
  }
  return { ships, lives, byCause, recent: recent.reverse() };
}

/** Listed vs mapped for the cursor's month — how much of the record the map can show. */
export function coverage(f: SinkingsFile, cursor: number) {
  const m = f.months[monthKey(cursor)];
  return m ? { listed: m[0], mapped: m[1] } : null;
}

/** The Wikipedia article (and day section) an entry came from. */
export function sourceUrl(page: string | null, t: number) {
  if (!page) return null;
  const d = new Date(t);
  const anchor = `${d.getUTCDate()}_${d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })}`;
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(page.replace(/ /g, "_"))}#${anchor}`;
}
