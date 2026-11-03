// Colorado live records: Denver sales and transfers, Adams assessor values, business-entity filings and ECMC wells.
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
const json = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
const baseDetail = (county, extra = {}) => ({ parcel: { state: 'Colorado', county, id: '0501107018018' }, owners: [], sales: [], assessedTotal: null, assessedLand: null, assessedImprovements: null, taxableValue: 1000, estimatedMarketValue: 500000, annualPropertyTax: null, valueYear: '', legalDescription: '', yearBuilt: null, livingAreaSqft: null, buildingCount: null, deedAcres: null, valueLabels: { total: 'Assessed total', land: 'Assessed land', improvements: 'Assessed improvements', taxable: 'Statewide taxable value', market: 'County actual value' }, ...extra });

test('Denver transfers: dates, deed names, and no sale is treated as qualified', () => {
  const live = load('app/land-intelligence/colorado-live.ts');
  assert.equal(live.denverSaleDate({ SALE_YEAR: 2015, SALE_MONTHDAY: 120 }), '2015-01-20');
  assert.equal(live.denverSaleDate({ SALE_YEAR: 2021, SALE_MONTHDAY: 1105 }), '2021-11-05');
  assert.equal(live.denverSaleDate({ SALE_YEAR: null, RECEPTION_DATE: 20150121 }), '2015-01-21', 'falls back to the reception date');
  const priced = plain(live.denverSale({ SALE_YEAR: 2015, SALE_MONTHDAY: 120, SALE_PRICE: 9350000, INSTRUMENT: 'WD', GRANTOR: 'A LLC', GRANTEE: 'B INC', RECEPTION_NUM: 2015007009 }));
  assert.deepEqual([priced.price, priced.status, priced.comparable, priced.origin, priced.deedType, priced.parties, priced.reference], [9350000, 'unknown', false, 'county', 'Warranty deed', 'A LLC → B INC', '2015007009']);
  const free = plain(live.denverSale({ SALE_YEAR: 2019, SALE_MONTHDAY: 301, SALE_PRICE: 10, INSTRUMENT: 'QC' }));
  assert.deepEqual([free.price, free.status], [null, 'non_market']);
  assert.match(free.statusLabel, /Quitclaim deed; no consideration recorded/);
  assert.equal(live.denverInstrument('ZZ'), 'Instrument ZZ');
});

test('Denver query uses the numeric PARID and merges with the statewide last sale', async () => {
  const calls = [];
  const live = load('app/land-intelligence/colorado-live.ts', async (url) => { calls.push(String(url)); return json({ features: [{ attributes: { SALE_YEAR: 2020, SALE_MONTHDAY: 615, SALE_PRICE: 640000, INSTRUMENT: 'SW' } }, { attributes: { SALE_YEAR: 2012, SALE_MONTHDAY: 101, SALE_PRICE: 300000, INSTRUMENT: 'WD' } }] }); });
  const detail = baseDetail('Denver', { sales: [{ date: '2020-06-15', price: 640000, reference: '' }, { date: '2004-02-01', price: 180000, reference: '' }] });
  const record = plain(await live.coloradoCountyLive(detail));
  assert.match(decodeURIComponent(calls[0]), /where=PARID=501107018018&/);
  assert.deepEqual([record.status, record.sales, record.kind], ['ready', 2, 'sales']);
  assert.deepEqual(plain(detail.sales.map((sale) => [sale.date, sale.price])), [['2020-06-15', 640000], ['2012-01-01', 300000], ['2004-02-01', 180000]], 'the duplicate statewide sale is dropped; the pre-2010 one kept');
  const down = load('app/land-intelligence/colorado-live.ts', async () => { throw new Error('offline'); });
  const kept = baseDetail('Denver', { sales: [{ date: '2004-02-01', price: 180000, reference: '' }] });
  assert.equal((await down.coloradoCountyLive(kept)).status, 'unavailable');
  assert.equal(kept.sales.length, 1, 'a failed county query leaves the statewide record');
});

test('Adams values: one account fills the value fields; the tax estimate uses assessed × total mill levy', async () => {
  const row = { ACCOUNTNO: 'R0036289', ACCTTYPE: 'Residential', ACTLANDVAL: 170000, ACTIMPSVAL: 574000, ACTTOTALVAL: 744000, ASDLANDVAL: 8920, ASDIMPSVAL: 30110, ASDTOTALVAL: 39030, MILLLEVY: 106.966, SCHOOLNAME: 'SCHOOL DISTRICT 27J', FIRENAME: 'BRIGHTON FIRE', LOTSIZE: 0.2, LOTMEASURE: 'Ac', DATECHG: 1777939200000, ALTASDTOTALVAL: 45402, ALTMILLLEVY: 56.29 };
  const calls = [];
  const live = load('app/land-intelligence/colorado-live.ts', async (url) => { calls.push(decodeURIComponent(String(url))); return json({ features: [{ attributes: row }] }); });
  const detail = baseDetail('Adams', { parcel: { state: 'Colorado', county: 'Adams', id: '0157328113028' } });
  const record = await live.coloradoCountyLive(detail);
  assert.match(calls[0], /PARCELNB='0157328113028'/);
  assert.deepEqual([detail.assessedTotal, detail.estimatedMarketValue, detail.taxableValue, detail.schoolDistrict, detail.valueLabels.total], [39030, 744000, null, 'SCHOOL DISTRICT 27J', 'County assessed value']);
  detail.countyLive = record;
  const { propertyHistory } = load('app/land-intelligence/property-history.ts');
  const tax = plain(propertyHistory(detail).taxes[0]);
  assert.deepEqual([tax.low, tax.high, tax.millLevy], [Math.round(39030 * 106.966 / 1000), Math.round(39030 * 106.966 / 1000), 106.966], 'the undefined alternate fields are not used');
  const two = load('app/land-intelligence/colorado-live.ts', async () => json({ features: [{ attributes: row }, { attributes: { ...row, ACCOUNTNO: 'R2' } }] }));
  const shared = baseDetail('Adams', { parcel: { state: 'Colorado', county: 'Adams', id: '0157328113028' } });
  await two.coloradoCountyLive(shared);
  assert.equal(shared.assessedTotal, null, 'several accounts are listed, not summed into one parcel value');
  assert.equal(plain(await load('app/land-intelligence/colorado-live.ts', async () => json({ features: [] })).adamsValues("1' OR '1'='1")).length, 0, 'non-numeric parcel ids are never queried');
});

test('business filings match the same name only and the route never looks up individuals', async () => {
  const live = load('app/land-intelligence/colorado-live.ts');
  assert.equal(live.entityCore('The Standard at Boulder, LLC'), 'THE STANDARD AT BOULDER');
  assert.equal(live.entityCore('SMITH & SONS L.L.C.'), 'SMITH AND SONS');
  const rows = [{ entityid: '1', entityname: 'The Standard at Boulder, LLC', entitystatus: 'Delinquent' }, { entityid: '2', entityname: 'THE STANDARD AT BOULDER LLC', entitystatus: 'Good Standing', principalcity: 'Athens', principalstate: 'GA' }, { entityid: '3', entityname: 'The Standard at Boulder Two, LLC', entitystatus: 'Good Standing' }];
  const matches = plain(live.entityMatches('THE STANDARD AT BOULDER LLC', rows));
  assert.deepEqual(matches.map((match) => match.id), ['2', '1'], 'exact core name only, good standing first');
  assert.match(matches[0].url, /masterFileId=2$/);
  let asked = '';
  const route = load('app/api/land-intelligence/entity/route.ts', async (url) => { asked = decodeURIComponent(String(url).replace(/\+/g, ' ')); return json(rows); });
  const request = (name) => ({ nextUrl: new URL(`http://x/?name=${encodeURIComponent(name)}`) });
  assert.equal((await route.GET(request('JOHN Q SMITH'))).status, 422);
  const ok = await route.GET(request('The Standard at Boulder, LLC'));
  assert.equal(ok.status, 200);
  assert.match(asked, /upper\(entityname\) like 'THE%STANDARD%AT%BOULDER%'/);
  assert.equal(ok.body.matches.length, 2);
  await route.GET(request('HS LAND & CATTLE LLC'));
  assert.match(asked, /like 'HS%LAND%CATTLE%'/, '"&" names search without AND (filings write "&")');
  assert.equal(live.entityCore('HS LAND & CATTLE, LLC'), live.entityCore('HS LAND AND CATTLE LLC'));
  const { normalizeParcelDetail } = load('app/land-intelligence/parcel-detail.ts');
  const { PARCEL_SOURCES } = load('app/land-intelligence/parcel-sources.ts');
  assert.equal(normalizeParcelDetail(PARCEL_SOURCES[0], { saleDate: '20070517', salePrice: '300000' }).sales[0].date, '2007-05-17', 'Weld YYYYMMDD sale dates are normalized');
});

test('ECMC wells within 2,000 ft carry status, operator, distance and the ECMC record; outside Colorado is skipped', async () => {
  const polygon = { type: 'Polygon', coordinates: [[[-104.82, 40.3], [-104.819, 40.3], [-104.819, 40.301], [-104.82, 40.301], [-104.82, 40.3]]] };
  const well = (id, lng, stat) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: [lng, 40.3005] }, properties: { OBJECTID: id, API_Label: `123-${id}`, WellName: `EATON ${id}`, wellstat: stat, Operator: 'NOBLE ENERGY INC', field_name: 'WATTENBERG', spud_date: 1097971200000, max_m_depth: 7420, scout_card_public: `https://ecmc.state.co.us/cogisdb/Facility/FacilityDetail?api=${id}`, status_date: 1533772800000 } });
  const mock = async () => ({ ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [well(1, -104.8195, 'PA'), well(2, -104.8165, 'PR'), well(3, -104.79, 'SI')] }) });
  const { coloradoWellsGroup } = load('app/api/land-intelligence/parcel-inspection/colorado-energy.ts', mock);
  const group = plain(await coloradoWellsGroup(polygon, 'co:1'));
  assert.equal(group.status, 'found');
  assert.deepEqual(group.findings.map((f) => f.relationship), ['inside', 'nearby'], 'the well ~2.5 km away is dropped; nearest first');
  assert.match(group.findings[0].detail, /^Plugged and abandoned · NOBLE ENERGY INC · WATTENBERG field · spudded 2004 · 7,420 ft measured depth · 0 ft from the parcel$/);
  assert.match(group.findings[1].detail, /Producing/);
  assert.match(group.findings[1].recordUrl, /FacilityDetail\?api=2$/);
  assert.equal((await coloradoWellsGroup(polygon, 'fl:1')).status, 'outside_coverage');
  const { PARCEL_DISCIPLINES } = load('app/land-intelligence/parcel-analysis.ts');
  assert.ok(PARCEL_DISCIPLINES.find((d) => d.id === 'hazards').groups.includes('oil-gas-wells'), 'wells count toward hazards and the feasibility roll-up');
});

test('rights and coverage: the four live sources are licensed, credited only when used, and Colorado lists wells', () => {
  const sections = load('app/land-intelligence/inspection-sections.ts');
  for (const id of ['denver-sales', 'adams-values', 'co-entities', 'ecmc-wells']) assert.ok(sections.SOURCE_RIGHTS[id].display && sections.SOURCE_RIGHTS[id].attribution, id);
  const denver = plain(sections.coverageProfile('Colorado', 'Denver'));
  assert.equal(denver.find((row) => row.family === 'salePrice').level, 'yes');
  const adams = plain(sections.coverageProfile('Colorado', 'Adams'));
  assert.deepEqual(['value', 'tax'].map((family) => adams.find((row) => row.family === family).level), ['yes', 'yes']);
  assert.ok(adams.some((row) => row.family === 'wells'));
  assert.ok(!plain(sections.coverageProfile('Florida', 'Broward')).some((row) => row.family === 'wells'));
  const { parcelReportHtml } = load('app/land-intelligence/export-parcel-report.ts');
  const polygon = { type: 'Polygon', coordinates: [[[-105, 40], [-104.999, 40], [-104.999, 40.001], [-105, 40.001], [-105, 40]]] };
  const report = { parcelKey: 'co:1', checkedAt: '2026-11-02T00:00:00Z', groups: [{ id: 'oil-gas-wells', label: 'Oil and gas wells within 2,000 ft', source: 'ECMC', sourceUrl: 'https://example.org', status: 'no_features', note: '', findings: [] }] };
  const detail = baseDetail('Denver', { parcel: { state: 'Colorado', county: 'Denver', id: '1', address: '', landUse: '', zoning: '', received: '', recordUrl: '', sourceUrl: '', propertyId: '' }, sales: [{ date: '2020-06-15', price: 640000, reference: '2020001', origin: 'county', deedType: 'Special warranty deed', parties: 'A → B', status: 'unknown', statusLabel: 'x' }], countyLive: { county: 'Denver', kind: 'sales', status: 'ready', source: 'Denver', sourceUrl: '', checkedAt: '', sales: 1 } });
  const html = parcelReportHtml(report, polygon, { name: 'X', id: '1', locality: 'Denver', sourceUrl: '' }, detail);
  assert.match(html, /county record; ref 2020001|Special warranty deed; A → B/);
  assert.match(html, /CC BY 3\.0/);
  assert.match(html, /Energy and Carbon Management Commission/);
  assert.doesNotMatch(html, /Adams County Assessor data/, 'Adams is not credited on a Denver report');
});
