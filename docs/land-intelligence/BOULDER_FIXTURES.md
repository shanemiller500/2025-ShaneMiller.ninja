# Boulder assessor fixture ledger

These folio IDs are public parcel identifiers from the seven locally supplied [Boulder County assessor CSVs](https://bouldercounty.gov/property-and-land/assessor/data-download/). No owner, mailing, or site address is copied here. Counts were read from the ignored server-side snapshot `snapshot-2026-10-25T13-37-33-036Z` (source date `10/25/2026 4:00:39 AM`). A later county download may legitimately change them.

| Folio | Case | Accounts | Buildings | Sale/deed rows | Permit rows | Accounts with values |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `146124104006` | Single account with building, sale and permit rows | 1 | 1 | 5 | 3 | 1 |
| `157508438002` | Multiple linked accounts | 3 | 4 | 2 | 16 | 3 |
| `146332200048` | Permit-heavy single account | 1 | 1 | 4 | 15 | 1 |

**Verification state:** these counts are internal import checks only. Compare folio/account identity, building count, sale/deed qualification and dates, and permit numbers against the county property viewer before calling the records externally verified. A sale/deed row is not necessarily a market sale. Keep any viewer screenshots or response samples free of owner and mailing details. County CSV reuse and deployment rights also remain unresolved.

**2026-11-01 (Phase 1):** all three fixtures load `ready` from the active snapshot in `tests/land-intelligence-foundations.test.cjs`, and every deed date is now ISO-normalized or flagged (`placeholder`, `before_county`, `after_source`, `unparseable`). Folio `146124104006`'s live statewide `apprValTot` equals its county actual value. Fixture counts are unchanged. The agency-viewer comparison is still open. A production server now withholds these rows (`rights_pending`) until the county confirms republication rights.

**2026-11-02 (Phase 2, schema 2 snapshot `snapshot-2026-11-02T03-21-*`):** the importer now merges the county's repeated per-basement-type building rows. Across the county, building records fell from 179,951 rows to 139,552 building/sections. The three fixtures are unchanged: 1, 4 and 1 building/sections; 5, 2 and 4 deed rows; 3, 16 and 15 permit rows.
