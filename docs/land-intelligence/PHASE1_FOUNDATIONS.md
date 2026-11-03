# Phase 1: data validation and foundations

Property & Market Intelligence expansion, Phase 1 of 6. Work date: 2026-11-01. Baseline: [PROPERTY_MARKET_AUDIT.md](PROPERTY_MARKET_AUDIT.md) and the earlier audits in this folder.

**Status: implementation complete; phase gate NOT passed.** Four required checks remain blocked by things outside the code (§6). They are listed explicitly rather than counted as done.

Evidence labels: **Live** means a real request from this workstation to the provider or to the app's own routes, on 2026-11-01. **Local data** means computed from the ignored Boulder snapshot or CSVs, aggregates only. **Test** means the automated suite (mocked providers unless stated otherwise).

---

## 1. Live provider verification: six statewide parcel services

This network reached the GIS services this time. Earlier audits could only read metadata.

### 1.1 Schema check (live metadata)

Every field the app requests (`PARCEL_SOURCES[].fields` and `PARCEL_DETAIL_FIELDS`) exists in each live layer. **No missing fields.**

| Source | Live layer name | Max records | Native CRS | Last edit (service) | GeoJSON |
| --- | --- | ---: | --- | --- | --- |
| CO | Colorado_Public_Parcel_Composite | 2,000 | 4326 | not published; county rows dated `4/23/2026` (`dateReceived`) | yes |
| UT | StateWideParcels | 2,000 | 3857 | 2026-10-23 | yes |
| WA | Parcels_2026 | 2,000 | 2927 | 2026-09-24 | yes |
| FL | CADASTRAL_DOR | 2,000 | 6439 | 2026-10-23 | yes |
| NC | Parcels (polys) | 5,000 | 2264 | not published | yes |
| WI | V1200_WisconsinParcels_2026 | 2,000 | 3857 | 2026-06-30 | yes |

The NC URL path contains `/secure/`, but it answered without authentication.

### 1.2 End-to-end through the app's own routes (live, production build)

A real bounded query ran in each state through `/parcel-map` (a 0.004° box), then `/parcel-detail` and `/parcel-inspection` for one returned parcel. The build was `next build --experimental-build-mode compile` + `generate`, then `next start` (see §5 for why the standard build was not used).

| State | Probe area | Parcels returned | With property ID | Detail | ID map = detail | Inspection |
| --- | --- | ---: | ---: | --- | --- | --- |
| CO | Boulder | 199 | 199 | 200 | yes | 200, 1.4 s |
| UT | Salt Lake City | 112 | 112 | 200 | yes | 200, 0.6 s |
| WA | Olympia | 73 | 73 | 200 | yes | 200, 0.8 s |
| FL | Tallahassee | 59 | 59 | 200 | yes | 200, 1.6 s |
| NC | Raleigh | 97 | 97 | 200 | yes | 200, 1.0 s |
| WI | Madison | 464 | 464 | 200 | yes | 200, 0.9 s |

**Result:** all six parcel providers are **verified working (live, 2026-11-01)** for map, detail and inspection. This is a dated probe, not an uptime guarantee.

### 1.3 Other inspection and research sources (live)

| Source | Result | Action |
| --- | --- | --- |
| USGS karst (CONUS_Karst) | **Was failing in every state.** The live layers key rows by `FID`; the code requested `OBJECTID`, and the service rejected the query ("'outFields' parameter is invalid"). | **Fixed.** Live after the fix: FL `found(1)` (Tallahassee carbonate karst), the other five `no_features`. |
| FEMA NFHL (`hazards.fema.gov`) | `source_error` in every state. The TLS handshake is reset for curl and Node; `www.fema.gov` loads, but the whole `hazards.fema.gov` host refuses this network. | **External blocker.** The code is correct: it reports `source_error`, never "no flood zone". Verify from a production or other network. |
| Census ACS (`api.census.gov`) | **Was failing silently.** Keyless requests now redirect (302) to `missing_key.html`. | **Fixed** to use optional `CENSUS_API_KEY` and explain its absence. No keyless request is sent. A free key is still needed (§6). |
| USGS EPQS elevation | Answers with HTTP 200 but takes 1.0–8.6 s per request; the drawing report showed `found` on one run and `unavailable` on another. | Documented as provider latency. Unchanged in Phase 1. |
| NRCS soils, NWI, NHD, Qfaults, EPA ECHO, Superfund, USMIN, NOAA marks, USGS water sites, CDOT highway/local/bridges, CO tanks, FL subsidence, Census geocoder, Photon search | All answered. Statuses were consistent with location (e.g. CO-only sources `outside_coverage` elsewhere). | None. |
| `/identify`, `/search`, `/soil-detail`, `/terrain`, `/report` (area) | HTTP 200 live | None. |

Remaining `coverage_unknown` states (wetlands, superfund, CO local roads) are the existing honest-empty semantics, not failures.

---

## 2. Colorado value labels (confirmed, fixed)

**Field definition evidence.**

- *Publisher aliases (live metadata):* `apprValTot` = "Parcel Total Value", `asedValTot` = "Taxable Value". The service description defines nothing further.
- *Comparison with county data (live + local data):* 24 Boulder parcels (the 3 fixtures plus 21 sampled single-account folios) were compared against the county's own Values table:
  - `apprValTot` equals the county **actual value** on **23 of 24**.
  - `asedValTot` equals the county **assessed value** on **0 of 24**. It is actual × a class rate: 6.25% on residential samples, 27% on a commercial sample. The county's assessed totals use different rates.

**Bug.** `apprValTot` was stored as `assessedTotal`, so the printable report labeled the county's actual (market) value "Assessed total". `asedValTot` was shown as a plain "Taxable value" with no caution.

**Fix** (`app/land-intelligence/parcel-detail.ts`):

- `apprValTot` → `estimatedMarketValue`, labeled **"County actual value"**.
- `asedValTot` → `taxableValue`, labeled **"Statewide taxable value"**, with a caution that it can differ from the county assessed value and tax bill.
- `assessedTotal` is now empty for CO, because the feed has no county assessed value.

Labels now come from the record (`valueLabels.market/taxable`, plus `valueNote`) in Map Inspection, the headline card and the printable report. Boulder's own value tab says "Actual value" / "Assessed value", which are the county's terms, instead of "Appraised".

### Florida values were doubled (found live, fixed)

The Florida detail added `AV_SD + AV_NSD` and `TV_SD + TV_NSD`. Per the [Florida DOR NAL user guide](https://www.geoplan.ufl.edu/agol/archived_content/Parcels/2010_NAL_SDF_NAP_UserGuide_091510.pdf), these are the **school-district** and **county non-school** values of the *same* parcel. On 300 live parcels they were equal on 286, so the "assessed total" was about 2× just value.

**Fix:**

- Show the county (non-school) roll, labeled "Assessed value (county)" / "Taxable value (county)".
- Show the school roll in a note only when it differs.
- A real `$0` taxable value (exempt parcel) is kept.

Live after the fix: Tallahassee sample assessed `511,303`, which equals just value (previously `1,022,606`).

---

## 3. Boulder sale-date validation (fixed)

**Findings (local data, Sales.csv, 753,371 rows):**

- **610** rows are dated `12/30/1899`. That's the spreadsheet "day zero", i.e. a missing date.
- **3** rows are dated after the county data date (`10/25/2026`): `11/6/2026`, `9/25/2027`, `10/16/2027`. All are unqualified (`U`) with no price.
- **73** rows from 1868–1898 are kept as genuine territorial-era and early recordings. Boulder County was created on 1861-11-01; none of the remaining rows predate it.

**Fix** (`app/land-intelligence/sale-date.ts`, applied in `boulder-property.ts` on read, so the existing snapshot is corrected without re-import):

- Each deed gets an ISO `date`, the county's original `recordedDate`, and a `dateIssue` of `placeholder` | `before_county` | `after_source` | `unparseable` when it fails validation.
- The UI and report show the reason instead of a misleading date.
- `parcelHeadline` never treats a deed with a withheld date as the latest sale.

---

## 4. Stable property identifiers and parcel matching (implemented, verified)

**Problem.** Selection keys are `<state>:<OBJECTID>`. OBJECTIDs are row numbers in one publication of a hosted layer, so they are not durable.

**Fix** (`parcel-sources.ts`): every parcel record now carries `propertyId = <state>:<county>:<parcel number>`.

- The county part uses the source's own code where it has one (WA `FIPS_NR`, FL `CO_NO`), otherwise its county name.
- Selection keys are unchanged, so no existing behavior moved.
- `propertyId` is shown in Map Inspection and the printable report.

**Live findings:**

- **Map and detail agree:** the property ID from the map equals the one from detail in all six states.
- **Join to county records:** across six Boulder County towns (Boulder, Longmont, Lafayette, Nederland, Louisville, rural Niwot), **1,712 of 1,717 (99.7%)** distinct statewide properties joined to the county snapshot by `propertyId`. The 5 misses (e.g. `146330300000`, `157508400000`) end in zeros and look like right-of-way or placeholder parcels (assumption).
- **Stacked rows (CO):** the statewide layer has 144,551 Boulder rows against 130,112 county folios. Duplicate rows share one parcel number, polygon, account and value, but carry different situs addresses (6 rows for one parcel in the sample). `propertyId` correctly collapses them to one property.
- **Multipart pieces (WA):** in Olympia, 8 parcel numbers were published as separate polygon rows with *different* geometry. **Limitation:** selecting one piece inspects only that piece. A per-property union is deferred (see §7).
- **Cross-county collisions** are prevented by the county segment (covered by tests).

---

## 5. Boulder County data rights (audited, enforced; unresolved)

**Live check of the county's pages:**

- The [assessor data download page](https://bouldercounty.gov/property-and-land/assessor/data-download/) carries **no license**. Its disclaimer says the data was "developed solely for internal use only by Boulder County", disclaims warranty and liability, and the footer reads "All Rights Reserved". It now lists nine files (refreshed daily at 4 a.m.).
- The county's [Open Data terms](https://bouldercounty.gov/government/open-data/terms-of-use/) grant a royalty-free reuse license with attribution, but only for "the Boulder County Open Data Catalog". They do not mention assessor data. The page also mislabels its license as both CC BY 4.0 and "CC0 4.0".

**Conclusion:** publication rights are **unresolved and arguably more restrictive than previously recorded**. Bulk republication of owner, deed and permit rows must not happen until the county confirms in writing.

**Enforcement added (was missing).** Before this change, a `next build` on any machine holding the ignored snapshot would package it into the production function. Now there are two layers:

1. **Build** (`next.config.js`): the snapshot is packaged only when `LAND_BOULDER_DATA_APPROVED=true`.
   - *Verified, unapproved build:* `parcel-detail` trace contains **0** Boulder files.
   - *Verified, approved build:* **257** files (manifest + 256 buckets of the active snapshot only).
2. **Runtime** (`boulder-property.ts`): a production server returns `rights_pending` and serves no Boulder rows without approval, even if files are present.
   - *Verified live:* production server, Boulder parcel → `rights_pending`.
   - The panel and report explain the withholding. Development and tests keep full access.

Statewide Colorado parcel data remains usable: its [service terms](https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/MapServer) allow commercial application use with State attribution and forbid resale, re-confirmed live.

---

## 6. External blockers (Phase 1 gate)

| # | Blocker | Why it blocks | Who / next step |
| --- | --- | --- | --- |
| B1 | **Boulder rights unconfirmed** | No production use of the county snapshot. It also blocks Phase 3 comps on Boulder data in production. | Owner: ask the Boulder County Assessor in writing whether the download CSVs (and derived aggregates) may be republished. |
| B2 | **FEMA `hazards.fema.gov` unreachable from this network** | The flood source cannot be verified live. | Re-run the probe from Vercel or another network. The code path itself is correct. |
| B3 | **Census Data API key** | ACS is unavailable everywhere until a key is configured. It is also a Phase 4 dependency. | Owner: request a free key at api.census.gov and set `CENSUS_API_KEY` in Vercel. |
| B4 | **`main` does not pass `npm run build`**: `app/dinosors/sim/nav.ts(173,13) Cannot find name 't'`, committed in `3894e81` | No standard production build or deployment. Land Intelligence was verified with compile/generate builds instead. | Fix in the Dinosaur Land codebase (outside this phase's scope; not touched). |
| B5 | **Browser visual and accessibility pass not performed** | Labels, rights notice and date flags are verified in code, routes and tests, but not on screen. | Manual desktop and mobile check of Map Inspection and print in a working browser. |

---

## 7. Open issues carried forward (not blockers for Phase 2 code)

- **WA multipart parcels:** inspection covers only the selected piece. Proposal: union all rows sharing a `propertyId` server-side, behind the same geometry validation. This needs its own tests.
- **Agency-viewer comparison:** Colorado values were checked against the county's own data file, not its web viewer. The three Boulder fixtures are still unverified in the viewer.
- **Utah** carries no owner, sale or value fields in the statewide layer (live), and is a non-disclosure state. No sale-based analytics are possible there.
- **Photon** public geocoder fair-use policy not reviewed (search works live).
- **EPQS latency** causes intermittent elevation `unavailable` in the drawing report.

---

## 8. Changes made

| File | Change |
| --- | --- |
| `app/land-intelligence/parcel-detail.ts` | CO value mapping and labels; FL school/county rolls no longer summed; `valueLabels.taxable/market`, `valueNote` |
| `app/land-intelligence/parcel-sources.ts` | `propertyId` on every parcel record; `propertyId()` helper |
| `app/land-intelligence/sale-date.ts` (new) | Client-safe Boulder deed-date validation and labels |
| `app/land-intelligence/boulder-property.ts` | Normalizes deed dates on read; `rights_pending` production gate |
| `app/land-intelligence/parcel-headline.ts` | Skips withheld-date deeds; source-specific value label |
| `app/land-intelligence/MapInspection.tsx` | Source value labels and notes; date-issue display; property ID row; rights notice |
| `app/land-intelligence/export-parcel-report.ts` | Same labels, property ID, date issues and rights notice in print |
| `app/api/land-intelligence/parcel-inspection/route.ts` | Karst `FID` fix; inspection cache version 3 → 4 |
| `app/api/land-intelligence/report/route.ts` | Optional `CENSUS_API_KEY`; no keyless Census call |
| `next.config.js` | Boulder snapshot packaged only with `LAND_BOULDER_DATA_APPROVED=true` |
| `tests/land-intelligence-foundations.test.cjs` (new) | 7 tests: dates, headline, labels, FL rolls, property IDs, rights gate, real-snapshot fixtures |
| `tests/land-intelligence-phase4.test.cjs` | Census key in harness; keyless-report test |
| `tests/land-intelligence-phase5.test.cjs`, `tests/land-intelligence-terrain.test.cjs` | Updated CO expectation; `process.env` stub in harness |

**New environment variables** (both optional; absent means the safe behavior):

- `LAND_BOULDER_DATA_APPROVED` — set to `true` only after B1 is resolved.
- `CENSUS_API_KEY` — free key from the Census Bureau.

## 9. Verification run

- `node --test tests/land-intelligence-*.test.*` → **74/74 pass** (66 before this phase + 7 in the new foundations file + 1 keyless-Census test in phase4). The two fixture/rights tests read the real local snapshot.
- `npx tsc --noEmit` → no Land Intelligence errors. The only error is B4.
- `next build --experimental-build-mode compile` + `generate` → succeeds. Trace counts are in §5.
- Live production-mode route checks: §1.2–1.3, §4, §5.
- Probe scripts and raw outputs were kept outside the repo (session scratchpad). No owner names or addresses were printed or stored.
