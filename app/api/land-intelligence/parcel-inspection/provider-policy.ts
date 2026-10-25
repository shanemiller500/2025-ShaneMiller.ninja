/** Query policy for the already connected parcel-screening layers. Source URLs stay in the map registry. */
export const PROVIDER_POLICY = {
  flood: { fields: "OBJECTID,FLD_ZONE,ZONE_SUBTY,SFHA_TF", nearbyMeters: 0, emptyStatus: "coverage_unknown", note: "FEMA mapping varies by community. No returned polygon does not confirm no flood risk or mapped coverage." },
  wetlands: { fields: "OBJECTID,WETLAND_TYPE,ATTRIBUTE,ACRES", nearbyMeters: 0, emptyStatus: "coverage_unknown", note: "NWI is an inventory, not a jurisdictional wetland determination; mapped coverage and imagery dates vary." },
  waterways: { fields: "OBJECTID,GNIS_NAME,FTYPE,FCODE", nearbyMeters: 0, emptyStatus: "no_features", note: "USGS legacy hydrography can omit small or altered drainage features." },
  soils: { fields: "objectid,mukey,musym,muname,farmlndcl", nearbyMeters: 0, emptyStatus: "coverage_unknown", note: "This connected NRCS map service describes a FY2015 SSURGO snapshot, not conditions verified by a site boring. Check current Web Soil Survey data." },
  faults: { fields: "OBJECTID,fault_name,age,mapped_certainty,last_review", nearbyMeters: 0, emptyStatus: "no_features", note: "Mapped fault traces are regional reference features, not a site seismic design assessment." },
  roads: { fields: "OBJECTID,ROUTE,ALIAS,AADT,AADTYR,SPEEDLIM", nearbyMeters: 0, emptyStatus: "no_features", state: "co", note: "Colorado state highways only; local streets and legal access are not assessed." },
  facilities: { fields: "OBJECTID,REGISTRY_ID,FAC_NAME,FAC_CITY,FAC_STATE,FAC_ACCURACY_METERS", nearbyMeters: 500, emptyStatus: "coverage_unknown", note: "EPA facility coordinates may be approximate. Proximity does not establish contamination or exposure." },
  superfund: { fields: "OBJECTID,EPA_ID,Site_Name,City,State,NPL_Status,FACILITY_URL", nearbyMeters: 0, emptyStatus: "coverage_unknown", note: "EPA site polygons reflect current understanding of a whole site; they are not legal boundaries or parcel-specific contamination findings. Some sites have no mapped polygon." },
} as const;

export type SourceId = keyof typeof PROVIDER_POLICY;
