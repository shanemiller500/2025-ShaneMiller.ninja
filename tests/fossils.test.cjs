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


/* ── Phase 2: the time machine ─────────────────────────────────────── */

const pa = load('utils/geo/paleo.ts');
const paleoIndex = JSON.parse(fs.readFileSync('public/atlas/paleo/index.json', 'utf8'));
const sliceFile = (s) => JSON.parse(fs.readFileSync(`public/atlas/paleo/${s.file}.json`, 'utf8'));

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
  assert.equal(sl[0].label, 'Today');
  assert.match(paleoIndex.source, /Scotese/);
});

test('paleo slices: sites belong to their time; today they sit where they are found', () => {
  const c = data.cols;
  for (const s of paleoIndex.slices.filter((_, k) => k % 6 === 0)) {
    const d = sliceFile(s);
    assert.equal(d.age, s.age);
    assert.equal(d.i.length, d.lng.length);
    assert.equal(d.i.length, d.lat.length);
    for (let k = 0; k < d.i.length; k++) {
      const i = d.i[k];
      assert.ok(c.min[i] <= s.hi && c.max[i] >= s.lo, `collection ${c.id[i]} (${c.max[i]}–${c.min[i]} Ma) in the ${s.age} Ma slice`);
      assert.ok(Math.abs(d.lng[k]) <= 180 && Math.abs(d.lat[k]) <= 90);
    }
  }
  const now = sliceFile(paleoIndex.slices[0]);
  assert.ok(now.i.length > 1000, `${now.i.length} sites today`);
  for (let k = 0; k < now.i.length; k += 50) {
    const i = now.i[k];
    assert.ok(Math.abs(now.lng[k] - c.lng[i]) < 0.02 && Math.abs(now.lat[k] - c.lat[i]) < 0.02, `site ${c.id[i]} moved at 0 Ma`);
  }
  // the Cretaceous has the most sites of any period; the 90 Ma slice should be well stocked
  assert.ok(sliceFile(paleoIndex.slices.find((s) => s.age === 90)).i.length > 1000);
});

test('paleo positions are plausible: North America drifts south toward the equator going back', () => {
  const lat = (age) => {
    const d = sliceFile(paleoIndex.slices.find((s) => s.age === age));
    const center = pa.outlineCenter(d);
    assert.ok(center, `outline at ${age} Ma`);
    return center[1];
  };
  const now = lat(0);
  assert.ok(now > 30 && now < 50, `today ${now}`);
  // Late Pennsylvanian: the lower 48 straddled the equator (Pangaea)
  assert.ok(Math.abs(lat(300)) < 15, `300 Ma ${lat(300)}`);
  assert.ok(lat(150) < now, '150 Ma further south than today');
  // and the outline stays one coherent shape
  const d90 = sliceFile(paleoIndex.slices.find((s) => s.age === 90));
  const main = [...d90.us].sort((a, b) => b.length - a.length)[0];
  for (let k = 1; k < main.length; k++) assert.ok(Math.hypot(main[k][0] - main[k - 1][0], main[k][1] - main[k - 1][1]) < 8, 'outline jump');
});

test('paleo helpers: nearest slice, labels, filters', () => {
  const sl = paleoIndex.slices;
  assert.equal(pa.nearestSlice(sl, 91).age, 90);
  assert.equal(pa.nearestSlice(sl, 1000).age, 540);
  assert.equal(pa.nearestSlice(sl, -3).age, 0);
  assert.equal(pa.fmtMa(0), 'Today');
  assert.equal(pa.fmtMa(90), '90 million years ago');
  assert.equal(pa.fmtMa(385.2), '385.2 million years ago');
  assert.equal(pa.fmtPaleoLat(12.34), '12.3°N');
  assert.equal(pa.fmtPaleoLat(-4), '4.0°S');
  assert.equal(pa.fmtPaleoLat(0.2), 'on the equator');
  const d = sliceFile(sl.find((s) => s.age === 150));
  const all = pa.paleoFeatures(data, d);
  assert.equal(all.features.length, d.i.length);
  const dinos = pa.paleoFeatures(data, d, { flag: fo.FLAG_DINO });
  assert.ok(dinos.features.length > 50 && dinos.features.every((f) => f.properties.flag & 1), `${dinos.features.length} Jurassic dinosaur sites`);
  assert.equal(JSON.stringify(pa.outlineFeatures(d).features[0].geometry.coordinates), JSON.stringify(d.us));
});

test('time-machine moments land on real slices with matching periods', () => {
  const { MOMENTS } = load('app/atlas/fossil-atlas/moments.ts');
  const byAge = new Map(paleoIndex.slices.map((s) => [s.age, s]));
  for (const m of MOMENTS) assert.ok(byAge.has(m.age), `${m.label} at ${m.age} Ma has no map`);
  const expect = { 500: /Cambrian/, 300: /Pennsylvanian/, 250: /Permian/, 150: /Jurassic/, 90: /Cretaceous/, 65: /Cretaceous/, 50: /Eocene/ };
  for (const [age, re] of Object.entries(expect)) {
    assert.match(byAge.get(Number(age)).label, re, `${age} Ma map is ${byAge.get(Number(age)).label}`);
    const m = MOMENTS.find((x) => x.age === Number(age));
    // captions sit after the map's own label, so they must not repeat it
    assert.ok(!m.caption.includes(byAge.get(Number(age)).label), `${m.label} caption repeats the period`);
  }
});

/* ── Phase 3: stories, library, flyovers ───────────────────────────── */

test('stories: every action points at something real', () => {
  const { FOSSIL_STORIES } = load('app/atlas/fossil-atlas/stories.ts');
  const ages = new Set(paleoIndex.slices.map((s) => s.age));
  const parks = new Set(FOSSIL_PARKS.map((p) => p.id));
  const fmCount = new Map();
  data.cols.fm.forEach((f) => fmCount.set(f, (fmCount.get(f) ?? 0) + 1));
  assert.ok(FOSSIL_STORIES.length >= 4);
  assert.equal(new Set(FOSSIL_STORIES.map((s) => s.id)).size, FOSSIL_STORIES.length);
  for (const st of FOSSIL_STORIES) {
    assert.ok(st.chapters.length >= 3, `${st.id} chapters`);
    assert.ok(st.docs.length >= 2, `${st.id} sources`);
    for (const d of st.docs) assert.match(d.url, /^https:\/\//);
    for (const ch of st.chapters) {
      const [lng, lat] = ch.camera.center;
      assert.ok(Math.abs(lng) <= 180 && Math.abs(lat) <= 90 && ch.camera.zoom > 1, `${st.id}: ${ch.title} camera`);
      assert.ok(ch.body.every((p) => p.length > 20), `${st.id}: ${ch.title} body`);
      for (const a of ch.actions ?? []) {
        if (a.kind === 'time') assert.ok(ages.has(Number(a.value)), `${st.id}: no map at ${a.value} Ma`);
        else if (a.kind === 'park' || a.kind === 'fly') assert.ok(parks.has(a.value), `${st.id}: park ${a.value}`);
        else if (a.kind === 'formation') {
          const fm = data.formations.indexOf(a.value);
          assert.ok(fm >= 0 && fmCount.get(fm) >= 100, `${st.id}: formation ${a.value} has ${fmCount.get(fm) ?? 0} sites`);
        } else assert.equal(a.kind, 'today');
      }
    }
  }
  // the 2006 NPS report and today's NPS page disagree on the day in August 1909; the story doesn't pick one
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
    assert.deepEqual([...e.projects], ['fossil-atlas']);
    assert.match(e.url, /\.pdf$/);
    assert.ok(docUrls.has(e.url), `${e.title} is cited by a story`);
    for (const t of e.tags.filter((t) => t.startsWith('story:'))) assert.ok(ids.has(t.slice(6)), t);
  }
});
