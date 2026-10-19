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

test('featured wrecks: unique, every fact from an official page (NOAA / NPS, or a national heritage body abroad)', () => {
  assert.equal(new Set(FEATURED_WRECKS.map((w) => w.id)).size, FEATURED_WRECKS.length);
  for (const w of FEATURED_WRECKS) {
    assert.ok(w.facts.length >= 2, `${w.name} facts`);
    for (const f of w.facts) assert.match(f.source.url, /^https:\/\/([a-z0-9-]+\.)*((noaa|nps)\.gov|historicenvironment\.scot|infomar\.ie|vasamuseet\.se|maryrose\.org|museum\.wa\.gov\.au)\//, `${w.name}: ${f.source.url}`);
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

/* ── Phase 2: wreck fields, graveyards, dive depths ──────────────── */
test('wreck areas: wreck fields plus hulk fields — Mallows Bay included', () => {
  const fc = readJson('wreck-areas.json');
  assert.ok(fc.features.length > 500);
  const kinds = new Set(fc.features.map((f) => f.properties.kind));
  assert.ok(kinds.has('wrecks') && kinds.has('hulks'));
  const mallows = fc.features.some((f) => {
    const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0];
    return f.properties.kind === 'hulks' && ring.some(([x, y]) => Math.abs(x + 77.27) < 0.03 && Math.abs(y - 38.47) < 0.03);
  });
  assert.ok(mallows, 'the Mallows Bay "Burnt hulks" field');
});

test('graveyards: densest first, named, worldwide (NOAA + UKHO charts)', () => {
  const { graveyards } = readJson('graveyards.json');
  assert.ok(graveyards.length >= 10);
  for (let i = 1; i < graveyards.length; i++) assert.ok(graveyards[i - 1].wrecks >= graveyards[i].wrecks, 'sorted');
  for (const g of graveyards) {
    assert.ok(g.name && g.wrecks > 0 && g.dangerous <= g.wrecks);
    assert.ok(Math.abs(g.center[0]) <= 180 && Math.abs(g.center[1]) <= 90);
  }
  // both sides of the Atlantic: New York Harbor and the English Channel
  assert.ok(graveyards.some((g) => g.country === 'US'));
  assert.ok(graveyards.some((g) => g.country === 'GB' || g.country === 'FR'));
});

test('dive depths: every published depth is the one its fact states', () => {
  const ft = (m) => Math.round(m * 3.28084);
  for (const w of FEATURED_WRECKS.filter((x) => x.depthM)) {
    const text = w.facts.map((f) => f.text).join(' ').replace(/,/g, '');
    const mentions = [String(w.depthM), String(ft(w.depthM))].some((n) => text.includes(n)) || [240, 18, 2600, 287, 12500, 41, 93].some((n) => text.includes(String(n)) && Math.abs(n / 3.28084 - w.depthM) / w.depthM < 0.05);
    assert.ok(mentions, `${w.name}: ${w.depthM} m isn't backed by a fact`);
  }
});

/* ── Phase 3: sinkings through time, stories ─────────────────────── */
const sk = load('utils/geo/sinkings.ts');

test('sinkings: sorted columns, known causes, both wars covered', () => {
  const f = readJson('sinkings.json');
  const c = f.cols;
  const n = c.day.length;
  assert.ok(n > 10000, `${n} sinkings`);
  for (const k of ['lng', 'lat', 'cause', 'lost', 'ship', 'flag', 'desc', 'page']) assert.equal(c[k].length, n, `${k} column length`);
  assert.equal(JSON.stringify(f.causes), JSON.stringify(sk.CAUSES.map((x) => x.key)));
  for (let i = 0; i < n; i++) {
    if (i) assert.ok(c.day[i] >= c.day[i - 1], 'sorted by day');
    assert.ok(Math.abs(c.lng[i]) <= 180 && Math.abs(c.lat[i]) <= 90, `position ${c.lng[i]},${c.lat[i]}`);
    assert.ok(c.cause[i] >= 0 && c.cause[i] < f.causes.length);
    assert.ok(c.lost[i] === null || (c.lost[i] > 0 && c.lost[i] < 10000), `lost ${c.lost[i]}`);
    assert.ok(c.ship[i] && !/\{\{|\[\[|thumb\|/.test(c.ship[i] + c.desc[i]), `clean text: ${c.ship[i]}`);
  }
  const ww1 = sk.eraRows(f, 'ww1').length;
  const ww2 = sk.eraRows(f, 'ww2').length;
  assert.ok(ww1 > 2500 && ww2 > 6500, `ww1 ${ww1}, ww2 ${ww2}`);
  // coverage is honest: mapped never exceeds listed, and the gap months are recorded
  for (const [k, [listed, mapped]] of Object.entries(f.months)) assert.ok(mapped <= listed, k);
  assert.ok(f.months['1917-04'][0] > 400 && f.months['1917-04'][1] < 20, 'April 1917 has few positions');
});

test('sinkings: tally counts only up to the cursor', () => {
  const f = readJson('sinkings.json');
  const rows = sk.eraRows(f, 'ww2');
  const all = new Set(sk.CAUSES.map((x) => x.key));
  const early = sk.tally(f, rows, all, Date.UTC(1939, 11, 31));
  const late = sk.tally(f, rows, all, Date.UTC(1945, 8, 2));
  assert.ok(early.ships > 50 && early.ships < late.ships);
  assert.equal(late.ships, sk.sinkingFeatures(f, rows, all).features.length);
  const subsOnly = sk.tally(f, rows, new Set(['submarine']), Date.UTC(1945, 8, 2));
  assert.equal(subsOnly.ships, late.byCause.submarine);
  assert.match(sk.sourceUrl('List of shipwrecks in March 1942', Date.UTC(1942, 2, 3)), /List_of_shipwrecks_in_March_1942#3_March$/);
});

test('sinkings parser: causes and lives lost read from the wording', () => {
  const out = require('node:child_process').execFileSync(process.execPath, ['scripts/atlas/build-sinkings.mjs', '--test'], { encoding: 'utf8' }).trim();
  // 9+41 gunners/crew; all 47; 12 of 40; stop before "of the 73 on board"; gale beats cruiser; ship type ≠ cause
  assert.equal(out, '50 47 12 50 weather warship weather warship submarine');
});

test('sinkings layer: time filters keep the style valid', () => {
  const { sinkingsLayer } = load('app/atlas/shipwrecks/layers.ts');
  const sources = {};
  const layers = [];
  const byId = (id) => layers.find((l) => l.id === id);
  const fake = {
    addSource: (id, s) => void (sources[id] = s),
    addLayer: (l) => void layers.push(l),
    getLayer: byId,
    setFilter: (id, f) => void (f == null ? delete byId(id).filter : (byId(id).filter = f)),
    setPaintProperty: (id, k, v) => void (byId(id).paint[k] = v),
  };
  sinkingsLayer.install(fake, { dark: true });
  const validate = () => styleSpec.validateStyleMin({ version: 8, sources, layers }).map((e) => e.message);
  sinkingsLayer.applyTime(fake, { cursor: Date.UTC(1942, 5, 1), trail: 120 * 864e5, flash: 14 * 864e5 });
  assert.deepEqual(validate(), []);
  sinkingsLayer.applyTime(fake, null);
  assert.deepEqual(validate(), []);
});

test('stories: chapters line up with their replay dates, actions resolve', () => {
  const { WRECK_STORIES } = load('app/atlas/shipwrecks/stories.ts');
  const featuredIds = new Set(FEATURED_WRECKS.map((w) => w.id));
  assert.ok(WRECK_STORIES.length >= 3);
  for (const s of WRECK_STORIES) {
    assert.equal(s.time.length, s.chapters.length, `${s.id}: one time slot per chapter`);
    assert.ok(s.docs.length && s.docs.every((d) => /^https:\/\/(espis\.boem\.gov|monitor\.noaa\.gov)\//.test(d.url)), `${s.id}: federal sources`);
    for (const t of s.time) {
      if (!t) continue;
      const ms = Date.parse(`${t.at}T12:00:00Z`);
      const era = sk.ERAS[t.era];
      assert.ok(ms >= era.start - 864e5 && ms <= era.end + 864e5, `${s.id}: ${t.at} inside ${t.era}`);
    }
    for (const ch of s.chapters)
      for (const a of ch.actions ?? []) {
        if (a.kind === 'replay') assert.ok(!Number.isNaN(Date.parse(String(a.value))), a.label);
        else assert.ok(featuredIds.has(String(a.value)), `${a.label}: ${a.value}`);
      }
  }
});

test('NCEI DEM: float32 GeoTIFF reader (strips), no-data → NaN, bilinear sampling', () => {
  const { readFloatTiff, sampleGrid } = load('components/atlas/nceiDem.ts');
  // build a 3×2 little-endian float32 TIFF in one strip
  const W = 3, H = 2, vals = [-5, -6, -7, -8, -99999, -10];
  const tags = [[256, 3, W], [257, 3, H], [258, 3, 32], [259, 3, 1], [273, 4, 0], [278, 3, H], [279, 4, W * H * 4], [339, 3, 3]];
  const ifdAt = 8, dataAt = ifdAt + 2 + tags.length * 12 + 4;
  const buf = new ArrayBuffer(dataAt + W * H * 4);
  const v = new DataView(buf);
  v.setUint16(0, 0x4949); v.setUint16(2, 42, true); v.setUint32(4, ifdAt, true);
  v.setUint16(ifdAt, tags.length, true);
  tags.forEach(([tag, type, val], i) => {
    const e = ifdAt + 2 + i * 12;
    v.setUint16(e, tag, true); v.setUint16(e + 2, type, true); v.setUint32(e + 4, 1, true);
    if (tag === 273) v.setUint32(e + 8, dataAt, true);
    else if (type === 3) v.setUint16(e + 8, val, true);
    else v.setUint32(e + 8, val, true);
  });
  vals.forEach((x, i) => v.setFloat32(dataAt + i * 4, x, true));
  const g = readFloatTiff(buf);
  assert.equal(g.width, 3); assert.equal(g.height, 2);
  assert.equal(g.data[0], -5); assert.ok(Number.isNaN(g.data[4]), 'no-data becomes NaN');
  assert.equal(sampleGrid(g, 0.5, 0), -5.5);
  // a NaN neighbour is skipped, not averaged in
  assert.equal(sampleGrid(g, 1.5, 1), -10);
});
