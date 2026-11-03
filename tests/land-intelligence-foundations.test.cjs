// Phase 1 (property and market expansion): value labels, Boulder deed-date validation and stable property identifiers.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const abs = path.resolve(file), exports = {};
  const requireLocal = (name) => name.startsWith('node:') ? require(name) : load(name.startsWith('@/') ? name.slice(2) + '.ts' : path.resolve(path.dirname(abs), name) + '.ts');
  const { outputText } = ts.transpileModule(fs.readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(outputText, { exports, require: requireLocal, process, URL, URLSearchParams, AbortSignal, Date, Map, Set, Math, Number, String, Array, Object, JSON, Promise, Error, Buffer }, { filename: abs });
  return exports;
}

test('Boulder deed dates: placeholder, pre-county and after-source dates are withheld; real historic deeds stay', () => {
  const { boulderRecordDate } = load('app/land-intelligence/record-date.ts');
  const source = '10/25/2026 4:00:39 AM';
  assert.deepEqual({ ...boulderRecordDate('4/4/1978 12:00:00 AM', source) }, { date: '1978-04-04' });
  assert.deepEqual({ ...boulderRecordDate('7/3/1872 12:00:00 AM', source) }, { date: '1872-07-03' }, 'a territorial-era recording is a real record');
  assert.equal(boulderRecordDate('12/30/1899 12:00:00 AM', source).dateIssue, 'placeholder');
  assert.equal(boulderRecordDate('5/1/1850', source).dateIssue, 'before_county');
  assert.equal(boulderRecordDate('11/6/2026 12:00:00 AM', source).dateIssue, 'after_source');
  assert.equal(boulderRecordDate('10/25/2026 12:00:00 AM', source).date, '2026-10-25', 'the county data date itself is allowed');
  assert.equal(boulderRecordDate('2/30/2020', source).dateIssue, 'unparseable', 'an impossible calendar date is rejected');
  assert.equal(boulderRecordDate('2021-03-04', source).date, '2021-03-04');
  assert.deepEqual({ ...boulderRecordDate('', source) }, { date: '' }, 'a blank date is missing, not invalid');
});

test('headline never treats a deed with a withheld date as the latest sale', () => {
  const { parcelHeadline } = load('app/land-intelligence/parcel-headline.ts');
  const account = (sales) => ({ accountNo: 'A1', linkedParcelCount: 1, owners: ['OWNER'], values: { actualTotal: 500000 }, sales });
  const detail = (sales) => ({ owners: [], sales: [], valueLabels: {}, boulder: { status: 'ready', property: { accounts: [account(sales)] } } });
  const headline = parcelHeadline(detail([{ date: '', dateIssue: 'placeholder', price: 999999 }, { date: '2019-05-01', price: 400000 }]));
  assert.equal(headline.price, 400000);
  assert.equal(headline.priceDate, '2019-05-01');
  assert.equal(headline.valueLabel, 'County actual value');
  assert.equal(parcelHeadline(detail([{ date: '', dateIssue: 'after_source', price: 700000 }])).price, null);
});

test('statewide headline value uses the source label rather than a generic estimate', () => {
  const { PARCEL_SOURCES } = load('app/land-intelligence/parcel-sources.ts');
  const { normalizeParcelDetail } = load('app/land-intelligence/parcel-detail.ts');
  const { parcelHeadline } = load('app/land-intelligence/parcel-headline.ts');
  const co = parcelHeadline(normalizeParcelDetail(PARCEL_SOURCES[0], { parcel_id: '1', countyName: 'Denver', apprValTot: '600000' }));
  assert.equal(co.value, 600000);
  assert.equal(co.valueLabel, 'County actual value');
  const fl = parcelHeadline(normalizeParcelDetail(PARCEL_SOURCES[3], { PARCEL_ID: 'X', CO_NO: 11, JV: 250000 }));
  assert.equal(fl.valueLabel, 'Just value');
  const nc = parcelHeadline(normalizeParcelDetail(PARCEL_SOURCES[4], { parno: '1', cntyname: 'Wake', parval: 300000 }));
  assert.equal(nc.valueLabel, 'Assessed total');
});

test('Florida school and county rolls are shown separately, never summed', () => {
  const { PARCEL_SOURCES } = load('app/land-intelligence/parcel-sources.ts');
  const { normalizeParcelDetail } = load('app/land-intelligence/parcel-detail.ts');
  const same = normalizeParcelDetail(PARCEL_SOURCES[3], { PARCEL_ID: 'A', CO_NO: 47, JV: 511303, AV_SD: 511303, AV_NSD: 511303, TV_SD: 511303, TV_NSD: 511303 });
  assert.equal(same.assessedTotal, 511303, 'not 1,022,606');
  assert.equal(same.taxableValue, 511303);
  assert.equal(same.valueLabels.total, 'Assessed value (county)');
  assert.equal(same.valueNote, undefined, 'no note when the rolls agree');
  const capped = normalizeParcelDetail(PARCEL_SOURCES[3], { PARCEL_ID: 'B', CO_NO: 47, JV: 400000, AV_SD: 400000, AV_NSD: 330000, TV_SD: 375000, TV_NSD: 305000 });
  assert.equal(capped.assessedTotal, 330000);
  assert.equal(capped.taxableValue, 305000);
  assert.match(capped.valueNote, /assessed \$400,000, taxable \$375,000/);
  const exempt = normalizeParcelDetail(PARCEL_SOURCES[3], { PARCEL_ID: 'C', CO_NO: 47, JV: 96490, AV_SD: 96490, AV_NSD: 96490, TV_SD: 0, TV_NSD: 0 });
  assert.equal(exempt.taxableValue, 0, 'a fully exempt parcel has a real $0 taxable value');
});

test('property identifiers are namespaced by state and county and ignore OBJECTID', () => {
  const { PARCEL_SOURCES, normalizeParcel } = load('app/land-intelligence/parcel-sources.ts');
  const [co, ut, wa, fl, nc, wi] = PARCEL_SOURCES;
  assert.equal(normalizeParcel(co, { OBJECTID: 1, parcel_id: '146124104006', countyName: 'Boulder' }).propertyId, 'co:BOULDER:146124104006');
  assert.equal(normalizeParcel(co, { OBJECTID: 99, parcel_id: '146124104006', countyName: 'Boulder' }).propertyId, 'co:BOULDER:146124104006', 'a renumbered row keeps its identity');
  assert.notEqual(normalizeParcel(co, { parcel_id: '1001', countyName: 'Adams' }).propertyId, normalizeParcel(co, { parcel_id: '1001', countyName: 'Arapahoe' }).propertyId, 'the same parcel number in two counties is two properties');
  assert.equal(normalizeParcel(ut, { PARCEL_ID: ' 16-06-101-001 ', County: 'Salt Lake' }).propertyId, 'ut:SALT-LAKE:16-06-101-001');
  assert.equal(normalizeParcel(wa, { PARCEL_ID_NR: 'A1', FIPS_NR: 53067, COUNTY_NM: 'Thurston' }).propertyId, 'wa:53067:A1', 'Washington uses its county FIPS code');
  assert.equal(normalizeParcel(fl, { PARCEL_ID: 'p 1', CO_NO: 47 }).propertyId, 'fl:47:P1');
  assert.equal(normalizeParcel(nc, { parno: '0794', cntyname: 'Wake County' }).propertyId, 'nc:WAKE:0794');
  assert.equal(normalizeParcel(wi, { PARCELID: '070/0709', CONAME: 'DANE' }).propertyId, 'wi:DANE:070/0709');
  assert.equal(normalizeParcel(co, { countyName: 'Boulder' }).propertyId, '', 'no parcel number, no identity');
});

test('production never serves the Boulder snapshot until republication is approved (skipped when no local snapshot)', async (t) => {
  if (!fs.existsSync('data/land-intelligence/boulder/manifest.json')) return t.skip('Boulder snapshot is not loaded in this checkout');
  const { loadBoulderProperty } = load('app/land-intelligence/boulder-property.ts');
  const saved = { NODE_ENV: process.env.NODE_ENV, LAND_BOULDER_DATA_APPROVED: process.env.LAND_BOULDER_DATA_APPROVED };
  try {
    process.env.NODE_ENV = 'production'; delete process.env.LAND_BOULDER_DATA_APPROVED;
    const withheld = await loadBoulderProperty('146124104006');
    assert.equal(withheld.status, 'rights_pending');
    assert.equal(withheld.property, null, 'no owner, deed or permit rows leave the server');
    process.env.LAND_BOULDER_DATA_APPROVED = 'yes';
    assert.equal((await loadBoulderProperty('146124104006')).status, 'rights_pending', 'only the exact value "true" records approval');
    process.env.LAND_BOULDER_DATA_APPROVED = 'true';
    assert.equal((await loadBoulderProperty('146124104006')).status, 'ready');
  } finally {
    for (const [key, value] of Object.entries(saved)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});

test('Boulder reader validates deed dates in the loaded snapshot (skipped when no local snapshot)', async (t) => {
  if (!fs.existsSync('data/land-intelligence/boulder/manifest.json')) return t.skip('Boulder snapshot is not loaded in this checkout');
  const { loadBoulderProperty } = load('app/land-intelligence/boulder-property.ts');
  // Fixture folios from docs/land-intelligence/BOULDER_FIXTURES.md.
  for (const [folio, accounts, sales] of [['146124104006', 1, 5], ['157508438002', 3, 2], ['146332200048', 1, 4]]) {
    const result = await loadBoulderProperty(folio);
    assert.equal(result.status, 'ready', folio);
    assert.equal(result.property.accounts.length, accounts, folio);
    const rows = result.property.accounts.flatMap((account) => account.sales);
    assert.equal(rows.length, sales, folio);
    for (const sale of rows) {
      assert.ok(sale.dateIssue || /^\d{4}-\d{2}-\d{2}$/.test(sale.date) || sale.date === '', `${folio} date normalized`);
      assert.equal(typeof sale.recordedDate, 'string', 'the county value is kept');
    }
  }
});
