// Market overlays: one shared definition for map paint, legend and the /market-map response. Client-safe.
// Colors are the reference data-viz palette: a single-hue blue ramp (steps 250/350/450/600, the range that stays
// visible on both light and dark basemaps, validated as an ordinal ramp in both modes) and, for price change, a
// diverging scale with red for decline and a gray "about flat" midpoint. Fixed national breaks, so a color means
// the same thing anywhere.

export type MarketLayerId = "market-value" | "market-rent" | "market-trend" | "market-permits";
export type MarketLevel = "tract" | "county" | "parcel";
export type MarketClass = { color: string; label: string; max: number | null };
export type MarketLayerDef = { id: MarketLayerId | "parcel-value"; property: string; level: MarketLevel; title: string; note: string; classes: MarketClass[] };

const BLUE = ["#86b6ef", "#5598e7", "#2a78d6", "#184f95"];
export const NO_DATA_COLOR = "#898781";

export const MARKET_LAYERS: Record<MarketLayerId, MarketLayerDef> = {
  "market-value": {
    id: "market-value", property: "medianValue", level: "tract", title: "Median home value · ACS 2020–2024",
    note: "Owner-occupied homes; faded = low-reliability estimate. Not this parcel's value.",
    classes: [{ max: 250000, label: "Under $250k" }, { max: 500000, label: "$250k–500k" }, { max: 1000000, label: "$500k–1M" }, { max: null, label: "$1M or more" }].map((item, i) => ({ ...item, color: BLUE[i] })),
  },
  "market-rent": {
    id: "market-rent", property: "medianRent", level: "tract", title: "Median gross rent · ACS 2020–2024",
    note: "Rent plus utilities, renter-occupied homes; faded = low-reliability estimate.",
    classes: [{ max: 1000, label: "Under $1,000" }, { max: 1500, label: "$1,000–1,500" }, { max: 2000, label: "$1,500–2,000" }, { max: null, label: "$2,000 or more" }].map((item, i) => ({ ...item, color: BLUE[i] })),
  },
  "market-trend": {
    id: "market-trend", property: "fiveYear", level: "tract", title: "Home price change, 5 years · FHFA tract index",
    note: "Calculated from FHFA's developmental annual tract index; tracts FHFA does not publish are unshaded.",
    classes: [
      { max: 0, label: "Decline", color: "#e34948" }, { max: 0.1, label: "0 to 10%", color: NO_DATA_COLOR },
      { max: 0.25, label: "10 to 25%", color: BLUE[0] }, { max: 0.4, label: "25 to 40%", color: BLUE[1] }, { max: 0.55, label: "40 to 55%", color: BLUE[2] }, { max: null, label: "55% or more", color: BLUE[3] },
    ],
  },
  "market-permits": {
    id: "market-permits", property: "permitsPerThousand", level: "county", title: "New housing permitted per 1,000 homes · latest year",
    note: "Census Building Permits Survey units ÷ ACS housing units × 1,000 (calculated). Permits are not completions.",
    classes: [{ max: 2, label: "Under 2" }, { max: 5, label: "2 to 5" }, { max: 10, label: "5 to 10" }, { max: null, label: "10 or more" }].map((item, i) => ({ ...item, color: BLUE[i] })),
  },
};

/** Statewide parcel value density: the layer's published total ÷ acres (CO, WA, FL, NC, WI; Utah publishes no value). */
export const PARCEL_VALUE_LAYER: MarketLayerDef & { id: "parcel-value" } = {
  id: "parcel-value", property: "valuePerAcre", level: "parcel", title: "Reported parcel value per acre",
  note: "Statewide value field ÷ mapped acres (calculated). Definitions differ by state (actual, just, assessed or market value). Condo units sharing a footprint are summed; small parcels read high.",
  classes: [{ max: 100000, label: "Under $100k/acre" }, { max: 1000000, label: "$100k–1M" }, { max: 5000000, label: "$1M–5M" }, { max: null, label: "$5M or more" }].map((item, i) => ({ ...item, color: BLUE[i] })),
};

/** Class index for a value; a value equal to a break falls in the higher class (as MapLibre `step` does), except 0 counts as decline. -1 without a value. */
export function classOf(def: MarketLayerDef, value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return -1;
  const index = def.classes.findIndex((item) => item.max == null || value < item.max || (item.max === 0 && value <= 0));
  return index;
}

/** MapLibre `step` expression on the layer's property; features without a value are not painted. */
export function fillColorExpression(def: MarketLayerDef): unknown[] {
  const expression: unknown[] = ["step", ["get", def.property], def.classes[0].color];
  def.classes.slice(0, -1).forEach((item, i) => expression.push(item.max === 0 ? 0.0000001 : item.max, def.classes[i + 1].color));
  return expression;
}
