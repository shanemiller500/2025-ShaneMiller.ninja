export const CRASH_SOURCE = "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Fatality_Analysis_Reporting_System_InitialRelease_Accidents/FeatureServer/0";
export const CRASH_FIELDS = "OBJECTID,ST_CASE,STATENAME,COUNTYNAME,CITYNAME,YEAR,MONTH,DAY,TWAY_ID,TWAY_ID2,FATALS,VE_TOTAL,PEDS";
export type FatalCrash = { id: string; state: string; county: string; city: string; date: string; road: string; fatalities: number | null; vehicles: number | null; pedestrians: number | null; sourceUrl: string };
const value = (raw: unknown) => raw == null ? "" : String(raw).trim();
const numeric = (raw: unknown) => raw == null || raw === "" || !Number.isFinite(Number(raw)) ? null : Number(raw);
export function normalizeCrash(a: Record<string, unknown>): FatalCrash {
  const year = numeric(a.YEAR), month = numeric(a.MONTH), day = numeric(a.DAY);
  const date = year && month && day && month >= 1 && month <= 12 && day >= 1 && day <= 31 ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : year ? String(year) : "";
  return { id: value(a.ST_CASE), state: value(a.STATENAME), county: value(a.COUNTYNAME), city: value(a.CITYNAME), date,
    road: [value(a.TWAY_ID), value(a.TWAY_ID2)].filter(Boolean).join(" / "), fatalities: numeric(a.FATALS), vehicles: numeric(a.VE_TOTAL), pedestrians: numeric(a.PEDS), sourceUrl: CRASH_SOURCE };
}