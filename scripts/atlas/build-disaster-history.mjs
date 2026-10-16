/* ------------------------------------------------------------------ */
/*  Bake the Disaster Atlas history files (public/atlas/):             */
/*                                                                     */
/*  hurricanes.json — every Atlantic (1851→) and NE Pacific (1949→)    */
/*      tropical cyclone track from NOAA NHC HURDAT2 (best tracks).    */
/*  tornadoes.json  — every U.S. tornado 1950→ from NOAA SPC, stored   */
/*      column-wise (one array per field) to stay small.               */
/*  fema-declarations.json — OpenFEMA disaster declarations since 1953,*/
/*      rolled up per county (by incident type + the latest few).      */
/*                                                                     */
/*  node scripts/atlas/build-disaster-history.mjs                      */
/* ------------------------------------------------------------------ */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas");
const NHC = "https://www.nhc.noaa.gov/data/hurdat/";
const SPC = "https://www.spc.noaa.gov/wcm/data/";

async function text(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}
const write = async (file, obj) => {
  const body = JSON.stringify(obj);
  await writeFile(path.join(OUT, file), body);
  console.log(`${file}: ${(body.length / 1024).toFixed(0)} KB`);
};

/* ── 1. hurricanes (HURDAT2) ─────────────────────────────────────── */

// the newest file names are listed on the data index page
const index = await text("https://www.nhc.noaa.gov/data/");
const newest = (re) => [...new Set(index.match(re) ?? [])].sort().pop();
const files = [newest(/hurdat2-1851-\d{4}-\d+\.txt/g), newest(/hurdat2-nepac-1949-\d{4}-\d+\.txt/g)].filter(Boolean);
if (files.length < 2) throw new Error("couldn't find both HURDAT2 files");

/** Saffir–Simpson category from knots (0 = below hurricane strength). */
const cat = (kt) => (kt >= 137 ? 5 : kt >= 113 ? 4 : kt >= 96 ? 3 : kt >= 83 ? 2 : kt >= 64 ? 1 : 0);
const coord = (s) => {
  const v = Number(s.slice(0, -1));
  return /[SW]$/.test(s) ? -v : v;
};

const storms = [];
for (const file of files) {
  const lines = (await text(NHC + file)).split(/\r?\n/);
  for (let i = 0; i < lines.length; ) {
    const head = lines[i].split(",").map((c) => c.trim());
    if (!/^(AL|EP|CP)\d{6}$/.test(head[0])) {
      i++;
      continue;
    }
    const n = Number(head[2]);
    const pts = [];
    let maxWind = 0;
    let minPres = 9999;
    let landfalls = 0;
    let t0 = null;
    for (const row of lines.slice(i + 1, i + 1 + n)) {
      const c = row.split(",").map((x) => x.trim());
      const [ymd, hm, rec, status, lat, lon, wind, pres] = c;
      const t = Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8), +hm.slice(0, 2), +hm.slice(2, 4));
      t0 ??= t;
      const kt = Number(wind) > 0 ? Number(wind) : 0;
      const mb = Number(pres) > 0 ? Number(pres) : null;
      if (kt > maxWind) maxWind = kt;
      if (mb && mb < minPres) minPres = mb;
      if (rec === "L") landfalls++;
      // [hours since first fix, lat×10, lon×10, wind kt, landfall flag]
      pts.push([Math.round((t - t0) / 3_600_000), Math.round(coord(lat) * 10), Math.round(coord(lon) * 10), kt, rec === "L" ? 1 : 0, status]);
    }
    const name = head[1] === "UNNAMED" ? null : head[1][0] + head[1].slice(1).toLowerCase();
    storms.push({
      id: head[0],
      name,
      year: Number(head[0].slice(4)),
      basin: head[0].slice(0, 2),
      start: t0,
      maxWind,
      minPres: minPres < 9999 ? minPres : null,
      cat: cat(maxWind),
      landfalls,
      pts: pts.map((p) => p.slice(0, 5)),
      // the strongest status reached, for "tropical storm / hurricane / …"
      hu: pts.some((p) => p[5] === "HU"),
    });
    i += n + 1;
  }
}
storms.sort((a, b) => a.start - b.start);
console.log(`hurricanes: ${storms.length} storms from ${files.join(" + ")}`);
await write("hurricanes.json", { generated: new Date().toISOString(), source: `NOAA NHC HURDAT2 (${files.join(", ")})`, storms });

/* ── 2. tornadoes (SPC) ──────────────────────────────────────────── */

const spcIndex = await text("https://www.spc.noaa.gov/wcm/");
const tornFile = [...new Set(spcIndex.match(/\d{4}-\d{4}_actual_tornadoes\.csv/g) ?? [])].sort().pop();
if (!tornFile) throw new Error("couldn't find the SPC tornado file");
const rows = (await text(SPC + tornFile)).trim().split(/\r?\n/);
const header = rows.shift().split(",");
const at = Object.fromEntries(header.map((h, i) => [h, i]));
const cols = { yr: [], md: [], hm: [], st: [], mag: [], inj: [], fat: [], slat: [], slon: [], elat: [], elon: [], len: [], wid: [] };
const r3 = (v) => Math.round(Number(v) * 1000) / 1000;
for (const line of rows) {
  const c = line.split(",");
  // sg 1 = a whole track; 2 = a piece of a multi-state track (skip, the whole one is also listed)
  if (c[at.sg] === "2") continue;
  const slat = Number(c[at.slat]);
  const slon = Number(c[at.slon]);
  if (!slat || !slon) continue;
  const elat = Number(c[at.elat]);
  const elon = Number(c[at.elon]);
  cols.yr.push(Number(c[at.yr]));
  cols.md.push(Number(c[at.mo]) * 100 + Number(c[at.dy]));
  cols.hm.push(Number(c[at.time].slice(0, 2)) * 100 + Number(c[at.time].slice(3, 5)));
  cols.st.push(c[at.st]);
  cols.mag.push(Number(c[at.mag]));
  cols.inj.push(Number(c[at.inj]) || 0);
  cols.fat.push(Number(c[at.fat]) || 0);
  cols.slat.push(r3(slat));
  cols.slon.push(r3(slon));
  // no end point recorded → 0 (drawn as a dot)
  cols.elat.push(elat && elon ? r3(elat) : 0);
  cols.elon.push(elat && elon ? r3(elon) : 0);
  cols.len.push(Math.round(Number(c[at.len]) * 10) / 10);
  cols.wid.push(Number(c[at.wid]) || 0);
}
console.log(`tornadoes: ${cols.yr.length} from ${tornFile} (tz column: ${header.includes("tz") ? "present — times are CST" : "?"})`);
await write("tornadoes.json", { generated: new Date().toISOString(), source: `NOAA SPC Severe Weather Database (${tornFile})`, cols });

/* ── 3. FEMA disaster declarations, per county ───────────────────── */

const FEMA = "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries";
const decl = [];
for (let skip = 0; ; skip += 10000) {
  const q = new URLSearchParams({
    $select: "disasterNumber,declarationDate,incidentType,declarationTitle,fipsStateCode,fipsCountyCode,declarationType",
    $orderby: "id",
    $top: "10000",
    $skip: String(skip),
  });
  const j = JSON.parse(await text(`${FEMA}?${q}`));
  const page = j.DisasterDeclarationsSummaries ?? [];
  decl.push(...page);
  process.stdout.write(`\rFEMA declarations: ${decl.length}`);
  if (page.length < 10000) break;
}
console.log();

const counties = {};
const byYear = {};
const seen = new Set();
for (const d of decl) {
  const year = Number(String(d.declarationDate).slice(0, 4));
  // national series: one count per disaster (not per county)
  if (!seen.has(d.disasterNumber)) {
    seen.add(d.disasterNumber);
    byYear[year] ??= {};
    byYear[year][d.incidentType] = (byYear[year][d.incidentType] ?? 0) + 1;
  }
  if (!d.fipsCountyCode || d.fipsCountyCode === "000") continue; // statewide
  const fips = `${d.fipsStateCode}${d.fipsCountyCode}`;
  const c = (counties[fips] ??= { n: 0, t: {}, seen: [], last: [] });
  if (c.seen.includes(d.disasterNumber)) continue;
  c.seen.push(d.disasterNumber);
  c.n++;
  c.t[d.incidentType] = (c.t[d.incidentType] ?? 0) + 1;
  c.last.push([year, d.incidentType, d.declarationTitle, d.disasterNumber, d.declarationType]);
}
for (const c of Object.values(counties)) {
  c.last = c.last.sort((a, b) => b[0] - a[0] || b[3] - a[3]).slice(0, 6);
  delete c.seen;
}
const types = {};
for (const c of Object.values(counties)) for (const [k, v] of Object.entries(c.t)) types[k] = (types[k] ?? 0) + v;
console.log(`FEMA: ${seen.size} disasters, ${Object.keys(counties).length} counties`, Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 8));
await write("fema-declarations.json", { generated: new Date().toISOString(), source: "OpenFEMA Disaster Declarations Summaries (v2)", counties, byYear });
