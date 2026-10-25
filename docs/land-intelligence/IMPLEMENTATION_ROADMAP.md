# Parcel Intelligence implementation roadmap

Revised 2026-10-24; active progress is in [phase tasks](PHASE_TASKS.md). **Three implementation phases** cover the original seven-part proposal. The audit documents are the baseline, and live source checks are part of Phase 1. Estimates are one engineer's focused working days, excluding access, licensing, procurement and deployment waits. They are ranges, not delivery dates. Every phase ships a useful increment inside the existing Map Inspection experience.

See the [ordered tasks](PHASE_TASKS.md), [architecture](ENGINE_ARCHITECTURE.md), [source matrix](DATA_SOURCE_MATRIX.md) and [validation gates](RISK_AND_VALIDATION.md).

## Phase 1 — make the existing parcel inspection trustworthy (10–19 days)

**Current state and reuse.** The Atlas map, six configured parcel sources, parcel details, 17 inspection groups, map findings and printable report already work as one user flow. Reuse `AtlasMap`, `parcel-sources.ts`, `parcel-detail.ts`, `parcel-inspection.ts`, `arcgis-query.ts`, `ParcelFindings.tsx`, `MapInspection.tsx` and `export-parcel-report.ts`. The Boulder importer exists, but its production snapshot is not loaded in this checkout. Live service behavior and rights remain unverified.

**Required changes and data.** First establish known parcel fixtures, source query evidence, rights and a browser performance baseline. Then bind every inspection to geometry resolved from its authoritative parcel record on the server. Validate CRS/topology and local spatial relationships; add a small provider registry with jurisdiction and coverage gates, pagination/partial states, bounded concurrency, request deduplication and a source-aware cache policy. Add provenance, dates, accuracy and clear states to the existing panel and report. The initial provider set is the **already configured** official state, federal and local services; no paid feed is necessary. Promote a provider to “working” only after a real bounded query and license review.

**Order and parallel work.** Tasks 01–04 establish source, rights and UI baselines and may run in parallel once fixture parcels are chosen. Tasks 05–07 establish parcel identity, spatial validation and response contracts. Tasks 08–10 convert existing providers and integrate the UI. The identity and status contract is a gate; adapter work can run independently afterward.

**Acceptance and risks.** A forged key/polygon combination cannot produce findings under the wrong parcel. Neighboring features, holes and borders are correctly classified; a provider outage leaves the other findings usable. Source caps and unknown coverage are visible. Search, selection, overlays, export and mobile sheet retain their behavior; real known-parcel and browser checks supplement mock tests. Measure request count and p95 against the baseline. Main risks are inaccurate source polygons, missing coverage metadata, licensing gaps and live endpoint changes.

**After Phase 1, what is left.** Building/ownership/deed/permit depth; most utility networks; broader environmental, geotechnical, transport and development coverage; cross-discipline reporting; nationwide jurisdiction expansion. A reliable core does not itself make every public record available.

**Recommendation for a stronger app.** Add an inspection “evidence ledger” in the panel: each source shows its coverage, last record date, check time, result limit and original record link. This gives users a quick way to judge every finding and gives the team a concrete target for source quality. Keep it concise and useful on mobile.

## Phase 2 — deepen property records and pilot infrastructure (18–39 days, plus data access)

**Current state and reuse.** `parcel-detail.ts` already maps selected state assessor fields. `boulder-import.mjs` and `boulder-property.ts` model multi-account parcels, buildings, sales and permits, but there is no active snapshot. `zoning-lookup.ts` and `county-record.ts` provide point-based discovery; `parcel-inspection/phase3.ts` queries a Denver storm line pilot and honestly marks unqueried utility categories. Reuse those paths and the Phase 1 result model.

**Required changes and data.** Acquire and review Boulder assessor files, load a validated snapshot, then join building, permit, sale, assessor and recorder records by verified identifiers. Pilot one official municipal permit/zoning source. Confirm the Denver storm layer's authority, footprint, quality and rights. Add one permitted utility-owner dataset if one is accessible. Present line accuracy, owner and as-built date where the source provides them. Recorder and utility services are jurisdiction-specific candidates, not assumed national coverage. [PHMSA's public viewer](https://www.npms.phmsa.dot.gov/AboutPublicViewer.aspx) is unsuitable for parcel-precise utility geometry.

**Order and parallel work.** Tasks 11–16 cover Boulder import, normalized records, a recorder and zoning pilot, Denver storm validation, another utility pilot and municipal development controls. Boulder and utility data access can be pursued in parallel after rights review; each adapter waits for the Phase 1 identity/provenance contract. Ship the verified Boulder profile and each approved infrastructure source as visible Map Inspection increments.

**Acceptance and risks.** A multi-account parcel retains separate building, sale and permit histories; an adjacent parcel receives none of them. Every record shows date and official source. Utility lines are shown as mapped, with positional uncertainty, and no blank map suggests excavation clearance. Outside-jurisdiction services are not queried. Assessors, recorder systems and utility owners may have different IDs, refresh cycles, access restrictions and costs; where access fails, ship the verified subset and label the remaining gap.

**After Phase 2, what is left.** Unavailable county histories and utility owners; easements/title and field-verified underground conditions; broader habitat, geology, flood/topography, roads/bridges and site feasibility; nationwide coverage and cross-source synthesis. A Boulder or Denver pilot does not imply other counties or cities are covered.

**Recommendation for a stronger app.** Give each jurisdiction a compact coverage profile: which record families are connected, their effective dates, and which require the official county or utility owner. That makes expansion measurable and prevents an impressive-looking empty result from being mistaken for a complete property file.

## Phase 3 — broaden engineering context and deliver a cohesive report (24–48 days, incremental releases)

**Current state and reuse.** FEMA, NWI, NHD, NRCS, EPA, USGS terrain/fault/karst/mine sources, FARS and CDOT already supply screening data. `parcel-analysis.ts`, `ParcelFindings.tsx`, `/road-segment` and the printable report are a base for a unified research summary. Source dates, coverage proof, current DEM-based slope, local transport and cross-source rules are incomplete.

**Required changes and data.** First correct coverage and vintage for existing FEMA/NWI/NRCS/USGS sources, then pilot 3DEP DEM slope/relief with stated resolution and datum and one verified state hazard/ecology source. Validate CDOT/FARS/COtrip and one local road or bridge source. Keep physical road proximity separate from legal access. Add deterministic cross-discipline findings only when the contributing records and geometry are verified. Extend the current panel, overlays and print export; keep a source status and date summary. Additional state, county, OGC, OSM or paid sources enter only through the same proof and rights gates, with real cost and value compared against official sources.

**Order and parallel work.** Tasks 17–20 cover environmental coverage, DEM, a state hazard candidate and transport. Those pilots can progress independently on the Phase 1 contract. Task 21 adds rule-based synthesis from verified findings; task 22 benchmarks dense parcels, mixed outages, borders, accessibility, responsive layout and report consistency. Each provider pilot is a usable release inside Map Inspection.

**Acceptance and risks.** Known flood/wetland/soil cases agree with official viewers or have documented discrepancies. DEM output states cell resolution and vertical datum; no slope or soil fact is described as a site survey. Road proximity never implies legal access. Every summary links back to records and methods, and missing inputs suppress unsupported conclusions. On-screen, map and print states agree. Measure p95, request count, response size and map interaction against the Phase 1 baseline. Risks include stale datasets, coarse geography, source caps, unknown reuse rights and users overreading screening data as engineering clearance.

**After Phase 3, what is left.** Jurisdiction-by-jurisdiction expansion, missing/private utility and legal records, field investigations, continuously changing source contracts and any optional commercial coverage. “Comprehensive” means the app clearly shows available evidence and its gaps for the selected parcel; it cannot guarantee all 12 disciplines have public parcel-level data everywhere.

**Recommendation for a stronger app.** Maintain a source-health and coverage dashboard behind the scenes, with dated known-parcel probes, contract/schema alerts and regression fixtures. In the UI, let users see “why this result applies to this parcel” on the map, including the source geometry and uncertainty. These improvements build trust without adding another mapping product or a misleading all-clear score.

## Required handoff after every phase

At the end of **each** phase, report: (1) what shipped in Map Inspection, (2) what was verified by mocks, real providers, browser, and deployment separately, (3) what remains for the next phase and outside the roadmap, (4) newly discovered risks or coverage limits, and (5) the next recommendations, ordered by user value and evidence. Update the source matrix and this roadmap to reflect actual results. If a source is blocked by rights or access, state the blocker and keep the rest of the phase usable; never silently count the candidate as delivered.

## Final architecture review

Three releases are enough to organize the work; the provider pilots within them are small, independently testable increments. Keep one parcel identity, one result contract and the existing map. Reuse data across disciplines without repeating network calls. Add durable storage, commercial feeds or a separate geometry service only when measured latency, rights or accuracy justify them. Nationwide coverage grows from verified jurisdiction profiles rather than a claim that one API covers the country.
