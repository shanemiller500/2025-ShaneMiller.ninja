# Phase 5: market maps and investment intelligence

Status: **implemented and verified, except the browser pass (B5).** Date: 2026-11-02.

Every new map layer and calculator input comes from the free sources set up in Phases 1–4: Census ACS, FHFA HPI, Census building permits, FRED, Census TIGERweb boundaries and the statewide parcel services. It adds no new paid service or key.

## 1. What was built

| Feature | Files | Notes |
|---|---|---|
| Market overlays (tract median home value, tract median gross rent, tract 5-year FHFA price change, county permits per 1,000 homes) | `market-layers.ts`, `app/api/land-intelligence/market-map/route.ts`, `layers.ts`, `LandApp.tsx`, `MapKey.tsx` | The route fetches TIGERweb tract or county boundaries for the view and joins the imported Phase 4 values by GEOID. Only one market choropleth shows at a time. Breaks are fixed nationally, so colors mean the same thing everywhere. ACS estimates whose reliability is "low" are drawn faded, and top-coded medians are labeled "or more". |
| Parcel value heatmap | `parcel-sources.ts` (`totalValue()`), `parcel-map/route.ts`, `market-layers.ts` (`PARCEL_VALUE_LAYER`) | Shows the published total value divided by acres, with the value basis named per state. Condo units published as separate records on one footprint are summed over that footprint. Utah publishes no value. |
| Comparable-sale markers | `MapInspection.tsx` (`comparablesGeoJSON`), `layers.ts` (`land-comps`) | Shows the subject, the comparables used and the excluded outliers once the Comparables section has loaded. The markers are cleared when the inspection closes. |
| Investment calculator | `investment.ts`, `MapInspection.tsx` (`InvestmentSection`) | Three tabs: Ownership cost (PITI + HOA), Rental (NOI, cap rate, cash flow, cash-on-cash return, DSCR, break-even occupancy, GRM) and Development (residual land value). |
| Shared lazy loading | `MapInspection.tsx` (`useLazyLoad`) | Comparables, Market and Investment share one fetch hook, so market data is fetched once. |

### Calculator inputs: records versus assumptions

Every prefilled input is labeled **"from records"** or **"assumption"**, and its source is shown.

| Input | Source, in order of precedence |
|---|---|
| Price | Comparable-sales midpoint (calculated), then the county actual value, then the statewide market value. The ACS tract median is used last and labeled "not this parcel", and only if it is not top-coded. |
| Interest rate | Freddie Mac 30-year fixed rate (FRED), with its date |
| Property tax | Estimated tax (assessed value × mill levy, upper end), then the statewide net tax. Otherwise 1% of price is used as an assumption. |
| Rent | HUD Fair Market Rent for the bedroom count, which needs the B6 token. Otherwise the ACS tract or county median gross rent is used. |
| Insurance (0.5%), hard cost ($250/sq ft), units, down payment, vacancy, operating percentages | **Assumptions** |

Outputs are deterministic arithmetic and are labeled "Scenario arithmetic … Not financial advice, a loan quote or an appraisal." The residual land value does not check zoning, density or site constraints, and the page says so.

### Data-quality fixes found during live checks

- **Wisconsin value basis.** The value heatmap now uses `CNTASSDVALUE` (total assessed value), not `ESTFMKVALUE`. In Dane County, 108 of 939 downtown Madison records and 33 of 140 west-suburb records had an estimated fair market value equal to the improvement value alone. Milwaukee and Green Bay had none.
  - Where a record shows this pattern, the Phase 2 detail panel now adds a note to its "Estimated fair market value" saying the land appears to be omitted.
- **Condo stacks.** Downtown Madison and Boulder publish one record per condo unit (or parking stall) on a shared footprint. Dividing each unit's value by the footprint understated the density more than 100×. Values are now summed per footprint.
  - Median value per footprint is about $17M/acre in downtown Madison and $26M/acre in downtown Boulder.
- **Class breaks were re-cut** to under $100k, $100k–1M, $1M–5M and $5M or more per acre. The first breaks put suburban lots, typically $1–3M/acre, in the top class.

## 2. Verification

| Check | Result |
|---|---|
| Unit tests | `node --test tests/land-intelligence-*.cjs tests/land-intelligence-*.mjs`: **117 pass, 0 fail**. New: `tests/land-intelligence-maps-investment.test.cjs`, covering payment math, rental and residual formulas, default precedence, the top-coded guard, legend/paint agreement at every break, the value basis per state, the Wisconsin note, mapped-area density and condo stacks. |
| Palette | The sequential blue and decline/neutral/blue trend scales were run through the dataviz validator on light and dark surfaces: pass. |
| Live market map | Boulder tracts 685 ms / 58 KB. Manhattan 735 tracts / 365 KB. Phoenix 675 tracts. Colorado 94 counties. Southeast 713 counties in 2.1 s. Oversized views are refused (tract span 0.6°, county span 20°). |
| Live parcel value | Checked in Boulder, Madison and Miami after the fixes above. Utah has no value, as expected. |
| TypeScript | No Land Intelligence errors. |
| Production build | `next build --experimental-build-mode compile` + `generate`: success. Traces: `market-map` and `market` include the 54 market files and **0 Boulder files**. `comparables` and `parcel-map` include 0 Boulder files when unapproved. No client chunk contains zlib. |
| Browser visual / accessibility | **Not performed** (B5 carried forward). |

## 3. Blockers and open items

| ID | Item |
|---|---|
| B1 | Boulder rights are unresolved. The Boulder-only parcel heatmap from county sales and the investment-opportunity overlays remain candidates and were not built. |
| B2 | FEMA network access (unchanged). |
| B4 | Dinosaur Land build error at `app/dinosors/sim/nav.ts:173`, which is why the standard `next build` was not used (unchanged). |
| B5 | Browser render and accessibility pass not done. |
| B6 | `HUD_API_TOKEN` is not set, so rents fall back to ACS. |
| Deploy | `data/land-intelligence/market/` (8.8 MB) is untracked and must be committed for the market routes to work in production. Nothing from Phases 1–5 is committed. |
| Phase 6 | The investment calculator is not yet in the printable report. |

## 4. Phase 6 readiness

Phase 6 (Unified Property Intelligence) can start. Every section now exists in Map Inspection: property, history, comparables, market and investment. What remains is consolidation, adding the calculator to the report, and UI polish.
