import type { AtlasLayer } from "@/components/atlas/types";
import type { ExpressionSpecification } from "maplibre-gl";
import { arcgisExportTiles } from "@/utils/geo/arcgis";
import { SOIL_CATEGORIES } from "./soil";
import { PARCEL_CATEGORIES } from "./parcel-sources";
import { CRASH_SOURCE } from "./crash";
import { FACILITY_STATUSES } from "./facility";
import { MARKET_LAYERS, PARCEL_VALUE_LAYER, fillColorExpression, type MarketLayerId } from "./market-layers";
import { PRICE_CLASSES } from "./recent-sales";
import { UNDERGROUND_KEY } from "./underground";

// Later entries draw on top: point layers (crashes, facilities) stay above fills and rasters.
export const LAND_OVERLAYS = [
  { id: "flood", label: "Flood zones", scope: "U.S. mapped areas", source: "FEMA NFHL", url: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer", layer: 28, minzoom: 7, opacity: 0.56 },
  { id: "wetlands", label: "Wetlands", scope: "U.S. mapped areas", source: "USFWS NWI", url: "https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer", layer: 0, minzoom: 8, opacity: 0.65 },
  { id: "waterways", label: "Waterways", scope: "U.S. legacy dataset", source: "USGS NHD", url: "https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer", layer: 6, minzoom: 8, opacity: 0.65 },
  { id: "faults", label: "Mapped faults", scope: "U.S. 2020 release", source: "USGS Qfaults", url: "https://earthquake.usgs.gov/arcgis/rest/services/haz/Qfaults/MapServer", layer: 21, minzoom: 5, opacity: 0.8 },
  { id: "roads", label: "Highway segments", scope: "Colorado pilot", source: "CDOT", url: "https://dtdapps.codot.gov/server/rest/services/Webapps/HighwaySegments/MapServer", layer: 2, minzoom: 9, opacity: 0.8 },
  // Market choropleths (Phase 5): fills beneath soils and parcels. Only one is shown at a time (LandApp keeps them exclusive).
  { id: "market-value", label: "Home values (tracts)", scope: "U.S. · ACS 2020–2024 median", source: "Census ACS · TIGERweb", url: "https://www.census.gov/programs-surveys/acs/data/summary-file.html", layer: 0, minzoom: 9, opacity: 0.62, type: "vector" },
  { id: "market-rent", label: "Rents (tracts)", scope: "U.S. · ACS 2020–2024 median", source: "Census ACS · TIGERweb", url: "https://www.census.gov/programs-surveys/acs/data/summary-file.html", layer: 0, minzoom: 9, opacity: 0.62, type: "vector" },
  { id: "market-trend", label: "Home price change, 5 yr (tracts)", scope: "U.S. · FHFA tract index", source: "FHFA HPI · TIGERweb", url: "https://www.fhfa.gov/data/hpi/datasets", layer: 0, minzoom: 9, opacity: 0.62, type: "vector" },
  { id: "market-permits", label: "New construction (counties)", scope: "U.S. · permits per 1,000 homes", source: "Census Building Permits Survey", url: "https://www.census.gov/construction/bps/", layer: 0, minzoom: 5, opacity: 0.55, type: "vector" },
  { id: "soils", label: "Soil map units", scope: "U.S. survey areas", source: "USDA NRCS", url: "https://apps.geo.fpac.usda.gov/nrcs-geodata/rest/services/soils/cg_soils/MapServer/0", layer: 0, minzoom: 12, opacity: 0.58, type: "vector" },
  { id: "parcels", label: "Parcel boundaries", scope: "CO, UT, WA, FL, NC, WI public sources", source: "State and county GIS", url: "https://gis.utah.gov/products/sgid/cadastre/parcels/", layer: 0, minzoom: 14, opacity: 0.7, type: "vector" },
  { id: "parcel-value", label: "Parcel value per acre", scope: "CO, WA, FL, NC, WI statewide value fields", source: "State parcel GIS", url: "https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/MapServer", layer: 0, minzoom: 14, opacity: 0.8, type: "vector" },
  { id: "contours", label: "Elevation contours", scope: "U.S. large-scale topography", source: "USGS The National Map", url: "https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer", layer: 19, minzoom: 12, opacity: 0.75 },
  // ECMC's own status symbols (Well Status layer); MapKey shows ECMC's legend for them.
  { id: "oil-gas-wells", label: "Oil and gas wells", scope: "Colorado · ECMC well status", source: "ECMC (Colorado)", url: "https://gisdnr.state.co.us/arcgis/rest/services/ECMC_Public/Wells_Public_ECMC/MapServer", layer: 2, minzoom: 10, opacity: 1 },
  { id: "crashes", label: "Fatal crashes (2024)", scope: "U.S. mapped fatal crashes only", source: "USDOT BTS / NHTSA FARS", url: CRASH_SOURCE, layer: 0, minzoom: 8, opacity: 1, type: "vector" },
  { id: "facilities", label: "Regulated facilities", scope: "U.S. reported points", source: "EPA ECHO", url: "https://echogeo.epa.gov/arcgis/rest/services/ECHO/Facilities/MapServer", layer: 0, minzoom: 10, opacity: 0.85, type: "vector" },
  { id: "underground", label: "Underground & mines", scope: "Colorado undermined areas · U.S. historical mine symbols", source: "DRMS · USGS USMIN · CGS", url: "https://mrdata.usgs.gov/usmin/", layer: 0, minzoom: 11, opacity: 1, type: "vector" },
  { id: "recent-sales", label: "Recent home sales", scope: "Colorado · Denver live; elsewhere the statewide last sale", source: "Denver Open Data · Colorado parcels", url: "https://opendata-geospatialdenver.hub.arcgis.com/", layer: 0, minzoom: 15, opacity: 1, type: "vector" },
  { id: "comps", label: "Comparable sales", scope: "Selected Boulder County parcel", source: "Boulder County Assessor", url: "https://bouldercounty.gov/property-and-land/assessor/data-download/", layer: 0, minzoom: 0, opacity: 1, type: "vector" },
] as const;
const isMarket = (id: string): id is MarketLayerId => id in MARKET_LAYERS;
const money = (value: unknown) => typeof value === "number" ? `$${Math.round(value).toLocaleString()}` : "no estimate";

export const LAND_LAYERS: AtlasLayer[] = LAND_OVERLAYS.map((item): AtlasLayer => ({
  id: `land-${item.id}`, label: item.label, group: "Land context", description: item.scope,
  citation: { label: item.source, href: item.url },
  clickable: item.id === "soils" ? ["land-soils-fill"] : item.id === "parcels" ? ["land-parcels-fill"] : item.id === "crashes" ? ["land-crashes-points"] : item.id === "facilities" ? ["land-facilities-points"] : item.id === "comps" ? ["land-comps-points"] : item.id === "recent-sales" ? ["land-recent-sales-points"] : item.id === "underground" ? ["land-underground-points", "land-underground-openings", "land-underground-undermined"] : item.id === "parcel-value" ? ["land-parcel-value-fill"] : isMarket(item.id) ? [`land-${item.id}-fill`] : undefined,
  hoverLabel: item.id === "underground" ? (feature) => {
    const p = feature.properties ?? {};
    return p.layer === "undermined" ? `${p.label} · mapped workings + 100 ft (DRMS)${p.depth ? ` · depth ${p.depth}` : ""}` : p.layer === "opening" ? `${p.label} (CGS inventory, forest land)` : `${p.label}${p.topo ? ` · ${p.topo}` : ""} (USGS topo symbol)`;
  } : item.id === "recent-sales" ? (feature) => {
    const p = feature.properties ?? {};
    return `${p.date} · ${money(Number(p.price))} · ${p.propertyClass}${p.source === "denver" ? ` · ${p.deed} (Denver, recorded sale)` : " · last sale on the statewide layer (updated yearly)"}${p.address ? ` · ${p.address}` : ""}`;
  } : isMarket(item.id) ? (feature) => {
    const p = feature.properties ?? {};
    if (item.id === "market-value") return `${p.name}: ${p.valueBound === "at_least" ? "≥" : ""}${money(p.medianValue)} median value${p.valueReliability === "low" ? " (low reliability)" : ""}`;
    if (item.id === "market-rent") return `${p.name}: ${p.rentBound === "at_least" ? "≥" : ""}${money(p.medianRent)} median rent${p.rentReliability === "low" ? " (low reliability)" : ""}`;
    if (item.id === "market-trend") return `${p.name}: ${typeof p.fiveYear === "number" ? `${p.fiveYear >= 0 ? "+" : ""}${(p.fiveYear * 100).toFixed(1)}% over 5 yr to ${p.trendYear}` : "no FHFA tract index"}`;
    return `${p.name}: ${typeof p.permitsPerThousand === "number" ? `${p.permitsPerThousand.toFixed(1)} per 1,000 homes (${Number(p.permitUnits).toLocaleString()} units, ${p.permitYear})` : "no permit record"}`;
  } : item.id === "parcel-value" ? (feature) => {
    const p = feature.properties ?? {};
    return typeof p.valuePerAcre === "number" ? `${p.address || p.id || "Parcel"}: $${Math.round(p.valuePerAcre).toLocaleString()} per acre (${p.valueBasis} $${Number(p.totalValue).toLocaleString()})` : `${p.address || p.id || "Parcel"}: no published value`;
  } : item.id === "comps" ? (feature) => String(feature.properties?.label ?? "Comparable sale") : item.id === "soils" ? (feature) => String(feature.properties?.muname ?? "Soil map unit") : item.id === "parcels" ? (feature) => String(feature.properties?.address || feature.properties?.id || "Parcel") : item.id === "crashes" ? () => "2024 fatal crash record" : item.id === "facilities" ? (feature) => `${feature.properties?.name ?? "EPA facility"} · ${feature.properties?.statusLabel ?? ""}` : undefined,
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
    if (isMarket(item.id)) {
      const def = MARKET_LAYERS[item.id];
      const reliability = item.id === "market-value" ? "valueReliability" : item.id === "market-rent" ? "rentReliability" : "";
      map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: `<a href="${item.url}" target="_blank">${item.source}</a>` });
      // Areas without a value stay unshaded; low-reliability ACS estimates are faded (not hidden).
      map.addLayer({ id: `land-${item.id}-fill`, type: "fill", source: sourceId, minzoom: item.minzoom, filter: ["!=", ["get", def.property], null], paint: { "fill-color": fillColorExpression(def) as ExpressionSpecification, "fill-opacity": reliability ? ["case", ["==", ["get", reliability], "low"], 0.22, item.opacity] as ExpressionSpecification : item.opacity } });
      map.addLayer({ id: `land-${item.id}-outline`, type: "line", source: sourceId, minzoom: item.minzoom, paint: { "line-color": "#f8fafc", "line-width": 0.6, "line-opacity": 0.45 } });
      return [`land-${item.id}-fill`, `land-${item.id}-outline`];
    }
    if (item.id === "parcel-value") {
      // Shares the parcel source (installed just before) so the parcels are fetched once.
      if (!map.getSource("land-parcels-source")) return [];
      map.addLayer({ id: "land-parcel-value-fill", type: "fill", source: "land-parcels-source", minzoom: item.minzoom, filter: ["!=", ["get", PARCEL_VALUE_LAYER.property], null], paint: { "fill-color": fillColorExpression(PARCEL_VALUE_LAYER) as ExpressionSpecification, "fill-opacity": item.opacity } });
      return ["land-parcel-value-fill"];
    }
    if (item.id === "underground") {
      map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: "Colorado DRMS · USGS USMIN · Colorado Geological Survey" });
      if (!map.hasImage("li-undermined-hatch")) {
        // A 12 px diagonal hatch in the undermined purple, so mapped workings read as "below the surface" over any basemap.
        const size = 12, data = new Uint8Array(size * size * 4);
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          const on = (x + y) % size < 2, i = (y * size + x) * 4;
          data.set(on ? [168, 85, 247, 235] : [88, 28, 135, 70], i);
        }
        map.addImage("li-undermined-hatch", { width: size, height: size, data });
      }
      const kindColor = ["match", ["get", "kind"], ...UNDERGROUND_KEY.kinds.flatMap((kind, index) => [index, kind.color]), "#94a3b8"] as unknown as ExpressionSpecification;
      const isLayer = (name: string) => ["==", ["get", "layer"], name] as unknown as ExpressionSpecification;
      map.addLayer({ id: "land-underground-undermined", type: "fill", source: sourceId, minzoom: 11, filter: isLayer("undermined"), paint: { "fill-pattern": "li-undermined-hatch", "fill-opacity": 0.85 } });
      map.addLayer({ id: "land-underground-undermined-glow", type: "line", source: sourceId, minzoom: 11, filter: isLayer("undermined"), paint: { "line-color": UNDERGROUND_KEY.undermined.color, "line-width": 7, "line-blur": 5, "line-opacity": 0.55 } });
      map.addLayer({ id: "land-underground-undermined-edge", type: "line", source: sourceId, minzoom: 11, filter: isLayer("undermined"), paint: { "line-color": "#e9d5ff", "line-width": 1.2, "line-opacity": 0.9 } });
      map.addLayer({ id: "land-underground-areas", type: "fill", source: sourceId, minzoom: 12, filter: isLayer("usmin-area"), paint: { "fill-color": kindColor, "fill-opacity": 0.32, "fill-outline-color": kindColor } });
      map.addLayer({ id: "land-underground-glow", type: "circle", source: sourceId, minzoom: 12, filter: isLayer("usmin"), paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 6, 17, 13], "circle-color": kindColor, "circle-blur": 1, "circle-opacity": 0.5 } });
      map.addLayer({ id: "land-underground-points", type: "circle", source: sourceId, minzoom: 12, filter: isLayer("usmin"), paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 2.5, 17, 5], "circle-color": kindColor, "circle-stroke-color": "#0b1020", "circle-stroke-width": 1 } });
      // CGS openings: a ring whose weight rises with the hazard rating (0 none … 3 extreme).
      map.addLayer({ id: "land-underground-openings", type: "circle", source: sourceId, minzoom: 11, filter: isLayer("opening"), paint: { "circle-radius": ["+", 4, ["*", 1.2, ["max", 0, ["get", "hazard"]]]], "circle-color": UNDERGROUND_KEY.opening.color, "circle-stroke-color": ["step", ["get", "hazard"], "#ffffff", 2, "#ef4444"], "circle-stroke-width": ["step", ["get", "hazard"], 1.2, 2, 2.4] } });
      return ["land-underground-undermined", "land-underground-undermined-glow", "land-underground-undermined-edge", "land-underground-areas", "land-underground-glow", "land-underground-points", "land-underground-openings"];
    }
    if (item.id === "recent-sales") {
      map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: "City and County of Denver (CC BY 3.0) · Colorado OIT parcels" });
      // Fill = price class. Denver's live records get a white ring; statewide last sales (yearly, older) a thinner amber ring.
      const color = ["match", ["get", "priceClass"], ...PRICE_CLASSES.flatMap((item, index) => [index, item.color]), "#94a3b8"] as unknown as ExpressionSpecification;
      map.addLayer({ id: "land-recent-sales-points", type: "circle", source: sourceId, minzoom: 15, paint: { "circle-radius": 6, "circle-color": color, "circle-stroke-color": ["match", ["get", "source"], "denver", "#ffffff", "#f59e0b"], "circle-stroke-width": ["match", ["get", "source"], "denver", 2, 1.5] } });
      return ["land-recent-sales-points"];
    }
    if (item.id === "comps") {
      map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] }, attribution: "Boulder County Assessor" });
      // Subject = large ring; used comparables = filled blue; outliers (shown, not used) = hollow.
      map.addLayer({ id: "land-comps-points", type: "circle", source: sourceId, paint: { "circle-radius": ["match", ["get", "kind"], "subject", 9, 6.5], "circle-color": ["match", ["get", "kind"], "comp", "#2a78d6", "rgba(0,0,0,0)"], "circle-stroke-color": ["match", ["get", "kind"], "subject", "#facc15", "#ffffff"], "circle-stroke-width": ["match", ["get", "kind"], "subject", 3, 2] } });
      return ["land-comps-points"];
    }
    const layerId = `land-${item.id}-raster`;
    let tiles = arcgisExportTiles(item.url, [item.layer]);
    // Omit the black inactive-well symbols until they have direct selection support.
    // Keep these records available in the parcel's nearby-well findings.
    if (item.id === "oil-gas-wells") {
      tiles += `&layerDefs=${encodeURIComponent(JSON.stringify({ [item.layer]: "wellstat NOT IN ('PA', 'AL')" }))}`;
    }
    map.addSource(sourceId, { type: "raster", tiles: [tiles], tileSize: 256, minzoom: item.minzoom, attribution: `<a href="${item.url}" target="_blank">${item.source}</a>` });
    map.addLayer({ id: layerId, type: "raster", source: sourceId, minzoom: item.minzoom, paint: { "raster-opacity": item.opacity } });
    return [layerId];
  },
}));
