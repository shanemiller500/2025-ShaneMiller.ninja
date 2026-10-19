/* ------------------------------------------------------------------ */
/*  Bake Ghost Towns data into public/atlas/:                          */
/*                                                                     */
/*  ghost-gnis.json   — every populated place the USGS Geographic      */
/*      Names Information System lists as "historical": towns and      */
/*      settlements that no longer exist (public domain).              */
/*  ghost-towns.json  — items Wikidata types as ghost towns, worldwide */
/*      (CC0), with article, image, founding/abandonment years.        */
/*  drowned.json      — U.S. towns flooded by reservoirs, from         */
/*      Wikipedia's "List of flooded towns in the United States"       */
/*      (CC BY-SA); positions from each town's article, else the       */
/*      reservoir's (flagged approximate).                             */
/*                                                                     */
/*  node scripts/atlas/build-ghost.mjs                                 */
/* ------------------------------------------------------------------ */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas");
const UA = { "User-Agent": "shanemiller.ninja atlas (+https://shanemiller.ninja)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (v) => Math.round(v * 1e4) / 1e4;

async function json(url, init = {}) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, { ...init, headers: { ...UA, ...(init.headers ?? {}) } });
    if (res.ok) return res.json();
    await sleep(2000 * attempt);
  }
  throw new Error(`failed: ${url.slice(0, 120)}`);
}

const WIKIDATA_ONLY = process.argv.includes("--wikidata");

/* ── 1. GNIS historical populated places ─────────────────────────── */
if (!WIKIDATA_ONLY) {

const GNIS = "https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/12/query";
const gnis = { id: [], name: [], state: [], county: [], lng: [], lat: [] };
const gnisSeen = new Set(); // a feature spanning two counties comes back once per county
for (let offset = 0; ; offset += 2000) {
  const q = new URLSearchParams({
    where: "gaz_featureclass='Populated Place'",
    outFields: "gaz_id,gaz_name,state_alpha,county_name,isunknowncoords",
    orderByFields: "objectid",
    resultOffset: String(offset),
    resultRecordCount: "2000",
    outSR: "4326",
    f: "json",
  });
  const j = await json(`${GNIS}?${q}`);
  for (const f of j.features ?? []) {
    const a = f.attributes;
    // GNIS serves multipoints: the place is the first point
    const pt = f.geometry?.points?.[0] ?? (f.geometry ? [f.geometry.x, f.geometry.y] : null);
    const g = pt ? { x: pt[0], y: pt[1] } : null;
    if (!g || !Number.isFinite(g.x) || !Number.isFinite(g.y) || String(a.isunknowncoords) === "1" || gnisSeen.has(a.gaz_id)) continue;
    gnisSeen.add(a.gaz_id);
    gnis.id.push(a.gaz_id);
    gnis.name.push(String(a.gaz_name).replace(/\s*\(historical\)\s*$/i, ""));
    gnis.state.push(a.state_alpha ?? null);
    gnis.county.push(a.county_name ?? null);
    gnis.lng.push(round(g.x));
    gnis.lat.push(round(g.y));
  }
  process.stdout.write(`\rGNIS ${gnis.id.length}`);
  if (!j.exceededTransferLimit && (j.features?.length ?? 0) < 2000) break;
}
console.log(`\nGNIS historical populated places: ${gnis.id.length}`);
await writeFile(path.join(DIR, "ghost-gnis.json"), JSON.stringify({ generated: new Date().toISOString(), source: "USGS GNIS — historical populated places", cols: gnis }));
}

/* ── 2. Wikidata ghost towns, abandoned and deserted villages (worldwide) ── */

/** What Wikidata calls it — the most specific first when an item is more than one (a deserted medieval village is also an abandoned village). */
export const KINDS = [
  ["Q74047", "ghost town"],
  ["Q21751582", "deserted medieval village"],
  ["Q350895", "abandoned village"],
];
const SPARQL = (cls) => `
SELECT ?c ?cLabel ?cDescription ?coord ?article ?countryLabel
  (SAMPLE(?img) AS ?image) (MIN(YEAR(?inc)) AS ?founded) (MIN(YEAR(?end)) AS ?abandoned)
WHERE {
  ?c wdt:P31/wdt:P279* wd:${cls}; wdt:P625 ?coord.
  OPTIONAL { ?c wdt:P17 ?country. }
  OPTIONAL { ?c wdt:P18 ?img. }
  OPTIONAL { ?c wdt:P571 ?inc. }
  OPTIONAL { ?c wdt:P576 ?end. }
  OPTIONAL { ?article schema:about ?c; schema:isPartOf <https://en.wikipedia.org/>. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?c ?cLabel ?cDescription ?coord ?article ?countryLabel`;
// one class per query (all three at once risks Wikidata's 60 s limit)
const rows = [];
for (const [k, [cls]] of KINDS.entries()) {
  const got = (await json(`https://query.wikidata.org/sparql?query=${encodeURIComponent(SPARQL(cls))}`, { headers: { Accept: "application/sparql-results+json" } })).results.bindings;
  for (const r of got) r.kind = k;
  rows.push(...got);
  await sleep(800);
}
const seen = new Map();
for (const r of rows) {
  const id = r.c.value.split("/").pop();
  const [lng, lat] = r.coord.value.replace(/^Point\(|\)$/g, "").split(" ").map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || seen.has(id)) continue;
  const name = r.cLabel.value;
  if (/^Q\d+$/.test(name)) continue; // no English label
  seen.set(id, {
    id,
    name,
    desc: r.cDescription?.value ?? "",
    country: r.countryLabel?.value ?? null,
    lng: round(lng),
    lat: round(lat),
    image: r.image ? decodeURIComponent(r.image.value.split("/Special:FilePath/")[1] ?? "") || null : null,
    wiki: r.article ? decodeURIComponent(r.article.value.split("/wiki/")[1] ?? "") || null : null,
    founded: r.founded ? Number(r.founded.value) : null,
    abandoned: r.abandoned ? Number(r.abandoned.value) : null,
    kind: r.kind,
  });
}
const towns = [...seen.values()];
const cols = Object.fromEntries(["id", "name", "desc", "country", "lng", "lat", "image", "wiki", "founded", "abandoned", "kind"].map((k) => [k, towns.map((t) => t[k])]));
console.log(`Wikidata: ${towns.length} (U.S. ${towns.filter((t) => t.country === "United States").length}, with article ${towns.filter((t) => t.wiki).length})`, KINDS.map(([, label], k) => `${label} ${towns.filter((t) => t.kind === k).length}`).join(" · "));
await writeFile(path.join(DIR, "ghost-towns.json"), JSON.stringify({ generated: new Date().toISOString(), source: "Wikidata (CC0)", kinds: KINDS.map(([, label]) => label), cols }));
if (WIKIDATA_ONLY) process.exit(0);

/* ── 3. drowned towns ────────────────────────────────────────────── */

const list = await json("https://en.wikipedia.org/w/api.php?action=parse&page=List_of_flooded_towns_in_the_United_States&prop=wikitext&format=json&formatversion=2");
const text = list.parse.wikitext;
const linkTitle = (cell) => cell.match(/\[\[([^\]|#]+)/)?.[1]?.trim() ?? null;
const linkLabel = (cell) => cell.match(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/)?.[1]?.trim() ?? cell.replace(/<ref[\s\S]*$/, "").trim();
const drowned = [];
const STATES = new Set(["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming"]);
for (const table of text.split("{|").slice(1)) {
  const body = table.split("|}")[0];
  let state = null;
  // a reservoir can span several town rows (rowspan): carry it down
  let lastRes = null;
  const dropSpan = (c) => c.replace(/^[^|[]*rowspan[^|]*\|\s*/, "");
  for (const row of body.split(/\n\|-/).slice(1)) {
    const cells = row
      .split(/\n\|/)
      .map((c) => c.trim())
      .filter((c) => c && !c.startsWith("!"));
    if (!cells.length) continue;
    // a row that opens a state carries it first (rowspan="n" | [[Alabama]])
    let i = 0;
    const first = dropSpan(cells[0]);
    const looksLikeState = STATES.has(linkLabel(first).replace(/\s*\(.*\)$/, ""));
    if (looksLikeState && cells.length >= 2 && /\[\[/.test(cells[1] ?? "")) {
      state = linkLabel(first).replace(/\s*\(.*\)$/, "");
      i = 1;
    }
    const town = dropSpan(cells[i] ?? "");
    let res = cells[i + 1] ? dropSpan(cells[i + 1]) : null;
    if (res && /\[\[/.test(res)) lastRes = res;
    else res = lastRes;
    if (!town || !res || !/\[\[/.test(town)) continue;
    drowned.push({ state, name: linkLabel(town), title: linkTitle(town), reservoir: linkLabel(res), resTitle: linkTitle(res) });
  }
}
// coordinates from the articles (towns first, then reservoirs as a fallback)
async function coordsFor(titles) {
  const out = new Map();
  const uniq = [...new Set(titles.filter(Boolean))];
  for (let k = 0; k < uniq.length; k += 50) {
    const batch = uniq.slice(k, k + 50);
    const j = await json(`https://en.wikipedia.org/w/api.php?action=query&prop=coordinates|pageprops&ppprop=wikibase_item&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(batch.join("|"))}`);
    // pages without {{coord}}: ask Wikidata
    const needWd = (j.query.pages ?? []).filter((pg) => !pg.coordinates?.length && pg.pageprops?.wikibase_item);
    if (needWd.length) {
      const wd = await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids=${needWd.map((pg) => pg.pageprops.wikibase_item).join("|")}`);
      for (const pg of needWd) {
        const v = wd.entities?.[pg.pageprops.wikibase_item]?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
        if (v) pg.coordinates = [{ lat: v.latitude, lon: v.longitude }];
      }
    }
    const redirect = new Map((j.query.redirects ?? []).map((r) => [r.to, r.from]));
    const normal = new Map((j.query.normalized ?? []).map((r) => [r.to, r.from]));
    for (const p of j.query.pages ?? []) {
      const c = p.coordinates?.[0];
      if (!c) continue;
      let t = p.title;
      t = redirect.get(t) ?? t;
      t = normal.get(t) ?? t;
      out.set(t, [round(c.lon), round(c.lat)]);
      out.set(p.title, [round(c.lon), round(c.lat)]);
    }
    await sleep(200);
  }
  return out;
}
const townC = await coordsFor(drowned.map((d) => d.title));
const resC = await coordsFor(drowned.map((d) => d.resTitle));
const drownedOut = [];
for (const d of drowned) {
  const at = townC.get(d.title) ?? resC.get(d.resTitle) ?? null;
  if (!at) continue;
  drownedOut.push({ name: d.name, state: d.state, reservoir: d.reservoir, wiki: d.title, lng: at[0], lat: at[1], approximate: !townC.get(d.title) });
}
console.log(`drowned towns: ${drowned.length} listed, ${drownedOut.length} placed (${drownedOut.filter((d) => d.approximate).length} at their reservoir)`);
await writeFile(path.join(DIR, "drowned.json"), JSON.stringify({ generated: new Date().toISOString(), source: "Wikipedia — List of flooded towns in the United States (CC BY-SA 4.0)", towns: drownedOut }));
