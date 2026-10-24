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
    : load(name.startsWith('@/') ? name.slice(2) + '.ts' : path.resolve(path.dirname(abs), name) + '.ts', fetchMock);
  const { outputText } = ts.transpileModule(fs.readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(outputText, { exports, require: requireLocal, fetch: fetchMock, URL, URLSearchParams, AbortSignal, Date, Map, Set, Math, Number, String, Array, Object, JSON, Promise, Error }, { filename: abs });
  return exports;
}
const request = (bbox) => ({ nextUrl: new URL(`http://local/api/land-intelligence/facility-map?bbox=${bbox}`) });

test('EPA facilities read as a status, programs and a report link people can understand', () => {
  const { normalizeFacility, facilityStatus } = load('app/land-intelligence/facility.ts');
  assert.equal(facilityStatus('No Violation Identified', 'N'), 'clear');
  assert.equal(facilityStatus('Violation Identified', 'N'), 'violation');
  assert.equal(facilityStatus('Significant Violation', 'Y'), 'significant');
  assert.equal(facilityStatus('Violation Identified', 'Y'), 'significant', 'the significant-noncompliance flag outranks the label');
  assert.equal(facilityStatus(null, 'N'), 'unknown');
  const facility = normalizeFacility({ REGISTRY_ID: '110001392920', FAC_NAME: 'PEERLESS TYRE CO', FAC_STREET: '610 BASELINE RD', FAC_CITY: 'LAFAYETTE', FAC_STATE: 'CO', FAC_CURR_COMPLIANCE_STATUS: 'Violation Identified', AIR_FLAG: 'Y', RCRA_FLAG: 'Y', NPDES_FLAG: 'N', FAC_DATE_LAST_INSPECTION: 1341446400000, FAC_TOTAL_PENALTIES: 2500 });
  assert.equal(facility.statusLabel, 'Violation identified');
  assert.equal(facility.programs, 'Air emissions · Hazardous waste');
  assert.equal(facility.lastInspection, '2012-07-05');
  assert.equal(facility.address, '610 BASELINE RD, LAFAYETTE, CO');
  assert.equal(facility.reportUrl, 'https://echo.epa.gov/detailed-facility-report?fid=110001392920');
  assert.equal(normalizeFacility({ REGISTRY_ID: '1 OR 1=1' }).reportUrl, '', 'only a digits-only registry ID builds a link');
});

test('facility map validates bounds and returns status-ranked points', async () => {
  let calls = 0;
  const fetchMock = async () => { calls++; return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-105.08, 40.0] }, properties: { REGISTRY_ID: '110000000001', FAC_NAME: 'A', FAC_CURR_COMPLIANCE_STATUS: 'Significant Violation', FAC_CURR_SNC_FLG: 'Y' } },
    { type: 'Feature', geometry: null, properties: { REGISTRY_ID: '110000000002' } },
  ] }) }; };
  const { GET } = load('app/api/land-intelligence/facility-map/route.ts', fetchMock);
  assert.equal((await GET(request('a,b,c,d'))).status, 400);
  assert.equal((await GET(request('-106,39,-104,41'))).status, 422, 'wide views are refused before any request');
  assert.equal(calls, 0);
  const result = await GET(request('-105.105,39.995,-105.075,40.015'));
  assert.equal(result.body.features.length, 1, 'features without a point are dropped');
  assert.equal(result.body.features[0].properties.status, 'significant');
  assert.equal(result.body.features[0].properties.rank, 3);
});
