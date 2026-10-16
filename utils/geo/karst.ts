/* ------------------------------------------------------------------ */
/*  Karst — USGS OFR 2014-1156 (Weary & Doctor), baked by              */
/*  scripts/atlas/build-karst.mjs into public/atlas/karst.json.        */
/* ------------------------------------------------------------------ */

export const KARST_URL = "/atlas/karst.json";
export const KARST_SERVICE = "https://services5.arcgis.com/njRHYVhl2CMXMsap/arcgis/rest/services/CONUS_Karst/FeatureServer";

export type KarstClass = "carbonate" | "evaporite" | "sandstone" | "volcanic" | "piping";

export const KARST_CLASSES: { key: KarstClass; label: string; short: string; color: string; layer: number; blurb: string }[] = [
  {
    key: "carbonate",
    label: "Carbonate karst",
    short: "Limestone · dolomite · marble",
    color: "#22d3ee",
    layer: 1,
    blurb: "Rock that slightly acidic groundwater slowly dissolves. Almost every big cave in the U.S. — Mammoth, Carlsbad, Wind, Jewel — is in carbonate rock.",
  },
  {
    key: "evaporite",
    label: "Evaporite karst",
    short: "Gypsum · salt",
    color: "#e879f9",
    layer: 3,
    blurb: "Gypsum and salt left by ancient evaporating seas. They dissolve far faster than limestone, so sinkholes can open in human lifetimes.",
  },
  {
    key: "volcanic",
    label: "Lava-tube pseudokarst",
    short: "Basalt lava flows",
    color: "#fb923c",
    layer: 7,
    blurb: "Not dissolved at all: flowing lava crusted over while molten rock kept draining underneath, leaving tunnels — lava tubes.",
  },
  {
    key: "piping",
    label: "Piping pseudokarst",
    short: "Soft sediments",
    color: "#a78bfa",
    layer: 5,
    blurb: "Loose sediments where water can wash out underground pipes and small caves that mimic true karst.",
  },
  {
    key: "sandstone",
    label: "Sandstone karst",
    short: "Quartz sandstone",
    color: "#facc15",
    layer: 6,
    blurb: "Rare quartz sandstone with solution features.",
  },
];

export const karstClass = (k: string) => KARST_CLASSES.find((c) => c.key === k) ?? KARST_CLASSES[0];

export interface KarstStats {
  km2: Record<string, number>;
  totalKm2: number;
  conusKm2: number;
  share: number;
}

/** One map unit from the full-detail service (fetched on click). */
export interface KarstUnit {
  karstType: string;
  unitName: string | null;
  unitAge: string | null;
  rocks: string[];
  state: string | null;
  ecoregion: string | null;
  url: string | null;
}

const clean = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s && s !== " " ? s : null;
};

/** The rock unit under a point, from the class's full-detail layer. */
export async function karstUnitAt(cls: KarstClass, lng: number, lat: number, signal?: AbortSignal): Promise<KarstUnit | null> {
  const layer = karstClass(cls).layer;
  const q = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    // the dissolved map is ~1 km generalized, so search a little around the click
    distance: "1500",
    units: "esriSRUnit_Meter",
    outFields: "KARST_TYPE,UNIT_NAME,UNIT_AGE,ROCKTYPE1,ROCKTYPE2,ROCKTYPE3,State,NA_L3NAME,URL",
    returnGeometry: "false",
    resultRecordCount: "1",
    f: "json",
  });
  const res = await fetch(`${KARST_SERVICE}/${layer}/query?${q}`, { signal });
  if (!res.ok) throw new Error(`USGS karst map: HTTP ${res.status}`);
  const a = (await res.json()).features?.[0]?.attributes;
  if (!a) return null;
  return {
    karstType: String(a.KARST_TYPE ?? "").replace(/=50/g, "≤50"),
    unitName: clean(a.UNIT_NAME),
    unitAge: clean(a.UNIT_AGE),
    rocks: [a.ROCKTYPE1, a.ROCKTYPE2].map(clean).filter((x): x is string => !!x).flatMap((s) => s.split(/;\s*/)).slice(0, 6),
    state: clean(a.State),
    ecoregion: clean(a.NA_L3NAME),
    url: clean(a.URL)?.replace(/^http:/, "https:") ?? null,
  };
}
