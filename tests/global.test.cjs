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
  const { cavesLayer } = load('app/atlas/underground/layers.ts');
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

/* Orbiting 3D views keep turning while the person zooms; only a one-pointer drag stops them. */
test('orbit guard: a one-pointer drag stops the orbit; taps and two-finger pinches do not', () => {
  const { onSinglePointerDrag } = load('components/atlas/orbitGuard.ts');
  const el = new EventTarget();
  let stops = 0;
  const cleanup = onSinglePointerDrag(el, () => stops++);
  const fire = (type, id, x, y) => {
    const e = new Event(type);
    Object.assign(e, { pointerId: id, clientX: x, clientY: y });
    el.dispatchEvent(e);
  };
  // a tap (tiny wobble) is not a drag
  fire('pointerdown', 1, 100, 100);
  fire('pointermove', 1, 102, 101);
  fire('pointerup', 1, 102, 101);
  assert.equal(stops, 0);
  // a two-finger pinch: both fingers move apart
  fire('pointerdown', 1, 100, 100);
  fire('pointerdown', 2, 200, 100);
  fire('pointermove', 1, 60, 100);
  fire('pointermove', 2, 240, 100);
  fire('pointerup', 1, 60, 100);
  fire('pointerup', 2, 240, 100);
  assert.equal(stops, 0);
  // a one-finger / mouse drag stops it — once per gesture
  fire('pointerdown', 3, 100, 100);
  fire('pointermove', 3, 130, 100);
  fire('pointermove', 3, 160, 100);
  fire('pointerup', 3, 160, 100);
  assert.equal(stops, 1);
  // a later drag (after pressing play again) stops it again
  fire('pointerdown', 4, 100, 100);
  fire('pointermove', 4, 100, 140);
  assert.equal(stops, 2);
  cleanup();
  fire('pointerdown', 5, 0, 0);
  fire('pointermove', 5, 50, 50);
  assert.equal(stops, 2, 'no events after cleanup');
});

/* Phase 2 "more global": NOAA history, Australian wrecks, world featured places. */

test('NOAA history: parallel columns, famous events right, quake ↔ tsunami links resolve', () => {
  const q = readJson('ncei-quakes.json');
  const t = readJson('ncei-tsunamis.json');
  const nq = q.cols.id.length;
  const nt = t.cols.id.length;
  assert.ok(nq > 6000 && nt > 1400, `${nq} quakes, ${nt} tsunamis`);
  for (const k of Object.keys(q.cols)) assert.equal(q.cols[k].length, nq, k);
  for (const k of Object.keys(t.cols)) assert.equal(t.cols[k].length, nt, k);
  assert.ok(t.cols.validity.every((v) => v >= 3), 'doubtful tsunamis left out');
  const sumatra = q.cols.id.indexOf(5823);
  assert.equal(q.cols.date[sumatra], '2004-12-26');
  assert.equal(q.cols.mag[sumatra], 9.1);
  assert.equal(q.cols.deaths[sumatra], 227899);
  const ti = t.cols.id.indexOf(q.cols.tsunami[sumatra]);
  assert.ok(ti >= 0 && t.cols.height[ti] > 30, 'Sumatra quake links to its tsunami');
  const lisbon = q.cols.id.indexOf(1339);
  assert.equal(q.cols.date[lisbon], '1755-11-01');
  const lituya = t.cols.id.indexOf(1880);
  assert.equal(t.cols.height[lituya], 524.6);
  assert.equal(t.causes[t.cols.cause[lituya]], 'Earthquake and landslide');
});

test('NOAA history helpers: dates, death text and rank, features carry the row index', () => {
  const n = load('utils/geo/ncei.ts');
  assert.equal(n.fmtNceiDate('2004-12-26'), '26 Dec 2004');
  assert.equal(n.fmtNceiDate('1755-11'), 'Nov 1755');
  assert.equal(n.fmtNceiDate('-2150'), '2150 BC');
  const amount = ['None', 'Few (1–50)', 'Some (51–100)', 'Many (101–1,000)', 'Very many (over 1,000)'];
  assert.equal(n.deathsText(227899, 4, amount), '227,899');
  assert.equal(n.deathsText(null, 3, amount), 'Many (101–1,000)');
  assert.equal(n.deathsText(null, null, amount), null);
  assert.equal(n.deathRank(227899, 4), 4);
  assert.equal(n.deathRank(60, null), 2);
  assert.equal(n.deathRank(null, 3), 3);
  assert.equal(n.deathRank(0, 0), 0);
  const q = readJson('ncei-quakes.json');
  const fc = n.nceiQuakeFeatures(q);
  assert.equal(fc.features.length, q.cols.id.length);
  const f = fc.features[q.cols.id.indexOf(1339)];
  assert.equal(f.properties.year, 1755);
  assert.equal(q.cols.id[f.properties.i], 1339);
  const bc = fc.features.find((x) => x.properties.year < 0);
  assert.ok(bc, 'BC years parse as negative');
  const ts = n.nceiTsunamiFeatures(readJson('ncei-tsunamis.json'));
  assert.ok(ts.features.every((x) => x.properties.height >= 0));
});

test('Australian wrecks: columns, dictionaries, Batavia where the WA Museum puts it', () => {
  const au = readJson('wrecks-au.json');
  const c = au.cols;
  const n = c.id.length;
  assert.ok(n > 7000, `${n} records`);
  for (const k of Object.keys(c)) assert.equal(c[k].length, n, k);
  for (const k of ['type', 'rig', 'region', 'state']) assert.ok(c[k].every((v) => v === -1 || (v >= 0 && v < au.dict[k].length)), k);
  assert.ok(c.kind.every((k) => k === 0 || k === 1));
  const located = c.sure.filter(Boolean).length;
  assert.ok(located > 300 && located < 1000, `${located} located`);
  const i = c.id.indexOf(3726);
  assert.equal(c.name[i], 'Batavia');
  assert.equal(c.year[i], 1629);
  assert.ok(Math.abs(c.lng[i] - 113.7919) < 0.01 && Math.abs(c.lat[i] + 28.4916) < 0.01);
  const wr = load('utils/geo/wrecks.ts');
  const fc = wr.auWreckFeatures(au);
  const b = fc.features.find((f) => f.properties.id === 3726);
  assert.equal(b.properties.state, 'Western Australia');
  assert.match(wr.auchdUrl(3726), /wreck\.do\?key=3726$/);
});

test('Phase 2 layers produce valid styles and are registered', () => {
  const ea = load('app/atlas/earth-alive/layers.ts');
  assert.deepEqual(styleErrors([ea.historyQuakesLayer, ea.tsunamisLayer]), []);
  assert.ok(['history', 'tsunamis'].every((id) => ea.EARTH_ALIVE_LAYERS.some((l) => l.id === id && !l.defaultOn)));
  const sw = load('app/atlas/shipwrecks/layers.ts');
  assert.deepEqual(styleErrors([sw.auWrecksLayer]), []);
  assert.ok(sw.WRECK_LAYERS.includes(sw.auWrecksLayer));
});

test('world featured places: sourced facts, sane positions, unique ids, caves in the cave list', () => {
  const sets = {
    fossils: load('app/atlas/fossil-atlas/featured.ts').FOSSIL_PARKS,
    mines: load('app/atlas/lost-mines/featured.ts').MINE_SITES,
    ghost: load('app/atlas/ghost-towns/featured.ts').FEATURED_TOWNS,
    caves: load('app/atlas/underground/featured.ts').FEATURED,
    strange: load('app/atlas/strange-earth/featured.ts').ANOMALIES,
    wrecks: load('app/atlas/shipwrecks/featured.ts').FEATURED_WRECKS,
  };
  const want = {
    fossils: ['messel', 'chengjiang', 'ischigualasto', 'dinosaur-provincial', 'jurassic-coast', 'burgess'],
    mines: ['potosi', 'falun', 'wieliczka', 'cornwall', 'rammelsberg', 'sewell'],
    ghost: ['humberstone', 'wharram-percy'],
    caves: ['Q555991'],
    strange: ['uluru', 'cappadocia', 'danxia'],
    wrecks: ['vasa', 'mary-rose', 'batavia'],
  };
  const caveIds = new Set(JSON.stringify(readJson('caves.json')).match(/Q\d+/g));
  for (const [k, list] of Object.entries(sets)) {
    const ids = list.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, `${k}: duplicate ids`);
    for (const id of want[k]) assert.ok(ids.includes(id), `${k}: ${id}`);
    for (const x of list) {
      assert.ok(Math.abs(x.center[0]) <= 180 && Math.abs(x.center[1]) <= 90, `${x.id} center`);
      assert.ok(x.facts.length >= 2, `${x.id} facts`);
      for (const f of x.facts) assert.match(f.source.url, /^https:\/\//, `${x.id} source`);
    }
  }
  assert.ok(caveIds.has('Q555991'), 'Sarawak Chamber is in caves.json');
  // world mines stay off the U.S. gold-rush timeline (1790–2000)
  for (const id of want.mines) assert.equal(sets.mines.find((s) => s.id === id).year, null);
});

test('Then & Now is offered only where USGS historical topo maps exist', () => {
  const { hasUsgsTopo } = load('utils/geo/topo.ts');
  for (const p of [[-119.0119, 38.2122], [-147.7, 64.8], [-155.5, 19.6], [-66.1, 18.4]]) assert.ok(hasUsgsTopo(p), String(p));
  for (const p of [[20.0557, 49.9831], [-0.6897, 54.0675], [-70.3825, -34.085], [131.0361, -25.345]]) assert.ok(!hasUsgsTopo(p), String(p));
});

/* Phase 3 "more global": near me everywhere, region-aware start, world copy. */

test('near: distances, nearest-first with a radius, point in (multi)polygon', () => {
  const nr = load('utils/geo/near.ts');
  assert.ok(Math.abs(nr.kmBetween([-0.1276, 51.5072], [2.3522, 48.8566]) - 344) < 5, 'London → Paris');
  assert.ok(Math.abs(nr.kmBetween([151.21, -33.87], [174.76, -36.85]) - 2156) < 25, 'Sydney → Auckland');
  assert.equal(nr.fmtKm(3.44), '3.4 km');
  assert.equal(nr.fmtKm(1840.2), '1,840 km');
  const pts = [[0, 0], [1, 0], [5, 0], [0.2, 0.1], [40, 40]].map((p, i) => ({ i, p }));
  const n = nr.nearest(pts, [0, 0], (x) => x.p, 3);
  assert.equal(JSON.stringify(n.map((x) => x.item.i)), '[0,3,1]');
  assert.equal(JSON.stringify(nr.nearest(pts, [0, 0], (x) => x.p, 10, 200).map((x) => x.item.i)), '[0,3,1]', 'radius drops the far ones');
  // works across the whole globe, many items
  const many = Array.from({ length: 5000 }, (_, i) => [((i * 37) % 360) - 180, ((i * 13) % 170) - 85]);
  const near = nr.nearest(many, [10, 10], (p) => p, 5);
  const brute = many.map((p) => nr.kmBetween([10, 10], p)).sort((a, b) => a - b).slice(0, 5);
  assert.equal(JSON.stringify(near.map((x) => Math.round(x.km))), JSON.stringify(brute.map(Math.round)));
  const square = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] };
  assert.ok(nr.pointInFeature([1, 1], square));
  assert.ok(!nr.pointInFeature([5, 5], square), 'holes are outside');
  assert.ok(!nr.pointInFeature([11, 1], square));
  assert.ok(nr.pointInFeature([21, 1], { type: 'MultiPolygon', coordinates: [square.coordinates, [[[20, 0], [22, 0], [22, 2], [20, 2], [20, 0]]]] }));
  assert.ok(!nr.pointInFeature([1, 1], { type: 'Point', coordinates: [1, 1] }));
  // the old per-app helpers are the shared one
  assert.equal(load('utils/geo/ghost.ts').kmBetween, nr.kmBetween);
  assert.equal(load('utils/geo/strange.ts').kmBetween, nr.kmBetween);
});

test('home view: the viewer region from the time zone, the caller fallback otherwise', () => {
  const hv = load('utils/geo/homeView.ts');
  const r = (tz) => hv.regionForZone(tz)?.key ?? null;
  assert.equal(r('America/Denver'), 'northAmerica');
  assert.equal(r('America/Sao_Paulo'), 'southAmerica');
  assert.equal(r('America/Argentina/Buenos_Aires'), 'southAmerica');
  assert.equal(r('Europe/London'), 'europe');
  assert.equal(r('Europe/Istanbul'), 'middleEast');
  assert.equal(r('Africa/Lagos'), 'africa');
  assert.equal(r('Asia/Kolkata'), 'southAsia');
  assert.equal(r('Asia/Tokyo'), 'eastAsia');
  assert.equal(r('Asia/Jakarta'), 'southeastAsia');
  assert.equal(r('Australia/Perth'), 'australia');
  assert.equal(r('Pacific/Auckland'), 'newZealand');
  assert.equal(r('Pacific/Honolulu'), 'hawaii');
  assert.equal(r('Etc/UTC'), null);
  assert.equal(r(''), null);
  for (const g of Object.values(hv.REGIONS)) assert.ok(Math.abs(g.center[0]) <= 180 && Math.abs(g.center[1]) <= 90, g.key);
  const c = hv.homeCenter([-1, -1]);
  assert.ok(Array.isArray(c) && c.length === 2);
});

test('hub: every live map says how far its data reaches', () => {
  const { ATLAS_PROJECTS } = load('utils/geo/projects.ts');
  for (const p of ATLAS_PROJECTS.filter((x) => x.status === 'live')) {
    assert.ok(p.coverage, `${p.slug} coverage`);
    assert.ok(!/every earthquake on earth/i.test(p.tagline), `${p.slug} overclaims`);
  }
});
