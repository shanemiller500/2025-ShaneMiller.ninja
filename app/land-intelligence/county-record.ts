// The county's own GIS parcel record at a point, read through an AI-built field map.
// The AI only names which attribute holds each fact; every value is read from the official record itself.
import { askOpenAIJson } from "./ai";
import { PARCEL_SOURCES } from "./parcel-sources";
import { parseFillValue, type FillKey, type FilledValue } from "./property-fill";
import { isOfficial } from "./zoning-code";
import { getJson } from "./zoning-lookup";

const CATALOG = "https://www.arcgis.com/sharing/rest/search";
const SERVICE_URL = /^https?:\/\/[^\s?#]+\/(Feature|Map)Server(\/\d+)?$/i;
const PARCEL_NAME = /parcel|cadastr|propert|tax\s*map|land\s*record/i;
const NOT_PARCEL = /centroid|point|label|annotation|historic|zoning|flood|easement|lot\s*line|dimension|buffer|notification|sold|for\s*sale/i;
// Only layers a government body publishes; personal copies on ArcGIS Online can be stale or edited.
const GOVERNMENT_OWNER = /gov|county|cnty|city|town|village|state|gis|admin|assessor|appraiser|auditor|treasurer|clerk|bcc|planning/i;
// Owner, mailing and contact fields never leave the server.
// Includes taxpayer-of-record prefixes (King County's KCTP_ADDR is the taxpayer's mailing address).
const PERSONAL_FIELD = /own|mail|name|dba|ico$|careof|care_of|attn|phone|email|grantor|grantee|buyer|seller|taxpayer|taxp|kctp|tp_|contact/i;
const STATEWIDE = new Set(PARCEL_SOURCES.map((source) => source.url.replace(/\/\d+$/, "").toLowerCase()));

export type CountyLayer = { url: string; name: string; fields: { name: string; alias: string }[] };
export type CountyRecord = { layer: CountyLayer; attributes: Record<string, unknown> };
export type FieldMap = Partial<Record<FillKey, string>>;

const layerCache = new Map<string, { expires: number; layers: CountyLayer[] }>();
const winners = new Map<string, string>();
// Same county layer, same field map: after the first parcel in a county no AI call is needed.
const fieldMaps = new Map<string, FieldMap>();
function remember<T>(map: Map<string, T>, key: string, value: T) {
  if (map.size >= 300) map.delete(map.keys().next().value!);
  map.set(key, value);
}

async function layerMeta(url: string, fallbackName: string): Promise<CountyLayer | null> {
  try {
    const meta = await getJson(`${url}?f=json`, 6000);
    if (meta.geometryType && !/polygon/i.test(String(meta.geometryType))) return null;
    const fields = (Array.isArray(meta.fields) ? meta.fields : []).map((field: { name?: unknown; alias?: unknown }) => ({ name: String(field.name ?? ""), alias: String(field.alias ?? "") })).filter((field: { name: string }) => field.name);
    return fields.length >= 5 ? { url, name: String(meta.name || fallbackName), fields } : null;
  } catch { return null; }
}

/** Government-published parcel layers for a county, found through the ArcGIS Online catalog. */
async function discoverLayers(county: string, state: string): Promise<CountyLayer[]> {
  const countyName = county.replace(/\s+county$/i, "");
  const type = '(type:"Feature Service" OR type:"Map Service")';
  const searches = await Promise.all([`"${countyName} County" ${state} parcels ${type}`, `"${countyName}" ${state} parcel ${type}`].map(async (q) => {
    try { return (await getJson(`${CATALOG}?${new URLSearchParams({ f: "json", q, num: "15", sortField: "numViews", sortOrder: "desc" })}`, 8000)).results ?? []; } catch { return []; }
  }));
  const seen = new Set<string>();
  const items = searches.flat().map((item: Record<string, unknown>) => ({ title: String(item.title ?? ""), owner: String(item.owner ?? ""), url: String(item.url ?? "").trim().replace(/\/+$/, "") }))
    .filter((item) => SERVICE_URL.test(item.url) && !STATEWIDE.has(item.url.replace(/\/\d+$/, "").toLowerCase()) && !NOT_PARCEL.test(item.title)
      && (isOfficial(item.url) || GOVERNMENT_OWNER.test(item.owner)) && !seen.has(item.url) && seen.add(item.url))
    // Titles that say parcel first; the county's own name next.
    .sort((a, b) => Number(PARCEL_NAME.test(b.title)) - Number(PARCEL_NAME.test(a.title)) || Number(b.title.toLowerCase().includes(countyName.toLowerCase())) - Number(a.title.toLowerCase().includes(countyName.toLowerCase())))
    .slice(0, 6);
  const layers = await Promise.all(items.map(async (item): Promise<CountyLayer[]> => {
    if (/\/\d+$/.test(item.url)) { const layer = await layerMeta(item.url, item.title); return layer ? [layer] : []; }
    try {
      const meta = await getJson(`${item.url}?f=json`, 6000);
      const picks = (meta.layers ?? []).filter((layer: { id?: unknown; name?: unknown }) => Number.isInteger(layer.id) && PARCEL_NAME.test(String(layer.name ?? "")) && !NOT_PARCEL.test(String(layer.name ?? ""))).slice(0, 2);
      return (await Promise.all(picks.map((layer: { id: number; name: string }) => layerMeta(`${item.url}/${layer.id}`, `${item.title} · ${layer.name}`)))).filter((layer): layer is CountyLayer => Boolean(layer));
    } catch { return []; }
  }));
  return layers.flat().slice(0, 8);
}

const compact = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** The county parcel feature that contains the point and names the selected parcel ID. */
export async function findCountyRecord({ lng, lat, county, state, parcelId, address }: { lng: number; lat: number; county: string; state: string; parcelId: string; address: string }): Promise<CountyRecord | null> {
  const key = `${county}|${state}`.toLowerCase();
  const cached = layerCache.get(key);
  const layers = cached && cached.expires > Date.now() ? cached.layers : await discoverLayers(county, state);
  if (!cached || cached.expires <= Date.now()) remember(layerCache, key, { expires: Date.now() + 24 * 60 * 60 * 1000, layers });
  const winner = winners.get(key);
  const ordered = [...layers].sort((a, b) => Number(b.url === winner) - Number(a.url === winner));
  // The tapped point first; then a few metres around it, so a tap on the edge or an address point in the street still reaches the parcel.
  const near = async (bufferMeters: number) => (await Promise.all(ordered.map(async (layer) => {
    const params = new URLSearchParams({ geometry: `${lng},${lat}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "*", returnGeometry: "false", f: "json", ...(bufferMeters ? { distance: String(bufferMeters), units: "esriSRUnit_Meter" } : {}) });
    try { return ((await getJson(`${layer.url}/query?${params}`, 7000)).features ?? []).slice(0, 40).map((feature: { attributes?: Record<string, unknown> }) => ({ layer, attributes: feature.attributes ?? {} })); } catch { return []; }
  }))).flat() as CountyRecord[];
  // An address can be shared or stale, so it only breaks ties between matching parcel IDs.
  const id = compact(parcelId), idDigits = parcelId.replace(/\D/g, ""), street = compact(address.split(",")[0]);
  const [houseNumber, streetName] = address.split(",")[0].trim().split(/\s+/).filter((part) => !/^[NSEW]$/i.test(part)).map(compact);
  const score = ({ attributes }: CountyRecord) => {
    const values = Object.values(attributes).map(compact);
    // Feeds and counties format IDs differently ("033-8823900910" vs "8823900910"): equal, or one ends with the other (8+ digits).
    const sameId = Object.entries(attributes).some(([field, value]) => {
      if (!/(?:^|_)(?:parcel|folio|apn|pin|account|tax.?id|parno|property.?id)(?:_|$)/i.test(field) && !/^(?:parcel|folio|apn|pin|account|taxid|parno|propertyid)/i.test(field)) return false;
      if (id.length >= 4 && compact(value) === id) return true;
      const digits = String(value ?? "").replace(/\D/g, "");
      return digits.length >= 8 && idDigits.length >= 8 && (digits === idDigits || idDigits.endsWith(digits) || digits.endsWith(idDigits)) && String(value).replace(/[\d\s-]/g, "").length <= 2;
    });
    // Whole address in one field, or house number and street name in separate fields.
    const sameAddress = (street.length > 6 && values.includes(street)) || (!!houseNumber && /^\d+$/.test(houseNumber) && !!streetName && values.includes(houseNumber) && values.some((value) => value === streetName || value.startsWith(streetName)));
    const match = sameId ? 4 + (sameAddress ? 2 : 0) : 0;
    return match && match + Object.values(attributes).filter((value) => value != null && value !== "" && value !== 0).length / 1000;
  };
  const pick = (records: CountyRecord[]) => records.map((record) => ({ record, score: score(record) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score)[0]?.record ?? null;
  const best = pick(await near(0)) ?? pick(await near(12));
  if (best) remember(winners, key, best.layer.url);
  return best;
}

const HINTS: Record<FillKey, string> = {
  landUse: "land use or property class description in words (not a numeric code)", ownerType: "",
  lastSaleDate: "date of the most recent sale or deed", lastSalePrice: "price of the most recent sale",
  yearBuilt: "year the main building was built", livingAreaSqft: "finished living or gross building area in square feet",
  bedrooms: "number of bedrooms", bathrooms: "number of bathrooms", buildingCount: "number of buildings",
  deedAcres: "legal, deeded or total acreage", legalDescription: "full legal description text",
  assessedTotal: "total assessed value", assessedLand: "assessed land value", assessedImprovements: "assessed improvement or building value",
  taxableValue: "taxable value", estimatedMarketValue: "market, actual, appraised or just value (total)", annualPropertyTax: "annual property tax bill amount",
};
// Owner type is a judgement about a name, which this path never sees.
const MAPPABLE = (Object.keys(HINTS) as FillKey[]).filter((key) => HINTS[key]);

// Naming conventions strong enough to match without AI: [must match, must not match], on the field name with separators removed.
const NOT_CURRENT = "PYR|PRIOR|PREV|EXEMPT|EXMPT";
const FIELD_PATTERNS: Partial<Record<FillKey, [RegExp, RegExp]>> = {
  assessedTotal: [/(ASD|ASSD|ASSESS|ASMT).*(TOT)|(TOT).*(ASD|ASSD|ASSESS)/, new RegExp(`LND|LAND|IMP|BLDG|PRS|PERS|${NOT_CURRENT}`)],
  assessedLand: [/(ASD|ASSD|ASSESS|ASMT).*(LND|LAND)|(LND|LAND).*(ASD|ASSD|ASSESS)/, new RegExp(NOT_CURRENT)],
  assessedImprovements: [/(ASD|ASSD|ASSESS|ASMT).*(IMP|BLDG)|(IMP|BLDG).*(ASD|ASSD|ASSESS)/, new RegExp(NOT_CURRENT)],
  estimatedMarketValue: [/(ACT|MKT|MARKET|JUST|APPR|FMV|JV).*(TOT|VAL)|(TOT).*(ACT|MKT|MARKET|JUST|APPR)/, new RegExp(`LND|LAND|IMP|BLDG|ASD|ASSD|ASSESS|TXBL|TAXABLE|${NOT_CURRENT}`)],
  taxableValue: [/TXBL|TAXABLE|TAXVAL/, new RegExp(NOT_CURRENT)],
  yearBuilt: [/YRBLT|YEARBUILT|YRBUILT|YEARBLT|ACTYRBLT/, /EFF|REMOD/],
  lastSalePrice: [/SALEPRICE|SALEPRC|SALEAMT|SLSAMT|SALESPRICE|SALEPRIC/, new RegExp(NOT_CURRENT)],
  lastSaleDate: [/SALEDATE|SALEDT|SLSDT|SALESDATE|DEEDDATE/, new RegExp(NOT_CURRENT)],
};

/** Fields matched by naming convention, each holding a plausible value for this parcel. Unnumbered or "1" fields win (primary building, latest sale). */
export function patternFieldMap(record: CountyRecord): FieldMap {
  const map: FieldMap = {};
  for (const [key, [match, reject]] of Object.entries(FIELD_PATTERNS) as [FillKey, [RegExp, RegExp]][]) {
    const rank = (name: string) => (/\d$/.test(name) ? (/1$/.test(name) ? 1 : 2) : 0) * 100 + name.length;
    const candidates = record.layer.fields.map((field) => field.name).filter((name) => {
      const flat = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const raw = record.attributes[name];
      const usable = raw != null && raw !== "" && (key === "lastSaleDate" ? recordDate(raw) != null : parseFillValue(key, String(raw).trim()) != null);
      return match.test(flat) && !reject.test(flat) && !PERSONAL_FIELD.test(name) && usable;
    }).sort((a, b) => rank(a) - rank(b));
    if (candidates[0]) map[key] = candidates[0];
  }
  return map;
}

/**
 * Which attribute holds each fact, decided once per layer: naming conventions first, then the AI from field names,
 * aliases and this record's sample values for whatever conventions didn't settle.
 */
export async function fieldMapFor(record: CountyRecord): Promise<FieldMap> {
  const cached = fieldMaps.get(record.layer.url);
  if (cached) return cached;
  const byPattern = patternFieldMap(record);
  const fields = record.layer.fields.filter((field) => !PERSONAL_FIELD.test(field.name) && !PERSONAL_FIELD.test(field.alias)).slice(0, 250)
    .map((field) => { const sample = record.attributes[field.name]; return `${field.name}${field.alias && field.alias !== field.name ? ` (${field.alias})` : ""}${sample == null || sample === "" ? "" : ` = ${String(sample).slice(0, 40)}`}`; });
  const raw = await askOpenAIJson({
    system: [
      "You map the fields of one county's parcel GIS layer to standard property facts. For each target return the exact field name that holds that fact for this parcel's primary building and most recent sale, or an empty string if no field clearly holds it.",
      "Judge by field names, aliases and the sample values shown (they belong to one real parcel). A wrong field is worse than none: floors are not bathrooms, units are not buildings, a recording number or legal range is not a description, and assessed value is distinct from actual or market value.",
      "Common assessor abbreviations: ASD/ASSD/ASMT = assessed; ACT/ACTUAL/MKT/JUST/APPR/FMV = market or actual value; TXBL = taxable; PYR/PRIOR/PREV = prior year (avoid); LND = land; IMP/IMPR/BLDG = improvements; BIL/BILL/TAX = tax bill; SLS/SALE/DEED = sale; DT = date; AMT = amount; YRBLT = year built; STT/STRC = structure; GRS/LVG/HTD/FIN AREA = building area; RCP/REC/DOC/BOOK/PAGE = recording number; RNG/TWN/SEC/QTR = township grid, not a legal description; a trailing 2, 3, 4 = a secondary building or older sale.",
      "Return field names exactly as listed.",
    ].join(" "),
    user: JSON.stringify({ layer: record.layer.name, targets: Object.fromEntries(MAPPABLE.map((key) => [key, HINTS[key]])), fields }),
    schemaName: "field_map", schema: { type: "object", additionalProperties: false, required: MAPPABLE, properties: Object.fromEntries(MAPPABLE.map((key) => [key, { type: "string" }])) },
    webSearch: false, deterministic: true, maxTokens: 600, timeoutMs: 30000,
  });
  const map = { ...checkFieldMap(raw, record.layer.fields.map((field) => field.name)), ...byPattern };
  remember(fieldMaps, record.layer.url, map);
  return map;
}

// Field names that can't hold a fact, whatever the model says (matched against the field name).
const ASSESSED = /ASD|ASSD|ASSESS|ASMT/i;
const NOT_FOR: Partial<Record<FillKey, RegExp>> = {
  // Totals never come from a land-only or improvements-only field.
  assessedTotal: /ACT|MKT|MARKET|JUST|APPR|FMV|PYR|PRIOR|PREV|LND|LAND|IMP|BLDG/i, assessedLand: /ACT|MKT|MARKET|JUST|APPR|FMV|PYR|PRIOR|PREV/i, assessedImprovements: /ACT|MKT|MARKET|JUST|APPR|FMV|PYR|PRIOR|PREV/i,
  estimatedMarketValue: /ASD|ASSD|ASSESS|ASMT|TXBL|TAXABLE|PYR|PRIOR|PREV|LND|LAND|IMP|BLDG/i, taxableValue: /PYR|PRIOR|PREV|ACT|MKT|MARKET|JUST|LND|LAND|IMP|BLDG/i,
  legalDescription: /RCP|REC|DOC|BOOK|PAGE|NUM|NBR|KEY|RNG|TWN|SEC|QTR|LOT|BLK/i,
  livingAreaSqft: /LOT|LAND|LND|PARCEL|ACRE|SITE|SHAPE|GIS/i,
  bathrooms: /FLR|FLOOR|STOR|UNIT|BED/i, bedrooms: /FLR|FLOOR|STOR|UNIT|BATH/i, buildingCount: /UNIT|FLR|FLOOR|STOR/i,
  annualPropertyTax: /PYR|PRIOR|PREV|RATE|LEVY|MILL/i, lastSalePrice: /PYR|PRIOR|PREV/i,
};

/** The model's field map, minus unknown, personal or contradictory fields; a numbered duplicate yields to its primary field. */
export function checkFieldMap(raw: Record<string, unknown>, fieldNames: string[]): FieldMap {
  const names = new Set(fieldNames);
  const map: FieldMap = {};
  for (const key of MAPPABLE) {
    let name = String(raw[key] ?? "");
    const primary = name.replace(/_?\d+$/, "");
    if (primary !== name && names.has(primary)) name = primary;
    const ruledOut = NOT_FOR[key]?.test(name) && !(/^assessed/.test(key) && ASSESSED.test(name) && !/PYR|PRIOR|PREV/i.test(name));
    if (names.has(name) && !PERSONAL_FIELD.test(name) && !ruledOut) map[key] = name;
  }
  return map;
}

/** A date from the forms county GIS uses: epoch milliseconds, YYYYMMDD, MMDDYYYY, ISO or M/D/YYYY. */
export function recordDate(raw: unknown): string | null {
  const iso = (y: number, m: number, d: number) => y >= 1800 && y <= new Date().getFullYear() + 1 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
  if (typeof raw === "number") { if (raw < 1e11) return null; const date = new Date(raw); return Number.isFinite(date.getTime()) ? iso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()) : null; }
  const text = String(raw ?? "").trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return iso(+match[1], +match[2], +match[3]);
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) return iso(+match[3], +match[1], +match[2]);
  if (/^\d{8}$/.test(text)) return +text.slice(0, 4) >= 1800 ? iso(+text.slice(0, 4), +text.slice(4, 6), +text.slice(6, 8)) : iso(+text.slice(4), +text.slice(0, 2), +text.slice(2, 4));
  return null;
}

/** Values for the wanted facts, read straight from the record through the field map. */
export function readRecord(record: CountyRecord, map: FieldMap, wanted: FillKey[]): Partial<Record<FillKey, FilledValue>> {
  const fields: Partial<Record<FillKey, FilledValue>> = {};
  for (const key of wanted) {
    const name = map[key];
    const raw = name ? record.attributes[name] : undefined;
    if (raw == null || raw === "") continue;
    const value = key === "lastSaleDate" ? recordDate(raw) : parseFillValue(key, String(raw).trim());
    // A legal description is words, not a document or reference number.
    if (key === "legalDescription" && !(typeof value === "string" && /[a-z]{2}/i.test(value) && value.includes(" "))) continue;
    if (value != null && !(key === "lastSalePrice" && value === 0)) fields[key] = { value, sourceUrl: record.layer.url, official: true, via: "county", field: name };
  }
  // Total, land and improvements read together must add up, or the mapping mixed value types; drop all three.
  const [total, land, improvements] = [fields.assessedTotal?.value, fields.assessedLand?.value, fields.assessedImprovements?.value];
  if (typeof total === "number" && typeof land === "number" && typeof improvements === "number" && Math.abs(total - land - improvements) > Math.max(2, total * 0.02)) {
    delete fields.assessedTotal; delete fields.assessedLand; delete fields.assessedImprovements;
  }
  return fields;
}
