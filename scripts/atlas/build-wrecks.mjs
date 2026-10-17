/* ------------------------------------------------------------------ */
/*  Bake the Shipwrecks data (public/atlas/):                          */
/*                                                                     */
/*  wrecks-noaa.json — every wreck charted on NOAA's Electronic        */
/*      Navigational Charts (ENC Direct, four chart scales), de-duped  */
/*      where scales overlap: category, depth over the wreck, water    */
/*      level and the chart note. U.S. waters. Public domain.          */
/*  wrecks-named.json — named shipwrecks worldwide from Wikidata (CC0),*/
/*      slim (id, name, position, year lost); details load on click.   */
/*  sanctuaries.json — NOAA National Marine Sanctuary boundaries.      */
/*                                                                     */
/*  node scripts/atlas/build-wrecks.mjs                                */
/* ------------------------------------------------------------------ */
import { writeFile } from "node:fs/promises";
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
async function json(url, init) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(120_000) });
      if (res.ok) return res.json();
      if (attempt >= 4) throw new Error(`HTTP ${res.status} ${url.slice(0, 120)}`);
    } catch (e) {
      if (attempt >= 4) throw e;
    }
    await sleep(2500 * attempt);
  }
}

/* ── 1. NOAA charted wrecks ──────────────────────────────────────── */

const ENC = "https://encdirect.noaa.gov/arcgis/rest/services/encdirect";
// largest scale first: where scales overlap, the most detailed chart wins
const SCALES = [
  ["enc_harbour", 36, "harbor"],
  ["enc_approach", 39, "approach"],
  ["enc_coastal", 33, "coastal"],
  ["enc_general", 29, "general"],
];
// fields differ slightly between chart scales, so every field is requested and picked by name

/** ENC wreck category (S-57 CATWRK, served as text and cut at 30 chars) → a short key. */
const catKey = (v) => {
  const t = String(v ?? "").toLowerCase();
  if (t.includes("non-dangerous")) return "safe";
  if (t.includes("dangerous")) return "danger";
  if (t.includes("hull") || t.includes("portion")) return "hull";
  if (t.includes("mast")) return "mast";
  if (t.includes("distributed")) return "remains";
  return null;
};

const wrecks = [];
const taken = new Map();
/** exact positions already used — overlapping chart cells repeat a wreck at identical coordinates */
const exact = new Map();
for (const [svc, layer, scale] of SCALES) {
  let n = 0;
  for (let offset = 0; ; offset += 1000) {
    const q = new URLSearchParams({ where: "1=1", outFields: "*", outSR: "4326", resultOffset: String(offset), resultRecordCount: "1000", f: "json" });
    const j = await json(`${ENC}/${svc}/MapServer/${layer}/query?${q}`);
    if (j.error) throw new Error(j.error.message);
    for (const f of j.features ?? []) {
      const g = f.geometry;
      if (!g || !Number.isFinite(g.x)) continue;
      n++;
      const a = f.attributes;
      // ~50 m cells: the same wreck drawn on two chart scales lands in the same cell
      const cx = Math.round(g.x / 0.0005);
      const cy = Math.round(g.y / 0.0005);
      const key = `${cx},${cy}`;
      const name = (a.OBJNAM ?? "").trim() || null;
      // duplicates only come from overlapping chart scales: look for the same wreck on a more
      // detailed chart, in this cell or a neighbouring one (it can sit right on a cell edge).
      // Wrecks on the same chart are distinct, however close (Mallows Bay has 100+ side by side).
      const pos = `${Math.round(g.x * 1e5)},${Math.round(g.y * 1e5)}`;
      let prev = exact.get(pos) ?? null;
      for (let dx = -1; dx <= 1 && !prev; dx++)
        for (let dy = -1; dy <= 1 && !prev; dy++) {
          const hit = taken.get(`${cx + dx},${cy + dy}`);
          if (hit && hit.scale !== scale) prev = hit.feature;
        }
      if (prev) {
        if (!prev.properties.name && name) prev.properties.name = name;
        continue;
      }
      const depth = Number(a.VALSOU);
      const feature = {
        type: "Feature",
        geometry: { type: "Point", coordinates: [Math.round(g.x * 1e5) / 1e5, Math.round(g.y * 1e5) / 1e5] },
        properties: {
          name,
          cat: catKey(a.CATWRK),
          depth: Number.isFinite(depth) && depth > -50 && a.VALSOU !== null ? Math.round(depth * 10) / 10 : null,
          lvl: a.WATLEV ? String(a.WATLEV).split(",")[0].trim() : null,
          note: (a.INFORM ?? "").trim().slice(0, 160) || null,
        },
      };
      if (!taken.has(key) || taken.get(key).scale !== scale) taken.set(key, { scale, feature });
      exact.set(pos, feature);
      wrecks.push(feature);
    }
    if ((j.features?.length ?? 0) < 1000) break;
  }
  console.log(`NOAA ${scale}: ${n} records → ${wrecks.length} unique so far`);
}
const cats = {};
for (const w of wrecks) cats[w.properties.cat ?? "none"] = (cats[w.properties.cat ?? "none"] ?? 0) + 1;
console.log("categories", cats, "named", wrecks.filter((w) => w.properties.name).length);
await write("wrecks-noaa.json", { type: "FeatureCollection", generated: new Date().toISOString(), source: "NOAA Office of Coast Survey — Electronic Navigational Charts (ENC Direct to GIS)", features: wrecks });

/* ── 2. named shipwrecks (Wikidata) ──────────────────────────────── */

async function sparql(query) {
  const j = await json(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, { headers: { ...UA, Accept: "application/sparql-results+json" } });
  return j.results.bindings;
}

// coordinates + English name per item; the year lost comes from "dissolved, abolished or demolished" (P576)
const named = new Map();
for (const [lo, hi] of [[-180, -60], [-60, 0], [0, 60], [60, 180.1]]) {
  const rows = await sparql(`
SELECT ?i ?c ?label ?lost WHERE {
  ?i wdt:P31/wdt:P279* wd:Q852190; wdt:P625 ?c.
  ?i p:P625/psv:P625/wikibase:geoLongitude ?lon.
  FILTER(?lon >= ${lo} && ?lon < ${hi})
  OPTIONAL { ?i rdfs:label ?label. FILTER(LANG(?label) = "en") }
  OPTIONAL { ?i wdt:P576 ?lost. }
}`);
  for (const r of rows) {
    const id = r.i.value.split("/").pop();
    const m = r.c.value.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/);
    if (!m) continue;
    const prev = named.get(id);
    const year = r.lost ? Number(r.lost.value.slice(0, r.lost.value.startsWith("-") ? 5 : 4)) : null;
    if (prev) {
      if (!prev.name && r.label) prev.name = r.label.value;
      if (prev.year == null && year != null) prev.year = year;
      continue;
    }
    named.set(id, { id, name: r.label?.value ?? null, lng: Math.round(Number(m[1]) * 1e4) / 1e4, lat: Math.round(Number(m[2]) * 1e4) / 1e4, year: Number.isFinite(year) ? year : null });
  }
  console.log(`Wikidata lon ${lo}…${hi}: ${rows.length} rows → ${named.size} wrecks`);
  await sleep(1500);
}
// columns keep 30k points small; unnamed items (no English label) are dropped
const list = [...named.values()].filter((w) => w.name && !/^Q\d+$/.test(w.name));
await write("wrecks-named.json", {
  generated: new Date().toISOString(),
  source: "Wikidata (CC0) — items that are shipwrecks, with coordinates",
  cols: { id: list.map((w) => w.id), name: list.map((w) => w.name), lng: list.map((w) => w.lng), lat: list.map((w) => w.lat), year: list.map((w) => w.year) },
});
console.log(`named wrecks: ${list.length} (${list.filter((w) => w.year != null).length} with a year lost)`);

/* ── 3. National Marine Sanctuaries ──────────────────────────────── */

const NMS = "https://services2.arcgis.com/C8EMgrsFcRFL6LrL/arcgis/rest/services/NMS_Boundaries_02032022/FeatureServer/0/query";
const nms = await json(`${NMS}?${new URLSearchParams({ where: "1=1", outFields: "NMS_Name,NMS_Abbrv", outSR: "4326", f: "geojson" })}`);
for (const f of nms.features) f.properties = { name: `${f.properties.NMS_Name} National Marine Sanctuary`.replace("National Marine Sanctuary National Marine Sanctuary", "National Marine Sanctuary"), code: f.properties.NMS_Abbrv };
const simp = await mapshaper.applyCommands("-i in.json -simplify 1.2% keep-shapes -o format=geojson precision=0.001 out.json", { "in.json": nms });
const fc = JSON.parse(simp["out.json"]);
await write("sanctuaries.json", { type: "FeatureCollection", generated: new Date().toISOString(), source: "NOAA Office of National Marine Sanctuaries — sanctuary boundaries", features: fc.features });
console.log("sanctuaries:", fc.features.map((f) => f.properties.code).join(" "));
