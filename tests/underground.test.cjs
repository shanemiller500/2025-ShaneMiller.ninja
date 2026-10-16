const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const THREE = require('three');

/* Load a TS module (and its relative / "@/" imports) the way tests here do: transpile + vm. */
const cache = new Map();
function load(file) {
  const abs = path.resolve(file);
  if (cache.has(abs)) return cache.get(abs);
  const exports = {};
  cache.set(abs, exports);
  const req = (spec) => {
    if (spec === 'three') return THREE;
    if (spec.startsWith('.') || spec.startsWith('@/')) {
      const base = spec.startsWith('@/') ? path.resolve(spec.slice(2)) : path.resolve(path.dirname(abs), spec);
      const hit = ['.ts', '.tsx', '/index.ts'].map((ext) => base + ext).find((p) => fs.existsSync(p));
      return load(hit);
    }
    return require(spec);
  };
  const { outputText } = ts.transpileModule(fs.readFileSync(abs, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  vm.runInNewContext(outputText, { exports, require: req, console, Math, Float32Array, Array, Set, Map }, { filename: abs });
  return exports;
}

const { generateCave, PK } = load('components/atlas/caveGen.ts');
const { FEATURED, diveSpecFor } = load('app/atlas/underground-usa/featured.ts');
const { UNDERGROUND_STORIES } = load('app/atlas/underground-usa/stories.ts');

/* ── generator ───────────────────────────────────────────────────── */

test('caves are deterministic for a seed and different across seeds', () => {
  const spec = { seed: 'Q2666855', style: 'trunk', depth: 60, river: true };
  const a = generateCave(spec);
  const b = generateCave(spec);
  const c = generateCave({ ...spec, seed: 'other' });
  assert.equal(a.count, b.count);
  assert.deepEqual(Array.from(a.positions.slice(0, 3000)), Array.from(b.positions.slice(0, 3000)));
  assert.notDeepEqual(Array.from(a.positions.slice(0, 300)), Array.from(c.positions.slice(0, 300)));
});

for (const f of FEATURED) {
  test(`${f.name}: a sane point cloud that reaches its depth`, () => {
    const m = generateCave(diveSpecFor({ id: f.id, kind: 'show' }));
    assert.ok(m.count > 15000 && m.count < 600000, `point count ${m.count}`);
    assert.ok(m.positions.every(Number.isFinite), 'no NaN / Infinity');
    assert.ok(m.maxDepth >= f.dive.depth * 0.8, `max depth ${m.maxDepth} vs main level ${f.dive.depth}`);
    assert.ok(m.path.length >= 6, 'has a flight path');
  });
}

/**
 * The fly-through must stay inside the passages: underground, every sample of the camera
 * path needs rock both above and below it within reach, and must not sit inside the rock.
 */
for (const f of FEATURED) {
  test(`${f.name}: the fly-through never leaves the cave or enters the rock`, () => {
    const m = generateCave({ ...diveSpecFor({ id: f.id, kind: 'show' }), surface: false });
    // spatial hash of wall + formation points
    const CELL = 4;
    const grid = new Map();
    const key = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
    for (let i = 0; i < m.count; i++) {
      const k = m.kinds[i];
      if (k !== PK.wall && k !== PK.formation && k !== PK.crystal) continue;
      const x = m.positions[i * 3], y = m.positions[i * 3 + 1], z = m.positions[i * 3 + 2];
      const kk = key(x, y, z);
      if (!grid.has(kk)) grid.set(kk, []);
      grid.get(kk).push(x, y, z);
    }
    const near = (p, r) => {
      const out = [];
      const n = Math.ceil(r / CELL);
      const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL), cz = Math.floor(p.z / CELL);
      for (let dx = -n; dx <= n; dx++) for (let dy = -n; dy <= n; dy++) for (let dz = -n; dz <= n; dz++) {
        const arr = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
        if (arr) for (let i = 0; i < arr.length; i += 3) out.push(arr[i], arr[i + 1], arr[i + 2]);
      }
      return out;
    };
    // same curve CaveScope flies
    const curve = new THREE.CatmullRomCurve3(m.path, false, 'centripetal', 0.4);
    const L = curve.getLength();
    let samples = 0, outside = 0, inRock = 0;
    for (let d = 0; d <= L; d += 1.5) {
      const p = curve.getPointAt(d / L);
      if (p.y > -3) continue; // still on the approach above / at the entrance
      samples++;
      const pts = near(p, 16);
      let above = false, below = false, minD = Infinity;
      for (let i = 0; i < pts.length; i += 3) {
        const dy = pts[i + 1] - p.y;
        const dist = Math.hypot(pts[i] - p.x, dy, pts[i + 2] - p.z);
        if (dist < minD) minD = dist;
        if (dist < 16 && dy > 0.3) above = true;
        if (dist < 16 && dy < -0.3) below = true;
      }
      if (!above || !below) outside++;
      if (minD < 0.25) inRock++;
    }
    assert.ok(samples > 50, `samples ${samples}`);
    // allow brief brushes at sharp bends, never sustained excursions
    assert.ok(outside / samples <= 0.03, `${outside}/${samples} path samples outside a passage`);
    assert.ok(inRock / samples <= 0.03, `${inRock}/${samples} path samples inside the rock`);
  });
}

/* ── data guarantees ─────────────────────────────────────────────── */

test('caves.json: protected caves are never exact; visitable caves are complete', () => {
  const fc = JSON.parse(fs.readFileSync('public/atlas/caves.json', 'utf8'));
  assert.ok(fc.features.length > 250);
  for (const f of fc.features) {
    const p = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    if (p.generalized) {
      assert.equal(p.tour, false, `${p.name} generalized but marked visitable`);
      // snapped to the 0.1° grid
      assert.ok(Math.abs(lng * 10 - Math.round(lng * 10)) < 1e-6 && Math.abs(lat * 10 - Math.round(lat * 10)) < 1e-6, `${p.name} not snapped: ${lng},${lat}`);
    } else {
      assert.equal(p.tour, true, `${p.name} exact but not visitable`);
      assert.ok(p.state, `${p.name} has no state`);
    }
    // inside the U.S. and its territories (Alaska, Hawaii, Puerto Rico, Guam / N. Marianas, Samoa)
    const states = lng > -180 && lng < -64 && lat > 17 && lat < 72;
    const pacific = lng > 144 && lng < 146.5 && lat > 13 && lat < 21;
    const samoa = lng > -171.5 && lng < -168 && lat > -15 && lat < -10;
    assert.ok(states || pacific || samoa, `${p.name} outside the U.S.: ${lng},${lat}`);
  }
});

test('karst.json: known classes and a sane share of the lower 48', () => {
  const fc = JSON.parse(fs.readFileSync('public/atlas/karst.json', 'utf8'));
  const classes = new Set(fc.features.map((f) => f.properties.cls));
  for (const c of classes) assert.ok(['carbonate', 'evaporite', 'sandstone', 'volcanic', 'piping'].includes(c), c);
  assert.ok(fc.stats.share > 15 && fc.stats.share < 30, `share ${fc.stats.share}`);
  assert.ok(fs.statSync('public/atlas/karst.json').size < 4 * 1024 * 1024, 'stays a light download');
});

/* ── content integrity ───────────────────────────────────────────── */

test('every featured fact has an https source; every featured cave exists in caves.json', () => {
  const ids = new Set(JSON.parse(fs.readFileSync('public/atlas/caves.json', 'utf8')).features.map((f) => f.properties.id));
  for (const f of FEATURED) {
    assert.ok(ids.has(f.id), `${f.name} (${f.id}) missing from caves.json`);
    assert.ok(f.facts.length > 0);
    for (const fact of f.facts) assert.match(fact.source.url, /^https:\/\//, `${f.name}: ${fact.text.slice(0, 40)}`);
  }
});

test('story actions point at real caves; story sources are https', () => {
  const featured = new Set(FEATURED.map((f) => f.id));
  for (const s of UNDERGROUND_STORIES) {
    assert.ok(s.docs.length > 0, `${s.title} has no sources`);
    for (const d of s.docs) assert.match(d.url, /^https:\/\//);
    for (const ch of s.chapters) for (const a of ch.actions ?? []) if (a.kind === 'dive') assert.ok(featured.has(a.value), `${s.title}: dive ${a.value}`);
  }
});

test('aquifers.json: karst aquifers with names, light enough to ship', () => {
  const fc = JSON.parse(fs.readFileSync('public/atlas/aquifers.json', 'utf8'));
  assert.ok(fc.features.length >= 10);
  const names = new Set(fc.features.map((f) => f.properties.name));
  for (const n of ['Floridan Aquifer System', 'Edwards-trinity Aquifer System', 'Ozark Plateaus Aquifer System']) assert.ok(names.has(n), `missing ${n}`);
  for (const f of fc.features) assert.ok(['carbonate', 'mixed'].includes(f.properties.rock));
  assert.ok(fs.statSync('public/atlas/aquifers.json').size < 512 * 1024);
});
