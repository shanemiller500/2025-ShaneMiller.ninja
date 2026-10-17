const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

/* Load a TS module (and its relative / "@/" imports) the way tests here do: transpile + vm. */
const cache = new Map();
function load(file) {
  const abs = path.resolve(file);
  if (cache.has(abs)) return cache.get(abs);
  const exports = {};
  cache.set(abs, exports);
  const req = (spec) => {
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
  vm.runInNewContext(outputText, { exports, require: req, console, Math, Float32Array, Array, Set, Map, Date, JSON, Number, String, URLSearchParams, URL, encodeURIComponent }, { filename: abs });
  return exports;
}

/* Prehistoric USA: baked PBDB data, period table, sourced parks, valid styles. */
const styleSpec = require('@maplibre/maplibre-gl-style-spec');
const data = JSON.parse(fs.readFileSync('public/atlas/fossils.json', 'utf8'));
const fo = load('utils/geo/fossils.ts');
const { FOSSIL_PARKS } = load('app/atlas/fossil-atlas/featured.ts');

test('fossils.json: 60,000+ U.S. collections, every column complete and in range', () => {
  const c = data.cols;
  const n = c.id.length;
  assert.ok(n > 60000, `${n} collections`);
  for (const k of ['lng', 'lat', 'n', 'max', 'min', 'per', 'fm', 'st', 'flag']) assert.equal(c[k].length, n, k);
  assert.equal(new Set(c.id).size, n, 'unique collection ids');
  for (let i = 0; i < n; i++) {
    assert.ok((c.lng[i] >= -180 && c.lng[i] <= -64) || c.lng[i] >= 144, `lng ${c.lng[i]}`);
    assert.ok(c.lat[i] >= 13 && c.lat[i] <= 72, `lat ${c.lat[i]}`);
    assert.ok(c.max[i] >= c.min[i], `collection ${c.id[i]}: max ${c.max[i]} < min ${c.min[i]}`);
    assert.ok(c.per[i] >= 0 && c.per[i] < data.periods.length);
    assert.ok(c.fm[i] >= -1 && c.fm[i] < data.formations.length);
    assert.ok(c.st[i] >= -1 && c.st[i] < data.states.length);
    assert.ok(c.flag[i] >= 0 && c.flag[i] <= 3);
  }
});

test('period of each collection matches the midpoint of its age range', () => {
  const c = data.cols;
  for (let i = 0; i < c.id.length; i += 7) {
    const mid = (c.max[i] + c.min[i]) / 2;
    const p = c.per[i];
    // max/min are rounded to 0.1 Myr in the file, so allow that much slack at a boundary
    assert.ok(mid <= data.periods[p].start + 0.1, `collection ${c.id[i]} mid ${mid} after ${data.periods[p].label}`);
    if (p > 0) assert.ok(mid >= data.periods[p - 1].start - 0.1, `collection ${c.id[i]} mid ${mid} before ${data.periods[p].label}`);
  }
});

test('the app period table is the one baked into the data (ICS order, youngest first)', () => {
  assert.equal(JSON.stringify(fo.PERIODS), JSON.stringify(data.periods));
  for (let i = 1; i < fo.PERIODS.length; i++) assert.ok(fo.PERIODS[i].start > fo.PERIODS[i - 1].start);
  assert.equal(fo.PERIODS.find((p) => p.key === 'cretaceous').start, 145);
  assert.equal(fo.PERIODS.find((p) => p.key === 'paleogene').start, 66);
  assert.equal(fo.periodEnd(0), 0);
  assert.equal(fo.periodEnd(4), 145); // the Jurassic ended when the Cretaceous began
});

test('dinosaurs only in Mesozoic-or-younger rock; famous formations present', () => {
  const c = data.cols;
  const triassic = data.periods.findIndex((p) => p.key === 'triassic');
  let dinos = 0;
  for (let i = 0; i < c.id.length; i++) {
    if (!(c.flag[i] & fo.FLAG_DINO)) continue;
    dinos++;
    // birds are dinosaurs, so younger sites are fine — but nothing older than the Triassic
    assert.ok(c.per[i] <= triassic, `dinosaur collection ${c.id[i]} in ${data.periods[c.per[i]].label}`);
  }
  assert.ok(dinos > 3000, `${dinos} dinosaur collections`);
  for (const name of ['Morrison', 'Hell Creek', 'Green River', 'Chinle']) assert.ok(data.formations.includes(name), name);
  const morrison = data.formations.indexOf('Morrison');
  const jurassic = data.periods.findIndex((p) => p.key === 'jurassic');
  const inMorrison = c.fm.map((f, i) => (f === morrison ? i : -1)).filter((i) => i >= 0);
  const jurassicShare = inMorrison.filter((i) => c.per[i] === jurassic).length / inMorrison.length;
  assert.ok(jurassicShare > 0.9, `Morrison is ${Math.round(jurassicShare * 100)}% Jurassic`);
});

test('state names are cleaned: no typos, lower case or stray spaces', () => {
  const ok = new Set(['British Columbia', 'Alberta']); // PBDB tags a few U.S. collections with these; kept as entered
  for (const s of data.states) {
    assert.equal(s, s.trim());
    for (const part of s.split(', ')) assert.ok(/^[A-Z]/.test(part), part);
  }
  for (const typo of ['Pennsylvannia', 'Texax', 'Califormia', 'oregon', 'Unknown']) assert.ok(!data.states.includes(typo), typo);
  assert.ok(data.states.includes('Texas') && data.states.includes('Utah'));
  for (const s of data.states) if (!s.includes(',')) assert.ok(ok.has(s) || s.length > 3, s);
  const f = { cols: { st: [data.states.indexOf('Illinois, Iowa')] }, states: data.states };
  assert.ok(fo.inState(f, 0, 'Iowa') && fo.inState(f, 0, 'Illinois') && !fo.inState(f, 0, 'Ohio'));
});

test('fmtAge reads naturally from billions of years to the present', () => {
  assert.equal(fo.fmtAge(152.1, 145), '152–145 million years ago');
  assert.equal(fo.fmtAge(66, 66), '66 million years ago');
  assert.equal(fo.fmtAge(5.3, 3.6), '5.3–3.6 million years ago');
  assert.equal(fo.fmtAge(2.58, 0.0117), '2.6 million years ago – 11,700 years ago');
  assert.equal(fo.fmtAge(2.58, 0), '2.6 million years ago – the present');
  assert.equal(fo.fmtAge(0.126, 0.0117), '126,000–11,700 years ago');
  assert.equal(fo.fmtAge(0.0117, 0), '11,700 years ago – the present');
});

test('fossilFeatures filters by period, formation and dinosaur flag', () => {
  const all = fo.fossilFeatures(data);
  assert.equal(all.features.length, data.cols.id.length);
  const jurassic = data.periods.findIndex((p) => p.key === 'jurassic');
  const j = fo.fossilFeatures(data, { periods: new Set([jurassic]) });
  assert.ok(j.features.length > 1000 && j.features.every((f) => f.properties.per === jurassic));
  const dino = fo.fossilFeatures(data, { flag: fo.FLAG_DINO });
  assert.ok(dino.features.every((f) => f.properties.flag & 1));
  const morrison = data.formations.indexOf('Morrison');
  const m = fo.fossilFeatures(data, { formation: morrison, flag: fo.FLAG_DINO });
  assert.ok(m.features.length > 100, `${m.features.length} Morrison dinosaur sites`);
  const ext = fo.extentOf(data.cols, m.features.map((f) => f.properties.i));
  // the Morrison crops out across the western interior
  assert.ok(ext.center[0] > -115 && ext.center[0] < -100 && ext.center[1] > 35 && ext.center[1] < 46, JSON.stringify(ext));
});

test('fossil parks: every fact sourced from nps.gov, each park among recorded fossil sites', () => {
  assert.ok(FOSSIL_PARKS.length >= 6);
  assert.equal(new Set(FOSSIL_PARKS.map((p) => p.id)).size, FOSSIL_PARKS.length);
  const c = data.cols;
  for (const p of FOSSIL_PARKS) {
    assert.ok(p.facts.length >= 2, `${p.name} facts`);
    for (const f of p.facts) assert.match(f.source.url, /^https:\/\/www\.nps\.gov\//, `${p.name}: ${f.text.slice(0, 40)}`);
    assert.match(p.site.url, /^https:\/\/www\.nps\.gov\//);
    // a park that protects fossils should have PBDB collections nearby (White Sands' footprints aren't in PBDB as a point, so allow 40 km)
    let best = Infinity;
    for (let i = 0; i < c.id.length; i++) {
      const dx = (c.lng[i] - p.center[0]) * Math.cos((p.center[1] * Math.PI) / 180);
      best = Math.min(best, Math.hypot(dx, c.lat[i] - p.center[1]) * 111.2);
    }
    assert.ok(best < 40, `${p.name}: nearest PBDB site ${best.toFixed(1)} km`);
  }
});

test('Prehistoric USA layers produce a valid MapLibre style', () => {
  const { FOSSIL_LAYERS } = load('app/atlas/fossil-atlas/layers.ts');
  for (const dark of [true, false]) {
    const sources = {};
    const layers = [];
    const fake = { addSource: (id, s) => void (sources[id] = s), addLayer: (l) => void layers.push(l), getLayer: () => undefined, setPaintProperty() {} };
    for (const l of FOSSIL_LAYERS) l.install(fake, { dark });
    const errors = styleSpec.validateStyleMin({ version: 8, glyphs: 'https://x/{fontstack}/{range}.pbf', sources, layers }).map((e) => e.message);
    assert.deepEqual(errors, []);
  }
});
