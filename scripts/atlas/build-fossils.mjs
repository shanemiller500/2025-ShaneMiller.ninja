/* ------------------------------------------------------------------ */
/*  Bake public/atlas/fossils.json — every fossil collection in the    */
/*  United States in the Paleobiology Database (CC BY 4.0): position,  */
/*  age range, geologic period, formation, state, number of finds,     */
/*  and whether it holds dinosaurs or mammals. Column-wise, with       */
/*  formation and state names in lookup tables; each collection's      */
/*  name and taxa load live from PBDB when it's clicked.               */
/*                                                                     */
/*  node scripts/atlas/build-fossils.mjs                               */
/* ------------------------------------------------------------------ */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas/fossils.json");
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
  console.log("fetching U.S. collections…");
  const all = (await json(`${API}/colls/list.json?cc=US&show=loc,strat&limit=all`)).records;
  const idsWith = async (base) => new Set((await json(`${API}/colls/list.json?cc=US&base_name=${base}&limit=all`)).records.map((r) => r.oid));
  const dinos = await idsWith("Dinosauria");
  const mammals = await idsWith("Mammalia");
  console.log(`collections ${all.length}, with dinosaurs ${dinos.size}, with mammals ${mammals.size}`);

  const formations = [];
  const fIndex = new Map();
  const states = [];
  const sIndex = new Map();
  const idx = (v, list, map) => {
    if (!v) return -1;
    if (!map.has(v)) {
      map.set(v, list.length);
      list.push(v);
    }
    return map.get(v);
  };
  const cols = { id: [], lng: [], lat: [], n: [], max: [], min: [], per: [], fm: [], st: [], flag: [] };
  let outside = 0;
  for (const r of all) {
    const lng = Number(r.lng);
    const lat = Number(r.lat);
    const max = Number(r.eag);
    const min = Number(r.lag);
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || !Number.isFinite(max) || !Number.isFinite(min)) continue;
    // a handful of records are tagged U.S. but sit abroad (a flipped sign, a mislabelled country): leave them out rather than guess
    const inUS = ((lng >= -180 && lng <= -64) || lng >= 144) && lat >= 13 && lat <= 72;
    if (!inUS) {
      outside++;
      continue;
    }
    cols.id.push(Number(String(r.oid).replace(/^col:/, "")));
    cols.lng.push(Math.round(lng * 1000) / 1000);
    cols.lat.push(Math.round(lat * 1000) / 1000);
    cols.n.push(Number(r.noc) || 0);
    cols.max.push(Math.round(max * 10) / 10);
    cols.min.push(Math.round(min * 10) / 10);
    cols.per.push(periodIndex(max, min));
    cols.fm.push(idx(r.sfm, formations, fIndex));
    cols.st.push(idx(normState(r.stp), states, sIndex));
    cols.flag.push((dinos.has(r.oid) ? 1 : 0) | (mammals.has(r.oid) ? 2 : 0));
  }
  const body = JSON.stringify({
    generated: new Date().toISOString(),
    source: "The Paleobiology Database (paleobiodb.org), CC BY 4.0",
    periods: PERIODS,
    formations,
    states,
    cols,
  });
  await writeFile(OUT, body);
  const byPer = {};
  for (const p of cols.per) byPer[PERIODS[p].label] = (byPer[PERIODS[p].label] ?? 0) + 1;
  console.log(`fossils.json: ${cols.id.length} collections (${outside} outside the U.S. dropped), ${formations.length} formations, ${(body.length / 1024 / 1024).toFixed(1)} MB`, byPer);
}
