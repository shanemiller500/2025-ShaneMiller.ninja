/* ------------------------------------------------------------------ */
/*  Shipwrecks extras (public/atlas/):                                 */
/*                                                                     */
/*  wreck-areas.json — wrecks NOAA charts as AREAS rather than points  */
/*      (scattered remains, hulks lying together — e.g. Mallows Bay's  */
/*      ghost fleet). ENC Direct Wreck_area layers, all chart scales.  */
/*  graveyards.json — the world's densest clusters of charted wrecks   */
/*      (NOAA's wrecks-noaa.json + the UK Hydrographic Office's        */
/*      wrecks-world.json — build those first), each named after the   */
/*      nearest town in Natural Earth's populated places (public       */
/*      domain) — offshore clusters reverse-geocode to just a country. */
/*                                                                     */
/*  node scripts/atlas/build-wreck-extras.mjs [--graveyards]           */
/*  (--graveyards rebuilds only the clusters)                          */
/* ------------------------------------------------------------------ */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas");
const UA = { "User-Agent": "shanemiller.ninja atlas (+https://shanemiller.ninja)" };
const write = async (file, obj) => {
  const body = JSON.stringify(obj);
  await writeFile(path.join(OUT, file), body);
  console.log(`${file}: ${(body.length / 1024).toFixed(0)} KB`);
};

/* ── 1. wreck areas ──────────────────────────────────────────────── */
if (!process.argv.includes("--graveyards")) {

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
}

/* ── 2. graveyards: the densest wreck clusters ───────────────────── */

// charted positions only: NOAA in U.S. waters, the UKHO everywhere else (it already leaves NOAA's wrecks out)
const noaa = JSON.parse(await readFile(path.join(OUT, "wrecks-noaa.json"), "utf8")).features;
const ukho = JSON.parse(await readFile(path.join(OUT, "wrecks-world.json"), "utf8")).cols;
const charted = [
  ...noaa.map((w) => [w.geometry.coordinates[0], w.geometry.coordinates[1], w.properties.cat]),
  ...ukho.id.map((_, i) => [ukho.lng[i], ukho.lat[i], ukho.cat[i]]),
];
const CELL = 0.25; // degrees
const cells = new Map();
for (const [x, y, cat] of charted) {
  const key = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  const c = cells.get(key) ?? { n: 0, sx: 0, sy: 0, danger: 0 };
  c.n++;
  c.sx += x;
  c.sy += y;
  if (cat === "danger") c.danger++;
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
// nearest town (Natural Earth 10m populated places), with the U.S. state or the country
const towns = (await (await fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson", { headers: UA })).json()).features.map((t) => ({ at: t.geometry.coordinates, ...t.properties }));
const km = (a, b) => {
  const r = Math.PI / 180;
  const h = Math.sin(((b[1] - a[1]) * r) / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(((b[0] - a[0]) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};
const graveyards = [];
for (const g of picked) {
  // nearest town — or, when that name is taken by a bigger cluster, the next one about as close
  const byDist = towns.map((t) => ({ t, d: km(g.center, t.at) })).sort((x, y) => x.d - y.d);
  const used = new Set(graveyards.map((x) => x.town));
  const t = (byDist.find((x) => !used.has(x.t.name) && x.d <= byDist[0].d * 1.5 + 30) ?? byDist[0]).t;
  const region = t.iso_a2 === "US" ? t.adm1name : t.adm0name;
  graveyards.push({ town: t.name, name: t.name === region ? t.name : `${t.name}, ${region}`, country: t.iso_a2 && t.iso_a2 !== "-99" ? t.iso_a2 : null, center: g.center, wrecks: g.n, dangerous: g.danger });
}
console.log(graveyards.map((g) => `${g.name}: ${g.wrecks}`).join("\n"));
await write("graveyards.json", { generated: new Date().toISOString(), cellDegrees: CELL, source: "Counted from NOAA (U.S.) and UK Hydrographic Office (worldwide) charted wrecks; nearest town from Natural Earth (public domain)", graveyards });
