/* ------------------------------------------------------------------ */
/*  Bake public/atlas/hurricanes-world.json — tropical cyclone tracks  */
/*  for every basin HURDAT2 doesn't cover: western Pacific (typhoons), */
/*  north Indian, south Indian, south Pacific and south Atlantic, from */
/*  NOAA NCEI's IBTrACS v04r01 (public domain).                        */
/*                                                                     */
/*  Same storm shape as hurricanes.json so one layer draws both:       */
/*    · main tracks only (no "spur" duplicates), 6-hourly fixes        */
/*      (00/06/12/18 UTC) plus any landfall fix                        */
/*    · wind = USA_WIND (JTWC, 1-minute sustained, kt) — the same      */
/*      measure as HURDAT2, so Saffir–Simpson categories compare.      */
/*      Before JTWC (≈1945) there is often no 1-minute wind; WMO_WIND  */
/*      is a 10-minute average from other agencies and isn't mixed in. */
/*    · landfall = the first fix over land (DIST2LAND 0) after a fix   */
/*      over water                                                      */
/*                                                                     */
/*  node scripts/atlas/build-ibtracs.mjs                               */
/* ------------------------------------------------------------------ */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas/hurricanes-world.json");
const BASE = "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/";
const BASINS = ["WP", "NI", "SI", "SP", "SA"];
const cat = (kt) => (kt >= 137 ? 5 : kt >= 113 ? 4 : kt >= 96 ? 3 : kt >= 83 ? 2 : kt >= 64 ? 1 : 0);

/** Stream a CSV line by line (the WP file is 115 MB). */
async function* lines(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      yield buf.slice(0, i).replace(/\r$/, "");
      buf = buf.slice(i + 1);
    }
  }
  if (buf) yield buf;
}

const storms = new Map();
for (const b of BASINS) {
  let col = null;
  let rows = 0;
  for await (const line of lines(`${BASE}ibtracs.${b}.list.v04r01.csv`)) {
    const c = line.split(",");
    if (!col) {
      col = Object.fromEntries(c.map((h, i) => [h.trim(), i]));
      continue;
    }
    if (c[col.SID] === " " || c[col.SEASON] === "Year") continue; // units row
    if (c[col.TRACK_TYPE] !== "main") continue;
    rows++;
    const sid = c[col.SID];
    const iso = c[col.ISO_TIME]; // "1884-06-24 16:00:00"
    const t = Date.parse(`${iso.replace(" ", "T")}Z`);
    const hour = Number(iso.slice(11, 13));
    const minute = Number(iso.slice(14, 16));
    const lat = Number(c[col.LAT]);
    const lon = Number(c[col.LON]);
    if (!Number.isFinite(t) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const usa = Number(c[col.USA_WIND]);
    const kt = c[col.USA_WIND].trim() && Number.isFinite(usa) && usa > 0 ? usa : 0;
    const presRaw = Number(c[col.USA_PRES].trim() ? c[col.USA_PRES] : c[col.WMO_PRES]);
    const pres = Number.isFinite(presRaw) && presRaw > 800 ? presRaw : null;
    const land = Number(c[col.DIST2LAND]) === 0;
    let s = storms.get(sid);
    if (!s) {
      const nm = c[col.NAME].trim();
      s = {
        id: sid,
        name: !nm || nm === "NOT_NAMED" || nm === "UNNAMED" ? null : nm.split(":")[0].charAt(0) + nm.split(":")[0].slice(1).toLowerCase(),
        year: Number(c[col.SEASON]),
        basin: b,
        start: t,
        maxWind: 0,
        minPres: null,
        landfalls: 0,
        lastLand: land,
        pts: [],
      };
      storms.set(sid, s);
    }
    const isLandfall = land && !s.lastLand;
    s.lastLand = land;
    if (kt > s.maxWind) s.maxWind = kt;
    if (pres && (s.minPres == null || pres < s.minPres)) s.minPres = pres;
    if (isLandfall) s.landfalls++;
    // keep the synoptic fixes (IBTrACS interpolates 3-hourly) and every landfall
    if ((hour % 6 === 0 && minute === 0) || isLandfall) {
      // lon in IBTrACS can run past 180 to keep a track continuous; wrap for the map
      const lng = ((((lon + 180) % 360) + 360) % 360) - 180;
      s.pts.push([Math.round((t - s.start) / 3_600_000), Math.round(lat * 10), Math.round(lng * 10), kt, isLandfall ? 1 : 0]);
    }
  }
  console.log(`${b}: ${rows} track rows`);
}

const out = [...storms.values()]
  // no 1-minute wind anywhere on the track = unknown intensity: leave it out rather than draw it as a weak storm
  .filter((s) => s.pts.length >= 2 && s.maxWind > 0)
  .map(({ lastLand: _l, ...s }) => ({ ...s, cat: cat(s.maxWind), hu: s.maxWind >= 64 }))
  .sort((a, b) => a.start - b.start);
const byBasin = {};
for (const s of out) byBasin[s.basin] = (byBasin[s.basin] ?? 0) + 1;
const body = JSON.stringify({
  generated: new Date().toISOString(),
  source: "NOAA NCEI IBTrACS v04r01 — WP, NI, SI, SP, SA basins (JTWC 1-minute winds)",
  storms: out,
});
await writeFile(OUT, body);
console.log(`hurricanes-world.json: ${out.length} storms`, byBasin, `${(body.length / 1024 / 1024).toFixed(1)} MB`);
