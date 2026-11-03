// Phase 6 (property and market expansion): one 8-section inspection shared by the screen and the printable report,
// source rights, jurisdiction coverage and the development-feasibility roll-up.
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
  vm.runInNewContext(outputText, { exports, require: requireLocal, process: { env: {}, cwd: () => process.cwd() }, URL, URLSearchParams, Date, Map, Set, Math, Number, String, Array, Object, JSON, Promise, Error }, { filename: abs });
  return exports;
}
// Values built in the vm context have that realm's prototypes; compare them as plain JSON.
const plain = (value) => JSON.parse(JSON.stringify(value));
const sections = load('app/land-intelligence/inspection-sections.ts');
const { parcelReportHtml } = load('app/land-intelligence/export-parcel-report.ts');
const invest = load('app/land-intelligence/investment.ts');

const polygon = { type: 'Polygon', coordinates: [[[-105.001, 40], [-104.999, 40], [-104.999, 40.001], [-105.001, 40.001], [-105.001, 40]]] };
const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });
const report = { parcelKey: 'co:1', checkedAt: '2026-11-02T12:00:00Z', groups: [
  { id: 'flood', label: 'Flood mapping', source: 'FEMA', sourceUrl: 'https://example.org/flood', status: 'found', note: '', findings: [
    { id: 'f1', name: 'Zone AE', relationship: 'intersects', distanceMeters: null, sourceRecordId: '1', recordUrl: 'https://example.org/1', geometry: point(-105, 40.0005) },
    { id: 'f2', name: 'Zone X', relationship: 'nearby', distanceMeters: 40, sourceRecordId: '2', recordUrl: 'https://example.org/2', geometry: point(-105.01, 40) },
  ] },
  { id: 'wetlands', label: 'Wetlands', source: 'USFWS', sourceUrl: 'https://example.org/w', status: 'unavailable', note: '', findings: [] },
  { id: 'wet-utilities', label: 'Water and sanitary sewer lines', source: 'Owner', sourceUrl: 'https://example.org/u', status: 'not_queried', note: '', findings: [] },
] };
const heading = { name: 'Example parcel', id: '123', locality: 'Boulder, Colorado', sourceUrl: 'https://example.org/parcel' };
const detail = { parcel: { state: 'Colorado', county: 'Boulder', address: '1 Main <St>', landUse: 'Residential', zoning: '', received: '2026-10-24', recordUrl: 'https://example.org/parcel', sourceUrl: 'https://example.org/source', propertyId: 'co:BOULDER:123' }, owners: ['OWNER'], sales: [], valueLabels: { market: 'County actual value' }, estimatedMarketValue: 900000, valueYear: '2026', legalDescription: '', boulder: { status: 'rights_pending' } };

test('eight unique sections in the audit order, numbered from one', () => {
  assert.deepEqual(plain(sections.INSPECTION_SECTIONS.map((s) => s.id)), ['overview', 'ownership', 'sales', 'listings', 'comparables', 'market', 'engineering', 'feasibility']);
  assert.equal(sections.sectionTitle('engineering'), '7. Land and engineering research');
  for (const section of sections.INSPECTION_SECTIONS) for (const source of section.sources) assert.ok(sections.SOURCE_RIGHTS[source], `${section.id} names a known source ${source}`);
});

test('screen and print parity: the panel renders every section and the report prints them in the same order', () => {
  const panel = fs.readFileSync('app/land-intelligence/MapInspection.tsx', 'utf8');
  const order = plain(sections.INSPECTION_SECTIONS.map((s) => panel.indexOf(`<InspectionPanel id="${s.id}"`)));
  assert.ok(order.every((index) => index > 0), 'every section is rendered by InspectionPanel');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'panel order matches the registry');
  const html = parcelReportHtml(report, polygon, heading, detail);
  const titles = [...html.matchAll(/<section class="part"><h2>([^<]+)<\/h2>/g)].map((match) => match[1]);
  assert.deepEqual(titles, plain(sections.INSPECTION_SECTIONS.map((s) => sections.sectionTitle(s.id))));
  assert.ok(html.indexOf('1. Property overview') < html.indexOf('Map measurements') && html.indexOf('Map measurements') < html.indexOf('2. Ownership and legal'));
  assert.ok(!/<h2>(Comparable sales|Market context|Property record and site context)</.test(html), 'old ad-hoc headings are gone');
});

test('rights: unlicensed listings are neither shown nor exported, and the report says why', () => {
  assert.equal(sections.sectionAllowed('listings', 'display'), false);
  assert.equal(sections.sectionAllowed('listings', 'export'), false);
  assert.equal(sections.sectionAllowed('market', 'export'), true);
  const html = parcelReportHtml(report, polygon, heading, detail);
  assert.match(html, /4\. Listings and leases<\/h2><p>Not included: MLS and listing feeds require paid or brokerage licenses/);
  assert.match(html, /Sources, rights and attribution/);
  assert.doesNotMatch(html, /HUD User/, 'HUD is credited only when its rents were retrieved');
  const withHud = parcelReportHtml(report, polygon, heading, detail, null, { geography: { state: { name: 'Colorado' } }, acs: { vintage: 'ACS', tract: null, county: null, state: null, us: null }, hpi: {}, permits: null, rates: {}, fmr: { status: 'ready', data: { year: '2026', rents: [{ bedrooms: 2, rent: 2100 }] } }, sources: [] });
  assert.match(withHud, /not endorsed or certified by HUD User/);
  assert.match(html, /Freddie Mac, Primary Mortgage Market Survey/);
  assert.doesNotMatch(html, /Sale and rental listings<\/b>/, 'a source that is not exported is not credited as used');
});

test('jurisdiction coverage reads from the connected sources, never implying absence', () => {
  const utah = sections.coverageProfile('Utah', 'Salt Lake');
  assert.equal(utah.find((row) => row.family === 'salePrice').level, 'no');
  assert.match(utah.find((row) => row.family === 'salePrice').note, /does not disclose/);
  assert.equal(utah.find((row) => row.family === 'market').level, 'yes');
  const pending = sections.coverageProfile('Colorado', 'Boulder', 'rights_pending');
  assert.match(pending.find((row) => row.family === 'countyDetail').note, /Withheld/);
  assert.equal(pending.find((row) => row.family === 'comparables').level, 'no');
  const ready = sections.coverageProfile('Colorado', 'Boulder', 'ready');
  assert.deepEqual(plain(['salePrice', 'buildings', 'tax', 'countyDetail', 'comparables'].map((family) => ready.find((row) => row.family === family).level)), ['yes', 'yes', 'yes', 'yes', 'yes']);
  assert.equal(sections.coverageProfile('Colorado', 'Larimer', 'ready').find((row) => row.family === 'countyDetail').level, 'no', 'only Boulder has full county detail');
  assert.equal(sections.coverageProfile('Colorado', 'Denver').find((row) => row.family === 'countyDetail').level, 'partial', 'Denver has live sales only');
  assert.deepEqual(plain(sections.coverageProfile('Texas', 'Travis')), []);
  assert.equal(sections.coverageProfile('Wisconsin', 'Dane').find((row) => row.family === 'value').level, 'yes');
});

test('feasibility roll-up counts records on the parcel and lists what was not checked', () => {
  const rollup = sections.constraintRollup(report);
  const water = rollup.rows.find((row) => row.id === 'water');
  assert.deepEqual(plain([water.onParcel, water.nearby, water.names]), [1, 1, ['Zone AE']]);
  assert.deepEqual(plain(rollup.unchecked).sort(), ['Water and sanitary sewer lines', 'Wetlands']);
  assert.equal(sections.constraintRollup(null), null);
});

test('report carries the calculator scenario with record, assumption and user labels', () => {
  const defaults = invest.scenarioDefaults(null, { estimate: { value: 800000 }, subject: { basis: 'building', units: 2000 } }, null);
  const input = { price: 800000, downPct: 20, ratePct: 6.5, years: 30, taxAnnual: defaults.taxAnnual.value, insuranceAnnual: defaults.insuranceAnnual.value, hoaMonthly: 0, closingCostPct: 3, monthlyRent: 3200, vacancyPct: 5, maintenancePct: 8, managementPct: 8, reservesPct: 5, units: 1, salePricePerUnit: 800000, buildingSqft: 2000, hardCostPerSqft: 250, softCostPct: 20, financingPct: 6, saleCostPct: 6, profitPct: 15 };
  const html = parcelReportHtml(report, polygon, heading, detail, null, null, { input, defaults, edited: true });
  assert.match(html, /Price \$800,000 <small>\(from records: Comparable-sales midpoint/);
  assert.match(html, /interest rate 6\.5% <small>\(entered by the user\)/, 'a changed default is labeled as user input');
  assert.match(html, /Rent \$3,200\/mo <small>\(entered by the user\)/);
  assert.match(html, /insurance \$4,000\/yr <small>\(assumption/);
  assert.match(html, /Scenario calculator \(inputs edited\)/);
  const own = invest.ownershipCost(input);
  assert.match(html, new RegExp(`principal and interest \\$${Math.round(own.principalInterest).toLocaleString('en-US')}/mo`));
  assert.match(parcelReportHtml(report, polygon, heading, detail), /calculator was not opened/);
  assert.match(html, /1 Main &lt;St&gt;/);
  assert.doesNotMatch(html, /<St>/);
});
