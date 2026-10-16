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

/* Disaster Atlas: feed parsing, formatting, county lookup, baked FEMA data, valid styles. */
const hz = load('utils/geo/hazards.ts');
const styleSpec = require('@maplibre/maplibre-gl-style-spec');

test('SPC CSV: comments may contain commas; bad rows are skipped', () => {
  const csv = 'Time,F_Scale,Location,County,State,Lat,Lon,Comments\n2131,EF1,3 N Moore,Cleveland,OK,35.38,-97.48,Roof damage, trees down. (OUN)\n2200,UNK,Nowhere,X,OK,,,\n';
  const f = hz.parseSpcCsv(csv, 'tornado', 'today');
  assert.equal(f.length, 1);
  assert.deepEqual(Array.from(f[0].geometry.coordinates), [-97.48, 35.38]);
  assert.equal(f[0].properties.mag, 'EF1');
  assert.equal(f[0].properties.comments, 'Roof damage, trees down. (OUN)');
  assert.equal(f[0].properties.place, '3 N Moore, Cleveland Co., OK');
  assert.equal(hz.parseSpcCsv('Time,Speed,Location,County,State,Lat,Lon,Comments\n', 'wind', 'today').length, 0);
});

test('formatting helpers', () => {
  assert.equal(hz.money(2217702383), '$2.2B');
  assert.equal(hz.money(838838945279), '$838.8B');
  assert.equal(hz.money(45_000_000), '$45M');
  assert.equal(hz.compass(330), 'NNW');
  assert.equal(hz.compass(0), 'N');
  assert.equal(hz.compass(359), 'N');
  assert.equal(hz.compass(90), 'E');
});

test('every NWS product maps to a known group', () => {
  const groups = new Set(hz.ALERT_GROUPS.map((g) => g.key));
  for (const [product, g] of Object.entries(hz.ALERT_PRODUCTS)) assert.ok(groups.has(g), `${product} → ${g}`);
});

test('FEMA risk: every county present, ratings valid, lookup finds the right one', () => {
  const nri = JSON.parse(fs.readFileSync('public/atlas/nri-counties.json', 'utf8'));
  assert.ok(nri.features.length >= 3200, `${nri.features.length} counties`);
  const ratings = new Set(hz.RISK_RATINGS.map((r) => r.key));
  for (const f of nri.features) {
    const p = f.properties;
    assert.match(p.id, /^\d{5}$/);
    for (const k of ['risk', 'hrcn', 'trnd', 'wfir', 'ifld', 'cfld']) assert.ok(p[k] === null || ratings.has(p[k]), `${p.name}: ${k}=${p[k]}`);
  }
  // downtown Houston → Harris County; Denver → Denver County; mid-Atlantic ocean → nothing
  assert.equal(hz.countyAt(nri, [-95.37, 29.76]).id, '48201');
  assert.equal(hz.countyAt(nri, [-104.99, 39.74]).id, '08031');
  assert.equal(hz.countyAt(nri, [-40, 30]), null);
});

test('Disaster Atlas layers produce a valid MapLibre style', () => {
  const { DISASTER_LAYERS } = load('app/atlas/disaster-atlas/layers.ts');
  const sources = {};
  const layers = [];
  const fake = { addSource: (id, s) => void (sources[id] = s), addLayer: (l) => void layers.push(l), getLayer: () => undefined, setPaintProperty() {} };
  for (const l of DISASTER_LAYERS) l.install(fake, { dark: true });
  const errors = styleSpec.validateStyleMin({ version: 8, glyphs: 'https://x/{fontstack}/{range}.pbf', sources, layers }).map((e) => e.message);
  assert.deepEqual(errors, []);
});

/* ── Phase 2: history archives ───────────────────────────────────── */
const hist = load('app/atlas/disaster-atlas/history.ts');
const hurdat = JSON.parse(fs.readFileSync('public/atlas/hurricanes.json', 'utf8')).storms;
const torn = JSON.parse(fs.readFileSync('public/atlas/tornadoes.json', 'utf8')).cols;
const decl = JSON.parse(fs.readFileSync('public/atlas/fema-declarations.json', 'utf8')).counties;

test('HURDAT2: famous storms carry their best-track numbers', () => {
  const s = (id) => hurdat.find((x) => x.id === id);
  assert.equal(s('AL122005').name, 'Katrina');
  assert.equal(s('AL122005').maxWind, 150);
  assert.equal(s('AL122005').minPres, 902);
  assert.equal(s('AL041992').cat, 5, 'Andrew was upgraded to Cat 5 in reanalysis');
  for (const n of hist.NOTABLE.hurricanes) assert.ok(s(n.id), `${n.label} (${n.id})`);
  // 2005 Atlantic: 15 hurricanes, 7 of them major — the record season
  const y2005 = hist.filterStorms(hurdat, { year: 2005, minCat: 0, basin: 'AL' });
  assert.equal(y2005.filter((x) => x.cat >= 1).length, 15);
  assert.equal(y2005.filter((x) => x.cat >= 3).length, 7);
});

test('hurricane features: one segment per step, never across the antimeridian', () => {
  const k = hurdat.find((x) => x.id === 'AL122005');
  const { lines, labels } = hist.hurricaneFeatures([k]);
  assert.equal(lines.features.length, k.pts.length - 1);
  assert.equal(labels.features.length, 1);
  for (const f of hist.hurricaneFeatures(hurdat.filter((x) => x.basin !== 'AL')).lines.features) {
    const [[a], [b]] = f.geometry.coordinates;
    assert.ok(Math.abs(a - b) < 180, 'segment wraps the globe');
  }
});

test('SPC tornadoes: Joplin 2011 and the notable set resolve to the deadliest match', () => {
  assert.ok(torn.yr.length > 70000);
  for (const n of hist.NOTABLE.tornadoes) {
    let best = -1;
    for (let i = 0; i < torn.yr.length; i++) if (torn.yr[i] === n.year && torn.md[i] === n.md && torn.st[i] === n.st && torn.mag[i] === n.mag && (best < 0 || torn.fat[i] > torn.fat[best])) best = i;
    assert.ok(best >= 0, n.label);
    if (n.label.startsWith('Joplin')) assert.deepEqual([torn.fat[best], torn.inj[best]], [158, 1150]);
    if (n.label.startsWith('Tuscaloosa')) assert.ok(torn.fat[best] >= 60, `Tuscaloosa–Birmingham: ${torn.fat[best]} deaths`);
  }
  const violent = hist.tornadoFeatures(torn, { year: 'all', minMag: 4 });
  assert.equal(violent.features.length, hist.tornadoStats(torn, { year: 'all', minMag: 4 }).n);
});

test('fire history goes to the right decade service', () => {
  assert.match(hist.fireHistoryService(2020), /2020s_Read_Only/);
  assert.match(hist.fireHistoryService(2007), /2000s_Read_Only/);
  assert.match(hist.fireHistoryService(1988), /1980s_Read_Only/);
  assert.match(hist.fireHistoryService(1975), /1979_And_Prior/);
});

test('FEMA declarations: every county but Connecticut matches (renamed ones via aliases)', () => {
  const nri = JSON.parse(fs.readFileSync('public/atlas/nri-counties.json', 'utf8'));
  const fc = hist.declarationFeatures(nri, decl, null);
  const unmatched = fc.features.filter((f) => f.properties.n === null).map((f) => f.properties.state);
  assert.ok(unmatched.every((s) => s === 'CT'), `unmatched outside CT: ${unmatched.filter((s) => s !== 'CT')}`);
  assert.ok(fc.features.find((f) => f.properties.id === '46102').properties.n > 0, 'Oglala Lakota via Shannon');
  const hurricanes = hist.declarationFeatures(nri, decl, 'Hurricane');
  assert.ok(hurricanes.features.find((f) => f.properties.id === '22071').properties.n >= 10, 'Orleans Parish hurricane declarations');
});
