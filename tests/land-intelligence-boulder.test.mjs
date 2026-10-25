import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { buildBoulderSnapshot, bucketForFolio, csvRows, TABLES } from '../app/land-intelligence/boulder-import.mjs';

test('CSV parser keeps quoted commas and chunked quotes', async () => {
  const chunks = ['folio,owner_name\r\n123,"Doe, ', 'Jane"\r\n456,"Two""', ' names"\r\n'];
  const rows = [];
  for await (const row of csvRows(Readable.from(chunks))) rows.push(row);
  assert.deepEqual(rows, [{ folio: '123', ownername: 'Doe, Jane' }, { folio: '456', ownername: 'Two" names' }]);
});

test('Boulder snapshot keeps shared accounts and histories separate by folio', async () => {
  const inputDir = await mkdtemp(join(tmpdir(), 'li-boulder-input-'));
  const outputDir = await mkdtemp(join(tmpdir(), 'li-boulder-output-'));
  const files = {
    Account_Parcels: 'strap,Parcelno\nR1,146512312020\nR2,146512312020\nR1,146512312021\n',
    Owner_Address: 'strap,folio,CreatedDate,owner_name,str_num,Str,account_type\nR1,146512312020,2026-10-17,"Doe, Jane",10,Main,Residential\nR2,146512312020,2026-10-17,Other Owner,10,Main,Commercial\n',
    Buildings: 'Strap,bld_num,designCodeDscr,builtYear,nbrBedRoom,mainfloorSF\nR1,1,Single Family,1990,3,1200\n',
    Land: 'Strap,landClassDscr\nR1,Residential land\n',
    Permits: 'Strap,permit_num,permit_category,issue_dt,Description\nR1,P-123,REMODEL,2020-05-01,Kitchen\n',
    Sales: 'Strap,Tdate,Price,deedNum\nR1,2019-01-01,500000,ABC1\nR1,2021-01-01,600000,ABC2\nR2,2018-01-01,300000,XYZ1\n',
    Values: 'Strap,tax_yr,totalActualVal,LandAcutalVal,bldAcutalVal,totalAssessedVal\nR1,2025,700000,200000,500000,50000\nR2,2025,200000,100000,100000,15000\n',
  };
  for (const table of TABLES) await writeFile(join(inputDir, `${table}.csv`), files[table]);
  const manifest = await buildBoulderSnapshot({ inputDir, outputDir });
  assert.equal(manifest.parcelCount, 2);
  assert.equal(manifest.sourceDate, '2026-10-17');
  const savedManifest = JSON.parse(await readFile(join(outputDir, 'manifest.json'), 'utf8'));
  assert.equal(savedManifest.snapshot, manifest.snapshot);
  assert.equal(savedManifest.format, 'json-gzip-v1');
  const bucket = JSON.parse(gunzipSync(await readFile(join(outputDir, manifest.snapshot, `${bucketForFolio('146512312020')}.json.gz`))).toString('utf8'));
  const accounts = bucket['146512312020'].accounts;
  assert.equal(accounts.length, 2);
  assert.deepEqual(accounts[0].owners, ['Doe, Jane']);
  assert.equal(accounts[0].sales.length, 2);
  assert.equal(accounts[1].sales.length, 1);
  assert.equal(accounts[0].values.actualTotal, 700000);
  assert.equal(accounts[0].values.actualLand, 200000);
  assert.equal(accounts[0].values.actualBuildings, 500000);
  assert.equal(accounts[1].values.actualTotal, 200000);
  assert.equal(accounts[0].buildings[0].bedrooms, 3);
  assert.equal(accounts[0].permits[0].number, 'P-123');
  assert.equal(accounts[0].permits[0].category, 'REMODEL');
  assert.equal(accounts[0].linkedParcelCount, 2);
  assert.equal(accounts[1].linkedParcelCount, 1);
  const otherBucket = JSON.parse(gunzipSync(await readFile(join(outputDir, manifest.snapshot, `${bucketForFolio('146512312021')}.json.gz`))).toString('utf8'));
  assert.deepEqual(otherBucket['146512312021'].accounts.map((item) => item.accountNo), ['R1']);
  assert.equal(otherBucket['146512312021'].accounts[0].linkedParcelCount, 2);
});

