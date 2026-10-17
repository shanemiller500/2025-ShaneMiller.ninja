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

/* Hidden Earth: sourced sites, sane cameras, valid lidar tiles and styles. */
const { SITES, SITE_KINDS } = load('app/atlas/hidden-earth/sites.ts');
const lidar = load('utils/geo/lidar.ts');
const euLidar = load('utils/geo/euLidar.ts');
const styleSpec = require('@maplibre/maplibre-gl-style-spec');

test('sites: unique, where lidar exists (U.S., England, Netherlands), every fact sourced', () => {
  assert.ok(SITES.length >= 10);
  assert.equal(new Set(SITES.map((s) => s.id)).size, SITES.length);
  for (const s of SITES) {
    const [lng, lat] = s.center;
    const us = lng > -125 && lng < -66 && lat > 24 && lat < 50;
    const eu = euLidar.EU_LIDAR.some((e) => lng >= e.bounds[0] && lng <= e.bounds[2] && lat >= e.bounds[1] && lat <= e.bounds[3]);
    assert.ok(us || eu, `${s.name} at ${lng},${lat}`);
    assert.ok(SITE_KINDS[s.kind], `${s.name} kind`);
    assert.ok(lidar.LIDAR_VIEWS.some((v) => v.key === s.view), `${s.name} view`);
    assert.ok(s.zoom >= lidar.LIDAR_MIN_ZOOM && s.zoom <= 17, `${s.name} zoom ${s.zoom}`);
    assert.ok(s.facts.length >= 2, `${s.name} facts`);
    for (const f of s.facts) assert.match(f.source.url, /^https:\/\/[^ ]+\.(gov|edu|org|org\.uk)\//, `${s.name}: source ${f.source.url}`);
    assert.ok(s.look.length > 20, `${s.name} look-for hint`);
  }
});

test('lidar tiles ask 3DEP for the right rendering', () => {
  for (const v of lidar.LIDAR_VIEWS) {
    const url = lidar.lidarTiles(v);
    const rule = JSON.parse(decodeURIComponent(url.match(/renderingRule=([^&]+)/)[1]));
    assert.equal(rule.rasterFunction, v.fn);
    assert.ok(url.includes('{bbox-epsg-3857}') && url.startsWith('https://elevation.nationalmap.gov/'));
  }
  assert.ok(lidar.COVERAGE_TILES.includes('layers=show:1'), 'coverage = the 1 m product index');
});

test('Hidden Earth layers produce a valid MapLibre style', () => {
  const { HIDDEN_LAYERS } = load('app/atlas/hidden-earth/layers.ts');
  const sources = {};
  const layers = [];
  const fake = { addSource: (id, s) => void (sources[id] = s), addLayer: (l) => void layers.push(l), getLayer: () => undefined, setPaintProperty() {} };
  for (const l of HIDDEN_LAYERS) l.install(fake, { dark: true });
  const errors = styleSpec.validateStyleMin({ version: 8, glyphs: 'https://x/{fontstack}/{range}.pbf', sources, layers }).map((e) => e.message);
  assert.deepEqual(errors, []);
});

test('point clouds: every site has a window size; the EPT index points at the public USGS bucket', () => {
  const idx = JSON.parse(fs.readFileSync('public/atlas/hidden-ept.json', 'utf8')).sites;
  let withData = 0;
  for (const s of SITES) {
    assert.ok(s.cloudHalf >= 100 && s.cloudHalf <= 800, `${s.name} cloud window ${s.cloudHalf}`);
    const c = idx[s.id];
    assert.ok(Array.isArray(c), `${s.id} is in the EPT index`);
    if (c.length) withData++;
    for (const d of c) assert.match(d.url, /^https:\/\/s3-us-west-2\.amazonaws\.com\/usgs-lidar-public\/[^/]+\/ept\.json$/);
    // newest survey first
    for (let i = 1; i < c.length; i++) assert.ok(c[i - 1].year >= c[i].year, `${s.id} ordering`);
  }
  assert.ok(withData >= 8, `only ${withData} sites have point clouds`);
  assert.ok(fs.statSync('public/atlas/laz-perf.wasm').size > 100_000, 'the LAZ decoder ships with the site');
});

/* ── Phase 3: hunt scoring + stories ─────────────────────────────── */
test('hunt scoring: a bullseye is 1,000, past the tolerance is 0, bigger sites forgive more', () => {
  const { huntScore, huntTolerance } = load('app/atlas/hidden-earth/huntScore.ts');
  for (const s of SITES) {
    assert.equal(huntScore(s, 0), 1000);
    assert.equal(huntScore(s, huntTolerance(s) + 1), 0);
    assert.ok(huntScore(s, huntTolerance(s) / 2) >= 499 && huntScore(s, huntTolerance(s) / 2) <= 501);
  }
  const small = SITES.find((s) => s.id === 'serpent');
  const big = SITES.find((s) => s.id === 'carolina-bays');
  assert.ok(huntTolerance(big) > huntTolerance(small));
});

test('stories: sourced, and every action points at something real', () => {
  const { HIDDEN_STORIES } = load('app/atlas/hidden-earth/stories.ts');
  assert.ok(HIDDEN_STORIES.length >= 3);
  for (const st of HIDDEN_STORIES) {
    assert.ok(st.docs.length && st.docs.every((d) => /^https:\/\//.test(d.url)), `${st.id} docs`);
    for (const ch of st.chapters) {
      assert.ok(ch.camera.center.every(Number.isFinite) && ch.body.every((t) => t.length > 20), `${st.id}: ${ch.title}`);
      for (const a of ch.actions ?? []) {
        if (['peel', 'cloud', 'then'].includes(a.kind)) assert.ok(SITES.some((s) => s.id === a.value), `${a.kind} → ${a.value}`);
        if (a.kind === 'view') assert.ok(lidar.LIDAR_VIEWS.some((v) => v.key === a.value), `view ${a.value}`);
      }
    }
  }
});

/* ── national lidar abroad (England, Netherlands) ────────────────── */

test('EU lidar: shading is mid-grey on the flat, lit on north-west slopes, transparent on no-data', () => {
  const W = 6;
  const flat = new Float32Array(W * W).fill(10);
  const px = (img, x, y, w) => Array.from(img.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
  const f = euLidar.shadeHeights(flat, W, W, 1, 3);
  assert.equal(px(f, 1, 1, W - 2)[0], Math.round(255 * Math.SQRT1_2)); // sin 45° ≈ 180
  // a slope rising to the east faces west: lit by the north-west lights
  const ramp = new Float32Array(W * W).map((_, i) => i % W); // rises to the east, so it faces west
  const west = euLidar.shadeHeights(ramp, W, W, 1, 1);
  const east = euLidar.shadeHeights(ramp.map((v) => -v), W, W, 1, 1);
  assert.ok(px(west, 1, 1, W - 2)[0] > px(east, 1, 1, W - 2)[0], 'west-facing brighter than east-facing');
  // no-data → transparent
  const holes = flat.slice();
  holes[2 * W + 2] = NaN;
  assert.equal(px(euLidar.shadeHeights(holes, W, W, 1), 1, 1, W - 2)[3], 0);
});

test('EU lidar: small holes fill, big gaps stay empty; tiles are in Web Mercator', () => {
  const W = 10;
  const h = new Float32Array(W * W).fill(5);
  h[55] = NaN; // a lone tree crown
  for (let y = 0; y < W; y++) for (let x = 0; x < 3; x++) h[y * W + x] = NaN; // a canal
  euLidar.fillHoles(h, W, W, 1);
  assert.equal(h[55], 5);
  assert.ok(Number.isNaN(h[0]), 'a wide gap is not invented in one pass');
  const b = euLidar.tileBounds3857(0, 0, 0, 0);
  assert.ok(Math.abs(b.minx + 20037508.34) < 1 && Math.abs(b.maxy - 20037508.34) < 1);
  for (const s of euLidar.EU_LIDAR) assert.ok(s.bounds[0] < s.bounds[2] && s.bounds[1] < s.bounds[3] && s.attribution && s.citation.license);
});
