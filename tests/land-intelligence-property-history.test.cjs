// Phase 2 (property and market expansion): sale classification, history, ownership, permits, buildings and tax estimates.
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
const history = load('app/land-intelligence/property-history.ts');
const account = (overrides = {}) => ({ accountNo: 'R1', linkedParcelCount: 1, siteAddress: '', owners: ['DOE JANE'], subdivision: '', legalDescription: '', taxArea: '', millLevy: 80, accountType: 'RESIDENTIAL', landUses: [], buildings: [], sales: [], permits: [], values: null, ...overrides });
const boulderDetail = (accounts) => ({ owners: [], sales: [], valueLabels: {}, boulder: { status: 'ready', property: { folio: '1', accounts, updatedAt: '', sourceDate: '10/25/2026 4:00:39 AM', sourceUrl: '' } } });

test('county and DOR qualification codes map to documented meanings; undefined codes are not guessed', () => {
  assert.deepEqual({ ...history.boulderSaleClass('Q', 500000) }, { status: 'market', label: "Qualified sale (county: arm's-length)", comparable: true });
  assert.equal(history.boulderSaleClass('Q', null).comparable, false, 'a qualified deed without a price is not a comparable');
  assert.equal(history.boulderSaleClass('U', 400000).status, 'non_market');
  assert.equal(history.boulderSaleClass('P', 400000).status, 'pending');
  assert.equal(history.floridaSaleClass('01', 300000).comparable, true);
  assert.equal(history.floridaSaleClass('1', 300000).label, 'Qualified: deed examination (DOR 01)', 'codes are zero-padded');
  assert.equal(history.floridaSaleClass('05', 300000).status, 'qualified_changed');
  assert.equal(history.floridaSaleClass('05', 300000).comparable, false, 'qualified-but-excluded sales stay out of comparables');
  assert.equal(history.floridaSaleClass('11', 300000).status, 'non_market');
  assert.equal(history.floridaSaleClass('99', 300000).status, 'pending');
  const unknown = history.floridaSaleClass('43', 300000);
  assert.equal(unknown.status, 'unknown');
  assert.match(unknown.label, /not defined in the reference guide/);
});

test('owner entity type is read from the recorded name only', () => {
  assert.equal(history.ownerEntityType('SMITH JOHN & MARY'), 'individual');
  assert.equal(history.ownerEntityType('PEARL STREET HOLDINGS LLC'), 'company');
  assert.equal(history.ownerEntityType('JONES FAMILY TRUST'), 'trust');
  assert.equal(history.ownerEntityType('DOE JANE TRUSTEE'), 'trust');
  assert.equal(history.ownerEntityType('CITY OF BOULDER'), 'government');
  assert.equal(history.ownerEntityType('BOULDER VALLEY SCHOOL DISTRICT RE2'), 'government');
  assert.equal(history.ownerEntityType('FIRST UNITED METHODIST CHURCH'), 'organization');
  assert.equal(history.ownerEntityType('ABC TRUST COMPANY'), 'company', 'a trust company is a company');
});

test('price changes use only comparable sales of one account and flag permits in between', () => {
  const sales = [
    { date: '2015-06-01', price: 400000, qualification: 'Q', deedType: 'WD', reception: 'A' },
    { date: '2018-01-01', price: 10, qualification: 'U', deedType: 'QD', reception: 'B' },
    { date: '2021-06-01', price: 600000, qualification: 'Q', deedType: 'WD', reception: 'C' },
  ];
  const permits = [{ number: 'P1', category: 'ADDITION', date: '2019-03-01', description: '', estimatedValue: 80000, issuedBy: 'City' }];
  const result = history.propertyHistory(boulderDetail([account({ sales, permits })]));
  assert.equal(result.marketSales, 2);
  assert.equal(result.lastMarketSale.price, 600000);
  assert.equal(result.priceChanges.length, 1, 'the unqualified quit-claim is skipped');
  const [change] = result.priceChanges;
  assert.equal(change.change, 200000);
  assert.ok(Math.abs(change.annualRate - (Math.pow(1.5, 1 / change.years) - 1)) < 1e-12);
  assert.equal(change.permitsBetween, 1);
  const shared = history.propertyHistory(boulderDetail([account({ sales, linkedParcelCount: 3 })]));
  assert.equal(shared.priceChanges.length, 0, 'deeds on a multi-parcel account are never priced against one parcel');
  assert.equal(shared.sales.every((sale) => sale.sharedAccount && !sale.comparable), true);
});

test('a withheld deed date is never the last qualified sale', () => {
  const result = history.propertyHistory(boulderDetail([account({ sales: [{ date: '', dateIssue: 'placeholder', price: 900000, qualification: 'Q', deedType: 'WD', reception: 'X' }, { date: '2010-01-01', price: 300000, qualification: 'Q', deedType: 'WD', reception: 'Y' }] })]));
  assert.equal(result.lastMarketSale.reception ?? result.lastMarketSale.reference, 'Y');
  assert.equal(result.marketSales, 1);
});

test('statewide sale that repeats a county deed is shown once', () => {
  const detail = boulderDetail([account({ sales: [{ date: '2021-02-24', price: 700000, qualification: 'Q', deedType: 'WD', reception: 'R' }] })]);
  detail.sales = [{ date: '2021-02-24', price: 700000, reference: '' }, { date: '1999-05-01', price: 200000, reference: '' }];
  const result = history.propertyHistory(detail);
  assert.equal(result.sales.length, 2);
  assert.equal(result.sales.filter((sale) => sale.source === 'state').length, 1);
  assert.equal(result.sales.find((sale) => sale.source === 'state').status, 'unknown', 'a statewide sale without a code has unknown market character');
});

test('tax estimate is assessed value × mill levy and becomes a range when school and county assessments differ', () => {
  const same = history.estimateTax(account({ millLevy: 100, values: { taxYear: '2026', actualTotal: 1000000, actualLand: null, actualBuildings: null, assessedTotal: 270000, assessedSchool: 270000 } }));
  assert.deepEqual([same.low, same.high], [27000, 27000]);
  const residential = history.estimateTax(account({ millLevy: 80, values: { taxYear: '2026', actualTotal: 1000000, actualLand: null, actualBuildings: null, assessedTotal: 62500, assessedSchool: 70000 } }));
  assert.deepEqual([residential.low, residential.high], [5000, 5600]);
  assert.equal(history.estimateTax(account({ millLevy: null, values: { taxYear: '2026', assessedTotal: 1, actualTotal: 1, actualLand: null, actualBuildings: null } })), null, 'no levy, no estimate');
});

test('permit and building summaries ignore withheld dates and merged basement rows', () => {
  const permits = [
    { number: '1', category: 'REMODEL', date: '2024-01-01', description: '', estimatedValue: 10000, issuedBy: '' },
    { number: '2', category: 'NEW CONSTRUCTION', date: '1999-05-01', description: '', estimatedValue: null, issuedBy: '' },
    { number: '3', category: 'REMODEL', date: '', dateIssue: 'placeholder', description: '', estimatedValue: 500, issuedBy: '' },
  ];
  const summary = history.summarizePermits([account({ permits })], '2026-10-25');
  assert.equal(summary.total, 3);
  assert.equal(summary.withheldDates, 1);
  assert.equal(summary.last, '2024-01-01');
  assert.equal(summary.first, '1999-05-01');
  assert.equal(summary.recent, 1);
  assert.equal(summary.reportedValue, 10500);
  assert.equal(summary.latestNewConstruction, '1999-05-01');
  assert.equal(summary.categories[0].name, 'REMODEL');
  const buildings = history.summarizeBuildings([
    { buildingNumber: '1', section: '1', finishedSqft: 1800, basementSqft: 1000, yearBuilt: 1980, effectiveYear: 2005, units: null },
    { buildingNumber: '1', section: '2', finishedSqft: 600, basementSqft: null, yearBuilt: 1990, effectiveYear: 1990, units: null },
    { buildingNumber: '2', section: '1', finishedSqft: null, basementSqft: null, yearBuilt: 1985, effectiveYear: null, units: null, percentComplete: 0.5 },
  ]);
  assert.deepEqual({ ...buildings }, { buildings: 2, sections: 3, finishedSqft: 2400, units: null, oldestYear: 1980, newestEffectiveYear: 2005, basementSqft: 1000, incomplete: 1 });
});

test('Florida and North Carolina statewide records carry documented sale facts only', () => {
  const { PARCEL_SOURCES } = load('app/land-intelligence/parcel-sources.ts');
  const { normalizeParcelDetail, floridaInspection } = load('app/land-intelligence/parcel-detail.ts');
  const fl = normalizeParcelDetail(PARCEL_SOURCES[3], { PARCEL_ID: 'A', CO_NO: 47, SALE_PRC1: 350000, SALE_YR1: 2023, SALE_MO1: 6, QUAL_CD1: '01', VI_CD1: 'I', SALE_PRC2: 900000, SALE_YR2: 2021, SALE_MO2: 2, QUAL_CD2: '01', VI_CD2: 'V', M_PAR_SAL2: 'D', NO_RES_UNT: 2, IMP_QUAL: 3, CONST_CLAS: 3, JV_HMSTD: 250000, DT_LAST_IN: '823', PUBLIC_LND: 'M', EFF_YR_BLT: 2001 });
  assert.equal(fl.sales[0].comparable, true);
  assert.equal(fl.sales[0].vacantAtSale, false);
  assert.equal(fl.sales[1].multiParcel, true);
  assert.equal(fl.sales[1].comparable, false, 'a multi-parcel price is not this parcel’s price');
  assert.equal(fl.sales[1].vacantAtSale, true);
  assert.equal(fl.residentialUnits, 2);
  assert.equal(fl.qualityLabel, 'Average');
  assert.equal(fl.constructionLabel, 'Masonry (C)');
  assert.equal(fl.homesteadValue, 250000);
  assert.equal(fl.lastInspection, '2023-08');
  assert.equal(fl.publicLand, 'Municipal');
  assert.equal(fl.effectiveYearBuilt, 2001);
  assert.equal(floridaInspection('0000'), '');
  assert.equal(floridaInspection('1399'), '', 'month 13 is rejected');
  const ncPlaceholder = normalizeParcelDetail(PARCEL_SOURCES[4], { parno: '1', cntyname: 'Wake', saledate: 978325200000, saledatetx: '', sourceref: 'Deed Book/Page /' });
  assert.equal(ncPlaceholder.sales.length, 0, 'the 2001-01-01 placeholder is not a sale');
  assert.equal(ncPlaceholder.sourceDocument, undefined, 'an empty book/page is not a reference');
  const nc = normalizeParcelDetail(PARCEL_SOURCES[4], { parno: '1', cntyname: 'Wake', saledate: 1734325200000, saledatetx: '2024-12-16T00:00:00Z', sourceref: 'Deed Book/Page 019788/00619', sourcedate: 1734325200000, structno: 1 });
  assert.equal(nc.sales[0].date, '2024-12-16');
  assert.deepEqual({ ...nc.sourceDocument }, { reference: 'Deed Book/Page 019788/00619', date: '2024-12-16' });
  assert.equal(nc.buildingCount, 1);
  const co = normalizeParcelDetail(PARCEL_SOURCES[0], { parcel_id: '1', countyName: 'Boulder', saleDate: '2/24/2021', salePrice: '700000' });
  assert.equal(co.sales[0].date, '2021-02-24', 'Colorado M/D/YYYY dates are normalized');
});

test('printable report escapes owner names and labels calculated figures', () => {
  const { parcelReportHtml } = load('app/land-intelligence/export-parcel-report.ts');
  const detail = boulderDetail([account({ owners: ['<script>x</script> LLC'], ownerships: [{ name: '<script>x</script> LLC', role: 'primary', share: 1 }], millLevy: 80, values: { taxYear: '2026', actualTotal: 1, actualLand: null, actualBuildings: null, assessedTotal: 62500, assessedSchool: 70000 } })]);
  detail.parcel = { address: '', landUse: '', zoning: '', received: '', recordUrl: '', sourceUrl: '', propertyId: 'co:BOULDER:1' };
  const polygon = { type: 'Polygon', coordinates: [[[-105.28, 40.01], [-105.279, 40.01], [-105.279, 40.011], [-105.28, 40.011], [-105.28, 40.01]]] };
  const html = parcelReportHtml({ parcelKey: 'co:1', checkedAt: '2026-11-01T00:00:00Z', groups: [] }, polygon, { name: 'Example', id: '1', locality: 'Boulder', sourceUrl: '' }, detail);
  assert.doesNotMatch(html, /<script>x/);
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt; LLC \(primary\), 100% share; entity type Company/);
  assert.match(html, /Calculated tax estimate: \$5,000 to \$5,600/);
});

test('real Boulder fixtures produce a consistent history (skipped when no local snapshot)', async (t) => {
  if (!fs.existsSync('data/land-intelligence/boulder/manifest.json')) return t.skip('Boulder snapshot is not loaded in this checkout');
  const { loadBoulderProperty } = load('app/land-intelligence/boulder-property.ts');
  for (const folio of ['146124104006', '157508438002', '146332200048']) {
    const lookup = await loadBoulderProperty(folio);
    const result = history.propertyHistory({ owners: [], sales: [], valueLabels: {}, boulder: lookup });
    const rows = lookup.property.accounts.flatMap((item) => item.sales).length;
    assert.equal(result.sales.length, rows, `${folio}: every deed row appears once`);
    assert.ok(result.sales.every((sale) => !sale.comparable || (sale.status === 'market' && sale.price > 0 && !sale.sharedAccount)), `${folio}: comparables are qualified, priced, single-parcel`);
    for (const tax of result.taxes) assert.ok(tax.low <= tax.high && tax.low > 0, `${folio}: tax range ordered`);
    assert.ok(result.owners.every((owner) => owner.entity), `${folio}: every owner classified`);
  }
});
