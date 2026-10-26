/* ------------------------------------------------------------------ */
/*  Terrain painter. A 1px-per-tile color map (hillshaded) is upscaled */
/*  with smoothing for soft biome blends, then each 512px chunk gets   */
/*  baked texture details once and is cached (LRU) until it changes.   */
/* ------------------------------------------------------------------ */
import { hash2, valueNoise } from "../sim/rng";
import { CHUNKS_X, CHUNKS_Y, CHUNK_TILES, REGION, type Terrain } from "../sim/terrain";
import { MAP_H, MAP_W, T, TILE } from "../sim/types";

export const TILE_RGB: Record<T, [number, number, number]> = {
  [T.Deep]: [38, 104, 146],
  [T.Shallow]: [78, 160, 196],
  [T.Sand]: [231, 212, 162],
  [T.Grass]: [140, 190, 88],
  [T.Jungle]: [78, 142, 60],
  [T.Forest]: [62, 110, 54],
  [T.Swamp]: [96, 122, 74],
  [T.Mud]: [122, 92, 60],
  [T.Tar]: [34, 29, 26],
  [T.Rock]: [156, 147, 134],
  [T.Mountain]: [122, 113, 104],
  [T.Cliff]: [104, 94, 86],
  [T.Volcano]: [110, 78, 60],
  [T.Basalt]: [72, 66, 64],
  [T.Dirt]: [180, 142, 94],
  [T.Cave]: [40, 34, 30],
  [T.Nest]: [206, 180, 124],
  [T.River]: [88, 170, 205],
  [T.Dune]: [226, 186, 122],
  [T.Snow]: [236, 242, 250],
  [T.Ice]: [186, 220, 238],
};

/** the desert's sand (warmer + deeper than a beach) */
const DESERT_SAND: [number, number, number] = [228, 196, 138];
/** snow on a high peak / scree */
const SNOWCAP: [number, number, number] = [240, 245, 252];

const CHUNK_PX = CHUNK_TILES * TILE;
/** painted map pixels per tile */
const RES = 4;
const NB: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const NB2: [number, number][] = [
  [2, 0],
  [-2, 0],
  [0, 2],
  [0, -2],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
];
const MAX_CACHED = 42;

type Canvas = HTMLCanvasElement;

function makeCanvas(w: number, h: number): Canvas {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export class TerrainRenderer {
  private colorMap: Canvas;
  private chunks = new Map<number, { canvas: Canvas; version: number; used: number }>();
  private colorVersion = new Uint32Array(CHUNKS_X * CHUNKS_Y).fill(0xffffffff);
  private frame = 0;
  /** water/shore tiles per chunk for animated overlays */
  waterTiles: number[][] = [];
  shoreTiles: number[][] = [];
  waterfallTiles: number[] = [];
  private listsVersion = -1;

  /** sub-tile terrain id per map pixel (organic, domain-warped edges) */
  private sub = new Uint8Array(MAP_W * RES * MAP_H * RES);

  constructor(private terrain: Terrain) {
    this.colorMap = makeCanvas(MAP_W * RES, MAP_H * RES);
    this.refreshRegion(0, 0, MAP_W - 1, MAP_H - 1);
    this.colorVersion.set(this.terrain.chunkVersion);
  }

  /** The painted map image (also used by the minimap). */
  get mapImage() {
    return this.colorMap;
  }

  /** Terrain type actually painted at a world point (after edge warping). */
  paintedAt(wx: number, wy: number): T {
    const px = Math.max(0, Math.min(MAP_W * RES - 1, Math.floor((wx / TILE) * RES)));
    const py = Math.max(0, Math.min(MAP_H * RES - 1, Math.floor((wy / TILE) * RES)));
    return this.sub[py * MAP_W * RES + px] as T;
  }

  /** Repaint part of the map (tile coords, inclusive). */
  private refreshRegion(tx0: number, ty0: number, tx1: number, ty1: number) {
    const t = this.terrain;
    const seed = t.seed;
    const SW = MAP_W * RES;
    tx0 = Math.max(0, tx0 - 1);
    ty0 = Math.max(0, ty0 - 1);
    tx1 = Math.min(MAP_W - 1, tx1 + 1);
    ty1 = Math.min(MAP_H - 1, ty1 + 1);
    const px0 = tx0 * RES;
    const py0 = ty0 * RES;
    const pw = (tx1 - tx0 + 1) * RES;
    const ph = (ty1 - ty0 + 1) * RES;
    // (cliffs + caves keep crisp edges; mountain rock blends into the snow + scree round it)
    const sharp = (k: number) => k === T.Cliff || k === T.Cave;
    // pass 1: which terrain lives at each sub-pixel (wobbly, natural borders)
    for (let py = py0; py < py0 + ph; py++) {
      for (let px = px0; px < px0 + pw; px++) {
        const fx = (px + 0.5) / RES;
        const fy = (py + 0.5) / RES;
        const plain = t.tiles[Math.floor(fy) * MAP_W + Math.floor(fx)];
        let k = plain;
        if (!sharp(plain)) {
          const wx = fx + (valueNoise(fx * 0.8, fy * 0.8, seed + 11) - 0.5) * 1.3 + (valueNoise(fx * 2.6, fy * 2.6, seed + 12) - 0.5) * 0.5;
          const wy = fy + (valueNoise(fx * 0.8, fy * 0.8, seed + 13) - 0.5) * 1.3 + (valueNoise(fx * 2.6, fy * 2.6, seed + 14) - 0.5) * 0.5;
          const sx = Math.max(0, Math.min(MAP_W - 1, Math.floor(wx)));
          const sy = Math.max(0, Math.min(MAP_H - 1, Math.floor(wy)));
          const warped = t.tiles[sy * MAP_W + sx];
          if (!sharp(warped)) k = warped;
        }
        this.sub[py * SW + px] = k;
      }
    }
    // pass 2: colors + shading + shoreline
    const ctx = this.colorMap.getContext("2d")!;
    const img = ctx.createImageData(pw, ph);
    const isW = (k: number) => k === T.Deep || k === T.Shallow || k === T.River;
    const at = (x: number, y: number) => this.sub[Math.max(0, Math.min(MAP_H * RES - 1, y)) * SW + Math.max(0, Math.min(SW - 1, x))];
    const H = (x: number, y: number) => t.height[Math.max(0, Math.min(MAP_H - 1, y)) * MAP_W + Math.max(0, Math.min(MAP_W - 1, x))];
    for (let py = py0; py < py0 + ph; py++) {
      for (let px = px0; px < px0 + pw; px++) {
        const k = at(px, py) as T;
        const fx = (px + 0.5) / RES;
        const fy = (py + 0.5) / RES;
        let [r, g, b] = TILE_RGB[k];
        const water = isW(k);
        const ti = Math.floor(fy) * MAP_W + Math.floor(fx);
        const e = t.elev[ti];
        // the desert's sand is warmer; dunes get long wind-blown ridges (they read even zoomed right out)
        if (k === T.Sand && t.region[ti] === REGION.desert) [r, g, b] = DESERT_SAND;
        if (k === T.Dune) {
          const ridge = Math.sin((fx * 1.25 + fy * 0.42 + valueNoise(fx * 0.25, fy * 0.25, seed + 31) * 3.2) * Math.PI * 2);
          const lit = ridge > 0.55 ? 14 : ridge < -0.6 ? -16 : ridge * 4;
          r += lit;
          g += lit * 0.9;
          b += lit * 0.6;
        }
        // high up, the rock goes grey and the snow comes down onto it
        if ((k === T.Mountain || k === T.Rock || k === T.Cliff) && e > 0.55) {
          const snow = Math.min(1, (e - 0.55) * (k === T.Mountain ? 3.2 : 1.6)) * (0.55 + valueNoise(fx * 0.7, fy * 0.7, seed + 33) * 0.6);
          r += (SNOWCAP[0] - r) * Math.min(1, snow);
          g += (SNOWCAP[1] - g) * Math.min(1, snow);
          b += (SNOWCAP[2] - b) * Math.min(1, snow);
        }
        // smooth hillshade from interpolated height (light from the north-west)
        const ix = Math.floor(fx - 0.5);
        const iy = Math.floor(fy - 0.5);
        const ax = fx - 0.5 - ix;
        const ay = fy - 0.5 - iy;
        const hAt = (x: number, y: number) => {
          const h00 = H(x, y);
          const h10 = H(x + 1, y);
          const h01 = H(x, y + 1);
          const h11 = H(x + 1, y + 1);
          return h00 * (1 - ax) * (1 - ay) + h10 * ax * (1 - ay) + h01 * (1 - ax) * ay + h11 * ax * ay;
        };
        const shade = water ? 0 : (hAt(ix - 1, iy) - hAt(ix + 1, iy) + hAt(ix, iy - 1) - hAt(ix, iy + 1)) * 110;
        const patch = (valueNoise(fx * 0.3, fy * 0.3, seed + 21) - 0.5) * (water ? 10 : 20);
        const grain = (hash2(px, py, seed + 5) - 0.5) * (water ? 3 : 7);
        if (water) {
          if (t.salt[Math.floor(fy) * MAP_W + Math.floor(fx)] && k === T.Deep) {
            r -= 10;
            g -= 14;
            b -= 4;
          }
          // foam where water touches land
          let shore = 0;
          for (const [dx, dy] of NB) if (!isW(at(px + dx, py + dy))) shore++;
          if (shore) {
            const m = Math.min(1, shore / 3) * 0.7;
            r += (236 - r) * m;
            g += (246 - g) * m;
            b += (250 - b) * m;
          }
        } else {
          let wet = 0;
          for (const [dx, dy] of NB2) if (isW(at(px + dx, py + dy))) wet++;
          if (wet && (k === T.Sand || k === T.Grass || k === T.Dirt || k === T.Mud || k === T.Jungle || k === T.Swamp)) {
            const m = Math.min(1, wet / 4) * 0.22;
            r *= 1 - m;
            g *= 1 - m * 0.7;
            b *= 1 - m * 0.3;
          }
        }
        const green = k === T.Grass || k === T.Jungle || k === T.Forest;
        // snow + ice take the shade blue (shadowed snow is blue, not grey)
        const cold = k === T.Snow || k === T.Ice || e > 0.66;
        r = clamp255(r + shade * (cold && shade < 0 ? 0.75 : 1) + patch * (green ? 0.6 : cold ? 0.3 : 1) + grain);
        g = clamp255(g + shade * (cold && shade < 0 ? 0.85 : 1) + patch * (green ? 1.3 : cold ? 0.3 : 1) + grain);
        b = clamp255(b + shade * (cold && shade < 0 ? 0.55 : 1) + patch * 0.4 + grain);
        const o = ((py - py0) * pw + (px - px0)) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = 255;
      }
    }
    blur(img.data, pw, ph);
    // keep the outer margin un-blurred-in so neighbouring repaints line up
    ctx.putImageData(img, px0, py0, px0 === 0 ? 0 : RES, py0 === 0 ? 0 : RES, pw - (px0 === 0 ? 0 : RES) * 2, ph - (py0 === 0 ? 0 : RES) * 2);
  }

  /** Repaint chunks whose ground changed since we last painted them. */
  private refreshDirty() {
    const cv = this.terrain.chunkVersion;
    for (let i = 0; i < cv.length; i++) {
      if (cv[i] === this.colorVersion[i]) continue;
      const cx = i % CHUNKS_X;
      const cy = Math.floor(i / CHUNKS_X);
      this.refreshRegion(cx * CHUNK_TILES, cy * CHUNK_TILES, cx * CHUNK_TILES + CHUNK_TILES - 1, cy * CHUNK_TILES + CHUNK_TILES - 1);
      this.colorVersion[i] = cv[i];
      // neighbours share painted borders: re-bake them too
      for (const [dx, dy] of NB) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= CHUNKS_X || ny >= CHUNKS_Y) continue;
        const n = this.chunks.get(ny * CHUNKS_X + nx);
        if (n) n.version = -1;
      }
    }
  }

  private buildLists() {
    const t = this.terrain;
    this.waterTiles = Array.from({ length: CHUNKS_X * CHUNKS_Y }, () => []);
    this.shoreTiles = Array.from({ length: CHUNKS_X * CHUNKS_Y }, () => []);
    this.waterfallTiles = [];
    const isW = (tt: number) => tt === T.Deep || tt === T.Shallow || tt === T.River;
    for (let y = 1; y < MAP_H - 1; y++) {
      for (let x = 1; x < MAP_W - 1; x++) {
        const i = y * MAP_W + x;
        const tt = t.tiles[i];
        const c = Math.floor(y / CHUNK_TILES) * CHUNKS_X + Math.floor(x / CHUNK_TILES);
        if (isW(tt)) {
          this.waterTiles[c].push(i);
          if (!isW(t.tiles[i - 1]) || !isW(t.tiles[i + 1]) || !isW(t.tiles[i - MAP_W]) || !isW(t.tiles[i + MAP_W])) this.shoreTiles[c].push(i);
        } else if (tt === T.Cliff && (t.tiles[i - MAP_W] === T.River || t.tiles[i + MAP_W] === T.River || t.tiles[i - 2 * MAP_W] === T.River)) {
          this.waterfallTiles.push(i);
        }
      }
    }
    this.listsVersion = t.version;
  }

  /** Make sure lists + color map reflect terrain edits. */
  sync() {
    if (this.listsVersion !== this.terrain.version) {
      this.refreshDirty();
      this.buildLists();
    }
  }

  private bake(cx: number, cy: number): Canvas {
    const key = cy * CHUNKS_X + cx;
    const old = this.chunks.get(key);
    const canvas = old?.canvas ?? makeCanvas(CHUNK_PX, CHUNK_PX);
    const ctx = canvas.getContext("2d")!;
    const t = this.terrain;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // 1 tile of margin on each side so the smooth blends line up across chunks
    const sx = cx * CHUNK_TILES - 1;
    const sy = cy * CHUNK_TILES - 1;
    ctx.clearRect(0, 0, CHUNK_PX, CHUNK_PX);
    ctx.drawImage(this.colorMap, sx * RES, sy * RES, (CHUNK_TILES + 2) * RES, (CHUNK_TILES + 2) * RES, -TILE, -TILE, CHUNK_PX + TILE * 2, CHUNK_PX + TILE * 2);

    for (let ty = 0; ty < CHUNK_TILES; ty++) {
      for (let tx = 0; tx < CHUNK_TILES; tx++) {
        const gx = cx * CHUNK_TILES + tx;
        const gy = cy * CHUNK_TILES + ty;
        if (gx >= MAP_W || gy >= MAP_H) continue;
        const raw = t.tiles[gy * MAP_W + gx] as T;
        const tile = raw === T.Cliff || raw === T.Cave ? raw : this.paintedAt(gx * TILE + TILE / 2, gy * TILE + TILE / 2);
        const px = tx * TILE;
        const py = ty * TILE;
        const h = (k: number) => hash2(gx, gy, t.seed + k);
        detailTile(ctx, tile, px, py, h, gx, gy, (k) => t.tiles[k] as T, t);
      }
    }
    return canvas;
  }

  /** Draw visible terrain in world space (ctx already camera-transformed). */
  draw(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, zoom: number) {
    this.sync();
    this.frame++;
    if (zoom < 0.42) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.colorMap, 0, 0, MAP_W * RES, MAP_H * RES, 0, 0, MAP_W * TILE, MAP_H * TILE);
      return;
    }
    const c0 = Math.max(0, Math.floor(x0 / CHUNK_PX));
    const c1 = Math.min(CHUNKS_X - 1, Math.floor(x1 / CHUNK_PX));
    const r0 = Math.max(0, Math.floor(y0 / CHUNK_PX));
    const r1 = Math.min(CHUNKS_Y - 1, Math.floor(y1 / CHUNK_PX));
    let baked = 0;
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const key = cy * CHUNKS_X + cx;
        const v = this.terrain.chunkVersion[key];
        let entry = this.chunks.get(key);
        if (!entry || entry.version !== v) {
          // bake at most a few per frame so panning never hitches
          if (baked >= 3 && entry) {
            entry.used = this.frame;
          } else {
            const canvas = this.bake(cx, cy);
            entry = { canvas, version: v, used: this.frame };
            this.chunks.set(key, entry);
            baked++;
          }
        }
        if (!entry) {
          ctx.drawImage(this.colorMap, cx * CHUNK_TILES * RES, cy * CHUNK_TILES * RES, CHUNK_TILES * RES, CHUNK_TILES * RES, cx * CHUNK_PX, cy * CHUNK_PX, CHUNK_PX, CHUNK_PX);
          continue;
        }
        entry.used = this.frame;
        // +0.5px overlap hides hairline seams when zoomed
        ctx.drawImage(entry.canvas, cx * CHUNK_PX, cy * CHUNK_PX, CHUNK_PX + 0.6, CHUNK_PX + 0.6);
      }
    }
    if (this.chunks.size > MAX_CACHED) {
      const sorted = Array.from(this.chunks.entries()).sort((a, b) => a[1].used - b[1].used);
      for (let i = 0; i < sorted.length - MAX_CACHED; i++) this.chunks.delete(sorted[i][0]);
    }
  }

  invalidateAll() {
    this.chunks.clear();
    this.listsVersion = -1;
  }
}

/** Two-pass 3-tap box blur (in place) to anti-alias the painted borders. */
function blur(d: Uint8ClampedArray, w: number, h: number) {
  const tmp = new Uint8ClampedArray(d.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const l = (y * w + Math.max(0, x - 1)) * 4;
      const r = (y * w + Math.min(w - 1, x + 1)) * 4;
      for (let c = 0; c < 3; c++) tmp[o + c] = (d[l + c] + d[o + c] * 2 + d[r + c]) >> 2;
      tmp[o + 3] = 255;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const u = (Math.max(0, y - 1) * w + x) * 4;
      const b = (Math.min(h - 1, y + 1) * w + x) * 4;
      for (let c = 0; c < 3; c++) d[o + c] = (tmp[u + c] + tmp[o + c] * 2 + tmp[b + c]) >> 2;
    }
  }
}

function clamp255(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function detailTile(ctx: CanvasRenderingContext2D, tile: T, px: number, py: number, h: (k: number) => number, gx: number, gy: number, tileAt: (i: number) => T, tr: Terrain) {
  const elev = tr.elev[gy * MAP_W + gx];
  switch (tile) {
    case T.Dune: {
      // wind ripples: shallow arcs across the slope, a sun-lit crest + a shaded lee
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const y = py + (k + 0.5) * (TILE / 3) + (h(10 + k) - 0.5) * 4;
        ctx.strokeStyle = "rgba(255,236,190,0.45)";
        ctx.beginPath();
        ctx.moveTo(px, y);
        ctx.quadraticCurveTo(px + TILE / 2, y - 3 - h(20 + k) * 2, px + TILE, y + (h(30 + k) - 0.5) * 3);
        ctx.stroke();
        ctx.strokeStyle = "rgba(150,104,52,0.22)";
        ctx.beginPath();
        ctx.moveTo(px, y + 1.5);
        ctx.quadraticCurveTo(px + TILE / 2, y - 1.5 - h(20 + k) * 2, px + TILE, y + 1.5 + (h(30 + k) - 0.5) * 3);
        ctx.stroke();
      }
      if (h(4) > 0.97) {
        // a sun-bleached bone / a pebble
        ctx.fillStyle = h(5) > 0.5 ? "#f3ead6" : "#9a8466";
        ctx.beginPath();
        ctx.ellipse(px + h(6) * TILE, py + h(7) * TILE, 3, 1.4, h(8) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case T.Snow: {
      // wind streaks + sparkle
      ctx.strokeStyle = "rgba(170,195,225,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 2; k++) {
        const y = py + h(10 + k) * TILE;
        ctx.moveTo(px + h(20 + k) * 10, y);
        ctx.lineTo(px + 14 + h(30 + k) * 16, y - 1);
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (let k = 0; k < 3; k++) ctx.fillRect(px + h(40 + k) * TILE, py + h(50 + k) * TILE, 1.2, 1.2);
      // deep drifts: soft mounds, sunlit on top with a blue shadow in their lee
      if (h(11) > 0.45) {
        const dx = px + h(12) * TILE;
        const dy = py + h(13) * TILE;
        const rw = 8 + h(14) * 10;
        ctx.fillStyle = "rgba(150,180,220,0.28)";
        ctx.beginPath();
        ctx.ellipse(dx + 2, dy + 2.5, rw, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.ellipse(dx, dy, rw, 3, 0, Math.PI, 0);
        ctx.fill();
      }
      if (h(6) > 0.82) {
        // a snow-covered boulder: grey sides, a thick white cap
        const bx = px + h(7) * TILE;
        const by = py + h(8) * TILE;
        const r = 3 + h(9) * 3.5;
        ctx.fillStyle = "rgba(110,108,118,0.65)";
        ctx.beginPath();
        ctx.ellipse(bx, by, r, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(252,253,255,0.95)";
        ctx.beginPath();
        ctx.ellipse(bx - 0.4, by - r * 0.35, r * 0.95, r * 0.42, 0, Math.PI, 0);
        ctx.fill();
      }
      if (h(15) > 0.9) {
        // a frozen patch: glassy ice with a glint
        ctx.fillStyle = "rgba(170,215,240,0.5)";
        ctx.beginPath();
        ctx.ellipse(px + h(16) * TILE, py + h(17) * TILE, 6 + h(18) * 5, 2.5, h(19) - 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fillRect(px + h(16) * TILE - 2, py + h(17) * TILE - 0.6, 3, 1.2);
      }
      if (h(21) > 0.93 && elev > 0.4 && elev < 0.72) {
        // a stunted alpine pine, snow loaded on its boughs
        const tx = px + h(22) * TILE;
        const ty = py + h(23) * TILE;
        const s = 0.7 + h(24) * 0.5;
        ctx.fillStyle = "rgba(60,50,40,0.8)";
        ctx.fillRect(tx - 1, ty - 3 * s, 2, 4 * s);
        for (let k = 0; k < 3; k++) {
          const yy = ty - (4 + k * 4) * s;
          const ww = (7 - k * 2) * s;
          ctx.fillStyle = "rgba(40,78,58,0.95)";
          ctx.beginPath();
          ctx.moveTo(tx - ww, yy + 3 * s);
          ctx.lineTo(tx, yy - 3 * s);
          ctx.lineTo(tx + ww, yy + 3 * s);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "rgba(250,252,255,0.9)";
          ctx.beginPath();
          ctx.moveTo(tx - ww * 0.8, yy + 1.5 * s);
          ctx.lineTo(tx, yy - 3 * s);
          ctx.lineTo(tx + ww * 0.6, yy + 0.8 * s);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    }
    case T.Ice: {
      // glassy sheen + cracks
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.beginPath();
      ctx.ellipse(px + h(1) * TILE, py + h(2) * TILE, 7, 2, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(90,140,180,0.4)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      const cx = px + h(3) * TILE;
      const cy = py + h(4) * TILE;
      for (let k = 0; k < 3; k++) {
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + (h(10 + k) - 0.5) * 22, cy + (h(20 + k) - 0.5) * 16);
      }
      ctx.stroke();
      break;
    }
    case T.Grass:
    case T.Nest: {
      ctx.strokeStyle = tile === T.Nest ? "rgba(120,90,50,0.45)" : h(1) > 0.5 ? "rgba(70,120,40,0.35)" : "rgba(190,225,120,0.35)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const n = 3 + Math.floor(h(2) * 4);
      for (let k = 0; k < n; k++) {
        const x = px + h(10 + k) * TILE;
        const y = py + h(20 + k) * TILE;
        if (tile === T.Nest) {
          ctx.moveTo(x - 4, y);
          ctx.lineTo(x + 4, y - 1 + h(30 + k) * 2);
        } else {
          ctx.moveTo(x, y);
          ctx.lineTo(x - 1 + h(30 + k) * 2, y - 4 - h(40 + k) * 3);
        }
      }
      ctx.stroke();
      if (tile === T.Grass && h(3) > 0.94) {
        ctx.fillStyle = ["#fff7d6", "#ffd84a", "#ff9ec4", "#c9a6ff"][Math.floor(h(4) * 4)];
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(px + h(50 + k) * TILE, py + h(60 + k) * TILE, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case T.Jungle:
    case T.Forest:
    case T.Swamp: {
      ctx.fillStyle = tile === T.Swamp ? "rgba(140,170,60,0.35)" : tile === T.Jungle ? "rgba(30,80,30,0.3)" : "rgba(40,60,30,0.32)";
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(px + h(10 + k) * TILE, py + h(20 + k) * TILE, 2 + h(30 + k) * 4, 1.5 + h(40 + k) * 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (tile === T.Forest && h(5) > 0.6) {
        ctx.fillStyle = "rgba(150,110,60,0.35)";
        ctx.fillRect(px + h(6) * TILE, py + h(7) * TILE, 3, 1.4);
      }
      break;
    }
    case T.Sand: {
      ctx.fillStyle = "rgba(170,140,90,0.35)";
      for (let k = 0; k < 5; k++) ctx.fillRect(px + h(10 + k) * TILE, py + h(20 + k) * TILE, 1.4, 1.4);
      if (h(3) > 0.96) {
        ctx.fillStyle = "#f6e9dc";
        ctx.beginPath();
        ctx.arc(px + h(4) * TILE, py + h(5) * TILE, 2.5, Math.PI, 0);
        ctx.fill();
      }
      break;
    }
    case T.Rock:
    case T.Basalt:
    case T.Mountain: {
      ctx.fillStyle = tile === T.Basalt ? "rgba(30,26,26,0.28)" : h(9) > 0.5 ? "rgba(205,198,186,0.45)" : "rgba(95,88,80,0.22)";
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.ellipse(px + h(10 + k) * TILE, py + h(20 + k) * TILE, 1.5 + h(30 + k) * 3, 1 + h(40 + k) * 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = tile === T.Basalt ? "rgba(20,16,16,0.3)" : "rgba(70,64,58,0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + h(50) * TILE, py + h(51) * TILE);
      ctx.lineTo(px + h(52) * TILE, py + h(53) * TILE);
      ctx.lineTo(px + h(54) * TILE, py + h(55) * TILE);
      ctx.stroke();
      // crags: a lit edge + a shadowed face, the bigger the higher up
      if (tile === T.Mountain || (tile === T.Rock && elev > 0.5)) {
        ctx.strokeStyle = "rgba(40,36,44,0.35)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        const cx = px + h(60) * TILE;
        const cy = py + h(61) * TILE;
        ctx.moveTo(cx - 6, cy + 4);
        ctx.lineTo(cx, cy - 5);
        ctx.lineTo(cx + 7, cy + 3);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy + 3);
        ctx.lineTo(cx - 0.5, cy - 4.5);
        ctx.stroke();
        // high rock under snow: a white cap on the crag + snow packed in the cracks
        if (tile === T.Rock && elev > 0.55) {
          ctx.fillStyle = "rgba(248,251,255,0.85)";
          ctx.beginPath();
          ctx.moveTo(cx - 6, cy + 2);
          ctx.quadraticCurveTo(cx, cy - 8, cx + 7, cy + 2);
          ctx.quadraticCurveTo(cx, cy - 2, cx - 6, cy + 2);
          ctx.fill();
          ctx.fillStyle = "rgba(240,246,252,0.55)";
          ctx.beginPath();
          ctx.ellipse(px + h(62) * TILE, py + h(63) * TILE, 5 + h(64) * 4, 2 + h(64) * 1.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (tile === T.Mountain && (gy < 6 || elev > 0.7) && h(7) > 0.3) {
        ctx.fillStyle = "rgba(250,250,255,0.75)";
        ctx.beginPath();
        ctx.ellipse(px + h(8) * TILE, py + h(9) * TILE, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case T.Cliff: {
      // a rough rock wall: jagged lit lip, shaded face, cracks, and a cast shadow below
      const left = tileAt(gy * MAP_W + gx - 1) === T.Cliff || tileAt(gy * MAP_W + gx - 1) === T.Cave;
      const right = tileAt(gy * MAP_W + gx + 1) === T.Cliff || tileAt(gy * MAP_W + gx + 1) === T.Cave;
      const below = tileAt((gy + 1) * MAP_W + gx) === T.Cliff;
      const top = (k: number) => py + 2 + hash2(gx * 4 + k, gy, 3) * 6;
      const x0 = px - (left ? 0 : 2);
      const x1 = px + TILE + (right ? 0 : 2);
      const bottom = py + TILE + (below ? 0 : 4);
      // (high up, the rock face is pale and frosted, with snow along the lip)
      const icy = tr.elev[gy * MAP_W + gx] > 0.6;
      const face = ctx.createLinearGradient(0, py, 0, bottom);
      face.addColorStop(0, icy ? "#e6ecf4" : "#a49a8c");
      face.addColorStop(0.18, icy ? "#a9a7ad" : "#857a6d");
      face.addColorStop(1, icy ? "#5d5a62" : "#4e463f");
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.moveTo(x0, top(0));
      for (let k = 1; k <= 4; k++) ctx.lineTo(px + (k / 4) * TILE + (k === 4 ? x1 - px - TILE : 0), top(k));
      ctx.lineTo(x1, bottom - (right ? 0 : 3));
      ctx.quadraticCurveTo(px + TILE / 2, bottom + 2, x0, bottom - (left ? 0 : 3));
      ctx.closePath();
      ctx.fill();
      // lit lip
      ctx.strokeStyle = "rgba(225,215,195,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, top(0));
      for (let k = 1; k <= 4; k++) ctx.lineTo(px + (k / 4) * TILE + (k === 4 ? x1 - px - TILE : 0), top(k));
      ctx.stroke();
      // strata + cracks
      ctx.strokeStyle = "rgba(40,34,30,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const sy = py + 12 + h(5) * 8;
      ctx.moveTo(px, sy);
      ctx.quadraticCurveTo(px + TILE / 2, sy + (h(6) - 0.5) * 6, px + TILE, sy + (h(7) - 0.5) * 4);
      for (let k = 0; k < 2; k++) {
        const cx = px + 6 + h(10 + k) * (TILE - 12);
        ctx.moveTo(cx, top(1) + 4);
        ctx.lineTo(cx + (h(20 + k) - 0.5) * 6, py + TILE * 0.6);
        ctx.lineTo(cx + (h(30 + k) - 0.5) * 8, bottom - 4);
      }
      ctx.stroke();
      if (h(40) > 0.6) {
        ctx.fillStyle = "rgba(90,130,60,0.7)";
        ctx.beginPath();
        ctx.ellipse(px + h(41) * TILE, top(2) + 1, 5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!below) {
        const sh = ctx.createLinearGradient(0, bottom - 2, 0, bottom + 14);
        sh.addColorStop(0, "rgba(20,25,20,0.35)");
        sh.addColorStop(1, "rgba(20,25,20,0)");
        ctx.fillStyle = sh;
        ctx.fillRect(x0, bottom - 2, x1 - x0, 16);
      }
      break;
    }
    case T.Volcano: {
      const a = Math.atan2(gy - 20, gx - 128);
      ctx.strokeStyle = "rgba(60,40,30,0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + TILE / 2, py + TILE / 2);
      ctx.lineTo(px + TILE / 2 + Math.cos(a) * 14, py + TILE / 2 + Math.sin(a) * 14);
      ctx.stroke();
      break;
    }
    case T.Mud:
    case T.Tar: {
      ctx.strokeStyle = tile === T.Tar ? "rgba(255,255,255,0.18)" : "rgba(60,40,20,0.45)";
      ctx.lineWidth = 1;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        ctx.arc(px + h(10 + k) * TILE, py + h(20 + k) * TILE, 2 + h(30 + k) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case T.Dirt: {
      if (tr.wadi[gy * MAP_W + gx]) {
        // the dry riverbed: cracked, sun-baked mud plates
        ctx.strokeStyle = "rgba(95,62,32,0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const x = px + h(10 + k) * TILE;
          const y = py + h(20 + k) * TILE;
          ctx.moveTo(x, y);
          ctx.lineTo(x + (h(30 + k) - 0.5) * 18, y + (h(40 + k) - 0.5) * 14);
          ctx.lineTo(x + (h(50 + k) - 0.5) * 22, y + (h(60 + k) - 0.2) * 16);
        }
        ctx.stroke();
        break;
      }
      ctx.fillStyle = "rgba(120,90,50,0.35)";
      for (let k = 0; k < 4; k++) ctx.fillRect(px + h(10 + k) * TILE, py + h(20 + k) * TILE, 2, 1.5);
      break;
    }
    case T.Cave: {
      const face = ctx.createLinearGradient(0, py, 0, py + TILE);
      face.addColorStop(0, "#a49a8c");
      face.addColorStop(1, "#4e463f");
      ctx.fillStyle = face;
      ctx.fillRect(px, py + 3, TILE, TILE - 3);
      const g = ctx.createRadialGradient(px + TILE / 2, py + TILE, 2, px + TILE / 2, py + TILE, TILE * 0.75);
      g.addColorStop(0, "#050404");
      g.addColorStop(1, "#2a221d");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(px + 1, py + TILE + 2);
      ctx.bezierCurveTo(px + 1, py + 4, px + TILE - 1, py + 4, px + TILE - 1, py + TILE + 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(200,190,170,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + 1, py + TILE);
      ctx.bezierCurveTo(px + 1, py + 4, px + TILE - 1, py + 4, px + TILE - 1, py + TILE);
      ctx.stroke();
      break;
    }
    case T.Deep:
    case T.Shallow:
    case T.River: {
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const y = py + h(1) * TILE;
      ctx.moveTo(px + 4, y);
      ctx.quadraticCurveTo(px + TILE / 2, y - 3, px + TILE - 4, y);
      ctx.stroke();
      break;
    }
  }
}
