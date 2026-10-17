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

/* Shipwrecks: baked data integrity, sourced featured wrecks, valid styles. */
const wr = load('utils/geo/wrecks.ts');
const { FEATURED_WRECKS } = load('app/atlas/shipwrecks/featured.ts');
const styleSpec = require('@maplibre/maplibre-gl-style-spec');
const readJson = (f) => JSON.parse(fs.readFileSync(path.join('public/atlas', f), 'utf8'));

test('NOAA charted wrecks: de-duplicated, known categories, sane depths', () => {
  const fc = readJson('wrecks-noaa.json');
  assert.ok(fc.features.length > 12000, `${fc.features.length} wrecks`);
  const cats = new Set(wr.WRECK_CATS.map((c) => c.key));
  const cells = new Set();
  for (const f of fc.features) {
    const p = f.properties;
    assert.ok(p.cat === null || cats.has(p.cat), `category ${p.cat}`);
    assert.ok(p.depth === null || (p.depth > -50 && p.depth < 6000), `depth ${p.depth}`);
    assert.ok(p.lvl === null || wr.WATER_LEVEL[p.lvl], `water level ${p.lvl}`);
    const [x, y] = f.geometry.coordinates;
    // the same wreck charted at two scales must not be stacked twice
    const key = `${x},${y}`;
    assert.ok(!cells.has(key), `duplicate wreck at ${x},${y}`);
    cells.add(key);
  }
});

test('named wrecks: parallel columns, real positions, names present', () => {
  const { cols } = readJson('wrecks-named.json');
  const n = cols.id.length;
  assert.ok(n > 25000);
  for (const k of ['name', 'lng', 'lat', 'year']) assert.equal(cols[k].length, n, `${k} column length`);
  for (let i = 0; i < n; i++) {
    assert.match(cols.id[i], /^Q\d+$/);
    assert.ok(cols.name[i] && !/^Q\d+$/.test(cols.name[i]));
    assert.ok(Math.abs(cols.lat[i]) <= 90 && Math.abs(cols.lng[i]) <= 180);
  }
  const fc = wr.namedWreckFeatures({ id: ['Q1'], name: ['A'], lng: [1], lat: [2], year: [null] });
  assert.equal(fc.features[0].properties.id, 'Q1');
});

test('sanctuaries: all 18 boundaries', () => {
  const fc = readJson('sanctuaries.json');
  assert.equal(fc.features.length, 18);
  assert.ok(fc.features.some((f) => f.properties.code === 'MNMS'), 'Monitor NMS');
  assert.ok(fc.features.some((f) => f.properties.code === 'TBNMS'), 'Thunder Bay NMS');
});

test('featured wrecks: unique, every fact from a NOAA / NPS page', () => {
  assert.equal(new Set(FEATURED_WRECKS.map((w) => w.id)).size, FEATURED_WRECKS.length);
  for (const w of FEATURED_WRECKS) {
    assert.ok(w.facts.length >= 2, `${w.name} facts`);
    for (const f of w.facts) assert.match(f.source.url, /^https:\/\/([a-z0-9-]+\.)*(noaa|nps)\.gov\//, `${w.name}: ${f.source.url}`);
    const [lng, lat] = w.center;
    assert.ok(Math.abs(lat) <= 90 && Math.abs(lng) <= 180);
  }
});

test('Shipwrecks layers produce a valid MapLibre style', () => {
  const { WRECK_LAYERS } = load('app/atlas/shipwrecks/layers.ts');
  const sources = {};
  const layers = [];
  const fake = { addSource: (id, s) => void (sources[id] = s), addLayer: (l) => void layers.push(l), getLayer: () => undefined, setPaintProperty() {} };
  for (const l of WRECK_LAYERS) l.install(fake, { dark: true });
  const errors = styleSpec.validateStyleMin({ version: 8, glyphs: 'https://x/{fontstack}/{range}.pbf', sources, layers }).map((e) => e.message);
  assert.deepEqual(errors, []);
});
