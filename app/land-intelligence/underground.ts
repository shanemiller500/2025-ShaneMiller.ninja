// Underground and mining sources shared by the parcel inspection, the Underground map layer and its legend. Client-safe.
import { USMIN_KINDS } from "@/utils/geo/mines";

/** Colorado DRMS Mine Subsidence Protection Program: statewide mapped undermined areas with a 100 ft buffer (2023, public). */
export const DRMS_UNDERMINED = "https://services7.arcgis.com/ZZPO1K5xRbz1PSYQ/arcgis/rest/services/Undermined_Areas_Statewide_100ft_buffer_2023/FeatureServer/0";
/** Colorado Geological Survey field inventory of abandoned mine openings on national forest land (1991–1999). No pagination support. */
export const CGS_AML_OPENINGS = "https://cgsarcimage.mines.edu/arcgis/rest/services/Hazards/Hazards_Viewer/MapServer/28";

/** "Strathmore 1919, Cambro 1928, Canon 1890" → distinct trimmed names, years kept. */
export const mineNames = (raw: unknown) => Array.from(new Set(String(raw ?? "").split(/[,;]/).map((name) => name.trim()).filter((name) => name && name !== "-")));

/** CGS hazard ratings, from least to most severe. */
export const AML_HAZARDS = ["no significant hazard", "potential danger", "dangerous", "extreme danger"] as const;
export const amlHazard = (raw: unknown) => { const text = String(raw ?? "").trim().toLowerCase(); return text && text !== "not available" ? `CGS hazard rating: ${text}` : ""; };
export const amlHazardLevel = (raw: unknown) => AML_HAZARDS.indexOf(String(raw ?? "").trim().toLowerCase() as (typeof AML_HAZARDS)[number]);

/** Map key for the Underground layer: undermined areas (hatched), USMIN symbols by kind, and inventoried openings. */
export const UNDERGROUND_KEY = {
  undermined: { label: "Undermined area (mapped workings + 100 ft)", color: "#a855f7" },
  kinds: USMIN_KINDS.map(({ key, label, color }) => ({ key, label, color })),
  opening: { label: "Inventoried mine opening (CGS, forest land)", color: "#facc15" },
};
