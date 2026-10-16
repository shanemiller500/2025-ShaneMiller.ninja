/* ------------------------------------------------------------------ */
/*  Bake public/atlas/nri-counties.json — FEMA National Risk Index by  */
/*  county: overall risk, expected annual loss, social vulnerability,  */
/*  community resilience, people + building value, and the ratings for */
/*  the hazards the Disaster Atlas maps (hurricane, tornado, wildfire, */
/*  inland + coastal flooding). Simplified with mapshaper.             */
/*                                                                     */
/*  node scripts/atlas/build-nri.mjs                                   */
/* ------------------------------------------------------------------ */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas/nri-counties.json");
const LAYER = "https://services.arcgis.com/XG15cJAlne2vxtgt/arcgis/rest/services/National_Risk_Index_Counties/FeatureServer/0";
const FIELDS = [
  "NRI_ID", "STATE", "STATEABBRV", "COUNTY", "COUNTYTYPE", "STCOFIPS", "POPULATION", "BUILDVALUE",
  "RISK_SCORE", "RISK_RATNG", "EAL_VALT", "EAL_RATNG", "SOVI_RATNG", "RESL_RATNG",
  "HRCN_RISKR", "TRND_RISKR", "WFIR_RISKR", "IFLD_RISKR", "CFLD_RISKR", "NRI_VER",
];

const features = [];
for (let offset = 0; ; offset += 1000) {
  const q = new URLSearchParams({
    where: "1=1",
    outFields: FIELDS.join(","),
    outSR: "4326",
    maxAllowableOffset: "0.005",
    geometryPrecision: "4",
    orderByFields: "OBJECTID",
    resultOffset: String(offset),
    resultRecordCount: "1000",
    f: "geojson",
  });
  const res = await fetch(`${LAYER}/query?${q}`);
  if (!res.ok) throw new Error(`NRI: HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);
  features.push(...j.features);
  process.stdout.write(`\r${features.length} counties`);
  if (j.features.length < 1000) break;
}
console.log();

// short keys keep the file small; "Not Applicable"/"Insufficient Data" → null
const rating = (v) => (v && !/not applicable|insufficient|no rating/i.test(v) ? v : null);
let version = null;
for (const f of features) {
  const p = f.properties;
  version ??= p.NRI_VER;
  f.properties = {
    id: p.STCOFIPS,
    name: `${p.COUNTY} ${p.COUNTYTYPE ?? ""}`.trim(),
    state: p.STATEABBRV,
    pop: p.POPULATION,
    bldg: Math.round(p.BUILDVALUE ?? 0),
    score: p.RISK_SCORE == null ? null : Math.round(p.RISK_SCORE * 10) / 10,
    risk: rating(p.RISK_RATNG),
    eal: Math.round(p.EAL_VALT ?? 0),
    ealR: rating(p.EAL_RATNG),
    sovi: rating(p.SOVI_RATNG),
    resl: rating(p.RESL_RATNG),
    hrcn: rating(p.HRCN_RISKR),
    trnd: rating(p.TRND_RISKR),
    wfir: rating(p.WFIR_RISKR),
    ifld: rating(p.IFLD_RISKR),
    cfld: rating(p.CFLD_RISKR),
  };
}

const out = await mapshaper.applyCommands("-i in.json -simplify 8% keep-shapes -o format=geojson precision=0.001 out.json", { "in.json": { type: "FeatureCollection", features } });
const fc = JSON.parse(out["out.json"]);
const body = JSON.stringify({ type: "FeatureCollection", generated: new Date().toISOString(), source: `FEMA National Risk Index (${version ?? "current"})`, features: fc.features });
await writeFile(OUT, body);
const by = {};
for (const f of fc.features) by[f.properties.risk ?? "none"] = (by[f.properties.risk ?? "none"] ?? 0) + 1;
console.log(`nri-counties.json: ${fc.features.length} counties · ${(body.length / 1024).toFixed(0)} KB · ${version}`, by);
