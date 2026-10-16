/* ------------------------------------------------------------------ */
/*  Tectonic plates — PB2002 (Bird 2003) boundary classes + names.     */
/*  The typed GeoJSON is baked by scripts/atlas/build-plates.mjs.      */
/* ------------------------------------------------------------------ */

export const PLATES_URL = "/atlas/plates.json";

export type BoundaryClass = "SUB" | "OSR" | "CRB" | "OTF" | "CTF" | "OCB" | "CCB";

export interface PlateBoundaryProps {
  /** e.g. "NA-PA" */
  name: string;
  a: string;
  b: string;
  cls: BoundaryClass;
  /** mean relative velocity, mm/yr */
  v: number;
}

/** Four map styles (what you see) over seven PB2002 classes (what the popup says). */
export const BOUNDARY_KINDS = [
  { key: "subduction", label: "Subduction zone", color: "#e11d48", classes: ["SUB"] },
  { key: "convergent", label: "Collision / convergent", color: "#f59e0b", classes: ["OCB", "CCB"] },
  { key: "spreading", label: "Spreading ridge / rift", color: "#0ea5e9", classes: ["OSR", "CRB"] },
  { key: "transform", label: "Transform fault", color: "#a855f7", classes: ["OTF", "CTF"] },
] as const;

export const BOUNDARY_CLASS_LABEL: Record<BoundaryClass, string> = {
  SUB: "Subduction zone",
  OSR: "Oceanic spreading ridge",
  CRB: "Continental rift",
  OTF: "Oceanic transform fault",
  CTF: "Continental transform fault",
  OCB: "Oceanic convergent boundary",
  CCB: "Continental collision",
};

export const BOUNDARY_CLASS_BLURB: Record<BoundaryClass, string> = {
  SUB: "One plate dives beneath the other. These produce the deepest and largest earthquakes on Earth, and chains of explosive volcanoes.",
  OSR: "Plates pull apart under the ocean and new crust wells up from the mantle — mostly small, shallow earthquakes.",
  CRB: "A continent is being stretched and may eventually split, opening a new ocean basin.",
  OTF: "Plates slide past each other sideways, offsetting segments of a mid-ocean ridge.",
  CTF: "Plates grind past each other on land — think the San Andreas fault.",
  OCB: "Plates converge under the ocean without a well-developed subduction zone.",
  CCB: "Two continents collide and crumple upward into mountain belts like the Himalaya.",
};

export const boundaryColor = (cls: BoundaryClass) =>
  BOUNDARY_KINDS.find((k) => (k.classes as readonly string[]).includes(cls))?.color ?? "#64748b";

export const PLATE_NAMES: Record<string, string> = {
  AF: "Africa", AM: "Amur", AN: "Antarctica", AP: "Altiplano", AR: "Arabia", AS: "Aegean Sea",
  AT: "Anatolia", AU: "Australia", BH: "Birds Head", BR: "Balmoral Reef", BS: "Banda Sea", BU: "Burma",
  CA: "Caribbean", CL: "Conway Reef", CO: "Cocos", CR: "Caroline", EA: "Easter", EU: "Eurasia",
  FT: "Futuna", GP: "Galápagos", IN: "India", JF: "Juan de Fuca", JZ: "Juan Fernández", KE: "Kermadec",
  MA: "Mariana", MN: "Manus", MO: "Maoke", MS: "Molucca Sea", NA: "North America", NB: "North Bismarck",
  ND: "North Andes", NH: "New Hebrides", NI: "Niuafo'ou", NZ: "Nazca", OK: "Okhotsk", ON: "Okinawa",
  PA: "Pacific", PM: "Panama", PS: "Philippine Sea", RI: "Rivera", SA: "South America", SB: "South Bismarck",
  SC: "Scotia", SL: "Shetland", SO: "Somalia", SS: "Solomon Sea", SU: "Sunda", SW: "Sandwich",
  TI: "Timor", TO: "Tonga", WL: "Woodlark", YA: "Yangtze",
};

export const plateName = (code: string) => PLATE_NAMES[code] ?? code;
