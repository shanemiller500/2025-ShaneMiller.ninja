# Risk register and validation strategy

Audited 2026-10-24. This is a public-record research product. Map data, county records and derived analysis must remain distinct from field verification, title opinion, permit determination and engineering design. Follow [architecture](ENGINE_ARCHITECTURE.md) and [source ledger](DATA_SOURCE_MATRIX.md).

| Risk / current evidence | Severity | Control and proof before release |
| --- | --- | --- |
| Wrong parcel geometry: `/parcel-inspection` accepts any valid polygon with a syntactically valid key. | Critical | Resolve exact key and geometry on server; compare source feature version/fingerprint. Fuzz mismatch, deleted OBJECTID, neighboring and border parcel cases. |
| False spatial match: ArcGIS returns a feature but `finding()` assumes all non-point results intersect; point location may be approximate. | High | Local topology check of authoritative geometries; store relation method and source positional accuracy. Fixtures: shared boundary, sliver, hole, multipart parcel, nearby point with large uncertainty. Independent known-parcel viewer comparison. |
| False negative from 40/500 caps, failed sublayer, unmapped county or unknown coverage. | High | Explicit `partial`, `outside`, `coverage_unknown` or `source_error`; page to a bounded budget; require coverage footprint before `no_features`. Simulate max records and one failed karst layer. |
| Cross-county ID collision, inconsistent assessor IDs, account/folio one-to-many. | High | Namespace by provider, jurisdiction and ID; county-specific crosswalk; never merge on street address or approximate point alone. Validate Boulder multi-account fixtures and actual known folios before activation. |
| Stale/legal status: assessor, deeds, zoning, permits, hazard maps have different effective dates. | High | Preserve record date, source update date, checked time and version; link official document; make no title, ownership, setback, code-compliance or clearance claim without jurisdiction-specific source and date. |
| Utility safety and access restrictions. | High | Owner permission and licensed dataset review; show line uncertainty; no service lateral/depth or excavation clearance claim. [PHMSA](https://www.npms.phmsa.dot.gov/AboutPublicViewer.aspx) says its viewer omits distribution lines and has minimum ±500 ft positional accuracy. |
| FEMA/NWI/soil/EPA coverage and engineering misuse. | High | Source-specific coverage and vintage; clearly state [NWI reconnaissance limits](https://www.fws.gov/page/national-wetlands-inventory-frequently-asked-questions), [EPA limitations](https://www.epa.gov/system/files/documents/2023-03/enviro-contam-contam-lands-metadata-FY21.pdf), DEM/soil resolution. Never turn lack of mapped feature into absence. |
| CRS, datum, topology and metric errors. | High | Boundary contract: WGS84 lon/lat GeoJSON with original WKID retained; validate orientation, holes, self-intersections and bbox. Use projected/geodesic distances appropriate to latitude and verify DEM vertical datum before combining heights. |
| Licensing and restricted records. | High | Per-provider rights/attribution/retention/commercial-use review before bulk storage or redistribution. “Publicly visible” is insufficient. Keep owner data server controlled and avoid storing downloaded personal data in tests/logs. |
| Source outages, quotas and excessive latency. | Medium | Source-level timeout, bounded concurrency, retry only idempotent transient failures with backoff, request cancellation, in-flight dedup, short TTL tied to source version. Synthetic outage tests plus measured p50/p95 and provider request count. |
| Cache drift/serverless behavior. | Medium | Treat current process Map as opportunistic; no cross-instance guarantee. Key by parcel/source/geometry version, never cache an outage as clean. Test refresh after source change and error recovery. |
| AI-enriched facts and dynamic catalog discovery. | Medium | Mark AI-derived or catalog-discovered values separately; require exact county/parcel match and cited page. `property-fill.ts` and `county-record.ts` already have guardrails, but they do not prove all facts. Do not convert AI or OSM proximity into legal/engineering conclusions. |
| Rendering/accessibility regression. | Medium | Keep `AtlasMap`/`MapInspection` composition and overlay IDs; test dark/light, mobile sheet, keyboard controls, focus, source links, dense features, print, reduced motion. Mock route tests do not prove browser behavior. |

## Verification ladder

1. **Code inspection:** identify exact route, adapter, field map and UI consumer. Current audit covers this level.
2. **Metadata probe:** official endpoint exposes layer, geometry, CRS, fields, max result, update metadata and allowed query operations. During this audit only Colorado parcel layer metadata and selected agency documentation were checked externally. Other configured URLs remain unverified live.
3. **Real bounded query:** use a known non-sensitive parcel, capture HTTP/schema, source ID, actual geometry, expected result, response time and date. Repeat for no-data and outage. This has not been completed here.
4. **Independent authority comparison:** check result against agency public viewer/record document, including jurisdiction, vintage and coverage. Required for new source promotion.
5. **Local regression:** run focused existing route/geometry tests, TypeScript and build as relevant. Mocks exercise contract/error paths, not provider uptime.
6. **Browser release:** search, select, toggle, map highlight, detail, print, mobile, keyboard and theme at known parcels. A production deployment adds network/server-log checks; local route health is insufficient.

## Quantitative release targets to agree at the start of Phase 1

Record baseline before setting hard performance numbers. Proposed starting gates: no more than one in-flight call per provider per parcel per instance; a five-at-once ArcGIS budget unless measured otherwise; no uncaught provider error; response explicitly partial at limits; map layers remain responsive with a dense parcel. Measure p50/p95 inspection latency, source request count, response bytes, feature count and MapLibre frame responsiveness. Compare each phase to the measured baseline; relax a threshold only with a documented product reason.

## Decisions before implementation

1. Which two or three jurisdictions form the first production-grade pilot, and which known non-sensitive parcels serve as regression fixtures?
2. Are county assessor/recorder/utility records allowed to be cached, printed and commercially displayed under their current terms? Boulder seven CSVs and municipal assets need explicit review.
3. What default proximity radii and spatial confidence labels are acceptable for each data type? The current 500 m/1 km buffers are screening choices, not engineering tolerances.
4. Is a server-side durable cache necessary after the Phase 1 baseline measurement, or is bounded ephemeral caching sufficient?
5. Which official sources may be described as covered after a successful query, and what footprint/effective-date evidence supports that statement?

These planning documents do not authorize a Phase 1 code change. When implementation is approved, first prove source access, then bind a selected parcel to its authoritative geometry. At the end of each of the three phases, report delivered behavior, verified evidence, remaining gaps and recommendations as required by the [roadmap](IMPLEMENTATION_ROADMAP.md).
