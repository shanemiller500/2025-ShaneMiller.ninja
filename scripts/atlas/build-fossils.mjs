/* ------------------------------------------------------------------ */
/*  Bake public/atlas/fossils/ — every fossil collection in the world  */
/*  in the Paleobiology Database (CC BY 4.0, ~278,000): position, age  */
/*  range, geologic period, formation, country and state or province,  */
/*  number of finds, and whether it holds dinosaurs or mammals.        */
/*                                                                     */
/*    t/<x>_<y>.json    every site in a 2° tile, column-wise           */
/*    summary.json      1° cells: sites per period (all / dinosaurs /  */
/*                      mammals) for the zoomed-out map                */
/*    formations.json   each formation's size, extent and tiles        */
/*    index.json        periods, tiles, totals                         */
/*                                                                     */
/*  Each collection's name and taxa load live from PBDB when clicked.  */
/*  node scripts/atlas/build-fossils.mjs [--test]                      */
/*  (downloads cached in FOSSILS_CACHE, default: os tmp)               */
/* ------------------------------------------------------------------ */
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT_DIR = path.join(ROOT, "public/atlas/fossils");
/** The U.S.-only file this replaced. */
const OLD_OUT = path.join(ROOT, "public/atlas/fossils.json");
const CACHE = process.env.FOSSILS_CACHE ?? path.join(os.tmpdir(), "fossils-cache");
export const TILE_DEG = 2;
export const CELL_DEG = 1;
export const tileKey = (lng, lat) => `${Math.floor(lng / TILE_DEG)}_${Math.floor(lat / TILE_DEG)}`;
const API = "https://paleobiodb.org/data1.2";
const UA = { "User-Agent": "shanemiller.ninja atlas (+https://shanemiller.ninja)" };

/** Geologic periods (International Commission on Stratigraphy chart), oldest last; colours are the ICS chart's. */
export const PERIODS = [
  { key: "quaternary", label: "Quaternary", start: 2.58, color: "#F9F97F" },
  { key: "neogene", label: "Neogene", start: 23.03, color: "#FFE619" },
  { key: "paleogene", label: "Paleogene", start: 66, color: "#FD9A52" },
  { key: "cretaceous", label: "Cretaceous", start: 145, color: "#7FC64E" },
  { key: "jurassic", label: "Jurassic", start: 201.4, color: "#34B2C9" },
  { key: "triassic", label: "Triassic", start: 251.9, color: "#812B92" },
  { key: "permian", label: "Permian", start: 298.9, color: "#F04028" },
  { key: "carboniferous", label: "Carboniferous", start: 358.9, color: "#67A599" },
  { key: "devonian", label: "Devonian", start: 419.2, color: "#CB8C37" },
  { key: "silurian", label: "Silurian", start: 443.8, color: "#B3E1B6" },
  { key: "ordovician", label: "Ordovician", start: 485.4, color: "#009270" },
  { key: "cambrian", label: "Cambrian", start: 538.8, color: "#7FA056" },
  { key: "precambrian", label: "Precambrian", start: 4600, color: "#F74370" },
];
/** The period a collection falls in, by the midpoint of its age range. */
export const periodIndex = (maxMa, minMa) => {
  const mid = (maxMa + minMa) / 2;
  const i = PERIODS.findIndex((p) => mid <= p.start);
  return i < 0 ? PERIODS.length - 1 : i;
};

const STATE_NAMES = ["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont","Virginia","Washington","West Virginia","Wisconsin","Wyoming","District of Columbia","Puerto Rico","Virgin Islands"];
const lev = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
/** PBDB's free-text state: fix case, stray spaces and typos ("Pennsylvannia", "Texax"); multi-state entries become "Iowa, Illinois". Anything else stays as entered. */
export function normState(raw) {
  if (!raw) return null;
  const one = (p) => {
    const t = p.trim().toLowerCase();
    if (!t) return null;
    let best = null;
    let bd = Infinity;
    for (const n of STATE_NAMES) {
      const d = lev(t, n.toLowerCase());
      if (d < bd) [best, bd] = [n, d];
    }
    return bd === 0 || (bd <= 2 && t.length >= 5) ? best : null;
  };
  const parts = raw.split(/\s*(?:,|\/|\band\b|-(?=[A-Z]))\s*/).map((p) => p.replace(/^and\s+/i, "")).filter((p) => p.trim());
  const names = parts.map(one);
  if (names.length && names.every(Boolean)) return Array.from(new Set(names)).join(", ");
  const t = raw.trim();
  return t && t.toLowerCase() !== "unknown" ? t : null;
}

async function json(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: UA });
    if (res.ok) return res.json();
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
  throw new Error(`PBDB failed: ${url}`);
}

if (process.argv.includes("--test")) {
  for (const [a, b] of [["Pennsylvannia", "Pennsylvania"], ["Texax", "Texas"], ["oregon", "Oregon"], ["Wyoming ", "Wyoming"], ["Idaho/ Utah", "Idaho, Utah"], ["Wyoming-Montana", "Wyoming, Montana"], ["Montana, and Wyoming", "Montana, Wyoming"], ["West Virginia, Maryland, and Pennyslvania", "West Virginia, Maryland, Pennsylvania"], ["British Columbia", "British Columbia"], ["Unknown", null], ["Iowa", "Iowa"], ["Ohio", "Ohio"], ["Utah", "Utah"]]) {
    const got = normState(a);
    console.log(got === b ? "ok  " : "FAIL", JSON.stringify(a), "→", JSON.stringify(got));
  }
} else if (!process.argv.includes("--no-fetch")) {
  /* ── the whole world, cached so re-runs don't refetch 85 MB ─────── */
  await mkdir(CACHE, { recursive: true });
  const cached = async (name, url) => {
    const f = path.join(CACHE, name);
    if (existsSync(f)) return JSON.parse(await readFile(f, "utf8"));
    console.log(`fetching ${url}…`);
    const j = await json(url);
    await writeFile(f, JSON.stringify(j));
    return j;
  };
  const all = (await cached("colls.json", `${API}/colls/list.json?all_records&show=loc,strat&limit=all`)).records;
  const dinos = new Set((await cached("Dinosauria.json", `${API}/colls/list.json?base_name=Dinosauria&limit=all`)).records.map((r) => r.oid));
  const mammals = new Set((await cached("Mammalia.json", `${API}/colls/list.json?base_name=Mammalia&limit=all`)).records.map((r) => r.oid));
  console.log(`collections ${all.length}, with dinosaurs ${dinos.size}, with mammals ${mammals.size}`);

  const regionName = new Intl.DisplayNames(["en"], { type: "region" });
  const country = (cc) => {
    if (!cc || !/^[A-Z]{2}$/.test(cc)) return "";
    try {
      return regionName.of(cc) ?? cc;
    } catch {
      return cc;
    }
  };

  const tiles = new Map();
  const tile = (key) => {
    if (!tiles.has(key)) tiles.set(key, { dict: [], at: new Map(), cols: { id: [], lng: [], lat: [], n: [], max: [], min: [], per: [], fm: [], cc: [], st: [], flag: [] } });
    return tiles.get(key);
  };
  const word = (t, s) => {
    if (!s) return -1;
    if (!t.at.has(s)) {
      t.at.set(s, t.dict.length);
      t.dict.push(s);
    }
    return t.at.get(s);
  };
  const cells = new Map();
  const formations = new Map();
  const countries = new Set();
  let finds = 0;
  let dropped = 0;
  for (const r of all) {
    const lng = Number(r.lng);
    const lat = Number(r.lat);
    const max = Number(r.eag);
    const min = Number(r.lag);
    if (![lng, lat, max, min].every(Number.isFinite) || Math.abs(lng) > 180 || Math.abs(lat) > 90 || (lng === 0 && lat === 0)) {
      dropped++;
      continue;
    }
    // round first, so the stored position and its tile always agree
    const [x, y] = [Math.round(lng * 1000) / 1000, Math.round(lat * 1000) / 1000];
    const key = tileKey(x, y);
    const t = tile(key);
    const per = periodIndex(max, min);
    const flag = (dinos.has(r.oid) ? 1 : 0) | (mammals.has(r.oid) ? 2 : 0);
    const c = t.cols;
    c.id.push(Number(String(r.oid).replace(/^col:/, "")));
    c.lng.push(x);
    c.lat.push(y);
    c.n.push(Number(r.noc) || 0);
    c.max.push(Math.round(max * 10) / 10);
    c.min.push(Math.round(min * 10) / 10);
    c.per.push(per);
    const fmName = (r.sfm ?? "").replace(/^"|"$/g, "").trim();
    c.fm.push(word(t, fmName));
    const nation = country(r.cc2);
    if (nation) countries.add(nation);
    c.cc.push(word(t, nation));
    // U.S. states are free text in PBDB: clean them; elsewhere keep the province as entered
    c.st.push(word(t, r.cc2 === "US" ? normState(r.stp) : (r.stp ?? "").trim()));
    c.flag.push(flag);
    finds += Number(r.noc) || 0;

    /* the zoomed-out summary: per 1° cell, sites per period — all, with dinosaurs, with mammals */
    const ck = `${Math.floor(x / CELL_DEG)}_${Math.floor(y / CELL_DEG)}`;
    if (!cells.has(ck)) cells.set(ck, { x: Math.floor(x / CELL_DEG), y: Math.floor(y / CELL_DEG), n: PERIODS.map(() => 0), d: PERIODS.map(() => 0), m: PERIODS.map(() => 0) });
    const cell = cells.get(ck);
    cell.n[per]++;
    if (flag & 1) cell.d[per]++;
    if (flag & 2) cell.m[per]++;

    /* formations: where they are, for "every site in this formation" */
    if (fmName) {
      if (!formations.has(fmName)) formations.set(fmName, { n: 0, per: PERIODS.map(() => 0), tiles: new Set(), w: 180, s: 90, e: -180, nn: -90 });
      const f = formations.get(fmName);
      f.n++;
      f.per[per]++;
      f.tiles.add(key);
      f.w = Math.min(f.w, x);
      f.e = Math.max(f.e, x);
      f.s = Math.min(f.s, y);
      f.nn = Math.max(f.nn, y);
    }
  }

  /* write */
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(path.join(OUT_DIR, "t"), { recursive: true });
  const tileKeys = [...tiles.keys()].sort();
  const tileIdx = new Map(tileKeys.map((k, i) => [k, i]));
  let bytes = 0;
  for (const k of tileKeys) {
    const { dict, cols } = tiles.get(k);
    const body = JSON.stringify({ dict, cols });
    bytes += body.length;
    await writeFile(path.join(OUT_DIR, "t", `${k}.json`), body);
  }
  const cl = [...cells.values()];
  // sparse rows: [period, all, dinosaurs, mammals] for each period present
  const summary = { cell: CELL_DEG, x: cl.map((c) => c.x), y: cl.map((c) => c.y), rows: cl.map((c) => PERIODS.flatMap((_, p) => (c.n[p] ? [[p, c.n[p], c.d[p], c.m[p]]] : []))) };
  const fl = [...formations.entries()].sort((a, b) => b[1].n - a[1].n);
  const formationsOut = {
    tiles: tileKeys,
    name: fl.map(([n]) => n),
    n: fl.map(([, f]) => f.n),
    per: fl.map(([, f]) => f.per.indexOf(Math.max(...f.per))),
    bbox: fl.map(([, f]) => [f.w, f.s, f.e, f.nn]),
    t: fl.map(([, f]) => [...f.tiles].map((k) => tileIdx.get(k))),
  };
  const counts = {
    sites: tileKeys.reduce((a, k) => a + tiles.get(k).cols.id.length, 0),
    finds,
    dino: tileKeys.reduce((a, k) => a + tiles.get(k).cols.flag.filter((f) => f & 1).length, 0),
    mammal: tileKeys.reduce((a, k) => a + tiles.get(k).cols.flag.filter((f) => f & 2).length, 0),
    countries: countries.size,
    formations: fl.length,
  };
  await writeFile(
    path.join(OUT_DIR, "index.json"),
    JSON.stringify({ generated: new Date().toISOString(), source: "The Paleobiology Database (paleobiodb.org), CC BY 4.0", periods: PERIODS, tile: TILE_DEG, tiles: Object.fromEntries(tileKeys.map((k) => [k, tiles.get(k).cols.id.length])), counts })
  );
  await writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(summary));
  await writeFile(path.join(OUT_DIR, "formations.json"), JSON.stringify(formationsOut));
  await rm(OLD_OUT, { force: true });
  console.log(`fossils: ${counts.sites} sites in ${counts.countries} countries (${dropped} without a position or age dropped) · ${tileKeys.length} tiles ${(bytes / 1048576).toFixed(1)} MB · ${cl.length} summary cells · ${fl.length} formations`, counts);
}
