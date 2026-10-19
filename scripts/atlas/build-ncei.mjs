/* ------------------------------------------------------------------ */
/*  Bake NOAA NCEI's historical hazard databases (public domain) for   */
/*  Earth Alive:                                                       */
/*                                                                     */
/*  • public/atlas/ncei-quakes.json — the Significant Earthquake       */
/*    Database: ~6,700 earthquakes from 2150 BC to today with ~$1M+    */
/*    damage, 10+ deaths, M7.5+, intensity X+, or a tsunami.           */
/*  • public/atlas/ncei-tsunamis.json — the Global Historical Tsunami  */
/*    Database, keeping only events NOAA rates definite (4) or         */
/*    probable (3).                                                    */
/*                                                                     */
/*  node scripts/atlas/build-ncei.mjs [--test]                         */
/* ------------------------------------------------------------------ */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas");
const API = "https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1";
const UA = { "User-Agent": "shanemiller.ninja atlas (+https://shanemiller.ninja)" };

/** NOAA's tsunami cause codes (Global Historical Tsunami Database). */
export const TSUNAMI_CAUSES = ["Unknown", "Earthquake", "Questionable earthquake", "Earthquake and landslide", "Volcano and earthquake", "Volcano, earthquake and landslide", "Volcano", "Volcano and landslide", "Landslide", "Meteorological", "Explosion", "Astronomical tide"];
/** NOAA's descriptive scale when an exact count isn't known. */
export const AMOUNT = ["None", "Few (1–50)", "Some (51–100)", "Many (101–1,000)", "Very many (over 1,000)"];

/** Every page of one NCEI endpoint. */
async function all(endpoint) {
  const items = [];
  for (let page = 1; ; page++) {
    let j;
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(`${API}/${endpoint}?page=${page}`, { headers: UA }).catch(() => null);
      if (res?.ok) {
        j = await res.json();
        break;
      }
      if (attempt >= 4) throw new Error(`NCEI ${endpoint} page ${page}: ${res?.status}`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
    items.push(...j.items);
    process.stdout.write(`\r${endpoint} ${page}/${j.totalPages}   `);
    if (page >= j.totalPages) break;
  }
  console.log();
  return items;
}

/** "2004-12-26", "1755-11", "-2150" — as much of the date as NOAA has. */
export function dateOf(r) {
  const y = String(r.year);
  if (!r.month) return y;
  const m = String(r.month).padStart(2, "0");
  return r.day ? `${y}-${m}-${String(r.day).padStart(2, "0")}` : `${y}-${m}`;
}
/** "INDONESIA:  SUMATRA:  OFF W COAST" → "Indonesia: Sumatra: Off W Coast" */
export function tidyPlace(s) {
  return (s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(^|[\s:(,/-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

if (process.argv.includes("--test")) {
  const t = (got, want, label) => console.log(JSON.stringify(got) === JSON.stringify(want) ? "ok  " : "FAIL", label, JSON.stringify(got));
  t(dateOf({ year: 2004, month: 12, day: 26 }), "2004-12-26", "full date");
  t(dateOf({ year: 1755, month: 11 }), "1755-11", "month");
  t(dateOf({ year: -2150 }), "-2150", "BC year");
  t(tidyPlace("INDONESIA:  SUMATRA:  OFF W COAST"), "Indonesia: Sumatra: Off W Coast", "place");
} else {
  /* significant earthquakes */
  const eq = await all("earthquakes");
  const q = { id: [], date: [], place: [], country: [], lng: [], lat: [], mag: [], depth: [], deaths: [], deathsAmt: [], tsunami: [] };
  for (const r of eq) {
    if (num(r.latitude) == null || num(r.longitude) == null) continue;
    q.id.push(r.id);
    q.date.push(dateOf(r));
    q.place.push(tidyPlace(r.locationName));
    q.country.push(tidyPlace(r.country));
    q.lng.push(Math.round(r.longitude * 1000) / 1000);
    q.lat.push(Math.round(r.latitude * 1000) / 1000);
    q.mag.push(num(r.eqMagnitude));
    q.depth.push(num(r.eqDepth));
    // the totals include deaths from the tsunami and other secondary effects
    q.deaths.push(num(r.deathsTotal) ?? num(r.deaths));
    q.deathsAmt.push(num(r.deathsAmountOrderTotal) ?? num(r.deathsAmountOrder));
    q.tsunami.push(num(r.tsunamiEventId));
  }
  await writeFile(path.join(OUT, "ncei-quakes.json"), JSON.stringify({ generated: new Date().toISOString(), source: "NOAA NCEI Significant Earthquake Database (public domain)", amount: AMOUNT, cols: q }));
  console.log(`ncei-quakes.json: ${q.id.length} earthquakes (${eq.length - q.id.length} without a position)`);

  /* tsunamis: definite and probable only */
  const ts = await all("tsunamis/events");
  const t = { id: [], date: [], place: [], country: [], lng: [], lat: [], height: [], cause: [], validity: [], deaths: [], deathsAmt: [], mag: [], runups: [] };
  let doubtful = 0;
  for (const r of ts) {
    if (num(r.latitude) == null || num(r.longitude) == null) continue;
    if (!(r.eventValidity >= 3)) {
      doubtful++;
      continue;
    }
    t.id.push(r.id);
    t.date.push(dateOf(r));
    t.place.push(tidyPlace(r.locationName));
    t.country.push(tidyPlace(r.country));
    t.lng.push(Math.round(r.longitude * 1000) / 1000);
    t.lat.push(Math.round(r.latitude * 1000) / 1000);
    t.height.push(num(r.maxWaterHeight));
    t.cause.push(num(r.causeCode) ?? 0);
    t.validity.push(r.eventValidity);
    t.deaths.push(num(r.deathsTotal) ?? num(r.deaths));
    t.deathsAmt.push(num(r.deathsAmountOrderTotal) ?? num(r.deathsAmountOrder));
    t.mag.push(num(r.eqMagnitude));
    t.runups.push(num(r.numRunups) ?? 0);
  }
  await writeFile(path.join(OUT, "ncei-tsunamis.json"), JSON.stringify({ generated: new Date().toISOString(), source: "NOAA NCEI Global Historical Tsunami Database (public domain)", causes: TSUNAMI_CAUSES, amount: AMOUNT, cols: t }));
  console.log(`ncei-tsunamis.json: ${t.id.length} definite or probable tsunamis (${doubtful} doubtful, questionable or erroneous left out)`);
}
