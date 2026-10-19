/* ------------------------------------------------------------------ */
/*  NOAA NCEI's historical hazard databases (public domain), baked by  */
/*  scripts/atlas/build-ncei.mjs:                                      */
/*  • the Significant Earthquake Database — 2150 BC to today, quakes   */
/*    with ~$1M+ damage, 10+ deaths, M7.5+, intensity X+ or a tsunami; */
/*  • the Global Historical Tsunami Database — definite and probable   */
/*    events only.                                                     */
/* ------------------------------------------------------------------ */

export const NCEI_QUAKES_URL = "/atlas/ncei-quakes.json";
export const NCEI_TSUNAMIS_URL = "/atlas/ncei-tsunamis.json";
export const nceiQuakeUrl = (id: number) => `https://www.ngdc.noaa.gov/hazel/view/hazards/earthquake/event-more-info/${id}`;
export const nceiTsunamiUrl = (id: number) => `https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-more-info/${id}`;

export interface NceiQuakes {
  amount: string[];
  cols: { id: number[]; date: string[]; place: string[]; country: string[]; lng: number[]; lat: number[]; mag: (number | null)[]; depth: (number | null)[]; deaths: (number | null)[]; deathsAmt: (number | null)[]; tsunami: (number | null)[] };
}
export interface NceiTsunamis {
  causes: string[];
  amount: string[];
  cols: { id: number[]; date: string[]; place: string[]; country: string[]; lng: number[]; lat: number[]; height: (number | null)[]; cause: number[]; validity: number[]; deaths: (number | null)[]; deathsAmt: (number | null)[]; mag: (number | null)[]; runups: number[] };
}

/** "26 Dec 2004", "Nov 1755", "2150 BC". */
export function fmtNceiDate(d: string): string {
  const m = /^(-?\d+)(?:-(\d\d))?(?:-(\d\d))?$/.exec(d);
  if (!m) return d;
  const y = Number(m[1]);
  const year = y < 0 ? `${-y} BC` : String(y);
  if (!m[2]) return year;
  const month = new Date(Date.UTC(2000, Number(m[2]) - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return m[3] ? `${Number(m[3])} ${month} ${year}` : `${month} ${year}`;
}

/** "227,898" or NOAA's range ("Many (101–1,000)") when the exact count isn't known; null when neither. */
export function deathsText(deaths: number | null, amt: number | null, amount: string[]): string | null {
  if (deaths != null) return deaths.toLocaleString("en-US");
  if (amt != null && amt > 0) return amount[amt] ?? null;
  return amt === 0 ? "None" : null;
}

/** A rank 0–4 for colouring: deaths when known, else NOAA's scale. */
export function deathRank(deaths: number | null, amt: number | null): number {
  if (deaths != null) return deaths >= 1001 ? 4 : deaths >= 101 ? 3 : deaths >= 51 ? 2 : deaths >= 1 ? 1 : 0;
  return amt != null && amt > 0 ? amt : 0;
}

export function nceiQuakeFeatures(q: NceiQuakes): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const c = q.cols;
  return {
    type: "FeatureCollection",
    features: c.id.map((id, i) => ({
      type: "Feature",
      id,
      geometry: { type: "Point", coordinates: [c.lng[i], c.lat[i]] },
      properties: { i, id, mag: c.mag[i] ?? 0, rank: deathRank(c.deaths[i], c.deathsAmt[i]), year: Number(c.date[i].split("-")[0] || c.date[i]), place: c.place[i] },
    })),
  };
}

export function nceiTsunamiFeatures(t: NceiTsunamis): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const c = t.cols;
  return {
    type: "FeatureCollection",
    features: c.id.map((id, i) => ({
      type: "Feature",
      id,
      geometry: { type: "Point", coordinates: [c.lng[i], c.lat[i]] },
      properties: { i, id, height: c.height[i] ?? 0, rank: deathRank(c.deaths[i], c.deathsAmt[i]), place: c.place[i], date: c.date[i] },
    })),
  };
}

/** Colours for the death rank (none → very many). */
export const DEATH_COLORS = ["#94a3b8", "#fcd34d", "#fb923c", "#f43f5e", "#a21caf"];
export const DEATH_LABELS = ["No deaths recorded", "1–50 deaths", "51–100", "101–1,000", "Over 1,000"];
