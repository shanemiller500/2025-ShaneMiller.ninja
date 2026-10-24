export type Jurisdiction = {
  state: string; stateCode: string; county: string; city: string;
  incorporated: boolean; authority: string;
};
export type ZoningDistrict = { code: string; description: string; futureLandUse: string };
export type ZoningLookup = {
  status: "found" | "none" | "unavailable" | "outside";
  checkedAt: string;
  jurisdiction: Jurisdiction | null;
  district: ZoningDistrict | null;
  source: { name: string; layerUrl: string; method: "parcel" | "catalog" } | null;
  note: string;
};
export type CatalogItem = { title: string; url: string; owner: string; numViews: number };

// Ordered by trust. Bare ZONE / DISTRICT are left out so FLOOD_ZONE or a
// commission DISTRICT on the same layer can't be read as zoning.
const CODE_FIELDS = ["ZONING", "ZONING_CODE", "ZONINGCODE", "ZONE_CODE", "ZONECODE", "ZONECLASS", "ZONE_CLASS", "ZONE_TYPE", "ZONE_DIST", "ZONEDIST", "ZONING_DIST", "ZONE_DISTRICT", "ZONINGDISTRICT", "ZONE_ABBR", "ZONE"];
const DESCRIPTION_FIELDS = ["ZONEDESC", "ZONE_DESC", "ZONINGDESC", "ZONING_DESC", "ZONEDESCRIPTION", "ZONE_NAME", "ZONENAME", "ZONING_NAME", "DISTRICT_NAME", "ZONE_LABEL"];
const FLU_FIELDS = ["FLU", "FUTURE_LAND_USE", "FUTURELANDUSE", "FLUM", "FLU_CODE", "FLU_DESC", "FLUCODE"];
const FIELD_REJECT = /flood|wind|fire|evac|hazard|storm|surge|school|time|noise|police|opportunit|enterprise|hardiness|climate|census|traffic|speed|petition|case|date|link|url|overlay|ord|prev|old|propos|pending|id$/i;
const LAYER_REJECT = /rezon|histor|petition|case|buffer|propos|pending|application|flood|wind|fire|evac|hazard|storm|surge|school|time|noise|police|opportunit|enterprise|hardiness|climate|census|traffic|speed|overlay|parking|historic|annotation|label|text/i;
// County layers often mark incorporated land with a placeholder instead of a district.
const PLACEHOLDER = /^(city|incorporated|municipal(ity)?|town|village|see city|in city|n\/?a|none|null|unknown|other|0|\.|-+)$/i;

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska",
  NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
};

const clean = (raw: unknown) => {
  if (raw == null || typeof raw === "object") return "";
  const text = String(raw).replace(/\s+/g, " ").trim();
  return !text || PLACEHOLDER.test(text) || /^https?:\/\//i.test(text) ? "" : text;
};
// "R-1", "PUD", "CBD-CURE-DDB400" read as codes; "UPTOWN MIXED USE" or "RESIDENTIAL" read as names.
const looksLikeCode = (text: string) => text.length <= 24 && /^[A-Z0-9][A-Z0-9\-/.()+& ]*$/i.test(text) && text.split(" ").length <= 2 && (text.length <= 6 || /[\d\-/.]/.test(text));

/** Values from fields matching `names` (exact, case-insensitive) in that order, then any other field whose name passes `extra`. */
function values(attrs: Record<string, unknown>, names: string[], extra?: RegExp) {
  const keys = Object.keys(attrs);
  const out: string[] = [];
  const add = (key: string) => { const text = clean(attrs[key]); if (text && !out.includes(text)) out.push(text); };
  for (const name of names) for (const key of keys) if (key.toUpperCase() === name) add(key);
  if (extra) for (const key of keys) if (extra.test(key) && !FIELD_REJECT.test(key)) add(key);
  return out;
}

/** Pull a zoning district out of arbitrary county attributes, or null when none is trustworthy. */
export function zoningFromAttributes(attrs: Record<string, unknown> | null | undefined): ZoningDistrict | null {
  if (!attrs || typeof attrs !== "object") return null;
  const candidates = [...values(attrs, CODE_FIELDS, /zon/i), ...values(attrs, DESCRIPTION_FIELDS)];
  if (!candidates.length) return null;
  // Layers disagree on which field holds the short code and which the name
  // (Charlotte keeps "UC" in zonedes and "UPTOWN MIXED USE" in zoneclass).
  const code = candidates.find(looksLikeCode) ?? candidates[0];
  const description = [...values(attrs, DESCRIPTION_FIELDS), ...candidates].find((text) => text !== code && !looksLikeCode(text)) ?? "";
  return { code, description, futureLandUse: values(attrs, FLU_FIELDS)[0] ?? "" };
}

/**
 * County layers often cover incorporated land with a stand-in polygon named
 * after the city (Boulder County: ZONECLASS "XBO", ZONEDESC "Boulder"). That
 * says "ask the city", not which district applies.
 */
export function isMunicipalPlaceholder({ code, description }: ZoningDistrict, { city, county }: Jurisdiction) {
  const names = [city, county, county.replace(/\s+county$/i, "")].filter(Boolean).map((name) => name.toLowerCase());
  return [code, description].some((text) => names.includes(text.toLowerCase()) || /^(city|town|village) of\b/i.test(text) || /\b(incorporated|municipal(ity)?|city limits|annexed)\b/i.test(text));
}

/** State / county / incorporated place from a Census geographies/coordinates response. */
export function jurisdictionFromCensus(json: unknown): Jurisdiction | null {
  const geographies = (json as { result?: { geographies?: Record<string, Record<string, unknown>[]> } })?.result?.geographies;
  if (!geographies || typeof geographies !== "object") return null;
  const first = (name: string) => geographies[name]?.[0];
  const stateCode = clean(first("States")?.STUSAB).toUpperCase();
  const state = clean(first("States")?.NAME) || STATE_NAMES[stateCode] || "";
  const county = clean(first("Counties")?.NAME);
  if (!state || !county) return null;
  const city = clean(first("Incorporated Places")?.NAME).replace(/\s+(city|town|village|borough|municipality|city and borough|metropolitan government.*|consolidated government.*|unified government.*)$/i, "").trim();
  return { state, stateCode, county, city, incorporated: Boolean(city), authority: city ? `${city}, ${stateCode || state}` : `${county}, ${stateCode || state}` };
}

const TYPE_FILTER = '(type:"Feature Service" OR type:"Map Service")';
/** ArcGIS Online catalog searches, governing jurisdiction first. */
export function catalogQueries({ city, county, state, incorporated }: Jurisdiction) {
  const countyName = county.replace(/\s+county$/i, "");
  return [
    ...(incorporated ? [`"${city}" ${state} zoning ${TYPE_FILTER}`, `"City of ${city}" zoning ${TYPE_FILTER}`] : []),
    `"${countyName} County" ${state} zoning ${TYPE_FILTER}`,
  ];
}

/** A catalog item or layer name that reads as a base zoning-district layer. */
export const isZoningName = (name: string) => /zon(ing|e)/i.test(name) && !LAYER_REJECT.test(name);

/** Rank catalog items: zoning in the title, then the jurisdiction named, then a government-looking owner, then views. */
export function rankCatalog(items: CatalogItem[], { city, county }: Jurisdiction) {
  const places = [city, county.replace(/\s+county$/i, "")].filter(Boolean).map((place) => place.toLowerCase().replace(/\s+/g, ""));
  const score = (item: CatalogItem) => {
    const title = item.title.toLowerCase(), owner = item.owner.toLowerCase(), compact = `${title} ${owner}`.replace(/\s+/g, "");
    return [/\bzoning\b/.test(title) ? 1 : 0, places.some((place) => compact.includes(place)) ? 1 : 0, /gov|county|city|town|gis|state/.test(owner) ? 1 : 0, item.numViews];
  };
  return items.filter((item) => isZoningName(item.title)).map((item) => ({ item, score: score(item) }))
    .sort((a, b) => { for (let i = 0; i < a.score.length; i++) if (a.score[i] !== b.score[i]) return b.score[i] - a.score[i]; return 0; })
    .map(({ item }) => item);
}
