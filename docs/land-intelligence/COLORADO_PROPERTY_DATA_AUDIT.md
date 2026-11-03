# Colorado property data: audit for a worthwhile proof of concept

Audit only, with no code changes. Date: 2026-11-02. Rules carried over from the 6-phase plan: free sources only; no scraping, no bypassing terms, no undocumented endpoints; nothing published until its rights are recorded.

**Evidence labels:**
- **Verified:** queried live on 2026-11-02.
- **Source-stated:** the publisher's page describes it, but I did not download it.
- **To verify:** found only indirectly.

> **Update, 2026-11-02: live queries connected** (`app/land-intelligence/colorado-live.ts`). These sources are queried per parcel, and nothing is downloaded or stored:
>
> | Source | Where it appears | License |
> |---|---|---|
> | Denver sales and transfers (2010 to present: deed type, buyer and seller; none treated as qualified) | Sales history | CC BY 3.0 |
> | Adams County assessor values (actual and assessed values, total mill levy, school and fire district) | Ownership; feeds the tax estimate (assessed × mill levy, the county's definition) | CC BY 4.0 |
> | Colorado business filings for business, trust and organization owners (same-name matches only) | Ownership | Public domain |
> | **ECMC oil and gas wells**: a statewide map layer (zoom 10+, ECMC symbols and legend) and an inspection group of wells within 2,000 ft | Engineering (hazards) and feasibility constraints | Public state records |
>
> - **Measured:** warm queries take about 0.1–0.9 s, and each county call has an 8 s timeout. If a county service is slow or down, the statewide record is shown with a notice.
> - **Still to do:** El Paso, Larimer and Douglas assessor files (no query API).
>
> **Recent home sales (2026-11-02, `recent-sales.ts`, `/api/land-intelligence/recent-sales`):**
> - **Map layer:** "Recent home sales" (zoom 15+, off by default, with a 3/6/12-month toggle).
> - **Nearby list:** "Recent sales nearby" in section 5 for Colorado parcels without Boulder comparables.
> - **Denver data:** the live citywide list of priced warranty and special-warranty deeds on homes and condos. It is cached for 6 hours, and multi-parcel and future-dated records are removed.
> - **Other counties:** each parcel's statewide last sale, about a year behind.
> - **Labelling:** sales are labelled as recorded sales, not verified as market sales, and no value is estimated from them.

## 1. Bottom line

Colorado can become a strong proof of concept because its county assessors publish sale prices (it is not a non-disclosure state like Utah) and several large counties offer free bulk files. Today the tool has full county detail for Boulder only, and Boulder's republication rights are still unconfirmed. Everywhere else it relies on the statewide composite, and **that composite is much thinner than it looks**:

- **Coverage:** it covers 44 of 64 counties (2,599,937 parcels, Verified). The 20 missing counties are mostly rural: Alamosa, Baca, Bent, Chaffee, Cheyenne, Conejos, Costilla, Crowley, Delta, Fremont, Jackson, Kiowa, Kit Carson, Las Animas, Lincoln, Mineral, Montrose, Otero, Phillips and Prowers.
- **El Paso:** the largest county (277,007 parcels, Colorado Springs) has **boundaries only**. Owner, value, sale and legal fields are all 0% filled.
- **Missing sale prices:** Larimer, Douglas and Pueblo publish **no sale price** in the composite.
- **Missing values:** Larimer, Grand, Gunnison and Clear Creek publish **no value**.
- **Thin facts everywhere:** building facts (year built, area, bedrooms) are absent statewide. Zoning is filled for only 9 counties.
- **Last sale only:** the composite holds one unqualified sale per parcel. That is not enough for comparables or a sales history.
- **Freshness:** it is updated annually; this vintage was received March–May 2026.

**Recommendation:** treat the statewide composite as the base map. Add county assessor bulk files for the Front Range metro counties, which hold most of the state's parcels, and add four statewide enrichments that matter for Colorado decisions: metro and special districts, oil and gas wells, wildfire risk, and business-entity owners. That turns about 65% of Colorado parcels into a full property file: owner, values, building facts, qualified sales history, comparables with a tested value range, and tax drivers. First contact each county about republication rights, which is the lesson from Boulder.

## 2. What the statewide composite provides (Verified)

Colorado Public Parcels (Governor's Office of Information Technology). Every record is marked `sharing: Public`.

| County | Parcels | Owner | Sale price | Sale date | Value | Legal | Zoning | Land use |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| El Paso | 277,007 | 0% | 0% | 0% | 0% | 0% | 0% | 0% |
| Jefferson | 258,817 | 89% | 52% | 87% | 87% | 89% | 0% | 81% |
| Denver | 240,257 | 99% | 79% | 100% | 99% | 100% | 100% | 100% |
| Arapahoe | 231,438 | 98% | 64% | 94% | 98% | 0% | 0% | 98% |
| Adams | 188,474 | 100% | 86% | 92% | 98% | 100% | 0% | 100% |
| Larimer | 180,960 | 99% | 0% | 0% | 0% | 0% | 0% | 99% |
| Douglas | 164,818 | 100% | 0% | 0% | 95% | 100% | 0% | 100% |
| Weld | 163,491 | 100% | 79% | 79% | 97% | 100% | 0% | 100% |
| Boulder | 144,551 | 99% | 90% | 90% | 98% | 99% | 0% | 0% |
| Pueblo | 101,146 | 100% | 0% | 0% | 100% | 100% | 0% | 100% |
| Mesa | 78,984 | 99% | 85% | 85% | 97% | 99% | 44% | 99% |
| Broomfield | 27,476 | 100% | 69% | 93% | 97% | 100% | 100% | 100% |

These 12 counties hold 2.06M of the 2.6M composite parcels. The other 32 counties in the composite range from well filled (Pitkin, Routt, La Plata) to owner-only (Yuma, Ouray). Washington County is empty like El Paso.

The composite also carries owner mailing addresses. The tool deliberately does not show them (Phase 2 privacy rule), and that should stay.

## 3. County bulk sources that fill the gaps

Ranked by parcels gained times the size of the gap.

| County | Free source | What it adds | Status | Rights |
|---|---|---|---|---|
| **Denver** (240k) | Open Data Catalog: *Real Property Sales and Transfers* ArcGIS feature service, plus Parcels, Zoning and building permits | **314,041 transfers from 2010 to present**: parcel id, reception number, instrument (deed type), sale date, price, grantor, grantee, property class, market cluster, neighborhood. Exports to CSV, GeoJSON and other formats. | **Verified** (fields and count queried) | Use-constraints disclaimer seen on the dataset. The portal's terms page loaded but its license wording was not confirmed. **To verify.** |
| **El Paso** (277k) | Assessor data page (assessor.elpasoco.com/assessordata) | **Parcel file updated weekly** (ownership, land use, improvement use, value) with a published layout. **Monthly sale files** by type (single family, multi-family, vacant, commercial, agricultural, manufacturing, mobile home), listed through September 2026. | **Verified** (page read) | No terms stated on the page. **To verify.** |
| **Larimer** (181k) | Assessor Public Data Center (larimer.gov/assessor/publicdata) | Free CSV tables: Account, Owner, **Sales**, Improvement Detail, Value Detail. This fills Larimer's missing prices and values. | Source-stated (the page blocks automated fetches) | County describes it as "free to the public". Republication **to verify**. |
| **Douglas** (165k) | Assessor download page and Douglas open data | **Property Sales table** (date, price, deed type, grantor/grantee, book/page, reception), parcels and attributes. The tables ship as an MS Access 2003 database and are refreshed monthly. | Source-stated (the county GIS service returned HTTP 502 when probed) | **To verify.** |
| **Adams** (188k) | Assessor Maps & Data: detailed data dump (Admin and Appraisal text files with layouts), refreshed twice a year (last 05/04/2026). Also a weekly property-values feature service. | Building and appraisal detail. Sales fields **to verify** in the layout. | Source-stated | **To verify.** |
| **Jefferson** (259k) | Jeffco Open Data hub | Parcels with attributes. A sales table was not found. | Source-stated | **CC BY 4.0** (county page), the clearest license found |
| **Arapahoe** (231k), **Weld** (163k) | Assessor sites (Arapahoe is reported to have a "data mart") | Unknown | To verify | To verify |
| **Boulder** (145k) | Already built (Phases 1–3) | Accounts, buildings, deeds, permits, comparables | Built | **Pending county confirmation (B1)** |

**Coverage target:** Denver, El Paso, Boulder, Larimer and Douglas together hold about 1.0M parcels (39% of the composite). Adding Jefferson, Arapahoe and Adams brings it to about 1.69M (65%).

**Paid options seen and excluded:** ReportAll, Regrid, Land Records and ATTOM.

## 4. Statewide enrichments worth adding

| Enrichment | Why it matters in Colorado | Source | Status |
|---|---|---|---|
| **Business-entity owners** | Many parcels are owned by LLCs. Linking an owner name to its state filing shows entity status, formation date and jurisdiction. | Colorado Secretary of State *Business Entities* dataset, data.colorado.gov (Socrata API `4ykn-tg5h`). Returns entity id, name, status, type and formation date. | **Verified** (sample row returned) |
| **Metro and special districts** | Metro-district debt mill levies can be a large share of a Colorado tax bill, so they matter for the investment calculator and tax estimate. | DOLA special district boundaries (gis.dola.colorado.gov/CO_SpecialDistrict, downloadable by district type) plus DOLA's published mill levies (no bulk file found) | Page **Verified**. DOLA says the boundaries are **not authoritative**. |
| **Oil and gas wells** | Nearby drilling, plugged wells and setbacks affect development and buyer interest, especially in Weld, Adams and Broomfield. | ECMC (formerly COGCC) downloadable well surface locations (updated daily) and the public ECMC_Wells map service. Flowlines are **not public**. | Source-stated |
| **Wildfire risk** | Much of Colorado's foothills and mountain housing has high wildfire exposure, which affects insurance and costs. | CSFS Colorado Forest Atlas / CO-WRA 2022, CSFS open data portal | **To verify** (export terms) |
| **Geologic hazards** | Expansive soils, subsidence and landslides are common Front Range constraints. | Colorado Geological Survey | To verify |
| **Zoning** | The composite has zoning for 9 counties only. | Municipal zoning services (the existing zoning lookup already covers some) | Partial |

## 5. What this makes possible (the proof-of-concept story)

For about 65% of Colorado parcels, one click would show:
1. **Owner, with the entity resolved**, and the legal description.
2. **Values and building facts** from the county assessor.
3. **A qualified sales history**, from county sales files in place of the composite's single last sale.
4. **Comparables with a tested value range** in five or more counties, built with the Phase 3 method. Each county gets its own holdout backtest, as Boulder did (median absolute error 11.5%).
5. **Tax drivers:** mill levy plus metro-district overlap, feeding the calculator.
6. **Colorado-specific constraints:** wells, wildfire risk and geologic hazards in section 8 (development feasibility).
7. **An honest coverage profile** per county. Most of this needs no new UI; it plugs into the 8-section registry.

## 6. How it fits the existing code (reuse, no new architecture)

- **County adapters:** generalize `boulder-import.mjs` and `boulder-property.ts` into one adapter per county, all producing the same account, building, sale and permit schema. `boulder-centroids`, the comps index and `comps.ts` stay; each county gets its own calibration table, set only after its backtest passes.
- **Rights:** each county gets its own `SOURCE_RIGHTS` entry and approval flag, generalizing `LAND_BOULDER_DATA_APPROVED`. A county is served only once its terms are recorded.
- **Sale qualification:** counties code sales differently. Boulder publishes a qualification code, but Denver's transfers have an instrument type and no qualification field. A per-county rule (such as "warranty deed, priced, single parcel") is needed and must be labeled as rule-based.
- **Size:** Boulder alone is tens of MB gzipped. Five to eight counties will approach serverless bundle limits. Two options:
  - Keep per-county gzip buckets and package only approved counties.
  - Move the snapshots to the already-provisioned Firestore.

  This is a decision for later. Don't add a new service until size requires it.
- **Freshness:** El Paso updates weekly, Douglas monthly, Adams twice a year and the composite annually. Each county's coverage row should show its snapshot date.

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| County republication rights unknown (the same blocker as Boulder) | **Blocker for production** | Email each assessor before building. Develop locally behind the per-county flag. |
| Sale prices in county files may include non-market transfers | High | Use county qualification codes where published, otherwise a documented rule. Never present a single price as market value. |
| Owner entity matching makes wrong links | Medium | Exact normalized-name matching only. Show "possible match" with the filing, never merge records. |
| Special-district boundaries are not authoritative (DOLA's own statement) | Medium | Label them as a screening layer and link the county treasurer for the bill. |
| Data volume and bundle size | Medium | Per-county buckets, approved counties only. Measure before choosing storage. |
| Mixed file formats (Access database, fixed-width text, CSV, feature services) | Low | One importer per county with a fixture test, as for Boulder. |

## 8. Suggested next phases (for approval)

1. **Rights outreach, with no code:** email assessors in Denver, El Paso, Larimer, Douglas, Adams, Jefferson and Arapahoe, plus Boulder's follow-up. Record each answer.
2. **Denver and El Paso adapters:** the two largest gaps with verified sources, plus the generalized county adapter and per-county rights flag.
3. **Larimer and Douglas,** then comparables and backtests in four or more counties.
4. **Statewide enrichments:** entity owners, special districts plus mill levy, ECMC wells and wildfire risk.
5. **Jefferson, Arapahoe and Adams,** once their sales files are confirmed.

## 9. Decisions needed

- Which counties to do first. I recommend Denver and El Paso.
- Whether you will contact the assessors about rights (step 1), or want draft emails.
- Whether entity-owner lookup is wanted, since it adds business-registry details beside owner names.
- The storage threshold for moving county snapshots off the bundle (later).

## Sources

- [Colorado Public Parcels service (OIT)](https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/MapServer/0)
- [Denver Real Property Sales and Transfers service](https://services1.arcgis.com/zdB7qR0BtYrg0Xpl/arcgis/rest/services/ODC_real_property_sales_and_transfers/FeatureServer), [Denver Open Data terms](https://www.denvergov.org/opendata/termsofuse)
- [El Paso County Assessor data](https://assessor.elpasoco.com/assessordata/)
- [Larimer County Assessor Public Data Center](https://larimer.gov/assessor/publicdata), [Larimer announcement (2024)](https://larimer.gov/spotlights/2024/11/15/large-property-data-sets-information-now-available-online)
- [Douglas County assessor downloads](https://www.douglasco.gov/?p=127732), [Douglas open data](https://douglas.co.us/?p=1725)
- [Adams County Assessor Maps & Data](https://adamscountyco.gov/our-county/elected-officials/assessor/maps-data/), [Adams property values service](https://services3.arcgis.com/4PNQOtAivErR7nbT/ArcGIS/rest/services/Property_Values/FeatureServer)
- [Jefferson County Maps & Data Downloads](https://www.jeffco.us/982/Maps-Data-Downloads)
- [Colorado Information Marketplace (SOS)](https://coloradosos.gov/pubs/info_center/COinfoMarket.html), [Business Entities API](https://data.colorado.gov/resource/4ykn-tg5h.json)
- [DOLA special districts](https://gis.dola.colorado.gov/CO_SpecialDistrict), [DOLA HB24-1302 mill levy information](https://dlg.colorado.gov/hb24-1302-mill-levy-public-information)
- [ECMC downloadable data](https://ecmc.colorado.gov/data-maps-reports/downloadable-data-documents), [ECMC flowlines (restricted)](https://ecmc.colorado.gov/data-maps-reports/maps-gis/flowlines-gis-data)
- [CSFS data](https://csfs.colostate.edu/data/), [Colorado wildfire risk viewer](https://climate.colorado.gov/colorado-wildfire-risk-public-viewer)
