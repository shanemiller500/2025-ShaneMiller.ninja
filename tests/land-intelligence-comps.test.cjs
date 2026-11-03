// Phase 3 (property and market expansion): deterministic comparable sales and value range.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, fetchMock, env = {}) {
  const abs = path.resolve(file), exports = {};
  const requireLocal = (name) => name.startsWith('node:') ? require(name) : name === 'next/server'
    ? { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } }
    : load(name.startsWith('@/') ? name.slice(2) + '.ts' : path.resolve(path.dirname(abs), name) + '.ts', fetchMock, env);
  const { outputText } = ts.transpileModule(fs.readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(outputText, { exports, require: requireLocal, fetch: fetchMock, process: { env, cwd: () => process.cwd() }, URL, URLSearchParams, AbortSignal, Date, Map, Set, Math, Number, String, Array, Object, JSON, Promise, Error, Buffer }, { filename: abs });
  return exports;
}
const comps = load('app/land-intelligence/comps.ts');
const ORIGIN = [-105.27, 40.01];
const east = (miles) => [ORIGIN[0] + miles / (69.172 * Math.cos(ORIGIN[1] * Math.PI / 180)), ORIGIN[1]];
let seq = 0;
const row = (o = {}) => ({ folio: `F${++seq}`, account: `R${seq}`, date: '2026-06-01', price: 900000, reception: `r${seq}`, deedType: 'WD', siteAddress: '', city: '', neighborhood: '174', subdivision: '', type: 'SFR', basis: 'building', units: 2000, landSqft: null, yearBuilt: 1990, effectiveYear: null, bedrooms: 3, quality: '', point: east(0.2), changedAfterSale: false, ...o });
const subject = (o = {}) => ({ folio: 'SUBJECT', type: 'SFR', basis: 'building', units: 2000, yearBuilt: 1990, neighborhood: '174', point: ORIGIN, ...o });
const ASOF = '2026-10-25';

test('percentile and distance helpers', () => {
  assert.equal(comps.percentile([1, 2, 3, 4], 0.5), 2.5);
  assert.equal(comps.percentile([10], 0.25), 10);
  assert.ok(Math.abs(comps.milesBetween(ORIGIN, east(1)) - 1) < 0.01);
});

test('tier 1 is used when it has five comparables and the range is median × subject area', () => {
  const rows = [400, 420, 450, 460, 480, 500].map((ppsf, i) => row({ price: ppsf * 2000, date: `2026-0${i + 1}-15` }));
  const result = comps.selectComparables(subject(), rows, ASOF);
  assert.equal(result.tier.id, 1);
  assert.equal(result.used, 6);
  assert.equal(result.stats.median, 455);
  assert.equal(result.estimate.value, 910000);
  assert.ok(result.estimate.low <= result.estimate.value && result.estimate.value <= result.estimate.high);
  assert.equal(result.confidence, 'medium', 'fewer than 8 sales is never high confidence');
});

test('filters: type, subject, size band, radius, window; one sale per property', () => {
  const rows = [
    row({ type: 'CONDO' }), row({ folio: 'SUBJECT' }), row({ units: 3100 }), row({ point: east(1.5) }), row({ date: '2023-01-01' }), row({ price: 0 }),
    row({ account: 'SAME', date: '2025-01-01', price: 800000 }), row({ account: 'SAME', date: '2026-02-01', price: 950000 }),
  ];
  const result = comps.selectComparables(subject(), rows, ASOF);
  assert.equal(result.tier.id, 3, 'too few in tiers 1 and 2, so the widest step is reported');
  assert.equal(result.comps.filter((comp) => comp.account === 'SAME').length, 1);
  assert.equal(result.comps.find((comp) => comp.account === 'SAME').price, 950000, 'the latest sale of a repeat property is kept');
  assert.equal(result.comps.some((comp) => comp.type === 'CONDO' || comp.folio === 'SUBJECT' || comp.price === 0), false);
  assert.equal(result.comps.some((comp) => comp.units === 3100), false, '3100 is outside ±50% (2000/1.5 to 2000×1.5)');
  assert.equal(result.comps.length, 3, 'the 1.5 mi and 2023 sales qualify only in the widest step');
  assert.equal(result.confidence, 'low');
  assert.match(result.reasons.join(' '), /widened to 3 mi/);
});

test('without a parcel location, comparables are limited to the same appraisal neighborhood', () => {
  const rows = [...Array(6)].map((_, i) => row({ point: null, date: `2026-0${i + 1}-01` })).concat([row({ neighborhood: '999', point: null })]);
  const result = comps.selectComparables(subject({ point: null }), rows, ASOF);
  assert.equal(result.locationMethod, 'neighborhood');
  assert.equal(result.comps.every((comp) => comp.neighborhood === '174' && comp.distanceMiles == null), true);
  assert.match(result.reasons[0], /appraisal neighborhood/);
});

test('outliers beyond 1.5× IQR are shown but excluded from the figures', () => {
  const rows = [450, 455, 460, 465, 470, 475, 480, 2000].map((ppsf, i) => row({ price: ppsf * 2000, date: `2026-0${i + 1}-10` }));
  const result = comps.selectComparables(subject(), rows, ASOF);
  const outliers = result.comps.filter((comp) => comp.outlier);
  assert.equal(outliers.length, 1);
  assert.equal(outliers[0].perUnit, 2000);
  assert.equal(result.used, 7);
  assert.ok(result.stats.max < 2000);
  assert.match(result.reasons.join(' '), /interquartile/);
});

test('a calibration sets the range around the midpoint; without one the range is the comparables middle half', () => {
  const rows = [400, 420, 450, 460, 480, 500].map((ppsf, i) => row({ price: ppsf * 2000, date: `2026-0${i + 1}-20` }));
  const plain = comps.selectComparables(subject(), rows, ASOF);
  assert.equal(plain.estimate.rangeBasis, 'comparable_spread');
  assert.equal(plain.estimate.coverage, null);
  const calibrated = comps.selectComparables(subject(), rows, ASOF, comps.BOULDER_CALIBRATION);
  assert.equal(calibrated.estimate.rangeBasis, 'calibrated');
  assert.equal(calibrated.estimate.value, plain.estimate.value, 'the midpoint does not depend on the calibration');
  const [low, high] = comps.BOULDER_CALIBRATION.bands[calibrated.confidence];
  assert.equal(calibrated.estimate.low, Math.round(calibrated.estimate.value * (1 + low) / 1000) * 1000);
  assert.equal(calibrated.estimate.high, Math.round(calibrated.estimate.value * (1 + high) / 1000) * 1000);
  assert.equal(calibrated.estimate.coverage, comps.BOULDER_CALIBRATION.validated[calibrated.confidence]);
});

test('high confidence needs 8+ sales in the nearest step with a tight spread', () => {
  const rows = [440, 445, 450, 452, 455, 458, 460, 465, 470].map((ppsf, i) => row({ price: ppsf * 2000, date: `2026-0${i + 1}-05` }));
  assert.equal(comps.selectComparables(subject(), rows, ASOF).confidence, 'high');
});

test('fewer than three usable sales gives no range; no area gives no search', () => {
  const two = comps.selectComparables(subject(), [row(), row()], ASOF);
  assert.equal(two.estimate, null);
  assert.equal(two.confidence, 'insufficient');
  const none = comps.selectComparables(subject({ units: 0 }), [row()], ASOF);
  assert.equal(none.comps.length, 0);
  assert.match(none.reasons[0], /No finished building area/);
});

test('selection is deterministic regardless of input order', () => {
  seq = 100;
  const rows = [...Array(12)].map((_, i) => row({ price: (430 + i * 7) * 2000, units: 1800 + i * 40, date: `2025-${String(i + 1).padStart(2, '0')}-01`, point: east(0.1 * (i % 5)) }));
  const a = comps.selectComparables(subject(), rows, ASOF);
  const b = comps.selectComparables(subject(), [...rows].reverse(), ASOF);
  assert.deepEqual(a.comps.map((comp) => comp.folio), b.comps.map((comp) => comp.folio));
  assert.deepEqual(a.estimate, b.estimate);
  assert.equal(a.comps.length, 10, 'at most 10 comparables');
});

test('comparables route explains unsupported places without calling a comps source', async () => {
  const calls = [];
  const fetchMock = async (url) => {
    calls.push(String(url));
    return { ok: true, text: async () => JSON.stringify({ features: [{ attributes: { OBJECTID: 7, PARCEL_ID: 'A', CO_NO: 47 } }] }), json: async () => ({}) };
  };
  const { GET } = load('app/api/land-intelligence/comparables/route.ts', fetchMock);
  const bad = await GET({ nextUrl: new URL('http://x/api?key=zz:1') });
  assert.equal(bad.status, 400);
  const fl = await GET({ nextUrl: new URL('http://x/api?key=fl:7') });
  assert.equal(fl.body.status, 'not_supported');
  assert.match(fl.body.reason, /Boulder County/);
  assert.equal(calls.length, 1, 'only the parcel record was requested');
});

test('real Boulder snapshot: fixture comparables are consistent and gated in production (skipped without snapshot)', async (t) => {
  if (!fs.existsSync('data/land-intelligence/boulder/manifest.json')) return t.skip('Boulder snapshot is not loaded in this checkout');
  const dev = load('app/land-intelligence/boulder-comps.ts', undefined, {});
  const single = await dev.boulderComparables('146124104006');
  assert.equal(single.status, 'ready');
  const result = single.result;
  assert.equal(result.subject.type, 'SINGLE FAM RES IMPROVEMENTS');
  assert.equal(result.locationMethod, 'distance');
  assert.ok(result.comps.length > 0 && result.comps.length <= 10);
  assert.ok(result.comps.every((comp) => comp.type === result.subject.type && comp.folio !== '146124104006' && comp.price > 0));
  if (result.estimate) assert.ok(result.estimate.low <= result.estimate.value && result.estimate.value <= result.estimate.high);
  const multi = await dev.boulderComparables('157508438002');
  assert.equal(multi.status, 'not_supported', 'a three-account parcel is not valued');
  const production = load('app/land-intelligence/boulder-comps.ts', undefined, { NODE_ENV: 'production' });
  const gated = await production.boulderComparables('146124104006');
  assert.equal(gated.status, 'rights_pending');
  assert.equal('result' in gated, false, 'no county comparables leave the server');
});
