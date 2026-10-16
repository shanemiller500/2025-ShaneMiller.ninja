/* ------------------------------------------------------------------ */
/*  Bake the cave layer for Underground USA from Wikidata (CC0).       */
/*                                                                     */
/*  node scripts/atlas/build-caves.mjs          → public/atlas/caves.json */
/*  node scripts/atlas/build-caves.mjs --report    summary only        */
/*                                                                     */
/*  Cave protection: exact locations are published only for caves the  */
/*  public can visit (show caves and the toured caves of national/     */
/*  state parks — see PUBLIC_EXTRA). Every other cave is snapped to a  */
/*  ~0.1° grid (≈10 km) and flagged `generalized`, so the atlas never  */
/*  becomes a finder for wild or closed caves. (Federal Cave Resources */
/*  Protection Act, 1988.)                                             */
/* ------------------------------------------------------------------ */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas/caves.json");
const REPORT = process.argv.includes("--report");

const QUERY = `
SELECT ?c ?cLabel ?cDescription ?coord ?article
  (GROUP_CONCAT(DISTINCT ?typeLabel; separator="|") AS ?types)
  (SAMPLE(?lenM) AS ?len) (SAMPLE(?depthM) AS ?depth) (SAMPLE(?img) AS ?image)
  (GROUP_CONCAT(DISTINCT ?areaLabel; separator="|") AS ?areas)
  (SAMPLE(?stateLabel) AS ?state)
WHERE {
  ?c wdt:P31/wdt:P279* wd:Q35509;
     wdt:P17 wd:Q30;
     wdt:P625 ?coord;
     wdt:P31 ?type.
  ?type rdfs:label ?typeLabel. FILTER(LANG(?typeLabel) = "en")
  OPTIONAL { ?c p:P2043/psn:P2043/wikibase:quantityAmount ?lenM. }
  OPTIONAL { ?c p:P4511/psn:P4511/wikibase:quantityAmount ?depthM. }
  OPTIONAL { ?c wdt:P18 ?img. }
  OPTIONAL { ?c wdt:P3018 ?area. ?area rdfs:label ?areaLabel. FILTER(LANG(?areaLabel) = "en") }
  OPTIONAL { ?c wdt:P131+ ?st. ?st wdt:P31 wd:Q35657; rdfs:label ?stateLabel. FILTER(LANG(?stateLabel) = "en") }
  OPTIONAL { ?article schema:about ?c; schema:isPartOf <https://en.wikipedia.org/>. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?c ?cLabel ?cDescription ?coord ?article`;

const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(QUERY)}`, {
  headers: { Accept: "application/sparql-results+json", "User-Agent": "shanemiller.ninja atlas (+https://shanemiller.ninja)" },
});
if (!res.ok) throw new Error(`Wikidata: HTTP ${res.status}`);
const rows = (await res.json()).results.bindings;

/* ── classify ─────────────────────────────────────────────────────── */

/** Wikidata types that make an item a real cave for this map. */
const CAVE_TYPES = new Set(["cave", "show cave", "sea cave", "ice cave", "lava tube", "solutional cave", "pit cave", "cave with prehistoric art"]);
/** Items that are tagged "cave" but aren't one we should plot. */
const EXCLUDE = new Set(["Lourdes grotto", "sculpture", "caving incident", "music venue", "amusement park", "city in the United States", "unincorporated community", "mine", "campsite"]);
/** Protected-area / park types that mean "you can visit" when the item itself is the park. */
const PARK = /state park|national park|national monument|state resort park|state historic park|county park|state preserve|National Park System unit/i;

/**
 * State for caves Wikidata has no state for, from an OpenStreetMap reverse-geocode of each
 * cave's coordinates (Oct 2026 check: every cave that DID have a Wikidata state matched OSM).
 */
const STATE_FILL = {
  Q7537893: "Virginia", // Skyline Caverns
  Q7582288: "Indiana", // Squire Boone Caverns
  Q6778143: "Missouri", // Marvel Cave
  Q6886428: "California", // Moaning Cavern
  Q7095191: "Arkansas", // Onyx Cave
  Q7116477: "Missouri", // Ozark Caverns
  Q24896781: "Washington", // Gardner Cave
  Q17098053: "Wisconsin", // Cherney Maribel Caves County Park
  Q5521739: "Virginia", // Gap Cave
  Q5195080: "Missouri", // Current River Cavern
  Q8342992: "California", // Mercer Caverns
  Q16895579: "Arkansas", // Mystic Caverns and Crystal Dome
};

const GRID = 0.1; // ≈ 10 km
const snap = (v) => Math.round(Math.round(v / GRID) * GRID * 10) / 10;
/** Publicly toured caves that Wikidata doesn't tag as show caves (NPS runs daily tours). */
const PUBLIC_EXTRA = new Set(["Q2666855" /* Mammoth Cave, Kentucky */]);
const commonsThumb = (fileUrl) => {
  // http://commons.wikimedia.org/wiki/Special:FilePath/Name.jpg → sized thumbnail via the same endpoint
  const name = decodeURIComponent(fileUrl.split("/Special:FilePath/")[1] ?? "");
  return name ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=800` : null;
};

const seen = new Map();
for (const r of rows) {
  const types = r.types.value.split("|");
  if (!types.some((t) => CAVE_TYPES.has(t) || PARK.test(t))) continue;
  if (types.some((t) => EXCLUDE.has(t))) continue;
  const [lng, lat] = r.coord.value.replace(/^Point\(|\)$/g, "").split(" ").map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
  const qid = r.c.value.split("/").pop();
  const show = types.includes("show cave") || types.some((t) => PARK.test(t)) || PUBLIC_EXTRA.has(qid);
  const archaeo = types.some((t) => /archaeological|prehistoric art|rock shelter|buffalo jump/i.test(t));
  const lava = types.includes("lava tube") || /lava tube/i.test(r.cDescription?.value ?? "");
  const ice = types.includes("ice cave");
  const sea = types.includes("sea cave");
  const kind = lava ? "lava" : show ? "show" : archaeo ? "heritage" : ice ? "ice" : sea ? "sea" : "wild";
  // exact position only where the public is welcome; everything else snaps to the grid
  const exact = show;
  const feature = {
    type: "Feature",
    id: qid,
    geometry: { type: "Point", coordinates: exact ? [Math.round(lng * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4] : [snap(lng), snap(lat)] },
    properties: {
      id: qid,
      name: r.cLabel.value,
      desc: r.cDescription?.value ?? "",
      kind,
      tour: show,
      generalized: !exact,
      state: r.state?.value ?? STATE_FILL[qid] ?? null,
      areas: r.areas.value ? r.areas.value.split("|") : [],
      lengthKm: r.len ? Math.round(Number(r.len.value) / 100) / 10 : null,
      depthM: r.depth ? Math.round(Number(r.depth.value)) : null,
      image: r.image ? commonsThumb(r.image.value) : null,
      wiki: r.article?.value ?? null,
    },
  };
  // the same cave can come back twice (two states, two images): keep the richer row
  const prev = seen.get(qid);
  if (!prev || (!prev.properties.image && feature.properties.image)) seen.set(qid, feature);
}

const features = [...seen.values()].sort((a, b) => Number(a.properties.tour) - Number(b.properties.tour));

if (REPORT) {
  const types = {};
  for (const r of rows) for (const t of r.types.value.split("|")) types[t] = (types[t] ?? 0) + 1;
  console.log("rows", rows.length, types);
  console.log("length", rows.filter((r) => r.len).length, "depth", rows.filter((r) => r.depth).length, "image", rows.filter((r) => r.image).length, "article", rows.filter((r) => r.article).length);
  for (const r of rows.filter((r) => r.len).sort((a, b) => b.len.value - a.len.value).slice(0, 25))
    console.log(`${(r.len.value / 1000).toFixed(1).padStart(7)} km  ${r.c.value.split("/").pop().padEnd(10)} ${r.cLabel.value} | ${r.state?.value ?? "?"} | ${r.types.value} | ${r.areas.value}`);
  const kinds = {};
  for (const f of features) kinds[f.properties.kind] = (kinds[f.properties.kind] ?? 0) + 1;
  console.log("\nkept", features.length, kinds, "exact", features.filter((f) => !f.properties.generalized).length);
  const want = /mammoth cave$|carlsbad cavern$|wind cave|jewel cave|kartchner|luray|timpanogos|oregon caves|mushpot|lewis and clark|lava beds|russell cave|blanchard|marengo|howe caverns|cave of the winds/i;
  for (const f of features.filter((f) => want.test(f.properties.name))) console.log(`  ${f.id.padEnd(10)} ${f.properties.name} | ${f.properties.kind} | ${f.geometry.coordinates} | ${f.properties.state}`);
} else {
  await mkdir(path.dirname(OUT), { recursive: true });
  const body = JSON.stringify({ type: "FeatureCollection", generated: new Date().toISOString(), features });
  await writeFile(OUT, body);
  console.log(`caves.json: ${features.length} caves (${features.filter((f) => !f.properties.generalized).length} exact), ${(body.length / 1024).toFixed(0)} KB`);
}
