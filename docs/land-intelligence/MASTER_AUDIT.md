# Land Intelligence architecture and capability audit

Audited 2026-10-24; updated for the 2026-10-25 Boulder storage change. Scope: this checkout only. The original audit was read-only; implementation progress is tracked in [phase tasks](PHASE_TASKS.md). A configured URL, a mock test, and an accessible service metadata page are **not** proof that a parcel query succeeds in production. See [source matrix](DATA_SOURCE_MATRIX.md) for verification levels.

## Architecture and user path

`app/land-intelligence/page.tsx` loads `LandClient.tsx`, which dynamically loads `LandApp.tsx`. `LandApp` uses the shared `components/atlas/AtlasMap.tsx` MapLibre globe and the `LAND_LAYERS` registry (`layers.ts`). Search calls `/api/land-intelligence/search`, which uses the Census geocoder or parses coordinates. The map starts in Colorado, but the page is U.S. facing. Drawing a pin, line, or area calls `/report` and `/terrain`; these are distinct from parcel inspection.

At parcel zoom, `/parcel-map` queries six configured state parcel layers (`parcel-sources.ts`), returns GeoJSON polygons and a `<state>:<OBJECTID>` key, and reports source outages and a 500-feature cap. Clicking a polygon stores its geometry in `LandApp`; `/parcel-detail` fetches that OBJECTID's attributes. `/parcel-inspection` resolves the selected key's full polygon server-side, calls source groups, and returns findings; a browser-supplied polygon cannot authorize another parcel. `MapInspection.tsx` shows `ParcelFindings.tsx`, assessor attributes, point-based zoning and site conditions, with map finding overlays from `LandApp`. `export-parcel-report.ts` produces a printable report. The route uses 4326 input/output and the ArcGIS polygon-ring converter in `parcel-inspection.ts`.

The separate `/identify` route inspects visible layers at a point; `/soil-map`, `/soil-detail`, `/crash-map`, `/facility-map`, `/road-segment`, `/zoning`, `/zoning-code`, and `/property-fill` have their own specialized flows. `zoning-lookup.ts` uses Census jurisdiction and ArcGIS catalog discovery. `county-record.ts` discovers government-labeled county parcel services and requires a matching parcel ID before filling fields; address is only a tie-breaker. AI-assisted property fill is optional and cites fetched pages; it is not a deterministic primary record source.

## Capability by discipline

| Discipline | Current evidence | State and gap |
| --- | --- | --- |
| Buildings and residential | `parcel-detail.ts` maps FL, NC, WA and other assessor fields; `boulder-property.ts` models buildings. | Partial. Local Boulder snapshot loaded on 2026-10-25; no normalized building footprint relation or agency-viewer comparison. |
| Land and cadastral | `parcel-sources.ts`, `/parcel-map`, `/parcel-detail`, `parcel-analysis.ts`. | Usable in configured parts of CO, UT, WA, FL, NC, WI when services respond; envelope routing is not county coverage proof and parcel geometry is not a survey. |
| Underground utilities | `parcel-inspection/phase3.ts` queries Denver storm mains and explicitly marks water/sewer, gas/power/telecom as unqueried. | Pilot only; no verified service laterals, depths, or easements. |
| Surveys and topography | `phase2.ts` NOAA marks, `/terrain` USGS elevation samples, contour raster in `layers.ts`. | Partial; marks are not corners, sampled elevation is not a site survey, no parcel plat feed. |
| Legal and ownership | `parcel-detail.ts` owners/legal description/sales where supplied; Boulder reader models deeds; county source links. | Partial; title, easements, rights of way, restrictions and recorded-document joins absent. |
| Permits and development | Boulder permits modeled; point zoning and AI code lookup (`zoning-lookup.ts`, `zoning-code.ts`). | Partial; local Boulder account permits loaded, but no general permit registry or defensible parcel setback calculation. |
| Environmental and ecology | NWI, EPA ECHO, Superfund, Colorado tanks via `parcel-inspection/route.ts` and `phase3.ts`. | Partial; no species or habitat parcel feed; facility proximity is not contamination. |
| Water and flood | FEMA, NWI, NHD, groundwater sites and USGS elevation. | Partial; no definitive flood coverage test, groundwater depth or drainage engineering. |
| Transportation and civil | CDOT highway findings, `/road-segment` alerts/FARS, crash map. | Colorado highway pilot and national fatal crash points; local access, bridges and all-crash history absent. |
| Geology and geotechnical | NRCS soils, Qfaults, karst, USMIN and FL subsidence. | Regional screening only; no borings, bedrock profile or geotechnical design values. |
| Hazards and restrictions | Flood, faults, mines, tanks, Superfund, subsidence; Atlas has separate disaster/mines content. | Partial; no parcel-specific wildfire/radon/protected-land determination. |
| Commercial and industrial | Parcel land use/value, ECHO facilities and tank sites. | Partial; no comprehensive commercial building, land-use history, or industrial site chronology. |

## Reuse and duplication

- Reuse `AtlasMap`, `LAND_LAYERS`, `ParcelFindings`, `MapInspection`, `ParcelDetail`, `parcel-analysis`, `arcgisFeatures`, `/report` spatial source knowledge, `zoning-lookup`, and `county-record`. Atlas apps provide candidate data and presentation patterns, not automatically valid parcel joins: see `app/atlas/disaster-atlas`, `lost-mines`, `hidden-earth`, and `utils/geo/projects.ts`.
- The same FEMA/NWI/NRCS/EPA/CDOT providers appear in `/report`, `/identify`, raster overlays, and `/parcel-inspection`. Centralize **metadata and query policy** incrementally; retain their different point, drawing, and parcel semantics. Do not replace all routes at once.
- Parcel inspection has distinct per-source statuses (`parcel-inspection.ts`) and visible notes. The UI and printable report now organize the connected results into the requested 12 subject areas (`parcel-analysis.ts`); categories without a connected parcel source point to the property record and state their limits. Twelve categories do not imply twelve complete data networks.

## Material issues and classification

1. **Trust boundary, high, locally addressed:** `/parcel-inspection` now resolves the selected key's polygon server-side and validates rings and holes. A mismatched client polygon is ignored in regression tests. Real changed/deleted parcel records and provider CRS still require agency checks.
2. **Spatial confidence, high, locally addressed:** parcel screening now filters returned geometry against the resolved polygon and tests neighboring lines, boundary-only touches, holes and islands. Provider positional accuracy and real geometry/CRS discrepancies still need agency-viewer comparisons; mapped line length remains approximate.
3. **Completeness, high, partial:** `arcgisFeatures` pages to a bounded cap and labels capped results partial. `parcel-map` still caps at 500. Coverage is not independently confirmed for most sources, so empty output remains a limited map result, never proof that a hazard or asset is absent.
4. **Availability, high (updated 2026-10-25):** `boulder-import.mjs` and `boulder-property.ts` now have an active local snapshot at `data/land-intelligence/boulder/manifest.json` with 130,112 parcels. It is ignored by Git and kept outside `public/`, so full county tables are not static assets. Production availability still requires an approved build that packages this snapshot; statewide Colorado attributes remain separate.
5. **Jurisdiction, medium:** `sourcesForBounds` uses coarse state rectangles; `phase3.ts` uses a Denver bounding rectangle, and `isColorado` uses a key prefix. Neither proves parcel jurisdiction or municipal utility-service coverage. Border and enclaves need tests and source footprints.
6. **Operations, medium:** parcel inspection has bounded ArcGIS concurrency and in-flight request reuse. Its short cache remains process-local and is not shared across serverless instances. Real provider p50/p95 latency, abort behavior, and availability telemetry remain unmeasured.
7. **Data contracts, medium:** external JSON has basic shape checks, not complete schemas; dates, spatial accuracy, source update dates, license and record-level confidence are sparse. `ParcelFinding` cannot represent `estimated` or distinguish provider outage from absent coverage beyond group status. `property-fill` uses AI and page text validation but needs an explicit lower-trust tier in any unified result.
8. **UI, medium:** `MapInspection` has a responsive bottom sheet, layer toggles, export and source links. Browser visual/accessibility and live map interaction were not checked in this audit; mock tests cannot establish them.

## Validation evidence and limits

Relevant tests are `tests/land-intelligence-parcel-inspection.test.cjs`, `land-intelligence-phase4.test.cjs`, `phase5.test.cjs`, `boulder.test.mjs`, `zoning.test.cjs`, and `terrain.test.cjs`. They include mocked route/provider checks, geometry fixtures, and source-state tests. They do not establish current remote endpoint availability, licensing, or browser behavior. The 2026-10-25 local import validated CSV-to-snapshot joins but could not compare with the agency viewer. `git status` showed pre-existing edits in Land Intelligence files at audit start; this documentation does not adjudicate those edits. No public Boulder snapshot is served. See [risk and validation](RISK_AND_VALIDATION.md).
