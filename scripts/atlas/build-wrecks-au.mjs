/* ------------------------------------------------------------------ */
/*  Bake public/atlas/wrecks-au.json — Australia's (and New Zealand's) */
/*  historic shipwrecks and sunken aircraft from the Australasian      */
/*  Underwater Cultural Heritage Database (© Commonwealth of           */
/*  Australia, DCCEEW; Australian National Shipwrecks, CC BY 3.0 AU).  */
/*                                                                     */
/*  Most positions are where a ship was recorded lost, not a surveyed  */
/*  wreck site: only records whose status is located, inspected,       */
/*  surveyed or excavated get `sure = 1`. Sites that aren't ships or   */
/*  aircraft are left out. Columnar with dictionary-encoded text.      */
/*                                                                     */
/*  node scripts/atlas/build-wrecks-au.mjs [--test]                    */
/* ------------------------------------------------------------------ */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas/wrecks-au.json");
const SERVICE = "https://gis.environment.gov.au/gispub/rest/services/heritage/shipwrecks_query/MapServer/32/query";
const UA = { "User-Agent": "shanemiller.ninja atlas (+https://shanemiller.ninja)" };
const KINDS = { MCT_SHWR: 0, MCT_ARCR: 1 };
const SURE = new Set(["LOCATED", "INSPCTED", "SURVEYED", "EXCVATED"]);

/** "MCT_SHWR - INSPCTED" → true when the site itself has been found. */
export const isLocated = (symbolClass) => SURE.has(String(symbolClass ?? "").split(" - ")[1]);
/** Free-text fields: trim, collapse spaces, drop "Unknown". */
export const clean = (s) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return !t || /^unknown$/i.test(t) ? "" : t;
};

if (process.argv.includes("--test")) {
  const t = (got, want, label) => console.log(JSON.stringify(got) === JSON.stringify(want) ? "ok  " : "FAIL", label, JSON.stringify(got));
  t(isLocated("MCT_SHWR - INSPCTED"), true, "inspected");
  t(isLocated("MCT_SHWR - LCTNUNKN"), false, "location unknown");
  t(clean("  Unknown "), "", "unknown");
  t(clean("Port  Stephens"), "Port Stephens", "spaces");
} else {
  const q = new URLSearchParams({ where: "1=1", outFields: "*", returnGeometry: "false", resultRecordCount: "10000", orderByFields: "MCH_ID", f: "json" });
  const j = await (await fetch(`${SERVICE}?${q}`, { headers: UA })).json();
  if (!j.features) throw new Error(JSON.stringify(j).slice(0, 300));
  if (j.exceededTransferLimit) throw new Error("more records than one page — add paging");

  const dict = { type: [], rig: [], region: [], state: [] };
  const code = (k, v) => {
    if (!v) return -1;
    let i = dict[k].indexOf(v);
    if (i < 0) i = dict[k].push(v) - 1;
    return i;
  };
  const cols = { id: [], name: [], lng: [], lat: [], kind: [], sure: [], year: [], built: [], tons: [], type: [], rig: [], where: [], region: [], state: [], plane: [] };
  let skipped = 0;
  for (const { attributes: r } of j.features) {
    const kind = KINDS[r.MCH_TYPE_CODE];
    if (kind == null || r.LATITUDE == null || r.LONGITUDE == null) {
      skipped++;
      continue;
    }
    cols.id.push(r.MCH_ID);
    cols.name.push(clean(r.VESSEL_NAME));
    cols.lng.push(Math.round(r.LONGITUDE * 10000) / 10000);
    cols.lat.push(Math.round(r.LATITUDE * 10000) / 10000);
    cols.kind.push(kind);
    cols.sure.push(isLocated(r.SYMBOLCLASS) ? 1 : 0);
    cols.year.push(/^\d{4}$/.test(r.YEAR_WRECKED ?? "") ? Number(r.YEAR_WRECKED) : null);
    cols.built.push(r.YEAR_BUILT || null);
    cols.tons.push(r.GROSS_TONNAGE || null);
    cols.type.push(code("type", clean(kind === 1 ? r.AIRCRAFT_TYPE_DESC : r.VESSEL_TYPE_DESC)));
    cols.rig.push(code("rig", kind === 0 && !/^not rigged$/i.test(r.RIG_TYPE_DESC ?? "") ? clean(r.RIG_TYPE_DESC) : ""));
    cols.where.push(clean(r.WHERE_LOST));
    cols.region.push(code("region", clean(r.REGION_NAME)));
    cols.state.push(code("state", clean(r.JURISDICTION_DESC)));
    cols.plane.push(kind === 1 ? clean(r.AIRCRAFT_MODEL) : "");
  }
  await writeFile(
    OUT,
    JSON.stringify({
      generated: new Date().toISOString(),
      source: "Australasian Underwater Cultural Heritage Database — © Commonwealth of Australia (DCCEEW)",
      license: "CC BY 3.0 AU",
      dict,
      cols,
    })
  );
  const located = cols.sure.filter(Boolean).length;
  console.log(`wrecks-au.json: ${cols.id.length} (${cols.kind.filter((k) => k === 1).length} aircraft, ${located} with a located site; ${skipped} other sites left out)`);
}
