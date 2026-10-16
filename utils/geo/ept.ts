/* ------------------------------------------------------------------ */
/*  USGS lidar point clouds in the browser. The USGS publishes 3DEP    */
/*  point clouds as Entwine Point Tiles (EPT): an octree of LAZ files  */
/*  in a public S3 bucket (CORS *). For a small area we walk the       */
/*  octree level by level until a point budget is hit, fetch only the  */
/*  nodes that touch it, decode them with laz-perf (WASM) and keep the */
/*  points inside the area.                                            */
/* ------------------------------------------------------------------ */

export interface EptCandidate {
  name: string;
  url: string;
  points: number;
  year: number;
}

/** Points ready for a 3D view: local metres around the site (x east, y north, z up). */
export interface PointCloud {
  count: number;
  /** x, y, z per point (z relative to the lowest point kept) */
  positions: Float32Array;
  /** ASPRS class per point (2 = ground, 3–5 = vegetation, 6 = building, 9 = water …) */
  classes: Uint8Array;
  /** 0–1 */
  intensity: Float32Array;
  /** half-width of the area, metres */
  halfSize: number;
  zRange: [number, number];
  /** lowest elevation kept, metres above the vertical datum */
  zBase: number;
  dataset: string;
  /** how many of the kept points are ground returns */
  groundCount: number;
}

interface EptInfo {
  bounds: [number, number, number, number, number, number];
  zToMetres: number;
}

type Hierarchy = Record<string, number>;

const R = 6378137;
const toMerc = (lng: number, lat: number): [number, number] => [(R * lng * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.split("/").slice(-2).join("/")}`);
  return res.json() as Promise<T>;
}

async function info(base: string, signal?: AbortSignal): Promise<EptInfo> {
  const j = await getJson<{ bounds: EptInfo["bounds"]; dataType: string; srs?: { wkt?: string; vertical?: string } }>(`${base}/ept.json`, signal);
  if (j.dataType !== "laszip") throw new Error(`unsupported EPT data type ${j.dataType}`);
  // EPT reprojects x/y to Web Mercator but keeps the source's vertical unit: some surveys are in feet
  const wkt = j.srs?.wkt ?? "";
  const vert = wkt.slice(wkt.indexOf("VERT_CS")) || "";
  const zToMetres = /VERT_CS/.test(wkt) && /foot|feet/i.test(vert) ? (/US survey/i.test(vert) ? 1200 / 3937 : 0.3048) : 1;
  return { bounds: j.bounds, zToMetres };
}

const nodeBounds = (b: EptInfo["bounds"], key: string) => {
  const [d, x, y] = key.split("-").map(Number);
  const size = (b[3] - b[0]) / 2 ** d;
  return { minx: b[0] + x * size, miny: b[1] + y * size, size };
};

/**
 * Pick the octree nodes to fetch: every node touching the area, from the root down, adding
 * whole levels while the estimated number of points inside the area stays under `budget`.
 */
async function selectNodes(base: string, ept: EptInfo, aoi: [number, number, number, number], budget: number, signal?: AbortSignal) {
  const hier: Hierarchy = {};
  const loadHier = async (key: string) => Object.assign(hier, await getJson<Hierarchy>(`${base}/ept-hierarchy/${key}.json`, signal));
  await loadHier("0-0-0-0");
  const [ax0, ay0, ax1, ay1] = aoi;
  const overlap = (key: string) => {
    const n = nodeBounds(ept.bounds, key);
    const w = Math.min(ax1, n.minx + n.size) - Math.max(ax0, n.minx);
    const h = Math.min(ay1, n.miny + n.size) - Math.max(ay0, n.miny);
    return w > 0 && h > 0 ? (w * h) / (n.size * n.size) : 0;
  };
  const chosen: string[] = [];
  let estimate = 0;
  let level = ["0-0-0-0"];
  for (let depth = 0; level.length && depth < 24; depth++) {
    // nodes marked -1 have their subtree in a separate file
    await Promise.all(level.filter((k) => hier[k] === -1).map(loadHier));
    const live = level.filter((k) => (hier[k] ?? 0) > 0 && overlap(k) > 0);
    const levelEstimate = live.reduce((a, k) => a + hier[k] * overlap(k), 0);
    if (chosen.length && estimate + levelEstimate > budget) break;
    chosen.push(...live);
    estimate += levelEstimate;
    // children of every node at this level that touches the area (counts may sit deeper)
    const next: string[] = [];
    for (const k of level) {
      if (hier[k] === undefined || overlap(k) === 0) continue;
      const [d, x, y, z] = k.split("-").map(Number);
      for (let i = 0; i < 8; i++) next.push(`${d + 1}-${x * 2 + (i & 1)}-${y * 2 + ((i >> 1) & 1)}-${z * 2 + ((i >> 2) & 1)}`);
    }
    level = next.filter((k) => hier[k] !== undefined);
  }
  return { nodes: chosen, estimate: Math.round(estimate) };
}

/* ── LAZ decoding (laz-perf, loaded once) ────────────────────────── */

type LazModule = Awaited<ReturnType<typeof import("laz-perf").createLazPerf>>;
let lazPromise: Promise<LazModule> | null = null;
function laz(): Promise<LazModule> {
  if (!lazPromise) {
    lazPromise = import("laz-perf").then(({ createLazPerf }) =>
      // in the browser the .wasm is served from public/atlas (copied from node_modules/laz-perf/lib/web)
      createLazPerf(typeof window === "undefined" ? {} : { locateFile: (f: string) => (f.endsWith(".wasm") ? "/atlas/laz-perf.wasm" : f) })
    );
  }
  return lazPromise;
}

interface RawPoints {
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  cls: Uint8Array;
  inten: Uint16Array;
  n: number;
}

/** Decode one LAZ node, keeping only points inside the area. */
async function decodeNode(buf: ArrayBuffer, aoi: [number, number, number, number]): Promise<RawPoints> {
  const L = await laz();
  const dv = new DataView(buf);
  const format = dv.getUint8(104) & 0x3f;
  const sx = dv.getFloat64(131, true), sy = dv.getFloat64(139, true), sz = dv.getFloat64(147, true);
  const ox = dv.getFloat64(155, true), oy = dv.getFloat64(163, true), oz = dv.getFloat64(171, true);
  const filePtr = L._malloc(buf.byteLength);
  L.HEAPU8.set(new Uint8Array(buf), filePtr);
  const zip = new L.LASZip();
  let pointPtr = 0;
  try {
    zip.open(filePtr, buf.byteLength);
    const count = zip.getCount();
    pointPtr = L._malloc(zip.getPointLength());
    const out: RawPoints = { x: new Float64Array(count), y: new Float64Array(count), z: new Float64Array(count), cls: new Uint8Array(count), inten: new Uint16Array(count), n: 0 };
    const [ax0, ay0, ax1, ay1] = aoi;
    // one view over the WASM heap, renewed if the heap grows (that detaches the old buffer)
    let heap = new DataView(L.HEAPU8.buffer);
    const clsAt = pointPtr + (format >= 6 ? 16 : 15);
    const clsMask = format >= 6 ? 0xff : 0x1f;
    for (let i = 0; i < count; i++) {
      zip.getPoint(pointPtr);
      if (heap.buffer !== L.HEAPU8.buffer) heap = new DataView(L.HEAPU8.buffer);
      const x = heap.getInt32(pointPtr, true) * sx + ox;
      const y = heap.getInt32(pointPtr + 4, true) * sy + oy;
      if (x < ax0 || x > ax1 || y < ay0 || y > ay1) continue;
      const k = out.n++;
      out.x[k] = x;
      out.y[k] = y;
      out.z[k] = heap.getInt32(pointPtr + 8, true) * sz + oz;
      out.inten[k] = heap.getUint16(pointPtr + 12, true);
      out.cls[k] = heap.getUint8(clsAt) & clsMask;
    }
    return out;
  } finally {
    zip.delete();
    L._free(filePtr);
    if (pointPtr) L._free(pointPtr);
  }
}

/** Noise classes (low/high noise) are dropped outright. */
const NOISE = new Set([7, 18]);

/**
 * Load the point cloud around a spot. Tries each candidate dataset in turn (newest first) and
 * returns the first with real coverage there.
 */
export async function loadPointCloud(
  candidates: EptCandidate[],
  center: [number, number],
  opts: { halfSize?: number; budget?: number; signal?: AbortSignal; onProgress?: (p: { stage: string; done: number; total: number; dataset: string }) => void } = {}
): Promise<PointCloud> {
  const halfSize = opts.halfSize ?? 300;
  const budget = opts.budget ?? 1_800_000;
  const [lng, lat] = center;
  const k = 1 / Math.cos((lat * Math.PI) / 180); // Web Mercator stretch at this latitude
  const [cx, cy] = toMerc(lng, lat);
  const aoi: [number, number, number, number] = [cx - halfSize * k, cy - halfSize * k, cx + halfSize * k, cy + halfSize * k];
  let lastError: Error | null = null;

  for (const cand of candidates) {
    const base = cand.url.replace(/\/ept\.json$/, "");
    try {
      opts.onProgress?.({ stage: "Reading the survey index", done: 0, total: 1, dataset: cand.name });
      const ept = await info(base, opts.signal);
      const { nodes } = await selectNodes(base, ept, aoi, budget, opts.signal);
      if (!nodes.length) continue;
      const parts: RawPoints[] = [];
      let done = 0;
      // fetch + decode with a little concurrency
      const queue = [...nodes];
      const worker = async () => {
        while (queue.length) {
          const key = queue.shift()!;
          const res = await fetch(`${base}/ept-data/${key}.laz`, { signal: opts.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status} for ${key}.laz`);
          parts.push(await decodeNode(await res.arrayBuffer(), aoi));
          opts.onProgress?.({ stage: "Downloading laser returns", done: ++done, total: nodes.length, dataset: cand.name });
        }
      };
      await Promise.all(Array.from({ length: Math.min(6, nodes.length) }, worker));
      const cloud = assemble(parts, cx, cy, k, ept.zToMetres, halfSize, cand.name);
      // a survey whose footprint brushes the site but has (almost) nothing here: try the next one
      if (cloud.count < 20_000) {
        lastError = new Error(`${cand.name}: only ${cloud.count} points here`);
        continue;
      }
      return cloud;
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      lastError = e as Error;
    }
  }
  throw lastError ?? new Error("no lidar point cloud covers this spot");
}

function assemble(parts: RawPoints[], cx: number, cy: number, k: number, zToMetres: number, halfSize: number, dataset: string): PointCloud {
  let n = 0;
  for (const p of parts) for (let i = 0; i < p.n; i++) if (!NOISE.has(p.cls[i])) n++;
  // robust floor/ceiling: ignore the extreme 0.1% (birds, pits, stray returns)
  const zs = new Float32Array(n);
  let j = 0;
  for (const p of parts) for (let i = 0; i < p.n; i++) if (!NOISE.has(p.cls[i])) zs[j++] = p.z[i] * zToMetres;
  const sorted = zs.slice().sort();
  const zLo = sorted[Math.floor(n * 0.001)] ?? 0;
  const zHi = sorted[Math.floor(n * 0.999)] ?? 1;
  // intensity is 0–65535 or 0–255 depending on the survey: normalise on the 99th percentile of a sample
  const sample: number[] = [];
  const stride = Math.max(1, Math.floor(n / 50_000));
  let seen = 0;
  for (const p of parts) for (let i = 0; i < p.n; i++) if (seen++ % stride === 0) sample.push(p.inten[i]);
  sample.sort((a, b) => a - b);
  const maxI = Math.max(1, sample[Math.floor(sample.length * 0.99)] ?? 1);
  const positions = new Float32Array(n * 3);
  const classes = new Uint8Array(n);
  const intensity = new Float32Array(n);
  let w = 0;
  let ground = 0;
  for (const p of parts) {
    for (let i = 0; i < p.n; i++) {
      if (NOISE.has(p.cls[i])) continue;
      positions[w * 3] = (p.x[i] - cx) / k;
      positions[w * 3 + 1] = (p.y[i] - cy) / k;
      positions[w * 3 + 2] = Math.min(zHi, Math.max(zLo, p.z[i] * zToMetres)) - zLo;
      classes[w] = p.cls[i];
      intensity[w] = Math.min(1, p.inten[i] / maxI);
      if (p.cls[i] === 2) ground++;
      w++;
    }
  }
  return { count: w, positions, classes, intensity, halfSize, zRange: [0, zHi - zLo], zBase: zLo, dataset, groundCount: ground };
}
