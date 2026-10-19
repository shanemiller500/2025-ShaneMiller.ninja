import { createReadStream } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

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

const blankAccount = (accountNo) => ({ accountNo, siteAddress: '', owners: [], subdivision: '', legalDescription: '', taxArea: '', millLevy: null, accountType: '', landUses: [], buildings: [], sales: [], permits: [], values: null });
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
      const folio = field(row, 'folio');
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
        if (name && !account.owners.includes(name)) account.owners.push(name);
        account.siteAddress ||= [field(row, 'str_num'), field(row, 'str_pfx'), field(row, 'Str'), field(row, 'str_sfx'), field(row, 'str_unit')].filter(Boolean).join(' ');
        account.subdivision ||= field(row, 'sub_dscr'); account.legalDescription ||= field(row, 'legalDscr'); account.taxArea ||= field(row, 'taxArea'); account.millLevy ??= number(field(row, 'mill_levy')); account.accountType ||= field(row, 'account_type');
      } else if (table === 'Buildings') account.buildings.push({ buildingNumber: field(row, 'bld_num'), design: field(row, 'designCodeDscr', 'bldgClassDscr'), yearBuilt: positive(field(row, 'builtYear')), effectiveYear: positive(field(row, 'EffectiveYear')), bedrooms: number(field(row, 'nbrBedRoom')), fullBaths: number(field(row, 'nbrFullBaths')), halfBaths: number(field(row, 'nbrHalfBaths')), threeQuarterBaths: number(field(row, 'nbrThreeQtrBaths')), mainFloorSqft: positive(field(row, 'mainfloorSF')), basementSqft: positive(field(row, 'bsmtSF')), garageSqft: positive(field(row, 'carStorageSF')) });
      else if (table === 'Land') { const use = field(row, 'landClassDscr'); if (use && !account.landUses.includes(use)) account.landUses.push(use); }
      else if (table === 'Sales') account.sales.push({ date: field(row, 'Tdate'), price: positive(field(row, 'Price')), qualification: field(row, 'sales_cd'), deedType: field(row, 'deed_type'), reception: field(row, 'deedNum') });
      else if (table === 'Permits') account.permits.push({ number: field(row, 'permit_num'), date: field(row, 'issue_dt'), description: field(row, 'Description'), estimatedValue: positive(field(row, 'estimated_value')), issuedBy: field(row, 'issued_by') });
      else if (table === 'Values') account.values = { taxYear: field(row, 'tax_yr'), actualTotal: number(field(row, 'totalActualVal')), actualLand: number(field(row, 'landActualVal')), actualBuildings: number(field(row, 'bldActualVal')), assessedTotal: number(field(row, 'totalAssessedVal')) };
    }
  };
  return { parcels, ingest, get sourceDate() { return sourceDate; } };
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
  const snapshot = `snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const snapshotDir = join(outputDir, snapshot);
  await mkdir(snapshotDir, { recursive: true });
  const buckets = new Map();
  for (const [folio, parcel] of parcels) { const bucket = bucketForFolio(folio); if (!buckets.has(bucket)) buckets.set(bucket, {}); buckets.get(bucket)[folio] = parcel; }
  for (const [bucket, records] of buckets) await writeFile(join(snapshotDir, `${bucket}.json`), JSON.stringify(records));
  const manifest = { updatedAt: new Date().toISOString(), sourceDate: index.sourceDate, snapshot, parcelCount: parcels.size, source: 'Boulder County Assessor public CSV', sourceUrl: 'https://bouldercounty.gov/property-and-land/assessor/data-download/' };
  const temporary = join(outputDir, 'manifest.next.json'); await writeFile(temporary, JSON.stringify(manifest)); await rename(temporary, join(outputDir, 'manifest.json'));
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inputAt = process.argv.indexOf('--input');
  const inputDir = inputAt >= 0 ? resolve(process.argv[inputAt + 1] ?? '') : undefined;
  if (inputAt >= 0 && !process.argv[inputAt + 1]) throw new Error('--input needs a directory of Boulder County CSV files');
  const outputDir = resolve('public/land-intelligence/boulder');
  buildBoulderSnapshot({ inputDir, outputDir }).then((manifest) => process.stdout.write(`Boulder snapshot: ${manifest.parcelCount.toLocaleString()} parcels\n`)).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
