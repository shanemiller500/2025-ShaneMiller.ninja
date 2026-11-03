import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// National market context from free federal files (public domain): Census ACS 2024 5-year table-based summary files
// (no API key), FHFA all-transactions house price indexes, and Census Building Permits Survey county files.
// Output: data/land-intelligence/market/{manifest.json,national.json.gz,state-<FIPS>.json.gz}.
export const ACS_YEAR = 2024;
const ACS_BASE = `https://www2.census.gov/programs-surveys/acs/summary_file/${ACS_YEAR}/table-based-SF/data/5YRData`;
export const ACS_METRICS = {
  population: ['B01003', 'E001'], medianIncome: ['B19013', 'E001'], housingUnits: ['B25001', 'E001'],
  occupied: ['B25002', 'E002'], vacant: ['B25002', 'E003'], owner: ['B25003', 'E002'], renter: ['B25003', 'E003'],
  medianYearBuilt: ['B25035', 'E001'], medianRent: ['B25064', 'E001'], rentBurden: ['B25071', 'E001'], medianValue: ['B25077', 'E001'],
  povertyUniverse: ['B17001', 'E001'], belowPoverty: ['B17001', 'E002'],
};
export const FHFA = {
  tract: 'https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv',
  metro: 'https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_at_metro.csv',
  state: 'https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_at_state.csv',
};
export const BPS_URL = (year) => `https://www2.census.gov/econ/bps/County/co${year}a.txt`;
export const TRACT_FIRST_YEAR = 2015, QUARTERS_KEPT = 41;

const num = (raw) => { const text = String(raw ?? '').replace(/[(),\s]/g, ''); if (!text || text === '-' || text === '.') return null; const n = Number(text); return Number.isFinite(n) ? n : null; };
// ACS annotation values (e.g. -666666666 "not available", -999999999 "too few samples") are negative sentinels, never data.
const acsValue = (raw) => { const n = num(raw); return n == null || n < 0 ? null : n; };

/** GEO_ID → { level, id } for the summary levels kept: nation 010, state 040, county 050, tract 140. */
export function acsGeography(geoId) {
  const match = String(geoId).match(/^(010|040|050|140)0000US(\d*)$/);
  if (!match) return null;
  const level = { '010': 'us', '040': 'state', '050': 'county', '140': 'tract' }[match[1]];
  const id = match[2];
  if ((level === 'state' && id.length !== 2) || (level === 'county' && id.length !== 5) || (level === 'tract' && id.length !== 11)) return null;
  return { level, id: level === 'us' ? 'us' : id };
}

async function* lines(path) { for await (const line of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) yield line; }

async function cached(url, cacheDir, refresh) {
  const path = join(cacheDir, url.replace(/^https?:\/\//, '').replace(/[^a-z0-9.]+/gi, '_'));
  if (!refresh && existsSync(path)) return path;
  const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
  if (!response.ok || !response.body) throw new Error(`${url}: HTTP ${response.status}`);
  const temporary = `${path}.part`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
  await rename(temporary, path);
  return path;
}

/** Reads one ACS table file into store[level][id].acs[metric] = [estimate, margin]. */
export async function ingestAcsTable(path, table, store) {
  let header = null;
  const wanted = Object.entries(ACS_METRICS).filter(([, [t]]) => t === table);
  let rows = 0;
  for await (const line of lines(path)) {
    const cells = line.split('|');
    if (!header) { header = cells; continue; }
    const geo = acsGeography(cells[0]);
    if (!geo) continue;
    const target = store.get(geo);
    for (const [metric, [, cell]] of wanted) {
      const e = header.indexOf(`${table}_${cell}`), m = header.indexOf(`${table}_${cell.replace('E', 'M')}`);
      target.acs[metric] = [acsValue(cells[e]), acsValue(cells[m])];
    }
    rows++;
  }
  return rows;
}

export function createStore() {
  const data = { us: { acs: {} }, states: {}, counties: {}, tracts: {}, metros: {} };
  const get = ({ level, id }) => {
    if (level === 'us') return data.us;
    const bag = level === 'state' ? data.states : level === 'county' ? data.counties : data.tracts;
    return (bag[id] ??= { acs: {} });
  };
  return { data, get };
}

/** FHFA annual tract file: tract,state_abbr,year,annual_change,hpi,hpi1990,hpi2000. Keeps the HPI from TRACT_FIRST_YEAR on. */
export async function ingestTracts(path, store) {
  const abbr = {};
  let header = true, lastYear = 0;
  for await (const line of lines(path)) {
    if (header) { header = false; continue; }
    const [tract, state, yearText, , hpiText] = line.split(',');
    const year = Number(yearText);
    if (!/^\d{11}$/.test(tract) || !year) continue;
    abbr[state] = tract.slice(0, 2);
    lastYear = Math.max(lastYear, year);
    if (year < TRACT_FIRST_YEAR) continue;
    const target = store.get({ level: 'tract', id: tract });
    (target.hpi ??= {})[year] = num(hpiText);
  }
  // Dense arrays from TRACT_FIRST_YEAR to the last published year.
  for (const tract of Object.values(store.data.tracts)) if (tract.hpi) {
    const values = [];
    for (let y = TRACT_FIRST_YEAR; y <= lastYear; y++) values.push(tract.hpi[y] ?? null);
    tract.hpi = values.some((value) => value != null) ? { first: TRACT_FIRST_YEAR, values } : undefined;
  }
  return { abbr, lastYear };
}

/** FHFA quarterly files keep the last QUARTERS_KEPT quarters per series. Metro: name,cbsa,year,qtr,index,(se). State: abbr,year,qtr,index. */
export async function ingestQuarterly(path, kind, store, abbr) {
  const series = {};
  for await (const line of lines(path)) {
    const cells = kind === 'metro' ? line.match(/("[^"]*"|[^,]+)/g) ?? [] : line.split(',');
    const [key, name, year, quarter, index, se] = kind === 'metro'
      ? [cells[1], cells[0].replace(/"/g, ''), cells[2], cells[3], cells[4], cells[5]]
      : [abbr[cells[0]], cells[0], cells[1], cells[2], cells[3], undefined];
    if (!key || !Number(year)) continue;
    (series[key] ??= { name, points: [] }).points.push([`${year}Q${quarter}`, num(index), num(se)]);
  }
  for (const [key, { name, points }] of Object.entries(series)) {
    const kept = points.slice(-QUARTERS_KEPT);
    const entry = { name, last: kept.at(-1)[0], index: kept.map((point) => point[1]), ...(kind === 'metro' ? { se: kept.map((point) => point[2]) } : {}) };
    if (kind === 'metro') store.data.metros[key] = entry; else store.get({ level: 'state', id: key }).hpi = entry;
  }
  return Object.keys(series).length;
}

/** Building Permits Survey county annual file: two header lines, then Date,State,County,Region,Division,Name, then bldgs/units/value for 1, 2, 3–4 and 5+ units. */
export async function ingestPermits(path, store) {
  let rows = 0;
  for await (const line of lines(path)) {
    const cells = line.split(',');
    if (!/^\d{4}$/.test(cells[0]?.trim() ?? '') || !/^\d{2}$/.test(cells[1]) || !/^\d{3}$/.test(cells[2])) continue;
    const units = [7, 10, 13, 16].map((index) => num(cells[index]) ?? 0);
    const target = store.get({ level: 'county', id: `${cells[1]}${cells[2]}` });
    (target.permits ??= []).push({ year: Number(cells[0]), units: units.reduce((a, b) => a + b, 0), single: units[0], twoToFour: units[1] + units[2], fivePlus: units[3], value: [8, 11, 14, 17].reduce((sum, index) => sum + (num(cells[index]) ?? 0), 0) });
    rows++;
  }
  return rows;
}

export async function buildMarket({ outputDir, cacheDir = join(tmpdir(), 'land-intelligence-market'), refresh = false, permitYears = [2020, 2021, 2022, 2023, 2024, 2025] }) {
  await mkdir(cacheDir, { recursive: true });
  const store = createStore();
  const fetchedAt = new Date().toISOString();
  const sources = [];
  const tables = [...new Set(Object.values(ACS_METRICS).map(([table]) => table))];
  for (const table of tables) {
    const url = `${ACS_BASE}/acsdt5y${ACS_YEAR}-${table.toLowerCase()}.dat`;
    const rows = await ingestAcsTable(await cached(url, cacheDir, refresh), table, store);
    sources.push({ id: `acs-${table}`, url, vintage: `ACS ${ACS_YEAR - 4}–${ACS_YEAR} 5-year`, rows });
    process.stdout.write(`ACS ${table}: ${rows.toLocaleString()} geographies\n`);
  }
  const { abbr, lastYear } = await ingestTracts(await cached(FHFA.tract, cacheDir, refresh), store);
  sources.push({ id: 'fhfa-tract', url: FHFA.tract, vintage: `annual through ${lastYear} (developmental)` });
  for (const kind of ['metro', 'state']) {
    const count = await ingestQuarterly(await cached(FHFA[kind], cacheDir, refresh), kind, store, abbr);
    sources.push({ id: `fhfa-${kind}`, url: FHFA[kind], vintage: `quarterly through ${kind === 'metro' ? Object.values(store.data.metros)[0]?.last : Object.values(store.data.states).find((s) => s.hpi)?.hpi.last}`, series: count });
  }
  for (const year of permitYears) {
    try {
      const rows = await ingestPermits(await cached(BPS_URL(year), cacheDir, refresh), store);
      sources.push({ id: `bps-${year}`, url: BPS_URL(year), vintage: `${year} annual`, rows });
    } catch (error) { process.stdout.write(`Building permits ${year}: ${error.message} (skipped)\n`); }
  }
  for (const county of Object.values(store.data.counties)) county.permits?.sort((a, b) => a.year - b.year);
  await mkdir(outputDir, { recursive: true });
  const byState = {};
  for (const [id, county] of Object.entries(store.data.counties)) ((byState[id.slice(0, 2)] ??= { counties: {}, tracts: {} }).counties[id] = county);
  for (const [id, tract] of Object.entries(store.data.tracts)) ((byState[id.slice(0, 2)] ??= { counties: {}, tracts: {} }).tracts[id] = tract);
  for (const [fips, bundle] of Object.entries(byState)) await writeFile(join(outputDir, `state-${fips}.json.gz`), gzipSync(JSON.stringify(bundle), { level: 9 }));
  await writeFile(join(outputDir, 'national.json.gz'), gzipSync(JSON.stringify({ us: store.data.us, states: store.data.states, metros: store.data.metros }), { level: 9 }));
  const manifest = { builtAt: fetchedAt, acsYear: ACS_YEAR, tractHpiThrough: lastYear, states: Object.keys(byState).length, counties: Object.keys(store.data.counties).length, tracts: Object.keys(store.data.tracts).length, metros: Object.keys(store.data.metros).length, sources };
  const temporary = join(outputDir, 'manifest.next.json');
  await writeFile(temporary, JSON.stringify(manifest, null, 1));
  await rename(temporary, join(outputDir, 'manifest.json'));
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildMarket({ outputDir: resolve('data/land-intelligence/market'), refresh: process.argv.includes('--refresh') })
    .then((manifest) => process.stdout.write(`Market data: ${manifest.tracts.toLocaleString()} tracts, ${manifest.counties.toLocaleString()} counties, ${manifest.metros} metros, ${manifest.states} states\n`))
    .catch((error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
}
