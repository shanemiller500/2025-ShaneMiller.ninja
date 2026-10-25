const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, fetchMock, loaded = new Map()) {
  const abs = path.resolve(file);
  if (loaded.has(abs)) return loaded.get(abs);
  const exports = {};
  loaded.set(abs, exports);
  const requireLocal = (name) => name === 'next/server'
    ? { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } }
    : name.startsWith('node:') || (!name.startsWith('.') && !name.startsWith('@/')) ? require(name)
    : load(name.startsWith('@/') ? name.slice(2) + '.ts' : path.resolve(path.dirname(abs), name + '.ts'), fetchMock, loaded);
  const { outputText } = ts.transpileModule(fs.readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  vm.runInNewContext(outputText, { exports, require: requireLocal, fetch: fetchMock, URL, URLSearchParams, AbortSignal, AbortController, Date, Map, Math, Number, String, Array, Object, JSON, Promise, Error, RegExp, Set, Infinity, setTimeout }, { filename: abs });
  return exports;
}

const polygon = { type: 'Polygon', coordinates: [[[-105, 40], [-104.999, 40], [-104.999, 40.001], [-105, 40.001], [-105, 40]]] };
const parcelSourceResult = (options, geometry = polygon) => {
  const id = Number(new URLSearchParams(String(options.body)).get('objectIds'));
  return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', id, geometry, properties: { OBJECTID: id } }] }) };
};

test('parcel geometry keeps holes and separate islands and measures point distance from boundary', () => {
  const { validParcelGeometry, esriParcelGeometry, pointInParcel, pointToParcelMeters } = load('app/land-intelligence/parcel-inspection.ts');
  const multi = { type: 'MultiPolygon', coordinates: [
    [[[-105, 40], [-104.99, 40], [-104.99, 40.01], [-105, 40.01], [-105, 40]], [[-104.997, 40.003], [-104.993, 40.003], [-104.993, 40.007], [-104.997, 40.007], [-104.997, 40.003]]],
    [[[-104.98, 40], [-104.97, 40], [-104.97, 40.01], [-104.98, 40.01], [-104.98, 40]]],
  ] };
  assert.equal(validParcelGeometry(multi), true);
  assert.equal(pointInParcel([-104.995, 40.005], multi), false, 'hole is outside');
  assert.equal(pointInParcel([-104.975, 40.005], multi), true, 'second island is inside');
  assert.equal(pointToParcelMeters([-104.975, 40.005], multi), 0);
  assert.ok(pointToParcelMeters([-104.965, 40.005], multi) > 100);
  const esri = esriParcelGeometry(multi);
  assert.equal(esri.rings.length, 3);
  const signed = (ring) => ring.slice(0, -1).reduce((sum, p, i) => sum + p[0] * ring[i + 1][1] - ring[i + 1][0] * p[1], 0);
  assert.ok(signed(esri.rings[0]) < 0, 'exterior is clockwise for ArcGIS');
  assert.ok(signed(esri.rings[1]) > 0, 'hole is counterclockwise for ArcGIS');
  assert.equal(validParcelGeometry({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1]]] }), false);
});

test('parcel API queries polygon sources, distinguishes unavailable and unknown coverage, and returns map geometry', async () => {
  const calls = [];
  const fetchMock = async (url, options = {}) => {
    calls.push({ url: String(url), body: String(options.body ?? '') });
    if (String(url).includes('Colorado_Public_Parcels')) return parcelSourceResult(options);
    if (String(url).includes('geodesy.noaa.gov/api/nde/bounds')) return { ok: true, text: async () => '[]' };
    if (String(url).includes('api.waterdata.usgs.gov/ogcapi')) return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [] }) };
    if (String(url).includes('mrdata.usgs.gov/services/wfs/usmin')) return { ok: true, text: async () => '<gml:FeatureCollection />' };
    if (String(url).includes('cg_soils')) throw new Error('soil service down');
    const features = String(url).includes('NFHL/MapServer/28') ? [{ type: 'Feature', geometry: polygon, properties: { OBJECTID: 7, FLD_ZONE: 'AE' } }]
      : String(url).includes('Facilities/MapServer/0') ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-104.9985, 40.0005] }, properties: { OBJECTID: 9, REGISTRY_ID: 'EPA-9', FAC_NAME: 'Test facility' } }]
      : [];
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features }) };
  };
  const { POST } = load('app/api/land-intelligence/parcel-inspection/route.ts', fetchMock);
  const bad = await POST({ json: async () => ({ parcelKey: 'co:7', geometry: { type: 'Point', coordinates: [-105, 40] } }) });
  assert.equal(bad.status, 400);
  assert.equal(calls.length, 0);
  const result = await POST({ json: async () => ({ parcelKey: 'co:7', geometry: polygon }) });
  assert.equal(result.status, 200);
  assert.equal(result.body.groups.find((group) => group.id === 'flood').status, 'found');
  assert.equal(result.body.groups.find((group) => group.id === 'flood').findings[0].geometry.type, 'Polygon');
  assert.equal(result.body.groups.find((group) => group.id === 'wetlands').status, 'coverage_unknown');
  assert.equal(result.body.groups.find((group) => group.id === 'soils').status, 'source_error');
  assert.equal(result.body.groups.find((group) => group.id === 'facilities').findings[0].relationship, 'nearby');
  assert.equal(result.body.groups.find((group) => group.id === 'wet-utilities').status, 'not_queried');
  assert.equal(result.body.groups.find((group) => group.id === 'dry-utilities').status, 'not_queried');
  assert.equal(result.body.groups.find((group) => group.id === 'denver-storm').status, 'outside_coverage');
  const floodCall = calls.find((call) => call.url.includes('NFHL/MapServer/28'));
  const query = new URLSearchParams(floodCall.body);
  assert.equal(query.get('geometryType'), 'esriGeometryPolygon');
  assert.equal(query.get('returnGeometry'), 'true');
  assert.equal(query.get('f'), 'geojson');
  assert.ok(JSON.parse(query.get('geometry')).rings.length);
});

test('complete parcel results are reused briefly, while a single failed karst layer stays partial', async () => {
  let calls = 0;
  let failOneKarst = false;
  const fetchMock = async (url, options = {}) => {
    calls++;
    if (String(url).includes('Colorado_Public_Parcels')) return parcelSourceResult(options);
    if (String(url).includes('geodesy.noaa.gov/api/nde/bounds')) return { ok: true, text: async () => '[]' };
    if (String(url).includes('api.waterdata.usgs.gov/ogcapi')) return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [] }) };
    if (String(url).includes('mrdata.usgs.gov/services/wfs/usmin')) return { ok: true, text: async () => '<gml:FeatureCollection />' };
    if (failOneKarst && String(url).includes('CONUS_Karst/FeatureServer/1/query')) throw new Error('temporary failure');
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [] }) };
  };
  const { POST } = load('app/api/land-intelligence/parcel-inspection/route.ts', fetchMock);
  const request = () => ({ json: async () => ({ parcelKey: 'co:9', geometry: polygon }) });
  const first = await POST(request());
  assert.equal(first.body.groups.find((group) => group.id === 'karst').status, 'no_features');
  const firstCalls = calls;
  const second = await POST(request());
  assert.equal(second.body.checkedAt, first.body.checkedAt);
  assert.equal(calls, firstCalls, 'cached inspection avoids another provider batch');
  failOneKarst = true;
  const changed = await POST({ json: async () => ({ parcelKey: 'co:10', geometry: polygon }) });
  assert.equal(changed.body.groups.find((group) => group.id === 'karst').status, 'partial');
});

test('Phase 2 survey marks and groundwater wells use parcel boundary distance and source details', async () => {
  const calls = [];
  const fetchMock = async (url, options = {}) => {
    calls.push(String(url));
    if (String(url).includes('Colorado_Public_Parcels')) return parcelSourceResult(options);
    if (String(url).includes('geodesy.noaa.gov')) return { ok: true, text: async () => JSON.stringify([
      { pid: 'AA1234', name: 'Benchmark A', lat: '40.0005', lon: '-104.9995', orthoHt: '1650', vertDatum: 'NAVD 88' },
      { pid: 'BB1234', name: 'Distant mark', lat: '40.0005', lon: '-104.98' },
    ]) };
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-104.998, 40.0005] }, properties: { monitoring_location_number: '01234567', monitoring_location_name: 'Observation well', site_type: 'Groundwater', well_constructed_depth: 120, horizontal_positional_accuracy: 'accurate' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-104.98, 40.0005] }, properties: { monitoring_location_number: '87654321' } },
    ] }) };
  };
  const { surveyControlGroup, groundwaterSitesGroup } = load('app/api/land-intelligence/parcel-inspection/phase2.ts', fetchMock);
  const [marks, wells] = await Promise.all([surveyControlGroup(polygon), groundwaterSitesGroup(polygon)]);
  assert.equal(marks.status, 'found');
  assert.equal(marks.findings.length, 1);
  assert.equal(marks.findings[0].relationship, 'inside');
  assert.match(marks.findings[0].recordUrl, /PidBox=AA1234/);
  assert.equal(wells.status, 'found');
  assert.equal(wells.findings.length, 1);
  assert.equal(wells.findings[0].relationship, 'nearby');
  assert.match(wells.findings[0].detail, /120 ft/);
  assert.match(wells.findings[0].recordUrl, /01234567/);
  const waterUrl = new URL(calls.find((url) => url.includes('api.waterdata.usgs.gov')));
  assert.equal(waterUrl.searchParams.get('site_type_code'), 'GW');
  assert.equal(waterUrl.searchParams.get('limit'), '100');
});

test('Phase 2 providers distinguish truncation from an unavailable source', async () => {
  const fetchMock = async (url, options = {}) => {
    if (String(url).includes('Colorado_Public_Parcels')) return parcelSourceResult(options);
    if (String(url).includes('geodesy.noaa.gov')) throw new Error('service down');
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [], numberMatched: 125, links: [{ rel: 'next' }] }) };
  };
  const { surveyControlGroup, groundwaterSitesGroup } = load('app/api/land-intelligence/parcel-inspection/phase2.ts', fetchMock);
  assert.equal((await surveyControlGroup(polygon)).status, 'source_error');
  assert.equal((await groundwaterSitesGroup(polygon)).status, 'partial');
});

test('Phase 2 EPA Superfund boundaries are queried against the selected parcel polygon', async () => {
  const calls = [];
  const fetchMock = async (url, options = {}) => {
    calls.push({ url: String(url), body: String(options.body ?? '') });
    if (String(url).includes('Colorado_Public_Parcels')) return parcelSourceResult(options);
    if (String(url).includes('geodesy.noaa.gov')) return { ok: true, text: async () => '[]' };
    if (String(url).includes('mrdata.usgs.gov')) return { ok: true, text: async () => '<gml:FeatureCollection />' };
    const features = String(url).includes('NEPAVELayersPublic_fgdb/MapServer/14') ? [{ type: 'Feature', geometry: polygon, properties: { OBJECTID: 4, EPA_ID: 'CO123456789', Site_Name: 'Example Site', NPL_Status: 'Final', FACILITY_URL: 'https://www.epa.gov/superfund/example-site' } }] : [];
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features }) };
  };
  const { POST } = load('app/api/land-intelligence/parcel-inspection/route.ts', fetchMock);
  const result = await POST({ json: async () => ({ parcelKey: 'co:11', geometry: polygon }) });
  const group = result.body.groups.find((item) => item.id === 'superfund');
  assert.equal(group.status, 'found');
  assert.equal(group.findings[0].name, 'Example Site');
  assert.equal(group.findings[0].geometry.type, 'Polygon');
  assert.match(group.findings[0].recordUrl, /epa.gov/);
  const query = new URLSearchParams(calls.find((call) => call.url.includes('NEPAVELayersPublic_fgdb/MapServer/14')).body);
  assert.equal(query.get('geometryType'), 'esriGeometryPolygon');
  assert.match(query.get('outFields'), /Site_Name/);
});

test('Phase 3 screens Denver storm mains by coverage and retains line geometry', async () => {
  const calls = [];
  const line = { type: 'LineString', coordinates: [[-105.001, 39.75], [-104.999, 39.75]] };
  const fetchMock = async (url, options = {}) => {
    calls.push({ url: String(url), body: String(options.body ?? '') });
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: line, properties: { OBJECTID: 12, assetid: 'STM-12', material: 'RCP', ownedby: 'DPUB' } }] }) };
  };
  const { denverStormGroup } = load('app/api/land-intelligence/parcel-inspection/phase3.ts', fetchMock);
  const denverParcel = { type: 'Polygon', coordinates: [[[-105.002, 39.749], [-104.998, 39.749], [-104.998, 39.751], [-105.002, 39.751], [-105.002, 39.749]]] };
  assert.equal((await denverStormGroup(polygon, 'co:7')).status, 'outside_coverage');
  assert.equal(calls.length, 0);
  const result = await denverStormGroup(denverParcel, 'co:7');
  assert.equal(result.status, 'found');
  assert.equal(result.findings[0].relationship, 'intersects');
  assert.equal(result.findings[0].geometry.type, 'LineString');
  assert.match(result.findings[0].detail, /RCP/);
  const query = new URLSearchParams(calls[0].body);
  assert.equal(query.get('geometryType'), 'esriGeometryPolygon');
});

test('Phase 3 tank facilities and Florida subsidence reports use boundary distance and honest source states', async () => {
  const calls = [];
  const fetchMock = async (url, options = {}) => {
    calls.push({ url: String(url), body: String(options.body ?? '') });
    const features = String(url).includes('Regulated_Storage_Tank') ? [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-104.9985, 40.0005] }, properties: { OBJECTID: 1, Facility_ID: 89, Facility_Name: 'Fuel shop', Facility_Category: 'Retail', Number_of_Active_Tanks: 2, Release_Number: 'R1' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-104.98, 40.0005] }, properties: { OBJECTID: 2, Facility_ID: 90 } },
    ] : [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-104.9985, 40.0005] }, properties: { OBJECTID: 4, REF_NUM: 'FGS-4', TRUE_SINK: 'U', EVENT_DATE: 1609459200000 } },
    ];
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features }) };
  };
  const { coloradoTankGroup, floridaSubsidenceGroup, unqueriedUtilityGroups } = load('app/api/land-intelligence/parcel-inspection/phase3.ts', fetchMock);
  assert.equal((await coloradoTankGroup(polygon, 'fl:7')).status, 'outside_coverage');
  assert.equal((await floridaSubsidenceGroup(polygon, 'co:7')).status, 'outside_coverage');
  assert.equal(calls.length, 0);
  const tanks = await coloradoTankGroup(polygon, 'co:7');
  assert.equal(tanks.status, 'found');
  assert.equal(tanks.findings.length, 1);
  assert.equal(tanks.findings[0].relationship, 'nearby');
  assert.match(tanks.findings[0].detail, /2 reported active tanks/);
  const reports = await floridaSubsidenceGroup(polygon, 'fl:7');
  assert.equal(reports.status, 'found');
  assert.equal(reports.findings[0].recordDate, '2021-01-01');
  assert.match(reports.findings[0].detail, /Cause unverified/);
  assert.ok(calls.every((call) => new URLSearchParams(call.body).get('distance') === '500'));
  assert.deepEqual(Array.from(unqueriedUtilityGroups(), (group) => group.status), ['not_queried', 'not_queried']);
});

test('parcel measurements include holes and separate polygons, while mapped line length excludes holes', () => {
  const { parcelMetrics, lineInsideParcelMeters } = load('app/land-intelligence/parcel-analysis.ts');
  const { areaSquareMeters, lengthMeters } = load('app/land-intelligence/geometry.ts');
  const outer = [[-105, 40], [-104.997, 40], [-104.997, 40.003], [-105, 40.003], [-105, 40]];
  const hole = [[-104.999, 40.001], [-104.998, 40.001], [-104.998, 40.002], [-104.999, 40.002], [-104.999, 40.001]];
  const island = [[-104.995, 40], [-104.994, 40], [-104.994, 40.001], [-104.995, 40.001], [-104.995, 40]];
  const parcel = { type: 'MultiPolygon', coordinates: [[outer, hole], [island]] };
  const metrics = parcelMetrics(parcel);
  assert.ok(Math.abs(metrics.areaMeters2 - (areaSquareMeters(outer) - areaSquareMeters(hole) + areaSquareMeters(island))) < 0.01);
  assert.ok(Math.abs(metrics.perimeterMeters - (lengthMeters(outer) + lengthMeters(hole) + lengthMeters(island))) < 0.01);
  const line = { type: 'LineString', coordinates: [[-105.001, 40.0015], [-104.996, 40.0015]] };
  const inside = lineInsideParcelMeters(line, parcel);
  assert.ok(inside > 160 && inside < 180, `expected outer minus hole, got ${inside}`);
  const multi = { type: 'MultiLineString', coordinates: [line.coordinates, [[-104.996, 40.0005], [-104.993, 40.0005]]] };
  assert.ok(lineInsideParcelMeters(multi, parcel) > inside);
});

test('printable parcel report escapes source fields and preserves unavailable and unqueried status', () => {
  const { parcelReportHtml } = load('app/land-intelligence/export-parcel-report.ts');
  const report = { parcelKey: 'co:1', checkedAt: '2026-10-24T12:00:00.000Z', groups: [
    { id: 'flood', label: 'Flood mapping', source: 'FEMA', sourceUrl: 'https://example.org/flood', status: 'unavailable', note: 'Provider did not respond', findings: [] },
    { id: 'wet-utilities', label: 'Water and sanitary sewer lines', source: 'Utility owner', sourceUrl: 'https://example.org/utility', status: 'not_queried', note: 'Owner records needed', findings: [] },
    { id: 'roads', label: 'Roads', source: 'Road agency', sourceUrl: 'https://example.org/roads', status: 'found', note: 'Mapped lines only', findings: [{ id: 'road-1', name: '<script>alert(1)</script>', detail: 'Test road', relationship: 'intersects', distanceMeters: null, sourceId: 'roads', sourceRecordId: 'R1', recordUrl: 'https://example.org/road?id="bad', recordDate: '2025', geometry: { type: 'LineString', coordinates: [[-105.001, 40.0005], [-104.998, 40.0005]] } }] },
  ] };
  const html = parcelReportHtml(report, polygon, { name: '<Parcel>', id: 'A"B', locality: 'Boulder, CO', sourceUrl: 'https://example.org/parcel' });
  assert.match(html, /&lt;Parcel&gt;/);
  assert.match(html, /&quot;bad/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /not queried/);
  assert.match(html, /unavailable/);
  assert.match(html, /approximately [\d,.]+ m falls inside/);
  assert.match(html, /not survey measurements/);
});

test('discipline drilldown assigns every parcel source exactly once', () => {
  const { PARCEL_DISCIPLINES, parcelDisciplineSummary } = load('app/land-intelligence/parcel-analysis.ts');
  const { PARCEL_INSPECTION_GROUPS } = load('app/land-intelligence/parcel-inspection.ts');
  assert.equal(PARCEL_DISCIPLINES.length, 12, 'all twelve subject areas must be visible');
  assert.equal(new Set(PARCEL_DISCIPLINES.map((discipline) => discipline.icon)).size, 12, 'each area has a distinct semantic icon');
  const assigned = PARCEL_DISCIPLINES.flatMap((discipline) => discipline.groups);
  assert.deepEqual([...new Set(assigned)].sort(), [...PARCEL_INSPECTION_GROUPS.map((group) => group.id)].sort());
  assert.equal(assigned.length, PARCEL_INSPECTION_GROUPS.length, 'a source must not appear in two disciplines');
  const summary = parcelDisciplineSummary({ parcelKey: 'co:1', checkedAt: '2026-10-24T12:00:00Z', groups: [
    { id: 'wetlands', label: 'Wetlands', source: 'NWI', sourceUrl: '', status: 'coverage_unknown', note: '', findings: [] },
    { id: 'facilities', label: 'Facilities', source: 'EPA', sourceUrl: '', status: 'found', note: '', findings: [{ id: 'a' }] },
  ] });
  assert.equal(summary.find((discipline) => discipline.id === 'ecology').unknown, 1);
  assert.equal(summary.find((discipline) => discipline.id === 'commercial').findings, 1);
});

test('combined observations require two complete intersecting sources and cite both records', () => {
  const { crossSourceObservations } = load('app/land-intelligence/parcel-analysis.ts');
  const item = (id, status, relationship) => ({ id, label: id, source: id.toUpperCase(), sourceUrl: `https://agency.gov/${id}`, status, note: '', findings: [{ id: `${id}:1`, name: id, sourceRecordId: '1', recordUrl: `https://agency.gov/${id}/1`, relationship }] });
  const report = (groups) => ({ parcelKey: 'co:1', checkedAt: '2026-10-25T12:00:00Z', groups });
  const observations = crossSourceObservations(report([item('flood', 'found', 'intersects'), item('wetlands', 'found', 'intersects')]));
  assert.equal(observations.length, 1);
  assert.equal(JSON.stringify(observations[0].sources.map((source) => source.url)), JSON.stringify(['https://agency.gov/flood/1', 'https://agency.gov/wetlands/1']));
  assert.equal(crossSourceObservations(report([item('flood', 'partial', 'intersects'), item('wetlands', 'found', 'intersects')])).length, 0);
  assert.equal(crossSourceObservations(report([item('flood', 'found', 'nearby'), item('wetlands', 'found', 'intersects')])).length, 0);
});
test('road proximity uses the actual line rather than only its bounding box', () => {
  const { pointToRoadMeters, linesNearMeters } = load('app/land-intelligence/road-segment.ts');
  const road = { type: 'LineString', coordinates: [[-105, 40], [-104.99, 40]] };
  assert.ok(pointToRoadMeters([-104.995, 40.0002], road) < 30);
  assert.ok(pointToRoadMeters([-104.995, 40.01], road) > 1000);
  assert.equal(linesNearMeters(road, { type: 'LineString', coordinates: [[-104.995, 39.999], [-104.995, 40.001]] }), 0);
  assert.ok(linesNearMeters(road, { type: 'LineString', coordinates: [[-104.995, 40.01], [-104.994, 40.01]] }) > 1000);
});

test('road segment links CDOT attributes, nearby fatal crashes, and active alerts with separate source states', async () => {
  const road = { type: 'LineString', coordinates: [[-105, 40], [-104.99, 40]] };
  const fetchMock = async (url, options = {}) => {
    const target = String(url);
    const features = target.includes('HighwaySegments') ? [{ type: 'Feature', geometry: road, properties: { OBJECTID: 7, ROUTE: 'US-6', AADT: 12000, AADTYR: '2025', SPEEDLIM: 45, PRISURF: 'Asphalt', THRULNQTY: 2 } }]
      : target.includes('Fatality_Analysis') ? [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-104.995, 40.0002] }, properties: { OBJECTID: 8, ST_CASE: 9, YEAR: 2024, MONTH: 5, DAY: 1, FATALS: 1 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-104.995, 40.01] }, properties: { OBJECTID: 10, ST_CASE: 10, YEAR: 2024, FATALS: 2 } },
      ] : [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[-104.995, 39.999], [-104.995, 40.001]] }, properties: { objectid: 11, alertid: 'A11', type: 'Closure', title: 'Lane closed', lastupdateddate: 1792800000000 } }];
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features }) };
  };
  const { GET } = load('app/api/land-intelligence/road-segment/route.ts', fetchMock);
  const invalid = await GET({ nextUrl: new URL('http://localhost/api/land-intelligence/road-segment?id=7%20OR%201=1'), signal: new AbortController().signal });
  assert.equal(invalid.status, 400);
  const result = await GET({ nextUrl: new URL('http://localhost/api/land-intelligence/road-segment?id=7'), signal: new AbortController().signal });
  assert.equal(result.status, 200);
  assert.equal(result.body.road.surface, 'Asphalt');
  assert.equal(result.body.crashes.status, 'found');
  assert.equal(result.body.crashes.items.length, 1);
  assert.match(result.body.crashes.items[0].recordUrl, /objectIds=8/);
  assert.equal(result.body.alerts.status, 'found');
  assert.equal(result.body.alerts.items[0].title, 'Lane closed');
  assert.match(result.body.conditionsUrl, /cotrip/);
});

test('road segment reports an alert outage separately from an empty crash result', async () => {
  const fetchMock = async (url, options = {}) => {
    if (String(url).includes('CoTrip_Alerts')) throw new Error('alerts unavailable');
    const features = String(url).includes('HighwaySegments') ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[-105, 40], [-104.99, 40]] }, properties: { OBJECTID: 8, ROUTE: 'US-6' } }] : [];
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features }) };
  };
  const { GET } = load('app/api/land-intelligence/road-segment/route.ts', fetchMock);
  const result = await GET({ nextUrl: new URL('http://localhost/api/land-intelligence/road-segment?id=8'), signal: new AbortController().signal });
  assert.equal(result.status, 200);
  assert.equal(result.body.crashes.status, 'none');
  assert.equal(result.body.alerts.status, 'unavailable');
});

test('map identify retains the CDOT segment ID for interactive road details', async () => {
  const fetchMock = async (_url, options) => {
    const params = new URLSearchParams(String(options.body));
    assert.match(params.get('outFields'), /OBJECTID/);
    return { ok: true, json: async () => ({ features: [{ attributes: { OBJECTID: 33, ROUTE: 'US-6', SPEEDLIM: 45 } }] }) };
  };
  const { POST } = load('app/api/land-intelligence/identify/route.ts', fetchMock);
  const response = await POST({ json: async () => ({ lng: -105, lat: 40, layers: ['roads'] }) });
  assert.equal(response.status, 200);
  assert.equal(response.body.results[0].features[0].OBJECTID, 33);
});

test('inspection ignores a forged client polygon and verifies the source OBJECTID', async () => {
  const other = { type: 'Polygon', coordinates: [[[-104.9, 40], [-104.899, 40], [-104.899, 40.001], [-104.9, 40.001], [-104.9, 40]]] };
  const calls = [];
  const fetchMock = async (url, options = {}) => {
    calls.push({ url: String(url), body: String(options.body ?? '') });
    if (String(url).includes('Colorado_Public_Parcels')) return parcelSourceResult(options);
    if (String(url).includes('geodesy.noaa.gov')) return { ok: true, text: async () => '[]' };
    if (String(url).includes('mrdata.usgs.gov')) return { ok: true, text: async () => '<gml:FeatureCollection />' };
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [] }) };
  };
  const { POST } = load('app/api/land-intelligence/parcel-inspection/route.ts', fetchMock);
  const result = await POST({ json: async () => ({ parcelKey: 'co:123', geometry: other }) });
  assert.equal(result.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(result.body.geometry)), polygon);
  const request = new URLSearchParams(calls.find((call) => call.url.includes('NFHL/MapServer/28')).body);
  assert.match(request.get('geometry'), /-105/);
  assert.equal(JSON.parse(request.get('geometry')).rings[0].some((point) => point[0] === -104.9), false);
});

test('missing authoritative parcel stops the inspection before provider calls', async () => {
  const calls = [];
  const { POST } = load('app/api/land-intelligence/parcel-inspection/route.ts', async (url) => {
    calls.push(String(url));
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [] }) };
  });
  const result = await POST({ json: async () => ({ parcelKey: 'co:456' }) });
  assert.equal(result.status, 404);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /Colorado_Public_Parcels/);
});

test('spatial matcher rejects adjacent polygons, parcel holes and boundary-only lines', () => {
  const { spatialRelation } = load('app/api/land-intelligence/parcel-inspection/spatial-match.ts');
  const adjacent = { type: 'Polygon', coordinates: [[[-104.999, 40], [-104.998, 40], [-104.998, 40.001], [-104.999, 40.001], [-104.999, 40]]] };
  const boundary = { type: 'LineString', coordinates: [[-105, 40], [-104.999, 40]] };
  const crossing = { type: 'LineString', coordinates: [[-105.0005, 40.0005], [-104.9985, 40.0005]] };
  assert.equal(spatialRelation(adjacent, polygon), null);
  assert.equal(spatialRelation(boundary, polygon), null);
  assert.equal(spatialRelation(crossing, polygon).relationship, 'intersects');
  assert.equal(spatialRelation(polygon, polygon).relationship, 'intersects');
  const withHole = { type: 'Polygon', coordinates: [polygon.coordinates[0], [[-104.9998, 40.0002], [-104.9992, 40.0002], [-104.9992, 40.0008], [-104.9998, 40.0008], [-104.9998, 40.0002]]] };
  const inHole = { type: 'Polygon', coordinates: [[[-104.9997, 40.0003], [-104.9993, 40.0003], [-104.9993, 40.0007], [-104.9997, 40.0007], [-104.9997, 40.0003]]] };
  assert.equal(spatialRelation(inHole, withHole), null);
  const { validParcelGeometry } = load('app/land-intelligence/parcel-inspection.ts');
  const bowtie = { type: 'Polygon', coordinates: [[[-105, 40], [-104.999, 40.001], [-105, 40.001], [-104.999, 40], [-105, 40]]] };
  assert.equal(validParcelGeometry(bowtie), false);
});

test('ArcGIS parcel screening pages complete results and drops unrelated returned points', async () => {
  const calls = [];
  const fetchMock = async (_url, options) => {
    const offset = Number(new URLSearchParams(String(options.body)).get('resultOffset'));
    calls.push(offset);
    const ids = offset === 0 ? Array.from({ length: 40 }, (_, i) => i + 1) : [41, 42];
    const features = ids.map((id) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [-104.9995, 40.0005] }, properties: { OBJECTID: id } }));
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [-104.5, 40] }, properties: { OBJECTID: offset + 500 } });
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features }) };
  };
  const { arcgisFeatures } = load('app/api/land-intelligence/parcel-inspection/arcgis-query.ts', fetchMock);
  const result = await arcgisFeatures('https://example.org/FeatureServer/0', polygon, 'OBJECTID');
  assert.equal(result.features.length, 42);
  assert.deepEqual(calls, [0, 40]);
  assert.equal(result.capped, false);
  assert.equal(result.rejected, 2);
});
test('simultaneous inspections share one source lookup and provider batch', async () => {
  const calls = [];
  const fetchMock = async (url, options = {}) => {
    calls.push(String(url));
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (String(url).includes('Colorado_Public_Parcels')) return parcelSourceResult(options);
    if (String(url).includes('geodesy.noaa.gov')) return { ok: true, text: async () => '[]' };
    if (String(url).includes('mrdata.usgs.gov')) return { ok: true, text: async () => '<gml:FeatureCollection />' };
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [] }) };
  };
  const { POST } = load('app/api/land-intelligence/parcel-inspection/route.ts', fetchMock);
  const request = () => ({ json: async () => ({ parcelKey: 'co:321' }) });
  const [a, b] = await Promise.all([POST(request()), POST(request())]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.body.checkedAt, b.body.checkedAt);
  assert.equal(calls.filter((url) => url.includes('Colorado_Public_Parcels')).length, 1);
  assert.equal(calls.filter((url) => url.includes('NFHL')).length, 1);
});
test('printable property section keeps Boulder account provenance and escapes county fields', () => {
  const { parcelReportHtml } = load('app/land-intelligence/export-parcel-report.ts');
  const account = { accountNo: 'R12', accountType: 'Residential', landUses: ['Residential'], values: { taxYear: '2026', actualTotal: 500000, assessedTotal: 34000 }, buildings: [{ design: 'House', buildingNumber: '1', yearBuilt: 1980, mainFloorSqft: 1200 }], sales: [{ date: '2025-01-02', price: 450000, reception: '<img src=x>', qualification: 'Q' }], permits: [{ date: '2024-03-04', number: 'P-123', category: 'REMODEL', description: 'Kitchen', issuedBy: 'County' }] };
  const detail = { parcel: { address: 'Example Street', landUse: 'Residential', zoning: '', received: '2026-10-24', recordUrl: 'https://example.org/parcel', sourceUrl: 'https://example.org/source' }, assessedTotal: 34000, valueYear: '2026', legalDescription: '', boulder: { status: 'ready', property: { folio: '123', updatedAt: '2026-10-24', sourceDate: '2026-10-24', sourceUrl: 'https://example.org/county', accounts: [account] } } };
  const report = { parcelKey: 'co:1', checkedAt: '2026-10-24T12:00:00Z', groups: [] };
  const html = parcelReportHtml(report, polygon, { name: 'Example parcel', id: '123', locality: 'Boulder', sourceUrl: 'https://example.org/parcel' }, detail);
  assert.ok(html.indexOf('Property record and site context') < html.indexOf('Map measurements'));
  assert.match(html, /Tax year: 2026/);
  assert.match(html, /reception &lt;img src=x&gt;/);
  assert.match(html, /category REMODEL/);
  assert.doesNotMatch(html, /<img src=x>/);
});
test('parcel headline keeps owner, deed price and assessor value distinct across shared accounts', () => {
  const { parcelHeadline } = load('app/land-intelligence/parcel-headline.ts');
  const one = parcelHeadline({ owners: ['STATE OWNER'], sales: [{ date: '2020-01-01', price: 150000 }], assessedTotal: 200000, estimatedMarketValue: null, boulder: { status: 'ready', property: { accounts: [{ accountNo: 'A1', linkedParcelCount: 1, owners: ['COUNTY OWNER'], sales: [{ date: '2024-01-01', price: 300000 }], values: { actualTotal: 400000 } }] } } });
  assert.equal(one.owner, 'COUNTY OWNER');
  assert.equal(one.price, 300000);
  assert.equal(one.value, 400000);
  assert.match(one.priceNote, /non-market/);
  const shared = parcelHeadline({ owners: ['STATE OWNER'], sales: [{ date: '2022-01-01', price: 175000 }], assessedTotal: 250000, estimatedMarketValue: null, boulder: { status: 'ready', property: { accounts: [{ accountNo: 'A1', linkedParcelCount: 2, owners: ['ACCOUNT OWNER'], sales: [{ date: '2024-01-01', price: 900000 }], values: { actualTotal: 900000 } }, { accountNo: 'A2', linkedParcelCount: 1, owners: ['OTHER OWNER'], sales: [], values: { actualTotal: 100000 } }] } } });
  assert.equal(shared.owner, 'STATE OWNER');
  assert.equal(shared.price, 175000, 'shared account deed price must not override the parcel sale field');
  assert.equal(shared.value, 250000, 'linked account values must not be summed into a parcel value');
});
test('Colorado local roads and bridge points keep parcel relation, state gate and outages distinct', async () => {
  const calls = [];
  const crossing = { type: 'LineString', coordinates: [[-105.001, 40.0005], [-104.998, 40.0005]] };
  const neighbor = { type: 'LineString', coordinates: [[-104.98, 40.0005], [-104.97, 40.0005]] };
  const fetchMock = async (url) => {
    calls.push(String(url));
    const road = String(url).includes('/14/query');
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: road ? [
      { type: 'Feature', geometry: crossing, properties: { OBJECTID: 11, ROUTENAME: 'County Road', SURFNAME: 'Gravel', AADT: 250, AADTYR: '2025' } },
      { type: 'Feature', geometry: neighbor, properties: { OBJECTID: 12, ROUTENAME: 'Neighbor Road' } },
    ] : [
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-104.999, 40.0005] }, properties: { OBJECTID: 21, STRID: 'B-21', STRUCTURE_TYPE: 'Bridge', YEARBUILT: '1985' } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-104.97, 40.0005] }, properties: { OBJECTID: 22, STRID: 'B-22' } },
    ] }) };
  };
  const { coloradoLocalRoadGroup, coloradoBridgeGroup } = load('app/api/land-intelligence/parcel-inspection/colorado-transport.ts', fetchMock);
  assert.equal((await coloradoLocalRoadGroup(polygon, 'ut:1')).status, 'outside_coverage');
  assert.equal((await coloradoBridgeGroup(polygon, 'ut:1')).status, 'outside_coverage');
  assert.equal(calls.length, 0);
  const roads = await coloradoLocalRoadGroup(polygon, 'co:1');
  const bridges = await coloradoBridgeGroup(polygon, 'co:1');
  assert.equal(roads.status, 'found');
  assert.equal(roads.findings.length, 1);
  assert.equal(roads.findings[0].relationship, 'intersects');
  assert.match(roads.findings[0].note ?? roads.note, /legal/);
  assert.equal(bridges.status, 'found');
  assert.equal(bridges.findings.length, 1);
  assert.equal(bridges.findings[0].relationship, 'inside');
  assert.match(bridges.findings[0].recordUrl, /\/query\?/);
  const failed = load('app/api/land-intelligence/parcel-inspection/colorado-transport.ts', async () => { throw new Error('offline'); });
  assert.equal((await failed.coloradoLocalRoadGroup(polygon, 'co:1')).status, 'source_error');
});