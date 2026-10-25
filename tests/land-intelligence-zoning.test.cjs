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
const request = (lng, lat) => ({ nextUrl: new URL(`http://local/api/land-intelligence/zoning?lng=${lng}&lat=${lat}`) });
const reply = (body) => ({ ok: true, text: async () => JSON.stringify(body) });
const census = (city) => ({ result: { geographies: { States: [{ NAME: 'North Carolina', STUSAB: 'NC' }], Counties: [{ NAME: 'Mecklenburg County' }], ...(city ? { 'Incorporated Places': [{ NAME: `${city} city` }] } : {}) } } });

test('zoning attributes separate the short code from the district name whichever field holds it', () => {
  const { zoningFromAttributes } = load('app/land-intelligence/zoning.ts');
  const charlotte = zoningFromAttributes({ objectid: 1, zonepetition: null, zonedes: 'UC', zoneclass: 'UPTOWN MIXED USE', overlay: 'none', hyperlink: null });
  assert.equal(charlotte.code, 'UC');
  assert.equal(charlotte.description, 'UPTOWN MIXED USE');
  const austin = zoningFromAttributes({ OBJECTID: 1, ZONING_ID: 121601, ZONING_ZTYPE: 'CBD-CURE-DDB400', ZONING_BASE: 'CBD' });
  assert.equal(austin.code, 'CBD-CURE-DDB400');
  assert.equal(zoningFromAttributes({ FLOOD_ZONE: 'AE', DISTRICT: 4, ZONING: 'N/A' }), null);
  assert.equal(zoningFromAttributes({ ZONE_DESC: 'https://example.gov/zoning.pdf' }), null);
});

test('county stand-in polygons for incorporated land are not treated as districts', () => {
  const { isMunicipalPlaceholder } = load('app/land-intelligence/zoning.ts');
  const boulder = { state: 'Colorado', stateCode: 'CO', county: 'Boulder County', city: 'Boulder', incorporated: true, authority: 'Boulder, CO' };
  assert.equal(isMunicipalPlaceholder({ code: 'XBO', description: 'Boulder', futureLandUse: '' }, boulder), true);
  assert.equal(isMunicipalPlaceholder({ code: 'RR', description: 'Rural Residential', futureLandUse: '' }, boulder), false);
  assert.equal(isMunicipalPlaceholder({ code: 'X', description: 'Unincorporated', futureLandUse: '' }, boulder), false);
});

test('census geography names the governing city, or the county when unincorporated', () => {
  const { jurisdictionFromCensus } = load('app/land-intelligence/zoning.ts');
  assert.equal(jurisdictionFromCensus(census('Charlotte')).authority, 'Charlotte, NC');
  const county = jurisdictionFromCensus(census(''));
  assert.equal(county.incorporated, false);
  assert.equal(county.authority, 'Mecklenburg County, NC');
  assert.equal(jurisdictionFromCensus({ result: { geographies: {} } }), null);
});

test('catalog ranking drops rezoning history and overlays and prefers named zoning layers', () => {
  const { rankCatalog } = load('app/land-intelligence/zoning.ts');
  const jurisdiction = { state: 'North Carolina', stateCode: 'NC', county: 'Mecklenburg County', city: 'Charlotte', incorporated: true, authority: 'Charlotte, NC' };
  const ranked = rankCatalog([
    { title: 'Rezoning History', owner: 'CharlotteNC', url: 'https://a/MapServer/0', numViews: 900 },
    { title: 'Child Safety Zones', owner: 'someone', url: 'https://b/FeatureServer', numViews: 800 },
    { title: 'Airport Overlay Zone', owner: 'CharlotteNC', url: 'https://c/MapServer/0', numViews: 700 },
    { title: 'City of Charlotte Zoning', owner: 'MecklenburgCoNC', url: 'https://d/FeatureServer/0', numViews: 10 },
  ], jurisdiction);
  assert.deepEqual(Array.from(ranked.map((item) => item.title)), ['City of Charlotte Zoning', 'Child Safety Zones']);
});

test('zoning route discovers a layer, retries off the street, then reuses the winning layer', async () => {
  const calls = [];
  const fetchMock = async (url) => {
    const href = String(url);
    calls.push(href);
    if (href.includes('geocoding.geo.census.gov')) return reply(census('Charlotte'));
    if (href.includes('arcgis.com/sharing/rest/search')) return reply({ results: [{ title: 'City of Charlotte Zoning', owner: 'MecklenburgCoNC', url: 'https://gis.example.gov/server/rest/services/Zoning/FeatureServer/0', numViews: 5 }] });
    if (href.includes('/Zoning/FeatureServer/0/query')) return reply({ features: href.includes('distance=12') ? [{ attributes: { zonedes: 'UC', zoneclass: 'UPTOWN MIXED USE' } }] : [] });
    throw new Error(`unexpected ${href}`);
  };
  const { GET } = load('app/api/land-intelligence/zoning/route.ts', fetchMock);
  const first = await GET(request(-80.8431, 35.2271));
  assert.equal(first.body.status, 'found');
  assert.equal(first.body.district.code, 'UC');
  assert.equal(first.body.source.method, 'catalog');
  assert.match(first.body.note, /Confirm with Charlotte, NC/);
  calls.length = 0;
  const second = await GET(request(-80.8432, 35.2272));
  assert.equal(second.body.district.code, 'UC');
  assert.equal(calls.some((href) => href.includes('sharing/rest/search')), false);
});

test('zoning route reports none, outside and unavailable honestly', async () => {
  const none = load('app/api/land-intelligence/zoning/route.ts', async (url) => String(url).includes('census') ? reply(census('')) : reply({ results: [] }));
  assert.equal((await none.GET(request(-80.7, 35.3))).body.status, 'none');
  const outside = load('app/api/land-intelligence/zoning/route.ts', async () => reply({ result: { geographies: {} } }));
  assert.equal((await outside.GET(request(-70, 35))).body.status, 'outside');
  const down = load('app/api/land-intelligence/zoning/route.ts', async () => { throw new Error('offline'); });
  assert.equal((await down.GET(request(-80.7, 35.3))).body.status, 'unavailable');
  assert.equal((await down.GET(request(10, 50))).status, 400);
});

function loadWithEnv(file, fetchMock, env) {
  const abs = path.resolve(file), exports = {};
  const requireLocal = (name) => name.startsWith('node:') ? require(name) : name === 'next/server'
    ? { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } }
    : loadWithEnv(name.startsWith('@/') ? name.slice(2) + '.ts' : path.resolve(path.dirname(abs), name) + '.ts', fetchMock, env);
  const { outputText } = ts.transpileModule(fs.readFileSync(abs, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(outputText, { exports, require: requireLocal, fetch: fetchMock, process: { env }, URL, URLSearchParams, AbortSignal, Date, Map, Set, Math, Number, String, Array, Object, JSON, Promise, Error }, { filename: abs });
  return exports;
}
const post = (body, ip = '1.1.1.1') => ({ json: async () => body, headers: new Headers({ 'x-forwarded-for': ip }) });
const openAiReply = (answer) => ({ ok: true, status: 200, json: async () => ({ output: [{ type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }] }) });
const answer = {
  codeTitle: 'Charlotte Unified Development Ordinance', codeUrl: 'https://charlottenc.gov/udo.pdf',
  districtSectionTitle: 'Section 9.904', districtSectionUrl: 'https://charlottenc.gov/udo.pdf#page=9',
  zoningMapUrl: 'https://charlottenc.gov/udo.pdf', districtName: 'Uptown Core', summary: 'Most intense mixed use.',
  permittedUses: ['Office', 'Residential'],
  standards: [
    { label: 'Maximum height', value: '400 feet', sourceUrl: 'https://charlottenc.gov/udo.pdf' },
    { label: 'Purpose', value: 'Vibrant 24 hour centre', sourceUrl: 'https://charlottenc.gov/udo.pdf' },
    { label: 'Front setback', value: '25 feet', sourceUrl: 'https://charlottenc.gov/deck-guide' },
    { label: 'Side setback', value: '5 feet', sourceUrl: 'https://charlottenc.gov/made-up-page' },
  ],
  sources: [{ title: 'UDO', url: 'https://charlottenc.gov/udo.pdf' }, { title: 'Blog', url: 'http://127.0.0.1/admin' }, { title: 'Gone', url: 'https://charlottenc.gov/made-up-page' }],
  confidence: 'high',
};

test('code links reject internal hosts and mark official publishers', () => {
  const { publicUrl, isOfficial, sanitizeZoningCode } = load('app/land-intelligence/zoning-code.ts');
  for (const bad of ['http://127.0.0.1/x', 'https://localhost/x', 'https://user:pw@city.gov/x', 'https://city.gov:8443/x', 'file:///etc/passwd', 'https://intranet/x', 'https://box.internal/x']) assert.equal(publicUrl(bad), '', bad);
  assert.equal(isOfficial('https://library.municode.com/co/boulder'), true);
  assert.equal(isOfficial('https://bouldercolorado.gov/zoning'), true);
  assert.equal(isOfficial('https://someblog.com/zoning'), false);
  const clean = sanitizeZoningCode(answer);
  assert.equal(clean.zoningMap, null, 'a map that repeats the ordinance URL is dropped');
  assert.deepEqual(Array.from(clean.standards.map((item) => item.label)), ['Maximum height', 'Side setback']);
  assert.equal(clean.sources.some((item) => item.url.includes('127.0.0.1')), false);
  assert.equal(sanitizeZoningCode({ confidence: 'certain' }).confidence, 'low');
});

test('code route asks with server-derived zoning, drops dead links and caches', async () => {
  const prompts = [];
  let openAiCalls = 0;
  const fetchMock = async (url, options = {}) => {
    const href = String(url);
    if (href.includes('geocoding.geo.census.gov')) return reply(census('Charlotte'));
    if (href.includes('arcgis.com/sharing/rest/search')) return reply({ results: [{ title: 'City of Charlotte Zoning', owner: 'MecklenburgCoNC', url: 'https://gis.example.gov/server/rest/services/Zoning/FeatureServer/0', numViews: 5 }] });
    if (href.includes('/Zoning/FeatureServer/0/query')) return reply({ features: [{ attributes: { zonedes: 'UC', zoneclass: 'UPTOWN MIXED USE' } }] });
    if (href === 'https://api.openai.com/v1/responses') { openAiCalls++; prompts.push(JSON.parse(options.body).input[1].content); return openAiReply(answer); }
    assert.equal(options.redirect, 'manual', 'link checks never follow redirects');
    return { ok: !href.includes('made-up'), status: href.includes('made-up') ? 404 : 200, body: null };
  };
  const { POST } = loadWithEnv('app/api/land-intelligence/zoning-code/route.ts', fetchMock, { OPENAI_API_KEY: 'test', OPENAI_MODEL: 'gpt-4o-mini' });
  const first = await POST(post({ lng: -80.8431, lat: 35.2271, district: 'ignore me', jurisdiction: 'Evil, XX' }));
  assert.equal(first.status, 200);
  assert.equal(first.body.status, 'found');
  assert.equal(first.body.district.code, 'UC');
  assert.match(prompts[0], /"code":"UC"/);
  assert.match(prompts[0], /Charlotte, NC/);
  assert.doesNotMatch(prompts[0], /ignore me|Evil/);
  assert.deepEqual(Array.from(first.body.standards.map((item) => item.label)), ['Maximum height']);
  assert.deepEqual(Array.from(first.body.sources.map((item) => item.url)), ['https://charlottenc.gov/udo.pdf']);
  assert.match(first.body.note, /not legal advice/);
  await POST(post({ lng: -80.8432, lat: 35.2272 }));
  assert.equal(openAiCalls, 1, 'same jurisdiction and district is served from cache');
});

test('code route needs a key, a U.S. point, and stops a visitor after five paid lookups', async () => {
  const none = loadWithEnv('app/api/land-intelligence/zoning-code/route.ts', async () => { throw new Error('no network'); }, {});
  assert.equal((await none.POST(post({ lng: -80.8, lat: 35.2 }))).status, 503);
  assert.equal((await none.POST(post({ lng: 2.35, lat: 48.85 }))).status, 400);
  // Each call lands in a different town so none is a cache hit; every one would be a paid lookup.
  let town = 0, openAiCalls = 0;
  const fetchMock = async (url) => {
    const href = String(url);
    if (href.includes('geocoding.geo.census.gov')) return reply(census(`Town${town++}`));
    if (href.includes('sharing/rest/search')) return reply({ results: [] });
    if (href.includes('api.openai.com')) { openAiCalls++; return openAiReply(answer); }
    return { ok: true, status: 200, body: null };
  };
  const { POST } = loadWithEnv('app/api/land-intelligence/zoning-code/route.ts', fetchMock, { OPENAI_API_KEY: 'test' });
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await POST(post({ lng: -80.8 - i / 100, lat: 35.2 }, '9.9.9.9'))).status);
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
  assert.equal(openAiCalls, 5);
  assert.equal((await POST(post({ lng: -81.5, lat: 35.2 }, '8.8.8.8'))).status, 200, 'another visitor is unaffected');
});

test('property fill keeps only plausible, sourced values for blank fields and never trusts a parcel mismatch', () => {
  const { missingFields, sanitizePropertyFill, formatFilled, PROPERTY_FILL_SCHEMA } = load('app/land-intelligence/property-fill.ts');
  const detail = { sales: [], parcel: { landUse: '', landValue: 50000, ownerType: '' }, assessedTotal: null, assessedLand: null, assessedImprovements: null, taxableValue: 41297, estimatedMarketValue: null, annualPropertyTax: null, yearBuilt: null, livingAreaSqft: null, buildingCount: null, deedAcres: null, legalDescription: '25 5 69 COLUMBINE KNOLLS' };
  const wanted = missingFields(detail);
  assert.equal(wanted.includes('taxableValue'), false, 'feed values are never replaced');
  assert.equal(wanted.includes('assessedLand'), false, 'the map feed land value already fills that row');
  assert.equal(wanted.includes('yearBuilt'), true);
  assert.equal(PROPERTY_FILL_SCHEMA.properties.parcelMatch.enum.length, 2);
  const src = 'https://www.arapahoegov.com/assessor/parcel/123';
  const answer = { parcelMatch: 'exact', recordUrl: src,
    yearBuilt: { value: '1974', sourceUrl: src }, livingAreaSqft: { value: '1,850 sq ft', sourceUrl: src },
    buildingCount: { value: 'two', sourceUrl: src }, annualPropertyTax: { value: '$3,412.50', sourceUrl: 'https://www.zillow.com/x' },
    assessedTotal: { value: '$1.2M', sourceUrl: src }, landUse: { value: 'Single family', sourceUrl: '' },
    estimatedMarketValue: { value: '450000', sourceUrl: 'http://10.0.0.1/x' }, taxableValue: { value: '1', sourceUrl: src } };
  const { fields } = sanitizePropertyFill(answer, wanted);
  assert.deepEqual(Object.keys(fields).sort(), ['annualPropertyTax', 'livingAreaSqft', 'yearBuilt']);
  assert.equal(fields.yearBuilt.value, 1974);
  assert.equal(fields.yearBuilt.official, true);
  assert.equal(fields.annualPropertyTax.official, false);
  assert.equal(formatFilled('livingAreaSqft', fields.livingAreaSqft.value), '1,850 sq ft');
  assert.deepEqual(Object.keys(sanitizePropertyFill({ ...answer, parcelMatch: 'none' }, wanted).fields), []);
});

test('property fill route builds the prompt from the source record, verifies sources, and caches per parcel', async () => {
  const prompts = [];
  let openAiCalls = 0;
  const parcelAttributes = { OBJECTID: 8, parcel_id: '2077-04-1-01-001', countyName: 'Arapahoe', situsAdd: '7079 S MARSHALL ST', sitAddCty: 'LITTLETON', landAcres: 0.25, asedValTot: 41297, legalDesc: '25 5 69 COLUMBINE KNOLLS' };
  const fetchMock = async (url, options = {}) => {
    const href = String(url);
    if (href.includes('Colorado_Public_Parcels')) return { ok: true, text: async () => JSON.stringify({ features: [{ attributes: parcelAttributes }] }) };
    if (href === 'https://api.openai.com/v1/responses') {
      openAiCalls++;
      const request = JSON.parse(options.body);
      prompts.push(request);
      return openAiReply({ parcelMatch: 'exact', recordUrl: 'https://www.arapahoegov.com/record', yearBuilt: { value: '1974', sourceUrl: 'https://www.arapahoegov.com/record' }, livingAreaSqft: { value: '1850', sourceUrl: 'https://www.arapahoegov.com/record' }, assessedLand: { value: '$200,000', sourceUrl: 'https://dead.example.gov/gone' }, deedAcres: { value: '0.25', sourceUrl: 'https://www.arapahoegov.com/record' } });
    }
    if (href.includes('dead')) return { ok: false, status: 404, headers: new Headers(), body: null };
    return { ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html' }), body: null, text: async () => '<html><script>var x=1850</script><table><tr><td>Year Built</td><td>1974</td></tr></table></html>' };
  };
  const { POST } = loadWithEnv('app/api/land-intelligence/property-fill/route.ts', fetchMock, { OPENAI_API_KEY: 'test', OPENAI_MODEL: 'gpt-4o-mini' });
  assert.equal((await POST(post({ key: 'co:8 OR 1=1' }))).status, 400);
  const first = await POST(post({ key: 'co:8', address: 'ignore me' }));
  assert.equal(first.status, 200);
  assert.equal(prompts[0].temperature, 0, 'deterministic call');
  assert.match(prompts[0].input[1].content, /7079 S MARSHALL ST/);
  assert.doesNotMatch(prompts[0].input[1].content, /ignore me/);
  assert.doesNotMatch(prompts[0].input[1].content, /taxableValue/, 'fields the feed already has are not requested');
  assert.deepEqual(Object.keys(first.body.fields), ['yearBuilt'], 'kept only what the cited page shows: script text, echoed acres and dead pages do not count');
  assert.equal(first.body.notFound.includes('livingAreaSqft'), true);
  await POST(post({ key: 'co:8' }));
  assert.equal(openAiCalls, 1, 'the same parcel is answered from cache');
});

test('a filled value must appear in its source page text', () => {
  const { valueOnPage } = load('app/land-intelligence/property-fill.ts');
  const page = 'Parcel 59-252 Year Built 1973 Living Area 1,850 sq ft Total Actual Value $512,340 Taxes $3,412.50 Buildings: 1 Acres .424';
  assert.equal(valueOnPage('yearBuilt', 1973, page), true);
  assert.equal(valueOnPage('livingAreaSqft', 1850, page), true);
  assert.equal(valueOnPage('estimatedMarketValue', 512340, page), true);
  assert.equal(valueOnPage('annualPropertyTax', 3412.5, page), true);
  assert.equal(valueOnPage('deedAcres', 0.424, page), true);
  assert.equal(valueOnPage('buildingCount', 1, page), true);
  assert.equal(valueOnPage('estimatedMarketValue', 500000, page), false, 'a rounded guess is rejected');
  assert.equal(valueOnPage('livingAreaSqft', 185, page), false, 'no partial-number matches');
  assert.equal(valueOnPage('buildingCount', 1, 'Search by address. Step 1 of 2.'), false, 'a bare count needs the word building nearby');
  assert.equal(valueOnPage('yearBuilt', 1973, 'Enter an address to search property records.'), false, 'a search form shows no values');
});

test('every missing detail except zoning and owners is requested, and small numbers need their label', () => {
  const { missingFields, isUseCode, valueOnPage, FILL_FIELDS } = load('app/land-intelligence/property-fill.ts');
  assert.equal(Object.keys(FILL_FIELDS).some((key) => /zon|owner(?!Type)/i.test(key)), false, 'zoning and owner names are not part of the fill');
  const florida = { sales: [], parcel: { landUse: 'DOR code 000', landValue: 39488, ownerType: '' }, assessedTotal: 59019, assessedLand: 39488, assessedImprovements: null, taxableValue: 59019, estimatedMarketValue: 39488, annualPropertyTax: null, yearBuilt: null, livingAreaSqft: null, buildingCount: null, deedAcres: null, legalDescription: 'RESUB OF PORTION OF SEC 7' };
  assert.deepEqual(Array.from(missingFields(florida)).sort(), ['annualPropertyTax', 'assessedImprovements', 'bathrooms', 'bedrooms', 'buildingCount', 'deedAcres', 'landUse', 'lastSaleDate', 'lastSalePrice', 'livingAreaSqft', 'ownerType', 'yearBuilt']);
  assert.equal(isUseCode('DOR code 000'), true);
  assert.equal(isUseCode('Single family residential'), false);
  const record = 'Bedrooms: 3 Bathrooms: 2 Buildings: 1 Use: Vacant Residential';
  assert.equal(valueOnPage('bedrooms', 3, record), true);
  assert.equal(valueOnPage('bathrooms', 2, record), true);
  assert.equal(valueOnPage('bathrooms', 3, record), false, '"3 Bathrooms:" belongs to the bedroom label');
  assert.equal(valueOnPage('bedrooms', 2, record), false);
  assert.equal(valueOnPage('bathrooms', 2.5, '3 beds 2.5 baths 1,850 sqft'), true);
  assert.equal(valueOnPage('bedrooms', 3, '3 beds 2.5 baths'), true);
  assert.equal(valueOnPage('landUse', 'Vacant Residential', record), true);
});

test('vacant-land zeros are kept only beside their label, and Florida county codes read as names', () => {
  const { sanitizePropertyFill, valueOnPage } = load('app/land-intelligence/property-fill.ts');
  const src = 'https://www.hcpao.org/record/1';
  const { fields } = sanitizePropertyFill({ parcelMatch: 'exact', recordUrl: src, assessedImprovements: { value: '$0', sourceUrl: src }, taxableValue: { value: '$0', sourceUrl: src } }, ['assessedImprovements', 'taxableValue']);
  assert.equal(fields.assessedImprovements.value, 0);
  assert.equal('taxableValue' in fields, false, 'a $0 only counts where vacant land makes it meaningful');
  assert.equal(valueOnPage('assessedImprovements', 0, 'Land Value $39,488 Improvement Value $0'), true);
  assert.equal(valueOnPage('assessedImprovements', 0, 'Page 1 of 0 results. Land Value $39,488'), false);
  assert.equal(valueOnPage('annualPropertyTax', 453, 'Total Taxes (2025): $453.00'), true, 'non-zero amounts need no label');
  const { PARCEL_SOURCES, normalizeParcel } = load('app/land-intelligence/parcel-sources.ts');
  const florida = PARCEL_SOURCES.find((source) => source.id === 'fl');
  assert.equal(normalizeParcel(florida, { PARCEL_ID: 'x', CO_NO: 38 }).county, 'Highlands');
  assert.equal(normalizeParcel(florida, { PARCEL_ID: 'x', CO_NO: 23 }).county, 'Miami-Dade');
  assert.equal(normalizeParcel(florida, { PARCEL_ID: 'x', CO_NO: 99 }).county, 'County code 99');
});

test('Florida DOR use codes read as land uses without AI', () => {
  const { floridaUse, PARCEL_SOURCES, normalizeParcel } = load('app/land-intelligence/parcel-sources.ts');
  assert.equal(floridaUse('000'), 'Vacant residential (DOR 000)');
  assert.equal(floridaUse('001'), 'Single family (DOR 001)');
  assert.equal(floridaUse('010'), 'Vacant commercial (DOR 010)');
  assert.equal(floridaUse('038'), 'Commercial (DOR 038)');
  assert.equal(floridaUse('099'), 'Miscellaneous (DOR 099)');
  assert.equal(floridaUse('0100'), 'DOR code 0100', 'unrecognised formats stay as given');
  const florida = PARCEL_SOURCES.find((source) => source.id === 'fl');
  const vacant = normalizeParcel(florida, { PARCEL_ID: 'x', DOR_UC: '000' });
  assert.equal(vacant.category, 'residential');
  const { isUseCode } = load('app/land-intelligence/property-fill.ts');
  assert.equal(isUseCode(vacant.landUse), false, 'a decoded use is not sent to the AI fill');
});

test('county and Florida appraiser domains count as official; listing sites do not', () => {
  const { isOfficial } = load('app/land-intelligence/zoning-code.ts');
  for (const url of ['https://www.hcpao.org/r/1', 'https://www.leepa.org/x', 'https://www.ocpafl.org/x', 'https://www.sc-pa.com/x', 'https://www.arapahoegov.com/x', 'https://propertysearch.jeffco.us/x'])
    assert.equal(isOfficial(url), true, url);
  for (const url of ['https://www.zillow.com/x', 'https://www.redfin.com/x', 'https://www.realtor.com/x'])
    assert.equal(isOfficial(url), false, url);
});

test('county field maps: conventions first, contradictory or personal fields ruled out, primary fields preferred', () => {
  const { patternFieldMap, checkFieldMap, recordDate, readRecord } = load('app/land-intelligence/county-record.ts');
  const names = ['PIN', 'STTYRBLT', 'STTYRBLT2', 'SLSDT', 'SLSAMT', 'SLSAMT2', 'ASMASDTOT', 'ASMASDLND', 'ASMASDIMP', 'TOTACTVAL', 'TOTACTLNDV', 'PYRTOTVAL', 'GENBIL', 'GENBIL1', 'LGLRCP', 'LOTSQFT', 'STTNBRFLR', 'OWNNAM', 'KCTP_ADDR'];
  const attributes = { PIN: '59-252-07-015', STTYRBLT: 1966, STTYRBLT2: 0, SLSDT: '06252021', SLSAMT: 730000, SLSAMT2: 0, ASMASDTOT: 54459, ASMASDLND: 15877, ASMASDIMP: 38582, TOTACTVAL: 870860, TOTACTLNDV: 233479, PYRTOTVAL: 870860, GENBIL: 5951, GENBIL1: 5632.2, LGLRCP: '2021098691', LOTSQFT: 4320, STTNBRFLR: 2, OWNNAM: 'A PERSON', KCTP_ADDR: '1 MAIN ST' };
  const record = { layer: { url: 'https://gis.example.gov/Parcel/FeatureServer/0', name: 'Parcel', fields: names.map((name) => ({ name, alias: name })) }, attributes };
  const byPattern = patternFieldMap(record);
  assert.equal(byPattern.assessedTotal, 'ASMASDTOT');
  assert.equal(byPattern.estimatedMarketValue, 'TOTACTVAL');
  assert.equal(byPattern.yearBuilt, 'STTYRBLT');
  assert.equal(byPattern.lastSalePrice, 'SLSAMT');
  const checked = checkFieldMap({ assessedTotal: 'TOTACTVAL', estimatedMarketValue: 'TOTACTLNDV', taxableValue: 'PYRTOTVAL', legalDescription: 'LGLRCP', livingAreaSqft: 'LOTSQFT', bathrooms: 'STTNBRFLR', annualPropertyTax: 'GENBIL1', landUse: 'OWNNAM', yearBuilt: 'NOT_A_FIELD' }, names);
  assert.deepEqual({ ...checked }, { annualPropertyTax: 'GENBIL' }, 'only the tax bill survives, moved to its primary field');
  assert.equal(recordDate('06252021'), '2021-06-25');
  assert.equal(recordDate('20210625'), '2021-06-25');
  assert.equal(recordDate(1624579200000), '2021-06-25');
  assert.equal(recordDate('6/25/2021'), '2021-06-25');
  assert.equal(recordDate('13252021'), null);
  const read = readRecord(record, { ...byPattern, legalDescription: 'LGLRCP' }, ['assessedTotal', 'assessedLand', 'assessedImprovements', 'estimatedMarketValue', 'lastSaleDate', 'legalDescription']);
  assert.equal(read.assessedTotal.value, 54459);
  assert.equal(read.assessedTotal.field, 'ASMASDTOT');
  assert.equal(read.lastSaleDate.value, '2021-06-25');
  assert.equal('legalDescription' in read, false, 'a recording number is not a legal description');
  const mismatched = readRecord({ ...record, attributes: { ...attributes, ASMASDTOT: 99999 } }, byPattern, ['assessedTotal', 'assessedLand', 'assessedImprovements']);
  assert.deepEqual(Object.keys(mismatched), [], 'parts that do not add up are all dropped');
});

test('county record only counts when it names the tapped parcel', async () => {
  const layerMeta = { name: 'Parcel', geometryType: 'esriGeometryPolygon', fields: ['OBJECTID', 'PIN', 'ADDR_HN', 'ADDR_SN', 'ADDR_ST', 'STTYRBLT'].map((name) => ({ name, alias: name })) };
  const features = [{ attributes: { OBJECTID: 1, PIN: 'ROW', ADDR_HN: null, STTYRBLT: null } }, { attributes: { OBJECTID: 2, PIN: '8823900905', ADDR_HN: '5027', ADDR_SN: '16TH', STTYRBLT: 1925 } }, { attributes: { OBJECTID: 3, PIN: '8823900910', ADDR_HN: '5023', ADDR_SN: '16TH', STTYRBLT: 1912 } }];
  const fetchMock = async (url) => {
    const href = String(url);
    if (href.includes('sharing/rest/search')) return reply({ results: [{ title: 'Parcels for King County', owner: 'KingCountyGIS', url: 'https://gis.kingcounty.gov/arcgis/rest/services/Parcel/FeatureServer/0' }] });
    if (href.includes('/query?')) return reply({ features: href.includes('distance=') ? features : [features[0]] });
    return reply(layerMeta);
  };
  const { findCountyRecord } = load('app/land-intelligence/county-record.ts', fetchMock);
  const found = await findCountyRecord({ lng: -122.31, lat: 47.66, county: 'King County', state: 'Washington', parcelId: '033-8823900910', address: '5023 16TH AVE NE, SEATTLE' });
  assert.equal(found.attributes.PIN, '8823900910', 'a right-of-way strip and the neighbour are skipped');
  const none = await findCountyRecord({ lng: -122.31, lat: 47.66, county: 'King County', state: 'Washington', parcelId: '999', address: '1 OTHER ST' });
  assert.equal(none, null);
  const addressOnly = await findCountyRecord({ lng: -122.31, lat: 47.66, county: 'King County', state: 'Washington', parcelId: '999', address: '5023 16TH AVE NE, SEATTLE' });
  assert.equal(addressOnly, null, 'the same street address cannot attach a different parcel record');
});
