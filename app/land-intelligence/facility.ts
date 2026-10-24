export const FACILITY_SOURCE = "https://echogeo.epa.gov/arcgis/rest/services/ECHO/Facilities/MapServer/0";
export const FACILITY_FIELDS = "REGISTRY_ID,FAC_NAME,FAC_STREET,FAC_CITY,FAC_STATE,FAC_CURR_COMPLIANCE_STATUS,FAC_CURR_SNC_FLG,FAC_DATE_LAST_INSPECTION,FAC_TOTAL_PENALTIES,FAC_FORMAL_ACTION_COUNT,AIR_FLAG,NPDES_FLAG,RCRA_FLAG,TRI_FLAG,SDWIS_FLAG,GHG_FLAG";

export type FacilityStatus = "significant" | "violation" | "clear" | "unknown";
// Ordered by severity; `rank` puts violations on top where points overlap.
export const FACILITY_STATUSES: { id: FacilityStatus; label: string; color: string; rank: number }[] = [
  { id: "significant", label: "Significant violation", color: "#dc2626", rank: 3 },
  { id: "violation", label: "Violation identified", color: "#f59e0b", rank: 2 },
  { id: "clear", label: "No violation identified", color: "#16a34a", rank: 1 },
  { id: "unknown", label: "Status not reported", color: "#94a3b8", rank: 0 },
];
const PROGRAMS: [string, string][] = [["AIR_FLAG", "Air emissions"], ["NPDES_FLAG", "Water discharge"], ["RCRA_FLAG", "Hazardous waste"], ["TRI_FLAG", "Toxics release"], ["SDWIS_FLAG", "Drinking water"], ["GHG_FLAG", "Greenhouse gas"]];

export type EpaFacility = {
  id: string; name: string; address: string; status: FacilityStatus; statusLabel: string; rank: number;
  // Joined text, not an array: map tiles hand properties back as strings when a point is tapped.
  programs: string; lastInspection: string; penalties: number | null; formalActions: number | null; reportUrl: string; sourceUrl: string;
};

const text = (raw: unknown) => raw == null ? "" : String(raw).replace(/\s+/g, " ").trim();
const amount = (raw: unknown) => raw == null || raw === "" || !Number.isFinite(Number(raw)) ? null : Number(raw);

export function facilityStatus(raw: unknown, significantFlag: unknown): FacilityStatus {
  const value = text(raw).toLowerCase();
  if (text(significantFlag).toUpperCase() === "Y" || value.startsWith("significant")) return "significant";
  if (value.startsWith("violation")) return "violation";
  if (value.startsWith("no violation")) return "clear";
  return "unknown";
}

export function normalizeFacility(a: Record<string, unknown>): EpaFacility {
  const status = facilityStatus(a.FAC_CURR_COMPLIANCE_STATUS, a.FAC_CURR_SNC_FLG);
  const info = FACILITY_STATUSES.find((item) => item.id === status)!;
  const id = text(a.REGISTRY_ID);
  const inspected = amount(a.FAC_DATE_LAST_INSPECTION);
  return {
    id, name: text(a.FAC_NAME) || "Regulated facility",
    address: [text(a.FAC_STREET), text(a.FAC_CITY), text(a.FAC_STATE)].filter(Boolean).join(", "),
    status, statusLabel: info.label, rank: info.rank,
    programs: PROGRAMS.filter(([flag]) => text(a[flag]).toUpperCase() === "Y").map(([, label]) => label).join(" · "),
    lastInspection: inspected && inspected > 0 ? new Date(inspected).toISOString().slice(0, 10) : "",
    penalties: amount(a.FAC_TOTAL_PENALTIES), formalActions: amount(a.FAC_FORMAL_ACTION_COUNT),
    // EPA's detailed facility report; the registry ID is digits only.
    reportUrl: /^\d{6,15}$/.test(id) ? `https://echo.epa.gov/detailed-facility-report?fid=${id}` : "",
    sourceUrl: FACILITY_SOURCE,
  };
}
