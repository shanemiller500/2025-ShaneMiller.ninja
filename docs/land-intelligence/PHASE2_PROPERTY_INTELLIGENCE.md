# Phase 2: complete property intelligence

Property & Market Intelligence expansion, Phase 2 of 6. Work date: 2026-11-01 (local snapshot rebuilt 2026-11-02 UTC). Builds on [PHASE1_FOUNDATIONS.md](PHASE1_FOUNDATIONS.md).

**Status: implementation complete; release gated.**
- **Data:** everything uses data the app already had (statewide parcel services plus the local Boulder assessor files). No new provider, paid service or AI was added.
- **Production gate:** the Boulder-based features stay withheld in production until the county confirms republication rights (blocker B1, unchanged).
- **Not yet done:** the browser visual pass (B5).

**Value types** (shown in the UI and the report):
- **Official record** values come straight from the county or state source.
- **Code-based classification** applies the source's own published code definitions.
- **Calculated** values are arithmetic on records and are marked with a purple "calculated" tag.
- **Rule-based** labels (owner entity type) are marked as such.

---

## 1. What was added

| Area | Source / definition | Detail |
| --- | --- | --- |
| **Unified sales history** | Boulder Sales table + statewide sale fields | One newest-first list per property. Each record shows date (or the withheld-date reason), price, source, deed type, reception/reference, and multi-parcel/shared-account flags. A statewide sale that repeats a county deed (same date and price) is shown once. |
| **Sale qualification** | Boulder help manual: Q = qualified arm's-length, U = unqualified, P = pending. Florida DOR NAL guide: codes 01–05, 11–20, 30–42, 98–99 | Each sale is labeled market / qualified-but-changed / non-market / pending / unknown. Florida codes the guide does not define (06, 21, 43) are shown as codes only. CO, NC, WI, UT and WA publish no qualification, so their sales are "unknown market character". |
| **Comparable flag** (input for Phase 3) | Derived | True only for a qualified, priced sale with a valid date, not on a multi-parcel account, and (FL) not a multi-parcel sale (`M_PAR_SAL` D/C) or 03–05 code. |
| **Price change between qualified sales** | Calculated | Change and compound annual rate between consecutive comparable sales of one account. The number of permits filed between the two sales is shown, because improvements change what was sold. |
| **Ownership** | Boulder `role_cd`, `pct_own` | Each owner shows primary/secondary role and share. The county notes that joint tenants each show 100%. |
| **Owner entity type** | Rule-based on the recorded name | Individual / company / trust / government / organization. It reads only words in the name; no person lookup. |
| **Buildings** | Boulder Buildings (help manual definitions) | Finished area, basements by type, quality, construction, class, stories, units, % complete, heating/cooling, exterior/roof, garage type. Plus a property summary: buildings/sections, finished-area sum, oldest year built, newest effective year. |
| **Land** | Boulder Land | County GIS square feet/acres (not survey quality), land class, valuation unit type. |
| **Assessments** | Boulder Values | Non-school and school assessed totals, land/building assessed values, extra-feature actual value. **Only the current tax year exists** in the county file, so no value history is shown, and the UI says so. |
| **Estimated property tax** | Calculated | Assessed value × mill levy ÷ 1,000. Colorado residential school and other levies use different assessed values (they differ on 116,759 of 134,825 accounts), so the result is a low–high range before exemptions or credits. Labeled "not a tax bill". |
| **Permit summary** | Boulder Permits | Total records, records without a usable date, earliest/latest, count in the last 5 years (from the county data date), top categories, reported work value, latest new construction. Permit dates use the same validation as deeds. |
| **Location codes** | Boulder Owner_Address | Appraisal neighborhood, section/township/range, site city, unit. |
| **Florida statewide facts** | DOR NAL guide | Sale qualification, vacant/improved at sale, multi-parcel flag (both sales), effective year built, residential units, improvement quality (1–6), construction class (1–5), homestead just value, last physical inspection (MMYY → YYYY-MM), public-land owner, special-features value. |
| **North Carolina** | NC OneMap | **Bug fixed:** a 2001-01-01 placeholder sale date was shown as a real sale. Added the deed book/page source document and structure count. |
| **Wisconsin** | Statewide parcels V12 | School district. |
| **Colorado statewide** | — | Sale dates normalized from M/D/YYYY to ISO. |
| **Printable report** | Same functions as the panel | Adds the property history (sales with qualification, calculated price changes, building/permit summaries, owners with roles/shares/entity type, tax estimate), all labeled. |

### Data bug fixed: duplicate Boulder buildings

The county repeats a building's row once per basement type (help manual, Buildings.csv). The previous importer made each row a separate building.
- **Before:** 179,951 building rows.
- **After merge:** **139,552** building/sections (distinct `bld_num` + `section_num`). This matches the CSV's 139,613 distinct keys minus 61 rows on accounts that link to no parcel.
- Basement areas are kept per type and summed.

The three fixture folios were unaffected (their counts are unchanged).

### Not available from existing data (stated in the UI)

- Assessment history (one tax year only).
- Deed type definitions: the county provides the code list "upon request", so codes are shown raw.
- Grantor/grantee, mortgages, liens.
- Owner history beyond the deed list (Owner_Address holds only the current owner).
- Sale qualification for CO, NC, WI, UT and WA.
- Utah owner, sale and value fields (the statewide layer has none).

---

## 2. Verification

| Check | Result |
| --- | --- |
| Automated tests | `node --test tests/land-intelligence-*.test.*`: **85/85 pass** (74 after Phase 1, plus 10 in the new `land-intelligence-property-history.test.cjs` and 1 new importer test). Real-snapshot tests ran against the local data. |
| TypeScript | `npx tsc --noEmit`: no Land Intelligence errors (only the pre-existing B4 Dinosaur Land error). |
| Snapshot rebuild | `node app/land-intelligence/boulder-import.mjs --input app/land-intelligence/docs`: 130,112 parcels, schema 2, 47 MB compressed, 20 s. **No bucket contains a mailing-address field** (scan of all 256 buckets). 144,294 ownership rows, of which 144,292 have a share and 134,703 are primary. |
| Live, dev server, 2026-11-01 | 225 parcel details across six states, all HTTP 200. Boulder: 25/25 ready with schema-2 fields. FL (Tallahassee): 4/4 sales classified; effective year on 33/40 parcels, inspection date on 40/40, quality 33/40, construction class 22/40. NC (Raleigh): **20 of 40 raw records carry the placeholder date; the app shows the 20 real sales and 0 placeholders**. WI: school district 40/40. |
| Production build | `next build --experimental-build-mode compile` + `generate`: success. Unapproved trace: **0 Boulder files**. No client chunk contains server-only zlib code. `next start`: page HTTP 200; Boulder parcel → `rights_pending` with no county rows; FL/CO detail and inspection HTTP 200. |
| Browser visual / accessibility | **Not performed** (B5 carried forward). |

---

## 3. Files changed

| File | Change |
| --- | --- |
| `app/land-intelligence/property-history.ts` (new) | Sale classification (county, DOR), owner entity rules, history merge, price changes, permit/building summaries, tax estimate |
| `app/land-intelligence/record-date.ts` (renamed from Phase 1 `sale-date.ts`) | Shared deed/permit date validation |
| `app/land-intelligence/boulder-import.mjs` | Schema 2: merged basement rows, building/land/value/ownership/location fields; mailing fields still excluded |
| `app/land-intelligence/boulder-property.ts` | Schema-2 types (backward compatible); permit date validation |
| `app/land-intelligence/parcel-detail.ts` | FL, NC, WI fields; NC placeholder fix; CO date normalization; sale classification |
| `app/land-intelligence/MapInspection.tsx` | Property history section; richer Boulder account, values, deeds, buildings and permits tabs; statewide facts |
| `app/land-intelligence/export-parcel-report.ts` | Property history in print; richer building/deed/permit rows |
| `tests/land-intelligence-property-history.test.cjs` (new), `tests/land-intelligence-boulder.test.mjs` | Phase 2 tests |

Local only (ignored, unpublished): new snapshot `data/land-intelligence/boulder/snapshot-2026-11-02T03-*`.

---

## 4. Remaining issues and blockers

| # | Item | Effect |
| --- | --- | --- |
| B1 | Boulder republication rights | All Boulder-based Phase 2 features are dev-only until resolved; production shows `rights_pending`. |
| B3 | Census API key | Not used in Phase 2; still required for Phase 4. |
| B4 | `main` fails `npm run build` (Dinosaur Land type error) | Blocks a standard deployment. |
| B5 | Browser visual and accessibility pass | The new panel sections are untested on screen, including dense parcels (up to 362 accounts on one folio). |
| — | FEMA host unreachable from this network (B2) | Unchanged; unrelated to Phase 2. |
| — | Deed type definitions | A county request would allow labeling WD, QD, etc. Until then they are shown raw. |

## 5. Phase 3 readiness

Ready to start on the code side. Phase 3 (deterministic comparables and $/sq ft) can use:
- `HistorySale.comparable` for qualified, priced, single-parcel, date-valid sales.
- Finished area per building/section and building class.
- Appraisal neighborhood and subdivision for grouping.
- `propertyId` to join statewide parcels (for location) to county accounts.

**Constraints:**
- Production use of Boulder comps depends on B1.
- Outside Boulder, only Florida publishes qualified sales with building area, so statewide comps would be Florida-only.
- Phase 3 still needs a parcel location (centroid) for each county folio. The county files have no coordinates, so distance-based comps must come from the statewide parcel geometry, joined by `propertyId`, and never from addresses.
