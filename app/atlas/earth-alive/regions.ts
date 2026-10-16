/* ------------------------------------------------------------------ */
/*  Places worth seeing from below — where a subducting plate lights   */
/*  up as a sheet of earthquakes diving into the mantle.               */
/*  Catalog thresholds keep each region at ~1–4k events.               */
/* ------------------------------------------------------------------ */

export interface DepthRegion {
  key: string;
  name: string;
  blurb: string;
  /** [w, s, e, n] — w > e crosses the antimeridian */
  bbox: [number, number, number, number];
  minmag: number;
  years: number;
}

export const DEPTH_REGIONS: DepthRegion[] = [
  {
    key: "tonga",
    name: "Tonga – Fiji",
    blurb: "The deepest earthquakes on Earth: the Pacific plate plunges almost 700 km into the mantle here, fast.",
    bbox: [174, -26, -171, -14],
    minmag: 4.5,
    years: 5,
  },
  {
    key: "japan",
    name: "Japan",
    blurb: "Two slabs at once — the Pacific plate from the east, the Philippine Sea plate from the south.",
    bbox: [136, 31, 146, 44],
    minmag: 4,
    years: 5,
  },
  {
    key: "alaska",
    name: "Southern Alaska",
    blurb: "The slab behind the 1964 M9.2 — follow it down to ~200 km beneath Anchorage and the Alaska Range volcanoes.",
    bbox: [-158, 57, -146, 64],
    minmag: 2.5,
    years: 2,
  },
  {
    key: "cascadia",
    name: "Cascadia",
    blurb: "A quiet, locked subduction zone: few deep quakes, but it last ruptured in an M9 in January 1700.",
    bbox: [-128, 40, -119, 50],
    minmag: 2,
    years: 3,
  },
  {
    key: "chile",
    name: "Chile – Peru",
    blurb: "The Nazca plate under South America — a long, shallow-dipping slab that builds the Andes.",
    bbox: [-76, -35, -62, -14],
    minmag: 4.5,
    years: 5,
  },
  {
    key: "central-america",
    name: "Central America",
    blurb: "The Cocos plate dives under Mexico and Central America, feeding a chain of volcanoes.",
    bbox: [-95, 8, -82, 18],
    minmag: 4,
    years: 5,
  },
  {
    key: "sumatra",
    name: "Sumatra – Java",
    blurb: "Where the 2004 M9.1 began — the Indo-Australian plate sliding under Indonesia.",
    bbox: [94, -10, 112, 6],
    minmag: 4.5,
    years: 5,
  },
  {
    key: "hindu-kush",
    name: "Hindu Kush",
    blurb: "A rare nest of intermediate-depth quakes under a continent — a slab hanging almost vertically.",
    bbox: [66, 34, 74, 39],
    minmag: 4,
    years: 5,
  },
];
