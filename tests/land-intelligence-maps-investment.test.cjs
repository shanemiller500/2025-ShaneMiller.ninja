// Phase 5 (property and market expansion): market overlays, parcel value density and investment scenarios.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, fetchMock, env = {}) {
  const abs = path.resolve(file), exports = {};
  const requireLocal = (name) => name.startsWith('node:') ? require(name) : name === 'next/server'
    ? { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200, headers: options.headers }) } }
    : load(name.startsWith('@/') ? name.slice(2) + '.ts' : path.resolve(path.dirname(abs), name) + '.ts', fetchMock, env);
  const { outputText } = ts.transpileModule(fs.readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(outputText, { exports, require: requireLocal, fetch: fetchMock, process: { env, cwd: () => process.cwd() }, URL, URLSearchParams, AbortSignal, Date, Map, Set, Math, Number, String, Array, Object, JSON, Promise, Error, Buffer }, { filename: abs });
  return exports;
}
const invest = load('app/land-intelligence/investment.ts');
const layers = load('app/land-intelligence/market-layers.ts');
const close = (a, b, tolerance = 0.01) => assert.ok(Math.abs(a - b) <= tolerance, `${a} ≈ ${b}`);

test('mortgage payment matches the standard amortization formula', () => {
  close(invest.monthlyPayment(400000, 6, 30), 2398.20);
  close(invest.monthlyPayment(120000, 0, 10), 1000, 1e-9);
  assert.equal(invest.monthlyPayment(0, 6, 30), 0);
});

test('ownership cost adds principal and interest, tax, insurance and HOA', () => {
  const result = invest.ownershipCost({ price: 500000, downPct: 20, ratePct: 6, years: 30, taxAnnual: 6000, insuranceAnnual: 2400, hoaMonthly: 100 });
  assert.equal(result.downPayment, 100000);
  assert.equal(result.loan, 400000);
  close(result.principalInterest, 2398.20);
  close(result.monthlyTotal, 2398.20 + 500 + 200 + 100);
  close(result.totalInterest, 2398.20 * 360 - 400000, 5);
  assert.equal(invest.clampPct(150), 1);
  assert.equal(invest.clampPct(-5), 0);
});

test('rental analysis: NOI, cap rate, cash flow, DSCR and break-even', () => {
  const r = invest.rentalAnalysis({ price: 400000, closingCostPct: 3, downPct: 25, ratePct: 6, years: 30, monthlyRent: 3000, vacancyPct: 5, taxAnnual: 4000, insuranceAnnual: 1600, maintenancePct: 8, managementPct: 8, reservesPct: 5, hoaMonthly: 0 });
  assert.equal(r.grossRent, 36000);
  assert.equal(r.vacancyLoss, 1800);
  assert.equal(r.effectiveIncome, 34200);
  close(r.operatingExpenses, 4000 + 1600 + 34200 * 0.21);
  close(r.noi, 34200 - (5600 + 7182));
  close(r.capRate, r.noi / 400000, 1e-12);
  close(r.debtService, invest.monthlyPayment(300000, 6, 30) * 12, 1e-6);
  close(r.cashInvested, 100000 + 12000);
  close(r.cashFlow, r.noi - r.debtService, 1e-6);
  close(r.dscr, r.noi / r.debtService, 1e-12);
  close(r.breakEvenOccupancy, (r.operatingExpenses + r.debtService) / 36000, 1e-12);
  close(r.grossRentMultiplier, 400000 / 36000, 1e-12);
  assert.equal(invest.rentalAnalysis({ price: 0, closingCostPct: 0, downPct: 100, ratePct: 6, years: 30, monthlyRent: 0, vacancyPct: 0, taxAnnual: 0, insuranceAnnual: 0, maintenancePct: 0, managementPct: 0, reservesPct: 0, hoaMonthly: 0 }).capRate, null, 'no price, no cap rate');
});

test('residual land value subtracts costs and profit from completed value', () => {
  const r = invest.residualLandValue({ units: 4, salePricePerUnit: 800000, buildingSqft: 8000, hardCostPerSqft: 250, softCostPct: 20, financingPct: 6, saleCostPct: 6, profitPct: 15 });
  assert.equal(r.grossValue, 3200000);
  assert.equal(r.hardCosts, 2000000);
  assert.equal(r.softCosts, 400000);
  close(r.financing, 144000);
  close(r.saleCosts, 192000);
  close(r.profit, 480000);
  close(r.residualLandValue, 3200000 - 192000 - 2000000 - 400000 - 144000 - 480000);
  close(r.perUnit, r.residualLandValue / 4);
  assert.ok(invest.residualLandValue({ units: 1, salePricePerUnit: 300000, buildingSqft: 2000, hardCostPerSqft: 250, softCostPct: 20, financingPct: 6, saleCostPct: 6, profitPct: 15 }).residualLandValue < 0, 'can be negative');
});

test('scenario defaults prefer records in order and label every assumption', () => {
  const none = invest.scenarioDefaults(null, null, null);
  assert.equal(none.price.assumption, true);
  assert.equal(none.ratePct.assumption, true);
  assert.equal(none.insuranceAnnual.assumption, true);
  const market = { acs: { tract: { medianValue: { value: 600000, bound: undefined }, medianRent: { value: 1900 } }, county: null }, rates: { thirtyYear: { rate: 6.25, date: '2026-10-29' } }, fmr: { status: 'ready', data: { rents: [{ bedrooms: 2, rent: 2100 }, { bedrooms: 3, rent: 2800 }] } } };
  const fromMarket = invest.scenarioDefaults(null, null, market);
  assert.equal(fromMarket.price.value, 600000);
  assert.match(fromMarket.price.source, /Tract median home value/);
  assert.equal(fromMarket.ratePct.value, 6.25);
  assert.equal(fromMarket.ratePct.assumption, false);
  assert.equal(fromMarket.monthlyRent.value, 2100, 'two-bedroom FMR when bedrooms are unknown');
  const comps = { estimate: { value: 910000 }, subject: { basis: 'building', units: 2000 } };
  const fromComps = invest.scenarioDefaults(null, comps, market);
  assert.equal(fromComps.price.value, 910000);
  assert.match(fromComps.price.source, /Comparable-sales midpoint/);
  assert.equal(fromComps.buildingSqft.value, 2000);
  const topCoded = invest.scenarioDefaults(null, null, { ...market, acs: { tract: { medianValue: { value: 2000001, bound: 'at_least' }, medianRent: { value: 1900 } } } });
  assert.equal(topCoded.price.assumption, true, 'a top-coded median is not used as a price');
});

test('legend classes and map paint agree for every break', () => {
  const evaluateStep = (expression, value) => { let color = expression[2]; for (let i = 3; i < expression.length; i += 2) if (value >= expression[i]) color = expression[i + 1]; return color; };
  for (const def of [...Object.values(layers.MARKET_LAYERS), layers.PARCEL_VALUE_LAYER]) {
    const expression = layers.fillColorExpression(def);
    const probes = def.classes.flatMap((item) => item.max == null ? [] : [item.max - 1e-6, item.max, item.max + 1e-6]).concat([-1, 0, 1e9]);
    for (const value of probes) assert.equal(evaluateStep(expression, value), def.classes[layers.classOf(def, value)].color, `${def.id} at ${value}`);
  }
  assert.equal(layers.classOf(layers.MARKET_LAYERS['market-trend'], 0), 0, 'zero change counts as decline-or-flat class 0');
  assert.equal(layers.classOf(layers.MARKET_LAYERS['market-value'], null), -1);
});

test('statewide parcel records carry a named total value; Utah has none', () => {
  const { PARCEL_SOURCES, normalizeParcel } = load('app/land-intelligence/parcel-sources.ts');
  const [co, ut, wa, fl, nc, wi] = PARCEL_SOURCES;
  assert.deepEqual([normalizeParcel(co, { apprValTot: '1,885,700' }).totalValue, normalizeParcel(co, {}).valueBasis], [1885700, 'County actual value']);
  assert.equal(normalizeParcel(ut, {}).totalValue, null);
  assert.equal(normalizeParcel(wa, { VALUE_LAND: 100, VALUE_BLDG: 200 }).totalValue, 300);
  assert.equal(normalizeParcel(fl, { JV: 511303 }).valueBasis, 'Just value');
  assert.equal(normalizeParcel(nc, { parval: 0 }).totalValue, null, 'zero is not a value');
  assert.equal(normalizeParcel(wi, { ESTFMKVALUE: 1, CNTASSDVALUE: 250000 }).totalValue, 250000, 'Wisconsin uses the total assessed value');
  const { normalizeParcelDetail } = load('app/land-intelligence/parcel-detail.ts');
  assert.match(normalizeParcelDetail(wi, { ESTFMKVALUE: 1240000, LNDVALUE: 335000, IMPVALUE: 1240000, CNTASSDVALUE: 1575000 }).valueNote, /omit the land/);
  assert.equal(normalizeParcelDetail(wi, { ESTFMKVALUE: 1600000, LNDVALUE: 335000, IMPVALUE: 1240000 }).valueNote, undefined);
});

test('parcel map adds value per acre from the source acreage or the mapped area, summing condo stacks', async () => {
  const square = (x) => ({ type: 'Polygon', coordinates: [[[x, 40], [x + 0.001, 40], [x + 0.001, 40.001], [x, 40.001], [x, 40]]] });
  const fetchMock = async () => ({ ok: true, text: async () => JSON.stringify({ type: 'FeatureCollection', features: [
    { type: 'Feature', geometry: square(-105), properties: { OBJECTID: 1, parcel_id: 'A', countyName: 'Boulder', landAcres: 0.5, apprValTot: '1000000' } },
    { type: 'Feature', geometry: square(-105.002), properties: { OBJECTID: 2, parcel_id: 'B', countyName: 'Boulder', apprValTot: '1000000' } },
    { type: 'Feature', geometry: square(-105.004), properties: { OBJECTID: 3, parcel_id: 'C', countyName: 'Boulder' } },
    { type: 'Feature', geometry: square(-105.006), properties: { OBJECTID: 4, parcel_id: 'D1', countyName: 'Boulder', landAcres: 0.01, apprValTot: '400000' } },
    { type: 'Feature', geometry: square(-105.006), properties: { OBJECTID: 5, parcel_id: 'D2', countyName: 'Boulder', landAcres: 0.01, apprValTot: '600000' } },
    { type: 'Feature', geometry: square(-105.006), properties: { OBJECTID: 6, parcel_id: 'D3', countyName: 'Boulder' } },
  ] }) });
  const { GET } = load('app/api/land-intelligence/parcel-map/route.ts', fetchMock);
  const response = await GET({ nextUrl: new URL('http://x/?bbox=-105.01,39.99,-104.99,40.01') });
  const [a, b, c, ...stack] = response.body.features.map((feature) => feature.properties);
  assert.equal(a.valuePerAcre, 2000000, '$1M on 0.5 reported acres');
  const mappedAcres = 1000000 / b.valuePerAcre;
  // 0.001° × 0.001° at 40°N ≈ 85.4 m × 111.2 m ≈ 9,495 m² ≈ 2.35 acres.
  assert.ok(mappedAcres > 2.3 && mappedAcres < 2.4, `mapped area ≈ 2.35 acres, got ${mappedAcres}`);
  assert.equal(c.valuePerAcre, null);
  // Three unit records on one footprint: $1M total over the mapped footprint, not each unit over its own share.
  assert.deepEqual(stack.map((p) => p.valuePerAcre), Array(3).fill(b.valuePerAcre));
});

test('market map route validates bounds and joins boundaries to imported values (skipped without data)', async (t) => {
  const { GET } = load('app/api/land-intelligence/market-map/route.ts', async () => { throw new Error('not called'); });
  assert.equal((await GET({ nextUrl: new URL('http://x/?level=tract&bbox=2,48,3,49') })).status, 400);
  assert.equal((await GET({ nextUrl: new URL('http://x/?level=tract&bbox=-106,39,-104,41') })).status, 422, 'too wide for tracts');
  if (!fs.existsSync('data/land-intelligence/market/manifest.json')) return t.skip('Market data has not been imported');
  const square = { type: 'Polygon', coordinates: [[[-105.28, 40.01], [-105.27, 40.01], [-105.27, 40.02], [-105.28, 40.02], [-105.28, 40.01]]] };
  const calls = [];
  const tiger = async (url) => { calls.push(String(url)); return { ok: true, json: async () => ({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: square, properties: { GEOID: '08013012204', NAME: 'Census Tract 122.04' } }, { type: 'Feature', geometry: square, properties: { GEOID: '08013013006', NAME: 'Census Tract 130.06' } }] }) }; };
  const route = load('app/api/land-intelligence/market-map/route.ts', tiger);
  const response = await route.GET({ nextUrl: new URL('http://x/?level=tract&bbox=-105.30,39.98,-105.10,40.05') });
  assert.equal(response.status, 200);
  assert.match(calls[0], /tigerweb\.geo\.census\.gov/);
  const [downtown, suburb] = response.body.features.map((feature) => feature.properties);
  assert.equal(downtown.medianValue, 1597600, 'ACS tract value joined by GEOID');
  assert.equal(downtown.fiveYear, null, 'FHFA does not publish this tract');
  assert.equal(typeof suburb.fiveYear, 'number');
  const counties = load('app/api/land-intelligence/market-map/route.ts', async () => ({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: square, properties: { GEOID: '08013', NAME: 'Boulder County' } }] }) }));
  const county = (await counties.GET({ nextUrl: new URL('http://x/?level=county&bbox=-106,39,-104,41') })).body.features[0].properties;
  assert.ok(county.permitsPerThousand > 10 && county.permitsPerThousand < 16, `2,001 units / 144,729 homes ≈ 13.8, got ${county.permitsPerThousand}`);
});
