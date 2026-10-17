/* ------------------------------------------------------------------ */
/*  Bake public/atlas/wrecks-world.json — charted wrecks worldwide     */
/*  from the UK Hydrographic Office wrecks & obstructions data (via    */
/*  EMODnet Human Activities, Open Government Licence v3). Wrecks that */
/*  NOAA already charts (within ~250 m of one of ours) are dropped so  */
/*  U.S. waters keep NOAA's record. Slim + columnar: the full record   */
/*  loads live from EMODnet when a wreck is clicked.                   */
/*                                                                     */
/*  node scripts/atlas/build-wrecks-world.mjs                          */
/* ------------------------------------------------------------------ */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas");
const WFS = "https://ows.emodnet-humanactivities.eu/wfs";
const PAGE = 10000;
const CATS = {
  "Dangerous wreck": "danger",
  "Non-dangerous wreck": "safe",
  "Wreck showing any portion of hull or superstructure": "hull",
  "Wreck showing mast/masts": "mast",
  "Distributed remains of wreck": "remains",
};
const num = (v) => {
  const n = Number(v);
  return v == null || v === "n/a" || v === "" || !Number.isFinite(n) ? null : n;
};

async function page(start) {
  const q = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: "emodnet:wwshipwrecks",
    propertyName: "wreck_id,wreck_cate,depth,name,date_sunk,the_geom",
    sortBy: "wreck_id",
    count: String(PAGE),
    startIndex: String(start),
    outputFormat: "application/json",
  });
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${WFS}?${q}`);
    if (res.ok) return (await res.json()).features;
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error(`EMODnet page ${start} failed`);
}

// NOAA's charted wrecks, bucketed for a quick "already charted?" check
const noaa = JSON.parse(await readFile(path.join(DIR, "wrecks-noaa.json"), "utf8"));
const CELL = 0.005;
const grid = new Map();
for (const f of noaa.features) {
  const [x, y] = f.geometry.coordinates;
  const k = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  if (!grid.has(k)) grid.set(k, []);
  grid.get(k).push([x, y]);
}
const nearNoaa = (x, y) => {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (const [px, py] of grid.get(`${cx + i},${cy + j}`) ?? []) {
        const dx = (px - x) * 111_320 * Math.cos((y * Math.PI) / 180);
        const dy = (py - y) * 110_574;
        if (dx * dx + dy * dy < 250 * 250) return true;
      }
  return false;
};

const cols = { id: [], lng: [], lat: [], cat: [], depth: [], name: [], year: [] };
let total = 0;
let dup = 0;
const seen = new Set();
for (let start = 0; ; start += PAGE) {
  const feats = await page(start);
  for (const f of feats) {
    const p = f.properties;
    const c = f.geometry?.coordinates;
    if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || seen.has(p.wreck_id)) continue;
    seen.add(p.wreck_id);
    total++;
    // the service hands out lat/lng in EPSG:4326 axis order for 2.0.0 JSON — guard both ways
    const [lng, lat] = Math.abs(c[1]) <= 90 && Math.abs(c[0]) <= 180 ? [c[0], c[1]] : [c[1], c[0]];
    if (nearNoaa(lng, lat)) {
      dup++;
      continue;
    }
    const name = p.name && p.name !== "n/a" ? String(p.name).trim() : null;
    const ds = p.date_sunk && /^\d{4}/.test(p.date_sunk) ? Number(p.date_sunk.slice(0, 4)) : null;
    cols.id.push(String(p.wreck_id));
    cols.lng.push(Math.round(lng * 1e5) / 1e5);
    cols.lat.push(Math.round(lat * 1e5) / 1e5);
    cols.cat.push(CATS[p.wreck_cate] ?? null);
    cols.depth.push(num(p.depth));
    cols.name.push(name);
    cols.year.push(ds && ds > 1000 && ds <= new Date().getFullYear() ? ds : null);
  }
  process.stdout.write(`\r${start + feats.length} fetched · ${cols.id.length} kept · ${dup} already NOAA`);
  if (feats.length < PAGE) break;
}
console.log(`\nUKHO wrecks: ${total}, kept ${cols.id.length}, dropped ${dup} charted by NOAA, named ${cols.name.filter(Boolean).length}`);
const body = JSON.stringify({
  generated: new Date().toISOString(),
  source: "UK Hydrographic Office wrecks & obstructions (worldwide subset), via EMODnet Human Activities",
  license: "Open Government Licence v3.0",
  cols,
});
await writeFile(path.join(DIR, "wrecks-world.json"), body);
console.log(`wrecks-world.json: ${(body.length / 1024).toFixed(0)} KB`);
