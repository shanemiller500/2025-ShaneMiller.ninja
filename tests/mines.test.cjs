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
  vm.runInNewContext(outputText, { exports, require: req, console, Math, Float32Array, Array, Set, Map, Date, JSON, Number, String, RegExp, URLSearchParams, URL, encodeURIComponent }, { filename: abs });
  return exports;
}

/* Lost Mines: baked MRDS + MSHA tiles, USMIN parsing, sourced sites, valid styles. */
const styleSpec = require('@maplibre/maplibre-gl-style-spec');
const mn = load('utils/geo/mines.ts');
const { MINE_SITES, SAFETY } = load('app/atlas/lost-mines/featured.ts');
const DIR = 'public/atlas/mines';
const index = JSON.parse(fs.readFileSync(`${DIR}/index.json`, 'utf8'));
const summary = JSON.parse(fs.readFileSync(`${DIR}/summary.json`, 'utf8'));
const tile = (k) => JSON.parse(fs.readFileSync(`${DIR}/t/${k}.json`, 'utf8'));
const keyOf = (lng, lat) => `${Math.floor(lng / 2)}_${Math.floor(lat / 2)}`;

test('index: 260,000+ MRDS sites and 20,000+ MSHA coal/metal mines, every tile file present', () => {
  assert.ok(index.counts.mrds > 260000, `${index.counts.mrds} MRDS`);
  assert.ok(index.counts.msha > 20000, `${index.counts.msha} MSHA`);
  assert.equal(JSON.stringify(index.groups), JSON.stringify(mn.GROUPS.map((g) => g.key)));
  let mrds = 0;
  let msha = 0;
  for (const [k, [a, b]] of Object.entries(index.tiles)) {
    assert.ok(fs.existsSync(`${DIR}/t/${k}.json`), k);
    mrds += a;
    msha += b;
  }
  assert.equal(mrds, index.counts.mrds);
  assert.equal(msha, index.counts.msha);
  assert.ok(index.mshaStatus.includes('Abandoned') && index.mrdsStatus.includes('Past Producer'));
});

test('tiles: every site sits in its own tile, columns line up, text indexes resolve', () => {
  const keys = Object.keys(index.tiles);
  for (const k of keys.filter((_, i) => i % 9 === 0)) {
    const t = tile(k);
    const [x, y] = k.split('_').map(Number);
    for (const src of ['mrds', 'msha']) {
      const c = t[src];
      const n = c.id.length;
      for (const col of Object.keys(c)) assert.equal(c[col].length, n, `${k} ${src}.${col}`);
      for (let i = 0; i < n; i++) {
        assert.equal(Math.floor(c.lng[i] / mn.TILE_DEG), x, `${k} lng`);
        assert.equal(Math.floor(c.lat[i] / mn.TILE_DEG), y, `${k} lat`);
        assert.ok(c.g[i] >= 0 && c.g[i] < mn.GROUPS.length);
        for (const col of src === 'mrds' ? ['com', 'op', 'county', 'state'] : ['type', 'sic', 'county', 'state']) assert.equal(typeof t.dict[c[col][i]], 'string', `${k} ${col}`);
      }
    }
  }
});

test('gold country shows up where it should: the Mother Lode and the Black Hills', () => {
  const gold = (lng, lat) => tile(keyOf(lng, lat)).mrds.g.filter((g) => g === 0).length;
  assert.ok(gold(-120.5, 38.5) > 2000, `Sierra gold ${gold(-120.5, 38.5)}`);
  assert.ok(gold(-103.7, 44.3) > 300, `Black Hills gold ${gold(-103.7, 44.3)}`);
  // the summary only counts producing mines, at half-degree cell centres
  for (let i = 0; i < summary.n.length; i++) {
    assert.ok(summary.n[i] > 0 && summary.gold[i] <= summary.n[i]);
    assert.ok(Math.abs((((summary.lng[i] / summary.cell) % 1) + 1) % 1 - 0.5) < 1e-6);
  }
});

test('Homestake: MRDS (frozen 2011) says producer, MSHA says abandoned — both kept', () => {
  const t = tile(keyOf(-103.765, 44.356));
  const m = t.mrds.id.indexOf(10106953);
  assert.ok(m >= 0, 'Homestake in MRDS');
  assert.equal(index.mrdsStatus[t.mrds.st[m]], 'Producer');
  assert.equal(t.mrds.g[m], 0);
  const h = t.msha.id.indexOf('3900055');
  assert.ok(h >= 0, 'Homestake in MSHA');
  assert.equal(index.mshaStatus[t.msha.st[h]], 'Abandoned');
  assert.equal(t.msha.date[h], '2007-03-23');
  assert.ok(mn.kmBetween([t.mrds.lng[m], t.mrds.lat[m]], [t.msha.lng[h], t.msha.lat[h]]) < 1.5);
});

test('mineFeatures: commodity filter, prospects hidden by default, ids unique', () => {
  const key = keyOf(-120.5, 38.5);
  const t = tile(key);
  const all = new Set(mn.GROUPS.map((_, i) => i));
  const fc = mn.mineFeatures([{ key, tile: t }], all, {});
  assert.ok(fc.features.every((f) => f.properties.src === 'msha' || (f.properties.st !== 2 && f.properties.st !== 3)));
  const withP = mn.mineFeatures([{ key, tile: t }], all, { prospects: true });
  assert.ok(withP.features.length > fc.features.length);
  const goldOnly = mn.mineFeatures([{ key, tile: t }], new Set([0]), {});
  assert.ok(goldOnly.features.length > 1000 && goldOnly.features.every((f) => f.properties.g === 0));
  assert.equal(new Set(withP.features.map((f) => f.id)).size, withP.features.length, 'feature ids are unique');
  assert.ok(mn.summaryFeatures(summary, new Set([0])).features.every((f) => f.properties.g === 0));
  const keys = mn.tilesFor([-121, 37, -117, 40], index);
  assert.ok(keys.length >= 4 && keys.every((k) => index.tiles[k]));
});

test('USMIN GML parsing: latitude-first positions flipped, polygons closed, kinds sorted', () => {
  const pt = '<gml:featureMember><ms:points gml:id="points.55764"><ms:geometry><gml:Point srsName="EPSG:4326"><gml:pos>38.204256 -119.005119</gml:pos></gml:Point></ms:geometry><ms:state>CA</ms:state><ms:ftr_type>Mine Shaft</ms:ftr_type><ms:ftr_name></ms:ftr_name><ms:topo_name>Bodie</ms:topo_name><ms:topo_date>1989</ms:topo_date><ms:topo_scale>24000</ms:topo_scale><ms:url>https://mrdata.usgs.gov/usmin/show-usmin.php?type=point&amp;id=55764</ms:url></ms:points></gml:featureMember>';
  const [p] = mn.parseUsminGml(`<wfs:FeatureCollection>${pt}</wfs:FeatureCollection>`, 'points');
  assert.equal(JSON.stringify(p.geometry.coordinates), JSON.stringify([-119.005119, 38.204256]));
  assert.equal(p.properties.type, 'Mine Shaft');
  assert.equal(mn.USMIN_KINDS[p.properties.kind].key, 'shaft');
  assert.equal(p.properties.topo, 'Bodie');
  assert.equal(p.properties.topoDate, 1989);
  assert.equal(p.properties.url, 'https://mrdata.usgs.gov/usmin/show-usmin.php?type=point&id=55764');
  const poly = '<gml:featureMember><ms:polygons gml:id="polygons.9924"><ms:geometry><gml:Polygon><gml:exterior><gml:LinearRing><gml:posList srsDimension="2">38.20 -119.00 38.21 -119.00 38.21 -119.01 </gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></ms:geometry><ms:ftr_type>Mine Dump</ms:ftr_type></ms:polygons></gml:featureMember>';
  const [g] = mn.parseUsminGml(poly, 'polygons');
  const ring = g.geometry.coordinates[0];
  assert.equal(JSON.stringify(ring[0]), JSON.stringify([-119.0, 38.2]));
  assert.equal(JSON.stringify(ring[0]), JSON.stringify(ring[ring.length - 1]), 'ring closed');
  // a "Mine Dump" is waste rock, not a mine
  assert.equal(mn.USMIN_KINDS[g.properties.kind].key, 'waste');
  for (const [t, k] of [['Adit', 'adit'], ['Prospect Pit', 'prospect'], ['Open Pit Mine', 'mine'], ['Gravel Pit', 'pit'], ['Tailings - Pond', 'waste'], ['Air Shaft', 'shaft']]) assert.equal(mn.USMIN_KINDS[mn.usminKind(t)].key, k, t);
});

test('featured sites: official sources, a recorded mine nearby, safety note sourced', () => {
  assert.ok(MINE_SITES.length >= 7);
  assert.equal(new Set(MINE_SITES.map((s) => s.id)).size, MINE_SITES.length);
  assert.match(SAFETY.source.url, /^https:\/\/www\.nps\.gov\//);
  const official = /^https:\/\/(www\.nps\.gov|historicsites\.nc\.gov|gastateparks\.org|www\.parks\.ca\.gov|danr\.sd\.gov|sanfordlab\.org|mrdata\.usgs\.gov)\//;
  for (const s of MINE_SITES) {
    assert.ok(s.facts.length >= 2, `${s.name} facts`);
    for (const f of s.facts) assert.match(f.source.url, official, `${s.name}: ${f.text.slice(0, 40)}`);
    if (s.id === 'klondike') continue; // the gold fields are in Canada; Skagway is the gateway
    const t = tile(keyOf(s.center[0], s.center[1]));
    let best = Infinity;
    for (const src of ['mrds', 'msha']) for (let i = 0; i < t[src].lng.length; i++) best = Math.min(best, mn.kmBetween(s.center, [t[src].lng[i], t[src].lat[i]]));
    // within a few km: Kennecott's marker is the mill town, its mines are up the mountain (~3.5 km)
    assert.ok(best < 5, `${s.name}: nearest recorded mine ${best.toFixed(2)} km`);
  }
});

test('Lost Mines layers produce a valid MapLibre style', () => {
  const { MINE_LAYERS } = load('app/atlas/lost-mines/layers.ts');
  for (const dark of [true, false]) {
    const sources = {};
    const layers = [];
    const fake = { addSource: (id, s) => void (sources[id] = s), addLayer: (l) => void layers.push(l), getLayer: () => undefined, setPaintProperty() {} };
    for (const l of MINE_LAYERS) l.install(fake, { dark });
    const errors = styleSpec.validateStyleMin({ version: 8, glyphs: 'https://x/{fontstack}/{range}.pbf', sources, layers }).map((e) => e.message);
    assert.deepEqual(errors, []);
  }
});


/* ── Phase 2: name search, the timeline ───────────────────────────── */

const names = JSON.parse(fs.readFileSync(`${DIR}/names.json`, 'utf8'));
const dated = JSON.parse(fs.readFileSync(`${DIR}/dated.json`, 'utf8'));

test('names index: 250,000+ named sites, every entry points at a real tile row', () => {
  assert.ok(names.name.length > 250000, `${names.name.length} names`);
  for (const k of ['t', 'i', 'src', 'g', 'st', 'state', 'lng', 'lat']) assert.equal(names[k].length, names.name.length, k);
  assert.ok(!names.name.some((n) => /^unnamed\b/i.test(n)));
  // spot-check against the tiles
  for (let k = 0; k < names.name.length; k += 9973) {
    const t = tile(names.tiles[names.t[k]]);
    const c = t[names.src[k] ? 'msha' : 'mrds'];
    assert.equal(c.name[names.i[k]], names.name[k]);
  }
  assert.ok(names.states.includes('South Dakota') && !names.states.includes('SD'), 'MSHA postal codes become full names');
});

test('search: exact names first, a trailing state narrows, the famous Homestake is found', () => {
  assert.equal(JSON.stringify(mn.splitState('homestake sd')), JSON.stringify({ name: 'homestake', state: 'South Dakota' }));
  assert.equal(JSON.stringify(mn.splitState('Homestake, South Dakota')), JSON.stringify({ name: 'homestake', state: 'South Dakota' }));
  assert.equal(JSON.stringify(mn.splitState('new mexico')), JSON.stringify({ name: 'new mexico', state: null }), 'a state alone is a name search');
  const folded = mn.foldNames(names);
  const hs = mn.searchNames(names, 'homestake sd', 40, folded);
  assert.ok(hs.length && hs.every((h) => h.state === 'South Dakota'));
  assert.ok(hs.some((h) => h.src === 'mrds' && tile(h.tile).mrds.id[h.i] === 10106953), 'MRDS #10106953 in the results');
  const kw = mn.searchNames(names, 'keane wonder', 40, folded);
  assert.ok(kw.length >= 1 && kw[0].name.toLowerCase().startsWith('keane wonder'));
  const ranked = mn.searchNames(names, 'empire', 40, folded);
  assert.ok(ranked.slice(0, 3).every((h) => h.name.toLowerCase() === 'empire'), 'exact first');
  assert.equal(mn.searchNames(names, 'x', 40, folded).length, 0, 'too short');
});

test('dated mines: years plausible, rows real, decades counted', () => {
  assert.ok(dated.y.length > 20000 && dated.y.length < index.counts.mrds / 5, `${dated.y.length} dated`);
  for (let k = 0; k < dated.y.length; k += 211) {
    assert.ok(dated.y[k] >= 1500 && dated.y[k] <= 2025, `year ${dated.y[k]}`);
    const m = tile(dated.tiles[dated.t[k]]).mrds;
    const i = dated.i[k];
    assert.equal(dated.y[k], dated.kind[k] ? m.first[i] : m.disc[i]);
  }
  const bins = mn.perDecade(dated, 1790, 2000);
  assert.equal(bins.reduce((a, b) => a + b, 0), dated.y.length, 'every dated site in a bin');
  // more recorded in the 1900s than the 1810s
  assert.ok(bins[(1900 - 1790) / 10] > bins[(1810 - 1790) / 10] * 10);
  const fc = mn.datedFeatures(dated, 1855, new Set([0]));
  assert.ok(fc.features.length > 100 && fc.features.every((f) => f.properties.y <= 1859 && f.properties.g === 0));
  assert.ok(fc.features.some((f) => f.properties.now === 1) && fc.features.every((f) => f.properties.now === (f.properties.y >= 1850 ? 1 : 0)));
});

test('timeline markers: sourced start years in order, Dahlonega marked approximate', () => {
  const withYear = MINE_SITES.filter((s) => s.year != null);
  assert.ok(withYear.length >= 6);
  for (const s of withYear) assert.ok(s.year >= 1790 && s.year <= 2000, s.name);
  assert.equal(MINE_SITES.find((s) => s.id === 'reed').year, 1799);
  assert.equal(MINE_SITES.find((s) => s.id === 'sutters-mill').year, 1848);
  assert.equal(MINE_SITES.find((s) => s.id === 'dahlonega').yearLabel, 'c. 1829');
  assert.equal(MINE_SITES.find((s) => s.id === 'empire').year, null, 'no sourced start year');
});


/* ── Phase 3: stories, library ─────────────────────────────────────── */

test('stories: every action points at something real', () => {
  const { MINE_STORIES } = load('app/atlas/lost-mines/stories.ts');
  const sites = new Set(MINE_SITES.map((s) => s.id));
  assert.ok(MINE_STORIES.length >= 3);
  assert.equal(new Set(MINE_STORIES.map((s) => s.id)).size, MINE_STORIES.length);
  for (const st of MINE_STORIES) {
    assert.ok(st.chapters.length >= 3, `${st.id} chapters`);
    assert.ok(st.docs.length >= 3, `${st.id} sources`);
    for (const d of st.docs) assert.match(d.url, /^https:\/\//);
    for (const ch of st.chapters) {
      const [lng, lat] = ch.camera.center;
      assert.ok(Math.abs(lng) <= 180 && Math.abs(lat) <= 90 && ch.camera.zoom > 1, `${st.id}: ${ch.title} camera`);
      for (const a of ch.actions ?? []) {
        const v = String(a.value ?? '');
        if (a.kind === 'site' || a.kind === 'fly') assert.ok(sites.has(v), `${st.id}: site ${v}`);
        else if (a.kind === 'timeline') assert.ok(Number(v) >= 1790 && Number(v) <= 2000, `${st.id}: decade ${v}`);
        else if (a.kind === 'then') {
          const [x, y, z] = v.split(',').map(Number);
          assert.ok(Math.abs(x) <= 180 && Math.abs(y) <= 90 && z > 8, `${st.id}: then ${v}`);
        } else if (a.kind === 'mine') {
          const m = /^(mrds|msha)\.(\w+)@(.+)$/.exec(v);
          assert.ok(m, v);
          const ids = tile(m[3])[m[1]].id.map(String);
          assert.ok(ids.includes(m[2]), `${v} is in its tile`);
        } else assert.equal(a.kind, 'map');
      }
    }
  }
  // the numbers in the safety story are the sources' own
  const safety = JSON.stringify(MINE_STORIES.find((s) => s.id === 'stay-out'));
  for (const n of ['725,690', '106,350', '1886', '2006', '9,934', '120 park units', '38,000']) assert.ok(safety.includes(n), n);
  const homestake = JSON.stringify(MINE_STORIES.find((s) => s.id === 'homestake'));
  for (const n of ['39.62 million', 'December 14, 2001', 'February 13, 2002']) assert.ok(homestake.includes(n), n);
});

test('library manifest: public-domain NPS file tagged to a real story and cited by it', () => {
  const { MINE_STORIES } = load('app/atlas/lost-mines/stories.ts');
  const manifest = JSON.parse(fs.readFileSync('scripts/atlas/manifests/lost-mines.json', 'utf8'));
  const ids = new Set(MINE_STORIES.map((s) => s.id));
  const cited = new Set(MINE_STORIES.flatMap((s) => s.docs.map((d) => d.url)));
  assert.ok(manifest.length >= 1);
  for (const e of manifest) {
    assert.equal(e.license, 'public domain');
    assert.deepEqual([...e.projects], ['lost-mines']);
    assert.match(e.url, /\.pdf$/);
    assert.ok(cited.has(e.url), `${e.title} is cited by a story`);
    for (const t of e.tags.filter((t) => t.startsWith('story:'))) assert.ok(ids.has(t.slice(6)), t);
  }
});
