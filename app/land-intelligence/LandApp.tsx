"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import maplibregl, { type Map as MlMap } from "maplibre-gl";
import { Activity, ArrowLeft, Building2, CarFront, Check, ChevronDown, CircleHelp, Crosshair, Download, Droplets, Eraser, Layers3, MapPin, Minus, Moon, Mountain, Pencil, Plus, RotateCcw, Route, Search, Satellite, Sprout, Sun, Undo2, Users, Waves, X } from "lucide-react";
import { AtlasMap } from "@/components/atlas/AtlasMap";
import { useAtlasTheme } from "@/components/atlas/Hud";
import type { AtlasLayer, Basemap } from "@/components/atlas/types";
import { areaSquareMeters, lengthMeters, shapeCenter, shapeGeoJSON, validShape, type AnalysisShape, type Coord, type ShapeKind } from "./geometry";
import { LAND_LAYERS, LAND_OVERLAYS } from "./layers";
import { MapInspection } from "./MapInspection";
import { MapKey } from "./MapKey";
import { focusGeoJSON, type FocusScope } from "./report-focus";
import { PARCEL_SOURCES, type ParcelRecord } from "./parcel-sources";
import type { ParcelDetail } from "./parcel-detail";
import type { FatalCrash } from "./crash";
import { downloadReport } from "./export-report";
import { EvidenceSummary, TerrainCard } from "./SiteAnalysis";
import type { Facility, Finding, Report, FeatureSet, Parcel, Road, TerrainResult } from "./report-types";

type Mode = "browse" | ShapeKind;
type SearchResult = { label: string; center: Coord };
type SoilSelection = { kind: "soil"; point: Coord; properties: Record<string, string | number | null> };
type ParcelSelection = { kind: "parcel"; point: Coord; properties: ParcelRecord & { parcelKey: string } };
type CrashSelection = { kind: "crash"; point: Coord; properties: FatalCrash };
type OverlaySelection = { kind: "overlay"; results: { id: string; label: string; url: string; status: string; features: Record<string, unknown>[] }[] };
type Inspection = SoilSelection | ParcelSelection | CrashSelection | OverlaySelection;
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

const TOOL = [
  { id: "pin" as const, label: "Pin", icon: MapPin, hint: "Click once to inspect a location" },
  { id: "line" as const, label: "Route", icon: Pencil, hint: "Click points along a road or corridor" },
  { id: "area" as const, label: "Area", icon: Crosshair, hint: "Click around a site or study area" },
];

const formatLength = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters).toLocaleString()} m`;
const formatArea = (squareMeters: number) => squareMeters >= 1000000 ? `${(squareMeters / 1000000).toFixed(2)} km²` : `${Math.round(squareMeters).toLocaleString()} m²`;

export default function LandApp() {
  const dark = useAtlasTheme();
  const { setTheme } = useTheme();
  const [map, setMap] = useState<MlMap | null>(null);
  const [showCoverageNotice, setShowCoverageNotice] = useState(false);
  const coverageNoticeSeen = useRef(false);
  const keyboardVertex = useRef<number | null>(null);
  const identifyController = useRef<AbortController | null>(null);
  const refreshReport = useRef(false);
  const refreshTerrain = useRef(false);
  const [mode, setMode] = useState<Mode>("pin");
  const [shape, setShape] = useState<AnalysisShape | null>(null);
  const [complete, setComplete] = useState(false);
  const [basemap, setBasemap] = useState<Basemap>("map");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
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
  const [parcelStatus, setParcelStatus] = useState("Zoom in to level 14 to see parcel boundaries in connected states.");
  const [crashData, setCrashData] = useState<GeoJSON.FeatureCollection>({ type: "FeatureCollection", features: [] });
  const [crashStatus, setCrashStatus] = useState("Zoom in to level 8 to see 2024 fatal crash points.");
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
  const data = useMemo(() => ({ "study-shape-source": shape ? shapeGeoJSON(shape) : { type: "FeatureCollection", features: [] } as GeoJSON.FeatureCollection, "report-focus-source": focusData, "land-soils-source": soilData, "land-parcels-source": parcelData, "land-parcels-selected-source": { type: "FeatureCollection", features: selectedParcel ? [selectedParcel] : [] } as GeoJSON.FeatureCollection, "land-crashes-source": crashData }), [shape, soilData, parcelData, selectedParcel, crashData, focusData]);
  const onMapReady = useCallback((instance: MlMap) => setMap(instance), []);

  useEffect(() => {
    if (!map) return;
    const showOnZoomOut = () => {
      if (map.getZoom() <= 5.5 && !coverageNoticeSeen.current) {
        coverageNoticeSeen.current = true;
        setShowCoverageNotice(true);
      }
    };
    map.on("zoomend", showOnZoomOut);
    return () => { map.off("zoomend", showOnZoomOut); };
  }, [map]);

  const propertyKey = inspection?.kind === "parcel" ? inspection.properties.parcelKey : null;
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
    const update = () => {
      const objectid = inspection?.kind === "soil" ? Number(inspection.properties.objectid) : -1;
      if (map.getLayer("land-soils-selected")) map.setFilter("land-soils-selected", ["==", ["get", "objectid"], Number.isFinite(objectid) ? objectid : -1]);
    };
    map.on("style.load", update);
    update();
    return () => { map.off("style.load", update); };
  }, [map, inspection]);

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

  const inspectOtherAt = useCallback((point: Coord) => {
    if (!map) return;
    setShowReport(false);
    identifyController.current?.abort();
    const layers = LAND_OVERLAYS.filter((layer) => layer.id !== "soils" && layer.id !== "parcels" && layer.id !== "crashes" && visibleLayers[`land-${layer.id}`] && map.getZoom() >= layer.minzoom).map((layer) => layer.id);
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

  const inspectSoilAt = useCallback((point: Coord) => {
    if (!map || !map.getLayer("land-soils-fill") || !visibleLayers["land-soils"]) return false;
    const hit = map.queryRenderedFeatures(map.project(point), { layers: ["land-soils-fill"] })[0];
    if (!hit?.properties) return false;
    setInspection({ kind: "soil", point, properties: hit.properties as Record<string, string | number | null> });
    return true;
  }, [map, visibleLayers]);

  useEffect(() => {
    if (!map) return;
    const click = (event: maplibregl.MapMouseEvent) => {
      if (mode === "browse") {
        identifyController.current?.abort();
        const crashHit = visibleLayers["land-crashes"] && map.getLayer("land-crashes-points") ? map.queryRenderedFeatures(event.point, { layers: ["land-crashes-points"] })[0] : null;
        if (crashHit?.properties) { setSelectedParcel(null); setInspection({ kind: "crash", point: [event.lngLat.lng, event.lngLat.lat], properties: crashHit.properties as FatalCrash }); setInspectionLoading(false); return; }
        const parcelHit = visibleLayers["land-parcels"] && map.getLayer("land-parcels-fill") ? map.queryRenderedFeatures(event.point, { layers: ["land-parcels-fill"] })[0] : null;
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
  }, [map, mode, complete, visibleLayers, parcelData, inspectOtherAt]);

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

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 4) return;
    setSearching(true); setSearchError(""); setResults([]);
    try {
      const response = await fetch(`/api/land-intelligence/search?q=${encodeURIComponent(query.trim())}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Search failed.");
      setResults(json.results ?? []);
      if (!json.results?.length) setSearchError("No address match. Try a full U.S. street address or latitude, longitude.");
    } catch (error) { setSearchError((error as Error).message); }
    finally { setSearching(false); }
  };
  const chooseResult = (result: SearchResult) => {
    setQuery(result.label); setResults([]); setSearchError("");
    setShape({ kind: "pin", points: [result.center] }); setComplete(true); setMode("browse"); setShowReport(true);
    setFlyTo({ center: result.center, zoom: 13, nonce: Date.now() });
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
    <AtlasMap layers={[...LAND_LAYERS, DRAW_LAYER, FOCUS_LAYER]} visible={visibleLayers} data={data} basemap={basemap} terrain="flat" dark={dark} initialView={{ center: [-105.5, 39.1], zoom: 6.5 }} atmosphere onMapReady={onMapReady} flyTo={flyTo} emptyCursor={mode === "browse" ? "grab" : "crosshair"} controls={false} className="absolute inset-0 h-full w-full" />
    <div className="li-map-wash pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/45 via-transparent to-slate-950/30" />

    <header className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-wrap items-start justify-between gap-2 sm:inset-x-5 sm:top-5">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/15 li-panel bg-slate-950/85 px-3 py-2.5 shadow-2xl backdrop-blur-xl sm:px-4">
        <Link href="/projects" aria-label="Back to projects" className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="h-6 w-px bg-white/15" />
        <div><div className="font-mono text-[9px] uppercase tracking-[0.24em] text-cyan-300">Atlas / U.S. study tool</div><h1 className="font-aspekta text-[17px] font-semibold leading-5">Land Intelligence</h1></div>
        <button type="button" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Light theme" : "Dark theme"} className="ml-1 rounded-lg border border-white/15 p-2 text-slate-200 hover:bg-white/10">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
      </div>
      <form onSubmit={search} className="pointer-events-auto relative flex w-full max-w-[370px] items-center gap-2 rounded-2xl border border-white/15 li-panel bg-slate-950/90 px-3 py-2 shadow-2xl backdrop-blur-xl sm:w-[370px]">
        <Search className="h-4 w-4 shrink-0 text-cyan-300" />
        <input value={query} onChange={(event) => { setQuery(event.target.value); setResults([]); setSearchError(""); }} placeholder="U.S. address or lat, lon" aria-label="Search U.S. address or coordinates" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-400" />
        {query && <button type="button" onClick={() => { setQuery(""); setResults([]); }} aria-label="Clear search" className="p-1 text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>}
        <button type="submit" disabled={searching || query.trim().length < 4} className="rounded-lg bg-cyan-400 px-2.5 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-50">{searching ? "Finding…" : "Find"}</button>
        {(results.length > 0 || searchError) && <div className="absolute left-0 right-0 top-[calc(100%+6px)] overflow-hidden rounded-xl border border-white/15 li-panel bg-slate-950 p-1 shadow-2xl">{results.map((result) => <button type="button" key={result.label} onClick={() => chooseResult(result)} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-slate-100 hover:bg-white/10">{result.label}</button>)}{searchError && <p className="px-3 py-2 text-xs text-amber-200">{searchError}</p>}</div>}
      </form>
    </header>

    {showCoverageNotice && <aside role="dialog" aria-label="Connected parcel states" className="pointer-events-auto absolute left-1/2 top-[116px] z-30 w-[min(390px,calc(100vw-24px))] -translate-x-1/2 rounded-2xl border border-white/15 li-panel bg-slate-950/95 p-4 text-xs shadow-2xl backdrop-blur-xl sm:top-24">
      <div className="flex items-start justify-between gap-3"><div><div className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-300">Parcel coverage</div><h2 className="mt-1 text-sm font-semibold text-white">Explore connected states</h2></div><button type="button" onClick={() => setShowCoverageNotice(false)} aria-label="Close parcel coverage notice" className="rounded-lg p-1 text-slate-300 hover:bg-white/10"><X className="h-4 w-4" /></button></div>
      <p className="mt-2 leading-relaxed text-slate-300">Parcel boundaries and available public property facts are connected in these states. Zoom to level 14 to see individual parcels.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{PARCEL_SOURCES.map((source) => <span key={source.id} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] text-cyan-100">{source.state}</span>)}</div>
      <p className="mt-3 text-[10px] leading-relaxed text-slate-400">Property fields vary by county. Other map layers may cover places beyond these parcel states.</p>
      <button type="button" onClick={() => { setShowCoverageNotice(false); setFlyTo({ center: [-105.5, 39.1], zoom: 6.5, nonce: Date.now() }); }} className="mt-3 rounded-lg bg-cyan-400 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-cyan-300">Back to Colorado</button>
    </aside>}

    <div className="pointer-events-auto absolute left-3 right-3 top-[145px] z-10 flex flex-wrap items-start gap-2 sm:left-5 sm:right-auto sm:top-28 sm:flex-col">
      <div className="flex rounded-2xl border border-white/15 li-panel bg-slate-950/90 p-1.5 shadow-2xl backdrop-blur-xl sm:block">
        <button type="button" onClick={() => setMode("browse")} title="Click mapped features to inspect them" aria-pressed={mode === "browse"} className={`flex items-center gap-1.5 rounded-xl px-2 py-2 text-left text-[11px] font-medium transition-colors sm:w-full sm:gap-2 sm:px-3 sm:py-2.5 sm:text-xs ${mode === "browse" ? "bg-cyan-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}><CircleHelp className="h-4 w-4" />Inspect</button>
        {TOOL.map(({ id, label, icon: Icon, hint }) => <button key={id} type="button" onClick={() => startTool(id)} title={hint} aria-pressed={mode === id} className={`flex items-center gap-1.5 rounded-xl px-2 py-2 text-left text-[11px] font-medium transition-colors sm:w-full sm:gap-2 sm:px-3 sm:py-2.5 sm:text-xs ${mode === id ? "bg-cyan-400 text-slate-950" : "text-slate-200 hover:bg-white/10"}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>
      <div className="flex gap-1 rounded-2xl border border-white/15 li-panel bg-slate-950/90 p-1.5 shadow-2xl backdrop-blur-xl sm:flex-col">
        <button type="button" title="Zoom in" onClick={() => map?.zoomIn()} className="rounded-xl p-2.5 text-slate-200 hover:bg-white/10"><Plus className="h-4 w-4" /></button>
        <button type="button" title="Zoom out" onClick={() => map?.zoomOut()} className="rounded-xl p-2.5 text-slate-200 hover:bg-white/10"><Minus className="h-4 w-4" /></button>
        <button type="button" title="Switch basemap" onClick={() => setBasemap((value) => value === "map" ? "satellite" : "map")} className="rounded-xl p-2.5 text-slate-200 hover:bg-white/10">{basemap === "map" ? <Satellite className="h-4 w-4" /> : <Layers3 className="h-4 w-4" />}</button>
        <button type="button" title="Map layers" aria-label="Map layers" aria-expanded={showLayers} onClick={() => setShowLayers((value) => !value)} className={`rounded-xl p-2.5 hover:bg-white/10 ${showLayers ? "bg-cyan-400/20 text-cyan-200" : "text-slate-200"}`}><Layers3 className="h-4 w-4" /></button>
        <button type="button" title="Clear drawing" onClick={clear} disabled={!shape} className="rounded-xl p-2.5 text-slate-200 hover:bg-white/10 disabled:opacity-35"><Eraser className="h-4 w-4" /></button>
      </div>
      {showLayers && <div className="max-h-[calc(100vh-250px)] w-[min(280px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-white/15 li-panel bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl sm:absolute sm:left-[100px] sm:top-0">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-semibold">Map layers</h2><button type="button" aria-label="Close map layers" onClick={() => setShowLayers(false)} className="rounded-lg p-1 text-slate-300 hover:bg-white/10"><X className="h-4 w-4" /></button></div>
        <p className="mb-3 text-[11px] leading-relaxed text-slate-400">Turn on source maps to explore. Layers appear as you zoom into their supported scale.</p>
        {LAND_OVERLAYS.map((layer) => <label key={layer.id} className="flex cursor-pointer items-start gap-2 border-t border-white/10 py-2.5"><input type="checkbox" checked={!!visibleLayers[`land-${layer.id}`]} onChange={(event) => setVisibleLayers((current) => ({ ...current, [`land-${layer.id}`]: event.target.checked }))} className="mt-0.5 accent-cyan-400" /><span className="min-w-0"><span className="block text-xs font-medium text-white">{layer.label}</span><span className="block text-[10px] text-slate-400">{layer.scope} · zoom {layer.minzoom}+</span><a href={layer.url} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="text-[10px] text-cyan-300 underline underline-offset-2">{layer.source}</a></span></label>)}
        <div className="border-t border-white/10 pt-3 text-[10px] leading-relaxed text-slate-400">Reference guides: <a href="https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">SSURGO</a> · <a href="https://www.fws.gov/program/national-wetlands-inventory" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">NWI</a> · <a href="https://www.nae.usace.army.mil/Missions/Regulatory/Jurisdiction-and-Wetlands/Wetland-Delineation-Manual/" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">USACE delineation</a> · <a href="https://highways.dot.gov/environment/noise" target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">FHWA noise</a>. USACE and FHWA provide guidance rather than map data here.</div>
      </div>}
    </div>

    <MapKey soils={!!visibleLayers["land-soils"]} parcels={!!visibleLayers["land-parcels"]} crashes={!!visibleLayers["land-crashes"]} soilStatus={soilStatus} parcelStatus={parcelStatus} crashStatus={crashStatus} />
    <MapInspection inspection={inspection} loading={inspectionLoading} components={soilComponents} error={soilDetailError} propertyDetail={propertyDetailResult?.key === propertyKey ? propertyDetailResult.detail : null} propertyLoading={propertyLoading} propertyError={propertyError} onInspectOther={inspectOtherAt} onInspectSoil={inspectSoilAt} onClose={() => { identifyController.current?.abort(); setInspection(null); setInspectionLoading(false); }} />

    <div className={`pointer-events-none absolute bottom-3 left-3 right-3 z-10 flex-col items-start gap-2 sm:bottom-5 sm:left-5 sm:right-auto ${shape && complete && showReport ? "hidden md:flex" : "flex"}`}>
      <div className="pointer-events-auto max-w-[340px] rounded-2xl border border-white/15 li-panel bg-slate-950/90 px-4 py-3 text-xs shadow-2xl backdrop-blur-xl">
        <p className="font-semibold text-white">{mode === "pin" ? "Drop a pin" : mode === "line" ? "Trace a route" : mode === "area" ? "Outline an area" : shape ? "Study shape ready" : "Choose a drawing tool"}</p>
        <p className="mt-1 leading-relaxed text-slate-300">{mode === "pin" ? "Click the map, or search for a U.S. address." : mode === "line" || mode === "area" ? "Click each corner, then finish. Drag any point to adjust it." : shape ? "Drag a point to refine the report." : "Use Pin, Route or Area to start."}</p>
        {measure && <div className="mt-2 font-mono text-cyan-200">{measure}</div>}
        {shape && shape.kind !== "pin" && !complete && <p className="mt-1 font-mono text-[10px] text-slate-400">{shape.points.length}/40 points{shape.points.length === 40 ? " · finish or undo to change" : ""}</p>}
        {(mode === "line" || mode === "area") && <div className="mt-3 flex gap-2"><button type="button" onClick={finish} disabled={!shape || !validShape(shape)} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 font-semibold text-slate-950 disabled:opacity-40"><Check className="h-3.5 w-3.5" />Finish</button><button type="button" onClick={undo} disabled={!shape?.points.length} className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1.5 text-slate-200 disabled:opacity-40"><Undo2 className="h-3.5 w-3.5" />Undo</button></div>}
        {shape && shape.kind !== "pin" && shape.points.length >= (shape.kind === "area" ? 3 : 2) && !validShape(shape) && <p className="mt-2 text-[10px] text-amber-200">The drawing crosses itself or is too small. Undo or drag a point to fix it.</p>}
      </div>
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-white/10 li-panel bg-slate-950/75 px-2.5 py-1.5 font-mono text-[10px] text-slate-300 backdrop-blur"><CircleHelp className="h-3 w-3" /> Screening only · source detail in report</div>
    </div>

    {shape && complete && <div className={`pointer-events-auto absolute z-20 overflow-hidden rounded-2xl border border-white/15 li-panel bg-slate-950/95 shadow-2xl backdrop-blur-xl transition-all ${showReport ? "bottom-3 left-3 right-3 max-h-[55vh] sm:bottom-5 sm:left-auto sm:right-5 sm:max-h-[calc(100vh-130px)] sm:w-[380px]" : "bottom-3 right-3 w-auto sm:bottom-5 sm:right-5"}`}>
      <button type="button" onClick={() => setShowReport((value) => !value)} className="flex w-full items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-left text-sm font-semibold"><span>Location report</span>{showReport ? <Minus className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</button>
      {showReport && <div className="max-h-[calc(55vh-48px)] space-y-3 overflow-y-auto p-4 sm:max-h-[calc(100vh-180px)]">
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

const FINDING_ICONS = { "Ground elevation": Mountain, "FEMA flood mapping": Waves, "Mapped waterways": Droplets, "Mapped wetlands": Sprout, "Mapped faults": Activity, "Public parcel records": Layers3, "Soil map units": Sprout, "EPA regulated facilities": Building2, "Census tract context": Users, "Colorado highways": Route, "Fatal crashes (2024)": CarFront } as const;

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
