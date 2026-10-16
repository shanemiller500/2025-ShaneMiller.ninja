/* ------------------------------------------------------------------ */
/*  Bake the plate-boundary layer for the atlas.                       */
/*                                                                     */
/*  PB2002 (Bird 2003, via github.com/fraxen/tectonicplates, ODC-BY)   */
/*  ships the boundaries without a type, and the typed version is     */
/*  5,800 tiny "steps" (10 MB). We merge consecutive steps of the     */
/*  same class into lines, round coordinates and keep the average     */
/*  relative velocity — ~10x smaller and every segment is typed.      */
/*                                                                     */
/*  node scripts/atlas/build-plates.mjs   → public/atlas/plates.json   */
/* ------------------------------------------------------------------ */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STEPS_URL = "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_steps.json";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../public/atlas/plates.json");

const round = (n) => Math.round(n * 1000) / 1000;
const same = (a, b) => a && b && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;

const res = await fetch(STEPS_URL);
if (!res.ok) throw new Error(`PB2002 steps: HTTP ${res.status}`);
const steps = (await res.json()).features
  .map((f) => f.properties)
  .sort((a, b) => a.SEQNUM - b.SEQNUM);

const features = [];
let run = null;

const flush = () => {
  if (run && run.coords.length > 1) {
    const [a, b] = run.bound.split(/[-\\/]/);
    features.push({
      type: "Feature",
      properties: { name: run.bound, a, b, cls: run.cls, v: Math.round((run.vSum / run.n) * 10) / 10 },
      geometry: { type: "LineString", coordinates: run.coords },
    });
  }
  run = null;
};

for (const s of steps) {
  const start = [round(s.STARTLONG), round(s.STARTLAT)];
  const end = [round(s.FINALLONG), round(s.FINALLAT)];
  // a step across the antimeridian would draw a line round the whole world
  const wraps = Math.abs(end[0] - start[0]) > 180;
  const continues = run && run.bound === s.PLATEBOUND && run.cls === s.STEPCLASS && same(run.coords.at(-1), start) && !wraps;
  if (!continues) {
    flush();
    if (wraps) continue;
    run = { bound: s.PLATEBOUND, cls: s.STEPCLASS, coords: [start], vSum: 0, n: 0 };
  }
  run.coords.push(end);
  run.vSum += s.VELOCITYLE;
  run.n += 1;
}
flush();

await mkdir(path.dirname(OUT), { recursive: true });
const body = JSON.stringify({ type: "FeatureCollection", features });
await writeFile(OUT, body);
console.log(`plates.json: ${features.length} segments from ${steps.length} steps, ${(body.length / 1024).toFixed(0)} KB`);
