const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, fetchMock) {
  const abs = path.resolve(file), exports = {};
  const requireLocal = (name) => name === 'next/server'
    ? { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } }
    : load(name.startsWith('@/') ? name.slice(2) + '.ts' : path.resolve(path.dirname(abs), name) + '.ts', fetchMock);
  const { outputText } = ts.transpileModule(fs.readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(outputText, { exports, require: requireLocal, fetch: fetchMock, URL, URLSearchParams, AbortSignal, Date, Map, Math, Number, String, Array, Object, JSON, Promise, Error }, { filename: abs });
  return exports;
}

test('parcel source routing includes both sides of a state border and marks other states outside', () => {
  const { sourcesForBounds } = load('app/land-intelligence/parcel-sources.ts');
  assert.deepEqual(Array.from(sourcesForBounds([-109.2, 39, -108.9, 39.1]).map((source) => source.id)), ['co', 'ut']);
  assert.equal(sourcesForBounds([-98, 35, -97.9, 35.1]).length, 0);
});

test('parcel records normalize state fields without exposing owner names', () => {
  const { PARCEL_SOURCES, normalizeParcel } = load('app/land-intelligence/parcel-sources.ts');
  const co = normalizeParcel(PARCEL_SOURCES[0], { parcel_id: '42', countyName: 'Denver', situsAdd: '123 Main St', sitAddCty: 'Denver', landAcres: 0.5, zoningDesc: 'Residential', landUseDsc: 'Single family residential', owner: 'Private person', URL: 'javascript:alert(1)' });
  assert.equal(co.category, 'residential');
  assert.equal(co.acres, 0.5);
  assert.equal(co.recordUrl, '');
  assert.equal('owner' in co, false);
  const ut = normalizeParcel(PARCEL_SOURCES[1], { PARCEL_ID: 'UT-1', OWN_TYPE: 'State', ParcelsCur: 1750000000000 });
  assert.equal(ut.category, 'public');
  assert.match(ut.received, /^2025-/);
  const wa = normalizeParcel(PARCEL_SOURCES[2], { PARCEL_ID_NR: 'WA-1', LANDUSE_CD: 11, VALUE_LAND: 320000 });
  assert.equal(wa.category, 'residential');
  assert.equal(wa.landValue, 320000);
  assert.equal(normalizeParcel(PARCEL_SOURCES[2], { LANDUSE_CD: 45 }).category, 'other');
});

test('parcel map caps geography and returns sourced polygons from a connected state', async () => {
  let calls = 0;
  const polygon = { type: 'Polygon', coordinates: [[[-105, 39], [-104.99, 39], [-104.99, 39.01], [-105, 39.01], [-105, 39]]] };
  const { GET } = load('app/api/land-intelligence/parcel-map/route.ts', async (url, options) => {
    calls++;
    assert.match(url, /Colorado_Public_Parcels/);
    assert.equal(new URLSearchParams(options.body).get('resultRecordCount'), '500');
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', id: 8, geometry: polygon, properties: { OBJECTID: 8, parcel_id: 'CO-8', landUseDsc: 'Commercial retail' } }] }) };
  });
  const request = (bbox) => ({ nextUrl: new URL(`http://local.test/?bbox=${bbox}`) });
  assert.equal((await GET(request('-105,39,-104,39.1'))).status, 422);
  assert.equal((await GET(request('-98,35,-97.99,35.01'))).body.coverage, 'outside');
  assert.equal(calls, 0);
  const result = await GET(request('-105,39,-104.99,39.01'));
  assert.equal(result.body.coverage, 'covered');
  assert.equal(result.body.features[0].properties.parcelKey, 'co:8');
  assert.equal(result.body.features[0].properties.category, 'commercial');
  assert.equal(calls, 1);
});
test('Florida DOR parcel fields stay normalized and do not request owner details', () => {
  const { PARCEL_SOURCES, normalizeParcel } = load('app/land-intelligence/parcel-sources.ts');
  const fl = PARCEL_SOURCES.find((source) => source.id === 'fl');
  assert.ok(fl);
  assert.equal(fl.fields.includes('OWN_NAME'), false);
  const parcel = normalizeParcel(fl, { PARCEL_ID: 'FL-1', CO_NO: 11, PHY_ADDR1: '100 Gulf Rd', PHY_CITY: 'Miami', LND_SQFOOT: 43560, DOR_UC: '0100', LND_VAL: 150000, ASMNT_YR: 2025 });
  assert.equal(parcel.acres, 1);
  assert.equal(parcel.landUse, 'DOR code 0100');
  assert.equal(parcel.landValue, 150000);
  assert.equal(parcel.received, '2025');
});
test('report uses the Washington source and keeps parcel attributes in one schema', async () => {
  let washingtonCalls = 0;
  const fetchMock = async (input, options = {}) => {
    const url = String(input), body = String(options.body ?? '');
    const json = (value) => ({ ok: true, json: async () => value });
    if (url.includes('Current_Parcels')) {
      washingtonCalls++;
      return json(body.includes('returnCountOnly=true') ? { count: 1 } : { features: [{ attributes: { PARCEL_ID_NR: 'WA-123', SITUS_ADDRESS: '10 Pine St', SITUS_CITY_NM: 'Seattle', LANDUSE_CD: 11, VALUE_LAND: 450000 } }] });
    }
    if (url.includes('InitialRelease_Accidents')) {
      assert.equal(new URLSearchParams(body).get('where'), 'YEAR=2024');
      return json(body.includes('returnCountOnly=true') ? { count: 1 } : { features: [{ attributes: { ST_CASE: 123, YEAR: 2024, MONTH: 7, DAY: 4, FATALS: 1 } }] });
    }
    if (url.includes('epqs.nationalmap.gov')) return json({ value: 20 });
    if (url.includes('/Tabular/post.rest')) return json({ Table: [['mukey', 'musym', 'muname']] });
    if (url.includes('geocoder/geographies')) return json({ result: { geographies: {} } });
    if (body.includes('returnCountOnly=true')) return json({ count: 0 });
    return json({ features: [] });
  };
  const { POST } = load('app/api/land-intelligence/report/route.ts', fetchMock);
  const result = await POST({ json: async () => ({ kind: 'pin', points: [[-122.3, 47.6]] }), headers: { get: () => null } });
  assert.equal(result.body.parcels.status, 'found');
  assert.equal(result.body.parcels.value.items[0].state, 'Washington');
  assert.equal(result.body.parcels.value.items[0].category, 'residential');
  assert.equal(result.body.parcels.value.items[0].landValue, 450000);
  assert.equal(result.body.crashes.value.items[0].fatalities, 1);
  assert.equal(washingtonCalls, 2);
});

test('North Carolina and Wisconsin public parcel fields join the common schema', () => {
  const { PARCEL_SOURCES, normalizeParcel, sourcesForBounds } = load('app/land-intelligence/parcel-sources.ts');
  const nc = PARCEL_SOURCES.find((source) => source.id === 'nc');
  const wi = PARCEL_SOURCES.find((source) => source.id === 'wi');
  assert.ok(nc && wi);
  assert.equal(nc.fields.includes('ownname'), false);
  assert.equal(wi.fields.includes('OWNERNME1'), false);
  assert.equal(normalizeParcel(nc, { parno: 'NC-1', cntyname: 'Wake', siteadd: '10 Main St', gisacres: 1.25, parusedesc: 'Residential', landval: 100000 }).category, 'residential');
  assert.equal(normalizeParcel(wi, { PARCELID: 'WI-1', CONAME: 'Dane', SITEADRESS: '5 Lake St', GISACRES: 2, PROPCLASS: 'Agricultural' }).category, 'agricultural');
  assert.deepEqual(Array.from(sourcesForBounds([-80, 35, -79.9, 35.1]).map((source) => source.id)), ['nc']);
  assert.deepEqual(Array.from(sourcesForBounds([-89.5, 43, -89.4, 43.1]).map((source) => source.id)), ['wi']);
});

test('outside focus forms a nearby ring with the parcel footprint cut out', () => {
  const { focusGeoJSON } = load('app/land-intelligence/report-focus.ts');
  const shape = { kind: 'pin', points: [[-105, 39]] };
  const parcel = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-105,39],[-104.99,39],[-104.99,39.01],[-105,39.01],[-105,39]]] } };
  assert.equal(focusGeoJSON(shape, parcel, 'inside').features[0].geometry.type, 'Polygon');
  assert.equal(focusGeoJSON(shape, parcel, 'outside').features[0].geometry.coordinates.length, 2);
});

test('fatal crash map uses 2024 FARS and rejects broad views', async () => {
  const { GET } = load('app/api/land-intelligence/crash-map/route.ts', async (url, options) => {
    assert.match(url, /InitialRelease_Accidents/);
    assert.equal(new URLSearchParams(options.body).get('where'), 'YEAR=2024');
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', id: 1, geometry: { type: 'Point', coordinates: [-105, 39] }, properties: { OBJECTID: 1, ST_CASE: 12, YEAR: 2024, MONTH: 1, DAY: 2, FATALS: 1 } }] }) };
  });
  const request = (bbox) => ({ nextUrl: new URL(`http://local.test/?bbox=${bbox}`) });
  assert.equal((await GET(request('-105,39,-100,40'))).status, 422);
  const result = await GET(request('-105,39,-104.9,39.1'));
  assert.equal(result.body.features[0].properties.date, '2024-01-02');
  assert.equal(result.body.features[0].properties.fatalities, 1);
});
test('clicked property details distinguish sale price and assessment', () => {
  const { PARCEL_SOURCES } = load('app/land-intelligence/parcel-sources.ts');
  const { normalizeParcelDetail } = load('app/land-intelligence/parcel-detail.ts');
  const co = normalizeParcelDetail(PARCEL_SOURCES[0], { parcel_id: '42', owner: 'Example Owner', saleDate: '2024-04-01', salePrice: '$425,000', apprValTot: '$510,000', asedValTot: '$36,000' });
  assert.equal(co.owners[0], 'Example Owner');
  assert.equal(co.sales[0].price, 425000);
  assert.equal(co.assessedTotal, 510000);
  assert.equal(co.taxableValue, 36000);
  const fl = normalizeParcelDetail(PARCEL_SOURCES[3], { OWN_NAME: 'Example LLC', SALE_PRC1: 350000, SALE_YR1: 2021, SALE_MO1: '04', SALE_PRC2: 0, SALE_YR2: 0, JV: 500000, ACT_YR_BLT: 1998 });
  assert.equal(fl.sales.length, 1);
  assert.equal(fl.sales[0].date, '2021-04');
  assert.equal(fl.estimatedMarketValue, 500000);
  assert.equal(fl.yearBuilt, 1998);
  const wi = normalizeParcelDetail(PARCEL_SOURCES[5], { OWNERNME1: 'Example Owner', CNTASSDVALUE: 310000, NETPRPTA: 4200 });
  assert.equal(wi.assessedTotal, 310000);
  assert.equal(wi.annualPropertyTax, 4200);
  assert.equal(wi.sales.length, 0);
});

test('parcel detail route validates keys and queries only the selected record', async () => {
  let calls = 0;
  const { GET } = load('app/api/land-intelligence/parcel-detail/route.ts', async (url, options) => {
    calls++;
    assert.match(url, /Colorado_Public_Parcels/);
    const params = new URLSearchParams(options.body);
    assert.equal(params.get('objectIds'), '8');
    assert.equal(params.get('returnGeometry'), 'false');
    assert.match(params.get('outFields'), /salePrice/);
    return { ok: true, text: async () => JSON.stringify({ features: [{ attributes: { OBJECTID: 8, parcel_id: 'CO-8', owner: 'Example Owner', salePrice: '400000' } }] }) };
  });
  const request = (key) => ({ nextUrl: new URL(`http://local.test/?key=${encodeURIComponent(key)}`) });
  assert.equal((await GET(request('co:8 OR 1=1'))).status, 400);
  assert.equal(calls, 0);
  const result = await GET(request('co:8'));
  assert.equal(result.body.detail.parcel.id, 'CO-8');
  assert.equal(result.body.detail.owners[0], 'Example Owner');
  assert.equal(result.body.detail.sales[0].price, 400000);
  assert.equal(calls, 1);
});
