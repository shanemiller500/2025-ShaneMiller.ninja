# Phase 6: unified property intelligence

Status: **implemented and verified.** Date: 2026-11-02. This is the last phase of the 6-phase plan.

Phase 6 brings Phases 1–5 together. Map Inspection now has the eight numbered sections proposed in the audit (§8.1). The printable report prints the same eight sections in the same order. A rights registry controls what can be shown and exported. A coverage profile states which records each jurisdiction publishes. Paid providers (Regrid, ATTOM, MLS, RentCast) remain excluded, per the free-only rule.

## 1. What was built

| Feature | Files | Notes |
|---|---|---|
| One section registry | `inspection-sections.ts` (`INSPECTION_SECTIONS`, `sectionTitle`) | Overview, Ownership and legal, Sales history, Listings and leases, Comparables and valuation, Market intelligence, Land and engineering research, Development feasibility. Both the panel and the report read this list. |
| 8-section Map Inspection | `MapInspection.tsx` (`InspectionPanel`, `PropertyFacts` parts), `ParcelFindings.tsx` | Numbered disclosure headers, each with a one-line status (for example "6 of 9 record types published here", "67 mapped records across 12 subject areas" or "Loads when opened"). Only one section is open at a time, and content mounts only while open, so lazy sections still make one request each. Engineering subject areas open independently inside section 7. Picking a finding on the map opens section 7. The download button now sits below the sections. |
| Rights registry | `inspection-sections.ts` (`SOURCE_RIGHTS`, `sectionAllowed`) | Each source has its basis, display and export flags, attribution and review date. Listings are neither displayed nor exported because no free licensed source exists. Boulder data stays server-gated by `LAND_BOULDER_DATA_APPROVED` (Phase 1). |
| Jurisdiction coverage profile | `inspection-sections.ts` (`coverageProfile`), `CoverageProfile` in section 1 | Nine record families per state (owner, value, sale prices, building facts, tax, legal, county detail, comparables, market), each marked published, partial or not published. A note says "not published" means "not in the connected sources", not "does not exist". Boulder rows upgrade when the county snapshot is approved. |
| Development feasibility | `constraintRollup`, `ConstraintSummary`, section 8 | Zoning lookup, plus mapped records on or crossing the parcel by subject area, plus the sources that were not fully checked (unavailable, not queried, unknown coverage). The investment calculators moved here from their Phase 5 standalone section. |
| 8-section printable report | `export-parcel-report.ts` | The report uses the same numbered sections in the same order, and the overview includes the coverage table and map measurements. It now includes the calculator scenario, with each input labeled "from records", "assumption" or "entered by the user". Sections not opened before download say so. A section whose sources do not allow export prints why instead of the data. A "Sources, rights and attribution" section credits each source used. HUD is credited only when its rents were actually retrieved. |
| Accessibility | `InspectionPanel`, heading levels | Each section is an `h3` button with `aria-expanded` and `aria-controls`, and its body is a labelled `region`. Inner titles are `h4`, and there is a visible focus ring. Coverage chips carry text, not color alone. |

## 2. Verification

| Check | Result |
|---|---|
| Unit tests | `node --test tests/land-intelligence-*.cjs tests/land-intelligence-*.mjs`: **123 pass, 0 fail**. New: `tests/land-intelligence-unified.test.cjs`, covering section order; screen/print parity (the panel renders every registry section in order, and the report's `h2` titles equal the registry); the rights export check for listings; HUD attribution only when used; coverage for Utah, Boulder (pending and approved), Denver, Texas and Wisconsin; the constraint roll-up; and the scenario in the report with record, assumption and user labels, plus escaping. The Phase 1 report-order test was updated to the new section names. |
| TypeScript | Only B4 (`app/dinosors/sim/nav.ts:173`). No Land Intelligence errors. |
| Production build | `next build --experimental-build-mode compile` + `generate`: success. Traces: `market-map` and `market` include 54 market files and 0 Boulder files. `comparables`, `parcel-map` and `parcel-detail` include 0 Boulder files. No client chunk contains zlib. |
| **Browser pass (closes B5)** | Headless Chrome over the DevTools protocol against `next start`, driving the real flow: address search, pick the result, open each of the 8 sections, capture the report. **Boulder, 1345 28th St, 1400 px:** all 8 sections in order; Boulder records withheld with the rights notice; comparables withheld; market for Census Tract 122.06; 67 engineering records; zoning BT-1 plus 4 constraint records on the parcel. **Fort Lauderdale, 820 NW 1 Ave, 400 px (phone sheet):** Florida owner and values, market for Broward tract 417, 64 engineering records, zoning RMM-25. Both runs: one section open at a time; `aria-controls` matches the body id; no unnamed controls; no duplicate ids; no horizontal overflow; Enter toggles a focused section; **no console errors**. The captured reports have all 8 numbered sections, the coverage table, the listings "Not included" notice and the scenario with record labels. |
| Latency (`next start`, local, 8–20 distinct points each) | `market` p50 267 ms / p95 297 ms. `market-map` p50 121 / p95 442. `parcel-detail` p50 58 / p95 218. `comparables` p50 56 / p95 140 (rights-pending path). `parcel-map` p50 249 / **p95 12.3 s**: statewide parcel services sometimes hit the 18 s fetch timeout, which is provider latency (the Phase 6 stack summing adds negligible work). Phase 1 recorded no p95 figure, so these are the first p95 measurements. |

The dev server could not compile pages on this machine: its PostCSS worker failed to start with `0xc0000142`, a Windows process-start error, not a code fault. The browser pass therefore ran against the production build.

## 3. Blockers and open items

| ID | Item |
|---|---|
| B1 | Boulder republication rights are unconfirmed. Production withholds Boulder detail and comparables. The browser pass confirmed the withheld state, not the approved one (the approved path is covered by unit tests). |
| B2 | FEMA network access (unchanged). |
| B4 | Dinosaur Land type error at `app/dinosors/sim/nav.ts:173`, which blocks the standard `next build` (unchanged). |
| B5 | **Closed**: the browser pass is done, see §2. |
| B6 | `HUD_API_TOKEN` is not set, so rents fall back to ACS. |
| Deploy | Nothing from Phases 1–6 is committed. `data/land-intelligence/market/` (8.8 MB) must be committed for the market routes to work in production. |
| Provider latency | Statewide parcel services occasionally take up to 18 s (`parcel-map` p95). A shorter timeout with a partial-result notice is a possible follow-up. |
| Out of scope (free-only rule) | Regrid/ATTOM coverage beyond 6 states, MLS/RentCast listings and commercial lease data. |
