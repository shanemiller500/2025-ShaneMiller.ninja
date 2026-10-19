/* ------------------------------------------------------------------ */
/*  Bake Lost Mines data from two public-domain federal registers:     */
/*                                                                     */
/*  • USGS Mineral Resources Data System (MRDS) — 266,000+ U.S. mines, */
/*    prospects and occurrences, and 38,000 more in 167 other          */
/*    countries (thinner coverage abroad). USGS stopped updating it in 2011, so  */
/*    "Producer" means producing when the record was written.          */
/*  • MSHA Mines data set — every mine the Mine Safety and Health      */
/*    Administration has on file, with its current status and the date */
/*    it was set. We keep coal and metal-ore mines (MRDS already       */
/*    covers sand, gravel and stone).                                  */
/*                                                                     */
/*  Writes public/atlas/mines/:                                        */
/*    summary.json      0.5° cells for the zoomed-out view             */
/*    index.json        which 2° tiles exist, with counts              */
/*    t/<x>_<y>.json    every site in a 2° tile, column-wise           */
/*                                                                     */
/*  node scripts/atlas/build-mines.mjs [--test]                        */
/*  Downloads are cached in MINES_CACHE (default: os tmp).             */
/* ------------------------------------------------------------------ */
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "public/atlas/mines");
const CACHE = process.env.MINES_CACHE ?? path.join(os.tmpdir(), "mines-cache");
const UA = { "User-Agent": "shanemiller.ninja atlas (+https://shanemiller.ninja)" };
const MRDS_ZIP = "https://mrdata.usgs.gov/mrds/mrds-csv.zip";
const MSHA_ZIP = "https://arlweb.msha.gov/OpenGovernmentData/DataSets/Mines.zip";
export const TILE_DEG = 2;
export const CELL_DEG = 0.5;

/* ── commodity groups (colours live in utils/geo/mines.ts) ─────────── */

export const GROUPS = ["gold", "silver", "copper", "leadzinc", "iron", "uranium", "mercury", "othermetal", "coal", "industrial", "other"];
const G = Object.fromEntries(GROUPS.map((g, i) => [g, i]));
const RULES = [
  [/^gold/i, G.gold],
  [/^silver/i, G.silver],
  [/^copper/i, G.copper],
  [/^(lead|zinc)/i, G.leadzinc],
  [/^(iron|manganese|chromium|nickel|cobalt)/i, G.iron],
  [/^(uranium|vanadium|thorium|radium)/i, G.uranium],
  [/^mercury/i, G.mercury],
  [/^coal/i, G.coal],
  [/^(tungsten|molybdenum|antimony|tin|platinum|pge|palladium|beryllium|bismuth|tantalum|niobium|columbium|titanium|aluminum|bauxite|arsenic|cadmium|lithium|rare earth|ree|cesium|rhenium|tellurium|gallium|germanium|indium|selenium|zirconium|magnesium|metal)/i, G.othermetal],
];
/** Group of a commodity name ("Gold", "Lead", "Sand and Gravel, Construction"…). */
export function groupOf(name, comType = "") {
  const n = (name ?? "").trim();
  for (const [re, g] of RULES) if (re.test(n)) return g;
  if (!n) return comType === "M" ? G.othermetal : G.other;
  return comType === "M" ? G.othermetal : G.industrial;
}
/** MSHA SIC description → group, or null for the aggregates and stone we leave to MRDS. */
export function mshaGroup(coalMetal, sic) {
  if (coalMetal === "C") return G.coal;
  const s = sic ?? "";
  if (/Gold Ore/i.test(s)) return G.gold;
  if (/Silver Ore/i.test(s)) return G.silver;
  if (/Copper Ore/i.test(s)) return G.copper;
  if (/Lead.?Zinc|Lead Ore|Zinc Ore/i.test(s)) return G.leadzinc;
  if (/Iron Ore|Manganese|Chrom/i.test(s)) return G.iron;
  if (/Uranium|Vanadium/i.test(s)) return G.uranium;
  if (/Mercury/i.test(s)) return G.mercury;
  if (/Ore|Metal/i.test(s)) return G.othermetal;
  return null;
}

export const MRDS_STATUS = ["Producer", "Past Producer", "Prospect", "Occurrence", "Plant", "Unknown"];
export const mrdsStatus = (s) => {
  const i = MRDS_STATUS.indexOf((s ?? "").trim());
  return i < 0 ? MRDS_STATUS.length - 1 : i;
};

/* ── CSV / text helpers ────────────────────────────────────────────── */

export function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
/** "TOMBSTONE CONSOLIDATED" → "Tombstone Consolidated"; mixed case is left alone. */
export function tidyName(s) {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (!t || t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Of|And|The|In|On|At)\b/g, (w) => w.toLowerCase()).replace(/^./, (c) => c.toUpperCase());
}
/** A year, or 0. MRDS years are free text ("1934", "ca. 1890", "1880s"). */
export function year(s) {
  const m = /(1[5-9]\d\d|20[0-2]\d)/.exec(s ?? "");
  return m ? Number(m[1]) : 0;
}
/** MSHA "03/23/2007" → "2007-03-23". */
export function mshaDate(s) {
  const m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec((s ?? "").trim());
  return m ? `${m[3]}-${m[1]}-${m[2]}` : "";
}
/** Commodity list: "Gold, Silver; Lead" from MRDS's commod1..3 (major, minor, trace — trace dropped). */
export function commodText(c1, c2) {
  const major = (c1 ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const minor = (c2 ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return [major.join(", "), minor.join(", ")].filter(Boolean).join("; ");
}
/** Worth putting in search: not blank, "Unnamed…" or "Unknown". */
export const isNamed = (s) => !!s && !/^(unnamed|unknown|no name|none)\b/i.test(s.trim());
/** The earliest year we know a site for: discovered (kind 0) or, failing that, first produced (kind 1). */
export function firstYear(disc, first) {
  if (disc && (!first || disc <= first)) return { year: disc, kind: 0 };
  if (first) return { year: first, kind: 1 };
  return null;
}
/** MSHA uses postal codes; MRDS full names — search shows full names. */
export const STATE_NAMES = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia", PR: "Puerto Rico", VI: "U.S. Virgin Islands", GU: "Guam" };

/** Repeated text columns (commodities, counties…) become indexes into one per-tile string list. */
export const DICT_COLS = { mrds: ["com", "op", "county", "state", "country"], msha: ["type", "sic", "county", "state"] };
export function dictEncode(tile) {
  const dict = [];
  const at = new Map();
  const idx = (s) => {
    if (!at.has(s)) {
      at.set(s, dict.length);
      dict.push(s);
    }
    return at.get(s);
  };
  const out = { dict };
  for (const [src, cols] of Object.entries(DICT_COLS)) {
    out[src] = { ...tile[src] };
    for (const c of cols) out[src][c] = tile[src][c].map(idx);
  }
  return out;
}
export const tileKey = (lng, lat) => `${Math.floor(lng / TILE_DEG)}_${Math.floor(lat / TILE_DEG)}`;
const inUS = (lng, lat) => ((lng >= -180 && lng <= -64) || lng >= 144) && lat >= 13 && lat <= 72;

/* ── download + unzip (cached) ─────────────────────────────────────── */

async function cachedZipText(url, inner) {
  await mkdir(CACHE, { recursive: true });
  const zipFile = path.join(CACHE, path.basename(new URL(url).pathname));
  if (!existsSync(zipFile)) {
    console.log(`downloading ${url}…`);
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    await writeFile(zipFile, Buffer.from(await res.arrayBuffer()));
  }
  const { unzipSync } = await import("fflate");
  const files = unzipSync(new Uint8Array(await readFile(zipFile)), { filter: (f) => f.name.toLowerCase() === inner.toLowerCase() });
  const buf = Object.values(files)[0];
  if (!buf) throw new Error(`${inner} not in ${zipFile}`);
  return Buffer.from(buf);
}

/* ── main ──────────────────────────────────────────────────────────── */

if (process.argv.includes("--test")) {
  const t = (got, want, label) => console.log(JSON.stringify(got) === JSON.stringify(want) ? "ok  " : "FAIL", label, JSON.stringify(got));
  t(groupOf("Gold"), G.gold, "gold");
  t(groupOf("Lead, Silver"), G.leadzinc, "lead first");
  t(groupOf("Sand and Gravel, Construction", "N"), G.industrial, "gravel");
  t(groupOf("Tungsten", "M"), G.othermetal, "tungsten");
  t(groupOf("", "M"), G.othermetal, "blank metal");
  t(mshaGroup("C", "Coal (Bituminous)"), G.coal, "msha coal");
  t(mshaGroup("M", "Gold Ore"), G.gold, "msha gold");
  t(mshaGroup("M", "Construction Sand and Gravel"), null, "msha gravel skipped");
  t(tidyName("TOMBSTONE CONSOLIDATED"), "Tombstone Consolidated", "case");
  t(tidyName("Hy Grade Placer"), "Hy Grade Placer", "mixed case kept");
  t(tidyName("MINE OF THE WEST"), "Mine of the West", "small words");
  t(year("ca. 1890s"), 1890, "year");
  t(year(""), 0, "no year");
  t(mshaDate("03/23/2007"), "2007-03-23", "date");
  t(commodText("Gold", "Silver, Lead"), "Gold; Silver, Lead", "commodities");
  t(parseCsvLine('1,"a, ""b""",c'), ["1", 'a, "b"', "c"], "csv");
  t(tileKey(-119.0, 38.2), "-60_19", "tile");
  t(isNamed("Unnamed Prospect"), false, "unnamed");
  t(isNamed("Homestake Mine"), true, "named");
  t(firstYear(1876, 1878), { year: 1876, kind: 0 }, "discovered first");
  t(firstYear(0, 1903), { year: 1903, kind: 1 }, "first production only");
  t(firstYear(0, 0), null, "no year");
} else {
  /* MRDS */
  const mrdsText = (await cachedZipText(MRDS_ZIP, "mrds.csv")).toString("utf8");
  const lines = mrdsText.split(/\r?\n/);
  const head = parseCsvLine(lines[0]);
  const col = (k) => head.indexOf(k);
  const C = Object.fromEntries(["dep_id", "site_name", "latitude", "longitude", "country", "state", "county", "com_type", "commod1", "commod2", "oper_type", "dep_type", "prod_size", "dev_stat", "disc_yr", "yr_fst_prd", "yr_lst_prd"].map((k) => [k, col(k)]));
  const tiles = new Map();
  const tile = (lng, lat) => {
    const k = tileKey(lng, lat);
    if (!tiles.has(k))
      tiles.set(k, {
        mrds: { id: [], lng: [], lat: [], name: [], g: [], st: [], com: [], op: [], sz: [], disc: [], first: [], last: [], county: [], state: [], country: [] },
        msha: { id: [], lng: [], lat: [], name: [], g: [], st: [], date: [], type: [], sic: [], county: [], state: [] },
      });
    return tiles.get(k);
  };
  const cells = new Map();
  const cell = (lng, lat) => {
    const k = `${Math.floor(lng / CELL_DEG)}_${Math.floor(lat / CELL_DEG)}`;
    if (!cells.has(k)) cells.set(k, { x: Math.floor(lng / CELL_DEG), y: Math.floor(lat / CELL_DEG), n: 0, g: GROUPS.map(() => 0) });
    return cells.get(k);
  };
  let mrdsN = 0;
  let abroad = 0;
  const countries = new Set();
  for (let li = 1; li < lines.length; li++) {
    if (!lines[li]) continue;
    const f = parseCsvLine(lines[li]);
    const lat = Number(f[C.latitude]);
    const lng = Number(f[C.longitude]);
    if (!f[C.latitude] || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) continue;
    const country = f[C.country] || "";
    // a U.S. record placed outside the country is a typo we can't fix — leave it out
    if (country === "United States" && !inUS(lng, lat)) continue;
    const g = groupOf((f[C.commod1] ?? "").split(",")[0], f[C.com_type]);
    // round first, so the stored position and its tile always agree
    const [rx, ry] = [Math.round(lng * 10000) / 10000, Math.round(lat * 10000) / 10000];
    const t = tile(rx, ry).mrds;
    t.id.push(Number(f[C.dep_id]));
    t.lng.push(rx);
    t.lat.push(ry);
    t.name.push(tidyName(f[C.site_name]));
    t.g.push(g);
    const st = mrdsStatus(f[C.dev_stat]);
    t.st.push(st);
    t.com.push(commodText(f[C.commod1], f[C.commod2]));
    t.op.push([f[C.oper_type], f[C.dep_type]].filter((x) => x && x !== "Unknown").join(" · "));
    t.sz.push(f[C.prod_size] ?? "");
    t.disc.push(year(f[C.disc_yr]));
    t.first.push(year(f[C.yr_fst_prd]));
    t.last.push(year(f[C.yr_lst_prd]));
    t.county.push(f[C.county] ?? "");
    t.state.push(f[C.state] ?? "");
    t.country.push(country);
    // the zoomed-out view counts only mines that produced (or still did when recorded)
    if (st <= 1) {
      const c = cell(lng, lat);
      c.n++;
      c.g[g]++;
    }
    mrdsN++;
    if (country && country !== "United States") {
      abroad++;
      countries.add(country);
    }
  }

  /* MSHA */
  const msha = (await cachedZipText(MSHA_ZIP, "Mines.txt")).toString("latin1").split(/\r?\n/).filter(Boolean);
  const mh = msha[0].split("|");
  const mi = (k) => mh.indexOf(k);
  const mshaStatuses = [];
  let mshaN = 0;
  for (const l of msha.slice(1)) {
    const f = l.split("|").map((s) => s.replace(/^"|"$/g, "").trim());
    const lat = Number(f[mi("LATITUDE")]);
    const lng = Number(f[mi("LONGITUDE")]);
    if (!f[mi("LATITUDE")] || !lat || !lng || !inUS(lng, lat)) continue;
    const g = mshaGroup(f[mi("COAL_METAL_IND")], f[mi("PRIMARY_SIC")]);
    if (g == null) continue;
    const status = f[mi("CURRENT_MINE_STATUS")];
    if (!mshaStatuses.includes(status)) mshaStatuses.push(status);
    const [rx, ry] = [Math.round(lng * 10000) / 10000, Math.round(lat * 10000) / 10000];
    const t = tile(rx, ry).msha;
    t.id.push(f[mi("MINE_ID")]);
    t.lng.push(rx);
    t.lat.push(ry);
    t.name.push(tidyName(f[mi("CURRENT_MINE_NAME")]));
    t.g.push(g);
    t.st.push(mshaStatuses.indexOf(status));
    t.date.push(mshaDate(f[mi("CURRENT_STATUS_DT")]));
    t.type.push(f[mi("CURRENT_MINE_TYPE")]);
    t.sic.push(f[mi("PRIMARY_SIC")]);
    t.county.push(f[mi("FIPS_CNTY_NM")]);
    t.state.push(f[mi("STATE")]);
    const c = cell(lng, lat);
    c.n++;
    c.g[g]++;
    mshaN++;
  }

  /* write */
  await rm(OUT, { recursive: true, force: true });
  await mkdir(path.join(OUT, "t"), { recursive: true });
  let bytes = 0;
  const index = {};
  for (const [k, t] of tiles) {
    const body = JSON.stringify(dictEncode(t));
    bytes += body.length;
    index[k] = [t.mrds.id.length, t.msha.id.length];
    await writeFile(path.join(OUT, "t", `${k}.json`), body);
  }
  /* search index (named sites) and the dated sites for the timeline */
  const tileKeys = [...tiles.keys()];
  const states = [];
  const stateIdx = (s) => {
    if (!states.includes(s)) states.push(s);
    return states.indexOf(s);
  };
  const counties = [];
  const countyIdx = (s) => {
    if (!counties.includes(s)) counties.push(s);
    return counties.indexOf(s);
  };
  const names = { tiles: tileKeys, states, counties, name: [], t: [], i: [], src: [], g: [], st: [], state: [], county: [], lng: [], lat: [] };
  const dated = { tiles: tileKeys, t: [], i: [], g: [], y: [], kind: [], lng: [], lat: [] };
  tileKeys.forEach((k, ti) => {
    const { mrds: m, msha: h } = tiles.get(k);
    for (let i = 0; i < m.id.length; i++) {
      if (isNamed(m.name[i])) {
        names.name.push(m.name[i]);
        names.t.push(ti);
        names.i.push(i);
        names.src.push(0);
        names.g.push(m.g[i]);
        names.st.push(m.st[i]);
        // abroad, "where" is the province and the country
        names.state.push(stateIdx(m.country[i] && m.country[i] !== "United States" ? [m.state[i], m.country[i]].filter(Boolean).join(", ") : m.state[i]));
        names.county.push(countyIdx(m.county[i]));
        names.lng.push(Math.round(m.lng[i] * 1000) / 1000);
        names.lat.push(Math.round(m.lat[i] * 1000) / 1000);
      }
      const y = firstYear(m.disc[i], m.first[i]);
      if (y) {
        dated.t.push(ti);
        dated.i.push(i);
        dated.g.push(m.g[i]);
        dated.y.push(y.year);
        dated.kind.push(y.kind);
        dated.lng.push(Math.round(m.lng[i] * 1000) / 1000);
        dated.lat.push(Math.round(m.lat[i] * 1000) / 1000);
      }
    }
    for (let i = 0; i < h.id.length; i++) {
      if (!isNamed(h.name[i])) continue;
      names.name.push(h.name[i]);
      names.t.push(ti);
      names.i.push(i);
      names.src.push(1);
      names.g.push(h.g[i]);
      names.st.push(h.st[i]);
      names.state.push(stateIdx(STATE_NAMES[h.state[i]] ?? h.state[i]));
      names.county.push(countyIdx(h.county[i]));
      names.lng.push(Math.round(h.lng[i] * 1000) / 1000);
      names.lat.push(Math.round(h.lat[i] * 1000) / 1000);
    }
  });
  await writeFile(path.join(OUT, "names.json"), JSON.stringify(names));
  await writeFile(path.join(OUT, "dated.json"), JSON.stringify(dated));
  console.log(`names ${names.name.length} · dated ${dated.y.length}`);

  const cl = [...cells.values()];
  const summary = {
    cell: CELL_DEG,
    // cell centres, total producing sites, and the leading commodity group
    lng: cl.map((c) => (c.x + 0.5) * CELL_DEG),
    lat: cl.map((c) => (c.y + 0.5) * CELL_DEG),
    n: cl.map((c) => c.n),
    g: cl.map((c) => c.g.indexOf(Math.max(...c.g))),
    gold: cl.map((c) => c.g[G.gold]),
  };
  const meta = {
    generated: new Date().toISOString(),
    sources: {
      mrds: "USGS Mineral Resources Data System (no longer updated since 2011), public domain",
      msha: "Mine Safety and Health Administration Mines data set, public domain",
    },
    tile: TILE_DEG,
    groups: GROUPS,
    mrdsStatus: MRDS_STATUS,
    mshaStatus: mshaStatuses,
    counts: { mrds: mrdsN, msha: mshaN, abroad, countries: countries.size },
    tiles: index,
  };
  await writeFile(path.join(OUT, "index.json"), JSON.stringify(meta));
  await writeFile(path.join(OUT, "summary.json"), JSON.stringify(summary));
  console.log(`MRDS ${mrdsN} (${abroad} in ${countries.size} other countries) · MSHA ${mshaN} (coal + metal ore) · ${tiles.size} tiles ${(bytes / 1048576).toFixed(1)} MB · ${cl.length} summary cells`);
  console.log("MSHA statuses", mshaStatuses.join(" | "));
}
