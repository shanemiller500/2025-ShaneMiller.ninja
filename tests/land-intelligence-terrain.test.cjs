const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = new Map();
function load(file) {
  const abs = path.resolve(file);
  if (loaded.has(abs)) return loaded.get(abs);
  const exports = {};
  loaded.set(abs, exports);
  const requireLocal = (name) => load(path.resolve(path.dirname(abs), name) + '.ts');
  const { outputText } = ts.transpileModule(fs.readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(outputText, { exports, require: requireLocal, Math, Number, Array, JSON }, { filename: abs });
  return exports;
}

const { terrainPoints, terrainStatistics } = load('app/land-intelligence/terrain.ts');
const { lengthMeters } = load('app/land-intelligence/geometry.ts');

test('route samples follow traveled distance across unequal segments', () => {
  const points = [[-105, 40], [-104.99, 40], [-104.99, 40.02]];
  const samples = terrainPoints({ kind: 'line', points });
  const total = lengthMeters(points);
  assert.equal(samples.length, 9);
  assert.deepEqual(Array.from(samples[0].point), points[0]);
  assert.ok(Math.abs(samples.at(-1).distanceMeters - total) < 0.01);
  assert.ok(Math.abs(samples.at(-1).point[1] - points.at(-1)[1]) < 1e-9);
  for (let i = 1; i < samples.length; i++) assert.ok(Math.abs(samples[i].distanceMeters - i * total / 8) < 0.01);
  assert.ok(samples[4].point[1] > 40, 'midpoint must fall on the longer northbound segment');
});

test('area samples stay inside a concave site and return several locations', () => {
  const shape = { kind: 'area', points: [[0, 0], [4, 0], [4, 1], [1, 1], [1, 4], [0, 4]] };
  const samples = terrainPoints(shape);
  assert.ok(samples.length >= 3 && samples.length <= 9);
  assert.ok(samples.every(({ point: [x, y] }) => x <= 1 || y <= 1));
  assert.ok(samples.every((sample) => sample.distanceMeters === null));
});

test('terrain summary reports sampled relief and route rise and fall', () => {
  const samples = [100, 125, 115, 140].map((elevationMeters, index) => ({ point: [index, 0], distanceMeters: index * 100, elevationMeters }));
  const line = terrainStatistics(samples, 'line');
  assert.equal(line.minMeters, 100);
  assert.equal(line.maxMeters, 140);
  assert.equal(line.ascentMeters, 50);
  assert.equal(line.descentMeters, 10);
  const area = terrainStatistics(samples, 'area');
  assert.equal(area.ascentMeters, null);
  assert.equal(area.descentMeters, null);
});

test('drawing validation rejects collapsed and self-crossing analysis areas', () => {
  const { validShape } = load('app/land-intelligence/geometry.ts');
  assert.equal(validShape({ kind: 'area', points: [[0, 0], [1, 0], [1, 1], [0, 1]] }), true);
  assert.equal(validShape({ kind: 'area', points: [[0, 0], [1, 1], [0, 1], [1, 0]] }), false);
  assert.equal(validShape({ kind: 'area', points: [[0, 0], [1, 0], [1, 0], [0, 1]] }), false);
  assert.equal(validShape({ kind: 'line', points: [[0, 0], [0, 0]] }), false);
});

test('terrain API returns a sourced profile and rejects invalid shapes before querying', async () => {
  const file = path.resolve('app/api/land-intelligence/terrain/route.ts');
  const exports = {};
  let calls = 0;
  const requireApi = (name) => name === 'next/server'
    ? { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } }
    : name.startsWith('@/') ? load(name.slice(2) + '.ts') : load(path.resolve(path.dirname(file), name) + '.ts');
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const fetchMock = async (input) => {
    calls++;
    const x = Number(new URL(input).searchParams.get('x'));
    return { ok: true, json: async () => ({ value: 100 + (x + 105) * 1000 }) };
  };
  vm.runInNewContext(outputText, { exports, require: requireApi, fetch: fetchMock, URL, URLSearchParams, AbortSignal, Date, Map, Math, Number, Array, JSON, Promise, Error }, { filename: file });
  const request = (shape) => ({ json: async () => shape, headers: { get: () => null } });
  const invalid = await exports.POST(request({ kind: 'area', points: [[0, 0], [1, 1], [0, 1], [1, 0]] }));
  assert.equal(invalid.status, 400);
  assert.equal(calls, 0);
  const valid = await exports.POST(request({ kind: 'line', points: [[-105, 40], [-104.99, 40]] }));
  assert.equal(valid.status, 200);
  assert.equal(valid.body.status, 'found');
  assert.equal(valid.body.samples.length, 9);
  assert.equal(valid.body.requested, 9);
  assert.equal(calls, 9);
  assert.ok(valid.body.maxMeters > valid.body.minMeters);
});



test('report API normalizes USDA soil and EPA facility records with source limits', async () => {
  const file = path.resolve('app/api/land-intelligence/report/route.ts');
  const exports = {};
  const requireApi = (name) => name === 'next/server'
    ? { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } }
    : name.startsWith('@/') ? load(name.slice(2) + '.ts') : load(path.resolve(path.dirname(file), name) + '.ts');
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  let soilBody = '';
  let facilityBody = '';
  const fetchMock = async (input, options = {}) => {
    const url = String(input);
    const body = String(options.body || '');
    const json = (value) => ({ ok: true, json: async () => value });
    if (url.includes('epqs.nationalmap.gov')) return json({ value: 1600 });
    if (url.includes('/Tabular/post.rest')) {
      soilBody = body;
      return json({ Table: [['mukey', 'musym', 'muname'], ['42', 'Lo', 'Example loam']] });
    }
    if (url.includes('ECHO/Facilities')) {
      facilityBody = body;
      return json(body.includes('returnCountOnly=true')
        ? { count: 1 }
        : { features: [{ attributes: { REGISTRY_ID: '100', FAC_NAME: 'Example facility', FAC_CITY: 'Denver', FAC_STATE: 'CO', AIR_FLAG: 'Y', FAC_ACCURACY_METERS: 50 } }] });
    }
    if (body.includes('returnCountOnly=true')) return json({ count: 0 });
    return json({ features: [] });
  };
  vm.runInNewContext(outputText, { exports, require: requireApi, fetch: fetchMock, URLSearchParams, AbortSignal, Date, Map, Math, Number, String, Array, JSON, Promise, Error }, { filename: file });
  const response = await exports.POST({ json: async () => ({ kind: 'pin', points: [[-104.99, 39.74]] }), headers: { get: () => null } });
  assert.equal(response.status, 200);
  assert.equal(response.body.soils.status, 'found');
  assert.equal(response.body.soils.value[0].name, 'Example loam');
  assert.equal(response.body.facilities.status, 'found');
  assert.equal(response.body.facilities.value.items[0].programs[0], 'Air');
  assert.ok(soilBody.includes('FORMAT=JSON%2BCOLUMNNAME'));
  assert.ok(facilityBody.includes('distance=1000'));
  assert.equal(response.body.facilities.coverage.includes('U.S.'), true);
});
