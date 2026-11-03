// Recent recorded home sales: Denver live (citywide, filtered) and the statewide last sale elsewhere in Colorado.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, fetchMock) {
  const abs = path.resolve(file), exports = {};
  const requireLocal = (name) => name.startsWith('node:') ? require(name) : name === 'next/server'
    ? { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } }
    : name.startsWith('@/') || name.startsWith('.') ? load(name.startsWith('@/') ? name.slice(2) + '.ts' : path.resolve(path.dirname(abs), name) + '.ts', fetchMock) : require(name);
  const { outputText } = ts.transpileModule(fs.readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(outputText, { exports, require: requireLocal, fetch: fetchMock, process: { env: {}, cwd: () => process.cwd() }, URL, URLSearchParams, AbortSignal, Date, Map, Set, Math, Number, String, Array, Object, JSON, Promise, Error, Buffer }, { filename: abs });
  return exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const square = (x, y, d = 0.0002) => ({ type: 'Polygon', coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] });
const TODAY = new Date('2026-11-02T12:00:00Z');

test('window start counts back whole months', () => {
  const recent = load('app/land-intelligence/recent-sales.ts');
  assert.equal(recent.windowStart(12, TODAY), '2025-11-02');
  assert.equal(recent.windowStart(3, TODAY), '2026-08-02');
});

test('Denver filter drops unpriced, future-dated and multi-parcel transfers', () => {
  const recent = load('app/land-intelligence/recent-sales.ts');
  const rows = [
    { PARID: 1, RECEPTION_NUM: 'A', SALE_YEAR: 2026, SALE_MONTHDAY: 915, SALE_PRICE: 640000, INSTRUMENT: 'WD', D_CLASS_N: 'SFR Grade C' },
    { PARID: 2, RECEPTION_NUM: 'B', SALE_YEAR: 2026, SALE_MONTHDAY: 1230, SALE_PRICE: 500000, INSTRUMENT: 'SW', D_CLASS_N: 'RESIDENTIAL-CONDOMINIUM' },
    { PARID: 3, RECEPTION_NUM: 'C', SALE_YEAR: 2026, SALE_MONTHDAY: 301, SALE_PRICE: 5000, INSTRUMENT: 'WD', D_CLASS_N: 'SFR Grade B' },
    { PARID: 4, RECEPTION_NUM: 'D', SALE_YEAR: 2026, SALE_MONTHDAY: 401, SALE_PRICE: 2400000, INSTRUMENT: 'SW', D_CLASS_N: 'SFR Grade C' },
    { PARID: 5, RECEPTION_NUM: 'D', SALE_YEAR: 2026, SALE_MONTHDAY: 401, SALE_PRICE: 2400000, INSTRUMENT: 'SW', D_CLASS_N: 'SFR Grade C' },
    { PARID: 6, RECEPTION_NUM: 'E', SALE_YEAR: 2024, SALE_MONTHDAY: 101, SALE_PRICE: 400000, INSTRUMENT: 'WD', D_CLASS_N: 'SFR Grade C' },
  ];
  const kept = plain(recent.denverRecentRows(rows, '2025-11-02', '2026-11-02'));
  assert.deepEqual(kept.map((sale) => [sale.parcelId, sale.date, sale.deed]), [[1, '2026-09-15', 'Warranty deed']], 'future date, under $10k, shared reception and out-of-window rows are dropped');
});

test('label point is the area-weighted centroid of the largest ring', () => {
  const recent = load('app/land-intelligence/recent-sales.ts');
  const [x, y] = plain(recent.polygonPoint(square(-105, 40, 0.002)));
  assert.ok(Math.abs(x + 104.999) < 1e-9 && Math.abs(y - 40.001) < 1e-9);
  const multi = { type: 'MultiPolygon', coordinates: [square(-105, 40, 0.0001).coordinates, square(-104, 40, 0.01).coordinates] };
  assert.ok(Math.abs(plain(recent.polygonPoint(multi))[0] + 103.995) < 1e-9);
});

test('statewide last sales: any date format, residential or unreported use, inside the window', () => {
  const recent = load('app/land-intelligence/recent-sales.ts');
  const base = { parcel_id: '49-153', countyName: 'Jefferson', situsAdd: '9561 W TENNESSEE AVE', sitAddCty: 'LAKEWOOD', salePrice: '653000', landUseDsc: 'Single Family' };
  const at = [-105.1, 39.7];
  assert.equal(recent.statewideRecent({ ...base, saleDate: '2/27/2026' }, at, '2025-11-02', '2026-11-02').date, '2026-02-27');
  assert.equal(recent.statewideRecent({ ...base, saleDate: '20260302' }, at, '2025-11-02', '2026-11-02').date, '2026-03-02', 'Weld YYYYMMDD');
  assert.equal(recent.statewideRecent({ ...base, saleDate: '2/27/2024' }, at, '2025-11-02', '2026-11-02'), null, 'outside the window');
  assert.equal(recent.statewideRecent({ ...base, saleDate: '2/27/2026', landUseDsc: 'Commercial Retail' }, at, '2025-11-02', '2026-11-02'), null, 'not a home');
  assert.equal(recent.statewideRecent({ ...base, saleDate: '2/27/2026', landUseDsc: '' }, at, '2025-11-02', '2026-11-02').propertyClass, 'Use not reported', 'blank use (e.g. Boulder) is kept and labeled');
  assert.equal(recent.statewideRecent({ ...base, saleDate: '2/27/2026', salePrice: '0' }, at, '2025-11-02', '2026-11-02'), null);
});

test('join: Denver parcels use the live sales by numeric PARID; others the statewide layer', () => {
  const recent = load('app/land-intelligence/recent-sales.ts');
  const parcels = [
    { type: 'Feature', geometry: square(-104.98, 39.73), properties: { parcel_id: '0503109057057', countyName: 'Denver', situsAdd: '1376 N PEARL ST APT 110', sitAddCty: 'DENVER', saleDate: '1/1/2019', salePrice: '200000', landUseDsc: 'Condominium' } },
    { type: 'Feature', geometry: square(-105.1, 39.7), properties: { parcel_id: '49-153', countyName: 'Jefferson', situsAdd: 'X', sitAddCty: 'LAKEWOOD', saleDate: '2/27/2026', salePrice: '653000', landUseDsc: 'Single Family' } },
  ];
  const denver = new Map([[503109057057, [{ parcelId: 503109057057, date: '2026-09-17', price: 290000, deed: 'Warranty deed', propertyClass: 'RESIDENTIAL-CONDOMINIUM', reception: '2026107179' }]]]);
  const sales = plain(recent.recentSalesFor(parcels, denver, 12, TODAY));
  assert.deepEqual(sales.map((sale) => [sale.source, sale.date, sale.price]), [['denver', '2026-09-17', 290000], ['statewide', '2026-02-27', 653000]], 'newest first; Denver ignores its stale statewide sale');
  assert.equal(plain(recent.recentSalesFor(parcels, denver, 3, TODAY)).length, 1);
  assert.deepEqual([recent.priceClass(399999), recent.priceClass(400000), recent.priceClass(2000000)], [0, 1, 3]);
});

test('route validates input, stays inside Colorado, and sorts nearby sales by distance', async () => {
  const parcelsResponse = { type: 'FeatureCollection', features: [
    { type: 'Feature', geometry: square(-105.1005, 39.7), properties: { parcel_id: 'far', countyName: 'Jefferson', situsAdd: 'A', saleDate: '3/1/2026', salePrice: '500000', landUseDsc: 'Single Family' } },
    { type: 'Feature', geometry: square(-105.1001, 39.7), properties: { parcel_id: 'near', countyName: 'Jefferson', situsAdd: 'B', saleDate: '2/1/2026', salePrice: '450000', landUseDsc: 'Single Family' } },
  ] };
  const route = load('app/api/land-intelligence/recent-sales/route.ts', async () => ({ ok: true, json: async () => parcelsResponse }));
  const get = (query) => route.GET({ nextUrl: new URL(`http://x/?${query}`) });
  assert.equal((await get('months=5&bbox=-105.11,39.69,-105.09,39.71')).status, 400);
  assert.equal((await get('months=12&bbox=-106,39,-105,40')).status, 422, 'view too large');
  assert.equal((await get('months=12&bbox=-80.2,25.7,-80.15,25.75')).body.coverage, 'outside');
  const near = await get('months=12&near=-105.1,39.7001');
  assert.equal(near.status, 200);
  assert.deepEqual(plain(near.body.features.map((feature) => feature.properties.parcelId)), ['near', 'far']);
  assert.ok(near.body.features[0].properties.distanceMiles < near.body.features[1].properties.distanceMiles);
  assert.equal(near.body.denver, 'not_needed');
});
