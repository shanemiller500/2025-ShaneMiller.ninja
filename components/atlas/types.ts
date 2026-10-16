/* ------------------------------------------------------------------ */
/*  Atlas layer registry — every map project declares its layers as    */
/*  AtlasLayer objects and <AtlasMap> handles the rest: installing     */
/*  them on the map (again after a basemap/theme swap), visibility,    */
/*  clicks, hover labels, selection highlight and animation.           */
/* ------------------------------------------------------------------ */
import type { Map as MlMap, MapGeoJSONFeature } from "maplibre-gl";

export interface Citation {
  label: string;
  href: string;
  license?: string;
}

export interface LegendItem {
  color: string;
  label: string;
  shape?: "dot" | "line" | "ring";
}

/** What the user clicked — handed to the project's detail drawer. */
export interface Picked {
  /** AtlasLayer id */
  layer: string;
  /** feature id when the layer has one (for the selection highlight) */
  id?: string | number;
  props: Record<string, unknown>;
  lngLat: [number, number];
}

export interface InstallContext {
  dark: boolean;
  /** first symbol (label) layer in the basemap — put area/line layers beneath it */
  labelLayerId?: string;
}

export interface AtlasLayer {
  id: string;
  label: string;
  /** Panel heading the toggle sits under, e.g. "Live" or "Tectonics" */
  group: string;
  description?: string;
  /** Short caveat chip, e.g. "U.S. only" */
  badge?: string;
  defaultOn?: boolean;
  legend?: LegendItem[];
  citation: Citation;
  /** Add sources + style layers. Return the style-layer ids this layer owns. */
  install(map: MlMap, ctx: InstallContext): string[];
  /** Style layers to hit-test on click/hover (subset of what install returned). */
  clickable?: string[];
  /** GeoJSON source whose features can be highlighted with feature-state `selected`. */
  selectSource?: string;
  /** Raster layers have no client-side features: look up what's under a click instead. */
  identify?(map: MlMap, lngLat: [number, number], signal: AbortSignal): Promise<Picked | null>;
  /** Short tooltip on hover. */
  hoverLabel?(f: MapGeoJSONFeature): string | null;
  /** Per-frame hook while the layer is visible (pulses, etc). */
  animate?(map: MlMap, now: number): void;
  /** Time replay: filter/fade features to the cursor. `null` = back to live. */
  applyTime?(map: MlMap, time: AtlasTime | null): void;
}

/** Replay state handed to time-aware layers. Times are epoch ms. */
export interface AtlasTime {
  cursor: number;
  /** how long a feature stays bright after it appears */
  trail: number;
  /** window that counts as "just happened" (flash) */
  flash: number;
}

export interface AtlasView {
  bounds: [number, number, number, number];
  zoom: number;
  center: [number, number];
}

export type Basemap = "map" | "satellite";
export type TerrainMode = "flat" | "relief" | "3d";
