/* ------------------------------------------------------------------ */
/*  A lake basin as a grid: real ground heights, which cells lie       */
/*  inside the mapped lake, the shoreline height and the area /        */
/*  volume / depth of water at any level. Pure maths — the 3D view     */
/*  (BasinFill) and the tests both use it.                             */
/* ------------------------------------------------------------------ */

export type LakeGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export type BBox = [number, number, number, number];

const polygons = (g: LakeGeometry): GeoJSON.Position[][][] => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

export function geometryBBox(g: LakeGeometry): BBox {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const poly of polygons(g)) for (const [x, y] of poly[0]) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return [w, s, e, n];
}

/** Grow a box by a fraction of its size on every side. */
export const padBBox = ([w, s, e, n]: BBox, f: number): BBox => [w - (e - w) * f, s - (n - s) * f, e + (e - w) * f, n + (n - s) * f];

function inRing(x: number, y: number, ring: GeoJSON.Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Point-in-lake, holes (islands) excluded. */
export function inLake(lng: number, lat: number, g: LakeGeometry) {
  return polygons(g).some((poly) => inRing(lng, lat, poly[0]) && !poly.slice(1).some((hole) => inRing(lng, lat, hole)));
}

/** Highest Terrarium zoom whose tiles over `bbox` stay within `maxTiles` (and ≤ `cap`). */
export function zoomForBBox([w, s, e, n]: BBox, maxTiles = 30, cap = 12) {
  const tx = (lng: number, z: number) => ((lng + 180) / 360) * 2 ** z;
  const ty = (lat: number, z: number) => {
    const r = (lat * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
  };
  for (let z = cap; z > 2; z--) {
    const count = (Math.floor(tx(e, z)) - Math.floor(tx(w, z)) + 1) * (Math.floor(ty(s, z)) - Math.floor(ty(n, z)) + 1);
    if (count <= maxTiles) return z;
  }
  return 3;
}

export interface Basin {
  bbox: BBox;
  cols: number;
  rows: number;
  /** ground height per cell (m), row 0 = north */
  heights: Float32Array;
  /** 1 where the cell lies inside the mapped lake */
  inside: Uint8Array;
  /** lowest ground inside the lake (m) */
  floor: number;
  /** highstand estimate: median ground height along the mapped shoreline (m) */
  shoreline: number;
  /** cell area (km²) for each row — cells shrink toward the pole */
  rowArea: Float64Array;
  /** cell size (km) */
  cellKmX: number;
  cellKmY: number;
}

export function buildBasin(geometry: LakeGeometry, bbox: BBox, elevation: (lng: number, lat: number) => number, cols = 256): Basin {
  const [w, s, e, n] = bbox;
  const midLat = (s + n) / 2;
  const kmX = (e - w) * 111.32 * Math.cos((midLat * Math.PI) / 180);
  const kmY = (n - s) * 110.574;
  const rows = Math.max(16, Math.round((cols * kmY) / kmX));
  const heights = new Float32Array(cols * rows);
  const inside = new Uint8Array(cols * rows);
  const rowArea = new Float64Array(rows);
  const dLng = (e - w) / (cols - 1);
  const dLat = (n - s) / (rows - 1);
  // every ring edge once; each row is filled by scanline (even–odd, so islands stay dry)
  const edges: [number, number, number, number][] = [];
  for (const poly of polygons(geometry)) for (const ring of poly) for (let i = 0; i < ring.length - 1; i++) edges.push([ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1]]);
  let floor = Infinity;
  for (let r = 0; r < rows; r++) {
    const lat = n - r * dLat;
    rowArea[r] = dLng * 111.32 * Math.cos((lat * Math.PI) / 180) * dLat * 110.574;
    const xs: number[] = [];
    for (const [x1, y1, x2, y2] of edges) if (y1 > lat !== y2 > lat) xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - w) / dLng));
      const c1 = Math.min(cols - 1, Math.floor((xs[k + 1] - w) / dLng));
      for (let c = c0; c <= c1; c++) inside[r * cols + c] = 1;
    }
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const h = elevation(w + c * dLng, lat);
      heights[i] = Number.isFinite(h) ? h : 0;
      if (inside[i] && heights[i] < floor) floor = heights[i];
    }
  }
  // shoreline: the outline traces the highstand, so its median height is the old water level
  const shore: number[] = [];
  for (const poly of polygons(geometry)) {
    const ring = poly[0];
    const step = Math.max(1, Math.floor(ring.length / 600));
    for (let i = 0; i < ring.length; i += step) {
      const h = elevation(ring[i][0], ring[i][1]);
      if (Number.isFinite(h)) shore.push(h);
    }
  }
  shore.sort((a, b) => a - b);
  if (!Number.isFinite(floor)) floor = shore[0] ?? 0;
  else {
    // the very lowest cells are often DEM pits; the floor is the 0.5th percentile of the lake bed
    const bed: number[] = [];
    for (let i = 0; i < heights.length; i++) if (inside[i]) bed.push(heights[i]);
    bed.sort((a, b) => a - b);
    floor = bed[Math.floor(bed.length * 0.005)] ?? floor;
  }
  const shoreline = Math.max(shore[Math.floor(shore.length / 2)] ?? floor + 10, floor + 5);
  return { bbox, cols, rows, heights, inside, floor, shoreline, rowArea, cellKmX: kmX / (cols - 1), cellKmY: kmY / (rows - 1) };
}

export interface WaterStats {
  level: number;
  /** water surface inside the mapped lake (km²) */
  areaKm2: number;
  volumeKm3: number;
  maxDepth: number;
}

/** How much water the mapped lake holds with its surface at `level` metres. */
export function waterAt(b: Basin, level: number): WaterStats {
  let area = 0;
  let volume = 0;
  let maxDepth = 0;
  for (let r = 0; r < b.rows; r++) {
    const a = b.rowArea[r];
    for (let c = 0; c < b.cols; c++) {
      const i = r * b.cols + c;
      if (!b.inside[i]) continue;
      const d = level - b.heights[i];
      if (d <= 0) continue;
      area += a;
      volume += (a * d) / 1000;
      if (d > maxDepth) maxDepth = d;
    }
  }
  return { level, areaKm2: area, volumeKm3: volume, maxDepth };
}
