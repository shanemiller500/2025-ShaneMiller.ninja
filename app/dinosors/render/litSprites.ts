/* ------------------------------------------------------------------ */
/*  Lit sprites. Buildings, homes, towers, camps and deposits are      */
/*  painted by hand-written vector art in flat colours. Here each one  */
/*  is painted into its own small image a few times a second, given a  */
/*  lighting pass there (sun on one side, shade on the other, darker   */
/*  where it meets the ground, a fine material grain) and then simply  */
/*  stamped every frame.                                               */
/*                                                                     */
/*  Two wins: every structure reads as a lit, solid thing without      */
/*  touching thousands of lines of art; and a town costs far less to   */
/*  draw, because a building is re-painted ~8 times a second instead   */
/*  of 60 (its smoke, flags and glows still move).                     */
/*                                                                     */
/*  Each shape's extent is measured once (painted to a scratch canvas   */
/*  and scanned), so nothing is clipped and nothing needs hand-kept     */
/*  bounding boxes. Anything too big to measure is painted directly.    */
/* ------------------------------------------------------------------ */

type Ctx = CanvasRenderingContext2D;

interface Bounds {
  l: number;
  t: number;
  r: number;
  b: number;
}

interface Entry {
  cv: HTMLCanvasElement;
  x: Ctx;
  state: number;
  res: number;
  b: Bounds;
  used: number;
}

/** the scratch canvas shapes are measured on, and where the origin sits in it (most art rises above its feet) */
const SCRATCH = 640;
const SCRATCH_OX = 320;
const SCRATCH_OY = 470;
/** new images per frame (the rest wait a frame, drawn from their last image) */
const BAKES_PER_FRAME = 10;
const MEASURES_PER_FRAME = 2;

let grainMask: HTMLCanvasElement | null = null;
/** Fine light + dark specks with see-through gaps: drawn "source-atop", it only textures what's already painted. */
export function grain(): HTMLCanvasElement {
  if (grainMask) return grainMask;
  const S = 128;
  grainMask = document.createElement("canvas");
  grainMask.width = grainMask.height = S;
  const c = grainMask.getContext("2d")!;
  const img = c.createImageData(S, S);
  let a = 9173;
  const rnd = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  for (let i = 0; i < S * S; i++) {
    const v = rnd();
    const light = v > 0.5;
    const o = i * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = light ? 255 : 20;
    img.data[o + 3] = Math.round(Math.pow(Math.abs(v - 0.5) * 2, 2.4) * (light ? 26 : 30));
  }
  c.putImageData(img, 0, 0);
  return grainMask;
}

export class LitSprites {
  private entries = new Map<string, Entry>();
  /** measured extents per shape (null = too big / empty: paint it directly) */
  private bounds = new Map<string, Bounds | null>();
  private scratch: Ctx | null = null;
  private frame = 0;
  private baked = 0;
  private measured = 0;

  /** Once per frame, before anything is drawn. */
  begin() {
    this.frame++;
    this.baked = 0;
    this.measured = 0;
    if (this.frame % 300 === 0) {
      // let go of what hasn't been on screen for a while
      this.entries.forEach((e, k) => {
        if (this.frame - e.used > 600) this.entries.delete(k);
      });
    }
  }

  /** Forget everything (quality changed, another world). */
  clear() {
    this.entries.clear();
    this.bounds.clear();
  }

  private measure(shape: string, paint: (x: Ctx) => void): Bounds | null | undefined {
    const known = this.bounds.get(shape);
    if (known !== undefined) return known;
    if (this.measured >= MEASURES_PER_FRAME) return undefined;
    this.measured++;
    if (!this.scratch) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = SCRATCH;
      this.scratch = cv.getContext("2d", { willReadFrequently: true })!;
    }
    const x = this.scratch;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
    x.clearRect(0, 0, SCRATCH, SCRATCH);
    x.save();
    x.translate(SCRATCH_OX, SCRATCH_OY);
    paint(x);
    x.restore();
    const d = x.getImageData(0, 0, SCRATCH, SCRATCH).data;
    let l = SCRATCH;
    let t = SCRATCH;
    let r = -1;
    let b = -1;
    for (let py = 0; py < SCRATCH; py += 2) {
      const row = py * SCRATCH * 4;
      for (let px = 0; px < SCRATCH; px += 2) {
        if (d[row + px * 4 + 3] > 6) {
          if (px < l) l = px;
          if (px > r) r = px;
          if (py < t) t = py;
          if (py > b) b = py;
        }
      }
    }
    let out: Bounds | null = null;
    // (touching the scratch's edge means it's bigger than we can see: leave it to be painted directly)
    if (r >= 0 && l > 3 && t > 3 && r < SCRATCH - 5 && b < SCRATCH - 5) {
      out = { l: l - SCRATCH_OX - 10, t: t - SCRATCH_OY - 22, r: r - SCRATCH_OX + 12, b: b - SCRATCH_OY + 8 };
    }
    this.bounds.set(shape, out);
    return out;
  }

  /**
   * Draw something at (wx, wy) through the cache. `paint` draws it around the origin.
   *   key    which thing this is (stable)
   *   state  re-painted whenever this number changes (a clock tick, usually)
   *   shape  things with the same shape share one measured extent
   *   res    image pixels per world pixel
   *   side   which side the light comes from (1 = from the right / east, -1 = from the left)
   * Returns false when it can't be cached: the caller paints it directly.
   */
  draw(c: Ctx, key: string, state: number, shape: string, res: number, wx: number, wy: number, paint: (x: Ctx) => void, side: number): boolean {
    const b = this.measure(shape, paint);
    if (!b) return false;
    let e = this.entries.get(key);
    const W = Math.max(2, Math.ceil((b.r - b.l) * res));
    const H = Math.max(2, Math.ceil((b.b - b.t) * res));
    if (!e || e.state !== state || e.res !== res || e.b !== b) {
      if (this.baked >= BAKES_PER_FRAME) {
        // out of budget this frame: its last image will do (or, with none yet, a direct paint)
        if (!e) return false;
      } else {
        this.baked++;
        if (!e) {
          const cv = document.createElement("canvas");
          e = { cv, x: cv.getContext("2d")!, state, res, b, used: this.frame };
          this.entries.set(key, e);
        }
        if (e.cv.width !== W || e.cv.height !== H) {
          e.cv.width = W;
          e.cv.height = H;
        }
        const x = e.x;
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.globalAlpha = 1;
        x.globalCompositeOperation = "source-over";
        x.clearRect(0, 0, W, H);
        x.save();
        x.setTransform(res, 0, 0, res, -b.l * res, -b.t * res);
        paint(x);
        x.restore();
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.globalAlpha = 1;
        if (res >= 1) {
          // an inked edge: the picture's own silhouette, dark and slightly soft, slipped in behind it
          x.globalCompositeOperation = "destination-over";
          x.shadowColor = "rgba(30,20,14,0.85)";
          x.shadowBlur = 1.3 * res;
          x.drawImage(e.cv, 0, 0);
          x.shadowColor = "transparent";
          x.shadowBlur = 0;
        }
        // the lighting pass: only where something was painted
        x.globalCompositeOperation = "source-atop";
        const g = x.createLinearGradient(side > 0 ? W : 0, 0, side > 0 ? 0 : W, H);
        g.addColorStop(0, "rgba(255,240,206,0.24)");
        g.addColorStop(0.42, "rgba(255,240,206,0)");
        g.addColorStop(1, "rgba(24,18,46,0.2)");
        x.fillStyle = g;
        x.fillRect(0, 0, W, H);
        const foot = x.createLinearGradient(0, H * 0.7, 0, H);
        foot.addColorStop(0, "rgba(20,14,30,0)");
        foot.addColorStop(1, "rgba(20,14,30,0.14)");
        x.fillStyle = foot;
        x.fillRect(0, H * 0.7, W, H * 0.3);
        if (res >= 1) {
          const pat = x.createPattern(grain(), "repeat");
          if (pat) {
            x.fillStyle = pat;
            x.fillRect(0, 0, W, H);
          }
        }
        x.globalCompositeOperation = "source-over";
        e.state = state;
        e.res = res;
        e.b = b;
      }
    }
    e.used = this.frame;
    c.drawImage(e.cv, wx + e.b.l, wy + e.b.t, e.b.r - e.b.l, e.b.b - e.b.t);
    return true;
  }
}
