# Phase 3: comparable sales and valuation

Property & Market Intelligence expansion, Phase 3 of 6. Work dates: 2026-11-01/02. Builds on [PHASE2_PROPERTY_INTELLIGENCE.md](PHASE2_PROPERTY_INTELLIGENCE.md).

**Status: implementation complete and backtested; release gated by B1** (Boulder County republication rights). Florida comparables were evaluated and deferred (§4). No paid source and no AI are used: selection and valuation are deterministic arithmetic on public records, and the same inputs always return the same comparables and figures.

---

## 1. What was built

| Part | File | What it does |
| --- | --- | --- |
| Parcel locations | `app/land-intelligence/boulder-centroids.mjs` (new) | One point per Boulder folio: the area centroid of the largest ring of the **State of Colorado public parcel polygon**. Paged by OBJECTID (2,000 per page). Live run: **144,551 rows, 73 pages, 28 s → 130,165 folios** (1.06 MB gz). State terms allow commercial application use with attribution and forbid resale; the attribution string is stored and shown. |
| Comparison profile | `boulder-import.mjs` `accountProfile` | Per account: primary building class (or `LAND: <land class>` when no building row), finished area of same-class sections (above-grade for residential, per the county), land GIS square feet, year built. Computed once at import and stored (snapshot **schema 3**). |
| Comparable-sales index | `boulder-import.mjs` `buildCompsIndex` → `comps.json.gz` | Qualified (`Q`), priced sales of **single-parcel** accounts in the 5 years before the county data date. A building sale is dropped when the building was built after the sale year (the price was for land). Sales are flagged when a new-construction, addition or demolition permit follows the sale, or a building is under 100% complete. Live: **22,099 sales (2021-10-25 → 2026-10-25), 22,089 with a location**, 1.05 MB gz. No owner names. |
| Selection and valuation | `app/land-intelligence/comps.ts` (new, pure) | See §2. |
| Server and route | `boulder-comps.ts` (new), `app/api/land-intelligence/comparables/route.ts` (new) | Loads the index once per instance; applies the publication gate; single-account parcels only; falls back to the parcel polygon centroid only when the index lacks the folio. Non-Boulder parcels get `not_supported` with the reason. |
| Map Inspection | `MapInspection.tsx` | New collapsible **"Comparable sales and valuation"** section, fetched only when opened. Shows the value range (purple "calculated"), confidence, midpoint arithmetic, county actual value for context, up to 10 comparables (price, date, $/sq ft, area, year built, distance, reception, outlier/changed flags) and a "How these were chosen" method panel. |
| Printable report | `export-parcel-report.ts`, `ParcelFindings.tsx` | Includes the comparables section once it has been loaded for the parcel. |
| Build gate | `next.config.js` | The comparables route packages the manifest, snapshot (with comps index) and centroids **only** with `LAND_BOULDER_DATA_APPROVED=true`. |

## 2. Method (deterministic)

1. **Candidates:** same county building class (or same land class); qualified, priced, single-parcel sales; not the subject; on or before the as-of date. Only the latest sale of a property that sold more than once is used.
2. **Search steps:** stop at the first step with at least 5 matches.
   - Step 1: ≤ 1 mi, ≤ 24 months, ±30% size.
   - Step 2: ≤ 2 mi, ≤ 36 months, ±30% size.
   - Step 3: ≤ 3 mi, ≤ 60 months, ±50% size.
   - Size bands are symmetric on a log scale.
   - Without a parcel point, matching is restricted to the same county appraisal neighborhood.
3. **Ranking:** 2 × |ln(size ratio)| + months/24 + miles + |year-built difference|/30 + 0.5 if changed after sale + 0.25 if a different neighborhood. Ties break by most recent date, then folio. Up to 10 comparables are kept.
4. **Outliers:** with 5 or more comparables, $/unit values beyond 1.5 × IQR (Tukey fences) are shown but not used.
5. **Midpoint:** subject area × median $/unit, rounded to $1,000. The unit is above-grade finished sq ft for buildings and GIS land sq ft for land.
6. **Confidence:**
   - **High:** 8+ used sales, step 1, and IQR/median ≤ 0.25.
   - **Medium:** 5+ used sales and IQR/median ≤ 0.4.
   - **Low:** anything else with at least 3 sales.
   - **Insufficient:** fewer than 3 sales; no figures are produced.
7. **Range (calibrated):** midpoint × (1 + the 10th/90th percentile of backtest errors at that confidence). The UI says "about 8 in 10 actual prices fell inside a range like this".
   - Sources without a calibration show the comparables' middle half instead, labeled "not checked against outcomes".
8. **No adjustments.** There is no time, condition, feature or location adjustment, and building facts are the county's current record. Every surface states this and that the figure is not an appraisal.

## 3. Validation on real data

**Holdout backtest** (`scratchpad/probe/backtest.mjs`, not in the repo). Each recent sale was valued only from comparables sold on or before its own date, and compared with its actual price:

| Sample | Confidence | Valued | Median absolute error | Midpoint within 10% |
| --- | --- | ---: | ---: | ---: |
| 2,000 sales from 2025–26 | High | 1,170 | **9.4%** | 52% |
| | Medium | 531 | **14.0%** | 37% |
| | Low | 249 | **20.8%** | 26% |
| | Insufficient | 50 | no estimate | — |
| | Overall | 1,950 | **11.5%** | median signed error −0.4% (no bias) |

**Range calibration** (`scratchpad/probe/calibrate.mjs`):
- **Sample:** 5,741 sales from 2024–26, fit on one half (2,877) and validated on the other (2,864).
- **Fitted bands:** high −15.1% / +21.1%; medium −22.7% / +39.4%; low −36.7% / +54.3%.
- **Held-out coverage:** **high 79%, medium 78%, low 76%**, against an ~80% target.

**Finding that changed the design:** the first version used the comparables' middle half ($/sq ft P25–P75) as the "range". The actual price fell inside it only 38–48% of the time, so it would have overstated precision. It was replaced by the calibrated range above.

**Other checks:**

| Check | Result |
| --- | --- |
| Automated tests | `node --test tests/land-intelligence-*.test.*`: **97/97 pass** (85 after Phase 2 + 11 in new `land-intelligence-comps.test.cjs` + 1 new importer test). Covers tiers, filters, neighborhood fallback, outliers, confidence, calibration, determinism (order-independent), the route's unsupported path, real-snapshot fixtures and the production gate. |
| TypeScript | No Land Intelligence errors (only the pre-existing B4 Dinosaur Land error). |
| Live, dev | 72 parcels via the route. Boulder, Longmont, Louisville and Nederland: 44 ready / 4 not supported (multi-account parcels or no area). Confidence ranges from high to insufficient; downtown Boulder's commercial core is mostly insufficient (few commercial sales). All 44 ready parcels used distance matching. Warm responses ~75 ms; cold first call ~0.7 s (index load). Denver and Tallahassee: `not_supported` with the reason. |
| Production build | Compile + generate succeed. **Unapproved:** 0 Boulder files in both the parcel-detail and comparables traces. **Approved:** 259 files (manifest, active snapshot, comps index, centroids; no older snapshots). No client chunk contains server-only zlib code. `next start`: page HTTP 200; 5 Longmont parcels → `rights_pending`, no result returned. |
| Browser visual / accessibility | **Not performed** (B5 carried forward). |

## 4. Florida: evaluated and deferred

Florida is the only other connected source with qualified sales and building area.
- **Live tests on 2026-11-01:** point-plus-distance queries fail (SRID error). Attribute filters inside a 2-mile envelope timed out at 25–30 s. Even a 1-mile count took 14 s.
- **Decision:** on-demand Florida comparables are not reliable, so they were not shipped.
- **Recommended path:** the DOR's free bulk NAL/SDF files, imported the same way as Boulder. This is a later-phase task and needs a rights check of the DOR files.

## 5. Files changed

New:
- `app/land-intelligence/boulder-centroids.mjs`, `comps.ts`, `boulder-comps.ts`
- `app/api/land-intelligence/comparables/route.ts`
- `tests/land-intelligence-comps.test.cjs`

Modified:
- `boulder-import.mjs` (profile, comps index, schema 3)
- `boulder-property.ts` (profile type; exported gate)
- `MapInspection.tsx`, `ParcelFindings.tsx`, `export-parcel-report.ts`
- `next.config.js`
- `tests/land-intelligence-boulder.test.mjs`

Local only (ignored, unpublished):
- `data/land-intelligence/boulder/centroids.json.gz`
- snapshot `snapshot-2026-11-02T03-46-28-403Z` (schema 3)

**Refresh order:** `node app/land-intelligence/boulder-centroids.mjs`, then `node app/land-intelligence/boulder-import.mjs --input <csv folder>`. Without centroids, comparables fall back to neighborhood matching.

## 6. Remaining issues and blockers

| # | Item |
| --- | --- |
| B1 | Boulder republication rights. Comparables are dev-only until resolved (production returns `rights_pending`). The derived index contains prices, dates, reception numbers and site addresses, so the county question covers it too. |
| B4 | `main` fails `npm run build` (Dinosaur Land type error). |
| B5 | Browser visual and accessibility pass of the new section. |
| — | Multi-account parcels (e.g. land and building accounts on one folio) are not valued. |
| — | No time adjustment. Phase 4's FHFA house-price index could supply one, but that would change the backtest, so it needs a re-calibration. |
| — | Calibration is specific to Boulder and the 2024–26 market; re-run `calibrate.mjs` after each snapshot refresh and update `BOULDER_CALIBRATION`. |
| — | Approved builds also package the centroids file into the parcel-detail function (traced by path); about 1 MB, harmless. |

## 7. Phase 4 readiness

Ready. Phase 4 (free HUD, FHFA, Census and FRED market data) does not depend on B1 and works nationally.
- **Dependency:** B3, the free Census API key.
- **Natural link to this phase:** an FHFA index could time-adjust comparable prices. Treat that as a separately backtested change, not a silent tweak.
