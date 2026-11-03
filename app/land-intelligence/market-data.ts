import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { fetchFredSeries, type RatePoint } from "@/utils/fred";
import { getJson } from "./zoning-lookup";
import { acsProfile, permitSummary, quarterlyChange, tractChange, type AcsProfile, type AcsRaw, type HpiChange, type PermitSummary } from "./market";

type Bundle = { counties: Record<string, { acs: AcsRaw; permits?: { year: number; units: number; single: number; twoToFour: number; fivePlus: number; value: number }[] }>; tracts: Record<string, { acs: AcsRaw; hpi?: { first: number; values: (number | null)[] } }> };
type Quarterly = { name: string; last: string; index: (number | null)[]; se?: (number | null)[] };
type National = { us: { acs: AcsRaw }; states: Record<string, { acs: AcsRaw; hpi?: Quarterly }>; metros: Record<string, Quarterly> };
type Manifest = { builtAt: string; acsYear: number; tractHpiThrough: number; sources: { id: string; url: string; vintage: string }[] };
export type Geography = { state: { fips: string; name: string }; county: { fips: string; name: string } | null; tract: { fips: string; name: string } | null; metro: { cbsa: string; name: string; division?: { code: string; name: string } } | null; zcta: string };
export type FmrRents = { year: string; areaName: string; smallArea: boolean; zip?: string; rents: { bedrooms: number; rent: number }[] };
export type MarketContext = {
  geography: Geography;
  acs: { tract: AcsProfile | null; county: AcsProfile | null; state: AcsProfile | null; us: AcsProfile | null; vintage: string };
  hpi: { tract: HpiChange | null; metro: (HpiChange & { name: string }) | null; state: HpiChange | null };
  permits: PermitSummary | null;
  rates: { thirtyYear: RatePoint | null; fifteenYear: RatePoint | null; status: "ready" | "unavailable" };
  fmr: { status: "ready"; data: FmrRents } | { status: "unavailable" | "not_configured"; reason: string };
  sources: { label: string; url: string; vintage: string }[]; builtAt: string;
};

const directory = () => join(process.cwd(), "data", "land-intelligence", "market");
const memo = new Map<string, unknown>();
async function gz<T>(name: string): Promise<T> {
  if (memo.has(name)) return memo.get(name) as T;
  const value = JSON.parse(gunzipSync(await readFile(join(directory(), name))).toString("utf8")) as T;
  // National plus a handful of states per instance; the oldest state bundle is dropped first.
  if (memo.size >= 8) { const oldest = Array.from(memo.keys()).find((key) => key !== "national.json.gz"); if (oldest) memo.delete(oldest); }
  memo.set(name, value);
  return value;
}

/** Imported per-state bundle (counties and tracts), or null when the state has no market file (e.g. territories without ACS). */
export const loadStateBundle = (fips: string) => /^\d{2}$/.test(fips) ? gz<Bundle>(`state-${fips}.json.gz`).catch(() => null) : Promise.resolve(null);

const geoCache = new Map<string, { expires: number; value: Geography | null }>();
/** FIPS geography at a U.S. point from the Census geocoder (no key). Null outside the 50 states, DC and Puerto Rico. */
export async function geographyAt(lng: number, lat: number): Promise<Geography | null> {
  const key = `${lng.toFixed(4)},${lat.toFixed(4)}`;
  const cached = geoCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?${new URLSearchParams({ x: lng.toFixed(6), y: lat.toFixed(6), benchmark: "Public_AR_Current", vintage: "Current_Current", layers: "all", format: "json" })}`;
  const g = (await getJson(url, 12000)).result?.geographies ?? {};
  const first = (name: string) => (g[name]?.[0] ?? null) as { GEOID?: string; NAME?: string; CBSA?: string } | null;
  const state = first("States"), county = first("Counties"), tract = first("Census Tracts"), metro = first("Metropolitan Statistical Areas"), zcta = first("2020 Census ZIP Code Tabulation Areas");
  // Divided metros (New York, Miami, ...): the GEOID is CBSA + division code; FHFA publishes those by division.
  const division = first("Metropolitan Divisions");
  const value: Geography | null = state?.GEOID ? {
    state: { fips: state.GEOID, name: state.NAME ?? "" },
    county: county?.GEOID ? { fips: county.GEOID, name: county.NAME ?? "" } : null,
    tract: tract?.GEOID ? { fips: tract.GEOID, name: tract.NAME ?? "" } : null,
    metro: metro?.CBSA || metro?.GEOID ? { cbsa: String(metro.CBSA || metro.GEOID), name: metro.NAME ?? "", ...(division?.GEOID && /^\d{10}$/.test(division.GEOID) ? { division: { code: division.GEOID.slice(5), name: division.NAME ?? "" } } : {}) } : null,
    zcta: zcta?.GEOID ?? "",
  } : null;
  if (geoCache.size > 2000) geoCache.clear();
  geoCache.set(key, { expires: Date.now() + 7 * 86_400_000, value });
  return value;
}

const fmrCache = new Map<string, { expires: number; data: FmrRents }>();
const BEDROOMS = ["Efficiency", "One-Bedroom", "Two-Bedroom", "Three-Bedroom", "Four-Bedroom"];
/** HUD Fair Market Rents through the official HUD USER API (free token). Small Area FMR areas return ZIP rows; the parcel ZIP is used when listed. */
export async function hudFmr(countyFips: string, zcta: string): Promise<MarketContext["fmr"]> {
  const token = process.env.HUD_API_TOKEN?.trim();
  if (!token) return { status: "not_configured", reason: "HUD Fair Market Rents need a free HUD USER API token on this server (HUD_API_TOKEN)." };
  const cached = fmrCache.get(countyFips);
  if (cached && cached.expires > Date.now()) return { status: "ready", data: cached.data };
  try {
    const response = await fetch(`https://www.huduser.gov/hudapi/public/fmr/data/${countyFips}99999`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (!response.ok) throw new Error(`HUD ${response.status}`);
    const data = (await response.json())?.data;
    const rows = Array.isArray(data?.basicdata) ? data.basicdata : data?.basicdata ? [data.basicdata] : [];
    const row = rows.find((item: Record<string, unknown>) => String(item.zip_code ?? "") === zcta) ?? rows.find((item: Record<string, unknown>) => /msa level/i.test(String(item.zip_code ?? ""))) ?? rows[0];
    if (!row) throw new Error("No FMR rows");
    const rents = BEDROOMS.map((name, bedrooms) => ({ bedrooms, rent: Number(row[name]) })).filter((item) => Number.isFinite(item.rent) && item.rent > 0);
    const result: FmrRents = { year: String(data.year ?? ""), areaName: String(data.area_name ?? data.metro_name ?? data.county_name ?? ""), smallArea: String(data.smallarea_status ?? "0") === "1", ...(row.zip_code && /^\d{5}$/.test(String(row.zip_code)) ? { zip: String(row.zip_code) } : {}), rents };
    fmrCache.set(countyFips, { expires: Date.now() + 86_400_000, data: result });
    return { status: "ready", data: result };
  } catch { return { status: "unavailable", reason: "HUD Fair Market Rents did not respond for this county." }; }
}

let rateCache: { expires: number; value: MarketContext["rates"] } | null = null;
async function rates(): Promise<MarketContext["rates"]> {
  if (rateCache && rateCache.expires > Date.now()) return rateCache.value;
  try {
    const [thirtyYear, fifteenYear] = await Promise.all([fetchFredSeries("MORTGAGE30US"), fetchFredSeries("MORTGAGE15US")]);
    rateCache = { expires: Date.now() + 6 * 3_600_000, value: { thirtyYear, fifteenYear, status: "ready" } };
    return rateCache.value;
  } catch { return { thirtyYear: null, fifteenYear: null, status: "unavailable" }; }
}

/** ACS profile of the tract at a point from the imported summary files (no API key). Null when no tract is found there. */
export async function tractAcsAt(lng: number, lat: number): Promise<{ name: string; fips: string; profile: AcsProfile | null; vintage: string } | null> {
  const geography = await geographyAt(lng, lat);
  if (!geography?.tract) return null;
  const [manifest, bundle] = await Promise.all([readFile(join(directory(), "manifest.json"), "utf8").then((raw) => JSON.parse(raw) as Manifest), gz<Bundle>(`state-${geography.state.fips}.json.gz`)]);
  return { name: `${geography.tract.name}, ${geography.county?.name ?? ""}, ${geography.state.name}`.replace(/, ,/, ","), fips: geography.tract.fips, profile: acsProfile(bundle.tracts[geography.tract.fips]?.acs), vintage: manifest.sources.find((source) => source.id === "acs-B25077")?.vintage ?? "" };
}

/** Everything known about the housing market at a point, from the imported federal files plus live FRED and HUD. Null when the point has no U.S. geography. */
export async function marketContext(lng: number, lat: number): Promise<MarketContext | null> {
  const geography = await geographyAt(lng, lat);
  if (!geography) return null;
  const [manifest, national] = await Promise.all([JSON.parse(await readFile(join(directory(), "manifest.json"), "utf8")) as Manifest, gz<National>("national.json.gz")]);
  const bundle = await gz<Bundle>(`state-${geography.state.fips}.json.gz`).catch(() => null);
  const county = geography.county ? bundle?.counties[geography.county.fips] : undefined;
  const tract = geography.tract ? bundle?.tracts[geography.tract.fips] : undefined;
  const metro = geography.metro ? national.metros[geography.metro.division?.code ?? ""] ?? national.metros[geography.metro.cbsa] : undefined;
  const countyAcs = acsProfile(county?.acs);
  const [rateData, fmr] = await Promise.all([rates(), geography.county ? hudFmr(geography.county.fips, geography.zcta) : Promise.resolve({ status: "unavailable" as const, reason: "No county at this point." })]);
  const vintage = (id: string) => manifest.sources.find((source) => source.id === id)?.vintage ?? "";
  return {
    geography,
    acs: { tract: acsProfile(tract?.acs), county: countyAcs, state: acsProfile(national.states[geography.state.fips]?.acs), us: acsProfile(national.us.acs), vintage: vintage("acs-B25077") },
    hpi: { tract: tractChange(tract?.hpi), metro: metro ? (() => { const change = quarterlyChange(metro); return change && { ...change, name: metro.name }; })() : null, state: quarterlyChange(national.states[geography.state.fips]?.hpi) },
    permits: permitSummary(county?.permits, countyAcs?.housingUnits.value ?? null),
    rates: rateData, fmr,
    sources: [
      { label: "U.S. Census Bureau, American Community Survey 5-year table-based summary files", url: "https://www.census.gov/programs-surveys/acs/data/summary-file.html", vintage: vintage("acs-B25077") },
      { label: "FHFA House Price Index, all-transactions (tract annual is developmental)", url: "https://www.fhfa.gov/data/hpi/datasets", vintage: `${vintage("fhfa-tract")}; metro/state ${vintage("fhfa-metro")}` },
      { label: "U.S. Census Bureau, Building Permits Survey (county annual)", url: "https://www.census.gov/construction/bps/", vintage: manifest.sources.filter((source) => source.id.startsWith("bps-")).map((source) => source.vintage.slice(0, 4)).join(", ") },
      { label: "Freddie Mac Primary Mortgage Market Survey via FRED", url: "https://fred.stlouisfed.org/series/MORTGAGE30US", vintage: rateData.thirtyYear?.date ?? "unavailable" },
      { label: "HUD Fair Market Rents (HUD USER API). This product uses the HUD User Data API but is not endorsed or certified by HUD User.", url: "https://www.huduser.gov/portal/datasets/fmr.html", vintage: fmr.status === "ready" ? `FY${fmr.data.year}` : "not connected" },
    ],
    builtAt: manifest.builtAt,
  };
}
