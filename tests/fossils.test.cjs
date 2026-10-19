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

/* Prehistoric Earth: the world's PBDB collections in tiles, the summary and formation index, sourced parks, valid styles. */
const styleSpec = require('@maplibre/maplibre-gl-style-spec');
const DIR = 'public/atlas/fossils';
const ix = JSON.parse(fs.readFileSync(`${DIR}/index.json`, 'utf8'));
const summary = JSON.parse(fs.readFileSync(`${DIR}/summary.json`, 'utf8'));
const formations = JSON.parse(fs.readFileSync(`${DIR}/formations.json`, 'utf8'));
const tile = (k) => JSON.parse(fs.readFileSync(`${DIR}/t/${k}.json`, 'utf8'));
const fo = load('utils/geo/fossils.ts');
const { FOSSIL_PARKS } = load('app/atlas/fossil-atlas/featured.ts');
const keys = Object.keys(ix.tiles).sort();
const word = (t, col, i) => (t.cols[col][i] >= 0 ? t.dict[t.cols[col][i]] : '');

test('index: 270,000+ sites worldwide, every tile present, counts add up', () => {
  assert.ok(ix.counts.sites > 270000, `${ix.counts.sites} sites`);
  assert.ok(ix.counts.countries > 150, `${ix.counts.countries} countries`);
  assert.ok(ix.counts.dino > 14000 && ix.counts.mammal > 20000);
  assert.equal(JSON.stringify(fo.PERIODS), JSON.stringify(ix.periods));
  let sum = 0;
  for (const k of keys) {
    assert.ok(fs.existsSync(`${DIR}/t/${k}.json`), k);
    sum += ix.tiles[k];
  }
  assert.equal(sum, ix.counts.sites);
  assert.ok(!fs.existsSync('public/atlas/fossils.json'), 'the old U.S.-only file is gone');
});

test('tiles: every site sits in its tile, columns line up, ages and periods agree', () => {
  for (const k of keys.filter((_, i) => i % 17 === 0)) {
    const t = tile(k);
    const c = t.cols;
    const n = c.id.length;
    const [x, y] = k.split('_').map(Number);
    for (const col of Object.keys(c)) assert.equal(c[col].length, n, `${k}.${col}`);
    for (let i = 0; i < n; i++) {
      assert.equal(Math.floor(c.lng[i] / 2), x, `${k} lng`);
      assert.equal(Math.floor(c.lat[i] / 2), y, `${k} lat`);
      assert.ok(c.max[i] >= c.min[i], `${c.id[i]} age range`);
      const mid = (c.max[i] + c.min[i]) / 2;
      const p = c.per[i];
      assert.ok(mid <= ix.periods[p].start + 0.1 && (p === 0 || mid >= ix.periods[p - 1].start - 0.1), `${c.id[i]} period`);
      for (const col of ['fm', 'cc', 'st']) assert.ok(c[col][i] === -1 || typeof t.dict[c[col][i]] === 'string', `${k} ${col}`);
      assert.ok(c.flag[i] >= 0 && c.flag[i] <= 3);
    }
  }
});

test('the world is in it: famous formations on four continents, in the right countries and periods', () => {
  const where = (name) => {
    const k = formations.name.indexOf(name);
    assert.ok(k >= 0, `${name} missing`);
    const cc = new Map();
    for (const ti of formations.t[k]) {
      const t = tile(formations.tiles[ti]);
      const fm = t.dict.indexOf(name);
      t.cols.fm.forEach((f, i) => f === fm && cc.set(word(t, 'cc', i), (cc.get(word(t, 'cc', i)) ?? 0) + 1));
    }
    return { n: formations.n[k], per: ix.periods[formations.per[k]].key, country: [...cc].sort((a, b) => b[1] - a[1])[0][0] };
  };
  const expect = { Morrison: ['United States', 'jurassic'], 'Hell Creek': ['United States', 'cretaceous'], Yixian: ['China', 'cretaceous'], Solnhofen: ['Germany', 'jurassic'], 'Burgess Shale': ['Canada', 'cambrian'], Messel: ['Germany', 'paleogene'] };
  for (const [name, [country, per]] of Object.entries(expect)) {
    const w = where(name);
    assert.equal(w.country, country, `${name} is mostly in ${w.country}`);
    assert.equal(w.per, per, `${name} is mostly ${w.per}`);
  }
});

test('dinosaurs only in Triassic-or-younger rock; U.S. state names still cleaned', () => {
  const triassic = ix.periods.findIndex((p) => p.key === 'triassic');
  let us = 0;
  for (const k of keys.filter((_, i) => i % 5 === 0)) {
    const t = tile(k);
    for (let i = 0; i < t.cols.id.length; i++) {
      if (t.cols.flag[i] & 1) assert.ok(t.cols.per[i] <= triassic, `dinosaur collection ${t.cols.id[i]} in ${ix.periods[t.cols.per[i]].label}`);
      if (word(t, 'cc', i) === 'United States') {
        us++;
        const st = word(t, 'st', i);
        if (st) for (const part of st.split(', ')) assert.ok(/^[A-Z]/.test(part) && !/Texax|Pennsylvannia/.test(part), part);
      }
    }
  }
  assert.ok(us > 5000, 'U.S. sites still there');
});

test('summary: 1° cells add up to the whole world, with dinosaurs and mammals per period', () => {
  let n = 0;
  let d = 0;
  let m = 0;
  for (const rows of summary.rows) for (const r of rows) [n, d, m] = [n + r[1], d + r[2], m + r[3]];
  assert.equal(n, ix.counts.sites);
  assert.equal(d, ix.counts.dino);
  assert.equal(m, ix.counts.mammal);
  const counts = fo.periodCounts(summary);
  assert.equal(counts.reduce((a, b) => a + b, 0), ix.counts.sites);
  const dinoCounts = fo.periodCounts(summary, fo.FLAG_DINO);
  assert.equal(dinoCounts.slice(6).reduce((a, b) => a + b, 0), 0, 'no dinosaurs before the Triassic');
  const jur = fo.summaryFeatures(summary, { period: 4, flag: fo.FLAG_DINO });
  assert.ok(jur.features.length > 100 && jur.features.every((f) => f.properties.per === 4 && f.properties.n > 0));
});

test('formations index: biggest first, tiles and extents real', () => {
  for (let k = 1; k < formations.n.length; k++) assert.ok(formations.n[k] <= formations.n[k - 1]);
  const k = formations.name.indexOf('Morrison');
  const [w, s, e, n] = formations.bbox[k];
  assert.ok(w > -115 && e < -95 && s > 30 && n < 50, JSON.stringify(formations.bbox[k]));
  assert.ok(formations.t[k].every((t) => ix.tiles[formations.tiles[t]]));
  assert.equal(formations.name[fo.searchFormations(formations, 'hell cr')[0]], 'Hell Creek');
  assert.equal(fo.searchFormations(formations, 'x').length, 0);
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

test('tileFeatures filters by period, formation and dinosaur flag; tilesFor finds the view', () => {
  const loaded = fo.tilesFor([-110, 38, -104, 42], ix).map((key) => ({ key, tile: tile(key) }));
  assert.ok(loaded.length >= 4 && loaded.length <= 16);
  const all = fo.tileFeatures(loaded);
  const morrisonDinos = fo.tileFeatures(loaded, { formation: 'Morrison', flag: fo.FLAG_DINO });
  assert.ok(morrisonDinos.features.length > 50, `${morrisonDinos.features.length} Morrison dinosaur sites`);
  assert.ok(morrisonDinos.features.every((f) => f.properties.flag & 1));
  const jur = fo.tileFeatures(loaded, { period: 4 });
  assert.ok(jur.features.every((f) => f.properties.per === 4) && jur.features.length < all.features.length);
  const fit = fo.fitBbox([-110, 38, -104, 42]);
  assert.ok(fit.zoom > 4 && fit.zoom < 8);
  assert.equal(JSON.stringify(fo.tilesAround([-109.3, 40.44], ix).sort()), JSON.stringify(['-55_19', '-55_20', '-55_21', '-56_19', '-56_20', '-56_21', '-54_19', '-54_20', '-54_21'].filter((k) => ix.tiles[k]).sort()));
});

test('fossil parks: every fact from NPS or UNESCO, each park among recorded fossil sites', () => {
  assert.ok(FOSSIL_PARKS.length >= 6);
  for (const p of FOSSIL_PARKS) {
    for (const f of p.facts) assert.match(f.source.url, /^https:\/\/(www\.nps\.gov|whc\.unesco\.org)\//);
    let best = Infinity;
    for (const key of fo.tilesAround(p.center, ix)) {
      const c = tile(key).cols;
      for (let i = 0; i < c.id.length; i++) {
        const dx = (c.lng[i] - p.center[0]) * Math.cos((p.center[1] * Math.PI) / 180);
        best = Math.min(best, Math.hypot(dx, c.lat[i] - p.center[1]) * 111.2);
      }
    }
    assert.ok(best < 40, `${p.name}: nearest PBDB site ${best.toFixed(1)} km`);
  }
});

test('Prehistoric Earth layers produce a valid MapLibre style', () => {
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

/* ── the time machine ─────────────────────────────────────────────── */

const pa = load('utils/geo/paleo.ts');
const paleoIndex = JSON.parse(fs.readFileSync('public/atlas/paleo/index.json', 'utf8'));
const sliceFile = (s) => JSON.parse(fs.readFileSync(`public/atlas/paleo/${s.file}.json`, 'utf8'));
const coastBase = (k) => [paleoIndex.coast.base[k * 2], paleoIndex.coast.base[k * 2 + 1]];

test('paleo index: 109 PaleoDEM slices from today to 540 Ma, contiguous windows, every file present', () => {
  const sl = paleoIndex.slices;
  assert.ok(sl.length >= 100, `${sl.length} slices`);
  assert.equal(sl[0].age, 0);
  assert.equal(sl[sl.length - 1].age, 540);
  for (let k = 0; k < sl.length; k++) {
    const s = sl[k];
    assert.ok(s.label && s.label.length > 2, `label for ${s.age}`);
    assert.ok(s.lo < s.hi && s.lo <= s.age && s.age <= s.hi, `${s.age} window`);
    if (k) {
      assert.ok(s.age > sl[k - 1].age);
      assert.equal(s.lo, sl[k - 1].hi, `gap before ${s.age}`);
    }
    for (const ext of ['webp', 'json']) assert.ok(fs.existsSync(`public/atlas/paleo/${s.file}.${ext}`), `${s.file}.${ext}`);
  }
  const ninety = sl.find((s) => s.age === 90);
  assert.equal(ninety.label, 'Mid-Cretaceous');
  assert.equal(ninety.stage, 'Turonian');
  assert.match(paleoIndex.source, /Scotese/);
  assert.equal(JSON.stringify(paleoIndex.tiles), JSON.stringify(keys), 'spots point into the fossil tiles');
  assert.equal(paleoIndex.coast.lens.reduce((a, b) => a + b, 0) * 2, paleoIndex.coast.base.length);
});

test('paleo slices: spots belong to their time; today they sit where they are found; coastlines aligned', () => {
  for (const s of paleoIndex.slices.filter((_, k) => k % 9 === 0)) {
    const d = sliceFile(s);
    const c = d.sites;
    assert.equal(d.age, s.age);
    for (const col of ['lat', 'n', 'finds', 'per', 'flag', 't', 'i']) assert.equal(c[col].length, c.lng.length, col);
    assert.equal(d.coast.length * 2, paleoIndex.coast.base.length);
    for (let k = 0; k < c.n.length; k += 37) {
      const t = tile(paleoIndex.tiles[c.t[k]]).cols;
      const i = c.i[k];
      assert.ok(t.min[i] <= s.hi && t.max[i] >= s.lo, `spot ${k}'s collection ${t.id[i]} (${t.max[i]}–${t.min[i]} Ma) in the ${s.age} Ma slice`);
      assert.ok(Math.abs(c.lng[k]) <= 180 && Math.abs(c.lat[k]) <= 90 && c.n[k] >= 1);
    }
  }
  const now = sliceFile(paleoIndex.slices[0]);
  for (let k = 0; k < now.sites.n.length; k += 97) {
    const t = tile(paleoIndex.tiles[now.sites.t[k]]).cols;
    const i = now.sites.i[k];
    assert.ok(Math.abs(now.sites.lng[k] - t.lng[i]) < 0.02 && Math.abs(now.sites.lat[k] - t.lat[i]) < 0.02, 'spots stay put at 0 Ma');
  }
  // today's coastline is today's coastline
  for (let k = 0; k < now.coast.length; k += 211) {
    const [x, y] = coastBase(k);
    assert.ok(now.coast[k] && Math.abs(now.coast[k][0] - x) < 0.02 && Math.abs(now.coast[k][1] - y) < 0.02, `coast point ${k}`);
  }
  assert.ok(sliceFile(paleoIndex.slices.find((s) => s.age === 90)).sites.n.reduce((a, b) => a + b, 0) > 5000);
});

test('paleo positions are plausible: the U.S. west coast near the equator at 300 Ma, India far south at 120 Ma', () => {
  const at = (age, lng, lat) => {
    const d = sliceFile(paleoIndex.slices.find((s) => s.age === age));
    const now = sliceFile(paleoIndex.slices[0]);
    const k = pa.nearestCoastPoint(now.coast, [lng, lat]);
    return pa.coastPointIn(d.coast, k);
  };
  // the Oregon coast in the Late Pennsylvanian (Pangaea)
  assert.ok(Math.abs(at(300, -124, 44)[1]) < 25, `Oregon at 300 Ma ${at(300, -124, 44)}`);
  // India's west coast before it drifted north
  assert.ok(at(120, 73, 17)[1] < -20, `India at 120 Ma ${at(120, 73, 17)}`);
  // coastline pieces never wrap the globe
  const fc = pa.coastFeatures(paleoIndex.coast, sliceFile(paleoIndex.slices.find((s) => s.age === 200)).coast);
  for (const line of fc.features[0].geometry.coordinates) for (let k = 1; k < line.length; k++) assert.ok(Math.abs(line[k][0] - line[k - 1][0]) < 180);
});

test('paleo helpers: nearest slice, labels, filters', () => {
  const sl = paleoIndex.slices;
  assert.equal(pa.nearestSlice(sl, 91).age, 90);
  assert.equal(pa.nearestSlice(sl, 1000).age, 540);
  assert.equal(pa.fmtMa(0), 'Today');
  assert.equal(pa.fmtMa(90), '90 million years ago');
  assert.equal(pa.fmtPaleoLat(12.34), '12.3°N');
  assert.equal(pa.fmtPaleoLat(0.2), 'on the equator');
  const d = sliceFile(sl.find((s) => s.age === 150));
  const all = pa.paleoFeatures(d, paleoIndex.tiles);
  assert.equal(all.features.length, d.sites.n.length);
  assert.equal(pa.sitesIn(all), d.sites.n.reduce((a, b) => a + b, 0));
  const dinos = pa.paleoFeatures(d, paleoIndex.tiles, { flag: fo.FLAG_DINO });
  assert.ok(dinos.features.length > 100 && dinos.features.every((f) => f.properties.flag & 1 && ix.tiles[f.properties.tile]), `${dinos.features.length} Jurassic dinosaur spots`);
});

test('time-machine moments land on real slices with matching periods', () => {
  const { MOMENTS } = load('app/atlas/fossil-atlas/moments.ts');
  const byAge = new Map(paleoIndex.slices.map((s) => [s.age, s]));
  for (const m of MOMENTS) assert.ok(byAge.has(m.age), `${m.label} at ${m.age} Ma has no map`);
  const expect = { 500: /Cambrian/, 300: /Pennsylvanian/, 250: /Permian/, 150: /Jurassic/, 90: /Cretaceous/, 65: /Cretaceous/, 50: /Eocene/ };
  for (const [age, re] of Object.entries(expect)) {
    assert.match(byAge.get(Number(age)).label, re);
    const m = MOMENTS.find((x) => x.age === Number(age));
    assert.ok(!m.caption.includes(byAge.get(Number(age)).label), `${m.label} caption repeats the period`);
  }
});

/* ── stories, library ─────────────────────────────────────────────── */

test('stories: every action points at something real', () => {
  const { FOSSIL_STORIES } = load('app/atlas/fossil-atlas/stories.ts');
  const ages = new Set(paleoIndex.slices.map((s) => s.age));
  const parks = new Set(FOSSIL_PARKS.map((p) => p.id));
  assert.ok(FOSSIL_STORIES.length >= 4);
  for (const st of FOSSIL_STORIES) {
    assert.ok(st.chapters.length >= 3, `${st.id} chapters`);
    for (const d of st.docs) assert.match(d.url, /^https:\/\//);
    for (const ch of st.chapters) {
      for (const a of ch.actions ?? []) {
        if (a.kind === 'time') assert.ok(ages.has(Number(a.value)), `${st.id}: no map at ${a.value} Ma`);
        else if (a.kind === 'park' || a.kind === 'fly') assert.ok(parks.has(a.value), `${st.id}: park ${a.value}`);
        else if (a.kind === 'formation') {
          const k = formations.name.indexOf(a.value);
          assert.ok(k >= 0 && formations.n[k] >= 100, `${st.id}: formation ${a.value} has ${formations.n[k] ?? 0} sites`);
        } else assert.equal(a.kind, 'today');
      }
    }
  }
  const quarry = FOSSIL_STORIES.find((s) => s.id === 'dinosaur-quarry');
  assert.ok(!/August 1[79]\b/.test(JSON.stringify(quarry)));
  assert.ok(/August 1909/.test(JSON.stringify(quarry)));
});

test('library manifest: public-domain NPS files tagged to real stories', () => {
  const { FOSSIL_STORIES } = load('app/atlas/fossil-atlas/stories.ts');
  const manifest = JSON.parse(fs.readFileSync('scripts/atlas/manifests/fossil-atlas.json', 'utf8'));
  const ids = new Set(FOSSIL_STORIES.map((s) => s.id));
  const docUrls = new Set(FOSSIL_STORIES.flatMap((s) => s.docs.map((d) => d.url)));
  for (const e of manifest) {
    assert.equal(e.license, 'public domain');
    assert.ok(docUrls.has(e.url), `${e.title} is cited by a story`);
    for (const t of e.tags.filter((t) => t.startsWith('story:'))) assert.ok(ids.has(t.slice(6)), t);
  }
});
