/* ------------------------------------------------------------------ */
/*  Pooled particles. Fixed-size pool, no per-frame allocation; when   */
/*  the pool is full new particles recycle the oldest ones.            */
/* ------------------------------------------------------------------ */

export enum P {
  Dust,
  Splash,
  Smoke,
  Ember,
  Spark,
  Leaf,
  Ash,
  Ripple,
  Ring,
  Poof,
  Star,
  Heart,
  Steam,
  Firefly,
  Drop,
  Rock,
  Mud,
  Note,
  Crumb,
}

export interface Particle {
  on: boolean;
  k: P;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  /** gravity on z */
  g: number;
  /** horizontal drag per second */
  drag: number;
}

export const MAX_PARTICLES = 1400;

export class Particles {
  pool: Particle[] = [];
  private cursor = 0;
  /** global budget multiplier (lowered when frame time is high) */
  budget = 1;
  active = 0;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({ on: false, k: P.Dust, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, color: "#fff", rot: 0, g: 0, drag: 0 });
    }
  }

  spawn(k: P, x: number, y: number, o: Partial<Omit<Particle, "on" | "k" | "x" | "y">> = {}) {
    // when stressed, randomly skip cosmetic particles
    if (this.budget < 1 && Math.random() > this.budget) return null;
    let p: Particle | null = null;
    for (let n = 0; n < 16; n++) {
      const c = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      if (!c.on) {
        p = c;
        break;
      }
    }
    if (!p) {
      p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    }
    p.on = true;
    p.k = k;
    p.x = x;
    p.y = y;
    p.z = o.z ?? 0;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.vz = o.vz ?? 0;
    p.max = o.max ?? 1;
    p.life = p.max;
    p.size = o.size ?? 4;
    p.color = o.color ?? "#fff";
    p.rot = o.rot ?? Math.random() * Math.PI * 2;
    p.g = o.g ?? 0;
    p.drag = o.drag ?? 0;
    return p;
  }

  burst(k: P, x: number, y: number, n: number, speed: number, o: Partial<Particle> = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(k, x, y, { ...o, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, max: (o.max ?? 1) * (0.6 + Math.random() * 0.6) });
    }
  }

  update(dt: number) {
    let n = 0;
    for (const p of this.pool) {
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.on = false;
        continue;
      }
      n++;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= p.g * dt;
      if (p.g > 0 && p.z < 0) {
        p.z = 0;
        p.vz = 0;
        p.vx *= 0.5;
        p.vy *= 0.5;
      }
      if (p.drag) {
        const f = Math.max(0, 1 - p.drag * dt);
        p.vx *= f;
        p.vy *= f;
      }
    }
    this.active = n;
  }

  clear() {
    for (const p of this.pool) p.on = false;
  }
}
