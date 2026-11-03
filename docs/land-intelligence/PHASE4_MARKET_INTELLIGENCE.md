# Phase 4: national market intelligence

Property & Market Intelligence expansion, Phase 4 of 6. Work date: 2026-11-02. Builds on [PHASE3_COMPARABLES_VALUATION.md](PHASE3_COMPARABLES_VALUATION.md).

**Status: implementation complete; works nationally, today, with free federal data.** None of it depends on the Boulder rights question (B1). One optional source, HUD Fair Market Rents, waits for a free HUD token (B6, new). No paid service and no AI are used. Published estimates keep their margins of error; derived figures are labeled "calculated".

---

## 1. Sources (all free, public domain)

| Source | What is used | Geography | Vintage | How it is obtained |
| --- | --- | --- | --- | --- |
| **Census ACS 2020–2024 5-year, table-based summary files** | B01003 population; B19013 median household income; B25001 housing units; B25002 occupancy; B25003 tenure; B25035 median year built; B25064 median gross rent; B25071 rent burden; B25077 median home value; B17001 poverty | Nation, 52 states, 3,236 counties, 85,395 tracts | 2020–2024 5-year | Pipe-delimited files from www2.census.gov, **no API key** |
| **FHFA all-transactions House Price Index** | Tract annual (developmental); metro and metro-division quarterly with standard error; state quarterly | 63,930 tracts (46,719 with a 2025 value); 410 metros/divisions; 51 states | Tract through 2025; metro/state through 2026 Q2 | CSV downloads |
| **Census Building Permits Survey** | County annual units by structure size (1, 2–4, 5+) and value | ~3,030 counties per year | 2020–2025 | Text files from www2.census.gov |
| **FRED / Freddie Mac PMMS** | 30- and 15-year fixed rates, week-earlier and year-earlier values | National | Weekly (latest 2026-10-29) | Live, keyless CSV; cached 6 h |
| **HUD Fair Market Rents** | 0–4 bedroom FMR; Small Area FMR by ZIP in designated metros | County / ZIP | FY of the response | Live HUD USER API; **needs `HUD_API_TOKEN`** (B6) |
| **Census geocoder** | Point → state, county, tract, metro, metro division, ZCTA | Any U.S. point | Current | Live, keyless |

**HUD downloads.** HUD's bulk FMR files return an empty HTTP 202 to non-browser clients. They downloaded only when the request impersonated a browser, so that route was **not used**; the official API is the supported path. HUD's required notice ("uses the HUD User Data API but is not endorsed or certified by HUD User") is shown with the source list.

## 2. What was built

| Part | File | Detail |
| --- | --- | --- |
| Importer | `app/land-intelligence/market-import.mjs` (new) | Streams each file once and caches raw downloads in the OS temp folder (`--refresh` to re-download). Output in `data/land-intelligence/market/`: `manifest.json` (sources, vintages, row counts), `national.json.gz` (U.S., states, metros) and 52 `state-<FIPS>.json.gz` bundles (counties and tracts). **8.8 MB total; full run ~25 s with cached downloads.** ACS annotation sentinels (negative codes) are never treated as values. |
| Pure arithmetic | `app/land-intelligence/market.ts` (new) | Reliability from the coefficient of variation (≤15% good, ≤30% caution, else low). Proportions and their margins per the ACS handbook, with the ratio-formula fallback. Top/bottom-coded medians flagged (≥ / ≤). Value ÷ income withheld when either median is top-coded. HPI 1- and 5-year changes. Permit trend and units per 1,000 existing homes. |
| Server | `app/land-intelligence/market-data.ts` (new) | Geocoder geography (7-day cache), metro-division lookup for divided metros, per-instance bundle cache (national + 7 states), FRED (6 h), HUD FMR client (24 h), `tractAcsAt` for other routes. |
| Route | `app/api/land-intelligence/market/route.ts` (new) | `GET ?lng&lat` for any U.S. point. CDN cache 1 h, stale-while-revalidate 1 day. |
| Shared FRED helper | `utils/fred.ts` (new) | Moved from `app/api/mortgage-rates/route.ts` (the stocks widget route now imports it; its output only gained `yearAgo`). |
| Drawing report | `app/api/land-intelligence/report/route.ts` | The census section now reads the imported ACS tract data. **It works without `CENSUS_API_KEY`** (it was unavailable since Phase 1). The keyed API remains a fallback. |
| Map Inspection | `MapInspection.tsx` | New collapsible **"Market intelligence"** section, loaded on open:<br>• tract / county / state / U.S. table of official estimates; hover shows the 90% margin; * marks low reliability<br>• calculated shares and value ÷ income<br>• FHFA tract, metro and state index with 1- and 5-year changes<br>• county permit trend<br>• mortgage rates<br>• HUD rents, or the reason they are unavailable<br>• sources and vintages |
| Printable report | `export-parcel-report.ts`, `ParcelFindings.tsx` | "Market context" section once loaded, with margins, labels and sources. |
| Build | `next.config.js` | Market files are always packaged for the market and report routes (public data, no gate). |

## 3. Verification

| Check | Result |
| --- | --- |
| Independent cross-check | Imported values equal Census Reporter's `acs2024_5yr` API on all 9 values checked (B25077, B19013 and B25064 for the U.S., Boulder County and tract 08013012204: e.g. $332,700 ± 236; $756,300 ± 14,324; $1,597,600 ± 302,510). A regression test pins these values. |
| Automated tests | **108/108 pass** (97 after Phase 3 + 11 in `land-intelligence-market.test.cjs`). Covers reliability, the proportion formula and its fallback, top codes, HPI and permit arithmetic, importer parsing of all three file formats, FRED year-ago, HUD county and Small Area parsing plus the token gate, the metro-division lookup, and the non-U.S. rejection. Older harnesses were updated to load Node built-ins; one assertion now targets only `api.census.gov`. |
| TypeScript | No Land Intelligence errors (B4 Dinosaur Land error only). |
| Live, dev, 8 locations | Boulder, Manhattan, rural Garfield County MT, Honolulu, Anchorage, San Juan PR, Miami, rural Holmes County MS: all returned housing data. 250–390 ms warm, 1.3 s cold. Rural MT has no metro; Puerto Rico has no FHFA state or BPS county series (reported as not published). |
| Live, tract index | 5 suburban tracts (Louisville CO, Plano TX, Naperville IL, Cary NC, Gilbert AZ) all returned 2025 values with 1- and 5-year changes. The dense urban tracts sampled are not published by FHFA, so they fall back to metro and state (verified as unpublished, not an ID mismatch). |
| Found and fixed live | Divided metros (New York, Miami, ...) had no metro index, because FHFA publishes them by metro division. They now use the geocoder's division code (New York division +5.7%/yr, Miami division +1.3%/yr). |
| Drawing report | Census `found` without a key (Boulder and Plano tracts), in dev and production. |
| Stocks route | `/api/mortgage-rates` unchanged apart from the added `yearAgo` field. |
| Production build | Compile + generate succeed. The market and report traces each hold 54 market files and 0 Boulder files; no client chunk contains server code. `next start`: page 200; market route 200 for Boulder and Plano with the CDN cache header. |
| Browser visual / accessibility | **Not performed** (B5 carried forward). The 5-column table relies on horizontal scroll at 400 px. |

## 4. Blockers and open items

| # | Item |
| --- | --- |
| B3 | **Resolved for Land Intelligence.** ACS now comes from the summary files; `CENSUS_API_KEY` is optional. |
| B6 (new) | HUD Fair Market Rents: register for a free HUD USER API token and set `HUD_API_TOKEN`. The client is mock-tested; a live response has not been verified. |
| — | **Deployment:** `data/land-intelligence/market/` (8.8 MB, public domain) is untracked. It must be committed or produced at build time for production. Nothing has been committed. |
| — | **Refresh cadence:** ACS yearly (December), FHFA quarterly/annual, BPS yearly. Re-run `node app/land-intelligence/market-import.mjs --refresh`. The UI shows import date and vintages. |
| — | **No county-level FHFA index:** the county annual file is spreadsheet-only and no parser dependency was added. Tract, metro and state cover the need. |
| B1, B2, B4, B5 | Unchanged (Boulder rights, FEMA network, Dinosaur Land build error, browser pass). |

## 5. Phase 5 readiness

Ready.
- **Market overlays:** the per-state bundles already hold tract and county values, and metro/state hold quarterly series. Choropleths need matching boundaries (Census TIGER/cartographic boundary files, also free).
- **Comparable-sale markers:** these can use `CompResult` points.
- **Property value heatmap:** ACS tract median value nationally; county assessor values in Boulder (gated by B1).
- **Investment calculators:** have their inputs: FRED rates, HUD FMR (once B6 is done), ACS rents and values, comparable value ranges.
