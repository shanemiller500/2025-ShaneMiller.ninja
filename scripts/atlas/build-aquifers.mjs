/* ------------------------------------------------------------------ */
/*  Bake the carbonate aquifers layer for Underground World.             */
/*                                                                     */
/*  Source: USGS Principal Aquifers of the United States (via Esri's   */
/*  Living Atlas "USA Aquifers" feature layer). Keeps the karst-prone  */
/*  ones — carbonate-rock (ROCK_TYPE 400) and sandstone-and-carbonate  */
/*  (500) aquifers — generalized and simplified with mapshaper.        */
/*                                                                     */
/*  node scripts/atlas/build-aquifers.mjs → public/atlas/aquifers.json */
/* ------------------------------------------------------------------ */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";

const SERVICE = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Aquifers_Feature_Layer_view/FeatureServer/0/query";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas/aquifers.json");

const features = [];
for (let offset = 0; ; offset += 1000) {
  const q = new URLSearchParams({
    where: "ROCK_TYPE IN (400, 500)",
    outFields: "AQ_NAME,ROCK_NAME,ROCK_TYPE",
    outSR: "4326",
    maxAllowableOffset: "0.01",
    geometryPrecision: "3",
    resultOffset: String(offset),
    resultRecordCount: "1000",
    f: "geojson",
  });
  const res = await fetch(`${SERVICE}?${q}`);
  if (!res.ok) throw new Error(`aquifers: HTTP ${res.status}`);
  const page = await res.json();
  for (const f of page.features ?? []) {
    if (!f.geometry) continue;
    const p = f.properties;
    features.push({ type: "Feature", geometry: f.geometry, properties: { name: p.AQ_NAME, rock: p.ROCK_TYPE === 400 ? "carbonate" : "mixed" } });
  }
  if ((page.features?.length ?? 0) < 1000 && !page.properties?.exceededTransferLimit) break;
}
console.log(`downloaded ${features.length} polygons`);

const out = await mapshaper.applyCommands(
  "-i in.json -dissolve2 name,rock -simplify 15% keep-shapes -filter-slivers min-area=4km2 -o format=geojson precision=0.001 out.json",
  { "in.json": { type: "FeatureCollection", features } }
);
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, out["out.json"]);
const fc = JSON.parse(out["out.json"]);
console.log(`aquifers.json: ${fc.features.length} aquifers, ${(out["out.json"].length / 1024).toFixed(0)} KB`);
console.log([...new Set(fc.features.map((f) => f.properties.name))].join("; "));
