# Colorado statewide data expansion

Reviewed 2026-10-25. A statewide agency catalog is not a single complete property record. Parcel geometry, county assessor data, recorded documents, utilities, habitat, water rights, and engineering measurements have different publishers, keys, dates, rights, and spatial accuracy. Promote a feed only after a bounded live query, a known-parcel comparison, field and CRS checks, rights review, and an understandable outage/unknown state.

| Priority | Official source | Parcel value | Current app status | Next proof |
| --- | --- | --- | --- | --- |
| 1 | [Colorado Public Parcels](https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer) | Statewide contributed parcel polygon, reported owner, sale and value, account/subdivision/block/lot when counties provide them. | Parcel selection and detail configured; these extra identifier fields are normalized. Metadata checked, live query inaccessible here. Annual county aggregation can lag the county. | Verify several counties against their assessors, field nullability, date, and attributions. Never call a missing field a missing parcel fact. |
| 1 | [CDOT Local Roads](https://dtdapps.codot.gov/server/rest/services/Webapps/open_data_sde/FeatureServer/14) | Physical road centerlines, route/surface and reported traffic fields. | Bounded parcel intersection adapter added; metadata and mock geometry checked, real query still unverified. | Compare an intersecting and adjacent known parcel to CDOT map; check fields, rights, update date, CRS and performance. A centerline cannot prove legal access. |
| 1 | [CDOT Bridges and Major Culverts](https://dtdapps.codot.gov/server/rest/services/Webapps/open_data_sde/FeatureServer/0) | Nearby mapped structures and identifiers. | Bounded 250 m point adapter added; metadata and mock geometry checked, real query still unverified. | Verify a structure and a false-positive neighbor, source date and point accuracy. A point is not a footprint or a parcel improvement. |
| 2 | [Colorado DWR GIS and maps](https://dwr.colorado.gov/services/data-information/gis) | Wells, water rights and related water records. | Candidate only. | Choose a documented API and exact identifiers; test legal and spatial meaning of well/right records. A nearby well is not a parcel's water entitlement. |
| 2 | [Colorado Energy & Carbon Management Commission downloads](https://ecmc.colorado.gov/data-maps-reports/downloadable-data-documents) | Oil and gas wells, facilities and related environmental records. | Candidate only. | Identify the publisher's feature service, public-use terms, coordinate precision and status date; compare known sites. |
| 2 | [Colorado Parks and Wildlife maps/GIS](https://cpw.state.co.us/maps-and-gis) | Habitat and species context. | Candidate only. | Check dataset-specific sensitivity, public-use terms, scale and currentness before parcel screening. Habitat mapping is not a site survey. |
| 2 | [Colorado Water Conservation Board tools](https://cwcb.colorado.gov/technical-tools) | State flood and water planning context. | Candidate only. | Identify authoritative feature layers and map effective dates, then compare with FEMA without merging distinct designations. |
| 3 | [Colorado Information Marketplace](https://data.colorado.gov/) and [CDOT OTIS](https://dtdapps.codot.gov/otis/) | Discovery and transport context. | Catalog links, not automatic parcel sources. | Evaluate individual datasets, rights and refresh cycles; avoid assuming catalog listing means parcel-scale completeness. |

## Current user experience

Owner of record, last reported sale price, and appraised/assessed value appear at the top of Map Inspection. A deed price is labeled separately from value; neither is a current listing price. For Boulder, one assessor account and one account tab are visible at a time, and the 12 subject areas share one open section with the full property record. The complete rows remain available when requested. Multi-parcel accounts carry a warning because a sale or building row may belong to another parcel.

## Release gates

1. Verify state parcels and the two CDOT adapters against actual bounded service responses and official viewers across multiple counties; record attribution, reuse terms, update dates and outages.
2. Confirm whether the seven Boulder assessor CSVs may be retained and distributed in a production server snapshot. The imported snapshot is local and ignored by Git.
3. Run desktop/mobile browser inspection, keyboard and screen-reader checks, and print review. Mock tests and a successful build do not establish visual quality or live statewide coverage.
4. Add further Colorado feeds one publisher at a time with parcel-scale evidence. Local recorder, zoning, permits, legal access, utilities and building facts remain jurisdiction-dependent; no statewide completeness claim is justified.
