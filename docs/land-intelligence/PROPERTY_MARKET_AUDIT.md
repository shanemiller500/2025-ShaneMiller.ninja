# Land Intelligence: property and market intelligence audit

Audited 2026-11-01. **Audit only. No application code, configuration, packages or data were changed.** This document extends the existing [master audit](MASTER_AUDIT.md), [source matrix](DATA_SOURCE_MATRIX.md), [engine architecture](ENGINE_ARCHITECTURE.md) and [roadmap](IMPLEMENTATION_ROADMAP.md). It does not replace them, and it treats their open Phase 1–3 gates as still open.

> **Phase 1 update, 2026-11-01:** see [PHASE1_FOUNDATIONS.md](PHASE1_FOUNDATIONS.md). Corrections to this audit:
>
> - The CO `asedValTot` question in §2.2 is resolved: it is a statewide class-rate value, not the county assessed value. `apprValTot` is the county actual value.
> - Florida assessed and taxable values were double-counted; this is fixed.
> - The Census ACS client in `/report` now needs a free key.
> - The live date anomalies in §2.4 are 610 placeholder `12/30/1899` rows and 3 after-source rows. 73 pre-1900 rows are real and kept.
> - A `propertyId` (`state:county:parcel`) now exists, which partly covers §7.1 item 2.

> **Phase 2 update, 2026-11-01:** see [PHASE2_PROPERTY_INTELLIGENCE.md](PHASE2_PROPERTY_INTELLIGENCE.md). Several dropped Boulder fields listed in §1 and §2.2 are now imported: finished area, stories, units, quality, construction, land GIS area, school-assessed value and ownership roles. Buildings were previously double-counted per basement type; this is fixed. North Carolina's 2001-01-01 placeholder sale date is no longer shown.

> **Phase 3 update, 2026-11-02:** see [PHASE3_COMPARABLES_VALUATION.md](PHASE3_COMPARABLES_VALUATION.md). Deterministic Boulder comparables with a backtested value range are built (median absolute error 11.5% on 1,950 holdout sales; calibrated range coverage 76–79%). Florida live comparables were deferred because the service was too slow for on-demand queries.

> **Phase 4 update, 2026-11-02:** see [PHASE4_MARKET_INTELLIGENCE.md](PHASE4_MARKET_INTELLIGENCE.md). National market context now runs on free federal data: ACS 2024 5-year from the table-based summary files (no API key, so §5's key concern is resolved), FHFA tract/metro/state HPI, Census building permits and FRED. HUD Fair Market Rents need a free API token.

> **Phase 5 update, 2026-11-02:** see [PHASE5_MAPS_INVESTMENT.md](PHASE5_MAPS_INVESTMENT.md). Tract and county market overlays, a parcel value-per-acre heatmap, comparable-sale markers and an ownership, rental and residual-land-value calculator are built. Live checks led to Wisconsin value densities using the total assessed value and condo-unit stacks being summed per footprint.

> **Phase 6 update, 2026-11-02:** see [PHASE6_UNIFIED_INSPECTION.md](PHASE6_UNIFIED_INSPECTION.md). Map Inspection and the printable report now share the eight §8.1 sections from one registry. The phase also adds a source-rights registry with export checks, a jurisdiction coverage profile and a development-feasibility roll-up. A headless browser pass closed B5. The 6-phase plan is complete. Paid providers stay out of scope.

**Evidence labels used throughout**

| Label | Meaning |
| --- | --- |
| **Verified (code)** | Read in this checkout at the cited path. |
| **Verified (local data)** | Computed in this audit from the ignored Boulder CSVs in `app/land-intelligence/docs/`. Aggregates only; no owner, mailing or address values were printed. |
| **Verified (tests)** | `node --test tests/land-intelligence-*.test.*` ran 66/66 passing on 2026-11-01. These are mocked tests: they show how the code behaves, not that providers are live. |
| **Provider-documented** | Read on the provider's own page on 2026-11-01. Linked. |
| **Third-party report** | Stated by an aggregator, reseller or press source. Treat as unconfirmed. |
| **Assumption** | Reasoned, not verified. |
| **Recommendation** | Proposed. Not implemented. |

No live provider request was made in this audit. The earlier audits recorded that this workspace could not reach most GIS endpoints. Nothing here promotes a configured provider to "working".

---

## 1. Executive summary

**What Land Intelligence is today (verified, code).** It is an engineering and environmental parcel-screening tool on one MapLibre globe (`components/atlas/AtlasMap.tsx`). Users can select parcels in six states (CO, UT, WA, FL, NC, WI) through statewide ArcGIS parcel services. Map Inspection then shows the owner of record, a last-sale headline, assessor values, 12 engineering subject areas and a printable report. One county, Boulder CO, has a full local assessor snapshot: 130,112 parcels with accounts, owners, buildings, deeds/sales, permits and values. There are **no listings, leases, comparables, valuations, market analytics or investment calculations**. Land Intelligence does **not** use Firebase, and it has no durable storage. All of its caches live in process memory.

**Biggest finding: the most valuable real-estate asset is already in the repo and underused.**
- The Boulder Sales table has **279,115 qualified (`Q`) deed rows**, and about 4,100–6,300 of them are priced each year from 2020 through 2026 (verified, local data).
- **164,482 of 179,951 building rows carry `TotalFinishedSF`** (verified, local data).
- The importer drops `TotalFinishedSF`, `Stories`, `UnitCount`, quality, construction, heating/AC, exterior wall, roof, the `Land` table's `GIS_sqft`/`landUnitValue`, and the `Values` table's assessed components (`app/land-intelligence/boulder-import.mjs:677-681`).
- With those fields kept, Boulder County could support **deterministic** qualified-sale comparables, $/finished-sqft, median-price trends, sales volume and permit-activity analytics, with no new provider.
- **Blocker:** retention and redistribution rights for these CSVs are still unconfirmed with the county (already recorded in [DATA_SOURCE_MATRIX.md](DATA_SOURCE_MATRIX.md)).

**MLS feasibility (high priority).**
- **A legitimate live-MLS integration is not practical for Land Intelligence as an independent, general-purpose public research tool.**
- Every route checked requires the MLS's approval under a use-specific license tied to MLS participants: RESO Web API via Bridge (REcolorado), MLS Grid (IRES, which covers Boulder), Spark/Flexmls, Trestle and Repliers.
- **IDX** permits public display only on a participating broker's site, under display rules. **Back-office** licenses forbid public display. **VOW** requires a broker-operated, registration-gated site.
- MLS access is possible only if Land Intelligence becomes (or partners as the vendor of) a **specific Colorado brokerage's** product. That would change what the product is. Details are in §4.

**Recommended data path.**
1. Finish what exists: Boulder deepening, statewide sale fields, and the Phase 1 live-probe and rights gates.
2. Add free federal market context, two pieces of which are already wired: ACS in `/report`, and FRED in `app/api/mortgage-rates/route.ts`. Then add HUD FMR, FHFA HPI and Census Building Permits.
3. If a paid residential feed is approved, **RentCast** is the best first pilot. It covers listings, rent and value AVMs, comps and market stats. Its license permits internal storage and redistribution to end users (provider-documented). Cost is low, but plan prices are unconfirmed.
4. **ATTOM** (from $500/mo, provider-documented) is the candidate only if national deed, mortgage, lien or foreclosure depth is required.
5. **Regrid** is the candidate for parcel coverage beyond the six states.
6. **Commercial lease intelligence cannot be reproduced** from public data. CompStak and Reonomy are enterprise-only, CoStar/LoopNet offer no licensable API, and Crexi's API only accepts listings pushed in.

**Positioning.** Land Intelligence should not try to match CoStar. It can credibly become **"parcel-level engineering + public-record property + deterministic feasibility"**, with explicit provenance. CoStar does not offer that combination, and its commercial lease, availability and tenant research cannot be legally or economically recreated.

---

## 2. Existing application inventory

### 2.1 User path and architecture (verified, code)

`app/land-intelligence/page.tsx` → `LandClient.tsx` (dynamic, no SSR) → `LandApp.tsx` (695 lines; owns map state and every `fetch` to `/api/land-intelligence/*`) → `MapInspection.tsx` (376 lines; the sidebar/bottom sheet) → `ParcelFindings.tsx`, `SiteAnalysis.tsx`, `RoadSegmentDetails.tsx`. Overlays are registered in `layers.ts` as `AtlasLayer[]` through the shared Atlas component library.

| Route (`app/api/land-intelligence/…`) | Purpose | Caching / persistence |
| --- | --- | --- |
| `search` | Address search: **Photon (OpenStreetMap) first**, Census Geocoder fallback, plus coordinate parsing | None. *Doc drift: MASTER_AUDIT says Census only.* |
| `parcel-map` | Viewport parcels from the 6 state services, 500-feature cap, `sourcesForBounds` state rectangles | CDN `s-maxage=600, swr=1800` |
| `parcel-detail` | One parcel's attributes by `<state>:<OBJECTID>` key; adds the Boulder snapshot when county = Boulder | `private, max-age=0` |
| `parcel-inspection` | Server-resolved geometry plus about 17 screening groups (FEMA, NWI, NHD, NRCS, Qfaults, karst, USMIN, EPA, Superfund, NOAA marks, USGS wells, CDOT, Denver storm, CO tanks, FL subsidence) | Process `Map`: 3 min, 30 entries for geometry; versioned report cache; in-flight dedup |
| `property-fill` | Fills empty fields: the county GIS layer found through the ArcGIS Online catalog (AI maps field names only), then OpenAI web search with on-page value verification | Process `Map`: 7 days, 500 entries; AI rate limit of 5 per visitor per 10 min and 60 per instance per hour |
| `report`, `terrain` | Point/line/area study (includes **ACS 2024 5-year tract profile**) | Process caches |
| `identify`, `soil-map`, `soil-detail`, `crash-map`, `facility-map`, `road-segment`, `zoning`, `zoning-code` | Point/overlay drill-downs and AI zoning-code lookup | Mixed |

**Firebase (verified, code).** `firebase.json` provisions Firestore database `shanemiller` and Storage. `utils/firebase/firestore.rules` covers only Dinosaur Land, Fight World and the Atlas `geoDocs` library (`utils/geo/library.ts`). **No Land Intelligence file imports Firebase.** The `firebase-admin` package and the Atlas seeder pattern (`scripts/atlas/seed.mjs`) already exist and can be reused (§7).

**Secrets (verified, code).** The only environment variables Land Intelligence reads are `OPENAI_API_KEY`, `OPENAI_MODEL` and `OPENAI_ORG`. All are server-side in `app/land-intelligence/ai.ts`.

### 2.2 Capability inventory against this audit's scope

Status meanings: **Working (local)** means the code path exists and passes mocked tests. **Configured** means the URL is in code but has no live verification. **Partial** means some fields or jurisdictions only. **Missing** means not present.

| Capability | Status | Evidence (paths) | Notes |
| --- | --- | --- | --- |
| Parcel boundaries, IDs, GIS selection | Working (local) / Configured live | `parcel-sources.ts`, `/parcel-map`, `layers.ts` (`land-parcels-*`), `parcel-detail.ts:queryParcelGeometry` | 6 states only, with coarse state-bbox routing. The key is the source OBJECTID, which is **not stable across source republishes**; the APN is in `parcel.id`. |
| Ownership (current) | Partial | `parcel-detail.ts` (CO `owner/owner2`, FL `OWN_NAME`, NC `ownname`, WI `OWNERNME1/2`); Boulder `Owner_Address` | No owner fields for UT or WA. No history beyond Boulder deed rows. No LLC resolution. |
| Deeds / recorded sales / history | Partial | CO `saleDate/salePrice` (1 sale); FL 2 sales with book/page/clerk; NC sale date only; Boulder full deed table with `sales_cd` (Q/U/P), deed type, reception | `parcel-headline.ts` picks the latest **priced** sale and does not filter by qualification code. It labels the sale "may be a non-market transfer", which is correct for display but unusable as-is for comps. |
| Taxes / assessments | Partial | WI `NETPRPTA` tax; Boulder `Values` and mill levy; CO `apprValTot`, `asedValTot` | **Finding:** CO `asedValTot` is mapped to `taxableValue` (`parcel-detail.ts:529`). In Colorado, assessed value is actual value × assessment rate, so labeling it "taxable" needs field-definition confirmation. |
| Mortgages, liens, foreclosure | **Missing** | none | Not in any connected public source. A recorder pilot (task 13) is still a search link only. |
| Building details / improvements | Partial | FL year built, living area, building count; NC `structyear`; Boulder `Buildings` (year, effective year, beds, baths, main floor, basement, garage) | Finished SF, stories, units, quality and construction exist in the CSV but **are not imported**. No building footprints. |
| Permits / construction history | Partial (Boulder) | Boulder `Permits` (number, category, date, description, estimated value, issuer) | Rows only; no analytics. |
| Land use / zoning | Partial | `parcelCategory()`, FL DOR decoding, `zoning-lookup.ts` (point, ArcGIS catalog), `zoning-code.ts` (AI) | Catalog discovery is not authenticated by publisher. |
| Environmental / flood / hazard / transport / utilities | Configured, mock-tested | `parcel-inspection/*`, `provider-policy.ts`, `parcel-analysis.ts` (12 areas) | This is the strongest part of the product. See MASTER_AUDIT for the gaps. |
| Census / demographics | Configured | `/report` → ACS 2024 5-year profile at tract | Available in the drawing report only. Map Inspection does not show it. |
| Market rates | Configured (outside LI) | `app/api/mortgage-rates/route.ts` (FRED CSV), `app/stocks/widgets/MortgageRateWidget.tsx` | Can be reused as financing context. |
| Listings, leases, rents, comps, AVM, market trends | **Missing** | none | — |
| Persistence / provenance | Partial | Process caches only. Provenance fields: `ParcelRecord.source/sourceUrl/received`, `FilledValue.via/official`, Boulder `sourceDate` | The `Finding` provenance contract in ENGINE_ARCHITECTURE is proposed, not fully implemented. |
| Reporting | Working (local) | `export-parcel-report.ts`, `export-report.ts` | Printable HTML. |
| Coverage | — | 6 states for parcel selection; 1 county for deep records | No country outside the U.S. |

### 2.3 Duplication and reuse notes (verified, code)

- Parcel field lists are maintained twice: `PARCEL_SOURCES[].fields` (map) and `PARCEL_DETAIL_FIELDS` (detail). This is intentional (it keeps the map response small), but they can drift.
- `/identify` `SOURCES` repeats URLs and fields from `LAND_OVERLAYS` and `provider-policy.ts`. The prior audit already flagged this.
- `bucketForFolio` is implemented in both `boulder-import.mjs` and `boulder-property.ts`. The two must stay byte-identical, or lookups miss silently. They currently match.
- The ACS client in `/report` and the FRED client in `/api/mortgage-rates` are the existing hooks for market context. Reuse them rather than adding new clients.

### 2.4 Boulder snapshot: data-quality observations (verified, local data)

| Table | Rows | Observation |
| --- | ---: | --- |
| Sales | 753,371 | 389,826 priced. Qualification codes: `U` 465,889, `Q` 279,115, `P` 8,361. **704 rows are dated before 1900 and 2 are dated 2027** (both `U`), so they need a date sanity filter. `Tdate` is `M/DD/YYYY HH:MM:SS AM` and is stored raw. |
| Buildings | 179,951 | 164,482 carry finished SF. Top classes: single-family 138,572; condos 16,884; manufactured 3,707; agricultural buildings 3,037; duplex/triplex 2,277; multi-unit (9+) 1,287; merchandising 1,285; warehouse 1,252; office 1,090. |
| Qualified priced sales per year | — | 2020: 5,855 · 2021: 6,303 · 2022: 4,958 · 2023: 4,131 · 2024: 4,567 · 2025: 4,512 · 2026 YTD: 2,892 |

The importer already joins all of these tables by account and folio. The missing pieces are field retention and analytics, not a new source.

---

## 3. CoStar capability comparison and gap matrix

CoStar Group's products: the CoStar suite (CRE property, sale comps, lease comps, availabilities, tenants, analytics and forecasts), LoopNet (CRE marketplace), Homes.com (residential listings) and Apartments.com (rentals). CoStar's differentiator is proprietary researched data gathered by its own research staff and contributors. Its [terms](https://www.costar.com/about/terms-conditions) and its litigation history (for example, its 2020 complaint against Crexi) show it does not license that data for reuse.

Feasibility key: **E** = existing data · **P** = free/public data · **L** = licensed API · **D** = deterministic calculation · **✗** = not reproducible legally, economically or reliably.

### A. Property and ownership

| Capability | LI today | Path | Verified vs modeled |
| --- | --- | --- | --- |
| Current owner | Partial (4 of 6 states, plus Boulder) | E; L (ATTOM, RentCast, Regrid) for gaps | Official record |
| Ownership history / transfers | Boulder only | E (Boulder deeds); L (ATTOM deed history) | Official record |
| LLC / corporate ownership | Missing | P: CO SOS [Business Entities dataset](https://data.colorado.gov/Business/Business-Entities-in-Colorado/4ykn-tg5h) (fields and license unverified); L: Reonomy "LLC piercing" (enterprise) | Exact entity-name matching is official. Linking a person behind an entity is **modeled**, and it raises privacy concerns. |
| Taxes / assessments | Partial | E; L | Official record |
| Mortgages / liens / foreclosure | Missing | L (ATTOM; BatchData third-party reported) | Official record via licensee |
| Building details / improvements | Partial | E (import the dropped Boulder fields); L | Assessor record, not an inspection |

### B. Commercial lease intelligence

| Capability | LI today | Path |
| --- | --- | --- |
| Available lease listings | Missing | ✗ CoStar/LoopNet. Crexi has no outbound API. MLS commercial listings exist only under MLS licenses (some MLSs carry income/commercial classes). |
| Historical lease comps, asking vs achieved rent, $/sf, terms, expirations | Missing | L: CompStak Enterprise (contact sales; no public API docs found). ✗ public. |
| Occupancy / vacancy / tenants | Missing | ✗ public at building level. L: CompStak, Reonomy (partial). |
| NOI, cap rate, yield | Missing | **D**, from user-entered or licensed inputs, always labeled as a scenario. Public cap-rate observations: ✗. |

### C. Residential

| Capability | LI today | Path |
| --- | --- | --- |
| Active / pending / sold listings, listing history, price changes | Missing | MLS (license-gated, §4); L: RentCast listings (provider-documented); ✗ scraping Zillow/Redfin/Homes.com |
| Historical sale prices | Boulder, partial statewide | E; L |
| Comparable properties | Missing | **E + D for Boulder** (qualified sales × finished SF × class × distance); L: RentCast comps |
| Rental listings / rent estimates | Missing | L: RentCast; P: HUD FMR (metro/county 40th percentile, not property-level) |
| Valuation / $ per sqft | Missing | **D**: $/sf ranges from qualified comps. L: RentCast/ATTOM AVM, which **must be labeled a modeled estimate**. Assessor actual value is official, but it is a mass-appraisal value, not market value. |
| Neighborhood trends | Missing | E (Boulder sales by subdivision); P: FHFA HPI (county/ZIP/tract, annual, developmental); Zillow ZHVI/ZORI (attribution required; commercial use unclear) |

### D. Market analytics

| Capability | Path |
| --- | --- |
| Sales volume, median/average price, appreciation | E + D (Boulder); P (FHFA); L (RentCast markets) |
| Rental trends | P (HUD FMR, ACS median gross rent); L (RentCast) |
| Commercial vacancy / absorption | ✗ public; L (CompStak/CoStar-class only) |
| Construction pipeline | E (Boulder permits); P ([Census Building Permits Survey](https://census.gov/construction/bps/faqs/data_faq.html), bulk files, no documented API) |
| Supply / demand, geographic comparison | P (ACS housing units, vacancy, tenure) + D |
| Forecasts | ✗ as a claim of fact. A simple trend extrapolation can be shown only if labeled as such. **Recommendation: no forecasts.** |

### E. Investment and development

| Capability | Path |
| --- | --- |
| Comparable sales / rent analysis | E + D (Boulder); L |
| Land acquisition intelligence | E: vacant-land classes (`parcelCategory`, FL DOR `000/010/040`, Boulder `Land.landClassDscr`) + qualified vacant-land sales + all existing constraint screening. **This is the strongest differentiator.** |
| Residual land value | **D**: user-entered GDV, cost, margin and fees. A scenario, never a fact. |
| Site feasibility tied to GIS constraints | E: `parcel-analysis.ts` areas + zoning lookup + flood/wetland/soil/slope evidence. Present as "constraints found", not as buildable area, until zoning dimensional standards are verified. |
| Available development parcels | ✗ without listings. Possible filter: "vacant + no mapped flood/wetland intersection + zoning X" in Boulder. This identifies candidates, not availability. |

---

## 4. MLS API feasibility (high priority)

### 4.1 Cross-cutting facts

- **RESO compliance does not grant access.** RESO certifies software conformance. Data access comes from the MLS that owns the data ([RESO FAQ](https://www.reso.org/faq/), [RESO certification](https://www.reso.org/certification/)).
- **License types are use-specific.** IDX means public display of other brokers' listings on a participant's site. VOW means a registration-gated broker site. Back office (BBO) means internal broker tools with no public display. PDAP is REcolorado's office-data license. See [REcolorado data delivery](https://recolorado.com/data/), [MLS Grid FAQ](https://mlsgrid.com/faq), [Canopy MLS](https://go.canopymls.com/data) and [NAR MLS policy](https://www.nar.realtor/mls).
- **Sold data under IDX.** Under NAR policy as of 2022, displaying sold listings under IDX is generally prohibited unless sold information is publicly accessible from government records ([2022 FAQ](https://www.nar.realtor/about-nar/policies/summary-of-2022-mls-changes)). Colorado is a disclosure state, but local MLS rules govern. The 2025 handbook text was not retrieved in this audit.
- **Independent tech companies generally do not qualify on their own.** Repliers says vendors may build only for participating MLS members, and that MLS data cannot be used for "academic or research purposes" ([Repliers access requirements](https://help.repliers.com/en/article/mls-data-access-requirements-who-can-use-mls-apis-wyl8lw)). Stellar MLS requires a broker-vendor-MLS three-party agreement for non-IDX development ([Stellar](https://www.stellarmls.com/data-delivery)).
- **Commercial leases.** Some MLSs carry income, commercial or lease property classes, but coverage is thin and depends on the MLS. MLS data is not a substitute for lease comps.

### 4.2 Provider findings

| Provider | Real listing data? | Developer key | Broker/MLS requirement | Independent public research tool? | Sold / history | Storage / combination | Coverage | Published pricing |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Bridge Interactive** (Zillow Group) | Yes, for partner MLSs | Account is free. Each dataset needs the data provider's approval; access is usually started by the MLS ([Bridge guide PDF](https://www.miamirealtors.com/wp-content/uploads/bsk-pdf-manager/2019/12/Get-started-with-the-Bridge-API-in-4-easy-steps.pdf)) | MLS approval for each license type | Not under IDX, VOW or BBO terms | Depends on the MLS and license | Set by the MLS license | MLSs on Bridge; **REcolorado is exclusive to Bridge** | Bridge itself is free; MLS fees apply and REcolorado does not publish them |
| **MLS Grid** | Yes | Vendor account plus a subscription for the intended use; one master license covers IDX, VOW and BBO | The broker signs a data-license request (OneKey, Heartland examples) | No. Each license type is tied to a broker use | Depends on the MLS | Back office means no public display (Heartland) | Includes **IRES** (Boulder, Fort Collins, Greeley, Longmont, Loveland) ([MLS Grid IRES](https://docs.mlsgrid.com/recent-releases/ires-multiple-listing-service-now-available-through-mls-grid)) | Fees set by each MLS (example: Canopy BBO $500 setup + $100/mo) |
| **Spark API / Flexmls** | Yes, for Flexmls MLSs | Free developer registration ([setup](https://sparkplatform.com/docs/overview/set_up_access)) | "Purchase with approval" chain; keys issued only on MLS admin approval | Not outside IDX/VOW plans | Plan-dependent | MLS plan terms | Flexmls MLSs (REcolorado and IRES are not Flexmls) | $50/mo per MLS plus MLS fees ([Spark FAQ](https://sparkplatform.com/docs/overview/faq)) |
| **Trestle** (CoreLogic, now Cotality) | Yes | Vendor portal | MLS approval of use and display | No | Depends on the MLS | MLS license | Trestle MLSs | 2017 report: $75 per feed per month plus MLS fees ([Inman 2017](https://www.inman.com/2017/03/24/corelogics-trestle-now-open-for-business-will-tech-vendors-bite/)). Dated. |
| **Repliers** | Yes (normalized MLS data) | Subscription | Broker of record signs; vendor needs MLS approval | **No.** Vendors build only for MLS members; research use is barred | Depends on the MLS | Single use case per subscription | Listed MLSs | From $199/mo per MLS ([pricing Q&A](https://help.repliers.com/en/article/qa-related-to-pricing-1hbxiq3/)) |
| **REcolorado** (Denver metro) | Yes | Via Bridge | IDX/VOW/BBO/PDAP; PDAP requires a three-party agreement with the participant | No public general use | Not stated on its page | Policy-governed | Front Range | Not published: datalicensing@recolorado.com |
| **IRES** (Northern Colorado, **including Boulder**) | Yes | Via MLS Grid | MLS Grid license; broker | No | Exchanges active and historical listings with REcolorado ([data share](https://recolorado.com/data-feeds-to-include-recolorado-rocc-and-ires-listings/)) | License | Northern CO | Not found |

### 4.3 Conclusion and required relationships

**Verified finding:** none of the checked providers offers an MLS license that permits public display of other brokers' listings in an independent, general-purpose research tool. Some MLSs allow non-participant licenses only by board approval (Canopy example).

**Paths that would be legitimate, each needing explicit approval:**
1. **Brokerage partnership, IDX.** A Colorado participating broker (REcolorado and/or IRES member) becomes the licensee. Land Intelligence is either that broker's IDX site or a registered vendor. Listings appear only under IDX display rules: broker attribution, refresh cadence, removal of withdrawn listings, field limits, no sold data unless the MLS allows it. **Consequence:** the product effectively becomes a brokerage marketing tool.
2. **VOW.** The same broker partner, plus user registration and the terms-of-use acceptance the VOW policy requires. This makes more data available, but listings sit behind a login, and Land Intelligence currently has no user accounts.
3. **Back office.** Internal analytics for a broker only. It **cannot** feed a public tool.
4. **MLS non-participant / data license.** This would need board approval in each MLS. Its existence and terms are unknown for REcolorado and IRES, so ask datalicensing@recolorado.com and IRES directly.

**Recommendation:** do not build an MLS integration now. Treat it as an **open decision** (§12). Meanwhile, use a licensed aggregator (RentCast) for listing data where its license allows display.

---

## 5. External provider comparison (non-MLS)

| Provider | Datasets | API availability | Data type | Coverage | Historical | Pricing | Restrictions | Effort | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **RentCast** ([docs](https://developers.rentcast.io/reference/introduction), [terms](https://www.rentcast.io/terms-api)) | Property records, owner, tax history, sale history, value and rent AVM with comps, active sale and rental listings, market stats | Public self-serve | Residential, some commercial; listings; market | 150M+ records; most U.S. ZIPs | Price and rent trends; sale history | Free: 50 req/mo (provider). Paid tiers $74–$449/mo per third-party reports; **unconfirmed** | **Permissive**: internal storage and **display, resell and distribution to end users** allowed; no attribution required; data may be inaccurate; may have to delete data on legal/third-party demand | Low | **Integrate (pilot) once approved.** Best value. Label AVMs as estimates. |
| **ATTOM** ([pricing](https://www.attomdata.com/solutions/delivery/property-data-api/pricing/)) | Property, deeds, mortgages, foreclosure, AVM, neighborhood, permits | Licensed self-serve, 30-day trial capped at 500 calls/day ([trial](https://support.attomdata.com/articles/9704145040-api-pricing-trial-extensions-and-paid-plans)) | Residential and commercial ownership, sales, liens | National | Deep | **From $500/mo** (provider). Premium by quote | License terms not public; storage and redistribution need contract review | Medium | **Investigate** only if liens, mortgages or foreclosures become a requirement |
| **Estated** | Property records | Legacy API kept for existing customers; not sold to new ones ([ATTOM](https://cloud-help.attomdata.com/article/661-is-estated-api-being-replaced)) | Property | National | — | — | — | — | **Avoid** (absorbed into ATTOM) |
| **BatchData** | Property, owner, contact, sales | Licensed | Residential/commercial ownership, contact | 155M properties (vendor claim) | Sales history | Pay-as-you-go; "from $500/mo for 20k calls" (third-party report) | Skip-trace and contact data carries privacy and TCPA risk | Medium | **Avoid** for now: overlaps ATTOM/RentCast; contact data is not needed |
| **Regrid** ([plans](https://support.regrid.com/reference/plan-options)) | Nationwide parcel polygons plus standardized assessor attributes, tiles | Self-serve (per-record) and enterprise | Parcel, ownership, land use | National parcels | Limited | Enterprise bundles $12K/$18K per year (blog, may be dated); self-serve prices not found | API/Tiles ToS not reviewed | Medium | **Investigate** as the route to coverage beyond 6 states. Compare against official sources first. |
| **CompStak** ([about](https://help.compstak.com/about-compstak-1)) | Lease comps (starting rent, free rent, TI, term), sale comps | Enterprise subscription; no public API docs found | Commercial lease and sales | National (office, retail, industrial) | Yes | Quote | Enterprise license | High | **Investigate** only if commercial lease is a must-have and the budget allows |
| **Reonomy / Altus** ([data solutions](https://www.reonomy.com/products/data-solutions)) | CRE property, transactions, owners (LLC resolution), contacts | Enterprise only (API and bulk) | Commercial ownership and sales | 54M+ commercial properties | Transactions | Quote | Enterprise; contact data | High | **Investigate** (low priority) |
| **Crexi** ([Listing API](https://learn.crexi.com/listing-api-overview-crexi-help-center?hsLang=en)) | — | Partners push listings in only | — | — | — | — | No outbound data | — | **Avoid.** No legitimate pull API; scrapers are unauthorized. |
| **LoopNet / CoStar** | — | No public API; LoopLink widget only shows a broker's own listings | — | — | — | — | Terms bar compiling or reusing listings ([LoopNet terms](https://www.loopnet.com/solutions/fr-ca/modalites-d-utilisation-loopnet)); history of litigation | — | **Avoid** |
| **County assessors / recorders** | Assessor tables; deeds | Varies: bulk CSV (Boulder), ArcGIS, search sites | Ownership, sales, buildings, permits | Per county | Varies | Usually free | **Per-county rights review** (Boulder unresolved) | Medium per county | **Integrate** one county at a time behind the existing rights gate |
| **CO Secretary of State business entities** | Entity name, status, ID, agent and address (third-party description) | Socrata dataset `4ykn-tg5h` exists; fields and license **unverified** | Entity | CO | Status history unknown | Free | Personal data in agent and principal fields | Low | **Investigate.** Exact entity-name match to owner only; no person profiling. |
| **Census ACS** | Housing units, vacancy, tenure, median value, median rent, income | Public API (already used in `/report`) | Market context | Tract and up | Annual 5-year | Free (key recommended) | Public domain; margins of error must be shown | Low | **Integrate** (reuse existing client) |
| **HUD FMR / Income Limits** ([FMR](https://www.huduser.gov/portal/datasets/fmr.html)) | 40th-percentile gross rent by metro/county and bedroom count | Public API with a free token | Rent benchmark | National | Annual | Free | Must display HUD's "not endorsed or certified" notice | Low | **Integrate** |
| **FHFA HPI** ([datasets](https://www.fhfa.gov/data/hpi/datasets)) | Repeat-sales index: county, ZIP5, tract (annual, developmental) | File downloads | Appreciation | National | Decades | Free | Public; label as developmental at small geographies | Low | **Integrate** (scheduled file ingest) |
| **Census Building Permits Survey** | Permitted units by county and place, monthly/annual | Bulk files; no documented API | Pipeline | National | Long | Free | Public | Low | **Integrate** (scheduled) |
| **FRED** | Mortgage rates, macro series | Already used (`app/api/mortgage-rates/route.ts`) | Financing context | National | Long | Free | Attribution per series | Very low | **Reuse** |
| **Zillow Research** ([metrics](https://zillowgroup.com/developers/api/public-data/real-estate-metrics)) | ZHVI, ZORI, inventory (aggregates) | CSV downloads | Market | Metro/ZIP | Long | Free | "Free for public use" with attribution; commercial use not clearly addressed; no scraping | Low | **Investigate.** Get written confirmation before commercial display. |
| **Redfin Data Center** | Market aggregates | CSV downloads | Market | Metro/ZIP | Long | Free | Data-Center-specific terms not found; general terms say personal and non-commercial | Low | **Investigate / avoid** until terms are confirmed |

Not recommended under any provider: scraping Zillow, Redfin, Realtor.com, Homes.com, Apartments.com, LoopNet or Crexi, or using any undocumented endpoint.

---

## 6. Free versus paid acquisition opportunities

| Tier | Opportunity | Unlocks | Cost |
| --- | --- | --- | --- |
| **Free, already in repo** | Boulder fields the importer drops; qualified-sale filter; subdivision grouping | Boulder comps, $/sf, trends, permit pipeline, vacant-land sales | $0 (pending county rights) |
| **Free, already wired** | ACS (`/report`), FRED (`/api/mortgage-rates`) | Tract demographics and housing, rate context in Map Inspection | $0 |
| **Free, new** | HUD FMR, FHFA HPI, Census BPS, CO SOS entities | Rent benchmark, appreciation, construction pipeline, entity matching | $0 (HUD token) |
| **Free, more statewide fields** | FL DOR second sale, WI tax, NC improvement values (already fetched); more counties' bulk assessor files | Wider sales and assessment depth | $0 per county + rights review |
| **Low-cost paid** | RentCast | Listings, rent/value AVM, comps, market stats for 6+ states | Free tier → est. tens to hundreds of dollars per month (confirm) |
| **Mid paid** | ATTOM; Regrid | National deeds, mortgages, foreclosure; national parcels | ≥$500/mo; ~$12K+/yr (confirm) |
| **Enterprise** | CompStak; Reonomy | Commercial lease comps; CRE ownership | Quote; likely five figures per year (assumption) |
| **Relationship-gated** | MLS (REcolorado/IRES) | Live residential listings under IDX/VOW | Broker partnership + MLS fees |

---

## 7. Data architecture and parcel matching

### 7.1 Smallest practical changes (recommendation)

1. **Keep the existing contracts.** Add property and market data as new adapters behind the same `ParcelDetail` → `MapInspection` flow and the `Finding` contract proposed in [ENGINE_ARCHITECTURE.md](ENGINE_ARCHITECTURE.md). Add tiers: `verification: "official_record" | "licensed_record" | "modeled_estimate" | "derived"`, plus `licenseId` and `collectedAt`.
2. **Canonical property identity.** OBJECTID keys (`co:12345`) are fine for selection but are not durable. Add a server-side canonical ID of `{sourceId}:{countyFIPS}:{normalizedAPN}` plus a geometry fingerprint, stored alongside the OBJECTID. Every external match is keyed to this ID, never to the OBJECTID alone.
3. **Boulder analytics at import time.** Extend `boulder-import.mjs` so it also writes a precomputed `comps` index: qualified, priced, date-sane sales joined to building class, finished SF, year built, a parcel centroid (from the CO parcel service or the county GIS), and subdivision. Also write per-subdivision and per-year market aggregates. Ship them inside the existing traced snapshot (`next.config.js` already traces it). **No database is needed.** The output is static and versioned with the snapshot.
4. **Durable cache for paid calls only.** The current process-local `Map`s do not survive across Vercel instances, so the same parcel could be billed repeatedly. Use the **already provisioned Firestore** (`shanemiller`) through `firebase-admin` on the server, in a new `liCache/{provider}:{canonicalId}:{schemaVersion}` collection whose rules deny all client access. Store the normalized payload, `collectedAt`, `expiresAt`, `licenseId` and the source request hash. This replaces nothing; it sits in front of the provider adapter. Do it only after the first paid provider is approved.
5. **Federal market datasets on a schedule.** FHFA, HUD and BPS publish annually or monthly. Ingest them with a script modeled on the Boulder importer into small static JSON keyed by FIPS/ZIP/tract, and refresh them in the build. ACS can stay on demand, as it is today in `/report`. No live calls are needed per parcel.
6. **No new map engine or spatial database.** Comps and market overlays become `AtlasLayer` entries in `layers.ts`, following the `crashes`/`facilities` GeoJSON pattern. Choropleths use static tract/ZIP GeoJSON joined to values. National-scale spatial search is **not** in scope; everything is parcel-centric or bounded to the viewport.

### 7.2 Matching strategy across providers

| Step | Rule | Outcome |
| --- | --- | --- |
| 1 | Exact normalized APN **within the same county FIPS** (the format-tolerant logic in `county-record.ts:265-270` can be reused) | `linked`, high confidence |
| 2 | Provider lat/lng **inside** the authoritative parcel polygon **and** street number + street name match | `linked`, medium |
| 3 | Point inside polygon, no address agreement | `candidate`; show as "nearby record", not merged |
| 4 | Address only | `unlinked`; never attached (this mirrors the existing rule in `county-record.ts`) |

| Case | Handling |
| --- | --- |
| Multiple buildings on one parcel | Keep a buildings array (the Boulder model already does this). Comps use the primary or largest residential building and record which one. |
| Condominiums | Parcel → many accounts/units (Boulder folio → accounts). A listing must match a **unit or account**, not the common-area parcel. If the unit is unknown, show it at building level and mark `unit_unresolved`. |
| Address changes | Match on APN first; keep the provider's address as an attribute; never re-key on address. |
| Parcel splits / merges | Keep the source's `dateReceived`/`PARCELDATE`. When an APN disappears, mark records `superseded` rather than deleting them. A geometry-fingerprint change means re-matching, and prior matches are kept as history. |
| Conflicting values | No silent merge. Show each source's value with its date and tier. The headline uses a declared precedence: official current record > licensed record > modeled estimate. |
| Multi-parcel accounts | The existing warning in `parcel-headline.ts` stays, and comps exclude sales whose account links to more than one parcel unless the deed is confirmed for the whole set. |

### 7.3 Provenance and licensing to persist with every value

`providerId`, `originalId`, `sourceUrl`, `recordDate`, `collectedAt`, `verification` tier, `confidence`, `licenseId` (which links to a rights record: display allowed, storage allowed, retention days, attribution text, deletion obligation). **Residential (RentCast/MLS) and commercial (CompStak/Reonomy) licenses get separate `licenseId`s.** The renderer checks `display` before showing a value, and the report exporter checks `export`.

---

## 8. UI/UX and map integration proposals

**Constraint:** keep `AtlasMap`, the current selection, `MapInspection`, the mobile sheet, `ParcelFindings`, overlays, export and the 12 engineering subject areas. The proposal **regroups** content that already exists and adds sections. It does not replace the current UI.

### 8.1 Unified property inspection: proposed sections

| # | Section | Contents | Status / source |
| --- | --- | --- | --- |
| 1 | Property Overview | `ParcelHeadlineCard` (owner, last sale, value), address, APN, acres, class, data-coverage badge | Exists |
| 2 | Ownership & Legal | Owners, legal description, subdivision/block/lot, Boulder accounts, recorder search link, optional CO SOS entity match | Exists + P |
| 3 | Sales History | Timeline of deeds with qualification code, deed type, reception and price; the non-market caution stays | Exists (Boulder, FL, CO single sale); UI addition |
| 4 | Listings & Leases | Active/recent listing and rental listing **only where licensed**; "No licensed listing source for this area" otherwise | New (RentCast or MLS) |
| 5 | Comparables & Valuation | Deterministic Boulder comps (qualified, ≤ N months, same class, ±X% finished SF, distance) → $/sf range; assessor actual value; optional AVM in a visibly separate "Modeled estimate" box | New: E + D; L optional |
| 6 | Market Intelligence | ACS tract housing, FHFA HPI trend, HUD FMR, BPS permits, FRED rate; Boulder subdivision medians and volume | New: P + E |
| 7 | Land & Engineering Research | Current `ParcelFindings` and 12 subject areas, unchanged | Exists |
| 8 | Development Feasibility | Zoning lookup + constraint roll-up (from section 7) + residual-land-value and simple NOI/cap-rate calculators with user inputs; labeled "scenario" | New: D |

Sections 4–6 and 8 load lazily when opened. The panel already uses a single-open-section pattern, which avoids extra provider calls and visual clutter.

### 8.2 Map overlays

| Overlay | Feasible? | Implementation shape |
| --- | --- | --- |
| Comparable-sale markers (for the selected parcel) | Yes (Boulder) | A GeoJSON `AtlasLayer` like `land-facilities-points`, shown only while a parcel is selected |
| Historical sale activity (density by year) | Yes (Boulder) | Viewport-bounded points or heat from the precomputed index |
| Property value heatmap | Yes (Boulder assessor actual $/sf; FHFA by tract/ZIP) | Choropleth; label "assessor value", not market value |
| Rental rate heatmap | Partial (HUD FMR county/metro; ACS median rent by tract) | Choropleth at the published geography only |
| Active sale/rental listings | Only with RentCast or MLS display rights | Points layer; display rules enforced by `licenseId` |
| Development activity | Yes (Boulder permits; BPS county) | Points (Boulder), choropleth (BPS) |
| Commercial availability / vacancy | **No** legitimate source | Do not build |
| Investment opportunities | Filter-based candidates only | Off by default; the "candidate, not available" wording is required |

---

## 9. Performance, security, licensing and cost

| Topic | Finding / recommendation |
| --- | --- |
| Repeated paid calls | Verified risk: `property-fill` caches in process for 7 days with 500 entries, which is per instance on serverless. Any paid provider needs the Firestore cache (§7.1) **and** the existing `overAiLimit`-style budget, generalized per provider. |
| API keys | Keep the server-only pattern (`ai.ts`). New keys belong in Vercel environment variables, never `NEXT_PUBLIC_`. Firestore cache rules: `allow read, write: if false` for clients. |
| Authorization | Land Intelligence is public and has no auth. Licensed data that requires registration (MLS VOW) would need user accounts. The site's email-link auth (`utils/firebase/useEmailCloud.ts`) exists but would need a new product decision. |
| Personal data | Owner names are already shown from public sources. `county-record.ts` keeps `PERSONAL_FIELD` server-side. Do **not** add skip-trace or contact data. Entity matching shows only the entity record. |
| Licensing-aware display | Enforce `licenseId` capabilities in the renderer and exporter. Residential and commercial rights are kept separate. |
| Freshness | Boulder refreshes daily at the county, but the snapshot only updates on re-import and rebuild. Show the snapshot date (already done). Federal datasets refresh annually or monthly. Listings refresh daily, with TTL ≤ 24 h and removal of delisted records. |
| Firestore cost | Assumption: a per-parcel cache at hobby or low-thousands daily volume stays inside or near the free tier. Indexing only by document ID, with no composite indexes, is enough. |
| Bundle / route size | The Boulder comps index adds roughly tens of MB uncompressed (assumption) to the traced server bundle, so keep it gzip-bucketed like the current snapshot. Watch Vercel function size limits. |
| Third-party geocoding | `/search` calls the public Photon instance first. Its fair-use policy should be reviewed before any commercial launch (not verified here). |

**Estimated recurring costs (assumptions where marked):**

| Item | Est. monthly |
| --- | --- |
| Free federal and county data | $0 |
| Firestore cache | ~$0–25 (assumption) |
| RentCast pilot | $0 (free 50 req) → confirm paid tier |
| ATTOM | ≥ $500 (provider-documented floor) |
| Regrid | ≈ $1,000+ for an enterprise bundle (blog figure, confirm) |
| MLS via broker | Platform fee (Spark $50/MLS; Bridge $0) + MLS license fees (unpublished for REcolorado/IRES) |
| CompStak / Reonomy | Quote |

---

## 10. Prioritized implementation roadmap (plan only, not started)

**Gate before any phase:** the existing roadmap's open Phase 1–3 gates (live known-parcel probes, rights decisions, browser checks) still apply. Property intelligence depends on parcel identity being correct.

### Phase 0: inventory and gates (mostly done by this audit and prior audits)

- **Add:** a rights record per source (Boulder CSV, CO parcels, CO SOS, HUD, FHFA, Zillow); a live probe of the 6 parcel services; a decision on MLS (§12).
- **Reuse:** `DATA_SOURCE_MATRIX.md`, `BOULDER_FIXTURES.md`.
- **Blockers:** Boulder county reply; network access for probes.
- **Complexity:** Low (2–4 days, excluding waiting). **Cost:** $0. **Benefit:** unblocks everything else.
- **Validation:** dated probe log; written rights decisions.

### Phase 1: property, ownership and sales history from existing data

- **Add:** import the dropped Boulder fields (finished SF, stories, units, quality, construction, land sqft, assessed components); a date-sanity filter for pre-1900 and future dates; a Sales History timeline; surfacing of the FL second sale and WI tax already fetched; a CO `asedValTot` label correction after field-definition check; a canonical property ID.
- **Reuse:** `boulder-import.mjs`, `boulder-property.ts`, `parcel-detail.ts`, `parcel-headline.ts`, `MapInspection.tsx`, `export-parcel-report.ts`.
- **Dependencies:** none new. **Blockers:** Boulder rights for production.
- **Complexity:** Low–Medium (5–9 days). **Cost:** $0.
- **Benefit:** the first complete parcel property file in one county.
- **Validation:** extend `land-intelligence-boulder.test.mjs` with the three fixture folios (expected finished SF, qualified sales); compare against the county viewer.

### Phase 2: residential listings via a licensed aggregator (MLS stays at decision stage)

- **Add:** a RentCast adapter (properties, listings, AVM) behind the `licenseId` model; the Firestore paid-call cache; a Listings & Leases section; a "modeled estimate" UI tier.
- **Reuse:** the `ai.ts` rate-budget pattern; the `county-record.ts` APN matcher; the `firebase-admin` seeder pattern.
- **Dependencies:** RentCast account (approval needed); match-quality test against Boulder records.
- **Blockers:** paid-key approval. MLS needs a brokerage relationship.
- **Complexity:** Medium (6–10 days). **Cost:** free tier → confirm paid.
- **Benefit:** active listings and rent context in 6+ states.
- **Validation:** 20 Boulder parcels: RentCast APN/owner/sale against the county snapshot, with match rate, mismatches and duplicate listings recorded; cache-hit test that one parcel produces at most one billed call per TTL.

### Phase 3: commercial facts from public data, plus a commercial-lease decision

- **Add:** commercial building classes and $/sf for Boulder commercial qualified sales; commercial land-use filters; EPA/permit history for commercial parcels; a vendor-quote comparison for CompStak and Reonomy (no integration until approved).
- **Reuse:** `parcelCategory`, the Boulder index, the `facilities` group.
- **Blockers:** lease comps are enterprise-licensed only.
- **Complexity:** Low (public part, 3–5 days). **Cost:** $0, or quote.
- **Benefit:** honest commercial context; a clear gap statement.
- **Validation:** spot-check commercial sales against county deeds; no lease figure shown without a licensed source.

### Phase 4: comparables, valuation and investment analytics (deterministic)

- **Add:** the Boulder comps engine (precomputed index plus selection rules that are documented and shown in the UI); a $/sf range; residual land value, NOI and cap-rate calculators that take user inputs only; a "Comparables & Valuation" and "Development Feasibility" section.
- **Reuse:** `parcel-analysis.ts` for constraint roll-up; `zoning-lookup.ts`.
- **Complexity:** Medium (8–12 days). **Cost:** $0.
- **Benefit:** the core investor and developer workflow, combined with engineering constraints.
- **Validation:** golden-file tests for comp selection (inclusion and exclusion reasons); boundary cases (multi-parcel accounts, condos, missing SF); sensitivity tests for the calculators; no output without a stated method.

### Phase 5: market trends and geographic overlays

- **Add:** scheduled ingest of FHFA HPI, HUD FMR and Census BPS; ACS in Map Inspection (reuse the `/report` client); FRED rate card; choropleth and comps `AtlasLayer`s.
- **Reuse:** `layers.ts` install pattern, the `/report` census client, `/api/mortgage-rates`.
- **Complexity:** Medium (6–10 days). **Cost:** $0.
- **Benefit:** neighborhood and market context everywhere in the U.S., not only in the six states.
- **Validation:** spot values against the agency tables; legend and geography labels; dark/light and mobile rendering in a browser.

### Phase 6: unified inspection, reporting, expansion

- **Add:** the 8-section inspection grouping; the property sections in the printable report with `licenseId` export checks; a jurisdiction coverage profile (which record families exist where); optionally Regrid/ATTOM for coverage beyond 6 states, if approved.
- **Complexity:** Medium (8–14 days) plus provider work.
- **Validation:** screen, print and source parity tests; accessibility; p95 latency against the Phase 1 baseline.

---

## 11. Risks and blockers

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Boulder CSV rights unconfirmed | **Blocker** for production comps | Written county confirmation, or keep it local/demo only |
| MLS license structure excludes an independent public tool | **Blocker** for MLS listings | Brokerage partnership decision, or use RentCast |
| Commercial lease data proprietary | **Blocker** for lease intelligence | Enterprise license, or state the gap explicitly |
| Users read AVMs or calculators as appraisals | High | Separate "modeled estimate" tier, method shown, no single headline value |
| Non-market deeds in comps | High | Filter to `Q` + priced + date-sane + single-parcel accounts |
| Wrong-parcel matches from aggregators | High | APN-within-FIPS matching ladder; unlinked records never merged |
| Utah is a non-disclosure state (third-party sources agree) | Medium | No sale-price comps in UT from public records; say so in the UI |
| OBJECTID instability | Medium | Canonical APN-based ID (Phase 1) |
| Repeated paid calls on serverless | Medium | Firestore cache + per-provider budget |
| Provider terms change | Medium | `licenseId` record with review date; deletion path |
| Privacy (owner and entity data) | Medium | No contact or skip-trace data; server-side field filtering stays |
| Prior gates still open (live probes, browser checks) | Medium | Finish them before or alongside Phase 1 |

---

## 12. Open decisions requiring your approval

1. **MLS strategy:** (a) defer MLS and use RentCast; (b) pursue a Colorado brokerage partnership (REcolorado and/or IRES, IDX or VOW), which makes Land Intelligence a broker tool; (c) email REcolorado and IRES licensing to ask about non-participant licenses before deciding.
2. **Boulder data rights:** contact the Boulder County Assessor to confirm production retention and display of the seven CSVs, including derived comps and aggregates.
3. **First paid provider:** approve a RentCast free-tier evaluation (no paid key until you approve). Decide whether ATTOM or Regrid quotes are wanted.
4. **Commercial lease:** accept the public-data gap, or request CompStak/Reonomy enterprise quotes.
5. **Durable cache:** approve using the existing Firestore database for a server-only Land Intelligence cache collection.
6. **AVMs:** show a third-party AVM at all? If yes, only in a separate "modeled estimate" box?
7. **Calculators:** approve residual-land-value, NOI and cap-rate calculators that use user inputs only, labeled as scenarios.
8. **Zillow / Redfin aggregates:** pursue written permission, or exclude them in favor of FHFA, ACS and HUD only?
9. **Entity matching:** approve exact-name owner ↔ CO SOS entity linking (Colorado only), with no person-level profiling.
10. **Phase order:** confirm that Phase 1 (Boulder deepening) runs alongside the existing open Phase 1 live-probe and rights gates, or after them.

---

### Sources consulted (2026-11-01)

MLS and standards: [REcolorado data delivery](https://recolorado.com/data/) · [REcolorado–IRES data share](https://recolorado.com/data-feeds-to-include-recolorado-rocc-and-ires-listings/) · [MLS Grid FAQ](https://mlsgrid.com/faq) · [MLS Grid: IRES](https://docs.mlsgrid.com/recent-releases/ires-multiple-listing-service-now-available-through-mls-grid) · [Spark setup](https://sparkplatform.com/docs/overview/set_up_access) · [Spark FAQ](https://sparkplatform.com/docs/overview/faq) · [Bridge getting-started (Miami REALTORS)](https://www.miamirealtors.com/wp-content/uploads/bsk-pdf-manager/2019/12/Get-started-with-the-Bridge-API-in-4-easy-steps.pdf) · [Repliers access](https://help.repliers.com/en/article/mls-data-access-requirements-who-can-use-mls-apis-wyl8lw) · [Repliers pricing](https://help.repliers.com/en/article/qa-related-to-pricing-1hbxiq3/) · [Trestle (Inman, 2017)](https://www.inman.com/2017/03/24/corelogics-trestle-now-open-for-business-will-tech-vendors-bite/) · [RESO FAQ](https://www.reso.org/faq/) · [RESO certification](https://www.reso.org/certification/) · [NAR MLS policy](https://www.nar.realtor/mls) · [NAR 2022 changes FAQ](https://www.nar.realtor/about-nar/policies/summary-of-2022-mls-changes) · [Stellar MLS](https://www.stellarmls.com/data-delivery) · [Canopy MLS](https://go.canopymls.com/data)

Providers: [RentCast docs](https://developers.rentcast.io/reference/introduction) · [RentCast API terms](https://www.rentcast.io/terms-api) · [ATTOM pricing](https://www.attomdata.com/solutions/delivery/property-data-api/pricing/) · [ATTOM trial](https://support.attomdata.com/articles/9704145040-api-pricing-trial-extensions-and-paid-plans) · [Estated status](https://cloud-help.attomdata.com/article/661-is-estated-api-being-replaced) · [BatchData (vendor blog)](https://batchdata.io/blog/best-property-data-apis-developers-2026-comparison) · [BatchData (Datarade)](https://datarade.ai/data-providers/batchdata/profile) · [Regrid plans](https://support.regrid.com/reference/plan-options) · [Regrid packages](https://regrid.com/blog/apipackages) · [CompStak](https://help.compstak.com/about-compstak-1) · [Reonomy data solutions](https://www.reonomy.com/products/data-solutions) · [Crexi Listing API](https://learn.crexi.com/listing-api-overview-crexi-help-center?hsLang=en) · [LoopNet terms](https://www.loopnet.com/solutions/fr-ca/modalites-d-utilisation-loopnet) · [CoStar terms](https://www.costar.com/about/terms-conditions)

Public data: [HUD FMR](https://www.huduser.gov/portal/datasets/fmr.html) · [FHFA HPI datasets](https://www.fhfa.gov/data/hpi/datasets) · [FHFA local HPI FAQ](https://fhfa.gov/sites/default/files/2024-09/bdl_faqs_local_hpis.pdf) · [Census BPS FAQ](https://census.gov/construction/bps/faqs/data_faq.html) · [Zillow public metrics](https://zillowgroup.com/developers/api/public-data/real-estate-metrics) · [CO business entities](https://data.colorado.gov/Business/Business-Entities-in-Colorado/4ykn-tg5h) · [Non-disclosure states (ATTOM blog)](https://www.attomdata.com/news/most-recent/do-you-know-what-non-disclosure-states-are/) · Boulder sources as listed in [DATA_SOURCE_MATRIX.md](DATA_SOURCE_MATRIX.md)
