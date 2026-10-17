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
  vm.runInNewContext(outputText, { exports, require: req, console, Math, Float32Array, Array, Set, Map, Date, JSON, URLSearchParams, URL, encodeURIComponent }, { filename: abs });
  return exports;
}

/* Phase 1 "more global": worldwide wrecks, caves, faults, disasters and fires. */
const styleSpec = require('@maplibre/maplibre-gl-style-spec');
const readJson = (f) => JSON.parse(fs.readFileSync(path.join('public/atlas', f), 'utf8'));

function styleErrors(layerDefs) {
  const sources = {};
  const layers = [];
  const fake = { addSource: (id, s) => void (sources[id] = s), addLayer: (l) => void layers.push(l), getLayer: () => undefined, setPaintProperty() {}, hasImage: () => true, addImage() {} };
  for (const l of layerDefs) l.install(fake, { dark: true });
  return styleSpec.validateStyleMin({ version: 8, glyphs: 'https://x/{fontstack}/{range}.pbf', sources, layers }).map((e) => e.message);
}

test('worldwide wrecks: parallel columns, real positions, U.S. waters left to NOAA', () => {
  const { cols } = readJson('wrecks-world.json');
  const n = cols.id.length;
  assert.ok(n > 60000, `${n} wrecks`);
  for (const k of ['lng', 'lat', 'cat', 'depth', 'name', 'year']) assert.equal(cols[k].length, n, k);
  const cats = new Set(['danger', 'safe', 'hull', 'mast', 'remains', null]);
  for (let i = 0; i < n; i++) {
    assert.ok(Math.abs(cols.lng[i]) <= 180 && Math.abs(cols.lat[i]) <= 90);
    assert.ok(cats.has(cols.cat[i]), cols.cat[i]);
    assert.ok(cols.year[i] === null || (cols.year[i] > 1000 && cols.year[i] <= new Date().getFullYear()));
  }
  // a known record: Clan Macmillan, torpedoed off Newhaven in 1917
  const i = cols.id.indexOf('20168');
  assert.equal(cols.name[i], 'CLAN MACMILLAN');
  assert.equal(cols.year[i], 1917);
  assert.ok(Math.abs(cols.lat[i] - 50.5795) < 0.001 && Math.abs(cols.lng[i] + 0.2566) < 0.001);
});

test('charted wrecks merge: NOAA + UKHO in one layer, category filter applies to both', () => {
  const wr = load('utils/geo/wrecks.ts');
  const noaa = readJson('wrecks-noaa.json');
  const { cols } = readJson('wrecks-world.json');
  const all = wr.chartedWreckFeatures(noaa, cols, new Set(['danger', 'safe', 'hull', 'mast', 'remains', 'none']));
  assert.equal(all.features.length, noaa.features.length + cols.id.length);
  const danger = wr.chartedWreckFeatures(noaa, cols, new Set(['danger']));
  assert.ok(danger.features.every((f) => f.properties.cat === 'danger'));
  assert.ok(danger.features.some((f) => f.properties.src === 'ukho') && danger.features.some((f) => f.properties.src === 'noaa'));
  assert.equal(wr.titleCase('CLAN MACMILLAN'), 'Clan Macmillan');
  assert.equal(wr.titleCase('HMS ROYAL OAK'), 'HMS Royal Oak');
});

test('world faults: no plate boundaries or U.S. duplicates, known kinds, light file', () => {
  const fc = readJson('faults-world.json');
  assert.ok(fc.features.length > 8000);
  const kinds = new Set(['normal', 'reverse', 'strike-slip', 'unknown']);
  for (const f of fc.features) {
    assert.ok(kinds.has(f.properties.kind), f.properties.kind);
    assert.ok(!['Bird 2003', 'UCERF3', 'USGS Hazfaults 2014'].includes(f.properties.cat), f.properties.cat);
    assert.equal(f.geometry.type, 'LineString');
    assert.ok(f.geometry.coordinates.length >= 2);
  }
  assert.ok(fs.statSync('public/atlas/faults-world.json').size < 3 * 1024 * 1024);
});

test('Earth Alive + Underground layers (now with global faults / OSM caves) produce valid styles', () => {
  const { EARTH_ALIVE_LAYERS } = load('app/atlas/earth-alive/layers.ts');
  assert.deepEqual(styleErrors(EARTH_ALIVE_LAYERS), []);
  const { cavesLayer } = load('app/atlas/underground-usa/layers.ts');
  assert.deepEqual(styleErrors([cavesLayer]), []);
});

test('Disaster Atlas world layer: valid style, in the live set', () => {
  const { worldLayer, LIVE_LAYER_IDS } = load('app/atlas/disaster-atlas/layers.ts');
  assert.deepEqual(styleErrors([worldLayer]), []);
  assert.ok(LIVE_LAYER_IDS.includes('world'));
});

test('GDACS: storms NHC tracks and U.S. fires/floods are left to the U.S. layers', () => {
  const { worldEventsShown } = load('utils/geo/hazards.ts');
  const ev = (type, short, iso3) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { type, short, iso3 } });
  const fc = { type: 'FeatureCollection', features: [ev('TC', 'TRUDY-26', 'MEX'), ev('TC', 'SIMON-26', 'COK'), ev('WF', 'x', 'USA'), ev('FL', 'y', 'USA'), ev('EQ', 'z', 'USA'), ev('WF', 'w', 'AUS')] };
  const out = worldEventsShown(fc, ['Trudy']).features.map((f) => `${f.properties.type}:${f.properties.iso3}`);
  assert.equal(out.join(' '), 'TC:COK EQ:USA WF:AUS');
  assert.equal(worldEventsShown(null, []), null);
});

test('FIRMS: column-wise detections rebuild into the same GeoJSON the layer reads', () => {
  const { hotspotFeatures } = load('utils/geo/hazards.ts');
  const fc = hotspotFeatures({ lng: [150.1], lat: [-33.8], frp: [12.5], conf: ['h'], t: [Date.UTC(2026, 9, 16, 3, 45) / 60000], day: [1] });
  const p = fc.features[0].properties;
  assert.equal(JSON.stringify(fc.features[0].geometry.coordinates), '[150.1,-33.8]');
  assert.equal(p.frp, 12.5);
  assert.equal(p.conf, 'high');
  assert.equal(p.when, '2026-10-16T03:45Z');
  assert.equal(p.day, true);
});

/* ── Phase 2: every ocean's cyclones, European bathymetry ────────── */

test('world cyclone tracks: IBTrACS basins only, JTWC winds, famous storms right', () => {
  const { storms } = readJson('hurricanes-world.json');
  assert.ok(storms.length > 3000);
  const basins = new Set(['WP', 'NI', 'SI', 'SP', 'SA']);
  for (const s of storms) {
    assert.ok(basins.has(s.basin), s.basin);
    assert.ok(s.maxWind > 0, `${s.id} has a measured wind`);
    assert.ok(s.pts.length >= 2);
    for (const p of s.pts) assert.ok(Math.abs(p[2]) <= 1800 && Math.abs(p[1]) <= 900, `${s.id} point ${p}`);
  }
  const find = (name, year) => storms.find((s) => s.name === name && s.year === year);
  // JTWC 1-minute peaks
  assert.equal(find('Haiyan', 2013).maxWind, 170);
  assert.equal(find('Haiyan', 2013).cat, 5);
  assert.equal(find('Tip', 1979).maxWind, 165);
  assert.equal(find('Nargis', 2008).basin, 'NI');
});

test('basin picker groups every basin; storm links go to NHC or IBTrACS', () => {
  const h = load('app/atlas/disaster-atlas/history.ts');
  const groups = Object.fromEntries(['AL', 'SA', 'EP', 'CP', 'WP', 'NI', 'SI', 'SP'].map((b) => [b, h.basinGroup(b)]));
  assert.equal(JSON.stringify(groups), JSON.stringify({ AL: 'AL', SA: 'AL', EP: 'EP', CP: 'EP', WP: 'WP', NI: 'IO', SI: 'IO', SP: 'SP' }));
  const storm = (basin) => ({ id: '2013306N07162', basin, year: 2013 });
  assert.match(h.stormSourceLink(storm('WP')).href, /^https:\/\/ncics\.org\/ibtracs\//);
  assert.match(h.stormSourceLink(storm('AL')).href, /^https:\/\/www\.nhc\.noaa\.gov\//);
  const all = h.filterStorms([{ ...storm('WP'), cat: 5 }, { ...storm('AL'), cat: 1 }], { year: 2013, minCat: 0, basin: 'all' });
  assert.equal(all.length, 2);
});

test('EMODnet: only European seas go to it', () => {
  const { inEmodnet } = load('components/atlas/nceiDem.ts');
  assert.equal(inEmodnet([-0.26, 50.58]), true); // English Channel
  assert.equal(inEmodnet([-8.55, 51.41]), true); // Lusitania
  assert.equal(inEmodnet([-49.95, 41.73]), false); // Titanic
  assert.equal(inEmodnet([-75.41, 35.0]), false); // Monitor
});

test('dive bathymetry: EMODnet is used only where it agrees with NOAA', () => {
  const src = fs.readFileSync('components/atlas/SeafloorDive.tsx', 'utf8');
  const fn = src.match(/export function depthsAgree[\s\S]*?\n}/)[0].replace('export ', '').replace(/: number/g, '');
  const depthsAgree = new Function(`${fn}; return depthsAgree;`)();
  assert.equal(depthsAgree(64.4, 60.2), true); // English Channel: agree
  assert.equal(depthsAgree(17.9, 40), false); // Scapa Flow: EMODnet is off
  assert.equal(depthsAgree(3, 6), true); // shallow: within 5 m
  assert.equal(depthsAgree(NaN, 10), false);
});
