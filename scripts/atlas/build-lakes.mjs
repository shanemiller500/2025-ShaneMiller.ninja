/* ------------------------------------------------------------------ */
/*  Bake public/atlas/pluvial.json — the Ice Age (pluvial) lakes of    */
/*  the Great Basin: 139 Late Quaternary lakes after Mifflin & Wheat   */
/*  (1979), from a public ArcGIS layer. Simplified with mapshaper;     */
/*  true (geodesic) areas, because the layer's own Shape__Area is in   */
/*  Web Mercator and overstates the size by ~1.7× at these latitudes.  */
/*                                                                     */
/*  node scripts/atlas/build-lakes.mjs                                 */
/* ------------------------------------------------------------------ */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas/pluvial.json");
const LAYER = "https://services3.arcgis.com/hDXM0jVzBTOKdR4i/arcgis/rest/services/Great_Basin_Pluvial_Lakes_MW1979/FeatureServer/0";

const features = [];
for (let offset = 0; ; offset += 1000) {
  const q = new URLSearchParams({ where: "1=1", outFields: "FID,name,timescale,note", outSR: "4326", resultOffset: String(offset), resultRecordCount: "1000", f: "geojson" });
  const j = await (await fetch(`${LAYER}/query?${q}`)).json();
  if (j.error) throw new Error(j.error.message);
  features.push(...j.features);
  if (!j.properties?.exceededTransferLimit && j.features.length < 1000) break;
}

/** Area of a lng/lat ring on a sphere, km² (spherical excess / the usual polygon-area formula). */
const R = 6371.0088;
function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [l1, p1] = ring[i];
    const [l2, p2] = ring[i + 1];
    sum += ((l2 - l1) * Math.PI) / 180 * (2 + Math.sin((p1 * Math.PI) / 180) + Math.sin((p2 * Math.PI) / 180));
  }
  return Math.abs((sum * R * R) / 2);
}
const polyArea = (rings) => rings.reduce((a, r, i) => a + (i === 0 ? ringArea(r) : -ringArea(r)), 0);
const areaKm2 = (g) => (g.type === "Polygon" ? polyArea(g.coordinates) : g.coordinates.reduce((a, p) => a + polyArea(p), 0));

for (const f of features) {
  const p = f.properties;
  f.properties = {
    id: p.FID,
    name: (p.name ?? "").trim() || null,
    note: (p.note ?? "").trim() || null,
    areaKm2: Math.round(areaKm2(f.geometry)),
  };
}

// light simplification: keep shorelines readable at regional zoom, stay small
const out = await mapshaper.applyCommands("-i in.json -simplify 12% keep-shapes -o out.json precision=0.0001", { "in.json": { type: "FeatureCollection", features } });
const fc = JSON.parse(out["out.json"]);
fc.features.sort((a, b) => b.properties.areaKm2 - a.properties.areaKm2);
const body = JSON.stringify({
  type: "FeatureCollection",
  generated: new Date().toISOString(),
  source: "Great Basin pluvial lakes after Mifflin & Wheat (1979), Nevada Bureau of Mines and Geology Bulletin 94",
  features: fc.features,
});
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, body);
const named = fc.features.filter((f) => f.properties.name).length;
console.log(`pluvial lakes: ${fc.features.length} (${named} named) · ${(body.length / 1024).toFixed(0)} KB`);
console.log(fc.features.slice(0, 6).map((f) => `${f.properties.name}: ${f.properties.areaKm2.toLocaleString()} km²`).join("\n"));
