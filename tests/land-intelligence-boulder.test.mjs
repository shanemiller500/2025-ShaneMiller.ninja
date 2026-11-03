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


test('Boulder snapshot schema 2 merges basement rows, keeps ownership roles and never stores mailing addresses', async () => {
  const inputDir = await mkdtemp(join(tmpdir(), 'li-boulder-input-'));
  const outputDir = await mkdtemp(join(tmpdir(), 'li-boulder-output-'));
  const files = {
    Account_Parcels: 'strap,Parcelno\nR1,146512312020\n',
    Owner_Address: 'strap,folio,CreatedDate,owner_name,role_cd,pct_own,mailingAddr1,mailingCity,nh,section,township,range,city,str_unit\n'
      + 'R1,146512312020,2026-10-17,Doe Jane,P,0.5,123 Private Rd,Elsewhere,174.00,24,1N,71,BOULDER,\nR1,146512312020,2026-10-17,Roe Sam,S,0.5,123 Private Rd,Elsewhere,174.00,24,1N,71,BOULDER,\n',
    // One building with two basement types (two county rows) plus a second building.
    Buildings: 'strap,bld_num,section_num,designCodeDscr,builtYear,TotalFinishedSF,mainfloorSF,bsmtSF,bsmtTypeDscr,Stories,UnitCount,qualityCodeDscr,ConstCodeDscr,CompCode\n'
      + 'R1,1,1,Ranch,1980,1800,1800,600,FINISHED,1,,GOOD,Frame,1\nR1,1,1,Ranch,1980,1800,1800,400,UNFINISHED,1,,GOOD,Frame,1\nR1,2,1,Detached garage,1985,,,,,,,AVERAGE,Frame,0.75\n',
    Land: 'strap,landClass,landClassDscr,landUnitType,landUnitValue,GIS_sqft,GIS_acreage\nR1,1112,Single Fam Res Land,SF,9000,9100,0.21\n',
    Permits: 'strap,permit_num,permit_category,issue_dt,Description\nR1,P-1,REMODEL,1/5/2020 12:00:00 AM,Kitchen\n',
    Sales: 'strap,Tdate,Price,deedNum,sales_cd,deed_type\nR1,1/1/2019 12:00:00 AM,500000,ABC1,Q,WD\n',
    Values: 'strap,tax_yr,totalActualVal,LandAcutalVal,bldAcutalVal,xfActualVal,totalAssessedVal,totalAssessedVal_School\nR1,2026,700000,200000,500000,0,43750,47250\n',
  };
  for (const table of TABLES) await writeFile(join(inputDir, `${table}.csv`), files[table]);
  const manifest = await buildBoulderSnapshot({ inputDir, outputDir });
  assert.equal(manifest.schema, 3);
  const raw = gunzipSync(await readFile(join(outputDir, manifest.snapshot, `${bucketForFolio('146512312020')}.json.gz`))).toString('utf8');
  assert.doesNotMatch(raw, /Private Rd|Elsewhere|mailing/i, 'mailing addresses are never written');
  const [account] = JSON.parse(raw)['146512312020'].accounts;
  assert.equal(account.buildings.length, 2, 'a second basement-type row is not a second building');
  assert.deepEqual(account.buildings[0].basements, [{ type: 'FINISHED', sqft: 600 }, { type: 'UNFINISHED', sqft: 400 }]);
  assert.equal(account.buildings[0].basementSqft, 1000);
  assert.equal(account.buildings[0].finishedSqft, 1800);
  assert.equal(account.buildings[0].quality, 'GOOD');
  assert.equal(account.buildings[1].percentComplete, 0.75);
  assert.deepEqual(account.ownerships, [{ name: 'Doe Jane', role: 'primary', share: 0.5 }, { name: 'Roe Sam', role: 'secondary', share: 0.5 }]);
  assert.equal(account.neighborhood, '174');
  assert.equal(account.plss, 'Sec 24 T1N R71');
  assert.deepEqual(account.land, [{ landClass: '1112', use: 'Single Fam Res Land', unitType: 'SF', units: 9000, gisSqft: 9100, gisAcres: 0.21 }]);
  assert.equal(account.values.assessedSchool, 47250);
  assert.equal(account.sales[0].qualification, 'Q');
  assert.equal(account.profile.type, 'Ranch', 'without a building class the design names the type');
  assert.equal(account.profile.units, 1800, 'only the primary building counts; the garage has no finished area');
});

test('comparison profiles and the comps index keep only usable qualified sales', async () => {
  const { accountProfile, buildCompsIndex } = await import('../app/land-intelligence/boulder-import.mjs');
  const { ringCentroid } = await import('../app/land-intelligence/boulder-centroids.mjs');
  const house = { buildingClass: 'SINGLE FAM RES IMPROVEMENTS', design: 'Ranch', finishedSqft: 1500, yearBuilt: 1990, effectiveYear: 2000, bedrooms: 3, quality: 'GOOD' };
  const account = (accountNo, extra) => ({ accountNo, linkedParcelCount: 1, siteAddress: '1 Main', city: 'BOULDER', neighborhood: '174', subdivision: 'S', land: [{ use: 'Res land', gisSqft: 8000 }], buildings: [house, { ...house, finishedSqft: 500, design: 'Split' }, { buildingClass: 'OTHER BLDGS', finishedSqft: 300 }], permits: [], sales: [], ...extra });
  const profile = accountProfile(account('R1'));
  assert.equal(profile.type, 'SINGLE FAM RES IMPROVEMENTS');
  assert.equal(profile.units, 2000, 'same-class sections add up; another class does not');
  assert.deepEqual({ ...accountProfile({ ...account('R2'), buildings: [] }) }, { type: 'LAND: Res land', basis: 'land', units: 8000, landSqft: 8000, yearBuilt: null, effectiveYear: null, bedrooms: null, quality: '' });
  const parcels = new Map();
  const add = (folio, acct) => { acct.profile = accountProfile(acct); parcels.set(folio, { folio, accounts: [acct] }); };
  add('A', account('R1', { sales: [{ date: '6/1/2024 12:00:00 AM', price: 900000, qualification: 'Q', deedType: 'WD', reception: 'r1' }, { date: '6/1/2024', price: 10, qualification: 'U', deedType: 'QD', reception: 'r2' }, { date: '6/1/2019', price: 500000, qualification: 'Q', deedType: 'WD', reception: 'old' }] }));
  add('B', account('R2', { linkedParcelCount: 2, sales: [{ date: '6/1/2024', price: 700000, qualification: 'Q', deedType: 'WD', reception: 'shared' }] }));
  add('C', account('R3', { buildings: [{ ...house, yearBuilt: 2025 }], sales: [{ date: '6/1/2023', price: 300000, qualification: 'Q', deedType: 'WD', reception: 'land-then' }] }));
  add('D', account('R4', { permits: [{ category: 'ADDITION', date: '1/1/2025' }], sales: [{ date: '6/1/2024', price: 800000, qualification: 'Q', deedType: 'WD', reception: 'changed' }] }));
  const index = buildCompsIndex(parcels, '10/25/2026 4:00:39 AM', { A: [-105.27, 40.01] });
  assert.equal(index.asOf, '2026-10-25');
  assert.equal(index.windowStart, '2021-10-25');
  assert.deepEqual(index.rows.map((row) => row.reception), ['r1', 'changed'], 'unqualified, old, shared-account and built-after-sale sales are excluded');
  assert.deepEqual(index.rows[0].point, [-105.27, 40.01]);
  assert.equal(index.rows[1].changedAfterSale, true);
  assert.equal(index.rows[1].point, null);
  assert.doesNotMatch(JSON.stringify(index), /owner/i, 'no owner names in the comps index');
  assert.deepEqual(ringCentroid([[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]), [1, 1]);
  assert.equal(ringCentroid([[[0, 0], [1, 1], [2, 2], [0, 0]]]), null, 'a degenerate ring has no centroid');
});
