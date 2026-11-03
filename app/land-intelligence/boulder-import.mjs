import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

export const BOULDER_DATA_URL = 'https://assessor.boco.solutions/ASR_PublicDataFiles/';
export const TABLES = ['Account_Parcels', 'Owner_Address', 'Buildings', 'Land', 'Permits', 'Sales', 'Values'];
const text = (value) => String(value ?? '').trim();
const number = (value) => { const clean = text(value).replace(/[$,\s]/g, ''); return clean && /^-?\d+(?:\.\d+)?$/.test(clean) ? Number(clean) : null; };
const positive = (value) => { const n = number(value); return n != null && n > 0 ? n : null; };
const field = (row, ...names) => { for (const name of names) { const value = row[name.toLowerCase().replace(/[^a-z0-9]/g, '')]; if (text(value)) return text(value); } return ''; };
const record = (headers, values) => Object.fromEntries(headers.map((header, index) => [header.toLowerCase().replace(/[^a-z0-9]/g, ''), values[index] ?? '']));

// CSV fields can span chunks and lines; parse before joining by account number.
export async function* csvRows(stream) {
  let headers = null, cells = [], cell = '', quoted = false, quotePending = false;
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    const input = Buffer.isBuffer(chunk) ? decoder.decode(chunk, { stream: true }) : String(chunk);
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (quotePending) { quotePending = false; if (char === '"') { cell += '"'; continue; } quoted = false; }
      if (quoted) { if (char === '"') quotePending = true; else cell += char; }
      else if (char === '"' && cell.length === 0) quoted = true;
      else if (char === ',') { cells.push(cell); cell = ''; }
      else if (char === '\n') { cells.push(cell.replace(/\r$/, '')); cell = ''; if (!headers) headers = cells.map((name) => name.replace(/^\uFEFF/, '')); else if (cells.some(Boolean)) yield record(headers, cells); cells = []; }
      else cell += char;
    }
  }
  if (quotePending) quoted = false;
  if (quoted) throw new Error('Unclosed quoted CSV field');
  if (cell || cells.length) { cells.push(cell.replace(/\r$/, '')); if (headers) yield record(headers, cells); }
}

const blankAccount = (accountNo) => ({ accountNo, linkedParcelCount: 1, siteAddress: '', owners: [], ownerships: [], subdivision: '', legalDescription: '', taxArea: '', millLevy: null, accountType: '', neighborhood: '', city: '', unit: '', plss: '', landUses: [], land: [], buildings: [], sales: [], permits: [], values: null });
// Help manual (2/11/2026): pct_own is a fraction; joint tenants each carry 1, and 0 "is likely just a data error".
const share = (raw) => { const n = number(raw); return n != null && n > 0 && n <= 1 ? n : null; };
// One building/section per bld_num + section_num. The county repeats a building's row once per basement type,
// so later rows only add their basement area (by type) instead of becoming another building.
const buildingFrom = (row) => ({
  buildingNumber: field(row, 'bld_num'), section: field(row, 'section_num'), design: field(row, 'designCodeDscr', 'bldgClassDscr'), buildingClass: field(row, 'bldgClassDscr'),
  quality: field(row, 'qualityCodeDscr'), construction: field(row, 'ConstCodeDscr'), yearBuilt: positive(field(row, 'builtYear')), effectiveYear: positive(field(row, 'EffectiveYear')),
  percentComplete: (() => { const n = number(field(row, 'CompCode')); return n != null && n >= 0 && n <= 1 ? n : null; })(),
  bedrooms: number(field(row, 'nbrBedRoom')), fullBaths: number(field(row, 'nbrFullBaths')), halfBaths: number(field(row, 'nbrHalfBaths')), threeQuarterBaths: number(field(row, 'nbrThreeQtrBaths')),
  finishedSqft: positive(field(row, 'TotalFinishedSF')), mainFloorSqft: positive(field(row, 'mainfloorSF')), basementSqft: null, basements: [], garageSqft: positive(field(row, 'carStorageSF')), garageType: field(row, 'carStorageTypeDscr'),
  stories: positive(field(row, 'Stories')), units: positive(field(row, 'UnitCount')), heating: field(row, 'HeatingDscr'), cooling: field(row, 'AcDscr'), exteriorWall: field(row, 'ExtWallDscrPrim'), roof: field(row, 'Roof_CoverDscr'),
});
const addBasement = (building, row) => {
  const sqft = positive(field(row, 'bsmtSF')); if (sqft == null) return;
  const type = field(row, 'bsmtTypeDscr', 'bsmtType') || 'Basement';
  const existing = building.basements.find((item) => item.type === type);
  if (existing) existing.sqft = Math.max(existing.sqft, sqft); else building.basements.push({ type, sqft });
  building.basementSqft = building.basements.reduce((total, item) => total + item.sqft, 0);
};
export function createBoulderIndex() {
  const parcels = new Map(), accountToFolios = new Map();
  let sourceDate = '';
  const getAccount = (folio, accountNo) => {
    let parcel = parcels.get(folio);
    if (!parcel) { parcel = { folio, accounts: [] }; parcels.set(folio, parcel); }
    let account = parcel.accounts.find((item) => item.accountNo === accountNo);
    if (!account) { account = blankAccount(accountNo); parcel.accounts.push(account); }
    return account;
  };
  const ingest = (table, row) => {
    const accountNo = field(row, 'strap', 'accountNo');
    if (table === 'Account_Parcels') {
      const folio = field(row, 'folio', 'Parcelno');
      if (!folio || !accountNo) return;
      if (!accountToFolios.has(accountNo)) accountToFolios.set(accountNo, new Set());
      accountToFolios.get(accountNo).add(folio);
      getAccount(folio, accountNo); return;
    }
    const directFolio = field(row, 'folio');
    const folios = directFolio ? [directFolio] : [...(accountToFolios.get(accountNo) ?? [])];
    for (const folio of folios) {
      const account = getAccount(folio, accountNo);
      if (table === 'Owner_Address') {
        sourceDate ||= field(row, 'CreatedDate');
        const name = field(row, 'owner_name');
        if (name && !account.owners.includes(name)) {
          account.owners.push(name);
          const role = field(row, 'role_cd').toUpperCase();
          account.ownerships.push({ name, role: role === 'P' ? 'primary' : role === 'S' ? 'secondary' : '', share: share(field(row, 'pct_own')) });
        }
        account.siteAddress ||= [field(row, 'str_num'), field(row, 'str_pfx'), field(row, 'Str'), field(row, 'str_sfx'), field(row, 'str_unit')].filter(Boolean).join(' ');
        account.subdivision ||= field(row, 'sub_dscr'); account.legalDescription ||= field(row, 'legalDscr'); account.taxArea ||= field(row, 'taxArea'); account.millLevy ??= number(field(row, 'mill_levy')); account.accountType ||= field(row, 'account_type');
        account.neighborhood ||= field(row, 'nh').replace(/^(\d+)\.0+$/, '$1'); account.city ||= field(row, 'city'); account.unit ||= field(row, 'str_unit');
        account.plss ||= [field(row, 'section') && `Sec ${field(row, 'section')}`, field(row, 'township') && `T${field(row, 'township')}`, field(row, 'range') && `R${field(row, 'range')}`].filter(Boolean).join(' ');
      } else if (table === 'Buildings') {
        const [buildingNumber, section] = [field(row, 'bld_num'), field(row, 'section_num')];
        let building = account.buildings.find((item) => item.buildingNumber === buildingNumber && item.section === section);
        if (!building) { building = buildingFrom(row); account.buildings.push(building); }
        addBasement(building, row);
      }
      else if (table === 'Land') {
        const use = field(row, 'landClassDscr'); if (use && !account.landUses.includes(use)) account.landUses.push(use);
        account.land.push({ landClass: field(row, 'landClass'), use, unitType: field(row, 'landUnitType'), units: positive(field(row, 'landUnitValue')), gisSqft: positive(field(row, 'GIS_sqft')), gisAcres: positive(field(row, 'GIS_acreage')) });
      }
      else if (table === 'Sales') account.sales.push({ date: field(row, 'Tdate'), price: positive(field(row, 'Price')), qualification: field(row, 'sales_cd'), deedType: field(row, 'deed_type'), reception: field(row, 'deedNum') });
      else if (table === 'Permits') account.permits.push({ number: field(row, 'permit_num'), category: field(row, 'permit_category'), date: field(row, 'issue_dt'), description: field(row, 'Description'), estimatedValue: positive(field(row, 'estimated_value')), issuedBy: field(row, 'issued_by') });
      else if (table === 'Values') account.values = {
        taxYear: field(row, 'tax_yr'), actualTotal: number(field(row, 'totalActualVal')), actualLand: number(field(row, 'LandAcutalVal', 'landActualVal')), actualBuildings: number(field(row, 'bldAcutalVal', 'bldActualVal')), actualExtraFeatures: number(field(row, 'xfActualVal')),
        assessedTotal: number(field(row, 'totalAssessedVal')), assessedSchool: number(field(row, 'totalAssessedVal_School')), assessedLand: number(field(row, 'landAssessedVal')), assessedBuildings: number(field(row, 'bldAssessedVal')),
      };
    }
  };
  return { parcels, accountToFolios, ingest, get sourceDate() { return sourceDate; } };
}

// Comparison profile: what a comparable sale is matched on. One definition, computed here and read at runtime.
// Building accounts compare on the primary building class and its finished area; accounts without a building row
// compare as land on county GIS square feet. Characteristics are the county's current record, not as of each sale.
export function accountProfile(account) {
  const landSqft = account.land.reduce((total, land) => total + (land.gisSqft ?? 0), 0) || null;
  if (!account.buildings.length) {
    const use = account.land[0]?.use;
    return use && landSqft ? { type: `LAND: ${use}`, basis: 'land', units: landSqft, landSqft, yearBuilt: null, effectiveYear: null, bedrooms: null, quality: '' } : null;
  }
  const primary = account.buildings.reduce((best, item) => (item.finishedSqft ?? 0) > (best.finishedSqft ?? 0) ? item : best);
  const type = primary.buildingClass || primary.design;
  if (!type) return null;
  // Sections of the same class (a split-level house, a multi-section office) add up; a detached garage of another class does not.
  const units = account.buildings.filter((item) => (item.buildingClass || item.design) === type).reduce((total, item) => total + (item.finishedSqft ?? 0), 0) || null;
  return { type, basis: 'building', units, landSqft, yearBuilt: primary.yearBuilt, effectiveYear: primary.effectiveYear, bedrooms: primary.bedrooms, quality: primary.quality };
}

const isoDate = (raw) => { const m = text(raw).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/) ?? text(raw).match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return ''; const [y, mo, d] = m[0].includes('/') ? [m[3], m[1], m[2]] : [m[1], m[2], m[3]]; return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`; };
const CHANGE_PERMIT = /NEW CONSTRUCTION|ADDITION|DEMOLI/i;
export const COMPS_WINDOW_YEARS = 5;

/**
 * Qualified (Q), priced sales of single-parcel accounts in the last five years before the county data date. A sale of a
 * building account whose primary building was built after the sale year is dropped: the price was for land.
 * The five-year window also excludes the county's 1899 placeholder and any date after the data date.
 */
export function buildCompsIndex(parcels, sourceDate, points = {}) {
  const asOf = isoDate(sourceDate) || new Date().toISOString().slice(0, 10);
  const start = `${Number(asOf.slice(0, 4)) - COMPS_WINDOW_YEARS}${asOf.slice(4)}`;
  const rows = [];
  for (const [folio, parcel] of parcels) for (const account of parcel.accounts) {
    if ((account.linkedParcelCount ?? 1) !== 1 || !account.profile?.units) continue;
    for (const sale of account.sales) {
      const date = isoDate(sale.date);
      if (sale.qualification.toUpperCase() !== 'Q' || !sale.price || !date || date < start || date > asOf) continue;
      if (account.profile.basis === 'building' && account.profile.yearBuilt && account.profile.yearBuilt > Number(date.slice(0, 4))) continue;
      const changedAfterSale = account.permits.some((permit) => CHANGE_PERMIT.test(permit.category) && isoDate(permit.date) > date) || account.buildings.some((item) => item.percentComplete != null && item.percentComplete < 1);
      rows.push({ folio, account: account.accountNo, date, price: sale.price, reception: sale.reception, deedType: sale.deedType, siteAddress: account.siteAddress, city: account.city, neighborhood: account.neighborhood, subdivision: account.subdivision, ...account.profile, point: points[folio] ?? null, changedAfterSale });
    }
  }
  return { asOf, windowStart: start, rows };
}

export function bucketForFolio(folio) {
  let hash = 2166136261;
  for (const char of folio) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16).slice(-2).padStart(2, '0');
}

export async function buildBoulderSnapshot({ inputDir, outputDir, fetchImpl = fetch }) {
  const index = createBoulderIndex();
  const { parcels, ingest } = index;
  for (const table of TABLES) {
    const name = `${table}.csv`;
    const stream = inputDir ? createReadStream(join(inputDir, name)) : await (async () => {
      let response;
      try { response = await fetchImpl(`${BOULDER_DATA_URL}${name}`, { signal: AbortSignal.timeout(180_000) }); }
      catch (error) { throw new Error(`Could not download ${name} from Boulder County. Use --input with the seven county CSV files if this network blocks the download. ${error.message}`); }
      if (!response.ok || !response.body) throw new Error(`${name}: HTTP ${response.status}`);
      return Readable.fromWeb(response.body);
    })();
    let count = 0;
    for await (const row of csvRows(stream)) { ingest(table, row); count++; }
    if (!count) throw new Error(`${name} contained no data rows; the snapshot was not published`);
    process.stdout.write(`${name}: ${count.toLocaleString()} rows\n`);
  }
  if (parcels.size === 0) throw new Error('No Boulder parcel records were joined');
  for (const parcel of parcels.values()) for (const account of parcel.accounts) {
    account.linkedParcelCount = index.accountToFolios.get(account.accountNo)?.size ?? 1;
    account.profile = accountProfile(account);
  }
  // Parcel points come from boulder-centroids.mjs (State of Colorado polygons); without them comps match by neighborhood only.
  let centroids = null;
  try { centroids = JSON.parse(gunzipSync(await readFile(join(outputDir, 'centroids.json.gz'))).toString('utf8')); } catch { /* optional */ }
  const comps = buildCompsIndex(parcels, index.sourceDate, centroids?.points);
  const snapshot = `snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const snapshotDir = join(outputDir, snapshot);
  await mkdir(snapshotDir, { recursive: true });
  const buckets = new Map();
  for (const [folio, parcel] of parcels) { const bucket = bucketForFolio(folio); if (!buckets.has(bucket)) buckets.set(bucket, {}); buckets.get(bucket)[folio] = parcel; }
  for (const [bucket, records] of buckets) await writeFile(join(snapshotDir, `${bucket}.json.gz`), gzipSync(JSON.stringify(records), { level: 6 }));
  const compsMeta = { ...comps, centroids: centroids ? { fetchedAt: centroids.fetchedAt, attribution: centroids.attribution, folios: centroids.folios } : null };
  await writeFile(join(snapshotDir, 'comps.json.gz'), gzipSync(JSON.stringify(compsMeta), { level: 6 }));
  // schema 2: merged basement rows, ownership roles/shares, land rows, extra-feature and school assessed values.
  // schema 3: per-account comparison profile and comps.json.gz (qualified sales index).
  const manifest = { updatedAt: new Date().toISOString(), sourceDate: index.sourceDate, snapshot, format: 'json-gzip-v1', schema: 3, parcelCount: parcels.size, compsCount: comps.rows.length, compsWithLocation: comps.rows.filter((row) => row.point).length, source: 'Boulder County Assessor public CSV', sourceUrl: 'https://bouldercounty.gov/property-and-land/assessor/data-download/' };
  const temporary = join(outputDir, 'manifest.next.json'); await writeFile(temporary, JSON.stringify(manifest)); await rename(temporary, join(outputDir, 'manifest.json'));
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inputAt = process.argv.indexOf('--input');
  const inputDir = inputAt >= 0 ? resolve(process.argv[inputAt + 1] ?? '') : undefined;
  if (inputAt >= 0 && !process.argv[inputAt + 1]) throw new Error('--input needs a directory of Boulder County CSV files');
  // Keep the joined county snapshot out of Next.js public static assets.
  const outputDir = resolve('data/land-intelligence/boulder');
  buildBoulderSnapshot({ inputDir, outputDir }).then((manifest) => process.stdout.write(`Boulder snapshot: ${manifest.parcelCount.toLocaleString()} parcels\n`)).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
