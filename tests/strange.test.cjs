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

/* Strange Earth: baked data guarantees, featured-fact sourcing, and the crater-ring maths. */
const strange = load('utils/geo/strange.ts');
const { ANOMALIES, VERDICTS } = load('app/atlas/strange-earth/featured.ts');
const read = (f) => JSON.parse(fs.readFileSync(path.join('public/atlas', f), 'utf8'));
const impacts = read('impacts.json').features;
const places = read('strange.json').features;
const landforms = read('landforms.json').features;
const wikiJunk = /<ref|\{\{|\}\}|\[\[|\]\]/;

test('impacts: the confirmed list, complete and clean', () => {
  assert.ok(impacts.length >= 190, `only ${impacts.length} craters`);
  const ids = new Set();
  for (const { properties: p, geometry: g } of impacts) {
    assert.ok(!ids.has(p.id), `duplicate ${p.id}`);
    ids.add(p.id);
    assert.ok(!wikiJunk.test(`${p.name} ${p.location} ${p.country} ${p.ageText}`), `wikitext left in ${p.name}`);
    assert.ok(Number.isFinite(p.diameterKm) && p.diameterKm > 0 && p.diameterKm < 400, `${p.name} diameter ${p.diameterKm}`);
    assert.ok(Number.isFinite(p.ageMa) && p.ageMa >= 0 && p.ageMa < 4000, `${p.name} age ${p.ageMa}`);
    assert.match(p.ageText, /(ka|Ma)$/, `${p.name} age text has a unit`);
    const [lng, lat] = g.coordinates;
    assert.ok(Math.abs(lng) <= 180 && Math.abs(lat) <= 90, `${p.name} coords`);
  }
});

test('impacts: known craters carry the right numbers (ka tables converted to Ma)', () => {
  const by = (n) => impacts.find((f) => f.properties.name.includes(n))?.properties;
  assert.equal(by('Meteor').diameterKm, 1.2);
  assert.ok(Math.abs(by('Meteor').ageMa - 0.049) < 0.002, 'Meteor Crater ~49 ka');
  assert.ok(Math.abs(by('Chicxulub').ageMa - 66) < 0.5, 'Chicxulub ~66 Ma');
  assert.ok(by('Vredefort').ageMa > 2000, 'Vredefort > 2 Ga');
  // proposed-but-unconfirmed structures must stay out
  assert.ok(!impacts.some((f) => /Wilkes Land/i.test(f.properties.name)), 'Wilkes Land is not confirmed');
});

test('places: worldwide, every category known, every U.S. one kept, abroad only notable ones', () => {
  const cats = new Set(strange.STRANGE_CATS.map((c) => c.key));
  assert.ok(places.length > 3000, `${places.length} places`);
  const us = places.filter((f) => f.properties.country === 'United States');
  assert.ok(us.length > 800, `${us.length} in the U.S.`);
  assert.ok(new Set(places.map((f) => f.properties.country)).size > 40, 'many countries');
  for (const { properties: p, geometry: g } of places) {
    assert.ok(cats.has(p.cat), `${p.name}: unknown category ${p.cat}`);
    const [lng, lat] = g.coordinates;
    assert.ok(Math.abs(lng) <= 180 && Math.abs(lat) <= 90, `${p.name} at ${lng},${lat}`);
    // outside the U.S. the query keeps only places with a photo or an English Wikipedia article
    if (p.country !== 'United States') assert.ok(p.image || p.wiki, `${p.name} (${p.country}) is not notable`);
  }
  for (const name of ['Strokkur', 'Giant\'s Causeway', 'Uluru']) assert.ok(places.some((f) => f.properties.name === name), name);
});

test('landforms: all four GNIS classes, named and located', () => {
  const n = {};
  for (const { properties: p, geometry: g } of landforms) {
    n[p.cls] = (n[p.cls] ?? 0) + 1;
    assert.ok(p.name && Number.isInteger(p.gnis), 'name + GNIS id');
    assert.ok(g.coordinates.every(Number.isFinite));
  }
  for (const c of strange.LANDFORM_CLASSES) assert.ok(n[c.key] > 50, `${c.key}: ${n[c.key]}`);
});

test('featured anomalies: unique, every fact sourced from a real page', () => {
  assert.ok(ANOMALIES.length >= 13);
  assert.equal(new Set(ANOMALIES.map((a) => a.id)).size, ANOMALIES.length);
  for (const a of ANOMALIES) {
    assert.ok(VERDICTS[a.verdict], `${a.name} verdict`);
    assert.ok(a.facts.length >= 2, `${a.name} needs at least two facts`);
    for (const f of a.facts) assert.match(f.source.url, /^https:\/\/[^ ]+\.(gov|org)\//, `${a.name}: "${f.text.slice(0, 30)}…" source`);
    assert.ok(a.fly.zoom >= 8 && a.fly.zoom <= 16 && a.fly.pitch <= 75, `${a.name} camera`);
  }
});

test('featured impact anomalies sit on their database crater', () => {
  for (const [id, name] of [['meteor-crater', 'Meteor'], ['chesapeake', 'Chesapeake'], ['upheaval-dome', 'Upheaval'], ['vredefort', 'Vredefort']]) {
    const a = ANOMALIES.find((x) => x.id === id);
    const c = impacts.find((f) => f.properties.name.includes(name));
    const km = strange.kmBetween(a.center, c.geometry.coordinates);
    assert.ok(km < 5, `${a.name} is ${km.toFixed(1)} km from the database point`);
  }
});

test('crater rings are drawn at true size', () => {
  // Meteor Crater (1.2 km) at zoom 14: 600 m radius ÷ (40075016 m / 2^14 / 512 px) ÷ cos(35°)
  const r14 = strange.ringRadius0(1.2, 35.03) * 2 ** 14;
  const mPerPx = 40075016 / (512 * 2 ** 14) * Math.cos((35.03 * Math.PI) / 180);
  assert.ok(Math.abs(r14 * mPerPx - 600) < 1, `radius ${r14 * mPerPx} m`);
});

test('ages read naturally', () => {
  assert.equal(strange.formatAge(0.049), '49,000 years');
  assert.equal(strange.formatAge(66.051), '66 million years');
  assert.equal(strange.formatAge(2.5), '2.5 million years');
  assert.equal(strange.formatAge(2023), '2.02 billion years');
});

/* ── Phase 2: investigate lenses ─────────────────────────────────── */
const topo = load('utils/geo/topo.ts');
const lenses = load('components/atlas/lenses.ts');

test('topo tiles: newest by default, locked to the chosen sheets otherwise', () => {
  assert.ok(!topo.topoTiles().includes('mosaicRule'));
  const url = topo.topoTiles([21833, 21832]);
  const rule = JSON.parse(decodeURIComponent(url.match(/mosaicRule=([^&]+)/)[1]));
  assert.deepEqual(rule, { mosaicMethod: 'esriMosaicLockRaster', lockRasterIds: [21833, 21832] });
  assert.ok(url.includes('{bbox-epsg-3857}') && url.includes('imageSR=3857'));
});

test('every lens turns into a valid raster style', () => {
  for (const lens of [lenses.SATELLITE_LENS, lenses.LIDAR_LENS, lenses.GEOLOGY_LENS, lenses.topoLens([1])]) {
    const st = lenses.lensStyle(lens);
    assert.equal(st.version, 8);
    assert.equal(st.layers.length, lens.sources.length + 1, `${lens.id}: background + one layer per source`);
    for (const s of lens.sources) {
      assert.equal(st.sources[s.id].type, 'raster');
      // https, or the AHN shading protocol the map components register (utils/geo/euLidar.ts)
      assert.match(st.sources[s.id].tiles[0], /^(https|ahn-hs):\/\//);
    }
    assert.ok(lens.citation.label && lens.citation.href.startsWith('https://'), `${lens.id} cites its source`);
  }
});

test('every anomaly tells you what to look for', () => {
  for (const a of ANOMALIES) assert.ok(a.look && a.look.length > 30, `${a.name} needs an investigate hint`);
});

/* ── Phase 3: Ice Age lakes ──────────────────────────────────────── */
const basinGrid = load('components/atlas/basinGrid.ts');
const { LAKE_FACTS } = load('app/atlas/strange-earth/lakes.ts');
const { STRANGE_STORIES } = load('app/atlas/strange-earth/stories.ts');
const pluvial = read('pluvial.json').features;

test('pluvial lakes: all 139, true areas, the big two the right size', () => {
  assert.equal(pluvial.length, 139);
  for (const f of pluvial) assert.ok(f.properties.areaKm2 > 0 && ['Polygon', 'MultiPolygon'].includes(f.geometry.type));
  const by = (n) => pluvial.find((f) => f.properties.name === n).properties.areaKm2;
  // UGS: ~20,000 sq mi (51,800 km²); USGS: 22,800 km²
  assert.ok(Math.abs(by('Bonneville') - 51800) / 51800 < 0.05, `Bonneville ${by('Bonneville')} km²`);
  assert.ok(Math.abs(by('Lahontan') - 22800) / 22800 < 0.05, `Lahontan ${by('Lahontan')} km²`);
});

test('basin grid: a synthetic bowl fills to its rim with the right area', () => {
  // a 1°×1° square lake at 40°N on a bowl: 1000 m at the centre, rising with distance
  const sq = { type: 'Polygon', coordinates: [[[-112, 40], [-111, 40], [-111, 41], [-112, 41], [-112, 40]]] };
  const bowl = (lng, lat) => 1000 + 400 * Math.max(Math.abs(lng + 111.5), Math.abs(lat - 40.5)) * 2;
  const b = basinGrid.buildBasin(sq, basinGrid.padBBox(basinGrid.geometryBBox(sq), 0.1), bowl, 200);
  assert.ok(Math.abs(b.shoreline - 1400) < 5, `shoreline ${b.shoreline}`);
  assert.ok(b.floor >= 1000 && b.floor < 1040, `floor (0.5th percentile) ${b.floor}`);
  const full = basinGrid.waterAt(b, b.shoreline);
  const trueArea = 111.32 * Math.cos((40.5 * Math.PI) / 180) * 110.574; // ≈ 9,360 km²
  assert.ok(Math.abs(full.areaKm2 - trueArea) / trueArea < 0.04, `area ${full.areaKm2} vs ${trueArea}`);
  assert.ok(Math.abs(full.maxDepth - 400) < 15, `depth ${full.maxDepth}`);
  // a square pyramid holds one third of its bounding box
  assert.ok(Math.abs(full.volumeKm3 / (trueArea * 0.4) - 1 / 3) < 0.03, `volume ${full.volumeKm3}`);
  assert.equal(basinGrid.waterAt(b, 999).areaKm2, 0, "dry below the true bottom");
});

test('basin grid: islands (holes) stay dry', () => {
  const ring = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]];
  const hole = [[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]];
  const g = { type: 'Polygon', coordinates: [ring, hole] };
  assert.equal(basinGrid.inLake(0.5, 0.5, g), true);
  assert.equal(basinGrid.inLake(2, 2, g), false);
  const b = basinGrid.buildBasin(g, [0, 0, 4, 4], () => 100, 81);
  const inside = b.inside.reduce((a, v) => a + v, 0);
  assert.ok(Math.abs(inside / (81 * b.rows) - 0.75) < 0.05, `filled share ${inside / (81 * b.rows)}`);
});

test('lake facts and stories are sourced and point at real things', () => {
  for (const [name, l] of Object.entries(LAKE_FACTS)) {
    assert.ok(pluvial.some((f) => f.properties.name === name), `${name} is in the lake data`);
    for (const f of l.facts) assert.match(f.source.url, /^https:\/\//);
  }
  for (const st of STRANGE_STORIES) {
    assert.ok(st.docs.length && st.docs.every((d) => /^https:\/\//.test(d.url)), `${st.id} docs`);
    for (const ch of st.chapters) {
      assert.ok(ch.camera.center.every(Number.isFinite) && ch.body.every((t) => t.length > 20), `${st.id}: ${ch.title}`);
      for (const a of ch.actions ?? []) {
        if (a.kind === 'refill') assert.ok(pluvial.some((f) => f.properties.name === a.value), `refill ${a.value}`);
        if (a.kind === 'fly') assert.ok(ANOMALIES.some((x) => x.id === a.value), `fly ${a.value}`);
        if (a.kind === 'investigate') assert.ok(ANOMALIES.some((x) => x.id === a.value) || String(a.value).split(',').length === 3, `investigate ${a.value}`);
      }
    }
  }
});

/* ── every layer's style is valid MapLibre (bad expressions fail silently in the browser) ── */
const styleSpec = require('@maplibre/maplibre-gl-style-spec');

function installAll(layers) {
  const sources = {};
  const styleLayers = [];
  const fakeMap = {
    addSource: (id, src) => void (sources[id] = src),
    addLayer: (l) => void styleLayers.push(l),
    getLayer: () => undefined,
    setPaintProperty() {},
  };
  for (const l of layers) l.install(fakeMap, { dark: true, labelLayerId: undefined });
  return { version: 8, glyphs: 'https://example.com/{fontstack}/{range}.pbf', sources, layers: styleLayers };
}

test('Strange Earth layers produce a valid MapLibre style', () => {
  const { STRANGE_LAYERS } = load('app/atlas/strange-earth/layers.ts');
  const style = installAll(STRANGE_LAYERS);
  // the page pushes data in later; give empty sources something valid
  for (const s of Object.values(style.sources)) if (s.type === 'geojson' && typeof s.data !== 'string') s.data = { type: 'FeatureCollection', features: [] };
  const errors = styleSpec.validateStyleMin(style).map((e) => e.message);
  assert.deepEqual(errors, []);
});
