/* ------------------------------------------------------------------ */
/*  Bake the data for Strange Earth.                                   */
/*                                                                     */
/*  1. public/atlas/strange.json  — notable U.S. landforms from        */
/*     Wikidata (CC0): arches, rock formations, lava fields, dry       */
/*     lakebeds, geysers, dunes, erratics… with photos + descriptions. */
/*  2. public/atlas/impacts.json  — the ~190 CONFIRMED impact          */
/*     structures on Earth. Wikidata alone mixes in proposed/          */
/*     unconfirmed ones, so the list comes from Wikipedia's "List of   */
/*     impact structures on Earth" (compiled from the Earth Impact     */
/*     Database, PASSC/UNB), joined to Wikidata for photos.            */
/*  3. public/atlas/landforms.json — USGS GNIS official names for      */
/*     arches, pillars, craters (any origin) and lava features.        */
/*                                                                     */
/*  node scripts/atlas/build-strange.mjs                               */
/* ------------------------------------------------------------------ */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas");
const UA = { "User-Agent": "shanemiller.ninja atlas (+https://shanemiller.ninja)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;

async function sparql(query) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, { headers: { ...UA, Accept: "application/sparql-results+json" } });
      if (res.ok) return (await res.json()).results.bindings;
      if (attempt >= 4) throw new Error(`Wikidata: HTTP ${res.status}`);
    } catch (e) {
      if (attempt >= 4) throw e;
    }
    await sleep(3000 * attempt);
  }
}

const thumb = (fileUrl, w = 800) => {
  const name = decodeURIComponent(fileUrl?.split("/Special:FilePath/")[1] ?? "");
  return name ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${w}` : null;
};

/* ── 1. strange places ───────────────────────────────────────────── */

/** Wikidata class → our category. Order matters: the first match wins. */
const CLASSES = [
  ["Q83471", "geyser"],
  ["Q3497768", "lakebed"], // dry lake
  ["Q935277", "lakebed"], // salt pan
  ["Q954501", "arch"], // natural arch
  ["Q488416", "volcanic"], // lava field
  ["Q1806785", "volcanic"], // cinder cone
  ["Q653139", "volcanic"], // volcanic plug
  ["Q15427433", "volcanic"], // columnar jointing
  ["Q1744266", "canyon"], // slot canyon
  ["Q372934", "erratic"], // glacial erratic
  ["Q25391", "dune"], // sand dune
  ["Q854550", "rock"], // hoodoo
  ["Q6554910", "rock"], // butte
  ["Q623319", "rock"], // mesa
  ["Q1139493", "rock"], // inselberg
  ["Q631305", "rock"], // rock formation
];

// one class per query — all of them at once hits Wikidata's 60 s limit
const placeQuery = (q) => `
SELECT ?i ?iLabel ?iDescription ?coord ?cls ?img ?article ?stateLabel WHERE {
  VALUES ?cls { wd:${q} }
  ?i wdt:P31/wdt:P279* ?cls; wdt:P17 wd:Q30; wdt:P625 ?coord.
  OPTIONAL { ?i wdt:P18 ?img. }
  OPTIONAL { ?article schema:about ?i; schema:isPartOf <https://en.wikipedia.org/>. }
  OPTIONAL { ?i wdt:P131+ ?state. ?state wdt:P31 wd:Q35657. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

const rows = [];
for (const [q] of CLASSES) {
  rows.push(...(await sparql(placeQuery(q))));
  await sleep(800);
}
const rank = Object.fromEntries(CLASSES.map(([q], i) => [q, i]));
const places = new Map();
for (const r of rows) {
  const id = r.i.value.split("/").pop();
  const cls = r.cls.value.split("/").pop();
  const [lng, lat] = r.coord.value.replace(/^Point\(|\)$/g, "").split(" ").map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
  const name = r.iLabel.value;
  if (/^Q\d+$/.test(name)) continue; // no English label
  const prev = places.get(id);
  if (prev && rank[prev.cls] <= rank[cls]) {
    if (!prev.properties.image && r.img) prev.properties.image = thumb(r.img.value);
    continue;
  }
  places.set(id, {
    cls,
    type: "Feature",
    id,
    geometry: { type: "Point", coordinates: [round(lng), round(lat)] },
    properties: {
      id,
      name,
      desc: r.iDescription?.value ?? "",
      cat: Object.fromEntries(CLASSES)[cls],
      state: r.stateLabel?.value ?? prev?.properties.state ?? null,
      image: r.img ? thumb(r.img.value) : prev?.properties.image ?? null,
      wiki: r.article?.value ?? null,
    },
  });
}
const placeFeatures = [...places.values()].map(({ cls, ...f }) => f);
const cats = {};
for (const f of placeFeatures) cats[f.properties.cat] = (cats[f.properties.cat] ?? 0) + 1;
console.log(`strange places: ${placeFeatures.length}`, cats);

/* ── 2. confirmed impact structures ──────────────────────────────── */

const wt = (await (await fetch("https://en.wikipedia.org/w/api.php?action=parse&page=List_of_impact_structures_on_Earth&prop=wikitext&format=json&formatversion=2", { headers: UA })).json()).parse.wikitext;
const confirmed = wt.slice(wt.indexOf("==Confirmed impact structures"), wt.indexOf("== Inferred impact events"));

const stripTemplates = (s) =>
  s
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[\s\S]*?<\/ref>/g, "")
    .replace(/\{\{0\|[^}]*\}\}/g, "")
    .replace(/\{\{sort\|[^|}]*\|([^}]*)\}\}/gi, "$1")
    .replace(/\{\{align\|[^|]*\|([\s\S]*)\}\}/gi, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/style="[^"]*"\|/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .trim();

/** {{coord|23|18|17|N|111|48|49|E}} / {{coord|21|30|N|50|28|E|}} / decimal → [lng, lat] */
function parseCoord(cell) {
  const m = cell.match(/\{\{coord\|([^}]*)\}\}/i);
  if (!m) return null;
  const parts = m[1].split("|").map((p) => p.trim()).filter((p) => p && !p.includes("="));
  const ns = parts.findIndex((p) => p === "N" || p === "S");
  if (ns < 0) {
    const [a, b] = parts.map(Number);
    return Number.isFinite(a) && Number.isFinite(b) ? [b, a] : null;
  }
  const ew = parts.findIndex((p, i) => i > ns && (p === "E" || p === "W"));
  const dms = (arr) => arr.reduce((acc, v, i) => acc + Number(v) / 60 ** i, 0);
  let lat = dms(parts.slice(0, ns));
  let lng = dms(parts.slice(ns + 1, ew));
  if (parts[ns] === "S") lat = -lat;
  if (parts[ew] === "W") lng = -lng;
  return Number.isFinite(lat) && Number.isFinite(lng) ? [round(lng), round(lat)] : null;
}

const num = (s) => {
  const m = stripTemplates(s).replace(/,/g, "").match(/[\d.]+/);
  return m ? Number(m[0]) : null;
};

/** Split a cell into its attributes (rowspan="2" …) and content. Pipes inside [[…]] / {{…}} don't count. */
function splitCell(raw) {
  const m = raw.match(/^\s*((?:[a-z-]+\s*=\s*"[^"]*"\s*)+)\|(?!\|)([\s\S]*)$/i);
  if (!m) return { attrs: "", content: raw.trim() };
  return { attrs: m[1], content: m[2].trim() };
}

const columnKey = (h) => {
  const t = h.toLowerCase();
  if (t.includes("name")) return "name";
  if (t.includes("location")) return "location";
  if (t.includes("country")) return "country";
  if (t.includes("diameter")) return "diameter";
  if (t.includes("age")) return "age";
  if (t.includes("coord")) return "coord";
  if (t.includes("date")) return "date";
  return "other";
};

const craters = [];
for (const table of confirmed.split("{|").slice(1)) {
  const body = table.slice(0, table.indexOf("\n|}") >= 0 ? table.indexOf("\n|}") : undefined);
  const [head, ...rowBlocks] = body.split("\n|-");
  const cols = head
    .split("\n")
    .filter((l) => l.startsWith("!"))
    .flatMap((l) => l.slice(1).split("!!"))
    .map((h) => columnKey(stripTemplates(h.replace(/<br\s*\/?>/g, " "))));
  if (!cols.includes("name") || !cols.includes("diameter")) continue;
  // the young tables give ages in ka, the old ones in millions of years: normalise to Ma
  const ageScale = /(ka)/i.test(head) ? 0.001 : 1;
  const ageUnit = ageScale === 1 ? "Ma" : "ka";
  // rowspan carry-over per column
  const carry = cols.map(() => ({ value: "", left: 0 }));
  for (const block of rowBlocks) {
    const cells = block
      .replace(/<ref[^>]*\/>/g, "")
      .replace(/<ref[\s\S]*?<\/ref>/g, "")
      .split("\n|")
      .slice(1)
      .flatMap((c) => c.split("||"))
      .map(splitCell);
    const row = {};
    let ci = 0;
    cols.forEach((col, k) => {
      if (carry[k].left > 0) {
        row[col] = carry[k].value;
        carry[k].left--;
        return;
      }
      const cell = cells[ci++];
      if (!cell) return;
      row[col] = cell.content;
      const span = cell.attrs.match(/rowspan\s*=\s*"(\d+)"/i);
      if (span) carry[k] = { value: cell.content, left: Number(span[1]) - 1 };
    });
    if (!row.name) continue;
    const link = row.name.match(/\[\[([^\]|#]+)/);
    const name = stripTemplates(row.name);
    if (!name) continue;
    craters.push({
      title: link ? link[1].trim() : null,
      name,
      location: row.location ? stripTemplates(row.location) || null : null,
      country: row.country ? stripTemplates(row.country) || null : null,
      diameterKm: row.diameter ? num(row.diameter) : null,
      ageMa: row.age && num(row.age) != null ? +(num(row.age) * ageScale).toPrecision(6) : null,
      ageText: row.age ? `${stripTemplates(row.age)} ${ageUnit}` : "",
      coord: row.coord ? parseCoord(row.coord) : null,
    });
  }
}

// article titles → Wikidata ids (+ coordinates when the table has none, + photos)
const titles = craters.map((c) => c.title).filter(Boolean);
const qidOf = new Map();
for (let i = 0; i < titles.length; i += 50) {
  const batch = titles.slice(i, i + 50);
  const j = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&titles=${encodeURIComponent(batch.join("|"))}&format=json&formatversion=2`, { headers: UA })).json();
  const redirect = new Map((j.query.redirects ?? []).map((r) => [r.from, r.to]));
  const normal = new Map((j.query.normalized ?? []).map((r) => [r.from, r.to]));
  const byTitle = new Map(j.query.pages.map((p) => [p.title, p.pageprops?.wikibase_item]));
  for (const t of batch) {
    const n = normal.get(t) ?? t;
    const q = byTitle.get(redirect.get(n) ?? n);
    if (q) qidOf.set(t, q);
  }
  await sleep(300);
}
const qids = [...new Set(qidOf.values())];
const extra = new Map();
for (let i = 0; i < qids.length; i += 80) {
  const vals = qids.slice(i, i + 80).map((q) => `wd:${q}`).join(" ");
  const res = await sparql(`SELECT ?i ?img ?coord WHERE { VALUES ?i { ${vals} } OPTIONAL { ?i wdt:P18 ?img. } OPTIONAL { ?i wdt:P625 ?coord. } }`);
  for (const r of res) {
    const q = r.i.value.split("/").pop();
    const e = extra.get(q) ?? {};
    if (r.img && !e.image) e.image = thumb(r.img.value);
    if (r.coord && !e.coord) {
      const [lng, lat] = r.coord.value.replace(/^Point\(|\)$/g, "").split(" ").map(Number);
      if (Number.isFinite(lng)) e.coord = [round(lng), round(lat)];
    }
    extra.set(q, e);
  }
  await sleep(500);
}

// some rows share one article (Clearwater East + West, Lockne + Malingen…): those need their own ids,
// and must never borrow the article's single coordinate (that put Kamenetsk, Ukraine, on Kamensk, Russia)
const rowsPerQid = new Map();
for (const c of craters) {
  const q = c.title ? qidOf.get(c.title) : null;
  if (q) rowsPerQid.set(q, (rowsPerQid.get(q) ?? 0) + 1);
}
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const impactFeatures = [];
for (const c of craters) {
  const q = c.title ? qidOf.get(c.title) : null;
  const e = q ? extra.get(q) ?? {} : {};
  const shared = q && rowsPerQid.get(q) > 1;
  const coord = c.coord ?? (shared ? null : e.coord);
  if (!coord) continue;
  const id = !q ? slug(c.name) : shared ? `${q}-${slug(c.name)}` : q;
  impactFeatures.push({
    type: "Feature",
    id,
    geometry: { type: "Point", coordinates: coord },
    properties: {
      id,
      name: c.name,
      location: c.location,
      country: c.country,
      diameterKm: c.diameterKm,
      ageMa: c.ageMa,
      ageText: c.ageText,
      image: e.image ?? null,
      wiki: c.title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(c.title.replace(/ /g, "_"))}` : null,
    },
  });
}
console.log(`confirmed impacts: ${impactFeatures.length} of ${craters.length} rows (with coordinates)`);

/* ── 3. USGS GNIS landforms ──────────────────────────────────────── */

const GNIS = "https://carto.nationalmap.gov/arcgis/rest/services/geonames/MapServer/5/query";
const landforms = [];
for (const cls of ["Arch", "Pillar", "Crater", "Lava"]) {
  for (let offset = 0; ; offset += 2000) {
    const q = new URLSearchParams({
      where: `gaz_featureclass='${cls}'`,
      outFields: "gaz_id,gaz_name,gaz_featureclass,state_alpha",
      outSR: "4326",
      resultOffset: String(offset),
      resultRecordCount: "2000",
      f: "json",
    });
    const j = await (await fetch(`${GNIS}?${q}`)).json();
    for (const f of j.features ?? []) {
      // GNIS serves multipoints: take the (single) point
      const pt = f.geometry?.points?.[0] ?? (Number.isFinite(f.geometry?.x) ? [f.geometry.x, f.geometry.y] : null);
      if (!pt) continue;
      const a = f.attributes;
      landforms.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [round(pt[0]), round(pt[1])] },
        properties: { gnis: a.gaz_id, name: a.gaz_name, cls: cls.toLowerCase(), state: a.state_alpha },
      });
    }
    if ((j.features?.length ?? 0) < 2000) break;
  }
}
const lfCount = {};
for (const f of landforms) lfCount[f.properties.cls] = (lfCount[f.properties.cls] ?? 0) + 1;
console.log(`GNIS landforms: ${landforms.length}`, lfCount);

/* ── write ───────────────────────────────────────────────────────── */

await mkdir(OUT, { recursive: true });
const write = async (file, features, extraProps = {}) => {
  const body = JSON.stringify({ type: "FeatureCollection", generated: new Date().toISOString(), ...extraProps, features });
  await writeFile(path.join(OUT, file), body);
  console.log(`${file}: ${(body.length / 1024).toFixed(0)} KB`);
};
await write("strange.json", placeFeatures);
await write("impacts.json", impactFeatures, { source: "Earth Impact Database (PASSC, University of New Brunswick), via Wikipedia's list of confirmed impact structures" });
await write("landforms.json", landforms, { source: "USGS Geographic Names Information System (GNIS)" });
