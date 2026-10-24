import type { AtlasLayer } from "@/components/atlas/types";
import type { ExpressionSpecification } from "maplibre-gl";
import { arcgisExportTiles } from "@/utils/geo/arcgis";
import { SOIL_CATEGORIES } from "./soil";
import { PARCEL_CATEGORIES } from "./parcel-sources";
import { CRASH_SOURCE } from "./crash";
import { FACILITY_STATUSES } from "./facility";

// Later entries draw on top: point layers (crashes, facilities) stay above fills and rasters.
export const LAND_OVERLAYS = [
  { id: "flood", label: "Flood zones", scope: "U.S. mapped areas", source: "FEMA NFHL", url: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer", layer: 28, minzoom: 7, opacity: 0.56 },
  { id: "wetlands", label: "Wetlands", scope: "U.S. mapped areas", source: "USFWS NWI", url: "https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer", layer: 0, minzoom: 8, opacity: 0.65 },
  { id: "waterways", label: "Waterways", scope: "U.S. legacy dataset", source: "USGS NHD", url: "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer", layer: 6, minzoom: 8, opacity: 0.65 },
  { id: "faults", label: "Mapped faults", scope: "U.S. 2020 release", source: "USGS Qfaults", url: "https://earthquake.usgs.gov/arcgis/rest/services/haz/Qfaults/MapServer", layer: 21, minzoom: 5, opacity: 0.8 },
  { id: "roads", label: "Highway segments", scope: "Colorado pilot", source: "CDOT", url: "https://dtdapps.codot.gov/server/rest/services/Webapps/HighwaySegments/MapServer", layer: 2, minzoom: 9, opacity: 0.8 },
  { id: "soils", label: "Soil map units", scope: "U.S. survey areas", source: "USDA NRCS", url: "https://apps.geo.fpac.usda.gov/nrcs-geodata/rest/services/soils/cg_soils/MapServer/0", layer: 0, minzoom: 12, opacity: 0.58, type: "vector" },
  { id: "parcels", label: "Parcel boundaries", scope: "CO, UT, WA, FL, NC, WI public sources", source: "State and county GIS", url: "https://gis.utah.gov/products/sgid/cadastre/parcels/", layer: 0, minzoom: 14, opacity: 0.7, type: "vector" },
  { id: "contours", label: "Elevation contours", scope: "U.S. large-scale topography", source: "USGS The National Map", url: "https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer", layer: 19, minzoom: 12, opacity: 0.75 },
  { id: "crashes", label: "Fatal crashes (2024)", scope: "U.S. mapped fatal crashes only", source: "USDOT BTS / NHTSA FARS", url: CRASH_SOURCE, layer: 0, minzoom: 8, opacity: 1, type: "vector" },
  { id: "facilities", label: "Regulated facilities", scope: "U.S. reported points", source: "EPA ECHO", url: "https://echogeo.epa.gov/arcgis/rest/services/ECHO/Facilities/MapServer", layer: 0, minzoom: 10, opacity: 0.85, type: "vector" },
] as const;

export const LAND_LAYERS: AtlasLayer[] = LAND_OVERLAYS.map((item): AtlasLayer => ({
  id: `land-${item.id}`, label: item.label, group: "Land context", description: item.scope,
  citation: { label: item.source, href: item.url },
  clickable: item.id === "soils" ? ["land-soils-fill"] : item.id === "parcels" ? ["land-parcels-fill"] : item.id === "crashes" ? ["land-crashes-points"] : item.id === "facilities" ? ["land-facilities-points"] : undefined,
  hoverLabel: item.id === "soils" ? (feature) => String(feature.properties?.muname ?? "Soil map unit") : item.id === "parcels" ? (feature) => String(feature.properties?.address || feature.properties?.id || "Parcel") : item.id === "crashes" ? () => "2024 fatal crash record" : item.id === "facilities" ? (feature) => `${feature.properties?.name ?? "EPA facility"} · ${feature.properties?.statusLabel ?? ""}` : undefined,
  install(map) {
    const sourceId = `land-${item.id}-source`;
    if (item.id === "soils") {
      map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: `<a href="${item.url}" target="_blank">USDA NRCS SSURGO</a>` });
      const color: unknown[] = ["match", ["get", "category"]];
      for (const category of SOIL_CATEGORIES) color.push(category.id, category.color);
      color.push("#88a991");
      map.addLayer({ id: "land-soils-fill", type: "fill", source: sourceId, minzoom: 12, paint: { "fill-color": color as ExpressionSpecification, "fill-opacity": 0.62 } });
      map.addLayer({ id: "land-soils-outline", type: "line", source: sourceId, minzoom: 12, paint: { "line-color": "#334155", "line-width": 0.8, "line-opacity": 0.75 } });
      map.addLayer({ id: "land-soils-selected", type: "line", source: sourceId, minzoom: 12, filter: ["==", ["get", "objectid"], -1], paint: { "line-color": "#f8fafc", "line-width": 3 } });
      return ["land-soils-fill", "land-soils-outline", "land-soils-selected"];
    }
    if (item.id === "parcels") {
      map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: "Public state and county parcel GIS" });
      map.addSource("land-parcels-selected-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      const color: unknown[] = ["match", ["get", "category"]];
      for (const category of PARCEL_CATEGORIES) color.push(category.id, category.color);
      color.push("#a5aab2");
      map.addLayer({ id: "land-parcels-fill", type: "fill", source: sourceId, minzoom: 14, paint: { "fill-color": color as ExpressionSpecification, "fill-opacity": 0.84 } });
      map.addLayer({ id: "land-parcels-outline", type: "line", source: sourceId, minzoom: 14, paint: { "line-color": "#f8fafc", "line-width": 1.15, "line-opacity": 0.88 } });
      map.addLayer({ id: "land-parcels-selected-fill", type: "fill", source: "land-parcels-selected-source", minzoom: 0, paint: { "fill-color": "#facc15", "fill-opacity": 0.22 } });
      map.addLayer({ id: "land-parcels-selected-halo", type: "line", source: "land-parcels-selected-source", minzoom: 0, paint: { "line-color": "#0f172a", "line-width": 7, "line-opacity": 0.9 } });
      map.addLayer({ id: "land-parcels-selected", type: "line", source: "land-parcels-selected-source", minzoom: 0, paint: { "line-color": "#facc15", "line-width": 4, "line-opacity": 1 } });
      return ["land-parcels-fill", "land-parcels-outline", "land-parcels-selected-fill", "land-parcels-selected-halo", "land-parcels-selected"];
    }
    if (item.id === "crashes") {
      map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: `<a href="${CRASH_SOURCE}" target="_blank">USDOT BTS / NHTSA FARS 2024</a>` });
      map.addLayer({ id: "land-crashes-halo", type: "circle", source: sourceId, minzoom: 8, paint: { "circle-radius": 9, "circle-color": "#fb7185", "circle-opacity": 0.2 } });
      map.addLayer({ id: "land-crashes-points", type: "circle", source: sourceId, minzoom: 8, paint: { "circle-radius": 5, "circle-color": "#e11d48", "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
      return ["land-crashes-halo", "land-crashes-points"];
    }
    if (item.id === "facilities") {
      // Own points instead of EPA's raster icons: one color per compliance status (see the map key), violations drawn on top.
      map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: `<a href="https://echo.epa.gov/" target="_blank">EPA ECHO</a>` });
      const color: unknown[] = ["match", ["get", "status"]];
      for (const status of FACILITY_STATUSES) color.push(status.id, status.color);
      color.push("#94a3b8");
      map.addLayer({ id: "land-facilities-points", type: "circle", source: sourceId, minzoom: item.minzoom, layout: { "circle-sort-key": ["get", "rank"] }, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4.5, 15, 7.5], "circle-color": color as ExpressionSpecification, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.75, "circle-opacity": 0.95 } });
      return ["land-facilities-points"];
    }
    const layerId = `land-${item.id}-raster`;
    const tiles = arcgisExportTiles(item.url, [item.layer]);
    map.addSource(sourceId, { type: "raster", tiles: [tiles], tileSize: 256, minzoom: item.minzoom, attribution: `<a href="${item.url}" target="_blank">${item.source}</a>` });
    map.addLayer({ id: layerId, type: "raster", source: sourceId, minzoom: item.minzoom, paint: { "raster-opacity": item.opacity } });
    return [layerId];
  },
}));
