// Underground screening: USGS USMIN mines (symbols and mapped areas), DRMS undermined areas, CGS mine openings, and the map layer.
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
    // polygon-clipping checks for arrays from its own realm, so hand it plain copies of the vm's arrays.
    : name === 'polygon-clipping' ? (() => { const pc = require(name); const wrap = (fn) => (...args) => fn(...JSON.parse(JSON.stringify(args))); const api = { intersection: wrap(pc.intersection), union: wrap(pc.union), difference: wrap(pc.difference), xor: wrap(pc.xor) }; return { ...api, default: api, __esModule: true }; })()
    : name.startsWith('@/') || name.startsWith('.') ? load(name.startsWith('@/') ? name.slice(2) + '.ts' : path.resolve(path.dirname(abs), name) + '.ts', fetchMock) : require(name);
  const { outputText } = ts.transpileModule(fs.readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(outputText, { exports, require: requireLocal, fetch: fetchMock, process: { env: {}, cwd: () => process.cwd() }, URL, URLSearchParams, AbortSignal, Date, Map, Set, Math, Number, String, Array, Object, JSON, Promise, Error, Buffer }, { filename: abs });
  return exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const parcel = { type: 'Polygon', coordinates: [[[-105.513, 39.801], [-105.512, 39.801], [-105.512, 39.802], [-105.513, 39.802], [-105.513, 39.801]]] };
// USMIN WFS 1.1 GML: latitude first.
const gmlPoint = (id, lat, lng, type, name = '') => `<gml:featureMember><ms:points gml:id="${id}"><gml:pos>${lat} ${lng}</gml:pos><ms:ftr_type>${type}</ms:ftr_type>${name ? `<ms:ftr_name>${name}</ms:ftr_name>` : ''}<ms:topo_name>Central City</ms:topo_name><ms:topo_date>1972</ms:topo_date><ms:topo_scale>24000</ms:topo_scale></ms:points></gml:featureMember>`;
const gmlArea = (id, ring, type) => `<gml:featureMember><ms:polygons gml:id="${id}"><gml:posList>${ring.map(([lng, lat]) => `${lat} ${lng}`).join(' ')}</gml:posList><ms:ftr_type>${type}</ms:ftr_type></ms:polygons></gml:featureMember>`;
const wfs = (members) => ({ ok: true, status: 200, text: async () => `<?xml version="1.0"?><wfs:FeatureCollection>${members}</wfs:FeatureCollection>` });

test('USMIN mines: symbols and mapped areas within 500 m, nearest first; far ones dropped', async () => {
  const mock = async (url) => String(url).includes('typeName=points')
    ? wfs(gmlPoint('p1', 39.8045, -105.5125, 'Mine Shaft') + gmlPoint('p2', 39.8016, -105.5130, 'Adit', 'Gregory') + gmlPoint('p3', 39.83, -105.5125, 'Prospect Pit'))
    : wfs(gmlArea('a1', [[-105.5126, 39.8014], [-105.5124, 39.8014], [-105.5124, 39.8016], [-105.5126, 39.8016]], 'Mine Dump'));
  const { mineGroup } = load('app/api/land-intelligence/parcel-inspection/underground.ts', mock);
  const group = plain(await mineGroup(parcel));
  assert.equal(group.status, 'found');
  assert.deepEqual(group.findings.map((f) => f.name), ['Gregory (adit)', 'Mine Dump', 'Mine Shaft'], 'the ~3 km prospect pit is outside 500 m');
  assert.deepEqual(group.findings.map((f) => f.relationship), ['inside', 'intersects', 'nearby']);
  assert.match(group.findings[0].detail, /Map symbol · Central City quadrangle · map dated 1972 · 1:24,000/);
  assert.match(group.findings[1].detail, /^Mapped area/);
  const down = load('app/api/land-intelligence/parcel-inspection/underground.ts', async () => { throw new Error('offline'); });
  assert.equal((await down.mineGroup(parcel)).status, 'source_error');
});

test('DRMS undermined areas list the mines and stay Colorado-only', async () => {
  const area = { type: 'Polygon', coordinates: [[[-105.514, 39.800], [-105.511, 39.800], [-105.511, 39.803], [-105.514, 39.803], [-105.514, 39.800]]] };
  const mock = async () => ({ ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', id: 846, geometry: area, properties: { FID: 846, MINE_NAME: 'Strathmore 1919, Cambro 1928, Canon 1890, Senator 1913, Otis 1898', Depth_Int: ' ' } }] }) });
  const { underminedGroup } = load('app/api/land-intelligence/parcel-inspection/underground.ts', mock);
  const group = plain(await underminedGroup(parcel, 'co:1'));
  assert.equal(group.findings.length, 1);
  assert.equal(group.findings[0].name, 'Undermined: Strathmore 1919, Cambro 1928, Canon 1890 +2 more');
  assert.match(group.findings[0].detail, /Mines: .*Otis 1898 · mapped workings \+ 100 ft buffer/);
  assert.equal(group.findings[0].relationship, 'intersects');
  assert.match(group.note, /Mapping is incomplete/);
  assert.equal((await underminedGroup(parcel, 'fl:1')).status, 'outside_coverage');
});

test('CGS openings: one unpaged query, hazard rating and condition shown', async () => {
  let body = '';
  const mock = async (url, init) => { body = String(init.body); return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-105.5125, 39.8030] }, properties: { FID: 7, SITENAME_1: 'HIGHLAND TUNNEL', HTYPE: 'adit', HAZ_RATING: 'dangerous', CONDITION: 'intact', COMMOD_T: 'SILVER', MINE_DIST: 'Aspen', DepthCalc: '> 100' } }] }) }; };
  const { coloradoAmlGroup } = load('app/api/land-intelligence/parcel-inspection/underground.ts', mock);
  const group = plain(await coloradoAmlGroup(parcel, 'co:1'));
  assert.doesNotMatch(body, /resultOffset|resultRecordCount/, 'the CGS server rejects pagination');
  assert.equal(group.findings[0].name, 'HIGHLAND TUNNEL · adit');
  assert.equal(group.findings[0].detail, 'CGS hazard rating: dangerous · intact · SILVER · Aspen district · depth > 100 ft');
});

test('helpers and registry: names, hazard levels, groups in the hazards discipline', () => {
  const ug = load('app/land-intelligence/underground.ts');
  assert.deepEqual(plain(ug.mineNames('Acme 1928, Leader 1899, Acme 1928, ')), ['Acme 1928', 'Leader 1899']);
  assert.deepEqual([ug.amlHazardLevel('extreme danger'), ug.amlHazardLevel('No significant hazard'), ug.amlHazardLevel('not available')], [3, 0, -1]);
  assert.equal(ug.amlHazard('not available'), '');
  const { PARCEL_DISCIPLINES } = load('app/land-intelligence/parcel-analysis.ts');
  const hazards = PARCEL_DISCIPLINES.find((d) => d.id === 'hazards').groups;
  for (const id of ['undermined-areas', 'mines', 'colorado-aml']) assert.ok(hazards.includes(id), id);
});

test('map route: bounds checked, parts fail independently, Colorado sources skipped elsewhere', async () => {
  const mock = async (url) => {
    const u = String(url);
    if (u.includes('mrdata.usgs.gov')) return wfs(u.includes('typeName=points') ? gmlPoint('p1', 39.8, -105.51, 'Mine Shaft') : '');
    if (u.includes('Undermined')) throw new Error('DRMS down');
    return { ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-105.51, 39.8] }, properties: { SITENAME_1: 'X', HTYPE: 'vertical shaft', HAZ_RATING: 'extreme danger' } }] }) };
  };
  const route = load('app/api/land-intelligence/underground/route.ts', mock);
  const get = (bbox) => route.GET({ nextUrl: new URL(`http://x/?bbox=${bbox}`) });
  assert.equal((await get('1,2,3')).status, 400);
  assert.equal((await get('-106,39,-105,40')).status, 422);
  const co = plain((await get('-105.53,39.79,-105.50,39.81')).body);
  assert.deepEqual(co.parts, { undermined: 'rejected', usmin: 'fulfilled', openings: 'fulfilled' });
  assert.deepEqual(co.features.map((f) => [f.properties.layer, f.properties.kind ?? f.properties.hazard]), [['usmin', 0], ['opening', 3]]);
  const fl = plain((await get('-80.2,25.7,-80.1,25.8')).body);
  assert.deepEqual([fl.parts.undermined, fl.parts.openings], ['outside', 'outside']);
});
