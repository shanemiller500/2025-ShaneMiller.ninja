/* ------------------------------------------------------------------ */
/*  Bake the Prehistoric Earth time machine:                             */
/*                                                                     */
/*  1. public/atlas/paleo/<age>.webp — Earth's land and seas at each   */
/*     of the 109 PALEOMAP PaleoDEMs (Scotese & Wright 2018, CC BY     */
/*     4.0, 6-arc-minute grids, 540 Ma → today), drawn as a Web        */
/*     Mercator image with depth/elevation colours and hillshade.      */
/*  2. public/atlas/paleo/<age>.json — the world's fossil sites from   */
/*     that time at their ancient positions (grouped by spot), and     */
/*     today's coastlines moved back with them. Positions come from    */
/*     the GPlates Web Service using the same PALEOMAP plate model, so */
/*     dots, coastlines and map line up.                               */
/*  3. public/atlas/paleo/index.json — the list of time slices.        */
/*                                                                     */
/*  PALEODEM_DIR=<folder of the 6-min .nc files>                       */
/*  node scripts/atlas/build-paleo.mjs [--images] [--points] [--test]  */
/*  (no flag = both). GPlates answers are cached in PALEO_CACHE        */
/*  (default: os tmp) so re-runs don't hit the service again.          */
/* ------------------------------------------------------------------ */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "public/atlas/paleo");
const CACHE = process.env.PALEO_CACHE ?? path.join(os.tmpdir(), "paleo-cache");
const GWS = "https://gws.gplates.org/reconstruct/reconstruct_points/";
const MODEL = "PALEOMAP";
const UA = { "User-Agent": "shanemiller.ninja atlas (+https://shanemiller.ninja)" };
const NE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const NE_COAST_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_coastline.geojson";
const FOSSIL_DIR = path.join(ROOT, "public/atlas/fossils");
/** Output image size (Web Mercator, ±85.0511°). */
const SIZE = Number(process.env.PALEO_SIZE ?? 2048);
const MAX_LAT = 85.0511287798066;

/* ── time slices from the PaleoDEM file names ─────────────────────── */

/** "Map21_PALEOMAP_6min_Mid-Cretaceous_90Ma.nc" → { map: "21", age: 90, label: "Mid-Cretaceous" } */
export function parseSlice(file) {
  const m = /^Map([\d.]+)_PALEOMAP_[^_]+_(.+)_([\d.]+)Ma\.nc$/.exec(file);
  if (!m) return null;
  return { map: String(Number(m[1])), age: Number(m[3]), label: cleanLabel(m[2]), file };
}

/**
 * Scotese's appendix (shipped with the grids): which stratigraphic stage each map shows.
 * `21,"Mid-Cretaceous  (Turonian , 91.9 Ma)  ",90,26` → { "21": { label: "Mid-Cretaceous", stage: "Turonian", strat: 91.9 } }
 */
export function parseAppendix(text) {
  const out = {};
  for (const row of text.split(/\r\n|\r|\n/)) {
    const m = /^\s*([\d.]+),(?:"([^"]*)"|([^,]*)),([\d.]+)/.exec(row);
    if (!m) continue;
    const desc = (m[2] ?? m[3]).replace(/\s+/g, " ").trim();
    const head = desc.replace(/\s*\(.*$/, "").trim();
    const inner = /\(([^)]*)\)/.exec(desc)?.[1] ?? "";
    const num = /([\d.]+)\s*(Ma|ky)?\s*$/.exec(inner);
    const stage = inner.replace(/,?\s*[\d.]+\s*(Ma|ky)?\s*$/, "").replace(/\s*,\s*/g, ", ").replace(/&/g, " & ").replace(/\s+/g, " ").trim();
    out[String(Number(m[1]))] = {
      label: cleanLabel(head),
      stage: stage && !/^\d/.test(stage) ? stage.charAt(0).toUpperCase() + stage.slice(1) : null,
      strat: num ? (num[2] === "ky" ? Number(num[1]) / 1000 : Number(num[1])) : null,
    };
  }
  return out;
}
const LABELS = {
  "Holocene": "Today",
  "Present-day": "Today",
  "KT Boundary": "End of the Cretaceous",
  "Permo-Triassic Boundary": "End of the Permian",
  "Jurassic/Cretaceous Boundary": "Jurassic–Cretaceous boundary",
  "Paleocene/Eocene Boundary": "Paleocene–Eocene boundary",
  "Early/Middle Carboniferous": "Early–Middle Carboniferous",
  "Early/Middle Cambrian boundary": "Early–Middle Cambrian boundary",
  "Cambrian/Precambrian boundary": "Start of the Cambrian",
  "Permo-Triassic Boundary": "End of the Permian",
  "Devono-Carboniferous Boundary": "Devonian–Carboniferous boundary",
  "Jurassic Cretaceous Boundary": "Jurassic–Cretaceous boundary",
  "Paleocene Eocene Boundary": "Paleocene–Eocene boundary",
  "Cambro-Ordovician Boundary": "Cambrian–Ordovician boundary",
  "EarlyMiddleCarboniferous": "Early–Middle Carboniferous",
  "LatePermian": "Late Permian",
};
export function cleanLabel(raw) {
  const s = raw.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (LABELS[s]) return LABELS[s];
  // "middle Late Miocene" → "Middle Late Miocene"; "late Middle Eocene" → "Late Middle Eocene"
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** Each slice stands for the time halfway to its neighbours. */
export function sliceWindows(ages) {
  const a = [...ages].sort((x, y) => x - y);
  return a.map((age, i) => ({ age, lo: i === 0 ? 0 : (a[i - 1] + age) / 2, hi: i === a.length - 1 ? age + 2.5 : (age + a[i + 1]) / 2 }));
}
/** Fossil collections whose age range overlaps a slice window. */
export function membersOf(cols, w) {
  const out = [];
  for (let i = 0; i < cols.id.length; i++) if (cols.min[i] <= w.hi && cols.max[i] >= w.lo) out.push(i);
  return out;
}
export const fileAge = (age) => String(age).replace(".", "_").padStart(3, "0");

/* ── colours ──────────────────────────────────────────────────────── */

const ramp = (stops) => (v) => {
  if (v <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [b, cb] = stops[i];
    if (v <= b) {
      const [a, ca] = stops[i - 1];
      const t = (v - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t];
    }
  }
  return stops[stops.length - 1][1];
};
// deep ocean → shelf → shallow inland seas (lighter, so seaways stand out)
const SEA = ramp([
  [-6500, [8, 22, 48]],
  [-4000, [14, 38, 74]],
  [-1500, [22, 62, 106]],
  [-200, [36, 104, 146]],
  [-50, [64, 150, 178]],
  [0, [104, 186, 196]],
]);
// lowland green → dry upland → mountains → high peaks
const LAND = ramp([
  [0, [116, 150, 92]],
  [300, [146, 160, 100]],
  [800, [176, 164, 112]],
  [1600, [160, 130, 92]],
  [2800, [128, 100, 78]],
  [4200, [176, 164, 154]],
  [6000, [236, 232, 226]],
]);

/* ── image ────────────────────────────────────────────────────────── */

async function readGrid(file) {
  const h5wasm = (await import("h5wasm/node")).default;
  await h5wasm.ready;
  const f = new h5wasm.File(file, "r");
  // the 1° grids say lat/lon, the 6′ grids latitude/longitude
  const lat = (f.get("lat") ?? f.get("latitude")).value;
  const lon = (f.get("lon") ?? f.get("longitude")).value;
  const z = f.get("z").value; // [lat][lon], lat ascending from −90
  f.close();
  return { nlat: lat.length, nlon: lon.length, lat0: lat[0], dlat: (lat[lat.length - 1] - lat[0]) / (lat.length - 1), lon0: lon[0], dlon: (lon[lon.length - 1] - lon[0]) / (lon.length - 1), z };
}

/** Bilinear sample, wrapping in longitude. */
function sample(g, lng, lat) {
  let x = (lng - g.lon0) / g.dlon;
  const y = Math.min(g.nlat - 1.000001, Math.max(0, (lat - g.lat0) / g.dlat));
  const nx = Math.round(360 / g.dlon); // columns per full turn (the grid repeats −180 at +180)
  x = ((x % nx) + nx) % nx;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const x1 = (x0 + 1) % nx;
  const at = (xx, yy) => {
    const v = g.z[yy * g.nlon + xx];
    return Number.isFinite(v) ? v : -4000;
  };
  return (at(x0, y0) * (1 - tx) + at(x1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x1, y0 + 1) * tx) * ty;
}

export const mercLat = (py, size) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * (py + 0.5)) / size))) * 180) / Math.PI;

async function renderImage(g, size) {
  const elev = new Float32Array(size * size);
  for (let py = 0; py < size; py++) {
    const lat = mercLat(py, size);
    for (let px = 0; px < size; px++) elev[py * size + px] = sample(g, ((px + 0.5) / size) * 360 - 180, lat);
  }
  const rgb = Buffer.alloc(size * size * 3);
  const R = 6371008;
  const lx = -0.5;
  const ly = -0.5;
  const lz = 0.707; // light from the north-west, 45° up
  for (let py = 0; py < size; py++) {
    const lat = mercLat(py, size);
    // ground size of a pixel at this latitude
    const m = ((2 * Math.PI * R) / size) * Math.cos((lat * Math.PI) / 180);
    for (let px = 0; px < size; px++) {
      const i = py * size + px;
      const v = elev[i];
      const l = elev[py * size + ((px - 1 + size) % size)];
      const r = elev[py * size + ((px + 1) % size)];
      const u = elev[Math.max(0, py - 1) * size + px];
      const d = elev[Math.min(size - 1, py + 1) * size + px];
      // the grids are coarse (≈11 km), so exaggerate relief for the shading
      const ex = v >= 0 ? 14 : 4;
      const dzdx = ((r - l) * ex) / (2 * m);
      const dzdy = ((d - u) * ex) / (2 * m);
      const len = Math.hypot(dzdx, dzdy, 1);
      const shade = Math.max(0, (-dzdx * lx - dzdy * ly + lz) / len);
      let [cr, cg, cb] = v >= 0 ? LAND(v) : SEA(v);
      const k = v >= 0 ? 0.55 + 0.6 * shade : 0.8 + 0.28 * shade;
      cr *= k;
      cg *= k;
      cb *= k;
      // a thin dark shoreline where land meets sea
      if ((v >= 0) !== (r >= 0) || (v >= 0) !== (d >= 0)) {
        cr *= 0.55;
        cg *= 0.55;
        cb *= 0.6;
      }
      rgb[i * 3] = Math.max(0, Math.min(255, cr));
      rgb[i * 3 + 1] = Math.max(0, Math.min(255, cg));
      rgb[i * 3 + 2] = Math.max(0, Math.min(255, cb));
    }
  }
  const sharp = (await import("sharp")).default;
  return sharp(rgb, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: 74, effort: 5 }).toBuffer();
}

/* ── GPlates ──────────────────────────────────────────────────────── */

async function reconstruct(points, age) {
  if (age === 0) return points.map((p) => [...p]);
  const out = [];
  for (let s = 0; s < points.length; s += 8000) {
    const chunk = points.slice(s, s + 8000);
    const body = new URLSearchParams({ lons: chunk.map((p) => p[0]).join(","), lats: chunk.map((p) => p[1]).join(","), time: String(age), model: MODEL, return_null_points: "" });
    let res;
    for (let attempt = 1; ; attempt++) {
      res = await fetch(GWS, { method: "POST", body, headers: UA }).catch(() => null);
      if (res?.ok) break;
      if (attempt >= 4) throw new Error(`GPlates failed at ${age} Ma: ${res?.status}`);
      await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
    const coords = (await res.json()).coordinates;
    if (coords.length !== chunk.length) throw new Error(`GPlates returned ${coords.length} for ${chunk.length} points`);
    out.push(...coords);
  }
  return out;
}

async function cached(name, fn) {
  const f = path.join(CACHE, name);
  if (existsSync(f)) return JSON.parse(await readFile(f, "utf8"));
  const v = await fn();
  await writeFile(f, JSON.stringify(v));
  return v;
}

/** Today's U.S. as outline rings (Natural Earth 50m, public domain), thinned to ~every 0.15°. */
async function usRings() {
  const ne = await (await fetch(NE_URL, { headers: UA })).json();
  const us = ne.features.find((f) => f.properties.ADM0_A3 === "USA");
  const polys = us.geometry.type === "Polygon" ? [us.geometry.coordinates] : us.geometry.coordinates;
  const rings = [];
  for (const poly of polys) {
    const ring = poly[0];
    // drop tiny islands
    let w = 180, e = -180, s = 90, n = -90;
    for (const [x, y] of ring) [w, e, s, n] = [Math.min(w, x), Math.max(e, x), Math.min(s, y), Math.max(n, y)];
    if ((e - w) * (n - s) < 0.3) continue;
    const thin = [ring[0]];
    for (const p of ring) {
      const q = thin[thin.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 0.15) thin.push(p);
    }
    thin.push(ring[0]);
    rings.push(thin.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]));
  }
  return rings;
}

/** Today's coastlines (Natural Earth 1:110m, public domain) as lines thinned to ~every 0.6°, small islands dropped. */
async function worldCoast() {
  const ne = await (await fetch(NE_COAST_URL, { headers: UA })).json();
  const lines = [];
  for (const feat of ne.features) {
    const parts = feat.geometry.type === "LineString" ? [feat.geometry.coordinates] : feat.geometry.coordinates;
    for (const line of parts) {
      let len = 0;
      for (let k = 1; k < line.length; k++) len += Math.hypot(line[k][0] - line[k - 1][0], line[k][1] - line[k - 1][1]);
      if (len < 2) continue;
      const thin = [line[0]];
      for (const p of line.slice(1, -1)) {
        const q = thin[thin.length - 1];
        if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 0.6) thin.push(p);
      }
      thin.push(line[line.length - 1]);
      lines.push(thin.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]));
    }
  }
  return lines;
}

/** Every fossil site, from the world tiles: [tile index, row, lng, lat, max, min, per, flag, finds]. */
async function fossilRows() {
  const ix = JSON.parse(await readFile(path.join(FOSSIL_DIR, "index.json"), "utf8"));
  const tiles = Object.keys(ix.tiles).sort();
  const rows = [];
  for (const [t, key] of tiles.entries()) {
    const { cols: c } = JSON.parse(await readFile(path.join(FOSSIL_DIR, "t", `${key}.json`), "utf8"));
    for (let i = 0; i < c.id.length; i++) rows.push([t, i, c.lng[i], c.lat[i], c.max[i], c.min[i], c.per[i], c.flag[i], c.n[i]]);
  }
  return { tiles, rows };
}

/**
 * Break rings into line pieces where GPlates has no position (null), and where two
 * neighbouring points have moved far apart — they sit on different plates (accreted
 * terranes along the Pacific coast), so a straight line between them would be false.
 */
export function outlinePieces(rings, coords) {
  const pieces = [];
  let k = 0;
  const dist = (a, b) => Math.hypot((a[0] - b[0]) * Math.cos(((a[1] + b[1]) * Math.PI) / 360), a[1] - b[1]);
  for (const ring of rings) {
    let cur = [];
    const flush = () => {
      if (cur.length > 1) pieces.push(cur);
      cur = [];
    };
    for (let j = 0; j < ring.length; j++) {
      const c = coords[k++];
      if (!c || Math.abs(c[0]) > 180) {
        flush();
        continue;
      }
      const p = [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100];
      // today's spacing vs then: the same plate keeps it (rotation preserves distances)
      if (cur.length && j > 0 && dist(cur[cur.length - 1], p) > dist(ring[j - 1], ring[j]) * 1.3 + 0.5) flush();
      // also break across the antimeridian
      if (cur.length && Math.abs(cur[cur.length - 1][0] - p[0]) > 180) flush();
      cur.push(p);
    }
    flush();
  }
  return pieces;
}

/* ── main ─────────────────────────────────────────────────────────── */

if (process.argv.includes("--test")) {
  const t = [
    [parseSlice("Map21_PALEOMAP_6min_Mid-Cretaceous_90Ma.nc"), { age: 90, label: "Mid-Cretaceous" }],
    [parseSlice("Map16_PALEOMAP_6min_KT_Boundary_65Ma.nc"), { age: 65, label: "End of the Cretaceous" }],
    [parseSlice("Map67.5_PALEOMAP_6min_Middle_Devonian_385.2Ma.nc"), { age: 385.2, label: "Middle Devonian" }],
    [parseSlice("Map24_PALEOMAP_6min_Early Cretaceous_105Ma.nc"), { age: 105, label: "Early Cretaceous" }],
    [parseSlice("Map05_PALEOMAP_6min_middle_Late_Miocene_10Ma.nc"), { age: 10, label: "Middle Late Miocene" }],
  ];
  for (const [got, want] of t) console.log(got?.age === want.age && got?.label === want.label ? "ok  " : "FAIL", JSON.stringify(got), JSON.stringify(want));
  const ap = parseAppendix(["Map ID Number,Stratigraphic Age Description,Plate Model Age,Map#", '21,"Mid-Cretaceous  (Turonian , 91.9 Ma)  ",90,26', '16,"KT Boundary (latest Maastrichtian, 66 Ma)",65,21', "32,Jurassic/Cretaceous Boundary (145 Ma),145,37", '38,"Middle Jurassic (Bajocian&Bathonian, 168.2)",170,42', "45.5,Late Triassic (Carnian/Norian 227 Ma),225,52", '1,"Present-day  (Holocene, 0 Ma)",0,1'].join("\r"));
  console.log(JSON.stringify(ap));
  console.log(JSON.stringify(sliceWindows([0, 5, 10])));
  // two points 1° apart on one plate stay one piece; a jump to another plate breaks it
  const pcs = outlinePieces([[[0, 0], [1, 0], [2, 0], [3, 0]]], [[10, 10], [11, 10], [30, 40], [31, 40]]);
  console.log(pcs.length === 2 ? "ok  " : "FAIL", "terrane break", JSON.stringify(pcs));
} else {
  const dir = process.env.PALEODEM_DIR;
  if (!dir) throw new Error("Set PALEODEM_DIR to the folder of 6-min PaleoDEM .nc files (Zenodo 10.5281/zenodo.5460860).");
  const files = (await readdir(dir, { recursive: true })).filter((f) => f.endsWith(".nc"));
  const only = process.env.PALEO_ONLY ? process.env.PALEO_ONLY.split(",").map(Number) : null; // preview a few slices
  const slices = files.map((f) => ({ ...parseSlice(path.basename(f)), path: path.join(dir, f) })).filter((s) => Number.isFinite(s.age) && (!only || only.includes(s.age))).sort((a, b) => a.age - b.age);
  if (!only && slices.length < 100) throw new Error(`only ${slices.length} PaleoDEMs found in ${dir}`);
  const appendixFile = (await readdir(dir)).find((f) => /TimeIntervals.*\.csv$/i.test(f));
  const appendix = appendixFile ? parseAppendix(await readFile(path.join(dir, appendixFile), "utf8")) : {};
  for (const s of slices) if (appendix[s.map]) Object.assign(s, appendix[s.map]);
  await mkdir(OUT, { recursive: true });
  await mkdir(CACHE, { recursive: true });
  const both = !process.argv.includes("--images") && !process.argv.includes("--points");
  const windows = sliceWindows(slices.map((s) => s.age));

  if (both || process.argv.includes("--images")) {
    let total = 0;
    for (const s of slices) {
      const webp = await renderImage(await readGrid(s.path), SIZE);
      await writeFile(path.join(OUT, `${fileAge(s.age)}.webp`), webp);
      total += webp.length;
      process.stdout.write(`\r${s.age} Ma image ${(webp.length / 1024).toFixed(0)} KB   `);
    }
    console.log(`\nimages: ${slices.length}, ${(total / 1024 / 1024).toFixed(1)} MB`);
  }

  let coastBase = null;
  let fossilTiles = null;
  if (both || process.argv.includes("--points")) {
    const { tiles, rows } = await fossilRows();
    fossilTiles = tiles;
    const coast = await cached("coast-110m.json", worldCoast);
    coastBase = coast;
    const coastPts = coast.flat();
    let groups = 0;
    let sites = 0;
    let dropped = 0;
    for (const s of slices) {
      const w = windows.find((x) => x.age === s.age);
      /* sites alive in this slice's window, grouped by spot (0.01°): one GPlates position per spot */
      const spots = new Map();
      for (const r of rows) {
        const [t, i, lng, lat, max, min, per, flag, finds] = r;
        if (!(min <= w.hi && max >= w.lo)) continue;
        const key = `${lng.toFixed(2)},${lat.toFixed(2)}`;
        let g = spots.get(key);
        if (!g) spots.set(key, (g = { lng: Number(lng.toFixed(2)), lat: Number(lat.toFixed(2)), n: 0, finds: 0, flag: 0, per: new Map(), rep: null, repFinds: -1 }));
        g.n++;
        g.finds += finds;
        g.flag |= flag;
        g.per.set(per, (g.per.get(per) ?? 0) + 1);
        // the spot opens its richest collection
        if (finds > g.repFinds) [g.rep, g.repFinds] = [[t, i], finds];
      }
      const list = [...spots.values()];
      const paleo = await cached(`fw-${s.age}.json`, () => reconstruct(list.map((g) => [g.lng, g.lat]), s.age));
      const coastThen = await cached(`coast-${s.age}.json`, () => reconstruct(coastPts, s.age));
      const out = { lng: [], lat: [], n: [], finds: [], per: [], flag: [], t: [], i: [] };
      list.forEach((g, k) => {
        const p = paleo[k];
        if (!p || Math.abs(p[0]) > 180) {
          dropped += g.n;
          return;
        }
        out.lng.push(Math.round(p[0] * 100) / 100);
        out.lat.push(Math.round(p[1] * 100) / 100);
        out.n.push(g.n);
        out.finds.push(g.finds);
        out.per.push([...g.per.entries()].sort((a, b) => b[1] - a[1])[0][0]);
        out.flag.push(g.flag);
        out.t.push(g.rep[0]);
        out.i.push(g.rep[1]);
        sites += g.n;
      });
      groups += out.n.length;
      // coastlines aligned with today's (null where that crust didn't exist yet), so the app can follow a place through time
      const coastOut = coastThen.map((c) => (c && Math.abs(c[0]) <= 180 ? [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100] : null));
      await writeFile(path.join(OUT, `${fileAge(s.age)}.json`), JSON.stringify({ age: s.age, sites: out, coast: coastOut }));
      process.stdout.write(`\r${s.age} Ma: ${out.n.length} spots, ${out.n.reduce((a, b) => a + b, 0)} sites   `);
    }
    console.log(`\nfossil spots: ${groups} (${sites} site-slices; ${dropped} without a position that far back)`);
  }

  await writeFile(
    path.join(OUT, "index.json"),
    JSON.stringify({
      generated: new Date().toISOString(),
      source: "PaleoDEMs: C. R. Scotese & N. M. Wright (2018), PALEOMAP Project, CC BY 4.0 · positions: GPlates Web Service, PALEOMAP model",
      model: MODEL,
      size: SIZE,
      // which fossil tile each spot's collection lives in, and today's coastlines (lines → their lengths, then flat points)
      ...(fossilTiles ? { tiles: fossilTiles } : {}),
      ...(coastBase ? { coast: { lens: coastBase.map((l) => l.length), base: coastBase.flat(2) } } : {}),
      slices: slices.map((s) => ({ age: s.age, label: s.label, stage: s.stage ?? null, strat: s.strat ?? s.age, file: fileAge(s.age), ...(({ lo, hi }) => ({ lo, hi }))(windows.find((x) => x.age === s.age)) })),
    })
  );
  console.log(`index.json: ${slices.length} slices`);
}
