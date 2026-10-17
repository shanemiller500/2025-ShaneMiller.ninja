/* ------------------------------------------------------------------ */
/*  Bake public/atlas/faults-world.json — active faults worldwide from */
/*  the GEM Global Active Faults Database (Styron & Pagani 2020,       */
/*  CC BY-SA 4.0). Left out, because Earth Alive already draws them:   */
/*    · Bird 2003 — the PB2002 plate boundaries (our plates layer)     */
/*    · UCERF3 + USGS Hazfaults — U.S. faults (USGS Qfaults is richer) */
/*  Folds (anticline/syncline) are dropped too. Lines are simplified   */
/*  (~300 m) and coordinates rounded to keep the file light.           */
/*                                                                     */
/*  node scripts/atlas/build-gem-faults.mjs                            */
/* ------------------------------------------------------------------ */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas/faults-world.json");
const SRC = "https://raw.githubusercontent.com/GEMScienceTools/gem-global-active-faults/master/geojson/gem_active_faults_harmonized.geojson";
const SKIP_CATALOGS = new Set(["Bird 2003", "UCERF3", "USGS Hazfaults 2014"]);
const TOL = 0.003; // degrees, ~300 m

/** GEM slip types → four readable kinds (the first word of a combined type leads). */
export function kindOf(slip) {
  const s = String(slip ?? "");
  if (/^(Anticline|Syncline)$/.test(s)) return null;
  if (/^Normal/.test(s)) return "normal";
  if (/^(Reverse|Blind Thrust|Subduction)/.test(s)) return "reverse";
  if (/^(Dextral|Sinistral|Strike-Slip)/.test(s)) return "strike-slip";
  return "unknown";
}
/** "(0.15,0.01,0.52)" → 0.15 (the preferred value, mm/yr) */
const first = (v) => {
  const n = Number(String(v ?? "").replace(/^\(/, "").split(",")[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Douglas–Peucker on lng/lat. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    let worst = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > worst) [worst, idx] = [d, i];
    }
    if (worst > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

if (!process.argv.includes("--no-fetch")) {
  const res = await fetch(SRC);
  if (!res.ok) throw new Error(`GEM: HTTP ${res.status}`);
  const src = await res.json();
  const features = [];
  let skipped = 0;
  for (const f of src.features) {
    const p = f.properties;
    const kind = kindOf(p.slip_type);
    if (SKIP_CATALOGS.has(p.catalog_name) || !kind || f.geometry?.type !== "LineString") {
      skipped++;
      continue;
    }
    const line = simplify(f.geometry.coordinates, TOL).map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
    if (line.length < 2) continue;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: line },
      properties: { name: p.name && p.name !== "None" ? String(p.name) : null, kind, slip: p.slip_type ?? null, rate: first(p.net_slip_rate), cat: p.catalog_name },
    });
  }
  const body = JSON.stringify({ type: "FeatureCollection", source: "GEM Global Active Faults Database (Styron & Pagani 2020)", license: "CC BY-SA 4.0", features });
  await writeFile(OUT, body);
  const kinds = {};
  for (const f of features) kinds[f.properties.kind] = (kinds[f.properties.kind] ?? 0) + 1;
  console.log(`faults-world.json: ${features.length} faults (skipped ${skipped}), ${(body.length / 1024).toFixed(0)} KB`, kinds);
}
