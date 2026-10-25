"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import maplibregl, { type Map as MlMap } from "maplibre-gl";
import { Activity, ArrowLeft, ArrowRight, Building2, CarFront, Check, ChevronDown, CircleHelp, Crosshair, Database, Download, Droplets, Eraser, Factory, Layers3, Leaf, MapPin, MapPinned, Minus, Moon, Mountain, Pencil, Plus, RotateCcw, Route, Search, Satellite, Sprout, Sun, Undo2, Users, Waves, X } from "lucide-react";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { useAtlasTheme } from "@/components/atlas/Hud";
import type { AtlasLayer, Basemap } from "@/components/atlas/types";
import { areaSquareMeters, lengthMeters, shapeCenter, shapeGeoJSON, validShape, type AnalysisShape, type Coord, type ShapeKind } from "./geometry";
import { LAND_LAYERS, LAND_OVERLAYS } from "./layers";
import { MapInspection } from "./MapInspection";
import { PARCEL_INSPECTION_GROUPS, pointInParcel, type ParcelFinding, type ParcelGeometry, type ParcelInspectionReport } from "./parcel-inspection";
import { MapKey } from "./MapKey";
import { focusGeoJSON, type FocusScope } from "./report-focus";
import { PARCEL_SOURCES, type ParcelRecord } from "./parcel-sources";
import type { ParcelDetail } from "./parcel-detail";
import type { FatalCrash } from "./crash";
import type { EpaFacility } from "./facility";
import { downloadReport } from "./export-report";
import { EvidenceSummary, TerrainCard } from "./SiteAnalysis";
import type { Facility, Finding, Report, FeatureSet, Parcel, Road, TerrainResult } from "./report-types";

type Mode = "browse" | "road" | ShapeKind;
type SearchResult = { label: string; detail?: string; provider?: string; precisionType?: "address" | "street" | "place" | "coordinate"; center: Coord };
type SoilSelection = { kind: "soil"; point: Coord; properties: Record<string, string | number | null> };
type ParcelSelection = { kind: "parcel"; point: Coord; properties: ParcelRecord & { parcelKey: string } };
type CrashSelection = { kind: "crash"; point: Coord; properties: FatalCrash };
type FacilitySelection = { kind: "facility"; point: Coord; properties: EpaFacility };
type OverlaySelection = { kind: "overlay"; results: { id: string; label: string; url: string; status: string; features: Record<string, unknown>[] }[] };
type Inspection = SoilSelection | ParcelSelection | CrashSelection | FacilitySelection | OverlaySelection;
type SoilComponent = { name: string; percentage: number | null; hydric: string; drainage: string; classification: string; slopePercent: number | null };

const DRAW_LAYER: AtlasLayer = {
  id: "study-shape", label: "Study shape", group: "Analysis", citation: { label: "Your drawing", href: "#" },
  install(map) {
    map.addSource("study-shape-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "study-shape-fill", type: "fill", source: "study-shape-source", paint: { "fill-color": "#06b6d4", "fill-opacity": 0.2 } });
    map.addLayer({ id: "study-shape-line", type: "line", source: "study-shape-source", paint: { "line-color": "#22d3ee", "line-width": 3, "line-opacity": 0.95 } });
    return ["study-shape-fill", "study-shape-line"];
  },
};

const FOCUS_LAYER: AtlasLayer = {
  id: "report-focus", label: "Report focus", group: "Analysis", citation: { label: "Your study boundary", href: "#" },
  install(map) {
    map.addSource("report-focus-source", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: "report-focus-fill", type: "fill", source: "report-focus-source", paint: { "fill-color": "#facc15", "fill-opacity": 0.2 } });
    map.addLayer({ id: "report-focus-halo", type: "line", source: "report-focus-source", paint: { "line-color": "#0f172a", "line-width": 5, "line-opacity": 0.75 } });
    map.addLayer({ id: "report-focus-line", type: "line", source: "report-focus-source", paint: { "line-color": "#facc15", "line-width": 3, "line-dasharray": [2, 1] } });
    return ["report-focus-fill", "report-focus-halo", "report-focus-line"];
  },
};

const INSPECTION_LAYERS: AtlasLayer[] = PARCEL_INSPECTION_GROUPS.map((group) => ({
  id: `parcel-inspection-${group.id}`, label: group.label, group: "Parcel findings", citation: { label: "Source details in Map Inspection", href: "#" },
  clickable: [`parcel-inspection-${group.id}-source-point`, `parcel-inspection-${group.id}-source-line`, `parcel-inspection-${group.id}-source-fill`],
  hoverLabel: (feature) => `${group.label}: ${String(feature.properties?.name ?? "mapped feature")}`,
  install(map) {
    const source = `parcel-inspection-${group.id}-source`;
    map.addSource(source, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    const fill = `${source}-fill`, line = `${source}-line`, point = `${source}-point`;
    map.addLayer({ id: fill, type: "fill", source, filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": group.color, "fill-opacity": 0.24 } });
    map.addLayer({ id: line, type: "line", source, filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]], paint: { "line-color": group.color, "line-width": 3, "line-opacity": 0.95 } });
    map.addLayer({ id: point, type: "circle", source, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-color": group.color, "circle-radius": 6, "circle-stroke-color": "#0f172a", "circle-stroke-width": 2 } });
    return [fill, line, point];
  },
}));
const INSPECTION_SELECTED_LAYER: AtlasLayer = {
  id: "parcel-inspection-selected", label: "Selected finding", group: "Parcel findings", citation: { label: "Source details in Map Inspection", href: "#" },
  install(map) {
    const source = "parcel-inspection-selected-source";
    map.addSource(source, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({ id: `${source}-line`, type: "line", source, filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]], paint: { "line-color": "#fff", "line-width": 5, "line-opacity": 0.9 } });
    map.addLayer({ id: `${source}-point`, type: "circle", source, filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 10, "circle-color": "#fff", "circle-opacity": 0.15, "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
    return [`${source}-line`, `${source}-point`];
  },
};

// Inspect comes first and is the default; a search result still drops a pin and opens its report.
const TOOL = [
  { id: "line" as const, label: "Route", icon: Pencil, hint: "Click points along a road or corridor" },
  { id: "area" as const, label: "Area", icon: Crosshair, hint: "Click around a site or study area" },
];

const formatLength = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters).toLocaleString()} m`;
const formatArea = (squareMeters: number) => squareMeters >= 1000000 ? `${(squareMeters / 1000000).toFixed(2)} km²` : `${Math.round(squareMeters).toLocaleString()} m²`;

export default function LandApp() {
  const dark = useAtlasTheme();
  const { setTheme } = useTheme();
  const [map, setMap] = useState<MlMap | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const addressSearchController = useRef<AbortController | null>(null);
  const addressSearchTimeout = useRef<number | null>(null);
  const keyboardVertex = useRef<number | null>(null);
  const identifyController = useRef<AbortController | null>(null);
  const addressParcelController = useRef<AbortController | null>(null);
  const refreshReport = useRef(false);
  const refreshTerrain = useRef(false);
  const [mode, setMode] = useState<Mode>("browse");
  const [shape, setShape] = useState<AnalysisShape | null>(null);
  const [complete, setComplete] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>("map");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const selectedAddressValue = useRef<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [flyTo, setFlyTo] = useState<{ center: Coord; zoom: number; nonce: number } | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [reportError, setReportError] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportNonce, setReportNonce] = useState(0);
  const [showReport, setShowReport] = useState(true);
  const [terrain, setTerrain] = useState<TerrainResult | null>(null);
  const [terrainError, setTerrainError] = useState("");
  const [terrainLoading, setTerrainLoading] = useState(false);
  const [terrainNonce, setTerrainNonce] = useState(0);
  const [showLayers, setShowLayers] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({ "study-shape": true, "report-focus": true, "land-soils": true, "land-parcels": true, "land-crashes": true, "land-contours": true });
  const [soilData, setSoilData] = useState<GeoJSON.FeatureCollection>({ type: "FeatureCollection", features: [] });
  const [soilStatus, setSoilStatus] = useState("Zoom in to level 12 to see colored soil map units.");
  const [parcelData, setParcelData] = useState<GeoJSON.FeatureCollection>({ type: "FeatureCollection", features: [] });
  const [selectedParcel, setSelectedParcel] = useState<GeoJSON.Feature | null>(null);
  const [parcelInspection, setParcelInspection] = useState<ParcelInspectionReport | null>(null);
  const [parcelInspectionLoading, setParcelInspectionLoading] = useState(false);
  const [parcelInspectionError, setParcelInspectionError] = useState("");
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [parcelStatus, setParcelStatus] = useState("Zoom in to level 14 to see parcel boundaries in connected states.");
  const [crashData, setCrashData] = useState<GeoJSON.FeatureCollection>({ type: "FeatureCollection", features: [] });
  const [crashStatus, setCrashStatus] = useState("Zoom in to level 8 to see 2024 fatal crash points.");
  const [facilityData, setFacilityData] = useState<GeoJSON.FeatureCollection>({ type: "FeatureCollection", features: [] });
  const [facilityStatus, setFacilityStatus] = useState("Zoom in to level 10 to see EPA regulated facilities.");
  const [reportFocus, setReportFocus] = useState<keyof Report | null>(null);
  const [focusScope, setFocusScope] = useState<FocusScope>("inside");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [propertyDetailResult, setPropertyDetailResult] = useState<{ key: string; detail: ParcelDetail } | null>(null);
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [propertyError, setPropertyError] = useState("");
  const [soilComponents, setSoilComponents] = useState<SoilComponent[] | null>(null);
  const [soilDetailError, setSoilDetailError] = useState("");

  const focusData = useMemo(() => shape && complete && reportFocus ? focusGeoJSON(shape, selectedParcel, focusScope) : { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection, [shape, complete, reportFocus, selectedParcel, focusScope]);
  const data = useMemo(() => {
    const currentInspection = inspection?.kind === "parcel" && parcelInspection?.parcelKey === inspection.properties.parcelKey && selectedParcel?.properties?.parcelKey === inspection.properties.parcelKey ? parcelInspection : null;
    const findingData = Object.fromEntries(PARCEL_INSPECTION_GROUPS.map((group) => [`parcel-inspection-${group.id}-source`, { type: "FeatureCollection", features: (currentInspection?.groups.find((item) => item.id === group.id)?.findings ?? []).map((finding) => ({ type: "Feature", id: finding.id, properties: { id: finding.id, name: finding.name }, geometry: finding.geometry })) } as GeoJSON.FeatureCollection]));
    const selectedFinding = currentInspection?.groups.filter((group) => visibleLayers[`parcel-inspection-${group.id}`] !== false).flatMap((group) => group.findings).find((finding) => finding.id === selectedFindingId);
    return { ...findingData, "parcel-inspection-selected-source": { type: "FeatureCollection", features: selectedFinding ? [{ type: "Feature", properties: {}, geometry: selectedFinding.geometry }] : [] } as GeoJSON.FeatureCollection, "study-shape-source": shape ? shapeGeoJSON(shape) : { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection, "report-focus-source": focusData, "land-soils-source": soilData, "land-parcels-source": parcelData, "land-parcels-selected-source": { type: "FeatureCollection", features: selectedParcel ? [{ ...selectedParcel, geometry: currentInspection?.geometry ?? selectedParcel.geometry }] : [] } as GeoJSON.FeatureCollection, "land-crashes-source": crashData, "land-facilities-source": facilityData };
  }, [shape, soilData, parcelData, selectedParcel, crashData, facilityData, focusData, parcelInspection, selectedFindingId, visibleLayers, inspection]);
  const onMapReady = useCallback((instance: MlMap) => setMap(instance), []);

  const propertyKey = inspection?.kind === "parcel" ? inspection.properties.parcelKey : null;
  useEffect(() => {
    setParcelInspection(null); setParcelInspectionError(""); setSelectedFindingId(null);
    if (!propertyKey || !selectedParcel || (selectedParcel.geometry.type !== "Polygon" && selectedParcel.geometry.type !== "MultiPolygon")) { setParcelInspectionLoading(false); return; }
    const controller = new AbortController();
    setParcelInspectionLoading(true);
    fetch("/api/land-intelligence/parcel-inspection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parcelKey: propertyKey }), signal: controller.signal })
      .then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error || "Parcel-wide inspection failed."); return json as ParcelInspectionReport; })
      .then((result) => { if (!controller.signal.aborted) setParcelInspection(result); })
      .catch((error) => { if (!controller.signal.aborted) setParcelInspectionError(error.message || "Parcel-wide inspection failed."); })
      .finally(() => { if (!controller.signal.aborted) setParcelInspectionLoading(false); });
    return () => controller.abort();
  }, [propertyKey, selectedParcel]);
  useEffect(() => {
    setPropertyDetailResult(null);
    setPropertyError("");
    if (!propertyKey) { setPropertyLoading(false); return; }
    const controller = new AbortController();
    setPropertyLoading(true);
    fetch(`/api/land-intelligence/parcel-detail?key=${encodeURIComponent(propertyKey)}`, { signal: controller.signal })
      .then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error || "Property record unavailable."); return json.detail as ParcelDetail; })
      .then((detail) => { if (!controller.signal.aborted) setPropertyDetailResult({ key: propertyKey, detail }); })
      .catch((error) => { if (!controller.signal.aborted) setPropertyError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setPropertyLoading(false); });
    return () => controller.abort();
  }, [propertyKey]);

  useEffect(() => {
    if (!map) return;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loadSoils = () => {
      controller?.abort();
      if (!visibleLayers["land-soils"] || map.getZoom() < 12) {
        setSoilData({ type: "FeatureCollection", features: [] });
        setSoilStatus(visibleLayers["land-soils"] ? "Zoom in to level 12 to see colored soil map units." : "Soil layer is off.");
        return;
      }
      const bounds = map.getBounds();
      const coords = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      if (coords[2] - coords[0] > 0.25 || coords[3] - coords[1] > 0.25) { setSoilStatus("Zoom in further to load individual soil polygons."); setSoilData({ type: "FeatureCollection", features: [] }); return; }
      const currentController = new AbortController();
      controller = currentController;
      setSoilStatus("Loading USDA soil polygons…");
      fetch(`/api/land-intelligence/soil-map?bbox=${coords.map((value) => value.toFixed(6)).join(",")}`, { signal: currentController.signal })
        .then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Soil polygons unavailable."); return json; })
        .then((json) => { setSoilData({ type: "FeatureCollection", features: json.features }); setSoilStatus(json.limited ? `${json.features.length} polygons shown. Zoom in for a complete view.` : `${json.features.length} mapped polygons · click one for details.`); })
        .catch((error) => { if (!currentController.signal.aborted) { setSoilData({ type: "FeatureCollection", features: [] }); setSoilStatus(error.message); } });
    };
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(loadSoils, 180); };
    map.on("moveend", schedule);
    schedule();
    return () => { map.off("moveend", schedule); if (timer) clearTimeout(timer); controller?.abort(); };
  }, [map, visibleLayers]);

  useEffect(() => {
    if (!map) return;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loadParcels = () => {
      controller?.abort();
      if (!visibleLayers["land-parcels"] || map.getZoom() < 14) {
        setParcelData({ type: "FeatureCollection", features: [] });
        setParcelStatus(visibleLayers["land-parcels"] ? "Zoom in to level 14 to see parcel boundaries in connected states." : "Parcel layer is off.");
        return;
      }
      const bounds = map.getBounds();
      const coords = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      if (coords[2] - coords[0] > 0.2 || coords[3] - coords[1] > 0.2) { setParcelData({ type: "FeatureCollection", features: [] }); setParcelStatus("Zoom in further to load individual parcels."); return; }
      const current = new AbortController();
      controller = current;
      setParcelStatus("Loading public parcel boundaries…");
      fetch(`/api/land-intelligence/parcel-map?bbox=${coords.map((value) => value.toFixed(6)).join(",")}`, { signal: current.signal })
        .then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Parcel data unavailable."); return json; })
        .then((json) => {
          setParcelData({ type: "FeatureCollection", features: json.features });
          setParcelStatus(json.coverage === "outside" ? "No parcel source connected here yet. CO, UT, WA, FL, NC and WI are connected." : json.coverage === "unavailable" ? "The public parcel source did not respond." : json.limited ? `${json.features.length} parcels shown · zoom in for a complete view.` : json.features.length === 0 ? `No polygon returned by ${json.sources.map((source: { state: string }) => source.state).join(", ")}; county coverage may have gaps.` : `${json.features.length} parcels from ${json.sources.map((source: { state: string }) => source.state).join(", ")} · click a boundary for details.${json.unavailable.length ? " Some sources did not respond." : ""}`);
        })
        .catch((error) => { if (!current.signal.aborted) { setParcelData({ type: "FeatureCollection", features: [] }); setParcelStatus(error.message); } });
    };
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(loadParcels, 220); };
    map.on("moveend", schedule);
    schedule();
    return () => { map.off("moveend", schedule); if (timer) clearTimeout(timer); controller?.abort(); };
  }, [map, visibleLayers]);

  useEffect(() => {
    if (!map) return;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loadCrashes = () => {
      controller?.abort();
      if (!visibleLayers["land-crashes"] || map.getZoom() < 8) {
        setCrashData({ type: "FeatureCollection", features: [] });
        setCrashStatus(visibleLayers["land-crashes"] ? "Zoom in to level 8 to see 2024 fatal crash points." : "Fatal crash layer is off.");
        return;
      }
      const bounds = map.getBounds();
      const coords = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      if (coords[2] - coords[0] > 2 || coords[3] - coords[1] > 2) { setCrashData({ type: "FeatureCollection", features: [] }); setCrashStatus("Zoom in further to load fatal crash points."); return; }
      const current = new AbortController(); controller = current;
      setCrashStatus("Loading 2024 fatal crashes…");
      fetch(`/api/land-intelligence/crash-map?bbox=${coords.map((value) => value.toFixed(6)).join(",")}`, { signal: current.signal })
        .then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Fatal crash data unavailable."); return json; })
        .then((json) => { setCrashData({ type: "FeatureCollection", features: json.features }); setCrashStatus(json.limited ? `${json.features.length} fatal crashes shown; zoom in for a complete view.` : `${json.features.length} mapped fatal crashes in this view (2024 only).`); })
        .catch((error) => { if (!current.signal.aborted) { setCrashData({ type: "FeatureCollection", features: [] }); setCrashStatus(error.message); } });
    };
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(loadCrashes, 220); };
    map.on("moveend", schedule); schedule();
    return () => { map.off("moveend", schedule); if (timer) clearTimeout(timer); controller?.abort(); };
  }, [map, visibleLayers]);

  useEffect(() => {
    if (!map) return;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loadFacilities = () => {
      controller?.abort();
      if (!visibleLayers["land-facilities"] || map.getZoom() < 10) {
        setFacilityData({ type: "FeatureCollection", features: [] });
        setFacilityStatus(visibleLayers["land-facilities"] ? "Zoom in to level 10 to see EPA regulated facilities." : "EPA facility layer is off.");
        return;
      }
      const bounds = map.getBounds();
      const coords = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      if (coords[2] - coords[0] > 1 || coords[3] - coords[1] > 1) { setFacilityData({ type: "FeatureCollection", features: [] }); setFacilityStatus("Zoom in further to load EPA facilities."); return; }
      const current = new AbortController(); controller = current;
      setFacilityStatus("Loading EPA regulated facilities…");
      fetch(`/api/land-intelligence/facility-map?bbox=${coords.map((value) => value.toFixed(6)).join(",")}`, { signal: current.signal })
        .then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "EPA facility data unavailable."); return json; })
        .then((json) => { setFacilityData({ type: "FeatureCollection", features: json.features }); setFacilityStatus(json.limited ? `${json.features.length} EPA facilities shown; zoom in for a complete view.` : `${json.features.length} EPA regulated facilit${json.features.length === 1 ? "y" : "ies"} in this view. Tap one for details.`); })
        .catch((error) => { if (!current.signal.aborted) { setFacilityData({ type: "FeatureCollection", features: [] }); setFacilityStatus(error.message); } });
    };
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(loadFacilities, 220); };
    map.on("moveend", schedule); schedule();
    return () => { map.off("moveend", schedule); if (timer) clearTimeout(timer); controller?.abort(); };
  }, [map, visibleLayers]);

  useEffect(() => {
    if (inspection?.kind !== "soil") { setSoilComponents(null); setSoilDetailError(""); return; }
    const key = String(inspection.properties.mukey ?? "");
    const controller = new AbortController();
    setSoilComponents(null); setSoilDetailError(""); setInspectionLoading(true);
    fetch(`/api/land-intelligence/soil-detail?mukey=${encodeURIComponent(key)}`, { signal: controller.signal })
      .then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Component data unavailable."); return json; })
      .then((json) => setSoilComponents(json.components))
      .catch((error) => { if (!controller.signal.aborted) setSoilDetailError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setInspectionLoading(false); });
    return () => controller.abort();
  }, [inspection]);

  const inspectOtherAt = useCallback((point: Coord, roadsOnly = false) => {
    if (!map) return;
    setShowReport(false);
    identifyController.current?.abort();
    const layers = roadsOnly ? ["roads"] : LAND_OVERLAYS.filter((layer) => layer.id !== "soils" && layer.id !== "parcels" && layer.id !== "crashes" && layer.id !== "facilities" && visibleLayers[`land-${layer.id}`] && map.getZoom() >= layer.minzoom).map((layer) => layer.id);
    if (!layers.length) { setInspection({ kind: "overlay", results: [] }); setInspectionLoading(false); return; }
    const controller = new AbortController();
    identifyController.current = controller;
    setInspection(null); setInspectionLoading(true);
    fetch("/api/land-intelligence/identify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lng: point[0], lat: point[1], layers }), signal: controller.signal })
      .then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Feature lookup failed."); return json; })
      .then((json) => setInspection({ kind: "overlay", results: json.results }))
      .catch(() => { if (!controller.signal.aborted) setInspection({ kind: "overlay", results: [] }); })
      .finally(() => { if (!controller.signal.aborted) setInspectionLoading(false); });
  }, [map, visibleLayers]);

  useEffect(() => {
    if (!map) return;
    const click = (event: maplibregl.MapMouseEvent) => {
      if (mode === "road") { inspectOtherAt([event.lngLat.lng, event.lngLat.lat], true); setMode("browse"); return; }
      if (mode === "browse") {
        addressParcelController.current?.abort();
        addressParcelController.current = null;
        setInspectionLoading(false);
        identifyController.current?.abort();
        // Small points get a finger-sized target: anything within 10 px of the tap.
        const touch: [maplibregl.PointLike, maplibregl.PointLike] = [[event.point.x - 10, event.point.y - 10], [event.point.x + 10, event.point.y + 10]];
        const parcelHit = visibleLayers["land-parcels"] && map.getLayer("land-parcels-fill") ? map.queryRenderedFeatures(event.point, { layers: ["land-parcels-fill"] })[0] : null;
        const findingLayers = PARCEL_INSPECTION_GROUPS.filter((group) => visibleLayers[`parcel-inspection-${group.id}`] !== false).flatMap((group) => [`parcel-inspection-${group.id}-source-point`, `parcel-inspection-${group.id}-source-line`, `parcel-inspection-${group.id}-source-fill`]).filter((id) => map.getLayer(id));
        const findingHit = findingLayers.length ? map.queryRenderedFeatures(touch, { layers: findingLayers })[0] : null;
        if (findingHit?.properties?.id && inspection?.kind === "parcel") { setSelectedFindingId(String(findingHit.properties.id)); return; }
        const crashHit = visibleLayers["land-crashes"] && map.getLayer("land-crashes-points") ? map.queryRenderedFeatures(touch, { layers: ["land-crashes-points"] })[0] : null;
        if (crashHit?.properties) { setSelectedParcel(null); setInspection({ kind: "crash", point: [event.lngLat.lng, event.lngLat.lat], properties: crashHit.properties as FatalCrash }); setInspectionLoading(false); return; }
        const facilityHit = visibleLayers["land-facilities"] && map.getLayer("land-facilities-points") ? map.queryRenderedFeatures(touch, { layers: ["land-facilities-points"] })[0] : null;
        if (facilityHit?.properties) { setSelectedParcel(null); setInspection({ kind: "facility", point: [event.lngLat.lng, event.lngLat.lat], properties: facilityHit.properties as EpaFacility }); setInspectionLoading(false); return; }
        if (parcelHit?.properties) {
          const properties = parcelHit.properties as ParcelRecord & { parcelKey: string };
          setSelectedParcel(parcelData.features.find((feature) => feature.properties?.parcelKey === properties.parcelKey) ?? parcelHit as GeoJSON.Feature);
          setShowReport(false); setInspection({ kind: "parcel", point: [event.lngLat.lng, event.lngLat.lat], properties }); setInspectionLoading(false); return;
        }
        setSelectedParcel(null);
        const hit = visibleLayers["land-soils"] && map.getLayer("land-soils-fill") ? map.queryRenderedFeatures(event.point, { layers: ["land-soils-fill"] })[0] : null;
        if (hit?.properties) { setShowReport(false); setInspection({ kind: "soil", point: [event.lngLat.lng, event.lngLat.lat], properties: hit.properties as Record<string, string | number | null> }); setInspectionLoading(true); return; }
        inspectOtherAt([event.lngLat.lng, event.lngLat.lat]);
        return;
      }
      const point: Coord = [event.lngLat.lng, event.lngLat.lat];
      if (mode === "pin") {
        setShape({ kind: "pin", points: [point] });
        setComplete(true);
        setMode("browse");
        setShowReport(true);
      } else {
        setShape((current) => ({ kind: mode, points: current?.kind === mode && !complete ? (current.points.length >= 40 ? current.points : [...current.points, point]) : [point] }));
        setComplete(false);
      }
    };
    map.on("click", click);
    return () => { map.off("click", click); };
  }, [map, mode, complete, visibleLayers, parcelData, inspectOtherAt, inspection, propertyKey]);

  useEffect(() => {
    if (!map || !shape) return;
    const markers = shape.points.map((point, index) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "li-vertex";
      el.title = `Drag point ${index + 1} or use arrow keys to adjust the ${shape.kind}`;
      el.setAttribute("aria-label", el.title);
      el.addEventListener("click", (event) => event.stopPropagation());
      el.addEventListener("keydown", (event) => {
        const delta: Record<string, Coord> = { ArrowUp: [0, 0.0002], ArrowDown: [0, -0.0002], ArrowLeft: [-0.0002, 0], ArrowRight: [0.0002, 0] };
        const move = delta[event.key];
        if (!move) return;
        event.preventDefault(); event.stopPropagation();
        keyboardVertex.current = index;
        setShape((current) => current ? { ...current, points: current.points.map((p, i) => i === index ? [p[0] + move[0], p[1] + move[1]] : p) } : null);
      });
      const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: "center" }).setLngLat(point).addTo(map);
      marker.on("dragend", () => {
        const at = marker.getLngLat();
        setShape((current) => current ? { ...current, points: current.points.map((p, i) => i === index ? [at.lng, at.lat] : p) } : null);
      });
      return marker;
    });
    if (keyboardVertex.current != null) {
      markers[keyboardVertex.current]?.getElement().focus();
      keyboardVertex.current = null;
    }
    return () => markers.forEach((marker) => marker.remove());
  }, [map, shape]);

  useEffect(() => {
    if (!shape || !complete) { setReport(null); setReportError(""); setReporting(false); return; }
    if (!validShape(shape)) { setReport(null); setReportError("The drawing crosses itself or is too small. Adjust its points, then check again."); setReporting(false); return; }
    const controller = new AbortController();
    setReporting(true);
    setReport(null);
    setReportError("");
    const force = refreshReport.current;
    refreshReport.current = false;
    fetch("/api/land-intelligence/report", { method: "POST", headers: { "Content-Type": "application/json", "X-Land-Refresh": force ? "1" : "0" }, body: JSON.stringify(shape), signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "The report could not be loaded.");
        return json as Report;
      })
      .then(setReport)
      .catch((error) => { if (!controller.signal.aborted) setReportError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setReporting(false); });
    return () => controller.abort();
  }, [shape, complete, reportNonce]);

  useEffect(() => {
    if (!shape || !complete || shape.kind === "pin") { setTerrain(null); setTerrainError(""); setTerrainLoading(false); return; }
    if (!validShape(shape)) { setTerrain(null); setTerrainError(""); setTerrainLoading(false); return; }
    const controller = new AbortController();
    setTerrain(null); setTerrainError(""); setTerrainLoading(true);
    const force = refreshTerrain.current;
    refreshTerrain.current = false;
    fetch("/api/land-intelligence/terrain", { method: "POST", headers: { "Content-Type": "application/json", "X-Land-Refresh": force ? "1" : "0" }, body: JSON.stringify(shape), signal: controller.signal })
      .then(async (response) => { const json = await response.json(); if (!response.ok) throw new Error(json.error ?? "Terrain sampling failed."); return json as TerrainResult; })
      .then(setTerrain)
      .catch((error) => { if (!controller.signal.aborted) setTerrainError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setTerrainLoading(false); });
    return () => controller.abort();
  }, [shape, complete, terrainNonce]);

  const startTool = (next: ShapeKind) => { setMode(next); setShape(null); setComplete(false); setReportFocus(null); setSelectedParcel(null); setShowReport(true); };
  const finish = () => {
    if (!shape || !validShape(shape)) return;
    setComplete(true);
    setMode("browse");
    setShowReport(true);
  };
  const undo = () => {
    setShape((current) => current?.points.length ? { ...current, points: current.points.slice(0, -1) } : null);
    setComplete(false);
  };
  const clear = () => { setShape(null); setComplete(false); setReport(null); setReportFocus(null); setSelectedParcel(null); setMode("pin"); };

  // On phones the inspection opens as a bottom sheet; keep the tapped spot in the map area above it.
  useEffect(() => {
    if (!map || !window.matchMedia("(max-width: 767px)").matches) return;
    const point = inspection && "point" in inspection ? inspection.point : null;
    map.easeTo({ ...(point ? { center: point } : {}), padding: { top: 0, right: 0, left: 0, bottom: point ? Math.round(window.innerHeight * 0.55) : 0 }, duration: 450 });
  }, [map, inspection]);

  const runAddressSearch = useCallback(async (term: string) => {
    addressSearchController.current?.abort();
    const controller = new AbortController();
    addressSearchController.current = controller;
    setSearching(true); setSearchError("");
    try {
      const center = map?.getCenter();
      const params = new URLSearchParams({ q: term });
      if (center) { params.set("lat", String(center.lat)); params.set("lon", String(center.lng)); }
      const response = await fetch(`/api/land-intelligence/search?${params}`, { signal: controller.signal });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Address search is temporarily unavailable.");
      if (controller.signal.aborted || addressSearchController.current !== controller) return;
      setResults(json.results ?? []);
      if (!json.results?.length) setSearchError("No matches yet. Try adding a city, state, or ZIP code.");
    } catch (error) {
      if (!controller.signal.aborted) setSearchError((error as Error).message || "Address search is temporarily unavailable.");
    } finally {
      if (addressSearchController.current === controller) { addressSearchController.current = null; setSearching(false); }
    }
  }, [map]);
  useEffect(() => {
    const term = query.trim();
    if (selectedAddressValue.current === term) { selectedAddressValue.current = null; return; }
    selectedAddressValue.current = null;
    if (term.length < 4) {
      addressSearchController.current?.abort(); addressSearchController.current = null;
      setResults([]); setSearchError(""); setSearching(false);
      return;
    }
    const timeout = window.setTimeout(() => { addressSearchTimeout.current = null; void runAddressSearch(term); }, 600);
    addressSearchTimeout.current = timeout;
    return () => { window.clearTimeout(timeout); if (addressSearchTimeout.current === timeout) addressSearchTimeout.current = null; addressSearchController.current?.abort(); };
  }, [query, runAddressSearch]);
  const search = (event: FormEvent) => {
    event.preventDefault();
    if (results[0]) chooseResult(results[0]);
    else if (query.trim().length >= 4) {
      if (addressSearchTimeout.current != null) window.clearTimeout(addressSearchTimeout.current);
      addressSearchTimeout.current = null;
      void runAddressSearch(query.trim());
    }
  };
  const dismissWelcome = () => {
    setShowWelcome(false);
  };
  const exploreBoulder = () => {
    dismissWelcome(); setMode("browse"); setShape(null); setComplete(false); setInspection(null); setSelectedParcel(null);
    setFlyTo({ center: [-105.2705, 40.015], zoom: 14.2, nonce: Date.now() });
  };
  const chooseResult = async (result: SearchResult) => {
    selectedAddressValue.current = result.label;
    addressSearchController.current?.abort(); addressSearchController.current = null; setSearching(false);
    setQuery(result.label); setResults([]); setSearchError("");
    addressParcelController.current?.abort();
    const controller = new AbortController();
    addressParcelController.current = controller;
    identifyController.current?.abort();
    setInspection(null); setSelectedParcel(null); setInspectionLoading(true);
    setShape({ kind: "pin", points: [result.center] }); setComplete(true); setMode("browse"); setShowReport(true);
    const zoom = result.precisionType === "street" ? 16 : result.precisionType === "address" || result.precisionType === "coordinate" ? 17 : 12;
    setFlyTo({ center: result.center, zoom, nonce: Date.now() });
    // Use the same parcel source as the map layer, then open the same parcel
    // inspection used by a map click. A geocoder pin alone never selects a parcel.
    if (zoom >= 14) {
      const [lng, lat] = result.center;
      const radius = 0.0004;
      const bounds = [lng - radius, lat - radius, lng + radius, lat + radius];
      try {
        const response = await fetch(`/api/land-intelligence/parcel-map?bbox=${bounds.join(",")}`, { signal: controller.signal });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Parcel boundary lookup failed.");
        if (controller.signal.aborted) return;
        const features = (json.features ?? []) as GeoJSON.Feature[];
        setParcelData((current) => {
          const byKey = new Map(current.features.map((feature) => [feature.properties?.parcelKey, feature]));
          for (const feature of features) byKey.set(feature.properties?.parcelKey, feature);
          return { type: "FeatureCollection", features: Array.from(byKey.values()) };
        });
        const parcel = features.find((feature) => feature.properties?.parcelKey && feature.geometry && (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") && pointInParcel(result.center, feature.geometry as ParcelGeometry));
        if (parcel?.properties) {
          const properties = parcel.properties as ParcelRecord & { parcelKey: string };
          setSelectedParcel(parcel);
          setShowReport(false);
          setInspection({ kind: "parcel", point: result.center, properties });
          return;
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.warn("Address matched, but parcel boundaries could not be loaded.", error);
      } finally {
        if (addressParcelController.current === controller) {
          addressParcelController.current = null;
          setInspectionLoading(false);
        }
      }
    }
    if (addressParcelController.current === controller) {
      addressParcelController.current = null;
      setInspectionLoading(false);
    }
  };
  const locate = (point: Coord) => setFlyTo({ center: point, zoom: Math.max(map?.getZoom() ?? 10, 12), nonce: Date.now() });
  const focusOn = (key: Exclude<keyof Report, "checkedAt">) => {
    if (!shape) return;
    if (reportFocus === key) { setReportFocus(null); return; }
    setReportFocus(key);
    const layer = key === "crashes" ? "crashes" : key === "elevation" || key === "census" ? null : key === "facilities" ? "facilities" : key === "roads" ? "roads" : key;
    if (layer) setVisibleLayers((current) => ({ ...current, [`land-${layer}`]: true }));
    setFlyTo({ center: shape.kind === "pin" ? shape.points[0] : shapeCenter(shape.points), zoom: Math.max(map?.getZoom() ?? 10, key === "parcels" || selectedParcel ? 15.5 : key === "soils" ? 14.5 : 12), nonce: Date.now() });
  };

  const measure = shape?.kind === "line" ? formatLength(lengthMeters(shape.points)) : shape?.kind === "area" && shape.points.length >= 3
    ? `${formatArea(areaSquareMeters(shape.points))} · ${formatLength(lengthMeters(shape.points, true))} perimeter` : shape?.kind === "pin"
      ? `${shape.points[0][1].toFixed(5)}, ${shape.points[0][0].toFixed(5)}` : null;

  return <div className={`li-app fixed inset-0 overflow-hidden ${dark ? "dark bg-slate-950 text-white" : "bg-slate-50 text-slate-900"}`}>
    <AtlasMap layers={[...LAND_LAYERS, ...INSPECTION_LAYERS, INSPECTION_SELECTED_LAYER, DRAW_LAYER, FOCUS_LAYER]} visible={{ ...Object.fromEntries(PARCEL_INSPECTION_GROUPS.map((group) => [`parcel-inspection-${group.id}`, true])), "parcel-inspection-selected": true, ...visibleLayers }} data={data} basemap={basemap} terrain="flat" dark={dark} initialView={{ center: [-105.5, 39.1], zoom: 6.5 }} atmosphere onMapReady={onMapReady} flyTo={flyTo} emptyCursor={mode === "browse" ? "grab" : "crosshair"} controls={false} className="absolute inset-0 h-full w-full" />
    <div className="li-map-wash pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/45 via-transparent to-slate-950/30" />

    {showWelcome && <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] [padding-top:max(0.75rem,env(safe-area-inset-top))] sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby="land-welcome-title" className="li-panel my-auto w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl sm:rounded-3xl sm:p-6">
        <div className="flex items-center gap-3"><div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-cyan-200"><MapPinned className="h-6 w-6" /></div><div><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300">Atlas · U.S. study tool</p><h2 id="land-welcome-title" className="mt-1 text-xl font-semibold text-white">Land Intelligence</h2></div></div>
        <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:mt-4">Explore property records and site conditions together on one map.</p>
        <div className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 sm:rounded-2xl"><div className="flex items-center gap-2 text-xs font-semibold text-white"><Database className="h-4 w-4 shrink-0 text-cyan-300" />Parcel data in {PARCEL_SOURCES.length} states</div><div className="mt-2 grid grid-cols-2 gap-1">{PARCEL_SOURCES.map((source) => <span key={source.id} className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-2 py-1.5 text-[10px] text-cyan-100">{source.state}</span>)}</div></div>
          <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] p-3 sm:rounded-2xl"><div className="flex items-center gap-2 text-xs font-semibold text-white"><Building2 className="h-4 w-4 shrink-0 text-cyan-300" />Richest detail: Boulder County</div><p className="mt-2 text-[11px] leading-relaxed text-slate-300">Owner, value, building, permit, and sale records.</p></div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">Early concept; coverage varies by county. More data is coming.</p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:mt-5 sm:grid-cols-2"><button type="button" onClick={exploreBoulder} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-xs font-semibold text-slate-950 hover:bg-cyan-300"><MapPin className="h-4 w-4" />Explore Boulder County</button><button type="button" onClick={dismissWelcome} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-xs font-semibold text-slate-100 hover:bg-white/10">Continue to the map<ArrowRight className="h-4 w-4" /></button></div>
      </section>
    </div>}

    <aside className="pointer-events-auto absolute left-3 top-3 z-20 flex max-h-[calc(100dvh-24px)] w-[min(290px,calc(100vw-24px))] flex-col overflow-y-auto rounded-2xl border border-white/15 li-panel bg-slate-950/90 p-2.5 shadow-2xl backdrop-blur-xl md:left-5 md:top-5" aria-label="Map controls">
      <header className="flex items-center gap-1.5 pb-2">
        <Link href="/projects" aria-label="Back to projects" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="min-w-0 flex-1"><div className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300">Atlas / U.S. study tool</div><h1 className="font-aspekta text-[16px] font-semibold leading-5">Land Intelligence</h1></div>
        <button type="button" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"} className="rounded-lg p-2 text-slate-200 hover:bg-white/10">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
      </header>
      <form onSubmit={search} className="relative flex w-full min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-2.5 py-2">
        <Search className="h-4 w-4 shrink-0 text-cyan-300" />
        <input role="combobox" aria-autocomplete="list" aria-expanded={query.trim().length >= 4 && (searching || results.length > 0 || !!searchError)} aria-controls="land-address-suggestions" value={query} onChange={(event) => { addressSearchController.current?.abort(); addressSearchController.current = null; setSearching(false); setQuery(event.target.value); setResults([]); setSearchError(""); }} placeholder="Address, city, or coordinates" aria-label="Search U.S. address or coordinates" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400" />
        {query && <button type="button" onClick={() => { addressSearchController.current?.abort(); addressSearchController.current = null; setSearching(false); setQuery(""); setResults([]); setSearchError(""); }} aria-label="Clear search" className="p-1 text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>}
        <button type="submit" disabled={query.trim().length < 4} className="rounded-lg bg-cyan-400 px-2.5 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50">Find</button>
        {query.trim().length >= 4 && (searching || results.length > 0 || !!searchError) && <div id="land-address-suggestions" role="listbox" aria-label="Address suggestions" className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-y-auto rounded-xl border border-white/15 li-panel bg-slate-950 p-1 shadow-2xl">{searching && !results.length && <p role="status" className="px-3 py-2 text-xs text-slate-300">Searching addresses and nearby places…</p>}{results.map((result) => <button type="button" role="option" aria-selected="false" key={`${result.label}-${result.center.join(",")}`} onClick={() => chooseResult(result)} className="flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-white/10"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" /><span className="min-w-0"><span className="block text-xs font-medium text-slate-100">{result.label}</span><span className="mt-0.5 block text-[10px] text-slate-400">{result.detail || "United States"}</span>{result.provider && <span className="mt-0.5 block text-[9px] text-slate-500">{result.provider}</span>}</span></button>)}{searchError && <p className="px-3 py-2 text-[11px] leading-relaxed text-amber-200">{searchError}</p>}{results.some((result) => result.provider?.includes("OpenStreetMap")) && <div className="border-t border-white/10 px-3 py-2 text-[9px] text-slate-500">Search data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">OpenStreetMap contributors</a> via Photon.</div>}</div>}
      </form>

      <div className="border-t border-white/10 pt-2">
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => setMode("browse")} title="Click mapped features to inspect them" aria-pressed={mode === "browse"} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-colors ${mode === "browse" ? "bg-cyan-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}><CircleHelp className="h-4 w-4" />Inspect</button>
        <button type="button" onClick={() => { setVisibleLayers((current) => ({ ...current, "land-roads": true })); setMode("road"); setShowReport(false); }} title="Tap a Colorado highway segment for crashes, incidents, and conditions" aria-pressed={mode === "road"} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-colors ${mode === "road" ? "bg-cyan-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}><Route className="h-4 w-4" />Roads</button>
        {TOOL.map(({ id, label, icon: Icon, hint }) => <button key={id} type="button" onClick={() => startTool(id)} title={hint} aria-pressed={mode === id} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-colors ${mode === id ? "bg-cyan-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
        <div className="flex items-center gap-1">
          <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => map?.zoomIn()} className="rounded-lg p-2 text-slate-200 hover:bg-white/10"><Plus className="h-4 w-4" /></button>
          <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => map?.zoomOut()} className="rounded-lg p-2 text-slate-200 hover:bg-white/10"><Minus className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" title={basemap === "map" ? "Switch to satellite basemap" : "Switch to street basemap"} aria-label="Switch basemap" onClick={() => setBasemap((value) => value === "map" ? "satellite" : "map")} className="rounded-lg p-2 text-slate-200 hover:bg-white/10">{basemap === "map" ? <Satellite className="h-4 w-4" /> : <Layers3 className="h-4 w-4" />}</button>
          <button type="button" title="Map filters and key" aria-label="Map filters and key" aria-expanded={showLayers} onClick={() => setShowLayers((value) => !value)} className={`rounded-lg p-2 hover:bg-white/10 ${showLayers ? "bg-cyan-400/20 text-cyan-200" : "text-slate-200"}`}><Layers3 className="h-4 w-4" /></button>
          <button type="button" title="Clear drawing" aria-label="Clear drawing" onClick={clear} disabled={!shape} className="rounded-lg p-2 text-slate-200 hover:bg-white/10 disabled:opacity-35"><Eraser className="h-4 w-4" /></button>
        </div>
      </div>
      </div>
      {showLayers && <div className="border-t border-white/10 pt-2">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-semibold">Map filters &amp; key</h2><button type="button" aria-label="Close map filters and key" onClick={() => setShowLayers(false)} className="rounded-lg p-1 text-slate-300 hover:bg-white/10"><X className="h-4 w-4" /></button></div>
        <p className="mb-3 text-[11px] leading-relaxed text-slate-400">Turn on source maps to explore. Layers appear as you zoom into their supported scale.</p>
        {LAND_OVERLAYS.map((layer) => <label key={layer.id} className="flex cursor-pointer items-start gap-2 border-t border-white/10 py-2.5"><input type="checkbox" checked={!!visibleLayers[`land-${layer.id}`]} onChange={(event) => setVisibleLayers((current) => ({ ...current, [`land-${layer.id}`]: event.target.checked }))} className="mt-0.5 accent-cyan-400" /><span className="min-w-0"><span className="block text-xs font-medium text-white">{layer.label}</span><span className="block text-[10px] text-slate-400">{layer.scope} · zoom {layer.minzoom}+</span><a href={layer.url} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="text-[10px] text-cyan-300 underline underline-offset-2">{layer.source}</a></span></label>)}
        <div className="border-t border-white/10 pt-3 text-[10px] leading-relaxed text-slate-400">Reference guides: <a href="https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">SSURGO</a> · <a href="https://www.fws.gov/program/national-wetlands-inventory" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">NWI</a> · <a href="https://www.nae.usace.army.mil/Missions/Regulatory/Jurisdiction-and-Wetlands/Wetland-Delineation-Manual/" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">USACE delineation</a> · <a href="https://highways.dot.gov/environment/noise" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">FHWA noise</a>. USACE and FHWA provide guidance rather than map data here.</div>
        <MapKey soils={!!visibleLayers["land-soils"]} parcels={!!visibleLayers["land-parcels"]} crashes={!!visibleLayers["land-crashes"]} facilities={!!visibleLayers["land-facilities"]} soilStatus={soilStatus} parcelStatus={parcelStatus} crashStatus={crashStatus} facilityStatus={facilityStatus} />
      </div>}
    </aside>
    {mode === "road" && <div role="status" className="pointer-events-none absolute bottom-5 left-1/2 z-20 w-[min(360px,calc(100vw-24px))] -translate-x-1/2 rounded-xl border border-cyan-300/30 li-panel bg-slate-950/95 px-3 py-2 text-center text-[11px] font-medium text-cyan-200 shadow-xl">Tap a Colorado highway line to inspect that segment. Zoom in to level 9+ to see the road layer.</div>}
    <MapInspection inspection={inspection} loading={inspectionLoading} components={soilComponents} error={soilDetailError} propertyDetail={propertyDetailResult?.key === propertyKey ? propertyDetailResult.detail : null} propertyLoading={propertyLoading} propertyError={propertyError} parcelInspection={parcelInspection} parcelGeometry={inspection?.kind === "parcel" && selectedParcel?.properties?.parcelKey === inspection.properties.parcelKey && (selectedParcel.geometry.type === "Polygon" || selectedParcel.geometry.type === "MultiPolygon") ? (parcelInspection?.parcelKey === inspection.properties.parcelKey ? parcelInspection.geometry : null) ?? selectedParcel.geometry as ParcelGeometry : null} parcelInspectionLoading={parcelInspectionLoading} parcelInspectionError={parcelInspectionError} visibleFindingGroups={Object.fromEntries(PARCEL_INSPECTION_GROUPS.map((group) => [group.id, visibleLayers[`parcel-inspection-${group.id}`] !== false]))} selectedFindingId={selectedFindingId} onToggleFindingGroup={(id) => setVisibleLayers((current) => ({ ...current, [`parcel-inspection-${id}`]: current[`parcel-inspection-${id}`] === false }))} onSetFindingGroupsVisible={(ids, shown) => setVisibleLayers((current) => ({ ...current, ...Object.fromEntries(ids.map((id) => [`parcel-inspection-${id}`, shown])) }))} onSelectFinding={(finding: ParcelFinding) => setSelectedFindingId(finding.id)} onInspectOther={inspectOtherAt} onClose={() => { addressParcelController.current?.abort(); addressParcelController.current = null; identifyController.current?.abort(); setInspection(null); setSelectedParcel(null); setSelectedFindingId(null); setInspectionLoading(false); }} />

    {shape && complete && <div className={`pointer-events-auto absolute z-20 overflow-hidden rounded-2xl border border-white/15 li-panel bg-slate-950/95 shadow-2xl backdrop-blur-xl transition-all ${showReport ? "bottom-0 left-0 right-0 max-h-[45dvh] rounded-b-none border-x-0 border-b-0 md:bottom-5 md:left-auto md:right-5 md:max-h-[calc(100vh-130px)] md:w-[380px] md:rounded-2xl md:border" : "bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 w-auto md:bottom-5 md:right-5"}`}>
      <button type="button" onClick={() => setShowReport((value) => !value)} className="flex w-full items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-left text-sm font-semibold"><span>Location report</span>{showReport ? <Minus className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
      {showReport && <div className="max-h-[calc(45dvh-48px)] space-y-3 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:max-h-[calc(100vh-180px)] md:pb-4">
        {reporting && <p className="flex items-center gap-2 text-xs text-cyan-200"><RotateCcw className="h-3.5 w-3.5 animate-spin" />Checking public data…</p>}
        {reportError && <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200">{reportError}</p>}
        {!reporting && (report || reportError) && <button type="button" onClick={() => { refreshReport.current = true; refreshTerrain.current = true; setReportNonce((value) => value + 1); setTerrainNonce((value) => value + 1); }} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-white/10"><RotateCcw className="h-3 w-3" />Check again</button>}
        {report && <>
          <p className="text-[11px] leading-relaxed text-slate-300">{shape.kind === "pin" ? "Point screening" : shape.kind === "line" ? "Route screening" : "Area screening"} · checked {new Date(report.checkedAt).toLocaleString()}</p>
          {measure && <p className="font-mono text-xs text-cyan-200">{measure}</p>}
          <button type="button" onClick={() => downloadReport(report, shape, terrain)} disabled={terrainLoading} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-2 text-[11px] font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-50"><Download className="h-3.5 w-3.5" />{terrainLoading ? "Sampling terrain…" : "Download printable report"}</button>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><div className="flex items-center gap-2 text-[11px] font-semibold text-white"><Crosshair className="h-3.5 w-3.5 text-cyan-300" />Map focus</div><p className="mt-1 text-[10px] leading-relaxed text-slate-400">Select a report item to show its map layer where available and outline the {selectedParcel ? "selected parcel" : "study boundary"}. Outside shows the nearby 1 km ring.</p><div className="mt-2 flex gap-1.5"><button type="button" aria-pressed={focusScope === "inside"} onClick={() => setFocusScope("inside")} className={`rounded-lg px-2.5 py-1 text-[10px] ${focusScope === "inside" ? "bg-cyan-400 text-slate-950" : "border border-white/15 text-slate-300"}`}>Inside boundary</button><button type="button" aria-pressed={focusScope === "outside"} onClick={() => setFocusScope("outside")} className={`rounded-lg px-2.5 py-1 text-[10px] ${focusScope === "outside" ? "bg-cyan-400 text-slate-950" : "border border-white/15 text-slate-300"}`}>Nearby outside</button></div>{reportFocus && <p className="mt-2 text-[10px] text-amber-200">Gold marks the visual focus. The report still analyzes the pin or drawn shape; source layers may extend beyond the focus.</p>}</div>
          <EvidenceSummary report={report} />
          <p className="border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">Terrain</p>
          <FindingCard title="Ground elevation" finding={report.elevation} active={reportFocus === 'elevation'} onFocus={() => focusOn('elevation')} value={report.elevation.value == null ? null : `${Math.round(report.elevation.value).toLocaleString()} m`} />
          {shape.kind !== "pin" && <TerrainCard terrain={terrain} loading={terrainLoading} error={terrainError} onLocate={locate} onRetry={() => { refreshTerrain.current = true; setTerrainNonce((value) => value + 1); }} />}
          <p className="border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">Water and hazards</p>
          <FindingCard title="FEMA flood mapping" finding={report.flood} active={reportFocus === 'flood'} onFocus={() => focusOn('flood')} value={report.flood.value?.length ? report.flood.value.map((zone) => `${zone.zone}${zone.special ? " · special flood hazard" : ""}`).join("; ") : null} />
          <FindingCard title="Mapped waterways" finding={report.waterways} active={reportFocus === 'waterways'} onFocus={() => focusOn('waterways')} value={report.waterways.value == null ? null : `${report.waterways.value.toLocaleString()} flowline feature${report.waterways.value === 1 ? "" : "s"}`} />
          <FindingCard title="Mapped wetlands" finding={report.wetlands} active={reportFocus === 'wetlands'} onFocus={() => focusOn('wetlands')} value={featureCount(report.wetlands.value, "feature")} details={report.wetlands.value?.items.map((item) => [item.name, item.detail].filter(Boolean).join(" · "))} />
          <FindingCard title="Mapped faults" finding={report.faults} active={reportFocus === 'faults'} onFocus={() => focusOn('faults')} value={featureCount(report.faults.value, "fault trace")} details={report.faults.value?.items.map((item) => [item.name, item.detail].filter(Boolean).join(" · "))} />
          <p className="border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">Land and environment</p>
          <FindingCard title="Public parcel records" finding={report.parcels} active={reportFocus === 'parcels'} onFocus={() => focusOn('parcels')} value={featureCount(report.parcels.value, "parcel")} details={report.parcels.value?.items.map(parcelDetail)} links={report.parcels.value?.items.map((item) => ({ label: `${item.state} · ${item.id || item.county || "Parcel"} source`, url: item.recordUrl || item.sourceUrl }))} />
          <FindingCard title="Soil map units" finding={report.soils} active={reportFocus === 'soils'} onFocus={() => focusOn('soils')} value={report.soils.value == null ? null : `${report.soils.value.length} unit${report.soils.value.length === 1 ? "" : "s"}`} details={report.soils.value?.map((item) => `${item.symbol || item.key} · ${item.name}`)} />
          <FindingCard title="EPA regulated facilities" finding={report.facilities} active={reportFocus === 'facilities'} onFocus={() => focusOn('facilities')} value={featureCount(report.facilities.value, "facility")} details={report.facilities.value?.items.map(facilityDetail)} />
          <FindingCard title="Census tract context" finding={report.census} active={reportFocus === 'census'} onFocus={() => focusOn('census')} value={report.census.value?.tract ?? null} details={report.census.value ? [report.census.value.population == null ? "" : `Population estimate: ${report.census.value.population.toLocaleString()}`, report.census.value.medianHouseholdIncome == null ? "" : `Median household income: $${report.census.value.medianHouseholdIncome.toLocaleString()}`, report.census.value.povertyPercent == null ? "" : `People below poverty level: ${report.census.value.povertyPercent}%`].filter(Boolean) : undefined} />
          <p className="border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">Transportation</p>
          <FindingCard title="Colorado highways" finding={report.roads} active={reportFocus === 'roads'} onFocus={() => focusOn('roads')} value={featureCount(report.roads.value, "segment")} details={report.roads.value?.items.map(roadDetail)} />
          <FindingCard title="Fatal crashes (2024)" finding={report.crashes} active={reportFocus === "crashes"} onFocus={() => focusOn("crashes")} value={featureCount(report.crashes.value, "fatal crash")} details={report.crashes.value?.items.map((item) => [item.date, item.road, [item.city, item.state].filter(Boolean).join(", "), item.fatalities == null ? "" : `${item.fatalities} fatalities`].filter(Boolean).join(" · "))} />
          <p className="border-t border-white/10 pt-3 text-[11px] leading-relaxed text-slate-400">Public GIS screening is preliminary. A blank result is not proof of absence. Mapped boundaries and point elevations are not a survey, flood determination, or site engineering assessment.</p>
        </>}
      </div>}
    </div>}
    <style jsx global>{`.li-vertex { width: 16px; height: 16px; border: 3px solid white; border-radius: 50%; background: #06b6d4; box-shadow: 0 0 0 3px rgba(8,47,73,.75), 0 2px 10px #0008; cursor: grab; } .li-vertex:active { cursor: grabbing; } .li-vertex:focus-visible { outline: 3px solid #facc15; outline-offset: 4px; }`}</style>
  </div>;
}

function featureCount<T>(value: FeatureSet<T> | null, singular: string) {
  return value == null ? null : `${value.count.toLocaleString()} ${singular}${value.count === 1 ? "" : "s"}`;
}

function parcelDetail(item: Parcel) {
  return [item.id || "Parcel", item.address, [item.county, item.state].filter(Boolean).join(", "), item.acres == null ? "" : `${item.acres} acres`, item.zoning ? `Zoning: ${item.zoning}` : "", item.landUse ? `Reported use: ${item.landUse}` : "", item.ownerType ? `Owner type: ${item.ownerType}` : "", item.landValue == null ? "" : `Reported land value: $${item.landValue.toLocaleString()}`, item.received ? `Data: ${item.received}` : ""].filter(Boolean).join(" · ");
}

function roadDetail(item: Road) {
  return [item.route, item.county, item.className, item.aadt == null ? "" : `AADT ${item.aadt.toLocaleString()}${item.aadtYear ? ` (${item.aadtYear})` : ""}`, item.speed == null ? "" : `${item.speed} mph`, item.lanes == null ? "" : `${item.lanes} through lanes`].filter(Boolean).join(" · ");
}

function facilityDetail(item: Facility) {
  return [item.name, [item.city, item.state].filter(Boolean).join(", "), item.programs.length ? item.programs.join("/" ) : "", item.compliance, item.accuracyMeters == null ? "" : `Location accuracy ${Math.round(item.accuracyMeters)} m`].filter(Boolean).join(" · ");
}

const FINDING_ICONS = { "Ground elevation": Mountain, "FEMA flood mapping": Waves, "Mapped waterways": Droplets, "Mapped wetlands": Leaf, "Mapped faults": Activity, "Public parcel records": Layers3, "Soil map units": Sprout, "EPA regulated facilities": Factory, "Census tract context": Users, "Colorado highways": Route, "Fatal crashes (2024)": CarFront } as const;

function FindingCard<T>({ title, finding, value, details, links, active, onFocus }: { title: string; finding: Finding<T>; value: string | null; details?: string[]; links?: { label: string; url: string }[]; active: boolean; onFocus: () => void }) {
  const Icon = FINDING_ICONS[title as keyof typeof FINDING_ICONS] ?? MapPin;
  return <section className={`rounded-xl border bg-white/[0.04] p-3 ${active ? "border-amber-300/70 ring-1 ring-amber-300/30" : "border-white/10"}`}>
    <div className="flex items-center justify-between gap-2"><button type="button" onClick={onFocus} aria-pressed={active} title={active ? "Clear map focus" : `Focus ${title} on map`} className="inline-flex items-center gap-1.5 text-left text-xs font-semibold text-white hover:text-cyan-200"><Icon className="h-3.5 w-3.5 shrink-0 text-cyan-300" /><span>{title}</span><Crosshair className={`h-3 w-3 shrink-0 ${active ? "text-amber-300" : "text-slate-500"}`} /></button><span className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${finding.status === "found" ? "bg-cyan-400/15 text-cyan-200" : finding.status === "none" || finding.status === "outside" ? "bg-slate-400/15 text-slate-300" : "bg-amber-400/15 text-amber-200"}`}>{finding.status === "none" ? "No mapped result" : finding.status === "outside" ? "Outside coverage" : finding.status}</span></div>
    {value && <p className="mt-2 text-[16px] font-semibold leading-snug text-white">{value}</p>}
    {!!details?.length && <ul className="mt-2 space-y-1 border-l border-cyan-400/30 pl-2 text-[10px] leading-relaxed text-slate-200">{details.map((detail, index) => <li key={`${index}-${detail}`}>{detail}</li>)}</ul>}
    {!!links?.length && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{links.filter((link) => link.url.startsWith("https://")).map((link, index) => <a key={`${index}-${link.url}`} href={link.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-300 underline underline-offset-2">{link.label} ↗</a>)}</div>}
    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">{finding.note}</p>
    <p className="mt-2 text-[10px] leading-relaxed text-slate-400">Coverage: {finding.coverage}<br />Data age: {finding.freshness}</p>
    <a href={finding.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[10px] text-cyan-300 underline decoration-cyan-300/40 underline-offset-2 hover:text-white">{finding.source} ↗</a>
  </section>;
}
