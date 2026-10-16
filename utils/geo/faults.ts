/* ------------------------------------------------------------------ */
/*  USGS Quaternary Fault and Fold Database (U.S. faults active in     */
/*  the last ~1.6 million years).                                      */
/* ------------------------------------------------------------------ */
import { arcgisValue, type IdentifyResult } from "./arcgis";

export const QFAULTS_SERVICE = "https://earthquake.usgs.gov/arcgis/rest/services/haz/Qfaults/MapServer";
/** "National Database" — every state in one layer */
export const QFAULTS_LAYER = 21;

/** Age classes in the colours the USGS renderer draws them (newest = most hazardous). */
export const FAULT_AGES = [
  { label: "Historic (< 150 yr)", color: "#ff0000" },
  { label: "Latest Quaternary (< 15 ka)", color: "#ffaa00" },
  { label: "Late Quaternary (< 130 ka)", color: "#55ff00" },
  { label: "Mid–late Quaternary (< 750 ka)", color: "#0000ff" },
  { label: "Quaternary (< 1.6 Ma)", color: "#000000" },
  { label: "Class B (uncertain)", color: "#9c9c9c" },
];

export interface FaultInfo {
  name: string;
  section: string | null;
  age: string | null;
  slipRate: string | null;
  slipSense: string | null;
  dip: string | null;
  lengthKm: string | null;
  location: string | null;
  certainty: string | null;
  reviewed: string | null;
  reportUrl: string | null;
  pdfUrl: string | null;
}

export function faultFromIdentify(r: IdentifyResult): FaultInfo {
  const a = r.attributes;
  return {
    name: arcgisValue(a["Fault Name"]) ?? r.value ?? "Unnamed fault",
    section: arcgisValue(a["Section Name"]),
    age: arcgisValue(a["Age"]),
    slipRate: arcgisValue(a["Slip Rate(mm/year)"]),
    slipSense: arcgisValue(a["Slip Sense"]),
    dip: arcgisValue(a["Dip Direction"]),
    lengthKm: arcgisValue(a["Total Fault Length (km)"]),
    location: arcgisValue(a["Location"]),
    certainty: arcgisValue(a["Linetype"]),
    reviewed: arcgisValue(a["Date of Last Review"]),
    reportUrl: arcgisValue(a["Fault url"]),
    pdfUrl: arcgisValue(a["archive report pdf"]),
  };
}
