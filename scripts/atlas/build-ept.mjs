/* ------------------------------------------------------------------ */
/*  Bake public/atlas/hidden-ept.json: for every Hidden Earth site,    */
/*  the USGS lidar point-cloud datasets (Entwine Point Tiles in the    */
/*  public usgs-lidar-public bucket) whose footprint covers it —       */
/*  newest first. The browser then streams just the nodes it needs.   */
/*                                                                     */
/*  node scripts/atlas/build-ept.mjs                                   */
/* ------------------------------------------------------------------ */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITES } from "../../app/atlas/hidden-earth/sites.ts";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas/hidden-ept.json");
const INDEX = "https://usgs.entwine.io/boundaries/resources.geojson";

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const covers = (g, [x, y]) => {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.some((p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)));
};
// the year a collection was flown, from its name (e.g. OH_Statewide_Phase2_2020 → 2020)
const yearOf = (name) => Math.max(0, ...[...name.matchAll(/(?:^|_)((?:19|20)\d\d)(?=_|$|[A-Z])/g)].map((m) => Number(m[1])));

const res = await fetch(INDEX);
if (!res.ok) throw new Error(`EPT index: HTTP ${res.status}`);
const index = await res.json();
console.log(`EPT resources: ${index.features.length}`);

const out = {};
for (const site of SITES) {
  const hits = index.features
    .filter((f) => f.geometry && covers(f.geometry, site.center))
    .map((f) => ({ name: f.properties.name, url: f.properties.url, points: f.properties.count, year: yearOf(f.properties.name) }))
    .sort((a, b) => b.year - a.year || b.points - a.points);
  out[site.id] = hits.slice(0, 4);
  console.log(`${site.id.padEnd(16)} ${hits.length ? hits.slice(0, 2).map((h) => `${h.name} (${h.year || "?"})`).join(" · ") : "— no point cloud"}`);
}
await writeFile(OUT, JSON.stringify({ generated: new Date().toISOString(), source: "USGS 3DEP lidar point clouds (Entwine Point Tiles, s3://usgs-lidar-public)", sites: out }, null, 1));
console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
