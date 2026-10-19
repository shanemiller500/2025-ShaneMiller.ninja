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
  vm.runInNewContext(outputText, { exports, require: requireLocal, fetch: fetchMock, URLSearchParams, AbortSignal, URL, Date, Map, Math, JSON, Number, String, Array, Object, Error, Promise }, { filename: abs });
  return exports;
}
test('soil map validates bounds and groups returned polygons', async () => {
  let calls = 0, requested;
  const polygon = { type: 'Polygon', coordinates: [[[-105, 39], [-104.99, 39], [-104.99, 39.01], [-105, 39.01], [-105, 39]]] };
  const { GET } = load('app/api/land-intelligence/soil-map/route.ts', async (_url, options) => {
    calls++; requested = options.body;
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', id: 42, properties: { mukey: 123, muname: 'Sandy loam' }, geometry: polygon }] }) };
  });
  const request = (bbox) => ({ nextUrl: new URL(`http://local.test/?bbox=${bbox}`) });
  assert.equal((await GET(request('-105,39,-103,40'))).status, 422);
  assert.equal((await GET(request('-105,39,-106,40'))).status, 400);
  assert.equal(calls, 0);
  const result = await GET(request('-105,39,-104.99,39.01'));
  assert.equal(result.status, 200);
  assert.equal(result.body.features[0].properties.objectid, 42);
  assert.equal(result.body.features[0].properties.category, 'sand');
  assert.equal(new URLSearchParams(requested).get('outFields').includes('farmlndcl'), true);
});
test('soil detail rejects unsafe keys and maps NRCS component ratings', async () => {
  let calls = 0;
  const { GET } = load('app/api/land-intelligence/soil-detail/route.ts', async (_url, options) => {
    calls++;
    assert.match(new URLSearchParams(options.body).get('QUERY'), /mukey = '12345'/);
    return { ok: true, json: async () => ({ Table: [['compname', 'comppct_r', 'hydricrating', 'drainagecl', 'taxclname', 'slope_r'], ['Clay loam', 65, 'No', 'Well drained', 'Fine-loamy', 3]] }) };
  });
  assert.equal((await GET({ nextUrl: new URL('http://local.test/?mukey=12%27%3BDROP') })).status, 400);
  const result = await GET({ nextUrl: new URL('http://local.test/?mukey=12345') });
  assert.equal(result.body.components[0].drainage, 'Well drained');
  assert.equal(result.body.components[0].percentage, 65);
  assert.equal(calls, 1);
});
test('feature inspection only queries allowlisted visible source ids', async () => {
  const urls = [];
  const { POST } = load('app/api/land-intelligence/identify/route.ts', async (url) => {
    urls.push(url);
    return { ok: true, json: async () => ({ features: [{ attributes: { WETLAND_TYPE: 'Freshwater Emergent Wetland', ATTRIBUTE: 'PEM1A', ACRES: 1.5 } }] }) };
  });
  const bad = await POST({ json: async () => ({ lng: -105, lat: 40, layers: Array(9).fill('wetlands') }) });
  assert.equal(bad.status, 400);
  const result = await POST({ json: async () => ({ lng: -105, lat: 40, layers: ['wetlands', 'unknown'] }) });
  assert.equal(urls.length, 1);
  assert.match(urls[0], /Wetlands\/MapServer\/0\/query/);
  assert.equal(result.body.results[0].features[0].ATTRIBUTE, 'PEM1A');
});

test('location report includes sourced tract estimates without treating them as site counts', async () => {
  const fetchMock = async (input, options = {}) => {
    const url = String(input), body = String(options.body ?? '');
    const json = (value) => ({ ok: true, json: async () => value });
    if (url.includes('geocoder/geographies/coordinates')) return json({ result: { geographies: { 'Census Tracts': [{ STATE: '08', COUNTY: '031', TRACT: '000100' }] } } });
    if (url.includes('api.census.gov/data/2024/acs/acs5/profile')) return json([['NAME', 'DP05_0001E', 'DP03_0062E', 'DP03_0128PE'], ['Census Tract 1, Denver County, Colorado', '3200', '84000', '11.2']]);
    if (url.includes('epqs.nationalmap.gov')) return json({ value: 1600 });
    if (url.includes('/Tabular/post.rest')) return json({ Table: [['mukey', 'musym', 'muname']] });
    if (body.includes('returnCountOnly=true')) return json({ count: 0 });
    return json({ features: [] });
  };
  const { POST } = load('app/api/land-intelligence/report/route.ts', fetchMock);
  const result = await POST({ json: async () => ({ kind: 'pin', points: [[-104.99, 39.74]] }), headers: { get: () => null } });
  assert.equal(result.body.census.status, 'found');
  assert.equal(result.body.census.value.population, 3200);
  assert.equal(result.body.census.value.povertyPercent, 11.2);
  assert.match(result.body.census.note, /not the people or households within the site/);
});
