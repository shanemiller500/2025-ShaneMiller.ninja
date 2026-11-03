// Phase 4 (property and market expansion): national market context from free federal data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, fetchMock, env = {}) {
  const abs = path.resolve(file), exports = {};
  const requireLocal = (name) => name.startsWith('node:') ? require(name) : name === 'next/server'
    ? { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } }
    : load(name.startsWith('@/') ? name.slice(2) + '.ts' : path.resolve(path.dirname(abs), name) + '.ts', fetchMock, env);
  const { outputText } = ts.transpileModule(fs.readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(outputText, { exports, require: requireLocal, fetch: fetchMock, process: { env, cwd: () => process.cwd() }, URL, URLSearchParams, AbortSignal, Date, Map, Set, Math, Number, String, Array, Object, JSON, Promise, Error, Buffer }, { filename: abs });
  return exports;
}
const market = load('app/land-intelligence/market.ts');

test('reliability follows the coefficient of variation from a 90% margin', () => {
  assert.equal(market.reliability(1000, 100), 'good');      // CV 6%
  assert.equal(market.reliability(1000, 400), 'caution');   // CV 24%
  assert.equal(market.reliability(1000, 600), 'low');       // CV 36%
  assert.equal(market.reliability(null, 10), 'unknown');
});

test('proportion margin uses the ACS formula and falls back to the ratio formula', () => {
  // p = 200/1000; MOE = sqrt(50² − 0.2²·80²)/1000
  const share = market.proportion([200, 50], [1000, 80]);
  assert.equal(share.value, 0.2);
  assert.ok(Math.abs(share.moe - Math.sqrt(50 ** 2 - 0.04 * 80 ** 2) / 1000) < 1e-12);
  const fallback = market.proportion([200, 10], [1000, 200]);
  assert.ok(Math.abs(fallback.moe - Math.sqrt(10 ** 2 + 0.04 * 200 ** 2) / 1000) < 1e-12, 'negative radicand uses the ratio formula');
  assert.equal(market.proportion([1, 1], [0, 1]).value, null);
});

test('top-coded medians are bounds, and value-to-income is withheld for them', () => {
  assert.equal(market.estimate('medianValue', [2000001, 0]).bound, 'at_least');
  assert.equal(market.estimate('medianYearBuilt', [1939, 0]).bound, 'at_most');
  assert.equal(market.estimate('medianValue', [756300, 14324]).bound, undefined);
  const capped = market.acsProfile({ medianValue: [2000001, null], medianIncome: [100000, 1000] });
  assert.equal(capped.priceToIncome, null);
  const normal = market.acsProfile({ medianValue: [500000, 1], medianIncome: [100000, 1], vacant: [10, 2], housingUnits: [100, 3], owner: [60, 4], renter: [30, 4], occupied: [90, 5], belowPoverty: [20, 5], povertyUniverse: [200, 10] });
  assert.equal(normal.priceToIncome, 5);
  assert.equal(normal.vacancyRate.value, 0.1);
  assert.ok(Math.abs(normal.renterShare.value - 30 / 90) < 1e-12);
  assert.equal(normal.povertyRate.value, 0.1);
});

test('price index changes: tract uses the latest published year within three; quarterly compares 4 and 20 quarters back', () => {
  const tract = market.tractChange({ first: 2015, values: [100, 110, 120, 130, 140, 150, 160, 170, 180, null, null] });
  assert.equal(tract.latest, '2023');
  assert.ok(Math.abs(tract.oneYear - (180 / 170 - 1)) < 1e-12);
  assert.ok(Math.abs(tract.fiveYear - (180 / 130 - 1)) < 1e-12);
  assert.equal(market.tractChange({ first: 2015, values: [100, 110, 120, 130, null, null, null] }), null, 'no value in the last three years');
  const index = Array.from({ length: 41 }, (_, i) => 100 + i);
  const quarterly = market.quarterlyChange({ last: '2026Q2', index, se: index.map(() => 2) });
  assert.equal(quarterly.latest, '2026Q2');
  assert.ok(Math.abs(quarterly.oneYear - (140 / 136 - 1)) < 1e-12);
  assert.ok(Math.abs(quarterly.fiveYear - (140 / 120 - 1)) < 1e-12);
  assert.equal(quarterly.standardError, 2);
});

test('permit summary: latest year, five-year average, per 1,000 homes and multifamily share', () => {
  const permits = [2021, 2022, 2023, 2024, 2025].map((year, i) => ({ year, units: 100 + i * 10, single: 50, twoToFour: 10, fivePlus: 40 + i * 10, value: 1 }));
  const summary = market.permitSummary(permits, 10000);
  assert.equal(summary.latestYear, 2025);
  assert.equal(summary.latestUnits, 140);
  assert.equal(summary.previousUnits, 130);
  assert.equal(summary.fiveYearAverage, 120);
  assert.equal(summary.perThousandHomes, 14);
  assert.ok(Math.abs(summary.multifamilyShare - 90 / 140) < 1e-12);
  assert.equal(market.permitSummary([], 1), null);
});

test('importer parses ACS, FHFA and Building Permits files', async () => {
  const importer = await import('../app/land-intelligence/market-import.mjs');
  assert.deepEqual({ ...importer.acsGeography('1400000US08013012204') }, { level: 'tract', id: '08013012204' });
  assert.deepEqual({ ...importer.acsGeography('0100000US') }, { level: 'us', id: 'us' });
  assert.equal(importer.acsGeography('1500000US080130122041'), null, 'block groups are not kept');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'li-market-'));
  const write = (name, text) => { const file = path.join(dir, name); fs.writeFileSync(file, text); return file; };
  const store = importer.createStore();
  await importer.ingestAcsTable(write('b25077.dat', 'GEO_ID|B25077_E001|B25077_M001\n0100000US|332700|236\n0500000US08013|756300|14324\n1400000US08013012204|-666666666|-222222222\n'), 'B25077', store);
  assert.deepEqual(store.data.us.acs.medianValue, [332700, 236]);
  assert.deepEqual(store.data.counties['08013'].acs.medianValue, [756300, 14324]);
  assert.deepEqual(store.data.tracts['08013012204'].acs.medianValue, [null, null], 'annotation sentinels are not values');
  const { abbr, lastYear } = await importer.ingestTracts(write('tract.csv', 'tract,state_abbr,year,annual_change,hpi,hpi1990,hpi2000\n08013012101,CO,2014,,90,,\n08013012101,CO,2015,,100,,\n08013012101,CO,2025,1.0,150,,\n'), store);
  assert.equal(abbr.CO, '08');
  assert.equal(lastYear, 2025);
  assert.equal(store.data.tracts['08013012101'].hpi.values.length, 11);
  assert.equal(store.data.tracts['08013012101'].hpi.values[10], 150);
  await importer.ingestQuarterly(write('metro.csv', '"Boulder, CO",14500,2026,1,478.97,( 4.19)\n"Boulder, CO",14500,2026,2,471.64,( 5.97)\n"Abilene, TX",10180,1975,1,-,-\n'), 'metro', store, abbr);
  assert.equal(store.data.metros['14500'].name, 'Boulder, CO');
  assert.equal(store.data.metros['14500'].last, '2026Q2');
  assert.deepEqual(store.data.metros['14500'].se, [4.19, 5.97]);
  assert.deepEqual(store.data.metros['10180'].index, [null], 'a dash is missing, not zero');
  await importer.ingestQuarterly(write('state.csv', 'CO,2026,1,854.32\nCO,2026,2,853.19\n'), 'state', store, abbr);
  assert.deepEqual(store.data.states['08'].hpi.index, [854.32, 853.19]);
  await importer.ingestPermits(write('co2025a.txt', 'Survey,FIPS,FIPS,Region,Division,County,,1-unit\nDate,State,County,Code,Code,Name,Bldgs,Units,Value\n \n2025,08,013,4,8,Boulder County                ,400,428,1000,10,20,500,5,19,300,30,1534,9000,0,0,0\n'), store);
  assert.deepEqual({ ...store.data.counties['08013'].permits[0] }, { year: 2025, units: 2001, single: 428, twoToFour: 39, fivePlus: 1534, value: 10800 });
});

test('shared FRED helper reports the year-earlier observation', async () => {
  const csv = 'observation_date,MORTGAGE30US\n2025-10-30,6.17\n2025-11-06,6.22\n2026-10-22,6.05\n2026-10-29,6.01\n';
  const { fetchFredSeries } = load('utils/fred.ts', async () => ({ ok: true, text: async () => csv }));
  const point = await fetchFredSeries('MORTGAGE30US');
  assert.equal(point.rate, 6.01);
  assert.equal(point.prev, 6.05);
  assert.deepEqual({ ...point.yearAgo }, { rate: 6.17, date: '2025-10-30' });
});

test('HUD Fair Market Rents need a token and parse county and Small Area responses', async () => {
  const none = load('app/land-intelligence/market-data.ts', async () => { throw new Error('no network'); }, {});
  assert.equal((await none.hudFmr('08013', '80302')).status, 'not_configured');
  const calls = [];
  const county = { data: { year: '2026', area_name: 'Boulder, CO MSA', smallarea_status: '0', basicdata: { Efficiency: '1500', 'One-Bedroom': '1700', 'Two-Bedroom': '2100', 'Three-Bedroom': '2800', 'Four-Bedroom': '3200' } } };
  const withToken = load('app/land-intelligence/market-data.ts', async (url, options) => { calls.push([url, options.headers.Authorization]); return { ok: true, json: async () => county }; }, { HUD_API_TOKEN: 'abc' });
  const result = await withToken.hudFmr('08013', '80302');
  assert.equal(result.status, 'ready');
  assert.deepEqual([...result.data.rents.map((item) => item.rent)], [1500, 1700, 2100, 2800, 3200]);
  assert.equal(calls[0][0], 'https://www.huduser.gov/hudapi/public/fmr/data/0801399999');
  assert.equal(calls[0][1], 'Bearer abc');
  const small = { data: { year: '2026', area_name: 'Denver', smallarea_status: '1', basicdata: [{ zip_code: 'MSA level', Efficiency: '1', 'One-Bedroom': '1', 'Two-Bedroom': '1', 'Three-Bedroom': '1', 'Four-Bedroom': '1' }, { zip_code: '80302', Efficiency: '1900', 'One-Bedroom': '2000', 'Two-Bedroom': '2500', 'Three-Bedroom': '3300', 'Four-Bedroom': '3700' }] } };
  const safmr = load('app/land-intelligence/market-data.ts', async () => ({ ok: true, json: async () => small }), { HUD_API_TOKEN: 'abc' });
  const zip = await safmr.hudFmr('08031', '80302');
  assert.equal(zip.data.zip, '80302');
  assert.equal(zip.data.smallArea, true);
  assert.equal(zip.data.rents[2].rent, 2500);
});

test('divided metros use the FHFA metro-division series', async (t) => {
  if (!fs.existsSync('data/land-intelligence/market/manifest.json')) return t.skip('Market data has not been imported');
  const geocoder = { result: { geographies: { States: [{ GEOID: '12', NAME: 'Florida' }], Counties: [{ GEOID: '12086', NAME: 'Miami-Dade County' }], 'Census Tracts': [{ GEOID: '12086006713', NAME: 'Census Tract 67.13' }], 'Metropolitan Statistical Areas': [{ GEOID: '33100', CBSA: '33100', NAME: 'Miami-Fort Lauderdale-West Palm Beach, FL Metro Area' }], 'Metropolitan Divisions': [{ GEOID: '3310033124', NAME: 'Miami-Miami Beach-Kendall, FL Metro Division' }] } } };
  const { marketContext } = load('app/land-intelligence/market-data.ts', async (url) => ({ ok: true, text: async () => String(url).includes('geocoding') ? JSON.stringify(geocoder) : 'observation_date,X\n2026-10-29,6.01\n' }), {});
  const context = await marketContext(-80.1918, 25.7617);
  assert.equal(context.geography.metro.division.code, '33124');
  assert.match(context.hpi.metro.name, /Miami-Miami Beach-Kendall/);
  assert.equal(context.hpi.tract, null, 'FHFA publishes no index for this tract');
});

test('market route rejects points outside the U.S.', async () => {
  const { GET } = load('app/api/land-intelligence/market/route.ts', async () => { throw new Error('not called'); });
  assert.equal((await GET({ nextUrl: new URL('http://x/?lng=2.35&lat=48.85') })).status, 400);
});

test('real imported files: Boulder County values equal the published ACS 2024 5-year estimates (skipped without data)', async (t) => {
  if (!fs.existsSync('data/land-intelligence/market/manifest.json')) return t.skip('Market data has not been imported');
  const geocoder = { result: { geographies: { States: [{ GEOID: '08', NAME: 'Colorado' }], Counties: [{ GEOID: '08013', NAME: 'Boulder County' }], 'Census Tracts': [{ GEOID: '08013012204', NAME: 'Census Tract 122.04' }], 'Metropolitan Statistical Areas': [{ GEOID: '14500', CBSA: '14500', NAME: 'Boulder, CO Metro Area' }], '2020 Census ZIP Code Tabulation Areas': [{ GEOID: '80302' }] } } };
  const fetchMock = async (url) => String(url).includes('geocoding.geo.census.gov')
    ? { ok: true, text: async () => JSON.stringify(geocoder) }
    : { ok: true, text: async () => 'observation_date,X\n2026-10-29,6.01\n' };
  const { marketContext } = load('app/land-intelligence/market-data.ts', fetchMock, {});
  const context = await marketContext(-105.2795, 40.015);
  // Independently confirmed through Census Reporter (acs2024_5yr) on 2026-11-02.
  assert.equal(context.acs.county.medianValue.value, 756300);
  assert.equal(context.acs.county.medianValue.moe, 14324);
  assert.equal(context.acs.county.medianIncome.value, 103994);
  assert.equal(context.acs.county.medianRent.value, 1966);
  assert.equal(context.acs.tract.medianValue.value, 1597600);
  assert.equal(context.acs.us.medianValue.value, 332700);
  assert.equal(context.hpi.metro.name, 'Boulder, CO');
  assert.ok(context.permits.latestUnits > 0);
  assert.equal(context.fmr.status, 'not_configured');
  assert.match(context.sources.map((source) => source.label).join(' '), /not endorsed or certified by HUD User/);
});
