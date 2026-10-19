/* ------------------------------------------------------------------ */
/*  Bake the karst layer for Underground World.                          */
/*                                                                     */
/*  Source: USGS Open-File Report 2014-1156, "Karst in the United      */
/*  States: A Digital Map Compilation and Database" (Weary & Doctor),  */
/*  public domain — read from a public ArcGIS feature service copy.    */
/*  ~91,000 polygons are generalized on the server, dissolved by       */
/*  class / exposure / climate and simplified with mapshaper into one  */
/*  small GeoJSON. Clicking the map queries the full-detail service    */
/*  for the rock unit under the cursor, so detail isn't lost.          */
/*                                                                     */
/*  node scripts/atlas/build-karst.mjs   → public/atlas/karst.json     */
/* ------------------------------------------------------------------ */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";

export const KARST_SERVICE = "https://services5.arcgis.com/njRHYVhl2CMXMsap/arcgis/rest/services/CONUS_Karst/FeatureServer";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas/karst.json");

/** Feature-service layer → our class key. */
const LAYERS = [
  { id: 1, cls: "carbonate" },
  { id: 3, cls: "evaporite" },
  { id: 6, cls: "sandstone" },
  { id: 7, cls: "volcanic" },
  { id: 5, cls: "piping" },
];
const PAGE = 2000;

/** "Carbonate rocks buried under <300 ft … in a humid climate" → exposure + climate. */
const parseType = (t = "") => ({
  exp: /buried/i.test(t) ? "buried" : "surface",
  clim: /humid/i.test(t) ? "humid" : /dry/i.test(t) ? "dry" : "",
});

async function fetchLayer({ id, cls }) {
  const features = [];
  for (let offset = 0; ; offset += PAGE) {
    const q = new URLSearchParams({
      where: "1=1",
      outFields: "KARST_TYPE",
      outSR: "4326",
      // ~1 km generalization on the server keeps the download sane
      maxAllowableOffset: "0.01",
      geometryPrecision: "3",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      f: "geojson",
    });
    let page;
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(`${KARST_SERVICE}/${id}/query?${q}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        page = await res.json();
        break;
      } catch (e) {
        if (attempt >= 4) throw new Error(`${cls} @${offset}: ${e.message}`);
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
    for (const f of page.features ?? []) {
      if (!f.geometry) continue;
      features.push({ type: "Feature", geometry: f.geometry, properties: { cls, ...parseType(f.properties?.KARST_TYPE) } });
    }
    process.stdout.write(`\r${cls}: ${features.length}`);
    if (!page.features?.length || !page.properties?.exceededTransferLimit) {
      if ((page.features?.length ?? 0) < PAGE) break;
    }
  }
  process.stdout.write("\n");
  return features;
}

const all = [];
for (const layer of LAYERS) all.push(...(await fetchLayer(layer)));
console.log(`downloaded ${all.length} polygons — dissolving…`);

const out = await mapshaper.applyCommands(
  [
    "-i in.json",
    "-dissolve2 cls,exp,clim",
    // keep small karst islands visible; drop the slivers
    "-simplify 12% keep-shapes",
    "-filter-slivers min-area=4km2",
    "-explode",
    "-o format=geojson precision=0.001 out.json",
  ].join(" "),
  { "in.json": { type: "FeatureCollection", features: all } }
);

// area per class/exposure (km²), measured on the dissolved map, so the page can quote real numbers
const measured = await mapshaper.applyCommands("-i k.json -each 'km2=this.area/1e6' -o format=json k2.json", { "k.json": out["out.json"] });
const stats = {};
for (const row of JSON.parse(measured["k2.json"])) {
  const key = `${row.cls}:${row.exp}`;
  stats[key] = Math.round((stats[key] ?? 0) + row.km2);
}
/** Conterminous U.S. land + inland water area, km² (U.S. Census Bureau, 2010). */
const CONUS_KM2 = 8_080_464;
// classes overlap (e.g. carbonate over evaporite), so measure the union for the headline share
const union = await mapshaper.applyCommands("-i k.json -dissolve2 -each 'km2=this.area/1e6' -o format=json u.json", { "k.json": out["out.json"] });
const total = Math.round(JSON.parse(union["u.json"])[0].km2);

const fc = JSON.parse(out["out.json"]);
fc.stats = { km2: stats, totalKm2: total, conusKm2: CONUS_KM2, share: Math.round((total / CONUS_KM2) * 1000) / 10 };
await mkdir(path.dirname(OUT), { recursive: true });
const body = JSON.stringify(fc);
await writeFile(OUT, body);
console.log(`karst.json: ${fc.features.length} polygons, ${(body.length / 1048576).toFixed(2)} MB`);
console.log("area km²:", stats, `→ ${fc.stats.share}% of the lower 48`);
