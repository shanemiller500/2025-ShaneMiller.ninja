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


/* Ghost Towns: baked data integrity, sourced featured towns, valid styles. */
const styleSpec = require('@maplibre/maplibre-gl-style-spec');
const readJson = (f) => JSON.parse(fs.readFileSync(path.join('public/atlas', f), 'utf8'));
const gh = load('utils/geo/ghost.ts');
const { FEATURED_TOWNS } = load('app/atlas/ghost-towns/featured.ts');

test('GNIS vanished places: 10,000+, clean names, U.S. positions', () => {
  const { cols } = readJson('ghost-gnis.json');
  const n = cols.id.length;
  assert.ok(n > 10000, `${n} places`);
  for (const k of ['name', 'state', 'county', 'lng', 'lat']) assert.equal(cols[k].length, n, k);
  assert.equal(new Set(cols.id).size, n, 'unique GNIS ids');
  for (let i = 0; i < n; i++) {
    assert.ok(!/historical/i.test(cols.name[i]), `"${cols.name[i]}" still says historical`);
    assert.ok(cols.lng[i] < -60 || cols.lng[i] > 140, `${cols.name[i]} at ${cols.lng[i]}`); // U.S. incl. Alaska, Hawaii, territories
  }
});

test('ghost towns: worldwide, mostly U.S., well-known ones present', () => {
  const { cols } = readJson('ghost-towns.json');
  assert.ok(cols.id.length > 3000);
  assert.ok(cols.country.filter((c) => c === 'United States').length > 2500);
  for (const name of ['Bodie', 'Rhyolite', 'Bannack', 'Kolmanskop', 'Craco']) assert.ok(cols.name.includes(name), name);
  for (let i = 0; i < cols.id.length; i++) {
    assert.match(cols.id[i], /^Q\d+$/);
    if (cols.founded[i] && cols.abandoned[i]) assert.ok(cols.founded[i] <= cols.abandoned[i] + 1, `${cols.name[i]} founded after abandoned`);
  }
});

test('drowned towns: every one placed, a real state, a reservoir; Quabbin towns present', () => {
  const { towns } = readJson('drowned.json');
  assert.ok(towns.length >= 150);
  const states = new Set(['Alabama', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Georgia', 'Illinois', 'Indiana', 'Kentucky', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Missouri', 'Mississippi', 'Montana', 'Nevada', 'New York', 'North Carolina', 'New Jersey', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'Tennessee', 'Texas', 'Utah', 'Washington', 'West Virginia']);
  for (const t of towns) {
    assert.ok(states.has(t.state), `${t.name}: state ${t.state}`);
    assert.ok(t.reservoir && t.name && Number.isFinite(t.lng) && Number.isFinite(t.lat));
  }
  for (const n of ['Enfield', 'Dana', 'Prescott', 'Greenwich']) assert.equal(towns.find((t) => t.name === n)?.reservoir, 'Quabbin Reservoir', n);
});

test('featured towns: unique, every fact from an official page, on a real place', () => {
  assert.equal(new Set(FEATURED_TOWNS.map((t) => t.id)).size, FEATURED_TOWNS.length);
  for (const t of FEATURED_TOWNS) {
    assert.ok(t.facts.length >= 2, t.name);
    for (const f of t.facts) assert.match(f.source.url, /^https:\/\/([a-z0-9-]+\.)*(nps\.gov|blm\.gov|parks\.ca\.gov|fwp\.mt\.gov|digitalcommonwealth\.org)\//, `${t.name}: ${f.source.url}`);
    assert.ok(t.zoom >= 8 && t.zoom <= 16);
  }
  // featured positions agree with the Wikidata ghost-town points (within 3 km)
  const { cols } = readJson('ghost-towns.json');
  for (const name of ['Bodie', 'Rhyolite', 'Bannack']) {
    const t = FEATURED_TOWNS.find((x) => x.name === name);
    // there can be several of a name (there's a Bodie in Washington too): take the nearest
    const km = Math.min(...cols.name.map((n, i) => (n === name ? gh.kmBetween(t.center, [cols.lng[i], cols.lat[i]]) : Infinity)));
    assert.ok(km < 3, `${name} position (${km.toFixed(1)} km off)`);
  }
});

test('Ghost Towns layers produce a valid MapLibre style', () => {
  const { GHOST_LAYERS } = load('app/atlas/ghost-towns/layers.ts');
  const sources = {};
  const layers = [];
  const fake = { addSource: (id, s) => void (sources[id] = s), addLayer: (l) => void layers.push(l), getLayer: () => undefined, setPaintProperty() {} };
  for (const l of GHOST_LAYERS) l.install(fake, { dark: true });
  const errors = styleSpec.validateStyleMin({ version: 8, glyphs: 'https://x/{fontstack}/{range}.pbf', sources, layers }).map((e) => e.message);
  assert.deepEqual(errors, []);
});

test('helpers: lifespan text and distances', () => {
  assert.equal(gh.lifespan(1859, 1932), '1859–1932');
  assert.equal(gh.lifespan(1877, null), 'founded 1877');
  assert.equal(gh.lifespan(null, 1911), 'abandoned 1911');
  assert.equal(gh.lifespan(null, null), null);
  assert.ok(Math.abs(gh.kmBetween([-119.0119, 38.2122], [-116.8287, 36.9019]) - 241) < 5); // Bodie → Rhyolite
});

/* ── Phase 2: then & now, OpenStreetMap abandoned places ─────────── */

test('then & now: the initial view box is centred on the town and sized to the screen', () => {
  const src = fs.readFileSync('components/atlas/ThenNow.tsx', 'utf8');
  const fn = src.match(/export function viewBounds[\s\S]*?\n}/)[0].replace('export ', '').replace(/: \[number, number\]/g, '').replace(/: number/g, '').replace(/\): \[number, number, number, number\]/, ')');
  const viewBounds = new Function(`${fn}; return viewBounds;`)();
  const [w, s, e, n] = viewBounds([-72.3667, 42.3167], 13.5, 1440, 900);
  assert.ok(Math.abs((w + e) / 2 + 72.3667) < 1e-9 && Math.abs((s + n) / 2 - 42.3167) < 1e-9, 'centred');
  // ~1440 px at z13.5 is ~0.087° of longitude
  assert.ok(Math.abs(e - w - 1440 * (360 / (512 * 2 ** 13.5))) < 1e-9);
  assert.ok(n - s < e - w, 'latitude span shrinks with cos(lat)');
});

test('OSM abandoned places: route keeps settlements, drops lone houses', () => {
  const src = fs.readFileSync('app/api/atlas/osm-abandoned/route.ts', 'utf8');
  assert.match(src, /SETTLEMENT = \/\^\(city\|town\|village\|hamlet\)\$\//);
  assert.match(src, /isolated_dwelling is a house/);
  const ov = fs.readFileSync('utils/geo/overpass.ts', 'utf8');
  assert.ok((ov.match(/https:\/\/[^"]+interpreter/g) ?? []).length >= 3, 'several Overpass mirrors');
});

/* ── Phase 3: stories, library, flyovers ─────────────────────────── */

test('stories: official sources, sane cameras, every action points at something real', () => {
  const { GHOST_STORIES } = load('app/atlas/ghost-towns/stories.ts');
  const ids = new Set(FEATURED_TOWNS.map((t) => t.id));
  const { GHOST_LAYERS } = load('app/atlas/ghost-towns/layers.ts');
  const layerIds = new Set(GHOST_LAYERS.map((l) => l.id));
  assert.ok(GHOST_STORIES.length >= 3);
  for (const s of GHOST_STORIES) {
    assert.ok(s.docs.length, `${s.id} cites sources`);
    for (const d of s.docs) assert.match(d.url, /^https:\/\/([a-z0-9-]+\.)*(nps\.gov|blm\.gov|digitalcommonwealth\.org|wikipedia\.org)\//, `${s.id}: ${d.url}`);
    for (const ch of s.chapters) {
      const [lng, lat] = ch.camera.center;
      assert.ok(Math.abs(lng) <= 180 && Math.abs(lat) <= 90 && ch.camera.zoom >= 2 && ch.camera.zoom <= 17, `${s.id}: ${ch.title} camera`);
      assert.ok(ch.body.every((p) => p.length > 20));
      for (const a of ch.actions ?? []) {
        const v = String(a.value);
        if (a.kind === 'town' || a.kind === 'fly') assert.ok(ids.has(v), `${a.label}: ${v}`);
        else if (a.kind === 'layer') assert.ok(layerIds.has(v), `${a.label}: layer ${v}`);
        else if (a.kind === 'then') {
          const [x, y, z, ...name] = v.split(',');
          assert.ok(Number.isFinite(+x) && Number.isFinite(+y) && +z >= 10 && +z <= 17 && name.join(',').length > 1, `${a.label}: ${v}`);
        } else assert.fail(`unknown action ${a.kind}`);
      }
    }
  }
});

test('library manifest: the story documents, public domain, federal', () => {
  const m = JSON.parse(fs.readFileSync('scripts/atlas/manifests/ghost-towns.json', 'utf8'));
  const { GHOST_STORIES } = load('app/atlas/ghost-towns/stories.ts');
  const seeded = new Set(m.map((d) => d.url));
  for (const d of m) {
    assert.equal(d.license, 'public domain');
    assert.match(d.url, /^https:\/\/([a-z0-9-]+\.)*nps\.gov\//);
    assert.ok(d.projects.includes('ghost-towns'));
  }
  // every NPS document a story cites is in the library
  for (const s of GHOST_STORIES) for (const d of s.docs) if (/nps\.gov/.test(d.url)) assert.ok(seeded.has(d.url), d.url);
});
