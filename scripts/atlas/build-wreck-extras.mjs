/* ------------------------------------------------------------------ */
/*  Shipwrecks extras (public/atlas/):                                 */
/*                                                                     */
/*  wreck-areas.json — wrecks NOAA charts as AREAS rather than points  */
/*      (scattered remains, hulks lying together — e.g. Mallows Bay's  */
/*      ghost fleet). ENC Direct Wreck_area layers, all chart scales.  */
/*  graveyards.json — the densest clusters of charted wrecks (from     */
/*      wrecks-noaa.json, run build-wrecks.mjs first), named with one  */
/*      OpenStreetMap reverse-geocode lookup each.                     */
/*                                                                     */
/*  node scripts/atlas/build-wreck-extras.mjs                          */
/* ------------------------------------------------------------------ */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas");
const UA = { "User-Agent": "shanemiller.ninja atlas (+https://shanemiller.ninja)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const write = async (file, obj) => {
  const body = JSON.stringify(obj);
  await writeFile(path.join(OUT, file), body);
  console.log(`${file}: ${(body.length / 1024).toFixed(0)} KB`);
};

/* ── 1. wreck areas ──────────────────────────────────────────────── */

const ENC = "https://encdirect.noaa.gov/arcgis/rest/services/encdirect";
// [service, Wreck_area layer, Obstruction_area layer, scale]
const SCALES = [
  ["enc_harbour", 158, 156, "harbor"],
  ["enc_approach", 163, 161, "approach"],
  ["enc_coastal", 120, 118, "coastal"],
  ["enc_general", 84, 83, "general"],
];
// some wreck fields are charted as "foul" obstruction areas — e.g. Mallows Bay's "Burnt hulks"
const HULKS = "UPPER(INFORM) LIKE '%HULK%' OR UPPER(INFORM) LIKE '%WRECK%'";
const areas = [];
const seen = new Set();
for (const [svc, wreckLayer, obstructionLayer, scale] of SCALES) {
  const get = async (layer, where) => {
    const q = new URLSearchParams({ where, outFields: "*", outSR: "4326", f: "geojson" });
    const res = await fetch(`${ENC}/${svc}/MapServer/${layer}/query?${q}`, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`${svc}/${layer}: HTTP ${res.status}`);
    return (await res.json()).features ?? [];
  };
  const found = [...(await get(wreckLayer, "1=1")).map((f) => ({ f, kind: "wrecks" })), ...(await get(obstructionLayer, HULKS)).map((f) => ({ f, kind: "hulks" }))];
  let kept = 0;
  for (const { f, kind } of found) {
    if (!f.geometry) continue;
    // the same area drawn on several chart scales: keep the most detailed (first seen)
    const ring = f.geometry.type === "Polygon" ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
    const cx = ring.reduce((a, c) => a + c[0], 0) / ring.length;
    const cy = ring.reduce((a, c) => a + c[1], 0) / ring.length;
    const key = `${Math.round(cx / 0.002)},${Math.round(cy / 0.002)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = f.properties ?? {};
    const depth = Number(p.VALSOU);
    f.properties = {
      kind,
      name: (p.OBJNAM ?? "").trim() || null,
      depth: p.VALSOU != null && Number.isFinite(depth) && depth > -50 ? Math.round(depth * 10) / 10 : null,
      note: (p.INFORM ?? "").trim().slice(0, 160) || null,
    };
    areas.push(f);
    kept++;
  }
  console.log(`wreck areas ${scale}: ${found.length} → kept ${kept}`);
}
const simp = await mapshaper.applyCommands("-i in.json -simplify 40% keep-shapes -o format=geojson precision=0.00001 out.json", { "in.json": { type: "FeatureCollection", features: areas } });
await write("wreck-areas.json", { type: "FeatureCollection", generated: new Date().toISOString(), source: "NOAA Office of Coast Survey — Electronic Navigational Charts (wreck areas)", features: JSON.parse(simp["out.json"]).features });

/* ── 2. graveyards: the densest wreck clusters ───────────────────── */

const wrecks = JSON.parse(await readFile(path.join(OUT, "wrecks-noaa.json"), "utf8")).features;
const CELL = 0.25; // degrees
const cells = new Map();
for (const w of wrecks) {
  const [x, y] = w.geometry.coordinates;
  const key = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  const c = cells.get(key) ?? { n: 0, sx: 0, sy: 0, danger: 0 };
  c.n++;
  c.sx += x;
  c.sy += y;
  if (w.properties.cat === "danger") c.danger++;
  cells.set(key, c);
}
// strongest cells first, skipping any next to one already taken (no double-counting a harbor)
const ranked = [...cells.entries()].sort((a, b) => b[1].n - a[1].n);
const picked = [];
for (const [key, c] of ranked) {
  const [i, j] = key.split(",").map(Number);
  if (picked.some((p) => Math.abs(p.i - i) <= 1 && Math.abs(p.j - j) <= 1)) continue;
  picked.push({ i, j, ...c, center: [Math.round((c.sx / c.n) * 1e4) / 1e4, Math.round((c.sy / c.n) * 1e4) / 1e4] });
  if (picked.length === 15) break;
}
const graveyards = [];
for (const g of picked) {
  // one reverse-geocode per cluster (OSM Nominatim: max 1 request/second)
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${g.center[1]}&lon=${g.center[0]}&zoom=10&format=json`, { headers: UA });
  const j = res.ok ? await res.json() : {};
  const a = j.address ?? {};
  const place = a.city ?? a.town ?? a.county ?? a.state_district ?? a.state ?? null;
  const state = a.state ?? null;
  graveyards.push({ name: place && state && place !== state ? `${place}, ${state}` : place ?? state ?? `${g.center[1].toFixed(2)}°, ${g.center[0].toFixed(2)}°`, center: g.center, wrecks: g.n, dangerous: g.danger });
  await sleep(1100);
}
console.log(graveyards.map((g) => `${g.name}: ${g.wrecks}`).join("\n"));
await write("graveyards.json", { generated: new Date().toISOString(), cellDegrees: CELL, source: "Counted from NOAA charted wrecks; place names © OpenStreetMap contributors", graveyards });
